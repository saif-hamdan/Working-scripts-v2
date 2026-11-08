/** Conflict checking: one employee cannot hold overlapping accepted rotations. */
function findConflicts(criteria, records) {
  criteria = criteria || {};
  var employeeIdKey = normalizeKey_(criteria.employeeId);
  var employeeNameKey = normalizeKey_(criteria.employeeName);
  if (!employeeIdKey && !employeeNameKey) return null;

  var candidates = records || getEmployeeConflictCandidateRecords_(
    criteria.employeeId,
    criteria.employeeName,
    1000
  );
  var matches = candidates.filter(function(record) {
    if (safeString_(record[H.RECORD.REQUEST_ID]) === safeString_(criteria.excludeRequestId)) return false;
    if (!isRecordBlockingEmployeeSchedule_(record)) return false;
    if (employeeIdKey) {
      if (normalizeKey_(record[H.RECORD.EMPLOYEE_ID]) !== employeeIdKey) return false;
    } else if (normalizeKey_(record[H.RECORD.EMPLOYEE_NAME]) !== employeeNameKey) {
      return false;
    }
    return isDateRangeOverlap_(criteria.startDate, criteria.endDate, record[H.RECORD.START_DATE], record[H.RECORD.END_DATE]);
  });
  return matches.length ? matches[0] : null;
}

function isRecordBlockingEmployeeSchedule_(record) {
  if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_ACCEPTED) return false;
  return [
    STATUS.FINAL_PENDING,
    STATUS.FINAL_APPROVED,
    STATUS.FINAL_IN_PROGRESS,
    STATUS.FINAL_DONE
  ].indexOf(safeString_(record[H.RECORD.FINAL_STATUS])) !== -1;
}

function getEmployeeConflictCandidateRecords_(employeeId, employeeName, maxResults) {
  var sheet = getSheet_(SHEETS.RECORDS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  if (safeString_(employeeId)) {
    return findObjectsByValue_(
      sheet,
      H.RECORD.EMPLOYEE_ID,
      employeeId,
      maxResults || 1000
    );
  }
  if (safeString_(employeeName)) {
    return findObjectsByValue_(
      sheet,
      H.RECORD.EMPLOYEE_NAME,
      employeeName,
      maxResults || 1000
    );
  }
  return [];
}

function findActiveRotationByEmployee_(employeeId, employeeName, excludeRequestId, records, startDate, endDate) {
  var today = dateOnly_(now_());
  return findConflicts({
    employeeId: employeeId,
    employeeName: employeeName,
    startDate: startDate || today,
    endDate: endDate || today,
    excludeRequestId: excludeRequestId
  }, records);
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
