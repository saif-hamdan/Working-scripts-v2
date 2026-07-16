/** Requeues processed response rows whose assigned request belongs to different form data. */
function run16_requeueMismatchedProcessedResponses() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var cfg = getConfig();
    if (!cfg.FORM_RESPONSES_SPREADSHEET_ID) {
      throw new Error('FORM_RESPONSES_SPREADSHEET_ID is not configured.');
    }

    var responseSpreadsheet = SpreadsheetApp.openById(cfg.FORM_RESPONSES_SPREADSHEET_ID);
    var responseSheet = findFormResponsesSheet_(responseSpreadsheet);
    if (!responseSheet || responseSheet.getLastRow() < 2) {
      return 'No form response rows were found.';
    }

    var map = ensureResponseQueueColumns_(responseSheet);
    var headers = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0].map(safeString_);
    var rows = responseSheet.getRange(2, 1, responseSheet.getLastRow() - 1, responseSheet.getLastColumn()).getValues();
    var recordsByRequestId = {};
    getRecords_().forEach(function(record) {
      var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
      if (requestId) recordsByRequestId[requestId] = record;
    });

    var requeuedRows = [];
    rows.forEach(function(row, index) {
      if (!isResponseRowProcessed_(row, map)) return;
      var requestIds = safeString_(row[map[RESPONSE_QUEUE.REQUEST_ID] - 1])
        .split(',')
        .map(function(requestId) { return requestId.trim(); })
        .filter(Boolean);
      if (!requestIds.length) return;

      var data = parseLinkedResponseRow_(
        stripResponseQueueHeaders_(headers, map),
        stripResponseQueueRow_(row, headers, map)
      );
      var knownRecords = requestIds.map(function(requestId) { return recordsByRequestId[requestId]; }).filter(Boolean);
      if (!knownRecords.length) return;
      if (knownRecords.some(function(record) { return responseDataMatchesRequestRecord_(data, record); })) return;

      var rowNumber = index + 2;
      var updates = {};
      updates[RESPONSE_QUEUE.STATUS] = RESPONSE_QUEUE_STATUS.NEW;
      updates[RESPONSE_QUEUE.PROCESSED_AT] = '';
      updates[RESPONSE_QUEUE.REQUEST_ID] = '';
      updates[RESPONSE_QUEUE.LAST_ERROR] = '';
      updates[RESPONSE_QUEUE.RETRY_COUNT] = 0;
      updates[RESPONSE_QUEUE.LAST_ATTEMPT_AT] = '';
      updateResponseQueueRow_(responseSheet, rowNumber, map, updates);
      requeuedRows.push(rowNumber);
    });

    var message = requeuedRows.length
      ? 'Requeued mismatched response rows: ' + requeuedRows.join(', ') + '. Run processUnprocessedFormResponses() next.'
      : 'No mismatched processed response rows were found.';
    Logger.log(message);
    return message;
  } finally {
    lock.releaseLock();
  }
}

function responseDataMatchesRequestRecord_(data, record) {
  var options = normalizeRotationOptionsFromSubmission_(data);
  if (!options.length) return false;
  var option = options[0];
  return normalizeKey_(data.employeeId) === normalizeKey_(record[H.RECORD.EMPLOYEE_ID])
    && normalizeKey_(option.rotationUnit) === normalizeKey_(record[H.RECORD.ROTATION_UNIT])
    && normalizeKey_(option.section) === normalizeKey_(record[H.RECORD.SECTION])
    && formatDate_(option.fromDate) === formatDate_(record[H.RECORD.START_DATE])
    && formatDate_(option.toDate) === formatDate_(record[H.RECORD.END_DATE]);
}
