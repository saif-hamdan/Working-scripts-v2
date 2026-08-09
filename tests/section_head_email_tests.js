const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const state = {
  section: null,
  record: null,
  sent: 0,
  queued: 0,
  updates: 0,
  toasts: [],
  logs: [],
  throwOnSend: false,
  revertedTo: undefined,
  renderedData: null
};

const sheet = {
  getName() { return context.SHEETS.RECORDS; },
  getLastRow() { return 10; }
};
const spreadsheet = {
  getSheetByName() { return sheet; }
};
const context = {
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  Boolean,
  RegExp,
  Error,
  isFinite,
  isNaN,
  encodeURIComponent,
  decodeURIComponent,
  Logger: { log() {} },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return Array.from(crypto.createHash('sha256').update(String(value)).digest())
        .map((byte) => byte > 127 ? byte - 256 : byte);
    },
    formatDate(value, _timezone, pattern) {
      const date = value instanceof Date ? value : new Date(value);
      const pad = (number, size = 2) => String(number).padStart(size, '0');
      const replacements = {
        yyyy: pad(date.getFullYear(), 4),
        MM: pad(date.getMonth() + 1),
        dd: pad(date.getDate()),
        HH: pad(date.getHours()),
        mm: pad(date.getMinutes()),
        ss: pad(date.getSeconds()),
        SSS: pad(date.getMilliseconds(), 3)
      };
      return pattern.replace(/yyyy|MM|dd|HH|mm|ss|SSS/g, (token) => replacements[token]);
    },
    getUuid() { return crypto.randomUUID(); }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() { return spreadsheet; },
    getActive() {
      return { toast(message) { state.toasts.push(message); } };
    }
  },
  MailApp: {
    sendEmail() {
      state.sent += 1;
      if (state.throwOnSend) throw new Error('Temporary MailApp failure');
    }
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock() { return true; },
        releaseLock() {}
      };
    }
  }
};
vm.createContext(context);

function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source, { filename: file }).runInContext(context);
}

[
  'Constants.gs',
  'Config.gs',
  'BootstrapConfig.gs',
  'Utils.gs',
  'DataService.gs',
  'BootstrapHelpers.gs',
  'Step03_ReferenceData.gs',
  'EmailService.gs',
  'ValidationService.gs'
].forEach(load);

function run(expression) {
  return vm.runInContext(expression, context);
}

const H = run('H');
const STATUS = run('STATUS');
context.SHEETS = run('SHEETS');

run(`
  getConfig = function() {
    return {
      ADMIN_EMAILS: ['admin@squ.edu.om'],
      OWNER_EMAIL: 'owner@squ.edu.om',
      BRAND: { primaryColor: '#0B4EA2', logoUrl: '' },
      ORGANIZATION_NAME_AR: 'Employee Services',
      ORGANIZATION_NAME_EN: 'Employee Services',
      EVALUATION_FORM_URL: ''
    };
  };
  getActiveUserEmail_ = function() { return 'admin@squ.edu.om'; };
  getOrCreateSheet_ = function() { return testSheet; };
  requireHeaders_ = function() {};
  getRecordFromSheetRow_ = function() { return Object.assign({}, testState.record); };
  findSectionByUnitAndName_ = function() { return testState.section; };
  getHeaderMap_ = function() {
    var map = {};
    map[H.RECORD.FINAL_STATUS] = 8;
    map[H.RECORD.NOTES] = 9;
    return map;
  };
  updateObjectRow_ = function(_sheet, _rowNumber, updates) {
    testState.updates += 1;
    Object.keys(updates).forEach(function(key) { testState.record[key] = updates[key]; });
  };
  refreshDashboard = function() {};
  renderTemplate_ = function(_templateName, data) {
    testState.renderedData = data;
    return '<html>final</html>';
  };
  buildTemplateData_ = function(_record, extra) { return Object.assign({}, extra || {}); };
  logInfo_ = function(action, requestId, message) {
    testState.logs.push({ level: 'INFO', action: action, requestId: requestId, message: message });
  };
  logError_ = function(action, requestId, error) {
    testState.logs.push({ level: 'ERROR', action: action, requestId: requestId, message: error && error.message });
  };
  queueEmail_ = function() { testState.queued += 1; };
  now_ = function() { return new Date('2026-08-04T09:00:00'); };
  testSheet = null;
  testState = null;
`);
context.testSheet = sheet;
context.testState = state;

function makeRecord() {
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'REQ-EMAIL-LIST';
  record[H.RECORD.EMPLOYEE_EMAIL] = 'employee@squ.edu.om';
  record[H.RECORD.DIRECT_MANAGER_EMAIL] = 'manager@squ.edu.om';
  record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL] = 'unit-head@squ.edu.om';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section A';
  record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_ACCEPTED;
  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_PENDING;
  return record;
}

function reset(emailValue) {
  state.section = emailValue === undefined ? null : { headEmail: emailValue };
  state.record = makeRecord();
  state.sent = 0;
  state.queued = 0;
  state.updates = 0;
  state.toasts = [];
  state.logs = [];
  state.throwOnSend = false;
  state.revertedTo = undefined;
  state.renderedData = null;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('single, two, and three valid addresses are parsed and normalized', () => {
  [
    ['head1@squ.edu.om', ['head1@squ.edu.om']],
    ['head1@squ.edu.om, head2@squ.edu.om', ['head1@squ.edu.om', 'head2@squ.edu.om']],
    [' head1@squ.edu.om , head2@squ.edu.om, head3@squ.edu.om ', ['head1@squ.edu.om', 'head2@squ.edu.om', 'head3@squ.edu.om']]
  ].forEach(([value, expected]) => {
    context.emailListValue = value;
    const result = run('validateEmailList_(emailListValue)');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(Array.from(result.emails), expected);
    assert.strictEqual(result.normalized, expected.join(','));
  });
});

test('duplicates are removed case-insensitively while preserving the first value', () => {
  context.emailListValue = 'Head1@squ.edu.om, head1@SQU.EDU.OM,head2@squ.edu.om';
  const result = run('parseEmailList_(emailListValue)');
  assert.strictEqual(result.isValid, true);
  assert.deepStrictEqual(Array.from(result.emails), ['Head1@squ.edu.om', 'head2@squ.edu.om']);
});

test('malformed addresses and empty comma entries fail with exact details', () => {
  const cases = [
    ['head1@squ.edu.om,bad-address', ['bad-address'], false],
    ['', [], false],
    [',head1@squ.edu.om', [], true],
    ['head1@squ.edu.om,', [], true],
    ['head1@squ.edu.om,,head2@squ.edu.om', [], true]
  ];
  cases.forEach(([value, invalidEmails, hasEmptyEntries]) => {
    context.emailListValue = value;
    const result = run('validateEmailList_(emailListValue)');
    assert.strictEqual(result.isValid, false);
    assert.deepStrictEqual(Array.from(result.invalidEmails), invalidEmails);
    assert.strictEqual(result.hasEmptyEntries, hasEmptyEntries);
  });
});

test('synchronization preserves and normalizes every valid address without adding rows', () => {
  const unit = {};
  unit[H.UNIT.UNIT_ID] = 'UNIT-A';
  unit[H.UNIT.UNIT_NAME] = 'Unit A';
  unit[H.UNIT.ACTIVE] = STATUS.YES;
  const section = {};
  section[H.SECTION.SECTION_ID] = 'SECTION-A';
  section[H.SECTION.UNIT_ID] = 'UNIT-A';
  section[H.SECTION.UNIT_NAME] = 'Unit A';
  section[H.SECTION.SECTION_NAME] = 'Section A';
  section[H.SECTION.ACTIVE] = STATUS.YES;
  section[H.SECTION.CAPACITY] = 1;
  section[H.SECTION.HEAD_EMAIL] = ' head1@squ.edu.om, head2@squ.edu.om, HEAD1@squ.edu.om ';
  section[H.SECTION.HEAD_NAME_AR] = 'الدكتورة مريم';
  section[H.SECTION.HEAD_NAME_EN] = 'Dr Maryam';
  section[H.SECTION.HEAD_SALUTATION_AR] = 'المحترمة';
  section[H.SECTION.HEAD_JOB_TITLE_AR] = 'رئيسة القسم';
  section[H.SECTION.HEAD_JOB_TITLE_EN] = 'Head of Section';
  context.referenceUnits = [unit];
  context.referenceSections = [section];
  const normalized = run('normalizeAdminSectionRows_(referenceSections, referenceUnits)');
  assert.strictEqual(normalized.length, 1);
  assert.strictEqual(normalized[0][H.SECTION.HEAD_EMAIL], 'head1@squ.edu.om,head2@squ.edu.om');
  assert.strictEqual(normalized[0][H.SECTION.HEAD_NAME_AR], 'الدكتورة مريم');
  assert.strictEqual(normalized[0][H.SECTION.HEAD_NAME_EN], 'Dr Maryam');
  assert.strictEqual(normalized[0][H.SECTION.HEAD_SALUTATION_AR], 'المحترمة');
  assert.strictEqual(normalized[0][H.SECTION.HEAD_JOB_TITLE_AR], 'رئيسة القسم');
  assert.strictEqual(normalized[0][H.SECTION.HEAD_JOB_TITLE_EN], 'Head of Section');
});

test('section schema appends all five optional section-head letter fields', () => {
  assert.deepStrictEqual(
    Array.from(run('SECTION_HEADERS.slice(-5)')),
    [
      'اسم رئيس القسم بالعربية',
      'اسم رئيس القسم بالإنجليزية',
      'صيغة مخاطبة رئيس القسم',
      'المسمى الوظيفي لرئيس القسم بالعربية',
      'المسمى الوظيفي لرئيس القسم بالإنجليزية'
    ]
  );
  assert.deepStrictEqual(
    Array.from(run('BH.SECTIONS.slice(-5)')),
    Array.from(run('SECTION_HEADERS.slice(-5)'))
  );
});

test('reference validation accepts valid lists and rejects a row containing one invalid address', () => {
  context.validationUnits = [{
    id: 'UNIT-A',
    name: 'Unit A',
    headEmail: 'unit-head@squ.edu.om',
    headName: 'Unit Head',
    active: true
  }];
  context.validationSections = [{
    id: 'SECTION-A',
    unitId: 'UNIT-A',
    unitName: 'Unit A',
    name: 'Section A',
    capacity: 1,
    headEmail: 'head1@squ.edu.om, head2@squ.edu.om',
    active: true
  }];
  run(`
    readUnits_ = function() { return validationUnits; };
    readSections_ = function() { return validationSections; };
  `);
  let issues = run('validateReferenceData_({})');
  assert.strictEqual(issues.filter((issue) => issue.severity === 'ERROR').length, 0);

  context.validationSections[0].headEmail = 'head1@squ.edu.om,bad-address';
  issues = run('validateReferenceData_({})');
  const emailIssues = issues.filter((issue) => issue.message === 'Invalid section head email list.');
  assert.strictEqual(emailIssues.length, 1);
  assert.match(emailIssues[0].value, /bad-address/);
});

test('final-approved To contains all valid section heads and removes duplicates', () => {
  reset('head1@squ.edu.om, manager@squ.edu.om, head2@squ.edu.om');
  context.finalRecord = state.record;
  const payload = run('buildFinalApprovedNotificationPayload_(finalRecord)');
  assert.strictEqual(payload.cc, '');
  assert.match(payload.to, /employee@squ\.edu\.om/);
  assert.match(payload.to, /manager@squ\.edu\.om/);
  assert.match(payload.to, /unit-head@squ\.edu\.om/);
  assert.match(payload.to, /head1@squ\.edu\.om/);
  assert.match(payload.to, /head2@squ\.edu\.om/);
  assert.strictEqual((payload.to.match(/manager@squ\.edu\.om/g) || []).length, 1);
});

test('final-approved letter uses dynamic section-head values', () => {
  reset('head@squ.edu.om');
  state.section = {
    headEmail: 'head@squ.edu.om',
    unitName: 'دائرة الموارد البشرية',
    headNameAr: 'الفاضلة مريم البلوشية',
    headNameEn: 'Ms Maryam Al Balushi',
    headSalutationAr: 'المحترمة',
    headJobTitleAr: 'رئيسة قسم التطوير',
    headJobTitleEn: 'Head of Development Section'
  };
  context.finalRecord = state.record;
  run('buildFinalApprovedNotificationPayload_(finalRecord)');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(state.renderedData.sectionHeadLetter)),
    {
      nameAr: 'الفاضلة مريم البلوشية',
      nameEn: 'Ms Maryam Al Balushi',
      salutationAr: 'المحترمة',
      jobTitleAr: 'رئيسة قسم التطوير',
      jobTitleEn: 'Head of Development Section'
    }
  );
});

test('missing optional section-head values use generic text without blocking email', () => {
  reset('head@squ.edu.om');
  context.finalRecord = state.record;
  const payload = run('buildFinalApprovedNotificationPayload_(finalRecord)');
  assert.match(payload.to, /head@squ\.edu\.om/);
  assert.strictEqual(state.renderedData.sectionHeadLetter.nameAr, 'رئيس القسم');
  assert.strictEqual(state.renderedData.sectionHeadLetter.nameEn, 'Section Head');
  assert.strictEqual(state.renderedData.sectionHeadLetter.salutationAr, 'المحترم/المحترمة');
  assert.strictEqual(state.renderedData.sectionHeadLetter.jobTitleAr, 'رئيس القسم');
  assert.strictEqual(state.renderedData.sectionHeadLetter.jobTitleEn, 'Head of Section');
});

test('the bilingual host letter exists only in the final-approved template', () => {
  const finalTemplate = fs.readFileSync(path.join(root, 'Emails_FinalApproved.html'), 'utf8');
  assert.match(finalTemplate, /انطلاقًا من توجهات جامعة السلطان قابوس/);
  assert.match(finalTemplate, /In line with Sultan Qaboos University's commitment/);
  assert.match(finalTemplate, /data\.sectionHeadLetter\.nameAr/);
  assert.match(finalTemplate, /data\.sectionHeadLetter\.nameEn/);
  assert.doesNotMatch(finalTemplate, /data\.sectionHeadLetter\.unitName/);
  assert.match(
    finalTemplate,
    /font-weight:bold;\"><\?= data\.sectionHeadLetter\.salutationAr \?><\/span>/
  );

  fs.readdirSync(root)
    .filter((file) => /^Emails_.*\.html$/.test(file) && file !== 'Emails_FinalApproved.html')
    .forEach((file) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      assert.doesNotMatch(source, /data\.sectionHeadLetter|انطلاقًا من توجهات جامعة السلطان قابوس/);
    });
});

test('final approval succeeds only after valid recipients are sent', () => {
  reset('head1@squ.edu.om, head2@squ.edu.om, head3@squ.edu.om');
  const result = run("applyFinalStatusChange_(2, STATUS.FINAL_APPROVED, 'admin@squ.edu.om', 'test')");
  assert.strictEqual(result.success, true);
  assert.strictEqual(state.sent, 1);
  assert.strictEqual(state.queued, 0);
  assert.strictEqual(state.updates, 1);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_APPROVED);
});

test('admin dialog can reject while the unit-head decision is still pending', () => {
  reset('head1@squ.edu.om');
  state.record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
  const result = run('confirmFinalStatusChange(2, STATUS.FINAL_REJECTED)');
  assert.strictEqual(result.success, true);
  assert.strictEqual(state.sent, 1);
  assert.strictEqual(state.updates, 1);
  assert.strictEqual(state.record[H.RECORD.HEAD_STATUS], STATUS.HEAD_PENDING);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_REJECTED);
});

test('admin still cannot approve while the unit-head decision is pending', () => {
  reset('head1@squ.edu.om');
  state.record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
  const result = run('confirmFinalStatusChange(2, STATUS.FINAL_APPROVED)');
  assert.strictEqual(result.success, false);
  assert.match(result.message, /Cannot change final approval status/);
  assert.strictEqual(state.sent, 0);
  assert.strictEqual(state.updates, 0);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_PENDING);
});

test('direct sheet edit can reject while the unit-head decision is pending', () => {
  reset('head1@squ.edu.om');
  state.record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
  const range = {
    getSheet() { return sheet; },
    getRow() { return 2; },
    getColumn() { return 8; },
    setValue(value) { state.revertedTo = value; },
    clearContent() { state.revertedTo = null; }
  };
  context.pendingRejectionEditEvent = {
    range,
    value: STATUS.FINAL_REJECTED,
    oldValue: STATUS.FINAL_PENDING,
    user: { getEmail() { return 'admin@squ.edu.om'; } }
  };
  run('handleFinalStatusEdit(pendingRejectionEditEvent)');
  assert.strictEqual(state.revertedTo, undefined);
  assert.strictEqual(state.sent, 1);
  assert.strictEqual(state.updates, 1);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_REJECTED);
});

test('invalid or missing section configuration blocks send, queue, and status update', () => {
  [undefined, '', 'head1@squ.edu.om,bad-address', 'head1@squ.edu.om,'].forEach((emailValue) => {
    reset(emailValue);
    const result = run("applyFinalStatusChange_(2, STATUS.FINAL_APPROVED, 'admin@squ.edu.om', 'test')");
    assert.strictEqual(result.success, false);
    assert.match(result.message, /Final approval could not be completed/);
    assert.strictEqual(state.sent, 0);
    assert.strictEqual(state.queued, 0);
    assert.strictEqual(state.updates, 0);
    assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_PENDING);
    assert.ok(state.logs.some((entry) => entry.action.includes('sectionHeadEmailValidation')));
  });
});

test('direct status edit restores the exact previous value and sends the bilingual toast', () => {
  reset('head1@squ.edu.om,,head2@squ.edu.om');
  const range = {
    getSheet() { return sheet; },
    getRow() { return 2; },
    getColumn() { return 8; },
    setValue(value) { state.revertedTo = value; },
    clearContent() { state.revertedTo = null; }
  };
  context.directEditEvent = {
    range,
    value: STATUS.FINAL_APPROVED,
    oldValue: STATUS.FINAL_PENDING,
    user: { getEmail() { return 'admin@squ.edu.om'; } }
  };
  run('handleFinalStatusEdit(directEditEvent)');
  assert.strictEqual(state.revertedTo, STATUS.FINAL_PENDING);
  assert.strictEqual(state.updates, 0);
  assert.strictEqual(state.sent, 0);
  assert.strictEqual(state.queued, 0);
  assert.strictEqual(state.toasts.length, 1);
  assert.match(state.toasts[0], /Final approval could not be completed/);
  assert.match(state.toasts[0], /تعذر الاعتماد النهائي/);
});

test('confirmation dialog returns failure and leaves stored status unchanged', () => {
  reset('bad-address');
  const result = run('confirmFinalStatusChange(2, STATUS.FINAL_APPROVED)');
  assert.strictEqual(result.success, false);
  assert.match(result.message, /Invalid addresses: bad-address/);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_PENDING);
  assert.strictEqual(state.updates, 0);
  assert.strictEqual(state.sent, 0);
  assert.strictEqual(state.queued, 0);
});

test('genuine MailApp failures still use the existing retry queue without changing status', () => {
  reset('head1@squ.edu.om,head2@squ.edu.om');
  state.throwOnSend = true;
  const result = run("applyFinalStatusChange_(2, STATUS.FINAL_APPROVED, 'admin@squ.edu.om', 'test')");
  assert.strictEqual(result.success, false);
  assert.strictEqual(state.sent, 1);
  assert.strictEqual(state.queued, 1);
  assert.strictEqual(state.updates, 0);
  assert.strictEqual(state.record[H.RECORD.FINAL_STATUS], STATUS.FINAL_PENDING);
});

test('initial unit-head approval recipient remains unchanged', () => {
  const source = fs.readFileSync(path.join(root, 'EmailService.gs'), 'utf8');
  const start = source.indexOf('function sendApprovalEmail');
  const end = source.indexOf('function groupApprovalRecordsByRecipient_', start);
  const approvalSource = source.slice(start, end);
  assert.match(approvalSource, /record\[H\.RECORD\.APPROVER_EMAIL\]/);
  assert.doesNotMatch(approvalSource, /getRotationSectionHeadEmail/);
});

let passed = 0;
for (const current of tests) {
  try {
    current.fn();
    passed += 1;
    console.log(`PASS ${current.name}`);
  } catch (error) {
    console.error(`FAIL ${current.name}`);
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}
console.log(`${passed}/${tests.length} section-head email tests passed.`);
