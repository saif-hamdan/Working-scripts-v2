/** Evaluation email job. */
function sendEvaluationEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var cfg = getConfig();
    if (!cfg.EVALUATION_FORM_URL) {
      logInfo_('sendEvaluationEmails', '', 'Skipped: EVALUATION_FORM_URL is empty.');
      return;
    }
    var today = dateOnly_(new Date());
    var records = getRecords_();
    records.forEach(function(record) {
      try {
        if (safeString_(record[H.RECORD.EVALUATION_SENT]) === STATUS.YES) return;
        if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_ACCEPTED) return;
        if (cfg.EVALUATION_ALLOWED_FINAL_STATUSES.indexOf(safeString_(record[H.RECORD.FINAL_STATUS])) === -1) return;
        var end = dateOnly_(record[H.RECORD.END_DATE]);
        if (!end || end.getTime() >= today.getTime()) return; // Send on the day after the end date or later.
        var sent = sendEvaluationEmail(record);
        if (sent) {
          updateRequestByRow_(record._rowNumber, {
            [H.RECORD.EVALUATION_SENT]: STATUS.YES,
            [H.RECORD.EVALUATION_SENT_AT]: now_()
          });
        }
      } catch (err) {
        logError_('sendEvaluationEmails', record[H.RECORD.REQUEST_ID], err);
      }
    });
  } finally {
    lock.releaseLock();
  }
}
