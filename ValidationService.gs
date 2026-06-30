/** Data validation and edit rules. */
function setupValidations() {
  var sheet = getOrCreateSheet_(SHEETS.RECORDS);
  requireHeaders_(sheet, RECORD_HEADERS);
  var map = getHeaderMap_(sheet);
  var statusCol = map[H.RECORD.FINAL_STATUS];
  if (statusCol) {
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(FINAL_STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, statusCol, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  }
  applyCleanTableFormatting_(sheet, RECORD_HEADERS.length);
  hideInternalColumns_(sheet);
}

function handleFinalStatusEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEETS.RECORDS) return;
  if (e.range.getRow() === 1) return;
  var map = getHeaderMap_(sheet);
  var editedCol = e.range.getColumn();
  var finalStatusCol = map[H.RECORD.FINAL_STATUS];
  var notesCol = map[H.RECORD.NOTES];
  if (editedCol !== finalStatusCol && editedCol !== notesCol) return;

  var userEmail = (e.user && e.user.getEmail) ? e.user.getEmail() : getActiveUserEmail_();
  if (!isAuthorizedEditor_(userEmail)) {
    revertEdit_(e);
    logInfo_('handleFinalStatusEdit:unauthorized', '', 'Unauthorized edit blocked for ' + userEmail);
    SpreadsheetApp.getActive().toast('غير مصرح بالتعديل / Unauthorized edit.');
    return;
  }

  if (editedCol === finalStatusCol) {
    var newValue = safeString_(e.value || e.range.getValue());
    var row = e.range.getRow();
    var headStatus = safeString_(sheet.getRange(row, map[H.RECORD.HEAD_STATUS]).getValue());
    var requestId = safeString_(sheet.getRange(row, map[H.RECORD.REQUEST_ID]).getValue());
    if (newValue === STATUS.FINAL_DONE && headStatus !== STATUS.HEAD_ACCEPTED) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:blockedDone', requestId, 'Cannot set done before head approval.');
      SpreadsheetApp.getActive().toast('لا يمكن تغيير الحالة إلى منجز قبل موافقة رئيس الوحدة.');
      return;
    }
    sheet.getRange(row, map[H.RECORD.LAST_UPDATED]).setValue(now_());
    refreshDashboard();
    refreshCharts();
    refreshFormChoices();
  }
}

function isAuthorizedEditor_(email) {
  var cfg = getConfig();
  if (!email) return false;
  return cfg.ADMIN_EMAILS.indexOf(email) !== -1 || email === cfg.OWNER_EMAIL;
}

function revertEdit_(e) {
  if (e.oldValue !== undefined) e.range.setValue(e.oldValue);
  else e.range.clearContent();
}
