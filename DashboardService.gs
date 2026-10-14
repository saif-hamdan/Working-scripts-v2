/** Dashboard calculations and rendering. */
function refreshDashboard(skipReferenceSync, rows) {
  if (skipReferenceSync !== true) syncReferenceDataFromAdminSheets_();
  renderDashboardRows_(rows || calculateSectionSummary_());
}

function renderDashboardRows_(rows) {
  var ss = openDashboardSpreadsheet_();
  var sheet = ensureSheet_(ss, SHEETS.DASHBOARD);
  removeDashboardSectionStatusColumn_(sheet);
  clearAndWriteObjects_(sheet, DASHBOARD_HEADERS, rows || []);
  applyCleanTableFormatting_(sheet, DASHBOARD_HEADERS.length);
}

function calculateSectionSummary_(records) {
  var units = getUnits_();
  var unitByName = {};
  units.forEach(function(unit) { unitByName[normalizeKey_(unit.name)] = unit; });
  var sections = getSections_();
  records = records || getRecords_();

  return sections.map(function(section) {
    var unit = unitByName[normalizeKey_(section.unitName)] || {};
    return calculateOneSectionSummary_(section.unitName, section.name, unit, records);
  });
}

function calculateOneSectionSummary_(unitName, sectionName, unit, records) {
  var unitKey = normalizeKey_(unitName);
  var sectionKey = normalizeKey_(sectionName);
  var allTrained = (records || []).filter(function(record) {
    return isRecordActiveOrApproved_(record) &&
      normalizeKey_(record[H.RECORD.ROTATION_UNIT]) === unitKey &&
      normalizeKey_(record[H.RECORD.SECTION]) === sectionKey;
  });
  var activeRecords = allTrained.filter(function(record) {
    return isTodayWithinRange_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  });
  var lastDate = '';
  allTrained.forEach(function(record) {
    var end = dateOnly_(record[H.RECORD.END_DATE]);
    if (end && (!lastDate || end.getTime() > dateOnly_(lastDate).getTime())) lastDate = end;
  });

  var row = {};
  row[H.DASHBOARD.UNIT] = unitName;
  row[H.DASHBOARD.SECTION] = sectionName;
  row[H.DASHBOARD.HEAD] = unit && unit.headName || '';
  row[H.DASHBOARD.HEAD_EMAIL] = unit && unit.headEmail || '';
  row[H.DASHBOARD.ACTIVE_COUNT] = activeRecords.length;
  row[H.DASHBOARD.ACTIVE_TRAINEES] = uniqueNonEmpty_(activeRecords.map(function(record) { return record[H.RECORD.EMPLOYEE_ID]; })).join('، ');
  row[H.DASHBOARD.ALL_TRAINEES] = uniqueNonEmpty_(allTrained.map(function(record) { return record[H.RECORD.EMPLOYEE_NAME]; })).join('، ');
  row[H.DASHBOARD.LAST_ROTATION] = lastDate ? formatDate_(lastDate) : '';
  row[H.DASHBOARD.TOTAL_HOURS] = allTrained.reduce(function(total, record) {
    return total + calculateRecordRotationHours_(record);
  }, 0);
  return row;
}

function refreshDashboardForRecords_(records) {
  records = records || [];
  if (!records.length) return [];
  var units = getUnits_();
  var unitByName = {};
  units.forEach(function(unit) { unitByName[normalizeKey_(unit.name)] = unit; });
  var recordsSheet = getSheet_(SHEETS.RECORDS);
  var dashboardSheet = ensureSheet_(openDashboardSpreadsheet_(), SHEETS.DASHBOARD);
  removeDashboardSectionStatusColumn_(dashboardSheet);
  setSheetHeaders_(dashboardSheet, DASHBOARD_HEADERS);
  var pairLookup = {};
  var updatedRows = [];

  records.forEach(function(record) {
    var unitName = safeString_(record[H.RECORD.ROTATION_UNIT]);
    var sectionName = safeString_(record[H.RECORD.SECTION]);
    if (!unitName || !sectionName) return;
    var key = normalizeKey_(unitName) + '|' + normalizeKey_(sectionName);
    if (pairLookup[key]) return;
    pairLookup[key] = true;

    var sectionRecords = recordsSheet
      ? findObjectsByValue_(recordsSheet, H.RECORD.SECTION, sectionName, 2000).filter(function(candidate) {
          return normalizeKey_(candidate[H.RECORD.ROTATION_UNIT]) === normalizeKey_(unitName);
        })
      : [];
    var dashboardRow = calculateOneSectionSummary_(
      unitName,
      sectionName,
      unitByName[normalizeKey_(unitName)] || {},
      sectionRecords
    );
    var existingRow = findDashboardRow_(dashboardSheet, unitName, sectionName);
    if (existingRow) updateObjectRow_(dashboardSheet, existingRow, dashboardRow);
    else appendObjectRow_(dashboardSheet, DASHBOARD_HEADERS, dashboardRow);
    updatedRows.push(dashboardRow);
  });

  applyCleanTableFormatting_(dashboardSheet, DASHBOARD_HEADERS.length);
  refreshEmployeeRotationHoursForRecords_(records);
  return updatedRows;
}

function findDashboardRow_(sheet, unitName, sectionName) {
  var candidates = findObjectsByValue_(sheet, H.DASHBOARD.SECTION, sectionName, 2000);
  var unitKey = normalizeKey_(unitName);
  for (var i = 0; i < candidates.length; i++) {
    if (normalizeKey_(candidates[i][H.DASHBOARD.UNIT]) === unitKey) return candidates[i]._rowNumber;
  }
  return null;
}
