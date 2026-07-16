function run12_createFiveMinuteFormRefreshTrigger() {
  var removed = removeFormRefreshTriggers_();
  var syncResult = repairSyncTriggerIfMissing();
  return finishStep_(
    '12 Use syncSystem For Change-Driven Form Refresh',
    BSTATUS.COMPLETE,
    'Removed ' + removed + ' legacy Step 11 trigger(s). syncSystem now checks reference hashes every five minutes and rebuilds the form only when needed. Sync trigger result: ' + syncResult + '.'
  );
}

function run12_deleteFiveMinuteFormRefreshTrigger() {
  var removed = removeFormRefreshTriggers_();
  return finishStep_('12 Delete Legacy Form Refresh Trigger', BSTATUS.COMPLETE, 'Removed ' + removed + ' legacy Step 11 form refresh trigger(s).');
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
