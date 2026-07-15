# SQU Rotation Placement System — Staged Setup Toolkit

Use this Apps Script project to create or repair the Google Forms and dashboard spreadsheet used by the production working scripts.

This toolkit is intentionally separate from the production workflow code. It prepares resources, headers, reference sheets, dashboard summaries, protections, and IDs.

No CSV files are required. Apps Script creates the Google Sheet tabs directly, and the dummy unit/section rows live in `DummyData.gs`.

## What this toolkit creates/prepares

- Main Google Form: `طلب تدوير وظيفي للموظف / Employee Rotation Request`
- Evaluation Google Form: `تقييم تجربة التدوير الوظيفي / Rotation Evaluation`
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
- `MAIN_FORM_BRANCH_UNITS_PER_RUN` controls how many unit-specific form sections are created per execution.
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
8. Run `run06_continueMainFormBranching()` repeatedly until it reports `Complete`. Each execution saves its progress and stays below the Apps Script execution-time limit.
9. `run07_setupEvaluationForm()`
10. `run08_buildDashboardSummaryAndCharts()`
11. `run09_applyProtections()`
12. `run10_finalizeSetupSummary()`
13. Run `run13_verifyProductionCompatibility()` repeatedly until it reports `Complete`. This verifies the current production setup functions in smaller chunks after the bootstrap IDs have been written into the project settings sheet.

## Repair existing resources after script changes

If the latest script adds, removes, renames, or changes spreadsheet columns/form questions, you do not need to start from scratch. Run `run14_repairExistingResourcesFromLatestScript()` after uploading the latest script. It opens the existing resource IDs, rebuilds each managed sheet from the latest headers while preserving row values that still match by header name, reapplies formatting/validations/settings, and rebuilds the main and evaluation forms.

After `run14_repairExistingResourcesFromLatestScript()` finishes, run:

1. `run03_validateReferenceData()`
2. `run05_startMainFormBranching()`
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

Optional dynamic refresh:

- Run `run11_refreshMainFormFromAdminSheets()` after editing `إدارة الوحدات` or `إدارة الأقسام`.
- Run `run12_createFiveMinuteFormRefreshTrigger()` if you want this setup project to check those admin sheets every 30 minutes and refresh the form automatically.
- Run `run12_deleteFiveMinuteFormRefreshTrigger()` to remove that optional trigger.

## Fixing a form that has only one question

Use the same run order above. The key repair steps are:

- `run04_rebuildMainFormBaseQuestions()`
- `run05_startMainFormBranching()`
- `run06_continueMainFormBranching()`

These rebuild the base questions first, create one unit-specific rotation-details page per eligible unit, and then verify that branching is complete.

## How the form gets section choices

The form does not read CSV files. Admins edit the visible Google Sheet tabs:

- `إدارة الوحدات`
- `إدارة الأقسام`

The setup script syncs those admin tabs into hidden system tabs:

- `الوحدات` provides the current-unit and rotation-unit dropdown choices.
- `الأقسام` provides the unit-to-section mapping.
- The selected rotation unit routes to one clear details page containing only sections belonging to that unit.
- Rotation Section, Rotation Start Date, Rotation End Date, and Required Daily Hours are all required on that same page.
- Each form submission creates exactly one Records-sheet row and one dashboard record. Submit a new response when the same employee needs another rotation.

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

After deploying the production working script as a Web App, paste the deployed URL into the production script setting `WEB_APP_URL`.

## Notes

- Google Forms cannot dynamically filter section choices based on dates entered in the same response. This toolkit creates unit-based branching only.
- Overlap/conflict checks and automatic section availability based on approved date conflicts must still be handled by the production working scripts during submission, approval, and scheduled refresh.
- Protections are applied by `run09_applyProtections()`. The records sheet leaves `حالة الاعتماد النهائي` and `ملاحظات` as the intended editable columns.
