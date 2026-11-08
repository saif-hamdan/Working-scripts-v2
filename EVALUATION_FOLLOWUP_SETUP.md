# Evaluation submission tracking and reminders

## Agreed behavior

- Employee in **To**, with the existing Employee Services copy policy:
  `employeeservices@squ.edu.om` in **CC**, or only in To when it is already
  the employee recipient. No managers or unit/section heads are added.
- Reminders apply only to invitations first prepared by the enabled feature.
  Already-sent/legacy-queued invitations are **not** enrolled.
- Remind every **3 calendar days in Asia/Muscat**, including weekends, after
  each successfully sent invitation/reminder. This is a date-based daily
  check, not an exact 72-hour timer or guaranteed delivery hour.
- Match each evaluation using its request ID and employee ID. Also check the
  respondent email when supplied and group/selection identifiers when supplied.
  Opening the link is not a submission. Completing one rotation never completes
  another rotation for the same employee.
- Keep the evaluation email's existing table, theme, sender, and prefilled
  link. Reminders add a bilingual reminder subject/intro only.

## What is added to `سجل الطلبات`

Five visible, script-managed columns:

1. `تم استلام التقييم`
2. `تاريخ استلام التقييم`
3. `تاريخ آخر تذكير بالتقييم`
4. `عدد تذكيرات التقييم`
5. `موعد التذكير القادم بالتقييم`

Three hidden metadata columns store enrollment time, pending message context,
and evaluation response ID. The setup appends missing columns without deleting,
moving, clearing, or rewriting existing request rows. Core `RECORD_HEADERS`
remain unchanged so uploading code before activation does not break existing
resources or older versioned web apps.

Older invitations keep blank tracking fields unless a matching new submission
is received after activation. Historical submissions are not backfilled by
this new-invitation-only setup. A newly enrolled invitation starts with `لا`
and reminder count zero. Sending flags/timestamps and the next reminder date
are updated only after the email queue successfully calls MailApp, not simply
when an email is queued.

## Upload from the existing VS Code directory

The GitHub update does not upload to Apps Script automatically. Upload the
latest committed project, including `EvaluationFollowupService.gs` and
`Step20_EvaluationFollowup.gs`. Keep `.claspignore`: never upload `tests/`.

If the only unrelated local edits are still `Step07_EvaluationForm.gs` and
`tests/multi_rotation_tests.js`, run these commands one at a time in the same
PowerShell terminal after **File > Save All**:

```powershell
git stash push -m "Local evaluation edits before follow-up upload" -- Step07_EvaluationForm.gs tests/multi_rotation_tests.js
```

Continue only if Git says the working directory/index were saved. If it says
there were no changes, do not accidentally apply an older stash.

```powershell
$evaluationFeatureStash = (git rev-parse 'stash@{0}').Trim()
```

```powershell
git status --short
```

The status must be empty. If other source edits remain, stop and review them.

```powershell
clasp.cmd show-file-status
```

Confirm the two new `.gs` files are tracked for upload and `tests/` is excluded.
Clasp replaces the online source project, so preserve any online-only edits
before uploading a whole-project copy.

```powershell
clasp.cmd push
```

After the upload finishes, restore the local edits even if the upload failed:

```powershell
git stash apply $evaluationFeatureStash
```

```powershell
git status --short
```

Do not push again after restoring those edits unless they are intentionally
included. The stash remains as a backup.

## Activate once in Apps Script

1. Sign in as the automation account that owns the existing triggers.
2. Refresh the existing Apps Script project after a successful upload.
3. Open `Step20_EvaluationFollowup.gs`.
4. Select and run **`run20_enableEvaluationFollowup`**. Authorize access if
   prompted. If another execution holds the lock, wait and try again.
5. Confirm the log says follow-up is enabled for **NEW invitations only**.
   Setup does not send any email.
6. Open the dashboard and confirm the five visible columns were appended to
   `سجل الطلبات`. Do not manually fill flags, dates, counts, or hidden metadata.
7. In Triggers, confirm exactly one **`onEvaluationFormSubmit`** trigger exists
   for the **evaluation Form**. This is not a main-request Form submit trigger.
   The existing daily `sendEvaluationEmails` trigger is reused (created only
   if absent). Normally the previous five triggers become six.
8. Let the existing daily evaluation job and five-minute sync process future
   invitations normally. Inspect a new invitation's actual send time and next
   reminder date; then submit that exact prefilled evaluation and confirm
   `تم استلام التقييم = نعم`, the received timestamp is populated, and the
   next reminder is cleared. Its other rotations remain independent.

Run Step 20 again only to repair the columns/trigger or resume a pause. It is
idempotent and preserves the original activation cutoff. If the evaluation
Form limits users to one response, setup refuses activation: turn off **Limit
to 1 response** manually so the employee can evaluate separate rotations.
Setup does not rebuild either Form or change existing evaluation questions
or rating choices, including manually added `لا ينطبق` options.

Do **not** run Step 07, Step 14, `setupAll()`, or `installTriggers()` for this
feature. No Web App redeployment, new deployment URL, or `WEB_APP_URL` change
is needed: the timer and evaluation-submit triggers run saved Head code.

## Runtime and delivery safeguards

- One full request-record read and one incremental Form-response read per job or
  tracked-email preflight batch, not a Form-history scan for every employee.
- At most 100 new responses reconciled and 10 messages prepared per job,
  with a three-minute soft time budget and persistent cursors.
- More work resumes via one deduplicated, temporary
  `continueEvaluationFollowup` trigger after about five minutes. It removes
  its own trigger before running; no extra permanent polling job is installed.
- At most 10 tracked emails are attempted in an existing queue pass. Preflight
  is bounded to 45 seconds and respects the remaining sync time budget.
- Reconcile submitted evaluations again before tracked queue mail is sent.
  If Form reconciliation fails or is incomplete, hold tracked mail. Ordinary
  approval/rejection emails retain their existing processing behavior.
- Check remaining MailApp quota and leave a 20-recipient reserve. Low quota
  defers tracked mail without consuming a delivery retry. Delivery may be
  later than the due date when services, quotas, or locks are unavailable.
- Keep one pending outbox context per rotation/cycle; do not enqueue another
  reminder while it is pending. Failed deliveries retry the same queue entry.
- A successful send is recorded in the outbox before updating the request.
  If the request update fails, the next job repairs its send metadata without
  resending the message. A process interrupted in `جار الإرسال` is held as
  failed for manual review, not automatically resent with an unknown outcome.
- Completed/obsolete evaluation messages use `ألغي الإرسال`, not `تم الإرسال`.
  Reminder counts increase only for successful reminder sends.

MailApp and Google Forms are separate services, not one atomic transaction.
These safeguards cannot prevent all Google-side outages, eliminate the tiny
race between a new Form submission and a send already in progress, or guarantee
exactly-once delivery after an ambiguous provider failure. Native service calls
can also stall beyond a soft time budget; inspect the execution diagnostics
and do not blindly reset mail queue rows when the delivery outcome is unknown.

Before any rollback to source older than this feature, pause follow-up and
review/resolve its pending outbox entries. An older mail-queue handler does
not understand the new cancellation and follow-up safeguards.

## Pause / resume

Run **`run20_pauseEvaluationFollowup`** to hold future new invitations and
reminders. Evaluation submissions can still be recorded. Existing in-progress
sends cannot be recalled. Run `run20_enableEvaluationFollowup` to resume
without changing the original activation date or enrolling older invitations.

## Local verification

```powershell
node tests/check_syntax.js
node tests/evaluation_followup_tests.js
node tests/evaluation_link_tests.js
node tests/multi_rotation_tests.js
node tests/section_head_email_tests.js
node tests/trigger_reliability_tests.js
```
