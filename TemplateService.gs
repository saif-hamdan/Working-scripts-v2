/** HTML template data builders. */
function buildTemplateData_(record, extra) {
  var cfg = getConfig();
  var totalCompletedHours = getEmployeeTotalCompletedHours_(record);
  var rows = removeEmptyEmailRows_([
    { ar: 'رقم الطلب', en: 'Request ID', value: record[H.RECORD.REQUEST_ID] },
    { ar: 'معرف مجموعة الطلب', en: 'Request Group ID', value: record[H.RECORD.REQUEST_GROUP_ID] },
    { ar: 'رقم الاختيار', en: 'Selection Number', value: record[H.RECORD.OPTION_ORDER] },
    { ar: 'اسم الموظف', en: 'Employee Name', value: record[H.RECORD.EMPLOYEE_NAME] },
    { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: record[H.RECORD.EMPLOYEE_ID] },
    { ar: 'إجمالي ساعات التدوير المنجزة', en: 'Total Completed Rotation Hours', value: totalCompletedHours },
    { ar: 'المسمى الوظيفي للموظف', en: 'Employee Job Title', value: record[H.RECORD.EMPLOYEE_JOB_TITLE] },
    { ar: 'المسؤول المباشر', en: 'Line Manager', value: record[H.RECORD.DIRECT_MANAGER_NAME] },
    { ar: 'الوحدة الحالية', en: 'Current Unit', value: record[H.RECORD.CURRENT_UNIT] },
    { ar: 'القسم الحالي للموظف', en: 'Current Employee Section', value: record[H.RECORD.CURRENT_DEPARTMENT] },
    { ar: 'وحدة التدوير', en: 'Rotation Unit', value: record[H.RECORD.ROTATION_UNIT] },
    { ar: 'قسم التدوير', en: 'Rotation Section', value: record[H.RECORD.SECTION] },
    { ar: 'من تاريخ', en: 'Start Date', value: formatDate_(record[H.RECORD.START_DATE]) },
    { ar: 'إلى تاريخ', en: 'End Date', value: formatDate_(record[H.RECORD.END_DATE]) },
    { ar: 'عدد ساعات التدوير اليومية المطلوبة', en: 'Required Daily Rotation Hours', value: record[H.RECORD.HOURS] },
    { ar: 'عدد أيام العمل', en: 'Working Days (Sun–Thu)', value: record[H.RECORD.WORKING_DAYS] },
    { ar: 'إجمالي ساعات التدوير', en: 'Total Rotation Hours', value: record[H.RECORD.TOTAL_HOURS] },
    { ar: 'إجمالي ساعات التدوير المطلوبة', en: 'Total Requested Rotation Hours', value: record[H.RECORD.SUBMISSION_TOTAL_HOURS] }
  ]);
  var data = {
    record: record,
    rows: rows,
    brand: cfg.BRAND,
    orgAr: cfg.ORGANIZATION_NAME_AR,
    orgEn: cfg.ORGANIZATION_NAME_EN,
    approveUrl: '',
    rejectUrl: '',
    evaluationUrl: cfg.EVALUATION_FORM_URL,
    year: Utilities.formatDate(new Date(), SYSTEM.TIME_ZONE, 'yyyy')
  };
  Object.keys(extra || {}).forEach(function(k) { data[k] = extra[k]; });
  return data;
}

function buildGroupedRequestTemplateData_(records, extra) {
  records = (records || []).slice().sort(function(left, right) {
    return toNumber_(left[H.RECORD.OPTION_ORDER], 0) - toNumber_(right[H.RECORD.OPTION_ORDER], 0);
  });
  if (!records.length) throw new Error('At least one request record is required for a grouped email.');

  var first = records[0];
  var data = buildTemplateData_(first, extra);
  var totalCompletedHoursRow = data.rows.filter(function(row) {
    return row.en === 'Total Completed Rotation Hours';
  })[0];
  data.rows = removeEmptyEmailRows_([
    { ar: 'معرف مجموعة الطلب', en: 'Request Group ID', value: first[H.RECORD.REQUEST_GROUP_ID] },
    { ar: 'اسم الموظف', en: 'Employee Name', value: first[H.RECORD.EMPLOYEE_NAME] },
    { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: first[H.RECORD.EMPLOYEE_ID] },
    totalCompletedHoursRow,
    { ar: 'المسمى الوظيفي للموظف', en: 'Employee Job Title', value: first[H.RECORD.EMPLOYEE_JOB_TITLE] },
    { ar: 'المسؤول المباشر', en: 'Line Manager', value: first[H.RECORD.DIRECT_MANAGER_NAME] },
    { ar: 'الوحدة الحالية', en: 'Current Unit', value: first[H.RECORD.CURRENT_UNIT] },
    { ar: 'القسم الحالي للموظف', en: 'Current Employee Section', value: first[H.RECORD.CURRENT_DEPARTMENT] },
    { ar: 'عدد اختيارات التدوير', en: 'Rotation Selection Count', value: records.length },
    { ar: 'إجمالي ساعات التدوير المطلوبة', en: 'Total Requested Rotation Hours', value: first[H.RECORD.SUBMISSION_TOTAL_HOURS] }
  ].filter(Boolean));
  data.requests = records.map(function(record) {
    return {
      record: record,
      requestId: safeString_(record[H.RECORD.REQUEST_ID]),
      selectionNumber: safeString_(record[H.RECORD.OPTION_ORDER]),
      rows: removeEmptyEmailRows_([
        { ar: 'رقم الطلب', en: 'Request ID', value: record[H.RECORD.REQUEST_ID] },
        { ar: 'رقم الاختيار', en: 'Selection Number', value: record[H.RECORD.OPTION_ORDER] },
        { ar: 'وحدة التدوير', en: 'Rotation Unit', value: record[H.RECORD.ROTATION_UNIT] },
        { ar: 'قسم التدوير', en: 'Rotation Section', value: record[H.RECORD.SECTION] },
        { ar: 'من تاريخ', en: 'Start Date', value: formatDate_(record[H.RECORD.START_DATE]) },
        { ar: 'إلى تاريخ', en: 'End Date', value: formatDate_(record[H.RECORD.END_DATE]) },
        { ar: 'عدد ساعات التدوير اليومية المطلوبة', en: 'Required Daily Rotation Hours', value: record[H.RECORD.HOURS] },
        { ar: 'عدد أيام العمل', en: 'Working Days (Sun–Thu)', value: record[H.RECORD.WORKING_DAYS] },
        { ar: 'إجمالي ساعات التدوير', en: 'Total Rotation Hours', value: record[H.RECORD.TOTAL_HOURS] }
      ])
    };
  });
  data.requestCount = data.requests.length;
  return data;
}

function removeEmptyEmailRows_(rows) {
  return rows.filter(function(row) {
    return row.value !== null && row.value !== undefined && safeString_(row.value) !== '';
  });
}

function renderTemplate_(templateName, data) {
  var template = HtmlService.createTemplateFromFile(templateName);
  template.data = data;
  return template.evaluate().getContent();
}
