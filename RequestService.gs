/** Request creation, retrieval, and updates. */
function createRequestFromFormSubmit(e) {
  logWarn_('createRequestFromFormSubmit', '', 'Direct form-submit request creation is disabled. Use processUnprocessedFormResponses() to create requests from the linked response-sheet queue.');
  return null;
}

function createRequestFromNormalizedData_(data, sourceInfo, options) {
  setupSheets();
  data = data || {};
  options = options || {};
  sourceInfo = sourceInfo || buildRequestSourceInfo_(data);
  if (sourceInfo.responseId) data.responseId = sourceInfo.responseId;
  if (sourceInfo.responseSourceId) data.responseSourceId = sourceInfo.responseSourceId;
  var rotationOptions = normalizeRotationOptionsFromSubmission_(data);
  validateSubmissionData_(data, rotationOptions);
  // Prefer the exact response-row ID. The content fingerprint is only a
  // fallback for callers that cannot supply a stable native/queue response ID.
  var stableResponseId = safeString_(data.responseId || data.responseSourceId);
  if (!stableResponseId) throw new Error('A stable parent form-response ID is required.');
  var requestGroupId = makeRequestGroupId_(stableResponseId);
  var submissionTotalHours = rotationOptions.reduce(function(total, option) {
    return total + toNumber_(option.totalHours, 0);
  }, 0);

  var createdRecords = [];
  var perRecordOptions = {};
  Object.keys(options).forEach(function(key) { perRecordOptions[key] = options[key]; });
  perRecordOptions.deferRefresh = true;
  perRecordOptions.requestGroupId = requestGroupId;
  perRecordOptions.stableResponseId = stableResponseId;
  perRecordOptions.submissionTotalHours = submissionTotalHours;
  perRecordOptions.existingRecords = options.existingRecords ||
    getConflictCandidateRecordsForSubmission_(data, rotationOptions);
  var startSelectionNumber = Math.max(1, toNumber_(options.startSelectionNumber, 1));
  for (var optionIndex = startSelectionNumber - 1; optionIndex < rotationOptions.length; optionIndex++) {
    var option = rotationOptions[optionIndex];
    var selectionKey = makeSelectionIdempotencyKey_(stableResponseId, option.optionOrder);
    var existingSelection = findIndexedRequestBySelectionKey_(selectionKey);
    if (existingSelection) {
      var existingRequest = getRequestById_(existingSelection[H.REQUEST_SOURCE_INDEX.REQUEST_ID]) || existingSelection;
      createdRecords.push(existingRequest);
      if (typeof options.onSelectionProcessed === 'function') {
        options.onSelectionProcessed(option.optionOrder, rotationOptions.length, existingRequest, true);
      }
      continue;
    }
    perRecordOptions.selectionKey = selectionKey;
    var created = createRequestRecordForRotationOption_(data, option, perRecordOptions);
    createdRecords.push(created);
    perRecordOptions.existingRecords.push(created);
    if (typeof options.onSelectionProcessed === 'function') {
      options.onSelectionProcessed(option.optionOrder, rotationOptions.length, created, false);
    }
  }
  if (options.deferRefresh !== true && createdRecords.length) refreshDashboardForRecords_(createdRecords);
  return createdRecords.length === 1 ? createdRecords[0] : createdRecords;
}

function createRequestRecordForRotationOption_(data, option, options) {
  var currentUnit = findUnitByName_(data.currentUnit) || { name: data.currentUnit, headName: '', headEmail: '' };
  var rotationUnit = findUnitByName_(option.rotationUnit) || { name: option.rotationUnit, headName: '', headEmail: '' };
  var approver = getApproverForRequest_(data.currentUnit, option.rotationUnit);
  var requestId = makeRequestId_();
  var token = generateToken_();
  var type = option.rotationType === 'rotation'
    ? STATUS.TYPE_ROTATION
    : option.rotationType === 'internal'
      ? STATUS.TYPE_INTERNAL
      : STATUS.TYPE_EXTERNAL;

  var record = {};
  record[H.RECORD.REQUEST_ID] = requestId;
  record[H.RECORD.TIMESTAMP] = now_();
  record[H.RECORD.SUBMITTER_EMAIL] = data.submitterEmail || data.directManagerEmail;
  record[H.RECORD.DIRECT_MANAGER_NAME] = data.directManagerName;
  record[H.RECORD.DIRECT_MANAGER_ID] = data.directManagerId;
  record[H.RECORD.DIRECT_MANAGER_EMAIL] = data.directManagerEmail;
  record[H.RECORD.DIRECT_MANAGER_EXTENSION] = data.directManagerExtension;
  record[H.RECORD.EMPLOYEE_NAME] = data.employeeName;
  record[H.RECORD.EMPLOYEE_ID] = data.employeeId;
  record[H.RECORD.EMPLOYEE_HIRE_DATE] = dateOnly_(data.employeeHireDate);
  record[H.RECORD.EMPLOYEE_JOB_TITLE] = data.employeeJobTitle;
  record[H.RECORD.EMPLOYEE_EMAIL] = data.employeeEmail;
  record[H.RECORD.CURRENT_UNIT] = data.currentUnit;
  record[H.RECORD.CURRENT_DEPARTMENT] = data.currentDepartment;
  record[H.RECORD.CURRENT_UNIT_HEAD] = currentUnit.headName;
  record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL] = currentUnit.headEmail;
  record[H.RECORD.ROTATION_UNIT] = option.rotationUnit;
  record[H.RECORD.SECTION] = option.section;
  record[H.RECORD.OPTION_ORDER] = option.optionOrder;
  record[H.RECORD.REQUEST_GROUP_ID] = options.requestGroupId;
  record[H.RECORD.SELECTION_KEY] = options.selectionKey;
  record[H.RECORD.START_DATE] = dateOnly_(option.fromDate);
  record[H.RECORD.END_DATE] = dateOnly_(option.toDate);
  record[H.RECORD.HOURS] = option.hours;
  record[H.RECORD.WORKING_DAYS] = option.workingDays;
  record[H.RECORD.TOTAL_HOURS] = option.totalHours;
  record[H.RECORD.SUBMISSION_TOTAL_HOURS] = options.submissionTotalHours;
  record[H.RECORD.TYPE] = type;
  record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_PENDING;
  record[H.RECORD.REJECTION_REASON] = '';
  record[H.RECORD.CONFLICT_ID] = '';
  record[H.RECORD.CONFLICT_DETAILS] = '';
  record[H.RECORD.APPROVAL_EMAIL_SENT_AT] = '';
  record[H.RECORD.DECISION_DATE] = '';
  // The record-specific link is generated and stored only when the rotation is
  // eligible for its post-end evaluation email.
  record[H.RECORD.EVALUATION_LINK] = '';
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

  var activeRotation = findActiveRotationByEmployee_(data.employeeId, data.employeeName, requestId, options.existingRecords);
  var conflict = null;

  if (activeRotation) {
    record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_EMPLOYEE_ACTIVE;
    record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_EMPLOYEE_ACTIVE;
    record[H.RECORD.REJECTION_REASON] = buildActiveEmployeeRejectionReason_(activeRotation);
    record[H.RECORD.CONFLICT_ID] = activeRotation[H.RECORD.REQUEST_ID];
    record[H.RECORD.CONFLICT_DETAILS] = formatActiveRotationDetails_(activeRotation);
    record[H.RECORD.DECISION_DATE] = now_();
  } else {
    conflict = findConflicts({
      rotationUnit: option.rotationUnit,
      section: option.section,
      startDate: option.fromDate,
      endDate: option.toDate,
      excludeRequestId: requestId
    }, options.existingRecords);
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
  appendRequestSourceIndex_(record);

  if (activeRotation) {
    sendActiveEmployeeRejectedNotification(record, activeRotation);
    logInfo_('createRequestFromNormalizedData_:activeEmployeeRejected', requestId, 'Request rejected because employee already has an active approved job rotation.');
  } else if (conflict) {
    sendConflictNotification(record, conflict, 'submission');
    logInfo_('createRequestFromNormalizedData_:conflict', requestId, 'Request rejected at submission because of conflict.');
  } else {
    var sent = sendApprovalEmail(record);
    if (sent) updateRequestByRow_(rowNumber, { [H.RECORD.APPROVAL_EMAIL_SENT_AT]: now_() });
    sendSubmissionConfirmationEmail(record);
    logInfo_('createRequestFromNormalizedData_', requestId, 'Request created and approval email processed.');
  }

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
      var responseItem = ir.getItem();
      var title = responseItem.getTitle();
      var rawResponse = ir.getResponse();
      named[title] = Array.isArray(rawResponse) ? rawResponse : [rawResponse];
      if (Array.isArray(rawResponse)) {
        try {
          var gridRows = responseItem.asGridItem().getRows();
          gridRows.forEach(function(rowTitle, rowIndex) {
            named[title + ' [' + rowTitle + ']'] = [rawResponse[rowIndex] || ''];
          });
        } catch (ignoreGridRows) {}
      }
    });
  }

  function val(title) {
    var v = named[title];
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        if (safeString_(v[i])) return v[i];
      }
      return '';
    }
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
    if (isRotationSectionResponseHeader_(key)) {
      var candidate = safeString_(val(key));
      if (candidate) section = candidate;
    }
  });

  var parsed = {
    timestamp: firstNonEmpty(['Timestamp', 'الطابع الزمني']),
    submitterEmail: submitterEmail || firstNonEmpty(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    directManagerName: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_NAME),
    directManagerId: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_ID),
    directManagerEmail: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_EMAIL),
    directManagerExtension: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_EXTENSION),
    employeeName: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_NAME),
    employeeId: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_ID),
    employeeHireDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_HIRE_DATE)),
    employeeJobTitle: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_JOB_TITLE),
    employeeEmail: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_EMAIL),
    currentUnit: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.CURRENT_UNIT),
    currentDepartment: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.CURRENT_DEPARTMENT),
    rotationUnit: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_UNIT),
    section: section,
    startDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.START_DATE)),
    endDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.END_DATE)),
    hours: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.HOURS),
    notes: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.NOTES),
    responseId: responseId,
    responseSourceId: e && e.responseSourceId ? safeString_(e.responseSourceId) : ''
  };

  parsed.rotationOptions = parseRotationOptionsFromAccessor_(firstNonEmpty, parsed.currentUnit, parsed.rotationUnit);
  if (!parsed.responseSourceId) parsed.responseSourceId = makeFormResponseSourceId_(parsed);
  return parsed;
}

function parseLinkedResponseRow_(headers, row) {
  headers = headers || [];
  row = row || [];

  function val(title) {
    var fallback = '';
    for (var i = 0; i < headers.length; i++) {
      if (safeString_(headers[i]) !== title) continue;
      if (safeString_(row[i])) return row[i];
      fallback = row[i];
    }
    return fallback;
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
    if (isRotationSectionResponseHeader_(header)) {
      var candidate = safeString_(row[index]);
      if (candidate) section = candidate;
    }
  });

  var parsed = {
    timestamp: firstNonEmpty(['Timestamp', 'الطابع الزمني']),
    submitterEmail: firstNonEmpty(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    directManagerName: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_NAME),
    directManagerId: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_ID),
    directManagerEmail: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_EMAIL),
    directManagerExtension: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.DIRECT_MANAGER_EXTENSION),
    employeeName: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_NAME),
    employeeId: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_ID),
    employeeHireDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_HIRE_DATE)),
    employeeJobTitle: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_JOB_TITLE),
    employeeEmail: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_EMAIL),
    currentUnit: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.CURRENT_UNIT),
    currentDepartment: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.CURRENT_DEPARTMENT),
    rotationUnit: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_UNIT),
    section: section,
    startDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.START_DATE)),
    endDate: parseDateFlexible_(firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.END_DATE)),
    hours: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.HOURS),
    notes: firstNonEmpty(FORM_RESPONSE_TITLE_CANDIDATES.NOTES),
    responseId: '',
    responseSourceId: ''
  };

  parsed.rotationOptions = parseRotationOptionsFromAccessor_(firstNonEmpty, parsed.currentUnit, parsed.rotationUnit);
  parsed.responseSourceId = makeFormResponseSourceId_(parsed);
  return parsed;
}


function isRotationSectionResponseHeader_(header) {
  header = safeString_(header);
  if (!header) return false;
  if (header.indexOf(FORM.SECTION_QUESTION_PREFIX) === 0) return true;
  if (header === FORM.TITLES.ROTATION_DEPARTMENT) return true;
  if (header.indexOf('قسم التدوير') !== -1 || header.indexOf('القسم المطلوب') !== -1) return true;
  var normalized = normalizeKey_(header);
  if (normalized.indexOf('rotationsection') !== -1 || normalized.indexOf('requestedsection') !== -1) return true;
  if (normalized.indexOf('rotationselection') !== -1 && normalized.indexOf('section') !== -1) return true;
  if (normalized.indexOf('current') !== -1 || header.indexOf('الحالي') !== -1) return false;
  return normalized === 'section' || normalized === 'rotationdepartment';
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


function datesOverlap_(startA, endA, startB, endB) {
  return dateOnly_(startA).getTime() <= dateOnly_(endB).getTime() && dateOnly_(startB).getTime() <= dateOnly_(endA).getTime();
}

function isSectionInUnit_(unitName, sectionName) {
  var targetUnit = normalizeKey_(unitName);
  var targetSection = normalizeKey_(sectionName);
  return getSections_().some(function(section) {
    return normalizeKey_(section.unitName) === targetUnit && normalizeKey_(section.name) === targetSection;
  });
}

function validateSubmissionData_(data, rotationOptions) {
  throwSubmissionMissing_(data.directManagerName, 'اسم المسؤول المباشر مفقود.', 'Direct manager name is missing.');
  throwSubmissionMissing_(data.directManagerId, 'الرقم الوظيفي للمسؤول المباشر مفقود.', 'Line manager employee ID is missing.');
  if (!data.directManagerEmail) data.directManagerEmail = data.submitterEmail || data.employeeEmail;
  throwSubmissionMissing_(data.directManagerEmail, 'بريد المسؤول المباشر مفقود.', 'Direct manager email is missing.');
  throwSubmissionMissing_(data.directManagerExtension, 'رقم محول المسؤول المباشر مفقود.', 'Line manager extension is missing.');
  throwSubmissionMissing_(data.employeeName, 'اسم الموظف مفقود.', 'Employee name is missing.');
  throwSubmissionMissing_(data.employeeId, 'الرقم الوظيفي للموظف مفقود.', 'Employee ID is missing.');
  throwSubmissionMissing_(data.employeeHireDate, 'تاريخ تعيين الموظف مفقود أو غير صحيح.', 'Employee hire date is missing or invalid.');
  throwSubmissionMissing_(data.employeeJobTitle, 'المسمى الوظيفي للموظف مفقود.', 'Employee job title is missing.');
  throwSubmissionMissing_(data.employeeEmail, 'بريد الموظف مفقود.', 'Employee email is missing.');
  throwSubmissionMissing_(data.currentUnit, 'الوحدة الحالية مفقودة.', 'Current unit is missing.');
  throwSubmissionMissing_(data.currentDepartment, 'القسم الحالي مفقود.', 'Current section is missing.');
  rotationOptions = rotationOptions || normalizeRotationOptionsFromSubmission_(data);
  throwSubmissionMissing_(rotationOptions.length ? 'yes' : '', 'يجب إضافة اختيار تدوير واحد على الأقل.', 'At least one rotation option is required.');
  if (rotationOptions.some(function(option) { return option.rotationType === 'rotation'; })) {
    validateUnifiedRotationOptions_(data, rotationOptions);
    return;
  }
  var seen = {};
  var internalOptions = [];
  var externalOptions = [];
  rotationOptions.forEach(function(option) {
    throwIfMissing_(option.section, 'Rotation section is missing.');
    if (option.section === FORM.NO_AVAILABLE_SECTIONS) throw new Error('No available section was selected.');
    if (!option.fromDate || !option.toDate) throw new Error('Start date or end date is invalid.');
    if (dateOnly_(option.fromDate).getTime() > dateOnly_(option.toDate).getTime()) throw new Error('Start date cannot be after end date.');
    if (option.rotationType === 'internal') {
      if (normalizeKey_(option.rotationUnit) !== normalizeKey_(data.currentUnit)) throw new Error('Internal rotation sections must be inside the employee current unit.');
      if (!isSectionInUnit_(data.currentUnit, option.section)) throw new Error('Internal rotation section must belong to the employee current unit.');
      internalOptions.push(option);
    } else {
      externalOptions.push(option);
      throwIfMissing_(option.rotationUnit, 'External rotation unit is missing.');
      if (normalizeKey_(option.rotationUnit) === normalizeKey_(data.currentUnit)) throw new Error('External rotation unit must be different from the employee current unit.');
      if (!isSectionInUnit_(option.rotationUnit, option.section)) throw new Error('External rotation section must belong to the selected external unit.');
      if (!option.hours || toNumber_(option.hours, 0) <= 0) throw new Error('External rotation daily hours are required.');
    }
    var duplicateKey = [option.rotationType, option.rotationUnit, option.section, dateOnly_(option.fromDate).getTime(), dateOnly_(option.toDate).getTime()].map(normalizeKey_).join('|');
    if (seen[duplicateKey]) throw new Error('Duplicate rotation option rows are not allowed.');
    seen[duplicateKey] = true;
  });
  if (!internalOptions.length) throw new Error('At least one internal rotation option is required.');
  if (internalOptions.length > (FORM.MAX_INTERNAL_OPTIONS || 3)) throw new Error('A maximum of three internal rotation options is allowed.');
  if (externalOptions.length > (FORM.MAX_EXTERNAL_OPTIONS || 3)) throw new Error('A maximum of three external rotation options is allowed.');
  if (!internalOptions.some(function(option) { return toNumber_(option.optionOrder, 0) === 1; })) {
    throw new Error('The first internal rotation option is required.');
  }
  for (var i = 0; i < internalOptions.length; i++) {
    for (var j = i + 1; j < internalOptions.length; j++) {
      if (datesOverlap_(internalOptions[i].fromDate, internalOptions[i].toDate, internalOptions[j].fromDate, internalOptions[j].toDate)) {
        throw new Error('Internal rotation date ranges cannot overlap.');
      }
    }
  }
}

function throwSubmissionMissing_(value, messageAr, messageEn) {
  if (value === null || value === undefined || safeString_(value) === '') {
    throw makeSubmissionValidationError_(messageAr, messageEn);
  }
}

function getConflictCandidateRecordsForSubmission_(data, rotationOptions) {
  var sheet = getSheet_(SHEETS.RECORDS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var candidates = [];
  if (safeString_(data.employeeId)) {
    candidates = candidates.concat(findObjectsByValue_(sheet, H.RECORD.EMPLOYEE_ID, data.employeeId, 500));
  } else if (safeString_(data.employeeName)) {
    candidates = candidates.concat(findObjectsByValue_(sheet, H.RECORD.EMPLOYEE_NAME, data.employeeName, 500));
  }
  var seenSections = {};
  (rotationOptions || []).forEach(function(option) {
    var sectionKey = normalizeKey_(option.section);
    if (!sectionKey || seenSections[sectionKey]) return;
    seenSections[sectionKey] = true;
    candidates = candidates.concat(findObjectsByValue_(sheet, H.RECORD.SECTION, option.section, 1000));
  });
  var seenRequests = {};
  return candidates.filter(function(record) {
    var requestId = safeString_(record[H.RECORD.REQUEST_ID]) || String(record._rowNumber);
    if (seenRequests[requestId]) return false;
    seenRequests[requestId] = true;
    return true;
  });
}

function validateUnifiedRotationOptions_(data, rotationOptions) {
  if (rotationOptions.some(function(option) { return option.rotationType !== 'rotation'; })) {
    throw new Error('Legacy internal/external rotations cannot be mixed with the new rotation-unit selections.');
  }
  if (!rotationOptions.length || rotationOptions.length > (FORM.MAX_ROTATION_OPTIONS || 3)) {
    throw makeSubmissionValidationError_(
      'يجب أن يحتوي الطلب على اختيار تدوير واحد على الأقل وبحد أقصى ثلاثة اختيارات.',
      'A submission must contain between one and three rotation selections.'
    );
  }

  var seenSections = {};
  rotationOptions.forEach(function(option, index) {
    var expectedOrder = index + 1;
    if (toNumber_(option.optionOrder, 0) !== expectedOrder) {
      throw makeSubmissionValidationError_(
        'أرقام اختيارات التدوير غير متسلسلة.',
        'Rotation selection numbers must be sequential starting from 1.'
      );
    }
    throwSubmissionMissing_(option.rotationUnit, 'وحدة التدوير مفقودة.', 'Rotation unit is missing.');
    throwSubmissionMissing_(option.section, 'قسم التدوير مفقود.', 'Rotation section is missing.');
    if (!isSectionInUnit_(option.rotationUnit, option.section)) {
      throw makeSubmissionValidationError_(
        'قسم التدوير المحدد لا يتبع الوحدة المحددة.',
        'The selected rotation section does not belong to its unit.'
      );
    }
    var sectionKey = normalizeKey_(option.rotationUnit) + '|' + normalizeKey_(option.section);
    if (seenSections[sectionKey]) {
      throw makeSubmissionValidationError_(
        'لا يمكن اختيار قسم التدوير نفسه أكثر من مرة في الطلب الواحد.',
        'Duplicate section selections are not allowed within the same submission.'
      );
    }
    seenSections[sectionKey] = true;
    var metrics = calculateRotationMetrics_(option.fromDate, option.toDate, option.hours);
    option.fromDate = metrics.startDate;
    option.toDate = metrics.endDate;
    option.hours = metrics.dailyHours;
    option.workingDays = metrics.workingDays;
    option.totalHours = metrics.totalHours;
  });

  for (var i = 0; i < rotationOptions.length; i++) {
    for (var j = i + 1; j < rotationOptions.length; j++) {
      if (datesOverlap_(rotationOptions[i].fromDate, rotationOptions[i].toDate, rotationOptions[j].fromDate, rotationOptions[j].toDate)) {
        throw makeSubmissionValidationError_(
          'لا يمكن أن تتداخل فترات اختيارات التدوير في الطلب الواحد.',
          'Rotation date ranges within the same submission cannot overlap.'
        );
      }
    }
  }
}

function parseRotationOptionsFromAccessor_(firstNonEmpty, currentUnit, rotationUnit) {
  var unifiedOptions = parseUnifiedRotationOptions_(firstNonEmpty, rotationUnit);
  if (unifiedOptions.length) return unifiedOptions;
  var options = [];
  appendParsedRotationOptions_(options, 'internal', FORM.MAX_INTERNAL_OPTIONS || 3, firstNonEmpty, currentUnit);
  appendParsedRotationOptions_(options, 'external', FORM.MAX_EXTERNAL_OPTIONS || 3, firstNonEmpty, '');
  return options;
}

function parseUnifiedRotationOptions_(firstNonEmpty, rotationUnit) {
  var options = [];
  for (var i = 1; i <= (FORM.MAX_ROTATION_OPTIONS || 3); i++) {
    var sectionChoice = firstNonEmpty([
      optionTitle_(FORM.TITLES.ROTATION_SECTION_PREFIX, i)
    ].concat(expandOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_SECTION, i)));
    var fromDate = parseDateFlexible_(firstNonEmpty([
      optionTitle_(FORM.TITLES.ROTATION_FROM_PREFIX, i)
    ].concat(expandOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_FROM, i))));
    var toDate = parseDateFlexible_(firstNonEmpty([
      optionTitle_(FORM.TITLES.ROTATION_TO_PREFIX, i)
    ].concat(expandOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_TO, i))));
    var hours = firstNonEmpty([
      optionTitle_(FORM.TITLES.ROTATION_HOURS_PREFIX, i)
    ].concat(expandOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_HOURS, i)));
    if (!sectionChoice && !fromDate && !toDate && !hours) continue;
    var parsedSection = parseRotationSectionChoice_(sectionChoice, '');
    options.push({
      rotationType: 'rotation',
      rotationUnit: parsedSection.unit,
      section: parsedSection.section,
      fromDate: fromDate,
      toDate: toDate,
      hours: hours,
      optionOrder: i
    });
  }
  return options;
}

function expandUnitScopedTitles_(titles, unitName) {
  var scoped = (titles || []).map(function(title) {
    return safeString_(title) + ' - ' + safeString_(unitName);
  });
  return scoped.concat(titles || []);
}

function appendParsedRotationOptions_(options, rotationType, maxOptions, firstNonEmpty, currentUnit) {
  for (var i = 1; i <= maxOptions; i++) {
    var externalUnit = rotationType === 'external' ? firstNonEmpty(expandOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.EXTERNAL_UNIT, i)) : '';
    if (rotationType === 'external' && isNoExternalRotationChoice_(externalUnit)) continue;
    var optionUnit = rotationType === 'internal' ? currentUnit : externalUnit;
    var section = firstNonEmpty(expandBranchedOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES[rotationType === 'internal' ? 'INTERNAL_SECTION' : 'EXTERNAL_SECTION'], i, optionUnit));
    var fromDate = parseDateFlexible_(firstNonEmpty(expandBranchedOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES[rotationType === 'internal' ? 'INTERNAL_FROM' : 'EXTERNAL_FROM'], i, optionUnit)));
    var toDate = parseDateFlexible_(firstNonEmpty(expandBranchedOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES[rotationType === 'internal' ? 'INTERNAL_TO' : 'EXTERNAL_TO'], i, optionUnit)));
    var externalHours = rotationType === 'external' ? firstNonEmpty(expandBranchedOptionTitles_(FORM_RESPONSE_TITLE_CANDIDATES.EXTERNAL_HOURS, i, optionUnit)) : '';
    if (!section && !fromDate && !toDate && !externalUnit && !externalHours) continue;
    var parsedSection = parseRotationSectionChoice_(section, optionUnit);
    options.push({
      rotationType: rotationType,
      rotationUnit: rotationType === 'external' ? (externalUnit || parsedSection.unit) : (parsedSection.unit || currentUnit),
      section: parsedSection.section,
      fromDate: fromDate,
      toDate: toDate,
      hours: externalHours,
      optionOrder: i
    });
  }
}

function expandOptionTitles_(templates, optionNumber) {
  return (templates || []).map(function(title) { return safeString_(title).replace('{n}', optionNumber); });
}

function expandBranchedOptionTitles_(templates, optionNumber, unitName) {
  var baseTitles = expandOptionTitles_(templates, optionNumber);
  if (!safeString_(unitName)) return baseTitles;
  return baseTitles.map(function(title) { return title + ' - ' + safeString_(unitName); }).concat(baseTitles);
}

function isNoExternalRotationChoice_(value) {
  return normalizeKey_(value) === normalizeKey_(FORM.NO_EXTERNAL_ROTATION);
}

function parseRotationSectionChoice_(choice, fallbackUnit) {
  choice = safeString_(choice);
  fallbackUnit = safeString_(fallbackUnit);
  if (fallbackUnit) {
    var combinedPrefix = fallbackUnit + ' / ';
    if (choice.indexOf(combinedPrefix) === 0) {
      return { unit: fallbackUnit, section: choice.substring(combinedPrefix.length) };
    }
    return { unit: fallbackUnit, section: choice };
  }
  var emDashParts = choice.split(' — ');
  if (emDashParts.length >= 2) {
    return { unit: emDashParts[0], section: emDashParts.slice(1).join(' — ') };
  }
  var parts = choice.split(' / ');
  if (parts.length >= 2) return { unit: parts[0], section: parts.slice(1).join(' / ') };
  return { unit: '', section: choice };
}

function normalizeRotationOptionsFromSubmission_(data) {
  if (data.rotationOptions && data.rotationOptions.length) return data.rotationOptions.slice();
  if (data.section || data.startDate || data.endDate) {
    return [{ rotationType: 'rotation', rotationUnit: data.rotationUnit || data.currentUnit, section: data.section, fromDate: data.startDate, toDate: data.endDate, hours: data.hours, optionOrder: data.optionOrder || 1 }];
  }
  return [];
}

function buildActiveEmployeeRejectionReason_(activeRotation) {
  return [
    'تم رفض الطلب تلقائياً لأن الموظف لديه تدوير وظيفي معتمد ونشط حالياً.',
    'The request was automatically rejected because the employee currently has an active approved job rotation.',
    'رقم الطلب النشط / Active request ID: ' + safeString_(activeRotation[H.RECORD.REQUEST_ID])
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

function processPendingApprovalEmails(options) {
  options = options || {};
  var sheet = getSheet_(SHEETS.RECORDS);
  if (!sheet || sheet.getLastRow() < 2) return { scanned: 0, sent: 0 };
  var cfg = getConfig();
  var lastRow = sheet.getLastRow();
  var scanRange = getQueueScanRange_(
    PENDING_APPROVAL_SCAN_CURSOR_KEY,
    lastRow,
    cfg.QUEUE_SCAN_WINDOW_ROWS || QUEUE_SCAN_WINDOW_ROWS
  );
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
  var values = scanRange.rowCount
    ? sheet.getRange(scanRange.startRow, 1, scanRange.rowCount, sheet.getLastColumn()).getValues()
    : [];
  var records = values.map(function(row, index) {
    var record = { _rowNumber: scanRange.startRow + index };
    headers.forEach(function(header, columnIndex) {
      if (header) record[header] = row[columnIndex];
    });
    return record;
  });
  var sentCount = 0;
  var attemptedCount = 0;
  for (var i = 0; i < records.length; i++) {
    var record = records[i];
    if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_PENDING) continue;
    if (safeString_(record[H.RECORD.FINAL_STATUS]) !== STATUS.FINAL_PENDING) continue;
    if (safeString_(record[H.RECORD.APPROVAL_EMAIL_SENT_AT])) continue;
    var retryCount = toNumber_(record[H.RECORD.EMAIL_RETRY_COUNT], 0);
    if (retryCount > 0) continue;
    if (attemptedCount >= PENDING_APPROVAL_EMAIL_BATCH_SIZE) {
      setQueueScanCursor_(PENDING_APPROVAL_SCAN_CURSOR_KEY, record._rowNumber, lastRow);
      return { scanned: i, sent: sentCount, remainingLikely: true };
    }
    if (shouldStopSync_(options.startedAt)) {
      setQueueScanCursor_(PENDING_APPROVAL_SCAN_CURSOR_KEY, record._rowNumber, lastRow);
      return { scanned: i, sent: sentCount, remainingLikely: true };
    }
    attemptedCount++;
    var sent = sendApprovalEmail(record);
    if (sent) {
      updateRequestByRow_(record._rowNumber, { [H.RECORD.APPROVAL_EMAIL_SENT_AT]: now_() });
      sentCount++;
    }
    else updateRequestByRow_(record._rowNumber, { [H.RECORD.EMAIL_RETRY_COUNT]: retryCount + 1 });
  }
  advanceQueueScanCursor_(PENDING_APPROVAL_SCAN_CURSOR_KEY, scanRange, lastRow);
  return { scanned: records.length, sent: sentCount, remainingLikely: scanRange.endRow < lastRow };
}
