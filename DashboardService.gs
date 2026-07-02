/** Dashboard calculations and rendering. */
function refreshDashboard(skipReferenceSync, rows) {
  if (skipReferenceSync !== true) syncReferenceDataFromAdminSheets_();
  renderDashboardRows_(rows || calculateSectionSummary_());
}

function renderDashboardRows_(rows) {
  var ss = openDashboardSpreadsheet_();
  var sheet = ensureSheet_(ss, SHEETS.DASHBOARD);
  clearAndWriteObjects_(sheet, DASHBOARD_HEADERS, rows || []);
  applyCleanTableFormatting_(sheet, DASHBOARD_HEADERS.length);
  applyDashboardConditionalFormatting_(sheet);
}

function calculateSectionSummary_(records) {
  var units = getUnits_();
  var unitByName = {};
  units.forEach(function(unit) { unitByName[normalizeKey_(unit.name)] = unit; });
  var sections = getSections_();
  records = records || getRecords_();

  return sections.map(function(section) {
    var activeRecords = records.filter(function(record) {
      return isRecordActiveOrApproved_(record) &&
        normalizeKey_(record[H.RECORD.TRAINING_UNIT]) === normalizeKey_(section.unitName) &&
        normalizeKey_(record[H.RECORD.SECTION]) === normalizeKey_(section.name) &&
        isTodayWithinRange_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
    });

    var allTrained = records.filter(function(record) {
      return isRecordActiveOrApproved_(record) &&
        normalizeKey_(record[H.RECORD.TRAINING_UNIT]) === normalizeKey_(section.unitName) &&
        normalizeKey_(record[H.RECORD.SECTION]) === normalizeKey_(section.name);
    });

    var lastDate = '';
    allTrained.forEach(function(record) {
      var end = dateOnly_(record[H.RECORD.END_DATE]);
      if (end && (!lastDate || end.getTime() > dateOnly_(lastDate).getTime())) lastDate = end;
    });

    var unit = unitByName[normalizeKey_(section.unitName)] || {};
    var row = {};
    row[H.DASHBOARD.UNIT] = section.unitName;
    row[H.DASHBOARD.SECTION] = section.name;
    row[H.DASHBOARD.HEAD] = unit.headName || '';
    row[H.DASHBOARD.HEAD_EMAIL] = unit.headEmail || '';
    row[H.DASHBOARD.ACTIVE_COUNT] = activeRecords.length;
    row[H.DASHBOARD.ACTIVE_TRAINEES] = uniqueNonEmpty_(activeRecords.map(function(r) { return r[H.RECORD.EMPLOYEE_NAME]; })).join('، ');
    row[H.DASHBOARD.ALL_TRAINEES] = uniqueNonEmpty_(allTrained.map(function(r) { return r[H.RECORD.EMPLOYEE_NAME]; })).join('، ');
    row[H.DASHBOARD.LAST_TRAINING] = lastDate ? formatDate_(lastDate) : '';
    row[H.DASHBOARD.STATUS] = activeRecords.length > 0 ? STATUS.OCCUPIED : STATUS.AVAILABLE;
    return row;
  });
}

function applyDashboardConditionalFormatting_(sheet) {
  var map = getHeaderMap_(sheet);
  if (!map[H.DASHBOARD.STATUS]) return;
  var statusRange = sheet.getRange(2, map[H.DASHBOARD.STATUS], Math.max(sheet.getLastRow() - 1, 1), 1);
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(STATUS.AVAILABLE)
    .setBackground('#EAF5EA')
    .setRanges([statusRange])
    .build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(STATUS.OCCUPIED)
    .setBackground('#F9E7E7')
    .setRanges([statusRange])
    .build());
  sheet.setConditionalFormatRules(rules);
}
