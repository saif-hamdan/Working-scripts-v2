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
  'Config.gs',
  'Utils.gs',
  'RotationMetricsService.gs',
  'RequestService.gs',
  'DataService.gs',
  'ConflictService.gs',
  'FormService.gs',
  'MultiRotationFormService.gs',
  'EvaluationPrefillService.gs',
  'TrainingHoursService.gs',
  'TemplateService.gs',
  'EmailService.gs',
  'EvaluationService.gs',
  'ApprovalWebApp.gs',
  'ApprovalActionQueueService.gs'
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
run('optionTitle_ = function(template, optionNumber) { return String(template || "").split("{n}").join(String(optionNumber)); };');

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

test('requested form wording and repeated labels are exact', () => {
  assert.strictEqual(
    FORM.TITLES.FORM_TITLE,
    'استمارة تحديد مسار التدوير المعرفي للموظفين الجدد / New Employee Knowledge Rotation Path Form'
  );
  assert.match(FORM.TITLES.FORM_DESCRIPTION, /هذه الاستمارة/);
  assert.match(FORM.TITLES.FORM_DESCRIPTION, /knowledge rotation pathway/);
  assert.strictEqual(
    FORM.TITLES.EMPLOYEE_NAME,
    'اسم الموظف الثلاثي / Full Employee Name'
  );
  assert.strictEqual(
    run('optionTitle_(FORM.TITLES.ROTATION_SECTION_PREFIX, 1)'),
    'اختيار التدوير 1: القسم / Rotation Selection 1: Section'
  );
  assert.strictEqual(FORM.TITLES.ROTATION_FROM_PREFIX, 'من تاريخ | From');
  assert.strictEqual(FORM.TITLES.ROTATION_TO_PREFIX, 'إلى تاريخ | To');
  assert.strictEqual(FORM.TITLES.ROTATION_HOURS_PREFIX, 'الساعات اليومية | Daily Hours');

  const multiRotationSource = fs.readFileSync(path.join(root, 'MultiRotationFormService.gs'), 'utf8');
  assert.doesNotMatch(
    multiRotationSource,
    /اختر القسم وحدد الفترة والساعات اليومية\. \/ Select the section, dates, and required daily hours\./
  );
  assert.match(multiRotationSource, /occurrenceIndex = selectionNumber - 1/);
  assert.match(multiRotationSource, /getMultiRotationItemOccurrence_/);
  assert.match(multiRotationSource, /hours\.setHelpText\('من ساعتين إلى سبع ساعات يومياً\./);

  const evaluationSource = fs.readFileSync(path.join(root, 'Step07_EvaluationForm.gs'), 'utf8');
  assert.match(evaluationSource, /تقييم تجربة التدوير المعرفي/);
  assert.match(evaluationSource, /New Employee Knowledge Rotation Experience Evaluation Form/);
});

test('newly created repeated date and hours items do not require a second cast', () => {
  context.newTypedDateItem = {
    title: '',
    required: false,
    setTitle(value) { this.title = value; return this; },
    setRequired(value) { this.required = value; return this; }
  };
  context.newTypedTextItem = {
    title: '',
    required: false,
    setTitle(value) { this.title = value; return this; },
    setRequired(value) { this.required = value; return this; }
  };
  context.emptyRepeatedItemForm = {
    getItems() { return []; },
    addDateItem() { return context.newTypedDateItem; },
    addTextItem() { return context.newTypedTextItem; }
  };

  assert.doesNotThrow(() => run(`
    createdRepeatedDateItem = ensureMultiRotationDateOccurrence_(
      emptyRepeatedItemForm,
      FORM.TITLES.ROTATION_FROM_PREFIX,
      0,
      true
    );
    createdRepeatedTextItem = ensureMultiRotationTextOccurrence_(
      emptyRepeatedItemForm,
      FORM.TITLES.ROTATION_HOURS_PREFIX,
      0,
      true
    );
  `));
  assert.strictEqual(context.createdRepeatedDateItem.required, true);
  assert.strictEqual(context.createdRepeatedTextItem.required, true);
});

test('current-unit choices are restored after clean branching reset', () => {
  const source = fs.readFileSync(path.join(root, 'MultiRotationFormService.gs'), 'utf8');
  const initializeStart = source.indexOf('function initializeMultiRotationFormBuild_');
  const initializeEnd = source.indexOf('function setMultiRotationCurrentUnitChoices_', initializeStart);
  const initializeSource = source.slice(initializeStart, initializeEnd);
  assert.ok(
    initializeSource.indexOf('removeExistingBranchItems_(form)') <
      initializeSource.indexOf('setMultiRotationCurrentUnitChoices_(form, units)'),
    'Current-unit choices must be restored after cleanup replaces navigation choices.'
  );
  assert.match(
    source,
    /function continueMultiRotationFormBuild_[\s\S]*setMultiRotationCurrentUnitChoices_\(form, units\)/
  );
  assert.match(source, /Current Employee Unit still contains the temporary reset choice/);
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

test('employee-ID completed hours count only approved rotations whose end date has passed', () => {
  function hoursRecord(requestId, employeeId, totalHours, headStatus, finalStatus, endDate) {
    const record = {};
    record[H.RECORD.REQUEST_ID] = requestId;
    record[H.RECORD.EMPLOYEE_NAME] = 'Employee';
    record[H.RECORD.EMPLOYEE_ID] = employeeId;
    record[H.RECORD.HOURS] = 2;
    record[H.RECORD.WORKING_DAYS] = 3;
    record[H.RECORD.TOTAL_HOURS] = totalHours;
    record[H.RECORD.HEAD_STATUS] = headStatus;
    record[H.RECORD.FINAL_STATUS] = finalStatus;
    record[H.RECORD.END_DATE] = new Date(endDate);
    return record;
  }

  const previousCompleted = hoursRecord(
    'PREVIOUS', '200', 6, STATUS.HEAD_ACCEPTED, STATUS.FINAL_DONE, '2026-07-01T00:00:00'
  );
  const currentCompleted = hoursRecord(
    'CURRENT', '200', 21, STATUS.HEAD_ACCEPTED, STATUS.FINAL_DONE, '2026-07-20T00:00:00'
  );
  const approvedAndEnded = hoursRecord(
    'APPROVED-ENDED', '200', 9, STATUS.HEAD_ACCEPTED, STATUS.FINAL_APPROVED, '2026-07-27T00:00:00'
  );
  const ongoing = hoursRecord(
    'ONGOING', '200', 42, STATUS.HEAD_ACCEPTED, STATUS.FINAL_APPROVED, '2026-08-10T00:00:00'
  );
  const unapprovedAndEnded = hoursRecord(
    'UNAPPROVED', '200', 100, STATUS.HEAD_PENDING, STATUS.FINAL_PENDING, '2026-07-10T00:00:00'
  );
  const headOnlyApprovedAndEnded = hoursRecord(
    'HEAD-ONLY', '200', 200, STATUS.HEAD_ACCEPTED, STATUS.FINAL_PENDING, '2026-07-10T00:00:00'
  );
  context.hoursReferenceDate = new Date('2026-07-28T09:00:00');
  context.employeeHourRecords = [
    previousCompleted,
    currentCompleted,
    approvedAndEnded,
    ongoing,
    unapprovedAndEnded,
    headOnlyApprovedAndEnded
  ];
  const summary = run('calculateEmployeeRotationHoursSummary_(employeeHourRecords, hoursReferenceDate)[0]');
  assert.strictEqual(summary[H.EMPLOYEE_ROTATION_HOURS.COMPLETED_HOURS], 36);
  assert.strictEqual(summary[H.EMPLOYEE_ROTATION_HOURS.ONGOING_HOURS], 42);
  assert.strictEqual(summary[H.EMPLOYEE_ROTATION_HOURS.TOTAL_HOURS], 78);

  context.employeeLookupCount = 0;
  run(`
    EMPLOYEE_ROTATION_HOURS_LOOKUP_CACHE_ = {};
    now_ = function() { return hoursReferenceDate; };
    getSheet_ = function() { return {}; };
    findObjectsByValue_ = function() {
      employeeLookupCount++;
      return employeeHourRecords;
    };
    getConfig = function() {
      return {
        BRAND: 'SQU',
        ORGANIZATION_NAME_AR: 'SQU',
        ORGANIZATION_NAME_EN: 'SQU',
        EVALUATION_FORM_URL: ''
      };
    };
  `);
  context.currentCompletedRecord = currentCompleted;
  assert.strictEqual(run('getEmployeeTotalCompletedHours_(currentCompletedRecord)'), 36);
  assert.strictEqual(run('getEmployeePreviousCompletedHours_(currentCompletedRecord)'), 36);

  const pending = hoursRecord(
    'PENDING', '200', 10, STATUS.HEAD_PENDING, STATUS.FINAL_PENDING, '2026-07-15T00:00:00'
  );
  context.pendingHoursRecord = pending;
  assert.strictEqual(run('getEmployeeTotalCompletedHours_(pendingHoursRecord)'), 36);
  assert.strictEqual(context.employeeLookupCount, 1);

  run('emailHoursData = buildTemplateData_(pendingHoursRecord, {});');
  const historyRow = context.emailHoursData.rows.find(
    (row) => row.en === 'Total Completed Rotation Hours'
  );
  assert.ok(historyRow);
  assert.strictEqual(historyRow.ar, 'إجمالي ساعات التدوير المنجزة');
  assert.strictEqual(historyRow.value, 36);
  assert.ok(context.emailHoursData.rows.some(
    (row) => row.ar === 'اسم الموظف' && row.en === 'Employee Name'
  ));
  assert.ok(context.emailHoursData.rows.some(
    (row) => row.ar === 'عدد ساعات التدوير اليومية المطلوبة' &&
      row.en === 'Required Daily Rotation Hours'
  ));
  assert.ok(context.emailHoursData.rows.some(
    (row) => row.ar === 'إجمالي ساعات التدوير' && row.en === 'Total Rotation Hours'
  ));
  assert.ok(context.emailHoursData.rows.some(
    (row) => row.ar === 'إجمالي ساعات التدوير المطلوبة' &&
      row.en === 'Total Requested Rotation Hours'
  ));
  assert.ok(context.emailHoursData.rows.every(
    (row) => !String(row.en).includes('(Employee ID)')
  ));
  assert.strictEqual(context.employeeLookupCount, 1);
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
  assert.throws(
    () => run('validateUnifiedRotationOptions_({}, overlapOptions)'),
    (error) => {
      assert.match(error.message, /cannot overlap/);
      assert.strictEqual(error.code, 'SUBMISSION_VALIDATION');
      assert.strictEqual(error.validationType, 'ROTATION_DATE_OVERLAP');
      assert.strictEqual(error.recipientPolicy, 'EMPLOYEE_CORRECTION');
      assert.strictEqual(error.conflict.firstSection, 'Section 1');
      assert.strictEqual(error.conflict.secondSection, 'Section 2');
      assert.strictEqual(
        context.Utilities.formatDate(error.conflict.overlapStartDate, 'Asia/Muscat', 'dd/MM/yyyy'),
        '07/07/2026'
      );
      assert.strictEqual(
        context.Utilities.formatDate(error.conflict.overlapEndDate, 'Asia/Muscat', 'dd/MM/yyyy'),
        '07/07/2026'
      );
      return true;
    }
  );
});

test('empty and unvisited selections create no parsed options', () => {
  context.accessorValues = {};
  run(`
    testAccessor = function(titles, occurrenceIndex) {
      for (var i = 0; i < titles.length; i++) {
        var value = accessorValues[titles[i]];
        if (Array.isArray(value)) {
          if (typeof occurrenceIndex === 'number') {
            if (value[occurrenceIndex]) return value[occurrenceIndex];
          } else {
            for (var valueIndex = 0; valueIndex < value.length; valueIndex++) {
              if (value[valueIndex]) return value[valueIndex];
            }
          }
        } else if (value) {
          return value;
        }
      }
      return "";
    };
  `);
  assert.strictEqual(run('parseUnifiedRotationOptions_(testAccessor, "").length'), 0);
  context.accessorValues[FORM.TITLES.ROTATION_SECTION_PREFIX.split('{n}').join('1')] = 'Unit A — Section 1';
  context.accessorValues[FORM.TITLES.ROTATION_FROM_PREFIX] = ['05/07/2026'];
  context.accessorValues[FORM.TITLES.ROTATION_TO_PREFIX] = ['07/07/2026'];
  context.accessorValues[FORM.TITLES.ROTATION_HOURS_PREFIX] = ['2'];
  assert.strictEqual(run('parseUnifiedRotationOptions_(testAccessor, "").length'), 1);
});

test('identical From, To, and Daily Hours labels remain selection-safe', () => {
  context.accessorValues = {};
  for (let selectionNumber = 1; selectionNumber <= 3; selectionNumber += 1) {
    context.accessorValues[
      FORM.TITLES.ROTATION_SECTION_PREFIX.split('{n}').join(String(selectionNumber))
    ] = `Unit ${selectionNumber} — Section ${selectionNumber}`;
  }
  context.accessorValues[FORM.TITLES.ROTATION_FROM_PREFIX] = [
    '05/07/2026',
    '12/07/2026',
    '19/07/2026'
  ];
  context.accessorValues[FORM.TITLES.ROTATION_TO_PREFIX] = [
    '07/07/2026',
    '14/07/2026',
    '21/07/2026'
  ];
  context.accessorValues[FORM.TITLES.ROTATION_HOURS_PREFIX] = ['2', '5', '7'];
  run('parsedRepeatedOptions = parseUnifiedRotationOptions_(testAccessor, "");');
  assert.strictEqual(context.parsedRepeatedOptions.length, 3);
  assert.deepStrictEqual(
    Array.from(context.parsedRepeatedOptions, (item) => item.optionOrder),
    [1, 2, 3]
  );
  assert.deepStrictEqual(
    Array.from(context.parsedRepeatedOptions, (item) => item.hours),
    ['2', '5', '7']
  );
  assert.deepStrictEqual(
    Array.from(context.parsedRepeatedOptions, (item) => item.section),
    ['Section 1', 'Section 2', 'Section 3']
  );
});

test('queued responses with the previous partial placeholder titles remain readable', () => {
  context.accessorValues = {
    'اختيار التدوير 1: القسم / Rotation Selection {n}: Section': 'Unit A — Section 1',
    'اختيار التدوير 1: من تاريخ / Rotation Selection {n}: From': '05/07/2026',
    'اختيار التدوير 1: إلى تاريخ / Rotation Selection {n}: To': '07/07/2026',
    'اختيار التدوير 1: الساعات اليومية / Rotation Selection {n}: Daily Hours': '2'
  };
  run('legacyPlaceholderOptions = parseUnifiedRotationOptions_(testAccessor, "");');
  assert.strictEqual(context.legacyPlaceholderOptions.length, 1);
  assert.strictEqual(context.legacyPlaceholderOptions[0].optionOrder, 1);
  assert.strictEqual(context.legacyPlaceholderOptions[0].section, 'Section 1');
  assert.strictEqual(context.legacyPlaceholderOptions[0].hours, '2');
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

test('conflicts allow multiple employees in one section but block one employee across overlapping sections', () => {
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'EXISTING';
  record[H.RECORD.EMPLOYEE_ID] = '200';
  record[H.RECORD.EMPLOYEE_NAME] = 'Employee One';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section 1';
  record[H.RECORD.START_DATE] = new Date('2026-07-05T00:00:00');
  record[H.RECORD.END_DATE] = new Date('2026-07-07T00:00:00');
  record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_ACCEPTED;
  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_APPROVED;
  context.conflictRecords = [record];
  assert.strictEqual(
    run(`findConflicts({
      employeeId: '200',
      employeeName: 'Employee One',
      rotationUnit: 'Unit A',
      section: 'Section 2',
      startDate: new Date('2026-07-07'),
      endDate: new Date('2026-07-09')
    }, conflictRecords)[H.RECORD.REQUEST_ID]`),
    'EXISTING'
  );
  assert.strictEqual(
    run(`findConflicts({
      employeeId: '201',
      employeeName: 'Employee Two',
      rotationUnit: 'Unit A',
      section: 'Section 1',
      startDate: new Date('2026-07-07'),
      endDate: new Date('2026-07-09')
    }, conflictRecords)`),
    null
  );

  record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_PENDING;
  assert.strictEqual(
    run(`findConflicts({
      employeeId: '200',
      startDate: new Date('2026-07-07'),
      endDate: new Date('2026-07-09')
    }, conflictRecords)[H.RECORD.REQUEST_ID]`),
    'EXISTING'
  );
});

test('evaluation URL prefills every employee and individual-rotation detail with one cached form read', () => {
  context.prefillAnswers = {};
  context.prefillFormOpenCount = 0;
  context.prefillItemReadCount = 0;
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
  context.FormApp.openById = () => {
    context.prefillFormOpenCount += 1;
    return {
      getItems() {
        context.prefillItemReadCount += 1;
        return context.prefillItems;
      },
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
    };
  };
  run('EVALUATION_PREFILL_FORM_CACHE_ = null; getConfig = function() { return { EVALUATION_FORM_ID: "evaluation-id", EVALUATION_FORM_URL: "fallback" }; }; logError_ = function() {};');
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'REQ-1';
  record[H.RECORD.REQUEST_GROUP_ID] = 'GROUP-1';
  record[H.RECORD.OPTION_ORDER] = 2;
  record[H.RECORD.EMPLOYEE_NAME] = 'Employee';
  record[H.RECORD.EMPLOYEE_ID] = '200';
  record[H.RECORD.EMPLOYEE_JOB_TITLE] = 'Analyst';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section 1';
  record[H.RECORD.START_DATE] = new Date('2026-07-05T00:00:00');
  record[H.RECORD.END_DATE] = new Date('2026-07-07T00:00:00');
  record[H.RECORD.HOURS] = 7;
  record[H.RECORD.WORKING_DAYS] = 3;
  record[H.RECORD.TOTAL_HOURS] = 21;
  context.evaluationRecord = record;
  assert.match(run('buildEvaluationPrefilledUrl_(evaluationRecord)'), /prefilled/);
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.REQUEST_ID], 'REQ-1');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.REQUEST_GROUP_ID], 'GROUP-1');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.SELECTION_NUMBER], '2');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.EMPLOYEE_NAME], 'Employee');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.EMPLOYEE_ID], '200');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.JOB_TITLE], 'Analyst');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.ROTATION_UNIT], 'Unit A');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.ROTATION_SECTION], 'Section 1');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.START_DATE], '05/07/2026');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.END_DATE], '07/07/2026');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.DAILY_HOURS], '7');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.WORKING_DAYS], '3');
  assert.strictEqual(context.prefillAnswers[EVALUATION_FIELDS.TOTAL_HOURS], '21');
  assert.match(context.prefillAnswers[EVALUATION_FIELDS.PARTICIPATION_DURATION], /05\/07\/2026.*07\/07\/2026.*3 working days/);

  assert.match(run('buildEvaluationPrefilledUrl_(evaluationRecord)'), /prefilled/);
  assert.strictEqual(context.prefillFormOpenCount, 1);
  assert.strictEqual(context.prefillItemReadCount, 1);

  const evaluationFormSource = fs.readFileSync(path.join(root, 'Step07_EvaluationForm.gs'), 'utf8');
  Object.keys(EVALUATION_FIELDS).forEach((key) => {
    assert.ok(evaluationFormSource.includes(`EVALUATION_FIELDS.${key}`), `Step 07 is missing ${key}`);
  });
});

test('three rotations receive separate evaluations on the day after each individual end date', () => {
  function scheduledRotation(rowNumber, requestId, endDate) {
    const record = { _rowNumber: rowNumber };
    record[H.RECORD.REQUEST_ID] = requestId;
    record[H.RECORD.EMPLOYEE_ID] = '200';
    record[H.RECORD.OPTION_ORDER] = rowNumber - 1;
    record[H.RECORD.END_DATE] = new Date(endDate);
    record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_ACCEPTED;
    record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_APPROVED;
    record[H.RECORD.EVALUATION_SENT] = STATUS.NO;
    record[H.RECORD.EVALUATION_LINK] = '';
    return record;
  }

  context.evalScheduleRecords = [
    scheduledRotation(2, 'REQ-1', '2026-07-01T00:00:00'),
    scheduledRotation(3, 'REQ-2', '2026-07-02T00:00:00'),
    scheduledRotation(4, 'REQ-3', '2026-07-03T00:00:00')
  ];
  context.evalScheduleSent = [];
  context.evalLinkBuildCount = 0;
  run(`
    LockService = {
      getScriptLock: function() {
        return { tryLock: function() { return true; }, releaseLock: function() {} };
      }
    };
    getConfig = function() {
      return {
        EVALUATION_FORM_URL: 'https://docs.google.com/forms/evaluation',
        EVALUATION_ALLOWED_FINAL_STATUSES: [
          STATUS.FINAL_APPROVED,
          STATUS.FINAL_IN_PROGRESS,
          STATUS.FINAL_DONE
        ]
      };
    };
    getRecords_ = function() { return evalScheduleRecords; };
    buildEvaluationPrefilledUrl_ = function(record) {
      evalLinkBuildCount++;
      return 'https://docs.google.com/forms/prefilled/' + record[H.RECORD.REQUEST_ID];
    };
    sendEvaluationEmail = function(record, evaluationUrl) {
      evalScheduleSent.push([record[H.RECORD.REQUEST_ID], evaluationUrl]);
      return true;
    };
    updateRequestByRow_ = function(rowNumber, patch) {
      var record = evalScheduleRecords[rowNumber - 2];
      Object.keys(patch).forEach(function(key) { record[key] = patch[key]; });
    };
    logInfo_ = function() {};
    logError_ = function() {};
  `);

  assert.strictEqual(
    run('isEvaluationDueForRecord_(evalScheduleRecords[0], getConfig(), new Date("2026-07-01T00:00:00"))'),
    false
  );
  run('sendEvaluationEmails(new Date("2026-07-02T00:00:00"))');
  run('sendEvaluationEmails(new Date("2026-07-03T00:00:00"))');
  run('sendEvaluationEmails(new Date("2026-07-04T00:00:00"))');

  const sent = Array.from(context.evalScheduleSent, (entry) => Array.from(entry));
  assert.deepStrictEqual(sent.map((entry) => entry[0]), ['REQ-1', 'REQ-2', 'REQ-3']);
  assert.deepStrictEqual(sent.map((entry) => entry[1]), [
    'https://docs.google.com/forms/prefilled/REQ-1',
    'https://docs.google.com/forms/prefilled/REQ-2',
    'https://docs.google.com/forms/prefilled/REQ-3'
  ]);
  assert.strictEqual(context.evalLinkBuildCount, 3);
  context.evalScheduleRecords.forEach((scheduledRecord) => {
    assert.strictEqual(scheduledRecord[H.RECORD.EVALUATION_SENT], STATUS.YES);
  });
});

test('one submission sends one grouped approval email to the unit head', () => {
  function groupedApprovalRecord(selectionNumber) {
    const record = { _rowNumber: selectionNumber + 1 };
    record[H.RECORD.REQUEST_ID] = `REQ-${selectionNumber}`;
    record[H.RECORD.REQUEST_GROUP_ID] = 'GROUP-1';
    record[H.RECORD.OPTION_ORDER] = selectionNumber;
    record[H.RECORD.EMPLOYEE_NAME] = 'Employee';
    record[H.RECORD.EMPLOYEE_ID] = '200';
    record[H.RECORD.EMPLOYEE_JOB_TITLE] = 'Analyst';
    record[H.RECORD.DIRECT_MANAGER_NAME] = 'Manager';
    record[H.RECORD.CURRENT_UNIT] = 'Current Unit';
    record[H.RECORD.CURRENT_DEPARTMENT] = 'Current Section';
    record[H.RECORD.ROTATION_UNIT] = `Unit ${selectionNumber}`;
    record[H.RECORD.SECTION] = `Section ${selectionNumber}`;
    record[H.RECORD.START_DATE] = new Date(`2026-07-${String(selectionNumber * 7 - 2).padStart(2, '0')}T00:00:00`);
    record[H.RECORD.END_DATE] = new Date(`2026-07-${String(selectionNumber * 7).padStart(2, '0')}T00:00:00`);
    record[H.RECORD.HOURS] = selectionNumber + 1;
    record[H.RECORD.WORKING_DAYS] = 3;
    record[H.RECORD.TOTAL_HOURS] = (selectionNumber + 1) * 3;
    record._submissionTotalHours = 27;
    record[H.RECORD.TOKEN] = `TOKEN-${selectionNumber}`;
    record[H.RECORD.APPROVER_EMAIL] = 'head@example.com';
    record[H.RECORD.HEAD_STATUS] = STATUS.HEAD_PENDING;
    record[H.RECORD.FINAL_STATUS] = STATUS.FINAL_PENDING;
    record[H.RECORD.APPROVAL_EMAIL_SENT_AT] = '';
    record[H.RECORD.EMAIL_RETRY_COUNT] = 0;
    return record;
  }

  context.groupedApprovalRecords = [1, 2, 3].map(groupedApprovalRecord);
  context.groupedPayloads = [];
  context.groupedTemplateData = null;
  context.groupedUpdates = [];
  run(`
    getConfig = function() {
      return {
        BRAND: { primaryColor: '#0B4EA2', logoUrl: '' },
        ORGANIZATION_NAME_AR: 'Employee Services',
        ORGANIZATION_NAME_EN: 'Employee Services',
        EVALUATION_FORM_URL: ''
      };
    };
    getEmployeeTotalCompletedHours_ = function() { return 0; };
    makeWebAppUrl_ = function(action, token) { return 'https://example.com/' + action + '/' + token; };
    renderTemplate_ = function(_name, data) { groupedTemplateData = data; return '<html>grouped</html>'; };
    sendEmailSafe_ = function(payload, context) {
      groupedPayloads.push({ payload: payload, context: context });
      return true;
    };
    updateRequestByRow_ = function(rowNumber, updates) {
      groupedUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
    now_ = function() { return new Date('2026-07-28T07:00:00'); };
    groupedApprovalResult = sendGroupedApprovalEmails_(groupedApprovalRecords);
  `);

  assert.strictEqual(context.groupedApprovalResult.groups, 1);
  assert.strictEqual(context.groupedApprovalResult.sent, 1);
  assert.strictEqual(context.groupedPayloads.length, 1);
  assert.strictEqual(context.groupedPayloads[0].payload.to, 'head@example.com');
  assert.strictEqual(context.groupedPayloads[0].context.kind, 'approval_group');
  assert.deepStrictEqual(
    Array.from(context.groupedPayloads[0].context.requestIds),
    ['REQ-1', 'REQ-2', 'REQ-3']
  );
  assert.strictEqual(context.groupedTemplateData.requests.length, 3);
  assert.ok(context.groupedTemplateData.rows.some(
    (row) => row.ar === 'اسم الموظف' && row.en === 'Employee Name'
  ));
  assert.ok(context.groupedTemplateData.rows.some(
    (row) => row.ar === 'إجمالي ساعات التدوير المطلوبة' &&
      row.en === 'Total Requested Rotation Hours'
  ));
  context.groupedTemplateData.requests.forEach((request, index) => {
    assert.match(request.approveUrl, new RegExp(`approve/TOKEN-${index + 1}`));
    assert.match(request.rejectUrl, new RegExp(`reject/TOKEN-${index + 1}`));
    assert.ok(request.rows.some(
      (row) => row.ar === 'عدد ساعات التدوير اليومية المطلوبة' &&
        row.en === 'Required Daily Rotation Hours'
    ));
    assert.ok(request.rows.some(
      (row) => row.ar === 'إجمالي ساعات التدوير' && row.en === 'Total Rotation Hours'
    ));
  });
  assert.strictEqual(context.groupedTemplateData.approveUrl, '');
  assert.strictEqual(context.groupedTemplateData.rejectUrl, '');
  const approvalTemplateSource = fs.readFileSync(path.join(root, 'Emails_Approval.html'), 'utf8');
  assert.match(approvalTemplateSource, /href="<\?= request\.approveUrl \?>"/);
  assert.match(approvalTemplateSource, /href="<\?= request\.rejectUrl \?>"/);
  assert.strictEqual(context.groupedUpdates.length, 3);
});

test('submission validation errors go to Employee Services instead of the unit head', () => {
  context.submissionReviewPayload = null;
  context.submissionReviewTemplateData = null;
  run(`
    getConfig = function() {
      return {
        BRAND: { primaryColor: '#0B4EA2', logoUrl: '' },
        ORGANIZATION_NAME_AR: 'Employee Services',
        ORGANIZATION_NAME_EN: 'Employee Services'
      };
    };
    normalizeRotationOptionsFromSubmission_ = function(data) { return data.rotationOptions || []; };
    renderTemplate_ = function(_name, data) {
      submissionReviewTemplateData = data;
      return '<html>review</html>';
    };
    sendEmailSafe_ = function(payload) {
      submissionReviewPayload = payload;
      return true;
    };
    sendInvalidDatesSubmissionEmail({
      directManagerEmail: 'manager@example.com',
      submitterEmail: 'submitter@example.com',
      employeeEmail: 'employee@example.com',
      approverEmail: 'unit-head@example.com',
      employeeName: 'Employee',
      rotationOptions: [{
        rotationUnit: 'Unit 1',
        section: 'Section 1',
        startDate: new Date('2026-07-01T00:00:00'),
        endDate: new Date('2026-07-03T00:00:00'),
        hours: 2
      }]
    }, 'RESPONSE-1', new Error('Validation failed'));
  `);

  assert.strictEqual(context.submissionReviewPayload.to, 'employeeservices@squ.edu.om');
  assert.strictEqual(context.submissionReviewPayload.cc, 'm.alaamri1@squ.edu.om');
  assert.doesNotMatch(
    `${context.submissionReviewPayload.to},${context.submissionReviewPayload.cc}`,
    /manager@example\.com|submitter@example\.com|employee@example\.com|unit-head@example\.com/
  );
  assert.ok(context.submissionReviewTemplateData.rows.some(
    (row) => row.ar === 'اسم الموظف' && row.en === 'Employee Name'
  ));
  assert.ok(context.submissionReviewTemplateData.rows.some(
    (row) => row.ar === 'عدد ساعات التدوير اليومية المطلوبة 1' &&
      row.en === 'Required Daily Rotation Hours 1'
  ));
  context.oldQueuedReviewPayload = {
    to: 'unit-head@example.com',
    cc: 'employee@example.com',
    bcc: 'manager@example.com'
  };
  run(`
    reroutedQueuedReviewPayload = applyEmailRecipientPolicy_(
      oldQueuedReviewPayload,
      { kind: 'invalid_dates_submission' }
    );
  `);
  assert.strictEqual(context.reroutedQueuedReviewPayload.to, 'employeeservices@squ.edu.om');
  assert.strictEqual(context.reroutedQueuedReviewPayload.cc, 'm.alaamri1@squ.edu.om');
  assert.strictEqual(context.reroutedQueuedReviewPayload.bcc, '');
});

test('same-submission date overlaps show exact sections and dates and bypass the unit head', () => {
  context.employeeCorrectionPayload = null;
  context.employeeCorrectionContext = null;
  context.employeeCorrectionTemplateData = null;
  context.employeeCorrectionData = {
    employeeName: 'Employee',
    employeeId: '200',
    employeeJobTitle: 'Analyst',
    directManagerName: 'Manager',
    directManagerEmail: 'manager@example.com',
    employeeEmail: 'employee@example.com',
    currentUnit: 'Unit A',
    currentDepartment: 'Current Section',
    approverEmail: 'unit-head@example.com',
    currentUnitHeadEmail: 'current-head@example.com',
    rotationOptions: [
      option(1, 'Unit A', 'Section 1', '2026-07-05T00:00:00', '2026-07-07T00:00:00', 2),
      option(2, 'Unit A', 'Section 2', '2026-07-07T00:00:00', '2026-07-09T00:00:00', 3)
    ]
  };
  run(`
    employeeCorrectionError = null;
    try {
      validateUnifiedRotationOptions_({}, employeeCorrectionData.rotationOptions);
    } catch (error) {
      employeeCorrectionError = error;
    }
    if (!employeeCorrectionError) throw new Error('Expected an overlap validation error.');
    getConfig = function() {
      return {
        BRAND: { primaryColor: '#0B4EA2', logoUrl: '' },
        ORGANIZATION_NAME_AR: 'Employee Services',
        ORGANIZATION_NAME_EN: 'Employee Services'
      };
    };
    normalizeRotationOptionsFromSubmission_ = function(data) { return data.rotationOptions || []; };
    renderTemplate_ = function(_name, data) {
      employeeCorrectionTemplateData = data;
      return '<html>employee correction</html>';
    };
    sendEmailSafe_ = function(payload, emailContext) {
      employeeCorrectionPayload = payload;
      employeeCorrectionContext = emailContext;
      return true;
    };
    sendInvalidDatesSubmissionEmail(
      employeeCorrectionData,
      'RESPONSE-OVERLAP',
      employeeCorrectionError
    );
  `);

  assert.strictEqual(
    context.employeeCorrectionPayload.to,
    'manager@example.com,employee@example.com'
  );
  assert.strictEqual(context.employeeCorrectionPayload.cc, '');
  assert.doesNotMatch(
    context.employeeCorrectionPayload.to,
    /unit-head@example\.com|current-head@example\.com/
  );
  assert.match(context.employeeCorrectionPayload.subject, /Date Overlap Requires Correction/);
  assert.strictEqual(context.employeeCorrectionContext.recipientPolicy, 'EMPLOYEE_CORRECTION');
  assert.strictEqual(context.employeeCorrectionTemplateData.isEmployeeCorrection, true);

  const overlapDetailsRow = context.employeeCorrectionTemplateData.rows.find(
    (row) => row.en === 'Conflicting Rotations 1'
  );
  assert.ok(overlapDetailsRow);
  assert.match(overlapDetailsRow.value, /Rotation Selection 1: Unit A — Section 1/);
  assert.match(overlapDetailsRow.value, /Rotation Selection 2: Unit A — Section 2/);
  assert.match(overlapDetailsRow.value, /05\/07\/2026 — 07\/07\/2026/);
  assert.match(overlapDetailsRow.value, /07\/07\/2026 — 09\/07\/2026/);

  const overlapRangeRow = context.employeeCorrectionTemplateData.rows.find(
    (row) => row.en === 'Overlapping Date Range 1'
  );
  assert.ok(overlapRangeRow);
  assert.strictEqual(overlapRangeRow.value, '07/07/2026 — 07/07/2026');
  assert.ok(context.employeeCorrectionTemplateData.rows.some(
    (row) => row.en === 'Rotation Section 1' && row.value === 'Section 1'
  ));
  assert.ok(context.employeeCorrectionTemplateData.rows.some(
    (row) => row.en === 'Start Date 2' && row.value === '07/07/2026'
  ));
  assert.ok(context.employeeCorrectionTemplateData.rows.some(
    (row) => row.en === 'End Date 2' && row.value === '09/07/2026'
  ));

  context.reroutedEmployeeCorrectionPayload = {
    to: 'unit-head@example.com',
    cc: 'current-head@example.com',
    bcc: 'another-head@example.com'
  };
  run(`
    enforcedEmployeeCorrectionPayload = applyEmailRecipientPolicy_(
      reroutedEmployeeCorrectionPayload,
      employeeCorrectionContext
    );
  `);
  assert.strictEqual(
    context.enforcedEmployeeCorrectionPayload.to,
    'manager@example.com,employee@example.com'
  );
  assert.strictEqual(
    context.enforcedEmployeeCorrectionPayload.cc,
    'employeeservices@squ.edu.om'
  );
  assert.strictEqual(context.enforcedEmployeeCorrectionPayload.bcc, '');
});

test('one unit-head group approval updates all three rotations but leaves final decisions pending', () => {
  context.groupDecisionRecords = context.groupedApprovalRecords.map((record) => Object.assign({}, record));
  context.groupDecisionUpdates = [];
  context.groupLookupLimits = [];
  context.groupConflictReadCount = 0;
  context.groupConflictCheckCount = 0;
  run(`
    getRequestByToken_ = function(token) {
      return groupDecisionRecords.filter(function(record) {
        return record[H.RECORD.TOKEN] === token;
      })[0] || null;
    };
    getOrCreateSheet_ = function() { return {}; };
    findObjectsByValue_ = function(_sheet, _header, _value, maxResults) {
      groupLookupLimits.push(maxResults);
      return groupDecisionRecords.slice();
    };
    getEmployeeConflictCandidateRecords_ = function() {
      groupConflictReadCount++;
      return groupDecisionRecords.slice();
    };
    findConflicts = function(_criteria, candidates) {
      groupConflictCheckCount++;
      if (!candidates || candidates.length !== 3) throw new Error('Conflict candidates were not reused.');
      return null;
    };
    updateRequestByRow_ = function(rowNumber, updates) {
      groupDecisionUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
    queueConflictNotification = function() {
      throw new Error('No conflict notification was expected.');
    };
    now_ = function() { return new Date('2026-07-28T08:00:00'); };
    processQueuedApproveGroupAction_('TOKEN-1');
  `);

  assert.deepStrictEqual(Array.from(context.groupLookupLimits), [4]);
  assert.strictEqual(context.groupConflictReadCount, 1);
  assert.strictEqual(context.groupConflictCheckCount, 3);
  assert.strictEqual(context.groupDecisionUpdates.length, 3);
  context.groupDecisionUpdates.forEach((entry) => {
    assert.strictEqual(entry.updates[H.RECORD.HEAD_STATUS], STATUS.HEAD_ACCEPTED);
    assert.strictEqual(entry.updates[H.RECORD.FINAL_STATUS], STATUS.FINAL_PENDING);
  });
});

test('one rotation approval button updates only its own rotation', () => {
  context.individualDecisionRecords = context.groupedApprovalRecords.map((record) => Object.assign({}, record));
  context.individualDecisionUpdates = [];
  run(`
    getRequestByToken_ = function(token) {
      return individualDecisionRecords.filter(function(record) {
        return record[H.RECORD.TOKEN] === token;
      })[0] || null;
    };
    findConflicts = function() { return null; };
    updateRequestByRow_ = function(rowNumber, updates) {
      individualDecisionUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
    queueConflictNotification = function() {
      throw new Error('No conflict notification was expected.');
    };
    now_ = function() { return new Date('2026-07-28T08:10:00'); };
    processQueuedApproveAction_('TOKEN-2');
  `);

  assert.strictEqual(context.individualDecisionUpdates.length, 1);
  assert.strictEqual(context.individualDecisionUpdates[0].rowNumber, 3);
  assert.strictEqual(
    context.individualDecisionUpdates[0].updates[H.RECORD.HEAD_STATUS],
    STATUS.HEAD_ACCEPTED
  );
  assert.strictEqual(
    context.individualDecisionUpdates[0].updates[H.RECORD.FINAL_STATUS],
    STATUS.FINAL_PENDING
  );
});

test('one rotation rejection button updates only its own rotation', () => {
  context.individualDecisionRecords = context.groupedApprovalRecords.map((record) => Object.assign({}, record));
  context.individualDecisionUpdates = [];
  context.individualRejectedNotifications = [];
  run(`
    getRequestByToken_ = function(token) {
      return individualDecisionRecords.filter(function(record) {
        return record[H.RECORD.TOKEN] === token;
      })[0] || null;
    };
    updateRequestByRow_ = function(rowNumber, updates) {
      individualDecisionUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
    sendRejectedNotification = function(record) {
      individualRejectedNotifications.push(record);
      return true;
    };
    now_ = function() { return new Date('2026-07-28T08:12:00'); };
    processQueuedRejectAction_('TOKEN-1', 'Not approved for this rotation');
  `);

  assert.strictEqual(context.individualDecisionUpdates.length, 1);
  assert.strictEqual(context.individualDecisionUpdates[0].rowNumber, 2);
  assert.strictEqual(
    context.individualDecisionUpdates[0].updates[H.RECORD.HEAD_STATUS],
    STATUS.HEAD_REJECTED
  );
  assert.strictEqual(
    context.individualDecisionUpdates[0].updates[H.RECORD.FINAL_STATUS],
    STATUS.FINAL_REJECTED
  );
  assert.strictEqual(context.individualRejectedNotifications.length, 1);
});

test('unit-head group action refuses an unexpected fourth rotation', () => {
  const unexpectedFourth = Object.assign({}, context.groupedApprovalRecords[0]);
  unexpectedFourth._rowNumber = 5;
  unexpectedFourth[H.RECORD.REQUEST_ID] = 'REQ-4';
  unexpectedFourth[H.RECORD.OPTION_ORDER] = 4;
  unexpectedFourth[H.RECORD.TOKEN] = 'TOKEN-4';
  context.groupDecisionRecords = context.groupedApprovalRecords
    .map((record) => Object.assign({}, record))
    .concat([unexpectedFourth]);
  context.groupDecisionUpdates = [];
  run(`
    getRequestByToken_ = function() { return groupDecisionRecords[0]; };
    findObjectsByValue_ = function() { return groupDecisionRecords.slice(); };
    updateRequestByRow_ = function(rowNumber, updates) {
      groupDecisionUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
  `);

  assert.throws(
    () => run(`processQueuedApproveGroupAction_('TOKEN-1')`),
    /more than the supported 3 rotations/
  );
  assert.strictEqual(context.groupDecisionUpdates.length, 0);
});

test('one unit-head group rejection updates all three rotations and queues email work', () => {
  context.groupDecisionRecords = context.groupedApprovalRecords.map((record) => Object.assign({}, record));
  context.groupDecisionUpdates = [];
  context.groupRejectedNotifications = [];
  run(`
    getRequestByToken_ = function(token) {
      return groupDecisionRecords.filter(function(record) {
        return record[H.RECORD.TOKEN] === token;
      })[0] || null;
    };
    findObjectsByValue_ = function() { return groupDecisionRecords.slice(); };
    updateRequestByRow_ = function(rowNumber, updates) {
      groupDecisionUpdates.push({ rowNumber: rowNumber, updates: updates });
    };
    queueRejectedNotification = function(record) {
      groupRejectedNotifications.push(record);
      return true;
    };
    sendRejectedNotification = function() {
      throw new Error('Group rejection must not send email inside the action trigger.');
    };
    now_ = function() { return new Date('2026-07-28T08:15:00'); };
    processQueuedRejectGroupAction_('TOKEN-1', 'Not approved');
  `);

  assert.strictEqual(context.groupDecisionUpdates.length, 3);
  assert.strictEqual(context.groupRejectedNotifications.length, 3);
  context.groupDecisionUpdates.forEach((entry) => {
    assert.strictEqual(entry.updates[H.RECORD.HEAD_STATUS], STATUS.HEAD_REJECTED);
    assert.strictEqual(entry.updates[H.RECORD.FINAL_STATUS], STATUS.FINAL_REJECTED);
    assert.strictEqual(entry.updates[H.RECORD.REJECTION_REASON], 'Not approved');
  });
});

test('legacy group actions stay bounded while dashboard final approval remains per row', () => {
  const approvalSource = fs.readFileSync(path.join(root, 'ApprovalWebApp.gs'), 'utf8');
  const queueSource = fs.readFileSync(path.join(root, 'ApprovalActionQueueService.gs'), 'utf8');
  const dashboardValidationSource = fs.readFileSync(path.join(root, 'ValidationService.gs'), 'utf8');
  assert.match(approvalSource, /FORM\.MAX_ROTATION_OPTIONS \|\| 3/);
  assert.match(approvalSource, /var conflictCandidates = getEmployeeConflictCandidateRecords_\(/);
  assert.match(approvalSource, /queueRejectedNotification\(record\)/);
  assert.match(queueSource, /shouldStopSync_\(options\.startedAt\)/);
  assert.match(dashboardValidationSource, /function applyFinalStatusChange_\(rowNumber/);
  assert.match(dashboardValidationSource, /updateObjectRow_\(sheet, rowNumber,/);
  assert.doesNotMatch(dashboardValidationSource, /REQUEST_GROUP_ID/);
});

test('section-head email values stay explicit and email-only edits do not change the form-choice hash', () => {
  const unit = {};
  unit[H.UNIT.UNIT_ID] = 'UNIT-A';
  unit[H.UNIT.UNIT_NAME] = 'Unit A';
  unit[H.UNIT.HEAD_EMAIL] = 'unit-head-1@example.com';
  unit[H.UNIT.ACTIVE] = STATUS.YES;

  const section = {};
  section[H.SECTION.SECTION_ID] = 'SECTION-1';
  section[H.SECTION.UNIT_ID] = 'UNIT-A';
  section[H.SECTION.UNIT_NAME] = 'Unit A';
  section[H.SECTION.SECTION_NAME] = 'Section 1';
  section[H.SECTION.ACTIVE] = STATUS.YES;
  section[H.SECTION.CAPACITY] = 1;
  section[H.SECTION.HEAD_EMAIL] = '';

  context.referenceUnits = [unit];
  context.referenceSections = [section];
  const normalized = run('normalizeAdminSectionRows_(referenceSections, referenceUnits)[0]');
  assert.strictEqual(normalized[H.SECTION.HEAD_EMAIL], '');

  context.normalizedReferenceSections = [normalized];
  const originalHash = run(
    'makeFormReferenceChecksum_(referenceUnits, normalizedReferenceSections)'
  );
  unit[H.UNIT.HEAD_EMAIL] = 'unit-head-2@example.com';
  normalized[H.SECTION.HEAD_EMAIL] = 'section-head-2@example.com';
  normalized[H.SECTION.CAPACITY] = 99;
  const emailOnlyHash = run(
    'makeFormReferenceChecksum_(referenceUnits, normalizedReferenceSections)'
  );
  assert.strictEqual(emailOnlyHash, originalHash);

  normalized[H.SECTION.SECTION_NAME] = 'Section 1 Updated';
  const choiceChangeHash = run(
    'makeFormReferenceChecksum_(referenceUnits, normalizedReferenceSections)'
  );
  assert.notStrictEqual(choiceChangeHash, originalHash);

  const syncSource = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
  const schemaSource = fs.readFileSync(path.join(root, 'Step18_SectionHeadEmails.gs'), 'utf8');
  assert.match(syncSource, /var needsFormRefresh = formChoicesChanged \|\|/);
  assert.doesNotMatch(
    schemaSource,
    /FormApp|openMainForm|openEvaluationForm|rebuildMainForm|rebuildEvaluationForm/
  );
});

test('final approval CCs the selected section head but final rejection does not', () => {
  const record = {};
  record[H.RECORD.REQUEST_ID] = 'REQ-FINAL';
  record[H.RECORD.EMPLOYEE_EMAIL] = 'employee@example.com';
  record[H.RECORD.DIRECT_MANAGER_EMAIL] = 'manager@example.com';
  record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL] = 'current-head@example.com';
  record[H.RECORD.ROTATION_UNIT] = 'Unit A';
  record[H.RECORD.SECTION] = 'Section 1';
  record[H.RECORD.EMPLOYEE_ID] = '200';
  context.finalRecipientRecord = record;
  run(`
    getConfig = function() {
      return {
        BRAND: { primaryColor: '#0B4EA2', logoUrl: '' },
        ORGANIZATION_NAME_AR: 'Employee Services',
        ORGANIZATION_NAME_EN: 'Employee Services',
        EVALUATION_FORM_URL: ''
      };
    };
    getEmployeeTotalCompletedHours_ = function() { return 0; };
    renderTemplate_ = function() { return '<html>final</html>'; };
    findSectionByUnitAndName_ = function() {
      return { headEmail: 'section-head@example.com' };
    };
    finalApprovedPayload = buildFinalApprovedNotificationPayload_(finalRecipientRecord);
    finalRejectedPayload = buildFinalRejectedNotificationPayload_(finalRecipientRecord);
    employeeConflictPayload = buildConflictNotificationPayload_(
      finalRecipientRecord,
      finalRecipientRecord,
      'test'
    );
  `);
  assert.strictEqual(context.finalApprovedPayload.cc, 'section-head@example.com');
  assert.doesNotMatch(
    `${context.finalRejectedPayload.to},${context.finalRejectedPayload.cc || ''}`,
    /section-head@example\.com/
  );
  assert.match(context.finalApprovedPayload.to, /employee@example\.com/);
  assert.match(context.finalApprovedPayload.to, /manager@example\.com/);
  assert.match(context.finalApprovedPayload.to, /current-head@example\.com/);
  assert.strictEqual(
    context.employeeConflictPayload.to,
    'manager@example.com,employee@example.com'
  );
  assert.strictEqual(context.employeeConflictPayload.cc, '');
});

test('rejection pages trust a valid configured production URL without deployment comparison', () => {
  run(`
    getConfig = function() {
      return { WEB_APP_URL: 'https://script.google.com/macros/s/DEPLOYMENT-ID/exec' };
    };
    rejectionUrlStatus = getValidatedWebAppUrlStatus_();
  `);
  assert.strictEqual(context.rejectionUrlStatus.ok, true);
  assert.strictEqual(
    context.rejectionUrlStatus.url,
    'https://script.google.com/macros/s/DEPLOYMENT-ID/exec'
  );
  const approvalSource = fs.readFileSync(path.join(root, 'ApprovalWebApp.gs'), 'utf8');
  const validationStart = approvalSource.indexOf('function getValidatedWebAppUrlStatus_');
  const validationEnd = approvalSource.indexOf('function normalizeWebAppUrl_', validationStart);
  assert.doesNotMatch(
    approvalSource.slice(validationStart, validationEnd),
    /ScriptApp\.getService\(\)\.getUrl\(\)/
  );
});

test('employee-hours summary uses the Knowledge Rotation tab name and renames the development tab', () => {
  assert.strictEqual(
    run('SHEETS.EMPLOYEE_ROTATION_HOURS'),
    'ملخص ساعات التدوير المعرفي'
  );
  assert.strictEqual(
    run('LEGACY_EMPLOYEE_ROTATION_HOURS_SHEET_NAME'),
    'ملخص ساعات التدوير الوظيفي للموظفين'
  );
  const source = fs.readFileSync(path.join(root, 'TrainingHoursService.gs'), 'utf8');
  assert.match(source, /legacySheet\.setName\(SHEETS\.EMPLOYEE_ROTATION_HOURS\)/);
});

test('request-sheet schema removes the submission total, uses the new type, and hides internal fields', () => {
  assert.strictEqual(STATUS.TYPE_ROTATION, 'التدوير المعرفي');
  assert.strictEqual(run('RECORD_HEADERS.indexOf(LEGACY_SUBMISSION_TOTAL_HOURS_HEADER)'), -1);
  assert.ok(run('INTERNAL_RECORD_HEADERS.indexOf(H.RECORD.REQUEST_GROUP_ID)') >= 0);
  assert.ok(run('INTERNAL_RECORD_HEADERS.indexOf(H.RECORD.SELECTION_KEY)') >= 0);

  const requestSource = fs.readFileSync(path.join(root, 'RequestService.gs'), 'utf8');
  assert.doesNotMatch(requestSource, /H\.RECORD\.SUBMISSION_TOTAL_HOURS/);
  assert.match(requestSource, /record\._submissionTotalHours = options\.submissionTotalHours/);

  const templateSource = fs.readFileSync(path.join(root, 'TemplateService.gs'), 'utf8');
  assert.match(templateSource, /findObjectsByValue_\([\s\S]*H\.RECORD\.REQUEST_GROUP_ID[\s\S]*FORM\.MAX_ROTATION_OPTIONS/);

  const migrationSource = fs.readFileSync(path.join(root, 'Step19_RequestSheetAndFormLabels.gs'), 'utf8');
  assert.match(migrationSource, /removeLegacySubmissionTotalHoursColumn_/);
  assert.match(migrationSource, /hideInternalColumns_/);
  assert.match(migrationSource, /updateMainFormEmployeeNameTitle_/);
  assert.doesNotMatch(migrationSource, /rebuildMainForm|initializeMultiRotationFormBuild_|rebuildEvaluationForm/);
});

test('dates render DD/MM/YYYY and sender/final recipients remain forced', () => {
  context.outputDate = new Date('2026-04-20T00:00:00');
  assert.strictEqual(run('formatDate_(outputDate)'), '20/04/2026');
  const emailSource = fs.readFileSync(path.join(root, 'EmailService.gs'), 'utf8');
  const constantsSource = fs.readFileSync(path.join(root, 'Constants.gs'), 'utf8');
  assert.match(constantsSource, /const EMAIL_SENDER_DISPLAY_NAME = 'Employee Services'/);
  run(`
    standardEmailMessage = buildEmailMessage_({
      to: 'recipient@example.com',
      cc: 'existing-copy@example.com',
      name: 'Wrong Name'
    });
    directEmployeeServicesMessage = buildEmailMessage_({
      to: 'EMPLOYEESERVICES@squ.edu.om',
      cc: 'employeeservices@squ.edu.om,existing-copy@example.com'
    });
  `);
  assert.strictEqual(context.standardEmailMessage.name, 'Employee Services');
  assert.strictEqual(
    context.standardEmailMessage.cc,
    'existing-copy@example.com,employeeservices@squ.edu.om'
  );
  assert.strictEqual(context.directEmployeeServicesMessage.to, 'EMPLOYEESERVICES@squ.edu.om');
  assert.strictEqual(context.directEmployeeServicesMessage.cc, 'existing-copy@example.com');
  assert.match(emailSource, /record\[H\.RECORD\.EMPLOYEE_EMAIL\][\s\S]*record\[H\.RECORD\.DIRECT_MANAGER_EMAIL\][\s\S]*record\[H\.RECORD\.CURRENT_UNIT_HEAD_EMAIL\]/);
  assert.match(emailSource, /EMAIL_SENDER_DISPLAY_NAME/);
});

test('all email subjects and bodies use Knowledge Rotation terminology', () => {
  const emailFiles = fs.readdirSync(root)
    .filter((file) => /^Emails_.*\.html$/i.test(file))
    .concat(['EmailService.gs']);
  emailFiles.forEach((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    let auditedSource = source;
    if (file === 'EmailService.gs') {
      const policyStart = source.indexOf('function applyEmailRecipientPolicy_');
      const policyRulesEnd = source.indexOf(
        "  if (context && context.kind === 'invalid_dates_submission')",
        policyStart
      );
      auditedSource = source.slice(0, policyStart) + source.slice(policyRulesEnd);
    }
    assert.doesNotMatch(
      auditedSource,
      /التدوير الوظيفي|تدوير وظيفي|job rotation/i,
      `${file} still contains old Job Rotation terminology`
    );
  });
  ['EmailService.gs', 'Emails_Approved.html', 'Emails_Conflict.html'].forEach((file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /طلب تدوير معرفي/);
  });
  assert.match(
    fs.readFileSync(path.join(root, 'Emails_Conflict.html'), 'utf8'),
    /طلب التدوير المعرفي/
  );

  const requestSource = fs.readFileSync(path.join(root, 'RequestService.gs'), 'utf8');
  const activeReasonStart = requestSource.indexOf('function buildActiveEmployeeRejectionReason_');
  const activeReasonEnd = requestSource.indexOf('\n}', activeReasonStart);
  const activeReasonSource = requestSource.slice(activeReasonStart, activeReasonEnd);
  assert.doesNotMatch(activeReasonSource, /تدوير وظيفي|job rotation/i);
  assert.match(activeReasonSource, /تدوير معرفي/);
  assert.match(activeReasonSource, /knowledge rotation/i);

  context.legacyQueuedEmail = {
    subject: 'Job Rotation Request',
    htmlBody: 'طلب التدوير الوظيفي / The job rotation request'
  };
  run(`
    normalizedLegacyQueuedEmail = applyEmailRecipientPolicy_(
      legacyQueuedEmail,
      { kind: 'rejected' }
    );
  `);
  assert.strictEqual(context.normalizedLegacyQueuedEmail.subject, 'Knowledge Rotation Request');
  assert.match(context.normalizedLegacyQueuedEmail.htmlBody, /التدوير المعرفي/);
  assert.match(context.normalizedLegacyQueuedEmail.htmlBody, /knowledge rotation request/i);
  assert.doesNotMatch(
    context.normalizedLegacyQueuedEmail.htmlBody,
    /التدوير الوظيفي|تدوير وظيفي|job rotation/i
  );
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
