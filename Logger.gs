/** System logging. */
function logInfo_(action, requestId, message) {
  logSystem_('INFO', action, requestId, message, null);
}

function logError_(action, requestId, error) {
  var message = error && error.message ? error.message : safeString_(error);
  logSystem_('ERROR', action, requestId, message, error);
}

function logSystem_(level, action, requestId, message, error) {
  try {
    var ss = openDashboardSpreadsheet_();
    var sheet = ensureSheet_(ss, SHEETS.LOG);
    setSheetHeaders_(sheet, LOG_HEADERS);
    appendObjectRow_(sheet, LOG_HEADERS, {
      [H.LOG.TIME]: now_(),
      [H.LOG.FUNCTION]: safeString_(action).split(':')[0],
      [H.LOG.REQUEST_ID]: requestId || '',
      [H.LOG.ACTION]: action || '',
      [H.LOG.LEVEL]: level,
      [H.LOG.MESSAGE]: message || '',
      [H.LOG.ERROR_JSON]: error ? objectToJson_({ message: error.message, stack: error.stack }) : ''
    });
    try { sheet.hideSheet(); } catch (ignore) {}
  } catch (ignore2) {
    // Do not throw from logging.
  }
}
