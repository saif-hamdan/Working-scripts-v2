function run11_refreshMainFormFromAdminSheets(options) {
  options = options || {};
  return withMainFormBranchLock_('11 Refresh Main Form From Admin Sheets', options, function() {
    return refreshMainFormFromAdminSheets_(options);
  });
}

function refreshMainFormFromAdminSheets_(options) {
  options = options || {};
  var ss = openDashboardFromProperties_();
  var sync = syncAdminReferenceData_(ss);

  var issues = validateReferenceData_(ss);
  saveValidationIssues_(issues);
  var errors = issues.filter(function(issue) { return issue.severity === 'ERROR'; });
  if (errors.length) {
    return failStep_('11 Refresh Main Form From Admin Sheets', 'Reference data validation failed with ' + errors.length + ' error(s). Check Setup Summary.');
  }

  var currentHash = safeString_(sync.formHash || sync.hash);
  var publishedHash = safeString_(getBootstrapProperty_(BSPROP.BRANCH_PUBLISHED_HASH, ''));
  var inProgress = mainFormBranchingInProgress_();

  if (inProgress) {
    var mode = getBootstrapProperty_(BSPROP.BRANCH_MODE, '');
    if (mode !== BBRANCH_MODE.CLEAN && mode !== BBRANCH_MODE.LIVE) {
      return failStep_(
        '11 Refresh Main Form From Admin Sheets',
        'An older unfinished rebuild was detected without safe staging metadata. Run run17_repairMainFormBranching() once.'
      );
    }
    return continueMainFormBranching_({
      skipLock: true,
      deadline: options.deadline
    });
  }

  if (!publishedHash) {
    var existingForm = openMainFormFromProperties_();
    var existingSections = readSections_(ss);
    var adoptionIssues = validateMultiRotationForm_(existingForm, existingSections);
    if (adoptionIssues.length) {
      if (options.allowCleanInitialization === true && mainFormIsUnusedForCleanInitialization_(existingForm)) {
        initializeBootstrapRotationOptionBranching_(existingForm, readUnits_(ss), existingSections, {
          mode: BBRANCH_MODE.CLEAN,
          targetHash: currentHash,
          preservePublishedHash: false
        });
        return continueMainFormBranching_({
          skipLock: true,
          deadline: options.deadline
        });
      }
      return failStep_(
        '11 Refresh Main Form From Admin Sheets',
        'The existing form cannot be adopted as a safe published baseline. Run run17_repairMainFormBranching() once. Details: ' +
          formatBootstrapBranchValidationIssues_(adoptionIssues)
      );
    }
    setBootstrapProperties_({
      [BSPROP.BRANCH_PUBLISHED_HASH]: currentHash,
      [BSPROP.BRANCH_TARGET_HASH]: currentHash,
      [BSPROP.REFERENCE_DIRTY]: 'false',
      [BSPROP.REFERENCE_DIRTY_AT]: null
    });
    writeSetupSummary_(ss, existingForm, tryOpenEvaluationForm_());
    return finishStep_(
      '11 Refresh Main Form From Admin Sheets',
      BSTATUS.COMPLETE,
      'No rebuild was needed. The existing validated form was recorded as the published reference version.'
    );
  }

  if (currentHash === publishedHash) {
    setBootstrapProperties_({
      [BSPROP.REFERENCE_DIRTY]: 'false',
      [BSPROP.REFERENCE_DIRTY_AT]: null
    });
    return finishStep_(
      '11 Refresh Main Form From Admin Sheets',
      BSTATUS.COMPLETE,
      'No changes. The current unit and section data already matches the published form.'
    );
  }

  var form = openMainFormFromProperties_();
  var sections = readSections_(ss);
  var units = readUnits_(ss);
  initializeLiveMainFormRefresh_(form, units, sections, currentHash);
  return continueMainFormBranching_({
    skipLock: true,
    deadline: options.deadline
  });
}

function mainFormBranchingInProgress_() {
  return getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') !== 'true' &&
    Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) > 0;
}

function mainFormNeedsRefresh_() {
  if (mainFormBranchingInProgress_()) return true;
  if (getBootstrapProperty_(BSPROP.REFERENCE_DIRTY, 'false') === 'true') return true;
  var currentHash = safeString_(
    getBootstrapProperty_(BSPROP.REFERENCE_FORM_HASH, '') ||
    getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, '')
  );
  var publishedHash = safeString_(getBootstrapProperty_(BSPROP.BRANCH_PUBLISHED_HASH, ''));
  return Boolean(currentHash && currentHash !== publishedHash);
}

function markMainFormReferenceDataDirty_(currentHash) {
  currentHash = safeString_(
    currentHash ||
    getBootstrapProperty_(BSPROP.REFERENCE_FORM_HASH, '') ||
    getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, '')
  );
  var publishedHash = safeString_(getBootstrapProperty_(BSPROP.BRANCH_PUBLISHED_HASH, ''));
  var dirty = Boolean(currentHash && currentHash !== publishedHash);
  setBootstrapProperties_({
    [BSPROP.REFERENCE_DIRTY]: dirty ? 'true' : 'false',
    [BSPROP.REFERENCE_DIRTY_AT]: dirty ? new Date().toISOString() : null
  });
  return dirty;
}

function mainFormIsUnusedForCleanInitialization_(form) {
  if (Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) > 0) return false;
  try {
    return form.getResponses().length === 0;
  } catch (ignore) {
    return false;
  }
}

// Compatibility helper retained for callers from older deployments.
function resetMainFormBranchingFromReferenceData_(ss, form) {
  var sync = syncAdminReferenceData_(ss);
  return initializeLiveMainFormRefresh_(
    form,
    readUnits_(ss),
    readSections_(ss),
    sync.formHash || sync.hash
  );
}
