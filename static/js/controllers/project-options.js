var app = angular.module("projectOptionsModule", ["apiModule"]);
app.controller("projectOptionsController", ProjectOptionsController);
function ProjectOptionsController($scope, $rootScope, ApiService) {
    $scope.running = false;
    $scope.selected_branch = 'Default';
    $scope.branches = ['Default'];

    $scope.updateProjectType = function() {
        $rootScope.project_type = $scope.selected_type;
    };

    $scope.updateProjectBranch = function() {
        $rootScope.project_branch = $scope.selected_branch;
    };

    // TODO: Remove listener on destroy?
    $scope.$on('ProjectBranchesFound', function(event, data) {
        var branches = [];
        data.branches.forEach(function (branch, index) {
            if (index === 0) {
                $scope.selected_branch = branch.name;
            }
            branches.push(branch.name);
        });
        $scope.branches = branches;
    });

    $scope.triggerSearchForProjectFiles = function(event) {
        var project_type = $rootScope.project_type;
        var project_branch = $rootScope.project_branch;

        var postData = {
            "github-info": $rootScope.getGithubProject(),
            "project-type": project_type,
            "branch": project_branch
        };

        ApiService.findProjectFiles(postData).success(function(data) {
            if (data.status === 'SUCCESS') {
                $scope.$parent.$broadcast('ProjectFilesFound', { files: data.files });
                $('html, body').animate({
                        scrollTop: $("#step-project-files").offset().top
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
    }

}