/**
 * One-time bootstrap configuration.
 * Leave IDs empty to create new files, or paste existing IDs to prepare existing files.
 */
const BOOTSTRAP_CONFIG = {
  CREATE_NEW_DASHBOARD_SPREADSHEET: true,
  EXISTING_DASHBOARD_SPREADSHEET_ID: '',

  CREATE_NEW_MAIN_FORM: true,
  EXISTING_MAIN_FORM_ID: '',

  CREATE_NEW_EVALUATION_FORM: true,
  EXISTING_EVALUATION_FORM_ID: '',

  OWNER_EMAIL: 'saif.alkaanuni@gmail.com',
  ADMIN_EMAILS: 'saif.alkaanuni@gmail.com',
  ORGANIZATION_NAME_AR: 'جامعة السلطان قابوس',
  ORGANIZATION_NAME_EN: 'Sultan Qaboos University',

  // Replace with official SQU brand values before go-live.
  BRAND_PRIMARY_COLOR: '#004B3A',
  BRAND_SECONDARY_COLOR: '#B08D57',
  BRAND_ACCENT_COLOR: '#F5F1E8',
  BRAND_LOGO_URL: '',

  APPROVER_UNIT_MODE: 'TRAINING_UNIT',
  EMAIL_SENDER_NAME: 'SQU Training System',

  // Staged setup controls.
  FORCE_CREATE_NEW_RESOURCES: false,
  REBUILD_MAIN_FORM_ITEMS: true,
  REBUILD_EVALUATION_FORM_ITEMS: true,
  MAIN_FORM_BRANCH_UNITS_PER_RUN: 25,
  MAIN_FORM_BRANCH_TIME_BUDGET_MS: 260000,
  PROTECT_SHEETS: true,
  DUMMY_HEAD_EMAIL: 'saif.alkaanuni@gmail.com'
};

const BS = {
  DASHBOARD: 'لوحة الأقسام',
  RECORDS: 'سجل الطلبات',
  CHARTS: 'الرسوم والمؤشرات',
  ADMIN_UNITS: 'إدارة الوحدات',
  ADMIN_SECTIONS: 'إدارة الأقسام',
  UNITS: 'الوحدات',
  SECTIONS: 'الأقسام',
  SETTINGS: 'الإعدادات',
  SUMMARY: 'Setup Summary'
};

const BSPROP = {
  DASHBOARD_ID: 'BOOTSTRAP_DASHBOARD_SPREADSHEET_ID',
  MAIN_FORM_ID: 'BOOTSTRAP_MAIN_FORM_ID',
  EVALUATION_FORM_ID: 'BOOTSTRAP_EVALUATION_FORM_ID',
  DASHBOARD_URL: 'BOOTSTRAP_DASHBOARD_URL',
  MAIN_FORM_EDIT_URL: 'BOOTSTRAP_MAIN_FORM_EDIT_URL',
  MAIN_FORM_PUBLISHED_URL: 'BOOTSTRAP_MAIN_FORM_PUBLISHED_URL',
  EVALUATION_FORM_EDIT_URL: 'BOOTSTRAP_EVALUATION_FORM_EDIT_URL',
  EVALUATION_FORM_PUBLISHED_URL: 'BOOTSTRAP_EVALUATION_FORM_PUBLISHED_URL',
  BRANCH_INDEX: 'BOOTSTRAP_MAIN_FORM_BRANCH_INDEX',
  BRANCH_TOTAL: 'BOOTSTRAP_MAIN_FORM_BRANCH_TOTAL',
  BRANCH_COMPLETE: 'BOOTSTRAP_MAIN_FORM_BRANCH_COMPLETE',
  LAST_STEP: 'BOOTSTRAP_LAST_STEP',
  LAST_STATUS: 'BOOTSTRAP_LAST_STATUS',
  LAST_MESSAGE: 'BOOTSTRAP_LAST_MESSAGE',
  LAST_UPDATED: 'BOOTSTRAP_LAST_UPDATED',
  VALIDATION_STATUS: 'BOOTSTRAP_VALIDATION_STATUS',
  VALIDATION_ISSUES_JSON: 'BOOTSTRAP_VALIDATION_ISSUES_JSON',
  REFERENCE_DATA_HASH: 'BOOTSTRAP_REFERENCE_DATA_HASH',
  LAST_REFERENCE_SYNC: 'BOOTSTRAP_LAST_REFERENCE_SYNC',
  READY: 'BOOTSTRAP_READY'
};

const BSTATUS = {
  COMPLETE: 'Complete',
  IN_PROGRESS: 'In progress',
  FAILED: 'Failed',
  NOT_STARTED: 'Not started'
};

const BH = {
  DASHBOARD: ['الوحدة','القسم','رئيس الوحدة','بريد رئيس الوحدة','عدد المتدربين النشطين','المتدربون النشطون','جميع من تدربوا في القسم','آخر تاريخ تدريب','حالة القسم'],
  RECORDS: ['رقم الطلب','الطابع الزمني','بريد مقدم الطلب','اسم المدير المباشر','بريد المدير المباشر','اسم الموظف الجديد','بريد الموظف الجديد','الوحدة الحالية للموظف','رئيس الوحدة الحالية','بريد رئيس الوحدة الحالية','وحدة التدريب المطلوبة','القسم المطلوب','من تاريخ','إلى تاريخ','عدد الساعات','نوع الطلب','حالة موافقة رئيس الوحدة','حالة الاعتماد النهائي','سبب الرفض','رقم الطلب المتعارض','تفاصيل التعارض','تاريخ إرسال بريد الموافقة','تاريخ الرد','رابط التقييم','تم إرسال التقييم','تاريخ إرسال التقييم','آخر تحديث','ملاحظات','رمز الموافقة','بريد المعتمد','معرف رد النموذج','إصدار القفل','عدد محاولات البريد','آخر خطأ','معرف مصدر رد النموذج'],
  UNITS: ['معرف الوحدة','اسم الوحدة','رئيس الوحدة','بريد رئيس الوحدة','نشط'],
  SECTIONS: ['معرف القسم','معرف الوحدة','اسم الوحدة','اسم القسم','نشط','السعة'],
  SETTINGS: ['المفتاح','القيمة']
};

const BFORM = {
  SECTION_PAGE_PREFIX: 'اختيار القسم - ',
  SECTION_QUESTION_PREFIX: 'القسم المطلوب / Requested Section - ',
  NO_UNITS: 'لا توجد وحدات نشطة حالياً / No active units are available',
  NO_SECTIONS: 'لا توجد أقسام متاحة حالياً / No sections are currently available',
  TITLES: {
    DIRECT_MANAGER_NAME: 'اسم المدير المباشر / Direct Manager Name',
    DIRECT_MANAGER_EMAIL: 'بريد المدير المباشر / Direct Manager Email',
    EMPLOYEE_NAME: 'اسم الموظف الجديد / New Employee Name',
    EMPLOYEE_EMAIL: 'بريد الموظف الجديد / New Employee Email',
    CURRENT_UNIT: 'الوحدة الحالية للموظف / Current Unit',
    START_DATE: 'من تاريخ / Start Date',
    END_DATE: 'إلى تاريخ / End Date',
    HOURS: 'عدد الساعات / Training Hours',
    NOTES: 'ملاحظات إضافية / Additional Notes',
    TRAINING_UNIT: 'وحدة التدريب المطلوبة / Requested Training Unit'
  }
};
