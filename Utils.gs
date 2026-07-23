/** General helpers. */
function now_() {
  return new Date();
}

function safeString_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate_(value);
  return String(value).trim();
}

function splitCsv_(value) {
  return safeString_(value)
    .split(',')
    .map(function(part) { return part.trim(); })
    .filter(function(part) { return part !== ''; });
}

function uniqueNonEmpty_(values) {
  var seen = {};
  var out = [];
  (values || []).forEach(function(value) {
    var s = safeString_(value);
    if (s && !seen[s]) {
      seen[s] = true;
      out.push(s);
    }
  });
  return out;
}

function normalizeKey_(value) {
  return safeString_(value).toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail_(value) {
  return safeString_(value).toLowerCase();
}

function makeStableSourceKey_(parts) {
  var normalized = (parts || []).map(function(part) {
    if (part instanceof Date) return formatDate_(part);
    return normalizeKey_(part);
  }).join('\u001f');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized);
  return digest.map(function(byte) {
    var unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function makeFormResponseSourceId_(data) {
  var sourceTimestamp = data && data.timestamp;
  if (sourceTimestamp instanceof Date && !isNaN(sourceTimestamp.getTime())) {
    sourceTimestamp = Utilities.formatDate(sourceTimestamp, SYSTEM.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  }
  var rotations = (data && data.rotationOptions || []).map(function(option) {
    return [
      option.optionOrder,
      option.rotationUnit,
      option.section,
      option.fromDate instanceof Date ? formatDate_(option.fromDate) : option.fromDate,
      option.toDate instanceof Date ? formatDate_(option.toDate) : option.toDate,
      option.hours
    ].join('\u001e');
  }).join('\u001d');
  return makeStableSourceKey_([
    sourceTimestamp,
    data && data.submitterEmail,
    data && data.employeeId,
    rotations || [
      data && data.startDate,
      data && data.endDate,
      data && data.rotationUnit,
      data && data.section,
      data && data.hours
    ].join('\u001e')
  ]);
}

function isActiveFlag_(value) {
  var s = normalizeKey_(value);
  return s === '' || s === 'yes' || s === 'y' || s === 'true' || s === '1' || s === 'نعم' || s === 'نشط';
}

function toNumber_(value, fallback) {
  var n = Number(value);
  return isNaN(n) ? (fallback || 0) : n;
}

function formatDate_(date) {
  if (!date) return '';
  var d = parseDateFlexible_(date);
  if (!d) return '';
  return Utilities.formatDate(d, SYSTEM.TIME_ZONE, 'dd/MM/yyyy');
}

function formatDateTime_(date) {
  if (!date) return '';
  var d = parseDateFlexible_(date);
  if (!d) return '';
  return Utilities.formatDate(d, SYSTEM.TIME_ZONE, 'dd/MM/yyyy HH:mm:ss');
}

function parseDateFlexible_(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var s = safeString_(value);
  if (!s) return null;

  var iso = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    var isoYear = Number(iso[1]);
    var isoMonth = Number(iso[2]);
    var isoDay = Number(iso[3]);
    var isoDate = new Date(isoYear, isoMonth - 1, isoDay);
    if (isoDate.getFullYear() === isoYear && isoDate.getMonth() === isoMonth - 1 && isoDate.getDate() === isoDay) return isoDate;
    return null;
  }

  var dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy) {
    var day = Number(dmy[1]);
    var month = Number(dmy[2]);
    var y = Number(dmy[3]);
    var dmyDate = new Date(y, month - 1, day);
    if (dmyDate.getFullYear() === y && dmyDate.getMonth() === month - 1 && dmyDate.getDate() === day) return dmyDate;
    return null;
  }

  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function dateOnly_(date) {
  var d = parseDateFlexible_(date);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isDateRangeOverlap_(startA, endA, startB, endB) {
  var a1 = dateOnly_(startA);
  var a2 = dateOnly_(endA);
  var b1 = dateOnly_(startB);
  var b2 = dateOnly_(endB);
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1.getTime() <= b2.getTime() && b1.getTime() <= a2.getTime();
}

function isTodayWithinRange_(startDate, endDate) {
  var today = dateOnly_(new Date());
  return isDateRangeOverlap_(today, today, startDate, endDate);
}

function generateToken_() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

function makeRequestId_() {
  // Caller should already hold the script lock. This avoids non-reentrant lock deadlocks
  // during form-submit processing.
  var props = PropertiesService.getScriptProperties();
  var year = Utilities.formatDate(new Date(), SYSTEM.TIME_ZONE, 'yyyy');
  var key = 'REQUEST_SEQUENCE_' + year;
  var next = Number(props.getProperty(key) || '0') + 1;
  props.setProperty(key, String(next));
  return SYSTEM.REQUEST_PREFIX + '-' + year + '-' + ('000000' + next).slice(-6);
}

function makeRequestGroupId_(stableResponseId) {
  var stable = safeString_(stableResponseId);
  if (!stable) stable = Utilities.getUuid();
  return 'GRP-' + makeStableSourceKey_([stable]).substring(0, 24);
}

function makeSelectionIdempotencyKey_(stableResponseId, selectionNumber) {
  return safeString_(stableResponseId) + ':' + String(Number(selectionNumber) || 0);
}

function makeWebAppUrl_(action, token) {
  var url = getConfig().WEB_APP_URL;
  if (!url) throw new Error('WEB_APP_URL is missing. Deploy the Apps Script as a Web App, then save the URL in settings.');
  return url + '?action=' + encodeURIComponent(action) + '&token=' + encodeURIComponent(token);
}

function objectToJson_(obj) {
  return JSON.stringify(obj || {}, function(key, value) {
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

function parseJsonSafe_(text, fallback) {
  try {
    return JSON.parse(text || '{}');
  } catch (err) {
    return fallback || {};
  }
}

function getQueueScanRange_(cursorKey, lastRow, scanWindowRows, options) {
  options = options || {};
  if (lastRow < 2) return { startRow: 2, endRow: 1, rowCount: 0, wrapped: false, direction: options.direction || 'forward' };

  var scanWindow = Math.max(1, toNumber_(scanWindowRows, 1));
  var props = PropertiesService.getScriptProperties();
  var storedCursor = safeString_(props.getProperty(cursorKey));
  var direction = options.direction === 'backward' ? 'backward' : 'forward';

  if (direction === 'backward') {
    var backwardCursor = toNumber_(storedCursor, lastRow);
    if (backwardCursor < 2 || backwardCursor > lastRow) backwardCursor = lastRow;
    var startRow = Math.max(2, backwardCursor - scanWindow + 1);
    return {
      startRow: startRow,
      endRow: backwardCursor,
      rowCount: backwardCursor - startRow + 1,
      wrapped: backwardCursor === lastRow && storedCursor !== '',
      direction: direction
    };
  }

  var cursor = toNumber_(storedCursor, 2);
  if (cursor < 2 || cursor > lastRow) cursor = 2;
  var endRow = Math.min(lastRow, cursor + scanWindow - 1);
  return {
    startRow: cursor,
    endRow: endRow,
    rowCount: endRow - cursor + 1,
    wrapped: cursor === 2 && storedCursor !== '',
    direction: direction
  };
}

function setQueueScanCursor_(cursorKey, nextRow, lastRow) {
  var cursor = toNumber_(nextRow, 2);
  if (lastRow < 2 || cursor < 2 || cursor > lastRow) cursor = 2;
  PropertiesService.getScriptProperties().setProperty(cursorKey, String(cursor));
  return cursor;
}

function advanceQueueScanCursor_(cursorKey, range, lastRow) {
  if (range && range.direction === 'backward') {
    return setQueueScanCursor_(cursorKey, range.startRow > 2 ? range.startRow - 1 : lastRow, lastRow);
  }
  return setQueueScanCursor_(cursorKey, range.endRow + 1, lastRow);
}

function logQueueStoppedEarly_(source, messageId, stats, batchSize) {
  if (!stats || !stats.remainingLikely || (!stats.stoppedEarly && !stats.stoppedForBatch)) return;
  var reason = stats.stoppedEarly ? 'runtime limit' : 'batch limit';
  logInfo_(source, messageId || '', 'Queue processor stopped before all actionable rows were exhausted (' + reason + '); more pending/error rows may remain. Batch size: ' + batchSize + ', scanned: ' + stats.scanned + '.');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getEffectiveUserEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || '';
  } catch (err) {
    return '';
  }
}

function getActiveUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || getEffectiveUserEmail_();
  } catch (err) {
    return getEffectiveUserEmail_();
  }
}

function throwIfMissing_(value, message) {
  if (!safeString_(value)) throw new Error(message);
  return value;
}

function htmlEscape_(value) {
  return safeString_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
