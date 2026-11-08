const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  console, Date, JSON, Math, Number, Object, String, Array, Boolean, RegExp,
  Error, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
  Utilities: {
    formatDate(value, _timezone, pattern) {
      const date = new Date(value);
      const pad = number => String(number).padStart(2, '0');
      return pattern.replace(/yyyy|MM|dd/g, token => ({
        yyyy: String(date.getFullYear()), MM: pad(date.getMonth() + 1), dd: pad(date.getDate())
      }[token]));
    }
  },
  FormApp: { ItemType: { TEXT: 'TEXT' } },
  LockService: {
    getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; }
  }
};
vm.createContext(context);
function run(source) { return vm.runInContext(source, context); }
[
  'Constants.gs', 'Utils.gs', 'RotationMetricsService.gs', 'SheetService.gs',
  'RequestService.gs', 'ValidationService.gs', 'EvaluationPrefillService.gs',
  'EvaluationService.gs', 'EmailService.gs', 'Step14_RepairLatestSchema.gs'
].forEach(file => new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }).runInContext(context));
const H = run('H');
const STATUS = run('STATUS');
const SHEETS = run('SHEETS');
const label = run('EVALUATION_LINK_LABEL_');
const fields = run('EVALUATION_FIELDS');
const titles = Object.values(fields);
const fallbackUrl = 'https://docs.google.com/forms/d/e/evaluation-id/viewform';
const state = { sent: [], errors: [], opens: 0, itemReads: 0 };
const form = {
  getItems() {
    state.itemReads += 1;
    return titles.map((title, index) => ({
      getTitle() { return title; },
      asTextItem() { return { createResponse(value) { return { index, value }; } }; }
    }));
  },
  createResponse() {
    const answers = [];
    return {
      withItemResponse(answer) { answers.push(answer); return this; },
      toPrefilledUrl() {
        return fallbackUrl + '?usp=pp_url&' + answers
          .map(answer => 'entry.' + answer.index + '=' + encodeURIComponent(answer.value)).join('&');
      }
    };
  },
  shortenFormUrl() { throw new Error('The sheet-label change must not use a URL shortener.'); }
};
context.FormApp.openById = () => { state.opens += 1; return form; };
context.getConfig = () => ({
  EVALUATION_FORM_ID: 'evaluation-id', EVALUATION_FORM_URL: fallbackUrl,
  EVALUATION_ALLOWED_FINAL_STATUSES: [STATUS.FINAL_APPROVED]
});
context.logError_ = (action, requestId, error) => state.errors.push({ action, requestId, error });
context.logInfo_ = () => {};
context.buildTemplateData_ = (record, overrides) => Object.assign({}, record, overrides);
context.renderTemplate_ = (_name, data) => '<a href="' + data.evaluationUrl + '">Open Evaluation</a>';
context.sendEmailSafe_ = (payload, emailContext) => { state.sent.push({ payload, emailContext }); return true; };
context.now_ = () => new Date('2026-07-08T12:00:00');

// Mimic Sheets: getValues returns HYPERLINK's label; getFormula retains its URL.
class FakeSheet {
  constructor(headers, records = [], name = SHEETS.RECORDS) {
    this.name = name;
    this.cells = [headers, ...records.map(record => headers.map(header => record[header] === undefined ? '' : record[header]))];
    this.formulaReads = [];
    this.writes = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.cells.length; }
  getLastColumn() { return this.cells[0].length; }
  cell(row, column) { return (this.cells[row - 1] || [])[column - 1] || ''; }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;
    function matrix(convert) {
      return Array.from({ length: rowCount }, (_, i) =>
        Array.from({ length: columnCount }, (_, j) => convert(sheet.cell(row + i, column + j))));
    }
    return {
      getValues() {
        return matrix(value => typeof value === 'string' && /^=HYPERLINK\(/i.test(value) ? label : value);
      },
      getFormulas() {
        sheet.formulaReads.push({ row, column, rowCount, columnCount });
        return matrix(value => typeof value === 'string' && value.startsWith('=') ? value : '');
      },
      getFormula() { return this.getFormulas()[0][0]; },
      setValues(values) {
        sheet.writes.push({ row, column, values });
        values.forEach((valuesRow, i) => {
          if (!sheet.cells[row + i - 1]) sheet.cells[row + i - 1] = [];
          valuesRow.forEach((value, j) => { sheet.cells[row + i - 1][column + j - 1] = value; });
        });
      },
      createTextFinder(target) {
        return {
          matchEntireCell() { return this; },
          findAll() {
            return matrix(value => value).flatMap((values, i) =>
              values.map((value, j) => String(value) === target ? { getRow: () => row + i } : null).filter(Boolean));
          },
          findNext() { return this.findAll()[0] || null; }
        };
      }
    };
  }
}

const headers = [
  H.RECORD.REQUEST_ID, H.RECORD.REQUEST_GROUP_ID, H.RECORD.EVALUATION_LINK,
  H.RECORD.EMPLOYEE_NAME, H.RECORD.EMPLOYEE_ID, H.RECORD.EMPLOYEE_EMAIL,
  H.RECORD.ROTATION_UNIT, H.RECORD.SECTION, H.RECORD.OPTION_ORDER,
  H.RECORD.START_DATE, H.RECORD.END_DATE, H.RECORD.HOURS,
  H.RECORD.WORKING_DAYS, H.RECORD.TOTAL_HOURS, H.RECORD.HEAD_STATUS,
  H.RECORD.FINAL_STATUS, H.RECORD.EVALUATION_SENT, H.RECORD.EVALUATION_SENT_AT,
  H.RECORD.LAST_UPDATED
];
const linkColumn = headers.indexOf(H.RECORD.EVALUATION_LINK) + 1;
function record(number = 1) {
  return {
    [H.RECORD.REQUEST_ID]: 'REQ-' + number,
    [H.RECORD.REQUEST_GROUP_ID]: 'GROUP-1',
    [H.RECORD.OPTION_ORDER]: number,
    [H.RECORD.EMPLOYEE_NAME]: 'سالم بن أحمد العامري',
    [H.RECORD.EMPLOYEE_ID]: '200',
    [H.RECORD.EMPLOYEE_EMAIL]: 'employee@example.com',
    [H.RECORD.ROTATION_UNIT]: 'Host Unit',
    [H.RECORD.SECTION]: 'Section ' + number,
    [H.RECORD.START_DATE]: new Date('2026-07-05T00:00:00'),
    [H.RECORD.END_DATE]: new Date('2026-07-07T00:00:00'),
    [H.RECORD.HOURS]: 7,
    [H.RECORD.WORKING_DAYS]: 3,
    [H.RECORD.TOTAL_HOURS]: 21,
    [H.RECORD.HEAD_STATUS]: STATUS.HEAD_ACCEPTED,
    [H.RECORD.FINAL_STATUS]: STATUS.FINAL_APPROVED,
    [H.RECORD.EVALUATION_SENT]: STATUS.NO,
    [H.RECORD.EVALUATION_LINK]: ''
  };
}
function useSheet(sheet) {
  context.testSheet = sheet;
  context.getOrCreateSheet_ = () => sheet;
  context.getRecords_ = () => context.getDataObjects_(sheet);
}
function reset() {
  Object.assign(state, { sent: [], errors: [], opens: 0, itemReads: 0 });
  run('EVALUATION_PREFILL_FORM_CACHE_ = null;');
}
function buildUrl(value) { return context.buildEvaluationPrefilledUrl_(value); }
function formula(url) { return context.buildEvaluationLinkCellFormula_(url); }
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('full prefilled URLs remain unchanged, with every rotation detail', () => {
  reset();
  const url = buildUrl(record());
  assert.ok(url.startsWith(fallbackUrl + '?usp=pp_url&'));
  const parameters = new URL(url).searchParams;
  const expected = {
    REQUEST_ID: 'REQ-1', REQUEST_GROUP_ID: 'GROUP-1', SELECTION_NUMBER: '1',
    EMPLOYEE_NAME: 'سالم بن أحمد العامري', EMPLOYEE_ID: '200', ROTATION_UNIT: 'Host Unit',
    ROTATION_SECTION: 'Section 1', START_DATE: '05/07/2026', END_DATE: '07/07/2026',
    DAILY_HOURS: '7', WORKING_DAYS: '3', TOTAL_HOURS: '21'
  };
  Object.entries(expected).forEach(([key, value]) => {
    assert.strictEqual(parameters.get('entry.' + titles.indexOf(fields[key])), value, key);
  });
  buildUrl(record(2));
  assert.strictEqual(state.opens, 1);
  assert.strictEqual(state.itemReads, 1);
});

test('the friendly formula preserves the exact URL, including quotes and query parameters', () => {
  const url = fallbackUrl + '?entry.1=A%26B&entry.2="quoted"';
  const cellFormula = formula(url);
  assert.strictEqual(cellFormula, '=HYPERLINK("' + url.replace(/"/g, '""') + '","' + label + '")');
  assert.strictEqual(context.evaluationUrlFromCellFormula_(cellFormula), url);
  assert.strictEqual(context.evaluationUrlFromCellFormula_(cellFormula.replace('","' + label, '";"' + label)), url);
});

test('blank or invalid destinations are not converted to hyperlinks', () => {
  ['', 'javascript:alert(1)', 'not a URL', '=IMPORTXML("x")'].forEach(value => assert.strictEqual(formula(value), value));
  assert.strictEqual(context.evaluationUrlFromCellFormula_('=HYPERLINK(A1,"Label")'), '');
});

test('new request links display a label while readers return the full URL', () => {
  const sheet = new FakeSheet(headers, [record()]);
  const url = buildUrl(record());
  context.updateObjectRow_(sheet, 2, { [H.RECORD.EVALUATION_LINK]: url });
  assert.strictEqual(sheet.getRange(2, linkColumn).getValues()[0][0], label);
  assert.strictEqual(sheet.cell(2, linkColumn), formula(url));
  const data = context.getDataObjects_(sheet)[0];
  assert.strictEqual(data[H.RECORD.EVALUATION_LINK], url);
  assert.strictEqual(data._rowNumber, 2);
});

test('subsequent request-row updates preserve the hyperlink and its destination', () => {
  const url = buildUrl(record());
  const sheet = new FakeSheet(headers, [{ ...record(), [H.RECORD.EVALUATION_LINK]: formula(url) }]);
  context.updateObjectRow_(sheet, 2, { [H.RECORD.EVALUATION_SENT]: STATUS.YES });
  context.updateObjectRow_(sheet, 2, { [H.RECORD.FINAL_STATUS]: STATUS.FINAL_APPROVED });
  assert.strictEqual(sheet.cell(2, linkColumn), formula(url));
  assert.strictEqual(context.getDataObjects_(sheet)[0][H.RECORD.EVALUATION_SENT], STATUS.YES);
});

test('bulk record reads use one bounded formula-column read for all labeled links', () => {
  const records = [1, 2, 3].map(number => ({ ...record(number), [H.RECORD.EVALUATION_LINK]: formula(buildUrl(record(number))) }));
  const sheet = new FakeSheet(headers, records);
  const data = context.getDataObjects_(sheet);
  assert.strictEqual(sheet.formulaReads.length, 1);
  assert.deepStrictEqual(sheet.formulaReads[0], { row: 2, column: linkColumn, rowCount: 3, columnCount: 1 });
  assert.strictEqual(new Set(data.map(value => value[H.RECORD.EVALUATION_LINK])).size, 3);
});

test('single-record, grouped-record, and dashboard-edit reads retain the actual URL', () => {
  const url = buildUrl(record());
  const sheet = new FakeSheet(headers, [{ ...record(), [H.RECORD.EVALUATION_LINK]: formula(url) }]);
  assert.strictEqual(context.findObjectByValue_(sheet, H.RECORD.REQUEST_ID, 'REQ-1')[H.RECORD.EVALUATION_LINK], url);
  assert.strictEqual(context.findObjectsByValue_(sheet, H.RECORD.REQUEST_GROUP_ID, 'GROUP-1', 3)[0][H.RECORD.EVALUATION_LINK], url);
  assert.strictEqual(context.getRecordFromSheetRow_(sheet, 2)[H.RECORD.EVALUATION_LINK], url);
});

test('old long links are not migrated during reads or unrelated row updates', () => {
  const url = fallbackUrl + '?entry.1=old';
  const sheet = new FakeSheet(headers, [{ ...record(), [H.RECORD.EVALUATION_LINK]: url }]);
  assert.strictEqual(context.getDataObjects_(sheet)[0][H.RECORD.EVALUATION_LINK], url);
  context.updateObjectRow_(sheet, 2, { [H.RECORD.EVALUATION_SENT]: STATUS.YES });
  assert.strictEqual(sheet.cell(2, linkColumn), url);
  assert.strictEqual(sheet.formulaReads.length, 0);
});

test('a later schema repair reads the full link destination instead of losing it to the label', () => {
  const url = buildUrl(record());
  const sheet = new FakeSheet(headers, [{ ...record(), [H.RECORD.EVALUATION_LINK]: formula(url) }]);
  assert.strictEqual(context.readBootstrapRowsByHeader_(sheet)[0][H.RECORD.EVALUATION_LINK], url);
});

test('other sheets and columns keep their existing URL values', () => {
  const url = buildUrl(record());
  const sheet = new FakeSheet(headers, [record()], 'Another sheet');
  context.updateObjectRow_(sheet, 2, { [H.RECORD.EVALUATION_LINK]: url, [H.RECORD.EMPLOYEE_NAME]: url });
  assert.strictEqual(sheet.cell(2, linkColumn), url);
  assert.strictEqual(sheet.cell(2, headers.indexOf(H.RECORD.EMPLOYEE_NAME) + 1), url);
});

test('explicitly clearing an evaluation link removes its formula', () => {
  const sheet = new FakeSheet(headers, [{ ...record(), [H.RECORD.EVALUATION_LINK]: formula(buildUrl(record())) }]);
  context.updateObjectRow_(sheet, 2, { [H.RECORD.EVALUATION_LINK]: '' });
  assert.strictEqual(sheet.cell(2, linkColumn), '');
});

test('the evaluation job emails full URLs, saves labels, and does not resend or alter old/future rows', () => {
  reset();
  const oldUrl = fallbackUrl + '?entry.0=OLD';
  const sheet = new FakeSheet(headers, [
    { ...record(1), [H.RECORD.EVALUATION_SENT]: STATUS.YES, [H.RECORD.EVALUATION_LINK]: oldUrl },
    record(2),
    { ...record(3), [H.RECORD.END_DATE]: new Date('2026-07-20T00:00:00') }
  ]);
  useSheet(sheet);
  run('sendEvaluationEmails(new Date("2026-07-08T00:00:00"));');
  assert.strictEqual(state.errors.length, 0);
  assert.strictEqual(state.sent.length, 1);
  const url = context.evaluationUrlFromCellFormula_(sheet.cell(3, linkColumn));
  assert.ok(url.startsWith(fallbackUrl + '?usp=pp_url&'));
  assert.strictEqual(state.sent[0].payload.htmlBody, '<a href="' + url + '">Open Evaluation</a>');
  assert.strictEqual(state.sent[0].payload.to, 'employee@example.com');
  assert.strictEqual(sheet.cell(2, linkColumn), oldUrl);
  assert.strictEqual(sheet.cell(4, linkColumn), '');
  assert.strictEqual(context.getDataObjects_(sheet)[1][H.RECORD.EVALUATION_SENT], STATUS.YES);
  run('sendEvaluationEmails(new Date("2026-07-08T00:00:00"));');
  assert.strictEqual(state.sent.length, 1);
  context.sendEvaluationEmail(context.getDataObjects_(sheet)[1]);
  assert.strictEqual(state.sent[1].payload.htmlBody, '<a href="' + url + '">Open Evaluation</a>');
});

let passed = 0;
for (const current of tests) {
  try { current.fn(); passed += 1; console.log('PASS ' + current.name); }
  catch (error) { console.error('FAIL ' + current.name); console.error(error.stack || error); process.exitCode = 1; }
}
console.log(passed + '/' + tests.length + ' evaluation-link tests passed.');
