const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
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
    getUuid() {
      return crypto.randomUUID();
    }
  },
  FormApp: {
    ItemType: {
      TEXT: 'TEXT',
      DATE: 'DATE',
      LIST: 'LIST',
      PAGE_BREAK: 'PAGE_BREAK',
      MULTIPLE_CHOICE: 'MULTIPLE_CHOICE'
    },
    PageNavigationType: { SUBMIT: 'SUBMIT', CONTINUE: 'CONTINUE' }
  }
};
vm.createContext(context);

function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  new vm.Script(source, { filename: file }).runInContext(context);
}

[
  'Constants.gs',
  'Utils.gs',
  'RotationMetricsService.gs',
  'RequestService.gs',
  'ConflictService.gs',
  'MultiRotationFormService.gs',
  'EvaluationPrefillService.gs'
].forEach(load);

function run(expression) {
  return vm.runInContext(expression, context);
}

const H = run('H');
const FORM = run('FORM');
const STATUS = run('STATUS');
const EVALUATION_FIELDS = run('EVALUATION_FIELDS');

const sections = [
  { unitName: 'Unit A', name: 'Section 1', capacity: 1 },
  { unitName: 'Unit A', name: 'Section 2', capacity: 1 },
  { unitName: 'Unit B', name: 'Section 3', capacity: 1 }
];
context.testSections = sections;
run('getSections_ = function() { return testSections; };');
run('optionTitle_ = function(template, optionNumber) { return String(template || "").replace("{n}", String(optionNumber)); };');

function option(order, unit, section, start, end, hours) {
  return {
    rotationType: 'rotation',
    optionOrder: order,
    rotationUnit: unit,
    section,
    fromDate: new Date(start),
    toDate: new Date(end),
    hours
  };
}

function validOptions(count = 3) {
  return [
    option(1, 'Unit A', 'Section 1', '2026-07-05T00:00:00', '2026-07-07T00:00:00', 2),
    option(2, 'Unit A', 'Section 2', '2026-07-12T00:00:00', '2026-07-14T00:00:00', 5),
    option(3, 'Unit B', 'Section 3', '2026-07-19T00:00:00', '2026-07-21T00:00:00', 7)
  ].slice(0, count);
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('three-page footprint stays below configured Forms limits', () => {
  context.footprintUnits = Array.from({ length: 68 }, (_, index) => ({ name: `Unit ${index + 1}` }));
  context.footprintSections = Array.from({ length: 510 }, (_, index) => ({
    unitName: `Unit ${(index % 68) + 1}`,
    name: `Section ${index + 1}`
  }));
  const footprint = run('calculateMultiRotationFormFootprint_(footprintUnits, footprintSections)');
  assert.strictEqual(footprint.selectionCount, 3);
  assert.strictEqual(footprint.dropdownChoices, 1530);
  assert.strictEqual(footprint.totalChoices, 1602);
  assert.strictEqual(footprint.sections, 4);
  assert.strictEqual(footprint.contentItems, 30);
  assert.strictEqual(footprint.formItems, 33);
  run('assertMultiRotationFormFootprint_(calculateMultiRotationFormFootprint_(footprintUnits, footprintSections))');
});

test('form navigation is limited to selections 1 through 3', () => {
  assert.strictEqual(FORM.MAX_ROTATION_OPTIONS, 3);
  assert.strictEqual(FORM.TITLES.ROTATION_ADD_MORE_YES, 'نعم / Yes');
  assert.match(FORM.TITLES.ROTATION_ADD_MORE_NO, /No, finish the request/);
  const source = fs.readFileSync(path.join(root, 'MultiRotationFormService.gs'), 'utf8');
  assert.match(source, /selectionNumber < \(FORM\.MAX_ROTATION_OPTIONS \|\| 3\)/);
  assert.match(source, /pages\[pages\.length - 1\]\.setGoToPage\(FormApp\.PageNavigationType\.SUBMIT\)/);
});

test('request-group IDs remain distinct for rows in the same response spreadsheet', () => {
  context.groupSourceA = 'same-spreadsheet-id:same-sheet-id:42';
  context.groupSourceB = 'same-spreadsheet-id:same-sheet-id:43';
  assert.notStrictEqual(run('makeRequestGroupId_(groupSourceA)'), run('makeRequestGroupId_(groupSourceB)'));
});

test('hours below 2 and above 7 are rejected; 2 and 7 are accepted', () => {
  assert.throws(() => run('validateDailyHours_(1.99)'), /between 2 and 7/);
  assert.strictEqual(run('validateDailyHours_(2)'), 2);
  assert.strictEqual(run('validateDailyHours_(7)'), 7);
  assert.throws(() => run('validateDailyHours_(7.01)'), /between 2 and 7/);
});

test('working-day rules exclude Friday and Saturday', () => {
  context.start = new Date('2026-07-03T00:00:00'); // Friday
  context.end = new Date('2026-07-07T00:00:00'); // Tuesday
  assert.strictEqual(run('calculateWorkingDays_(start, end)'), 3);
  context.twoDayEnd = new Date('2026-07-06T00:00:00');
  assert.throws(() => run('calculateRotationMetrics_(start, twoDayEnd, 2)'), /at least three working days/);
  const metrics = run('calculateRotationMetrics_(start, end, 7)');
  assert.strictEqual(metrics.workingDays, 3);
  assert.strictEqual(metrics.totalHours, 21);
});

test('one, two, and three selections validate and calculate aggregate hours', () => {
  [1, 2, 3].forEach((count) => {
    context.validationOptions = validOptions(count);
    run('validateUnifiedRotationOptions_({}, validationOptions)');
    const expected = [6, 21, 42][count - 1];
    assert.strictEqual(context.validationOptions.reduce((sum, item) => sum + item.totalHours, 0), expected);
  });
});

test('duplicate sections and overlapping selections are rejected', () => {
  context.duplicateOptions = validOptions(2);
  context.duplicateOptions[1].rotationUnit = 'Unit A';
  context.duplicateOptions[1].section = 'Section 1';
  assert.throws(() => run('validateUnifiedRotationOptions_({}, duplicateOptions)'), /Duplicate section selections/);

  context.overlapOptions = validOptions(2);
  context.overlapOptions[1].fromDate = new Date('2026-07-07T00:00:00');
  context.overlapOptions[1].toDate = new Date('2026-07-09T00:00:00');
  assert.throws(() => run('validateUnifiedRotationOptions_({}, overlapOptions)'), /cannot overlap/);
});

test('empty and unvisited selections create no parsed options', () => {
  context.accessorValues = {};
  run('testAccessor = function(titles) { for (var i = 0; i < titles.length; i++) if (accessorValues[titles[i]]) return accessorValues[titles[i]]; return ""; };');
  assert.strictEqual(run('parseUnifiedRotationOptions_(testAccessor, "").length'), 0);
  context.accessorValues[FORM.TITLES.ROTATION_SECTION_PREFIX.replace('{n}', '1')] = 'Unit A — Section 1';
  context.accessorValues[FORM.TITLES.ROTATION_FROM_PREFIX.replace('{n}', '1')] = '05/07/2026';
  context.accessorValues[FORM.TITLES.ROTATION_TO_PREFIX.replace('{n}', '1')] = '07/07/2026';
  context.accessorValues[FORM.TITLES.ROTATION_HOURS_PREFIX.replace('{n}', '1')] = '2';
  assert.strictEqual(run('parseUnifiedRotationOptions_(testAccessor, "").length'), 1);
});

test('partial retry resumes without duplicate selection records', () => {
  run(`
    mockIndexes = {};
    mockRecordsById = {};
    mockCreatedKeys = [];
    setupSheets = function() {};
    getConflictCandidateRecordsForSubmission_ = function() { return []; };
    refreshDashboardForRecords_ = function() {};
    findIndexedRequestBySelectionKey_ = function(key) { return mockIndexes[key] || null; };
    getRequestById_ = function(id) { return mockRecordsById[id] || null; };
    createRequestRecordForRotationOption_ = function(data, rotationOption, creationOptions) {
      var id = 'REQ-' + rotationOption.optionOrder;
      var record = {};
      record[H.RECORD.REQUEST_ID] = id;
      record[H.RECORD.REQUEST_GROUP_ID] = creationOptions.requestGroupId;
      record[H.RECORD.OPTION_ORDER] = rotationOption.optionOrder;
      record[H.RECORD.SELECTION_KEY] = creationOptions.selectionKey;
      record[H.RECORD.TOTAL_HOURS] = rotationOption.totalHours;
      record[H.RECORD.ROTATION_UNIT] = rotationOption.rotationUnit;
      record[H.RECORD.SECTION] = rotationOption.section;
      mockCreatedKeys.push(creationOptions.selectionKey);
      mockRecordsById[id] = record;
      var indexed = {};
      indexed[H.REQUEST_SOURCE_INDEX.REQUEST_ID] = id;
      indexed[H.REQUEST_SOURCE_INDEX.REQUEST_GROUP_ID] = creationOptions.requestGroupId;
      indexed[H.REQUEST_SOURCE_INDEX.SELECTION_KEY] = creationOptions.selectionKey;
      indexed[H.REQUEST_SOURCE_INDEX.SELECTION_NUMBER] = rotationOption.optionOrder;
      mockIndexes[creationOptions.selectionKey] = indexed;
      return record;
    };
  `);
  context.parentData = {
    directManagerName: 'Manager',
    directManagerId: '100',
    directManagerEmail: 'manager@example.com',
    directManagerExtension: '1234',
    employeeName: 'Employee',
    employeeId: '200',
    employeeHireDate: new Date('2026-01-01T00:00:00'),
    employeeJobTitle: 'Analyst',
    employeeEmail: 'employee@example.com',
    currentUnit: 'Unit A',
    currentDepartment: 'Home',
    responseSourceId: 'stable-parent',
    rotationOptions: validOptions(3)
  };
  [1, 2, 3].forEach((count) => {
    run('mockIndexes = {}; mockRecordsById = {}; mockCreatedKeys = [];');
    context.parentData.responseSourceId = `stable-parent-${count}`;
    context.parentData.rotationOptions = validOptions(count);
    run(`createRequestFromNormalizedData_(parentData, { responseSourceId: parentData.responseSourceId }, { deferRefresh: true })`);
    assert.strictEqual(context.mockCreatedKeys.length, count);
  });
  run('mockIndexes = {}; mockRecordsById = {}; mockCreatedKeys = [];');
  context.parentData.responseId = 'sheet-id:sheet-tab-id:42';
  context.parentData.responseSourceId = 'content-fingerprint';
  context.parentData.rotationOptions = validOptions(1);
  run(`createRequestFromNormalizedData_(parentData, { responseId: parentData.responseId, responseSourceId: parentData.responseSourceId }, { deferRefresh: true })`);
  assert.strictEqual(context.mockCreatedKeys[0], 'sheet-id:sheet-tab-id:42:1');
  run('mockIndexes = {}; mockRecordsById = {}; mockCreatedKeys = [];');
  delete context.parentData.responseId;
  context.parentData.responseSourceId = 'stable-parent';
  context.parentData.rotationOptions = validOptions(3);
  assert.throws(() => run(`
    createRequestFromNormalizedData_(parentData, { responseSourceId: 'stable-parent' }, {
      deferRefresh: true,
      onSelectionProcessed: function(number) {
        if (number === 1) {
          var error = new Error('simulated timeout');
          error.code = 'PARTIAL_PARENT_RETRY';
          throw error;
        }
      }
    })
  `), /simulated timeout/);
  run(`createRequestFromNormalizedData_(parentData, { responseSourceId: 'stable-parent' }, { deferRefresh: true, startSelectionNumber: 2 })`);
  assert.deepStrictEqual(Array.from(context.mockCreatedKeys), ['stable-parent:1', 'stable-parent:2', 'stable-parent:3']);
  run(`createRequestFromNormalizedData_(parentData, { responseSourceId: 'stable-parent' }, { deferRefresh: true })`);
  assert.strictEqual(context.mockCreatedKeys.length, 3);
});

test('existing conflict detection still blocks an overlapping accepted record', () => {
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'EXISTING';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section 1';
  record[H.RECORD.START_DATE] = new Date('2026-07-05T00:00:00');
  record[H.RECORD.END_DATE] = new Date('2026-07-07T00:00:00');
  record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_ACCEPTED;
  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_APPROVED;
  context.conflictRecords = [record];
  run('findSectionByUnitAndName_ = function() { return { capacity: 1 }; };');
  assert.strictEqual(
    run(`findConflicts({ rotationUnit: 'Unit A', section: 'Section 1', startDate: new Date('2026-07-07'), endDate: new Date('2026-07-09') }, conflictRecords)[H.RECORD.REQUEST_ID]`),
    'EXISTING'
  );
});

test('evaluation URL prefills the actual section and matching record fields', () => {
  context.prefillAnswers = {};
  context.prefillItems = Object.values(EVALUATION_FIELDS).map((title) => ({
    getTitle() { return title; },
    asTextItem() {
      return {
        createResponse(value) {
          return { title, value };
        }
      };
    }
  }));
  context.FormApp.openById = () => ({
    getItems() { return context.prefillItems; },
    createResponse() {
      return {
        withItemResponse(itemResponse) {
          context.prefillAnswers[itemResponse.title] = itemResponse.value;
          return this;
        },
        toPrefilledUrl() {
          return 'https://docs.google.com/forms/prefilled';
        }
      };
    }
  });
  run('getConfig = function() { return { EVALUATION_FORM_ID: "evaluation-id", EVALUATION_FORM_URL: "fallback" }; }; logError_ = function() {};');
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'REQ-1';
  record[H.RECORD.EMPLOYEE_NAME] = 'Employee';
  record[H.RECORD.EMPLOYEE_JOB_TITLE] = 'Analyst';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section 1';
  record[H.RECORD.START_DATE] = new Date('2026-07-05T00:00:00');
  record[H.RECORD.END_DATE] = new Date('2026-07-07T00:00:00');
  record[H.RECORD.WORKING_DAYS] = 3;
  context.evaluationRecord = record;
  assert.match(run('buildEvaluationPrefilledUrl_(evaluationRecord)'), /prefilled/);
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.ROTATION_SECTION], 'Unit A — Section 1');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.REQUEST_ID], 'REQ-1');
});

test('dates render DD/MM/YYYY and sender/final recipients remain forced', () => {
  context.outputDate = new Date('2026-04-20T00:00:00');
  assert.strictEqual(run('formatDate_(outputDate)'), '20/04/2026');
  const emailSource = fs.readFileSync(path.join(root, 'EmailService.gs'), 'utf8');
  const constantsSource = fs.readFileSync(path.join(root, 'Constants.gs'), 'utf8');
  assert.match(constantsSource, /قسم خدمات الموظفين والمتقاعدين \| Employee Services/);
  assert.match(emailSource, /record\[H\.RECORD\.EMPLOYEE_EMAIL\][\s\S]*record\[H\.RECORD\.DIRECT_MANAGER_EMAIL\][\s\S]*record\[H\.RECORD\.CURRENT_UNIT_HEAD_EMAIL\]/);
  assert.match(emailSource, /EMAIL_SENDER_DISPLAY_NAME/);
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
console.log(`${passed}/${tests.length} focused tests passed.`);
