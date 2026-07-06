function run10_finalizeSetupSummary() {
  var ss = openDashboardFromProperties_();
  var mainForm = tryOpenMainForm_();
  var evaluationForm = tryOpenEvaluationForm_();
  syncAdminReferenceData_(ss);
  writeSettings_(ss, mainForm, evaluationForm);

  var branchingComplete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  var validationComplete = getBootstrapProperty_(BSPROP.VALIDATION_STATUS, '') === BSTATUS.COMPLETE;
  var ready = branchingComplete && validationComplete && Boolean(mainForm) && Boolean(evaluationForm);
  setBootstrapProperties_({
    [BSPROP.READY]: String(ready)
  });

  writeSetupSummary_(ss, mainForm, evaluationForm);
  var message = ready
    ? 'Setup is finalized. Copy the IDs from Setup Summary into the production working scripts.'
    : 'Setup Summary was refreshed, but setup is not fully ready. Check branching and validation status.';
  return finishStep_('10 Finalize Setup Summary', ready ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS, message);
}
