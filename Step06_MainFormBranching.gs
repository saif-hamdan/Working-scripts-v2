function run06_continueMainFormBranching() {
  var startedAt = Date.now();
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var sections = readSections_(ss);
  var eligibleUnits = bootstrapEligibleUnits_(readUnits_(ss), sections);
  if (!eligibleUnits.length) {
    failStep_('06 Continue Main Form Branching', 'No active units with active sections were found. Run Steps 2 and 3, then restart with Step 5.');
  }

  var expectedTotal = bootstrapBranchWorkTotal_(eligibleUnits.length);
  var storedTotal = Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) || 0;
  var complete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  if (complete && storedTotal === expectedTotal) {
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return finishStep_('06 Continue Main Form Branching', BSTATUS.COMPLETE, 'Single-rotation unit-to-section branching was already complete.');
  }
  if (!storedTotal) {
    failStep_('06 Continue Main Form Branching', 'Branching is not initialized. Run run05_startMainFormBranching() first.');
  }
  if (storedTotal !== expectedTotal) {
    failStep_('06 Continue Main Form Branching', 'The active unit/section data changed during branching. Run run05_startMainFormBranching() again, then continue with Step 6.');
  }

  var batchSize = Math.max(1, Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_UNITS_PER_RUN) || 8);
  var timeBudget = Math.min(210000, Math.max(60000, Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_TIME_BUDGET_MS) || 210000));
  var deadline = startedAt + timeBudget;
  var phase = getBootstrapProperty_(BSPROP.BRANCH_PHASE, 'reset-navigation');

  if (phase === 'reset-navigation') {
    clearFormNavigationReferences_(form);
    setBootstrapProperties_({ [BSPROP.BRANCH_PHASE]: 'remove-old-items' });
    return finishBootstrapBranchChunk_(ss, form, 0, expectedTotal, 'Old form navigation was reset. Run Step 6 again to remove old branch items.');
  }

  if (phase === 'remove-old-items') {
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
        'Removed ' + cleanup.removed + ' old branch item(s); ' + cleanup.remaining + ' remain. Run Step 6 again.'
      );
    }
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: '0',
      [BSPROP.BRANCH_PHASE]: 'build'
    });
    return finishBootstrapBranchChunk_(ss, form, 0, expectedTotal, 'Old branch items were removed. Run Step 6 again to start building the new branches.');
  }

  if (phase !== 'build') {
    failStep_('06 Continue Main Form Branching', 'Unknown branching phase "' + phase + '". Run run05_startMainFormBranching() to restart safely.');
  }

  var progress = Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0;
  var completedThisRun = 0;
  var lastWorkLabel = 'building form branches';
  while (progress < expectedTotal && completedThisRun < batchSize && Date.now() < deadline) {
    var work = getBootstrapBranchWork_(progress, eligibleUnits.length);
    lastWorkLabel = work.label;
    processBootstrapBranchWork_(form, eligibleUnits, sections, work);
    progress++;
    completedThisRun++;
    // Save after every unit/task so a forced Apps Script timeout can resume safely.
    setBootstrapProperties_({ [BSPROP.BRANCH_INDEX]: String(progress) });
  }

  complete = progress >= expectedTotal;
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(progress),
    [BSPROP.BRANCH_PHASE]: complete ? 'complete' : 'build',
    [BSPROP.BRANCH_COMPLETE]: String(complete)
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '06 Continue Main Form Branching',
    complete ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS,
    complete
      ? 'Single-rotation details pages are complete for ' + eligibleUnits.length + ' unit(s). Each submission now contains one section, From date, To date, and Daily Hours.'
      : 'Completed ' + completedThisRun + ' task(s) while ' + lastWorkLabel + '. Progress is ' + progress + ' / ' + expectedTotal + '. Run Step 6 again.'
  );
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
