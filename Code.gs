/** Entry points used by menus, triggers, and web app deployment. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('SQU Training')
      .addItem('إعداد/تحديث النظام', 'setupAllFromMenu')
      .addItem('تحديث لوحة الأقسام', 'refreshDashboard')
      .addItem('تحديث القوائم في النموذج', 'refreshFormChoices')
      .addItem('معالجة الطلبات غير المعالجة', 'processResponseQueueOnce')
      .addItem('إرسال تقييمات مستحقة', 'sendEvaluationEmails')
      .addItem('تغيير حالة الاعتماد النهائي', 'showFinalStatusDialog')
      .addItem('إعادة تثبيت المشغلات', 'installTriggers')
      .addToUi();
  } catch (ignore) {}
}


function showFinalStatusDialog() {
  var html = HtmlService.createHtmlOutputFromFile('FinalStatusDialog')
    .setWidth(460)
    .setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(html, 'تغيير حالة الاعتماد النهائي');
}

function setupAll() {
  setupAllSystem();
}


function processResponseQueueOnce() {
  try {
    var stats = processUnprocessedFormResponses();
    logInfo_('processResponseQueueOnce', '', formatResponseQueueStats_(stats));
    return stats;
  } catch (err) {
    logError_('processResponseQueueOnce', '', err);
    throw err;
  }
}

function onFormSubmit(e) {
  logInfo_('onFormSubmit', '', 'Form submit trigger received; request creation is handled by processUnprocessedFormResponses.');
}

function onEdit(e) {
  handleFinalStatusEdit(e);
}

function doGet(e) {
  return handleWebGet(e);
}

function doPost(e) {
  return handleWebPost(e);
}


function isSyncActiveHour_(date) {
  var hour = Number(Utilities.formatDate(date || new Date(), SYNC_CONFIG.TIMEZONE, 'H'));
  return hour >= SYNC_CONFIG.ACTIVE_START_HOUR && hour < SYNC_CONFIG.ACTIVE_END_HOUR;
}

function isSyncNearTimeout_(startedAt) {
  return startedAt && Date.now() - startedAt >= SYNC_CONFIG.MAX_SINGLE_RUN_MS;
}

function shouldStopSync_(startedAt) {
  if (!isSyncNearTimeout_(startedAt)) return false;
  logInfo_('syncSystem', '', 'syncSystem stopped early to avoid timeout. Remaining work will continue in the next run.');
  return true;
}

function getSyncRuntimeDateKey_(date) {
  return SYNC_CONFIG.RUNTIME_KEY_PREFIX + Utilities.formatDate(date || new Date(), SYNC_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function getSyncRuntimeUsedToday_() {
  var value = PropertiesService.getScriptProperties().getProperty(getSyncRuntimeDateKey_());
  var runtimeMs = Number(value);
  return isNaN(runtimeMs) || runtimeMs < 0 ? 0 : runtimeMs;
}

function hasSyncDailyBudgetRemaining_() {
  return getSyncRuntimeUsedToday_() < SYNC_CONFIG.DAILY_RUNTIME_BUDGET_MS;
}

function addSyncRuntimeToday_(elapsedMs) {
  var props = PropertiesService.getScriptProperties();
  var key = getSyncRuntimeDateKey_();
  var currentRuntimeMs = Number(props.getProperty(key));
  if (isNaN(currentRuntimeMs) || currentRuntimeMs < 0) currentRuntimeMs = 0;
  var updatedRuntimeMs = currentRuntimeMs + Math.max(0, Number(elapsedMs) || 0);
  props.setProperty(key, String(updatedRuntimeMs));
  return updatedRuntimeMs;
}

function cleanupOldSyncRuntimeProperties_() {
  var props = PropertiesService.getScriptProperties();
  var allProperties = props.getProperties();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SYNC_CONFIG.RUNTIME_RETENTION_DAYS);
  var cutoffDateText = Utilities.formatDate(cutoff, SYNC_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  Object.keys(allProperties).forEach(function(key) {
    if (key.indexOf(SYNC_CONFIG.RUNTIME_KEY_PREFIX) !== 0) return;
    var dateText = key.substring(SYNC_CONFIG.RUNTIME_KEY_PREFIX.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return;
    if (dateText < cutoffDateText) props.deleteProperty(key);
  });
}

function getSyncLastFullRefreshAt_() {
  var value = PropertiesService.getScriptProperties().getProperty(SYNC_CONFIG.LAST_FULL_REFRESH_KEY);
  var timestamp = Number(value);
  return isNaN(timestamp) || timestamp < 0 ? 0 : timestamp;
}

function setSyncLastFullRefreshAt_(timestamp) {
  PropertiesService.getScriptProperties().setProperty(
    SYNC_CONFIG.LAST_FULL_REFRESH_KEY,
    String(timestamp || Date.now())
  );
}

function shouldRunScheduledFullRefresh_(nowMs) {
  var lastFullRefreshAt = getSyncLastFullRefreshAt_();
  return !lastFullRefreshAt || nowMs - lastFullRefreshAt >= SYNC_CONFIG.FULL_REFRESH_INTERVAL_MS;
}

function hasSyncQueueChanges_(responseQueueStats, approvalActionQueueStats, emailQueueStats) {
  return toNumber_(responseQueueStats && responseQueueStats.processed, 0) > 0 ||
    toNumber_(responseQueueStats && responseQueueStats.failed, 0) > 0 ||
    toNumber_(approvalActionQueueStats && approvalActionQueueStats.processed, 0) > 0 ||
    toNumber_(approvalActionQueueStats && approvalActionQueueStats.failed, 0) > 0 ||
    toNumber_(emailQueueStats && emailQueueStats.sent, 0) > 0 ||
    toNumber_(emailQueueStats && emailQueueStats.failed, 0) > 0;
}

function runFullSyncRefresh_(startedAt) {
  refreshDashboard(true);
  if (shouldStopSync_(startedAt)) return false;
  refreshFormChoices(true);
  setSyncLastFullRefreshAt_(Date.now());
  return true;
}

function syncSystem() {
  var startedAt = Date.now();
  if (!isSyncActiveHour_()) {
    logInfo_('syncSystem', '', 'syncSystem skipped: outside active hours.');
    return;
  }

  var lock = LockService.getScriptLock();
  var lockAcquired = lock.tryLock(SYNC_CONFIG.LOCK_WAIT_MS);
  if (!lockAcquired) {
    logInfo_('syncSystem', '', 'syncSystem skipped: another execution is already running.');
    return;
  }

  try {
    cleanupOldSyncRuntimeProperties_();
    if (!hasSyncDailyBudgetRemaining_()) {
      logInfo_('syncSystem', '', 'syncSystem skipped: estimated daily runtime budget reached.');
      return;
    }
    if (shouldStopSync_(startedAt)) return;
    var responseQueueStats = processUnprocessedFormResponses({ skipLock: true, startedAt: startedAt });
    logInfo_('syncSystem', '', formatResponseQueueStats_(responseQueueStats));
    if (shouldStopSync_(startedAt)) return;
    var approvalActionQueueStats = processApprovalActionQueue({ skipLock: true, startedAt: startedAt });
    logInfo_('syncSystem', '', formatApprovalActionQueueStats_(approvalActionQueueStats));
    if (shouldStopSync_(startedAt)) return;
    syncReferenceDataFromAdminSheets_();
    if (shouldStopSync_(startedAt)) return;
    var emailQueueStats = processEmailQueue({ startedAt: startedAt });
    if (shouldStopSync_(startedAt)) return;
    processPendingApprovalEmails({ startedAt: startedAt });
    if (shouldStopSync_(startedAt)) return;
    var queueChanged = hasSyncQueueChanges_(responseQueueStats, approvalActionQueueStats, emailQueueStats);
    var scheduledRefreshDue = shouldRunScheduledFullRefresh_(Date.now());
    if (queueChanged || scheduledRefreshDue) {
      if (!runFullSyncRefresh_(startedAt)) return;
      logInfo_('syncSystem', '', 'Full refresh completed; reason: ' + (queueChanged ? 'queue changes' : 'scheduled interval') + '.');
    } else {
      logInfo_('syncSystem', '', 'Full refresh skipped: no queue changes and scheduled interval has not elapsed.');
    }
    logInfo_('syncSystem', '', 'Sync completed in ' + (Date.now() - startedAt) + ' ms.');
  } catch (err) {
    logError_('syncSystem', '', err);
  } finally {
    if (lockAcquired) {
      try {
        var elapsedMs = Date.now() - startedAt;
        var runtimeUsedTodayMs = addSyncRuntimeToday_(elapsedMs);
        logInfo_('syncSystem', '', 'Estimated sync runtime used today: ' + runtimeUsedTodayMs + ' ms.');
      } catch (runtimeErr) {
        logError_('syncSystem:runtimeTracking', '', runtimeErr);
      } finally {
        lock.releaseLock();
      }
    }
  }
}

function maintenanceCheck() {
  try {
    refreshDashboard();
    refreshCharts();
    logInfo_('maintenanceCheck', '', 'Maintenance completed.');
  } catch (err) {
    logError_('maintenanceCheck', '', err);
  }
}
