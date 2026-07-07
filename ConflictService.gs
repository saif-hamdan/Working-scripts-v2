/** Conflict checking: same training unit + same section + overlapping date range + already accepted/active. */
function findConflicts(criteria) {
  var records = getRecords_();
  var trainingKey = normalizeKey_(criteria.trainingUnit);
  var sectionKey = normalizeKey_(criteria.section);
  var conflicts = records.filter(function(record) {
    if (safeString_(record[H.RECORD.REQUEST_ID]) === safeString_(criteria.excludeRequestId)) return false;
    if (!isRecordActiveOrApproved_(record)) return false;
    if (normalizeKey_(record[H.RECORD.TRAINING_UNIT]) !== trainingKey) return false;
    if (normalizeKey_(record[H.RECORD.SECTION]) !== sectionKey) return false;
    return isDateRangeOverlap_(criteria.startDate, criteria.endDate, record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  });
  return conflicts.length ? conflicts[0] : null;
}

function findActiveTrainingByEmployee_(employeeEmail, employeeName, excludeRequestId) {
  var emailKey = normalizeEmail_(employeeEmail);
  var nameKey = normalizeKey_(employeeName);
  if (!emailKey && !nameKey) return null;

  var matches = getRecords_().filter(function(record) {
    if (safeString_(record[H.RECORD.REQUEST_ID]) === safeString_(excludeRequestId)) return false;
    if (!isRecordActiveOrApproved_(record)) return false;
    if (!isTodayWithinRange_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE])) return false;
    if (emailKey) return normalizeEmail_(record[H.RECORD.EMPLOYEE_EMAIL]) === emailKey;
    return normalizeKey_(record[H.RECORD.EMPLOYEE_NAME]) === nameKey;
  });
  return matches.length ? matches[0] : null;
}

function formatConflictDetails_(conflict) {
  if (!conflict) return '';
  return [
    'رقم الطلب: ' + safeString_(conflict[H.RECORD.REQUEST_ID]),
    'الموظف: ' + safeString_(conflict[H.RECORD.EMPLOYEE_NAME]),
    'الوحدة: ' + safeString_(conflict[H.RECORD.TRAINING_UNIT]),
    'القسم: ' + safeString_(conflict[H.RECORD.SECTION]),
    'الفترة: ' + formatDate_(conflict[H.RECORD.START_DATE]) + ' إلى ' + formatDate_(conflict[H.RECORD.END_DATE]),
    'المسؤول المباشر: ' + safeString_(conflict[H.RECORD.DIRECT_MANAGER_NAME])
  ].join('\n');
}

function formatActiveTrainingDetails_(activeRecord) {
  if (!activeRecord) return '';
  return [
    'رقم الطلب النشط: ' + safeString_(activeRecord[H.RECORD.REQUEST_ID]),
    'الموظف: ' + safeString_(activeRecord[H.RECORD.EMPLOYEE_NAME]),
    'البريد: ' + safeString_(activeRecord[H.RECORD.EMPLOYEE_EMAIL]),
    'وحدة التدريب: ' + safeString_(activeRecord[H.RECORD.TRAINING_UNIT]),
    'القسم: ' + safeString_(activeRecord[H.RECORD.SECTION]),
    'الفترة: ' + formatDate_(activeRecord[H.RECORD.START_DATE]) + ' إلى ' + formatDate_(activeRecord[H.RECORD.END_DATE]),
    'الحالة النهائية: ' + safeString_(activeRecord[H.RECORD.FINAL_STATUS])
  ].join('\n');
}
