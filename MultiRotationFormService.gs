/**
 * Three-selection Google Form builder.
 *
 * The form keeps the common employee/manager questions on the initial page and
 * uses one page per rotation selection. Selections one and two branch either to
 * the next selection or directly to SUBMIT. Selection three always submits.
 */

function multiRotationSectionChoiceValues_(sections) {
  return uniqueNonEmpty_((sections || []).map(function(section) {
    var unitName = safeString_(section.unitName);
    var sectionName = safeString_(section.name);
    if (!unitName || !sectionName) return '';
    return unitName + ' — ' + sectionName;
  }));
}

function calculateMultiRotationFormFootprint_(units, sections) {
  var selectionCount = FORM.MAX_ROTATION_OPTIONS || 3;
  var activeUnitCount = uniqueNonEmpty_((units || []).map(function(unit) { return unit.name; })).length;
  var activeSectionCount = multiRotationSectionChoiceValues_(sections).length;
  var continuationCount = Math.max(0, selectionCount - 1);
  var baseContentItems = 16;
  var rotationQuestionItems = selectionCount * 4;
  var contentItems = baseContentItems + rotationQuestionItems + continuationCount;
  var pageBreakItems = selectionCount;
  return {
    activeUnits: activeUnitCount,
    activeSections: activeSectionCount,
    selectionCount: selectionCount,
    dropdownChoices: activeSectionCount * selectionCount,
    navigationChoices: continuationCount * 2,
    currentUnitChoices: activeUnitCount,
    totalChoices: (activeSectionCount * selectionCount) + (continuationCount * 2) + activeUnitCount,
    sections: selectionCount + 1,
    contentItems: contentItems,
    formItems: contentItems + pageBreakItems
  };
}

function assertMultiRotationFormFootprint_(footprint) {
  if (!footprint.activeSections) throw new Error('No active organizational sections are available for the rotation dropdowns.');
  if (footprint.totalChoices > GOOGLE_FORM_LIMITS.MAX_TOTAL_CHOICES) {
    throw new Error(
      'Google Forms choice limit blocker: the proposed form requires ' + footprint.totalChoices +
      ' total choices, above the supported limit of ' + GOOGLE_FORM_LIMITS.MAX_TOTAL_CHOICES + '.'
    );
  }
  if (footprint.formItems > GOOGLE_FORM_LIMITS.MAX_CONTENT_ITEMS) {
    throw new Error('Google Forms content-item limit blocker: ' + footprint.formItems + ' Apps Script form items are required.');
  }
  if (footprint.sections > GOOGLE_FORM_LIMITS.MAX_SECTIONS) {
    throw new Error('Google Forms section limit blocker: ' + footprint.sections + ' sections are required.');
  }
  var ratio = footprint.totalChoices / GOOGLE_FORM_LIMITS.MAX_TOTAL_CHOICES;
  if (ratio >= GOOGLE_FORM_LIMITS.WARNING_RATIO) {
    logWarn_(
      'assertMultiRotationFormFootprint_',
      '',
      'The form uses ' + footprint.totalChoices + ' of ' + GOOGLE_FORM_LIMITS.MAX_TOTAL_CHOICES +
        ' total choices. Review the active-section count before publishing.'
    );
  }
  return footprint;
}

function formatMultiRotationFootprint_(footprint) {
  return 'Active sections: ' + footprint.activeSections +
    '; choices across ' + footprint.selectionCount + ' rotation dropdowns: ' + footprint.dropdownChoices +
    '; total form sections: ' + footprint.sections +
    '; content items: ' + footprint.contentItems +
    '; Apps Script form items including page breaks: ' + footprint.formItems +
    '; total choices including current unit and navigation: ' + footprint.totalChoices + '.';
}

function initializeMultiRotationFormBuild_(form, units, sections, options) {
  options = options || {};
  var footprint = assertMultiRotationFormFootprint_(calculateMultiRotationFormFootprint_(units, sections));

  var mode = options.mode === BBRANCH_MODE.LIVE ? BBRANCH_MODE.LIVE : BBRANCH_MODE.CLEAN;
  if (mode === BBRANCH_MODE.CLEAN) {
    removeExistingBranchItems_(form);
  }
  setMultiRotationCurrentUnitChoices_(form, units);
  var targetHash = safeString_(options.targetHash || getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, ''));
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: '0',
    [BSPROP.BRANCH_TOTAL]: String(footprint.selectionCount),
    [BSPROP.BRANCH_PHASE]: 'build-selections',
    [BSPROP.BRANCH_PHASE_INDEX]: '0',
    [BSPROP.BRANCH_COMPLETE]: 'false',
    [BSPROP.BRANCH_MODE]: mode,
    [BSPROP.BRANCH_TARGET_HASH]: targetHash,
    [BSPROP.BRANCH_LAST_ERROR]: '',
    [BSPROP.REFERENCE_DIRTY]: 'false',
    [BSPROP.PRODUCTION_COMPATIBILITY_STATUS]: '',
    [BSPROP.READY]: 'false'
  });
  if (mode === BBRANCH_MODE.CLEAN && options.preservePublishedHash !== true) {
    setBootstrapProperties_({ [BSPROP.BRANCH_PUBLISHED_HASH]: '' });
  }
  logInfo_('initializeMultiRotationFormBuild_', '', formatMultiRotationFootprint_(footprint));
  return [1, 2, 3].slice(0, footprint.selectionCount);
}

function setMultiRotationCurrentUnitChoices_(form, units) {
  var currentUnitItem = getItem_(form, FORM.TITLES.CURRENT_UNIT, FormApp.ItemType.LIST);
  if (!currentUnitItem) {
    throw new Error('Current Employee Unit question is missing. Run Step 4 first.');
  }
  var unitNames = uniqueNonEmpty_((units || []).map(function(unit) { return unit.name; }));
  currentUnitItem.asListItem().setChoiceValues(unitNames.length ? unitNames : [BFORM.NO_UNITS]);
  return unitNames;
}

function ensureMultiRotationSelectionPage_(form, selectionNumber, choiceValues) {
  var pageTitle = optionTitle_(FORM.TITLES.ROTATION_PAGE_PREFIX, selectionNumber);
  var page = ensurePage_(form, pageTitle);
  page.setHelpText('');

  var section = ensureList_(
    form,
    optionTitle_(FORM.TITLES.ROTATION_SECTION_PREFIX, selectionNumber),
    true
  );
  section.setHelpText('');
  section.setChoiceValues(choiceValues);

  var occurrenceIndex = selectionNumber - 1;
  var start = ensureMultiRotationDateOccurrence_(
    form,
    optionTitle_(FORM.TITLES.ROTATION_FROM_PREFIX, selectionNumber),
    occurrenceIndex,
    true
  );
  start.setHelpText('');

  var end = ensureMultiRotationDateOccurrence_(
    form,
    optionTitle_(FORM.TITLES.ROTATION_TO_PREFIX, selectionNumber),
    occurrenceIndex,
    true
  );
  end.setHelpText('');

  var hours = ensureMultiRotationTextOccurrence_(
    form,
    optionTitle_(FORM.TITLES.ROTATION_HOURS_PREFIX, selectionNumber),
    occurrenceIndex,
    true
  );
  hours.setHelpText('من ساعتين إلى سبع ساعات يومياً. / Between 2 and 7 hours per day.');
  applyDailyHoursValidation_(hours);

  var continuation = null;
  if (selectionNumber < (FORM.MAX_ROTATION_OPTIONS || 3)) {
    var continuationTitle = optionTitle_(FORM.TITLES.ROTATION_ADD_MORE_PREFIX, selectionNumber);
    var item = getItem_(form, continuationTitle, FormApp.ItemType.MULTIPLE_CHOICE);
    continuation = item ? item.asMultipleChoiceItem() : form.addMultipleChoiceItem().setTitle(continuationTitle);
    continuation
      .setRequired(true)
      .setHelpText('')
      .setChoiceValues([FORM.TITLES.ROTATION_ADD_MORE_YES, FORM.TITLES.ROTATION_ADD_MORE_NO]);
  }

  return {
    page: page,
    section: section,
    start: start,
    end: end,
    hours: hours,
    continuation: continuation
  };
}

function getMultiRotationItemOccurrence_(form, title, type, occurrenceIndex) {
  var targetIndex = Math.max(0, Number(occurrenceIndex) || 0);
  var matches = form.getItems(type).filter(function(item) {
    return safeBootstrapFormItemTitle_(item) === safeString_(title);
  });
  return matches[targetIndex] || null;
}

function ensureMultiRotationDateOccurrence_(form, title, occurrenceIndex, required) {
  var item = getMultiRotationItemOccurrence_(form, title, FormApp.ItemType.DATE, occurrenceIndex);
  if (!item) item = form.addDateItem().setTitle(title);
  item = asTypedFormItem_(item, 'asDateItem');
  return item.setRequired(Boolean(required));
}

function ensureMultiRotationTextOccurrence_(form, title, occurrenceIndex, required) {
  var item = getMultiRotationItemOccurrence_(form, title, FormApp.ItemType.TEXT, occurrenceIndex);
  if (!item) item = form.addTextItem().setTitle(title);
  item = asTypedFormItem_(item, 'asTextItem');
  return item.setRequired(Boolean(required));
}

function applyDailyHoursValidation_(textItem) {
  var validation = FormApp.createTextValidation()
    .requireNumberBetween(2, 7)
    .setHelpText('أدخل رقماً من 2 إلى 7. / Enter a number from 2 to 7.')
    .build();
  textItem.setValidation(validation);
  return textItem;
}

function publishMultiRotationNavigation_(form) {
  var pages = [];
  for (var i = 1; i <= (FORM.MAX_ROTATION_OPTIONS || 3); i++) {
    var pageItem = getItem_(form, optionTitle_(FORM.TITLES.ROTATION_PAGE_PREFIX, i), FormApp.ItemType.PAGE_BREAK);
    if (!pageItem) throw new Error('Missing rotation page for selection ' + i + '.');
    pages.push(pageItem.asPageBreakItem());
  }

  for (var selectionNumber = 1; selectionNumber < pages.length; selectionNumber++) {
    var title = optionTitle_(FORM.TITLES.ROTATION_ADD_MORE_PREFIX, selectionNumber);
    var continuationItem = getItem_(form, title, FormApp.ItemType.MULTIPLE_CHOICE);
    if (!continuationItem) throw new Error('Missing continuation question for selection ' + selectionNumber + '.');
    var continuation = continuationItem.asMultipleChoiceItem();
    continuation.setChoices([
      continuation.createChoice(FORM.TITLES.ROTATION_ADD_MORE_YES, pages[selectionNumber]),
      continuation.createChoice(FORM.TITLES.ROTATION_ADD_MORE_NO, FormApp.PageNavigationType.SUBMIT)
    ]);
    pages[selectionNumber - 1].setGoToPage(FormApp.PageNavigationType.CONTINUE);
  }
  pages[pages.length - 1].setGoToPage(FormApp.PageNavigationType.SUBMIT);
}

function validateMultiRotationForm_(form, sections) {
  var issues = [];
  var expectedChoices = multiRotationSectionChoiceValues_(sections);
  var currentUnitItem = getItem_(form, FORM.TITLES.CURRENT_UNIT, FormApp.ItemType.LIST);
  if (!currentUnitItem) {
    issues.push('Current Employee Unit question is missing.');
  } else {
    var currentUnitChoices = currentUnitItem.asListItem().getChoices().map(function(choice) {
      return choice.getValue();
    });
    if (currentUnitChoices.indexOf(bootstrapTemporaryResetChoice_()) !== -1) {
      issues.push('Current Employee Unit still contains the temporary reset choice.');
    }
  }
  for (var i = 1; i <= (FORM.MAX_ROTATION_OPTIONS || 3); i++) {
    var pageTitle = optionTitle_(FORM.TITLES.ROTATION_PAGE_PREFIX, i);
    var page = getItem_(form, pageTitle, FormApp.ItemType.PAGE_BREAK);
    if (!page) issues.push('Missing page: ' + pageTitle);

    var sectionTitle = optionTitle_(FORM.TITLES.ROTATION_SECTION_PREFIX, i);
    var sectionItem = getItem_(form, sectionTitle, FormApp.ItemType.LIST);
    if (!sectionItem) {
      issues.push('Missing section dropdown: ' + sectionTitle);
    } else {
      var list = sectionItem.asListItem();
      if (!list.isRequired()) issues.push('Section dropdown is not required: ' + sectionTitle);
      var actualChoices = list.getChoices().map(function(choice) { return choice.getValue(); });
      if (!bootstrapChoiceCollectionsEqual_(actualChoices, expectedChoices)) {
        issues.push('Section choices do not match active reference data for selection ' + i + '.');
      }
    }

    [
      { title: optionTitle_(FORM.TITLES.ROTATION_FROM_PREFIX, i), type: FormApp.ItemType.DATE, cast: 'asDateItem', occurrenceIndex: i - 1 },
      { title: optionTitle_(FORM.TITLES.ROTATION_TO_PREFIX, i), type: FormApp.ItemType.DATE, cast: 'asDateItem', occurrenceIndex: i - 1 },
      { title: optionTitle_(FORM.TITLES.ROTATION_HOURS_PREFIX, i), type: FormApp.ItemType.TEXT, cast: 'asTextItem', occurrenceIndex: i - 1 }
    ].forEach(function(spec) {
      var item = getMultiRotationItemOccurrence_(form, spec.title, spec.type, spec.occurrenceIndex);
      if (!item) {
        issues.push('Missing required question: ' + spec.title);
      } else if (!asTypedFormItem_(item, spec.cast).isRequired()) {
        issues.push('Question is not required: ' + spec.title);
      }
    });

    var continuationTitle = optionTitle_(FORM.TITLES.ROTATION_ADD_MORE_PREFIX, i);
    var continuation = getItem_(form, continuationTitle, FormApp.ItemType.MULTIPLE_CHOICE);
    if (i < (FORM.MAX_ROTATION_OPTIONS || 3)) {
      if (!continuation) {
        issues.push('Missing continuation question for selection ' + i + '.');
      } else if (!continuation.asMultipleChoiceItem().isRequired()) {
        issues.push('Continuation question is not required for selection ' + i + '.');
      }
    } else if (continuation) {
      issues.push('Selection ' + i + ' must not offer another rotation.');
    }
  }
  return issues;
}

function continueMultiRotationFormBuild_(options) {
  options = options || {};
  var ss = openDashboardFromProperties_();
  var form = openMainFormFromProperties_();
  var units = readUnits_(ss);
  var sections = readSections_(ss);
  var footprint = assertMultiRotationFormFootprint_(calculateMultiRotationFormFootprint_(units, sections));
  setMultiRotationCurrentUnitChoices_(form, units);
  var total = footprint.selectionCount;
  var storedTotal = Number(getBootstrapProperty_(BSPROP.BRANCH_TOTAL, '0')) || 0;
  if (storedTotal !== total) {
    initializeMultiRotationFormBuild_(form, units, sections, {
      mode: getBootstrapProperty_(BSPROP.BRANCH_MODE, '') || BBRANCH_MODE.CLEAN,
      targetHash: getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, ''),
      preservePublishedHash: true
    });
  }

  var progress = Number(getBootstrapProperty_(BSPROP.BRANCH_INDEX, '0')) || 0;
  var choiceValues = multiRotationSectionChoiceValues_(sections);
  if (progress < total) {
    var nextSelection = progress + 1;
    ensureMultiRotationSelectionPage_(form, nextSelection, choiceValues);
    progress = nextSelection;
    setBootstrapProperties_({
      [BSPROP.BRANCH_INDEX]: String(progress),
      [BSPROP.BRANCH_PHASE_INDEX]: String(progress)
    });
  }

  if (progress < total) {
    writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
    return finishStep_(
      '06 Continue Main Form Branching',
      BSTATUS.IN_PROGRESS,
      'Built rotation selection ' + progress + ' of ' + total + '. ' +
        formatMultiRotationFootprint_(footprint) + ' Run Step 6 again.'
    );
  }

  publishMultiRotationNavigation_(form);
  var issues = validateMultiRotationForm_(form, sections);
  if (issues.length) return failMainFormBranching_(issues.join(' | '));

  var targetHash = safeString_(getBootstrapProperty_(BSPROP.BRANCH_TARGET_HASH, '')) ||
    safeString_(getBootstrapProperty_(BSPROP.REFERENCE_DATA_HASH, ''));
  setBootstrapProperties_({
    [BSPROP.BRANCH_INDEX]: String(total),
    [BSPROP.BRANCH_TOTAL]: String(total),
    [BSPROP.BRANCH_PHASE]: 'complete',
    [BSPROP.BRANCH_PHASE_INDEX]: String(total),
    [BSPROP.BRANCH_COMPLETE]: 'true',
    [BSPROP.BRANCH_PUBLISHED_HASH]: targetHash,
    [BSPROP.REFERENCE_DIRTY]: 'false',
    [BSPROP.REFERENCE_DIRTY_AT]: null,
    [BSPROP.BRANCH_LAST_ERROR]: ''
  });
  restoreMainFormAcceptanceAfterRepair_(form);
  writeSetupSummary_(ss, form, tryOpenEvaluationForm_());
  return finishStep_(
    '06 Continue Main Form Branching',
    BSTATUS.COMPLETE,
    'Three rotation-selection pages are complete. ' + formatMultiRotationFootprint_(footprint)
  );
}
