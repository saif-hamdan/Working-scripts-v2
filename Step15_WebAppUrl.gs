/** Saves the production Web App URL without using the Script Properties UI. */
function run15_saveActiveWebAppUrl() {
  var ss = openDashboardFromProperties_();
  var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
  var sheet = ss.getSheetByName(settingsSheetName) || bsEnsureSheet_(ss, settingsSheetName);
  bsSetHeaders_(sheet, BH.SETTINGS);

  // A manually saved dashboard URL is authoritative. ScriptApp.getService().getUrl()
  // can return an older active deployment when the project has multiple deployments.
  var dashboardUrl = normalizeProductionWebAppUrl_(getSettingValue_(sheet, SETTINGS_KEYS.WEB_APP_URL));
  var propertyUrl = normalizeProductionWebAppUrl_(
    PropertiesService.getScriptProperties().getProperty(SETTINGS_KEYS.WEB_APP_URL)
  );
  var detectedUrl = '';
  try {
    detectedUrl = normalizeProductionWebAppUrl_(ScriptApp.getService().getUrl());
  } catch (ignore) {}

  var activeUrl = isConfiguredWebAppUrl_(dashboardUrl)
    ? dashboardUrl
    : (isConfiguredWebAppUrl_(propertyUrl) ? propertyUrl : detectedUrl);
  if (!isConfiguredWebAppUrl_(activeUrl)) {
    throw new Error('No production Web App URL was found. Paste the current /exec deployment URL into WEB_APP_URL in the dashboard settings sheet, then run this function again.');
  }

  setSettingValue_(sheet, SETTINGS_KEYS.WEB_APP_URL, activeUrl);
  PropertiesService.getScriptProperties().setProperty(SETTINGS_KEYS.WEB_APP_URL, activeUrl);

  Logger.log('WEB_APP_URL saved: ' + activeUrl);
  return 'WEB_APP_URL was saved to Script Properties and the settings sheet: ' + activeUrl;
}

function getSettingValue_(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var result = '';
  values.forEach(function(row) {
    if (safeString_(row[0]) === key) result = safeString_(row[1]);
  });
  return result;
}

function setSettingValue_(sheet, key, value) {
  var lastRow = sheet.getLastRow();
  var found = false;
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (safeString_(keys[i][0]) === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        found = true;
      }
    }
  }
  if (!found) sheet.appendRow([key, value]);
}
