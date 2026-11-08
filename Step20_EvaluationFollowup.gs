/** Enable new-invitation-only tracking without rebuilding Forms or request rows. */
function run20_enableEvaluationFollowup() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Another system execution is running. Please try Step 20 again later.');
  try {
    var cfg = getConfig();
    if (!cfg.EVALUATION_FORM_ID || !cfg.EVALUATION_FORM_URL) throw new Error('Evaluation Form ID/URL is missing.');
    var props = PropertiesService.getScriptProperties();
    var previousForm = props.getProperty(EVALUATION_FOLLOWUP_CONFIG.FORM_ID_KEY);
    if (previousForm && previousForm !== cfg.EVALUATION_FORM_ID) {
      throw new Error('Follow-up is already bound to a different evaluation Form. Review the configuration before changing Forms.');
    }
    var form = FormApp.openById(cfg.EVALUATION_FORM_ID);
    var titles = form.getItems(FormApp.ItemType.TEXT).map(function(item) { return safeString_(item.getTitle()); });
    [EVALUATION_FIELDS.REQUEST_ID, EVALUATION_FIELDS.EMPLOYEE_ID].forEach(function(title) {
      if (titles.indexOf(title) === -1) throw new Error('Existing evaluation Form is missing the required matching field: ' + title);
    });
    if (form.hasLimitOneResponsePerUser && form.hasLimitOneResponsePerUser()) {
      throw new Error('Disable "Limit to 1 response" in the evaluation Form settings: each rotation needs a separate response.');
    }
    var sheet = getOrCreateSheet_(SHEETS.RECORDS);
    requireHeaders_(sheet, RECORD_HEADERS);
    var map = getHeaderMap_(sheet);
    var missing = EVALUATION_TRACKING_HEADERS.filter(function(header) { return !map[header]; });
    if (missing.length) {
      var firstColumn = sheet.getLastColumn() + 1;
      var needed = firstColumn + missing.length - 1 - sheet.getMaxColumns();
      if (needed > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), needed);
      sheet.getRange(1, firstColumn, 1, missing.length).setValues([missing])
        .setFontWeight('bold').setBackground('#F5F1E8');
    }
    map = requireHeaders_(sheet, EVALUATION_TRACKING_HEADERS);
    var rowCount = Math.max(1, sheet.getMaxRows() - 1);
    [EVALUATION_TRACKING.SUBMITTED_AT, EVALUATION_TRACKING.LAST_REMINDER_AT, EVALUATION_TRACKING.ENROLLED_AT].forEach(function(header) {
      sheet.getRange(2, map[header], rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    });
    sheet.getRange(2, map[EVALUATION_TRACKING.NEXT_REMINDER_AT], rowCount, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(2, map[EVALUATION_TRACKING.REMINDER_COUNT], rowCount, 1).setNumberFormat('0');
    [EVALUATION_TRACKING.ENROLLED_AT, EVALUATION_TRACKING.PENDING_CONTEXT, EVALUATION_TRACKING.RESPONSE_ID].forEach(function(header) {
      sheet.hideColumns(map[header]);
    });
    var triggers = ScriptApp.getProjectTriggers();
    var matching = triggers.filter(function(trigger) {
      return trigger.getHandlerFunction() === 'onEvaluationFormSubmit' && trigger.getTriggerSourceId() === cfg.EVALUATION_FORM_ID;
    });
    if (!matching.length) ScriptApp.newTrigger('onEvaluationFormSubmit').forForm(form).onFormSubmit().create();
    matching.slice(1).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
    if (!triggers.some(function(trigger) { return trigger.getHandlerFunction() === 'sendEvaluationEmails'; })) {
      ScriptApp.newTrigger('sendEvaluationEmails').timeBased().everyDays(1).atHour(6).create();
    }
    var enabledAt = props.getProperty(EVALUATION_FOLLOWUP_CONFIG.ENABLED_AT_KEY);
    if (!enabledAt) {
      enabledAt = now_().toISOString();
      props.setProperty(EVALUATION_FOLLOWUP_CONFIG.RESPONSE_CURSOR_KEY, objectToJson_({ time: new Date(enabledAt).getTime(), id: '' }));
    }
    props.setProperties({
      [EVALUATION_FOLLOWUP_CONFIG.ENABLED_AT_KEY]: enabledAt,
      [EVALUATION_FOLLOWUP_CONFIG.FORM_ID_KEY]: cfg.EVALUATION_FORM_ID,
      EVALUATION_FOLLOWUP_PAUSED: 'false'
    });
    EVALUATION_FOLLOWUP_SETTINGS_CACHE_ = null;
    var message = 'Evaluation follow-up enabled for NEW invitations only. Existing invitations are not enrolled. Reminders repeat every 3 calendar days after actual sending until a matching evaluation is received. No Forms were rebuilt and no emails were sent by setup.';
    console.info(message);
    return message;
  } finally {
    lock.releaseLock();
  }
}

function run20_pauseEvaluationFollowup() {
  PropertiesService.getScriptProperties().setProperty('EVALUATION_FOLLOWUP_PAUSED', 'true');
  EVALUATION_FOLLOWUP_SETTINGS_CACHE_ = null;
  return 'New evaluation invitations and reminders are paused. Submitted evaluations can still be recorded. Run run20_enableEvaluationFollowup() to resume without changing the original activation date.';
}
