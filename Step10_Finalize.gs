function run10_finalizeSetupSummary() {
  var ss = openDashboardFromProperties_();
  var mainForm = tryOpenMainForm_();
  var evaluationForm = tryOpenEvaluationForm_();
  syncAdminReferenceData_(ss);
  writeSettings_(ss, mainForm, evaluationForm);
  mirrorCurrentSettingsToScriptProperties_(ss);

  var bootstrapReady = isBootstrapSetupReady_(mainForm, evaluationForm);
  var compatibilityComplete = getBootstrapProperty_(BSPROP.PRODUCTION_COMPATIBILITY_STATUS, '') === BSTATUS.COMPLETE;
  var ready = bootstrapReady && compatibilityComplete;
  setBootstrapProperties_({
    [BSPROP.READY]: String(ready)
  });

  writeSetupSummary_(ss, mainForm, evaluationForm);
  var message = ready
    ? 'Setup is finalized. Resource IDs were written into this project settings sheet, and production compatibility has passed.'
    : bootstrapReady
      ? 'Resource IDs were written into this project settings sheet. Run run13_verifyProductionCompatibility() until it reports Complete; production compatibility must pass before go-live.'
      : 'Setup Summary was refreshed and resource IDs were written into this project settings sheet, but setup is not fully ready. Check branching and validation status.';
  return finishStep_('10 Finalize Setup Summary', ready ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS, message);
}

function run13_verifyProductionCompatibility() {
  var ss = openDashboardFromProperties_();
  mirrorCurrentSettingsToScriptProperties_(ss);

  var steps = getProductionCompatibilitySteps_();
  var index = Number(getBootstrapProperty_(BSPROP.PRODUCTION_COMPATIBILITY_INDEX, '0')) || 0;
  if (index < 0 || index >= steps.length) index = 0;

  var step = steps[index];
  step.fn();

  var nextIndex = index + 1;
  var complete = nextIndex >= steps.length;
  var mainForm = tryOpenMainForm_();
  var evaluationForm = tryOpenEvaluationForm_();
  if (complete) {
    nextIndex = 0;
    writeSettings_(ss, mainForm, evaluationForm);
    mirrorCurrentSettingsToScriptProperties_(ss);
  }

  var bootstrapReady = isBootstrapSetupReady_(mainForm, evaluationForm);
  var ready = bootstrapReady && complete;
  setBootstrapProperties_({
    [BSPROP.PRODUCTION_COMPATIBILITY_INDEX]: String(nextIndex),
    [BSPROP.PRODUCTION_COMPATIBILITY_STATUS]: complete ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS,
    [BSPROP.READY]: String(ready)
  });

  writeSetupSummary_(ss, mainForm, evaluationForm);
  var message = complete
    ? 'Production compatibility passed. Current setup functions completed successfully, and IDs remain in this project settings sheet.'
    : 'Production compatibility step ' + (index + 1) + ' of ' + steps.length + ' passed: ' + step.name + '. Run run13_verifyProductionCompatibility() again to continue with ' + steps[nextIndex].name + '.';
  return finishStep_('13 Verify Production Compatibility', complete ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS, message);
}

function getProductionCompatibilitySteps_() {
  return [
    { name: 'setupSheets()', fn: setupSheets },
    { name: 'setupResponseQueueSheet_()', fn: setupResponseQueueSheet_ },
    { name: 'setupValidations()', fn: setupValidations },
    { name: 'protectDashboardSheets()', fn: protectDashboardSheets },
    { name: 'refreshDashboard()', fn: refreshDashboard },
    { name: 'verify completed main-form branching', fn: verifyCompletedMainFormBranching_ },
    { name: 'installTriggers()', fn: installTriggers }
  ];
}

function verifyCompletedMainFormBranching_() {
  if (getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') !== 'true') {
    throw new Error('Main form branching is incomplete. Run run06_continueMainFormBranching() until it reports Complete.');
  }
  var ss = openDashboardFromProperties_();
  var eligibleUnitCount = bootstrapEligibleUnits_(readUnits_(ss), readSections_(ss)).length;
  var expectedTotal = bootstrapBranchWorkTotal_(eligibleUnitCount);
  var progress = Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0;
  var total = Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) || 0;
  if (!eligibleUnitCount || progress !== expectedTotal || total !== expectedTotal) {
    throw new Error('Main form branching progress does not match the current unit and section data. Restart with Step 5.');
  }
}

function isBootstrapSetupReady_(mainForm, evaluationForm) {
  var branchingComplete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  var validationComplete = getBootstrapProperty_(BSPROP.VALIDATION_STATUS, '') === BSTATUS.COMPLETE;
  return branchingComplete && validationComplete && Boolean(mainForm) && Boolean(evaluationForm);
}

function mirrorCurrentSettingsToScriptProperties_(ss) {
  var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
  var settings = readSettingsRows_(ss.getSheetByName(settingsSheetName));
  var values = {};
  Object.keys(SETTINGS_KEYS).forEach(function(name) {
    var key = SETTINGS_KEYS[name];
    if (settings[key] !== undefined && String(settings[key]).trim() !== '') values[key] = settings[key];
  });
  if (Object.keys(values).length) PropertiesService.getScriptProperties().setProperties(values, false);
}
