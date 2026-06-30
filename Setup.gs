/** One-time and maintenance setup. */
function setupAllSystem() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupSheets();
    setupFormStructure();
    setupValidations();
    protectDashboardSheets();
    refreshDashboard();
    refreshCharts();
    refreshFormChoices();
    installTriggers();
    logInfo_('setupAllSystem', '', 'Setup completed successfully.');
  } catch (err) {
    logError_('setupAllSystem', '', err);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function setupSheets() {
  var ss = openDashboardSpreadsheet_();
  ensureMainSheets_(ss);
  writeSettingsFromConfig_(ss);
  ensureReferenceSheets_(ss);
  ensureSystemSheets_(ss);
}

function ensureMainSheets_(ss) {
  setSheetHeaders_(ensureSheet_(ss, SHEETS.DASHBOARD), DASHBOARD_HEADERS);
  setSheetHeaders_(ensureSheet_(ss, SHEETS.RECORDS), RECORD_HEADERS);
  setSheetHeaders_(ensureSheet_(ss, SHEETS.CHARTS), ['المؤشر', 'القيمة']);
  applyCleanTableFormatting_(ss.getSheetByName(SHEETS.DASHBOARD), DASHBOARD_HEADERS.length);
  applyCleanTableFormatting_(ss.getSheetByName(SHEETS.RECORDS), RECORD_HEADERS.length);
  hideInternalColumns_(ss.getSheetByName(SHEETS.RECORDS));
}

function ensureReferenceSheets_(ss) {
  var units = ensureSheet_(ss, SHEETS.UNITS);
  setSheetHeaders_(units, UNIT_HEADERS);
  if (units.getLastRow() < 2) {
    units.getRange(2, 1, 2, UNIT_HEADERS.length).setValues([
      ['UNIT-001', 'مثال وحدة 1', 'اسم رئيس الوحدة', 'unit.head@example.com', 'نعم'],
      ['UNIT-002', 'مثال وحدة 2', 'اسم رئيس الوحدة', 'unit2.head@example.com', 'نعم']
    ]);
  }
  var sections = ensureSheet_(ss, SHEETS.SECTIONS);
  setSheetHeaders_(sections, SECTION_HEADERS);
  if (sections.getLastRow() < 2) {
    sections.getRange(2, 1, 3, SECTION_HEADERS.length).setValues([
      ['SEC-001', 'UNIT-001', 'مثال وحدة 1', 'قسم مثال 1', 'نعم', 1],
      ['SEC-002', 'UNIT-001', 'مثال وحدة 1', 'قسم مثال 2', 'نعم', 1],
      ['SEC-003', 'UNIT-002', 'مثال وحدة 2', 'قسم مثال 3', 'نعم', 1]
    ]);
  }
  applyCleanTableFormatting_(units, UNIT_HEADERS.length);
  applyCleanTableFormatting_(sections, SECTION_HEADERS.length);
  try { units.hideSheet(); sections.hideSheet(); } catch (ignore) {}
}

function ensureSystemSheets_(ss) {
  var log = ensureSheet_(ss, SHEETS.LOG);
  setSheetHeaders_(log, LOG_HEADERS);
  var queue = ensureSheet_(ss, SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(queue, QUEUE_HEADERS);
  try { log.hideSheet(); queue.hideSheet(); } catch (ignore) {}
}

function setupAllFromMenu() {
  setupAllSystem();
  SpreadsheetApp.getActive().toast('تم إعداد النظام بنجاح / System setup completed.');
}
