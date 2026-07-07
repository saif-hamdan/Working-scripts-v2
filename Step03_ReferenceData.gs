function run03_validateReferenceData() {
  var ss = openDashboardFromProperties_();
  syncAdminReferenceData_(ss);
  var issues = validateReferenceData_(ss);
  saveValidationIssues_(issues);
  writeSetupSummary_(ss);

  var errors = issues.filter(function(issue) { return issue.severity === 'ERROR'; });
  if (errors.length) {
    failStep_('03 Validate Reference Data', 'Reference data validation failed with ' + errors.length + ' error(s). Check Setup Summary.');
  }
  return finishStep_('03 Validate Reference Data', BSTATUS.COMPLETE, 'Reference data is valid. Warnings, if any, are listed in Setup Summary.');
}

function validateReferenceData_(ss) {
  var issues = [];
  var units = readUnits_(ss, { includeInactive: true });
  var activeUnits = readUnits_(ss);
  var sections = readSections_(ss, { includeInactive: true });
  var activeSections = readSections_(ss);

  var unitById = {};
  var unitByName = {};
  units.forEach(function(unit) {
    if (unit.id) unitById[unit.id] = unit;
    unitByName[unit.name] = unit;
  });

  var activeUnitById = {};
  var activeUnitByName = {};
  activeUnits.forEach(function(unit) {
    if (unit.id) activeUnitById[unit.id] = unit;
    activeUnitByName[unit.name] = unit;
  });

  activeSections = activeSections.filter(function(section) {
    var existingUnit = section.unitId ? unitById[section.unitId] : unitByName[section.unitName];
    if (!existingUnit && section.unitName) existingUnit = unitByName[section.unitName];
    if (existingUnit && !existingUnit.active) return false;
    return true;
  });

  if (!activeUnits.length) {
    issues.push(issue_('ERROR', BS.UNITS, 'No active units were found.', ''));
  }
  if (!activeSections.length) {
    issues.push(issue_('ERROR', BS.SECTIONS, 'No active sections were found.', ''));
  }

  var unitNameCounts = {};

  activeUnits.forEach(function(unit) {
    unitNameCounts[unit.name] = (unitNameCounts[unit.name] || 0) + 1;
    if (!unit.headEmail) issues.push(issue_('ERROR', BS.UNITS, 'Missing unit head email.', unit.name));
    if (unit.headEmail && !validEmail_(unit.headEmail)) issues.push(issue_('ERROR', BS.UNITS, 'Invalid unit head email.', unit.name + ': ' + unit.headEmail));
    if (!unit.headName) issues.push(issue_('WARN', BS.UNITS, 'Missing unit head name.', unit.name));
  });

  Object.keys(unitNameCounts).forEach(function(name) {
    if (unitNameCounts[name] > 1) issues.push(issue_('ERROR', BS.UNITS, 'Duplicate active unit name.', name));
  });

  var activeSectionCountsByUnit = {};
  var sectionKeyCounts = {};
  activeSections.forEach(function(section) {
    var matchingUnit = section.unitId ? activeUnitById[section.unitId] : activeUnitByName[section.unitName];
    if (!matchingUnit && section.unitName) matchingUnit = activeUnitByName[section.unitName];
    if (!matchingUnit) {
      issues.push(issue_('ERROR', BS.SECTIONS, 'Section is assigned to a missing or inactive unit.', section.name + ' / ' + section.unitName));
    }

    var unitKey = matchingUnit ? matchingUnit.name : section.unitName;
    activeSectionCountsByUnit[unitKey] = (activeSectionCountsByUnit[unitKey] || 0) + 1;
    var sectionKey = unitKey + '||' + section.name;
    sectionKeyCounts[sectionKey] = (sectionKeyCounts[sectionKey] || 0) + 1;

    if (!section.id) issues.push(issue_('WARN', BS.SECTIONS, 'Missing section ID.', unitKey + ' / ' + section.name));
    if (section.capacity < 1) issues.push(issue_('WARN', BS.SECTIONS, 'Section capacity is less than 1.', unitKey + ' / ' + section.name));
  });

  Object.keys(sectionKeyCounts).forEach(function(key) {
    if (sectionKeyCounts[key] > 1) {
      issues.push(issue_('ERROR', BS.SECTIONS, 'Duplicate active section name inside the same unit.', key.replace('||', ' / ')));
    }
  });

  activeUnits.forEach(function(unit) {
    if (!activeSectionCountsByUnit[unit.name]) {
      issues.push(issue_('WARN', BS.SECTIONS, 'Active unit has no active sections.', unit.name));
    }
  });

  units.forEach(function(unit) {
    if (!unit.id) issues.push(issue_('WARN', BS.UNITS, 'Missing unit ID.', unit.name));
  });
  sections.forEach(function(section) {
    if (!section.unitName) issues.push(issue_('ERROR', BS.SECTIONS, 'Missing section unit name.', section.name));
  });

  return issues;
}

function issue_(severity, area, message, value) {
  return { severity: severity, area: area, message: message, value: value || '' };
}
