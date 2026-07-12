function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  refreshMainFormRotationOptionChoices_(form, ss);
  removeExistingBranchItems_(form);

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: '0',
    [BSPROP.BRANCH_COMPLETE]: 'true'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('05 Start Main Form Branching', BSTATUS.COMPLETE, 'Main form now captures up to 3 internal and 3 external rotation options without unit branching.');
}

function refreshMainFormRotationOptionChoices_(form, dashboard) {
  var sections = readSections_(dashboard);
  var internalChoices = uniqueNonEmpty_(sections.map(function(section) { return section.name; }));
  var externalChoices = uniqueNonEmpty_(sections.map(function(section) {
    return section.unitName ? section.unitName + ' / ' + section.name : section.name;
  }));
  if (!internalChoices.length) internalChoices = [BFORM.NO_SECTIONS];
  if (!externalChoices.length) externalChoices = [BFORM.NO_SECTIONS];
  for (var i = 1; i <= 3; i++) {
    var internalItem = getItem_(form, optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, i), FormApp.ItemType.LIST);
    if (internalItem) internalItem.asListItem().setChoiceValues(internalChoices);
    var externalItem = getItem_(form, optionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, i), FormApp.ItemType.LIST);
    if (externalItem) externalItem.asListItem().setChoiceValues(externalChoices);
  }
}

function removeExistingBranchItems_(form) {
  clearFormNavigationReferences_(form);
  var legacyPagePrefix = 'اختيار القسم - ';
  var legacyQuestionPrefixes = [
    'القسم المطلوب - ',
    'Requested Section - ',
    'القسم المطلوب / Requested Section - '
  ];
  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    var title = items[i].getTitle ? items[i].getTitle() : '';
    var isLegacyBranchItem = title.indexOf(legacyPagePrefix) === 0 || legacyQuestionPrefixes.some(function(prefix) {
      return title.indexOf(prefix) === 0;
    });
    if (title.indexOf(BFORM.SECTION_PAGE_PREFIX) === 0 || title.indexOf(BFORM.SECTION_QUESTION_PREFIX) === 0 || isLegacyBranchItem) {
      try {
        form.deleteItem(items[i]);
      } catch (err) {
        Logger.log('Could not delete old branch item "' + title + '": ' + err.message);
      }
    }
  }
}

function buildUnitBranchPage_(form, unit, sections) {
  var page = ensurePage_(form, BFORM.SECTION_PAGE_PREFIX + unit.name);
  try { page.setGoToPage(FormApp.PageNavigationType.SUBMIT); } catch (ignore) {}

  var sectionItem = ensureList_(form, BFORM.SECTION_QUESTION_PREFIX + unit.name, true);

  var sectionNames = uniqueNonEmpty_(sections.filter(function(section) {
    if (unit.id && section.unitId) return section.unitId === unit.id;
    return section.unitName === unit.name;
  }).map(function(section) {
    return section.name;
  }));
  if (!sectionNames.length) sectionNames = [BFORM.NO_SECTIONS];
  sectionItem.setChoiceValues(sectionNames);
}

function rebuildRotationUnitRoutingChoices_(form, units, processedCount) {
  var item = getItem_(form, BFORM.TITLES.ROTATION_UNIT, FormApp.ItemType.LIST);
  if (!item) return false;
  var listItem = item.asListItem();
  var choices = [];
  for (var i = 0; i < processedCount; i++) {
    var page = getItem_(form, BFORM.SECTION_PAGE_PREFIX + units[i].name, FormApp.ItemType.PAGE_BREAK);
    if (page) choices.push(listItem.createChoice(units[i].name, page.asPageBreakItem()));
  }
  if (choices.length) listItem.setChoices(choices);
  return true;
}
