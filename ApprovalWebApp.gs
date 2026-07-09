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
  var record = getRequestByToken_(token);
  if (!record) {
    return renderMessagePage_('رابط غير صالح', 'Invalid link', 'لم يتم العثور على الطلب. / Request was not found.', false);
  }
  if (!isRequestAwaitingUnitHeadDecision_(record)) {
    return renderAlreadyProcessedPage_(record);
  }
  queueApprovalAction_(token, APPROVAL_ACTIONS.APPROVE, '');
  return renderDecisionQueuedPage_();
}

function processQueuedApproveAction_(token) {
  throwIfMissing_(token, 'Missing approval token.');

  var requestId = '';
  var conflictNotification = null;

  try {
    var record = getRequestByToken_(token);
    if (!record) throw new Error('Request was not found for approval token.');

    requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING || safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) {
      logInfo_('processQueuedApproveAction_', requestId, 'Queued approval skipped because the request was already processed. Current final status: ' + safeString_(record[H.RECORD.FINAL_STATUS]));
      return;
    }

    var conflict = findConflicts({
      rotationUnit: record[H.RECORD.ROTATION_UNIT],
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
      record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_CONFLICT;
      record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_CONFLICT;
      record[H.RECORD.CONFLICT_ID] = conflict[H.RECORD.REQUEST_ID];
      record[H.RECORD.CONFLICT_DETAILS] = formatConflictDetails_(conflict);
      conflictNotification = { record: record, conflict: conflict, source: 'late_approval' };
      logInfo_('processQueuedApproveAction_:conflict', requestId, 'Approval blocked because of conflict.');
      return;
    }

    updateRequestByRow_(record._rowNumber, {
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED,
      [H.RECORD.FINAL_STATUS]: STATUS.FINAL_PENDING,
      [H.RECORD.DECISION_DATE]: now_()
    });
    logInfo_('processQueuedApproveAction_', requestId, 'Request approved by unit head; final admin approval remains pending.');
  } finally {
    if (conflictNotification) {
      queueConflictNotification(conflictNotification.record, conflictNotification.conflict, conflictNotification.source);
    }
  }
}

function showRejectPage_(token) {
  throwIfMissing_(token, 'Missing rejection token.');
  var record = getRequestByToken_(token);
  if (!record) return renderMessagePage_('رابط غير صالح', 'Invalid link', 'لم يتم العثور على الطلب. / Request was not found.', false);
  if (!isRequestAwaitingUnitHeadDecision_(record)) return renderAlreadyProcessedPage_(record);
  var actionUrlStatus = getValidatedWebAppUrlStatus_();
  if (!actionUrlStatus.ok) {
    return renderMessagePage_(
      'خطأ في إعداد رابط التطبيق',
      'Web App URL Configuration Error',
      actionUrlStatus.message,
      false
    );
  }
  var template = HtmlService.createTemplateFromFile('RejectPage');
  template.data = buildTemplateData_(record, { token: token, actionUrl: actionUrlStatus.url });
  return template.evaluate().setTitle('رفض الطلب / Reject Request');
}

function handleRejectSubmit_(token, reason) {
  var result = rejectRequest_(token, reason);
  return renderMessagePage_(result.titleAr, result.titleEn, result.message, result.success);
}

function rejectRequestFromPage(token, reason) {
  try {
    return rejectRequest_(token, reason);
  } catch (err) {
    logError_('rejectRequestFromPage', '', err);
    return {
      titleAr: 'حدث خطأ',
      titleEn: 'Error',
      message: err.message,
      success: false
    };
  }
}

function isRequestAwaitingUnitHeadDecision_(record) {
  return safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_PENDING
    && safeString_(record[H.RECORD.FINAL_STATUS]) === STATUS.FINAL_PENDING;
}

function buildAlreadyProcessedResult_(record) {
  var requestId = safeString_(record && record[H.RECORD.REQUEST_ID]);
  var headStatus = safeString_(record && record[H.RECORD.HEAD_STATUS]);
  var finalStatus = safeString_(record && record[H.RECORD.FINAL_STATUS]);
  var message = 'تم تسجيل قرار لهذا الطلب مسبقاً ولا يمكن إرسال قرار آخر لنفس الطلب.';
  if (requestId) message += ' رقم الطلب: ' + requestId + '.';
  if (headStatus) message += ' حالة موافقة رئيس الوحدة: ' + headStatus + '.';
  if (finalStatus) message += ' حالة الاعتماد النهائي: ' + finalStatus + '.';
  message += ' / This request was already processed, so another decision cannot be submitted.';
  if (requestId) message += ' Request ID: ' + requestId + '.';
  if (headStatus) message += ' Unit head status: ' + headStatus + '.';
  if (finalStatus) message += ' Final status: ' + finalStatus + '.';
  return {
    titleAr: 'تمت معالجة الطلب مسبقاً',
    titleEn: 'Request Already Processed',
    message: message,
    success: true
  };
}

function renderAlreadyProcessedPage_(record) {
  var result = buildAlreadyProcessedResult_(record);
  return renderMessagePage_(result.titleAr, result.titleEn, result.message, result.success);
}

function rejectRequest_(token, reason) {
  throwIfMissing_(token, 'Missing rejection token.');
  throwIfMissing_(reason, 'Rejection reason is required.');
  var record = getRequestByToken_(token);
  if (!record) {
    return {
      titleAr: 'رابط غير صالح',
      titleEn: 'Invalid link',
      message: 'لم يتم العثور على الطلب. / Request was not found.',
      success: false
    };
  }
  if (!isRequestAwaitingUnitHeadDecision_(record)) {
    return buildAlreadyProcessedResult_(record);
  }
  queueApprovalAction_(token, APPROVAL_ACTIONS.REJECT, reason);
  return buildDecisionQueuedResult_();
}

function processQueuedRejectAction_(token, reason) {
  throwIfMissing_(token, 'Missing rejection token.');
  throwIfMissing_(reason, 'Rejection reason is required.');

  var requestId = '';
  var rejectedRecord = null;

  try {
    var record = getRequestByToken_(token);
    if (!record) throw new Error('Request was not found for rejection token.');
    requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING || safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) {
      logInfo_('processQueuedRejectAction_', requestId, 'Queued rejection skipped because the request was already processed. Current final status: ' + safeString_(record[H.RECORD.FINAL_STATUS]));
      return;
    }

    rejectedRecord = Object.assign({}, record);
    rejectedRecord[H.RECORD.HEAD_STATUS] = STATUS.HEAD_REJECTED;
    rejectedRecord[H.RECORD.FINAL_STATUS] = STATUS.FINAL_REJECTED;
    rejectedRecord[H.RECORD.REJECTION_REASON] = reason;
    rejectedRecord[H.RECORD.DECISION_DATE] = now_();

    updateRequestByRow_(record._rowNumber, {
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_REJECTED,
      [H.RECORD.FINAL_STATUS]: STATUS.FINAL_REJECTED,
      [H.RECORD.REJECTION_REASON]: reason,
      [H.RECORD.DECISION_DATE]: rejectedRecord[H.RECORD.DECISION_DATE]
    });
    logInfo_('processQueuedRejectAction_', requestId, 'Request rejected by unit head; rejection email will be sent after the row update.');
  } finally {
    if (rejectedRecord) {
      if (sendRejectedNotification(rejectedRecord) !== true) {
        logInfo_(
          'processQueuedRejectAction_:emailPendingRetry',
          requestId,
          'Unit-head rejection was recorded; rejection email was queued for retry.'
        );
      }
    }
  }
}

function getValidatedWebAppUrlStatus_() {
  var configuredUrl = safeString_(getConfig().WEB_APP_URL);
  if (!configuredUrl) {
    return {
      ok: false,
      message: 'WEB_APP_URL is missing. Deploy the Apps Script as a Web App, then save the active deployment URL in Script Properties or the settings sheet.'
    };
  }

  var activeUrl = '';
  try {
    activeUrl = safeString_(ScriptApp.getService().getUrl());
  } catch (err) {
    return {
      ok: false,
      message: 'Unable to read the active Web App deployment URL. Redeploy the Apps Script as a Web App, then update WEB_APP_URL.'
    };
  }

  if (!activeUrl) {
    return {
      ok: false,
      message: 'No active Web App deployment URL was found. Deploy the Apps Script as a Web App, then update WEB_APP_URL.'
    };
  }

  if (normalizeWebAppUrl_(configuredUrl) !== normalizeWebAppUrl_(activeUrl)) {
    return {
      ok: false,
      message: 'WEB_APP_URL does not match the active Web App deployment URL. Update WEB_APP_URL after the latest deployment before using rejection links.'
    };
  }

  return { ok: true, url: configuredUrl };
}

function normalizeWebAppUrl_(url) {
  return safeString_(url).replace(/\/+$/, '');
}

function buildDecisionQueuedResult_() {
  return {
    titleAr: 'تم استلام القرار',
    titleEn: 'Decision Received',
    message: 'تم استلام قرارك بنجاح وسيتم معالجته خلال وقت قصير. يمكنك الآن إغلاق هذه الصفحة. / Your decision was received successfully and will be processed shortly. You may now close this page.',
    success: true
  };
}

function renderDecisionQueuedPage_() {
  var result = buildDecisionQueuedResult_();
  return renderMessagePage_(result.titleAr, result.titleEn, result.message, result.success);
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
