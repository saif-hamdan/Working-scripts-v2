function run05_startMainFormBranching(options) {
  options = options || {};
  return withMainFormBranchLock_('05 Start Main Form Branching', options, function() {
    return startMainFormBranching_(options);
  });
}

function run18_clearMainFormRotationDescriptions(options) {
  options = options || {};
  return withMainFormBranchLock_('18 Clear Main Form Rotation Descriptions', options, function() {
    var form = openMainFormFromProperties_();
    var clearedPages = 0;
    var clearedQuestions = 0;
    var sectionTitlePrefix = BFORM.TITLES.ROTATION_DEPARTMENT + ' - ';

    form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function(item) {
      var page = item.asPageBreakItem();
      if (safeBootstrapFormItemTitle_(page).indexOf(BFORM.ROTATION_BRANCH_PAGE_PREFIX) !== 0) return;
      page.setHelpText('');
      clearedPages++;
    });

    form.getItems(FormApp.ItemType.LIST).forEach(function(item) {
      var list = item.asListItem();
      if (safeBootstrapFormItemTitle_(list).indexOf(sectionTitlePrefix) !== 0) return;
      list.setHelpText('');
      clearedQuestions++;
    });

    return finishStep_(
      '18 Clear Main Form Rotation Descriptions',
      BSTATUS.COMPLETE,
      'Cleared descriptions from ' + clearedPages + ' rotation page(s) and ' + clearedQuestions + ' rotation section question(s).'
    );
  });
}

function startMainFormBranching_(options) {
  options = options || {};
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var sync = syncAdminReferenceData_(ss);
  var selections = initializeMultiRotationFormBuild_(form, readUnits_(ss), readSections_(ss), {
    mode: BBRANCH_MODE.CLEAN,
    targetHash: sync.hash,
    preservePublishedHash: options.preservePublishedHash === true
  });

  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '05 Start Main Form Branching',
    BSTATUS.IN_PROGRESS,
    'Three sequential rotation-selection pages were initialized. Run run06_continueMainFormBranching() ' +
      selections.length + ' time(s), or until it reports Complete.'
  );
}

function refreshMainFormRotationOptionChoices_(form, dashboard) {
  return initializeMultiRotationFormBuild_(form, readUnits_(dashboard), readSections_(dashboard), {
    mode: BBRANCH_MODE.LIVE,
    targetHash: getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, '')
  });
}

function initializeBootstrapRotationOptionBranching_(form, units, sections, options) {
  return initializeMultiRotationFormBuild_(form, units, sections, options);
}

function initializeLiveMainFormRefresh_(form, units, sections, targetHash) {
  return initializeBootstrapRotationOptionBranching_(form, units, sections, {
    mode: BBRANCH_MODE.LIVE,
    targetHash: targetHash,
    preservePublishedHash: true
  });
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
  return FORM.MAX_ROTATION_OPTIONS || 3;
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
    page.setHelpText('');
  } catch (ignorePageHelp) {}
  try { page.setGoToPage(FormApp.PageNavigationType.SUBMIT); } catch (ignoreUnitNavigation) {}
  var sectionNames = bootstrapSectionNamesForUnit_(unit, sections);
  var sectionItem = ensureList_(form, bootstrapUnitScopedTitle_(BFORM.TITLES.ROTATION_DEPARTMENT, unit.name), true)
    .setChoiceValues(sectionNames);
  try {
    sectionItem.setHelpText('');
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

function bootstrapTemporaryResetChoice_() {
  return 'إعادة ضبط مؤقتة / Temporary reset';
}

function bootstrapFormItemIndex_(form) {
  var index = Object.create(null);
  [FormApp.ItemType.PAGE_BREAK, FormApp.ItemType.LIST, FormApp.ItemType.DATE, FormApp.ItemType.TEXT].forEach(function(itemType) {
    var typeKey = String(itemType);
    var byTitle = Object.create(null);
    form.getItems(itemType).forEach(function(item) {
      var title = safeBootstrapFormItemTitle_(item);
      if (!byTitle[title]) byTitle[title] = [];
      byTitle[title].push(item);
    });
    index[typeKey] = byTitle;
  });
  return index;
}

function bootstrapIndexedItemsWithTitle_(index, itemType, title) {
  var byTitle = (index || {})[String(itemType)] || {};
  return byTitle[title] || [];
}

function bootstrapListChoiceValues_(item) {
  try {
    var typed = item && item.asListItem ? item.asListItem() : item;
    return typed.getChoices().map(function(choice) { return safeString_(choice.getValue()); });
  } catch (ignore) {
    return [];
  }
}

function bootstrapNormalizeChoiceValue_(value) {
  return safeString_(value)
    .replace(/[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bootstrapChoiceCounts_(values) {
  var counts = Object.create(null);
  (values || []).forEach(function(value) {
    var normalized = bootstrapNormalizeChoiceValue_(value);
    counts[normalized] = (counts[normalized] || 0) + 1;
  });
  return counts;
}

function bootstrapChoiceKeys_(leftCounts, rightCounts) {
  var keys = Object.create(null);
  Object.keys(leftCounts || {}).forEach(function(key) { keys[key] = true; });
  Object.keys(rightCounts || {}).forEach(function(key) { keys[key] = true; });
  return Object.keys(keys);
}

function bootstrapChoiceCollectionsEqual_(left, right) {
  var leftCounts = bootstrapChoiceCounts_(left);
  var rightCounts = bootstrapChoiceCounts_(right);
  var keys = bootstrapChoiceKeys_(leftCounts, rightCounts);
  return keys.every(function(key) { return leftCounts[key] === rightCounts[key]; });
}

function bootstrapChoiceMismatchDetails_(actual, expected) {
  var actualCounts = bootstrapChoiceCounts_(actual);
  var expectedCounts = bootstrapChoiceCounts_(expected);
  var keys = bootstrapChoiceKeys_(actualCounts, expectedCounts);
  var missing = [];
  var unexpected = [];

  keys.forEach(function(key) {
    var actualCount = actualCounts[key] || 0;
    var expectedCount = expectedCounts[key] || 0;
    for (var missingIndex = actualCount; missingIndex < expectedCount; missingIndex++) missing.push(key);
    for (var extraIndex = expectedCount; extraIndex < actualCount; extraIndex++) unexpected.push(key);
  });

  var details = [];
  if (missing.length) details.push('Missing: [' + missing.join(', ') + ']');
  if (unexpected.length) details.push('Unexpected: [' + unexpected.join(', ') + ']');
  return details.length ? ' ' + details.join(' ') : '';
}

function validateBootstrapRotationBranching_(form, eligibleUnits, sections, options) {
  return validateMultiRotationForm_(form, sections);
  /* Legacy unit-page validation retained below for rollback reference. */
  options = options || {};
  var issues = [];
  var itemIndex = options.itemIndex || bootstrapFormItemIndex_(form);
  var validateGlobals = options.validateGlobals !== false;
  var unitStart = Math.max(0, Number(options.unitStart) || 0);
  var unitEnd = typeof options.unitEnd === 'number'
    ? Math.min(eligibleUnits.length, Math.max(unitStart, options.unitEnd))
    : eligibleUnits.length;

  function requireExactlyOne(itemType, title, label) {
    var items = bootstrapIndexedItemsWithTitle_(itemIndex, itemType, title);
    if (items.length !== 1) issues.push(label + ' expected 1 item but found ' + items.length + ': ' + title);
    return items.length === 1 ? items[0] : null;
  }

  function requireRequired(item, castMethodName, label) {
    if (!item) return;
    try {
      var typed = item && typeof item[castMethodName] === 'function' ? item[castMethodName]() : item;
      if (!typed.isRequired || typed.isRequired() !== true) issues.push(label + ' is not required.');
    } catch (err) {
      issues.push(label + ' required-state validation failed: ' + safeString_(err && err.message));
    }
  }

  var rotationUnitItem = null;
  var currentUnitItem = null;
  if (validateGlobals) {
    requireExactlyOne(FormApp.ItemType.PAGE_BREAK, BFORM.ROTATION_ROUTER_PAGE_TITLE, 'Rotation router page');
    rotationUnitItem = requireExactlyOne(FormApp.ItemType.LIST, BFORM.TITLES.ROTATION_UNIT, 'Rotation unit question');
    currentUnitItem = requireExactlyOne(FormApp.ItemType.LIST, BFORM.TITLES.CURRENT_UNIT, 'Current unit question');
    requireRequired(rotationUnitItem, 'asListItem', 'Rotation unit question');
    requireRequired(currentUnitItem, 'asListItem', 'Current unit question');
  }

  eligibleUnits.slice(unitStart, unitEnd).forEach(function(unit) {
    var unitName = unit.name;
    requireExactlyOne(FormApp.ItemType.PAGE_BREAK, BFORM.ROTATION_BRANCH_PAGE_PREFIX + unitName, 'Rotation details page');
    var sectionItem = requireExactlyOne(
      FormApp.ItemType.LIST,
      bootstrapUnitScopedTitle_(BFORM.TITLES.ROTATION_DEPARTMENT, unitName),
      'Rotation section question'
    );
    var startItem = requireExactlyOne(FormApp.ItemType.DATE, bootstrapUnitScopedTitle_(BFORM.TITLES.START_DATE, unitName), 'Rotation start date');
    var endItem = requireExactlyOne(FormApp.ItemType.DATE, bootstrapUnitScopedTitle_(BFORM.TITLES.END_DATE, unitName), 'Rotation end date');
    var hoursItem = requireExactlyOne(FormApp.ItemType.TEXT, bootstrapUnitScopedTitle_(BFORM.TITLES.HOURS, unitName), 'Rotation daily hours');
    requireRequired(sectionItem, 'asListItem', 'Rotation section question for ' + unitName);
    requireRequired(startItem, 'asDateItem', 'Rotation start date for ' + unitName);
    requireRequired(endItem, 'asDateItem', 'Rotation end date for ' + unitName);
    requireRequired(hoursItem, 'asTextItem', 'Rotation daily hours for ' + unitName);

    if (sectionItem) {
      var expectedSections = bootstrapSectionNamesForUnit_(unit, sections);
      var actualSections = bootstrapListChoiceValues_(sectionItem);
      if (!bootstrapChoiceCollectionsEqual_(actualSections, expectedSections)) {
        issues.push(
          'Rotation section choices do not match the reference data for unit: ' + unitName + '.' +
          bootstrapChoiceMismatchDetails_(actualSections, expectedSections)
        );
      }
    }
  });

  if (validateGlobals && options.requirePublishedNavigation === true) {
    var expectedUnits = eligibleUnits.map(function(unit) { return unit.name; });
    if (rotationUnitItem && !bootstrapChoiceCollectionsEqual_(bootstrapListChoiceValues_(rotationUnitItem), expectedUnits)) {
      var actualRotationUnits = bootstrapListChoiceValues_(rotationUnitItem);
      issues.push(
        'Published rotation-unit choices do not match the eligible units.' +
        bootstrapChoiceMismatchDetails_(actualRotationUnits, expectedUnits)
      );
    }
    if (currentUnitItem && !bootstrapChoiceCollectionsEqual_(bootstrapListChoiceValues_(currentUnitItem), expectedUnits)) {
      var actualCurrentUnits = bootstrapListChoiceValues_(currentUnitItem);
      issues.push(
        'Published current-unit choices do not match the eligible units.' +
        bootstrapChoiceMismatchDetails_(actualCurrentUnits, expectedUnits)
      );
    }
    var temporaryChoice = bootstrapTemporaryResetChoice_();
    if (rotationUnitItem && bootstrapListChoiceValues_(rotationUnitItem).indexOf(temporaryChoice) !== -1) {
      issues.push('The rotation-unit question still contains the temporary reset choice.');
    }
    if (currentUnitItem && bootstrapListChoiceValues_(currentUnitItem).indexOf(temporaryChoice) !== -1) {
      issues.push('The current-unit question still contains the temporary reset choice.');
    }
  }
  return issues;
}

function formatBootstrapBranchValidationIssues_(issues) {
  return (issues || []).slice(0, 20).join(' | ');
}

function finalizeBootstrapRotationNavigation_(form, eligibleUnits) {
  publishBootstrapRotationPageNavigationChunk_(form, eligibleUnits, 0, eligibleUnits.length);
  publishBootstrapRotationChoiceNavigation_(form, eligibleUnits);
}

function publishBootstrapRotationPageNavigationChunk_(form, eligibleUnits, startIndex, endIndex) {
  var pages = bootstrapItemsByTitle_(form, FormApp.ItemType.PAGE_BREAK, 'asPageBreakItem');
  var start = Math.max(0, Number(startIndex) || 0);
  var requestedEnd = typeof endIndex === 'number' ? endIndex : eligibleUnits.length;
  var end = Math.min(eligibleUnits.length, Math.max(start, requestedEnd));
  for (var unitIndex = start; unitIndex < end; unitIndex++) {
    var unit = eligibleUnits[unitIndex];
    var page = pages[BFORM.ROTATION_BRANCH_PAGE_PREFIX + unit.name];
    if (!page) throw new Error('Missing rotation details page for unit: ' + unit.name);
    page.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  }
  return end;
}

function publishBootstrapRotationChoiceNavigation_(form, eligibleUnits) {
  var pages = bootstrapItemsByTitle_(form, FormApp.ItemType.PAGE_BREAK, 'asPageBreakItem');
  var lists = bootstrapItemsByTitle_(form, FormApp.ItemType.LIST, 'asListItem');
  var routerPage = pages[BFORM.ROTATION_ROUTER_PAGE_TITLE];
  var rotationUnitItem = lists[BFORM.TITLES.ROTATION_UNIT];
  if (!routerPage || !rotationUnitItem) throw new Error('The rotation routing items are incomplete. Run Step 6 again.');

  var unitChoices = eligibleUnits.map(function(unit) {
    var page = pages[BFORM.ROTATION_BRANCH_PAGE_PREFIX + unit.name];
    if (!page) throw new Error('Missing rotation details page for unit: ' + unit.name);
    return rotationUnitItem.createChoice(unit.name, page);
  });
  rotationUnitItem.setChoices(unitChoices);

  var currentUnitItem = lists[BFORM.TITLES.CURRENT_UNIT];
  if (currentUnitItem) currentUnitItem.setChoiceValues(eligibleUnits.map(function(unit) { return unit.name; }));
}

function getBootstrapBranchCleanupSpec_() {
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
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_PAGE_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_SECTION_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_FROM_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_TO_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_HOURS_PREFIX, rotationOption));
    exactTitles.push(optionTitle_(BFORM.TITLES.ROTATION_ADD_MORE_PREFIX, rotationOption));
    questionPrefixes.push(optionTitle_(BFORM.TITLES.ROTATION_SECTION_PREFIX, rotationOption) + ' - ');
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

  return {
    exactTitles: exactTitles,
    pagePrefixes: pagePrefixes,
    questionPrefixes: questionPrefixes
  };
}

function isBootstrapBranchItemTitle_(title, spec) {
  spec = spec || getBootstrapBranchCleanupSpec_();
  return spec.exactTitles.indexOf(title) !== -1 ||
    spec.pagePrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; }) ||
    spec.questionPrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; });
}

function removeExistingBranchItems_(form, options) {
  options = options || {};
  if (options.clearNavigation !== false) clearFormNavigationReferences_(form);
  var cleanupSpec = getBootstrapBranchCleanupSpec_();

  var branchItems = [];
  form.getItems().forEach(function(item) {
    var title = safeBootstrapFormItemTitle_(item);
    if (!title) return;
    if (isBootstrapBranchItemTitle_(title, cleanupSpec)) branchItems.push({ item: item, title: title });
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

function getBootstrapPublishedBranchTitleSet_(eligibleUnits) {
  var keep = {};
  keep[BFORM.ROTATION_ROUTER_PAGE_TITLE] = true;
  keep[BFORM.TITLES.ROTATION_UNIT] = true;
  (eligibleUnits || []).forEach(function(unit) {
    keep[BFORM.ROTATION_BRANCH_PAGE_PREFIX + unit.name] = true;
    keep[bootstrapUnitScopedTitle_(BFORM.TITLES.ROTATION_DEPARTMENT, unit.name)] = true;
    keep[bootstrapUnitScopedTitle_(BFORM.TITLES.START_DATE, unit.name)] = true;
    keep[bootstrapUnitScopedTitle_(BFORM.TITLES.END_DATE, unit.name)] = true;
    keep[bootstrapUnitScopedTitle_(BFORM.TITLES.HOURS, unit.name)] = true;
  });
  return keep;
}

function removeObsoleteBranchItems_(form, eligibleUnits, options) {
  options = options || {};
  var keep = getBootstrapPublishedBranchTitleSet_(eligibleUnits);
  var cleanupSpec = getBootstrapBranchCleanupSpec_();
  var obsolete = [];
  form.getItems().forEach(function(item) {
    var title = safeBootstrapFormItemTitle_(item);
    if (title && isBootstrapBranchItemTitle_(title, cleanupSpec) && !keep[title]) {
      obsolete.push({ item: item, title: title });
    }
  });
  obsolete.reverse();

  var limit = Math.max(1, Number(options.limit) || obsolete.length || 1);
  var deadline = Number(options.deadline) || 0;
  var removed = 0;
  for (var index = 0; index < obsolete.length && removed < limit; index++) {
    if (deadline && Date.now() >= deadline) break;
    try {
      form.deleteItem(obsolete[index].item);
      removed++;
    } catch (err) {
      if (/item is missing/i.test(safeString_(err && err.message))) {
        removed++;
        continue;
      }
      Logger.log('Could not delete obsolete branch item "' + obsolete[index].title + '": ' + err.message);
    }
  }
  return { removed: removed, remaining: Math.max(0, obsolete.length - removed) };
}

// Compatibility name retained for older callers. The rebuild is intentionally
// initialized here and completed by repeated Step 6 executions.
function rebuildBootstrapRotationOptionBranching_(form, units, sections) {
  return initializeBootstrapRotationOptionBranching_(form, units, sections);
}
