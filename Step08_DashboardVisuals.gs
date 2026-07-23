function run08_buildDashboardSummaryAndCharts() {
  var ss = openDashboardFromProperties_();
  syncAdminReferenceData_(ss);
  refreshDashboardSectionSummary_(ss);
  writeSetupSummary_(ss);
  return finishStep_('08 Build Dashboard Summary', BSTATUS.COMPLETE, 'Dashboard summary was refreshed.');
}

function refreshDashboardSectionSummary_(ss) {
  var dashboard = ss.getSheetByName(BS.DASHBOARD);
  var records = ss.getSheetByName(BS.RECORDS);
  if (!dashboard || !records) throw new Error('Dashboard and records sheets must exist before building summaries.');

  bsSetHeaders_(dashboard, BH.DASHBOARD);
  bsClearDataBelowHeader_(dashboard);

  var units = readUnits_(ss);
  var sections = readSections_(ss);
  var unitById = {};
  var unitByName = {};
  units.forEach(function(unit) {
    if (unit.id) unitById[unit.id] = unit;
    unitByName[unit.name] = unit;
  });

  var rMap = bsGetHeaderMap_(records);
  var employeeNameCol = columnLetter_(rMap['اسم الموظف']);
  var employeeIdCol = columnLetter_(rMap['الرقم الوظيفي للموظف']);
  var requestedUnitCol = columnLetter_(rMap['وحدة التدوير']);
  var requestedSectionCol = columnLetter_(rMap['قسم التدوير']);
  var startDateCol = columnLetter_(rMap['من تاريخ']);
  var endDateCol = columnLetter_(rMap['إلى تاريخ']);
  var totalHoursCol = columnLetter_(rMap['إجمالي ساعات التدوير']);
  var headApprovalCol = columnLetter_(rMap['حالة موافقة رئيس الوحدة']);
  var approvedStatus = 'موافق عليه من رئيس الوحدة';
  var recordsName = qSheet_(BS.RECORDS);

  var rows = sections.map(function(section, index) {
    var row = index + 2;
    var unit = section.unitId ? unitById[section.unitId] : unitByName[section.unitName];
    if (!unit) unit = unitByName[section.unitName] || { name: section.unitName, headName: '', headEmail: '' };

    var activeCount = '=COUNTIFS(' + recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + ',$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + ',$B' + row + ',' +
      recordsName + '!$' + startDateCol + ':$' + startDateCol + ',"<="&TODAY(),' +
      recordsName + '!$' + endDateCol + ':$' + endDateCol + ',">="&TODAY(),' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + ',"' + approvedStatus + '")';

    var activeEmployeeIds = '=IFERROR(TEXTJOIN(", ",TRUE,FILTER(' +
      recordsName + '!$' + employeeIdCol + ':$' + employeeIdCol + ',' +
      recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + '=$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + '=$B' + row + ',' +
      recordsName + '!$' + startDateCol + ':$' + startDateCol + '<=TODAY(),' +
      recordsName + '!$' + endDateCol + ':$' + endDateCol + '>=TODAY(),' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + '="' + approvedStatus + '")),"")';

    var allNames = '=IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(' +
      recordsName + '!$' + employeeNameCol + ':$' + employeeNameCol + ',' +
      recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + '=$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + '=$B' + row + ',' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + '="' + approvedStatus + '"))),"")';

    var lastRotation = '=IFERROR(MAX(FILTER(' +
      recordsName + '!$' + endDateCol + ':$' + endDateCol + ',' +
      recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + '=$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + '=$B' + row + ',' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + '="' + approvedStatus + '")),"")';

    var status = '=IF(E' + row + '>0,"مشغول / Occupied","متاح / Available")';
    var totalHours = '=IFERROR(SUM(FILTER(' +
      recordsName + '!$' + totalHoursCol + ':$' + totalHoursCol + ',' +
      recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + '=$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + '=$B' + row + ',' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + '="' + approvedStatus + '")),0)';

    return [unit.name, section.name, unit.headName, unit.headEmail, activeCount, activeEmployeeIds, allNames, lastRotation, status, totalHours];
  });

  if (rows.length) dashboard.getRange(2, 1, rows.length, BH.DASHBOARD.length).setValues(rows);
  if (rows.length) dashboard.getRange(2, 8, rows.length, 1).setNumberFormat('dd/MM/yyyy');
  dashboard.getRange(1, 1, Math.max(rows.length + 1, 2), BH.DASHBOARD.length).setWrap(true).setVerticalAlignment('middle');
  applyBasicSheetFormat_(dashboard, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
}
