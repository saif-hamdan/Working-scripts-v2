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

function getHeaderMap_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return {};
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(header, index) {
    var h = safeString_(header);
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
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(safeString_);
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
  var values = sheet.getRange(2, map[header], sheet.getLastRow() - 1, 1).getValues();
  var target = safeString_(value);
  for (var i = 0; i < values.length; i++) {
    if (safeString_(values[i][0]) === target) return i + 2;
  }
  return null;
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
}

function hideInternalColumns_(sheet) {
  var map = getHeaderMap_(sheet);
  [
    H.RECORD.TOKEN,
    H.RECORD.APPROVER_EMAIL,
    H.RECORD.FORM_RESPONSE_ID,
    H.RECORD.LOCK_VERSION,
    H.RECORD.EMAIL_RETRY_COUNT,
    H.RECORD.LAST_ERROR
  ].forEach(function(header) {
    if (map[header]) sheet.hideColumns(map[header]);
  });
}
