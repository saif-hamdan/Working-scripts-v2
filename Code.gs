/** Entry points used by menus, triggers, and web app deployment. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('SQU Training')
      .addItem('إعداد/تحديث النظام', 'setupAllFromMenu')
      .addItem('تحديث لوحة الأقسام', 'refreshDashboard')
      .addItem('تحديث القوائم في النموذج', 'refreshFormChoices')
      .addItem('إرسال تقييمات مستحقة', 'sendEvaluationEmails')
      .addItem('إعادة تثبيت المشغلات', 'installTriggers')
      .addToUi();
  } catch (ignore) {}
}

function setupAll() {
  setupAllSystem();
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

function syncSystem() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var responseQueueStats = processUnprocessedFormResponses({ skipLock: true });
    logInfo_('syncSystem', '', formatResponseQueueStats_(responseQueueStats));
    syncReferenceDataFromAdminSheets_();
    processEmailQueue();
    processPendingApprovalEmails();
    refreshDashboard(true);
    refreshCharts();
    refreshFormChoices(true);
    logInfo_('syncSystem', '', 'Sync completed.');
  } catch (err) {
    logError_('syncSystem', '', err);
  } finally {
    lock.releaseLock();
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
