/** Editable evaluation-form prefills generated from an individual rotation record. */
var EVALUATION_PREFILL_FORM_CACHE_ = null;

function buildEvaluationPrefilledUrl_(record) {
  var cfg = getConfig();
  var fallbackUrl = safeString_(cfg.EVALUATION_FORM_URL);
  if (!cfg.EVALUATION_FORM_ID) return fallbackUrl;

  try {
    var formContext = getEvaluationPrefillFormContext_(cfg.EVALUATION_FORM_ID);
    var valuesByTitle = buildEvaluationPrefillValues_(record);
    var response = formContext.form.createResponse();
    Object.keys(valuesByTitle).forEach(function(title) {
      var item = formContext.textItemsByTitle[title];
      var value = valuesByTitle[title];
      if (!item || value === undefined || value === '') return;
      response.withItemResponse(item.asTextItem().createResponse(value));
    });
    return response.toPrefilledUrl();
  } catch (err) {
    logError_('buildEvaluationPrefilledUrl_', record && record[H.RECORD.REQUEST_ID], err);
    return fallbackUrl;
  }
}

function getEvaluationPrefillFormContext_(formId) {
  formId = safeString_(formId);
  if (EVALUATION_PREFILL_FORM_CACHE_ && EVALUATION_PREFILL_FORM_CACHE_.formId === formId) {
    return EVALUATION_PREFILL_FORM_CACHE_;
  }
  var form = FormApp.openById(formId);
  var textItemsByTitle = {};
  form.getItems(FormApp.ItemType.TEXT).forEach(function(item) {
    var title = safeString_(item.getTitle());
    if (title && !textItemsByTitle[title]) textItemsByTitle[title] = item;
  });
  EVALUATION_PREFILL_FORM_CACHE_ = {
    formId: formId,
    form: form,
    textItemsByTitle: textItemsByTitle
  };
  return EVALUATION_PREFILL_FORM_CACHE_;
}

function buildEvaluationPrefillValues_(record) {
  record = record || {};
  var workingDays = toNumber_(record[H.RECORD.WORKING_DAYS], 0) ||
    calculateWorkingDays_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  var dailyHours = toNumber_(record[H.RECORD.HOURS], 0);
  var totalHours = toNumber_(record[H.RECORD.TOTAL_HOURS], 0) ||
    (workingDays * dailyHours);
  var valuesByTitle = {};
  valuesByTitle[EVALUATION_FIELDS.REQUEST_ID] = safeString_(record[H.RECORD.REQUEST_ID]);
  valuesByTitle[EVALUATION_FIELDS.REQUEST_GROUP_ID] = safeString_(record[H.RECORD.REQUEST_GROUP_ID]);
  valuesByTitle[EVALUATION_FIELDS.SELECTION_NUMBER] = safeString_(record[H.RECORD.OPTION_ORDER]);
  valuesByTitle[EVALUATION_FIELDS.EMPLOYEE_NAME] = safeString_(record[H.RECORD.EMPLOYEE_NAME]);
  valuesByTitle[EVALUATION_FIELDS.EMPLOYEE_ID] = safeString_(record[H.RECORD.EMPLOYEE_ID]);
  valuesByTitle[EVALUATION_FIELDS.JOB_TITLE] = safeString_(record[H.RECORD.EMPLOYEE_JOB_TITLE]);
  valuesByTitle[EVALUATION_FIELDS.ROTATION_UNIT] = safeString_(record[H.RECORD.ROTATION_UNIT]);
  valuesByTitle[EVALUATION_FIELDS.ROTATION_SECTION] = safeString_(record[H.RECORD.SECTION]);
  valuesByTitle[EVALUATION_FIELDS.START_DATE] = formatDate_(record[H.RECORD.START_DATE]);
  valuesByTitle[EVALUATION_FIELDS.END_DATE] = formatDate_(record[H.RECORD.END_DATE]);
  valuesByTitle[EVALUATION_FIELDS.DAILY_HOURS] = safeString_(dailyHours);
  valuesByTitle[EVALUATION_FIELDS.WORKING_DAYS] = safeString_(workingDays);
  valuesByTitle[EVALUATION_FIELDS.TOTAL_HOURS] = safeString_(totalHours);
  valuesByTitle[EVALUATION_FIELDS.PARTICIPATION_DURATION] = formatParticipationDuration_(record);
  return valuesByTitle;
}
