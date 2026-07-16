/** Google Form setup and dropdown refresh. */
function openMainForm_() {
  var id = getConfig().MAIN_FORM_ID;
  if (!id) throw new Error('MAIN_FORM_ID is not configured.');
  return FormApp.openById(id);
}

function setupFormStructure(options) {
  options = options || {};
  var form = openMainForm_();
  form.setTitle(FORM.TITLES.FORM_TITLE);
  form.setDescription(FORM.TITLES.FORM_DESCRIPTION);
  try { form.setCollectEmail(true); } catch (ignore) {}
  try { form.setRequireLogin(true); } catch (ignoreLogin) {}

  deleteFormItemIfPresent_(form, 'اسم المدير المباشر / Direct Manager Name', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'بريد المدير المباشر / Direct Manager Email', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'المسؤول المباشر / Line Manager', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'بريد المسؤول المباشر / Line Manager Email', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'الرقم الوظيفي للموظف / Employee ID', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'بريد الموظف / Employee Email', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'الوحدة الحالية للموظف / Current Unit', FormApp.ItemType.LIST);
  deleteFormItemIfPresent_(form, 'القسم الحالي للموظف / Current Employee Section', FormApp.ItemType.TEXT);
  deleteFormItemIfPresent_(form, 'من تاريخ / Start Date', FormApp.ItemType.DATE);
  deleteFormItemIfPresent_(form, 'إلى تاريخ / End Date', FormApp.ItemType.DATE);

  ensureSectionHeaderItem_(form, FORM.TITLES.LINE_MANAGER_SECTION);
  ensureTextItem_(form, FORM.TITLES.DIRECT_MANAGER_NAME, true);
  applyNumericValidation_(ensureTextItem_(form, FORM.TITLES.DIRECT_MANAGER_ID, true));
  applyEmailValidationToFormItem_(ensureTextItem_(form, FORM.TITLES.DIRECT_MANAGER_EMAIL, true));
  applyNumericValidation_(ensureTextItem_(form, FORM.TITLES.DIRECT_MANAGER_EXTENSION, true));

  ensureSectionHeaderItem_(form, FORM.TITLES.EMPLOYEE_SECTION);
  ensureTextItem_(form, FORM.TITLES.EMPLOYEE_NAME, true);
  applyNumericValidation_(ensureTextItem_(form, FORM.TITLES.EMPLOYEE_ID, true));
  ensureDateItem_(form, FORM.TITLES.EMPLOYEE_HIRE_DATE, true);
  ensureTextItem_(form, FORM.TITLES.EMPLOYEE_JOB_TITLE, true);
  applyEmailValidationToFormItem_(ensureTextItem_(form, FORM.TITLES.EMPLOYEE_EMAIL, true));

  ensureSectionHeaderItem_(form, FORM.TITLES.CURRENT_EMPLOYEE_SECTION);
  ensureCurrentUnitItem_(form);
  ensureTextItem_(form, FORM.TITLES.CURRENT_DEPARTMENT, true);

  ensureSectionHeaderItem_(form, FORM.TITLES.ROTATION_SECTION);
  ensureParagraphItem_(form, FORM.TITLES.NOTES, false);
  removeObsoleteSingleRotationItems_(form);
  removeObsoleteRotationOptionItems_(form);
  if (options.skipChoiceRefresh !== true) refreshFormChoices();
}


function removeObsoleteSingleRotationItems_(form) {
  deleteFormItemIfPresent_(form, FORM.TITLES.START_DATE, FormApp.ItemType.DATE);
  deleteFormItemIfPresent_(form, FORM.TITLES.END_DATE, FormApp.ItemType.DATE);
  deleteFormItemIfPresent_(form, FORM.TITLES.ROTATION_UNIT, FormApp.ItemType.LIST);
  deleteFormItemIfPresent_(form, FORM.TITLES.ROTATION_DEPARTMENT, FormApp.ItemType.LIST);
  deleteFormItemIfPresent_(form, FORM.TITLES.HOURS, FormApp.ItemType.TEXT);
}

function removeObsoleteRotationOptionItems_(form) {
  deleteFormItemIfPresent_(form, FORM.TITLES.PHASE_ONE_INTERNAL, FormApp.ItemType.SECTION_HEADER);
  deleteFormItemIfPresent_(form, FORM.TITLES.PHASE_TWO_EXTERNAL, FormApp.ItemType.SECTION_HEADER);
  for (var i = 1; i <= (FORM.MAX_INTERNAL_OPTIONS || 3); i++) {
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.INTERNAL_SECTION_PREFIX, i), FormApp.ItemType.LIST);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.INTERNAL_FROM_PREFIX, i), FormApp.ItemType.DATE);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.INTERNAL_TO_PREFIX, i), FormApp.ItemType.DATE);
  }
  for (var j = 1; j <= (FORM.MAX_EXTERNAL_OPTIONS || 3); j++) {
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.EXTERNAL_UNIT_PREFIX, j), FormApp.ItemType.LIST);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.EXTERNAL_SECTION_PREFIX, j), FormApp.ItemType.LIST);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.EXTERNAL_FROM_PREFIX, j), FormApp.ItemType.DATE);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.EXTERNAL_TO_PREFIX, j), FormApp.ItemType.DATE);
    deleteFormItemIfPresent_(form, optionTitle_(FORM.TITLES.EXTERNAL_HOURS_PREFIX, j), FormApp.ItemType.TEXT);
  }
}

function optionTitle_(template, optionNumber) {
  return safeString_(template).replace('{n}', optionNumber);
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

function refreshFormChoices(options) {
  if (typeof options === 'boolean') options = { skipReferenceSync: options };
  options = options || {};
  if (typeof run11_refreshMainFormFromAdminSheets === 'function') {
    return run11_refreshMainFormFromAdminSheets({
      skipLock: options.skipLock === true,
      deadline: options.deadline,
      allowCleanInitialization: options.allowCleanInitialization === true
    });
  }
  if (options.skipReferenceSync !== true) syncReferenceDataFromAdminSheets_();
  var form = openMainForm_();
  var units = getUnits_();
  var sections = getSections_();
  setRotationOptionChoices_(form, units, sections);

  logInfo_('refreshFormChoices', '', 'Form choices refreshed.');
}


function setRotationOptionChoices_(form, units, sections) {
  rebuildRotationOptionBranching_(form, units, sections);
}

function branchedOptionTitle_(template, optionNumber, unitName) {
  return optionTitle_(template, optionNumber) + ' - ' + safeString_(unitName);
}

function sectionNamesForFormUnit_(unit, sections) {
  return uniqueNonEmpty_((sections || []).filter(function(section) {
    if (unit.id && section.unitId) return normalizeKey_(section.unitId) === normalizeKey_(unit.id);
    return normalizeKey_(section.unitName) === normalizeKey_(unit.name);
  }).map(function(section) {
    return section.name;
  }));
}

function unitsWithFormSections_(units, sections) {
  return (units || []).filter(function(unit) {
    return safeString_(unit.name) && sectionNamesForFormUnit_(unit, sections).length;
  });
}

function rebuildRotationOptionBranching_(form, units, sections) {
  clearRotationOptionNavigation_(form);
  removeObsoleteRotationOptionItems_(form);
  removeRotationOptionBranchItems_(form);

  var eligibleUnits = unitsWithFormSections_(units, sections);
  var currentUnitItem = ensureCurrentUnitItem_(form);
  if (!eligibleUnits.length) {
    currentUnitItem.setChoiceValues([FORM.NO_AVAILABLE_SECTIONS]);
    return;
  }

  var internalPages = eligibleUnits.map(function(unit) {
    var page = ensurePageBreak_(form, FORM.INTERNAL_BRANCH_PAGE_PREFIX + unit.name);
    var sectionNames = sectionNamesForFormUnit_(unit, sections);
    for (var optionNumber = 1; optionNumber <= (FORM.MAX_INTERNAL_OPTIONS || 3); optionNumber++) {
      var required = optionNumber === 1;
      ensureListItem_(form, branchedOptionTitle_(FORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber, unit.name), required)
        .setChoiceValues(sectionNames);
      ensureDateItem_(form, branchedOptionTitle_(FORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber, unit.name), required);
      ensureDateItem_(form, branchedOptionTitle_(FORM.TITLES.INTERNAL_TO_PREFIX, optionNumber, unit.name), required);
    }
    return { unit: unit, page: page };
  });

  var externalStages = [];
  for (var externalOption = 1; externalOption <= (FORM.MAX_EXTERNAL_OPTIONS || 3); externalOption++) {
    var routerPage = ensurePageBreak_(form, FORM.EXTERNAL_ROUTER_PAGE_PREFIX + externalOption);
    var routerItem = ensureListItem_(form, optionTitle_(FORM.TITLES.EXTERNAL_UNIT_PREFIX, externalOption), true);
    try {
      routerItem.setHelpText('اختر وحدة مختلفة عن وحدة الموظف الحالية، أو اختر عدم إضافة تدوير خارجي. / Select a unit different from the employee current unit, or choose not to add external rotation.');
    } catch (ignoreHelp) {}

    var detailPages = eligibleUnits.map(function(unit) {
      var page = ensurePageBreak_(form, FORM.EXTERNAL_BRANCH_PAGE_PREFIX + externalOption + ' - ' + unit.name);
      ensureListItem_(form, branchedOptionTitle_(FORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption, unit.name), true)
        .setChoiceValues(sectionNamesForFormUnit_(unit, sections));
      ensureDateItem_(form, branchedOptionTitle_(FORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption, unit.name), true);
      ensureDateItem_(form, branchedOptionTitle_(FORM.TITLES.EXTERNAL_TO_PREFIX, externalOption, unit.name), true);
      applyNumericValidation_(ensureTextItem_(form, branchedOptionTitle_(FORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption, unit.name), true));
      return { unit: unit, page: page };
    });
    externalStages.push({ routerPage: routerPage, routerItem: routerItem, detailPages: detailPages });
  }

  for (var stageIndex = 0; stageIndex < externalStages.length; stageIndex++) {
    var stage = externalStages[stageIndex];
    var choices = [stage.routerItem.createChoice(FORM.NO_EXTERNAL_ROTATION, FormApp.PageNavigationType.SUBMIT)];
    stage.detailPages.forEach(function(detail) {
      choices.push(stage.routerItem.createChoice(detail.unit.name, detail.page));
      var nextRouter = stageIndex + 1 < externalStages.length ? externalStages[stageIndex + 1].routerPage : null;
      try {
        detail.page.setGoToPage(nextRouter || FormApp.PageNavigationType.SUBMIT);
      } catch (ignoreNavigation) {}
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

function clearRotationOptionNavigation_(form) {
  var temporaryChoice = 'إعادة ضبط مؤقتة / Temporary reset';
  var navigationTitles = [FORM.TITLES.CURRENT_UNIT, FORM.TITLES.ROTATION_UNIT];
  for (var optionNumber = 1; optionNumber <= (FORM.MAX_EXTERNAL_OPTIONS || 3); optionNumber++) {
    navigationTitles.push(optionTitle_(FORM.TITLES.EXTERNAL_UNIT_PREFIX, optionNumber));
  }
  navigationTitles.forEach(function(title) {
    var item = getFormItemByTitle_(form, title, FormApp.ItemType.LIST);
    if (item) {
      try { asTypedFormItem_(item, 'asListItem').setChoiceValues([temporaryChoice]); } catch (ignoreChoice) {}
    }
  });
  form.getItems(FormApp.ItemType.PAGE_BREAK).forEach(function(item) {
    try { asTypedFormItem_(item, 'asPageBreakItem').setGoToPage(FormApp.PageNavigationType.CONTINUE); } catch (ignorePage) {}
  });
}

function removeRotationOptionBranchItems_(form) {
  var pagePrefixes = [
    FORM.INTERNAL_BRANCH_PAGE_PREFIX,
    FORM.EXTERNAL_ROUTER_PAGE_PREFIX,
    FORM.EXTERNAL_BRANCH_PAGE_PREFIX,
    FORM.SECTION_PAGE_PREFIX
  ];
  var questionPrefixes = [FORM.SECTION_QUESTION_PREFIX];
  for (var optionNumber = 1; optionNumber <= (FORM.MAX_INTERNAL_OPTIONS || 3); optionNumber++) {
    questionPrefixes.push(optionTitle_(FORM.TITLES.INTERNAL_SECTION_PREFIX, optionNumber) + ' - ');
    questionPrefixes.push(optionTitle_(FORM.TITLES.INTERNAL_FROM_PREFIX, optionNumber) + ' - ');
    questionPrefixes.push(optionTitle_(FORM.TITLES.INTERNAL_TO_PREFIX, optionNumber) + ' - ');
  }
  for (var externalOption = 1; externalOption <= (FORM.MAX_EXTERNAL_OPTIONS || 3); externalOption++) {
    questionPrefixes.push(optionTitle_(FORM.TITLES.EXTERNAL_SECTION_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(FORM.TITLES.EXTERNAL_FROM_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(FORM.TITLES.EXTERNAL_TO_PREFIX, externalOption) + ' - ');
    questionPrefixes.push(optionTitle_(FORM.TITLES.EXTERNAL_HOURS_PREFIX, externalOption) + ' - ');
  }
  var items = form.getItems();
  for (var itemIndex = items.length - 1; itemIndex >= 0; itemIndex--) {
    var title = items[itemIndex].getTitle ? safeString_(items[itemIndex].getTitle()) : '';
    var isBranchItem = pagePrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; }) ||
      questionPrefixes.some(function(prefix) { return title.indexOf(prefix) === 0; });
    if (!isBranchItem) continue;
    try {
      form.deleteItem(items[itemIndex]);
    } catch (err) {
      logWarn_('removeRotationOptionBranchItems_', '', 'Could not delete old branch item "' + title + '": ' + err.message);
    }
  }
}

function ensureSectionHeaderItem_(form, title) {
  var item = getFormItemByTitle_(form, title, FormApp.ItemType.SECTION_HEADER);
  if (!item) item = form.addSectionHeaderItem().setTitle(title);
  return asTypedFormItem_(item, 'asSectionHeaderItem');
}

function applyEmailValidationToFormItem_(textItem) {
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
    var key = normalizeKey_(record[H.RECORD.ROTATION_UNIT]) + '|' + normalizeKey_(record[H.RECORD.SECTION]);
    var sectionId = sectionIdByKey[key] || key;
    counts[sectionId] = (counts[sectionId] || 0) + 1;
  });
  return counts;
}
