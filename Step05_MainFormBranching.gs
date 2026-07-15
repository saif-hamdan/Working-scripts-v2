function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  var eligibleUnits = initializeBootstrapRotationOptionBranching_(form, readUnits_(ss), readSections_(ss));

  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '05 Start Main Form Branching',
    BSTATUS.IN_PROGRESS,
    'Branching was initialized for ' + eligibleUnits.length + ' unit(s). Run run06_continueMainFormBranching() repeatedly until it reports Complete.'
  );
}

function refreshMainFormRotationOptionChoices_(form, dashboard) {
  return initializeBootstrapRotationOptionBranching_(form, readUnits_(dashboard), readSections_(dashboard));
}

function initializeBootstrapRotationOptionBranching_(form, units, sections) {
  var eligibleUnits = bootstrapEligibleUnits_(units, sections);
  var currentUnitItem = getItem_(form, BFORM.TITLES.CURRENT_UNIT, FormApp.ItemType.LIST);
  if (!currentUnitItem) {
    throw new Error('Current Employee Unit question is missing. Run run04_rebuildMainFormBaseQuestions() first.');
  }
  if (!eligibleUnits.length) {
    currentUnitItem.asListItem().setChoiceValues([BFORM.NO_UNITS]);
    throw new Error('No active units with active sections were found. Check the unit and section sheets, then run Step 3 again.');
  }

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: String(bootstrapBranchWorkTotal_(eligibleUnits.length)),
    [BSPROP.BRANCH_PHASE]: 'reset-navigation',
    [BSPROP.BRANCH_COMPLETE]: 'false',
    [BSPROP.PRODUCTION_COMPATIBILITY_STATUS]: '',
    [BSPROP.READY]: 'false'
  });
  return eligibleUnits;
}

function bootstrapBranchedOptionTitle_(template, optionNumber, unitName) {
  return optionTitle_(template, optionNumber) + ' - ' + safeString_(unitName);
}

function bootstrapSectionNamesForUnit_(unit, sections) {
  return uniqueNonEmpty_((sections || []).filter(function(section) {
    if (unit.id && section.unitId) return normalizeKey_(section.unitId) === normalizeKey_(unit.id);
    return normalizeKey_(section.unitName) === normalizeKey_(unit.name);
  }).map(function(section) {
    return section.name;
  }));
}

function bootstrapEligibleUnits_(units, sections) {
  return (units || []).filter(function(unit) {
    return safeString_(unit.name) && bootstrapSectionNamesForUnit_(unit, sections).length;
  });
}

function bootstrapBranchWorkTotal_(unitCount) {
  return (Number(unitCount) || 0) * 4 + 4;
}

function getBootstrapBranchWork_(progressIndex, unitCount) {
  if (progressIndex < unitCount) {
    return { type: 'internal-unit', unitIndex: progressIndex, label: 'building internal unit sections' };
  }
  if (progressIndex < unitCount * 4) {
    var externalOffset = progressIndex - unitCount;
    return {
      type: 'external-unit',
      externalOption: Math.floor(externalOffset / unitCount) + 1,
      unitIndex: externalOffset % unitCount,
      label: 'building external unit sections'
    };
  }
  var finalizeOffset = progressIndex - unitCount * 4;
  return finalizeOffset === 0
    ? { type: 'finalize-internal', label: 'connecting internal navigation' }
    : { type: 'finalize-external', externalOption: finalizeOffset, label: 'connecting external navigation' };
}

function processBootstrapBranchWork_(form, eligibleUnits, sections, work) {
  if (work.type === 'internal-unit') {
    buildBootstrapInternalUnitBranch_(form, eligibleUnits[work.unitIndex], sections);
    return;
  }
  if (work.type === 'external-unit') {
    buildBootstrapExternalUnitBranch_(form, eligibleUnits[work.unitIndex], sections, work.externalOption);
    return;
  }
  if (work.type === 'finalize-internal') {
    finalizeBootstrapInternalNavigation_(form, eligibleUnits);
    return;
  }
  finalizeBootstrapExternalNavigation_(form, eligibleUnits, work.externalOption);
}

function buildBootstrapInternalUnitBranch_(form, unit, sections) {
  ensurePage_(form, BFORM.INTERNAL_BRANCH_PAGE_PREFIX + unit.name);
  var sectionNames = bootstrapSectionNamesForUnit_(unit, sections);
  for (var optionNumber = 1; optionNumber <= (BFORM.MAX_INTERNAL_OPTIONS || 3); optionNumber++) {
    var required = optionNumber === 1;
    ensureList_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber, unit.name), required)
      .setChoiceValues(sectionNames);
    ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber, unit.name), required);
    ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, optionNumber, unit.name), required);
  }
}

function buildBootstrapExternalUnitBranch_(form, unit, sections, externalOption) {
  ensurePage_(form, BFORM.EXTERNAL_ROUTER_PAGE_PREFIX + externalOption);
  var routerItem = ensureList_(form, optionTitle_(BFORM.TITLES.EXTERNAL_UNIT_PREFIX, externalOption), true);
  routerItem.setChoiceValues([BFORM.NO_EXTERNAL_ROTATION]);
  try {
    routerItem.setHelpText('Select a unit different from the employee current unit, or choose not to add external rotation.');
  } catch (ignoreHelp) {}

  ensurePage_(form, BFORM.EXTERNAL_BRANCH_PAGE_PREFIX + externalOption + ' - ' + unit.name);
  ensureList_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption, unit.name), true)
    .setChoiceValues(bootstrapSectionNamesForUnit_(unit, sections));
  ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption, unit.name), true);
  ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_TO_PREFIX, externalOption, unit.name), true);
  applyNumericValidation_(ensureText_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption, unit.name), true));
}

function finalizeBootstrapInternalNavigation_(form, eligibleUnits) {
  var currentUnitItem = getItem_(form, BFORM.TITLES.CURRENT_UNIT, FormApp.ItemType.LIST);
  var firstExternalRouter = getItem_(form, BFORM.EXTERNAL_ROUTER_PAGE_PREFIX + '1', FormApp.ItemType.PAGE_BREAK);
  if (!currentUnitItem || !firstExternalRouter) {
    throw new Error('The internal or external form routing items are incomplete. Run Step 6 again.');
  }
  currentUnitItem = currentUnitItem.asListItem();
  firstExternalRouter = firstExternalRouter.asPageBreakItem();
  var choices = eligibleUnits.map(function(unit) {
    var page = getItem_(form, BFORM.INTERNAL_BRANCH_PAGE_PREFIX + unit.name, FormApp.ItemType.PAGE_BREAK);
    if (!page) throw new Error('Missing internal rotation page for unit: ' + unit.name);
    page = page.asPageBreakItem();
    try { page.setGoToPage(firstExternalRouter); } catch (ignoreNavigation) {}
    return currentUnitItem.createChoice(unit.name, page);
  });
  currentUnitItem.setChoices(choices);
}

function finalizeBootstrapExternalNavigation_(form, eligibleUnits, externalOption) {
  var routerItem = getItem_(form, optionTitle_(BFORM.TITLES.EXTERNAL_UNIT_PREFIX, externalOption), FormApp.ItemType.LIST);
  if (!routerItem) throw new Error('Missing external rotation unit question for option ' + externalOption + '.');
  routerItem = routerItem.asListItem();
  var nextRouter = externalOption < (BFORM.MAX_EXTERNAL_OPTIONS || 3)
    ? getItem_(form, BFORM.EXTERNAL_ROUTER_PAGE_PREFIX + (externalOption + 1), FormApp.ItemType.PAGE_BREAK)
    : null;
  if (nextRouter) nextRouter = nextRouter.asPageBreakItem();

  var choices = [routerItem.createChoice(BFORM.NO_EXTERNAL_ROTATION, FormApp.PageNavigationType.SUBMIT)];
  eligibleUnits.forEach(function(unit) {
    var page = getItem_(form, BFORM.EXTERNAL_BRANCH_PAGE_PREFIX + externalOption + ' - ' + unit.name, FormApp.ItemType.PAGE_BREAK);
    if (!page) throw new Error('Missing external rotation page for unit: ' + unit.name + ', option ' + externalOption + '.');
    page = page.asPageBreakItem();
    choices.push(routerItem.createChoice(unit.name, page));
    try { page.setGoToPage(nextRouter || FormApp.PageNavigationType.SUBMIT); } catch (ignoreNavigation) {}
  });
  routerItem.setChoices(choices);
}

function removeExistingBranchItems_(form, options) {
  options = options || {};
  if (options.clearNavigation !== false) clearFormNavigationReferences_(form);

  var exactTitles = [
    BFORM.TITLES.PHASE_ONE_INTERNAL,
    BFORM.TITLES.PHASE_TWO_EXTERNAL,
    BFORM.TITLES.START_DATE,
    BFORM.TITLES.END_DATE,
    BFORM.TITLES.HOURS,
    BFORM.TITLES.ROTATION_UNIT,
    BFORM.TITLES.ROTATION_DEPARTMENT
  ];
  var pagePrefixes = [
    BFORM.INTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.EXTERNAL_ROUTER_PAGE_PREFIX,
    BFORM.EXTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.SECTION_PAGE_PREFIX,
    'اختيار القسم - '
  ];
  var questionPrefixes = [
    BFORM.SECTION_QUESTION_PREFIX,
    'القسم المطلوب - ',
    'Requested Section - ',
    'القسم المطلوب / Requested Section - '
  ];
  for (var internalOption = 1; internalOption <= (BFORM.MAX_INTERNAL_OPTIONS || 3); internalOption++) {
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, internalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, internalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, internalOption));
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, internalOption) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, internalOption) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, internalOption) + ' - ');
  }
  for (var externalOption = 1; externalOption <= (BFORM.MAX_EXTERNAL_OPTIONS || 3); externalOption++) {
    exactTitles.push(optionTitle_(BFORM.TITLES.EXTERNAL_UNIT_PREFIX, externalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.EXTERNAL_TO_PREFIX, externalOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption));
    questionPrefixes.push(optionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.EXTERNAL_TO_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption) + ' - ');
  }

  var branchItems = form.getItems().filter(function(item) {
    var title = item.getTitle ? item.getTitle() : '';
    return exactTitles.indexOf(title) !== -1 ||
      pagePrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; }) ||
      questionPrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; });
  }).reverse();

  var limit = Math.max(1, Number(options.limit) || branchItems.length || 1);
  var deadline = Number(options.deadline) || 0;
  var removed = 0;
  for (var itemIndex = 0; itemIndex < branchItems.length && removed < limit; itemIndex++) {
    if (deadline && Date.now() >= deadline) break;
    try {
      form.deleteItem(branchItems[itemIndex]);
      removed++;
    } catch (err) {
      Logger.log('Could not delete old branch item "' + (branchItems[itemIndex].getTitle ? branchItems[itemIndex].getTitle() : '') + '": ' + err.message);
    }
  }
  return { removed: removed, remaining: Math.max(0, branchItems.length - removed) };
}

// Compatibility name retained for older callers. The rebuild is intentionally
// initialized here and completed by repeated Step 6 executions.
function rebuildBootstrapRotationOptionBranching_(form, units, sections) {
  return initializeBootstrapRotationOptionBranching_(form, units, sections);
}
