/** One-time and maintenance setup. */
function setupAllSystem() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setupSheets();
    setupFormStructure();
    setupResponseQueueSheet_();
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
  syncReferenceDataFromAdminSheets_({ forceFormat: true });
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
  var adminUnits = ensureSheet_(ss, SHEETS.ADMIN_UNITS);
  setSheetHeaders_(adminUnits, UNIT_HEADERS);
  var adminSections = ensureSheet_(ss, SHEETS.ADMIN_SECTIONS);
  setSheetHeaders_(adminSections, SECTION_HEADERS);

  var units = ensureSheet_(ss, SHEETS.UNITS);
  setSheetHeaders_(units, UNIT_HEADERS);
  if (adminUnits.getLastRow() < 2 && units.getLastRow() >= 2) {
    clearAndWriteObjects_(adminUnits, UNIT_HEADERS, getDataObjects_(units));
  }
  if (adminUnits.getLastRow() < 2) {
    adminUnits.getRange(2, 1, 2, UNIT_HEADERS.length).setValues([
      ['المكتبة الرئيسية', 'المكتبة الرئيسية', 'الدكتور حمد بن محمد بن سالم العزري', 'مدير المكتبة الرئيسية', '', 'نعم'],
      ['دائرة الإسكان', 'دائرة الإسكان', 'الفاضل محمد بن علي بن حمد النحوي', 'مدير دائرة الإسكان', '', 'نعم']
    ]);
  }

  var sections = ensureSheet_(ss, SHEETS.SECTIONS);
  setSheetHeaders_(sections, SECTION_HEADERS);
  if (adminSections.getLastRow() < 2 && sections.getLastRow() >= 2) {
    clearAndWriteObjects_(adminSections, SECTION_HEADERS, getDataObjects_(sections));
  }
  if (adminSections.getLastRow() < 2) {
    adminSections.getRange(2, 1, 3, SECTION_HEADERS.length).setValues([
      ['المكتبة الرئيسية-ادارة المكتبة الرئيسية', 'المكتبة الرئيسية', 'المكتبة الرئيسية', 'ادارة المكتبة الرئيسية', 'نعم', 1],
      ['المكتبة الرئيسية-الاعارة', 'المكتبة الرئيسية', 'المكتبة الرئيسية', 'الاعارة', 'نعم', 1],
      ['دائرة الإسكان-دائرة الإسكان', 'دائرة الإسكان', 'دائرة الإسكان', 'دائرة الإسكان', 'نعم', 1]
    ]);
  }
  applyCleanTableFormatting_(adminUnits, UNIT_HEADERS.length);
  applyCleanTableFormatting_(adminSections, SECTION_HEADERS.length);
  applyCleanTableFormatting_(units, UNIT_HEADERS.length);
  applyCleanTableFormatting_(sections, SECTION_HEADERS.length);
  try { units.hideSheet(); sections.hideSheet(); } catch (ignore) {}
}

function ensureSystemSheets_(ss) {
  var log = ensureSheet_(ss, SHEETS.LOG);
  setSheetHeaders_(log, LOG_HEADERS);
  var queue = ensureSheet_(ss, SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(queue, QUEUE_HEADERS);
  var actionQueue = ensureSheet_(ss, SHEETS.ACTION_QUEUE);
  setSheetHeaders_(actionQueue, ACTION_QUEUE_HEADERS);
  try { log.hideSheet(); queue.hideSheet(); actionQueue.hideSheet(); } catch (ignore) {}
}

function setupAllFromMenu() {
  setupAllSystem();
  SpreadsheetApp.getActive().toast('تم إعداد النظام بنجاح / System setup completed.');
}


function setupResponseQueueSheet_() {
  var cfg = getConfig();
  if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
    warnIfResponseQueueMissing_();
    return false;
  }

  var ss = SpreadsheetApp.openById(cfg.FORM_RESPONSES_SPREADSHEET_ID);
  var sheet = findFormResponsesSheet_(ss);
  if (!sheet) {
    throw new Error('Could not find a Google Form responses sheet in FORM_RESPONSES_SPREADSHEET_ID.');
  }

  ensureResponseQueueColumns_(sheet);
  logInfo_('setupResponseQueueSheet_', '', 'Response queue sheet verified: ' + sheet.getName());
  return true;
}

function warnIfResponseQueueMissing_() {
  var cfg = getConfig();
  if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
    logWarn_(
      'setupResponseQueueSheet_',
      '',
      'FORM_RESPONSES_SPREADSHEET_ID is not configured; response queue columns could not be verified.'
    );
  }
}
