function run09_applyProtections() {
  var ss = openDashboardFromProperties_();
  if (!BOOTSTRAP_CONFIG.PROTECT_SHEETS) {
    return finishStep_('09 Apply Protections', BSTATUS.COMPLETE, 'Sheet protection is disabled in BOOTSTRAP_CONFIG.PROTECT_SHEETS.');
  }

  prepareBootstrapProtectionConfig_(ss);
  removeLegacySetupProtections_(ss);
  protectDashboardSheets();
  hideBootstrapSystemSheets_(ss);
  writeSetupSummary_(ss);
  return finishStep_('09 Apply Protections', BSTATUS.COMPLETE, 'Protections were applied by protectDashboardSheets(). Final status and notes are the editable records columns.');
}

function prepareBootstrapProtectionConfig_(ss) {
  var config = {};
  config[SETTINGS_KEYS.DASHBOARD_SPREADSHEET_ID] = ss.getId();
  config[SETTINGS_KEYS.OWNER_EMAIL] = getEffectiveOwnerEmail_();
  config[SETTINGS_KEYS.ADMIN_EMAILS] = getBootstrapAdminEmailsForConfig_().join(',');
  setBootstrapProperties_(config);
}

function getBootstrapAdminEmailsForConfig_() {
  var owner = getEffectiveOwnerEmail_();
  var raw = BOOTSTRAP_CONFIG.ADMIN_EMAILS || owner;
  var emails = String(raw || '').split(',').map(function(email) { return email.trim(); }).filter(Boolean);
  if (owner && emails.indexOf(owner) === -1) emails.push(owner);
  return emails;
}

function removeLegacySetupProtections_(ss) {
  [BS.DASHBOARD, BS.RECORDS, BS.CHARTS, BS.ADMIN_UNITS, BS.ADMIN_SECTIONS, BS.UNITS, BS.SECTIONS, BS.SETTINGS].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) removeSetupProtections_(sheet);
  });
}

function hideBootstrapSystemSheets_(ss) {
  try { ss.getSheetByName(BS.UNITS).hideSheet(); } catch (ignore) {}
  try { ss.getSheetByName(BS.SECTIONS).hideSheet(); } catch (ignore2) {}
  try { ss.getSheetByName(BS.SETTINGS).hideSheet(); } catch (ignore3) {}
}
