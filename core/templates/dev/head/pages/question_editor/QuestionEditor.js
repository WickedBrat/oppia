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
 * @fileoverview Controllers for the question editor page and the editor
 *               help tab in the navbar.
 */

oppia.constant('INTERACTION_SPECS', GLOBALS.INTERACTION_SPECS);
oppia.constant(
  'QUESTION_TITLE_INPUT_FOCUS_LABEL',
  'questionTitleInputFocusLabel');
oppia.constant(
  'QUESTION_DATA_URL_TEMPLATE',
  '/explorehandler/init/<question_id>');
oppia.constant(
  'QUESTION_VERSION_DATA_URL_TEMPLATE',
  '/explorehandler/init/<question_id>?v=<version>');
oppia.constant(
  'EDITABLE_QUESTION_DATA_URL_TEMPLATE',
  '/question_editor12/<question_id>');
oppia.constant(
  'TRANSLATE_QUESTION_DATA_URL_TEMPLATE',
  '/createhandler/translate/<question_id>');
oppia.constant(
  'EDITABLE_QUESTION_DATA_DRAFT_URL_TEMPLATE',
  '/questionhandler/data/<question_id>?apply_draft=<apply_draft>');

oppia.controller('QuestionEditor', [
  '$scope', '$http', '$window', '$rootScope', '$log', '$timeout',
  'QuestionDataService', 'EditorStateService',
  'ExplorationLanguageCodeService', 'QuestionRightsService',
  'ExplorationInitStateNameService',
  'EditabilityService', 'QuestionStatesService', 'RouterService',
  'StateEditorTutorialFirstTimeService',
  'ExplorationParamSpecsService', 'ExplorationParamChangesService',
  'ContextService', 'ExplorationAdvancedFeaturesService', 'ChangeListService',
  'AutosaveInfoModalsService', 'ParamChangesObjectFactory',
  'ParamSpecsObjectFactory', 'ExplorationAutomaticTextToSpeechService',
  'ExplorationCorrectnessFeedbackService', 'StateTopAnswersStatsService',
  'StateTopAnswersStatsBackendApiService', 'ThreadDataService',
  function(
      $scope, $http, $window, $rootScope, $log, $timeout,
      QuestionDataService, EditorStateService,
      ExplorationLanguageCodeService, QuestionRightsService,
      ExplorationInitStateNameService,
      EditabilityService, QuestionStatesService, RouterService,
      StateEditorTutorialFirstTimeService,
      ExplorationParamSpecsService, ExplorationParamChangesService,
      ContextService, ExplorationAdvancedFeaturesService, ChangeListService,
      AutosaveInfoModalsService, ParamChangesObjectFactory,
      ParamSpecsObjectFactory, ExplorationAutomaticTextToSpeechService,
      ExplorationCorrectnessFeedbackService, StateTopAnswersStatsService,
      StateTopAnswersStatsBackendApiService, ThreadDataService) {
    $scope.EditabilityService = EditabilityService;
    $scope.EditorStateService = EditorStateService;
    EditabilityService.markEditable();
    /** ********************************************************
     * Called on initial load of the exploration editor page.
     *********************************************************/
    $rootScope.loadingMessage = 'Loading';

    $scope.questionId = ContextService.getQuestionId();
    $scope.questionUrl = '/question_editor/' + $scope.questionId;

    $scope.getTabStatuses = RouterService.getTabStatuses;

    /** ******************************************
    * Methods affecting the graph visualization.
    ********************************************/
    $scope.areExplorationWarningsVisible = false;
    $scope.toggleExplorationWarningVisibility = function() {
      $scope.areExplorationWarningsVisible = (
        !$scope.areExplorationWarningsVisible);
    };

    $scope.getQuestionUrl = function(questionId) {
      return questionId ? ('/question_editor/' + questionId) : '';
    };

    // Initializes the exploration page using data from the backend. Called on
    // page load.
    $scope.initQuestionPage = function(successCallback) {
      GLOBALS.context = 'question_editor';
      QuestionDataService.getData(function(questionId, lostChanges) {
        if (!AutosaveInfoModalsService.isModalOpen()) {
          AutosaveInfoModalsService.showLostChangesModal(
            lostChanges, questionId);
        }
      }).then(function(data) {
        console.log(data);
        data.language_code = data.language_code;
        QuestionStatesService.init(data.states);
        ExplorationLanguageCodeService.init(data.language_code);
        ExplorationInitStateNameService.init(data.init_state_name);
        ExplorationParamSpecsService.init(
          ParamSpecsObjectFactory.createFromBackendDict(data.param_specs));
        ExplorationParamChangesService.init(
          ParamChangesObjectFactory.createFromBackendList(data.param_changes));
        ExplorationAutomaticTextToSpeechService.init(data.auto_tts_enabled);
        ExplorationCorrectnessFeedbackService.init(
          data.correctness_feedback_enabled);

        $scope.QuestionRightsService = QuestionRightsService;
        $scope.explorationInitStateNameService = (
          ExplorationInitStateNameService);

        $scope.currentUserIsAdmin = data.is_admin;
        $scope.currentUserIsModerator = data.is_moderator;

        $scope.currentUser = data.user;
        $scope.currentVersion = data.version;

        ExplorationAdvancedFeaturesService.init(data);

        if (GLOBALS.can_edit) {
          EditabilityService.markEditable();
        }

        if (GLOBALS.can_translate || GLOBALS.can_edit) {
          EditabilityService.markTranslatable();
        }

        if (!EditorStateService.getActiveStateName() ||
            !QuestionStatesService.getState(
              EditorStateService.getActiveStateName())) {
          EditorStateService.setActiveStateName(
            ExplorationInitStateNameService.displayed);
        }

        if (!RouterService.isLocationSetToNonStateEditorTab() &&
            !data.states.hasOwnProperty(
              RouterService.getCurrentStateFromLocationPath('gui'))) {
          if (ThreadDataService.getOpenThreadsCount() > 0) {
            RouterService.navigateToFeedbackTab();
          } else {
            RouterService.navigateToMainTab();
          }
        }

        // ExplorationWarningsService.updateWarnings();

        // Initialize changeList by draft changes if they exist.
        if (data.draft_changes !== null) {
          ChangeListService.loadAutosavedChangeList(data.draft_changes);
        }

        if (data.is_version_of_draft_valid === false &&
            data.draft_changes !== null &&
            data.draft_changes.length > 0) {
          // Show modal displaying lost changes if the version of draft
          // changes is invalid, and draft_changes is not `null`.
          AutosaveInfoModalsService.showVersionMismatchModal(
            ChangeListService.getChangeList());
          return;
        }

        $scope.$broadcast('refreshStatisticsTab');
        $scope.$broadcast('refreshVersionHistory', {
          forceRefresh: true
        });

        if (QuestionStatesService.getState(
          EditorStateService.getActiveStateName())) {
          $scope.$broadcast('refreshStateEditor');
        }

        if (successCallback) {
          successCallback();
        }

        StateEditorTutorialFirstTimeService.init(
          data.show_state_editor_tutorial_on_load, $scope.questionId);

        if (QuestionRightsService.isPublic()) {
          // Stats are loaded asynchronously after the exploration data because
          // they are not needed to interact with the editor.
          StateTopAnswersStatsBackendApiService.fetchStats(
            $scope.questionId
          ).then(StateTopAnswersStatsService.init);
        }
      });
    };

    $scope.initQuestionPage();

    $scope.$on('initQuestionPage', function(unusedEvtData, successCallback) {
      $scope.initQuestionPage(successCallback);
    });
  }
]);
