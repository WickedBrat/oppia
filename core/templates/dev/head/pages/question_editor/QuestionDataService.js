// Copyright 2014 The Oppia Authors. All Rights Reserved.
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
 *  @fileoverview Service for handling all interactions
 *  with the question editor backend.
 */

oppia.factory('QuestionDataService', [
  '$http', '$log', '$window', '$q', 'AlertsService',
  'EditableQuestionBackendApiService', 'LocalQuestionStorageService',
  'ReadOnlyQuestionBackendApiService', 'UrlService',
  function($http, $log, $window, $q, AlertsService,
      EditableQuestionBackendApiService, LocalQuestionStorageService,
      ReadOnlyQuestionBackendApiService, UrlService) {
    // The pathname (without the hash) should be:
    // .../question_editor/{question_id}
    var questionId = '';
    var draftChangeListId = null;
    var pathnameArray = UrlService.getPathname().split('/');
    for (var i = 0; i < pathnameArray.length; i++) {
      if (pathnameArray[i] === 'question_editor') {
        questionId = pathnameArray[i + 1];
        break;
      }
    }

    var resolvedAnswersUrlPrefix = (
      '/question_editorhandler/resolved_answers/' + questionId);
    var questionDraftAutosaveUrl = '';
    if (true) {
      questionDraftAutosaveUrl = (
        '/questionhandler/autosave_draft/' + questionId);
    } else if (GLOBALS.can_translate) {
      questionDraftAutosaveUrl = (
        '/questionhandler/autosave_translation_draft/' + questionId);
    }


    // Put question variables here.
    var questionData = {
      questionId: questionId,
      // Note that the changeList is the full changeList since the last
      // committed version (as opposed to the most recent autosave).
      autosaveChangeList: function(changeList, successCallback, errorCallback) {
        // First save locally to be retrieved later if save is unsuccessful.
        LocalQuestionStorageService.saveQuestionDraft(
          questionId, changeList, draftChangeListId);
        $http.put(questionDraftAutosaveUrl, {
          change_list: changeList,
          version: questionData.data.version
        }).then(function(response) {
          draftChangeListId = response.data.draft_change_list_id;
          // We can safely remove the locally saved draft copy if it was saved
          // to the backend.
          LocalQuestionStorageService.removeQuestionDraft(questionId);
          if (successCallback) {
            successCallback(response);
          }
        }, function() {
          if (errorCallback) {
            errorCallback();
          }
        });
      },
      discardDraft: function(successCallback, errorCallback) {
        $http.post(questionDraftAutosaveUrl, {}).then(function() {
          LocalQuestionStorageService.removeQuestionDraft(questionId);
          if (successCallback) {
            successCallback();
          }
        }, function() {
          if (errorCallback) {
            errorCallback();
          }
        });
      },
      // Returns a promise that supplies the data for the current question.
      getData: function(errorCallback) {
        console.log(questionData.data);
        if (questionData.data) {
          $log.info('Found question data in cache.');
          return $q.resolve(questionData.data);
        } else {
          // Retrieve data from the server.
          // WARNING: Note that this is a version of the question with draft
          // changes applied. This makes a force-refresh necessary when changes
          // are discarded, otherwise the question-with-draft-changes
          // (which is cached here) will be reused.
          return (
            EditableQuestionBackendApiService.fetchApplyDraftQuestion(
              questionId).then(function(response) {
              $log.info('Retrieved question data.');
              $log.info(response);
              draftChangeListId = response.draft_change_list_id;
              questionData.data = response;
              var draft = LocalQuestionStorageService.getQuestionDraft(
                questionId);
              if (draft) {
                if (draft.isValid(draftChangeListId)) {
                  var changeList = draft.getChanges();
                  questionData.autosaveChangeList(changeList, function() {
                    // A reload is needed so that the changelist just saved is
                    // loaded as opposed to the question returned by this
                    // response.
                    $window.location.reload();
                  });
                } else {
                  errorCallback(questionId, draft.getChanges());
                }
              }
              return response;
            })
          );
        }
      },
      // Returns a promise supplying the last saved version for the current
      // question.
      getLastSavedData: function() {
        return ReadOnlyQuestionBackendApiService.loadLatestQuestion(
          questionId).then(function(response) {
          $log.info('Retrieved saved question data.');
          $log.info(response);

          return response.question;
        });
      },
      resolveAnswers: function(stateName, resolvedAnswersList) {
        AlertsService.clearWarnings();
        $http.put(
          resolvedAnswersUrlPrefix + '/' + encodeURIComponent(stateName), {
            resolved_answers: resolvedAnswersList
          }
        );
      },
      /**
       * Saves the question to the backend, and, on a success callback,
       * updates the local copy of the question data.
       * @param {object} changeList - Represents the change list for
       *   this save. Each element of the list is a command representing an
       *   editing action (such as add state, delete state, etc.). See the
       *  _'Change' class in exp_services.py for full documentation.
       * @param {string} commitMessage - The user-entered commit message for
       *   this save operation.
       */
      save: function(
          changeList, commitMessage, successCallback, errorCallback) {
        EditableQuestionBackendApiService.updateQuestion(questionId,
          questionData.data.version, commitMessage, changeList).then(
          function(response) {
            AlertsService.clearWarnings();
            questionData.data = response;
            if (successCallback) {
              successCallback(
                response.is_version_of_draft_valid,
                response.draft_changes);
            }
          }, function() {
            if (errorCallback) {
              errorCallback();
            }
          }
        );
      }
    };

    return questionData;
  }
]);
