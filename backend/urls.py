from django.conf.urls import patterns, url
from backend import views

""" URL setup (kinda like htaccess) """

urlpatterns = patterns(
    '',
    url(r'^find-user-repos/$', views.find_user_repos, name="find_user_repos"),
    url(r'^find-project-branches/$', views.find_project_branches, name="find_project_branches"),
    url(r'^find-project-files/$', views.find_project_files, name="find_gradle_files"),
    url(r'^find-dependencies/$', views.find_dependencies, name="find_dependencies"),
    url(r'^check-for-updates/$', views.check_for_updates, name="check_for_updates")
)
