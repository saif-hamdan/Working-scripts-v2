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
        capacity: Math.max(1, toNumber_(row[H.SECTION.CAPACITY], 1))
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
  var sections = normalizeAdminSectionRows_(getDataObjects_(adminSections));
  var props = PropertiesService.getScriptProperties();
  var unitsChecksum = makeReferenceChecksum_(units);
  var sectionsChecksum = makeReferenceChecksum_(sections);
  var unitsChanged = unitsChecksum !== props.getProperty('REFERENCE_UNITS_CHECKSUM');
  var sectionsChanged = sectionsChecksum !== props.getProperty('REFERENCE_SECTIONS_CHECKSUM');

  if (units.length && unitsChanged) {
    clearAndWriteObjects_(runtimeUnits, UNIT_HEADERS, units);
  }
  if (sections.length && sectionsChanged) {
    clearAndWriteObjects_(runtimeSections, SECTION_HEADERS, sections);
  }
  props.setProperties({
    REFERENCE_UNITS_CHECKSUM: unitsChecksum,
    REFERENCE_SECTIONS_CHECKSUM: sectionsChecksum
  }, false);

  if (forceFormat) {
    applyCleanTableFormatting_(adminUnits, UNIT_HEADERS.length);
    applyCleanTableFormatting_(adminSections, SECTION_HEADERS.length);
    applyCleanTableFormatting_(runtimeUnits, UNIT_HEADERS.length);
    applyCleanTableFormatting_(runtimeSections, SECTION_HEADERS.length);
  }
  try { runtimeUnits.hideSheet(); runtimeSections.hideSheet(); } catch (ignore) {}
  return {
    unitsChanged: unitsChanged,
    sectionsChanged: sectionsChanged,
    changed: unitsChanged || sectionsChanged
  };
}


function makeReferenceChecksum_(rows) {
  var json = JSON.stringify(rows || []);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, json, Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function normalizeAdminUnitRows_(rows) {
  return (rows || []).map(function(row) {
    var unit = {};
    unit[H.UNIT.UNIT_ID] = safeString_(row[H.UNIT.UNIT_ID]) || safeString_(row[H.UNIT.UNIT_NAME]);
    unit[H.UNIT.UNIT_NAME] = safeString_(row[H.UNIT.UNIT_NAME]);
    unit[H.UNIT.HEAD_NAME] = safeString_(row[H.UNIT.HEAD_NAME]);
    unit[H.UNIT.HEAD_EMAIL] = safeString_(row[H.UNIT.HEAD_EMAIL]);
    unit[H.UNIT.ACTIVE] = safeString_(row[H.UNIT.ACTIVE]) || STATUS.YES;
    return unit;
  }).filter(function(unit) {
    return safeString_(unit[H.UNIT.UNIT_NAME]);
  });
}

function normalizeAdminSectionRows_(rows) {
  return (rows || []).map(function(row) {
    var section = {};
    section[H.SECTION.SECTION_ID] = safeString_(row[H.SECTION.SECTION_ID]) ||
      (safeString_(row[H.SECTION.UNIT_NAME]) + '|' + safeString_(row[H.SECTION.SECTION_NAME]));
    section[H.SECTION.UNIT_ID] = safeString_(row[H.SECTION.UNIT_ID]);
    section[H.SECTION.UNIT_NAME] = safeString_(row[H.SECTION.UNIT_NAME]);
    section[H.SECTION.SECTION_NAME] = safeString_(row[H.SECTION.SECTION_NAME]);
    section[H.SECTION.ACTIVE] = safeString_(row[H.SECTION.ACTIVE]) || STATUS.YES;
    section[H.SECTION.CAPACITY] = Math.max(1, toNumber_(row[H.SECTION.CAPACITY], 1));
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

function getApproverForRequest_(currentUnitName, trainingUnitName) {
  var cfg = getConfig();
  var unitName = cfg.APPROVER_UNIT_MODE === APPROVER_UNIT_MODE.CURRENT_UNIT ? currentUnitName : trainingUnitName;
  var unit = findUnitByName_(unitName);
  return unit || { name: unitName, headName: '', headEmail: '' };
}
