from backend.projectfiles.GenericProjectFile import GenericProjectFile
from bs4 import BeautifulSoup


class MavenProjectFile(GenericProjectFile):
    """ Maven project file implementation to extract dependencies """
    def extract(self):
        dependencies = []

        root = BeautifulSoup(self.result.text)
        for dependency in root.find_all('dependency'):
            group = dependency.groupid.text
            artifact = dependency.artifactid.text
            version = dependency.version.text
            dependencies.append({'group': group,
                                 'artifact': artifact,
                                 'version': version,
                                 'gav': ":".join([group, artifact, version])})
        return dependencies