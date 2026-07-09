# SQU Job Rotation System — Working Apps Script Package

This folder is the production Apps Script project for the Google Forms + Google Sheets job-rotation approval workflow.

## What it implements

- Google Form response-sheet queue processing for submissions.
- Arabic dashboard sheets:
  - `لوحة الأقسام`
  - `سجل الطلبات`
- Visible admin reference sheets:
  - `إدارة الوحدات`
  - `إدارة الأقسام`
- Hidden runtime/system sheets:
  - `الوحدات`
  - `الأقسام`
  - `الإعدادات`
  - `سجل النظام`
  - `طابور البريد`
- Unit → section Google Form branching, so the form does not show 500+ sections at once.
- Approval/rejection web app links with secure tokens; approval emails are sent only to the unit head.
- Required rejection reason page.
- Conflict checking on submission and again on approval.
- Immediate auto-rejection if the employee already has active approved rotation.
- Late approval conflict blocking.
- Bilingual Arabic/English centered emails.
- SQU-themed email placeholders for official colors and logo.
- Locked system columns and controlled final-acceptance status editing.
- Daily evaluation email after the end date, only for approved rotation and only once.
- Five-minute sync trigger for dashboard/form refresh and email retry.

## Deployment steps

1. Open [script.google.com](https://script.google.com) and create a new Apps Script project.
2. Copy all `.gs`, `.html`, and `appsscript.json` files from this folder into the project.
3. In **Project Settings → Script Properties**, add:

```text
DASHBOARD_SPREADSHEET_ID = your dashboard spreadsheet ID
MAIN_FORM_ID = your main job rotation request Google Form ID
FORM_RESPONSES_SPREADSHEET_ID = required linked Google Form responses spreadsheet ID
RESPONSE_QUEUE_BATCH_SIZE = 25
QUEUE_SCAN_WINDOW_ROWS = 500
EVALUATION_FORM_URL = evaluation Google Form published URL
OWNER_EMAIL = employeeservices@squ.edu.om
ADMIN_EMAILS = employeeservices@squ.edu.om
APPROVER_UNIT_MODE = CURRENT_UNIT
EMAIL_SENDER_NAME = 
ORGANIZATION_NAME_AR = قسم خدمات الموظفين والمتقاعدين
ORGANIZATION_NAME_EN = Employees and Retirees Services Section
BRAND_PRIMARY_COLOR = official SQU primary color
BRAND_SECONDARY_COLOR = official SQU secondary color
BRAND_ACCENT_COLOR = official SQU accent/background color
BRAND_LOGO_URL = official hosted logo URL
EVALUATION_ALLOWED_FINAL_STATUSES = معتمد,منجز
```


### Optional response queue throughput settings

`RESPONSE_QUEUE_BATCH_SIZE` and `QUEUE_SCAN_WINDOW_ROWS` are optional. Leave them blank or omit them to use the built-in defaults: batch size `25` and scan window `500` rows. The script ignores unsafe or invalid values and falls back to the built-in defaults instead.

Validation limits:

- `RESPONSE_QUEUE_BATCH_SIZE` must be a whole number from `1` to `100`.
- `QUEUE_SCAN_WINDOW_ROWS` must be a whole number from the effective batch size through `2000`.

Recommended values:

| Volume | `RESPONSE_QUEUE_BATCH_SIZE` | `QUEUE_SCAN_WINDOW_ROWS` | When to use |
|---|---:|---:|---|
| Small | `10` | `250` | Occasional submissions and low retry backlog. |
| Medium | `25` | `500` | Default for normal daily operation. |
| High-volume | `75` | `1500` | Short bursts or larger intake periods; keep Apps Script execution time and quotas under review. |

Recommended `APPROVER_UNIT_MODE` is `CURRENT_UNIT`, meaning the head of the unit the employee belongs to approves. Use `ROTATION_UNIT` only if your policy requires the receiving rotation unit head to approve.

4. In the Google Form, use **Responses → Link to Sheets** to create or select the linked response spreadsheet, then set `FORM_RESPONSES_SPREADSHEET_ID` to that spreadsheet ID. This linked response sheet is required: request records are created only when `processUnprocessedFormResponses()` reads the response-sheet queue during sync.
5. Run `setupAll()` once and authorize permissions.
6. Fill the visible `إدارة الوحدات` and `إدارة الأقسام` sheets with your real unit/section data. The production script syncs these into the hidden runtime `الوحدات` and `الأقسام` sheets.
7. Deploy the script as a **Web App**:
   - Execute as: **Me**
   - Access: **Anyone in your domain**
8. Copy the Web App URL into `WEB_APP_URL` in Script Properties or the hidden `الإعدادات` sheet.
9. Run `setupAll()` again so the form choices, triggers, protections, and dashboard are refreshed.

## Important notes

Native Google Forms cannot refresh a second dropdown live on the same page after the first dropdown is selected. This implementation uses the recommended Google Forms workaround: the rotation unit dropdown routes to a unit-specific page, where the section dropdown shows only sections under that unit.

The form choices are refreshed by the five-minute trigger and after decisions. Form submissions are not converted into requests by a direct form-submit trigger; the five-minute sync calls `processUnprocessedFormResponses()` to create requests from the linked response-sheet queue. Admins may also run `processResponseQueueOnce()` manually, or use the `معالجة الطلبات غير المعالجة` custom menu item, after a form outage or high-volume submission period; it logs the number of processed, skipped, and failed rows. If `FORM_RESPONSES_SPREADSHEET_ID` is missing, setup and sync log a warning and no submitted form responses can become requests. The approval handler still re-checks conflicts atomically with `LockService`, so even if the form choice was stale, the system blocks late conflicts.

Do not install the five-minute refresh trigger in the setup/resource project. It belongs only in this production workflow project.


## Troubleshooting stuck queue rows

The five-minute `syncSystem()` run processes three queues before refreshing the dashboard and form choices. If an admin sees missing requests, pending decisions, or unsent emails, first open **Apps Script → Executions** and inspect the latest `syncSystem`, `processResponseQueueOnce`, and `maintenanceCheck` runs. Then unhide/check the relevant system sheets in the dashboard spreadsheet, especially `سجل النظام`, `طابور القرارات`, and `طابور البريد`; the linked Google Form response spreadsheet also has queue columns appended to the right side of the response sheet.

### Linked form response queue columns

The linked Form responses sheet is the source queue for creating dashboard requests. The system appends these columns to the far right of the response sheet:

| Column | Meaning |
|---|---|
| `Processing Status` | Current queue state for the response row. |
| `Processed At` | Timestamp when the row was successfully converted or matched to an existing request. |
| `Dashboard Request ID` | Request ID created in `سجل الطلبات`, or the existing request found for the same response. |
| `Processing Error` | Last error message, if processing failed. |
| `Retry Count` | Number of failed processing attempts. |
| `Last Attempt At` | Timestamp of the latest processing attempt. |

Response queue statuses:

| Status | Meaning | Admin action |
|---|---|---|
| Blank / `NEW` | Not processed yet; blank is normal for newly submitted rows before the queue processor touches them. | Run `processResponseQueueOnce()` for an immediate pass, or wait for `syncSystem()`. |
| `PROCESSING` | The row is currently being attempted or was interrupted during an attempt. | Check Apps Script Executions for an interrupted run; run `processResponseQueueOnce()` again if no execution is active. |
| `PROCESSED` | The response row has been converted to a dashboard request or matched to an existing request. | No action. Use `Dashboard Request ID` to trace it in `سجل الطلبات`. |
| `ERROR` | A retryable failure occurred and the row can be attempted again until the retry limit is reached. | Read `Processing Error`, fix the configuration/data issue, then run `processResponseQueueOnce()` or `syncSystem()`. |
| `ERROR_REQUIRES_REVIEW` | The row reached the retry limit or contains data that cannot be safely auto-corrected, such as invalid date order. | Review the original response values and `Processing Error`; correct the source data or create/resolve the request manually, then leave an audit note in `سجل النظام` or the admin records. Do not simply clear the status unless you intentionally want the row retried. |

For response rows requiring review, admins should compare the submitted row with the required form fields, verify unit/section names against `إدارة الوحدات` and `إدارة الأقسام`, and check whether a request already exists in `سجل الطلبات` using `Dashboard Request ID`, employee email, dates, and section. After the underlying issue is fixed, run `processResponseQueueOnce()` to process only the response queue, or run `syncSystem()` to process all queues and refresh dependent dashboard/form data.

### Request source index maintenance

The hidden `Request Source Index` sheet maps form response identifiers back to rows in `سجل الطلبات` so the response queue can match duplicates safely. After manual data repair, bulk import, or if duplicate matching behaves unexpectedly, an admin should run `rebuildRequestSourceIndex()` from Apps Script or use **SQU Job Rotation → إعادة بناء فهرس مصادر الطلبات**. The function reads `سجل الطلبات`, clears the index below its header, writes one index row for every request with `معرف رد النموذج` or `معرف مصدر رد النموذج`, and records the indexed record count in `سجل النظام`.

Before increasing response-queue batch/window sizes, run `benchmarkRequestSourceIndexWithCopiedSampleData({ targetSize: 10000 })` from Apps Script. It temporarily fills the hidden index with copied/synthetic identifiers based on existing request records, performs a batch duplicate lookup against 10,000+ index rows, logs the write and lookup timings, and restores the original index rows in a `finally` block. Only tune `RESPONSE_QUEUE_BATCH_SIZE` or `QUEUE_SCAN_WINDOW_ROWS` after the benchmark timing is acceptable for the production spreadsheet.


### Approval action queue (`طابور القرارات`)

Approval and rejection web-app link clicks are stored in the hidden `طابور القرارات` sheet before they update `سجل الطلبات`.

| Status | Meaning | Admin action |
|---|---|---|
| `بانتظار المعالجة` | A unit-head approval/rejection action is waiting to be processed. | Wait for `syncSystem()` or run it manually. |
| `تمت المعالجة` | The action was applied successfully. | No action. Verify the request status in `سجل الطلبات` if needed. |
| `فشلت المعالجة - ستعاد المحاولة` | The action failed but is still retryable. | Check `آخر خطأ`, the approval token, the target request status, and Apps Script Executions; fix the cause and run `syncSystem()`. |
| `تتطلب مراجعة يدوية` | The action reached the retry limit and will not be retried automatically. | Review `معرف القرار`, `رمز الموافقة`, `الإجراء`, `سبب الرفض`, and `آخر خطأ`; confirm whether the request was already processed or changed, then apply the correct decision manually in `سجل الطلبات` if policy allows and record what was done. |

Rows requiring review in `طابور القرارات` often mean the approval token no longer matches an actionable request, the request is no longer pending, or a conflict/error occurred during late validation. Use the hidden `سجل النظام` sheet and Apps Script Executions logs to identify the exact failure before making any manual status change.

### Email queue (`طابور البريد`)

The hidden `طابور البريد` sheet stores messages that could not be sent immediately or were queued for later retry.

| Status | Meaning | Admin action |
|---|---|---|
| `بانتظار الإرسال` | The message is pending or retryable. | Wait for `syncSystem()` or run it manually; verify recipients and mail quota if it remains pending. |
| `تم الإرسال` | The message was sent by the queue processor. | No action. |
| `فشل الإرسال` | The message failed after the retry limit. | Review `آخر خطأ`, recipients, subject, and `بيانات السياق`; fix invalid email/configuration/quota issues and decide whether to requeue or send the message manually. |

For failed email rows, admins should check Apps Script Executions for `processEmailQueue` errors, inspect `بيانات السياق` for the request ID and email type, and confirm whether the intended request status already changed. If a message must be resent, create a new queued email through the normal workflow or send it manually and document the action; avoid editing the stored HTML/status without an audit trail.

### Manual recovery functions and logs

- `processResponseQueueOnce()` — processes only the linked response-sheet queue and logs processed, skipped, failed, scanned, and remaining-row counts.
- `syncSystem()` — processes the response queue, approval action queue, email queue, pending approval emails, reference-data sync, dashboard refreshes, and form-choice refreshes when needed.
- `maintenanceCheck()` — refreshes dashboard outputs; use it after queue issues are resolved if admins only need to rebuild visible reporting.

When diagnosing any stuck row, capture the row number, queue status, retry/attempt count, last error, and latest Apps Script Execution ID. The hidden `سجل النظام` sheet provides an in-spreadsheet audit trail, while Apps Script Executions provides stack traces and runtime failures that may not fit in queue columns.

## Main functions

- `setupAll()` — run after configuration changes.
- `refreshFormChoices()` — refresh unit/section choices in the Google Form.
- `refreshDashboard()` — rebuild the clean dashboard sheet.
- `installTriggers()` — install edit, five-minute sync, and daily evaluation triggers. It intentionally does not install a direct form-submit request-creation trigger.
- `processUnprocessedFormResponses()` — create requests from unprocessed rows in the linked Google Form response sheet.
- `processResponseQueueOnce()` — manually process the linked response-sheet queue once and log processed, skipped, and failed row counts; useful after a form outage or high-volume submission period.
- `sendEvaluationEmails()` — manually send due evaluation emails.

## Sheet data requirements

### `إدارة الوحدات`

| معرف الوحدة | اسم الوحدة | رئيس الوحدة | مسمى وظيفي رئيس الوحدة | بريد رئيس الوحدة | نشط |
|---|---|---|---|---|---|
| المكتبة الرئيسية | المكتبة الرئيسية | الدكتور حمد بن محمد بن سالم العزري | مدير المكتبة الرئيسية |  | نعم |

### `إدارة الأقسام`

| معرف القسم | معرف الوحدة | اسم الوحدة | اسم القسم | نشط | السعة |
|---|---|---|---|---|---|
| المكتبة الرئيسية-الاعارة | المكتبة الرئيسية | المكتبة الرئيسية | الاعارة | نعم | 1 |

The system uses capacity 1 by default, matching the requirement that a section cannot have another trainee at the same time.
