(function() {
    var app = angular.module('demo', ["ngCookies", "searchModule", "projectOptionsModule"]);
    app.run(function($http, $cookies, $rootScope) {
        var csrf_cookie_name = "csrftoken";

        $http.defaults.headers.xsrfHeaderName = "X-CSRFToken";
        $http.defaults.xsrfCookieName = csrf_cookie_name;
        $http.defaults.headers.common['X-CSRFToken'] = $cookies[csrf_cookie_name];
        $http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

        $rootScope.step = 1;
    });

    app.filter('unsafe', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    });

    app.controller('MainController', function($scope, $rootScope){
        $rootScope.github_username = '';
        $rootScope.github_repo = '';
        $rootScope.project_type = 'gradle';
        $rootScope.project_branch = 'default';
        $rootScope.getGithubProject = function() {
            return $rootScope.github_username + "/" + $rootScope.github_repo;
        };
    });

    // Add them to the app
    /*
    app.controller('FileListController', FileListController);
    app.controller('DependencyListController', DependencyListController);
    app.controller('ExportController', ExportController);

    function FileListController($scope, $rootScope, $http) {
        $scope.running = false;
        $scope.files = [];
        $scope.error_text = "";
        $scope.warning_text = "";
        $scope.progress_text = "";

        // TODO: Remove listener on destroy?
        $scope.$on('ProjectFilesFound', function(event, data) {
            $scope.files = data.files;
        });

        $scope.toggleAllRows = function(event) {
            var value = event.currentTarget.checked;
            $scope.files.forEach(function(file) {
                file.selected = value;
            });
        };

        $scope.checkIfAllRowsAreChecked = function() {
            var file_count = 0;
            $scope.files.forEach(function(file) {
                if (file.selected === true) {
                    file_count = file_count + 1;
                }
            });
            $scope.toggle_status = file_count === $scope.files.length;
        };

        $scope.generateMapListForFiles = function(files) {
            var list = [];
            files.forEach(function(file) {
                if (file.selected) {
                    list.push({name: "selected", value: file.html_url + "|" + file.path });
                }
            });
            return list;
        };

        $scope.fetchDependencies = function(event) {
            $scope.error_text = "";
            $scope.warning_text = "";
            $scope.progress_text = "";

            // Silently exit if it's running or something else than a form submission or "button" triggering
            if ($scope.running || (event.type === "keypress" && event.keyCode !== 13)) {
                return;
            }
            $scope.running = true;

            var selected_files = $scope.generateMapListForFiles($scope.files);
            if (selected_files.length === 0) {
                $scope.error_text = "No files selected. You'll need to select at least one of the above.";
                $scope.running = false;
                return;
            }

            $scope.progress_text = 'Gathering dependencies (this might take a while)...';
            $http({
                method: 'POST',
                url: '/api/find-dependencies/',
                data: $.param([{name: "project-type", value: $rootScope.project_type}].concat(selected_files)),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': $rootScope.csrf_token }
            }).success(function(data) {
                if (data.status === 'SUCCESS') {
                    $scope.$parent.$broadcast('DependenciesFound', { files: data.files });
                    $('html, body').animate({
                        scrollTop: $("#step-project-deps").offset().top
                    }, 800);
                    $scope.running = false;
                } else {
                    $scope.error_text = data.message;
                    $scope.running = false;
                }
            }).error(function(data) {
                $scope.error_text = data;
                $scope.running = false;
            });
            $scope.running = false;
        };
    }

    function DependencyListController($scope, $rootScope, $http) {
        $scope.files = [];
        $scope.error_text = "";
        $scope.warning_text = "";
        $scope.progress_text = "";

        // TODO: Remove listener on destroy?
        $scope.$on('DependenciesFound', function(event, data) {
            $scope.files = data.files;

            angular.forEach($scope.files, function(file) {
                angular.forEach(file.dependencies, function(dependency) {
                    $scope.checkForUpdate(dependency);
                });
            });
        });

        $scope.checkForUpdate = function(dependency) {
            $scope.error_text = "";
            $scope.warning_text = "";
            $scope.progress_text = "";

            var postdata = {
                'group': dependency.group,
                'artifact': dependency.artifact,
                'version': dependency.version,
                'project-type': $rootScope.project_type
            };

            dependency.latest_version = "Loading...";
            $http({
                method: 'POST',
                url: '/api/check-for-updates/',
                data: $.param(postdata),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': $rootScope.csrf_token }
            }).success(function(data) {
                if (data.status === 'UPDATE_FOUND') {
                    dependency.has_update = true;
                    dependency.gav = data.gav_string;
                    dependency.latest_version = data.latest_version;
                    dependency.latest_version_subtitle = '<span class="dependency-meta">Update available</span>';
                } else if (data.status === 'UP-TO-DATE') {
                    dependency.has_update = false;
                    dependency.latest_version = data.version;
                    dependency.latest_version_subtitle = '<span class="dependency-meta">Up to date</span>';
                } else {
                    dependency.has_update = false;
                    dependency.latest_version = data.version;
                    dependency.latest_version_subtitle = '<span class="dependency-meta">:-(</span>';
                }

                // FIXME: Workaround as it's impossible to know who'll be done last
                $scope.setupClipboard(jQuery('.clipboard-button'));

                $scope.running = false;
            }).error(function(data) {
                $scope.error_text = data;
                $scope.running = false;
            });

            $scope.setupClipboard = function(element) {
                var client = new ZeroClipboard(element, { moviePath: "ZeroClipboard.swf", debug: false });
                client.on("load", function(client) {
                    client.on("complete", function(client, args) {
                        client.setText(args.text);
                    });
                });
            };
        };
    }

    function ExportController($scope, $rootScope) {
        $scope.buildMessage = function(project, files, is_markdown) {
            var message = is_markdown ? "# " : "";
            message += "Hello world!\n\nWe've found updates to the following dependencies used in " +
                       (is_markdown? "**" : "") + project +
                       (is_markdown? "**" : "") + ":\n\n";

            var latest_path = '';
            files.forEach(function(file) {
                if (file.path != latest_path) {
                    latest_path = file.path;
                    message += "File: " + latest_path + "\n\n";
                }

                file.dependencies.forEach(function(dependency) {
                    message += (is_markdown? "**" : "    ") +
                               dependency.artifact +
                               (is_markdown? "**" : "") + " " +
                               dependency.version + "--> " +
                               dependency.latest_version + '\n' +
                               (is_markdown? "`" : "    ") + '"' +
                               dependency.group + ":" +
                               dependency.artifact + ":" +
                               dependency.latest_version + '"' +
                               (is_markdown? "`" : "") + '\n\n\n';
                });
            });

            message += "*This list was generated via " + document.URL + "*";
            return encodeURIComponent(message);
        };

        $scope.exportToEmail = function(files) {
            var project = $rootScope.getGithubProject();
            var subject = encodeURIComponent("Project Dependency Status for " + project);
            window.location.href = "mailto:?subject=" + subject + "&body=" + $scope.buildMessage(project, files, false);
        };

        $scope.exportToGithub = function(files) {
            var project = $rootScope.getGithubProject();
            var title = encodeURIComponent("Project Dependency Status");
            var body = $scope.buildMessage(project, files, true);
            var url = 'https://github.com/' + project + '/issues/new?title=' + title + '&body=' + body;
            window.open(url, '_blank');
        };
    }*/
})();