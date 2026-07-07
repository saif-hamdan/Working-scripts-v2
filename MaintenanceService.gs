/** Admin-only maintenance utilities. */
function rebuildRequestSourceIndex() {
  var action = 'rebuildRequestSourceIndex';
  var userEmail = getMaintenanceUserEmail_();
  if (!isAuthorizedEditor_(userEmail)) {
    var message = 'Unauthorized request source index rebuild blocked for ' + (userEmail || 'unknown user') + '.';
    logWarn_(action + ':unauthorized', '', message);
    throw new Error(message);
  }

  var ss = openDashboardSpreadsheet_();
  var recordsSheet = ss.getSheetByName(SHEETS.RECORDS);
  if (!recordsSheet) throw new Error('Missing sheet: ' + SHEETS.RECORDS);
  requireHeaders_(recordsSheet, RECORD_HEADERS);

  var indexSheet = ensureSheet_(ss, SHEETS.REQUEST_SOURCE_INDEX);
  setSheetHeaders_(indexSheet, REQUEST_SOURCE_INDEX_HEADERS);
  clearRequestSourceIndexRows_(indexSheet);

  var records = getDataObjects_(recordsSheet);
  var indexRows = [];
  records.forEach(function(record) {
    var responseId = safeString_(record[H.RECORD.FORM_RESPONSE_ID]);
    var sourceId = safeString_(record[H.RECORD.FORM_RESPONSE_SOURCE_ID]);
    var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (!requestId || (!responseId && !sourceId)) return;

    var indexRecord = {};
    indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = responseId;
    indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = sourceId;
    indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = requestId;
    indexRecord[H.REQUEST_SOURCE_INDEX.CREATED_AT] = record[H.RECORD.TIMESTAMP] || now_();
    indexRows.push(indexRecord);
  });

  if (indexRows.length) {
    var values = indexRows.map(function(row) {
      return REQUEST_SOURCE_INDEX_HEADERS.map(function(header) {
        return row[header] === undefined ? '' : row[header];
      });
    });
    indexSheet.getRange(2, 1, values.length, REQUEST_SOURCE_INDEX_HEADERS.length).setValues(values);
  }

  try { indexSheet.hideSheet(); } catch (ignore) {}
  logInfo_(action, '', 'Rebuilt request source index with ' + indexRows.length + ' indexed record(s).');
  return { indexedRecords: indexRows.length };
}

function clearRequestSourceIndexRows_(sheet) {
  var maxRows = sheet.getMaxRows();
  if (maxRows < 2) return;
  sheet.getRange(2, 1, maxRows - 1, Math.max(sheet.getMaxColumns(), REQUEST_SOURCE_INDEX_HEADERS.length)).clearContent();
}

function getMaintenanceUserEmail_() {
  try {
    var activeEmail = Session.getActiveUser().getEmail();
    if (activeEmail) return activeEmail;
  } catch (ignore) {}
  try {
    return Session.getEffectiveUser().getEmail();
  } catch (ignore2) {}
  return '';
}

function benchmarkRequestSourceIndexWithCopiedSampleData(options) {
  options = options || {};
  var action = 'benchmarkRequestSourceIndexWithCopiedSampleData';
  var userEmail = getMaintenanceUserEmail_();
  if (!isAuthorizedEditor_(userEmail)) {
    var message = 'Unauthorized request source index benchmark blocked for ' + (userEmail || 'unknown user') + '.';
    logWarn_(action + ':unauthorized', '', message);
    throw new Error(message);
  }

  var targetSize = Math.max(10000, toNumber_(options.targetSize, 10000));
  var lookupSize = Math.min(targetSize, Math.max(1, toNumber_(options.lookupSize, RESPONSE_QUEUE_BATCH_SIZE)));
  var ss = openDashboardSpreadsheet_();
  var recordsSheet = ss.getSheetByName(SHEETS.RECORDS);
  if (!recordsSheet || recordsSheet.getLastRow() < 2) throw new Error('At least one existing request record is required as sample data.');
  requireHeaders_(recordsSheet, RECORD_HEADERS);

  var indexSheet = ensureSheet_(ss, SHEETS.REQUEST_SOURCE_INDEX);
  setSheetHeaders_(indexSheet, REQUEST_SOURCE_INDEX_HEADERS);
  var originalLastRow = indexSheet.getLastRow();
  var originalLastCol = Math.max(indexSheet.getLastColumn(), REQUEST_SOURCE_INDEX_HEADERS.length);
  var originalValues = originalLastRow > 1 ? indexSheet.getRange(2, 1, originalLastRow - 1, originalLastCol).getValues() : [];

  try {
    clearRequestSourceIndexRows_(indexSheet);

    var sampleRecords = getDataObjects_(recordsSheet);
    var values = [];
    for (var i = 0; i < targetSize; i++) {
      var sample = sampleRecords[i % sampleRecords.length];
      var suffix = '-BENCH-' + (i + 1);
      values.push([
        safeString_(sample[H.RECORD.FORM_RESPONSE_ID]) || ('benchmark-response-id' + suffix),
        safeString_(sample[H.RECORD.FORM_RESPONSE_SOURCE_ID]) || ('benchmark-source-id' + suffix),
        (safeString_(sample[H.RECORD.REQUEST_ID]) || 'benchmark-request') + suffix,
        sample[H.RECORD.TIMESTAMP] || now_()
      ]);
    }

    var startedAt = new Date().getTime();
    indexSheet.getRange(2, 1, values.length, REQUEST_SOURCE_INDEX_HEADERS.length).setValues(values);
    var writeMs = new Date().getTime() - startedAt;

    var responseIds = [];
    var sourceIds = [];
    for (var j = 0; j < lookupSize; j++) {
      var valueIndex = targetSize - 1 - j;
      responseIds.push(values[valueIndex][0]);
      sourceIds.push(values[valueIndex][1]);
    }

    startedAt = new Date().getTime();
    var matches = findRequestsByResponseIds_(responseIds, sourceIds);
    var lookupMs = new Date().getTime() - startedAt;

    var result = {
      indexedRecords: targetSize,
      lookupKeys: lookupSize,
      matches: matches.length,
      writeMs: writeMs,
      lookupMs: lookupMs
    };
    logInfo_(action, '', 'Request source index benchmark: ' + JSON.stringify(result));
    return result;
  } finally {
    clearRequestSourceIndexRows_(indexSheet);
    if (originalValues.length) indexSheet.getRange(2, 1, originalValues.length, originalLastCol).setValues(originalValues);
    try { indexSheet.hideSheet(); } catch (ignore) {}
  }
}
