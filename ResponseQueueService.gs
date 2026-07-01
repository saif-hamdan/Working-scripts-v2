/** Response-sheet backed queue processing for Google Form submissions. */
const RESPONSE_QUEUE = Object.freeze({
  PROCESSED: 'Processed',
  PROCESSED_AT: 'Processed At',
  REQUEST_ID: 'Request ID',
  LAST_ERROR: 'Processing Error'
});

function processUnprocessedFormResponses() {
  var cfg = getConfig();
  if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
    logInfo_('processUnprocessedFormResponses', '', 'FORM_RESPONSES_SPREADSHEET_ID is not configured; skipping response queue.');
    return 0;
  }

  var ss = SpreadsheetApp.openById(cfg.FORM_RESPONSES_SPREADSHEET_ID);
  var sheet = findFormResponsesSheet_(ss);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  ensureResponseQueueColumns_(sheet);
  var map = getHeaderMap_(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  var processedCount = 0;

  rows.forEach(function(row, index) {
    var rowNumber = index + 2;
    if (!hasResponseRowData_(row, headers)) return;
    if (isResponseRowProcessed_(row, map)) return;

    var responseId = makeResponseQueueId_(ss, sheet, rowNumber);
    var existingRecord = findRequestByResponseId_(responseId);
    if (existingRecord) {
      markResponseRowProcessed_(sheet, rowNumber, map, existingRecord[H.RECORD.REQUEST_ID] || responseId, '');
      processedCount++;
      return;
    }

    try {
      var event = buildFormSubmitEventFromResponseRow_(headers, row, responseId);
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
  var map = getHeaderMap_(sheet);
  [RESPONSE_QUEUE.PROCESSED, RESPONSE_QUEUE.PROCESSED_AT, RESPONSE_QUEUE.REQUEST_ID, RESPONSE_QUEUE.LAST_ERROR].forEach(function(header) {
    if (!map[header]) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(header);
      map[header] = col;
    }
  });
}

function hasResponseRowData_(row, headers) {
  for (var i = 0; i < headers.length; i++) {
    if (isResponseQueueHeader_(headers[i])) continue;
    if (row[i] !== '' && row[i] !== null) return true;
  }
  return false;
}

function isResponseRowProcessed_(row, map) {
  var value = map[RESPONSE_QUEUE.PROCESSED] ? row[map[RESPONSE_QUEUE.PROCESSED] - 1] : '';
  return normalizeKey_(value) === 'yes' || normalizeKey_(value) === 'true' || safeString_(value) === STATUS.YES;
}

function buildFormSubmitEventFromResponseRow_(headers, row, responseId) {
  var namedValues = {};
  headers.forEach(function(header, index) {
    if (!header || isResponseQueueHeader_(header)) return;
    namedValues[header] = [row[index]];
  });
  return { namedValues: namedValues, responseId: responseId };
}

function isResponseQueueHeader_(header) {
  return header === RESPONSE_QUEUE.PROCESSED ||
    header === RESPONSE_QUEUE.PROCESSED_AT ||
    header === RESPONSE_QUEUE.REQUEST_ID ||
    header === RESPONSE_QUEUE.LAST_ERROR;
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

function markResponseRowProcessed_(sheet, rowNumber, map, requestId, error) {
  var updates = {};
  updates[RESPONSE_QUEUE.PROCESSED] = STATUS.YES;
  updates[RESPONSE_QUEUE.PROCESSED_AT] = now_();
  updates[RESPONSE_QUEUE.REQUEST_ID] = requestId || '';
  updates[RESPONSE_QUEUE.LAST_ERROR] = error || '';
  updateObjectRow_(sheet, rowNumber, updates);
}

function markResponseRowError_(sheet, rowNumber, map, err) {
  var updates = {};
  updates[RESPONSE_QUEUE.PROCESSED] = STATUS.NO;
  updates[RESPONSE_QUEUE.LAST_ERROR] = err && err.message ? err.message : safeString_(err);
  updateObjectRow_(sheet, rowNumber, updates);
}
