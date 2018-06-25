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
 * @fileoverview Utility service for saving data locally on the client machine.
 */

// Service for saving question draft changes to local storage.
//
// Note that the draft is only saved if localStorage exists and works
// (i.e. has storage capacity).
oppia.factory('LocalQuestionStorageService', [
  'QuestionDraftObjectFactory',
  function(QuestionDraftObjectFactory) {
    // Check that local storage exists and works as expected.
    // If it does storage stores the localStorage object,
    // else storage is undefined or false.
    var storage = (function() {
      var test = 'test';
      var result;
      try {
        localStorage.setItem(test, test);
        result = localStorage.getItem(test) === test;
        localStorage.removeItem(test);
        return result && localStorage;
      } catch (exception) {}
    }());

    /**
     * Create the key to access the changeList in localStorage
     * @param {String} questionId - The question id of the changeList
     *   to be accessed.
     */
    var _createQuestionDraftKey = function(questionId) {
      return 'draft_' + questionId;
    };

    return {
      /**
       * Check that localStorage is available to the client.
       * @returns {boolean} true iff the client has access to localStorage.
       */
      isStorageAvailable: function() {
        return Boolean(storage);
      },
      /**
       * Save the given changeList to localStorage along with its
       * draftChangeListId
       * @param {String} questionId - The id of the question
       *   associated with the changeList to be saved.
       * @param {List} changeList - The question change list to be saved.
       * @param {Integer} draftChangeListId - The id of the draft to be saved.
       */
      saveQuestionDraft: function(
          questionId, changeList, draftChangeListId) {
        var localSaveKey = _createQuestionDraftKey(questionId);
        if (storage) {
          var draftDict = QuestionDraftObjectFactory.toLocalStorageDict(
            changeList, draftChangeListId);
          storage.setItem(localSaveKey, JSON.stringify(draftDict));
        }
      },
      /**
       * Retrieve the local save of the changeList associated with the given
       * question id.
       * @param {String} questionId - The question id of the change list
       *   to be retrieved.
       * @returns {Object} The local save draft object if it exists,
       *   else null.
       */
      getQuestionDraft: function(questionId) {
        if (storage) {
          var draftDict = JSON.parse(
            storage.getItem(_createQuestionDraftKey(questionId)));
          if (draftDict) {
            return QuestionDraftObjectFactory.createFromLocalStorageDict(
              draftDict);
          }
        }
        return null;
      },
      /**
       * Remove the local save of the changeList associated with the given
       * question id.
       * @param {String} questionId - The question id of the change list
       *   to be removed.
       */
      removeQuestionDraft: function(questionId) {
        if (storage) {
          storage.removeItem(_createQuestionDraftKey(questionId));
        }
      }
    };
  }]);
