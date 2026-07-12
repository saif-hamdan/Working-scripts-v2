function run06_continueMainFormBranching() {
  var started = Date.now();
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var units = readUnits_(ss);
  var sections = readSections_(ss);
  var total = units.length;
  var index = Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0;
  var chunkSize = Math.max(Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_UNITS_PER_RUN) || 25, 1);
  var timeBudget = Math.max(Number(BOOTSTRAP_CONFIG.MAIN_FORM_BRANCH_TIME_BUDGET_MS) || 260000, 30000);

  if (!total) failStep_('06 Continue Main Form Branching', 'No active units were found.');
  if (!getItem_(form, BFORM.TITLES.ROTATION_UNIT, FormApp.ItemType.LIST)) {
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: String(total),
      [BSPROP.BRANCH_TOTAL]: String(total),
      [BSPROP.BRANCH_COMPLETE]: 'true'
    });
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return finishStep_('06 Continue Main Form Branching', BSTATUS.COMPLETE, 'Unit branching is not required because the current main form uses internal/external rotation option lists.');
  }
  if (index >= total) {
    rebuildRotationUnitRoutingChoices_(form, units, total);
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: String(total),
      [BSPROP.BRANCH_TOTAL]: String(total),
      [BSPROP.BRANCH_COMPLETE]: 'true'
    });
    return finishStep_('06 Continue Main Form Branching', BSTATUS.COMPLETE, 'Main form branching was already complete.');
  }

  var processed = 0;
  while (index < total && processed < chunkSize && Date.now() - started < timeBudget) {
    buildUnitBranchPage_(form, units[index], sections);
    index++;
    processed++;
  }

  rebuildRotationUnitRoutingChoices_(form, units, index);
  var complete = index >= total;
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(index),
    [BSPROP.BRANCH_TOTAL]: String(total),
    [BSPROP.BRANCH_COMPLETE]: String(complete)
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());

  var message = complete
    ? 'Main form branching is complete for ' + total + ' unit(s).'
    : 'Processed ' + processed + ' unit(s). Progress: ' + index + ' / ' + total + '. Run this step again.';
  return finishStep_('06 Continue Main Form Branching', complete ? BSTATUS.COMPLETE : BSTATUS.IN_PROGRESS, message);
}
