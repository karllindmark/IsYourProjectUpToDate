// Regular expressions used to validate input
var GITHUB_URL_REGEX = /^(?:(?:http(?:s)?:\/\/)?(?:www\.)?)github\.com\//i;
var USER_REPO_REGEX = /^([\w-]+)\/([\w.-]+)$/i;
var INVALID_LETTERS_REGEX = /[^\w\/\.-]/g;

// Key codes used in this script
var KEY_BACKSPACE = 8;
var KEY_TAB = 9;
var KEY_ENTER = 13;
var KEY_ESC = 27;
var KEY_ARROW_UP = 38;
var KEY_ARROW_DOWN = 40;
var KEY_DELETE = 46;

var NO_SUGGESTION_SELECTED = -1;

var app = angular.module("searchModule", ["apiModule"]);
app.controller("searchController", SearchController);

function SearchController($scope, $rootScope, ApiService) {
    $scope.running = false;
    $scope.error_text = "";
    $scope.warning_text = "";
    $scope.progress_text = "";

    $scope.github_info = "";
    $scope.github_username = "";
    $scope.github_repos = [];

    $scope.selected_suggestion = NO_SUGGESTION_SELECTED;
    $scope.filtered_repos = [];
    $scope.hide_typeahead = true;

    // Function to toggle meta touches on key down
    $scope.onKeyDownEvent = function(event) {
        if (event.which === KEY_TAB && !$scope.hide_typeahead) {
            $scope.selectSuggestion(event, $scope.selected_suggestion, true);
        }
    };

    // Function to handle the keyUp event instead of using keypress
    $scope.onKeyUpEvent = function(event) {
        // Generalize the key event identifier
        event.which = event.which || event.keyCode || event.charCode;
        switch (event.which) {
            case KEY_ESC:
            case KEY_ARROW_UP:
            case KEY_ARROW_DOWN:
                $scope.handleSelectionForSuggestions(event);
                break;
            case KEY_TAB:
                break;
            case KEY_BACKSPACE:
            case KEY_DELETE:
                $scope.selected_suggestion = NO_SUGGESTION_SELECTED;
                if (!$scope.github_info) {
                    $scope.hide_typeahead = true;
                }
                $scope.suggestRepositories(event);
                break;
            default:
                $scope.suggestRepositories(event);
                break;
        }
    };

    // We'll need to hot-wire the directional buttons for the suggestion box
    $scope.handleSelectionForSuggestions = function(event) {
        // If the type-ahead is closed, we don't do anything else
        if ($scope.hide_typeahead || !$scope.github_info) {
            return;
        }

        // If the user presses ESC, we need to hide the type-ahead
        if (event.which === KEY_ESC) {
            $scope.hide_typeahead = true;
            $scope.selected_suggestion = NO_SUGGESTION_SELECTED;
            return;
        }

        // The type-ahead should be visible now
        $scope.hide_typeahead = false;

        // Calculate the bounds for the type-ahead dropdown
        var max_index = ($scope.filtered_repos.length - 1) || 0;
        var current_index = $scope.selected_suggestion;
        var next_index = NO_SUGGESTION_SELECTED;

        if (event.which === 38) { // Key: ARROW UP
            if (current_index >= 0) {
                next_index = current_index - 1;
            } else {
                next_index = max_index;
            }
        } else if (event.which === 40) { // Key: ARROW DOWN
            if (current_index < max_index) {
                next_index = current_index + 1;
            } else {
                next_index = NO_SUGGESTION_SELECTED;
            }
        }

        // If the given repo exists, we select it
        $scope.selectSuggestion(event, next_index, false);
    };

    $scope.selectSuggestion = function(event, index, trigger) {
        if (index === NO_SUGGESTION_SELECTED) {
            $scope.selected_suggestion = index;
            $scope.github_info = $scope.info_filter;
            return;
        }

        var repo = $scope.filtered_repos[index];
        if (repo) {
            $scope.selected_suggestion = index;
            $scope.github_info = repo['owner']['login'] + "/" + repo['name'];
            if (trigger) {
                $scope.triggerSearchForProject(event);
            }
        }
    };

    $scope.suggestRepositories = function(event) {
        // Grab the current value for the input field (pre-this event)
        var github_info = event.currentTarget.value;
        if (!github_info) {
            return;
        }

        // We don't want a whitespace only!
        github_info = github_info.replace(/^\s+/, "");
        if (!github_info) {
            event.preventDefault();
            return;
        }

        // Count the slashes in the given Github information
        var first_slash = github_info.indexOf("/");
        var last_slash = github_info.lastIndexOf("/");

        // Skipping the ENTER presses
        if (event.which == KEY_ENTER) {
            return;
        }

        // Abort processing if it's a link
        if (github_info.indexOf(":/") !== -1) {
            $scope.hide_typeahead = true;
            $scope.selected_suggestion = NO_SUGGESTION_SELECTED;
            return;
        }

        // We won't do anything without a slash!
        if (first_slash === -1) {
            $scope.hide_typeahead = true;
            $scope.selected_suggestion = NO_SUGGESTION_SELECTED;
            return;
        }

        // Are there too many slashes?
        $scope.warning_text = "";
        if (first_slash !== last_slash) {
            $scope.warning_text = "Invalid format: &lt;username&gt;/&lt;repo&gt;";
            return;
        }

        // Display the type-ahead if necessary
        $scope.hide_typeahead = false;
        $scope.selected_suggestion = NO_SUGGESTION_SELECTED;

        // Validate that the user has specified a username
        var github_user = github_info.substr(0, first_slash);
        var github_repo = github_info.substr(first_slash+1);
        if (!github_user) {
            $scope.warning_text = "No username specified.";
            $scope.progress_text = "";
            return;
        }

        // If the stored user doesn't match the current one, we need to fetch the repos
        var current_user = $scope.github_username;
        if (github_user !== current_user) {
            $scope.progress_text = "Fetching the user repositories...";
            var postData = { "github-user": github_user };
            ApiService.findUserRepos(postData).success(function(data) {
                if (data.status === "ERROR") {
                    $scope.warning_text = data.message;
                    $scope.progress_text = "";
                    return;
                }

                $scope.progress_text = "";
                var user_in_request = data.data[0]['owner']['login'];
                if ($scope.github_username == user_in_request) {
                    $scope.github_repos = data.data;
                    $scope.hide_typeahead = false;
                }
            }).error(function(data) {
                $scope.error_text = data;
                $scope.progress_text = "";
                $scope.running = false;
            });
        }

        // Storing the values to the $scope
        $scope.github_username = github_user;
        $scope.github_repo = github_repo;
        $scope.info_filter = github_info;
        // FIXME: When should "$scope.running = true;" be set?
    };

    $scope.isRepositoryVisibleWithFilter = function(item) {
        var string = (item["owner"]["login"] + "/" + item["name"]);
        var filter = $scope.info_filter.toLocaleLowerCase();
        var expected = string.slice(0, string.length).toLocaleLowerCase();
        return expected.indexOf(filter) === 0 && expected !== filter;
    };

    $scope.triggerSearchForProject = function(event) {
        // Reset the states
        $scope.hide_typeahead = true;
        $scope.error_text = "";
        $scope.warning_text = "";
        $scope.progress_text = "";

        // Silently exit if it's already running or something else than a form submission or "button" triggering
        if ($scope.running || (event.type === "keypress" && event.keyCode !== KEY_ENTER)) {
            return;
        }
        $scope.running = true;

        // Did the user enter some Github information?
        var github_info = $scope.github_info;
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
            $scope.error_text = 'Invalid characters: ' + $.unique(found_invalid_letters).join(" ") + '<br>' +
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

        var postData = { "github-info": user_repo_match[0] };
        ApiService.findBranches(postData).success(function(data) {
            if (data.status === 'SUCCESS') {
                $scope.$parent.$broadcast('ProjectBranchesFound', { branches: data.data });

                // FIXME: Use ngAnimate here instead? Or velocity maybe
                $scope.running = false;
            } else {
                $scope.error_text = data.message;
                $scope.running = false;
            }
            $scope.progress_text = "";
        }).error(function(data) {
            $scope.error_text = data;
            $scope.running = false;
        });
    };
}