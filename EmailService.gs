/** Email rendering, sending, queueing, and retry. */
function sendApprovalEmail(record) {
  var approveUrl = makeWebAppUrl_('approve', record[H.RECORD.TOKEN]);
  var rejectUrl = makeWebAppUrl_('reject', record[H.RECORD.TOKEN]);
  var data = buildTemplateData_(record, { approveUrl: approveUrl, rejectUrl: rejectUrl });
  var html = renderTemplate_('Emails_Approval', data);
  return sendEmailSafe_({
    to: safeString_(record[H.RECORD.APPROVER_EMAIL]),
    subject: 'طلب موافقة على التدوير المعرفي / Knowledge Rotation Approval Request - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'approval', requestId: record[H.RECORD.REQUEST_ID] });
}

function groupApprovalRecordsByRecipient_(records) {
  var groups = {};
  (records || []).forEach(function(record) {
    var recipient = safeString_(record[H.RECORD.APPROVER_EMAIL]);
    var key = normalizeKey_(recipient) || ('missing:' + safeString_(record[H.RECORD.REQUEST_ID]));
    if (!groups[key]) groups[key] = { recipient: recipient, records: [] };
    groups[key].records.push(record);
  });
  return Object.keys(groups).map(function(key) { return groups[key]; });
}

function buildApprovalGroupContext_(records) {
  records = (records || []).slice().sort(function(left, right) {
    return toNumber_(left[H.RECORD.OPTION_ORDER], 0) - toNumber_(right[H.RECORD.OPTION_ORDER], 0);
  });
  return {
    kind: 'approval_group',
    requestGroupId: records.length ? safeString_(records[0][H.RECORD.REQUEST_GROUP_ID]) : '',
    requestIds: records.map(function(record) { return safeString_(record[H.RECORD.REQUEST_ID]); })
  };
}

function buildGroupedApprovalPayload_(records, recipient) {
  var data = buildGroupedRequestTemplateData_(records, {});
  data.requests.forEach(function(request) {
    request.approveUrl = makeWebAppUrl_('approve', request.record[H.RECORD.TOKEN]);
    request.rejectUrl = makeWebAppUrl_('reject', request.record[H.RECORD.TOKEN]);
  });
  var groupId = safeString_(records[0][H.RECORD.REQUEST_GROUP_ID]);
  return {
    to: safeString_(recipient),
    subject: 'طلبات موافقة التدوير المعرفي / Knowledge Rotation Approval Requests - ' +
      groupId + ' (' + records.length + ')',
    htmlBody: renderTemplate_('Emails_Approval', data)
  };
}

function markApprovalGroupDelivery_(records, sent) {
  var deliveredAt = sent ? now_() : '';
  (records || []).forEach(function(record) {
    var updates = sent
      ? {
          [H.RECORD.APPROVAL_EMAIL_SENT_AT]: deliveredAt,
          [H.RECORD.EMAIL_RETRY_COUNT]: 0
        }
      : {
          [H.RECORD.EMAIL_RETRY_COUNT]: toNumber_(record[H.RECORD.EMAIL_RETRY_COUNT], 0) + 1
        };
    if (record._rowNumber) updateRequestByRow_(record._rowNumber, updates);
    Object.keys(updates).forEach(function(header) { record[header] = updates[header]; });
  });
}

function sendGroupedApprovalEmails_(records) {
  var result = { groups: 0, sent: 0, queued: 0, records: 0 };
  groupApprovalRecordsByRecipient_(records).forEach(function(group) {
    if (!group.records.length) return;
    var context = buildApprovalGroupContext_(group.records);
    var sent = sendEmailSafe_(
      buildGroupedApprovalPayload_(group.records, group.recipient),
      context
    );
    markApprovalGroupDelivery_(group.records, sent);
    result.groups++;
    result.records += group.records.length;
    if (sent) result.sent++;
    else result.queued++;
  });
  return result;
}


function sendSubmissionConfirmationEmail(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_Submitted', data);
  return sendEmailSafe_({
    to: safeString_(record[H.RECORD.DIRECT_MANAGER_EMAIL]),
    cc: uniqueNonEmpty_([record[H.RECORD.EMPLOYEE_EMAIL]]).join(','),
    subject: 'تم استلام طلب التدوير المعرفي / Knowledge Rotation Request Submitted - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  }, { kind: 'submitted', requestId: record[H.RECORD.REQUEST_ID] });
}

function sendGroupedSubmissionConfirmationEmail_(records) {
  records = (records || []).slice().sort(function(left, right) {
    return toNumber_(left[H.RECORD.OPTION_ORDER], 0) - toNumber_(right[H.RECORD.OPTION_ORDER], 0);
  });
  if (!records.length) return false;
  var first = records[0];
  var data = buildGroupedRequestTemplateData_(records, {});
  var html = renderTemplate_('Emails_Submitted', data);
  return sendEmailSafe_({
    to: safeString_(first[H.RECORD.DIRECT_MANAGER_EMAIL]),
    cc: uniqueNonEmpty_([first[H.RECORD.EMPLOYEE_EMAIL]]).join(','),
    subject: 'تم استلام طلبات التدوير المعرفي / Knowledge Rotation Requests Submitted - ' +
      safeString_(first[H.RECORD.REQUEST_GROUP_ID]) + ' (' + records.length + ')',
    htmlBody: html
  }, {
    kind: 'submitted_group',
    requestGroupId: safeString_(first[H.RECORD.REQUEST_GROUP_ID]),
    requestIds: records.map(function(record) { return safeString_(record[H.RECORD.REQUEST_ID]); })
  });
}


function isEmployeeCorrectionSubmissionError_(error) {
  return Boolean(
    error &&
    error.code === 'SUBMISSION_VALIDATION' &&
    error.recipientPolicy === 'EMPLOYEE_CORRECTION'
  );
}

function getRotationOptionDate_(option, isStart) {
  option = option || {};
  return isStart
    ? (option.fromDate || option.startDate)
    : (option.toDate || option.endDate);
}

function formatRotationConflictSelection_(option, fallbackNumber) {
  var number = toNumber_(option && option.optionOrder, fallbackNumber);
  var location = [
    safeString_(option && option.rotationUnit),
    safeString_(option && option.section)
  ].filter(Boolean).join(' — ');
  var range = formatDate_(getRotationOptionDate_(option, true)) + ' — ' +
    formatDate_(getRotationOptionDate_(option, false));
  return 'Rotation Selection ' + number + ': ' + location + ' (' + range + ')';
}

function buildSubmissionOverlapRows_(rotationOptions) {
  var rows = [];
  rotationOptions = rotationOptions || [];
  for (var i = 0; i < rotationOptions.length; i++) {
    var firstStart = dateOnly_(getRotationOptionDate_(rotationOptions[i], true));
    var firstEnd = dateOnly_(getRotationOptionDate_(rotationOptions[i], false));
    if (!firstStart || !firstEnd) continue;
    for (var j = i + 1; j < rotationOptions.length; j++) {
      var secondStart = dateOnly_(getRotationOptionDate_(rotationOptions[j], true));
      var secondEnd = dateOnly_(getRotationOptionDate_(rotationOptions[j], false));
      if (!secondStart || !secondEnd ||
          !isDateRangeOverlap_(firstStart, firstEnd, secondStart, secondEnd)) continue;
      var conflictNumber = (rows.length / 2) + 1;
      var overlapStart = new Date(Math.max(firstStart.getTime(), secondStart.getTime()));
      var overlapEnd = new Date(Math.min(firstEnd.getTime(), secondEnd.getTime()));
      rows.push({
        ar: 'التدويرات المتعارضة ' + conflictNumber,
        en: 'Conflicting Rotations ' + conflictNumber,
        value: formatRotationConflictSelection_(rotationOptions[i], i + 1) +
          ' ↔ ' + formatRotationConflictSelection_(rotationOptions[j], j + 1)
      });
      rows.push({
        ar: 'فترة تداخل التواريخ ' + conflictNumber,
        en: 'Overlapping Date Range ' + conflictNumber,
        value: formatDate_(overlapStart) + ' — ' + formatDate_(overlapEnd)
      });
    }
  }
  return rows;
}

function buildEmployeeCorrectionRecipients_(data) {
  data = data || {};
  return uniqueNonEmpty_([
    data.directManagerEmail || data.submitterEmail,
    data.employeeEmail
  ]).join(',');
}

function sendInvalidDatesSubmissionEmail(data, responseId, error) {
  data = data || {};
  var cfg = getConfig();
  var employeeCorrection = isEmployeeCorrectionSubmissionError_(error);
  var rotationOptions = normalizeRotationOptionsFromSubmission_(data);
  var validationRows = [
    { ar: 'اسم الموظف', en: 'Employee Name', value: data.employeeName || '' },
    { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: data.employeeId || '' },
    { ar: 'المسمى الوظيفي للموظف', en: 'Employee Job Title', value: data.employeeJobTitle || '' },
    { ar: 'المسؤول المباشر', en: 'Line Manager', value: data.directManagerName || '' },
    { ar: 'الوحدة الحالية', en: 'Current Unit', value: data.currentUnit || '' },
    { ar: 'القسم الحالي للموظف', en: 'Current Employee Section', value: data.currentDepartment || '' }
  ];
  rotationOptions.forEach(function(option, index) {
    var number = toNumber_(option.optionOrder, index + 1);
    validationRows.push({ ar: 'وحدة التدوير ' + number, en: 'Rotation Unit ' + number, value: option.rotationUnit });
    validationRows.push({ ar: 'قسم التدوير ' + number, en: 'Rotation Section ' + number, value: option.section });
    validationRows.push({ ar: 'من تاريخ ' + number, en: 'Start Date ' + number, value: formatDate_(getRotationOptionDate_(option, true)) });
    validationRows.push({ ar: 'إلى تاريخ ' + number, en: 'End Date ' + number, value: formatDate_(getRotationOptionDate_(option, false)) });
    validationRows.push({
      ar: 'عدد ساعات التدوير اليومية المطلوبة ' + number,
      en: 'Required Daily Rotation Hours ' + number,
      value: option.hours
    });
  });
  if (employeeCorrection) {
    validationRows.push({
      ar: 'نوع التعارض',
      en: 'Conflict Type',
      value: 'تداخل في تواريخ التدوير / Overlapping rotation dates'
    });
    validationRows = validationRows.concat(buildSubmissionOverlapRows_(rotationOptions));
  }
  validationRows.push({ ar: 'سبب عدم المعالجة', en: 'Processing Error', value: error && error.message ? error.message : safeString_(error) });
  var templateData = {
    brand: cfg.BRAND,
    orgAr: cfg.ORGANIZATION_NAME_AR,
    orgEn: cfg.ORGANIZATION_NAME_EN,
    responseId: responseId || '',
    errorMessage: error && error.message ? error.message : safeString_(error),
    isEmployeeCorrection: employeeCorrection,
    rows: removeEmptyEmailRows_(validationRows)
  };
  var html = renderTemplate_('Emails_InvalidDates', templateData);
  var context = {
    kind: 'invalid_dates_submission',
    requestId: responseId || '',
    recipientPolicy: employeeCorrection ? 'EMPLOYEE_CORRECTION' : 'EMPLOYEE_SERVICES',
    directManagerEmail: safeString_(data.directManagerEmail || data.submitterEmail),
    employeeEmail: safeString_(data.employeeEmail)
  };
  return sendEmailSafe_({
    to: employeeCorrection ? buildEmployeeCorrectionRecipients_(data) : SUBMISSION_REVIEW_EMAIL_TO,
    cc: employeeCorrection ? '' : SUBMISSION_REVIEW_EMAIL_CC,
    subject: employeeCorrection
      ? 'يلزم تصحيح تداخل تواريخ التدوير المعرفي / Knowledge Rotation Date Overlap Requires Correction'
      : 'تعذر معالجة طلب التدوير المعرفي / Knowledge Rotation Submission Requires Review',
    htmlBody: html
  }, context);
}

function buildApprovedNotificationPayload_(record) {
  var data = buildTemplateData_(record, {});
  var html = renderTemplate_('Emails_Approved', data);
  return {
    to: uniqueNonEmpty_([record[H.RECORD.DIRECT_MANAGER_EMAIL], record[H.RECORD.EMPLOYEE_EMAIL]]).join(','),
    cc: uniqueNonEmpty_([record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL], record[H.RECORD.APPROVER_EMAIL]]).join(','),
    subject: 'طلب التدوير المعرفي / Knowledge Rotation Request - موافقة رئيس الوحدة بانتظار الاعتماد النهائي / Unit Head Approved Pending Final Approval - ' + record[H.RECORD.REQUEST_ID],
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
    subject: 'تم رفض طلب التدوير المعرفي / Knowledge Rotation Request Rejected - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendRejectedNotification(record) {
  return sendEmailSafe_(buildRejectedNotificationPayload_(record), { kind: 'rejected', requestId: record[H.RECORD.REQUEST_ID] });
}

function queueRejectedNotification(record) {
  return queueEmailForLater_(buildRejectedNotificationPayload_(record), { kind: 'rejected', requestId: record[H.RECORD.REQUEST_ID] });
}

function buildFinalApprovedNotificationPayload_(record, validatedSectionHeadContext) {
  var sectionHeadContext = resolveRotationSectionHeadNotificationContext_(
    record,
    validatedSectionHeadContext
  );
  if (!sectionHeadContext.isValid) {
    throw new Error('Section-head email validation failed before final-approved payload construction.');
  }
  var data = buildTemplateData_(record, {
    sectionHeadLetter: sectionHeadContext.letter
  });
  var html = renderTemplate_('Emails_FinalApproved', data);
  var toRecipients = uniqueEmailRecipients_([
    record[H.RECORD.EMPLOYEE_EMAIL],
    record[H.RECORD.DIRECT_MANAGER_EMAIL],
    record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL]
  ].concat(sectionHeadContext.emails));
  return {
    to: toRecipients.join(','),
    cc: '',
    subject: 'تم الاعتماد النهائي لطلب التدوير المعرفي / Knowledge Rotation Request Finally Approved - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function buildSectionHeadLetterData_(record, section) {
  section = section || {};
  return {
    nameAr: safeString_(section.headNameAr) || 'رئيس القسم',
    nameEn: safeString_(section.headNameEn) || 'Section Head',
    salutationAr: safeString_(section.headSalutationAr) || 'المحترم/المحترمة',
    jobTitleAr: safeString_(section.headJobTitleAr) || 'رئيس القسم',
    jobTitleEn: safeString_(section.headJobTitleEn) || 'Head of Section',
    unitName: safeString_(section.unitName) ||
      safeString_(record && record[H.RECORD.ROTATION_UNIT]) ||
      'وحدة التدوير'
  };
}

function resolveRotationSectionHeadNotificationContext_(record, suppliedContext) {
  if (suppliedContext && typeof suppliedContext === 'object' &&
      !Array.isArray(suppliedContext) && typeof suppliedContext.isValid === 'boolean') {
    var trustedContext = suppliedContext;
    trustedContext.section = trustedContext.section || findSectionByUnitAndName_(
      record && record[H.RECORD.ROTATION_UNIT],
      record && record[H.RECORD.SECTION]
    );
    trustedContext.letter = trustedContext.letter ||
      buildSectionHeadLetterData_(record, trustedContext.section);
    return trustedContext;
  }

  var resolvedContext = getRotationSectionHeadEmailValidation_(record);
  if (suppliedContext === null || typeof suppliedContext === 'undefined') {
    return resolvedContext;
  }

  var suppliedValidation = validateEmailList_(Array.isArray(suppliedContext)
    ? suppliedContext.join(',')
    : suppliedContext);
  suppliedValidation.reason = suppliedValidation.isBlank
    ? 'EMAIL_MISSING'
    : (suppliedValidation.isValid ? '' : 'EMAIL_INVALID');
  suppliedValidation.unitName = resolvedContext.unitName;
  suppliedValidation.sectionName = resolvedContext.sectionName;
  suppliedValidation.section = resolvedContext.section;
  suppliedValidation.letter = resolvedContext.letter;
  return suppliedValidation;
}

function getRotationSectionHeadEmailValidation_(record) {
  var unitName = safeString_(record && record[H.RECORD.ROTATION_UNIT]);
  var sectionName = safeString_(record && record[H.RECORD.SECTION]);
  var section = findSectionByUnitAndName_(unitName, sectionName);
  if (!section) {
    return {
      isValid: false,
      reason: 'SECTION_NOT_FOUND',
      unitName: unitName,
      sectionName: sectionName,
      raw: '',
      emails: [],
      validEmails: [],
      invalidEmails: [],
      emptyEntryPositions: [],
      hasEmptyEntries: false,
      isBlank: true,
      normalized: '',
      section: null,
      letter: buildSectionHeadLetterData_(record, null)
    };
  }

  var validation = validateEmailList_(section.headEmail);
  validation.reason = validation.isBlank
    ? 'EMAIL_MISSING'
    : (validation.isValid ? '' : 'EMAIL_INVALID');
  validation.unitName = unitName;
  validation.sectionName = sectionName;
  validation.section = section;
  validation.letter = buildSectionHeadLetterData_(record, section);
  return validation;
}

function getRotationSectionHeadEmail_(record) {
  var validation = getRotationSectionHeadEmailValidation_(record);
  return validation.isValid ? validation.normalized : '';
}

function sendFinalApprovedNotification(record, validatedSectionHeadContext) {
  var validation = resolveRotationSectionHeadNotificationContext_(
    record,
    validatedSectionHeadContext
  );
  if (!validation.isValid) {
    logError_(
      'sendFinalApprovedNotification:sectionHeadEmailValidation',
      record && record[H.RECORD.REQUEST_ID],
      new Error('Final-approved email blocked because the section-head email list is invalid.')
    );
    return false;
  }
  return sendEmailSafe_(
    buildFinalApprovedNotificationPayload_(record, validation),
    { kind: 'final_approved', requestId: record[H.RECORD.REQUEST_ID] }
  ) === true;
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
    subject: 'تم رفض طلب التدوير المعرفي / Knowledge Rotation Request Rejected - ' + record[H.RECORD.REQUEST_ID],
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
    subject: 'تم رفض طلب التدوير المعرفي / Knowledge Rotation Request Rejected - تدوير معرفي نشط / active knowledge rotation - ' + record[H.RECORD.REQUEST_ID],
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
    to: uniqueNonEmpty_([
      record[H.RECORD.DIRECT_MANAGER_EMAIL],
      record[H.RECORD.EMPLOYEE_EMAIL]
    ]).join(','),
    cc: '',
    subject: 'طلب التدوير المعرفي / Knowledge Rotation Request - تعارض / Conflict - ' + record[H.RECORD.REQUEST_ID],
    htmlBody: html
  };
}

function sendConflictNotification(record, conflict, source) {
  return sendEmailSafe_(buildConflictNotificationPayload_(record, conflict, source), { kind: 'conflict', requestId: record[H.RECORD.REQUEST_ID] });
}

function queueConflictNotification(record, conflict, source) {
  return queueEmailForLater_(buildConflictNotificationPayload_(record, conflict, source), { kind: 'conflict', requestId: record[H.RECORD.REQUEST_ID] });
}

function sendEvaluationEmail(record, evaluationUrl) {
  evaluationUrl = safeString_(evaluationUrl) ||
    safeString_(record[H.RECORD.EVALUATION_LINK]) ||
    buildEvaluationPrefilledUrl_(record);
  var data = buildTemplateData_(record, { evaluationUrl: evaluationUrl });
  var html = renderTemplate_('Emails_Evaluation', data);
  var context = { kind: 'evaluation', requestId: record[H.RECORD.REQUEST_ID] };
  var rotationNumber = safeString_(record[H.RECORD.OPTION_ORDER]);
  var rotationSuffix = rotationNumber ? ' - التدوير ' + rotationNumber + ' / Rotation ' + rotationNumber : '';
  var sent = sendEmailSafe_({
    to: safeString_(record[H.RECORD.EMPLOYEE_EMAIL]),
    subject: 'تقييم تجربة التدوير المعرفي / Knowledge Rotation Experience Evaluation - ' +
      record[H.RECORD.REQUEST_ID] + rotationSuffix,
    htmlBody: html
  }, context);
  return sent || isEmailContextQueued_(context);
}

function isEmailContextQueued_(context) {
  var sheet = getOrCreateSheet_(SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(sheet, QUEUE_HEADERS);
  return Boolean(findObjectByValue_(sheet, H.QUEUE.CONTEXT_JSON, objectToJson_(context || {})));
}

function sendEmailSafe_(payload, context) {
  payload = applyEmailRecipientPolicy_(payload, context);
  try {
    if (!safeString_(payload.to)) throw new Error('Email recipient is empty.');
    MailApp.sendEmail(buildEmailMessage_(payload));
    logInfo_('sendEmailSafe_:' + (context && context.kind || ''), context && context.requestId, 'Email sent to: ' + payload.to);
    return true;
  } catch (err) {
    queueEmail_(payload, context, err);
    logError_('sendEmailSafe_:' + (context && context.kind || ''), context && context.requestId, err);
    return false;
  }
}

function applyEmailRecipientPolicy_(payload, context) {
  var routedPayload = Object.assign({}, payload || {});
  ['subject', 'body', 'htmlBody'].forEach(function(field) {
    if (typeof routedPayload[field] !== 'string') return;
    routedPayload[field] = routedPayload[field]
      .replace(/التدوير الوظيفي/g, 'التدوير المعرفي')
      .replace(/تدوير وظيفي/g, 'تدوير معرفي')
      .replace(/job rotation/gi, function(match) {
        return match.charAt(0) === 'J' ? 'Knowledge Rotation' : 'knowledge rotation';
      });
  });
  if (context && context.kind === 'invalid_dates_submission') {
    if (context.recipientPolicy === 'EMPLOYEE_CORRECTION') {
      routedPayload.to = uniqueNonEmpty_([
        context.directManagerEmail,
        context.employeeEmail
      ]).join(',');
      routedPayload.cc = '';
    } else {
      routedPayload.to = SUBMISSION_REVIEW_EMAIL_TO;
      routedPayload.cc = SUBMISSION_REVIEW_EMAIL_CC;
    }
    routedPayload.bcc = '';
  }
  return applyEmployeeServicesCopyPolicy_(routedPayload);
}

function applyEmployeeServicesCopyPolicy_(payload) {
  var routedPayload = Object.assign({}, payload || {});
  var employeeServicesKey = normalizeEmail_(EMPLOYEE_SERVICES_COPY_EMAIL);
  var toRecipients = uniqueEmailRecipients_(splitCsv_(routedPayload.to));
  var isDirectRecipient = toRecipients.some(function(email) {
    return normalizeEmail_(email) === employeeServicesKey;
  });
  var ccRecipients = uniqueEmailRecipients_(splitCsv_(routedPayload.cc)).filter(function(email) {
    return normalizeEmail_(email) !== employeeServicesKey;
  });
  var bccRecipients = uniqueEmailRecipients_(splitCsv_(routedPayload.bcc)).filter(function(email) {
    return normalizeEmail_(email) !== employeeServicesKey;
  });

  if (!isDirectRecipient) ccRecipients.push(EMPLOYEE_SERVICES_COPY_EMAIL);
  routedPayload.to = toRecipients.join(',');
  routedPayload.cc = uniqueEmailRecipients_(ccRecipients).join(',');
  routedPayload.bcc = bccRecipients.join(',');
  return routedPayload;
}

function uniqueEmailRecipients_(recipients) {
  var seen = {};
  var result = [];
  (recipients || []).forEach(function(recipient) {
    var value = safeString_(recipient);
    var key = normalizeEmail_(value);
    if (!key || seen[key]) return;
    seen[key] = true;
    result.push(value);
  });
  return result;
}

function buildEmailMessage_(payload) {
  payload = applyEmployeeServicesCopyPolicy_(payload || {});
  var message = {
    to: payload.to || '',
    cc: payload.cc || '',
    bcc: payload.bcc || '',
    subject: payload.subject || '',
    body: payload.body || 'يرجى عرض هذه الرسالة بصيغة HTML. / Please view this message in HTML.',
    htmlBody: payload.htmlBody || ''
  };
  // Keep the workflow identity independent of legacy Script Properties or
  // hidden settings such as "SQU Training System".
  var senderName = EMAIL_SENDER_DISPLAY_NAME;
  if (senderName) message.name = senderName;
  return message;
}

function queueEmailForLater_(payload, context) {
  payload = applyEmailRecipientPolicy_(payload, context);
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
  payload = applyEmailRecipientPolicy_(payload, context);
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
      var queuedPayload = applyEmailRecipientPolicy_({
        to: safeString_(row[H.QUEUE.TO]),
        cc: safeString_(row[H.QUEUE.CC]),
        bcc: safeString_(row[H.QUEUE.BCC]),
        subject: safeString_(row[H.QUEUE.SUBJECT]),
        htmlBody: safeString_(row[H.QUEUE.HTML])
      }, context);
      var message = buildEmailMessage_(queuedPayload);
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
      } else if (context.kind === 'approval_group' && Array.isArray(context.requestIds)) {
        var groupDeliveredAt = now_();
        context.requestIds.forEach(function(requestId) {
          var groupedRecord = getRequestById_(requestId);
          if (!groupedRecord) return;
          updateRequestByRow_(groupedRecord._rowNumber, {
            [H.RECORD.APPROVAL_EMAIL_SENT_AT]: groupDeliveredAt,
            [H.RECORD.EMAIL_RETRY_COUNT]: 0
          });
        });
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
