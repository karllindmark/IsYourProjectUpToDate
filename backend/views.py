from distutils.version import LooseVersion
import fnmatch

from requests.packages.urllib3.exceptions import ProtocolError, ConnectionError, ConnectTimeoutError
import requests

from backend.JsonHttpResponseBuilder import JsonHttpResponseBuilder
from backend.projectfiles import ProjectFileBuilder, PROJECT_FILES

GITHUB_API_HOST = "https://api.github.com"
GITHUB_BRANCH_LIST_URL = GITHUB_API_HOST + "/repos/{github_info}/branches"
GITHUB_REPO_LIST_URL = GITHUB_API_HOST + "/users/{github_user}/repos"
GITHUB_LIST_URL = GITHUB_API_HOST + "/search/code?q={project_file}+in:path+repo:{github_info}"


def find_user_repos(request):
    github_user = request.POST.get('github-user')
    if not github_user:
        return JsonHttpResponseBuilder("ERROR", "No user specified.").build()

    url = GITHUB_REPO_LIST_URL.format(github_user=github_user)
    try:
        response = requests.get(url).json()
    except (ProtocolError, ConnectionError, ConnectionError):
        return JsonHttpResponseBuilder("ERROR", "Unable to connect to Github. Please try again later").build()

    if not type(response) is list:
        return JsonHttpResponseBuilder("ERROR", "No repos found for %s" % github_user).build()
    else:
        return JsonHttpResponseBuilder("SUCCESS", "", response).build()


def find_project_branches(request):
    github_info = request.POST.get('github-info')
    if not github_info:
        return JsonHttpResponseBuilder("ERROR", "No github info specified.").build()

    url = GITHUB_BRANCH_LIST_URL.format(github_info=github_info)
    try:
        response = requests.get(url).json()
    except (ProtocolError, ConnectTimeoutError, ConnectionError):
        return JsonHttpResponseBuilder("ERROR", "Unable to connect to Github. Please try again later.").build()

    if not type(response) is list:
        return JsonHttpResponseBuilder("ERROR", "No branches found for %s!" % github_info).build()
    else:
        return JsonHttpResponseBuilder("SUCCESS", "", response).build()


def find_project_files(request):
    github_info = request.POST.get('github-info')
    project_branch = request.POST.get('project-branch')
    project_type = request.POST.get('project-type')
    project = PROJECT_FILES.get(project_type)

    if not github_info or not project_type or not project_branch:
        return JsonHttpResponseBuilder("ERROR", "Oops, something bad happened.").build()
    elif not project:
        return JsonHttpResponseBuilder("ERROR", "Unsupported project type: " + project_type).build()

    url = GITHUB_LIST_URL.format(project_branch=project_branch,
                                 project_file=project.get('file'),
                                 github_info=github_info)
    try:
        response = requests.get(url).json()
    except (ProtocolError, ConnectTimeoutError, ConnectionError):
        return JsonHttpResponseBuilder("ERROR", "Unable to connect to Github. Please try again later.").build()

    if response.get('errors'):
        return JsonHttpResponseBuilder("ERROR", "Invalid user or repository name. Please try again.").build()
    elif not response.get('items'):
        return JsonHttpResponseBuilder("ERROR", "The given project is not using " + project.get('name') + ".").build()

    project_files = [file_path
                     for file_path in response.get('items')
                     if fnmatch.fnmatch(file_path['name'], project.get('file'))]
    if project_files:
        return JsonHttpResponseBuilder("SUCCESS", "", {"files": project_files}).build()
    else:
        return JsonHttpResponseBuilder("ERROR", "No valid project files found.").build()


def find_dependencies(request):
    selected_files = request.POST.getlist('selected')
    project_type = request.POST.get('project-type')

    if not selected_files:
        return JsonHttpResponseBuilder("ERROR", "No project files selected.").build()
    elif not project_type:
        return JsonHttpResponseBuilder("ERROR", "No project type selected.").build()

    file_results = []
    for selected_file in selected_files:
        url, path = selected_file.split("|")
        try:
            response = requests.get(url.replace("/blob/", "/raw/"))
        except (ProtocolError, ConnectTimeoutError, ConnectionError):
            return JsonHttpResponseBuilder("ERROR",
                                           "Request failed while fetching the project files. " +
                                           "Please try again later.").build()

        dependencies = ProjectFileBuilder.create(project_type, selected_file, response).extract()
        if dependencies:
            file_results.append({
                'path': path,
                'url': url,
                'dependencies': dependencies
            })

    if file_results:
        return JsonHttpResponseBuilder("SUCCESS", "Dependencies found.", {"files": file_results}).build()
    else:
        return JsonHttpResponseBuilder("NO_DEPENDENCIES", "No project files found.").build()


# FIXME: This is too specific for Gradle + Maven (especially Maven Central)
def check_for_updates(request):
    group = request.POST.get("group")
    artifact = request.POST.get("artifact")
    version = request.POST.get("version")
    project_type = request.POST.get("project-type")

    if not project_type:
        return JsonHttpResponseBuilder("ERROR", "Missing project type.").build()

    gav_string = ":".join([group, artifact, version])

    urls = PROJECT_FILES[project_type]['urls']
    for url in urls:
        url = url.format(group=group, artifact=artifact)
        try:
            response = requests.get(url).json()['response']
        except (ProtocolError, ConnectTimeoutError, ConnectionError, KeyError):
            return JsonHttpResponseBuilder("ERROR", "Request failed. Please try again later.").build()

        if response.get('numFound', 0) == 0:
            continue

        latest_version = response['docs'][0]['latestVersion']

        # FIXME (2014-09-10): We should handle attributes accordingly, but at the moment we'll just "ignore" it.
        if version[0] == '$' or version != '+' and LooseVersion(latest_version) > LooseVersion(version):
            gav_string = ":".join([group, artifact, latest_version])
            return JsonHttpResponseBuilder("UPDATE_FOUND",
                                           str(latest_version),
                                           {"gav_string": gav_string, 'latest_version': latest_version}).build()
        else:
            return JsonHttpResponseBuilder("UP-TO-DATE", str(latest_version), {"gav_string": gav_string}).build()
    return JsonHttpResponseBuilder("ERROR", "Not available in Maven Central.", {"gav_string": gav_string}).build()