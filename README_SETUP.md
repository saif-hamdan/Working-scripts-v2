# SQU Rotation Placement System — Staged Setup Toolkit

Use this Apps Script project to create or repair the Google Forms and dashboard spreadsheet used by the production working scripts.

This toolkit is intentionally separate from the production workflow code. It prepares resources, headers, reference sheets, dashboard summaries, protections, and IDs.

For the isolated duplicate and the exact fresh-resource sequence, use
`MULTI_ROTATION_SETUP.md`. The duplicated design supports one to three
rotation selections per parent Form response.

No CSV files are required. Apps Script creates the Google Sheet tabs directly, and the dummy unit/section rows live in `DummyData.gs`.

## What this toolkit creates/prepares

- Main Google Form: `استمارة تحديد مسار التدوير المعرفي للموظفين الجدد / New Employee Knowledge Rotation Path Form`
- Evaluation Google Form: `Knowledge Rotation Experience Evaluation / تقييم تجربة التدوير المعرفي`
- Dashboard spreadsheet with Arabic RTL tabs:
  - `لوحة الأقسام`
  - `سجل الطلبات`
  - visible `إدارة الوحدات`
  - visible `إدارة الأقسام`
  - hidden `الوحدات`
  - hidden `الأقسام`
  - hidden `الإعدادات`
- `Setup Summary` sheet containing setup status, IDs, URLs, validation issues, and branching progress.

## Important configuration

Open `BootstrapConfig.gs` before running.

- To repair existing resources, set the relevant `CREATE_NEW_*` value to `false` and paste the existing ID.
- To create resources once and reuse them on later runs, leave `FORCE_CREATE_NEW_RESOURCES` as `false`.
- To intentionally create a fresh set after a previous run, set `FORCE_CREATE_NEW_RESOURCES` to `true` for that run only, then set it back to `false`.
- The three rotation pages are checkpointed one page per Step 06 execution.
- The built-in default owner and admin email is `employeeservices@squ.edu.om`; the built-in dummy unit-head email is `s.alkaanuni1@squ.edu.om`.

## Start with completely new resources

To create a new dashboard spreadsheet, main form, evaluation form, response destination, and sheets without reusing saved IDs:

1. Set all three `CREATE_NEW_*` options to `true`, leave all `EXISTING_*_ID` values empty, and set `FORCE_CREATE_NEW_RESOURCES` to `true`.
2. Run `run00_startCompletelyFreshSetup()`. This clears saved bootstrap resource IDs, production resource pointers, response-spreadsheet state, and production-compatibility progress before creating the new resources. Existing Drive files are not deleted.
3. Immediately set `FORCE_CREATE_NEW_RESOURCES` back to `false` so later setup runs reuse the new files.
4. Continue with `run02_setupDashboardSheets()` and the remaining required run order below. Do not run `run01_createOrOpenResources()` again because the fresh-start function already runs it.

## Required run order

Run these functions from Apps Script in order:

1. `run01_createOrOpenResources()`
2. `run02_setupDashboardSheets()`
3. If you want the built-in dummy data from `DummyData.gs`, keep the rows created by step 2. To force reload the dummy data into the Google Sheet tabs, run `run02_loadDummyReferenceData()`.
4. If you want real data instead, fill or paste it into hidden sheets:
   - `الوحدات`
   - `الأقسام`
5. `run03_validateReferenceData()`
6. `run04_rebuildMainFormBaseQuestions()`
7. `run05_startMainFormBranching()`
8. Run `run06_continueMainFormBranching()` three times until it reports `Complete`. Each execution saves one selection-page checkpoint and stays below the Apps Script execution-time limit.
9. `run07_setupEvaluationForm()`
10. `run08_buildDashboardSummaryAndCharts()`

For an existing deployment receiving the section-head email enhancement, run
`run18_updateSectionHeadEmailSchema()` once after pushing the code. This adds
the section-head email, Arabic and English names, Arabic salutation, and Arabic
and English job-title columns to `إدارة الأقسام`. It fills blank section-head
email values with `M.ALAAMRI1@squ.edu.om` and synchronizes the hidden reference
sheet without opening or modifying either Google Form. The five letter fields
are optional; when they are blank, the final-approved email uses generic
bilingual address text and is still sent.

For an existing development dashboard receiving the request-sheet cleanup, run
`run19_applyRequestSheetAndFormUpdates()` once. It deletes the obsolete
`إجمالي ساعات الطلب` column, hides internal request-control columns, and changes
the main-form question to `اسم الموظف الثلاثي / Full Employee Name`. It does
not rebuild form choices, branching, or the evaluation form.
11. `run09_applyProtections()`
12. `run10_finalizeSetupSummary()`
13. Run `run13_verifyProductionCompatibility()` repeatedly until it reports `Complete`. This verifies the current production setup functions in smaller chunks after the bootstrap IDs have been written into the project settings sheet.

## Repair existing resources after script changes

If the latest script adds, removes, renames, or changes spreadsheet columns/form questions, you do not need to start from scratch. Run `run14_repairExistingResourcesFromLatestScript()` after uploading the latest script. It opens the existing resource IDs, rebuilds each managed sheet from the latest headers while preserving row values that still match by header name, reapplies formatting/validations/settings, and rebuilds the main and evaluation forms.

After `run14_repairExistingResourcesFromLatestScript()` finishes, run:

1. `run03_validateReferenceData()`
2. `run17_repairMainFormBranching()`
3. Run `run06_continueMainFormBranching()` repeatedly until it reports `Complete`
4. `run09_applyProtections()`
5. `run10_finalizeSetupSummary()`
6. `run13_verifyProductionCompatibility()` repeatedly until it reports `Complete`

`bootstrapAll()` is kept only as a compatibility wrapper. The staged functions above make setup and verification easier to audit.

Each numbered runner is in the matching `StepNN_*.gs` file. For example, `run06_continueMainFormBranching()` is in `Step06_MainFormBranching.gs`.

## Troubleshooting creation

If it looks like nothing was created:

1. Run `run00_diagnoseSetupState()` and open Apps Script `Executions` to read the logs.
2. If all IDs are missing, run `run01_createOrOpenResources()`.
3. After `run01_createOrOpenResources()`, check the execution logs for the dashboard and form URLs.
4. If saved IDs point to files that cannot be opened, run `run00_clearSavedResourceIdsForFreshSetup()` and then run `run01_createOrOpenResources()` again.
5. If saved IDs point to trashed/deleted files and you want a clean start, run `run00_startCompletelyFreshSetup()` instead. `run00_startFreshSetupResources()` remains as a compatibility alias.

The created spreadsheet and forms are Drive files, not tabs inside the Apps Script editor.

## One-time safe repair for duplicated or broken form branches

After uploading this version over an existing duplicated project, run `run17_repairMainFormBranching()` once. It preserves the existing duplicate form ID, published URL, linked response destination, and prior response-acceptance state. The form is temporarily closed with a bilingual maintenance message while old rotation pages and duplicated questions are removed.

Then run `run06_continueMainFormBranching()` until it reports `Complete`. The scheduled `syncSystem()` execution can also continue the saved repair. The form reopens automatically only after all three selection pages exist, every page contains its Section dropdown, Start Date, End Date, and Daily Hours question, and navigation has passed validation.

Change-driven refresh after repair:

- Admin edits are consolidated. They update the reference hash and queue work; they do not rebuild the form after every edited cell.
- `syncSystem()` checks every five minutes and touches the Google Form only when the current reference hash differs from the published form hash or a rebuild is unfinished.
- `run11_refreshMainFormFromAdminSheets()` remains available for a manual check. It reports `No changes` without modifying the form when the hashes match.
- `run12_createFiveMinuteFormRefreshTrigger()` is now a compatibility runner: it deletes legacy Step 11 triggers and confirms that `syncSystem()` handles refreshes.
- Do not install a separate time-driven trigger for `run11_refreshMainFormFromAdminSheets()`.
- `run12_deleteFiveMinuteFormRefreshTrigger()` removes any legacy Step 11 trigger.

## Fixing a form that has only one question

Use the same run order above. The key repair steps are:

- `run04_rebuildMainFormBaseQuestions()`
- `run05_startMainFormBranching()`
- `run06_continueMainFormBranching()`

These rebuild the base questions first, create three sequential rotation-selection pages, and then verify that branching is complete.

## How the form gets section choices

The form does not read CSV files. Admins edit the visible Google Sheet tabs:

- `إدارة الوحدات`
- `إدارة الأقسام`

The setup script syncs those admin tabs into hidden system tabs:

- `الوحدات` provides the current-unit dropdown choices.
- `الأقسام` provides active unit-to-section pairs.
- Each of the three rotation pages uses one list containing every active pair displayed as `Unit Name — Section Name`.
- Rotation Section, Rotation Start Date, Rotation End Date, and Required Daily Hours are required on every visited rotation page.
- One parent submission creates one independent Records-sheet row per visited selection, all linked by a request-group ID.

To remove a unit or section from the form without deleting it, set its `نشط` value to `لا` in the admin sheet and run `run11_refreshMainFormFromAdminSheets()`.

## After setup

Open `Setup Summary` and copy these values into the production working scripts project or Script Properties:

```text
DASHBOARD_SPREADSHEET_ID
MAIN_FORM_ID
EVALUATION_FORM_URL
OWNER_EMAIL
ADMIN_EMAILS
```

After deploying the production working script as a Web App, paste the current production `/exec` URL into `WEB_APP_URL` in the hidden `الإعدادات` settings sheet, then run `run15_saveActiveWebAppUrl()` once. The dashboard value is authoritative because Apps Script can report an older URL when multiple deployments exist. The runner mirrors the dashboard URL into Script Properties and updates every duplicate `WEB_APP_URL` settings row. Repeat these steps whenever you create a new Web App deployment.

Setup refreshes preserve a real `WEB_APP_URL`; they only write `PASTE_WEB_APP_URL_AFTER_DEPLOYMENT` when no deployment URL has been saved yet.
If Apps Script reports its editor-only `/dev` testing URL, the setup normalizes it to the production `/exec` URL before saving or generating approval links.

If an older response row was incorrectly marked `PROCESSED` with another response's request ID, run `run16_requeueMismatchedProcessedResponses()` once, then run `processUnprocessedFormResponses()`. The repair runner only requeues processed rows whose employee and rotation details do not match their assigned request record.

## Notes

- Google Forms cannot dynamically filter section choices based on dates entered in the same response. This toolkit creates unit-based branching only.
- Overlap/conflict checks and automatic section availability based on approved date conflicts must still be handled by the production working scripts during submission, approval, and scheduled refresh.
- Protections are applied by `run09_applyProtections()`. The records sheet leaves `حالة الاعتماد النهائي` and `ملاحظات` as the intended editable columns.
