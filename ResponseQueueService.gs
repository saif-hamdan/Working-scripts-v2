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
  ERROR: 'ERROR',
  ERROR_REQUIRES_REVIEW: 'ERROR_REQUIRES_REVIEW'
});

function processUnprocessedFormResponses(options) {
  options = options || {};
  var lock = options.skipLock ? null : LockService.getScriptLock();
  var requestCreationOptions = { deferRefresh: options.deferRefresh === true };
  if (lock) lock.waitLock(30000);

  try {
    var cfg = getConfig();
    if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
      logWarn_('processUnprocessedFormResponses', '', 'FORM_RESPONSES_SPREADSHEET_ID is not configured; linked Google Form response-sheet queue cannot be processed and no requests will be created.');
      return buildResponseQueueStats_(0, 0, 0, false, 0, false);
    }

    setupSheets();

    var ss = SpreadsheetApp.openById(cfg.FORM_RESPONSES_SPREADSHEET_ID);
    var sheet = findFormResponsesSheet_(ss);
    if (!sheet || sheet.getLastRow() < 2) return buildResponseQueueStats_(0, 0, 0, false, 0, false);

    var map = ensureResponseQueueColumns_(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
    var lastRow = sheet.getLastRow();
    var scanWindow = Math.max(RESPONSE_QUEUE_BATCH_SIZE, QUEUE_SCAN_WINDOW_ROWS);
    var scanRange = getQueueScanRange_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, lastRow, scanWindow);
    var startRow = scanRange.startRow;
    var rows = scanRange.rowCount > 0 ? sheet.getRange(scanRange.startRow, 1, scanRange.rowCount, sheet.getLastColumn()).getValues() : [];
    var processedCount = 0;
    var skippedCount = 0;
    var failedCount = 0;
    var stoppedEarly = false;
    var stoppedForBatch = false;
    var scannedCount = 0;
    var actionableCount = 0;
    var remainingLikely = scanRange.endRow < lastRow;
    var cursorDeferred = false;

    var responseQueueItems = [];
    var responseIds = [];
    var responseSourceIds = [];

    for (var index = rows.length - 1; index >= 0; index--) {
      var row = rows[index];
      var rowNumber = startRow + index;
      scannedCount++;
      if (!hasResponseRowData_(row, headers, map)) {
        skippedCount++;
        continue;
      }
      if (isResponseRowProcessed_(row, map)) {
        skippedCount++;
        continue;
      }
      if (!shouldAttemptResponseRow_(row, map, cfg.RESPONSE_QUEUE_MAX_RETRIES)) {
        markResponseRowReviewRequiredIfMaxed_(sheet, rowNumber, row, map, cfg.RESPONSE_QUEUE_MAX_RETRIES);
        skippedCount++;
        continue;
      }
      if (actionableCount >= RESPONSE_QUEUE_BATCH_SIZE) {
        remainingLikely = true;
        stoppedForBatch = true;
        setQueueScanCursor_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, rowNumber, lastRow);
        cursorDeferred = true;
        break;
      }
      if (shouldStopSync_(options.startedAt)) {
        stoppedEarly = true;
        remainingLikely = true;
        setQueueScanCursor_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, rowNumber, lastRow);
        cursorDeferred = true;
        break;
      }
      actionableCount++;

      var responseId = makeResponseQueueId_(ss, sheet, rowNumber);
      var responseSourceId = makeResponseSourceIdFromRow_(headers, row, map);
      responseQueueItems.push({ row: row, rowNumber: rowNumber, responseId: responseId, responseSourceId: responseSourceId });
      if (responseId) responseIds.push(responseId);
      if (responseSourceId) responseSourceIds.push(responseSourceId);
    }

    var matchedRecords = findRequestsByResponseIds_(responseIds, responseSourceIds);
    var recordsByResponseSourceId = {};
    var recordsByResponseId = {};
    matchedRecords.forEach(function(record) {
      var matchedResponseSourceId = safeString_(record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID]);
      var matchedResponseId = safeString_(record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID]);
      if (matchedResponseSourceId && !recordsByResponseSourceId[matchedResponseSourceId]) recordsByResponseSourceId[matchedResponseSourceId] = record;
      if (matchedResponseId && !recordsByResponseId[matchedResponseId]) recordsByResponseId[matchedResponseId] = record;
    });

    for (var itemIndex = 0; itemIndex < responseQueueItems.length; itemIndex++) {
      var item = responseQueueItems[itemIndex];
      var row = item.row;
      var rowNumber = item.rowNumber;
      var responseId = item.responseId;
      var responseSourceId = item.responseSourceId;
      try {
        var data = null;
        var existingRecord = (responseSourceId ? recordsByResponseSourceId[responseSourceId] : null) || recordsByResponseId[responseId];
        if (existingRecord) {
          markResponseRowProcessed_(sheet, rowNumber, map, existingRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] || responseId, '');
          skippedCount++;
          logInfo_('processUnprocessedFormResponses', existingRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] || responseId, 'Queued form response from row ' + rowNumber + ' already had a request; marked as processed.');
          continue;
        }

        markResponseRowProcessing_(sheet, rowNumber, map);
        data = parseLinkedResponseRow_(stripResponseQueueHeaders_(headers, map), stripResponseQueueRow_(row, headers, map));
        var sourceInfo = buildRequestSourceInfo_(data);
        sourceInfo.responseId = responseId;
        sourceInfo.responseSourceId = responseSourceId;
        var record = createRequestFromNormalizedData_(data, sourceInfo, requestCreationOptions);
        var indexRecord = appendRequestSourceIndex_(record) || record;
        if (responseSourceId && !recordsByResponseSourceId[responseSourceId]) recordsByResponseSourceId[responseSourceId] = indexRecord;
        if (responseId && !recordsByResponseId[responseId]) recordsByResponseId[responseId] = indexRecord;
        markResponseRowProcessed_(sheet, rowNumber, map, record[H.RECORD.REQUEST_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_ID] || responseId, '');
        processedCount++;
        logInfo_('processUnprocessedFormResponses', record[H.RECORD.REQUEST_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_ID], 'Queued form response processed from row ' + rowNumber + '.');
      } catch (err) {
        if (isInvalidDateOrderError_(err) && data) {
          markResponseRowRequiresReview_(sheet, rowNumber, map, err);
          sendInvalidDatesSubmissionEmail(data, responseId, err);
        } else {
          markResponseRowError_(sheet, rowNumber, map, err, cfg.RESPONSE_QUEUE_MAX_RETRIES);
        }
        failedCount++;
        logError_('processUnprocessedFormResponses', responseId, err);
      }
    }

    if (!cursorDeferred) advanceQueueScanCursor_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, scanRange, lastRow);
    var stats = buildResponseQueueStats_(processedCount, skippedCount, failedCount, stoppedEarly, scannedCount, remainingLikely);
    stats.stoppedForBatch = stoppedForBatch;
    logInfo_('processUnprocessedFormResponses', '', formatResponseQueueStats_(stats));
    logQueueStoppedEarly_('processUnprocessedFormResponses', '', stats, RESPONSE_QUEUE_BATCH_SIZE);
    return stats;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function buildResponseQueueStats_(processed, skipped, failed, stoppedEarly, scanned, remainingLikely) {
  return {
    processed: processed || 0,
    skipped: skipped || 0,
    failed: failed || 0,
    stoppedEarly: Boolean(stoppedEarly),
    scanned: scanned || 0,
    remainingLikely: Boolean(remainingLikely)
  };
}

function formatResponseQueueStats_(stats) {
  return 'Queued form responses processed: ' + stats.processed +
    ', skipped: ' + stats.skipped +
    ', failed: ' + stats.failed +
    ', scanned: ' + stats.scanned +
    ', remainingLikely: ' + stats.remainingLikely +
    ', stoppedEarly: ' + stats.stoppedEarly + '.';
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

function shouldAttemptResponseRow_(row, map, maxRetries) {
  var status = map[RESPONSE_QUEUE.STATUS] ? safeString_(row[map[RESPONSE_QUEUE.STATUS] - 1]) : '';
  if (status === RESPONSE_QUEUE_STATUS.ERROR_REQUIRES_REVIEW) return false;
  if (status !== RESPONSE_QUEUE_STATUS.ERROR) return true;
  return getResponseRowRetryCount_(row, map) < maxRetries;
}

function getResponseRowRetryCount_(row, map) {
  if (!map[RESPONSE_QUEUE.RETRY_COUNT]) return 0;
  return toNumber_(row[map[RESPONSE_QUEUE.RETRY_COUNT] - 1], 0);
}

function stripResponseQueueHeaders_(headers, map) {
  var cleanHeaders = [];
  headers.forEach(function(header, index) {
    if (isResponseQueueColumnIndex_(index + 1, map)) return;
    cleanHeaders.push(header);
  });
  return cleanHeaders;
}

function stripResponseQueueRow_(row, headers, map) {
  var cleanRow = [];
  headers.forEach(function(header, index) {
    if (isResponseQueueColumnIndex_(index + 1, map)) return;
    cleanRow.push(row[index]);
  });
  return cleanRow;
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

function findRequestsByResponseIds_(responseIds, responseSourceIds) {
  responseIds = responseIds || [];
  responseSourceIds = responseSourceIds || [];

  var responseIdLookup = {};
  var responseSourceIdLookup = {};
  responseIds.forEach(function(responseId) {
    responseId = safeString_(responseId);
    if (responseId) responseIdLookup[responseId] = true;
  });
  responseSourceIds.forEach(function(responseSourceId) {
    responseSourceId = safeString_(responseSourceId);
    if (responseSourceId) responseSourceIdLookup[responseSourceId] = true;
  });

  if (!Object.keys(responseIdLookup).length && !Object.keys(responseSourceIdLookup).length) return [];

  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  var headerMap = requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  try { sheet.hideSheet(); } catch (ignore) {}
  if (sheet.getLastRow() < 2) return [];

  var rowCount = sheet.getLastRow() - 1;
  var responseIdValues = sheet.getRange(2, headerMap[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID], rowCount, 1).getValues();
  var responseSourceIdValues = sheet.getRange(2, headerMap[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID], rowCount, 1).getValues();
  var requestIdValues = sheet.getRange(2, headerMap[H.REQUEST_SOURCE_INDEX.REQUEST_ID], rowCount, 1).getValues();
  var createdAtValues = sheet.getRange(2, headerMap[H.REQUEST_SOURCE_INDEX.CREATED_AT], rowCount, 1).getValues();
  var matches = [];

  for (var i = 0; i < rowCount; i++) {
    var responseId = safeString_(responseIdValues[i][0]);
    var responseSourceId = safeString_(responseSourceIdValues[i][0]);
    if (!responseIdLookup[responseId] && !responseSourceIdLookup[responseSourceId]) continue;

    var record = { _rowNumber: i + 2 };
    record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = responseId;
    record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = responseSourceId;
    record[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = requestIdValues[i][0];
    record[H.REQUEST_SOURCE_INDEX.CREATED_AT] = createdAtValues[i][0];
    matches.push(record);
  }

  return matches;
}

function isRequestAlreadyCreatedForResponse_(responseId) {
  return Boolean(findIndexedRequestByResponseId_(responseId));
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
    employeeEmail: valueFor(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_EMAIL),
    startDate: parseDateFlexible_(valueFor(FORM_RESPONSE_TITLE_CANDIDATES.START_DATE)),
    endDate: parseDateFlexible_(valueFor(FORM_RESPONSE_TITLE_CANDIDATES.END_DATE)),
    trainingUnit: valueFor(FORM_RESPONSE_TITLE_CANDIDATES.TRAINING_UNIT),
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


function isInvalidDateOrderError_(err) {
  return safeString_(err && err.message ? err.message : err) === 'Start date cannot be after end date.';
}

function markResponseRowRequiresReview_(sheet, rowNumber, map, err) {
  var retryCount = toNumber_(sheet.getRange(rowNumber, map[RESPONSE_QUEUE.RETRY_COUNT]).getValue(), 0) + 1;
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.ERROR_REQUIRES_REVIEW;
  updates[RESPONSE_QUEUE.LAST_ERROR] = err && err.message ? err.message : safeString_(err);
  updates[RESPONSE_QUEUE.RETRY_COUNT] = retryCount;
  updates[RESPONSE_QUEUE.LAST_ATTEMPT_AT] = now_();
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function markResponseRowReviewRequiredIfMaxed_(sheet, rowNumber, row, map, maxRetries) {
  var status = map[RESPONSE_QUEUE.STATUS] ? safeString_(row[map[RESPONSE_QUEUE.STATUS] - 1]) : '';
  if (status !== RESPONSE_QUEUE_STATUS.ERROR) return;
  if (getResponseRowRetryCount_(row, map) < maxRetries) return;

  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.ERROR_REQUIRES_REVIEW;
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function markResponseRowProcessing_(sheet, rowNumber, map) {
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.PROCESSING;
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

function markResponseRowError_(sheet, rowNumber, map, err, maxRetries) {
  var retryCount = toNumber_(sheet.getRange(rowNumber, map[RESPONSE_QUEUE.RETRY_COUNT]).getValue(), 0) + 1;
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = retryCount >= maxRetries ? RESPONSE_QUEUE_STATUS.ERROR_REQUIRES_REVIEW : RESPONSE_QUEUE_STATUS.ERROR;
  updates[RESPONSE_QUEUE.LAST_ERROR] = err && err.message ? err.message : safeString_(err);
  updates[RESPONSE_QUEUE.RETRY_COUNT] = retryCount;
  updates[RESPONSE_QUEUE.LAST_ATTEMPT_AT] = now_();
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function updateResponseQueueRow_(sheet, rowNumber, map, updates) {
  Object.keys(updates).forEach(function(header) {
    if (!map[header]) throw new Error('Cannot update missing response queue column: ' + header);
  });
  var lastCol = sheet.getLastColumn();
  var row = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  Object.keys(updates).forEach(function(header) {
    row[map[header] - 1] = updates[header];
  });
  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([row]);
}
