/**
 * SQU Job Rotation System - Constants
 * All dashboard-facing headers are Arabic. Internal/system fields are also Arabic.
 */
const SYSTEM = Object.freeze({
  VERSION: '1.0.0',
  TIME_ZONE: 'Asia/Muscat',
  REQUEST_PREFIX: 'TRN'
});

const RESPONSE_QUEUE_BATCH_SIZE = 25;
const ACTION_QUEUE_BATCH_SIZE = 25;
const EMAIL_QUEUE_BATCH_SIZE = 50;
const QUEUE_SCAN_WINDOW_ROWS = 500;
const RESPONSE_QUEUE_MIN_BATCH_SIZE = 1;
const RESPONSE_QUEUE_MAX_BATCH_SIZE = 100;
const RESPONSE_QUEUE_MAX_SCAN_WINDOW_ROWS = 2000;
const RESPONSE_QUEUE_SCAN_CURSOR_KEY = 'RESPONSE_QUEUE_NEXT_SCAN_ROW';
const EMAIL_QUEUE_SCAN_CURSOR_KEY = 'EMAIL_QUEUE_NEXT_SCAN_ROW';
const ACTION_QUEUE_SCAN_CURSOR_KEY = 'ACTION_QUEUE_NEXT_SCAN_ROW';

const SYNC_CONFIG = Object.freeze({
  TIMEZONE: SYSTEM.TIME_ZONE,
  ACTIVE_START_HOUR: 5,
  ACTIVE_END_HOUR: 22,
  LOCK_WAIT_MS: 3000,
  MAX_SINGLE_RUN_MS: 5.5 * 60 * 1000,
  DAILY_RUNTIME_BUDGET_MS: 5.5 * 60 * 60 * 1000,
  TRIGGER_EVERY_MINUTES: 5,
  RUNTIME_KEY_PREFIX: 'SYNC_RUNTIME_MS_',
  RUNTIME_RETENTION_DAYS: 14,
  LAST_DASHBOARD_REFRESH_KEY: 'SYNC_LAST_DASHBOARD_REFRESH_AT',
  LAST_FORM_REFRESH_KEY: 'SYNC_LAST_FORM_REFRESH_AT',
  DASHBOARD_REFRESH_INTERVAL_MS: 45 * 60 * 1000
});

const SHEETS = Object.freeze({
  DASHBOARD: 'لوحة الأقسام',
  RECORDS: 'سجل الطلبات',
  ADMIN_UNITS: 'إدارة الوحدات',
  ADMIN_SECTIONS: 'إدارة الأقسام',
  UNITS: 'الوحدات',
  SECTIONS: 'الأقسام',
  SETTINGS: 'الإعدادات',
  LOG: 'سجل النظام',
  EMAIL_QUEUE: 'طابور البريد',
  ACTION_QUEUE: 'طابور القرارات',
  REQUEST_SOURCE_INDEX: 'Request Source Index',
  EMPLOYEE_ROTATION_HOURS: 'ملخص ساعات التدوير الوظيفي للموظفين'
});

const H = Object.freeze({
  DASHBOARD: Object.freeze({
    UNIT: 'الوحدة',
    SECTION: 'القسم',
    HEAD: 'رئيس الوحدة',
    HEAD_EMAIL: 'بريد رئيس الوحدة',
    ACTIVE_COUNT: 'عدد الموظفين في التدوير النشط',
    ACTIVE_TRAINEES: 'الأرقام الوظيفية للموظفين في التدوير النشط',
    ALL_TRAINEES: 'جميع من أتموا التدوير في القسم',
    LAST_ROTATION: 'آخر تاريخ تدوير',
    STATUS: 'حالة القسم'
  }),
  RECORD: Object.freeze({
    REQUEST_ID: 'رقم الطلب',
    TIMESTAMP: 'الطابع الزمني',
    SUBMITTER_EMAIL: 'بريد مقدم الطلب',
    DIRECT_MANAGER_NAME: 'المسؤول المباشر',
    DIRECT_MANAGER_ID: 'الرقم الوظيفي للمسؤول المباشر',
    DIRECT_MANAGER_EMAIL: 'بريد المسؤول المباشر',
    DIRECT_MANAGER_EXTENSION: 'رقم محول المسؤول المباشر',
    EMPLOYEE_NAME: 'اسم الموظف',
    EMPLOYEE_ID: 'الرقم الوظيفي للموظف',
    EMPLOYEE_HIRE_DATE: 'تاريخ تعيين الموظف',
    EMPLOYEE_JOB_TITLE: 'المسمى الوظيفي للموظف',
    EMPLOYEE_EMAIL: 'بريد الموظف',
    CURRENT_UNIT: 'الوحدة الحالية للموظف',
    CURRENT_DEPARTMENT: 'القسم الحالي للموظف',
    CURRENT_UNIT_HEAD: 'رئيس الوحدة الحالية',
    CURRENT_UNIT_HEAD_EMAIL: 'بريد رئيس الوحدة الحالية',
    ROTATION_UNIT: 'وحدة التدوير',
    SECTION: 'قسم التدوير',
    OPTION_ORDER: 'رقم الخيار',
    START_DATE: 'من تاريخ',
    END_DATE: 'إلى تاريخ',
    HOURS: 'عدد الساعات اليومية المطلوبة',
    TYPE: 'نوع الطلب',
    HEAD_STATUS: 'حالة موافقة رئيس الوحدة',
    FINAL_STATUS: 'حالة الاعتماد النهائي',
    REJECTION_REASON: 'سبب الرفض',
    CONFLICT_ID: 'رقم الطلب المتعارض',
    CONFLICT_DETAILS: 'تفاصيل التعارض',
    APPROVAL_EMAIL_SENT_AT: 'تاريخ إرسال بريد الموافقة',
    DECISION_DATE: 'تاريخ الرد',
    EVALUATION_LINK: 'رابط التقييم',
    EVALUATION_SENT: 'تم إرسال التقييم',
    EVALUATION_SENT_AT: 'تاريخ إرسال التقييم',
    LAST_UPDATED: 'آخر تحديث',
    NOTES: 'ملاحظات',
    TOKEN: 'رمز الموافقة',
    APPROVER_EMAIL: 'بريد المعتمد',
    FORM_RESPONSE_ID: 'معرف رد النموذج',
    LOCK_VERSION: 'إصدار القفل',
    EMAIL_RETRY_COUNT: 'عدد محاولات البريد',
    LAST_ERROR: 'آخر خطأ',
    FORM_RESPONSE_SOURCE_ID: 'معرف مصدر رد النموذج'
  }),
  UNIT: Object.freeze({
    UNIT_ID: 'معرف الوحدة',
    UNIT_NAME: 'اسم الوحدة',
    HEAD_NAME: 'رئيس الوحدة',
    HEAD_TITLE: 'مسمى وظيفي رئيس الوحدة',
    HEAD_EMAIL: 'بريد رئيس الوحدة',
    ACTIVE: 'نشط'
  }),
  SECTION: Object.freeze({
    SECTION_ID: 'معرف القسم',
    UNIT_ID: 'معرف الوحدة',
    UNIT_NAME: 'اسم الوحدة',
    SECTION_NAME: 'اسم القسم',
    ACTIVE: 'نشط',
    CAPACITY: 'السعة'
  }),
  SETTINGS: Object.freeze({
    KEY: 'المفتاح',
    VALUE: 'القيمة'
  }),
  LOG: Object.freeze({
    TIME: 'الوقت',
    FUNCTION: 'الدالة',
    REQUEST_ID: 'رقم الطلب',
    ACTION: 'الإجراء',
    LEVEL: 'المستوى',
    MESSAGE: 'الرسالة',
    ERROR_JSON: 'تفاصيل الخطأ'
  }),
  ACTION_QUEUE: Object.freeze({
    ACTION_ID: 'معرف القرار',
    CREATED_AT: 'أنشئ في',
    TOKEN: 'رمز الموافقة',
    ACTION: 'الإجراء',
    REASON: 'سبب الرفض',
    STATUS: 'الحالة',
    ATTEMPTS: 'عدد المحاولات',
    LAST_ERROR: 'آخر خطأ',
    PROCESSED_AT: 'تاريخ المعالجة'
  }),
  REQUEST_SOURCE_INDEX: Object.freeze({
    FORM_RESPONSE_ID: 'FORM_RESPONSE_ID',
    FORM_RESPONSE_SOURCE_ID: 'FORM_RESPONSE_SOURCE_ID',
    REQUEST_ID: 'REQUEST_ID',
    CREATED_AT: 'CREATED_AT'
  }),
  EMPLOYEE_ROTATION_HOURS: Object.freeze({
    EMPLOYEE_NAME: 'اسم الموظف',
    EMPLOYEE_ID: 'الرقم الوظيفي للموظف',
    COMPLETED_HOURS: 'إجمالي ساعات التدوير المنجز',
    ONGOING_HOURS: 'إجمالي ساعات التدوير الجاري'
  }),
  QUEUE: Object.freeze({
    MESSAGE_ID: 'معرف الرسالة',
    STATUS: 'الحالة',
    TO: 'المستلمون',
    CC: 'نسخة',
    BCC: 'نسخة مخفية',
    SUBJECT: 'الموضوع',
    HTML: 'نص الرسالة',
    CONTEXT_JSON: 'بيانات السياق',
    ATTEMPTS: 'عدد المحاولات',
    LAST_ERROR: 'آخر خطأ',
    CREATED_AT: 'أنشئت في',
    LAST_ATTEMPT_AT: 'آخر محاولة'
  })
});

const DASHBOARD_HEADERS = Object.freeze(Object.values(H.DASHBOARD));
const RECORD_HEADERS = Object.freeze(Object.values(H.RECORD));
const UNIT_HEADERS = Object.freeze(Object.values(H.UNIT));
const SECTION_HEADERS = Object.freeze(Object.values(H.SECTION));
const SETTINGS_HEADERS = Object.freeze(Object.values(H.SETTINGS));
const LOG_HEADERS = Object.freeze(Object.values(H.LOG));
const QUEUE_HEADERS = Object.freeze(Object.values(H.QUEUE));
const ACTION_QUEUE_HEADERS = Object.freeze(Object.values(H.ACTION_QUEUE));
const REQUEST_SOURCE_INDEX_HEADERS = Object.freeze(Object.values(H.REQUEST_SOURCE_INDEX));
const EMPLOYEE_ROTATION_HOURS_HEADERS = Object.freeze(Object.values(H.EMPLOYEE_ROTATION_HOURS));

const EMPLOYEE_ROTATION_HOURS_CONFIG = Object.freeze({
  TIMEZONE: SYSTEM.TIME_ZONE,
  TRIGGER_EVERY_MINUTES: 10,
  ACTIVE_START_MINUTES: 22 * 60,
  ACTIVE_END_MINUTES: (23 * 60) + 50
});

const STATUS = Object.freeze({
  YES: 'نعم',
  NO: 'لا',
  AVAILABLE: 'متاح',
  OCCUPIED: 'مشغول',
  TYPE_INTERNAL: 'داخلي',
  TYPE_EXTERNAL: 'خارجي',
  TYPE_ROTATION: 'تدوير وظيفي',
  HEAD_PENDING: 'بانتظار موافقة رئيس الوحدة',
  HEAD_ACCEPTED: 'موافق عليه من رئيس الوحدة',
  HEAD_REJECTED: 'مرفوض من رئيس الوحدة',
  HEAD_CONFLICT: 'تعذر الاعتماد بسبب التعارض',
  HEAD_EMPLOYEE_ACTIVE: 'مرفوض تلقائياً لوجود تدوير وظيفي نشط للموظف',
  FINAL_PENDING: 'قيد الاعتماد النهائي',
  FINAL_APPROVED: 'معتمد',
  FINAL_IN_PROGRESS: 'قيد التنفيذ',
  FINAL_DONE: 'منجز',
  FINAL_REJECTED: 'مرفوض',
  FINAL_CONFLICT: 'مرفوض تلقائياً بسبب التعارض',
  FINAL_EMPLOYEE_ACTIVE: 'مرفوض تلقائياً لوجود تدوير وظيفي نشط للموظف',
  QUEUE_PENDING: 'بانتظار الإرسال',
  QUEUE_SENT: 'تم الإرسال',
  QUEUE_FAILED: 'فشل الإرسال',
  ACTION_QUEUE_PENDING: 'بانتظار المعالجة',
  ACTION_QUEUE_PROCESSED: 'تمت المعالجة',
  ACTION_QUEUE_FAILED: 'فشلت المعالجة - ستعاد المحاولة',
  ACTION_QUEUE_REQUIRES_REVIEW: 'تتطلب مراجعة يدوية'
});

const FINAL_STATUS_OPTIONS = Object.freeze([
  STATUS.FINAL_PENDING,
  STATUS.FINAL_APPROVED,
  STATUS.FINAL_IN_PROGRESS,
  STATUS.FINAL_DONE,
  STATUS.FINAL_REJECTED,
  STATUS.FINAL_CONFLICT,
  STATUS.FINAL_EMPLOYEE_ACTIVE
]);

const ACTIVE_FINAL_STATUSES = Object.freeze([
  STATUS.FINAL_APPROVED,
  STATUS.FINAL_IN_PROGRESS,
  STATUS.FINAL_DONE
]);

const APPROVED_EVALUATION_FINAL_STATUSES = Object.freeze([
  STATUS.FINAL_APPROVED,
  STATUS.FINAL_DONE
]);

const SETTINGS_KEYS = Object.freeze({
  DASHBOARD_SPREADSHEET_ID: 'DASHBOARD_SPREADSHEET_ID',
  MAIN_FORM_ID: 'MAIN_FORM_ID',
  FORM_RESPONSES_SPREADSHEET_ID: 'FORM_RESPONSES_SPREADSHEET_ID',
  RESPONSE_QUEUE_MAX_RETRIES: 'RESPONSE_QUEUE_MAX_RETRIES',
  RESPONSE_QUEUE_BATCH_SIZE: 'RESPONSE_QUEUE_BATCH_SIZE',
  QUEUE_SCAN_WINDOW_ROWS: 'QUEUE_SCAN_WINDOW_ROWS',
  ACTION_QUEUE_MAX_RETRIES: 'ACTION_QUEUE_MAX_RETRIES',
  EVALUATION_FORM_URL: 'EVALUATION_FORM_URL',
  WEB_APP_URL: 'WEB_APP_URL',
  OWNER_EMAIL: 'OWNER_EMAIL',
  ADMIN_EMAILS: 'ADMIN_EMAILS',
  APPROVER_UNIT_MODE: 'APPROVER_UNIT_MODE',
  EMAIL_SENDER_NAME: 'EMAIL_SENDER_NAME',
  ORGANIZATION_NAME_AR: 'ORGANIZATION_NAME_AR',
  ORGANIZATION_NAME_EN: 'ORGANIZATION_NAME_EN',
  BRAND_PRIMARY_COLOR: 'BRAND_PRIMARY_COLOR',
  BRAND_SECONDARY_COLOR: 'BRAND_SECONDARY_COLOR',
  BRAND_ACCENT_COLOR: 'BRAND_ACCENT_COLOR',
  BRAND_LOGO_URL: 'BRAND_LOGO_URL',
  EVALUATION_ALLOWED_FINAL_STATUSES: 'EVALUATION_ALLOWED_FINAL_STATUSES'
});

const APPROVER_UNIT_MODE = Object.freeze({
  ROTATION_UNIT: 'ROTATION_UNIT',
  CURRENT_UNIT: 'CURRENT_UNIT'
});

const FORM = Object.freeze({
  ROTATION_ROUTER_PAGE_TITLE: 'اختيار وحدة التدوير / Select Rotation Unit',
  ROTATION_BRANCH_PAGE_PREFIX: 'اختيار أقسام التدوير / Select Rotation Sections - ',
  ROTATION_SCHEDULE_PAGE_PREFIX: 'جدول اختيار التدوير رقم / Schedule for Rotation Selection ',
  SECTION_PAGE_PREFIX: 'قسم التدوير / Rotation Section - ',
  SECTION_QUESTION_PREFIX: 'قسم التدوير / Rotation Section - ',
  INTERNAL_BRANCH_PAGE_PREFIX: 'التدوير الداخلي حسب الوحدة / Internal Rotation by Unit - ',
  EXTERNAL_ROUTER_PAGE_PREFIX: 'اختيار وحدة التدوير الخارجي / Select External Rotation Unit - ',
  EXTERNAL_BRANCH_PAGE_PREFIX: 'تفاصيل التدوير الخارجي / External Rotation Details - ',
  MAX_ROTATION_OPTIONS: 5,
  MAX_INTERNAL_OPTIONS: 3,
  MAX_EXTERNAL_OPTIONS: 3,
  NO_AVAILABLE_SECTIONS: 'لا توجد أقسام متاحة حالياً',
  NO_EXTERNAL_ROTATION: 'لا أرغب في إضافة تدوير خارجي / No external rotation',
  TITLES: Object.freeze({
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
    CURRENT_DEPARTMENT: 'القسم الحالي للموظف / Current Employee Section',
    ROTATION_SECTION: 'بيانات التدوير الوظيفي / Job Rotation Details',
    ROTATION_SECTION_PREFIX: 'اختيار التدوير {n}: القسم / Rotation Selection {n}: Section',
    OPTIONAL_ROTATION_GRID: 'اختيارات التدوير الإضافية / Additional Rotation Selections',
    OPTIONAL_ROTATION_GRID_ROW_PREFIX: 'اختيار التدوير {n} / Rotation Selection {n}',
    ROTATION_FROM_PREFIX: 'اختيار التدوير {n}: من تاريخ / Rotation Selection {n}: From',
    ROTATION_TO_PREFIX: 'اختيار التدوير {n}: إلى تاريخ / Rotation Selection {n}: To',
    ROTATION_HOURS_PREFIX: 'اختيار التدوير {n}: الساعات اليومية / Rotation Selection {n}: Daily Hours',
    ROTATION_ADD_MORE_PREFIX: 'هل تريد إضافة قسم تدوير آخر (الاختيار {n})؟ / Do you want to add another rotation section (Selection {n})?',
    ROTATION_ADD_MORE_YES: 'نعم / Yes',
    ROTATION_ADD_MORE_NO: 'لا، إنهاء الطلب / No, finish the request',
    PHASE_ONE_INTERNAL: 'المرحلة الأولى: التدوير داخل الوحدة / Phase One: Rotation Inside the Current Unit',
    PHASE_TWO_EXTERNAL: 'المرحلة الثانية: التدوير خارج الوحدة / Phase Two: Rotation Outside the Current Unit',
    INTERNAL_SECTION_PREFIX: 'التدوير داخل الوحدة - الخيار {n}: القسم / Section',
    INTERNAL_FROM_PREFIX: 'التدوير داخل الوحدة - الخيار {n}: الفترة من / Period from',
    INTERNAL_TO_PREFIX: 'التدوير داخل الوحدة - الخيار {n}: إلى / To',
    EXTERNAL_UNIT_PREFIX: 'التدوير خارج الوحدة - الخيار {n}: الوحدة / Unit',
    EXTERNAL_SECTION_PREFIX: 'التدوير خارج الوحدة - الخيار {n}: القسم / Section',
    EXTERNAL_FROM_PREFIX: 'التدوير خارج الوحدة - الخيار {n}: الفترة من / Period from',
    EXTERNAL_TO_PREFIX: 'التدوير خارج الوحدة - الخيار {n}: إلى / To',
    EXTERNAL_HOURS_PREFIX: 'التدوير خارج الوحدة - الخيار {n}: عدد الساعات اليومية / Daily Hours',
    START_DATE: 'تاريخ بداية التدوير / Rotation Start Date',
    END_DATE: 'تاريخ نهاية التدوير / Rotation End Date',
    HOURS: 'عدد الساعات اليومية المطلوبة / Required Daily Hours',
    ROTATION_UNIT: 'وحدة التدوير / Rotation Unit',
    ROTATION_DEPARTMENT: 'قسم التدوير / Rotation Section',
    NOTES: 'ملاحظات إضافية / Additional Notes'
  })
});

const FORM_RESPONSE_TITLE_CANDIDATES = Object.freeze({
  DIRECT_MANAGER_NAME: Object.freeze([FORM.TITLES.DIRECT_MANAGER_NAME, 'المسؤول المباشر', 'اسم المدير المباشر / Direct Manager Name', 'اسم المدير المباشر']),
  DIRECT_MANAGER_ID: Object.freeze([FORM.TITLES.DIRECT_MANAGER_ID, 'الرقم الوظيفي للمسؤول المباشر', 'رقم وظيفي المسؤول المباشر', 'رقم وظيفي المسؤول المباشر / Line Manager Employee ID', 'رقم وظيفي المدير المباشر', 'رقم وظيفي المدير المباشر / Direct Manager Employee ID', 'Line Manager Employee ID', 'Direct Manager Employee ID']),
  DIRECT_MANAGER_EMAIL: Object.freeze([FORM.TITLES.DIRECT_MANAGER_EMAIL, 'بريد المسؤول المباشر', 'بريد المدير المباشر / Direct Manager Email', 'بريد المدير المباشر']),
  DIRECT_MANAGER_EXTENSION: Object.freeze([FORM.TITLES.DIRECT_MANAGER_EXTENSION, 'رقم محول المسؤول المباشر', 'محول المسؤول المباشر', 'رقم محول المسؤول المباشر / Line Manager Extension', 'رقم محول المدير المباشر', 'رقم محول المدير المباشر / Direct Manager Extension', 'Line Manager Extension', 'Direct Manager Extension']),
  EMPLOYEE_NAME: Object.freeze([FORM.TITLES.EMPLOYEE_NAME, 'اسم الموظف']),
  EMPLOYEE_ID: Object.freeze([FORM.TITLES.EMPLOYEE_ID, 'الرقم الوظيفي للموظف', 'Employee ID']),
  EMPLOYEE_HIRE_DATE: Object.freeze([FORM.TITLES.EMPLOYEE_HIRE_DATE, 'تاريخ تعيين الموظف', 'تاريخ التعيين', 'تاريخ تعيين الموظف / Employee Hire Date', 'Employee Hire Date', 'Hire Date']),
  EMPLOYEE_JOB_TITLE: Object.freeze([FORM.TITLES.EMPLOYEE_JOB_TITLE, 'المسمى الوظيفي للموظف', 'المسمى الوظيفي', 'المسمى الوظيفي للموظف / Employee Job Title', 'Employee Job Title', 'Job Title']),
  EMPLOYEE_EMAIL: Object.freeze([FORM.TITLES.EMPLOYEE_EMAIL, 'بريد الموظف']),
  CURRENT_UNIT: Object.freeze([FORM.TITLES.CURRENT_UNIT, 'الوحدة الحالية للموظف']),
  CURRENT_DEPARTMENT: Object.freeze([FORM.TITLES.CURRENT_DEPARTMENT, 'القسم الحالي للموظف', 'القسم الحالي', 'القسم الحالي للموظف / Current Employee Section', 'Current Employee Section', 'Current Section']),
  ROTATION_UNIT: Object.freeze([FORM.TITLES.ROTATION_UNIT, 'وحدة التدوير', 'وحدة ال' + 'تد' + 'ريب المطلوبة', 'Requested ' + 'Train' + 'ing Unit', 'وحدة ال' + 'تد' + 'ريب المطلوبة / Requested ' + 'Train' + 'ing Unit']),
  START_DATE: Object.freeze([FORM.TITLES.START_DATE, 'من تاريخ']),
  END_DATE: Object.freeze([FORM.TITLES.END_DATE, 'إلى تاريخ']),
  HOURS: Object.freeze([FORM.TITLES.HOURS, 'عدد الساعات اليومية المطلوبة', 'عدد الساعات', 'عدد ساعات ال' + 'تد' + 'ريب اليومية', 'Daily ' + 'Train' + 'ing Hours', 'عدد ساعات ال' + 'تد' + 'ريب اليومية / Daily ' + 'Train' + 'ing Hours']),

  ROTATION_SECTION: Object.freeze([FORM.TITLES.ROTATION_SECTION_PREFIX, 'Rotation Selection {n}: Section']),
  OPTIONAL_ROTATION_GRID: Object.freeze([FORM.TITLES.OPTIONAL_ROTATION_GRID, 'Additional Rotation Selections']),
  ROTATION_FROM: Object.freeze([FORM.TITLES.ROTATION_FROM_PREFIX, 'Rotation Selection {n}: From']),
  ROTATION_TO: Object.freeze([FORM.TITLES.ROTATION_TO_PREFIX, 'Rotation Selection {n}: To']),
  ROTATION_HOURS: Object.freeze([FORM.TITLES.ROTATION_HOURS_PREFIX, 'Rotation Selection {n}: Daily Hours']),

  INTERNAL_SECTION: Object.freeze(['التدوير داخل الوحدة - الخيار {n}: القسم / Section', 'Internal section {n}', 'Internal Section {n}', 'القسم الداخلي {n}']),
  INTERNAL_FROM: Object.freeze(['التدوير داخل الوحدة - الخيار {n}: الفترة من / Period from', 'From date {n}', 'الفترة من {n}']),
  INTERNAL_TO: Object.freeze(['التدوير داخل الوحدة - الخيار {n}: إلى / To', 'To date {n}', 'إلى {n}']),
  EXTERNAL_UNIT: Object.freeze(['التدوير خارج الوحدة - الخيار {n}: الوحدة / Unit', 'External unit {n}', 'External Unit {n}', 'الوحدة الخارجية {n}']),
  EXTERNAL_SECTION: Object.freeze(['التدوير خارج الوحدة - الخيار {n}: القسم / Section', 'External section {n}', 'External Section {n}', 'القسم الخارجي {n}']),
  EXTERNAL_FROM: Object.freeze(['التدوير خارج الوحدة - الخيار {n}: الفترة من / Period from', 'From date {n}', 'الفترة من {n}']),
  EXTERNAL_TO: Object.freeze(['التدوير خارج الوحدة - الخيار {n}: إلى / To', 'To date {n}', 'إلى {n}']),
  EXTERNAL_HOURS: Object.freeze(['التدوير خارج الوحدة - الخيار {n}: عدد الساعات اليومية / Daily Hours', 'External daily hours {n}', 'External Daily Hours {n}', 'عدد الساعات اليومية الخارجية {n}']),
  NOTES: Object.freeze([FORM.TITLES.NOTES, 'ملاحظات إضافية', 'ملاحظات'])
});
