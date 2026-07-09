/** HTML template data builders. */
function buildTemplateData_(record, extra) {
  var cfg = getConfig();
  var rows = [
    { ar: 'رقم الطلب', en: 'Request ID', value: record[H.RECORD.REQUEST_ID] },
    { ar: 'اسم الموظف', en: 'Employee', value: record[H.RECORD.EMPLOYEE_NAME] },
    { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: record[H.RECORD.EMPLOYEE_ID] },
    { ar: 'بريد الموظف', en: 'Employee Email', value: record[H.RECORD.EMPLOYEE_EMAIL] },
    { ar: 'المسؤول المباشر', en: 'Line Manager', value: record[H.RECORD.DIRECT_MANAGER_NAME] },
    { ar: 'بريد المسؤول المباشر', en: 'Line Manager Email', value: record[H.RECORD.DIRECT_MANAGER_EMAIL] },
    { ar: 'الوحدة الحالية', en: 'Current Unit', value: record[H.RECORD.CURRENT_UNIT] },
    { ar: 'وحدة التدوير', en: 'Rotation Unit', value: record[H.RECORD.ROTATION_UNIT] },
    { ar: 'قسم التدوير', en: 'Rotation Section', value: record[H.RECORD.SECTION] },
    { ar: 'من تاريخ', en: 'Start Date', value: formatDate_(record[H.RECORD.START_DATE]) },
    { ar: 'إلى تاريخ', en: 'End Date', value: formatDate_(record[H.RECORD.END_DATE]) },
    { ar: 'عدد الساعات اليومية المطلوبة', en: 'Required Daily Hours', value: record[H.RECORD.HOURS] },
    { ar: 'نوع الطلب', en: 'Request Type', value: record[H.RECORD.TYPE] },
    { ar: 'حالة موافقة رئيس الوحدة', en: 'Unit Head Approval Status', value: record[H.RECORD.HEAD_STATUS] },
    { ar: 'حالة الاعتماد النهائي من الإدارة', en: 'Final Admin Approval Status', value: record[H.RECORD.FINAL_STATUS] }
  ];
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

function renderTemplate_(templateName, data) {
  var template = HtmlService.createTemplateFromFile(templateName);
  template.data = data;
  return template.evaluate().getContent();
}
