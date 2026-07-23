/** Evaluation email job. Each rotation record has its own due date and sent flag. */
function sendEvaluationEmails(referenceDate) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var cfg = getConfig();
    if (!cfg.EVALUATION_FORM_URL) {
      logInfo_('sendEvaluationEmails', '', 'Skipped: EVALUATION_FORM_URL is empty.');
      return;
    }
    var today = dateOnly_(referenceDate || new Date());
    var records = getRecords_();
    records.forEach(function(record) {
      try {
        if (!isEvaluationDueForRecord_(record, cfg, today)) return;
        var evaluationLink = buildEvaluationPrefilledUrl_(record);
        if (evaluationLink && evaluationLink !== safeString_(record[H.RECORD.EVALUATION_LINK])) {
          record[H.RECORD.EVALUATION_LINK] = evaluationLink;
          updateRequestByRow_(record._rowNumber, {
            [H.RECORD.EVALUATION_LINK]: evaluationLink
          });
        }
        var sent = sendEvaluationEmail(record, evaluationLink);
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

function isEvaluationDueForRecord_(record, cfg, referenceDate) {
  record = record || {};
  if (safeString_(record[H.RECORD.EVALUATION_SENT]) === STATUS.YES) return false;
  if (safeString_(record[H.RECORD.HEAD_STATUS]) !== STATUS.HEAD_ACCEPTED) return false;
  var allowedStatuses = cfg && cfg.EVALUATION_ALLOWED_FINAL_STATUSES || APPROVED_EVALUATION_FINAL_STATUSES;
  if (allowedStatuses.indexOf(safeString_(record[H.RECORD.FINAL_STATUS])) === -1) return false;
  var endDate = dateOnly_(record[H.RECORD.END_DATE]);
  var today = dateOnly_(referenceDate || new Date());
  if (!endDate || !today) return false;
  var dueDate = new Date(endDate.getTime());
  dueDate.setDate(dueDate.getDate() + 1);
  return today.getTime() >= dueDate.getTime();
}
