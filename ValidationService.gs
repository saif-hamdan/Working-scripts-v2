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

const FINAL_STATUS_HEAD_PENDING_MESSAGE = 'لا يمكن تغيير حالة الاعتماد النهائي قبل اتخاذ رئيس الوحدة قراراً. / Cannot change final approval status before the unit head makes a decision.';
const SYSTEM_OWNED_FINAL_STATUS_MESSAGE = 'هذه الحالة النهائية تلقائية ويديرها النظام فقط. / This automatic final status is managed by the system only.';

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
    var requestId = '';
    var headStatus = '';
    try {
      var rowRecord = getRecordFromSheetRow_(sheet, e.range.getRow());
      requestId = safeString_(rowRecord[H.RECORD.REQUEST_ID]);
      headStatus = safeString_(rowRecord[H.RECORD.HEAD_STATUS]);
    } catch (ignore) {}

    if (!isMeaningfulFinalStatusChange_(e)) return;

    if (headStatus === STATUS.HEAD_PENDING) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:headPendingBlocked', requestId, 'Final status edit blocked while unit-head decision is pending.');
      SpreadsheetApp.getActive().toast(FINAL_STATUS_HEAD_PENDING_MESSAGE);
      return;
    }

    if (headStatus !== STATUS.HEAD_ACCEPTED) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:headNotAcceptedBlocked', requestId, 'Final status edit blocked because unit-head approval is required first.');
      SpreadsheetApp.getActive().toast('لا يمكن الاعتماد النهائي قبل موافقة رئيس الوحدة. / Unit-head approval is required first.');
      return;
    }

    var targetStatus = safeString_(e.value);
    if (isSystemOwnedFinalStatus_(targetStatus)) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:systemOwnedStatusBlocked', requestId, 'Manual system-owned final status edit reverted.');
      SpreadsheetApp.getActive().toast(SYSTEM_OWNED_FINAL_STATUS_MESSAGE);
      return;
    }

    if (!isAdminSettableFinalStatus_(targetStatus)) {
      revertEdit_(e);
      logInfo_('handleFinalStatusEdit:invalidFinalStatusBlocked', requestId, 'Manual final status edit reverted because the target status is not admin-settable: ' + targetStatus);
      SpreadsheetApp.getActive().toast('إجراء غير صالح. / Invalid final status action.');
      return;
    }

    if (targetStatus === STATUS.FINAL_APPROVED || targetStatus === STATUS.FINAL_REJECTED) {
      var result = applyFinalStatusChange_(e.range.getRow(), targetStatus, userEmail, 'handleFinalStatusEdit:directSheetEdit', safeString_(e.oldValue));
      if (!result.success) {
        revertEdit_(e);
        SpreadsheetApp.getActive().toast(result.message);
        return;
      }
      return;
    }

    updateObjectRow_(sheet, e.range.getRow(), {
      [H.RECORD.FINAL_STATUS]: targetStatus,
      [H.RECORD.LAST_UPDATED]: now_()
    });
    refreshDashboard();
    logInfo_('handleFinalStatusEdit:directSheetEdit', requestId, 'Final status changed to ' + targetStatus + ' by ' + userEmail + ' from a direct sheet edit.');
    return;
  }
}

function isMeaningfulFinalStatusChange_(e) {
  return safeString_(e && e.oldValue) !== safeString_(e && e.value);
}

function isSystemOwnedFinalStatus_(status) {
  return status === STATUS.FINAL_CONFLICT || status === STATUS.FINAL_EMPLOYEE_ACTIVE;
}


function isAdminSettableFinalStatus_(status) {
  return status === STATUS.FINAL_APPROVED
    || status === STATUS.FINAL_REJECTED
    || status === STATUS.FINAL_IN_PROGRESS
    || status === STATUS.FINAL_DONE;
}

function getSelectedFinalStatusContext() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet() || openDashboardSpreadsheet_();
    var sheet = ss.getActiveSheet();
    if (!sheet || sheet.getName() !== SHEETS.RECORDS) {
      return { success: false, message: 'يرجى اختيار صف من ورقة سجل الطلبات. / Select a row on the records sheet.' };
    }
    var range = sheet.getActiveRange();
    if (!range || range.getRow() <= 1) {
      return { success: false, message: 'يرجى اختيار صف طلب صالح. / Select a valid request row.' };
    }
    var rowNumber = range.getRow();
    var record = getRecordFromSheetRow_(sheet, rowNumber);
    if (!safeString_(record[H.RECORD.REQUEST_ID])) {
      return { success: false, message: 'الصف المحدد لا يحتوي على رقم طلب. / Selected row has no request ID.' };
    }
    return {
      success: true,
      rowNumber: rowNumber,
      requestId: safeString_(record[H.RECORD.REQUEST_ID]),
      employeeName: safeString_(record[H.RECORD.EMPLOYEE_NAME]),
      headStatus: safeString_(record[H.RECORD.HEAD_STATUS]),
      finalStatus: safeString_(record[H.RECORD.FINAL_STATUS]),
      actions: [STATUS.FINAL_APPROVED, STATUS.FINAL_REJECTED]
    };
  } catch (err) {
    logError_('getSelectedFinalStatusContext', '', err);
    return { success: false, message: 'تعذر قراءة الصف المحدد: ' + (err && err.message ? err.message : err) };
  }
}

function confirmFinalStatusChange(rowNumber, targetStatus) {
  try {
    rowNumber = parseInt(rowNumber, 10);
    targetStatus = safeString_(targetStatus);
    if (!rowNumber || rowNumber <= 1) return { success: false, message: 'رقم الصف غير صالح. / Invalid row number.' };
    if (isSystemOwnedFinalStatus_(targetStatus)) {
      return { success: false, message: SYSTEM_OWNED_FINAL_STATUS_MESSAGE };
    }
    if (targetStatus !== STATUS.FINAL_APPROVED && targetStatus !== STATUS.FINAL_REJECTED) {
      return { success: false, message: 'إجراء غير صالح. / Invalid final status action.' };
    }

    var userEmail = getActiveUserEmail_();
    if (!isAuthorizedEditor_(userEmail)) {
      return { success: false, message: 'غير مصرح لك بتنفيذ هذا الإجراء. / You are not authorized.' };
    }

    return applyFinalStatusChange_(rowNumber, targetStatus, userEmail, 'confirmFinalStatusChange');
  } catch (err) {
    logError_('confirmFinalStatusChange', '', err);
    return { success: false, message: 'حدث خطأ: ' + (err && err.message ? err.message : err) };
  }
}

function applyFinalStatusChange_(rowNumber, targetStatus, userEmail, logAction, currentFinalStatusOverride) {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || openDashboardSpreadsheet_();
  var sheet = ss.getSheetByName(SHEETS.RECORDS) || getOrCreateSheet_(SHEETS.RECORDS);
  if (rowNumber > sheet.getLastRow()) return { success: false, message: 'الصف المحدد خارج نطاق البيانات. / Selected row is outside the data range.' };
  requireHeaders_(sheet, RECORD_HEADERS);
  var record = getRecordFromSheetRow_(sheet, rowNumber);
  var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
  if (!requestId) return { success: false, message: 'الصف المحدد لا يحتوي على رقم طلب. / Selected row has no request ID.' };
  if (safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_PENDING) {
    return { success: false, message: FINAL_STATUS_HEAD_PENDING_MESSAGE };
  }
  if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_ACCEPTED) {
    return { success: false, message: 'لا يمكن الاعتماد النهائي قبل موافقة رئيس الوحدة. / Unit-head approval is required first.' };
  }
  var currentFinalStatus = currentFinalStatusOverride === undefined
    ? safeString_(record[H.RECORD.FINAL_STATUS])
    : safeString_(currentFinalStatusOverride);
  if (currentFinalStatus === targetStatus) {
    return { success: false, message: 'الحالة النهائية مطابقة للإجراء المطلوب بالفعل. / Final status already matches the requested action.' };
  }

  record[H.RECORD.FINAL_STATUS] = targetStatus;
  var sent = targetStatus === STATUS.FINAL_APPROVED
    ? sendFinalApprovedNotification(record)
    : sendFinalRejectedNotification(record);
  if (sent !== true) {
    logInfo_(
      logAction + ':emailPendingRetry',
      requestId,
      'Final status was not updated because the final-decision email was not sent; sendEmailSafe_ queued it for retry.'
    );
    return {
      success: false,
      message: 'تعذر إرسال البريد؛ لم يتم تغيير الحالة النهائية، والبريد بانتظار إعادة المحاولة. / Failed to send email; status was not changed. Email is pending retry.'
    };
  }

  updateObjectRow_(sheet, rowNumber, {
    [H.RECORD.FINAL_STATUS]: targetStatus,
    [H.RECORD.LAST_UPDATED]: now_()
  });
  refreshDashboard();
  logInfo_(logAction, requestId, 'Final status changed to ' + targetStatus + ' by ' + userEmail + ' after email was sent.');
  return { success: true, message: 'تم إرسال البريد وتحديث الحالة إلى: ' + targetStatus + ' / Email sent and final status updated.' };
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
    syncReferenceDataFromAdminSheets_({ forceFormat: true });
    var bootstrapSync = syncAdminReferenceData_(openDashboardFromProperties_());
    var queued = markMainFormReferenceDataDirty_(
      bootstrapSync.formHash || bootstrapSync.hash
    );
    refreshDashboard(true);
    logInfo_(
      'handleAdminReferenceEdit_',
      '',
      'Reference data synced from ' + sheet.getName() + '. ' +
        (queued
          ? 'Form-choice data changed; a change-driven form refresh was queued for syncSystem.'
          : 'Only non-form data changed, or the choices already match; no form rebuild was queued.')
    );
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
