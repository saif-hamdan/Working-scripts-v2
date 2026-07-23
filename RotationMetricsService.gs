/** Pure date, working-day, and rotation-hours calculations. */

function makeSubmissionValidationError_(messageAr, messageEn) {
  var error = new Error(safeString_(messageAr) + ' / ' + safeString_(messageEn));
  error.code = 'SUBMISSION_VALIDATION';
  return error;
}

function isSubmissionValidationError_(error) {
  return Boolean(error && error.code === 'SUBMISSION_VALIDATION');
}

function calculateWorkingDays_(startDate, endDate) {
  var start = dateOnly_(startDate);
  var end = dateOnly_(endDate);
  if (!start || !end || start.getTime() > end.getTime()) return 0;
  var count = 0;
  for (var day = new Date(start.getTime()); day.getTime() <= end.getTime(); day.setDate(day.getDate() + 1)) {
    var weekday = day.getDay();
    if (weekday >= 0 && weekday <= 4) count++; // Sunday through Thursday.
  }
  return count;
}

function validateDailyHours_(value) {
  var hours = Number(value);
  if (!isFinite(hours) || hours < 2 || hours > 7) {
    throw makeSubmissionValidationError_(
      'يجب أن يكون عدد ساعات التدوير اليومية بين ساعتين وسبع ساعات.',
      'Daily rotation hours must be between 2 and 7, inclusive.'
    );
  }
  return hours;
}

function calculateRotationMetrics_(startDate, endDate, dailyHours) {
  var start = dateOnly_(startDate);
  var end = dateOnly_(endDate);
  if (!start || !end) {
    throw makeSubmissionValidationError_(
      'تاريخ بداية أو نهاية التدوير مفقود أو غير صحيح.',
      'The rotation start or end date is missing or invalid.'
    );
  }
  if (start.getTime() > end.getTime()) {
    throw makeSubmissionValidationError_(
      'لا يمكن أن يكون تاريخ بداية التدوير بعد تاريخ النهاية.',
      'The rotation start date cannot be after the end date.'
    );
  }
  var workingDays = calculateWorkingDays_(start, end);
  if (workingDays < 3) {
    throw makeSubmissionValidationError_(
      'يجب ألا تقل مدة التدوير عن ثلاثة أيام عمل من الأحد إلى الخميس.',
      'Each rotation must contain at least three working days, Sunday through Thursday.'
    );
  }
  var hours = validateDailyHours_(dailyHours);
  return {
    startDate: start,
    endDate: end,
    dailyHours: hours,
    workingDays: workingDays,
    totalHours: workingDays * hours
  };
}

function formatParticipationDuration_(record) {
  return formatDate_(record[H.RECORD.START_DATE]) + ' – ' +
    formatDate_(record[H.RECORD.END_DATE]) + ' (' +
    safeString_(record[H.RECORD.WORKING_DAYS]) + ' working days / أيام عمل)';
}
