/** Email rendering, sending, queueing, and retry. */
function sendApprovalEmail(record) {
  var approveUrl = makeWebAppUrl_('approve', record[H.RECORD.TOKEN]);
  var rejectUrl = makeWebAppUrl_('reject', record[H.RECORD.TOKEN]);
  var data = buildTemplateData_(record, { approveUrl: approveUrl, rejectUrl: rejectUrl });
  var html = renderTemplate_('Emails_Approval', data);
  return sendEmailSafe_({
    to: safeString_(record[H.RECORD.APPROVER_EMAIL]),
    subject: 'طلب موافقة تدوير وظيفي / Job Rotation Approval Request - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'approval', requestId: record[H.RECORD.REQUEST_ID] });
}


function sendSubmissionConfirmationEmail(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_Submitted', data);
  return sendEmailSafe_({
    to: safeString_(record[H.RECORD.DIRECT_MANAGER_EMAIL]),
    cc: uniqueNonEmpty_([record[H.RECORD.EMPLOYEE_EMAIL], record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]]).join(','),
    subject: 'تم استلام طلب التدوير الوظيفي / Job Rotation Request Submitted - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'submitted', requestId: record[H.RECORD.REQUEST_ID] });
}


function sendInvalidDatesSubmissionEmail(data, responseId, error) {
  data = data || {};
  var cfg = getConfig();
  var templateData = {
    brand: cfg.BRAND,
    orgAr: cfg.ORGANIZATION_NAME_AR,
    orgEn: cfg.ORGANIZATION_NAME_EN,
    responseId: responseId || '',
    errorMessage: error && error.message ? error.message : safeString_(error),
    rows: [
      { ar: 'اسم الموظف', en: 'Employee', value: data.employeeName || '' },
      { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: data.employeeId || '' },
      { ar: 'تاريخ تعيين الموظف', en: 'Employee Hire Date', value: formatDate_(data.employeeHireDate) },
      { ar: 'المسمى الوظيفي للموظف', en: 'Employee Job Title', value: data.employeeJobTitle || '' },
      { ar: 'بريد الموظف', en: 'Employee Email', value: data.employeeEmail || '' },
      { ar: 'المسؤول المباشر', en: 'Line Manager', value: data.directManagerName || '' },
      { ar: 'الرقم الوظيفي للمسؤول المباشر', en: 'Line Manager Employee ID', value: data.directManagerId || '' },
      { ar: 'بريد المسؤول المباشر', en: 'Line Manager Email', value: data.directManagerEmail || '' },
      { ar: 'رقم محول المسؤول المباشر', en: 'Line Manager Extension', value: data.directManagerExtension || '' },
      { ar: 'الوحدة الحالية', en: 'Current Unit', value: data.currentUnit || '' },
      { ar: 'القسم الحالي للموظف', en: 'Current Department', value: data.currentDepartment || '' },
      { ar: 'وحدة التدوير', en: 'Rotation Unit', value: data.rotationUnit || '' },
      { ar: 'قسم التدوير', en: 'Rotation Section', value: data.section || '' },
      { ar: 'تاريخ البداية المرسل', en: 'Submitted Start Date', value: formatDate_(data.startDate) },
      { ar: 'تاريخ النهاية المرسل', en: 'Submitted End Date', value: formatDate_(data.endDate) },
      { ar: 'سبب عدم المعالجة', en: 'Processing Error', value: error && error.message ? error.message : safeString_(error) }
    ]
  };
  var html = renderTemplate_('Emails_InvalidDates', templateData);
  return sendEmailSafe_({
    to: uniqueNonEmpty_([data.directManagerEmail, data.submitterEmail]).join(','),
    cc: uniqueNonEmpty_([data.employeeEmail]).join(','),
    subject: 'تعذر استلام طلب التدوير الوظيفي - التواريخ غير صحيحة / Job Rotation Request Not Submitted - Incorrect Dates',
    htmlBody: html
  }, { kind: 'invalid_dates_submission', requestId: responseId || '' });
}

function buildApprovedNotificationPayload_(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_Approved', data);
  return {
    to: uniqueNonEmpty_([record[H.RECORD.DIRECT_MANAGER_EMAIL], record[H.RECORD.EMPLOYEE_EMAIL]]).join(','),
    cc: uniqueNonEmpty_([record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL], record[H.RECORD.APPROVER_EMAIL]]).join(','),
    subject: 'تمت موافقة رئيس الوحدة - الاعتماد النهائي معلق / Unit Head Approved - Final Admin Decision Pending - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendApprovedNotification(record) {
  return sendEmailSafe_(buildApprovedNotificationPayload_(record), { kind: 'approved', requestId: record[H.RECORD.REQUEST_ID] });
}

function queueApprovedNotification(record) {
  return queueEmailForLater_(buildApprovedNotificationPayload_(record), { kind: 'approved', requestId: record[H.RECORD.REQUEST_ID] });
}

function buildRejectedNotificationPayload_(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_Rejected', data);
  return {
    to: uniqueNonEmpty_([record[H.RECORD.DIRECT_MANAGER_EMAIL], record[H.RECORD.EMPLOYEE_EMAIL]]).join(','),
    cc: uniqueNonEmpty_([record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL], record[H.RECORD.APPROVER_EMAIL]]).join(','),
    subject: 'تم رفض طلب التدوير الوظيفي / Job Rotation Request Rejected - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendRejectedNotification(record) {
  return sendEmailSafe_(buildRejectedNotificationPayload_(record), { kind: 'rejected', requestId: record[H.RECORD.REQUEST_ID] });
}

function queueRejectedNotification(record) {
  return queueEmailForLater_(buildRejectedNotificationPayload_(record), { kind: 'rejected', requestId: record[H.RECORD.REQUEST_ID] });
}

function buildFinalApprovedNotificationPayload_(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_FinalApproved', data);
  return {
    to: uniqueNonEmpty_([
      record[H.RECORD.EMPLOYEE_EMAIL],
      record[H.RECORD.DIRECT_MANAGER_EMAIL],
      record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]
    ]).join(','),
    subject: 'تم الاعتماد النهائي لطلب التدوير الوظيفي / Job Rotation Request Finally Approved - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendFinalApprovedNotification(record) {
  return sendEmailSafe_(buildFinalApprovedNotificationPayload_(record), { kind: 'final_approved', requestId: record[H.RECORD.REQUEST_ID] }) === true;
}

function buildFinalRejectedNotificationPayload_(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_FinalRejected', data);
  return {
    to: uniqueNonEmpty_([
      record[H.RECORD.EMPLOYEE_EMAIL],
      record[H.RECORD.DIRECT_MANAGER_EMAIL],
      record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]
    ]).join(','),
    subject: 'تم الرفض النهائي لطلب التدوير الوظيفي / Job Rotation Request Finally Rejected - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendFinalRejectedNotification(record) {
  return sendEmailSafe_(buildFinalRejectedNotificationPayload_(record), { kind: 'final_rejected', requestId: record[H.RECORD.REQUEST_ID] }) === true;
}

function sendActiveEmployeeRejectedNotification(record, activeRotation) {
  var data = buildTemplateData_(record, {
    activeRotation: activeRotation,
    activeRotationDetails: formatActiveRotationDetails_(activeRotation)
  });
  var html = renderTemplate_('Emails_ActiveEmployeeRejected', data);
  return sendEmailSafe_({
    to: uniqueNonEmpty_([record[H.RECORD.EMPLOYEE_EMAIL], record[H.RECORD.DIRECT_MANAGER_EMAIL]]).join(','),
    cc: uniqueNonEmpty_([record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]]).join(','),
    subject: 'رفض تلقائي لطلب التدوير الوظيفي / Automatic Job Rotation Request Rejection - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'active_employee_rejected', requestId: record[H.RECORD.REQUEST_ID] });
}

function buildConflictNotificationPayload_(record, conflict, source) {
  var data = buildTemplateData_(record, {
    conflict: conflict,
    conflictDetails: formatConflictDetails_(conflict),
    source: source
  });
  var html = renderTemplate_('Emails_Conflict', data);
  return {
    to: uniqueNonEmpty_([record[H.RECORD.APPROVER_EMAIL], record[H.RECORD.EMPLOYEE_EMAIL], record[H.RECORD.DIRECT_MANAGER_EMAIL], record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]]).join(','),
    subject: 'تعارض في طلب التدوير الوظيفي / Job Rotation Request Conflict - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendConflictNotification(record, conflict, source) {
  return sendEmailSafe_(buildConflictNotificationPayload_(record, conflict, source), { kind: 'conflict', requestId: record[H.RECORD.REQUEST_ID] });
}

function queueConflictNotification(record, conflict, source) {
  return queueEmailForLater_(buildConflictNotificationPayload_(record, conflict, source), { kind: 'conflict', requestId: record[H.RECORD.REQUEST_ID] });
}

function sendEvaluationEmail(record) {
  var cfg = getConfig();
  var data = buildTemplateData_(record, { evaluationUrl: cfg.EVALUATION_FORM_URL });
  var html = renderTemplate_('Emails_Evaluation', data);
  return sendEmailSafe_({
    to: safeString_(record[H.RECORD.EMPLOYEE_EMAIL]),
    subject: 'تقييم تجربة التدوير الوظيفي / Job Rotation Evaluation - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'evaluation', requestId: record[H.RECORD.REQUEST_ID] });
}

function sendEmailSafe_(payload, context) {
  try {
    if (!safeString_(payload.to)) throw new Error('Email recipient is empty.');
    var message = {
      to: payload.to,
      cc: payload.cc || '',
      bcc: payload.bcc || '',
      subject: payload.subject,
      body: payload.body || 'يرجى عرض هذه الرسالة بصيغة HTML. / Please view this message in HTML.',
      htmlBody: payload.htmlBody
    };
    MailApp.sendEmail(message);
    logInfo_('sendEmailSafe_:' + (context && context.kind || ''), context && context.requestId, 'Email sent to: ' + payload.to);
    return true;
  } catch (err) {
    queueEmail_(payload, context, err);
    logError_('sendEmailSafe_:' + (context && context.kind || ''), context && context.requestId, err);
    return false;
  }
}

function queueEmailForLater_(payload, context) {
  try {
    if (!safeString_(payload.to)) throw new Error('Email recipient is empty.');
    queueEmail_(payload, context, null);
    logInfo_('queueEmailForLater_:' + (context && context.kind || ''), context && context.requestId, 'Email queued to: ' + payload.to);
    return true;
  } catch (err) {
    logError_('queueEmailForLater_:' + (context && context.kind || ''), context && context.requestId, err);
    return false;
  }
}

function queueEmail_(payload, context, error) {
  var sheet = getOrCreateSheet_(SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(sheet, QUEUE_HEADERS);
  appendObjectRow_(sheet, QUEUE_HEADERS, {
    [H.QUEUE.MESSAGE_ID]: Utilities.getUuid(),
    [H.QUEUE.STATUS]: STATUS.QUEUE_PENDING,
    [H.QUEUE.TO]: payload.to || '',
    [H.QUEUE.CC]: payload.cc || '',
    [H.QUEUE.BCC]: payload.bcc || '',
    [H.QUEUE.SUBJECT]: payload.subject || '',
    [H.QUEUE.HTML]: payload.htmlBody || '',
    [H.QUEUE.CONTEXT_JSON]: objectToJson_(context || {}),
    [H.QUEUE.ATTEMPTS]: 0,
    [H.QUEUE.LAST_ERROR]: error && error.message ? error.message : safeString_(error),
    [H.QUEUE.CREATED_AT]: now_(),
    [H.QUEUE.LAST_ATTEMPT_AT]: ''
  });
  try { sheet.hideSheet(); } catch (ignore) {}
}

function processEmailQueue(options) {
  options = options || {};
  var sheet = getOrCreateSheet_(SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(sheet, QUEUE_HEADERS);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var scanWindow = Math.max(EMAIL_QUEUE_BATCH_SIZE, QUEUE_SCAN_WINDOW_ROWS);
  var scanRange = getQueueScanRange_(EMAIL_QUEUE_SCAN_CURSOR_KEY, lastRow, scanWindow);
  var startRow = scanRange.startRow;
  var headers = lastRow >= 1 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(safeString_) : [];
  var rows = lastRow >= 2 && scanRange.rowCount > 0 ? sheet.getRange(scanRange.startRow, 1, scanRange.rowCount, lastCol).getValues() : [];
  var stats = { sent: 0, processed: 0, failed: 0, skipped: 0, scanned: 0, remainingLikely: scanRange.endRow < lastRow, stoppedEarly: false, stoppedForBatch: false };
  var actionableCount = 0;
  var cursorDeferred = false;
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = objectFromQueueRow_(headers, rows[i], startRow + i);
    stats.scanned++;
    if (safeString_(row[H.QUEUE.STATUS]) === STATUS.QUEUE_SENT) {
      stats.skipped++;
      continue;
    }
    var attempts = toNumber_(row[H.QUEUE.ATTEMPTS], 0);
    if (attempts >= 5) {
      stats.skipped++;
      continue;
    }
    if (actionableCount >= EMAIL_QUEUE_BATCH_SIZE) {
      stats.remainingLikely = true;
      stats.stoppedForBatch = true;
      setQueueScanCursor_(EMAIL_QUEUE_SCAN_CURSOR_KEY, row._rowNumber, lastRow);
      cursorDeferred = true;
      break;
    }
    if (shouldStopSync_(options.startedAt)) {
      stats.stoppedEarly = true;
      stats.remainingLikely = true;
      setQueueScanCursor_(EMAIL_QUEUE_SCAN_CURSOR_KEY, row._rowNumber, lastRow);
      cursorDeferred = true;
      break;
    }
    actionableCount++;
    var context = parseJsonSafe_(row[H.QUEUE.CONTEXT_JSON], {});
    try {
      var message = {
        to: safeString_(row[H.QUEUE.TO]),
        cc: safeString_(row[H.QUEUE.CC]),
        bcc: safeString_(row[H.QUEUE.BCC]),
        subject: safeString_(row[H.QUEUE.SUBJECT]),
        body: 'يرجى عرض هذه الرسالة بصيغة HTML. / Please view this message in HTML.',
        htmlBody: safeString_(row[H.QUEUE.HTML])
      };
      MailApp.sendEmail(message);
      updateObjectRow_(sheet, row._rowNumber, {
        [H.QUEUE.STATUS]: STATUS.QUEUE_SENT,
        [H.QUEUE.ATTEMPTS]: attempts + 1,
        [H.QUEUE.LAST_ATTEMPT_AT]: now_(),
        [H.QUEUE.LAST_ERROR]: ''
      });
      if (context.kind === 'approval' && context.requestId) {
        var record = getRequestById_(context.requestId);
        if (record && !safeString_(record[H.RECORD.APPROVAL_EMAIL_SENT_AT])) {
          updateRequestByRow_(record._rowNumber, { [H.RECORD.APPROVAL_EMAIL_SENT_AT]: now_() });
        }
      }
      stats.sent++;
      stats.processed++;
    } catch (err) {
      updateObjectRow_(sheet, row._rowNumber, {
        [H.QUEUE.STATUS]: attempts + 1 >= 5 ? STATUS.QUEUE_FAILED : STATUS.QUEUE_PENDING,
        [H.QUEUE.ATTEMPTS]: attempts + 1,
        [H.QUEUE.LAST_ATTEMPT_AT]: now_(),
        [H.QUEUE.LAST_ERROR]: err.message
      });
      stats.failed++;
      logError_('processEmailQueue', context.requestId || '', err);
    }
  }
  if (!cursorDeferred) advanceQueueScanCursor_(EMAIL_QUEUE_SCAN_CURSOR_KEY, scanRange, lastRow);
  logInfo_('processEmailQueue', '', 'Email queue sent: ' + stats.sent +
    ', skipped: ' + stats.skipped +
    ', failed: ' + stats.failed +
    ', scanned: ' + stats.scanned +
    ', remainingLikely: ' + stats.remainingLikely +
    ', stoppedEarly: ' + stats.stoppedEarly + '.');
  logQueueStoppedEarly_('processEmailQueue', '', stats, EMAIL_QUEUE_BATCH_SIZE);
  return stats;
}
