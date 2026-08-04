/** Entry points used by menus, triggers, and web app deployment. */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    var setupMenu = ui.createMenu('Staged bootstrap setup')
      .addItem('00 - Diagnose setup state', 'run00_diagnoseSetupState')
      .addItem('00 - Clear saved resource IDs for fresh setup', 'run00_clearSavedResourceIdsForFreshSetup')
      .addItem('00 - Start fresh setup resources', 'run00_startFreshSetupResources')
      .addSeparator()
      .addItem('01 - Create or open resources', 'run01_createOrOpenResources')
      .addItem('02 - Set up dashboard sheets', 'run02_setupDashboardSheets')
      .addItem('03 - Validate reference data', 'run03_validateReferenceData')
      .addItem('04 - Rebuild main form base questions', 'run04_rebuildMainFormBaseQuestions')
      .addItem('05 - Start main form branching', 'run05_startMainFormBranching')
      .addItem('06 - Continue main form branching', 'run06_continueMainFormBranching')
      .addItem('07 - Set up evaluation form', 'run07_setupEvaluationForm')
      .addItem('08 - Build dashboard summary', 'run08_buildDashboardSummaryAndCharts')
      .addItem('09 - Apply protections', 'run09_applyProtections')
      .addItem('10 - Finalize setup summary', 'run10_finalizeSetupSummary')
      .addItem('13 - Verify production compatibility', 'run13_verifyProductionCompatibility')
      .addItem('14 - Repair existing resources from latest script', 'run14_repairExistingResourcesFromLatestScript')
      .addItem('17 - Repair main form branching once', 'run17_repairMainFormBranching')
      .addItem('18 - Add section-head emails without form changes', 'run18_updateSectionHeadEmailSchema')
      .addItem('19 - Apply request-sheet layout and employee-name label', 'run19_applyRequestSheetAndFormUpdates')
      .addSeparator()
      .addItem('11 - Refresh main form from admin sheets', 'run11_refreshMainFormFromAdminSheets')
      .addItem('12 - Use syncSystem for form refresh', 'run12_createFiveMinuteFormRefreshTrigger')
      .addItem('12 - Delete legacy form refresh trigger', 'run12_deleteFiveMinuteFormRefreshTrigger')
      .addSeparator()
      .addItem('Bootstrap all (small setups only)', 'bootstrapAll');

    ui.createMenu('SQU Rotation')
      .addItem('إعداد/تحديث النظام', 'setupAllFromMenu')
      .addItem('Production setupAll', 'setupAll')
      .addItem('تحديث لوحة الأقسام', 'refreshDashboard')
      .addItem('تحديث ملخص ساعات التدوير المعرفي', 'refreshEmployeeRotationHoursSummary')
      .addItem('تحديث القوائم في النموذج', 'refreshFormChoices')
      .addItem('معالجة الطلبات غير المعالجة', 'processResponseQueueOnce')
      .addItem('إعادة بناء فهرس مصادر الطلبات', 'rebuildRequestSourceIndex')
      .addItem('Sync system', 'syncSystem')
      .addItem('Maintenance check', 'maintenanceCheck')
      .addItem('إرسال تقييمات مستحقة', 'sendEvaluationEmails')
      .addItem('تغيير حالة الاعتماد النهائي', 'showFinalStatusDialog')
      .addItem('إعادة تثبيت المشغلات', 'installTriggers')
      .addSeparator()
      .addSubMenu(setupMenu)
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

function getSyncLastRefreshAt_(propertyKey) {
  var value = PropertiesService.getScriptProperties().getProperty(propertyKey);
  var timestamp = Number(value);
  return isNaN(timestamp) || timestamp < 0 ? 0 : timestamp;
}

function setSyncLastRefreshAt_(propertyKey, timestamp) {
  PropertiesService.getScriptProperties().setProperty(propertyKey, String(timestamp || Date.now()));
}

function shouldRunScheduledRefresh_(propertyKey, intervalMs, nowMs) {
  var lastRefreshAt = getSyncLastRefreshAt_(propertyKey);
  return !lastRefreshAt || nowMs - lastRefreshAt >= intervalMs;
}

function shouldRunScheduledDashboardRefresh_(nowMs) {
  return shouldRunScheduledRefresh_(
    SYNC_CONFIG.LAST_DASHBOARD_REFRESH_KEY,
    SYNC_CONFIG.DASHBOARD_REFRESH_INTERVAL_MS,
    nowMs
  );
}


function hasSyncQueueChanges_(responseQueueStats, approvalActionQueueStats, emailQueueStats) {
  return toNumber_(responseQueueStats && responseQueueStats.processed, 0) > 0 ||
    toNumber_(responseQueueStats && responseQueueStats.failed, 0) > 0 ||
    toNumber_(approvalActionQueueStats && approvalActionQueueStats.processed, 0) > 0 ||
    toNumber_(approvalActionQueueStats && approvalActionQueueStats.failed, 0) > 0 ||
    toNumber_(emailQueueStats && emailQueueStats.sent, 0) > 0 ||
    toNumber_(emailQueueStats && emailQueueStats.failed, 0) > 0;
}

function refreshDashboardFromSync_(records) {
  var dashboardRows = calculateSectionSummary_(records);
  renderDashboardRows_(dashboardRows);
  setSyncLastRefreshAt_(SYNC_CONFIG.LAST_DASHBOARD_REFRESH_KEY);
  return dashboardRows;
}


function refreshFormChoicesFromSync_(startedAt, forceCheck) {
  if (forceCheck !== true && typeof mainFormNeedsRefresh_ === 'function' && !mainFormNeedsRefresh_()) return false;
  var deadline = startedAt
    ? startedAt + SYNC_CONFIG.MAX_SINGLE_RUN_MS - 15000
    : Date.now() + Math.max(60000, SYNC_CONFIG.MAX_SINGLE_RUN_MS - 15000);
  if (Date.now() >= deadline) {
    logInfo_('syncSystem', '', 'Form refresh deferred because the sync execution is near its deadline.');
    return false;
  }
  refreshFormChoices({
    skipReferenceSync: true,
    skipLock: true,
    deadline: deadline
  });
  setSyncLastRefreshAt_(SYNC_CONFIG.LAST_FORM_REFRESH_KEY);
  return true;
}

function hasCapacityAffectingQueueChanges_(responseQueueStats, approvalActionQueueStats) {
  return toNumber_(responseQueueStats && responseQueueStats.processed, 0) > 0 ||
    toNumber_(approvalActionQueueStats && approvalActionQueueStats.processed, 0) > 0;
}

function runFullSyncRefresh_(startedAt) {
  var records = getRecords_();
  if (shouldStopSync_(startedAt)) return false;
  var dashboardRows = refreshDashboardFromSync_(records);
  if (shouldStopSync_(startedAt)) return false;
  refreshFormChoicesFromSync_(startedAt);
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
    var responseQueueStats = processUnprocessedFormResponses({ skipLock: true, startedAt: startedAt, deferRefresh: true });
    logInfo_('syncSystem', '', formatResponseQueueStats_(responseQueueStats));
    if (shouldStopSync_(startedAt)) return;
    var approvalActionQueueStats = processApprovalActionQueue({ skipLock: true, startedAt: startedAt });
    logInfo_('syncSystem', '', formatApprovalActionQueueStats_(approvalActionQueueStats));
    if (shouldStopSync_(startedAt)) return;
    var referenceSyncStats = syncReferenceDataFromAdminSheets_();
    if (shouldStopSync_(startedAt)) return;
    var emailQueueStats = processEmailQueue({ startedAt: startedAt });
    if (shouldStopSync_(startedAt)) return;
    processPendingApprovalEmails({ startedAt: startedAt });
    if (shouldStopSync_(startedAt)) return;

    var nowMs = Date.now();
    var queueChanged = hasSyncQueueChanges_(responseQueueStats, approvalActionQueueStats, emailQueueStats);
    var approvalRecordsChanged = toNumber_(approvalActionQueueStats && approvalActionQueueStats.processed, 0) > 0;
    var referenceChanged = Boolean(referenceSyncStats && referenceSyncStats.changed);
    var formChoicesChanged = Boolean(
      referenceSyncStats && referenceSyncStats.formChoicesChanged
    );
    var dashboardRefreshDue = shouldRunScheduledDashboardRefresh_(nowMs);
    // Newly created response records update only their affected dashboard rows.
    // A full records scan remains scheduled, and is also used after approvals or
    // reference-data changes that can affect many rows.
    var needsDashboardRefresh = approvalRecordsChanged || referenceChanged || dashboardRefreshDue;
    // Form choices now depend only on unit/section reference data. Request and
    // approval status changes do not require rebuilding the Google Form.
    var stagedBranchingInProgress = typeof mainFormBranchingInProgress_ === 'function' && mainFormBranchingInProgress_();
    var needsFormRefresh = formChoicesChanged ||
      (typeof mainFormNeedsRefresh_ === 'function' && mainFormNeedsRefresh_());

    if (needsDashboardRefresh || needsFormRefresh) {
      var records = getRecords_();
      var dashboardRows = null;
      if (shouldStopSync_(startedAt)) return;
      if (needsDashboardRefresh) {
        dashboardRows = refreshDashboardFromSync_(records);
        logInfo_('syncSystem', '', 'Dashboard refresh completed; reason: ' + (approvalRecordsChanged ? 'approval changes' : (referenceChanged ? 'reference data changes' : 'scheduled interval')) + '.');
      }
      if (shouldStopSync_(startedAt)) return;
      if (needsFormRefresh) {
        refreshFormChoicesFromSync_(startedAt, formChoicesChanged);
        logInfo_('syncSystem', '', 'Change-driven form refresh checked; reason: ' + (formChoicesChanged ? 'unit/section choice changes' : (stagedBranchingInProgress ? 'staged branching progress' : 'queued reference edit')) + '.');
      }
    } else {
      logInfo_('syncSystem', '', 'Refresh phases skipped: no queue/reference changes and scheduled intervals have not elapsed.');
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
    logInfo_('maintenanceCheck', '', 'Maintenance completed.');
  } catch (err) {
    logError_('maintenanceCheck', '', err);
  }
}
