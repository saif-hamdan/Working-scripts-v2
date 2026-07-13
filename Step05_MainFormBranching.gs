function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  removeExistingBranchItems_(form);
  refreshMainFormRotationOptionChoices_(form, ss);

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: '0',
    [BSPROP.BRANCH_COMPLETE]: 'true'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('05 Start Main Form Branching', BSTATUS.COMPLETE, 'Main form uses internal/external rotation option lists; unit branching is not required.');
}

function refreshMainFormRotationOptionChoices_(form, dashboard) {
  setBootstrapRotationOptionChoices_(form, readUnits_(dashboard), readSections_(dashboard));
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
  if (!item) throw new Error('Rotation Unit question is missing. Run run04_rebuildMainFormBaseQuestions() before continuing branching.');
  var listItem = item.asListItem();
  var choices = [];
  for (var i = 0; i < processedCount; i++) {
    var page = getItem_(form, BFORM.SECTION_PAGE_PREFIX + units[i].name, FormApp.ItemType.PAGE_BREAK);
    if (page) choices.push(listItem.createChoice(units[i].name, page.asPageBreakItem()));
  }
  if (choices.length) listItem.setChoices(choices);
  return true;
}