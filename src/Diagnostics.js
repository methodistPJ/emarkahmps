/* No payloads, student names, IDs, PINs, proofs or session tokens in diagnostics. */
var DIAG_ = null;

function diagnosticStart_(action) {
  DIAG_ = {
    action: 'public challenge login activationBegin activationFinish issueActivation schoolPreview schoolPreviewDetails schoolCommit schoolPrepare schoolReadiness dashboard marksGet reviewGet adminData analytics compare pdfDownload sessionContext health audit jobs userSave entitySave enrolmentEnd gradesSave examSave prepareExam saveMarks submit remarkSave finalize reopen pdfRetry archive newYear rosterImport historicalImport logout'.split(' ').indexOf(action) >= 0 ? action : 'unknown',
    started: Date.now(),
    lock_wait_ms: 0,
    lock_hold_ms: 0,
    sheets_read_ms: 0,
    sheets_write_ms: 0,
    transaction_ms: 0,
    read_calls: 0,
    read_cells: 0,
    write_calls: 0,
    write_cells: 0
  };
}

function diagnosticRead_(range) {
  var start = Date.now();
  try {
    return range.getValues();
  } finally {
    if (DIAG_) {
      DIAG_.read_calls++;
      DIAG_.read_cells += range.getNumRows() * range.getNumColumns();
      DIAG_.sheets_read_ms += Date.now() - start;
    }
  }
}

function diagnosticWrite_(range, values) {
  var start = Date.now();
  try {
    return range.setValues(values);
  } finally {
    if (DIAG_) {
      DIAG_.write_calls++;
      DIAG_.write_cells += range.getNumRows() * range.getNumColumns();
      DIAG_.sheets_write_ms += Date.now() - start;
    }
  }
}

function diagnosticFinish_(result) {
  try {
    if (!DIAG_) return;
    var data = Object.assign({}, DIAG_, {
      duration_ms: Date.now() - DIAG_.started,
      ok: result.ok,
      error_code: result.ok ? '' : result.error.code,
      response_bytes: Utilities.newBlob(JSON.stringify(result)).getBytes().length
    });
    delete data.started;
    if (PropertiesService.getScriptProperties().getProperty('DIAGNOSTICS_ENABLED') === 'true') console.log(JSON.stringify({
      mps_diagnostic: data
    }));
    DIAG_ = null;
  } catch (e) {
    DIAG_ = null;
  }
}

function health_(db, u) {
  admin_(u);
  var cfg = config_(),
    issues = [];
  Object.keys(SCHEMA_).forEach(function(t) {
    try {
      db.validate(t);
    } catch (e) {
      issues.push('Header/jadual tidak serasi: ' + t);
    }
  });
  var props = PropertiesService.getScriptProperties();
  if (!cfg.secret || cfg.secret.length < 43) issues.push('AUTH_PEPPER belum sah.');
  if (!cfg.parent) issues.push('Folder induk belum dikonfigurasi.');
  if (!props.getProperty('TEMPLATE_ID')) issues.push('Template belum dikonfigurasi.');
  var triggers = ScriptApp.getProjectTriggers().filter(function(t) {
    return t.getHandlerFunction() === 'processQueue_';
  });
  if (triggers.length !== 1) issues.push('Perlu tepat satu trigger processQueue_.');
  var pending = props.getProperty('RECOVERY_ROW'),
    worker = {
      last_completed: props.getProperty('WORKER_LAST_OK') || null
    };
  return {
    release: '1.0.3-rc.1',
    academic_year: cfg.year,
    issues: issues,
    recovery_pending: !!pending,
    queue_triggers: triggers.length,
    worker: worker || null,
    diagnostics: props.getProperty('DIAGNOSTICS_ENABLED') === 'true',
    boundaries: 'Ini semakan konfigurasi; bukan bukti permissions Drive atau pagination Docs telah diuji.'
  };
}
