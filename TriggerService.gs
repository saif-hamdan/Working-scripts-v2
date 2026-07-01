/** Installable triggers. */
function installTriggers() {
  deleteExistingTriggers();
  var cfg = getConfig();
  // Request creation is handled by processUnprocessedFormResponses() from the
  // 5-minute sync flow, so no form-submit trigger is installed.
  if (cfg.DASHBOARD_SPREADSHEET_ID) {
    ScriptApp.newTrigger('onEdit')
      .forSpreadsheet(SpreadsheetApp.openById(cfg.DASHBOARD_SPREADSHEET_ID))
      .onEdit()
      .create();
  }
  ScriptApp.newTrigger('syncSystem').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sendEvaluationEmails').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('maintenanceCheck').timeBased().everyDays(1).atHour(3).create();
  logInfo_('installTriggers', '', 'Triggers installed.');
}

function deleteExistingTriggers() {
  var handlerNames = ['onFormSubmit', 'onEdit', 'syncSystem', 'sendEvaluationEmails', 'maintenanceCheck'];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
