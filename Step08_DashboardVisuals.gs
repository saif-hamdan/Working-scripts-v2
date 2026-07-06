function run08_buildDashboardSummaryAndCharts() {
  var ss = openDashboardFromProperties_();
  syncAdminReferenceData_(ss);
  refreshDashboardSectionSummary_(ss);
  buildChartsAndKpis_(ss);
  writeSetupSummary_(ss);
  return finishStep_('08 Build Dashboard Summary And Charts', BSTATUS.COMPLETE, 'Dashboard summary, KPIs, and charts were refreshed.');
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
  var employeeNameCol = columnLetter_(rMap['اسم الموظف الجديد']);
  var requestedUnitCol = columnLetter_(rMap['وحدة التدريب المطلوبة']);
  var requestedSectionCol = columnLetter_(rMap['القسم المطلوب']);
  var startDateCol = columnLetter_(rMap['من تاريخ']);
  var endDateCol = columnLetter_(rMap['إلى تاريخ']);
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

    var activeNames = '=IFERROR(TEXTJOIN(", ",TRUE,FILTER(' +
      recordsName + '!$' + employeeNameCol + ':$' + employeeNameCol + ',' +
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

    var lastTraining = '=IFERROR(MAX(FILTER(' +
      recordsName + '!$' + endDateCol + ':$' + endDateCol + ',' +
      recordsName + '!$' + requestedUnitCol + ':$' + requestedUnitCol + '=$A' + row + ',' +
      recordsName + '!$' + requestedSectionCol + ':$' + requestedSectionCol + '=$B' + row + ',' +
      recordsName + '!$' + headApprovalCol + ':$' + headApprovalCol + '="' + approvedStatus + '")),"")';

    var status = '=IF(E' + row + '>0,"مشغول / Occupied","متاح / Available")';

    return [unit.name, section.name, unit.headName, unit.headEmail, activeCount, activeNames, allNames, lastTraining, status];
  });

  if (rows.length) dashboard.getRange(2, 1, rows.length, BH.DASHBOARD.length).setValues(rows);
  dashboard.getRange(1, 1, Math.max(rows.length + 1, 2), BH.DASHBOARD.length).setWrap(true).setVerticalAlignment('middle');
  applyBasicSheetFormat_(dashboard, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
}

function buildChartsAndKpis_(ss) {
  var charts = ss.getSheetByName(BS.CHARTS);
  var dashboard = ss.getSheetByName(BS.DASHBOARD);
  var records = ss.getSheetByName(BS.RECORDS);
  if (!charts || !dashboard || !records) throw new Error('Dashboard, records, and charts sheets are required.');

  bsSetHeaders_(charts, ['المؤشر', 'القيمة']);
  bsClearDataBelowHeader_(charts);
  charts.getCharts().forEach(function(chart) {
    charts.removeChart(chart);
  });

  var dMap = bsGetHeaderMap_(dashboard);
  var rMap = bsGetHeaderMap_(records);
  var dashboardName = qSheet_(BS.DASHBOARD);
  var recordsName = qSheet_(BS.RECORDS);
  var sectionStatusCol = columnLetter_(dMap['حالة القسم']);
  var requestIdCol = columnLetter_(rMap['رقم الطلب']);
  var headApprovalCol = columnLetter_(rMap['حالة موافقة رئيس الوحدة']);
  var finalStatusCol = columnLetter_(rMap['حالة الاعتماد النهائي']);
  var evaluationSentCol = columnLetter_(rMap['تم إرسال التقييم']);

  var rows = [
    ['إجمالي الأقسام / Total Sections', '=COUNTA(' + dashboardName + '!B2:B)'],
    ['الأقسام المشغولة / Occupied Sections', '=COUNTIF(' + dashboardName + '!$' + sectionStatusCol + '2:$' + sectionStatusCol + ',"مشغول*")'],
    ['الأقسام المتاحة / Available Sections', '=COUNTIF(' + dashboardName + '!$' + sectionStatusCol + '2:$' + sectionStatusCol + ',"متاح*")'],
    ['إجمالي الطلبات / Total Requests', '=COUNTA(' + recordsName + '!$' + requestIdCol + '2:$' + requestIdCol + ')'],
    ['بانتظار الموافقة / Pending Approval', '=COUNTIF(' + recordsName + '!$' + headApprovalCol + '2:$' + headApprovalCol + ',"بانتظار موافقة رئيس الوحدة")'],
    ['موافق عليه من رئيس الوحدة / Approved By Head', '=COUNTIF(' + recordsName + '!$' + headApprovalCol + '2:$' + headApprovalCol + ',"موافق عليه من رئيس الوحدة")'],
    ['مرفوض من رئيس الوحدة / Rejected By Head', '=COUNTIF(' + recordsName + '!$' + headApprovalCol + '2:$' + headApprovalCol + ',"مرفوض من رئيس الوحدة")'],
    ['منجز / Completed', '=COUNTIF(' + recordsName + '!$' + finalStatusCol + '2:$' + finalStatusCol + ',"منجز")'],
    ['تم إرسال التقييم / Evaluation Sent', '=COUNTIF(' + recordsName + '!$' + evaluationSentCol + '2:$' + evaluationSentCol + ',"نعم")']
  ];

  charts.getRange(2, 1, rows.length, 2).setValues(rows);
  charts.getRange(1, 1, rows.length + 1, 2).setFontSize(11).setVerticalAlignment('middle');
  charts.getRange(1, 1, 1, 2).setBackground(BOOTSTRAP_CONFIG.BRAND_PRIMARY_COLOR).setFontColor('#FFFFFF').setFontWeight('bold');
  charts.getRange(2, 1, rows.length, 1).setFontWeight('bold');
  charts.getRange(2, 2, rows.length, 1).setHorizontalAlignment('center');
  charts.setRowHeights(1, rows.length + 1, 30);
  applyBasicSheetFormat_(charts, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);

  var statusChart = charts.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(charts.getRange(3, 1, 2, 2))
    .setPosition(2, 4, 0, 0)
    .setOption('title', 'حالة الأقسام / Section Status')
    .setOption('colors', [BOOTSTRAP_CONFIG.BRAND_SECONDARY_COLOR, BOOTSTRAP_CONFIG.BRAND_PRIMARY_COLOR])
    .setOption('legend', { position: 'right' })
    .build();
  charts.insertChart(statusChart);

  var approvalsChart = charts.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(charts.getRange(6, 1, 3, 2))
    .setPosition(18, 4, 0, 0)
    .setOption('title', 'حالة موافقات رئيس الوحدة / Unit Head Approval Status')
    .setOption('colors', [BOOTSTRAP_CONFIG.BRAND_PRIMARY_COLOR])
    .setOption('legend', { position: 'none' })
    .build();
  charts.insertChart(approvalsChart);
}
