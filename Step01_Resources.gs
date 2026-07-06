function run01_createOrOpenResources() {
  var dashboard = resolveDashboardResource_();
  var mainForm = resolveMainFormResource_();
  var evaluationForm = resolveEvaluationFormResource_();

  setBootstrapProperties_({
    [BSPROP.DASHBOARD_ID]: dashboard.getId(),
    [BSPROP.DASHBOARD_URL]: dashboard.getUrl(),
    [BSPROP.MAIN_FORM_ID]: mainForm.getId(),
    [BSPROP.MAIN_FORM_EDIT_URL]: mainForm.getEditUrl(),
    [BSPROP.MAIN_FORM_PUBLISHED_URL]: mainForm.getPublishedUrl(),
    [BSPROP.EVALUATION_FORM_ID]: evaluationForm.getId(),
    [BSPROP.EVALUATION_FORM_EDIT_URL]: evaluationForm.getEditUrl(),
    [BSPROP.EVALUATION_FORM_PUBLISHED_URL]: evaluationForm.getPublishedUrl(),
    [BSPROP.READY]: 'false'
  });

  writeSetupSummary_(dashboard, mainForm, evaluationForm);
  Logger.log('Dashboard URL: ' + dashboard.getUrl());
  Logger.log('Main form edit URL: ' + mainForm.getEditUrl());
  Logger.log('Main form published URL: ' + mainForm.getPublishedUrl());
  Logger.log('Evaluation form edit URL: ' + evaluationForm.getEditUrl());
  Logger.log('Evaluation form published URL: ' + evaluationForm.getPublishedUrl());
  return finishStep_('01 Create/Open Resources', BSTATUS.COMPLETE, 'Resources are ready. Setup Summary was created or refreshed.');
}

function resolveDashboardResource_() {
  var configuredId = BOOTSTRAP_CONFIG.CREATE_NEW_DASHBOARD_SPREADSHEET ? '' : BOOTSTRAP_CONFIG.EXISTING_DASHBOARD_SPREADSHEET_ID;
  var savedId = BOOTSTRAP_CONFIG.FORCE_CREATE_NEW_RESOURCES ? '' : getBootstrapProperty_(BSPROP.DASHBOARD_ID, '');
  var id = configuredId || savedId;
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      if (configuredId || !BOOTSTRAP_CONFIG.CREATE_NEW_DASHBOARD_SPREADSHEET) throw err;
      Logger.log('Saved dashboard ID could not be opened; creating a new dashboard spreadsheet.');
    }
  }
  if (!BOOTSTRAP_CONFIG.CREATE_NEW_DASHBOARD_SPREADSHEET) {
    throw new Error('EXISTING_DASHBOARD_SPREADSHEET_ID is required when CREATE_NEW_DASHBOARD_SPREADSHEET is false.');
  }
  return SpreadsheetApp.create('SQU Training Dashboard');
}

function resolveMainFormResource_() {
  var configuredId = BOOTSTRAP_CONFIG.CREATE_NEW_MAIN_FORM ? '' : BOOTSTRAP_CONFIG.EXISTING_MAIN_FORM_ID;
  var savedId = BOOTSTRAP_CONFIG.FORCE_CREATE_NEW_RESOURCES ? '' : getBootstrapProperty_(BSPROP.MAIN_FORM_ID, '');
  var id = configuredId || savedId;
  if (id) {
    try {
      return FormApp.openById(id);
    } catch (err) {
      if (configuredId || !BOOTSTRAP_CONFIG.CREATE_NEW_MAIN_FORM) throw err;
      Logger.log('Saved main form ID could not be opened; creating a new main form.');
    }
  }
  if (!BOOTSTRAP_CONFIG.CREATE_NEW_MAIN_FORM) {
    throw new Error('EXISTING_MAIN_FORM_ID is required when CREATE_NEW_MAIN_FORM is false.');
  }
  return FormApp.create('طلب تدريب موظف جديد / New Employee Training Request');
}

function resolveEvaluationFormResource_() {
  var configuredId = BOOTSTRAP_CONFIG.CREATE_NEW_EVALUATION_FORM ? '' : BOOTSTRAP_CONFIG.EXISTING_EVALUATION_FORM_ID;
  var savedId = BOOTSTRAP_CONFIG.FORCE_CREATE_NEW_RESOURCES ? '' : getBootstrapProperty_(BSPROP.EVALUATION_FORM_ID, '');
  var id = configuredId || savedId;
  if (id) {
    try {
      return FormApp.openById(id);
    } catch (err) {
      if (configuredId || !BOOTSTRAP_CONFIG.CREATE_NEW_EVALUATION_FORM) throw err;
      Logger.log('Saved evaluation form ID could not be opened; creating a new evaluation form.');
    }
  }
  if (!BOOTSTRAP_CONFIG.CREATE_NEW_EVALUATION_FORM) {
    throw new Error('EXISTING_EVALUATION_FORM_ID is required when CREATE_NEW_EVALUATION_FORM is false.');
  }
  return FormApp.create('تقييم تجربة التدريب / Training Evaluation');
}
