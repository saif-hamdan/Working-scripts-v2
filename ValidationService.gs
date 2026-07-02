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
  if (sheet.getName() === SHEETS.ADMIN_UNITS || sheet.getName() === SHEETS.ADMIN_SECTIONS) {
    handleAdminReferenceEdit_(e);
    return;
  }
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
    if (ACTIVE_FINAL_STATUSES.indexOf(newValue) !== -1 && headStatus !== STATUS.HEAD_ACCEPTED) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:blockedActiveFinalStatus', requestId, 'Cannot set final admin approval status before unit head approval.');
      SpreadsheetApp.getActive().toast('لا يمكن تغيير الحالة إلى اعتماد نهائي أو قيد التنفيذ أو منجز قبل موافقة رئيس الوحدة.');
      return;
    }

    if (newValue === STATUS.FINAL_APPROVED || newValue === STATUS.FINAL_REJECTED) {
      var record = getRecordFromSheetRow_(sheet, row);
      record[H.RECORD.FINAL_STATUS] = newValue;
      revertEdit_(e);
      var sent = newValue === STATUS.FINAL_APPROVED
        ? sendFinalApprovedNotification(record)
        : sendFinalRejectedNotification(record);
      if (!sent) {
        logInfo_('handleFinalStatusEdit:emailFailed', requestId, 'Final status edit reverted because notification email was not sent.');
        SpreadsheetApp.getActive().toast('تعذر إرسال إشعار البريد، لم يتم تغيير الحالة النهائية. / Email notification failed; final status was not changed.');
        return;
      }
      e.range.setValue(newValue);
    }

    sheet.getRange(row, map[H.RECORD.LAST_UPDATED]).setValue(now_());
    refreshDashboard();
    refreshCharts();
    refreshFormChoices();
  }
}

function handleAdminReferenceEdit_(e) {
  var sheet = e.range.getSheet();
  var userEmail = (e.user && e.user.getEmail) ? e.user.getEmail() : getActiveUserEmail_();
  if (!isAuthorizedEditor_(userEmail)) {
    revertEdit_(e);
    logInfo_('handleAdminReferenceEdit_:unauthorized', '', 'Unauthorized reference edit blocked for ' + userEmail);
    SpreadsheetApp.getActive().toast('غير مصرح بتعديل بيانات الوحدات والأقسام / Unauthorized reference edit.');
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    syncReferenceDataFromAdminSheets_();
    refreshDashboard(true);
    refreshCharts();
    refreshFormChoices(true);
    logInfo_('handleAdminReferenceEdit_', '', 'Reference data synced from ' + sheet.getName() + '.');
  } catch (err) {
    logError_('handleAdminReferenceEdit_', '', err);
    throw err;
  } finally {
    lock.releaseLock();
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

function getRecordFromSheetRow_(sheet, row) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
  var values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var record = { _rowNumber: row };
  headers.forEach(function(header, index) {
    if (header) record[header] = values[index];
  });
  return record;
}
