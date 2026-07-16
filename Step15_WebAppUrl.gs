/** Saves the active Web App deployment URL without using the Script Properties UI. */
function run15_saveActiveWebAppUrl() {
  var activeUrl = '';
  try {
    activeUrl = safeString_(ScriptApp.getService().getUrl());
  } catch (err) {
    throw new Error('Unable to read the active Web App URL. Deploy this Apps Script project as a Web App, then run this function again.');
  }

  if (!isConfiguredWebAppUrl_(activeUrl)) {
    throw new Error('No active Web App deployment was found. Deploy this Apps Script project as a Web App, then run this function again.');
  }

  var ss = openDashboardFromProperties_();
  var settingsSheetName = (typeof SHEETS !== 'undefined' && SHEETS.SETTINGS) ? SHEETS.SETTINGS : BS.SETTINGS;
  var sheet = ss.getSheetByName(settingsSheetName) || bsEnsureSheet_(ss, settingsSheetName);
  bsSetHeaders_(sheet, BH.SETTINGS);
  setSettingValue_(sheet, SETTINGS_KEYS.WEB_APP_URL, activeUrl);
  PropertiesService.getScriptProperties().setProperty(SETTINGS_KEYS.WEB_APP_URL, activeUrl);

  Logger.log('WEB_APP_URL saved: ' + activeUrl);
  return 'WEB_APP_URL was saved to Script Properties and the settings sheet: ' + activeUrl;
}

function setSettingValue_(sheet, key, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (safeString_(keys[i][0]) === key) {
        sheet.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value]);
}
