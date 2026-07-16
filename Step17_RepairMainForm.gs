function run17_repairMainFormBranching(options) {
  options = options || {};
  return withMainFormBranchLock_('17 Repair Main Form Branching', options, function() {
    return repairMainFormBranching_(options);
  });
}

function repairMainFormBranching_(options) {
  options = options || {};
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  removeFormRefreshTriggers_();

  var sync = syncAdminReferenceData_(ss);
  var referenceIssues = validateReferenceData_(ss);
  saveValidationIssues_(referenceIssues);
  var referenceErrors = referenceIssues.filter(function(issue) { return issue.severity === 'ERROR'; });
  if (referenceErrors.length) {
    return failStep_(
      '17 Repair Main Form Branching',
      'Repair was not started because reference data has ' + referenceErrors.length + ' error(s). Correct them in the admin sheets and run Step 17 again.'
    );
  }

  var repairAlreadyActive = getBootstrapProperty_(BSPROP.BRANCH_REPAIR_ACTIVE, 'false') === 'true';
  var cleanRepairInProgress = repairAlreadyActive &&
    getBootstrapProperty_(BSPROP.BRANCH_MODE, '') === BBRANCH_MODE.CLEAN &&
    mainFormBranchingInProgress_() &&
    getBootstrapProperty_(BSPROP.BRANCH_PHASE, '') !== 'failed';

  if (cleanRepairInProgress) {
    return continueMainFormBranching_({
      skipLock: true,
      deadline: options.deadline
    });
  }

  if (!repairAlreadyActive) {
    var wasAccepting = true;
    var previousClosedMessage = '';
    try { wasAccepting = form.isAcceptingResponses(); } catch (ignoreAcceptingState) {}
    try { previousClosedMessage = form.getCustomClosedFormMessage() || ''; } catch (ignoreClosedMessage) {}
    setBootstrapProperties_({
      [BSPROP.BRANCH_REPAIR_PREVIOUS_ACCEPTING]: wasAccepting ? 'true' : 'false',
      [BSPROP.BRANCH_REPAIR_PREVIOUS_CLOSED_MESSAGE]: previousClosedMessage
    });
  }

  var maintenanceMessage = 'النموذج مغلق مؤقتاً لإجراء صيانة آمنة. يرجى المحاولة لاحقاً. / The form is temporarily closed for safe maintenance. Please try again later.';
  try { form.setCustomClosedFormMessage(maintenanceMessage); } catch (ignoreMaintenanceMessage) {}
  form.setAcceptingResponses(false);
  setBootstrapProperties_({
    [BSPROP.BRANCH_REPAIR_ACTIVE]: 'true',
    [BSPROP.BRANCH_LAST_ERROR]: '',
    [BSPROP.REFERENCE_DIRTY]: 'true',
    [BSPROP.REFERENCE_DIRTY_AT]: new Date().toISOString()
  });

  try {
    initializeBootstrapRotationOptionBranching_(form, readUnits_(ss), readSections_(ss), {
      mode: BBRANCH_MODE.CLEAN,
      targetHash: sync.hash,
      preservePublishedHash: true
    });

    var result = continueMainFormBranching_({
      skipLock: true,
      deadline: options.deadline
    });
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return result;
  } catch (err) {
    setBootstrapProperties_({
      [BSPROP.BRANCH_PHASE]: 'failed',
      [BSPROP.BRANCH_COMPLETE]: 'false',
      [BSPROP.BRANCH_LAST_ERROR]: safeString_(err && err.message)
    });
    throw err;
  }
}
