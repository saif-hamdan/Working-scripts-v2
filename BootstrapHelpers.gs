function bsEnsureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function bsSetHeaders_(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function getBootstrapProps_() {
  return PropertiesService.getScriptProperties();
}

function setBootstrapProperties_(values) {
  var props = getBootstrapProps_();
  Object.keys(values).forEach(function(key) {
    if (values[key] === null || typeof values[key] === 'undefined') {
      props.deleteProperty(key);
    } else {
      props.setProperty(key, String(values[key]));
    }
  });
}

function getBootstrapProperty_(key, fallback) {
  var value = getBootstrapProps_().getProperty(key);
  return value === null || typeof value === 'undefined' ? fallback : value;
}

function finishStep_(step, status, message) {
  setBootstrapProperties_({
    [BSPROP.LAST_STEP]: step,
    [BSPROP.LAST_STATUS]: status,
    [BSPROP.LAST_MESSAGE]: message || '',
    [BSPROP.LAST_UPDATED]: new Date().toISOString()
  });
  try {
    var ss = openDashboardFromProperties_();
    writeSetupSummary_(ss);
  } catch (err) {
    Logger.log('Setup Summary refresh skipped: ' + err.message);
  }
  Logger.log(step + ': ' + status + (message ? ' - ' + message : ''));
  return message || status;
}

function failStep_(step, message) {
  finishStep_(step, BSTATUS.FAILED, message);
  throw new Error(message);
}

function openDashboardFromProperties_() {
  var id = getBootstrapProperty_(BSPROP.DASHBOARD_ID, '');
  if (!id) throw new Error('Dashboard spreadsheet ID is missing. Run run01_createOrOpenResources() first.');
  return SpreadsheetApp.openById(id);
}

function openMainFormFromProperties_() {
  var id = getBootstrapProperty_(BSPROP.MAIN_FORM_ID, '');
  if (!id) throw new Error('Main form ID is missing. Run run01_createOrOpenResources() first.');
  return FormApp.openById(id);
}

function openEvaluationFormFromProperties_() {
  var id = getBootstrapProperty_(BSPROP.EVALUATION_FORM_ID, '');
  if (!id) throw new Error('Evaluation form ID is missing. Run run01_createOrOpenResources() first.');
  return FormApp.openById(id);
}

function getEffectiveOwnerEmail_() {
  return BOOTSTRAP_CONFIG.OWNER_EMAIL || safeUserEmail_();
}

function getAdminEmails_() {
  var owner = getEffectiveOwnerEmail_();
  var raw = BOOTSTRAP_CONFIG.ADMIN_EMAILS || owner;
  var emails = raw.split(',').map(function(email) { return email.trim(); }).filter(Boolean);
  if (owner && emails.indexOf(owner) === -1) emails.push(owner);
  return emails;
}

function safeUserEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

function isActiveValue_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  return ['لا', 'no', 'false', 'inactive', 'غير نشط', '0'].indexOf(text) === -1;
}

function readUnits_(ss, options) {
  options = options || {};
  var sheet = ss.getSheetByName(BS.UNITS);
  if (!sheet) return [];
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BH.UNITS.length).getValues() : [];
  return rows.filter(function(row) {
    return row[1] && (options.includeInactive || isActiveValue_(row[5]));
  }).map(function(row) {
    return {
      id: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      headName: String(row[2] || '').trim(),
      headTitle: String(row[3] || '').trim(),
      headEmail: String(row[4] || '').trim(),
      active: isActiveValue_(row[5])
    };
  });
}

function readSections_(ss, options) {
  options = options || {};
  var sheet = ss.getSheetByName(BS.SECTIONS);
  if (!sheet) return [];
  var rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, BH.SECTIONS.length).getValues() : [];
  return rows.filter(function(row) {
    return row[2] && row[3] && (options.includeInactive || isActiveValue_(row[4]));
  }).map(function(row) {
    return {
      id: String(row[0] || '').trim(),
      unitId: String(row[1] || '').trim(),
      unitName: String(row[2] || '').trim(),
      name: String(row[3] || '').trim(),
      active: isActiveValue_(row[4]),
      capacity: Number(row[5] || 1) || 1
    };
  });
}

function bsGetHeaderMap_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (!lastColumn) return {};
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var map = {};
  headers.forEach(function(header, index) {
    if (header) map[String(header).trim()] = index + 1;
  });
  return map;
}

function getColumnIndexByHeader_(sheet, header) {
  var map = bsGetHeaderMap_(sheet);
  if (!map[header]) throw new Error('Missing required header "' + header + '" in sheet "' + sheet.getName() + '".');
  return map[header];
}

function columnLetter_(column) {
  var letter = '';
  while (column > 0) {
    var modulo = (column - 1) % 26;
    letter = String.fromCharCode(65 + modulo) + letter;
    column = Math.floor((column - modulo) / 26);
  }
  return letter;
}

function qSheet_(name) {
  return "'" + String(name).replace(/'/g, "''") + "'";
}

function applyBasicSheetFormat_(sheet, headerColor) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  try { sheet.setRightToLeft(true); } catch (ignore) {}
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastColumn)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground(headerColor || BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  for (var column = 1; column <= lastColumn; column++) {
    try { sheet.autoResizeColumn(column); } catch (ignore2) {}
  }
}

function moveSheetTo_(ss, sheetName, position) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  try {
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(position);
  } catch (ignore) {}
}

function bsClearDataBelowHeader_(sheet) {
  var rows = sheet.getMaxRows() - 1;
  var columns = sheet.getMaxColumns();
  if (rows > 0 && columns > 0) sheet.getRange(2, 1, rows, columns).clearContent();
}

function getDataRows_(sheet, columnCount) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues()
    .filter(function(row) {
      return row.some(function(value) { return String(value || '').trim() !== ''; });
    });
}

function ensureAdminReferenceSheets_(ss) {
  var adminUnits = bsEnsureSheet_(ss, BS.ADMIN_UNITS);
  var adminSections = bsEnsureSheet_(ss, BS.ADMIN_SECTIONS);
  var systemUnits = bsEnsureSheet_(ss, BS.UNITS);
  var systemSections = bsEnsureSheet_(ss, BS.SECTIONS);

  bsSetHeaders_(adminUnits, BH.UNITS);
  bsSetHeaders_(adminSections, BH.SECTIONS);
  bsSetHeaders_(systemUnits, BH.UNITS);
  bsSetHeaders_(systemSections, BH.SECTIONS);

  copySystemReferenceToAdminIfNeeded_(adminUnits, systemUnits, BH.UNITS.length);
  copySystemReferenceToAdminIfNeeded_(adminSections, systemSections, BH.SECTIONS.length);
  applyReferenceAdminFormatting_(ss);
}

function copySystemReferenceToAdminIfNeeded_(adminSheet, systemSheet, columnCount) {
  if (adminSheet.getLastRow() > 1 || systemSheet.getLastRow() < 2) return;
  var rows = getDataRows_(systemSheet, columnCount);
  if (rows.length) adminSheet.getRange(2, 1, rows.length, columnCount).setValues(rows);
}

function applyReferenceAdminFormatting_(ss) {
  var adminUnits = ss.getSheetByName(BS.ADMIN_UNITS);
  var adminSections = ss.getSheetByName(BS.ADMIN_SECTIONS);
  if (adminUnits) {
    applyBasicSheetFormat_(adminUnits, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
    clearColumnValidationByHeader_(adminUnits, BH.UNITS, 'بريد رئيس الوحدة');
    applyYesNoValidationByHeader_(adminUnits, BH.UNITS, 'نشط');
  }
  if (adminSections) {
    applyBasicSheetFormat_(adminSections, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
    applyYesNoValidationByHeader_(adminSections, BH.SECTIONS, 'نشط');
    applyUnitIdValidation_(ss, adminSections);
  }
}

function applyYesNoValidationByHeader_(sheet, headers, header) {
  var column = headers.indexOf(header) + 1;
  if (!column) throw new Error('Missing validation header "' + header + '".');
  applyYesNoValidation_(sheet, column);
}

function clearColumnValidationByHeader_(sheet, headers, header) {
  var column = headers.indexOf(header) + 1;
  if (!column) return;
  sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).clearDataValidations();
}

function applyYesNoValidation_(sheet, column) {
  var range = sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['نعم', 'لا'], true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function applyUnitIdValidation_(ss, sectionsSheet) {
  var unitsSheet = ss.getSheetByName(BS.ADMIN_UNITS);
  if (!unitsSheet || unitsSheet.getLastRow() < 2) return;
  var sourceRange = unitsSheet.getRange(2, 1, Math.max(unitsSheet.getMaxRows() - 1, 1), 1);
  var targetRange = sectionsSheet.getRange(2, 2, Math.max(sectionsSheet.getMaxRows() - 1, 1), 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sourceRange, true)
    .setAllowInvalid(false)
    .build();
  targetRange.setDataValidation(rule);
}

function syncAdminReferenceData_(ss) {
  ensureAdminReferenceSheets_(ss);
  var adminUnits = ss.getSheetByName(BS.ADMIN_UNITS);
  var adminSections = ss.getSheetByName(BS.ADMIN_SECTIONS);
  var systemUnits = ss.getSheetByName(BS.UNITS);
  var systemSections = ss.getSheetByName(BS.SECTIONS);

  var unitRows = getDataRows_(adminUnits, BH.UNITS.length).filter(function(row) { return row[1]; });
  var sectionRows = cascadeInactiveUnitSections_(
    getDataRows_(adminSections, BH.SECTIONS.length).filter(function(row) { return row[2] && row[3]; }),
    unitRows
  );

  bsClearDataBelowHeader_(systemUnits);
  bsClearDataBelowHeader_(systemSections);
  if (unitRows.length) systemUnits.getRange(2, 1, unitRows.length, BH.UNITS.length).setValues(unitRows);
  if (sectionRows.length) systemSections.getRange(2, 1, sectionRows.length, BH.SECTIONS.length).setValues(sectionRows);

  applyBasicSheetFormat_(systemUnits, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  applyBasicSheetFormat_(systemSections, BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  try { systemUnits.hideSheet(); } catch (ignore) {}
  try { systemSections.hideSheet(); } catch (ignore2) {}

  var hash = hashReferenceRows_(unitRows, sectionRows);
  setBootstrapProperties_({
    [BSPROP.REFERENCE_DATA_HASH]: hash,
    [BSPROP.LAST_REFERENCE_SYNC]: new Date().toISOString()
  });
  return { unitCount: unitRows.length, sectionCount: sectionRows.length, hash: hash };
}

function cascadeInactiveUnitSections_(sectionRows, unitRows) {
  var unitById = {};
  var unitByName = {};
  var activeUnitById = {};
  var activeUnitByName = {};
  (unitRows || []).forEach(function(row) {
    var id = String(row[0] || '').trim();
    var name = String(row[1] || '').trim();
    if (id) unitById[id] = true;
    if (name) unitByName[name] = true;
    if (!isActiveValue_(row[5])) return;
    if (id) activeUnitById[id] = true;
    if (name) activeUnitByName[name] = true;
  });

  return (sectionRows || []).map(function(row) {
    var copy = row.slice();
    var unitId = String(copy[1] || '').trim();
    var unitName = String(copy[2] || '').trim();
    var hasUnit = (unitId && unitById[unitId]) || (unitName && unitByName[unitName]);
    var hasActiveUnit = (unitId && activeUnitById[unitId]) || (unitName && activeUnitByName[unitName]);
    if (hasUnit && !hasActiveUnit) copy[4] = 'لا';
    return copy;
  });
}

function hashReferenceRows_(unitRows, sectionRows) {
  var payload = JSON.stringify({ units: unitRows, sections: sectionRows });
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return digest.map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function writeSettings_(ss, mainForm, evaluationForm) {
  var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
  var sheet = ss.getSheetByName(settingsSheetName) || bsEnsureSheet_(ss, settingsSheetName);
  bsSetHeaders_(sheet, BH.SETTINGS);

  var owner = getEffectiveOwnerEmail_();
  var admins = BOOTSTRAP_CONFIG.ADMIN_EMAILS || owner;
  var values = {};
  values[SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID] = ss.getId();
  values[SETTINGS_KEYS.MAIN_FORM_ID] = mainForm ? mainForm.getId() : getBootstrapProperty_(BSPROP.MAIN_FORM_ID, '');
  values[SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID] = mainForm
    ? ensureMainFormResponseDestination_(mainForm, ss)
    : getMainFormResponsesSpreadsheetId_(mainForm);
  values[SETTINGS_KEYS.RESPONSE_QUEUE_MAX_RETRIES] = '3';
  values[SETTINGS_KEYS.ACTION_QUEUE_MAX_RETRIES] = '3';
  values[SETTINGS_KEYS.EVALUATION_FORM_URL] = evaluationForm ? evaluationForm.getPublishedUrl() : getBootstrapProperty_(BSPROP.EVALUATION_FORM_PUBLISHED_URL, '');
  values[SETTINGS_KEYS.WEB_APP_URL] = 'PASTE_WEB_APP_URL_AFTER_DEPLOYMENT';
  values[SETTINGS_KEYS.OWNER_EMAIL] = owner;
  values[SETTINGS_KEYS.ADMIN_EMAILS] = admins;
  values[SETTINGS_KEYS.APPROVER_UNIT_MODE] = BOOTSTRAP_CONFIG.APPROVER_UNIT_MODE;
  values[SETTINGS_KEYS.EMAIL_SENDER_NAME] = BOOTSTRAP_CONFIG.EMAIL_SENDER_NAME;
  values[SETTINGS_KEYS.ORGANIZATION_NAME_AR] = BOOTSTRAP_CONFIG.ORGANIZATION_NAME_AR;
  values[SETTINGS_KEYS.ORGANIZATION_NAME_EN] = BOOTSTRAP_CONFIG.ORGANIZATION_NAME_EN;
  values[SETTINGS_KEYS.BRAND_PRIMARY_COLOR] = BOOTSTRAP_CONFIG.BRAND_PRIMARY_COLOR;
  values[SETTINGS_KEYS.BRAND_SECONDARY_COLOR] = BOOTSTRAP_CONFIG.BRAND_SECONDARY_COLOR;
  values[SETTINGS_KEYS.BRAND_ACCENT_COLOR] = BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR;
  values[SETTINGS_KEYS.BRAND_LOGO_URL] = BOOTSTRAP_CONFIG.BRAND_LOGO_URL;
  values[SETTINGS_KEYS.EVALUATION_ALLOWED_FINAL_STATUSES] = APPROVED_EVALUATION_FINAL_STATUSES.join(',');

  var rows = Object.keys(SETTINGS_KEYS).map(function(name) {
    var key = SETTINGS_KEYS[name];
    return [key, values[key] !== undefined ? values[key] : ''];
  });

  bsClearDataBelowHeader_(sheet);
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

function getMainFormResponsesSpreadsheetId_(mainForm) {
  return getMainFormResponsesSpreadsheetIdFromForm_(mainForm) ||
    getBootstrapProperty_(SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID, '');
}

function ensureMainFormResponseDestination_(mainForm, dashboard) {
  if (!mainForm) return getBootstrapProperty_(SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID, '');

  var responseSpreadsheetId = getConfiguredMainFormResponsesSpreadsheetId_(dashboard, mainForm);
  if (!responseSpreadsheetId && dashboard) responseSpreadsheetId = dashboard.getId();
  if (!responseSpreadsheetId) return '';

  mainForm.setDestination(FormApp.DestinationType.SPREADSHEET, responseSpreadsheetId);
  writeMainFormResponsesSpreadsheetId_(dashboard, responseSpreadsheetId);
  return responseSpreadsheetId;
}

function getConfiguredMainFormResponsesSpreadsheetId_(dashboard, mainForm) {
  var propValue = getBootstrapProps_().getProperty(SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID);
  if (propValue) return propValue;

  if (dashboard) {
    try {
      var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
      var settings = readSettingsRows_(dashboard.getSheetByName(settingsSheetName));
      if (settings[SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID]) {
        return settings[SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID];
      }
    } catch (ignore) {}
  }

  return getMainFormResponsesSpreadsheetIdFromForm_(mainForm);
}

function writeMainFormResponsesSpreadsheetId_(dashboard, responseSpreadsheetId) {
  setBootstrapProperties_({
    [SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID]: responseSpreadsheetId
  });

  if (!dashboard || !responseSpreadsheetId) return;

  try {
    var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
    var sheet = dashboard.getSheetByName(settingsSheetName) || bsEnsureSheet_(dashboard, settingsSheetName);
    bsSetHeaders_(sheet, BH.SETTINGS);
    var lastRow = Math.max(sheet.getLastRow(), 1);
    if (lastRow > 1) {
      var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (safeString_(keys[i][0]) === SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID) {
          sheet.getRange(i + 2, 2).setValue(responseSpreadsheetId);
          return;
        }
      }
    }
    sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID, responseSpreadsheetId]]);
  } catch (err) {
    Logger.log('Could not write FORM_RESPONSES_SPREADSHEET_ID to Settings sheet: ' + err.message);
  }
}

function getMainFormResponsesSpreadsheetIdFromForm_(mainForm) {
  if (mainForm) {
    try {
      return mainForm.getDestinationId ? (mainForm.getDestinationId() || '') : '';
    } catch (ignore) {}
  }
  return '';
}

function writeSetupSummary_(ss, mainForm, evaluationForm) {
  ss = ss || openDashboardFromProperties_();
  mainForm = mainForm || tryOpenMainForm_();
  evaluationForm = evaluationForm || tryOpenEvaluationForm_();

  var sheet = bsEnsureSheet_(ss, BS.SUMMARY);
  sheet.clear();
  sheet.setRightToLeft(false);

  var branchIndex = getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0');
  var branchTotal = getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0');
  var branchComplete = getBootstrapProperty_(BSPROP.BRANCH_COMPLETE, 'false');

  var rows = [
    ['Item', 'Value'],
    ['Last updated', new Date()],
    ['Last step', getBootstrapProperty_(BSPROP.LAST_STEP, BSTATUS.NOT_STARTED)],
    ['Last status', getBootstrapProperty_(BSPROP.LAST_STATUS, BSTATUS.NOT_STARTED)],
    ['Last message', getBootstrapProperty_(BSPROP.LAST_MESSAGE, '')],
    ['DASHBOARD_SPREADSHEET_ID', ss.getId()],
    ['Dashboard URL', ss.getUrl()],
    ['MAIN_FORM_ID', mainForm ? mainForm.getId() : getBootstrapProperty_(BSPROP.MAIN_FORM_ID, '')],
    ['Main Form Edit URL', mainForm ? mainForm.getEditUrl() : getBootstrapProperty_(BSPROP.MAIN_FORM_EDIT_URL, '')],
    ['Main Form Published URL', mainForm ? mainForm.getPublishedUrl() : getBootstrapProperty_(BSPROP.MAIN_FORM_PUBLISHED_URL, '')],
    ['EVALUATION_FORM_ID', evaluationForm ? evaluationForm.getId() : getBootstrapProperty_(BSPROP.EVALUATION_FORM_ID, '')],
    ['Evaluation Form Edit URL', evaluationForm ? evaluationForm.getEditUrl() : getBootstrapProperty_(BSPROP.EVALUATION_FORM_EDIT_URL, '')],
    ['Evaluation Form Published URL', evaluationForm ? evaluationForm.getPublishedUrl() : getBootstrapProperty_(BSPROP.EVALUATION_FORM_PUBLISHED_URL, '')],
    ['Main form branching progress', branchIndex + ' / ' + branchTotal],
    ['Main form branching complete', branchComplete],
    ['Validation status', getBootstrapProperty_(BSPROP.VALIDATION_STATUS, BSTATUS.NOT_STARTED)],
    ['Reference data hash', getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, '')],
    ['Last reference sync', getBootstrapProperty_(BSPROP.LAST_REFERENCE_SYNC, '')],
    ['Production compatibility status', getBootstrapProperty_(BSPROP.PRODUCTION_COMPATIBILITY_STATUS, BSTATUS.NOT_STARTED)],
    ['Next production compatibility step', getBootstrapProperty_(BSPROP.PRODUCTION_COMPATIBILITY_INDEX, '0')],
    ['Ready for production script IDs', getBootstrapProperty_(BSPROP.READY, 'false')]
  ];

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground(BOOTSTRAP_CONFIG.BRAND_ACCENT_COLOR);
  sheet.getRange(2, 1, rows.length - 1, 1).setFontWeight('bold');

  var issues = readValidationIssues_();
  if (issues.length) {
    var startRow = rows.length + 3;
    sheet.getRange(startRow, 1, 1, 4)
      .setValues([['Validation severity', 'Area', 'Message', 'Value']])
      .setFontWeight('bold')
      .setBackground('#FFE8D6');
    var issueRows = issues.map(function(issue) {
      return [issue.severity, issue.area, issue.message, issue.value || ''];
    });
    sheet.getRange(startRow + 1, 1, issueRows.length, 4).setValues(issueRows);
  }

  sheet.autoResizeColumns(1, 4);
}

function tryOpenMainForm_() {
  try { return openMainFormFromProperties_(); } catch (ignore) { return null; }
}

function tryOpenEvaluationForm_() {
  try { return openEvaluationFormFromProperties_(); } catch (ignore) { return null; }
}

function readValidationIssues_() {
  var raw = getBootstrapProperty_(BSPROP.VALIDATION_ISSUES_JSON, '[]');
  try {
    return JSON.parse(raw) || [];
  } catch (err) {
    return [];
  }
}

function saveValidationIssues_(issues) {
  var limited = issues.slice(0, 200);
  setBootstrapProperties_({
    [BSPROP.VALIDATION_ISSUES_JSON]: JSON.stringify(limited),
    [BSPROP.VALIDATION_STATUS]: issues.some(function(issue) { return issue.severity === 'ERROR'; }) ? BSTATUS.FAILED : BSTATUS.COMPLETE
  });
}

function validEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function removeSetupProtections_(sheet) {
  var prefix = 'SQU Setup Toolkit';
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .concat(sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE));
  protections.forEach(function(protection) {
    try {
      if (String(protection.getDescription() || '').indexOf(prefix) === 0) protection.remove();
    } catch (ignore) {}
  });
}

function configureProtectionEditors_(protection, editors) {
  try { protection.setWarningOnly(false); } catch (ignore) {}
  try {
    var existing = protection.getEditors();
    if (existing.length) protection.removeEditors(existing);
  } catch (ignore2) {}
  if (editors && editors.length) {
    try { protection.addEditors(editors); } catch (ignore3) {}
  }
  try {
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  } catch (ignore4) {}
}
