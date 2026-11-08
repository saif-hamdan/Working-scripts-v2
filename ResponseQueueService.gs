/** Response-sheet backed queue processing for Google Form submissions. */
const RESPONSE_QUEUE = Object.freeze({
  STATUS: 'Processing Status',
  PROCESSED_AT: 'Processed At',
  REQUEST_ID: 'Dashboard Request ID',
  REQUEST_GROUP_ID: 'Request Group ID',
  SELECTION_COUNT: 'Selection Count',
  NEXT_SELECTION_NUMBER: 'Next Selection Number',
  LAST_ERROR: 'Processing Error',
  RETRY_COUNT: 'Retry Count',
  LAST_ATTEMPT_AT: 'Last Attempt At'
});

const RESPONSE_QUEUE_HEADERS = Object.freeze([
  RESPONSE_QUEUE.STATUS,
  RESPONSE_QUEUE.PROCESSED_AT,
  RESPONSE_QUEUE.REQUEST_ID,
  RESPONSE_QUEUE.REQUEST_GROUP_ID,
  RESPONSE_QUEUE.SELECTION_COUNT,
  RESPONSE_QUEUE.NEXT_SELECTION_NUMBER,
  RESPONSE_QUEUE.LAST_ERROR,
  RESPONSE_QUEUE.RETRY_COUNT,
  RESPONSE_QUEUE.LAST_ATTEMPT_AT
]);

const RESPONSE_QUEUE_STATUS = Object.freeze({
  NEW: 'PENDING',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  ERROR: 'RETRYABLE_ERROR',
  RETRYABLE_ERROR: 'RETRYABLE_ERROR',
  ERROR_REQUIRES_REVIEW: 'MANUAL_REVIEW',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
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
    var batchSize = cfg.RESPONSE_QUEUE_BATCH_SIZE || RESPONSE_QUEUE_BATCH_SIZE;
    var scanWindow = Math.max(batchSize, cfg.QUEUE_SCAN_WINDOW_ROWS || QUEUE_SCAN_WINDOW_ROWS);
    // New Google Form responses are appended at the bottom, so scan response
    // queue windows from newest to oldest while the cursor still wraps to cover
    // older ERROR rows that may need retry.
    var scanRange = getQueueScanRange_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, lastRow, scanWindow, { direction: 'backward' });
    var startRow = scanRange.startRow;
    var rows = scanRange.rowCount > 0 ? sheet.getRange(scanRange.startRow, 1, scanRange.rowCount, sheet.getLastColumn()).getValues() : [];
    var processedCount = 0;
    var skippedCount = 0;
    var failedCount = 0;
    var stoppedEarly = false;
    var stoppedForBatch = false;
    var scannedCount = 0;
    var actionableCount = 0;
    var remainingLikely = scanRange.startRow > 2;
    var cursorDeferred = false;

    var responseQueueItems = [];
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
      if (actionableCount >= batchSize) {
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
      responseQueueItems.push({ row: row, rowNumber: rowNumber, responseId: responseId, responseSourceId: '' });
    }

    var recordsByResponseSourceId = {};
    var recordsByResponseId = {};

    for (var itemIndex = 0; itemIndex < responseQueueItems.length; itemIndex++) {
      var item = responseQueueItems[itemIndex];
      var row = item.row;
      var rowNumber = item.rowNumber;
      var responseId = item.responseId;
      var responseSourceId = item.responseSourceId;
      var recordsHandled = [];
      try {
        var data = null;
        markResponseRowProcessing_(sheet, rowNumber, map);
        data = parseLinkedResponseRow_(stripResponseQueueHeaders_(headers, map), stripResponseQueueRow_(row, headers, map));
        responseSourceId = safeString_(data.responseSourceId || responseSourceId);
        var sourceInfo = buildRequestSourceInfo_(data);
        sourceInfo.responseId = responseId;
        sourceInfo.responseSourceId = responseSourceId;
        var startSelectionNumber = Math.max(1, getResponseRowNextSelectionNumber_(row, map));
        var selectionCount = normalizeRotationOptionsFromSubmission_(data).length;
        var requestIdsCreated = splitCsv_(map[RESPONSE_QUEUE.REQUEST_ID] ? row[map[RESPONSE_QUEUE.REQUEST_ID] - 1] : '');
        requestCreationOptions.startSelectionNumber = startSelectionNumber;
        requestCreationOptions.onSelectionProcessed = function(selectionNumber, totalSelections, createdRecord) {
          recordsHandled.push(createdRecord);
          var createdRequestId = safeString_(createdRecord[H.RECORD.REQUEST_ID] || createdRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID]);
          if (createdRequestId && requestIdsCreated.indexOf(createdRequestId) === -1) requestIdsCreated.push(createdRequestId);
          markResponseSelectionProgress_(
            sheet,
            rowNumber,
            map,
            selectionNumber + 1,
            totalSelections,
            createdRecord[H.RECORD.REQUEST_GROUP_ID] || createdRecord[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID],
            requestIdsCreated
          );
          if (shouldStopBeforeNextParentSelection_(options.startedAt, selectionNumber, totalSelections)) {
            var partialError = new Error('Parent submission paused safely after selection ' + selectionNumber + '.');
            partialError.code = 'PARTIAL_PARENT_RETRY';
            throw partialError;
          }
        };
        var record = createRequestFromNormalizedData_(data, sourceInfo, requestCreationOptions);
        var primaryRecord = Array.isArray(record) ? record[0] : record;
        var requestIds = requestIdsCreated.join(', ');
        var indexRecord = normalizeRequestSourceIndexRecord_(primaryRecord);
        if (responseSourceId && !recordsByResponseSourceId[responseSourceId]) recordsByResponseSourceId[responseSourceId] = indexRecord;
        if (responseId && !recordsByResponseId[responseId]) recordsByResponseId[responseId] = indexRecord;
        if (recordsHandled.length) {
          try { refreshDashboardForRecords_(recordsHandled); } catch (refreshErr) { logError_('processUnprocessedFormResponses:refresh', responseId, refreshErr); }
          recordsHandled = [];
        }
        markResponseRowProcessed_(sheet, rowNumber, map, requestIds || responseId, '');
        processedCount++;
        logInfo_('processUnprocessedFormResponses', requestIds, 'Queued form response processed from row ' + rowNumber + '.');
      } catch (err) {
        if (recordsHandled.length) {
          try { refreshDashboardForRecords_(recordsHandled); } catch (refreshErr) { logError_('processUnprocessedFormResponses:refresh', responseId, refreshErr); }
        }
        if (isSubmissionValidationError_(err) && data) {
          markResponseRowRequiresReview_(sheet, rowNumber, map, err);
          sendInvalidDatesSubmissionEmail(data, responseId, err);
        } else if (err && err.code === 'PARTIAL_PARENT_RETRY') {
          markResponseRowRetryable_(sheet, rowNumber, map, err, false);
          stoppedEarly = true;
          remainingLikely = true;
          setQueueScanCursor_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, rowNumber, lastRow);
          cursorDeferred = true;
        } else {
          markResponseRowError_(sheet, rowNumber, map, err, cfg.RESPONSE_QUEUE_MAX_RETRIES);
        }
        failedCount++;
        logError_('processUnprocessedFormResponses', responseId, err);
        if (err && err.code === 'PARTIAL_PARENT_RETRY') break;
      }
    }

    if (!cursorDeferred) advanceQueueScanCursor_(RESPONSE_QUEUE_SCAN_CURSOR_KEY, scanRange, lastRow);
    var stats = buildResponseQueueStats_(processedCount, skippedCount, failedCount, stoppedEarly, scannedCount, remainingLikely);
    stats.stoppedForBatch = stoppedForBatch;
    logInfo_('processUnprocessedFormResponses', '', formatResponseQueueStats_(stats));
    logQueueStoppedEarly_('processUnprocessedFormResponses', '', stats, batchSize);
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

function findExistingResponseQueueRequest_(responseId, responseSourceId, recordsByResponseId, recordsByResponseSourceId) {
  responseId = safeString_(responseId);
  responseSourceId = safeString_(responseSourceId);
  if (responseId) return recordsByResponseId[responseId] || null;
  return responseSourceId ? (recordsByResponseSourceId[responseSourceId] || null) : null;
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
  var createdColumns = false;

  if (!queueStart) {
    queueStart = lastCol + 1;
    sheet.getRange(1, queueStart, 1, RESPONSE_QUEUE_HEADERS.length).setValues([RESPONSE_QUEUE_HEADERS]);
    createdColumns = true;
  }

  var map = {};
  RESPONSE_QUEUE_HEADERS.forEach(function(header, index) {
    map[header] = queueStart + index;
  });
  if (createdColumns && sheet.getMaxRows() > 1) {
    var dataRowCount = sheet.getMaxRows() - 1;
    sheet.getRange(2, map[RESPONSE_QUEUE.PROCESSED_AT], dataRowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sheet.getRange(2, map[RESPONSE_QUEUE.LAST_ATTEMPT_AT], dataRowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
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

function getResponseRowNextSelectionNumber_(row, map) {
  if (!map[RESPONSE_QUEUE.NEXT_SELECTION_NUMBER]) return 1;
  return Math.max(1, toNumber_(row[map[RESPONSE_QUEUE.NEXT_SELECTION_NUMBER] - 1], 1));
}

function shouldStopBeforeNextParentSelection_(startedAt, processedSelectionNumber, totalSelections) {
  if (processedSelectionNumber >= totalSelections || !startedAt) return false;
  return Date.now() - startedAt >= SYNC_CONFIG.PARENT_SELECTION_STOP_MS;
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
  var cleanHeaders = stripResponseQueueHeaders_(headers, map);
  var cleanRow = stripResponseQueueRow_(row, headers, map);
  return parseLinkedResponseRow_(cleanHeaders, cleanRow).responseSourceId;

  // Legacy single-rotation hashing is intentionally retained below as
  // unreachable rollback reference.
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

  var rotationUnit = valueFor(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_UNIT);
  var data = {
    timestamp: valueFor(['Timestamp', 'الطابع الزمني']),
    submitterEmail: valueFor(['Email Address', 'البريد الإلكتروني', FORM.TITLES.DIRECT_MANAGER_EMAIL]),
    employeeId: valueFor(FORM_RESPONSE_TITLE_CANDIDATES.EMPLOYEE_ID),
    startDate: parseDateFlexible_(valueFor(expandUnitScopedTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_FROM, rotationUnit))),
    endDate: parseDateFlexible_(valueFor(expandUnitScopedTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_TO, rotationUnit))),
    rotationUnit: rotationUnit,
    section: valueFor(expandUnitScopedTitles_(FORM_RESPONSE_TITLE_CANDIDATES.ROTATION_SECTION, rotationUnit))
  };

  if (!safeString_(data.section)) {
    for (var k = 0; k < headers.length; k++) {
      if (isResponseQueueColumnIndex_(k + 1, map)) continue;
      if (isRotationSectionResponseHeader_(headers[k]) && safeString_(row[k])) {
        data.section = row[k];
        break;
      }
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
  var currentNext = toNumber_(sheet.getRange(rowNumber, map[RESPONSE_QUEUE.NEXT_SELECTION_NUMBER]).getValue(), 0);
  if (!currentNext) updates[RESPONSE_QUEUE.NEXT_SELECTION_NUMBER] = 1;
  updateResponseQueueRow_(sheet, rowNumber, map, updates);
}

function markResponseSelectionProgress_(sheet, rowNumber, map, nextSelectionNumber, selectionCount, requestGroupId, requestIds) {
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.PROCESSING;
  updates[RESPONSE_QUEUE.NEXT_SELECTION_NUMBER] = nextSelectionNumber;
  updates[RESPONSE_QUEUE.SELECTION_COUNT] = selectionCount;
  updates[RESPONSE_QUEUE.REQUEST_GROUP_ID] = requestGroupId || '';
  updates[RESPONSE_QUEUE.REQUEST_ID] = (requestIds || []).join(', ');
  updates[RESPONSE_QUEUE.LAST_ATTEMPT_AT] = now_();
  updates[RESPONSE_QUEUE.LAST_ERROR] = '';
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

function markResponseRowRetryable_(sheet, rowNumber, map, err, incrementRetry) {
  var retryCount = toNumber_(sheet.getRange(rowNumber, map[RESPONSE_QUEUE.RETRY_COUNT]).getValue(), 0);
  if (incrementRetry !== false) retryCount++;
  var updates = {};
  updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.RETRYABLE_ERROR;
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
