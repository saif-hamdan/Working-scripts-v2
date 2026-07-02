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
    var responseQueueStats = processUnprocessedFormResponses({ skipLock: true });
    logInfo_('syncSystem', '', formatResponseQueueStats_(responseQueueStats));
    var approvalActionQueueStats = processApprovalActionQueue({ skipLock: true });
    logInfo_('syncSystem', '', formatApprovalActionQueueStats_(approvalActionQueueStats));
    syncReferenceDataFromAdminSheets_();
    processEmailQueue();
    processPendingApprovalEmails();
    refreshDashboard(true);
    refreshCharts();
    refreshFormChoices(true);
    logInfo_('syncSystem', '', 'Sync completed in ' + (Date.now() - startedAt) + ' ms.');
  } catch (err) {
    logError_('syncSystem', '', err);
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
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
