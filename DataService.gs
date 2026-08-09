/** Loads units, sections, and request records as objects. */
function getUnits_() {
  var sheet = getOrCreateSheet_(SHEETS.UNITS);
  requireHeaders_(sheet, UNIT_HEADERS);
  return getDataObjects_(sheet)
    .filter(function(row) { return isActiveFlag_(row[H.UNIT.ACTIVE]); })
    .map(function(row) {
      return {
        id: safeString_(row[H.UNIT.UNIT_ID]) || safeString_(row[H.UNIT.UNIT_NAME]),
        name: safeString_(row[H.UNIT.UNIT_NAME]),
        headName: safeString_(row[H.UNIT.HEAD_NAME]),
        headTitle: safeString_(row[H.UNIT.HEAD_TITLE]),
        headEmail: safeString_(row[H.UNIT.HEAD_EMAIL])
      };
    })
    .filter(function(unit) { return unit.name; });
}

function getSections_() {
  var sheet = getOrCreateSheet_(SHEETS.SECTIONS);
  requireHeaders_(sheet, SECTION_HEADERS);
  return getDataObjects_(sheet)
    .filter(function(row) { return isActiveFlag_(row[H.SECTION.ACTIVE]); })
    .map(function(row) {
      return {
        id: safeString_(row[H.SECTION.SECTION_ID]) || (safeString_(row[H.SECTION.UNIT_NAME]) + '|' + safeString_(row[H.SECTION.SECTION_NAME])),
        unitId: safeString_(row[H.SECTION.UNIT_ID]),
        unitName: safeString_(row[H.SECTION.UNIT_NAME]),
        name: safeString_(row[H.SECTION.SECTION_NAME]),
        capacity: Math.max(1, toNumber_(row[H.SECTION.CAPACITY], 1)),
        headEmail: normalizeEmailListForStorage_(row[H.SECTION.HEAD_EMAIL]),
        headNameAr: safeString_(row[H.SECTION.HEAD_NAME_AR]),
        headNameEn: safeString_(row[H.SECTION.HEAD_NAME_EN]),
        headSalutationAr: safeString_(row[H.SECTION.HEAD_SALUTATION_AR]),
        headJobTitleAr: safeString_(row[H.SECTION.HEAD_JOB_TITLE_AR]),
        headJobTitleEn: safeString_(row[H.SECTION.HEAD_JOB_TITLE_EN])
      };
    })
    .filter(function(section) { return section.unitName && section.name; });
}

function getRecords_() {
  var sheet = getOrCreateSheet_(SHEETS.RECORDS);
  requireHeaders_(sheet, RECORD_HEADERS);
  return getDataObjects_(sheet);
}

function syncReferenceDataFromAdminSheets_(options) {
  options = options || {};
  var forceFormat = options.forceFormat === true;
  var ss = openDashboardSpreadsheet_();
  var adminUnits = ensureSheet_(ss, SHEETS.ADMIN_UNITS);
  var adminSections = ensureSheet_(ss, SHEETS.ADMIN_SECTIONS);
  var runtimeUnits = ensureSheet_(ss, SHEETS.UNITS);
  var runtimeSections = ensureSheet_(ss, SHEETS.SECTIONS);

  setSheetHeaders_(adminUnits, UNIT_HEADERS);
  setSheetHeaders_(adminSections, SECTION_HEADERS);
  setSheetHeaders_(runtimeUnits, UNIT_HEADERS);
  setSheetHeaders_(runtimeSections, SECTION_HEADERS);

  if (adminUnits.getLastRow() < 2 && runtimeUnits.getLastRow() >= 2) {
    clearAndWriteObjects_(adminUnits, UNIT_HEADERS, getDataObjects_(runtimeUnits));
  }
  if (adminSections.getLastRow() < 2 && runtimeSections.getLastRow() >= 2) {
    clearAndWriteObjects_(adminSections, SECTION_HEADERS, getDataObjects_(runtimeSections));
  }
  var units = normalizeAdminUnitRows_(getDataObjects_(adminUnits));
  var sections = normalizeAdminSectionRows_(getDataObjects_(adminSections), units);
  var props = PropertiesService.getScriptProperties();
  var unitsChecksum = makeReferenceChecksum_(units);
  var sectionsChecksum = makeReferenceChecksum_(sections);
  var formChecksum = makeFormReferenceChecksum_(units, sections);
  var previousFormChecksum = props.getProperty('REFERENCE_FORM_CHECKSUM');
  var unitsChanged = unitsChecksum !== props.getProperty('REFERENCE_UNITS_CHECKSUM');
  var sectionsChanged = sectionsChecksum !== props.getProperty('REFERENCE_SECTIONS_CHECKSUM');
  // On the first run after this schema upgrade, adopt the current choices as
  // the baseline. This prevents an email-only schema migration from touching
  // either Google Form.
  var formChoicesChanged = previousFormChecksum !== null &&
    formChecksum !== previousFormChecksum;

  if (units.length && unitsChanged) {
    clearAndWriteObjects_(runtimeUnits, UNIT_HEADERS, units);
  }
  if (sections.length && sectionsChanged) {
    clearAndWriteObjects_(runtimeSections, SECTION_HEADERS, sections);
  }
  props.setProperties({
    REFERENCE_UNITS_CHECKSUM: unitsChecksum,
    REFERENCE_SECTIONS_CHECKSUM: sectionsChecksum,
    REFERENCE_FORM_CHECKSUM: formChecksum
  }, false);

  if (forceFormat) {
    applyCleanTableFormatting_(adminUnits, UNIT_HEADERS.length);
    applyCleanTableFormatting_(adminSections, SECTION_HEADERS.length);
    applyCleanTableFormatting_(runtimeUnits, UNIT_HEADERS.length);
    applyCleanTableFormatting_(runtimeSections, SECTION_HEADERS.length);
    applySectionHeadSalutationValidation_(adminSections);
  }
  try { runtimeUnits.hideSheet(); runtimeSections.hideSheet(); } catch (ignore) {}
  return {
    unitsChanged: unitsChanged,
    sectionsChanged: sectionsChanged,
    formChoicesChanged: formChoicesChanged,
    changed: unitsChanged || sectionsChanged
  };
}

function ensureDefaultSectionHeadEmails_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var map = getHeaderMap_(sheet);
  var sectionNameColumn = map[H.SECTION.SECTION_NAME];
  var headEmailColumn = map[H.SECTION.HEAD_EMAIL];
  if (!sectionNameColumn || !headEmailColumn) return 0;

  var rowCount = sheet.getLastRow() - 1;
  var sectionNames = sheet.getRange(2, sectionNameColumn, rowCount, 1).getValues();
  var emails = sheet.getRange(2, headEmailColumn, rowCount, 1).getValues();
  var changed = 0;
  for (var i = 0; i < rowCount; i++) {
    if (!safeString_(sectionNames[i][0]) || safeString_(emails[i][0])) continue;
    emails[i][0] = DEFAULT_SECTION_HEAD_EMAIL;
    changed++;
  }
  if (changed) sheet.getRange(2, headEmailColumn, rowCount, 1).setValues(emails);
  return changed;
}

function applySectionHeadSalutationValidation_(sheet) {
  if (!sheet) return false;
  var column = getHeaderMap_(sheet)[H.SECTION.HEAD_SALUTATION_AR];
  if (!column) return false;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['المحترم', 'المحترمة'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  return true;
}


function makeReferenceChecksum_(rows) {
  var json = JSON.stringify(rows || []);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json, Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function makeFormReferenceChecksum_(units, sections) {
  var formUnits = (units || []).map(function(unit) {
    return [
      safeString_(unit[H.UNIT.UNIT_ID]),
      safeString_(unit[H.UNIT.UNIT_NAME]),
      safeString_(unit[H.UNIT.ACTIVE])
    ];
  });
  var formSections = (sections || []).map(function(section) {
    return [
      safeString_(section[H.SECTION.SECTION_ID]),
      safeString_(section[H.SECTION.UNIT_ID]),
      safeString_(section[H.SECTION.UNIT_NAME]),
      safeString_(section[H.SECTION.SECTION_NAME]),
      safeString_(section[H.SECTION.ACTIVE])
    ];
  });
  return makeReferenceChecksum_({
    units: formUnits,
    sections: formSections
  });
}

function normalizeAdminUnitRows_(rows) {
  return (rows || []).map(function(row) {
    var unit = {};
    unit[H.UNIT.UNIT_ID] = safeString_(row[H.UNIT.UNIT_ID]) || safeString_(row[H.UNIT.UNIT_NAME]);
    unit[H.UNIT.UNIT_NAME] = safeString_(row[H.UNIT.UNIT_NAME]);
    unit[H.UNIT.HEAD_NAME] = safeString_(row[H.UNIT.HEAD_NAME]);
    unit[H.UNIT.HEAD_TITLE] = safeString_(row[H.UNIT.HEAD_TITLE]);
    unit[H.UNIT.HEAD_EMAIL] = safeString_(row[H.UNIT.HEAD_EMAIL]);
    unit[H.UNIT.ACTIVE] = safeString_(row[H.UNIT.ACTIVE]) || STATUS.YES;
    return unit;
  }).filter(function(unit) {
    return safeString_(unit[H.UNIT.UNIT_NAME]);
  });
}

function normalizeAdminSectionRows_(rows, units) {
  var unitById = {};
  var unitByName = {};
  var activeUnitById = {};
  var activeUnitByName = {};
  (units || []).forEach(function(unit) {
    var id = safeString_(unit[H.UNIT.UNIT_ID]);
    var name = safeString_(unit[H.UNIT.UNIT_NAME]);
    if (id) unitById[id] = true;
    if (name) unitByName[name] = true;
    if (!isActiveFlag_(unit[H.UNIT.ACTIVE])) return;
    if (id) activeUnitById[id] = true;
    if (name) activeUnitByName[name] = true;
  });

  return (rows || []).map(function(row) {
    var unitId = safeString_(row[H.SECTION.UNIT_ID]);
    var unitName = safeString_(row[H.SECTION.UNIT_NAME]);
    var hasUnit = (unitId && unitById[unitId]) || (unitName && unitByName[unitName]);
    var hasActiveUnit = (unitId && activeUnitById[unitId]) || (unitName && activeUnitByName[unitName]);
    var section = {};
    section[H.SECTION.SECTION_ID] = safeString_(row[H.SECTION.SECTION_ID]) ||
      (unitName + '|' + safeString_(row[H.SECTION.SECTION_NAME]));
    section[H.SECTION.UNIT_ID] = unitId;
    section[H.SECTION.UNIT_NAME] = unitName;
    section[H.SECTION.SECTION_NAME] = safeString_(row[H.SECTION.SECTION_NAME]);
    section[H.SECTION.ACTIVE] = hasUnit && !hasActiveUnit ? STATUS.NO : (safeString_(row[H.SECTION.ACTIVE]) || STATUS.YES);
    section[H.SECTION.CAPACITY] = Math.max(1, toNumber_(row[H.SECTION.CAPACITY], 1));
    section[H.SECTION.HEAD_EMAIL] = normalizeEmailListForStorage_(row[H.SECTION.HEAD_EMAIL]);
    section[H.SECTION.HEAD_NAME_AR] = safeString_(row[H.SECTION.HEAD_NAME_AR]);
    section[H.SECTION.HEAD_NAME_EN] = safeString_(row[H.SECTION.HEAD_NAME_EN]);
    section[H.SECTION.HEAD_SALUTATION_AR] = safeString_(row[H.SECTION.HEAD_SALUTATION_AR]);
    section[H.SECTION.HEAD_JOB_TITLE_AR] = safeString_(row[H.SECTION.HEAD_JOB_TITLE_AR]);
    section[H.SECTION.HEAD_JOB_TITLE_EN] = safeString_(row[H.SECTION.HEAD_JOB_TITLE_EN]);
    return section;
  }).filter(function(section) {
    return safeString_(section[H.SECTION.UNIT_NAME]) && safeString_(section[H.SECTION.SECTION_NAME]);
  });
}

function findUnitByName_(unitName) {
  var target = normalizeKey_(unitName);
  return getUnits_().filter(function(unit) { return normalizeKey_(unit.name) === target; })[0] || null;
}

function findSectionByUnitAndName_(unitName, sectionName) {
  var unitKey = normalizeKey_(unitName);
  var secKey = normalizeKey_(sectionName);
  return getSections_().filter(function(section) {
    return normalizeKey_(section.unitName) === unitKey && normalizeKey_(section.name) === secKey;
  })[0] || null;
}

function getApproverForRequest_(currentUnitName, rotationUnitName) {
  var cfg = getConfig();
  var unitName = cfg.APPROVER_UNIT_MODE === APPROVER_UNIT_MODE.CURRENT_UNIT ? currentUnitName : rotationUnitName;
  var unit = findUnitByName_(unitName);
  return unit || { name: unitName, headName: '', headEmail: '' };
}
