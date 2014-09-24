jQuery(document).ready(function() {
    jQuery('a[data-target]').click(function () {
        jQuery('#' + jQuery(this).attr('data-target')).slideToggle(400);
    });
});
(function() {
    var GITHUB_URL_REGEX = /^(?:(?:http(?:s)?:\/\/)?(?:www\.)?)github\.com\//i;
    var USER_REPO_REGEX = /^([\w-]+)\/([\w.-]+)$/i;
    var INVALID_LETTERS_REGEX = /[^\w\/\.-]/g;

    var app = angular.module('demo', []);

    app.filter('unsafe', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    });
    app.controller('MainController', function($scope, $rootScope){
        $rootScope.project_type = 'gradle';
        $rootScope.csrf_token = jQuery('input[name=csrfmiddlewaretoken]').val();
        $rootScope.getGithubProject = function() {
            return $rootScope.github_username + "/" + $rootScope.github_repo;
        };
    });

    // Add them to the app
    app.controller('SearchController', SearchController);
    app.controller('FileListController', FileListController);
    app.controller('DependencyListController', DependencyListController);
    app.controller('ExportController', ExportController);

    function SearchController($scope, $rootScope, $http) {
        $scope.running = false;
        $scope.error_text = "";
        $scope.warning_text = "";
        $scope.progress_text = "";
        $scope.updateProjectType = function() {
            $rootScope.project_type = $scope.selected_type;
        };

        $scope.triggerSearch = function($event) {
            $scope.error_text = "";
            $scope.warning_text = "";
            $scope.progress_text = "";
            // Silently exit if it's running or something else than a form submission or "button" triggering
            if ($scope.running || ($event.type === "keypress" && $event.keyCode !== 13)) {
                return;
            }
            $scope.running = true;

            var github_info = $scope.github_info;
            var project_type = $rootScope.project_type;
            var token = $rootScope.csrf_token;

            // Did we even get Github info?
            if (!github_info) {
                $scope.warning_text = 'You forgot to fill in the field below!';
                $scope.running = false;
                return;
            }

            // Strip away the Github url from the search string
            github_info = github_info.replace(GITHUB_URL_REGEX, "");

            // Search for invalid characters
            var found_invalid_letters = github_info.match(INVALID_LETTERS_REGEX);
            if (found_invalid_letters != null && found_invalid_letters.length > 0) {
                $scope.error_text = 'Invalid characters: ' + $.unique(found_invalid_letters).join(" ") + ' <br>' +
                    'Valid username/repository characters are alphanumerics, dashes and punctuations.';
                $scope.running = false;
                return;
            }

            // Check that we have a username and a repo name separated by a "/"
            var user_repo_match = USER_REPO_REGEX.exec(github_info);
            if (user_repo_match === null) {
                $scope.error_text = 'Invalid format, expected one of the following:<br><br>' +
                    '- &lt;username&gt;/&lt;repository&gt;<br>' +
                    '- [[http[s]://]www.github.com/]&lt;username&gt;/&lt;repository&gt;<br><br>' +
                    'Valid username/repository characters are alphanumerics, dashes and punctuations.';
                $scope.running = false;
                return;
            }

            // Store the user upstairs
            $rootScope.github_username = user_repo_match[1];
            $rootScope.github_repo = user_repo_match[2];

            $scope.progress_text = "Searching for " + user_repo_match[0] + " on Github...";

            var postData = {
                "github-info": user_repo_match[0],
                "project-type": project_type,
                "csrfmiddlewaretoken": token
            };

            $http({
                method: 'POST',
                url: '/api/find-project-files/',
                data: $.param(postData),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': token }
            }).success(function(data) {
                if (data.status === 'SUCCESS') {
                    $scope.$parent.$broadcast('ProjectFilesFound', { files: data.files });
                    jQuery('#step-1').fadeOut(400, function () {
                        $scope.running = false;
                        jQuery("#step-2").fadeIn(400);
                    });
                } else {
                    $scope.error_text = data.message;
                    $scope.running = false;
                }
            }).error(function(data) {
                $scope.error_text = data;
                $scope.running = false;
            });
        }
    }

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

        $scope.toggleAllRows = function($event) {
            var value = $event.currentTarget.checked;
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

        $scope.fetchDependencies = function($event) {
            $scope.error_text = "";
            $scope.warning_text = "";
            $scope.progress_text = "";
            // Silently exit if it's running or something else than a form submission or "button" triggering
            if ($scope.running || ($event.type === "keypress" && $event.keyCode !== 13)) {
                return;
            }
            $scope.running = true;

            var selected_files = $scope.generateMapListForFiles($scope.files);
            if (selected_files.length === 0) {
                console.log("How the fuck are we even here? Length => " + selected_files.length);
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
                    jQuery('#step-2').fadeOut(400, function () {
                        $scope.running = false;
                        jQuery("#step-3").fadeIn(400);
                    });
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

        $scope.normalize_dependency = function(dependency) {
            return (dependency.g + "_" + dependency.a + "_" + dependency.v).replace(/\W/g, '_');
        };

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
                'group': dependency.g,
                'artifact': dependency.a,
                'version': dependency.v,
                'project-type': $rootScope.project_type
            };
            $http({
                method: 'POST',
                url: '/api/check-for-updates/',
                data: $.param(postdata),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': $rootScope.csrf_token }
            }).success(function(data) {
                var id = '#progress-' + $scope.normalize_dependency(dependency);
                var element = jQuery(id);
                var row = element.parent();
                var button = element.siblings().find(".clipboard-button");

                if (data.status === 'UPDATE_FOUND') {
                    row.addClass("has-update-available");
                    row.attr("data-new-version", data.new_version);
                    element.html(data.message + '<span class="dependency-meta">Update available</span>');
                } else if (data.status === 'UP-TO-DATE') {
                    element.html(data.message + '<span class="dependency-meta">Up to date</span>');
                } else {
                    element.html(data.message + '<span class="dependency-meta">:-(</span>');
                }

                button.attr('data-clipboard-text', data.gav_string);
                $scope.setupClipboard(button);
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
        $scope.buildMessage = function(project, is_markdown) {
            var message = is_markdown ? "# " : "";
            message += "Hello world!\n\nWe've found updates to the following dependencies used in " +
                       (is_markdown? "**" : "") + project +
                       (is_markdown? "**" : "") + ":\n\n";

            var latest_path = '';

            $('.has-update-available').each(function() {
                var elem = $(this);

                if (elem.attr('data-path') !== latest_path) {
                    latest_path = elem.attr('data-path');

                    message += "File: " + latest_path + "\n\n";
                }

                message += (is_markdown? "**" : "    ") +
                           elem.attr('data-artifact') +
                           (is_markdown? "**" : "") + " " +
                           elem.attr('data-version') + "--> " +
                           elem.attr('data-new-version') + '\n' +
                           (is_markdown? "`" : "    ") + '"' +
                           elem.attr('data-group') + ":" +
                           elem.attr('data-artifact') + ":" +
                           elem.attr('data-new-version') + '"' +
                           (is_markdown? "`" : "") + '\n\n\n';
            });

            message += "*This list was generated via " + document.URL + "*";
            return encodeURIComponent(message);
        };

        $scope.exportToEmail = function() {
            var project = $rootScope.getGithubProject();
            var subject = encodeURIComponent("Project Dependency Status for " + project);
            window.location.href = "mailto:?subject=" + subject + "&body=" + $scope.buildMessage(project, false);
        };

        $scope.exportToGithub = function() {
            var project = $rootScope.getGithubProject();
            var title = encodeURIComponent("Project Dependency Status");
            var body = $scope.buildMessage(project, true);
            var url = 'https://github.com/' + project + '/issues/new?title=' + title + '&body=' + body;
            window.open(url, '_blank');
        };
    }
})();