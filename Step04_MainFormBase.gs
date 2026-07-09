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
  form.setTitle('Employee / طلب تدوير وظيفي للموظف Job Rotation Request');
  form.setDescription('يرجى إدخال بيانات الطلب بدقة. يتم التحقق من التعارضات مرة أخرى عند اعتماد رئيس الوحدة.\nPlease enter the request details carefully. Conflicts are checked again when the unit head approves.');
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setRequireLogin(true); } catch (ignoreLogin) {}
  try { form.setAllowResponseEdits(false); } catch (ignore2) {}
  try { form.setProgressBar(true); } catch (ignore3) {}
  try { form.setConfirmationMessage('تم إرسال طلب التدوير الوظيفي بنجاح. / Your job rotation request has been submitted successfully.'); } catch (ignore4) {}

  if (BOOTSTRAP_CONFIG.REBUILD_MAIN_FORM_ITEMS) deleteAllFormItems_(form);

  var units = readUnits_(dashboard);
  var unitNames = units.map(function(unit) { return unit.name; });
  if (!unitNames.length) unitNames = [BFORM.NO_UNITS];

  ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_NAME, true);

  ensureText_(form, BFORM.TITLES.EMPLOYEE_NAME, true);
  ensureText_(form, BFORM.TITLES.EMPLOYEE_ID, true);
  applyEmailValidation_(ensureText_(form, BFORM.TITLES.EMPLOYEE_EMAIL, true));

  var currentUnit = ensureList_(form, BFORM.TITLES.CURRENT_UNIT, true);
  currentUnit.setChoiceValues(unitNames);

  ensureDate_(form, BFORM.TITLES.START_DATE, true);
  ensureDate_(form, BFORM.TITLES.END_DATE, true);
  applyHoursValidation_(ensureText_(form, BFORM.TITLES.HOURS, true));
  ensureParagraph_(form, BFORM.TITLES.NOTES, false);

  var rotationUnit = ensureList_(form, BFORM.TITLES.ROTATION_UNIT, true);
  rotationUnit.setChoiceValues(unitNames);
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

function applyHoursValidation_(textItem) {
  try {
    var validation = FormApp.createTextValidation()
      .requireNumberGreaterThan(0)
      .build();
    textItem.setValidation(validation);
  } catch (ignore) {}
  return textItem;
}
