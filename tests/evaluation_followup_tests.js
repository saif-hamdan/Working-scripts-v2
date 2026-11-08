const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function harness() {
  const state = {
    time: Date.parse('2026-11-10T06:10:00+04:00'), properties: {}, sent: [], logs: [],
    responses: [], responseReads: 0, recordReads: 0, mailFailure: false,
    quota: 1500, blocked: false, locked: false, releases: 0, failRecordWrite: false,
    triggers: [], responseReadAdvance: 0, recordWriteAdvance: 0
  };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.time])); }
    static now() { return state.time; }
  }
  const properties = {
    getProperties() { return { ...state.properties }; },
    getProperty(key) { return state.properties[key] || null; },
    setProperty(key, value) { state.properties[key] = String(value); return this; },
    setProperties(values) { Object.entries(values).forEach(([key, value]) => this.setProperty(key, value)); return this; },
    deleteProperty(key) { delete state.properties[key]; return this; }
  };
  const context = {
    Date: ClockDate,
    console: { info(message) { state.logs.push(String(message)); }, error(message) { state.logs.push(String(message)); } },
    PropertiesService: { getScriptProperties() { return properties; } },
    Utilities: {
      getUuid() { return 'uuid-' + (state.uuid = (state.uuid || 0) + 1); },
      formatDate(value, zone, pattern) {
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).formatToParts(value);
        const get = type => parts.find(part => part.type === type).value;
        return pattern.replace(/yyyy|MM|dd|HH|mm|ss|H|m/g, token => ({
          yyyy: get('year'), MM: get('month'), dd: get('day'), HH: get('hour'),
          mm: get('minute'), ss: get('second'), H: String(Number(get('hour'))), m: String(Number(get('minute')))
        }[token]));
      }
    },
    FormApp: { ItemType: { TEXT: 'TEXT' } },
    LockService: {
      getScriptLock() {
        return {
          tryLock() { if (state.blocked || state.locked) return false; state.locked = true; return true; },
          releaseLock() { state.locked = false; state.releases++; }
        };
      }
    },
    MailApp: {
      getRemainingDailyQuota() { return state.quota; },
      sendEmail(message) {
        if (state.mailFailure) throw new Error('Mail service unavailable');
        state.sent.push({ ...message, time: state.time });
        state.quota -= [message.to, message.cc, message.bcc].filter(Boolean).join(',').split(',').length;
      }
    }
  };
  vm.createContext(context);
  function run(code) { return vm.runInContext(code, context); }
  for (const file of ['Constants.gs', 'BootstrapConfig.gs', 'Utils.gs', 'RotationMetricsService.gs',
    'SheetService.gs', 'RequestService.gs', 'EvaluationPrefillService.gs', 'EvaluationService.gs',
    'EmailService.gs', 'EvaluationFollowupService.gs', 'Step20_EvaluationFollowup.gs', 'Step14_RepairLatestSchema.gs']) {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }).runInContext(context);
  }
  const H = run('H'), E = run('EVALUATION_TRACKING'), F = run('EVALUATION_FIELDS');
  const STATUS = run('STATUS'), SHEETS = run('SHEETS'), CORE = run('RECORD_HEADERS');
  const trackingHeaders = run('EVALUATION_TRACKING_HEADERS'), C = run('EVALUATION_FOLLOWUP_CONFIG');
  class Sheet {
    constructor(name, headers = []) { this.name = name; this.cells = [Array.from(headers)]; this.maxColumns = headers.length; this.hidden = []; }
    getName() { return this.name; }
    getLastRow() { return this.cells.length; }
    getLastColumn() { return this.cells[0].length; }
    getMaxRows() { return 1000; }
    getMaxColumns() { return this.maxColumns; }
    insertColumnsAfter(_column, count) { this.maxColumns += count; }
    hideColumns(column) { this.hidden.push(column); }
    hideSheet() {}
    clear() { this.cells = [[]]; }
    setFrozenRows() {}
    setRightToLeft() {}
    getRange(row, column, count = 1, width = 1) {
      const sheet = this;
      const raw = (r, c) => (sheet.cells[r - 1] || [])[c - 1] ?? '';
      function values(convert) {
        return Array.from({ length: count }, (_, i) => Array.from({ length: width }, (_, j) => convert(raw(row + i, column + j))));
      }
      const range = {
        getValues() {
          if (sheet.name === SHEETS.RECORDS && row === 2 && column === 1 && width >= CORE.length && count === sheet.getLastRow() - 1) state.recordReads++;
          return values(value => typeof value === 'string' && value.startsWith('=HYPERLINK(') ? run('EVALUATION_LINK_LABEL_') : value);
        },
        getFormulas() { return values(value => typeof value === 'string' && value.startsWith('=') ? value : ''); },
        getFormula() { return this.getFormulas()[0][0]; },
        setValues(rows) {
          if (sheet.name === SHEETS.RECORDS && row > 1) {
            if (state.failRecordWrite) throw new Error('Request write unavailable');
            state.time += state.recordWriteAdvance;
          }
          rows.forEach((items, i) => {
            if (!sheet.cells[row + i - 1]) sheet.cells[row + i - 1] = [];
            items.forEach((item, j) => {
              sheet.cells[row + i - 1][column + j - 1] = state.truncateDates && item instanceof Date
                ? new ClockDate(Math.floor(item.getTime() / 1000) * 1000) : item;
            });
          });
          return this;
        },
        createTextFinder(target) {
          return {
            matchEntireCell() { return this; },
            findAll() {
              const matches = [];
              values(value => value).forEach((items, i) => items.forEach(item => {
                if (String(item) === target) matches.push({ getRow: () => row + i });
              }));
              return matches;
            },
            findNext() { return this.findAll()[0] || null; }
          };
        }
      };
      for (const method of ['setFontWeight', 'setBackground', 'setNumberFormat', 'setHorizontalAlignment', 'setVerticalAlignment']) range[method] = function() { return this; };
      return range;
    }
  }
  const sheets = new Map();
  const records = new Sheet(SHEETS.RECORDS, CORE);
  sheets.set(SHEETS.RECORDS, records);
  const ss = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; }
  };
  context.SpreadsheetApp = { openById() { return ss; } };
  const cfg = {
    DASHBOARD_SPREADSHEET_ID: 'dashboard', EVALUATION_FORM_ID: 'evaluation-form',
    EVALUATION_FORM_URL: 'https://docs.google.com/forms/d/e/evaluation/viewform',
    EVALUATION_ALLOWED_FINAL_STATUSES: [STATUS.FINAL_APPROVED, STATUS.FINAL_IN_PROGRESS, STATUS.FINAL_DONE],
    BRAND: { primaryColor: '#0B4EA2', logoUrl: '' }
  };
  context.getConfig = () => cfg;
  context.getRecords_ = () => { context.requireHeaders_(records, CORE); return context.getDataObjects_(records); };
  context.logInfo_ = (action, _id, message) => state.logs.push(action + ': ' + message);
  context.logWarn_ = context.logInfo_;
  context.logError_ = (action, _id, error) => state.logs.push(action + ': ' + (error.message || error));
  context.logExecutionStage_ = (action, stage) => state.logs.push(action + ': ' + stage);
  context.shouldStopSync_ = startedAt => Boolean(startedAt && state.time - startedAt >= 330000);
  context.buildTemplateData_ = (record, extra) => ({
    rows: [{ ar: 'رقم الطلب', en: 'Request ID', value: record[H.RECORD.REQUEST_ID] }],
    brand: cfg.BRAND, ...extra
  });
  context.renderTemplate_ = (name, data) => {
    const source = fs.readFileSync(path.join(root, name + '.html'), 'utf8');
    const regex = /<\?(!?=)?([\s\S]*?)\?>/g;
    let program = 'var output = [];\n', offset = 0, match;
    while ((match = regex.exec(source))) {
      program += 'output.push(' + JSON.stringify(source.slice(offset, match.index)) + ');\n';
      program += match[1] ? 'output.push(' + (match[1] === '=' ? 'escapeHtml(' : '(') + match[2].trim().replace(/;$/, '') + '));\n' : match[2] + '\n';
      offset = regex.lastIndex;
    }
    program += 'output.push(' + JSON.stringify(source.slice(offset)) + '); output.join(\'\');';
    return vm.runInNewContext(program, {
      data, include: () => '<style>/* same email theme */</style>',
      escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    });
  };
  const itemTitles = Object.values(F);
  const form = {
    getId() { return cfg.EVALUATION_FORM_ID; },
    getItems() { return itemTitles.map((title, i) => ({
      getTitle() { return title; },
      asTextItem() { return { createResponse(value) { return { i, value }; } }; }
    })); },
    hasLimitOneResponsePerUser() { return Boolean(state.limitOneResponse); },
    createResponse() {
      const answers = [];
      return {
        withItemResponse(answer) { answers.push(answer); return this; },
        toPrefilledUrl() { return cfg.EVALUATION_FORM_URL + '?usp=pp_url&' + answers.map(a => 'entry.' + a.i + '=' + encodeURIComponent(a.value)).join('&'); }
      };
    },
    getResponses(since) {
      state.responseReads++;
      state.lastResponseSince = since;
      if (state.formFailure) throw new Error('Form backend unavailable');
      state.time += state.responseReadAdvance;
      return state.responses.filter(response => response.getTimestamp().getTime() >= since.getTime());
    }
  };
  context.FormApp.openById = id => { assert.strictEqual(id, cfg.EVALUATION_FORM_ID); return form; };
  function trigger(handler, sourceId = null) {
    return { getHandlerFunction: () => handler, getTriggerSourceId: () => sourceId };
  }
  state.triggers = ['sendEvaluationEmails', 'syncSystem', 'maintenanceCheck', 'scheduledRefreshEmployeeRotationHoursSummary', 'onEdit'].map(name => trigger(name));
  context.ScriptApp = {
    getProjectTriggers() { return state.triggers.slice(); },
    deleteTrigger(value) { state.triggers = state.triggers.filter(item => item !== value); },
    newTrigger(handler) {
      let sourceId = null;
      const builder = {
        forForm(value) { sourceId = value.getId(); return this; },
        create() { const value = trigger(handler, sourceId); state.triggers.push(value); return value; }
      };
      for (const method of ['onFormSubmit', 'timeBased', 'after', 'everyDays', 'atHour']) builder[method] = function() { return this; };
      return builder;
    }
  };
  function addRecord(number, overrides = {}) {
    const record = {
      [H.RECORD.REQUEST_ID]: 'REQ-' + number, [H.RECORD.REQUEST_GROUP_ID]: 'GROUP-1', [H.RECORD.OPTION_ORDER]: number,
      [H.RECORD.EMPLOYEE_ID]: '200', [H.RECORD.EMPLOYEE_NAME]: 'Test Employee', [H.RECORD.EMPLOYEE_EMAIL]: 'employee@squ.edu.om',
      [H.RECORD.DIRECT_MANAGER_EMAIL]: 'manager@squ.edu.om', [H.RECORD.CURRENT_UNIT_HEAD_EMAIL]: 'unit-head@squ.edu.om',
      [H.RECORD.ROTATION_UNIT]: 'Unit A', [H.RECORD.SECTION]: 'Section ' + number,
      [H.RECORD.START_DATE]: new ClockDate('2026-11-05T00:00:00+04:00'), [H.RECORD.END_DATE]: new ClockDate('2026-11-09T00:00:00+04:00'),
      [H.RECORD.HOURS]: 3, [H.RECORD.WORKING_DAYS]: 3, [H.RECORD.TOTAL_HOURS]: 9,
      [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED, [H.RECORD.FINAL_STATUS]: STATUS.FINAL_APPROVED,
      [H.RECORD.EVALUATION_SENT]: STATUS.NO, ...overrides
    };
    const headers = records.cells[0];
    records.cells.push(headers.map(header => record[header] ?? ''));
    return record;
  }
  function read(number = 1) { return context.getRecords_().find(record => record[H.RECORD.REQUEST_ID] === 'REQ-' + number); }
  function queueRows() { return context.getDataObjects_(sheets.get(SHEETS.EMAIL_QUEUE)); }
  function enable() { return context.run20_enableEvaluationFollowup(); }
  function job() { return context.sendEvaluationEmails(); }
  function deliver() { return context.processEmailQueue({ startedAt: state.time }); }
  function setTime(value) { state.time = Date.parse(value); }
  function response(record, options = {}) {
    const values = {
      [F.REQUEST_ID]: record[H.RECORD.REQUEST_ID], [F.EMPLOYEE_ID]: record[H.RECORD.EMPLOYEE_ID],
      [F.REQUEST_GROUP_ID]: record[H.RECORD.REQUEST_GROUP_ID], [F.SELECTION_NUMBER]: record[H.RECORD.OPTION_ORDER],
      ...options.values
    };
    const value = {
      getId: () => options.id || 'response-' + record[H.RECORD.REQUEST_ID],
      getTimestamp: () => new ClockDate(options.time || state.time),
      getRespondentEmail: () => options.email === undefined ? record[H.RECORD.EMPLOYEE_EMAIL] : options.email,
      getItemResponses: () => Object.entries(values).map(([title, answer]) => ({ getItem: () => ({ getTitle: () => title }), getResponse: () => answer }))
    };
    state.responses.push(value);
    return value;
  }
  return { context, state, run, H, E, F, C, STATUS, SHEETS, CORE, trackingHeaders, records, form, cfg,
    properties, sheets, ss, addRecord, read, queueRows, enable, job, deliver, setTime, response };
}

test('optional columns do not change the core request schema or require activation on upload', () => {
  const h = harness();
  h.addRecord(1);
  assert.strictEqual(h.context.getEvaluationFollowupSettings_().enabled, false);
  assert.strictEqual(h.CORE.indexOf(h.E.ENROLLED_AT), -1);
  assert.strictEqual(h.context.getRecords_().length, 1);
});

test('before explicit activation the existing evaluation invitation path remains unchanged', () => {
  const h = harness(); h.addRecord(1); h.job();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.read()[h.H.RECORD.EVALUATION_SENT], h.STATUS.YES);
  assert.strictEqual(h.records.cells[0].length, h.CORE.length);
  assert.strictEqual(h.state.triggers.length, 5);
});

test('time-driven event objects use the current date for legacy invitations, tracked invitations, and reminders', () => {
  const event = { triggerUid: 'timer-1', hour: 6, timezone: 'Asia/Muscat' };
  const legacy = harness(); legacy.addRecord(1);
  legacy.context.sendEvaluationEmails(event);
  assert.strictEqual(legacy.state.sent.length, 1);
  const h = harness(); h.addRecord(1); h.enable();
  h.context.sendEvaluationEmails(event); h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  h.setTime('2026-11-13T06:10:00+04:00');
  h.context.sendEvaluationEmails(event); h.deliver();
  assert.strictEqual(h.state.sent.length, 2);
  assert.strictEqual(h.read()[h.E.REMINDER_COUNT], 1);
});

test('setup appends columns once, hides internal metadata, preserves old rows, and never sends mail', () => {
  const h = harness();
  h.addRecord(1, { [h.H.RECORD.EVALUATION_SENT]: h.STATUS.YES, [h.H.RECORD.EVALUATION_SENT_AT]: new Date('2026-11-01') });
  const before = plain(h.records.cells);
  h.enable();
  const activation = h.state.properties[h.C.ENABLED_AT_KEY];
  h.setTime('2026-11-11T06:10:00+04:00');
  h.enable();
  assert.strictEqual(h.state.properties[h.C.ENABLED_AT_KEY], activation);
  assert.strictEqual(h.records.cells[0].length, h.CORE.length + h.trackingHeaders.length);
  assert.deepStrictEqual(plain(h.records.cells[1]), before[1]);
  assert.strictEqual(h.read()[h.E.ENROLLED_AT], '');
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.state.triggers.filter(t => t.getHandlerFunction() === 'onEvaluationFormSubmit').length, 1);
  assert.strictEqual(h.state.triggers.filter(t => t.getHandlerFunction() === 'sendEvaluationEmails').length, 1);
  const map = h.context.getHeaderMap_(h.records);
  for (const field of [h.E.ENROLLED_AT, h.E.PENDING_CONTEXT, h.E.RESPONSE_ID]) assert.ok(h.records.hidden.includes(map[field]));
});

test('setup refuses one-response-only Forms or an unexpected Form change without sending email', () => {
  const h = harness();
  h.state.limitOneResponse = true;
  assert.throws(() => h.enable(), /Limit to 1 response/);
  assert.strictEqual(h.state.sent.length, 0);
  h.state.limitOneResponse = false;
  h.properties.setProperty(h.C.FORM_ID_KEY, 'different-form');
  assert.throws(() => h.enable(), /different evaluation Form/);
  assert.strictEqual(h.context.getEvaluationFollowupSettings_().enabled, false);
});

test('old invitations are never enrolled or reminded, while new invitations are queued once', () => {
  const h = harness();
  h.addRecord(1, { [h.H.RECORD.EVALUATION_SENT]: h.STATUS.YES, [h.H.RECORD.EVALUATION_SENT_AT]: new Date('2026-11-01') });
  h.addRecord(2);
  h.enable(); h.job(); h.job();
  assert.strictEqual(h.queueRows().length, 1);
  assert.strictEqual(h.read(1)[h.E.ENROLLED_AT], '');
  assert.ok(h.read(2)[h.E.ENROLLED_AT]);
  assert.strictEqual(h.read(2)[h.H.RECORD.EVALUATION_SENT], h.STATUS.NO);
  assert.strictEqual(h.read(2)[h.H.RECORD.EVALUATION_SENT_AT], '');
  assert.strictEqual(h.read(2)[h.E.NEXT_REMINDER_AT], '');
  assert.strictEqual(h.state.sent.length, 0);
});

test('the first three-day clock starts after actual sending, not after queueing', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  h.setTime('2026-11-12T23:59:00+04:00'); h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.context.evaluationCalendarDay_(h.read()[h.E.NEXT_REMINDER_AT]), h.context.evaluationCalendarDay_(new Date('2026-11-15T06:00:00+04:00')));
  assert.strictEqual(h.read()[h.E.REMINDER_COUNT], 0);
  assert.strictEqual(h.state.sent[0].to, 'employee@squ.edu.om');
  assert.strictEqual(h.state.sent[0].cc.toLowerCase(), 'employeeservices@squ.edu.om');
  assert.strictEqual(h.state.sent[0].bcc, '');
  assert.doesNotMatch(h.state.sent[0].htmlBody, /Reminder:|تذكير:/);
  assert.match(h.state.sent[0].htmlBody, /entry\./);
});

test('Sheets normalizing date milliseconds does not cancel a valid newly enrolled invitation', () => {
  const h = harness(); h.setTime('2026-11-10T06:10:00.789+04:00');
  h.state.truncateDates = true;
  h.addRecord(1); h.enable(); h.job(); h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.read()[h.H.RECORD.EVALUATION_SENT], h.STATUS.YES);
});

test('calendar-day reminders repeat indefinitely, keep the same prefilled link, and do not duplicate a cycle', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
  const link = h.read()[h.H.RECORD.EVALUATION_LINK];
  h.setTime('2026-11-12T06:10:00+04:00'); h.job();
  assert.strictEqual(h.queueRows().length, 1);
  for (const [day, number] of [[13, 1], [16, 2], [19, 3]]) {
    h.setTime('2026-11-' + day + 'T06:10:00+04:00'); h.job(); h.job();
    assert.strictEqual(h.queueRows().length, number + 1);
    assert.strictEqual(h.read()[h.E.REMINDER_COUNT], number - 1);
    h.deliver(); h.deliver();
    assert.strictEqual(h.state.sent.length, number + 1);
    assert.strictEqual(h.read()[h.E.REMINDER_COUNT], number);
    assert.strictEqual(h.read()[h.H.RECORD.EVALUATION_LINK], link);
    assert.match(h.state.sent[number].subject, /تذكير \/ Reminder/);
    assert.match(h.state.sent[number].htmlBody, /Reminder: We have not yet received/);
    assert.match(h.state.sent[number].htmlBody, /تذكير: لم نستلم تقييمك/);
  }
});

test('a reminder delayed for many days does not create a catch-up burst or start another cycle before sending', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
  h.setTime('2026-11-13T06:10:00+04:00'); h.job();
  h.setTime('2026-11-22T06:10:00+04:00'); h.job(); h.job();
  assert.strictEqual(h.queueRows().length, 2);
  assert.strictEqual(h.read()[h.E.REMINDER_COUNT], 0);
  h.deliver(); h.job(); h.deliver();
  assert.strictEqual(h.state.sent.length, 2);
  assert.strictEqual(h.read()[h.E.REMINDER_COUNT], 1);
  assert.strictEqual(h.context.evaluationCalendarDay_(h.read()[h.E.NEXT_REMINDER_AT]), h.context.evaluationCalendarDay_(new Date('2026-11-25T06:00:00+04:00')));
});

test('a submission stops only its own rotation and cancels an already-queued reminder', () => {
  const h = harness(); [1, 2, 3].forEach(n => h.addRecord(n)); h.enable(); h.job(); h.deliver();
  h.setTime('2026-11-13T06:10:00+04:00'); h.job();
  const submitted = h.response(h.read(2));
  h.context.onEvaluationFormSubmit({ source: h.form, response: submitted });
  const sentBefore = h.state.sent.length;
  h.deliver();
  assert.strictEqual(h.state.sent.length - sentBefore, 2);
  assert.strictEqual(h.read(2)[h.E.SUBMITTED], h.STATUS.YES);
  assert.strictEqual(h.read(2)[h.E.NEXT_REMINDER_AT], '');
  assert.strictEqual(h.read(1)[h.E.SUBMITTED], h.STATUS.NO);
  assert.strictEqual(h.read(3)[h.E.SUBMITTED], h.STATUS.NO);
  assert.ok(h.queueRows().some(row => row[h.H.QUEUE.STATUS] === 'ألغي الإرسال'));
});

for (const mismatch of ['request', 'employee', 'email', 'group', 'selection']) {
  test(mismatch + ' mismatch does not falsely mark a rotation complete', () => {
    const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
    h.setTime('2026-11-10T07:00:00+04:00');
    const options = mismatch === 'email' ? { email: 'someone-else@squ.edu.om' } : { values: {
      [{ request: h.F.REQUEST_ID, employee: h.F.EMPLOYEE_ID, group: h.F.REQUEST_GROUP_ID, selection: h.F.SELECTION_NUMBER }[mismatch]]: 'WRONG'
    } };
    const response = h.response(h.read(), options);
    h.context.onEvaluationFormSubmit({ source: h.form, response });
    assert.strictEqual(h.read()[h.E.SUBMITTED], h.STATUS.NO);
  });
}

test('opening a link, an event from the wrong Form, or a duplicate response cannot corrupt completion tracking', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
  h.context.onEvaluationFormSubmit({ source: h.form });
  assert.strictEqual(h.read()[h.E.SUBMITTED], h.STATUS.NO);
  h.setTime('2026-11-10T07:00:00+04:00');
  const response = h.response(h.read());
  h.context.onEvaluationFormSubmit({ source: { getId: () => 'main-request-form' }, response });
  assert.strictEqual(h.read()[h.E.SUBMITTED], h.STATUS.NO);
  h.context.onEvaluationFormSubmit({ source: h.form, response });
  const firstTime = h.read()[h.E.SUBMITTED_AT].getTime();
  h.context.onEvaluationFormSubmit({ source: h.form, response });
  assert.strictEqual(h.read()[h.E.SUBMITTED_AT].getTime(), firstTime);
});

test('missed or busy submit triggers are recovered before any queued reminder is sent', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
  h.setTime('2026-11-13T06:10:00+04:00'); h.job();
  const response = h.response(h.read());
  h.state.blocked = true;
  h.context.onEvaluationFormSubmit({ source: h.form, response });
  h.state.blocked = false;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.read()[h.E.SUBMITTED], h.STATUS.YES);
});

test('response checkpoints resume batches sharing an identical timestamp without losing any response', () => {
  const h = harness();
  for (let i = 1; i <= 105; i++) h.addRecord(i, { [h.H.RECORD.EVALUATION_SENT]: h.STATUS.YES });
  h.enable(); h.setTime('2026-11-10T07:00:00+04:00');
  for (let i = 1; i <= 105; i++) h.response(h.read(i), { id: 'response-' + String(i).padStart(3, '0') });
  h.job();
  assert.strictEqual(h.context.getRecords_().filter(row => row[h.E.SUBMITTED] === h.STATUS.YES).length, 100);
  h.context.continueEvaluationFollowup();
  assert.strictEqual(h.context.getRecords_().filter(row => row[h.E.SUBMITTED] === h.STATUS.YES).length, 105);
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.queueRows().length, 0);
});

test('failed response reconciliation holds tracked mail without exhausting delivery retries', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  h.state.formFailure = true;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.queueRows()[0][h.H.QUEUE.ATTEMPTS], 0);
  h.state.formFailure = false; h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
});

test('job and outbox message limits resume a larger intake without duplicate invitations', () => {
  const h = harness(); for (let i = 1; i <= 25; i++) h.addRecord(i); h.enable();
  h.state.recordReads = 0;
  h.job();
  assert.strictEqual(h.state.recordReads, 1);
  assert.strictEqual(h.queueRows().length, 10);
  assert.strictEqual(h.state.triggers.filter(t => t.getHandlerFunction() === 'continueEvaluationFollowup').length, 1);
  h.context.continueEvaluationFollowup(); h.context.continueEvaluationFollowup();
  assert.strictEqual(h.queueRows().length, 25);
  assert.strictEqual(h.state.properties[h.C.JOB_CURSOR_KEY], undefined);
  h.state.recordReads = 0; h.state.responseReads = 0;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 10);
  assert.strictEqual(h.state.recordReads, 1);
  assert.strictEqual(h.state.responseReads, 1);
  h.deliver(); h.deliver();
  assert.strictEqual(h.state.sent.length, 25);
});

test('runtime guards checkpoint before doing more invitation work', () => {
  const h = harness(); for (let i = 1; i <= 20; i++) h.addRecord(i); h.enable();
  h.state.responseReadAdvance = h.C.MAX_JOB_MS;
  h.job();
  assert.strictEqual(h.queueRows().length, 0);
  assert.ok(h.state.properties[h.C.JOB_CURSOR_KEY]);
  assert.ok(h.state.triggers.some(t => t.getHandlerFunction() === 'continueEvaluationFollowup'));
});

test('a partially prepared invitation resumes the same row without losing enrollment or duplicating mail', () => {
  const h = harness(); h.addRecord(1); h.enable();
  h.state.recordWriteAdvance = h.C.MAX_JOB_MS;
  h.job();
  assert.strictEqual(h.queueRows().length, 0);
  const enrollment = h.read()[h.E.ENROLLED_AT].getTime();
  h.state.recordWriteAdvance = 0;
  h.context.continueEvaluationFollowup(); h.deliver();
  assert.strictEqual(h.read()[h.E.ENROLLED_AT].getTime(), enrollment);
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.queueRows().length, 1);
});

test('legacy approval emails still send when evaluation reconciliation is temporarily unavailable', () => {
  const h = harness();
  h.context.queueEmail_({ to: 'approver@squ.edu.om', subject: 'Approval', htmlBody: '<p>Approve</p>' }, { kind: 'approval', requestId: 'none' }, null);
  for (let i = 1; i <= 25; i++) h.addRecord(i);
  h.enable(); h.job(); h.context.continueEvaluationFollowup(); h.context.continueEvaluationFollowup();
  h.state.formFailure = true;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.state.sent[0].to, 'approver@squ.edu.om');
});

test('a duplicate outbox entry for the same cycle is cancelled after the first successful send', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  const row = h.queueRows()[0];
  const queue = h.sheets.get(h.SHEETS.EMAIL_QUEUE);
  h.context.appendObjectRow_(queue, h.run('QUEUE_HEADERS'), row);
  h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.ok(h.queueRows().some(value => value[h.H.QUEUE.STATUS] === 'ألغي الإرسال'));
});

test('an admin rejection after queueing prevents an evaluation reminder from sending', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.deliver();
  h.setTime('2026-11-13T06:10:00+04:00'); h.job();
  h.context.updateRequestByRow_(2, { [h.H.RECORD.FINAL_STATUS]: h.STATUS.FINAL_REJECTED });
  h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.read()[h.E.NEXT_REMINDER_AT], '');
});

test('queued evaluation mail uses a corrected employee email without adding managers as recipients', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  h.context.updateRequestByRow_(2, { [h.H.RECORD.EMPLOYEE_EMAIL]: 'corrected@squ.edu.om' });
  h.deliver();
  assert.strictEqual(h.state.sent[0].to, 'corrected@squ.edu.om');
  assert.strictEqual(h.state.sent[0].cc.toLowerCase(), 'employeeservices@squ.edu.om');
  assert.doesNotMatch(h.state.sent[0].to + h.state.sent[0].cc, /manager|unit-head/);
});

test('a row with pre-activation tracking metadata is not enrolled in new reminders', () => {
  const h = harness(); h.enable();
  h.addRecord(1, {
    [h.H.RECORD.EVALUATION_SENT]: h.STATUS.YES,
    [h.H.RECORD.EVALUATION_SENT_AT]: new Date('2026-11-01'),
    [h.E.ENROLLED_AT]: new Date('2026-11-01'),
    [h.E.NEXT_REMINDER_AT]: new Date('2026-11-04')
  });
  h.job(); h.deliver();
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.queueRows().length, 0);
});

test('a low mail quota defers evaluation mail without changing counters or consuming a retry', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.state.quota = 1;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.queueRows()[0][h.H.QUEUE.ATTEMPTS], 0);
  assert.strictEqual(h.read()[h.H.RECORD.EVALUATION_SENT_AT], '');
  h.state.quota = 1500; h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
});

test('mail failures retry the same outbox entry and do not start reminder timing prematurely', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.state.mailFailure = true;
  h.deliver();
  assert.strictEqual(h.queueRows().length, 1);
  assert.strictEqual(h.queueRows()[0][h.H.QUEUE.STATUS], h.STATUS.QUEUE_PENDING);
  assert.strictEqual(h.read()[h.E.NEXT_REMINDER_AT], '');
  h.state.mailFailure = false; h.deliver(); h.job();
  assert.strictEqual(h.queueRows().length, 1);
  assert.strictEqual(h.state.sent.length, 1);
});

test('post-send record-write failure is recovered without sending the email twice', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job(); h.state.failRecordWrite = true;
  h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.strictEqual(h.queueRows()[0][h.H.QUEUE.STATUS], h.STATUS.QUEUE_SENT);
  h.state.failRecordWrite = false; h.job(); h.deliver();
  assert.strictEqual(h.state.sent.length, 1);
  assert.ok(h.read()[h.H.RECORD.EVALUATION_SENT_AT]);
  assert.strictEqual(h.read()[h.E.PENDING_CONTEXT], '');
});

test('interrupted sends are held for review instead of being automatically sent again', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  const queue = h.sheets.get(h.SHEETS.EMAIL_QUEUE);
  h.context.updateObjectRow_(queue, 2, { [h.H.QUEUE.STATUS]: 'جار الإرسال', [h.H.QUEUE.ATTEMPTS]: 5 });
  h.deliver();
  assert.strictEqual(h.state.sent.length, 0);
  assert.strictEqual(h.queueRows()[0][h.H.QUEUE.STATUS], h.STATUS.QUEUE_FAILED);
  assert.match(h.queueRows()[0][h.H.QUEUE.LAST_ERROR], /outcome is unknown/);
});

test('pausing holds invitations/reminders but still accepts submitted evaluations and preserves activation on resume', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  const activated = h.state.properties[h.C.ENABLED_AT_KEY];
  h.context.run20_pauseEvaluationFollowup(); h.deliver(); h.job();
  assert.strictEqual(h.state.sent.length, 0);
  h.setTime('2026-11-10T07:00:00+04:00');
  const response = h.response(h.read()); h.context.onEvaluationFormSubmit({ source: h.form, response });
  assert.strictEqual(h.read()[h.E.SUBMITTED], h.STATUS.YES);
  h.enable(); h.deliver();
  assert.strictEqual(h.state.properties[h.C.ENABLED_AT_KEY], activated);
  assert.strictEqual(h.state.sent.length, 0);
});

test('later broad schema repairs retain the optional tracking columns and their data', () => {
  const h = harness(); h.addRecord(1); h.enable(); h.job();
  const before = h.read()[h.E.PENDING_CONTEXT];
  h.context.bsEnsureSheet_ = (_ss, name) => h.ss.getSheetByName(name);
  h.context.bsSetHeaders_ = (sheet, headers) => h.context.setSheetHeaders_(sheet, headers);
  h.context.repairBootstrapSheetSchema_(h.ss, h.SHEETS.RECORDS, Array.from(h.CORE));
  assert.strictEqual(h.read()[h.E.PENDING_CONTEXT], before);
  assert.ok(h.context.getHeaderMap_(h.records)[h.E.NEXT_REMINDER_AT]);
});

let passed = 0;
for (const current of tests) {
  try { current.fn(); passed++; console.log('PASS ' + current.name); }
  catch (error) { console.error('FAIL ' + current.name); console.error(error.stack || error); process.exitCode = 1; }
}
console.log(passed + '/' + tests.length + ' evaluation-followup tests passed.');
