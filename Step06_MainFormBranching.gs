function run06_continueMainFormBranching(options) {
  options = options || {};
  return withMainFormBranchLock_('06 Continue Main Form Branching', options, function() {
    return continueMainFormBranching_(options);
  });
}

function continueMainFormBranching_(options) {
  options = options || {};
  var startedAt = Date.now();
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var sections = readSections_(ss);
  var units = readUnits_(ss);
  var eligibleUnits = bootstrapEligibleUnits_(units, sections);
  if (!eligibleUnits.length) {
    return failMainFormBranching_('No active units with active sections were found. Run Steps 2 and 3, then restart with Step 5.');
  }

  var expectedTotal = bootstrapBranchWorkTotal_(eligibleUnits.length);
  var storedTotal = Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) || 0;
  var complete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  var mode = getBootstrapProperty_(BSPROP.BRANCH_MODE, '');
  var targetHash = safeString_(getBootstrapProperty_(BSPROP.BRANCH_TARGET_HASH, ''));
  var currentHash = safeString_(getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, ''));

  if (complete && storedTotal === expectedTotal) {
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return finishStep_('06 Continue Main Form Branching', BSTATUS.COMPLETE, 'Single-rotation unit-to-section branching was already complete.');
  }
  if (!storedTotal || (mode !== BBRANCH_MODE.CLEAN && mode !== BBRANCH_MODE.LIVE)) {
    return failMainFormBranching_('Branching is not safely initialized. Run run17_repairMainFormBranching() for an existing form, or run05_startMainFormBranching() during initial setup.');
  }

  if (!targetHash) {
    targetHash = currentHash;
    setBootstrapProperties_({ [BSPROP.BRANCH_TARGET_HASH]: targetHash });
  }

  if ((targetHash && currentHash && targetHash !== currentHash) || storedTotal !== expectedTotal) {
    initializeBootstrapRotationOptionBranching_(form, units, sections, {
      mode: mode,
      targetHash: currentHash,
      preservePublishedHash: true
    });
    return finishBootstrapBranchChunk_(
      ss,
      form,
      Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0,
      expectedTotal,
      'Reference data changed while branching was in progress. Progress was safely restarted for the latest data without publishing incomplete navigation.'
    );
  }

  var batchSize = Math.max(1, Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_UNITS_PER_RUN) || 8);
  var timeBudget = Math.min(210000, Math.max(60000, Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_TIME_BUDGET_MS) || 210000));
  var deadline = startedAt + timeBudget;
  var outerDeadline = Number(options.deadline) || 0;
  if (outerDeadline) deadline = Math.min(deadline, outerDeadline);
  var phase = getBootstrapProperty_(BSPROP.BRANCH_PHASE, mode === BBRANCH_MODE.CLEAN ? 'reset-navigation' : 'build');

  if (phase === 'failed') {
    return failMainFormBranching_(getBootstrapProperty_(BSPROP.BRANCH_LAST_ERROR, 'Main form branching previously failed. Run run17_repairMainFormBranching().'));
  }

  if (Date.now() >= deadline) {
    return finishBootstrapBranchChunk_(ss, form, Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0, expectedTotal, 'No form work was started because the caller was near its execution deadline. The next sync will continue.');
  }

  if (phase === 'reset-navigation') {
    if (mode !== BBRANCH_MODE.CLEAN) {
      return failMainFormBranching_('A live refresh attempted to reset published navigation. Run run17_repairMainFormBranching().');
    }
    clearFormNavigationReferences_(form);
    setBootstrapProperties_({ [BSPROP.BRANCH_PHASE]: 'remove-old-items' });
    return finishBootstrapBranchChunk_(ss, form, 0, expectedTotal, 'Old form navigation was reset for the closed clean repair. Run Step 6 again to remove old branch items.');
  }

  if (phase === 'remove-old-items') {
    if (mode !== BBRANCH_MODE.CLEAN) {
      return failMainFormBranching_('Only a closed clean repair may remove all branch items. Run run17_repairMainFormBranching().');
    }
    var cleanup = removeExistingBranchItems_(form, {
      clearNavigation: false,
      limit: Math.max(24, batchSize * 5),
      deadline: deadline
    });
    if (cleanup.remaining > 0) {
      return finishBootstrapBranchChunk_(
        ss,
        form,
        0,
        expectedTotal,
        'Removed ' + cleanup.removed + ' old or duplicate branch item(s); ' + cleanup.remaining + ' remain. Run Step 6 again.'
      );
    }
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: '0',
      [BSPROP.BRANCH_PHASE]: 'build'
    });
    return finishBootstrapBranchChunk_(ss, form, 0, expectedTotal, 'All old and duplicate branch items were removed. Run Step 6 again to build clean branches.');
  }

  if (phase === 'cleanup-obsolete') {
    return continueObsoleteBranchCleanup_(ss, form, eligibleUnits, sections, expectedTotal, batchSize, deadline, targetHash);
  }

  if (phase !== 'build') {
    return failMainFormBranching_('Unknown branching phase "' + phase + '". Run run17_repairMainFormBranching() to restart safely.');
  }

  var progress = Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, mode === BBRANCH_MODE.LIVE ? '1' : '0')) || 0;
  if (mode === BBRANCH_MODE.LIVE && progress < 1) progress = 1;
  var completedThisRun = 0;
  var lastWorkLabel = 'building form branches';
  while (progress < expectedTotal && completedThisRun < batchSize && Date.now() < deadline) {
    var work = getBootstrapBranchWork_(progress, eligibleUnits.length);
    lastWorkLabel = work.label;
    if (work.type === 'finalize-navigation') {
      var beforePublishIssues = validateBootstrapRotationBranching_(form, eligibleUnits, sections, { requirePublishedNavigation: false });
      if (beforePublishIssues.length) {
        return failMainFormBranching_('Main form validation failed before publishing navigation: ' + formatBootstrapBranchValidationIssues_(beforePublishIssues));
      }
      finalizeBootstrapRotationNavigation_(form, eligibleUnits);
      var afterPublishIssues = validateBootstrapRotationBranching_(form, eligibleUnits, sections, { requirePublishedNavigation: true });
      if (afterPublishIssues.length) {
        return failMainFormBranching_('Main form validation failed after publishing navigation: ' + formatBootstrapBranchValidationIssues_(afterPublishIssues));
      }
    } else {
      processBootstrapBranchWork_(form, eligibleUnits, sections, work);
    }
    progress++;
    completedThisRun++;
    setBootstrapProperties_({ [BSPROP.BRANCH_INDEX]: String(progress) });
  }

  if (progress >= expectedTotal) {
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: String(progress),
      [BSPROP.BRANCH_PHASE]: 'cleanup-obsolete',
      [BSPROP.BRANCH_COMPLETE]: 'false',
      [BSPROP.BRANCH_PUBLISHED_HASH]: targetHash,
      [BSPROP.BRANCH_LAST_ERROR]: ''
    });
    return finishBootstrapBranchChunk_(ss, form, progress, expectedTotal, 'Validated navigation was published. The next Step 6 or sync run will remove obsolete unreachable items and finish.');
  }

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(progress),
    [BSPROP.BRANCH_PHASE]: 'build',
    [BSPROP.BRANCH_COMPLETE]: 'false'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '06 Continue Main Form Branching',
    BSTATUS.IN_PROGRESS,
    'Completed ' + completedThisRun + ' task(s) while ' + lastWorkLabel + '. Progress is ' + progress + ' / ' + expectedTotal + '. Run Step 6 again.'
  );
}

function continueObsoleteBranchCleanup_(ss, form, eligibleUnits, sections, expectedTotal, batchSize, deadline, targetHash) {
  var cleanup = removeObsoleteBranchItems_(form, eligibleUnits, {
    limit: Math.max(24, batchSize * 5),
    deadline: deadline
  });
  if (cleanup.remaining > 0) {
    return finishBootstrapBranchChunk_(
      ss,
      form,
      expectedTotal,
      expectedTotal,
      'Removed ' + cleanup.removed + ' obsolete unreachable branch item(s); ' + cleanup.remaining + ' remain.'
    );
  }

  var issues = validateBootstrapRotationBranching_(form, eligibleUnits, sections, { requirePublishedNavigation: true });
  if (issues.length) {
    return failMainFormBranching_('Final main form validation failed: ' + formatBootstrapBranchValidationIssues_(issues));
  }

  restoreMainFormAcceptanceAfterRepair_(form);
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(expectedTotal),
    [BSPROP.BRANCH_TOTAL]: String(expectedTotal),
    [BSPROP.BRANCH_PHASE]: 'complete',
    [BSPROP.BRANCH_COMPLETE]: 'true',
    [BSPROP.BRANCH_MODE]: '',
    [BSPROP.BRANCH_TARGET_HASH]: targetHash,
    [BSPROP.BRANCH_PUBLISHED_HASH]: targetHash,
    [BSPROP.BRANCH_LAST_ERROR]: '',
    [BSPROP.REFERENCE_DIRTY]: 'false',
    [BSPROP.REFERENCE_DIRTY_AT]: null
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '06 Continue Main Form Branching',
    BSTATUS.COMPLETE,
    'Single-rotation details pages are complete and validated for ' + eligibleUnits.length + ' unit(s). The form uses one Section, From date, To date, and Daily Hours per submission.'
  );
}

function restoreMainFormAcceptanceAfterRepair_(form) {
  if (getBootstrapProperty_(BSPROP.BRANCH_REPAIR_ACTIVE, 'false') !== 'true') return;
  var wasAccepting = getBootstrapProperty_(BSPROP.BRANCH_REPAIR_PREVIOUS_ACCEPTING, 'true') === 'true';
  var previousMessage = getBootstrapProperty_(BSPROP.BRANCH_REPAIR_PREVIOUS_CLOSED_MESSAGE, '');
  try { form.setCustomClosedFormMessage(previousMessage); } catch (ignoreMessage) {}
  if (wasAccepting) {
    form.setAcceptingResponses(true);
  } else {
    form.setAcceptingResponses(false);
  }
  setBootstrapProperties_({
    [BSPROP.BRANCH_REPAIR_ACTIVE]: 'false',
    [BSPROP.BRANCH_REPAIR_PREVIOUS_ACCEPTING]: null,
    [BSPROP.BRANCH_REPAIR_PREVIOUS_CLOSED_MESSAGE]: null
  });
}

function failMainFormBranching_(message) {
  setBootstrapProperties_({
    [BSPROP.BRANCH_PHASE]: 'failed',
    [BSPROP.BRANCH_COMPLETE]: 'false',
    [BSPROP.BRANCH_LAST_ERROR]: message
  });
  return failStep_('06 Continue Main Form Branching', message);
}

function finishBootstrapBranchChunk_(ss, form, progress, total, message) {
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(progress),
    [BSPROP.BRANCH_TOTAL]: String(total),
    [BSPROP.BRANCH_COMPLETE]: 'false'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('06 Continue Main Form Branching', BSTATUS.IN_PROGRESS, message);
}
