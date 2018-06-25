// Copyright 2017 The Oppia Authors. All Rights Reserved.
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
 * @fileoverview Service to send changes to a question to the backend.
 */

oppia.factory('EditableQuestionBackendApiService', [
  '$http', '$q', 'QUESTION_DATA_URL_TEMPLATE',
  'EDITABLE_QUESTION_DATA_URL_TEMPLATE',
  'EDITABLE_QUESTION_DATA_DRAFT_URL_TEMPLATE',
  'TRANSLATE_QUESTION_DATA_URL_TEMPLATE',
  'UrlInterpolationService',
  'ReadOnlyQuestionBackendApiService',
  function($http, $q, QUESTION_DATA_URL_TEMPLATE,
      EDITABLE_QUESTION_DATA_URL_TEMPLATE,
      EDITABLE_QUESTION_DATA_DRAFT_URL_TEMPLATE,
      TRANSLATE_QUESTION_DATA_URL_TEMPLATE,
      UrlInterpolationService,
      ReadOnlyQuestionBackendApiService) {
    var _fetchQuestion = function(
        questionId, applyDraft, successCallback, errorCallback) {
      var editableQuestionDataUrl = _getQuestionUrl(
        questionId, applyDraft);

      $http.get(editableQuestionDataUrl).then(function(response) {
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

    var _updateQuestion = function(
        questionId, questionVersion, commitMessage, changeList,
        successCallback, errorCallback) {
      var editableQuestionDataUrl = _getQuestionUrl(
        questionId, null);

      var putData = {
        version: questionVersion,
        commit_message: commitMessage,
        change_list: changeList
      };
      $http.put(editableQuestionDataUrl, putData).then(function(response) {
        // The returned data is an updated question dict.
        var question = angular.copy(response.data);

        // Delete from the ReadOnlyQuestionBackendApiService's cache
        // As the two versions of the data (learner and editor) now differ
        ReadOnlyQuestionBackendApiService.deleteQuestionFromCache(
          questionId, question);

        if (successCallback) {
          successCallback(question);
        }
      }, function(errorResponse) {
        if (errorCallback) {
          errorCallback(errorResponse.data);
        }
      });
    };

    var _deleteQuestion = function(
        questionId, successCallback, errorCallback) {
      var editableQuestionDataUrl = _getQuestionUrl(questionId, null);

      $http['delete'](editableQuestionDataUrl).then(function() {
        // Delete item from the ReadOnlyQuestionBackendApiService's cache
        ReadOnlyQuestionBackendApiService.deleteQuestionFromCache(
          questionId);
        if (successCallback) {
          successCallback({});
        }
      }, function(errorResponse) {
        if (errorCallback) {
          errorCallback(errorResponse.data);
        }
      });
    };

    var _getQuestionUrl = function(questionId, applyDraft) {
      if (applyDraft) {
        return UrlInterpolationService.interpolateUrl(
          EDITABLE_QUESTION_DATA_DRAFT_URL_TEMPLATE, {
            question_id: questionId,
            apply_draft: JSON.stringify(applyDraft)
          });
      }
      if (!GLOBALS.can_edit && GLOBALS.can_translate) {
        return UrlInterpolationService.interpolateUrl(
          TRANSLATE_QUESTION_DATA_URL_TEMPLATE, {
            question_id: questionId
          });
      }

      return UrlInterpolationService.interpolateUrl(
        EDITABLE_QUESTION_DATA_URL_TEMPLATE, {
          question_id: questionId
        });
    };

    return {
      fetchQuestion: function(questionId) {
        return $q(function(resolve, reject) {
          _fetchQuestion(questionId, null, resolve, reject);
        });
      },

      fetchApplyDraftQuestion: function(questionId) {
        return $q(function(resolve, reject) {
          _fetchQuestion(questionId, true, resolve, reject);
        });
      },

      /**
       * Updates an question in the backend with the provided question
       * ID. The changes only apply to the question of the given version
       * and the request to update the question will fail if the provided
       * question version is older than the current version stored in the
       * backend. Both the changes and the message to associate with those
       * changes are used to commit a change to the question.
       * The new question is passed to the success callback,
       * if one is provided to the returned promise object. Errors are passed
       * to the error callback, if one is provided. Please note, once this is
       * called the cached question in ReadOnlyQuestionBackendApiService
       * will be deleted. This is due to the differences in the back-end
       * editor object and the back-end player object. As it stands now,
       * we are unable to cache any Question object obtained from the
       * editor beackend.
       */
      updateQuestion: function(
          questionId, questionVersion, commitMessage, changeList) {
        return $q(function(resolve, reject) {
          _updateQuestion(
            questionId, questionVersion, commitMessage, changeList,
            resolve, reject);
        });
      },

      /**
       * Deletes an question in the backend with the provided question
       * ID. If successful, the question will also be deleted from the
       * ReadOnlyQuestionBackendApiService cache as well.
       * Errors are passed to the error callback, if one is provided.
       */
      deleteQuestion: function(questionId) {
        return $q(function(resolve, reject) {
          _deleteQuestion(
            questionId, resolve, reject);
        });
      }
    };
  }
]);
