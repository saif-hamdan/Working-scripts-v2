/** Installable triggers. */
const SYNC_TRIGGER_PROPERTY_KEY = 'SYNC_TRIGGER_ID';

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
  installSyncTriggerSafe();
  ScriptApp.newTrigger('sendEvaluationEmails').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('maintenanceCheck').timeBased().everyDays(1).atHour(3).create();
  installEmployeeTrainingHoursSummaryTriggerSafe();
  logInfo_('installTriggers', '', 'Triggers installed.');
}

function deleteExistingTriggers() {
  var handlerNames = ['onFormSubmit', 'onEdit', 'sendEvaluationEmails', 'maintenanceCheck', 'scheduledRefreshEmployeeTrainingHoursSummary'];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlerNames.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function installSyncTriggerSafe() {
  var props = PropertiesService.getScriptProperties();
  var newTrigger = ScriptApp.newTrigger('syncSystem')
    .timeBased()
    .everyMinutes(SYNC_CONFIG.TRIGGER_EVERY_MINUTES)
    .create();
  var newTriggerId = newTrigger.getUniqueId();
  var syncTriggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'syncSystem';
  });
  var verified = syncTriggers.some(function(trigger) {
    return trigger.getUniqueId() === newTriggerId;
  });
  if (!verified) {
    logError_('installSyncTriggerSafe', '', new Error('Created syncSystem trigger could not be verified. Existing syncSystem triggers were left unchanged.'));
    return null;
  }

  props.setProperty(SYNC_TRIGGER_PROPERTY_KEY, newTriggerId);
  syncTriggers.forEach(function(trigger) {
    if (trigger.getUniqueId() !== newTriggerId) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  logInfo_('installSyncTriggerSafe', '', 'syncSystem trigger installed and verified: ' + newTriggerId);
  return newTriggerId;
}

function repairSyncTriggerIfMissing() {
  var syncTriggerCount = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'syncSystem';
  }).length;
  if (syncTriggerCount === 0) {
    logInfo_('repairSyncTriggerIfMissing', '', 'No syncSystem trigger found; installing a replacement.');
    return installSyncTriggerSafe();
  }
  logInfo_('repairSyncTriggerIfMissing', '', 'syncSystem trigger count: ' + syncTriggerCount + '. No repair needed.');
  return syncTriggerCount;
}


function installEmployeeTrainingHoursSummaryTriggerSafe() {
  var newTrigger = ScriptApp.newTrigger('scheduledRefreshEmployeeTrainingHoursSummary')
    .timeBased()
    .everyMinutes(EMPLOYEE_TRAINING_HOURS_CONFIG.TRIGGER_EVERY_MINUTES)
    .create();
  var newTriggerId = newTrigger.getUniqueId();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'scheduledRefreshEmployeeTrainingHoursSummary' && trigger.getUniqueId() !== newTriggerId) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  logInfo_('installEmployeeTrainingHoursSummaryTriggerSafe', '', 'Employee training hours summary trigger installed: ' + newTriggerId);
  return newTriggerId;
}
