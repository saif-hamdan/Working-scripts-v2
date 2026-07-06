function setupMainForm_(form, dashboard) {
  rebuildMainFormBase_(form, dashboard);
  removeExistingBranchItems_(form);
  var units = readUnits_(dashboard);
  var sections = readSections_(dashboard);
  units.forEach(function(unit) {
    buildUnitBranchPage_(form, unit, sections);
  });
  rebuildTrainingUnitRoutingChoices_(form, units, units.length);
}

function setupEvaluationForm_(form) {
  rebuildEvaluationForm_(form);
}

function ensureText_(form, title, required) {
  var item = getItem_(form, title, FormApp.ItemType.TEXT);
  var textItem = item ? item.asTextItem() : form.addTextItem().setTitle(title);
  return textItem.setRequired(Boolean(required));
}
function ensureParagraph_(form, title, required) {
  var item = getItem_(form, title, FormApp.ItemType.PARAGRAPH_TEXT);
  var paragraphItem = item ? item.asParagraphTextItem() : form.addParagraphTextItem().setTitle(title);
  return paragraphItem.setRequired(Boolean(required));
}
function ensureDate_(form, title, required) {
  var item = getItem_(form, title, FormApp.ItemType.DATE);
  var dateItem = item ? item.asDateItem() : form.addDateItem().setTitle(title);
  return dateItem.setRequired(Boolean(required));
}
function ensureList_(form, title, required) {
  var item = getItem_(form, title, FormApp.ItemType.LIST);
  var listItem = item ? item.asListItem() : form.addListItem().setTitle(title);
  return listItem.setRequired(Boolean(required));
}
function ensurePage_(form, title) {
  var item = getItem_(form, title, FormApp.ItemType.PAGE_BREAK);
  return item ? item.asPageBreakItem() : form.addPageBreakItem().setTitle(title);
}
function getItem_(form, title, type) {
  var items = form.getItems(type);
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle && items[i].getTitle() === title) return items[i];
  }
  return null;
}
