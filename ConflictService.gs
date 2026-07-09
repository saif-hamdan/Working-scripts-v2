/** Conflict checking: same rotation unit + rotation section + overlapping date range + already accepted/active. */
function findConflicts(criteria) {
  var records = getRecords_();
  var rotationKey = normalizeKey_(criteria.rotationUnit);
  var sectionKey = normalizeKey_(criteria.section);
  var section = findSectionByUnitAndName_(criteria.rotationUnit, criteria.section);
  var capacity = section ? section.capacity : 1;
  var overlappingRecords = records.filter(function(record) {
    if (safeString_(record[H.RECORD.REQUEST_ID]) === safeString_(criteria.excludeRequestId)) return false;
    if (!isRecordActiveOrApproved_(record)) return false;
    if (normalizeKey_(record[H.RECORD.ROTATION_UNIT]) !== rotationKey) return false;
    if (normalizeKey_(record[H.RECORD.SECTION]) !== sectionKey) return false;
    return isDateRangeOverlap_(criteria.startDate, criteria.endDate, record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  });
  return findCapacityConflictForDates_(criteria.startDate, criteria.endDate, overlappingRecords, capacity);
}

function findCapacityConflictForDates_(startDate, endDate, overlappingRecords, capacity) {
  var start = dateOnly_(startDate);
  var end = dateOnly_(endDate);
  if (!start || !end) return null;

  for (var day = new Date(start.getTime()); day.getTime() <= end.getTime(); day.setDate(day.getDate() + 1)) {
    var recordsOnDay = overlappingRecords.filter(function(record) {
      return isDateRangeOverlap_(day, day, record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
    });
    if (recordsOnDay.length >= capacity) return recordsOnDay[0];
  }
  return null;
}

function findActiveRotationByEmployee_(employeeId, employeeName, excludeRequestId) {
  var employeeIdKey = normalizeKey_(employeeId);
  var nameKey = normalizeKey_(employeeName);
  if (!employeeIdKey && !nameKey) return null;

  var matches = getRecords_().filter(function(record) {
    if (safeString_(record[H.RECORD.REQUEST_ID]) === safeString_(excludeRequestId)) return false;
    if (!isRecordActiveOrApproved_(record)) return false;
    if (!isTodayWithinRange_(record[H.RECORD.START_DATE], record[H.RECORD.END_DATE])) return false;
    if (employeeIdKey) return normalizeKey_(record[H.RECORD.EMPLOYEE_ID]) === employeeIdKey;
    return normalizeKey_(record[H.RECORD.EMPLOYEE_NAME]) === nameKey;
  });
  return matches.length ? matches[0] : null;
}

function formatConflictDetails_(conflict) {
  if (!conflict) return '';
  return [
    'رقم الطلب: ' + safeString_(conflict[H.RECORD.REQUEST_ID]),
    'الموظف: ' + safeString_(conflict[H.RECORD.EMPLOYEE_NAME]),
    'الوحدة: ' + safeString_(conflict[H.RECORD.ROTATION_UNIT]),
    'قسم التدوير: ' + safeString_(conflict[H.RECORD.SECTION]),
    'الفترة: ' + formatDate_(conflict[H.RECORD.START_DATE]) + ' إلى ' + formatDate_(conflict[H.RECORD.END_DATE]),
    'المسؤول المباشر: ' + safeString_(conflict[H.RECORD.DIRECT_MANAGER_NAME])
  ].join('\n');
}

function formatActiveRotationDetails_(activeRecord) {
  if (!activeRecord) return '';
  return [
    'رقم الطلب النشط: ' + safeString_(activeRecord[H.RECORD.REQUEST_ID]),
    'الموظف: ' + safeString_(activeRecord[H.RECORD.EMPLOYEE_NAME]),
    'الرقم الوظيفي: ' + safeString_(activeRecord[H.RECORD.EMPLOYEE_ID]),
    'وحدة التدوير: ' + safeString_(activeRecord[H.RECORD.ROTATION_UNIT]),
    'قسم التدوير: ' + safeString_(activeRecord[H.RECORD.SECTION]),
    'الفترة: ' + formatDate_(activeRecord[H.RECORD.START_DATE]) + ' إلى ' + formatDate_(activeRecord[H.RECORD.END_DATE]),
    'الحالة النهائية: ' + safeString_(activeRecord[H.RECORD.FINAL_STATUS])
  ].join('\n');
}
