function run02_setupDashboardSheets() {
  var ss = openDashboardFromProperties_();
  var mainForm = tryOpenMainForm_();
  var evaluationForm = tryOpenEvaluationForm_();
  setupDashboardSheetsStaged_(ss, mainForm, evaluationForm);
  writeSetupSummary_(ss, mainForm, evaluationForm);
  return finishStep_('02 Setup Dashboard Sheets', BSTATUS.COMPLETE, 'Dashboard sheets, headers, settings, and dummy reference rows are ready.');
}

function run02_loadDummyReferenceData() {
  var ss = openDashboardFromProperties_();
  ensureAdminReferenceSheets_(ss);
  writeDummyReferenceData_(ss);
  applyReferenceAdminFormatting_(ss);
  writeSetupSummary_(ss);
  return finishStep_('02 Load Dummy Reference Data', BSTATUS.COMPLETE, 'Dummy units and sections were loaded into the Google Sheet tabs.');
}

function setupDashboardSheetsStaged_(ss, mainForm, evaluationForm) {
  bsSetHeaders_(bsEnsureSheet_(ss, BS.DASHBOARD), BH.DASHBOARD);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.RECORDS), BH.RECORDS);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.CHARTS), ['المؤشر', 'القيمة']);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.ADMIN_UNITS), BH.UNITS);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.ADMIN_SECTIONS), BH.SECTIONS);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.UNITS), BH.UNITS);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.SECTIONS), BH.SECTIONS);
  bsSetHeaders_(bsEnsureSheet_(ss, BS.SETTINGS), BH.SETTINGS);

  ensureAdminReferenceSheets_(ss);
  seedReferenceData_(ss);
  syncAdminReferenceData_(ss);
  writeSettings_(ss, mainForm, evaluationForm);

  [BS.DASHBOARD, BS.RECORDS, BS.CHARTS, BS.ADMIN_UNITS, BS.ADMIN_SECTIONS, BS.UNITS, BS.SECTIONS, BS.SETTINGS].forEach(function(name) {
    applyBasicSheetFormat_(ss.getSheetByName(name), BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  });
  applyReferenceAdminFormatting_(ss);

  moveSheetTo_(ss, BS.DASHBOARD, 1);
  moveSheetTo_(ss, BS.RECORDS, 2);
  moveSheetTo_(ss, BS.CHARTS, 3);
  moveSheetTo_(ss, BS.ADMIN_UNITS, 4);
  moveSheetTo_(ss, BS.ADMIN_SECTIONS, 5);

  try { ss.getSheetByName(BS.UNITS).hideSheet(); } catch (ignore) {}
  try { ss.getSheetByName(BS.SECTIONS).hideSheet(); } catch (ignore2) {}
  try { ss.getSheetByName(BS.SETTINGS).hideSheet(); } catch (ignore3) {}
}

function seedReferenceData_(ss) {
  var units = ss.getSheetByName(BS.ADMIN_UNITS);
  var sections = ss.getSheetByName(BS.ADMIN_SECTIONS);
  if (shouldSeedDummyReference_(units, sections)) {
    writeDummyReferenceData_(ss);
  }
}

function shouldSeedDummyReference_(unitsSheet, sectionsSheet) {
  if (unitsSheet.getLastRow() < 2 || sectionsSheet.getLastRow() < 2) return true;
  var unitsPreview = unitsSheet.getRange(2, 1, Math.min(unitsSheet.getLastRow() - 1, 5), BH.UNITS.length).getValues();
  var sectionsPreview = sectionsSheet.getRange(2, 1, Math.min(sectionsSheet.getLastRow() - 1, 5), BH.SECTIONS.length).getValues();
  var hasOldSampleUnit = unitsPreview.some(function(row) { return String(row[1] || '').indexOf('مثال وحدة') !== -1; });
  var hasOldSampleSection = sectionsPreview.some(function(row) { return String(row[3] || '').indexOf('قسم مثال') !== -1; });
  return hasOldSampleUnit || hasOldSampleSection;
}

function writeDummyReferenceData_(ss) {
  ensureAdminReferenceSheets_(ss);
  var units = ss.getSheetByName(BS.ADMIN_UNITS);
  var sections = ss.getSheetByName(BS.ADMIN_SECTIONS);
  bsClearDataBelowHeader_(units);
  bsClearDataBelowHeader_(sections);

  var unitRows = getDummyUnitRows_();
  var sectionRows = getDummySectionRows_();
  units.getRange(2, 1, unitRows.length, BH.UNITS.length).setValues(unitRows);
  sections.getRange(2, 1, sectionRows.length, BH.SECTIONS.length).setValues(sectionRows);
  syncAdminReferenceData_(ss);
}
