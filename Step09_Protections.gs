function run09_applyProtections() {
  var ss = openDashboardFromProperties_();
  if (!BOOTSTRAP_CONFIG.PROTECT_SHEETS) {
    return finishStep_('09 Apply Protections', BSTATUS.COMPLETE, 'Sheet protection is disabled in BOOTSTRAP_CONFIG.PROTECT_SHEETS.');
  }
  applySetupProtections_(ss);
  writeSetupSummary_(ss);
  return finishStep_('09 Apply Protections', BSTATUS.COMPLETE, 'Protections were applied. Final status and notes are the editable records columns.');
}

function applySetupProtections_(ss) {
  var editors = getAdminEmails_();
  [BS.DASHBOARD, BS.RECORDS, BS.CHARTS, BS.ADMIN_UNITS, BS.ADMIN_SECTIONS, BS.UNITS, BS.SECTIONS, BS.SETTINGS].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) removeSetupProtections_(sheet);
  });

  protectWholeSheet_(ss.getSheetByName(BS.DASHBOARD), editors, 'SQU Setup Toolkit - Dashboard summary');
  protectWholeSheet_(ss.getSheetByName(BS.CHARTS), editors, 'SQU Setup Toolkit - Charts and KPIs');
  protectWholeSheet_(ss.getSheetByName(BS.ADMIN_UNITS), editors, 'SQU Setup Toolkit - Admin units');
  protectWholeSheet_(ss.getSheetByName(BS.ADMIN_SECTIONS), editors, 'SQU Setup Toolkit - Admin sections');
  protectWholeSheet_(ss.getSheetByName(BS.UNITS), editors, 'SQU Setup Toolkit - Units reference data');
  protectWholeSheet_(ss.getSheetByName(BS.SECTIONS), editors, 'SQU Setup Toolkit - Sections reference data');
  protectWholeSheet_(ss.getSheetByName(BS.SETTINGS), editors, 'SQU Setup Toolkit - Settings');
  bsProtectRecordsSheet_(ss.getSheetByName(BS.RECORDS), editors);

  try { ss.getSheetByName(BS.UNITS).hideSheet(); } catch (ignore) {}
  try { ss.getSheetByName(BS.SECTIONS).hideSheet(); } catch (ignore2) {}
  try { ss.getSheetByName(BS.SETTINGS).hideSheet(); } catch (ignore3) {}
}

function protectWholeSheet_(sheet, editors, description) {
  if (!sheet) return;
  var protection = sheet.protect();
  protection.setDescription(description);
  configureProtectionEditors_(protection, editors);
}

function bsProtectRecordsSheet_(sheet, editors) {
  if (!sheet) return;
  var map = bsGetHeaderMap_(sheet);
  var finalStatusColumn = map['حالة الاعتماد النهائي'];
  var notesColumn = map['ملاحظات'];
  var systemStartColumn = map['رمز الموافقة'];
  var maxRows = Math.max(sheet.getMaxRows(), 1);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var owner = getEffectiveOwnerEmail_();
  var systemEditors = owner ? [owner] : editors;

  if (systemStartColumn) {
    try { sheet.hideColumns(systemStartColumn, lastColumn - systemStartColumn + 1); } catch (ignore) {}
  }

  protectRange_(sheet.getRange(1, 1, 1, lastColumn), systemEditors, 'SQU Setup Toolkit - Records headers');

  var editableColumns = [finalStatusColumn, notesColumn].filter(Boolean).sort(function(a, b) { return a - b; });
  var startColumn = 1;
  editableColumns.forEach(function(column) {
    if (column > startColumn) {
      protectRange_(sheet.getRange(2, startColumn, Math.max(maxRows - 1, 1), column - startColumn), systemEditors, 'SQU Setup Toolkit - Records protected columns');
    }
    startColumn = column + 1;
  });
  if (startColumn <= lastColumn) {
    protectRange_(sheet.getRange(2, startColumn, Math.max(maxRows - 1, 1), lastColumn - startColumn + 1), systemEditors, 'SQU Setup Toolkit - Records protected columns');
  }

  if (finalStatusColumn) protectRange_(sheet.getRange(2, finalStatusColumn, Math.max(maxRows - 1, 1), 1), editors, 'SQU Setup Toolkit - Editable final status');
  if (notesColumn) protectRange_(sheet.getRange(2, notesColumn, Math.max(maxRows - 1, 1), 1), editors, 'SQU Setup Toolkit - Editable notes');
}

function protectRange_(range, editors, description) {
  var protection = range.protect();
  protection.setDescription(description);
  configureProtectionEditors_(protection, editors);
}
