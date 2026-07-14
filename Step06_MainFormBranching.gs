function run06_continueMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var units = readUnits_(ss);
  var sections = readSections_(ss);
  if (!units.length) failStep_('06 Continue Main Form Branching', 'No active units were found.');

  var complete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false') === 'true';
  if (!complete) {
    rebuildBootstrapRotationOptionBranching_(form, units, sections);
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: String(units.length),
      [BSPROP.BRANCH_TOTAL]: String(units.length),
      [BSPROP.BRANCH_COMPLETE]: 'true'
    });
  }

  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '06 Continue Main Form Branching',
    BSTATUS.COMPLETE,
    complete
      ? 'Internal and external unit-to-section branching was already complete.'
      : 'Internal and external unit-to-section branching is complete for ' + units.length + ' unit(s).'
  );
}
