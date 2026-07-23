# Three-Rotation Duplicate — Resource Map and Fresh Setup

This branch is for the duplicated three-rotation system only. It must not be
configured with production Forms, Sheets, response destinations, deployments,
or triggers.

## Confirm the duplicate Apps Script project

The duplicate Script ID is:

`1s9bvFblbnaAXKd5VInk4O7hniqEN_MgeljrPtQRpwd5LldA04IuMMWIG`

Confirm it in either place:

1. Apps Script editor → **Project Settings** → **IDs** → **Script ID**.
2. The local `.clasp.json` file → `scriptId`.

The historical production Script ID is not stored in the working source and
must not be pasted into this project.

## Fresh resource map

| Resource | Fresh setup behavior | Where to confirm the ID |
|---|---|---|
| Apps Script project | Already exists; never recreated by setup | Apps Script Project Settings |
| Dashboard spreadsheet | Created by Step 01 | `Setup Summary` and Script Properties |
| Main request Form | Created by Step 01 | `Setup Summary` and Script Properties |
| Main Form response destination | The new dashboard spreadsheet | Main Form → Responses → linked Sheets icon; `FORM_RESPONSES_SPREADSHEET_ID` |
| Evaluation Form | Created by Step 01 | `Setup Summary` and Script Properties |
| Web App deployment | Not created by Steps 00–13 | Apps Script → Deploy → Manage deployments |

## Create all resources from scratch

Upload this branch to the duplicate Apps Script project only after reviewing
the diff. Do not deploy it and do not install triggers yet.

1. Open `BootstrapConfig.gs`.
2. Keep all three `CREATE_NEW_*` values set to `true`.
3. Keep all `EXISTING_*_ID` values empty.
4. Set `FORCE_CREATE_NEW_RESOURCES` to `true`.
5. Run `run00_clearSavedResourceIdsForFreshSetup()`.
6. Run `run01_createOrOpenResources()`. This creates the dashboard spreadsheet,
   main Form, main Form response destination, and evaluation Form.
7. Immediately set `FORCE_CREATE_NEW_RESOURCES` back to `false`.
8. Run `run00_diagnoseSetupState()` and confirm the Script ID and every newly
   created resource ID in the execution log.
9. Run `run02_setupDashboardSheets()`.
10. Review the visible `إدارة الوحدات` and `إدارة الأقسام` tabs. Replace the
    seeded rows if required, keep active values as `نعم`, and do not proceed
    until unit-head names/emails and section mappings are correct.
11. Run `run03_validateReferenceData()`. Resolve every `ERROR` in `Setup Summary`.
12. Run `run04_rebuildMainFormBaseQuestions()`.
13. Run `run05_startMainFormBranching()`.
14. Run `run06_continueMainFormBranching()` three times. The first two calls
    build selections 1 and 2; the third builds selection 3, connects Yes/No
    navigation, and must report `Complete`.
15. Run `run07_setupEvaluationForm()`.
16. Run `run08_buildDashboardSummaryAndCharts()`.
17. Run `run09_applyProtections()`.
18. Run `run10_finalizeSetupSummary()`.
19. Run `run13_verifyProductionCompatibility()` repeatedly until it reports
    `Complete`. This verification is read-only with respect to triggers.
20. Reopen `Setup Summary` and confirm all IDs refer to the new files.

Stop here. Do not run `installTriggers()`, do not create a Web App deployment,
and do not submit a live Form response until explicit approval is given.

## Three-selection form footprint

With the current 510 active unit–section pairs and 68 active units:

- Rotation dropdown choices: `510 × 3 = 1,530`
- Current-unit choices: `68`
- Yes/No navigation choices: `2 × 2 = 4`
- Total choices: `1,602`
- Form sections: `4` including the common first section
- Content items: `30`
- Apps Script Form items including page breaks: `33`

The builder recalculates and validates these figures from the live reference
data before it adds rotation pages.

## Later go-live actions

Only after approval:

1. Deploy the duplicate project as a Web App.
2. Run `run15_saveActiveWebAppUrl()` to save the new `/exec` URL.
3. Run `installTriggers()` once.
4. Confirm there is exactly one `syncSystem` trigger and no direct
   `onFormSubmit` or separate Step 11 refresh trigger.
5. Use non-production addresses and controlled test submissions first.

At the initial batch size, expected response throughput is one parent
submission every five-minute `syncSystem` execution. Each parent may contain
one to three independent rotation records. `RESPONSE_QUEUE_BATCH_SIZE` remains
configurable for later monitored tuning.
