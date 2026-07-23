/** Spreadsheet helpers. */
function openDashboardSpreadsheet_() {
  var id = getConfig().DASHBOARD_SPREADSHEET_ID;
  if (!id) throw new Error('DASHBOARD_SPREADSHEET_ID is not configured.');
  return SpreadsheetApp.openById(id);
}

function ensureSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getSheet_(name) {
  return openDashboardSpreadsheet_().getSheetByName(name);
}

function getOrCreateSheet_(name) {
  return ensureSheet_(openDashboardSpreadsheet_(), name);
}

function setSheetHeaders_(sheet, headers) {
  if (!sheet) throw new Error('Cannot set headers on a missing sheet.');
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  try { sheet.setRightToLeft(true); } catch (ignore) {}
  sheet.setFrozenRows(1);
}


function normalizeHeaderAlias_(header) {
  var h = safeString_(header);
  var oldRotationUnitAr = 'وحدة ال' + 'تد' + 'ريب المطلوبة';
  var oldSectionAr = 'القسم المطلوب';
  var oldHoursAr = 'عدد ساعات ال' + 'تد' + 'ريب اليومية';
  var oldActiveCountAr = 'عدد الم' + 'تد' + 'ربين النشطين';
  var oldActiveEmployeesAr = 'الأرقام الوظيفية للم' + 'تد' + 'ربين النشطين';
  var oldAllEmployeesAr = 'جميع من ' + 'تد' + 'ربوا في القسم';
  var oldLastRotationAr = 'آخر تاريخ ' + 'تد' + 'ريب';
  if (typeof H !== 'undefined') {
    if (h === oldRotationUnitAr) return H.RECORD.ROTATION_UNIT;
    if (h === oldSectionAr) return H.RECORD.SECTION;
    if (h === oldHoursAr) return H.RECORD.HOURS;
    if (h === oldActiveCountAr) return H.DASHBOARD.ACTIVE_COUNT;
    if (h === oldActiveEmployeesAr) return H.DASHBOARD.ACTIVE_TRAINEES;
    if (h === oldAllEmployeesAr) return H.DASHBOARD.ALL_TRAINEES;
    if (h === oldLastRotationAr) return H.DASHBOARD.LAST_ROTATION;
  }
  return h;
}

function getHeaderMap_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return {};
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(header, index) {
    var h = normalizeHeaderAlias_(header);
    if (h) map[h] = index + 1;
  });
  return map;
}

function requireHeaders_(sheet, headers) {
  var map = getHeaderMap_(sheet);
  var missing = headers.filter(function(h) { return !map[h]; });
  if (missing.length) {
    throw new Error('Missing columns in sheet "' + sheet.getName() + '": ' + missing.join(', '));
  }
  return map;
}

function getDataObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeaderAlias_);
  var rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var objects = [];
  rows.forEach(function(row, index) {
    var obj = { _rowNumber: index + 2 };
    var hasValue = false;
    headers.forEach(function(header, colIndex) {
      if (!header) return;
      obj[header] = row[colIndex];
      if (row[colIndex] !== '' && row[colIndex] !== null) hasValue = true;
    });
    if (hasValue) objects.push(obj);
  });
  return objects;
}


function objectFromQueueRow_(headers, row, rowNumber) {
  var obj = { _rowNumber: rowNumber };
  headers.forEach(function(header, colIndex) {
    if (header) obj[header] = row[colIndex];
  });
  return obj;
}

function appendObjectRow_(sheet, headers, obj) {
  var row = headers.map(function(header) {
    return obj[header] === undefined ? '' : obj[header];
  });
  var rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  return rowNumber;
}

function updateObjectRow_(sheet, rowNumber, updates) {
  var map = getHeaderMap_(sheet);
  Object.keys(updates).forEach(function(header) {
    if (!map[header]) throw new Error('Cannot update missing column: ' + header + ' in ' + sheet.getName());
  });
  var lastCol = sheet.getLastColumn();
  var row = sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
  Object.keys(updates).forEach(function(header) {
    row[map[header] - 1] = updates[header];
  });
  sheet.getRange(rowNumber, 1, 1, lastCol).setValues([row]);
}

function findRowByValue_(sheet, header, value) {
  var map = getHeaderMap_(sheet);
  if (!map[header] || sheet.getLastRow() < 2) return null;
  var target = safeString_(value);
  if (!target) return null;
  var match = sheet
    .getRange(2, map[header], sheet.getLastRow() - 1, 1)
    .createTextFinder(target)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : null;
}

function findObjectByValue_(sheet, header, value) {
  var rowNumber = findRowByValue_(sheet, header, value);
  if (!rowNumber) return null;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
  var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  var obj = { _rowNumber: rowNumber };
  headers.forEach(function(h, idx) { if (h) obj[h] = values[idx]; });
  return obj;
}

function findObjectsByValue_(sheet, header, value, maxResults) {
  var map = getHeaderMap_(sheet);
  var target = safeString_(value);
  if (!map[header] || !target || sheet.getLastRow() < 2) return [];
  var matches = sheet
    .getRange(2, map[header], sheet.getLastRow() - 1, 1)
    .createTextFinder(target)
    .matchEntireCell(true)
    .findAll();
  var limit = Math.max(1, toNumber_(maxResults, 500));
  var rowNumbers = [];
  var seenRows = {};
  matches.slice(0, limit).forEach(function(match) {
    var rowNumber = match.getRow();
    if (!seenRows[rowNumber]) {
      seenRows[rowNumber] = true;
      rowNumbers.push(rowNumber);
    }
  });
  if (!rowNumbers.length) return [];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(safeString_);
  return rowNumbers.map(function(rowNumber) {
    var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    var obj = { _rowNumber: rowNumber };
    headers.forEach(function(h, index) { if (h) obj[h] = values[index]; });
    return obj;
  });
}

function clearAndWriteObjects_(sheet, headers, objects) {
  sheet.clear();
  setSheetHeaders_(sheet, headers);
  if (objects && objects.length) {
    var rows = objects.map(function(obj) {
      return headers.map(function(h) { return obj[h] === undefined ? '' : obj[h]; });
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function applyCleanTableFormatting_(sheet, headerCount) {
  if (!sheet) return;
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(headerCount || sheet.getLastColumn(), 1);
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  range.setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#F5F1E8');
  try { sheet.setRightToLeft(true); } catch (ignore) {}
  sheet.setFrozenRows(1);
  for (var c = 1; c <= lastCol; c++) sheet.autoResizeColumn(c);
  try {
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1, 1, Math.max(lastRow, 2), lastCol).createFilter();
  } catch (ignore2) {}
  applyStandardDateFormats_(sheet);
}

function applyStandardDateFormats_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return;
  var map = getHeaderMap_(sheet);
  var rowCount = sheet.getLastRow() - 1;
  [
    H.RECORD.EMPLOYEE_HIRE_DATE,
    H.RECORD.START_DATE,
    H.RECORD.END_DATE,
    H.RECORD.DECISION_DATE,
    H.DASHBOARD.LAST_ROTATION
  ].forEach(function(header) {
    if (map[header]) sheet.getRange(2, map[header], rowCount, 1).setNumberFormat('dd/MM/yyyy');
  });
  [
    H.RECORD.TIMESTAMP,
    H.RECORD.APPROVAL_EMAIL_SENT_AT,
    H.RECORD.EVALUATION_SENT_AT,
    H.RECORD.LAST_UPDATED,
    H.QUEUE.CREATED_AT,
    H.QUEUE.LAST_ATTEMPT_AT
  ].forEach(function(header) {
    if (map[header]) sheet.getRange(2, map[header], rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  });
}

function hideInternalColumns_(sheet) {
  var map = getHeaderMap_(sheet);
  [
    H.RECORD.TOKEN,
    H.RECORD.APPROVER_EMAIL,
    H.RECORD.FORM_RESPONSE_ID,
    H.RECORD.FORM_RESPONSE_SOURCE_ID,
    H.RECORD.LOCK_VERSION,
    H.RECORD.EMAIL_RETRY_COUNT,
    H.RECORD.LAST_ERROR
  ].forEach(function(header) {
    if (map[header]) sheet.hideColumns(map[header]);
  });
}

function getRequestSourceIndex_() {
  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  try { sheet.hideSheet(); } catch (ignore) {}
  return getDataObjects_(sheet);
}

function normalizeRequestSourceIndexRecord_(record) {
  record = record || {};
  var indexRecord = {};
  indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = safeString_(record[H.RECORD.FORM_RESPONSE_ID] || record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID]);
  indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = safeString_(record[H.RECORD.FORM_RESPONSE_SOURCE_ID] || record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID]);
  indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID] = safeString_(record[H.RECORD.REQUEST_GROUP_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID]);
  indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER] = toNumber_(record[H.RECORD.OPTION_ORDER] || record[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER], 0);
  indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_KEY] = safeString_(record[H.RECORD.SELECTION_KEY] || record[H.REQUEST_SOURCE_INDEX.SELECTION_KEY]);
  indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = safeString_(record[H.RECORD.REQUEST_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_ID]);
  indexRecord[H.REQUEST_SOURCE_INDEX.CREATED_AT] = record[H.RECORD.TIMESTAMP] || record[H.REQUEST_SOURCE_INDEX.CREATED_AT] || now_();
  if (record._rowNumber) indexRecord._rowNumber = record._rowNumber;
  return indexRecord;
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
  var values = sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).getValues();
  var matches = [];

  for (var i = 0; i < rowCount; i++) {
    var row = values[i];
    var responseId = safeString_(row[headerMap[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] - 1]);
    var responseSourceId = safeString_(row[headerMap[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] - 1]);
    if (!responseIdLookup[responseId] && !responseSourceIdLookup[responseSourceId]) continue;

    var record = { _rowNumber: i + 2 };
    record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = responseId;
    record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = responseSourceId;
    record[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = row[headerMap[H.REQUEST_SOURCE_INDEX.REQUEST_ID] - 1];
    record[H.REQUEST_SOURCE_INDEX.CREATED_AT] = row[headerMap[H.REQUEST_SOURCE_INDEX.CREATED_AT] - 1];
    matches.push(record);
  }

  return matches;
}

function findIndexedRequestByResponseId_(responseId) {
  responseId = safeString_(responseId);
  if (!responseId) return null;
  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  return findObjectByValue_(sheet, H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID, responseId);
}

function findIndexedRequestByResponseSourceId_(sourceId) {
  sourceId = safeString_(sourceId);
  if (!sourceId) return null;
  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  return findObjectByValue_(sheet, H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID, sourceId);
}

function findIndexedRequestBySelectionKey_(selectionKey) {
  selectionKey = safeString_(selectionKey);
  if (!selectionKey) return null;
  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  return findObjectByValue_(sheet, H.REQUEST_SOURCE_INDEX.SELECTION_KEY, selectionKey);
}

function appendRequestSourceIndex_(record) {
  record = record || {};
  var responseId = safeString_(record[H.RECORD.FORM_RESPONSE_ID] || record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID]);
  var sourceId = safeString_(record[H.RECORD.FORM_RESPONSE_SOURCE_ID] || record[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID]);
  var selectionKey = safeString_(record[H.RECORD.SELECTION_KEY] || record[H.REQUEST_SOURCE_INDEX.SELECTION_KEY]);
  var requestId = safeString_(record[H.RECORD.REQUEST_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_ID]);
  if (!requestId || (!responseId && !sourceId && !selectionKey)) return null;

  var existing = selectionKey
    ? findIndexedRequestBySelectionKey_(selectionKey)
    : (responseId
      ? findIndexedRequestByResponseId_(responseId)
      : (sourceId ? findIndexedRequestByResponseSourceId_(sourceId) : null));
  if (existing) return existing;

  var sheet = getOrCreateSheet_(SHEETS.REQUEST_SOURCE_INDEX);
  requireHeaders_(sheet, REQUEST_SOURCE_INDEX_HEADERS);
  var indexRecord = {};
  indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = responseId;
  indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = sourceId;
  indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID] = safeString_(record[H.RECORD.REQUEST_GROUP_ID] || record[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID]);
  indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER] = toNumber_(record[H.RECORD.OPTION_ORDER] || record[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER], 0);
  indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_KEY] = selectionKey;
  indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = requestId;
  indexRecord[H.REQUEST_SOURCE_INDEX.CREATED_AT] = record[H.RECORD.TIMESTAMP] || record[H.REQUEST_SOURCE_INDEX.CREATED_AT] || now_();
  indexRecord._rowNumber = appendObjectRow_(sheet, REQUEST_SOURCE_INDEX_HEADERS, indexRecord);
  try { sheet.hideSheet(); } catch (ignore) {}
  return indexRecord;
}

function backfillRequestSourceIndexIfEmpty_(indexSheet, recordsSheet) {
  if (!indexSheet || indexSheet.getLastRow() >= 2 || !recordsSheet || recordsSheet.getLastRow() < 2) return;
  requireHeaders_(recordsSheet, RECORD_HEADERS);
  var rows = getDataObjects_(recordsSheet);
  var indexRows = [];
  rows.forEach(function(record) {
    var responseId = safeString_(record[H.RECORD.FORM_RESPONSE_ID]);
    var sourceId = safeString_(record[H.RECORD.FORM_RESPONSE_SOURCE_ID]);
    var requestId = safeString_(record[H.RECORD.REQUEST_ID]);
    if (!requestId || (!responseId && !sourceId)) return;
    var indexRecord = {};
    indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_ID] = responseId;
    indexRecord[H.REQUEST_SOURCE_INDEX.FORM_RESPONSE_SOURCE_ID] = sourceId;
    indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID] = safeString_(record[H.RECORD.REQUEST_GROUP_ID]);
    indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER] = toNumber_(record[H.RECORD.OPTION_ORDER], 0);
    indexRecord[H.REQUEST_SOURCE_INDEX.SELECTION_KEY] = safeString_(record[H.RECORD.SELECTION_KEY]) ||
      makeSelectionIdempotencyKey_(sourceId || responseId, record[H.RECORD.OPTION_ORDER] || 1);
    indexRecord[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = requestId;
    indexRecord[H.REQUEST_SOURCE_INDEX.CREATED_AT] = record[H.RECORD.TIMESTAMP] || now_();
    indexRows.push(indexRecord);
  });
  if (!indexRows.length) return;
  var values = indexRows.map(function(row) {
    return REQUEST_SOURCE_INDEX_HEADERS.map(function(header) { return row[header] === undefined ? '' : row[header]; });
  });
  indexSheet.getRange(2, 1, values.length, REQUEST_SOURCE_INDEX_HEADERS.length).setValues(values);
}
