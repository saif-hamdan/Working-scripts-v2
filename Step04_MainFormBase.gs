function run04_rebuildMainFormBaseQuestions() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  ensureMainFormResponseDestination_(form, ss);
  syncAdminReferenceData_(ss);
  rebuildMainFormBase_(form, ss);
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: '0',
    [BSPROP.BRANCH_COMPLETE]: 'false'
  });
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_('04 Rebuild Main Form Base Questions', BSTATUS.COMPLETE, 'Main form base questions were rebuilt. Branching is reset.');
}

function rebuildMainFormBase_(form, dashboard) {
  form.setTitle(BFORM.TITLES.FORM_TITLE);
  form.setDescription(BFORM.TITLES.FORM_DESCRIPTION);
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setRequireLogin(true); } catch (ignoreLogin) {}
  try { form.setAllowResponseEdits(false); } catch (ignore2) {}
  try { form.setProgressBar(true); } catch (ignore3) {}
  try { form.setConfirmationMessage('تم إرسال طلب التدوير الوظيفي بنجاح. / Your job rotation request has been submitted successfully.'); } catch (ignore4) {}

  if (BOOTSTRAP_CONFIG.REBUILD_MAIN_FORM_ITEMS) deleteAllFormItems_(form);

  var units = readUnits_(dashboard);
  var unitNames = uniqueNonEmpty_(units.map(function(unit) { return unit.name; }));
  if (!unitNames.length) unitNames = [BFORM.NO_UNITS];

  ensureSectionHeader_(form, BFORM.TITLES.LINE_MANAGER_SECTION);
  ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_NAME, true);
  applyNumericValidation_(ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_ID, true));
  applyEmailValidation_(ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_EMAIL, true));
  applyNumericValidation_(ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_EXTENSION, true));

  ensureSectionHeader_(form, BFORM.TITLES.EMPLOYEE_SECTION);
  ensureText_(form, BFORM.TITLES.EMPLOYEE_NAME, true);
  applyNumericValidation_(ensureText_(form, BFORM.TITLES.EMPLOYEE_ID, true));
  ensureDate_(form, BFORM.TITLES.EMPLOYEE_HIRE_DATE, true);
  ensureText_(form, BFORM.TITLES.EMPLOYEE_JOB_TITLE, true);
  applyEmailValidation_(ensureText_(form, BFORM.TITLES.EMPLOYEE_EMAIL, true));

  ensureSectionHeader_(form, BFORM.TITLES.CURRENT_EMPLOYEE_SECTION);
  var currentUnit = ensureList_(form, BFORM.TITLES.CURRENT_UNIT, true);
  currentUnit.setChoiceValues(unitNames);
  ensureText_(form, BFORM.TITLES.CURRENT_DEPARTMENT, true);

  ensureSectionHeader_(form, BFORM.TITLES.ROTATION_SECTION);
  applyNumericValidation_(ensureText_(form, BFORM.TITLES.HOURS, true));

  var currentUnitSections = uniqueNonEmpty_(readSections_(dashboard).map(function(section) { return section.name; }));
  var allSectionChoices = uniqueNonEmpty_(readSections_(dashboard).map(function(section) {
    return section.unitName ? section.unitName + ' / ' + section.name : section.name;
  }));
  if (!currentUnitSections.length) currentUnitSections = [BFORM.NO_SECTIONS];
  if (!allSectionChoices.length) allSectionChoices = [BFORM.NO_SECTIONS];

  ensureSectionHeader_(form, BFORM.TITLES.PHASE_ONE_INTERNAL);
  for (var internalIndex = 1; internalIndex <= 3; internalIndex++) {
    var internalSection = ensureList_(form, optionTitle_(BFORM.TITLES.INTERNAL_SECTION_PREFIX, internalIndex), internalIndex === 1);
    internalSection.setChoiceValues(currentUnitSections);
    ensureDate_(form, optionTitle_(BFORM.TITLES.INTERNAL_FROM_PREFIX, internalIndex), internalIndex === 1);
    ensureDate_(form, optionTitle_(BFORM.TITLES.INTERNAL_TO_PREFIX, internalIndex), internalIndex === 1);
  }

  ensureSectionHeader_(form, BFORM.TITLES.PHASE_TWO_EXTERNAL);
  for (var externalIndex = 1; externalIndex <= 3; externalIndex++) {
    var externalSection = ensureList_(form, optionTitle_(BFORM.TITLES.EXTERNAL_SECTION_PREFIX, externalIndex), false);
    externalSection.setChoiceValues(allSectionChoices);
    ensureDate_(form, optionTitle_(BFORM.TITLES.EXTERNAL_FROM_PREFIX, externalIndex), false);
    ensureDate_(form, optionTitle_(BFORM.TITLES.EXTERNAL_TO_PREFIX, externalIndex), false);
  }

  ensureParagraph_(form, BFORM.TITLES.NOTES, false);
}

function ensureSectionHeader_(form, title) {
  var item = getItem_(form, title, FormApp.ItemType.SECTION_HEADER);
  if (!item) item = form.addSectionHeaderItem().setTitle(title);
  return item.asSectionHeaderItem ? item.asSectionHeaderItem() : item;
}

function deleteAllFormItems_(form) {
  clearFormNavigationReferences_(form);
  deleteFormItemsByType_(form, [
    FormApp.ItemType.TEXT,
    FormApp.ItemType.PARAGRAPH_TEXT,
    FormApp.ItemType.DATE,
    FormApp.ItemType.LIST,
    FormApp.ItemType.MULTIPLE_CHOICE,
    FormApp.ItemType.CHECKBOX,
    FormApp.ItemType.SCALE,
    FormApp.ItemType.GRID,
    FormApp.ItemType.CHECKBOX_GRID,
    FormApp.ItemType.TIME,
    FormApp.ItemType.DATETIME,
    FormApp.ItemType.DURATION,
    FormApp.ItemType.SECTION_HEADER,
    FormApp.ItemType.IMAGE,
    FormApp.ItemType.VIDEO
  ]);
  deleteFormItemsByType_(form, [FormApp.ItemType.PAGE_BREAK]);
}

function clearFormNavigationReferences_(form) {
  var temporaryChoice = 'إعادة ضبط مؤقتة / Temporary reset';
  var rotationUnit = getItem_(form, BFORM.TITLES.ROTATION_UNIT, FormApp.ItemType.LIST);
  if (rotationUnit) {
    try { rotationUnit.asListItem().setChoiceValues([temporaryChoice]); } catch (ignore) {}
  }
  form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function(item) {
    try { item.asPageBreakItem().setGoToPage(FormApp.PageNavigationType.CONTINUE); } catch (ignore2) {}
  });
}

function deleteFormItemsByType_(form, itemTypes) {
  itemTypes.forEach(function(itemType) {
    if (!itemType) return;
    var items = form.getItems(itemType);
    for (var i = items.length - 1; i >= 0; i--) {
      try {
        form.deleteItem(items[i]);
      } catch (err) {
        Logger.log('Could not delete form item "' + (items[i].getTitle ? items[i].getTitle() : itemType) + '": ' + err.message);
      }
    }
  });
}

function applyEmailValidation_(textItem) {
  try {
    var validation = FormApp.createTextValidation()
      .requireTextIsEmail()
      .build();
    textItem.setValidation(validation);
  } catch (ignore) {}
  return textItem;
}

function applyNumericValidation_(textItem) {
  try {
    var validation = FormApp.createTextValidation()
      .requireNumber()
      .build();
    textItem.setValidation(validation);
  } catch (ignore) {}
  return textItem;
}

function optionTitle_(template, optionNumber) {
  return safeString_(template).replace('{n}', optionNumber);
}
