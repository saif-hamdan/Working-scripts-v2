function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  var eligibleUnits = initializeBootstrapRotationOptionBranching_(form, readUnits_(ss), readSections_(ss));

  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '05 Start Main Form Branching',
    BSTATUS.IN_PROGRESS,
    'Single-rotation branching was initialized for ' + eligibleUnits.length + ' unit(s). Each unit will have one page with Section, Start Date, End Date, and Daily Hours. Run run06_continueMainFormBranching() repeatedly until it reports Complete.'
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

function bootstrapUnitScopedTitle_(title, unitName) {
  return safeString_(title) + ' - ' + safeString_(unitName);
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
  return (Number(unitCount) || 0) + 2;
}

function getBootstrapBranchWork_(progressIndex, unitCount) {
  if (progressIndex === 0) return { type: 'rotation-router', label: 'building the rotation-unit selector' };
  if (progressIndex <= unitCount) {
    return { type: 'rotation-unit', unitIndex: progressIndex - 1, label: 'building filtered rotation details' };
  }
  return { type: 'finalize-navigation', label: 'connecting form navigation' };
}

function processBootstrapBranchWork_(form, eligibleUnits, sections, work) {
  if (work.type === 'rotation-router') {
    buildBootstrapRotationRouter_(form, eligibleUnits);
    return;
  }
  if (work.type === 'rotation-unit') {
    buildBootstrapRotationUnitBranch_(form, eligibleUnits[work.unitIndex], sections);
    return;
  }
  finalizeBootstrapRotationNavigation_(form, eligibleUnits);
}

function buildBootstrapRotationRouter_(form, eligibleUnits) {
  ensurePage_(form, BFORM.ROTATION_ROUTER_PAGE_TITLE);
  ensureList_(form, BFORM.TITLES.ROTATION_UNIT, true)
    .setChoiceValues(eligibleUnits.map(function(unit) { return unit.name; }));
}

function buildBootstrapRotationUnitBranch_(form, unit, sections) {
  var page = ensurePage_(form, BFORM.ROTATION_BRANCH_PAGE_PREFIX + unit.name);
  try {
    page.setHelpText('Complete one submission for one rotation section in ' + unit.name + '. Submit a new response if another rotation is needed.');
  } catch (ignorePageHelp) {}
  var sectionNames = bootstrapSectionNamesForUnit_(unit, sections);
  var sectionItem = ensureList_(form, bootstrapUnitScopedTitle_(BFORM.TITLES.ROTATION_DEPARTMENT, unit.name), true)
    .setChoiceValues(sectionNames);
  try {
    sectionItem.setHelpText('Only sections belonging to ' + unit.name + ' are shown.');
  } catch (ignoreSectionHelp) {}
  ensureDate_(form, bootstrapUnitScopedTitle_(BFORM.TITLES.START_DATE, unit.name), true);
  ensureDate_(form, bootstrapUnitScopedTitle_(BFORM.TITLES.END_DATE, unit.name), true);
  applyNumericValidation_(ensureText_(form, bootstrapUnitScopedTitle_(BFORM.TITLES.HOURS, unit.name), true));
}

function bootstrapItemsByTitle_(form, itemType, castMethodName) {
  var map = {};
  form.getItems(itemType).forEach(function(item) {
    try {
      var typed = item && typeof item[castMethodName] === 'function' ? item[castMethodName]() : item;
      var title = safeBootstrapFormItemTitle_(typed);
      if (title) map[title] = typed;
    } catch (ignoreMissingItem) {}
  });
  return map;
}

function safeBootstrapFormItemTitle_(item) {
  try {
    return item && item.getTitle ? safeString_(item.getTitle()) : '';
  } catch (ignoreMissingItem) {
    return '';
  }
}

function finalizeBootstrapRotationNavigation_(form, eligibleUnits) {
  var pages = bootstrapItemsByTitle_(form, FormApp.ItemType.PAGE_BREAK, 'asPageBreakItem');
  var lists = bootstrapItemsByTitle_(form, FormApp.ItemType.LIST, 'asListItem');
  var routerPage = pages[BFORM.ROTATION_ROUTER_PAGE_TITLE];
  var rotationUnitItem = lists[BFORM.TITLES.ROTATION_UNIT];
  if (!routerPage || !rotationUnitItem) {
    throw new Error('The rotation routing items are incomplete. Run Step 6 again.');
  }

  var unitChoices = [];
  eligibleUnits.forEach(function(unit) {
    var page = pages[BFORM.ROTATION_BRANCH_PAGE_PREFIX + unit.name];
    if (!page) throw new Error('Missing rotation details page for unit: ' + unit.name);
    unitChoices.push(rotationUnitItem.createChoice(unit.name, page));
    try { page.setGoToPage(FormApp.PageNavigationType.SUBMIT); } catch (ignoreUnitNavigation) {}
  });
  rotationUnitItem.setChoices(unitChoices);

  var currentUnitItem = lists[BFORM.TITLES.CURRENT_UNIT];
  if (currentUnitItem) currentUnitItem.setChoiceValues(eligibleUnits.map(function(unit) { return unit.name; }));
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
    BFORM.TITLES.ROTATION_DEPARTMENT,
    BFORM.TITLES.OPTIONAL_ROTATION_GRID
  ];
  var pagePrefixes = [
    BFORM.ROTATION_ROUTER_PAGE_TITLE,
    BFORM.ROTATION_BRANCH_PAGE_PREFIX,
    BFORM.LEGACY_ROTATION_BRANCH_PAGE_PREFIX,
    BFORM.ROTATION_SCHEDULE_PAGE_PREFIX,
    BFORM.INTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.EXTERNAL_ROUTER_PAGE_PREFIX,
    BFORM.EXTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.SECTION_PAGE_PREFIX,
    'اختيار القسم - '
  ];
  var questionPrefixes = [
    BFORM.SECTION_QUESTION_PREFIX,
    BFORM.TITLES.ROTATION_DEPARTMENT + ' - ',
    BFORM.TITLES.START_DATE + ' - ',
    BFORM.TITLES.END_DATE + ' - ',
    BFORM.TITLES.HOURS + ' - ',
    BFORM.TITLES.OPTIONAL_ROTATION_GRID + ' - ',
    'القسم المطلوب - ',
    'Requested Section - ',
    'القسم المطلوب / Requested Section - '
  ];

  for (var rotationOption = 1; rotationOption <= (BFORM.LEGACY_MAX_ROTATION_OPTIONS || 5); rotationOption++) {
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_FROM_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_TO_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_HOURS_PREFIX, rotationOption));
    questionPrefixes.push(optionTitle_(BFORM.TITLES.ROTATION_SECTION_PREFIX, rotationOption) + ' - ');
    if (rotationOption > 1) exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_ADD_MORE_PREFIX, rotationOption));
  }
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

  var branchItems = [];
  form.getItems().forEach(function(item) {
    var title = safeBootstrapFormItemTitle_(item);
    if (!title) return;
    var matches = exactTitles.indexOf(title) !== -1 ||
      pagePrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; }) ||
      questionPrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; });
    if (matches) branchItems.push({ item: item, title: title });
  });
  branchItems.reverse();

  var limit = Math.max(1, Number(options.limit) || branchItems.length || 1);
  var deadline = Number(options.deadline) || 0;
  var removed = 0;
  for (var itemIndex = 0; itemIndex < branchItems.length && removed < limit; itemIndex++) {
    if (deadline && Date.now() >= deadline) break;
    try {
      form.deleteItem(branchItems[itemIndex].item);
      removed++;
    } catch (err) {
      if (/item is missing/i.test(safeString_(err && err.message))) {
        removed++;
        continue;
      }
      Logger.log('Could not delete old branch item "' + branchItems[itemIndex].title + '": ' + err.message);
    }
  }
  return { removed: removed, remaining: Math.max(0, branchItems.length - removed) };
}

// Compatibility name retained for older callers. The rebuild is intentionally
// initialized here and completed by repeated Step 6 executions.
function rebuildBootstrapRotationOptionBranching_(form, units, sections) {
  return initializeBootstrapRotationOptionBranching_(form, units, sections);
}
