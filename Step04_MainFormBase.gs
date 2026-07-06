function run04_rebuildMainFormBaseQuestions() {
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
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
  form.setTitle('طلب تدريب موظف جديد / New Employee Training Request');
  form.setDescription('يرجى إدخال بيانات طلب التدريب. سيتم إرسال الطلب للموافقة والتحقق من التعارضات تلقائياً.\nPlease enter the training request details. The request will be routed for approval and conflict checking.');
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setAllowResponseEdits(false); } catch (ignore2) {}
  try { form.setProgressBar(true); } catch (ignore3) {}
  try { form.setConfirmationMessage('تم إرسال طلب التدريب بنجاح. / Your training request has been submitted successfully.'); } catch (ignore4) {}

  if (BOOTSTRAP_CONFIG.REBUILD_MAIN_FORM_ITEMS) deleteAllFormItems_(form);

  var units = readUnits_(dashboard);
  var unitNames = units.map(function(unit) { return unit.name; });
  if (!unitNames.length) unitNames = [BFORM.NO_UNITS];

  ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_NAME, true)
    .setHelpText('يرجى كتابة الاسم الكامل. / Please enter the full name.');
  applyEmailValidation_(ensureText_(form, BFORM.TITLES.DIRECT_MANAGER_EMAIL, true));

  ensureText_(form, BFORM.TITLES.EMPLOYEE_NAME, true)
    .setHelpText('يرجى كتابة الاسم الكامل للموظف الجديد. / Please enter the new employee full name.');
  applyEmailValidation_(ensureText_(form, BFORM.TITLES.EMPLOYEE_EMAIL, true));

  var currentUnit = ensureList_(form, BFORM.TITLES.CURRENT_UNIT, true);
  currentUnit.setChoiceValues(unitNames);

  ensureDate_(form, BFORM.TITLES.START_DATE, true);
  ensureDate_(form, BFORM.TITLES.END_DATE, true);
  applyHoursValidation_(ensureText_(form, BFORM.TITLES.HOURS, true));
  ensureParagraph_(form, BFORM.TITLES.NOTES, false);

  var trainingUnit = ensureList_(form, BFORM.TITLES.TRAINING_UNIT, true);
  trainingUnit.setChoiceValues(unitNames);
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
  var trainingUnit = getItem_(form, BFORM.TITLES.TRAINING_UNIT, FormApp.ItemType.LIST);
  if (trainingUnit) {
    try { trainingUnit.asListItem().setChoiceValues([temporaryChoice]); } catch (ignore) {}
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
      .setHelpText('يرجى إدخال بريد إلكتروني صحيح. / Please enter a valid email address.')
      .build();
    textItem.setValidation(validation);
  } catch (ignore) {}
  return textItem;
}

function applyHoursValidation_(textItem) {
  try {
    var validation = FormApp.createTextValidation()
      .requireNumberGreaterThan(0)
      .setHelpText('يرجى إدخال رقم أكبر من صفر. / Please enter a number greater than zero.')
      .build();
    textItem.setValidation(validation);
  } catch (ignore) {}
  return textItem;
}
