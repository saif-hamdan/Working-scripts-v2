/** Optional, per-rotation evaluation tracking. Enabled only by Step 20. */
var EVALUATION_FOLLOWUP_SETTINGS_CACHE_ = null;

function getEvaluationFollowupSettings_() {
  if (EVALUATION_FOLLOWUP_SETTINGS_CACHE_) return EVALUATION_FOLLOWUP_SETTINGS_CACHE_;
  var properties = PropertiesService.getScriptProperties().getProperties();
  var enabledAt = new Date(properties[EVALUATION_FOLLOWUP_CONFIG.ENABLED_AT_KEY] || '');
  var formId = safeString_(properties[EVALUATION_FOLLOWUP_CONFIG.FORM_ID_KEY]);
  EVALUATION_FOLLOWUP_SETTINGS_CACHE_ = {
    enabled: Boolean(formId && !isNaN(enabledAt.getTime())),
    enabledAt: enabledAt,
    formId: formId,
    paused: properties.EVALUATION_FOLLOWUP_PAUSED === 'true'
  };
  return EVALUATION_FOLLOWUP_SETTINGS_CACHE_;
}

function evaluationCalendarDay_(date) {
  if (!date || isNaN(new Date(date).getTime())) return NaN;
  var key = Utilities.formatDate(new Date(date), SYSTEM.TIME_ZONE, 'yyyy-MM-dd');
  return Date.parse(key + 'T00:00:00Z') / 86400000;
}

function nextEvaluationReminderDate_(sentAt) {
  // Stored/displayed as a date, not a promise of an exact delivery hour.
  return new Date((evaluationCalendarDay_(sentAt) + EVALUATION_FOLLOWUP_CONFIG.REMINDER_DAYS) * 86400000);
}

function evaluationRecordsById_(records) {
  var byId = Object.create(null);
  (records || []).forEach(function(record) {
    var id = safeString_(record[H.RECORD.REQUEST_ID]);
    if (id) byId[id] = record;
  });
  return byId;
}

function updateEvaluationRecord_(record, updates) {
  updateRequestByRow_(record._rowNumber, updates);
  Object.keys(updates).forEach(function(header) { record[header] = updates[header]; });
}

function requireEvaluationTime_(deadline) {
  if (deadline && Date.now() >= deadline) {
    var error = new Error('Evaluation batch checkpointed at its time budget.');
    error.code = 'EVALUATION_DEFERRED';
    throw error;
  }
}

function isEvaluationFollowupRecordApproved_(record, cfg) {
  var allowed = cfg.EVALUATION_ALLOWED_FINAL_STATUSES || APPROVED_EVALUATION_FINAL_STATUSES;
  return safeString_(record[H.RECORD.HEAD_STATUS]) === STATUS.HEAD_ACCEPTED &&
    allowed.indexOf(safeString_(record[H.RECORD.FINAL_STATUS])) !== -1;
}

function isEvaluationRecordEnrolled_(record, settings) {
  var enrolledAt = new Date(record[EVALUATION_TRACKING.ENROLLED_AT]).getTime();
  // Sheets may normalize sub-second Date precision on a write/read round trip.
  return isFinite(enrolledAt) && Math.floor(enrolledAt / 1000) >= Math.floor(settings.enabledAt.getTime() / 1000);
}

function parseEvaluationSubmission_(response) {
  var values = Object.create(null);
  response.getItemResponses().forEach(function(answer) {
    values[safeString_(answer.getItem().getTitle())] = safeString_(answer.getResponse());
  });
  return {
    id: safeString_(response.getId()),
    timestamp: response.getTimestamp(),
    requestId: values[EVALUATION_FIELDS.REQUEST_ID] || '',
    employeeId: values[EVALUATION_FIELDS.EMPLOYEE_ID] || '',
    groupId: values[EVALUATION_FIELDS.REQUEST_GROUP_ID] || '',
    selection: values[EVALUATION_FIELDS.SELECTION_NUMBER] || '',
    email: normalizeEmail_(response.getRespondentEmail())
  };
}

function applyEvaluationSubmission_(submission, record) {
  if (!record) return false;
  var valid = submission.id && submission.requestId === safeString_(record[H.RECORD.REQUEST_ID]) &&
    submission.employeeId && submission.employeeId === safeString_(record[H.RECORD.EMPLOYEE_ID]) &&
    submission.timestamp && !isNaN(new Date(submission.timestamp).getTime());
  if (submission.email && submission.email !== normalizeEmail_(record[H.RECORD.EMPLOYEE_EMAIL])) valid = false;
  if (submission.groupId && submission.groupId !== safeString_(record[H.RECORD.REQUEST_GROUP_ID])) valid = false;
  if (submission.selection && submission.selection !== safeString_(record[H.RECORD.OPTION_ORDER])) valid = false;
  if (!valid) {
    logWarn_('evaluationSubmission', record[H.RECORD.REQUEST_ID], 'Evaluation identifiers or respondent email do not match this rotation; no completion was recorded.');
    return false;
  }
  if (safeString_(record[EVALUATION_TRACKING.SUBMITTED]) === STATUS.YES) return true;
  var updates = {};
  updates[EVALUATION_TRACKING.SUBMITTED] = STATUS.YES;
  updates[EVALUATION_TRACKING.SUBMITTED_AT] = submission.timestamp;
  updates[EVALUATION_TRACKING.RESPONSE_ID] = submission.id;
  updates[EVALUATION_TRACKING.NEXT_REMINDER_AT] = '';
  updates[EVALUATION_TRACKING.PENDING_CONTEXT] = '';
  updateEvaluationRecord_(record, updates);
  return true;
}

/** One lightweight evaluation-Form submit trigger; never the main request Form. */
function onEvaluationFormSubmit(event) {
  var settings = getEvaluationFollowupSettings_();
  if (!settings.enabled || !event || !event.response || !event.source ||
      event.source.getId() !== settings.formId) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    logExecutionStage_('onEvaluationFormSubmit', 'Busy; submission will be recovered by the incremental reconciliation');
    return;
  }
  try {
    if (getConfig().EVALUATION_FORM_ID !== settings.formId) throw new Error('Evaluation Form ID changed. Run Step 20 after confirming the correct Form.');
    var submission = parseEvaluationSubmission_(event.response);
    if (submission.requestId) applyEvaluationSubmission_(submission, getRequestById_(submission.requestId));
  } catch (error) {
    logError_('onEvaluationFormSubmit', '', error);
  } finally {
    lock.releaseLock();
  }
}

/** Read new responses once per batch, with a resumable timestamp/ID checkpoint. */
function reconcileEvaluationSubmissions_(byId, settings, deadline) {
  if (Date.now() >= deadline) return false;
  var props = PropertiesService.getScriptProperties();
  var saved = parseJsonSafe_(props.getProperty(EVALUATION_FOLLOWUP_CONFIG.RESPONSE_CURSOR_KEY), {});
  var cursor = { time: toNumber_(saved.time, settings.enabledAt.getTime()), id: safeString_(saved.id) };
  var form = getEvaluationPrefillFormContext_(settings.formId).form;
  var responses = form.getResponses(new Date(Math.max(settings.enabledAt.getTime() - 1, cursor.time - 1000)));
  var descriptors = responses.map(function(response) {
    return { response: response, time: response.getTimestamp().getTime(), id: safeString_(response.getId()) };
  }).filter(function(item) {
    return item.time > cursor.time || (item.time === cursor.time && item.id > cursor.id);
  }).sort(function(left, right) {
    return left.time - right.time || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  });
  var processed = 0;
  try {
    for (; processed < descriptors.length; processed++) {
      if (processed >= EVALUATION_FOLLOWUP_CONFIG.MAX_RESPONSES_PER_RUN || Date.now() >= deadline) break;
      var item = descriptors[processed];
      var submission = parseEvaluationSubmission_(item.response);
      applyEvaluationSubmission_(submission, byId[submission.requestId]);
      cursor = { time: item.time, id: item.id };
    }
  } finally {
    if (processed) props.setProperty(EVALUATION_FOLLOWUP_CONFIG.RESPONSE_CURSOR_KEY, objectToJson_(cursor));
  }
  return processed === descriptors.length;
}

function evaluationMessageContext_(record, reminderNumber) {
  return {
    kind: 'evaluation_followup',
    requestId: safeString_(record[H.RECORD.REQUEST_ID]),
    enrollment: new Date(record[EVALUATION_TRACKING.ENROLLED_AT]).getTime(),
    reminderNumber: reminderNumber
  };
}

function isTrackedEvaluationEmailContext_(context) {
  return Boolean(context && context.kind === 'evaluation_followup');
}

function completeEvaluationDelivery_(record, context, sentAt) {
  if (safeString_(record[EVALUATION_TRACKING.PENDING_CONTEXT]) !== objectToJson_(context)) return;
  var updates = {};
  updates[EVALUATION_TRACKING.PENDING_CONTEXT] = '';
  if (context.reminderNumber === 0) {
    updates[H.RECORD.EVALUATION_SENT] = STATUS.YES;
    updates[H.RECORD.EVALUATION_SENT_AT] = sentAt;
  } else {
    updates[EVALUATION_TRACKING.REMINDER_COUNT] = context.reminderNumber;
    updates[EVALUATION_TRACKING.LAST_REMINDER_AT] = sentAt;
  }
  updates[EVALUATION_TRACKING.NEXT_REMINDER_AT] = safeString_(record[EVALUATION_TRACKING.SUBMITTED]) === STATUS.YES
    ? '' : nextEvaluationReminderDate_(sentAt);
  updateEvaluationRecord_(record, updates);
}

/** Reuse a pending/sent outbox entry; never enqueue the same reminder cycle twice. */
function ensureEvaluationMessageQueued_(record, deadline) {
  requireEvaluationTime_(deadline);
  var json = safeString_(record[EVALUATION_TRACKING.PENDING_CONTEXT]);
  var context = parseJsonSafe_(json, null);
  if (!isTrackedEvaluationEmailContext_(context)) throw new Error('Invalid evaluation outbox context; review the request row.');
  var queue = getOrCreateSheet_(SHEETS.EMAIL_QUEUE);
  setSheetHeaders_(queue, QUEUE_HEADERS);
  var existing = findObjectByValue_(queue, H.QUEUE.CONTEXT_JSON, json);
  requireEvaluationTime_(deadline);
  if (existing) {
    if (safeString_(existing[H.QUEUE.STATUS]) === STATUS.QUEUE_SENT) {
      completeEvaluationDelivery_(record, context, existing[H.QUEUE.LAST_ATTEMPT_AT]);
      if (safeString_(existing[H.QUEUE.LAST_ERROR])) {
        var recovered = {};
        recovered[H.QUEUE.LAST_ERROR] = '';
        updateObjectRow_(queue, existing._rowNumber, recovered);
      }
    }
    return true;
  }
  var queued = sendEvaluationEmail(record, record[H.RECORD.EVALUATION_LINK], {
    queueOnly: true, isReminder: context.reminderNumber > 0, context: context, deadline: deadline
  });
  // The pending context prevents duplicate invitations while the actual sent
  // flag/time and reminder clock stay untouched until MailApp succeeds.
  return queued;
}

function runEvaluationFollowupJob_(referenceDate) {
  var settings = getEvaluationFollowupSettings_();
  if (!settings.enabled || settings.paused) return;
  var startedAt = Date.now();
  var deadline = startedAt + EVALUATION_FOLLOWUP_CONFIG.MAX_JOB_MS;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) { scheduleEvaluationContinuation_(); return; }
  try {
    var cfg = getConfig();
    if (cfg.EVALUATION_FORM_ID !== settings.formId || !cfg.EVALUATION_FORM_URL) {
      throw new Error('Evaluation Form settings changed. Confirm them and run Step 20 before continuing.');
    }
    requireHeaders_(getOrCreateSheet_(SHEETS.RECORDS), EVALUATION_TRACKING_HEADERS);
    logExecutionStage_('sendEvaluationEmails', 'Read records and reconcile new evaluation responses', startedAt);
    var records = getRecords_();
    if (!reconcileEvaluationSubmissions_(evaluationRecordsById_(records), settings, deadline)) {
      scheduleEvaluationContinuation_();
      return;
    }
    var props = PropertiesService.getScriptProperties();
    var saved = parseJsonSafe_(props.getProperty(EVALUATION_FOLLOWUP_CONFIG.JOB_CURSOR_KEY), null);
    var remaining = saved ? Math.min(toNumber_(saved.remaining, records.length), records.length) : records.length;
    var index = records.length ? (saved ? toNumber_(saved.index, 0) : 0) % records.length : 0;
    var processed = 0;
    var today = referenceDate || now_();
    var todayDay = evaluationCalendarDay_(today);
    while (remaining > 0 && processed < EVALUATION_FOLLOWUP_CONFIG.MAX_MESSAGES_PER_RUN && Date.now() < deadline) {
      var record = records[index];
      index = (index + 1) % records.length;
      remaining--;
      if (!safeString_(record[H.RECORD.REQUEST_ID])) continue;
      try {
        if (safeString_(record[EVALUATION_TRACKING.SUBMITTED]) === STATUS.YES) continue;
        if (safeString_(record[EVALUATION_TRACKING.PENDING_CONTEXT])) {
          if (!isEvaluationRecordEnrolled_(record, settings)) continue;
          processed++;
          ensureEvaluationMessageQueued_(record, deadline);
          continue;
        }
        if (isEvaluationDueForRecord_(record, cfg, today)) {
          var updates = {};
          if (!isEvaluationRecordEnrolled_(record, settings)) {
            updates[EVALUATION_TRACKING.ENROLLED_AT] = now_();
            updates[EVALUATION_TRACKING.SUBMITTED] = STATUS.NO;
            updates[EVALUATION_TRACKING.REMINDER_COUNT] = 0;
          }
          var link = buildEvaluationPrefilledUrl_(record);
          if (!link) throw new Error('No evaluation link could be generated.');
          requireEvaluationTime_(deadline);
          updates[H.RECORD.EVALUATION_LINK] = link;
          updateEvaluationRecord_(record, updates);
          requireEvaluationTime_(deadline);
          updates = {};
          updates[EVALUATION_TRACKING.PENDING_CONTEXT] = objectToJson_(evaluationMessageContext_(record, 0));
          updateEvaluationRecord_(record, updates);
        } else if (isEvaluationRecordEnrolled_(record, settings) && record[H.RECORD.EVALUATION_SENT_AT] &&
            isEvaluationFollowupRecordApproved_(record, cfg) &&
            evaluationCalendarDay_(record[EVALUATION_TRACKING.NEXT_REMINDER_AT]) <= todayDay) {
          var reminder = toNumber_(record[EVALUATION_TRACKING.REMINDER_COUNT], 0) + 1;
          var reminderUpdates = {};
          reminderUpdates[EVALUATION_TRACKING.PENDING_CONTEXT] = objectToJson_(evaluationMessageContext_(record, reminder));
          updateEvaluationRecord_(record, reminderUpdates);
        } else {
          continue; // Older invitations have no enrollment marker and are never reminded.
        }
        processed++;
        ensureEvaluationMessageQueued_(record, deadline);
      } catch (error) {
        if (error.code === 'EVALUATION_DEFERRED') {
          // Resume this same row: it may have a safely persisted partial/outbox state.
          index = (index - 1 + records.length) % records.length;
          remaining++;
          break;
        }
        logError_('sendEvaluationEmails:followup', record[H.RECORD.REQUEST_ID], error);
      }
    }
    if (remaining > 0) {
      props.setProperty(EVALUATION_FOLLOWUP_CONFIG.JOB_CURSOR_KEY, objectToJson_({ index: index, remaining: remaining }));
      scheduleEvaluationContinuation_();
    } else {
      props.deleteProperty(EVALUATION_FOLLOWUP_CONFIG.JOB_CURSOR_KEY);
    }
    logExecutionStage_('sendEvaluationEmails', 'Batch finished; messages checked/queued: ' + processed + '; remaining rows: ' + remaining, startedAt);
  } catch (error) {
    logError_('sendEvaluationEmails:followup', '', error);
  } finally {
    lock.releaseLock();
  }
}

function scheduleEvaluationContinuation_() {
  var existing = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'continueEvaluationFollowup';
  });
  if (!existing) ScriptApp.newTrigger('continueEvaluationFollowup').timeBased()
    .after(EVALUATION_FOLLOWUP_CONFIG.CONTINUATION_DELAY_MS).create();
}

function continueEvaluationFollowup() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'continueEvaluationFollowup') ScriptApp.deleteTrigger(trigger);
  });
  if (getEvaluationFollowupSettings_().enabled) sendEvaluationEmails();
}

/** Called lazily once by the existing email queue, only when it finds tracked mail. */
function prepareEvaluationQueueState_(options) {
  var state = { ready: false };
  try {
    var settings = getEvaluationFollowupSettings_();
    if (!settings.enabled || settings.paused) return state;
    var cfg = getConfig();
    if (cfg.EVALUATION_FORM_ID !== settings.formId) throw new Error('Evaluation Form ID changed; tracked emails are on hold.');
    state.deadline = Date.now() + EVALUATION_FOLLOWUP_CONFIG.MAX_QUEUE_PREFLIGHT_MS;
    if (options && options.startedAt) state.deadline = Math.min(state.deadline, options.startedAt + SYNC_CONFIG.MAX_SINGLE_RUN_MS - 15000);
    if (Date.now() >= state.deadline) return state;
    requireHeaders_(getOrCreateSheet_(SHEETS.RECORDS), EVALUATION_TRACKING_HEADERS);
    state.records = evaluationRecordsById_(getRecords_());
    state.cfg = cfg;
    state.settings = settings;
    state.remainingQuota = MailApp.getRemainingDailyQuota();
    state.ready = reconcileEvaluationSubmissions_(state.records, settings, state.deadline);
    if (!state.ready) scheduleEvaluationContinuation_();
  } catch (error) {
    logError_('prepareEvaluationQueueState_', '', error);
  }
  return state;
}

function cancelEvaluationQueueRow_(queue, row, record, context, reason) {
  var updates = {};
  updates[H.QUEUE.STATUS] = STATUS.QUEUE_CANCELLED;
  updates[H.QUEUE.LAST_ERROR] = reason;
  updateObjectRow_(queue, row._rowNumber, updates);
  if (record && safeString_(record[EVALUATION_TRACKING.PENDING_CONTEXT]) === objectToJson_(context)) {
    updates = {};
    updates[EVALUATION_TRACKING.PENDING_CONTEXT] = '';
    updates[EVALUATION_TRACKING.NEXT_REMINDER_AT] = '';
    updateEvaluationRecord_(record, updates);
  }
  return 'cancelled';
}

/** Isolated from legacy mail delivery. Recheck completion immediately before sending. */
function processTrackedEvaluationQueueRow_(queue, row, context, state) {
  if (!state.ready || Date.now() >= state.deadline) return 'deferred';
  var record = state.records[context.requestId];
  var attempts = toNumber_(row[H.QUEUE.ATTEMPTS], 0);
  var accepted = false;
  try {
    if (!record || safeString_(record[EVALUATION_TRACKING.SUBMITTED]) === STATUS.YES ||
        !isEvaluationRecordEnrolled_(record, state.settings) ||
        typeof context.reminderNumber !== 'number' || context.reminderNumber < 0 ||
        context.reminderNumber !== Math.floor(context.reminderNumber) ||
        typeof context.enrollment !== 'number' || !isFinite(context.enrollment) ||
        (context.reminderNumber > 0 && context.reminderNumber !== toNumber_(record[EVALUATION_TRACKING.REMINDER_COUNT], 0) + 1) ||
        safeString_(record[EVALUATION_TRACKING.PENDING_CONTEXT]) !== objectToJson_(context) ||
        Math.abs(new Date(record[EVALUATION_TRACKING.ENROLLED_AT]).getTime() - context.enrollment) > 1000 ||
        !isEvaluationFollowupRecordApproved_(record, state.cfg)) {
      return cancelEvaluationQueueRow_(queue, row, record, context, 'Evaluation received, request changed, or this outbox entry is obsolete.');
    }
    if (safeString_(row[H.QUEUE.STATUS]) === STATUS.QUEUE_SENDING) {
      // A prior process stopped between MailApp and its bookkeeping. Do not risk a duplicate.
      var interrupted = {};
      interrupted[H.QUEUE.STATUS] = STATUS.QUEUE_FAILED;
      interrupted[H.QUEUE.ATTEMPTS] = 5;
      interrupted[H.QUEUE.LAST_ERROR] = 'Interrupted evaluation send: delivery outcome is unknown. Check Sent mail before any manual retry.';
      updateObjectRow_(queue, row._rowNumber, interrupted);
      return 'failed';
    }
    var message = buildEmailMessage_(applyEmailRecipientPolicy_({
      to: safeString_(record[H.RECORD.EMPLOYEE_EMAIL]), cc: '', bcc: '',
      subject: safeString_(row[H.QUEUE.SUBJECT]), htmlBody: safeString_(row[H.QUEUE.HTML])
    }, context));
    if (!message.to) throw new Error('Employee email is missing.');
    var recipientCount = uniqueEmailRecipients_(splitCsv_(message.to).concat(splitCsv_(message.cc), splitCsv_(message.bcc))).length;
    if (state.remainingQuota < recipientCount + EVALUATION_FOLLOWUP_CONFIG.MAIL_QUOTA_RESERVE) return 'deferred';
    var sending = {};
    sending[H.QUEUE.STATUS] = STATUS.QUEUE_SENDING;
    sending[H.QUEUE.ATTEMPTS] = attempts + 1;
    sending[H.QUEUE.LAST_ATTEMPT_AT] = now_();
    updateObjectRow_(queue, row._rowNumber, sending);
    MailApp.sendEmail(message);
    accepted = true;
    state.remainingQuota -= recipientCount;
    var sentAt = now_();
    var sent = {};
    sent[H.QUEUE.STATUS] = STATUS.QUEUE_SENT;
    sent[H.QUEUE.LAST_ATTEMPT_AT] = sentAt;
    sent[H.QUEUE.LAST_ERROR] = '';
    updateObjectRow_(queue, row._rowNumber, sent);
    completeEvaluationDelivery_(record, context, sentAt);
    return 'sent';
  } catch (error) {
    var failed = {};
    failed[H.QUEUE.STATUS] = accepted ? STATUS.QUEUE_SENT : (attempts + 1 >= 5 ? STATUS.QUEUE_FAILED : STATUS.QUEUE_PENDING);
    failed[H.QUEUE.ATTEMPTS] = attempts + 1;
    if (accepted) failed[H.QUEUE.LAST_ATTEMPT_AT] = sentAt;
    failed[H.QUEUE.LAST_ERROR] = accepted ? 'Email sent; request tracking update needs recovery: ' + error.message : error.message;
    try { updateObjectRow_(queue, row._rowNumber, failed); } catch (logError) {
      logExecutionStage_('processTrackedEvaluationQueueRow_', 'Outbox bookkeeping failed', null, logError);
    }
    logError_('processTrackedEvaluationQueueRow_', context.requestId, error);
    return accepted ? 'sent' : 'failed';
  }
}
