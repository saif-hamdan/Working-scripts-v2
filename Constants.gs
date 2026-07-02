/**
 * SQU Training Placement System - Constants
 * All dashboard-facing headers are Arabic. Internal/system fields are also Arabic.
 */
const SYSTEM = Object.freeze({
  VERSION: '1.0.0',
  TIME_ZONE: 'Asia/Muscat',
  REQUEST_PREFIX: 'TRN'
});

const SHEETS = Object.freeze({
  DASHBOARD: 'لوحة الأقسام',
  RECORDS: 'سجل الطلبات',
  CHARTS: 'الرسوم والمؤشرات',
  ADMIN_UNITS: 'إدارة الوحدات',
  ADMIN_SECTIONS: 'إدارة الأقسام',
  UNITS: 'الوحدات',
  SECTIONS: 'الأقسام',
  SETTINGS: 'الإعدادات',
  LOG: 'سجل النظام',
  EMAIL_QUEUE: 'طابور البريد',
  ACTION_QUEUE: 'طابور القرارات'
});

const H = Object.freeze({
  DASHBOARD: Object.freeze({
    UNIT: 'الوحدة',
    SECTION: 'القسم',
    HEAD: 'رئيس الوحدة',
    HEAD_EMAIL: 'بريد رئيس الوحدة',
    ACTIVE_COUNT: 'عدد المتدربين النشطين',
    ACTIVE_TRAINEES: 'المتدربون النشطون',
    ALL_TRAINEES: 'جميع من تدربوا في القسم',
    LAST_TRAINING: 'آخر تاريخ تدريب',
    STATUS: 'حالة القسم'
  }),
  RECORD: Object.freeze({
    REQUEST_ID: 'رقم الطلب',
    TIMESTAMP: 'الطابع الزمني',
    SUBMITTER_EMAIL: 'بريد مقدم الطلب',
    DIRECT_MANAGER_NAME: 'اسم المدير المباشر',
    DIRECT_MANAGER_EMAIL: 'بريد المدير المباشر',
    EMPLOYEE_NAME: 'اسم الموظف الجديد',
    EMPLOYEE_EMAIL: 'بريد الموظف الجديد',
    CURRENT_UNIT: 'الوحدة الحالية للموظف',
    CURRENT_UNIT_HEAD: 'رئيس الوحدة الحالية',
    CURRENT_UNIT_HEAD_EMAIL: 'بريد رئيس الوحدة الحالية',
    TRAINING_UNIT: 'وحدة التدريب المطلوبة',
    SECTION: 'القسم المطلوب',
    START_DATE: 'من تاريخ',
    END_DATE: 'إلى تاريخ',
    HOURS: 'عدد الساعات',
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

const STATUS = Object.freeze({
  YES: 'نعم',
  NO: 'لا',
  AVAILABLE: 'متاح',
  OCCUPIED: 'مشغول',
  TYPE_INTERNAL: 'داخلي',
  TYPE_EXTERNAL: 'خارجي',
  HEAD_PENDING: 'بانتظار موافقة رئيس الوحدة',
  HEAD_ACCEPTED: 'موافق عليه من رئيس الوحدة',
  HEAD_REJECTED: 'مرفوض من رئيس الوحدة',
  HEAD_CONFLICT: 'تعذر الاعتماد بسبب التعارض',
  HEAD_EMPLOYEE_ACTIVE: 'مرفوض تلقائياً لوجود تدريب نشط للموظف',
  FINAL_PENDING: 'قيد الاعتماد النهائي',
  FINAL_APPROVED: 'معتمد',
  FINAL_IN_PROGRESS: 'قيد التنفيذ',
  FINAL_DONE: 'منجز',
  FINAL_REJECTED: 'مرفوض',
  FINAL_CONFLICT: 'مرفوض تلقائياً بسبب التعارض',
  FINAL_EMPLOYEE_ACTIVE: 'مرفوض تلقائياً لوجود تدريب نشط للموظف',
  QUEUE_PENDING: 'بانتظار الإرسال',
  QUEUE_SENT: 'تم الإرسال',
  QUEUE_FAILED: 'فشل الإرسال',
  ACTION_QUEUE_PENDING: 'بانتظار المعالجة',
  ACTION_QUEUE_PROCESSED: 'تمت المعالجة',
  ACTION_QUEUE_FAILED: 'فشلت المعالجة'
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
  TRAINING_UNIT: 'TRAINING_UNIT',
  CURRENT_UNIT: 'CURRENT_UNIT'
});

const FORM = Object.freeze({
  SECTION_PAGE_PREFIX: 'اختيار القسم - ',
  SECTION_QUESTION_PREFIX: 'القسم المطلوب / Requested Section - ',
  NO_AVAILABLE_SECTIONS: 'لا توجد أقسام متاحة حالياً',
  TITLES: Object.freeze({
    DIRECT_MANAGER_NAME: 'اسم المدير المباشر / Direct Manager Name',
    DIRECT_MANAGER_EMAIL: 'بريد المدير المباشر / Direct Manager Email',
    EMPLOYEE_NAME: 'اسم الموظف الجديد / New Employee Name',
    EMPLOYEE_EMAIL: 'بريد الموظف الجديد / New Employee Email',
    CURRENT_UNIT: 'الوحدة الحالية للموظف / Current Unit',
    START_DATE: 'من تاريخ / Start Date',
    END_DATE: 'إلى تاريخ / End Date',
    HOURS: 'عدد الساعات / Training Hours',
    TRAINING_UNIT: 'وحدة التدريب المطلوبة / Requested Training Unit',
    NOTES: 'ملاحظات إضافية / Additional Notes'
  })
});
