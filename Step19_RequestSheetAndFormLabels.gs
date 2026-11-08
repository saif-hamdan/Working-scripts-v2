/**
 * Applies the current request-sheet schema/presentation and renames one main
 * form question without rebuilding form choices, branching, or either form.
 */
function run19_applyRequestSheetAndFormUpdates() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    throw new Error('Request-sheet update skipped because another system execution is running.');
  }
  try {
    var ss = openDashboardFromProperties_();
    var recordsSheet = ss.getSheetByName(SHEETS.RECORDS) || ensureSheet_(ss, SHEETS.RECORDS);
    var removedSubmissionTotal = removeLegacySubmissionTotalHoursColumn_(recordsSheet);
    setSheetHeaders_(recordsSheet, RECORD_HEADERS);
    applyCleanTableFormatting_(recordsSheet, RECORD_HEADERS.length);
    var hiddenColumns = hideInternalColumns_(recordsSheet);

    var form = openMainFormFromProperties_();
    var employeeNameUpdated = updateMainFormEmployeeNameTitle_(form);

    var message = 'Request sheet and main-form label updated. Submission-total column removed: ' +
      removedSubmissionTotal + '; internal columns hidden: ' + hiddenColumns.length +
      '; employee-name title changed: ' + employeeNameUpdated +
      '. No form choices or branching were rebuilt.';
    Logger.log(message);
    return message;
  } finally {
    lock.releaseLock();
  }
}
