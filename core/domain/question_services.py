# coding: utf-8
#
# Copyright 2017 The Oppia Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS-IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Services for questions data model."""

import logging

from core.domain import question_domain
from core.domain import role_services
from core.domain import user_services
from core.platform import models
import feconf

memcache_services = models.Registry.import_memcache_services()
(question_models, skill_models, user_models) = models.Registry.import_models(
    [models.NAMES.question, models.NAMES.skill, models.NAMES.user])

CMD_CREATE_NEW = 'create_new'


def _create_new_question(committer_id, question, commit_message):
    """Creates a new question.

    Args:
        committer_id: str. ID of the committer.
        question: Question. question domain object.
        commit_message: str. A description of changes made to the question.

    Returns:
        str. The ID of the model.
    """
    question.validate()
    create_new_question_rights(question.question_id, committer_id)
    model = question_models.QuestionModel(
        id=question.question_id,
        question_data=question.question_data,
        question_data_schema_version=question.question_data_schema_version,
        language_code=question.language_code,
    )

    model.commit(committer_id, commit_message, [{'cmd': CMD_CREATE_NEW}])

    create_question_summary(
        model.id, committer_id, feconf.ACTIVITY_STATUS_PRIVATE)
    return model.id


def add_question(committer_id, question):
    """Saves a new question.

    Args:
        committer_id: str. ID of the committer.
        question: Question. Question to be saved.

    Returns:
        str. The ID of the question.
    """
    commit_message = 'New question created'
    question_id = _create_new_question(committer_id, question, commit_message)

    return question_id


def delete_question(
        committer_id, question_id, force_deletion=False):
    """Deletes the question with the given question_id.

    Args:
        committer_id: str. ID of the committer.
        question_id: str. ID of the question.
        force_deletion: bool. If true, the question and its history are fully
            deleted and are unrecoverable. Otherwise, the question and all
            its history are marked as deleted, but the corresponding models are
            still retained in the datastore. This last option is the preferred
            one.
    """
    question_model = question_models.QuestionModel.get(question_id)
    question_model.delete(
        committer_id, feconf.COMMIT_MESSAGE_QUESTION_DELETED,
        force_deletion=force_deletion)


def get_question_from_model(question_model):
    """Returns domain object repersenting the given question model.

    Args:
        question_model: QuestionModel. The question model loaded from the
            datastore.

    Returns:
        Question. The domain object representing the question model.
    """
    return question_domain.Question(
        question_model.id, question_model.question_data,
        question_model.question_data_schema_version,
        question_model.language_code)


def _get_question_memcache_key(question_id, version=None):
    """Returns a memcache key for an question.

    Args:
        question_id: str. The id of the question whose memcache key
            is to be returned.
        version: int or None. If specified, the version of the question
            whose memcache key is to be returned.

    Returns:
        str. Memcache key for the given question (or question version).
    """

    if version:
        return 'question-version:%s:%s' % (question_id, version)
    else:
        return 'question:%s' % question_id


def get_question_by_id(question_id, strict=True, version=None):
    """Returns an question domain object.

    Args:
        question_id: str. The id of the question to be returned.
        strict: bool. Whether to fail noisily if no question with a given id
            exists.
        version: int or None. The version of the question to be returned.
            If None, the latest version of the question is returned.

    Returns:
        Question. The domain object corresponding to the given question.
    """

    question_memcache_key = _get_question_memcache_key(
        question_id, version=version)
    memcached_question = memcache_services.get_multi(
        [question_memcache_key]).get(question_memcache_key)

    if memcached_question is not None:
        return memcached_question
    else:
        question_model = question_models.QuestionModel.get(
            question_id, strict=strict, version=version)
        if question_model:
            question = get_question_from_model(question_model)
            memcache_services.set_multi({
                question_memcache_key: question})
            return question
        else:
            return None


def get_questions_by_ids(question_ids):
    """Returns a list of domain objects representing questions.

    Args:
        question_ids: list(str). List of question ids.

    Returns:
        list(Question|None). A list of domain objects representing questions
        with the given ids or None when the id is not valid.
    """
    question_model_list = question_models.QuestionModel.get_multi(question_ids)
    questions = []
    for question_model in question_model_list:
        questions.append(get_question_from_model(question_model))
    return questions


def apply_change_list(question_id, change_list):
    """Applies a changelist to a pristine question and returns the result.

    Args:
        question_id: str. ID of the given question.
        change_list: list(QuestionChange). A change list to be applied to the
            given question. Each entry in change_list is a QuestionChange
            object.

    Returns:
      Question. The resulting question domain object.
    """
    question = get_question_by_id(question_id)
    try:
        for change in change_list:
            if change.cmd == question_domain.CMD_UPDATE_QUESTION_PROPERTY:
                if (change.property_name ==
                        question_domain.QUESTION_PROPERTY_LANGUAGE_CODE):
                    question.update_language_code(change.new_value)
                elif (change.cmd ==
                      question_domain.QUESTION_PROPERTY_QUESTION_DATA):
                    question.update_question_data(change.new_value)

        return question

    except Exception as e:
        logging.error(
            '%s %s %s %s' % (
                e.__class__.__name__, e, question_id, change_list)
        )
        raise


def _save_question(committer_id, question, change_list, commit_message):
    """Validates a question and commits it to persistent storage.

    Args:
        committer_id: str. The id of the user who is performing the update
            action.
        question: Question. The domain object representing a question.
        change_list: list(QuestionChange). A list of QuestionChange objects.
            These changes are applied in sequence to produce the resulting
            question.
        commit_message: str or None. A description of changes made to the
            question.

    Raises:
        Exception: Received an invalid change list.
    """
    if not change_list:
        raise Exception(
            'Unexpected error: received an invalid change list when trying to '
            'save question %s: %s' % (question.question_id, change_list))

    question.validate()

    question_model = question_models.QuestionModel.get(question.question_id)
    question_model.question_data = question.question_data
    question_model.question_data_schema_version = (
        question.question_data_schema_version)
    question_model.language_code = question.language_code
    change_list_dict = [change.to_dict() for change in change_list]
    question_model.commit(committer_id, commit_message, change_list_dict)


def update_question(
        committer_id, question_id, change_list, commit_message):
    """Updates a question. Commits changes.

    Args:
        committer_id: str. The ID of the user who is performing the update
            action.
        question_id: str. The question ID.
        change_list: list(QuestionChange). A list of QuestionChange objects.
            These changes are applied in sequence to produce the resulting
            question.
        commit_message: str or None. A description of changes made to the
            question.
    """
    updated_question = apply_change_list(question_id, change_list)
    _save_question(
        committer_id, updated_question, change_list, commit_message)


def get_new_question_id():
    """Returns a new question id.

    Returns:
        str. A new question id.
    """
    return question_models.QuestionModel.get_new_id('')


def create_question_summary(
        question_id, creator_id, status):
    """Creates and stores a summary of the given question.

    Args:
        question_id: str. ID of the question.
        creator_id: str. The user ID of the creator of the question.
        status: str. The status of the question.
    """
    question = get_question_by_id(question_id)
    question_summary = compute_summary_of_question(
        question, creator_id, status)
    save_question_summary(question_summary)


def compute_summary_of_question(question, creator_id, status):
    """Create a QuestionSummary domain object for a given Question domain
    object and return it.

    Args:
        question: Question. The question object for which the summary
            is to be computed.
        creator_id: str. The user ID of the creator of the question.
        status: str. The status of the question.

    Returns:
        QuestionSummary. The computed summary for the given question.
    """
    question_html_data = question.question_data['content']['html']
    question_summary = question_domain.QuestionSummary(
        question.question_id, creator_id, question.language_code,
        status, question_html_data
    )

    return question_summary


def save_question_summary(question_summary):
    """Save a question summary domain object as a QuestionSummaryModel
    entity in the datastore.

    Args:
        question_summary: The question summary object to be saved in the
            datastore.
    """
    question_summary_model = question_models.QuestionSummaryModel(
        id=question_summary.id,
        creator_id=question_summary.creator_id,
        language_code=question_summary.language_code,
        status=question_summary.status,
        question_model_last_updated=question_summary.last_updated,
        question_model_created_on=question_summary.created_on,
        question_html_data=question_summary.question_data
    )

    question_summary_model.put()


def send_question_for_review(committer_id, question_id):
    """Marks a question's status as pending.

    Args:
        committer_id: str. The user_id of the committer.
        question_id: str. The user_id of the question.

    Returns:
        QuestionSummaryModel: The QuestionSummaryModel for the given question.
    """
    model = get_question_summary_by_question_id(question_id, strict=False)
    commit_message = 'Marked question as pending.'
    model.status = feconf.QUESTION_STATUS_PENDING
    model.commit(
        committer_id,
        commit_message,
        [{'cmd': question_domain.CMD_SEND_QUESTION_FOR_REVIEW}])


def reject_question(committer_id, question_id):
    """Marks a question's status as rejected.

    Args:
        committer_id: str. The user_id of the committer.
        question_id: str. The user_id of the question.

    Returns:
        QuestionSummaryModel: The QuestionSummaryModel for the given question.
    """
    model = get_question_summary_by_question_id(question_id, strict=False)
    commit_message = 'Marked question as rejected.'
    model.status = feconf.QUESTION_STATUS_REJECTED
    model.commit(
        committer_id,
        commit_message,
        [{'cmd': question_domain.CMD_REJECT_QUESTION}])


def get_question_summaries_by_creator_id(creator_id):
    """Gets question summaries of questions created by the user.

    Args:
        creator_id: str. The user ID of the creator.

    Returns:
        QuestionSummaryModel. The QuestionSummaryModel for the given question.
    """
    return question_models.QuestionSummaryModel.get_by_creator_id(creator_id)


def get_question_summary_by_question_id(question_id, strict=False):
    """Gets question summaries of questions created by the user.

    Args:
        question_id: str. The user ID of the question.
        strict: bool. Whether to fail noisily if no question summary for the
            given question id exists in the datastore.

    Returns:
        QuestionSummaryModel. The QuestionSummaryModel for the given question.
    """
    return question_models.QuestionSummaryModel.get(question_id, strict=strict)


def get_summaries_of_linked_skills(question_id):
    """Gets linked skill IDs for given question.

    Args:
        question_id: str. The question ID for the given question.

    Returns:
        QuestionSkillLinkModel. The QuestionSkillModel for the given question.
    """
    linked_skill_summaries = []
    question_skill_links = question_models.QuestionSkillLinkModel.get(
        question_id, strict=False)

    if question_skill_links is None:
        return None
    for question_skill_link in question_skill_links:
        linked_skill_summaries = (
            skill_models.SkillSummaryModel.get(
                question_skill_link.skill_id, strict=False))

    return linked_skill_summaries


def get_question_rights_from_model(question_rights_model):
    """Constructs a QuestionRights object from the given question rights model.

    Args:
        question_rights_model: QuestionRightsModel. Question rights from the
            datastore.

    Returns:
        QuestionRights. The rights object created from the model.
    """

    return question_domain.QuestionRights(
        question_rights_model.id,
        question_rights_model.manager_ids
    )


def save_question_rights(
        question_rights, committer_id, commit_message, commit_cmds):
    """Saves a QuestionRights domain object to the datastore.

    Args:
        question_rights: QuestionRights. The rights object for the given
            question.
        committer_id: str. ID of the committer.
        commit_message: str. Descriptive message for the commit.
        commit_cmds: list(QuestionChangeDict). A list of commands
            describing what kind of commit was done.
    """

    model = question_models.QuestionRightsModel.get(
        question_rights.id, strict=False)

    model.manager_ids = question_rights.manager_ids
    commit_cmd_dicts = [commit_cmd.to_dict() for commit_cmd in commit_cmds]
    model.commit(committer_id, commit_message, commit_cmd_dicts)


def create_new_question_rights(question_id, committer_id):
    """Creates a new question rights object and saves it to the datastore.

    Args:
        question_id: str. ID of the question.
        committer_id: str. ID of the committer.
    """
    question_rights = question_domain.QuestionRights(question_id, [])
    commit_cmds = [{'cmd': CMD_CREATE_NEW}]

    question_models.QuestionRightsModel(
        id=question_rights.id,
        manager_ids=question_rights.manager_ids
    ).commit(committer_id, 'Created new question rights', commit_cmds)


def get_question_rights(question_id, strict=True):
    """Retrieves the rights object for the given question.

    Args:
        question_id: str. ID of the question.
        strict: bool. Whether to fail noisily if no question rights with a
            given id exists in the datastore.

    Returns:
        QuestionRights. The rights object associated with the given question.

    Raises:
        EntityNotFoundError. The question with ID question_id was not
            found in the datastore.
    """

    model = question_models.QuestionRightsModel.get(question_id, strict=strict)

    if model is None:
        return None

    return get_question_rights_from_model(model)


def check_can_edit_question(user_id, question_id):
    """Checks if the user can edit the given question or not

    Args:
        user_id: str. The user ID of the user.
        question_id: str. The question ID of the question.

    Returns:
        bool. Represents if the user can edit the question or not.
    """
    question_summary = get_question_summary_by_question_id(
        question_id, strict=False)

    if question_summary.status == feconf.QUESTION_STATUS_PENDING:
        return False

    if ((question_summary.status == feconf.ACTIVITY_STATUS_PRIVATE or
         question_summary.status == feconf.QUESTION_STATUS_REJECTED) and
            question_summary.creator_id == user_id):
        return True

    if (user_services.is_admin(user_id) or
            user_services.is_topic_manager(user_id)):
        if question_summary.status == feconf.QUESTION_STATUS_APPROVED:
            return True
        return False

    return False


def publish_question(question_id, committer_id):
    """Marks the given question as published.

    Args:
        question_id: str. The id of the given question.
        committer_id: str. ID of the committer.

    Raises:
        Exception. The given question does not exist.
        Exception. The question is already published.
        Exception. The user does not have enough rights to publish the question.
    """
    question_summary = get_question_summary_by_question_id(
        question_id, strict=False)
    if question_summary is None:
        raise Exception('The given question does not exist')
    user = user_services.UserActionsInfo(committer_id)
    if role_services.ACTION_CHANGE_QUESTION_STATUS not in user.actions:
        raise Exception(
            'The user does not have enough rights to publish the question.')

    if question_summary.status == feconf.QUESTION_STATUS_APPROVED:
        raise Exception('The question is already published.')
    question_summary.status = feconf.QUESTION_STATUS_APPROVED
    question_summary.put()


def unpublish_question(question_id, committer_id):
    """Marks the given question as unpublished.

    Args:
        question_id: str. The id of the given question.
        committer_id: str. ID of the committer.

    Raises:
        Exception. The given question does not exist.
        Exception. The question is already unpublished.
        Exception. The user does not have enough rights to unpublish the
            question.
    """
    question_summary = get_question_summary_by_question_id(
        question_id, strict=False)
    if question_summary is None:
        raise Exception('The given question does not exist')
    user = user_services.UserActionsInfo(committer_id)
    if role_services.ACTION_CHANGE_QUESTION_STATUS not in user.actions:
        raise Exception(
            'The user does not have enough rights to unpublish the question.')

    if not question_summary.status == feconf.QUESTION_STATUS_APPROVED:
        raise Exception('The question is already unpublished.')
    question_summary.status = feconf.ACTIVITY_STATUS_PRIVATE
    question_summary.put()


def is_version_of_draft_valid(question_id, version):
    """Checks if the draft version is the same as the latest version of the
    question.

    Args:
        question_id: str. The id of the question.
        version: int. The draft version which is to be validate.

    Returns:
        bool. Whether the given version number is the same as the current
        version number of the question in the datastore.
    """
    return get_question_by_id(
        question_id).question_data_schema_version == version


def get_question_with_draft_applied(question_id, user_id):
    """If a draft exists for the given user and question,
    apply it to the question.

    Args:
        question_id: str. The id of the question.
        user_id: str. The id of the user whose draft is to be applied.

    Returns:
        Question. The question domain object.
    """

    question_user_data = user_models.QuestionUserDataModel.get(user_id, question_id)
    question = get_question_by_id(question_id)
    if question_user_data:
        if question_user_data.draft_change_list:
            draft_change_list = [
                question_domain.QuestionChange(change)
                for change in question_user_data.draft_change_list]
    return (
        apply_change_list(question_id, draft_change_list)
        if question_user_data and question_user_data.draft_change_list and
        is_version_of_draft_valid(
            question_id, question_user_data.draft_change_list_question_version)
        else question)


def discard_draft(question_id, user_id):
    """Discard the draft for the given user and question.

    Args:
        question_id: str. The id of the question.
        user_id: str. The id of the user whose draft is to be discarded.
    """

    question_user_data = user_models.QuestionUserDataModel.get(
        user_id, question_id)
    if question_user_data:
        question_user_data.draft_change_list = None
        question_user_data.draft_change_list_last_updated = None
        question_user_data.draft_change_list_question_version = None
        question_user_data.put()


def get_user_question_data(
        user_id, question_id, apply_draft=False, version=None):
    """Returns a description of the given question."""
    if apply_draft:
        question = get_question_with_draft_applied(question_id, user_id)
    else:
        question = get_question_by_id(question_id, version=version)

    states = {}
    state_dict = question.question_data
    states['question_data'] = state_dict
    question_user_data = user_models.QuestionUserDataModel.get(
        user_id, question_id)
    draft_changes = (question_user_data.draft_change_list if question_user_data
                     and question_user_data.draft_change_list else None)
    is_valid_draft_version = (
        is_version_of_draft_valid(
            question_id, question_user_data.draft_change_list_question_version)
        if question_user_data and question_user_data.draft_change_list_question_version
        else None)
    draft_change_list_id = (question_user_data.draft_change_list_id
                            if question_user_data else 0)
    editor_dict = {
        'draft_change_list_id': draft_change_list_id,
        'question_id': question_id,
        'language_code': question.language_code,
        'param_changes': [],
        'param_specs': {},
        'states': states,
        'version': question.question_data_schema_version,
        'is_version_of_draft_valid': is_valid_draft_version,
        'draft_changes': draft_changes,
        'init_state_name': 'question_data'
    }

    return editor_dict


def create_or_update_draft(
        question_id, user_id, change_list, question_version, current_datetime):
    """Create a draft with the given change list, or update the change list
    of the draft if it already exists. A draft is updated only if the change
    list timestamp of the new change list is greater than the change list
    timestamp of the draft.
    The method assumes that a QuestionUserDataModel object exists for the
    given user and question.

    Args:
        question_id: str. The id of the question.
        user_id: str. The id of the user.
        change_list: list(QuestionChange). A list that contains the changes
            to be made to the QuestionUserDataModel object.
        question_version: int. The current version of the question.
        current_datetime: datetime.datetime. The current date and time.
    """
    question_user_data = user_models.QuestionUserDataModel.get(
        user_id, question_id)
    if (question_user_data and question_user_data.draft_change_list and
            question_user_data.draft_change_list_last_updated > current_datetime):
        return

    updated_question = apply_change_list(question_id, change_list)
    updated_question.validate()

    if question_user_data is None:
        question_user_data = user_models.QuestionUserDataModel.create(
            user_id, question_id)

    draft_change_list_id = question_user_data.draft_change_list_id
    draft_change_list_id += 1
    change_list_dict = [change.to_dict() for change in change_list]
    question_user_data.draft_change_list = change_list_dict
    question_user_data.draft_change_list_last_updated = current_datetime
    question_user_data.draft_change_list_question_version = question_version
    question_user_data.draft_change_list_id = draft_change_list_id
    question_user_data.put()
