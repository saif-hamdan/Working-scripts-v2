function run11_refreshMainFormFromAdminSheets() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var previousHash = getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, '');
  var sync = syncAdminReferenceData_(ss);

  var issues = validateReferenceData_(ss);
  saveValidationIssues_(issues);
  var errors = issues.filter(function(issue) { return issue.severity === 'ERROR'; });
  if (errors.length) {
    failStep_('11 Refresh Main Form From Admin Sheets', 'Reference data validation failed with ' + errors.length + ' error(s). Check Setup Summary.');
  }

  var branchingComplete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  if (sync.hash === previousHash && branchingComplete) {
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return finishStep_('11 Refresh Main Form From Admin Sheets', BSTATUS.COMPLETE, 'No admin reference data changes were found. Main form is already up to date.');
  }

  if (sync.hash !== previousHash) {
    resetMainFormBranchingFromReferenceData_(ss, form);
  }

  run06_continueMainFormBranching();
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('11 Refresh Main Form From Admin Sheets', BSTATUS.IN_PROGRESS, 'Main form refresh ran. If branching is not complete, run this function again or use the 30-minute trigger.');
}

function resetMainFormBranchingFromReferenceData_(ss, form) {
  rebuildMainFormBase_(form, ss);
  removeExistingBranchItems_(form);

  var units = readUnits_(ss);
  var rotationUnit = getItem_(form, BFORM.TITLES.ROTATION_UNIT, FormApp.ItemType.LIST);
  if (!rotationUnit) {
    failStep_('11 Refresh Main Form From Admin Sheets', 'Rotation Unit question is missing after form rebuild.');
  }
  if (units.length) {
    rotationUnit.asListItem().setChoiceValues(uniqueNonEmpty_(units.map(function(unit) { return unit.name; })));
  }

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: String(units.length),
    [BSPROP.BRANCH_COMPLETE]: 'false'
  });
}
