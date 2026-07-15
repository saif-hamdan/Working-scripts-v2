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
  var completeAfterChunk = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '11 Refresh Main Form From Admin Sheets',
    completeAfterChunk ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS,
    completeAfterChunk
      ? 'Main form reference data and unit-to-section branching were refreshed.'
      : 'Main form refresh is still in progress. Run run11_refreshMainFormFromAdminSheets() again until it reports Complete.'
  );
}

function resetMainFormBranchingFromReferenceData_(ss, form) {
  initializeBootstrapRotationOptionBranching_(form, readUnits_(ss), readSections_(ss));
}
