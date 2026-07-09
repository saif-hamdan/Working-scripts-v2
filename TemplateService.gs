/** HTML template data builders. */
function buildTemplateData_(record, extra) {
  var cfg = getConfig();
  var rows = [
    { ar: 'رقم الطلب', en: 'Request ID', value: record[H.RECORD.REQUEST_ID] },
    { ar: 'الطابع الزمني', en: 'Timestamp', value: formatDateTime_(record[H.RECORD.TIMESTAMP]) },
    { ar: 'بريد مقدم الطلب', en: 'Submitter Email', value: record[H.RECORD.SUBMITTER_EMAIL] },
    { ar: 'اسم الموظف', en: 'Employee', value: record[H.RECORD.EMPLOYEE_NAME] },
    { ar: 'الرقم الوظيفي للموظف', en: 'Employee ID', value: record[H.RECORD.EMPLOYEE_ID] },
    { ar: 'تاريخ تعيين الموظف', en: 'Employee Hire Date', value: formatDate_(record[H.RECORD.EMPLOYEE_HIRE_DATE]) },
    { ar: 'المسمى الوظيفي للموظف', en: 'Employee Job Title', value: record[H.RECORD.EMPLOYEE_JOB_TITLE] },
    { ar: 'بريد الموظف', en: 'Employee Email', value: record[H.RECORD.EMPLOYEE_EMAIL] },
    { ar: 'المسؤول المباشر', en: 'Line Manager', value: record[H.RECORD.DIRECT_MANAGER_NAME] },
    { ar: 'الرقم الوظيفي للمسؤول المباشر', en: 'Line Manager Employee ID', value: record[H.RECORD.DIRECT_MANAGER_ID] },
    { ar: 'بريد المسؤول المباشر', en: 'Line Manager Email', value: record[H.RECORD.DIRECT_MANAGER_EMAIL] },
    { ar: 'رقم محول المسؤول المباشر', en: 'Line Manager Extension', value: record[H.RECORD.DIRECT_MANAGER_EXTENSION] },
    { ar: 'الوحدة الحالية', en: 'Current Unit', value: record[H.RECORD.CURRENT_UNIT] },
    { ar: 'القسم الحالي للموظف', en: 'Current Employee Department', value: record[H.RECORD.CURRENT_DEPARTMENT] },
    { ar: 'رئيس الوحدة الحالية', en: 'Current Unit Head', value: record[H.RECORD.CURRENT_UNIT_HEAD] },
    { ar: 'بريد رئيس الوحدة الحالية', en: 'Current Unit Head Email', value: record[H.RECORD.CURRENT_UNIT_HEAD_EMAIL] },
    { ar: 'وحدة التدوير', en: 'Rotation Unit', value: record[H.RECORD.ROTATION_UNIT] },
    { ar: 'قسم التدوير', en: 'Rotation Section', value: record[H.RECORD.SECTION] },
    { ar: 'من تاريخ', en: 'Start Date', value: formatDate_(record[H.RECORD.START_DATE]) },
    { ar: 'إلى تاريخ', en: 'End Date', value: formatDate_(record[H.RECORD.END_DATE]) },
    { ar: 'عدد الساعات اليومية المطلوبة', en: 'Required Daily Hours', value: record[H.RECORD.HOURS] },
    { ar: 'نوع الطلب', en: 'Request Type', value: record[H.RECORD.TYPE] },
    { ar: 'حالة موافقة رئيس الوحدة', en: 'Unit Head Approval Status', value: record[H.RECORD.HEAD_STATUS] },
    { ar: 'حالة الاعتماد النهائي من الإدارة', en: 'Final Admin Approval Status', value: record[H.RECORD.FINAL_STATUS] },
    { ar: 'سبب الرفض', en: 'Rejection Reason', value: record[H.RECORD.REJECTION_REASON] },
    { ar: 'رقم الطلب المتعارض', en: 'Conflicting Request ID', value: record[H.RECORD.CONFLICT_ID] },
    { ar: 'تفاصيل التعارض', en: 'Conflict Details', value: record[H.RECORD.CONFLICT_DETAILS] },
    { ar: 'تاريخ إرسال بريد الموافقة', en: 'Approval Email Sent At', value: formatDateTime_(record[H.RECORD.APPROVAL_EMAIL_SENT_AT]) },
    { ar: 'تاريخ الرد', en: 'Decision Date', value: formatDateTime_(record[H.RECORD.DECISION_DATE]) },
    { ar: 'رابط التقييم', en: 'Evaluation Link', value: record[H.RECORD.EVALUATION_LINK] },
    { ar: 'تم إرسال التقييم', en: 'Evaluation Sent', value: record[H.RECORD.EVALUATION_SENT] },
    { ar: 'تاريخ إرسال التقييم', en: 'Evaluation Sent At', value: formatDateTime_(record[H.RECORD.EVALUATION_SENT_AT]) },
    { ar: 'آخر تحديث', en: 'Last Updated', value: formatDateTime_(record[H.RECORD.LAST_UPDATED]) },
    { ar: 'ملاحظات', en: 'Notes', value: record[H.RECORD.NOTES] },
    { ar: 'بريد المعتمد', en: 'Approver Email', value: record[H.RECORD.APPROVER_EMAIL] },
    { ar: 'معرف رد النموذج', en: 'Form Response ID', value: record[H.RECORD.FORM_RESPONSE_ID] },
    { ar: 'معرف مصدر رد النموذج', en: 'Form Response Source ID', value: record[H.RECORD.FORM_RESPONSE_SOURCE_ID] }
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
