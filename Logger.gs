/** System logging. */
/** Execution logs only: no spreadsheet, properties, or lock calls. */
function logExecutionStage_(action, stage, startedAt, error) {
  try {
    var message = action + ': ' + stage;
    if (typeof startedAt === 'number') {
      message += ' [' + Math.max(0, Date.now() - startedAt) + ' ms]';
    }
    if (error) {
      console.error(message + '\n' + (error.stack || error.message || String(error)));
    } else {
      console.info(message);
    }
  } catch (ignore) {
    // Diagnostics must never interrupt the actual job or its error handling.
  }
}

function logInfo_(action, requestId, message) {
  logSystem_('INFO', action, requestId, message, null);
}

function logWarn_(action, requestId, message) {
  logSystem_('WARN', action, requestId, message, null);
}

function logError_(action, requestId, error) {
  var message = error && error.message ? error.message : safeString_(error);
  // Preserve the error/stack even if opening or writing the log sheet stalls.
  logExecutionStage_(action, message, null, error || message);
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
  } catch (loggingError) {
    logExecutionStage_('logSystem_', 'Spreadsheet logging failed', null, loggingError);
  }
}
