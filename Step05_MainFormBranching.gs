function run05_startMainFormBranching() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  syncAdminReferenceData_(ss);
  var units = readUnits_(ss);
  if (!units.length) failStep_('05 Start Main Form Branching', 'No active units were found. Run run03_validateReferenceData() and fix the source data.');

  var trainingUnit = getItem_(form, BFORM.TITLES.TRAINING_UNIT, FormApp.ItemType.LIST);
  if (!trainingUnit) {
    failStep_('05 Start Main Form Branching', 'Requested Training Unit question is missing. Run run04_rebuildMainFormBaseQuestions() first.');
  }

  removeExistingBranchItems_(form);
  trainingUnit.asListItem().setChoiceValues(units.map(function(unit) { return unit.name; }));

  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: String(units.length),
    [BSPROP.BRANCH_COMPLETE]: 'false'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('05 Start Main Form Branching', BSTATUS.COMPLETE, 'Branching reset. Run run06_continueMainFormBranching() until complete.');
}

function removeExistingBranchItems_(form) {
  clearFormNavigationReferences_(form);
  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i--) {
    var title = items[i].getTitle ? items[i].getTitle() : '';
    if (title.indexOf(BFORM.SECTION_PAGE_PREFIX) === 0 || title.indexOf(BFORM.SECTION_QUESTION_PREFIX) === 0) {
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

  var sectionNames = sections.filter(function(section) {
    if (unit.id && section.unitId) return section.unitId === unit.id;
    return section.unitName === unit.name;
  }).map(function(section) {
    return section.name;
  });
  if (!sectionNames.length) sectionNames = [BFORM.NO_SECTIONS];
  sectionItem.setChoiceValues(sectionNames);
}

function rebuildTrainingUnitRoutingChoices_(form, units, processedCount) {
  var item = getItem_(form, BFORM.TITLES.TRAINING_UNIT, FormApp.ItemType.LIST);
  if (!item) throw new Error('Requested Training Unit question is missing.');
  var listItem = item.asListItem();
  var choices = [];
  for (var i = 0; i < processedCount; i++) {
    var page = getItem_(form, BFORM.SECTION_PAGE_PREFIX + units[i].name, FormApp.ItemType.PAGE_BREAK);
    if (page) choices.push(listItem.createChoice(units[i].name, page.asPageBreakItem()));
  }
  if (choices.length) listItem.setChoices(choices);
}
