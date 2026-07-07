function run14_repairExistingResourcesFromLatestScript() {
  run01_createOrOpenResources();

  var ss = openDashboardFromProperties_();
  var mainForm = openMainFormFromProperties_();
  var evaluationForm = openEvaluationFormFromProperties_();

  repairBootstrapSheetSchema_(ss, BS.DASHBOARD, BH.DASHBOARD);
  repairBootstrapSheetSchema_(ss, BS.RECORDS, BH.RECORDS);
  repairBootstrapSheetSchema_(ss, BS.ADMIN_UNITS, BH.UNITS);
  repairBootstrapSheetSchema_(ss, BS.ADMIN_SECTIONS, BH.SECTIONS);
  repairBootstrapSheetSchema_(ss, BS.UNITS, BH.UNITS);
  repairBootstrapSheetSchema_(ss, BS.SECTIONS, BH.SECTIONS);
  repairBootstrapSheetSchema_(ss, BS.SETTINGS, BH.SETTINGS);

  ensureAdminReferenceSheets_(ss);
  seedReferenceData_(ss);
  syncAdminReferenceData_(ss);
  writeSettings_(ss, mainForm, evaluationForm);

  rebuildMainFormBase_(mainForm, ss);
  rebuildEvaluationForm_(evaluationForm);
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: '0',
    [BSPROP.BRANCH_COMPLETE]: 'false',
    [BSPROP.VALIDATION_STATUS]: '',
    [BSPROP.PRODUCTION_COMPATIBILITY_STATUS]: '',
    [BSPROP.READY]: 'false'
  });

  [BS.DASHBOARD, BS.RECORDS, BS.ADMIN_UNITS, BS.ADMIN_SECTIONS, BS.UNITS, BS.SECTIONS, BS.SETTINGS].forEach(function(name) {
    applyBasicSheetFormat_(ss.getSheetByName(name), BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  });
  applyReferenceAdminFormatting_(ss);
  try { ss.getSheetByName(BS.UNITS).hideSheet(); } catch (ignore) {}
  try { ss.getSheetByName(BS.SECTIONS).hideSheet(); } catch (ignore2) {}
  try { ss.getSheetByName(BS.SETTINGS).hideSheet(); } catch (ignore3) {}

  writeSetupSummary_(ss, mainForm, evaluationForm);
  return finishStep_('14 Repair Existing Resources From Latest Script', BSTATUS.IN_PROGRESS, 'Existing dashboard sheets and forms were repaired from the latest script without creating a fresh resource set. Run run03_validateReferenceData(), then run05_startMainFormBranching() and repeat run06_continueMainFormBranching() until branching is complete.');
}

function repairBootstrapSheetSchema_(ss, sheetName, headers) {
  var sheet = bsEnsureSheet_(ss, sheetName);
  var rows = readBootstrapRowsByHeader_(sheet);
  sheet.clear();
  bsSetHeaders_(sheet, headers);
  if (rows.length) {
    var output = rows.map(function(row) {
      return headers.map(function(header) {
        return row[header] === undefined ? '' : row[header];
      });
    });
    sheet.getRange(2, 1, output.length, headers.length).setValues(output);
  }
  return sheet;
}

function readBootstrapRowsByHeader_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  return rows.map(function(row) {
    var obj = {};
    var hasValue = false;
    headers.forEach(function(header, index) {
      if (!header) return;
      obj[header] = row[index];
      if (row[index] !== '' && row[index] !== null) hasValue = true;
    });
    return hasValue ? obj : null;
  }).filter(Boolean);
}
