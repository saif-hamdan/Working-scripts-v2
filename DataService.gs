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
