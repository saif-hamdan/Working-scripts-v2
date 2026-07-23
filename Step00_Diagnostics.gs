function run00_diagnoseSetupState() {
  var props = getBootstrapProps_().getProperties();
  Logger.log('=== SQU Setup Toolkit Diagnostics ===');
  Logger.log('Apps Script project ID: ' + ScriptApp.getScriptId());
  Logger.log('Current user: ' + safeUserEmail_());
  Logger.log('Last step: ' + (props[BSPROP.LAST_STEP] || 'not set'));
  Logger.log('Last status: ' + (props[BSPROP.LAST_STATUS] || 'not set'));
  Logger.log('Last message: ' + (props[BSPROP.LAST_MESSAGE] || 'not set'));

  diagnoseDashboard_(props[BSPROP.DASHBOARD_ID]);
  diagnoseMainForm_(props[BSPROP.MAIN_FORM_ID]);
  diagnoseEvaluationForm_(props[BSPROP.EVALUATION_FORM_ID]);

  Logger.log('If all IDs are missing, run run01_createOrOpenResources().');
  Logger.log('If IDs exist but cannot be opened, check permissions or run run00_clearSavedResourceIdsForFreshSetup() and then run run01_createOrOpenResources().');
}

function run00_clearSavedResourceIdsForFreshSetup() {
  clearSavedResourceProperties_();
  return finishStep_('00 Clear Saved Resource IDs', BSTATUS.COMPLETE, 'Saved setup IDs were cleared. Existing Drive files were not deleted. Run run01_createOrOpenResources() to create/open resources again.');
}

function run00_startFreshSetupResources() {
  return run00_startCompletelyFreshSetup();
}

function run00_startCompletelyFreshSetup() {
  clearSavedResourceProperties_();
  return run01_createOrOpenResources();
}

function clearSavedResourceProperties_() {
  [
    BSPROP.DASHBOARD_ID,
    BSPROP.DASHBOARD_URL,
    BSPROP.MAIN_FORM_ID,
    BSPROP.MAIN_FORM_EDIT_URL,
    BSPROP.MAIN_FORM_PUBLISHED_URL,
    BSPROP.EVALUATION_FORM_ID,
    BSPROP.EVALUATION_FORM_EDIT_URL,
    BSPROP.EVALUATION_FORM_PUBLISHED_URL,
    BSPROP.BRANCH_INDEX,
    BSPROP.BRANCH_TOTAL,
    BSPROP.BRANCH_PHASE,
    BSPROP.BRANCH_PHASE_INDEX,
    BSPROP.BRANCH_COMPLETE,
    BSPROP.BRANCH_MODE,
    BSPROP.BRANCH_TARGET_HASH,
    BSPROP.BRANCH_PUBLISHED_HASH,
    BSPROP.BRANCH_LAST_ERROR,
    BSPROP.BRANCH_REPAIR_ACTIVE,
    BSPROP.BRANCH_REPAIR_PREVIOUS_ACCEPTING,
    BSPROP.BRANCH_REPAIR_PREVIOUS_CLOSED_MESSAGE,
    BSPROP.REFERENCE_DATA_HASH,
    BSPROP.REFERENCE_DIRTY,
    BSPROP.REFERENCE_DIRTY_AT,
    BSPROP.LAST_REFERENCE_SYNC,
    BSPROP.READY,
    BSPROP.PRODUCTION_COMPATIBILITY_INDEX,
    BSPROP.PRODUCTION_COMPATIBILITY_STATUS,
    SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID,
    SETTINGS_KEYS.MAIN_FORM_ID,
    SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID,
    SETTINGS_KEYS.EVALUATION_FORM_ID,
    SETTINGS_KEYS.EVALUATION_FORM_URL,
    SETTINGS_KEYS.WEB_APP_URL
  ].forEach(function(key) {
    getBootstrapProps_().deleteProperty(key);
  });
}

function diagnoseDashboard_(id) {
  if (!id) {
    Logger.log('Dashboard spreadsheet ID: missing');
    return;
  }
  try {
    var ss = SpreadsheetApp.openById(id);
    Logger.log('Dashboard spreadsheet ID: ' + id);
    Logger.log('Dashboard URL: ' + ss.getUrl());
    Logger.log('Dashboard sheets: ' + ss.getSheets().map(function(sheet) { return sheet.getName(); }).join(', '));
  } catch (err) {
    Logger.log('Dashboard spreadsheet ID could not be opened: ' + id + ' / ' + err.message);
  }
}

function diagnoseMainForm_(id) {
  if (!id) {
    Logger.log('Main form ID: missing');
    return;
  }
  try {
    var form = FormApp.openById(id);
    Logger.log('Main form ID: ' + id);
    Logger.log('Main form edit URL: ' + form.getEditUrl());
    Logger.log('Main form published URL: ' + form.getPublishedUrl());
    Logger.log('Main form item count: ' + form.getItems().length);
  } catch (err) {
    Logger.log('Main form ID could not be opened: ' + id + ' / ' + err.message);
  }
}

function diagnoseEvaluationForm_(id) {
  if (!id) {
    Logger.log('Evaluation form ID: missing');
    return;
  }
  try {
    var form = FormApp.openById(id);
    Logger.log('Evaluation form ID: ' + id);
    Logger.log('Evaluation form edit URL: ' + form.getEditUrl());
    Logger.log('Evaluation form published URL: ' + form.getPublishedUrl());
    Logger.log('Evaluation form item count: ' + form.getItems().length);
  } catch (err) {
    Logger.log('Evaluation form ID could not be opened: ' + id + ' / ' + err.message);
  }
}
