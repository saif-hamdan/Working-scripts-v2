/** Sheet-backed queue for approval/rejection link decisions. */
const APPROVAL_ACTIONS = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  APPROVE_GROUP: 'approve_group',
  REJECT_GROUP: 'reject_group'
});

function queueApprovalAction_(token, action, reason) {
  token = safeString_(token);
  action = safeString_(action);
  reason = safeString_(reason);
  throwIfMissing_(token, 'Missing approval token.');
  var supportedActions = [
    APPROVAL_ACTIONS.APPROVE,
    APPROVAL_ACTIONS.REJECT,
    APPROVAL_ACTIONS.APPROVE_GROUP,
    APPROVAL_ACTIONS.REJECT_GROUP
  ];
  if (supportedActions.indexOf(action) === -1) {
    throw new Error('Unsupported approval action: ' + action);
  }
  if (action === APPROVAL_ACTIONS.REJECT || action === APPROVAL_ACTIONS.REJECT_GROUP) {
    throwIfMissing_(reason, 'Rejection reason is required.');
  }

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
    var cfg = getConfig();
    var maxRetries = cfg.ACTION_QUEUE_MAX_RETRIES;
    var sheet = getOrCreateSheet_(SHEETS.ACTION_QUEUE);
    setSheetHeaders_(sheet, ACTION_QUEUE_HEADERS);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var scanWindow = Math.max(ACTION_QUEUE_BATCH_SIZE, QUEUE_SCAN_WINDOW_ROWS);
    var scanRange = getQueueScanRange_(ACTION_QUEUE_SCAN_CURSOR_KEY, lastRow, scanWindow);
    var startRow = scanRange.startRow;
    var headers = lastRow >= 1 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(safeString_) : [];
    var rows = lastRow >= 2 && scanRange.rowCount > 0 ? sheet.getRange(scanRange.startRow, 1, scanRange.rowCount, lastCol).getValues() : [];
    var stats = { processed: 0, failed: 0, reviewRequired: 0, skipped: 0, scanned: 0, remainingLikely: scanRange.endRow < lastRow, stoppedEarly: false, stoppedForBatch: false };
    var actionableCount = 0;
    var cursorDeferred = false;

    for (var i = rows.length - 1; i >= 0; i--) {
      var row = objectFromQueueRow_(headers, rows[i], startRow + i);
      stats.scanned++;
      if (!shouldAttemptApprovalActionRow_(row, maxRetries)) {
        if (markApprovalActionRowFinalIfMaxed_(sheet, row, maxRetries)) {
          stats.reviewRequired++;
        }
        stats.skipped++;
        continue;
      }
      if (actionableCount >= ACTION_QUEUE_BATCH_SIZE) {
        stats.remainingLikely = true;
        stats.stoppedForBatch = true;
        setQueueScanCursor_(ACTION_QUEUE_SCAN_CURSOR_KEY, row._rowNumber, lastRow);
        cursorDeferred = true;
        break;
      }
      if (shouldStopSync_(options.startedAt)) {
        stats.stoppedEarly = true;
        stats.remainingLikely = true;
        setQueueScanCursor_(ACTION_QUEUE_SCAN_CURSOR_KEY, row._rowNumber, lastRow);
        cursorDeferred = true;
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
        } else if (action === APPROVAL_ACTIONS.APPROVE_GROUP) {
          processQueuedApproveGroupAction_(row[H.ACTION_QUEUE.TOKEN]);
        } else if (action === APPROVAL_ACTIONS.REJECT_GROUP) {
          processQueuedRejectGroupAction_(row[H.ACTION_QUEUE.TOKEN], row[H.ACTION_QUEUE.REASON]);
        } else {
          throw new Error('Unsupported approval action: ' + action);
        }
        updateObjectRow_(sheet, row._rowNumber, {
          [H.ACTION_QUEUE.STATUS]: STATUS.ACTION_QUEUE_PROCESSED,
          [H.ACTION_QUEUE.LAST_ERROR]: '',
          [H.ACTION_QUEUE.PROCESSED_AT]: now_()
        });
        stats.processed++;
        logInfo_('processApprovalActionQueue', actionId, 'Queued approval action processed.');
      } catch (err) {
        var nextAttempts = attempts + 1;
        var isFinalFailure = nextAttempts >= maxRetries;
        updateObjectRow_(sheet, row._rowNumber, {
          [H.ACTION_QUEUE.STATUS]: isFinalFailure ? STATUS.ACTION_QUEUE_REQUIRES_REVIEW : STATUS.ACTION_QUEUE_FAILED,
          [H.ACTION_QUEUE.ATTEMPTS]: nextAttempts,
          [H.ACTION_QUEUE.LAST_ERROR]: err.message,
          [H.ACTION_QUEUE.PROCESSED_AT]: isFinalFailure ? now_() : ''
        });
        if (isFinalFailure) {
          stats.reviewRequired++;
        } else {
          stats.failed++;
        }
        logError_('processApprovalActionQueue', actionId, err);
        logInfo_(
          'processApprovalActionQueue',
          actionId,
          isFinalFailure
            ? 'Queued approval action requires manual admin review after attempt ' + nextAttempts + ' of ' + maxRetries + '.'
            : 'Queued approval action failure is retryable after attempt ' + nextAttempts + ' of ' + maxRetries + '.'
        );
      }
    }

    if (!cursorDeferred) advanceQueueScanCursor_(ACTION_QUEUE_SCAN_CURSOR_KEY, scanRange, lastRow);
    logInfo_('processApprovalActionQueue', '', formatApprovalActionQueueStats_(stats));
    logQueueStoppedEarly_('processApprovalActionQueue', '', stats, ACTION_QUEUE_BATCH_SIZE);
    return stats;
  } finally {
    if (lock) lock.releaseLock();
  }
}


function shouldAttemptApprovalActionRow_(row, maxRetries) {
  var status = safeString_(row[H.ACTION_QUEUE.STATUS]);
  if (status !== STATUS.ACTION_QUEUE_PENDING && status !== STATUS.ACTION_QUEUE_FAILED) return false;
  return toNumber_(row[H.ACTION_QUEUE.ATTEMPTS], 0) < maxRetries;
}

function markApprovalActionRowFinalIfMaxed_(sheet, row, maxRetries) {
  var status = safeString_(row[H.ACTION_QUEUE.STATUS]);
  if (status !== STATUS.ACTION_QUEUE_PENDING && status !== STATUS.ACTION_QUEUE_FAILED) return false;
  if (toNumber_(row[H.ACTION_QUEUE.ATTEMPTS], 0) < maxRetries) return false;

  updateObjectRow_(sheet, row._rowNumber, {
    [H.ACTION_QUEUE.STATUS]: STATUS.ACTION_QUEUE_REQUIRES_REVIEW,
    [H.ACTION_QUEUE.PROCESSED_AT]: now_()
  });
  return true;
}

function formatApprovalActionQueueStats_(stats) {
  var reviewRequired = toNumber_(stats.reviewRequired, 0);
  var message = 'Queued approval actions processed: ' + stats.processed +
    ', skipped: ' + stats.skipped +
    ', retryableFailed: ' + stats.failed +
    ', reviewRequired: ' + reviewRequired +
    ', scanned: ' + stats.scanned +
    ', remainingLikely: ' + stats.remainingLikely +
    ', stoppedEarly: ' + stats.stoppedEarly + '.';
  if (reviewRequired > 0) {
    message += ' Admin intervention required for ' + reviewRequired + ' approval action(s).';
  }
  return message;
}
