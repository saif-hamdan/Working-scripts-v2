function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  var units = readUnits_(ss);
  rebuildBootstrapRotationOptionBranching_(form, units, readSections_(ss));

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(units.length),
    [BSPROP.BRANCH_TOTAL]: String(units.length),
    [BSPROP.BRANCH_COMPLETE]: 'true'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('05 Start Main Form Branching', BSTATUS.COMPLETE, 'Internal and external unit-to-section branching was rebuilt for ' + units.length + ' unit(s).');
}

function refreshMainFormRotationOptionChoices_(form, dashboard) {
  rebuildBootstrapRotationOptionBranching_(form, readUnits_(dashboard), readSections_(dashboard));
}

function removeExistingBranchItems_(form) {
  clearFormNavigationReferences_(form);
  var legacyPagePrefix = 'اختيار القسم - ';
  var legacyQuestionPrefixes = [
    'القسم المطلوب - ',
    'Requested Section - ',
    'القسم المطلوب / Requested Section - '
  ];
  var pagePrefixes = [
    BFORM.INTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.EXTERNAL_ROUTER_PAGE_PREFIX,
    BFORM.EXTERNAL_BRANCH_PAGE_PREFIX,
    BFORM.SECTION_PAGE_PREFIX,
    legacyPagePrefix
  ];
  var exactTitles = [
    BFORM.TITLES.PHASE_ONE_INTERNAL,
    BFORM.TITLES.PHASE_TWO_EXTERNAL,
    BFORM.TITLES.START_DATE,
    BFORM.TITLES.END_DATE,
    BFORM.TITLES.HOURS,
    BFORM.TITLES.ROTATION_UNIT,
    BFORM.TITLES.ROTATION_DEPARTMENT
  ];
  var questionPrefixes = [BFORM.SECTION_QUESTION_PREFIX].concat(legacyQuestionPrefixes);
  for (var optionNumber = 1; optionNumber <= (BFORM.MAX_INTERNAL_OPTIONS || 3); optionNumber++) {
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber));
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber));
    exactTitles.push(optionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, optionNumber));
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber) + ' - ');
    questionPrefixes.push(optionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, optionNumber) + ' - ');
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

  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    var title = items[i].getTitle ? items[i].getTitle() : '';
    var isBranchItem = exactTitles.indexOf(title) !== -1 ||
      pagePrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; }) ||
      questionPrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; });
    if (isBranchItem) {
      try {
        form.deleteItem(items[i]);
      } catch (err) {
        Logger.log('Could not delete old branch item "' + title + '": ' + err.message);
      }
    }
  }
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

function rebuildBootstrapRotationOptionBranching_(form, units, sections) {
  removeExistingBranchItems_(form);
  var eligibleUnits = (units || []).filter(function(unit) {
    return safeString_(unit.name) && bootstrapSectionNamesForUnit_(unit, sections).length;
  });
  var currentUnitItem = getItem_(form, BFORM.TITLES.CURRENT_UNIT, FormApp.ItemType.LIST);
  if (!currentUnitItem) throw new Error('Current Employee Unit question is missing. Run run04_rebuildMainFormBaseQuestions() first.');
  currentUnitItem = currentUnitItem.asListItem();
  if (!eligibleUnits.length) {
    currentUnitItem.setChoiceValues([BFORM.NO_UNITS]);
    return;
  }

  var internalPages = eligibleUnits.map(function(unit) {
    var page = ensurePage_(form, BFORM.INTERNAL_BRANCH_PAGE_PREFIX + unit.name);
    var sectionNames = bootstrapSectionNamesForUnit_(unit, sections);
    for (var optionNumber = 1; optionNumber <= (BFORM.MAX_INTERNAL_OPTIONS || 3); optionNumber++) {
      var required = optionNumber === 1;
      ensureList_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber, unit.name), required)
        .setChoiceValues(sectionNames);
      ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber, unit.name), required);
      ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, optionNumber, unit.name), required);
    }
    return { unit: unit, page: page };
  });

  var externalStages = [];
  for (var externalOption = 1; externalOption <= (BFORM.MAX_EXTERNAL_OPTIONS || 3); externalOption++) {
    var routerPage = ensurePage_(form, BFORM.EXTERNAL_ROUTER_PAGE_PREFIX + externalOption);
    var routerItem = ensureList_(form, optionTitle_(BFORM.TITLES.EXTERNAL_UNIT_PREFIX, externalOption), true);
    try {
      routerItem.setHelpText('اختر وحدة مختلفة عن وحدة الموظف الحالية، أو اختر عدم إضافة تدوير خارجي. / Select a unit different from the employee current unit, or choose not to add external rotation.');
    } catch (ignoreHelp) {}
    var detailPages = eligibleUnits.map(function(unit) {
      var page = ensurePage_(form, BFORM.EXTERNAL_BRANCH_PAGE_PREFIX + externalOption + ' - ' + unit.name);
      ensureList_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption, unit.name), true)
        .setChoiceValues(bootstrapSectionNamesForUnit_(unit, sections));
      ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption, unit.name), true);
      ensureDate_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_TO_PREFIX, externalOption, unit.name), true);
      applyNumericValidation_(ensureText_(form, bootstrapBranchedOptionTitle_(BFORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption, unit.name), true));
      return { unit: unit, page: page };
    });
    externalStages.push({ routerPage: routerPage, routerItem: routerItem, detailPages: detailPages });
  }

  for (var stageIndex = 0; stageIndex < externalStages.length; stageIndex++) {
    var stage = externalStages[stageIndex];
    var choices = [stage.routerItem.createChoice(BFORM.NO_EXTERNAL_ROTATION, FormApp.PageNavigationType.SUBMIT)];
    stage.detailPages.forEach(function(detail) {
      choices.push(stage.routerItem.createChoice(detail.unit.name, detail.page));
      var nextRouter = stageIndex + 1 < externalStages.length ? externalStages[stageIndex + 1].routerPage : null;
      try { detail.page.setGoToPage(nextRouter || FormApp.PageNavigationType.SUBMIT); } catch (ignoreNavigation) {}
    });
    stage.routerItem.setChoices(choices);
  }

  var firstExternalRouter = externalStages[0].routerPage;
  var currentUnitChoices = [];
  internalPages.forEach(function(entry) {
    currentUnitChoices.push(currentUnitItem.createChoice(entry.unit.name, entry.page));
    try { entry.page.setGoToPage(firstExternalRouter); } catch (ignoreInternalNavigation) {}
  });
  currentUnitItem.setChoices(currentUnitChoices);
}
