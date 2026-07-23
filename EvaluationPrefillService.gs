/** Editable evaluation-form prefills generated from an individual rotation record. */
function buildEvaluationPrefilledUrl_(record) {
  var cfg = getConfig();
  var fallbackUrl = safeString_(cfg.EVALUATION_FORM_URL);
  if (!cfg.EVALUATION_FORM_ID) return fallbackUrl;

  try {
    var form = FormApp.openById(cfg.EVALUATION_FORM_ID);
    var valuesByTitle = {};
    valuesByTitle[EVALUATION_FIELDS.REQUEST_ID] = safeString_(record[H.RECORD.REQUEST_ID]);
    valuesByTitle[EVALUATION_FIELDS.EMPLOYEE_NAME] = safeString_(record[H.RECORD.EMPLOYEE_NAME]);
    valuesByTitle[EVALUATION_FIELDS.JOB_TITLE] = safeString_(record[H.RECORD.EMPLOYEE_JOB_TITLE]);
    valuesByTitle[EVALUATION_FIELDS.ROTATION_SECTION] = [
      safeString_(record[H.RECORD.ROTATION_UNIT]),
      safeString_(record[H.RECORD.SECTION])
    ].filter(Boolean).join(' — ');
    valuesByTitle[EVALUATION_FIELDS.PARTICIPATION_DURATION] = formatParticipationDuration_(record);

    var response = form.createResponse();
    form.getItems(FormApp.ItemType.TEXT).forEach(function(item) {
      var value = valuesByTitle[safeString_(item.getTitle())];
      if (value === undefined || value === '') return;
      response.withItemResponse(item.asTextItem().createResponse(value));
    });
    return response.toPrefilledUrl();
  } catch (err) {
    logError_('buildEvaluationPrefilledUrl_', record && record[H.RECORD.REQUEST_ID], err);
    return fallbackUrl;
  }
}
