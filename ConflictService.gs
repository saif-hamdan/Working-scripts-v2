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

function formatConflictDetails_(conflict) {
  if (!conflict) return '';
  return [
    'رقم الطلب: ' + safeString_(conflict[H.RECORD.REQUEST_ID]),
    'الموظف: ' + safeString_(conflict[H.RECORD.EMPLOYEE_NAME]),
    'الوحدة: ' + safeString_(conflict[H.RECORD.TRAINING_UNIT]),
    'القسم: ' + safeString_(conflict[H.RECORD.SECTION]),
    'الفترة: ' + formatDate_(conflict[H.RECORD.START_DATE]) + ' إلى ' + formatDate_(conflict[H.RECORD.END_DATE]),
    'المدير المباشر: ' + safeString_(conflict[H.RECORD.DIRECT_MANAGER_NAME])
  ].join('\n');
}
