/** Google Form setup and dropdown refresh. */
function openMainForm_() {
  var id = getConfig().MAIN_FORM_ID;
  if (!id) throw new Error('MAIN_FORM_ID is not configured.');
  return FormApp.openById(id);
}

function setupFormStructure(options) {
  options = options || {};
  var form = openMainForm_();
  form.setTitle('Employee / طلب تدريب موظف Training Request');
  form.setDescription('يرجى إدخال بيانات الطلب بدقة. يتم التحقق من التعارضات مرة أخرى عند اعتماد رئيس الوحدة.\nPlease enter the request details carefully. Conflicts are checked again when the unit head approves.');
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setRequireLogin(true); } catch (ignoreLogin) {}

  deleteFormItemIfPresent_(form, 'اسم المدير المباشر / Direct Manager Name', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'بريد المدير المباشر / Direct Manager Email', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, FORM.TITLES.DIRECT_MANAGER_EMAIL, FormApp.ItemType.TEXT);
  ensureTextItem_(form, FORM.TITLES.DIRECT_MANAGER_NAME, true);
  ensureTextItem_(form, FORM.TITLES.EMPLOYEE_NAME, true);
  ensureTextItem_(form, FORM.TITLES.EMPLOYEE_ID, true);
  ensureTextItem_(form, FORM.TITLES.EMPLOYEE_EMAIL, true);
  ensureCurrentUnitItem_(form);
  ensureDateItem_(form, FORM.TITLES.START_DATE, true);
  ensureDateItem_(form, FORM.TITLES.END_DATE, true);
  ensureTextItem_(form, FORM.TITLES.HOURS, true);
  ensureParagraphItem_(form, FORM.TITLES.NOTES, false);
  ensureTrainingUnitItem_(form);
  if (options.skipChoiceRefresh !== true) refreshFormChoices();
}

function deleteFormItemIfPresent_(form, title, type) {
  var item = getFormItemByTitle_(form, title, type);
  if (!item) return;
  try {
    form.deleteItem(item);
  } catch (err) {
    logWarn_('deleteFormItemIfPresent_', '', 'Could not delete obsolete form item "' + title + '": ' + err.message);
  }
}

function refreshFormChoices(skipReferenceSync) {
  if (skipReferenceSync !== true) syncReferenceDataFromAdminSheets_();
  var form = openMainForm_();
  var units = getUnits_();
  var sections = getSections_();
  var unavailable = getUnavailableSectionIdsForCurrentDate_();

  var currentUnitItem = ensureCurrentUnitItem_(form);
  currentUnitItem.setChoiceValues(units.map(function(unit) { return unit.name; }));

  var trainingUnitItem = ensureTrainingUnitItem_(form);
  var pageBreakByUnit = {};

  units.forEach(function(unit) {
    var page = ensurePageBreak_(form, FORM.SECTION_PAGE_PREFIX + unit.name);
    try { page.setGoToPage(FormApp.PageNavigationType.SUBMIT); } catch (ignore) {}
    pageBreakByUnit[unit.name] = page;

    var sectionItem = ensureListItem_(form, FORM.SECTION_QUESTION_PREFIX + unit.name, true);
    var availableSections = sections.filter(function(section) {
      if (normalizeKey_(section.unitName) !== normalizeKey_(unit.name)) return false;
      var activeCount = unavailable[section.id] || 0;
      return activeCount < section.capacity;
    }).map(function(section) { return section.name; });

    if (!availableSections.length) availableSections = [FORM.NO_AVAILABLE_SECTIONS];
    sectionItem.setChoiceValues(availableSections);
  });

  var choices = units.map(function(unit) {
    return trainingUnitItem.createChoice(unit.name, pageBreakByUnit[unit.name]);
  });
  if (choices.length) trainingUnitItem.setChoices(choices);
  logInfo_('refreshFormChoices', '', 'Form choices refreshed.');
}

function ensureTextItem_(form, title, required) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.TEXT);
  if (!item) item = form.addTextItem().setTitle(title);
  item = asTypedFormItem_(item, 'asTextItem');
  try { item.setHelpText(''); } catch (ignore) {}
  item.setRequired(Boolean(required));
  return item;
}

function ensureParagraphItem_(form, title, required) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.PARAGRAPH_TEXT);
  if (!item) item = form.addParagraphTextItem().setTitle(title);
  item = asTypedFormItem_(item, 'asParagraphTextItem');
  try { item.setHelpText(''); } catch (ignore) {}
  item.setRequired(Boolean(required));
  return item;
}

function ensureDateItem_(form, title, required) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.DATE);
  if (!item) item = form.addDateItem().setTitle(title);
  item = asTypedFormItem_(item, 'asDateItem');
  try { item.setHelpText(''); } catch (ignore) {}
  item.setRequired(Boolean(required));
  return item;
}

function ensureListItem_(form, title, required) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.LIST);
  if (!item) item = form.addListItem().setTitle(title);
  item = asTypedFormItem_(item, 'asListItem');
  try { item.setHelpText(''); } catch (ignore) {}
  item.setRequired(Boolean(required));
  return item;
}

function ensureCurrentUnitItem_(form) {
  return ensureListItem_(form, FORM.TITLES.CURRENT_UNIT, true);
}

function ensureTrainingUnitItem_(form) {
  return ensureListItem_(form, FORM.TITLES.TRAINING_UNIT, true);
}

function ensurePageBreak_(form, title) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.PAGE_BREAK);
  if (!item) item = form.addPageBreakItem().setTitle(title);
  return asTypedFormItem_(item, 'asPageBreakItem');
}

function asTypedFormItem_(item, castMethodName) {
  if (item && typeof item[castMethodName] === 'function') return item[castMethodName]();
  return item;
}

function getFormItemByTitle_(form, title, type) {
  var items = form.getItems(type);
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle && items[i].getTitle() === title) return items[i];
  }
  return null;
}

function getUnavailableSectionIdsForCurrentDate_() {
  var counts = {};
  var records = getRecords_();
  var sections = getSections_();
  var sectionIdByKey = {};
  sections.forEach(function(section) {
    sectionIdByKey[normalizeKey_(section.unitName) + '|' + normalizeKey_(section.name)] = section.id;
  });

  records.forEach(function(record) {
    if (!isRecordActiveOrApproved_(record)) return;
    if (!isTodayWithinRange_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE])) return;
    var key = normalizeKey_(record[H.RECORD.TRAINING_UNIT]) + '|' + normalizeKey_(record[H.RECORD.SECTION]);
    var sectionId = sectionIdByKey[key] || key;
    counts[sectionId] = (counts[sectionId] || 0) + 1;
  });
  return counts;
}
