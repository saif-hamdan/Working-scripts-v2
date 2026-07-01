/** Request creation, retrieval, and updates. */
function createRequestFromFormSubmit(e) {
  logWarn_('createRequestFromFormSubmit', '', 'Direct form-submit request creation is disabled. Use processUnprocessedFormResponses() to create requests from the linked response-sheet queue.');
  return null;
}

function createRequestFromNormalizedData_(data, sourceInfo) {
  setupSheets();
  data = data || {};
  sourceInfo = sourceInfo || buildRequestSourceInfo_(data);
  if (sourceInfo.responseId) data.responseId = sourceInfo.responseId;
  if (sourceInfo.responseSourceId) data.responseSourceId = sourceInfo.responseSourceId;
  validateSubmissionData_(data);

  if (data.responseId) {
    var existingRecord = findRequestByResponseId_(data.responseId);
    if (existingRecord) {
      logInfo_('createRequestFromNormalizedData_:idempotent', existingRecord[H.RECORD.REQUEST_ID] || '', 'Request already exists for form response ' + data.responseId + '; skipping duplicate creation.');
      return existingRecord;
    }
  }

  if (data.responseSourceId) {
    var existingSourceRecord = findRequestByResponseSourceId_(data.responseSourceId);
    if (existingSourceRecord) {
      logInfo_('createRequestFromNormalizedData_:sourceIdempotent', existingSourceRecord[H.RECORD.REQUEST_ID] || '', 'Request already exists for response source ' + data.responseSourceId + '; skipping duplicate creation.');
      return existingSourceRecord;
    }
  }

  var currentUnit = findUnitByName_(data.currentUnit) || { name: data.currentUnit, headName: '', headEmail: '' };
  var trainingUnit = findUnitByName_(data.trainingUnit) || { name: data.trainingUnit, headName: '', headEmail: '' };
  var approver = getApproverForRequest_(data.currentUnit, data.trainingUnit);
  var requestId = makeRequestId_();
  var token = generateToken_();
  var type = normalizeKey_(data.currentUnit) === normalizeKey_(data.trainingUnit) ? STATUS.TYPE_INTERNAL : STATUS.TYPE_EXTERNAL;

  var record = {};
  record[H.RECORD.REQUEST_ID] = requestId;
  record[H.RECORD.TIMESTAMP] = now_();
  record[H.RECORD.SUBMITTER_EMAIL] = data.submitterEmail || data.directManagerEmail;
  record[H.RECORD.DIRECT_MANAGER_NAME] = data.directManagerName;
  record[H.RECORD.DIRECT_MANAGER_EMAIL] = data.directManagerEmail;
  record[H.RECORD.EMPLOYEE_NAME] = data.employeeName;
  record[H.RECORD.EMPLOYEE_EMAIL] = data.employeeEmail;
  record[H.RECORD.CURRENT_UNIT] = data.currentUnit;
  record[H.RECORD.CURRENT_UNIT_HEAD] = currentUnit.headName;
  record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL] = currentUnit.headEmail;
  record[H.RECORD.TRAINING_UNIT] = data.trainingUnit;
  record[H.RECORD.SECTION] = data.section;
  record[H.RECORD.START_DATE] = dateOnly_(data.startDate);
  record[H.RECORD.END_DATE] = dateOnly_(data.endDate);
  record[H.RECORD.HOURS] = data.hours;
  record[H.RECORD.TYPE] = type;
  record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_PENDING;
  record[H.RECORD.REJECTION_REASON] = '';
  record[H.RECORD.CONFLICT_ID] = '';
  record[H.RECORD.CONFLICT_DETAILS] = '';
  record[H.RECORD.APPROVAL_EMAIL_SENT_AT] = '';
  record[H.RECORD.DECISION_DATE] = '';
  record[H.RECORD.EVALUATION_LINK] = getConfig().EVALUATION_FORM_URL;
  record[H.RECORD.EVALUATION_SENT] = STATUS.NO;
  record[H.RECORD.EVALUATION_SENT_AT] = '';
  record[H.RECORD.LAST_UPDATED] = now_();
  record[H.RECORD.NOTES] = data.notes;
  record[H.RECORD.TOKEN] = token;
  record[H.RECORD.APPROVER_EMAIL] = approver.headEmail;
  record[H.RECORD.FORM_RESPONSE_ID] = data.responseId;
  record[H.RECORD.LOCK_VERSION] = 1;
  record[H.RECORD.EMAIL_RETRY_COUNT] = 0;
  record[H.RECORD.LAST_ERROR] = '';
  record[H.RECORD.FORM_RESPONSE_SOURCE_ID] = data.responseSourceId;

  var activeTraining = findActiveTrainingByEmployee_(data.employeeEmail, data.employeeName, requestId);
  var conflict = null;

  if (activeTraining) {
    record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_EMPLOYEE_ACTIVE;
    record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_EMPLOYEE_ACTIVE;
    record[H.RECORD.REJECTION_REASON] = buildActiveEmployeeRejectionReason_(activeTraining);
    record[H.RECORD.CONFLICT_ID] = activeTraining[H.RECORD.REQUEST_ID];
    record[H.RECORD.CONFLICT_DETAILS] = formatActiveTrainingDetails_(activeTraining);
    record[H.RECORD.DECISION_DATE] = now_();
  } else {
    conflict = findConflicts({
      trainingUnit: data.trainingUnit,
      section: data.section,
      startDate: data.startDate,
      endDate: data.endDate,
      excludeRequestId: requestId
    });
  }

  if (conflict) {
    record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_CONFLICT;
    record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_CONFLICT;
    record[H.RECORD.CONFLICT_ID] = conflict[H.RECORD.REQUEST_ID];
    record[H.RECORD.CONFLICT_DETAILS] = formatConflictDetails_(conflict);
    record[H.RECORD.DECISION_DATE] = now_();
  }

  var sheet = getOrCreateSheet_(SHEETS.RECORDS);
  requireHeaders_(sheet, RECORD_HEADERS);
  var rowNumber = appendObjectRow_(sheet, RECORD_HEADERS, record);
  record._rowNumber = rowNumber;

  if (activeTraining) {
    sendActiveEmployeeRejectedNotification(record, activeTraining);
    logInfo_('createRequestFromNormalizedData_:activeEmployeeRejected', requestId, 'Request rejected because employee already has active approved training.');
  } else if (conflict) {
    sendConflictNotification(record, conflict, 'submission');
    logInfo_('createRequestFromNormalizedData_:conflict', requestId, 'Request rejected at submission because of conflict.');
  } else {
    var sent = sendApprovalEmail(record);
    if (sent) updateRequestByRow_(rowNumber, { [H.RECORD.APPROVAL_EMAIL_SENT_AT]: now_() });
    sendSubmissionConfirmationEmail(record);
    logInfo_('createRequestFromNormalizedData_', requestId, 'Request created and approval email processed.');
  }

  refreshDashboard();
  refreshCharts();
  refreshFormChoices();
  return record;
}

function parseFormSubmission_(e) {
  var named = {};
  var submitterEmail = '';
  var responseId = '';

  if (e && e.namedValues) {
    named = e.namedValues;
  }

  if (e && e.responseId) responseId = safeString_(e.responseId);

  if (e && e.response) {
    var response = e.response;
    try { submitterEmail = response.getRespondentEmail() || ''; } catch (ignore) {}
    try { responseId = response.getId ? response.getId() : ''; } catch (ignore2) {}
    try { named.Timestamp = [response.getTimestamp ? response.getTimestamp() : '']; } catch (ignore3) {}
    response.getItemResponses().forEach(function(ir) {
      var title = ir.getItem().getTitle();
      named[title] = [ir.getResponse()];
    });
  }

  function val(title) {
    var v = named[title];
    if (Array.isArray(v)) return v.length ? v[0] : '';
    return v || '';
  }

  function firstNonEmpty(titles) {
    for (var i = 0; i < titles.length; i++) {
      var s = safeString_(val(titles[i]));
      if (s) return s;
    }
    return '';
  }

  var section = '';
  Object.keys(named).forEach(function(key) {
    if (section) return;
    if (key.indexOf(FORM.SECTION_QUESTION_PREFIX) === 0 || normalizeKey_(key).indexOf('section') !== -1 || key.indexOf('القسم المطلوب') !== -1) {
      var candidate = safeString_(val(key));
      if (candidate) section = candidate;
    }
  });

  var parsed = {
    timestamp: firstNonEmpty(['Timestamp', 'الطابع الزمني']),
    submitterEmail: submitterEmail || firstNonEmpty(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    directManagerName: firstNonEmpty([FORM.TITLES.DIRECT_MANAGER_NAME, 'اسم المدير المباشر']),
    directManagerEmail: firstNonEmpty([FORM.TITLES.DIRECT_MANAGER_EMAIL, 'بريد المدير المباشر']),
    employeeName: firstNonEmpty([FORM.TITLES.EMPLOYEE_NAME, 'اسم الموظف الجديد']),
    employeeEmail: firstNonEmpty([FORM.TITLES.EMPLOYEE_EMAIL, 'بريد الموظف الجديد']),
    currentUnit: firstNonEmpty([FORM.TITLES.CURRENT_UNIT, 'الوحدة الحالية للموظف']),
    trainingUnit: firstNonEmpty([FORM.TITLES.TRAINING_UNIT, 'وحدة التدريب المطلوبة']),
    section: section,
    startDate: parseDateFlexible_(firstNonEmpty([FORM.TITLES.START_DATE, 'من تاريخ'])),
    endDate: parseDateFlexible_(firstNonEmpty([FORM.TITLES.END_DATE, 'إلى تاريخ'])),
    hours: firstNonEmpty([FORM.TITLES.HOURS, 'عدد الساعات']),
    notes: firstNonEmpty([FORM.TITLES.NOTES, 'ملاحظات']),
    responseId: responseId,
    responseSourceId: e && e.responseSourceId ? safeString_(e.responseSourceId) : ''
  };

  if (!parsed.responseSourceId) parsed.responseSourceId = makeFormResponseSourceId_(parsed);
  return parsed;
}

function parseLinkedResponseRow_(headers, row) {
  headers = headers || [];
  row = row || [];

  function val(title) {
    for (var i = 0; i < headers.length; i++) {
      if (safeString_(headers[i]) === title) return row[i];
    }
    return '';
  }

  function firstNonEmpty(titles) {
    for (var i = 0; i < titles.length; i++) {
      var s = safeString_(val(titles[i]));
      if (s) return s;
    }
    return '';
  }

  var section = '';
  headers.forEach(function(header, index) {
    header = safeString_(header);
    if (section || !header) return;
    if (header.indexOf(FORM.SECTION_QUESTION_PREFIX) === 0 || normalizeKey_(header).indexOf('section') !== -1 || header.indexOf('القسم المطلوب') !== -1) {
      var candidate = safeString_(row[index]);
      if (candidate) section = candidate;
    }
  });

  var parsed = {
    timestamp: firstNonEmpty(['Timestamp', 'الطابع الزمني']),
    submitterEmail: firstNonEmpty(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    directManagerName: firstNonEmpty([FORM.TITLES.DIRECT_MANAGER_NAME, 'اسم المدير المباشر']),
    directManagerEmail: firstNonEmpty([FORM.TITLES.DIRECT_MANAGER_EMAIL, 'بريد المدير المباشر']),
    employeeName: firstNonEmpty([FORM.TITLES.EMPLOYEE_NAME, 'اسم الموظف الجديد']),
    employeeEmail: firstNonEmpty([FORM.TITLES.EMPLOYEE_EMAIL, 'بريد الموظف الجديد']),
    currentUnit: firstNonEmpty([FORM.TITLES.CURRENT_UNIT, 'الوحدة الحالية للموظف']),
    trainingUnit: firstNonEmpty([FORM.TITLES.TRAINING_UNIT, 'وحدة التدريب المطلوبة']),
    section: section,
    startDate: parseDateFlexible_(firstNonEmpty([FORM.TITLES.START_DATE, 'من تاريخ'])),
    endDate: parseDateFlexible_(firstNonEmpty([FORM.TITLES.END_DATE, 'إلى تاريخ'])),
    hours: firstNonEmpty([FORM.TITLES.HOURS, 'عدد الساعات']),
    notes: firstNonEmpty([FORM.TITLES.NOTES, 'ملاحظات']),
    responseId: '',
    responseSourceId: ''
  };

  parsed.responseSourceId = makeFormResponseSourceId_(parsed);
  return parsed;
}

function buildRequestSourceInfo_(data) {
  data = data || {};
  return {
    responseId: data.responseId || '',
    responseSourceId: data.responseSourceId || '',
    timestamp: data.timestamp || ''
  };
}

function createRequestFromFormData_(e) {
  var data = parseFormSubmission_(e);
  return createRequestFromNormalizedData_(data);
}

function validateSubmissionData_(data) {
  throwIfMissing_(data.directManagerName, 'Direct manager name is missing.');
  throwIfMissing_(data.directManagerEmail, 'Direct manager email is missing.');
  throwIfMissing_(data.employeeName, 'Employee name is missing.');
  throwIfMissing_(data.employeeEmail, 'Employee email is missing.');
  throwIfMissing_(data.currentUnit, 'Current unit is missing.');
  throwIfMissing_(data.trainingUnit, 'Requested training unit is missing.');
  throwIfMissing_(data.section, 'Requested section is missing.');
  if (data.section === FORM.NO_AVAILABLE_SECTIONS) throw new Error('No available section was selected.');
  if (!data.startDate || !data.endDate) throw new Error('Start date or end date is invalid.');
  if (dateOnly_(data.startDate).getTime() > dateOnly_(data.endDate).getTime()) throw new Error('Start date cannot be after end date.');
}

function buildActiveEmployeeRejectionReason_(activeTraining) {
  return [
    'تم رفض الطلب تلقائياً لأن الموظف لديه تدريب معتمد ونشط حالياً.',
    'The request was automatically rejected because the employee currently has active approved training.',
    'رقم الطلب النشط / Active request ID: ' + safeString_(activeTraining[H.RECORD.REQUEST_ID])
  ].join('\n');
}

function getRequestByToken_(token) {
  return findObjectByValue_(getOrCreateSheet_(SHEETS.RECORDS), H.RECORD.TOKEN, token);
}

function getRequestById_(requestId) {
  return findObjectByValue_(getOrCreateSheet_(SHEETS.RECORDS), H.RECORD.REQUEST_ID, requestId);
}

function updateRequestByRow_(rowNumber, updates) {
  updates[H.RECORD.LAST_UPDATED] = now_();
  updateObjectRow_(getOrCreateSheet_(SHEETS.RECORDS), rowNumber, updates);
}

function updateRequestById_(requestId, updates) {
  var sheet = getOrCreateSheet_(SHEETS.RECORDS);
  var row = findRowByValue_(sheet, H.RECORD.REQUEST_ID, requestId);
  if (!row) throw new Error('Request not found: ' + requestId);
  updateRequestByRow_(row, updates);
}

function isRecordActiveOrApproved_(record) {
  var head = safeString_(record[H.RECORD.HEAD_STATUS]);
  var finalStatus = safeString_(record[H.RECORD.FINAL_STATUS]);
  return head === STATUS.HEAD_ACCEPTED && ACTIVE_FINAL_STATUSES.indexOf(finalStatus) !== -1;
}

function processPendingApprovalEmails() {
  var records = getRecords_();
  records.forEach(function(record) {
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING) return;
    if (safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) return;
    if (safeString_(record[H.RECORD.APPROVAL_EMAIL_SENT_AT])) return;
    var retryCount = toNumber_(record[H.RECORD.EMAIL_RETRY_COUNT], 0);
    if (retryCount > 0) return;
    var sent = sendApprovalEmail(record);
    if (sent) updateRequestByRow_(record._rowNumber, { [H.RECORD.APPROVAL_EMAIL_SENT_AT]: now_() });
    else updateRequestByRow_(record._rowNumber, { [H.RECORD.EMAIL_RETRY_COUNT]: retryCount + 1 });
  });
}
