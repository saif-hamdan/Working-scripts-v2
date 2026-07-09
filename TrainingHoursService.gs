/** Employee-level rotation hour summary calculations. */
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

function calculateEmployeeRotationHoursSummary_(records) {
  var summaryByEmployeeId = {};
  (records || []).forEach(function(record) {
    var employeeId = safeString_(record[H.RECORD.EMPLOYEE_ID]);
    var employeeName = safeString_(record[H.RECORD.EMPLOYEE_NAME]);
    if (!employeeId && !employeeName) return;

    var finalStatus = safeString_(record[H.RECORD.FINAL_STATUS]);
    var isCompleted = isRecordCompletedRotationForHours_(record);
    var isOngoing = isRecordOngoingRotationForHours_(record);
    if (!isCompleted && !isOngoing) return;

    var key = employeeId || normalizeKey_(employeeName);
    if (!summaryByEmployeeId[key]) {
      var row = {};
      row[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME] = employeeName;
      row[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_ID] = employeeId;
      row[H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS] = 0;
      row[H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS] = 0;
      summaryByEmployeeId[key] = row;
    }

    var totalHours = calculateRecordRotationHours_(record);
    if (finalStatus === STATUS.FINAL_DONE) {
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS] += totalHours;
    } else {
      summaryByEmployeeId[key][H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS] += totalHours;
    }
  });

  return Object.keys(summaryByEmployeeId).map(function(key) {
    return summaryByEmployeeId[key];
  }).sort(function(a, b) {
    return safeString_(a[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME]).localeCompare(safeString_(b[H.EMPLOYEE_ROTATION_HOURS.EMPLOYEE_NAME]));
  });
}

function isRecordCompletedRotationForHours_(record) {
  return safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_ACCEPTED &&
    safeString_(record[H.RECORD.FINAL_STATUS]) === STATUS.FINAL_DONE;
}

function isRecordOngoingRotationForHours_(record) {
  var finalStatus = safeString_(record[H.RECORD.FINAL_STATUS]);
  return safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_ACCEPTED &&
    (finalStatus === STATUS.FINAL_APPROVED || finalStatus === STATUS.FINAL_IN_PROGRESS);
}

function calculateRecordRotationHours_(record) {
  var dailyHours = toNumber_(record[H.RECORD.HOURS], 0);
  if (dailyHours <= 0) return 0;
  var days = calculateInclusiveRotationDays_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  return dailyHours * days;
}

function calculateInclusiveRotationDays_(startDate, endDate) {
  var start = dateOnly_(startDate);
  var end = dateOnly_(endDate);
  if (!start || !end || end.getTime() < start.getTime()) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}
