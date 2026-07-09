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

  OWNER_EMAIL: 'employeeservices@squ.edu.om',
  ADMIN_EMAILS: 'employeeservices@squ.edu.om',
  ORGANIZATION_NAME_AR: 'قسم خدمات الموظفين والمتقاعدين',
  ORGANIZATION_NAME_EN: 'Employees and Retirees Services Section',

  // Replace with official SQU brand values before go-live.
  BRAND_PRIMARY_COLOR: '#0B4EA2',
  BRAND_SECONDARY_COLOR: '#D4A017',
  BRAND_ACCENT_COLOR: '#C4CCE6',
  BRAND_LOGO_URL: '',

  APPROVER_UNIT_MODE: 'CURRENT_UNIT',
  EMAIL_SENDER_NAME: '',

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
  READY: 'BOOTSTRAP_READY',
  PRODUCTION_COMPATIBILITY_INDEX: 'BOOTSTRAP_PRODUCTION_COMPATIBILITY_INDEX',
  PRODUCTION_COMPATIBILITY_STATUS: 'BOOTSTRAP_PRODUCTION_COMPATIBILITY_STATUS'
};

const BSTATUS = {
  COMPLETE: 'Complete',
  IN_PROGRESS: 'In progress',
  FAILED: 'Failed',
  NOT_STARTED: 'Not started'
};

const BH = {
  DASHBOARD: ['الوحدة','القسم','رئيس الوحدة','بريد رئيس الوحدة','عدد الموظفين قيد التدوير النشط','الأرقام الوظيفية للموظفين قيد التدوير النشط','جميع من تم تدويرهم في القسم','آخر تاريخ تدوير وظيفي','حالة القسم'],
  RECORDS: ['رقم الطلب','الطابع الزمني','بريد مقدم الطلب','المسؤول المباشر','الرقم الوظيفي للمسؤول المباشر','بريد المسؤول المباشر','رقم محول المسؤول المباشر','اسم الموظف','الرقم الوظيفي للموظف','تاريخ تعيين الموظف','المسمى الوظيفي للموظف','بريد الموظف','الوحدة الحالية للموظف','القسم الحالي للموظف','رئيس الوحدة الحالية','بريد رئيس الوحدة الحالية','وحدة التدوير','قسم التدوير','من تاريخ','إلى تاريخ','عدد الساعات اليومية المطلوبة','نوع الطلب','حالة موافقة رئيس الوحدة','حالة الاعتماد النهائي','سبب الرفض','رقم الطلب المتعارض','تفاصيل التعارض','تاريخ إرسال بريد الموافقة','تاريخ الرد','رابط التقييم','تم إرسال التقييم','تاريخ إرسال التقييم','آخر تحديث','ملاحظات','رمز الموافقة','بريد المعتمد','معرف رد النموذج','إصدار القفل','عدد محاولات البريد','آخر خطأ','معرف مصدر رد النموذج'],
  UNITS: ['معرف الوحدة','اسم الوحدة','رئيس الوحدة','مسمى وظيفي رئيس الوحدة','بريد رئيس الوحدة','نشط'],
  SECTIONS: ['معرف القسم','معرف الوحدة','اسم الوحدة','اسم القسم','نشط','السعة'],
  SETTINGS: ['المفتاح','القيمة']
};

const BFORM = {
  SECTION_PAGE_PREFIX: 'قسم التدوير / Rotation Section - ',
  SECTION_QUESTION_PREFIX: 'قسم التدوير / Rotation Section - ',
  NO_UNITS: 'لا توجد وحدات نشطة حالياً / No active units are available',
  NO_SECTIONS: 'لا توجد أقسام متاحة حالياً / No sections are currently available',
  TITLES: {
    FORM_TITLE: 'استمارة تحديد مسار التدوير الوظيفي للموظفين الجدد / New Employee Job Rotation Path Form',
    FORM_DESCRIPTION: 'في إطار تطوير الأداء المؤسسي وتأهيل الموظفين الجدد، تم إعداد هذه الاستبانة لتحديد مسار التدوير الوظيفي بما يدعم اكتساب الخبرات العملية وتسريع اندماج الموظف في بيئة العمل.\nTo support institutional performance enhancement and the effective onboarding of new employees, this form has been developed to identify each employee\'s job rotation pathway, facilitating the acquisition of practical experience and accelerating integration into the work environment.',
    LINE_MANAGER_SECTION: 'بيانات المسؤول المباشر / Line Manager Details',
    DIRECT_MANAGER_NAME: 'اسم المسؤول المباشر / Line Manager Name',
    DIRECT_MANAGER_ID: 'رقم وظيفي المسؤول المباشر / Line Manager Employee ID',
    DIRECT_MANAGER_EMAIL: 'بريد الالكتروني المسؤول المباشر / Line Manager Email',
    DIRECT_MANAGER_EXTENSION: 'رقم محول المسؤول المباشر / Line Manager Extension',
    EMPLOYEE_SECTION: 'بيانات الموظف / Employee Details',
    EMPLOYEE_NAME: 'اسم الموظف / Employee Name',
    EMPLOYEE_ID: 'رقم وظيفي الموظف / Employee ID',
    EMPLOYEE_HIRE_DATE: 'تاريخ تعيين الموظف / Employee Hire Date',
    EMPLOYEE_JOB_TITLE: 'المسمى الوظيفي للموظف / Employee Job Title',
    EMPLOYEE_EMAIL: 'البريد الالكتروني للموظف / Employee Email',
    CURRENT_EMPLOYEE_SECTION: 'بيانات الموظف الحالية / Current Employee Details',
    CURRENT_UNIT: 'الوحدة الحالية للموظف / Current Employee Unit',
    CURRENT_DEPARTMENT: 'القسم الحالي للموظف / Current Employee Department',
    ROTATION_SECTION: 'بيانات التدوير الوظيفي / Job Rotation Details',
    START_DATE: 'تاريخ بداية التدوير / Rotation Start Date',
    END_DATE: 'تاريخ نهاية التدوير / Rotation End Date',
    HOURS: 'عدد الساعات اليومية المطلوبة / Required Daily Hours',
    NOTES: 'ملاحظات إضافية / Additional Notes',
    ROTATION_UNIT: 'وحدة التدوير / Rotation Unit',
    ROTATION_DEPARTMENT: 'قسم التدوير / Rotation Section'
  }
};
