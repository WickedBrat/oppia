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
 * Directive for the MultipleChoiceInput interaction.
 *
 * IMPORTANT NOTE: The naming convention for customization args that are passed
 * into the directive is: the name of the parameter, followed by 'With',
 * followed by the name of the arg.
 */
oppia.directive('oppiaInteractiveMultipleChoiceInput', [
  'HtmlEscaperService', 'multipleChoiceInputRulesService',
  'UrlInterpolationService',
  function(
      HtmlEscaperService, multipleChoiceInputRulesService,
      UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {
        onSubmit: '&'
      },
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/MultipleChoiceInput/directives/' +
        'multiple_choice_input_interaction_directive.html'),
      controller: [
        '$scope', '$attrs', '$filter', 
        function($scope, $attrs, $filter) {
          $scope.choices = HtmlEscaperService.escapedJsonToObj(
          $attrs.choicesWithValue);
          $scope.answer = null;
          for(var i = 0; i <= $scope.choices.length - 1; i++){
            $scope.choices[i] = $filter(
              'normalizeWhitespace')($scope.choices[i]);
            $scope.choices[i] = $filter(
              'removeExtraLines')($scope.choices[i]);
          }

          $scope.submitAnswer = function(answer) {
            answer = parseInt(answer, 10);
            $scope.onSubmit({
              answer: answer,
              rulesService: multipleChoiceInputRulesService
            });
          };
        }]
    };
  }
]);

oppia.directive('oppiaResponseMultipleChoiceInput', [
  'HtmlEscaperService', 'UrlInterpolationService',
  function(HtmlEscaperService, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/MultipleChoiceInput/directives/' +
        'multiple_choice_input_response_directive.html'),
      controller: ['$scope', '$attrs', function($scope, $attrs) {
        var _answer = HtmlEscaperService.escapedJsonToObj($attrs.answer);
        var _choices = HtmlEscaperService.escapedJsonToObj($attrs.choices);
        $scope.response = _choices[_answer];
      }]
    };
  }
]);

oppia.directive('oppiaShortResponseMultipleChoiceInput', [
  'HtmlEscaperService', 'UrlInterpolationService',
  function(HtmlEscaperService, UrlInterpolationService) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: UrlInterpolationService.getExtensionResourceUrl(
        '/interactions/MultipleChoiceInput/directives/' +
        'multiple_choice_input_short_response_directive.html'),
      controller: [
        '$scope', '$attrs', '$filter',
        function($scope, $attrs, $filter) {
          var _answer = HtmlEscaperService.escapedJsonToObj($attrs.answer);
          var _choices = HtmlEscaperService.escapedJsonToObj($attrs.choices);
          var response = $filter('convertToPlainText')(_choices[_answer]);
          $scope.response = $filter('truncateAtFirstLine')(response);
        }]
    };
  }
]);

oppia.factory('multipleChoiceInputRulesService', [function() {
  return {
    Equals: function(answer, inputs) {
      return answer === inputs.x;
    }
  };
}]);
