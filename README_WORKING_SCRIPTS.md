# SQU Training Placement System — Working Apps Script Package

This folder is the production Apps Script project for the Google Forms + Google Sheets training-placement approval workflow.

## What it implements

- Google Form submission handler.
- Arabic dashboard sheets:
  - `لوحة الأقسام`
  - `سجل الطلبات`
  - `الرسوم والمؤشرات`
- Hidden configuration sheets:
  - `الوحدات`
  - `الأقسام`
  - `الإعدادات`
  - `سجل النظام`
  - `طابور البريد`
- Unit → section Google Form branching, so the form does not show 500+ sections at once.
- Approval/rejection web app links with secure tokens.
- Required rejection reason page.
- Conflict checking on submission and again on approval.
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
FORM_RESPONSES_SPREADSHEET_ID = optional linked responses spreadsheet ID
EVALUATION_FORM_URL = evaluation Google Form published URL
OWNER_EMAIL = owner email
ADMIN_EMAILS = comma-separated admin emails
APPROVER_UNIT_MODE = TRAINING_UNIT
EMAIL_SENDER_NAME = SQU Training System
ORGANIZATION_NAME_AR = جامعة السلطان قابوس
ORGANIZATION_NAME_EN = Sultan Qaboos University
BRAND_PRIMARY_COLOR = official SQU primary color
BRAND_SECONDARY_COLOR = official SQU secondary color
BRAND_ACCENT_COLOR = official SQU accent/background color
BRAND_LOGO_URL = official hosted logo URL
EVALUATION_ALLOWED_FINAL_STATUSES = معتمد,منجز
```

Recommended `APPROVER_UNIT_MODE` is `TRAINING_UNIT`, meaning the head of the unit receiving the trainee approves. Use `CURRENT_UNIT` only if your policy requires the current unit head to approve.

4. Run `setupAll()` once and authorize permissions.
5. Fill the hidden `الوحدات` and `الأقسام` sheets with your real unit/section data.
6. Deploy the script as a **Web App**:
   - Execute as: **Me**
   - Access: **Anyone in your domain**
7. Copy the Web App URL into `WEB_APP_URL` in Script Properties or the hidden `الإعدادات` sheet.
8. Run `setupAll()` again so the form choices, triggers, protections, dashboard, and charts are refreshed.

## Important notes

Native Google Forms cannot refresh a second dropdown live on the same page after the first dropdown is selected. This implementation uses the recommended Google Forms workaround: the requested training unit dropdown routes to a unit-specific page, where the section dropdown shows only sections under that unit.

The form choices are refreshed by the five-minute trigger and after submissions/decisions. The approval handler still re-checks conflicts atomically with `LockService`, so even if the form choice was stale, the system blocks late conflicts.

## Main functions

- `setupAll()` — run after configuration changes.
- `refreshFormChoices()` — refresh unit/section choices in the Google Form.
- `refreshDashboard()` — rebuild the clean dashboard sheet.
- `refreshCharts()` — rebuild KPI tables and charts.
- `installTriggers()` — install form submit, edit, five-minute sync, and daily evaluation triggers.
- `sendEvaluationEmails()` — manually send due evaluation emails.

## Sheet data requirements

### `الوحدات`

| معرف الوحدة | اسم الوحدة | رئيس الوحدة | بريد رئيس الوحدة | نشط |
|---|---|---|---|---|
| UNIT-001 | Unit Name | Head Name | head@example.com | نعم |

### `الأقسام`

| معرف القسم | معرف الوحدة | اسم الوحدة | اسم القسم | نشط | السعة |
|---|---|---|---|---|---|
| SEC-001 | UNIT-001 | Unit Name | Section Name | نعم | 1 |

The system uses capacity 1 by default, matching the requirement that a section cannot have another trainee at the same time.
