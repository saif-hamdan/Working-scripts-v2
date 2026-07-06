# SQU Training Placement System — Working Apps Script Package

This folder is the production Apps Script project for the Google Forms + Google Sheets training-placement approval workflow.

## What it implements

- Google Form response-sheet queue processing for submissions.
- Arabic dashboard sheets:
  - `لوحة الأقسام`
  - `سجل الطلبات`
  - `الرسوم والمؤشرات`
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
- Immediate auto-rejection if the employee already has active approved training.
- Late approval conflict blocking.
- Bilingual Arabic/English centered emails.
- SQU-themed email placeholders for official colors and logo.
- Locked system columns and controlled final-acceptance status editing.
- Daily evaluation email after the end date, only for approved training and only once.
- Five-minute sync trigger for dashboard/form refresh and email retry.

## Deployment steps

1. Open [script.google.com](https://script.google.com) and create a new Apps Script project.
2. Copy all `.gs`, `.html`, and `appsscript.json` files from this folder into the project.
3. In **Project Settings → Script Properties**, add:

```text
DASHBOARD_SPREADSHEET_ID = your dashboard spreadsheet ID
MAIN_FORM_ID = your main training request Google Form ID
FORM_RESPONSES_SPREADSHEET_ID = required linked Google Form responses spreadsheet ID
EVALUATION_FORM_URL = evaluation Google Form published URL
OWNER_EMAIL = owner email
ADMIN_EMAILS = comma-separated admin emails
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

Recommended `APPROVER_UNIT_MODE` is `CURRENT_UNIT`, meaning the head of the unit the employee belongs to approves. Use `TRAINING_UNIT` only if your policy requires the receiving training unit head to approve.

4. In the Google Form, use **Responses → Link to Sheets** to create or select the linked response spreadsheet, then set `FORM_RESPONSES_SPREADSHEET_ID` to that spreadsheet ID. This linked response sheet is required: request records are created only when `processUnprocessedFormResponses()` reads the response-sheet queue during sync.
5. Run `setupAll()` once and authorize permissions.
6. Fill the visible `إدارة الوحدات` and `إدارة الأقسام` sheets with your real unit/section data. The production script syncs these into the hidden runtime `الوحدات` and `الأقسام` sheets.
7. Deploy the script as a **Web App**:
   - Execute as: **Me**
   - Access: **Anyone in your domain**
8. Copy the Web App URL into `WEB_APP_URL` in Script Properties or the hidden `الإعدادات` sheet.
9. Run `setupAll()` again so the form choices, triggers, protections, dashboard, and charts are refreshed.

## Important notes

Native Google Forms cannot refresh a second dropdown live on the same page after the first dropdown is selected. This implementation uses the recommended Google Forms workaround: the requested training unit dropdown routes to a unit-specific page, where the section dropdown shows only sections under that unit.

The form choices are refreshed by the five-minute trigger and after decisions. Form submissions are not converted into requests by a direct form-submit trigger; the five-minute sync calls `processUnprocessedFormResponses()` to create requests from the linked response-sheet queue. Admins may also run `processResponseQueueOnce()` manually, or use the `معالجة الطلبات غير المعالجة` custom menu item, after a form outage or high-volume submission period; it logs the number of processed, skipped, and failed rows. If `FORM_RESPONSES_SPREADSHEET_ID` is missing, setup and sync log a warning and no submitted form responses can become requests. The approval handler still re-checks conflicts atomically with `LockService`, so even if the form choice was stale, the system blocks late conflicts.

Do not install the five-minute refresh trigger in the setup/resource project. It belongs only in this production workflow project.

## Main functions

- `setupAll()` — run after configuration changes.
- `refreshFormChoices()` — refresh unit/section choices in the Google Form.
- `refreshDashboard()` — rebuild the clean dashboard sheet.
- `refreshCharts()` — rebuild KPI tables and charts.
- `installTriggers()` — install edit, five-minute sync, and daily evaluation triggers. It intentionally does not install a direct form-submit request-creation trigger.
- `processUnprocessedFormResponses()` — create requests from unprocessed rows in the linked Google Form response sheet.
- `processResponseQueueOnce()` — manually process the linked response-sheet queue once and log processed, skipped, and failed row counts; useful after a form outage or high-volume submission period.
- `sendEvaluationEmails()` — manually send due evaluation emails.

## Sheet data requirements

### `إدارة الوحدات`

| معرف الوحدة | اسم الوحدة | رئيس الوحدة | بريد رئيس الوحدة | نشط |
|---|---|---|---|---|
| UNIT-001 | Unit Name | Head Name | head@example.com | نعم |

### `إدارة الأقسام`

| معرف القسم | معرف الوحدة | اسم الوحدة | اسم القسم | نشط | السعة |
|---|---|---|---|---|---|
| SEC-001 | UNIT-001 | Unit Name | Section Name | نعم | 1 |

The system uses capacity 1 by default, matching the requirement that a section cannot have another trainee at the same time.
