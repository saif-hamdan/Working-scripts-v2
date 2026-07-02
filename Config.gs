/** Configuration loading from Script Properties first, then hidden settings sheet. */
function getConfig() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var settings = readSettingsMapSafe_();

  function value(key, fallback) {
    if (props[key] !== undefined && String(props[key]).trim() !== '') return props[key];
    if (settings[key] !== undefined && String(settings[key]).trim() !== '') return settings[key];
    return fallback || '';
  }

  var adminEmails = splitCsv_(value(SETTINGS_KEYS.ADMIN_EMAILS, value(SETTINGS_KEYS.OWNER_EMAIL, '')));
  var ownerEmail = value(SETTINGS_KEYS.OWNER_EMAIL, '');
  if (ownerEmail && adminEmails.indexOf(ownerEmail) === -1) adminEmails.push(ownerEmail);

  return {
    DASHBOARD_SPREADSHEET_ID: value(SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID, ''),
    MAIN_FORM_ID: value(SETTINGS_KEYS.MAIN_FORM_ID, ''),
    FORM_RESPONSES_SPREADSHEET_ID: value(SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID, ''),
    RESPONSE_QUEUE_MAX_RETRIES: Math.max(1, toNumber_(value(SETTINGS_KEYS.RESPONSE_QUEUE_MAX_RETRIES, '3'), 3)),
    EVALUATION_FORM_URL: value(SETTINGS_KEYS.EVALUATION_FORM_URL, ''),
    WEB_APP_URL: value(SETTINGS_KEYS.WEB_APP_URL, ''),
    OWNER_EMAIL: ownerEmail,
    ADMIN_EMAILS: adminEmails,
    APPROVER_UNIT_MODE: normalizeApproverUnitMode_(value(SETTINGS_KEYS.APPROVER_UNIT_MODE, APPROVER_UNIT_MODE.CURRENT_UNIT)),
    EMAIL_SENDER_NAME: value(SETTINGS_KEYS.EMAIL_SENDER_NAME, 'Employees and Retirees Services Section - قسم خدمات الموظفين والمتقاعدين'),
    ORGANIZATION_NAME_AR: value(SETTINGS_KEYS.ORGANIZATION_NAME_AR, 'قسم خدمات الموظفين والمتقاعدين'),
    ORGANIZATION_NAME_EN: value(SETTINGS_KEYS.ORGANIZATION_NAME_EN, 'Employees and Retirees Services Section'),
    BRAND: {
      primaryColor: value(SETTINGS_KEYS.BRAND_PRIMARY_COLOR, '#004B3A'),
      secondaryColor: value(SETTINGS_KEYS.BRAND_SECONDARY_COLOR, '#B08D57'),
      accentColor: value(SETTINGS_KEYS.BRAND_ACCENT_COLOR, '#F5F1E8'),
      logoUrl: value(SETTINGS_KEYS.BRAND_LOGO_URL, '')
    },
    EVALUATION_ALLOWED_FINAL_STATUSES: splitCsv_(value(
      SETTINGS_KEYS.EVALUATION_ALLOWED_FINAL_STATUSES,
      APPROVED_EVALUATION_FINAL_STATUSES.join(',')
    ))
  };
}

function setConfigProperties(configObject) {
  PropertiesService.getScriptProperties().setProperties(configObject, true);
}

function getRequiredConfigValue_(key) {
  var cfg = getConfig();
  var value = cfg[key] || '';
  if (!value) throw new Error('Missing required config value: ' + key);
  return value;
}

function readSettingsMapSafe_() {
  try {
    var id = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID);
    if (!id) return {};
    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheetByName(SHEETS.SETTINGS);
    if (!sheet || sheet.getLastRow() < 2) return {};
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    var map = {};
    values.forEach(function(row) {
      var key = safeString_(row[0]);
      if (key) map[key] = safeString_(row[1]);
    });
    return map;
  } catch (err) {
    return {};
  }
}

function writeSettingsFromConfig_(ss) {
  var sheet = ensureSheet_(ss, SHEETS.SETTINGS);
  setSheetHeaders_(sheet, SETTINGS_HEADERS);
  var current = readSettingsRows_(sheet);
  var props = PropertiesService.getScriptProperties().getProperties();
  var defaults = {};
  defaults[SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID] = ss.getId();
  defaults[SETTINGS_KEYS.MAIN_FORM_ID] = '';
  defaults[SETTINGS_KEYS.FORM_RESPONSES_SPREADSHEET_ID] = '';
  defaults[SETTINGS_KEYS.RESPONSE_QUEUE_MAX_RETRIES] = '3';
  defaults[SETTINGS_KEYS.EVALUATION_FORM_URL] = '';
  defaults[SETTINGS_KEYS.WEB_APP_URL] = '';
  defaults[SETTINGS_KEYS.OWNER_EMAIL] = Session.getEffectiveUser().getEmail() || '';
  defaults[SETTINGS_KEYS.ADMIN_EMAILS] = Session.getEffectiveUser().getEmail() || '';
  defaults[SETTINGS_KEYS.APPROVER_UNIT_MODE] = APPROVER_UNIT_MODE.CURRENT_UNIT;
  defaults[SETTINGS_KEYS.EMAIL_SENDER_NAME] = 'Employees and Retirees Services Section - قسم خدمات الموظفين والمتقاعدين';
  defaults[SETTINGS_KEYS.ORGANIZATION_NAME_AR] = 'قسم خدمات الموظفين والمتقاعدين';
  defaults[SETTINGS_KEYS.ORGANIZATION_NAME_EN] = 'Employees and Retirees Services Section';
  defaults[SETTINGS_KEYS.BRAND_PRIMARY_COLOR] = '#004B3A';
  defaults[SETTINGS_KEYS.BRAND_SECONDARY_COLOR] = '#B08D57';
  defaults[SETTINGS_KEYS.BRAND_ACCENT_COLOR] = '#F5F1E8';
  defaults[SETTINGS_KEYS.BRAND_LOGO_URL] = '';
  defaults[SETTINGS_KEYS.EVALUATION_ALLOWED_FINAL_STATUSES] = APPROVED_EVALUATION_FINAL_STATUSES.join(',');

  // Script Properties are the preferred source of truth. Mirror them into the settings
  // sheet so admins can review the live configuration from the dashboard file.
  Object.keys(defaults).forEach(function(key) {
    if (props[key] !== undefined && String(props[key]).trim() !== '') defaults[key] = props[key];
  });

  Object.keys(defaults).forEach(function(key) {
    if (!current[key]) current[key] = defaults[key];
    if (
      key === SETTINGS_KEYS.APPROVER_UNIT_MODE &&
      !props[key] &&
      current[key] === APPROVER_UNIT_MODE.TRAINING_UNIT
    ) {
      current[key] = defaults[key];
    }
  });
  var rows = Object.keys(current).map(function(key) { return [key, current[key]]; });
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 2).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  try { sheet.hideSheet(); } catch (ignore) {}
}

function normalizeApproverUnitMode_(value) {
  var mode = safeString_(value);
  if (mode === APPROVER_UNIT_MODE.TRAINING_UNIT) return APPROVER_UNIT_MODE.TRAINING_UNIT;
  return APPROVER_UNIT_MODE.CURRENT_UNIT;
}

function readSettingsRows_(sheet) {
  var map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  values.forEach(function(row) {
    var key = safeString_(row[0]);
    if (key) map[key] = safeString_(row[1]);
  });
  return map;
}
