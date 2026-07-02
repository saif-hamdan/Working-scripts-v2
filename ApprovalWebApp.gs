/** Web app approval/rejection handlers. */
function handleWebGet(e) {
  var action = e && e.parameter ? safeString_(e.parameter.action) : '';
  var token = e && e.parameter ? safeString_(e.parameter.token) : '';
  try {
    if (action === 'approve') return handleApprove_(token);
    if (action === 'reject') return showRejectPage_(token);
    return renderMessagePage_('طلب غير معروف', 'Unknown request', 'الرابط غير صحيح أو ناقص. / The link is invalid or incomplete.', false);
  } catch (err) {
    logError_('handleWebGet', '', err);
    return renderMessagePage_('حدث خطأ', 'Error', err.message, false);
  }
}

function handleWebPost(e) {
  var action = e && e.parameter ? safeString_(e.parameter.action) : '';
  try {
    if (action === 'reject') {
      var token = safeString_(e.parameter.token);
      var reason = safeString_(e.parameter.reason);
      return handleRejectSubmit_(token, reason);
    }
    return renderMessagePage_('طلب غير معروف', 'Unknown request', 'الرابط غير صحيح أو ناقص. / The link is invalid or incomplete.', false);
  } catch (err) {
    logError_('handleWebPost', '', err);
    return renderMessagePage_('حدث خطأ', 'Error', err.message, false);
  }
}

function handleApprove_(token) {
  throwIfMissing_(token, 'Missing approval token.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var record = getRequestByToken_(token);
    if (!record) return renderMessagePage_('رابط غير صالح', 'Invalid link', 'لم يتم العثور على الطلب. / Request was not found.', false);

    var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING || safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) {
      return renderMessagePage_('تمت معالجة الطلب مسبقاً', 'Already processed', 'حالة الطلب الحالية: ' + safeString_(record[H.RECORD.FINAL_STATUS]), true);
    }

    var conflict = findConflicts({
      trainingUnit: record[H.RECORD.TRAINING_UNIT],
      section: record[H.RECORD.SECTION],
      startDate: record[H.RECORD.START_DATE],
      endDate: record[H.RECORD.END_DATE],
      excludeRequestId: requestId
    });

    if (conflict) {
      updateRequestByRow_(record._rowNumber, {
        [H.RECORD.HEAD_STATUS]: STATUS.HEAD_CONFLICT,
        [H.RECORD.FINAL_STATUS]: STATUS.FINAL_CONFLICT,
        [H.RECORD.CONFLICT_ID]: conflict[H.RECORD.REQUEST_ID],
        [H.RECORD.CONFLICT_DETAILS]: formatConflictDetails_(conflict),
        [H.RECORD.DECISION_DATE]: now_()
      });
      var updated = getRequestById_(requestId);
      queueConflictNotification(updated, conflict, 'late_approval');
      logInfo_('handleApprove_:conflict', requestId, 'Approval blocked because of conflict.');
      return renderMessagePage_('تعذر الاعتماد بسبب التعارض', 'Approval blocked due to conflict', 'يوجد طلب آخر معتمد لنفس القسم وفي فترة متداخلة. سيتم إرسال التفاصيل بالبريد الإلكتروني.', false);
    }

    updateRequestByRow_(record._rowNumber, {
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED,
      [H.RECORD.FINAL_STATUS]: STATUS.FINAL_PENDING,
      [H.RECORD.DECISION_DATE]: now_()
    });
    logInfo_('handleApprove_', requestId, 'Request approved by unit head; final admin approval remains pending.');
    return renderMessagePage_('تم تسجيل القرار', 'Decision Recorded', 'تم تسجيل قرارك بنجاح. يمكنك الآن إغلاق هذه الصفحة. / Your decision has been recorded successfully. You may now close this page.', true);
  } finally {
    lock.releaseLock();
  }
}

function showRejectPage_(token) {
  throwIfMissing_(token, 'Missing rejection token.');
  var record = getRequestByToken_(token);
  if (!record) return renderMessagePage_('رابط غير صالح', 'Invalid link', 'لم يتم العثور على الطلب. / Request was not found.', false);
  var template = HtmlService.createTemplateFromFile('RejectPage');
  template.data = buildTemplateData_(record, { token: token, actionUrl: getConfig().WEB_APP_URL });
  return template.evaluate().setTitle('رفض الطلب / Reject Request');
}

function handleRejectSubmit_(token, reason) {
  throwIfMissing_(token, 'Missing rejection token.');
  throwIfMissing_(reason, 'Rejection reason is required.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var record = getRequestByToken_(token);
    if (!record) return renderMessagePage_('رابط غير صالح', 'Invalid link', 'لم يتم العثور على الطلب. / Request was not found.', false);
    var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING || safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) {
      return renderMessagePage_('تمت معالجة الطلب مسبقاً', 'Already processed', 'حالة الطلب الحالية: ' + safeString_(record[H.RECORD.FINAL_STATUS]), true);
    }
    updateRequestByRow_(record._rowNumber, {
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_REJECTED,
      [H.RECORD.FINAL_STATUS]: STATUS.FINAL_REJECTED,
      [H.RECORD.REJECTION_REASON]: reason,
      [H.RECORD.DECISION_DATE]: now_()
    });
    var rejectedRecord = getRequestById_(requestId);
    queueRejectedNotification(rejectedRecord);
    logInfo_('handleRejectSubmit_', requestId, 'Request rejected.');
    return renderMessagePage_('تم تسجيل القرار', 'Decision Recorded', 'تم تسجيل قرارك بنجاح. يمكنك الآن إغلاق هذه الصفحة. / Your decision has been recorded successfully. You may now close this page.', true);
  } finally {
    lock.releaseLock();
  }
}

function renderMessagePage_(titleAr, titleEn, message, success) {
  var template = HtmlService.createTemplateFromFile('MessagePage');
  template.data = {
    titleAr: titleAr,
    titleEn: titleEn,
    message: message,
    success: success,
    brand: getConfig().BRAND,
    orgAr: getConfig().ORGANIZATION_NAME_AR,
    orgEn: getConfig().ORGANIZATION_NAME_EN
  };
  return template.evaluate().setTitle(titleEn);
}
