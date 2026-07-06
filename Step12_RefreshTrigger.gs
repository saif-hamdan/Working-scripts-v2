function run12_createFiveMinuteFormRefreshTrigger() {
  removeFormRefreshTriggers_();
  ScriptApp.newTrigger('run11_refreshMainFormFromAdminSheets')
    .timeBased()
    .everyMinutes(5)
    .create();
  return finishStep_('12 Create Five Minute Form Refresh Trigger', BSTATUS.COMPLETE, 'A 5-minute trigger was created for run11_refreshMainFormFromAdminSheets().');
}

function run12_deleteFiveMinuteFormRefreshTrigger() {
  var removed = removeFormRefreshTriggers_();
  return finishStep_('12 Delete Five Minute Form Refresh Trigger', BSTATUS.COMPLETE, 'Removed ' + removed + ' form refresh trigger(s).');
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
