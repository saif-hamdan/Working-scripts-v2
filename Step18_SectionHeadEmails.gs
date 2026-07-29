/**
 * Adds/repairs the section-head email column and synchronizes reference data
 * without opening, rebuilding, or modifying either Google Form.
 */
function run18_updateSectionHeadEmailSchema() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error('Reference email update skipped because another system execution is running.');
  }
  try {
    var ss = openDashboardFromProperties_();
    var adminSections = repairBootstrapSheetSchema_(ss, BS.ADMIN_SECTIONS, BH.SECTIONS);
    repairBootstrapSheetSchema_(ss, BS.SECTIONS, BH.SECTIONS);
    ensureAdminReferenceSheets_(ss);
    ensureDefaultSectionHeadEmails_(adminSections);
    var productionSync = syncReferenceDataFromAdminSheets_({ forceFormat: true });
    var bootstrapSync = syncAdminReferenceData_(ss);
    markMainFormReferenceDataDirty_(bootstrapSync.formHash || bootstrapSync.hash);
    applyReferenceAdminFormatting_(ss);
    try { ss.getSheetByName(BS.SECTIONS).hideSheet(); } catch (ignore) {}

    var message = 'Section-head email schema updated without opening or modifying either form. ' +
      'Blank section emails were set to ' + DEFAULT_SECTION_HEAD_EMAIL +
      '. Reference data changed: ' +
      Boolean(productionSync && productionSync.changed) + '.';
    Logger.log(message);
    return message;
  } finally {
    lock.releaseLock();
  }
}
