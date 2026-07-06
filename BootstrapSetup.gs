/**
 * Compatibility entrypoint.
 *
 * Prefer the staged run01...run10 functions for large data sets. This function
 * intentionally runs only one branching chunk so it cannot guarantee completion
 * for large unit/section lists.
 */
function bootstrapAll() {
  run01_createOrOpenResources();
  run02_setupDashboardSheets();
  run03_validateReferenceData();
  run04_rebuildMainFormBaseQuestions();
  run05_startMainFormBranching();
  run06_continueMainFormBranching();
  run07_setupEvaluationForm();
  run08_buildDashboardSummaryAndCharts();
  run09_applyProtections();
  run10_finalizeSetupSummary();
}

function getOrCreateDashboard_() {
  return resolveDashboardResource_();
}

function getOrCreateMainForm_() {
  return resolveMainFormResource_();
}

function getOrCreateEvaluationForm_() {
  return resolveEvaluationFormResource_();
}

function setupDashboardSheets_(ss, mainForm, evaluationForm) {
  setupDashboardSheetsStaged_(ss, mainForm, evaluationForm);
}
