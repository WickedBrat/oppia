// Copyright 2018 The Oppia Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Service to get topic data.
 */
oppia.constant(
  'TOPIC_DATA_URL_TEMPLATE', '/topic_data_handler/<topic_id>');

oppia.factory('TopicViewerBackendApiService', [
  '$http', '$q', 'TOPIC_DATA_URL_TEMPLATE', 'UrlInterpolationService',
  function($http, $q, TOPIC_DATA_URL_TEMPLATE, UrlInterpolationService) {
    var topicData = null;
    var _fetchTopicData = function(topicId, successCallback, errorCallback) {
      var topicDataUrl = UrlInterpolationService.interpolateUrl(
        TOPIC_DATA_URL_TEMPLATE, {
          topic_id: topicId
        });

      $http.get(topicDataUrl).then(function(response) {
        topicData = angular.copy(response.data);
        if (successCallback) {
          successCallback(topicData);
        }
      }, function(errorResponse) {
        if (errorCallback) {
          errorCallback(errorResponse.data);
        }
      });
    };

    return {
      fetchTopicData: function(topicId) {
        if (topicData) {
          return topicData;
        }
        return $q(function(resolve, reject) {
          _fetchTopicData(topicId, resolve, reject);
        });
      }
    };
  }
]);
