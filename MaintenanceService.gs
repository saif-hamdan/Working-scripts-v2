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
