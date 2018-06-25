// Copyright 2016 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Service to retrieve read only information
 * about questions from the backend.
 */

oppia.factory('ReadOnlyQuestionBackendApiService', [
  '$http', '$q', 'QUESTION_DATA_URL_TEMPLATE',
  'QUESTION_VERSION_DATA_URL_TEMPLATE', 'UrlInterpolationService',
  function($http, $q, QUESTION_DATA_URL_TEMPLATE,
      QUESTION_VERSION_DATA_URL_TEMPLATE, UrlInterpolationService) {
    // Maps previously loaded questions to their IDs.
    var _questionCache = [];

    var _fetchQuestion = function(
        questionId, version, successCallback, errorCallback) {
      var questionDataUrl = _getQuestionUrl(questionId, version);

      $http.get(questionDataUrl).then(function(response) {
        var question = angular.copy(response.data);
        if (successCallback) {
          successCallback(question);
        }
      }, function(errorResponse) {
        if (errorCallback) {
          errorCallback(errorResponse.data);
        }
      });
    };

    var _isCached = function(questionId) {
      return _questionCache.hasOwnProperty(questionId);
    };

    var _getQuestionUrl = function(questionId, version) {
      if (version) {
        return UrlInterpolationService.interpolateUrl(
          QUESTION_VERSION_DATA_URL_TEMPLATE, {
            question_id: questionId,
            version: String(version)
          });
      }
      return UrlInterpolationService.interpolateUrl(
        QUESTION_DATA_URL_TEMPLATE, {
          question_id: questionId
        }
      );
    };

    return {
      /**
       * Retrieves an question from the backend given an question ID
       * and version number (or none). This returns a promise object that
       * allows success and rejection callbacks to be registered. If the
       * question is successfully loaded and a success callback function
       * is provided to the promise object, the success callback is called
       * with the question passed in as a parameter. If something goes
       * wrong while trying to fetch the question, the rejection callback
       * is called instead, if present. The rejection callback function is
       * passed any data returned by the backend in the case of an error.
       */
      fetchQuestion: function(questionId, version) {
        return $q(function(resolve, reject) {
          _fetchQuestion(questionId, version, resolve, reject);
        });
      },

      /**
       * Behaves in the exact same way as fetchQuestion (including
       * callback behavior and returning a promise object),
       * except this function will attempt to see whether the latest version
       * of the given question has already been loaded. If it has not yet
       * been loaded, it will fetch the question from the backend. If it
       * successfully retrieves the question from the backend, this method
       * will store the question in the cache to avoid requests from the
       * backend in further function calls.
       */
      loadLatestQuestion: function(questionId) {
        return $q(function(resolve, reject) {
          if (_isCached(questionId)) {
            if (resolve) {
              resolve(angular.copy(_questionCache[questionId]));
            }
          } else {
            _fetchQuestion(questionId, null, function(question) {
              // Save the fetched question to avoid future fetches.
              _questionCache[questionId] = question;
              if (resolve) {
                resolve(angular.copy(question));
              }
            }, reject);
          }
        });
      },

      /**
       * Retrieves an question from the backend given an question ID
       * and version number. This method does not interact with any cache
       * and using this method will not overwrite or touch the state of the
       * cache. All previous data in the cache will still be retained after
       * this call.
       */
      loadQuestion: function(questionId, version) {
        return $q(function(resolve, reject) {
          _fetchQuestion(questionId, version, function(question) {
            if (resolve) {
              resolve(angular.copy(question));
            }
          }, reject);
        });
      },

      /**
       * Returns whether the given question is stored within the local
       * data cache or if it needs to be retrieved from the backend upon a
       * load.
       */
      isCached: function(questionId) {
        return _isCached(questionId);
      },

      /**
       * Replaces the current question in the cache given by the specified
       * question ID with a new question object.
       */
      cacheQuestion: function(questionId, question) {
        _questionCache[questionId] = angular.copy(question);
      },

      /**
       * Clears the local question data cache, forcing all future loads to
       * re-request the previously loaded questions from the backend.
       */
      clearQuestionCache: function() {
        _questionCache = [];
      },

      /**
       * Deletes a specific question from the local cache
       */
      deleteQuestionFromCache: function(questionId) {
        if (_isCached(questionId)) {
          delete _questionCache[questionId];
        }
      }
    };
  }
]);
