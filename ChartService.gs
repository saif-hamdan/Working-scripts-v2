/** KPI tables and indicators. */
function refreshCharts(records, dashboardRows) {
  records = records || getRecords_();
  dashboardRows = dashboardRows || calculateSectionSummary_(records);
  refreshChartsFromData_(records, dashboardRows);
}

function refreshChartsFromData_(records, dashboardRows) {
  var ss = openDashboardSpreadsheet_();
  var sheet = ensureSheet_(ss, SHEETS.CHARTS);
  sheet.clear();
  try { sheet.setRightToLeft(true); } catch (ignore) {}

  var statusCounts = countBy_(records, H.RECORD.FINAL_STATUS);
  var unitActiveCounts = {};
  dashboardRows.forEach(function(row) {
    unitActiveCounts[row[H.DASHBOARD.UNIT]] = (unitActiveCounts[row[H.DASHBOARD.UNIT]] || 0) + toNumber_(row[H.DASHBOARD.ACTIVE_COUNT], 0);
  });
  var typeCounts = countBy_(records, H.RECORD.TYPE);

  sheet.getRange('A1:B1').setValues([['حالة الاعتماد النهائي', 'العدد']]).setFontWeight('bold');
  writeKeyValueTable_(sheet, 2, 1, statusCounts);

  sheet.getRange('D1:E1').setValues([['الوحدة', 'عدد المتدربين النشطين']]).setFontWeight('bold');
  writeKeyValueTable_(sheet, 2, 4, unitActiveCounts);

  sheet.getRange('G1:H1').setValues([['نوع الطلب', 'العدد']]).setFontWeight('bold');
  writeKeyValueTable_(sheet, 2, 7, typeCounts);

  sheet.getRange('J1:K6').setValues([
    ['المؤشر', 'القيمة'],
    ['إجمالي الطلبات', records.length],
    ['الطلبات المعتمدة', records.filter(function(r) { return safeString_(r[H.RECORD.FINAL_STATUS]) === STATUS.FINAL_APPROVED; }).length],
    ['الطلبات المرفوضة', records.filter(function(r) { return safeString_(r[H.RECORD.FINAL_STATUS]) === STATUS.FINAL_REJECTED || safeString_(r[H.RECORD.FINAL_STATUS]) === STATUS.FINAL_CONFLICT; }).length],
    ['الأقسام المتاحة', dashboardRows.filter(function(r) { return safeString_(r[H.DASHBOARD.STATUS]) === STATUS.AVAILABLE; }).length],
    ['الأقسام المشغولة', dashboardRows.filter(function(r) { return safeString_(r[H.DASHBOARD.STATUS]) === STATUS.OCCUPIED; }).length]
  ]).setFontWeight('bold');

  sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 11).setHorizontalAlignment('center').setVerticalAlignment('middle');
  for (var c = 1; c <= 11; c++) sheet.autoResizeColumn(c);
}

function countBy_(records, header) {
  var counts = {};
  records.forEach(function(record) {
    var key = safeString_(record[header]) || 'غير محدد';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function writeKeyValueTable_(sheet, startRow, startCol, map) {
  var keys = Object.keys(map);
  if (!keys.length) {
    sheet.getRange(startRow, startCol, 1, 2).setValues([['لا توجد بيانات', 0]]);
    return;
  }
  var rows = keys.map(function(key) { return [key, map[key]]; });
  sheet.getRange(startRow, startCol, rows.length, 2).setValues(rows);
}
