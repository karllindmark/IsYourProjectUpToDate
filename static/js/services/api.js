var service = angular.module('apiModule', []);
service.factory('ApiService', ApiService);

function ApiService($http) {
    function dataToString (data) {
        if (typeof data !== "string") {
            return $.param(data);
        }
        return data;
    }

    return {
        findUserRepos: function(data) {
            return $http.post('/api/find-user-repos/', dataToString(data));
        },
        findBranches: function(data) {
            return $http.post('/api/find-project-branches/', dataToString(data));
        },
        findProjectFiles: function(data) {
            return $http.post('/api/find-project-files/', dataToString(data));
        }
    };
}