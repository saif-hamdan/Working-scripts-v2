const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function harness(time = '2026-11-08T22:10:00+04:00') {
  const state = {
    clock: new Date(time).getTime(), info: [], errors: [], events: [], work: [],
    lockAvailable: true, lockWaits: [], releases: 0, sheetOpens: 0, logRows: [],
    consoleBroken: false, sheetBroken: false, budgetAvailable: true,
    dashboardDue: false, referenceChanged: false, formChanged: false,
    failAt: '', advanceAt: '', runtimeWrites: [], outputRows: null
  };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.clock])); }
    static now() { return state.clock; }
  }
  function work(name) {
    state.work.push(name);
    if (state.failAt === name) throw new Error('Injected failure: ' + name);
    if (state.advanceAt === name) state.clock += 330000;
  }
  const sheet = { hideSheet() {} };
  const ss = { getSheetByName() { return sheet; } };
  const context = {
    Date: ClockDate,
    console: {
      info(message) {
        if (state.consoleBroken) throw new Error('Console unavailable');
        state.events.push('console.info');
        state.info.push(String(message));
      },
      error(message) {
        if (state.consoleBroken) throw new Error('Console unavailable');
        state.events.push('console.error');
        state.errors.push(String(message));
      }
    },
    Utilities: {
      formatDate(date, timezone, pattern) {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(date);
        if (pattern !== 'H' && pattern !== 'm') throw new Error('Unexpected format: ' + pattern);
        return String(Number(parts.find(part => part.type === (pattern === 'H' ? 'hour' : 'minute')).value));
      }
    },
    LockService: {
      getScriptLock() {
        state.events.push('getLock');
        return {
          tryLock(milliseconds) { state.lockWaits.push(milliseconds); return state.lockAvailable; },
          releaseLock() { state.releases++; }
        };
      }
    },
    PropertiesService: { getScriptProperties() { throw new Error('Unexpected Properties call'); } },
    MailApp: { sendEmail() { throw new Error('Unexpected Mail call'); } },
    FormApp: { openById() { throw new Error('Unexpected Form call'); } }
  };
  vm.createContext(context);
  for (const file of ['Constants.gs', 'Utils.gs', 'RotationMetricsService.gs', 'Logger.gs', 'TrainingHoursService.gs', 'Code.gs']) {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }).runInContext(context);
  }
  const H = vm.runInContext('H', context);
  const STATUS = vm.runInContext('STATUS', context);
  state.records = [
    { [H.RECORD.EMPLOYEE_ID]: '200', [H.RECORD.EMPLOYEE_NAME]: 'Test Employee',
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED, [H.RECORD.FINAL_STATUS]: STATUS.FINAL_APPROVED,
      [H.RECORD.END_DATE]: '2026-11-07', [H.RECORD.TOTAL_HOURS]: 6 },
    { [H.RECORD.EMPLOYEE_ID]: '200', [H.RECORD.EMPLOYEE_NAME]: 'Test Employee',
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED, [H.RECORD.FINAL_STATUS]: STATUS.FINAL_APPROVED,
      [H.RECORD.END_DATE]: '2026-11-09', [H.RECORD.TOTAL_HOURS]: 4 },
    { [H.RECORD.EMPLOYEE_ID]: '200', [H.RECORD.EMPLOYEE_NAME]: 'Test Employee',
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED, [H.RECORD.FINAL_STATUS]: STATUS.FINAL_REJECTED,
      [H.RECORD.END_DATE]: '2026-11-07', [H.RECORD.TOTAL_HOURS]: 100 }
  ];
  Object.assign(context, {
    openDashboardSpreadsheet_() {
      state.events.push('openSheet');
      state.sheetOpens++;
      if (state.sheetBroken) throw new Error('Spreadsheet backend unavailable');
      return ss;
    },
    ensureSheet_() { return sheet; },
    setSheetHeaders_() {},
    appendObjectRow_(_sheet, _headers, row) { state.logRows.push(row); },
    getRecords_() { work('records'); return state.records; },
    clearAndWriteObjects_(_sheet, _headers, rows) { work('writeSummary'); state.outputRows = rows; },
    applyCleanTableFormatting_() { work('formatSummary'); },
    cleanupOldSyncRuntimeProperties_() { work('cleanup'); },
    hasSyncDailyBudgetRemaining_() { work('budget'); return state.budgetAvailable; },
    processUnprocessedFormResponses(options) { work('responses'); state.responseOptions = options; return { processed: 0, failed: 0 }; },
    formatResponseQueueStats_() { return 'response statistics'; },
    processApprovalActionQueue(options) { work('actions'); state.actionOptions = options; return { processed: 0, failed: 0 }; },
    formatApprovalActionQueueStats_() { return 'approval statistics'; },
    syncReferenceDataFromAdminSheets_() {
      work('references');
      return { changed: state.referenceChanged, formChoicesChanged: state.formChanged };
    },
    processEmailQueue(options) { work('emails'); state.emailOptions = options; return { sent: 0, failed: 0 }; },
    processPendingApprovalEmails() { work('pendingApprovals'); },
    shouldRunScheduledDashboardRefresh_() { return state.dashboardDue; },
    mainFormBranchingInProgress_() { return false; },
    mainFormNeedsRefresh_() { return state.formChanged; },
    calculateSectionSummary_(records) { work('dashboardCalculation'); assert.strictEqual(records, state.records); return []; },
    renderDashboardRows_() { work('dashboard'); },
    refreshFormChoices(options) { work('form'); state.formOptions = options; },
    setSyncLastRefreshAt_() {},
    addSyncRuntimeToday_(elapsed) { state.runtimeWrites.push(elapsed); work('runtime'); return elapsed; }
  });
  return { context, state, H, STATUS, work };
}

for (const time of ['2026-11-05T18:03:40+04:00', '2026-11-07T03:48:40+04:00']) {
  test('reported failure time ' + time + ' skips summary without any spreadsheet or lock call', () => {
    const { context, state } = harness(time);
    context.scheduledRefreshEmployeeRotationHoursSummary();
    assert.deepStrictEqual(state.work, []);
    assert.strictEqual(state.sheetOpens, 0);
    assert.strictEqual(state.events.includes('getLock'), false);
    assert.ok(state.info.some(line => line.includes('Skipped: outside 22:00-23:50 window')));
  });
}

test('the Muscat summary window keeps its existing inclusive boundaries', () => {
  const { context } = harness();
  for (const [time, expected] of [['21:59:59', false], ['22:00:00', true], ['23:50:59', true], ['23:51:00', false]]) {
    assert.strictEqual(context.isEmployeeRotationHoursSummaryActiveTime_(new context.Date('2026-11-08T' + time + '+04:00')), expected);
  }
});

test('busy summary lock skips without a spreadsheet write or releasing someone else\'s lock', () => {
  const { context, state } = harness();
  state.lockAvailable = false;
  context.scheduledRefreshEmployeeRotationHoursSummary();
  assert.deepStrictEqual(state.lockWaits, [3000]);
  assert.strictEqual(state.sheetOpens, 0);
  assert.strictEqual(state.releases, 0);
  assert.deepStrictEqual(state.work, []);
});

test('active summary preserves completed/ongoing totals, rendering order, and success audit', () => {
  const { context, state, H } = harness();
  context.scheduledRefreshEmployeeRotationHoursSummary();
  assert.deepStrictEqual(state.work, ['records', 'writeSummary', 'formatSummary']);
  assert.strictEqual(state.outputRows.length, 1);
  assert.strictEqual(state.outputRows[0][H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS], 6);
  assert.strictEqual(state.outputRows[0][H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS], 4);
  assert.strictEqual(state.outputRows[0][H.EMPLOYEE_ROTATION_HOURS.TOTAL_HOURS], 10);
  assert.strictEqual(state.releases, 1);
  assert.ok(state.logRows.some(row => row[H.LOG.MESSAGE] === 'Employee rotation hours summary refreshed.'));
  for (const phase of ['Read request records', 'Calculate hours', 'Write summary rows', 'Format summary', 'Write completion log']) {
    assert.ok(state.info.some(line => line.includes(phase)), phase);
  }
});

for (const phase of ['records', 'writeSummary', 'formatSummary']) {
  test('summary ' + phase + ' failure records a stack and releases the acquired lock', () => {
    const { context, state, H } = harness();
    state.failAt = phase;
    assert.doesNotThrow(() => context.scheduledRefreshEmployeeRotationHoursSummary());
    assert.strictEqual(state.releases, 1);
    assert.ok(state.errors.some(line => line.includes('Injected failure: ' + phase) && line.includes('trigger_reliability_tests.js')));
    assert.ok(state.logRows.some(row => row[H.LOG.LEVEL] === 'ERROR'));
  });
}

test('errors reach execution logs before a failing spreadsheet logger, without recursive logging', () => {
  const { context, state } = harness();
  state.sheetBroken = true;
  assert.doesNotThrow(() => context.logError_('testAction', '', new Error('Original job failure')));
  assert.ok(state.errors[0].includes('Original job failure'));
  assert.ok(state.errors[1].includes('Spreadsheet logging failed'));
  assert.strictEqual(state.sheetOpens, 1);
  assert.ok(state.events.indexOf('console.error') < state.events.indexOf('openSheet'));
});

test('console diagnostics cannot break a job even when console and spreadsheet logging fail', () => {
  const { context, state } = harness();
  state.consoleBroken = true;
  state.sheetBroken = true;
  assert.doesNotThrow(() => context.logExecutionStage_('test', 'stage', state.clock, new Error('Failure')));
  assert.doesNotThrow(() => context.logError_('test', '', new Error('Failure')));
});

test('elapsed-time diagnostics are nonnegative and do not access other services', () => {
  const { context, state } = harness();
  context.logExecutionStage_('test', 'first', state.clock - 42);
  context.logExecutionStage_('test', 'clock adjusted', state.clock + 42);
  assert.match(state.info[0], /\[42 ms\]/);
  assert.match(state.info[1], /\[0 ms\]/);
  assert.strictEqual(state.sheetOpens, 0);
});

test('inactive sync skips without spreadsheet, properties, queue, or lock work', () => {
  const { context, state } = harness('2026-11-08T03:48:40+04:00');
  context.syncSystem();
  assert.deepStrictEqual(state.work, []);
  assert.strictEqual(state.sheetOpens, 0);
  assert.strictEqual(state.events.includes('getLock'), false);
  assert.ok(state.info.some(line => line.includes('Skipped: outside active hours')));
});

test('busy sync lock skips without sheet work and keeps the original wait duration', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  state.lockAvailable = false;
  context.syncSystem();
  assert.deepStrictEqual(state.lockWaits, [3000]);
  assert.deepStrictEqual(state.work, []);
  assert.strictEqual(state.sheetOpens, 0);
  assert.strictEqual(state.releases, 0);
});

test('sync preserves queue order, options, no-change refresh behavior, and runtime accounting', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  context.syncSystem();
  assert.deepStrictEqual(state.work, ['cleanup', 'budget', 'responses', 'actions', 'references', 'emails', 'pendingApprovals', 'runtime']);
  assert.strictEqual(state.responseOptions.skipLock, true);
  assert.strictEqual(state.responseOptions.deferRefresh, true);
  assert.strictEqual(state.actionOptions.skipLock, true);
  assert.strictEqual(state.emailOptions.startedAt, state.responseOptions.startedAt);
  assert.strictEqual(state.runtimeWrites.length, 1);
  assert.strictEqual(state.releases, 1);
  assert.strictEqual(state.errors.length, 0);
  assert.ok(state.info.some(line => line.includes('Process response queue')));
  assert.ok(state.info.some(line => line.includes('Finished')));
});

test('reference changes still refresh dashboard and form exactly once with the original options', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  state.referenceChanged = true;
  state.formChanged = true;
  context.syncSystem();
  assert.deepStrictEqual(state.work.slice(-5), ['records', 'dashboardCalculation', 'dashboard', 'form', 'runtime']);
  assert.strictEqual(state.formOptions.skipLock, true);
  assert.strictEqual(state.formOptions.skipReferenceSync, true);
  assert.strictEqual(state.formOptions.deadline, state.clock + 315000);
  assert.strictEqual(state.releases, 1);
});

test('daily budget still stops queue work and keeps runtime accounting and lock release', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  state.budgetAvailable = false;
  context.syncSystem();
  assert.deepStrictEqual(state.work, ['cleanup', 'budget', 'runtime']);
  assert.strictEqual(state.releases, 1);
  assert.ok(state.info.some(line => line.includes('Skipped: estimated daily runtime budget reached')));
});

test('the existing near-timeout guard stops after a queue phase without changing its checkpoint options', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  state.advanceAt = 'responses';
  context.syncSystem();
  assert.deepStrictEqual(state.work, ['cleanup', 'budget', 'responses', 'runtime']);
  assert.deepStrictEqual(state.runtimeWrites, [330000]);
  assert.strictEqual(state.releases, 1);
  assert.ok(state.info.some(line => line.includes('Stopped early to avoid timeout')));
});

for (const phase of ['cleanup', 'responses', 'actions', 'references', 'emails', 'pendingApprovals', 'records', 'dashboard', 'form', 'runtime']) {
  test('sync ' + phase + ' failure preserves the error path, runtime tracking, and lock release without retrying work', () => {
    const { context, state } = harness('2026-11-08T09:00:00+04:00');
    state.failAt = phase;
    state.dashboardDue = true;
    state.formChanged = true;
    assert.doesNotThrow(() => context.syncSystem());
    assert.strictEqual(state.work.filter(value => value === phase).length, 1);
    assert.strictEqual(state.runtimeWrites.length, 1);
    assert.strictEqual(state.releases, 1);
    assert.ok(state.errors.some(line => line.includes('Injected failure: ' + phase)));
  });
}

test('ordinary sync failures remain visible even if the spreadsheet logger is unavailable', () => {
  const { context, state } = harness('2026-11-08T09:00:00+04:00');
  state.failAt = 'emails';
  state.sheetBroken = true;
  assert.doesNotThrow(() => context.syncSystem());
  assert.ok(state.errors.some(line => line.includes('Injected failure: emails')));
  assert.strictEqual(state.releases, 1);
});

let passed = 0;
for (const current of tests) {
  try { current.fn(); passed++; console.log('PASS ' + current.name); }
  catch (error) { console.error('FAIL ' + current.name); console.error(error.stack || error); process.exitCode = 1; }
}
console.log(passed + '/' + tests.length + ' trigger-reliability tests passed.');
