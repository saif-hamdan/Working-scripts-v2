const FORM_REFRESH_TRIGGER_EVERY_MINUTES = 30;

function run12_createFiveMinuteFormRefreshTrigger() {
  removeFormRefreshTriggers_();
  ScriptApp.newTrigger('run11_refreshMainFormFromAdminSheets')
    .timeBased()
    .everyMinutes(FORM_REFRESH_TRIGGER_EVERY_MINUTES)
    .create();
  return finishStep_('12 Create Thirty Minute Form Refresh Trigger', BSTATUS.COMPLETE, 'A ' + FORM_REFRESH_TRIGGER_EVERY_MINUTES + '-minute trigger was created for run11_refreshMainFormFromAdminSheets().');
}

function run12_deleteFiveMinuteFormRefreshTrigger() {
  var removed = removeFormRefreshTriggers_();
  return finishStep_('12 Delete Thirty Minute Form Refresh Trigger', BSTATUS.COMPLETE, 'Removed ' + removed + ' form refresh trigger(s).');
}

function removeFormRefreshTriggers_() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === 'run11_refreshMainFormFromAdminSheets') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  return removed;
}
