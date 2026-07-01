/** Response-sheet backed queue processing for Google Form submissions. */
const RESPONSE_QUEUE = Object.freeze({
  STATUS: 'Processing Status',
  PROCESSED_AT: 'Processed At',
  REQUEST_ID: 'Dashboard Request ID',
  LAST_ERROR: 'Processing Error',
  RETRY_COUNT: 'Retry Count',
  LAST_ATTEMPT_AT: 'Last Attempt At'
});

const RESPONSE_QUEUE_HEADERS = Object.freeze([
  RESPONSE_QUEUE.STATUS,
  RESPONSE_QUEUE.PROCESSED_AT,
  RESPONSE_QUEUE.REQUEST_ID,
  RESPONSE_QUEUE.LAST_ERROR,
  RESPONSE_QUEUE.RETRY_COUNT,
  RESPONSE_QUEUE.LAST_ATTEMPT_AT
]);

const RESPONSE_QUEUE_STATUS = Object.freeze({
  NEW: 'NEW',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  ERROR: 'ERROR'
});

function processUnprocessedFormResponses() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var cfg = getConfig();
    if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
      logInfo_('processUnprocessedFormResponses', '', 'FORM_RESPONSES_SPREADSHEET_ID is not configured; skipping response queue.');
      return 0;
    }

    setupSheets();
    var ss = SpreadsheetApp.openById(cfg.FORM_RESPONSES_SPREADSHEET_ID);
    var sheet = findFormResponsesSheet_(ss);
    if (!sheet || sheet.getLastRow() < 2) return 0;

    var map = ensureResponseQueueColumns_(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    var processedCount = 0;

    rows.forEach(function(row, index) {
      var rowNumber = index + 2;
      if (!hasResponseRowData_(row, headers, map)) return;
      if (isResponseRowProcessed_(row, map)) return;

      var responseId = makeResponseQueueId_(ss, sheet, rowNumber);
      var responseSourceId = makeResponseSourceIdFromRow_(headers, row, map);
      var existingRecord = findRequestByResponseSourceId_(responseSourceId) || findRequestByResponseId_(responseId);
      if (existingRecord) {
        markResponseRowProcessed_(sheet, rowNumber, map, existingRecord[H.RECORD.REQUEST_ID] || responseId, '');
        processedCount++;
        return;
      }

      try {
        markResponseRowProcessing_(sheet, rowNumber, map);
        var event = buildFormSubmitEventFromResponseRow_(headers, row, responseId, responseSourceId, map);
        var record = createRequestFromFormData_(event);
        markResponseRowProcessed_(sheet, rowNumber, map, record[H.RECORD.REQUEST_ID] || responseId, '');
        processedCount++;
        logInfo_('processUnprocessedFormResponses', record[H.RECORD.REQUEST_ID], 'Queued form response processed from row ' + rowNumber + '.');
      } catch (err) {
        markResponseRowError_(sheet, rowNumber, map, err);
        logError_('processUnprocessedFormResponses', responseId, err);
      }
    });

    return processedCount;
  } finally {
    lock.releaseLock();
  }
}

function findFormResponsesSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) continue;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
    if (headers.indexOf('Timestamp') !== -1 || headers.indexOf('الطابع الزمني') !== -1) return sheet;
  }
  return sheets.length ? sheets[0] : null;
}

function ensureResponseQueueColumns_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(safeString_) : [];
  var queueStart = findResponseQueueColumnStart_(headers);

  if (!queueStart) {
    queueStart = lastCol + 1;
    sheet.getRange(1, queueStart, 1, RESPONSE_QUEUE_HEADERS.length).setValues([RESPONSE_QUEUE_HEADERS]);
  }

  var map = {};
  RESPONSE_QUEUE_HEADERS.forEach(function(header, index) {
    map[header] = queueStart + index;
  });
  return map;
}

function findResponseQueueColumnStart_(headers) {
  if (headers.length < RESPONSE_QUEUE_HEADERS.length) return 0;
  var start = headers.length - RESPONSE_QUEUE_HEADERS.length;
  for (var i = 0; i < RESPONSE_QUEUE_HEADERS.length; i++) {
    if (headers[start + i] !== RESPONSE_QUEUE_HEADERS[i]) return 0;
  }
  return start + 1;
}

function hasResponseRowData_(row, headers, map) {
  for (var i = 0; i < headers.length; i++) {
    if (isResponseQueueColumnIndex_(i + 1, map)) continue;
    if (row[i] !== '' && row[i] !== null) return true;
  }
  return false;
}

function isResponseRowProcessed_(row, map) {
  var value = map[RESPONSE_QUEUE.STATUS] ? row[map[RESPONSE_QUEUE.STATUS] - 1] : '';
  return safeString_(value) === RESPONSE_QUEUE_STATUS.PROCESSED;
}

function buildFormSubmitEventFromResponseRow_(headers, row, responseId, responseSourceId, map) {
  var namedValues = {};
  headers.forEach(function(header, index) {
    if (!header || isResponseQueueColumnIndex_(index + 1, map)) return;
    namedValues[header] = [row[index]];
  });
  return { namedValues: namedValues, responseId: responseId, responseSourceId: responseSourceId };
}

function isResponseQueueColumnIndex_(columnIndex, map) {
  for (var i = 0; i < RESPONSE_QUEUE_HEADERS.length; i++) {
    if (map[RESPONSE_QUEUE_HEADERS[i]] === columnIndex) return true;
  }
  return false;
}

function makeResponseQueueId_(ss, sheet, rowNumber) {
  return ss.getId() + ':' + sheet.getSheetId() + ':' + rowNumber;
}

function isRequestAlreadyCreatedForResponse_(responseId) {
  return Boolean(findRequestByResponseId_(responseId));
}

function findRequestByResponseId_(responseId) {
  var sheet = getSheet_(SHEETS.RECORDS);
  if (!sheet) return null;
  return findObjectByValue_(sheet, H.RECORD.FORM_RESPONSE_ID, responseId);
}

function findRequestByResponseSourceId_(responseSourceId) {
  var sheet = getSheet_(SHEETS.RECORDS);
  if (!sheet || !responseSourceId) return null;
  return findObjectByValue_(sheet, H.RECORD.FORM_RESPONSE_SOURCE_ID, responseSourceId);
}

function makeResponseSourceIdFromRow_(headers, row, map) {
  function valueFor(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var wanted = candidates[i];
      for (var j = 0; j < headers.length; j++) {
        if (isResponseQueueColumnIndex_(j + 1, map)) continue;
        if (headers[j] === wanted) return row[j];
      }
    }
    return '';
  }

  var data = {
    timestamp: valueFor(['Timestamp', 'الطابع الزمني']),
    submitterEmail: valueFor(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    employeeEmail: valueFor([FORM.TITLES.EMPLOYEE_EMAIL, 'بريد الموظف الجديد']),
    startDate: parseDateFlexible_(valueFor([FORM.TITLES.START_DATE, 'من تاريخ'])),
    endDate: parseDateFlexible_(valueFor([FORM.TITLES.END_DATE, 'إلى تاريخ'])),
    trainingUnit: valueFor([FORM.TITLES.TRAINING_UNIT, 'وحدة التدريب المطلوبة']),
    section: ''
  };

  for (var k = 0; k < headers.length; k++) {
    if (isResponseQueueColumnIndex_(k + 1, map)) continue;
    if (headers[k].indexOf(FORM.SECTION_QUESTION_PREFIX) === 0 || normalizeKey_(headers[k]).indexOf('section') !== -1 || headers[k].indexOf('القسم المطلوب') !== -1) {
      data.section = row[k];
      break;
    }
  }

  return makeFormResponseSourceId_(data);
}

function markResponseRowProcessing_(sheet, rowNumber, map) {
  var retryCount = Number(sheet.getRange(rowNumber, map[RESPONSE_QUEUE.RETRY_COUNT]).getValue()) || 0;
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.PROCESSING;
  updates[RESPONSE_QUEUE.RETRY_COUNT] = retryCount + 1;
  updates[RESPONSE_QUEUE.LAST_ATTEMPT_AT] = now_();
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function markResponseRowProcessed_(sheet, rowNumber, map, requestId, error) {
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.PROCESSED;
  updates[RESPONSE_QUEUE.PROCESSED_AT] = now_();
  updates[RESPONSE_QUEUE.REQUEST_ID] = requestId || '';
  updates[RESPONSE_QUEUE.LAST_ERROR] = error || '';
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function markResponseRowError_(sheet, rowNumber, map, err) {
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.ERROR;
  updates[RESPONSE_QUEUE.LAST_ERROR] = err && err.message ? err.message : safeString_(err);
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function updateResponseQueueRow_(sheet, rowNumber, map, updates) {
  Object.keys(updates).forEach(function(header) {
    if (!map[header]) throw new Error('Cannot update missing response queue column: ' + header);
    sheet.getRange(rowNumber, map[header]).setValue(updates[header]);
  });
}
