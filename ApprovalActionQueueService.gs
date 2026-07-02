/** Sheet-backed queue for approval/rejection link decisions. */
const APPROVAL_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject'
});

function queueApprovalAction_(token, action, reason) {
  token = safeString_(token);
  action = safeString_(action);
  reason = safeString_(reason);
  throwIfMissing_(token, 'Missing approval token.');
  if (action !== APPROVAL_ACTIONS.APPROVE && action !== APPROVAL_ACTIONS.REJECT) {
    throw new Error('Unsupported approval action: ' + action);
  }
  if (action === APPROVAL_ACTIONS.REJECT) throwIfMissing_(reason, 'Rejection reason is required.');

  var sheet = getOrCreateSheet_(SHEETS.ACTION_QUEUE);
  setSheetHeaders_(sheet, ACTION_QUEUE_HEADERS);
  var actionId = Utilities.getUuid();
  appendObjectRow_(sheet, ACTION_QUEUE_HEADERS, {
    [H.ACTION_QUEUE.ACTION_ID]: actionId,
    [H.ACTION_QUEUE.CREATED_AT]: now_(),
    [H.ACTION_QUEUE.TOKEN]: token,
    [H.ACTION_QUEUE.ACTION]: action,
    [H.ACTION_QUEUE.REASON]: reason,
    [H.ACTION_QUEUE.STATUS]: STATUS.ACTION_QUEUE_PENDING,
    [H.ACTION_QUEUE.ATTEMPTS]: 0,
    [H.ACTION_QUEUE.LAST_ERROR]: '',
    [H.ACTION_QUEUE.PROCESSED_AT]: ''
  });
  try { sheet.hideSheet(); } catch (ignore) {}
  logInfo_('queueApprovalAction_', '', 'Queued approval action ' + actionId + ' (' + action + ').');
  return actionId;
}

function processApprovalActionQueue(options) {
  options = options || {};
  var lock = options.skipLock ? null : LockService.getScriptLock();
  if (lock) lock.waitLock(30000);

  try {
    var sheet = getOrCreateSheet_(SHEETS.ACTION_QUEUE);
    setSheetHeaders_(sheet, ACTION_QUEUE_HEADERS);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var scanWindow = Math.max(ACTION_QUEUE_BATCH_SIZE, QUEUE_SCAN_WINDOW_ROWS);
    var startRow = Math.max(2, lastRow - scanWindow + 1);
    var headers = lastRow >= 1 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(safeString_) : [];
    var rows = lastRow >= 2 ? sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues() : [];
    var stats = { processed: 0, failed: 0, skipped: 0, scanned: 0, remainingLikely: startRow > 2, stoppedEarly: false };
    var actionableCount = 0;

    for (var i = rows.length - 1; i >= 0; i--) {
      var row = objectFromQueueRow_(headers, rows[i], startRow + i);
      stats.scanned++;
      if (safeString_(row[H.ACTION_QUEUE.STATUS]) !== STATUS.ACTION_QUEUE_PENDING) {
        stats.skipped++;
        continue;
      }
      if (actionableCount >= ACTION_QUEUE_BATCH_SIZE) {
        stats.remainingLikely = true;
        break;
      }
      if (shouldStopSync_(options.startedAt)) {
        stats.stoppedEarly = true;
        stats.remainingLikely = true;
        break;
      }
      actionableCount++;
      var attempts = toNumber_(row[H.ACTION_QUEUE.ATTEMPTS], 0);
      var action = safeString_(row[H.ACTION_QUEUE.ACTION]);
      var actionId = safeString_(row[H.ACTION_QUEUE.ACTION_ID]);
      try {
        if (action === APPROVAL_ACTIONS.APPROVE) {
          processQueuedApproveAction_(row[H.ACTION_QUEUE.TOKEN]);
        } else if (action === APPROVAL_ACTIONS.REJECT) {
          processQueuedRejectAction_(row[H.ACTION_QUEUE.TOKEN], row[H.ACTION_QUEUE.REASON]);
        } else {
          throw new Error('Unsupported approval action: ' + action);
        }
        updateObjectRow_(sheet, row._rowNumber, {
          [H.ACTION_QUEUE.STATUS]: STATUS.ACTION_QUEUE_PROCESSED,
          [H.ACTION_QUEUE.ATTEMPTS]: attempts + 1,
          [H.ACTION_QUEUE.LAST_ERROR]: '',
          [H.ACTION_QUEUE.PROCESSED_AT]: now_()
        });
        stats.processed++;
        logInfo_('processApprovalActionQueue', actionId, 'Queued approval action processed.');
      } catch (err) {
        updateObjectRow_(sheet, row._rowNumber, {
          [H.ACTION_QUEUE.STATUS]: STATUS.ACTION_QUEUE_FAILED,
          [H.ACTION_QUEUE.ATTEMPTS]: attempts + 1,
          [H.ACTION_QUEUE.LAST_ERROR]: err.message,
          [H.ACTION_QUEUE.PROCESSED_AT]: now_()
        });
        stats.failed++;
        logError_('processApprovalActionQueue', actionId, err);
      }
    }

    logInfo_('processApprovalActionQueue', '', formatApprovalActionQueueStats_(stats));
    return stats;
  } finally {
    if (lock) lock.releaseLock();
  }
}

function formatApprovalActionQueueStats_(stats) {
  return 'Queued approval actions processed: ' + stats.processed +
    ', skipped: ' + stats.skipped +
    ', failed: ' + stats.failed +
    ', scanned: ' + stats.scanned +
    ', remainingLikely: ' + stats.remainingLikely +
    ', stoppedEarly: ' + stats.stoppedEarly + '.';
}
