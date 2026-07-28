/** Employee-level rotation hour summary calculations. */
var EMPLOYEE_ROTATION_HOURS_LOOKUP_CACHE_ = {};

function refreshEmployeeRotationHoursSummary() {
  var rows = calculateEmployeeRotationHoursSummary_(getRecords_());
  renderEmployeeRotationHoursSummary_(rows);
  return rows;
}

function scheduledRefreshEmployeeRotationHoursSummary() {
  if (!isEmployeeRotationHoursSummaryActiveTime_()) {
    logInfo_('scheduledRefreshEmployeeRotationHoursSummary', '', 'Employee rotation hours summary skipped: outside 22:00-23:50 window.');
    return;
  }
  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(3000);
  if (!lockAcquired) {
    logInfo_('scheduledRefreshEmployeeRotationHoursSummary', '', 'Employee rotation hours summary skipped: another execution is already running.');
    return;
  }
  try {
    refreshEmployeeRotationHoursSummary();
    logInfo_('scheduledRefreshEmployeeRotationHoursSummary', '', 'Employee rotation hours summary refreshed.');
  } catch (err) {
    logError_('scheduledRefreshEmployeeRotationHoursSummary', '', err);
  } finally {
    lock.releaseLock();
  }
}

function refreshEmployeeTrainingHoursSummary() {
  return refreshEmployeeRotationHoursSummary();
}

function scheduledRefreshEmployeeTrainingHoursSummary() {
  return scheduledRefreshEmployeeRotationHoursSummary();
}

function isEmployeeRotationHoursSummaryActiveTime_(date) {
  var d = date || new Date();
  var hour = Number(Utilities.formatDate(d, EMPLOYEE_ROTATION_HOURS_CONFIG.TIMEZONE, 'H'));
  var minute = Number(Utilities.formatDate(d, EMPLOYEE_ROTATION_HOURS_CONFIG.TIMEZONE, 'm'));
  var minutesAfterMidnight = (hour * 60) + minute;
  return minutesAfterMidnight >= EMPLOYEE_ROTATION_HOURS_CONFIG.ACTIVE_START_MINUTES &&
    minutesAfterMidnight <= EMPLOYEE_ROTATION_HOURS_CONFIG.ACTIVE_END_MINUTES;
}

function renderEmployeeRotationHoursSummary_(rows) {
  var ss = openDashboardSpreadsheet_();
  var sheet = ensureSheet_(ss, SHEETS.EMPLOYEE_ROTATION_HOURS);
  clearAndWriteObjects_(sheet, EMPLOYEE_ROTATION_HOURS_HEADERS, rows || []);
  applyCleanTableFormatting_(sheet, EMPLOYEE_ROTATION_HOURS_HEADERS.length);
}

function calculateEmployeeRotationHoursSummary_(records, referenceDate) {
  var summaryByEmployeeId = {};
  (records || []).forEach(function(record) {
    var employeeId = safeString_(record[H.RECORD.EMPLOYEE_ID]);
    var employeeName = safeString_(record[H.RECORD.EMPLOYEE_NAME]);
    if (!employeeId && !employeeName) return;

    var isCompleted = isRecordCompletedRotationForHours_(record, referenceDate);
    var isOngoing = isRecordOngoingRotationForHours_(record, referenceDate);
    if (!isCompleted && !isOngoing) return;

    var key = employeeId || normalizeKey_(employeeName);
    if (!summaryByEmployeeId[key]) {
      var row = {};
      row[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME] = employeeName;
      row[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_ID] = employeeId;
      row[H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS] = 0;
      row[H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS] = 0;
      row[H.EMPLOYEE_ROTATION_HOURS.TOTAL_HOURS] = 0;
      summaryByEmployeeId[key] = row;
    }

    var totalHours = calculateRecordRotationHours_(record);
    if (isCompleted) {
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS] += totalHours;
    } else {
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS] += totalHours;
    }
    summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.TOTAL_HOURS] =
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS] +
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS];
  });

  return Object.keys(summaryByEmployeeId).map(function(key) {
    return summaryByEmployeeId[key];
  }).sort(function(a, b) {
    return safeString_(a[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME]).localeCompare(safeString_(b[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME]));
  });
}

function isRecordApprovedForHours_(record) {
  var finalStatus = safeString_(record[H.RECORD.FINAL_STATUS]);
  return safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_ACCEPTED &&
    APPROVED_EVALUATION_FINAL_STATUSES.indexOf(finalStatus) !== -1;
}

function hasRotationEndedForHours_(record, referenceDate) {
  var endDate = dateOnly_(record[H.RECORD.END_DATE]);
  var today = dateOnly_(referenceDate || now_());
  return !!endDate && !!today && endDate.getTime() < today.getTime();
}

function isRecordCompletedRotationForHours_(record, referenceDate) {
  return isRecordApprovedForHours_(record) &&
    hasRotationEndedForHours_(record, referenceDate);
}

function isRecordOngoingRotationForHours_(record, referenceDate) {
  var endDate = dateOnly_(record[H.RECORD.END_DATE]);
  var today = dateOnly_(referenceDate || now_());
  return isRecordApprovedForHours_(record) &&
    !!endDate &&
    !!today &&
    endDate.getTime() >= today.getTime();
}

function calculateRecordRotationHours_(record) {
  var storedTotal = toNumber_(record[H.RECORD.TOTAL_HOURS], 0);
  if (storedTotal > 0) return storedTotal;
  var dailyHours = toNumber_(record[H.RECORD.HOURS], 0);
  if (dailyHours <= 0) return 0;
  var days = toNumber_(record[H.RECORD.WORKING_DAYS], 0) ||
    calculateWorkingDays_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  return dailyHours * days;
}

function calculateInclusiveRotationDays_(startDate, endDate) {
  return calculateWorkingDays_(startDate, endDate);
}

/**
 * Finds only rows matching one employee ID and caches the result for this
 * execution. A three-selection submission therefore performs one lookup, not
 * one lookup per selection or per email.
 */
function getEmployeeRotationHoursSnapshotById_(employeeId) {
  employeeId = safeString_(employeeId);
  if (!employeeId) return null;
  var cacheKey = normalizeKey_(employeeId);
  if (Object.prototype.hasOwnProperty.call(EMPLOYEE_ROTATION_HOURS_LOOKUP_CACHE_, cacheKey)) {
    return EMPLOYEE_ROTATION_HOURS_LOOKUP_CACHE_[cacheKey];
  }

  var recordsSheet = getSheet_(SHEETS.RECORDS);
  var employeeRecords = recordsSheet
    ? findObjectsByValue_(recordsSheet, H.RECORD.EMPLOYEE_ID, employeeId, 1000000)
    : [];
  var summary = calculateEmployeeRotationHoursSummary_(employeeRecords)[0];
  var snapshot = {
    completedHours: summary ? toNumber_(summary[H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS], 0) : 0,
    ongoingHours: summary ? toNumber_(summary[H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS], 0) : 0,
    totalHours: summary ? toNumber_(summary[H.EMPLOYEE_ROTATION_HOURS.TOTAL_HOURS], 0) : 0
  };
  EMPLOYEE_ROTATION_HOURS_LOOKUP_CACHE_[cacheKey] = snapshot;
  return snapshot;
}

function getEmployeeTotalCompletedHours_(record) {
  record = record || {};
  var employeeId = safeString_(record[H.RECORD.EMPLOYEE_ID]);
  if (!employeeId) return '';
  var snapshot = getEmployeeRotationHoursSnapshotById_(employeeId);
  return Math.max(0, snapshot ? snapshot.completedHours : 0);
}

/** Backward-compatible alias for older callers. */
function getEmployeePreviousCompletedHours_(record) {
  return getEmployeeTotalCompletedHours_(record);
}

function refreshEmployeeRotationHoursForRecords_(records) {
  records = records || [];
  if (!records.length) return [];
  var recordsSheet = getSheet_(SHEETS.RECORDS);
  var summarySheet = ensureSheet_(openDashboardSpreadsheet_(), SHEETS.EMPLOYEE_ROTATION_HOURS);
  setSheetHeaders_(summarySheet, EMPLOYEE_ROTATION_HOURS_HEADERS);
  var employeeLookup = {};
  var updatedRows = [];

  records.forEach(function(record) {
    var employeeId = safeString_(record[H.RECORD.EMPLOYEE_ID]);
    var employeeName = safeString_(record[H.RECORD.EMPLOYEE_NAME]);
    var key = employeeId || normalizeKey_(employeeName);
    if (!key || employeeLookup[key]) return;
    employeeLookup[key] = true;
    var employeeRecords = recordsSheet && employeeId
      ? findObjectsByValue_(recordsSheet, H.RECORD.EMPLOYEE_ID, employeeId, 2000)
      : (recordsSheet ? findObjectsByValue_(recordsSheet, H.RECORD.EMPLOYEE_NAME, employeeName, 2000) : []);
    var summary = calculateEmployeeRotationHoursSummary_(employeeRecords)[0];
    if (!summary) return;
    var existingRow = employeeId
      ? findRowByValue_(summarySheet, H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_ID, employeeId)
      : findRowByValue_(summarySheet, H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME, employeeName);
    if (existingRow) updateObjectRow_(summarySheet, existingRow, summary);
    else appendObjectRow_(summarySheet, EMPLOYEE_ROTATION_HOURS_HEADERS, summary);
    updatedRows.push(summary);
  });
  applyCleanTableFormatting_(summarySheet, EMPLOYEE_ROTATION_HOURS_HEADERS.length);
  return updatedRows;
}
