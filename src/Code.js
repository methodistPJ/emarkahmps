function doGet() {
  return HtmlService.createHtmlOutputFromFile('Workspace').setTitle('MPS e-Assessment').addMetaTag('viewport',
    'width=device-width, initial-scale=1');
}

function rpc(envelope) {
  CONFIG_REQUEST_ = null;
  diagnosticStart_(envelope && envelope.action || 'unknown');
  var response;
  try {
    response = dispatch_(envelope);
    return response;
  } finally {
    diagnosticFinish_(response || {
      ok: false,
      error: {
        code: 'INTERNAL'
      }
    });
  }
}

function dispatch_(envelope) {
  try {
    need_(envelope && typeof envelope.action === 'string', 'Permintaan tidak sah.');
    var data = locked_(function(db) {
      var p = envelope.payload || {},
        a = envelope.action;
      if (a === 'public') return publicInfo_(db);
      if (a === 'challenge') return challenge_(db, p);
      if (a === 'login') return login_(db, p);
      if(a==='activationBegin')return activationBegin_(db,p);
      if(a==='activationFinish')return activationFinish_(db,p);
      var u = session_(db, envelope.token);
      if(a==='issueActivation')return issueActivation_(db,u,p,envelope.request_id);
      var reads = {
        schoolReadiness:schoolReadiness_,schoolPreviewDetails:schoolPreviewDetails_,
        dashboard: dashboard_,
        marksGet: marksGet_,
        reviewGet: reviewGet_,
        adminData: adminData_,
        analytics: analytics_,
        compare: compare_,
        pdfDownload: pdfReference_,
        sessionContext: sessionContext_,
        health: health_
      };
      if (a === 'audit') {
        admin_(u);
        return db.read('AUDIT_LOG').slice(-500).reverse();
      }
      if (a === 'jobs') {
        admin_(u);
        return db.read('_STATE').filter(function(r) {
          return r.state_id.indexOf('archive:') === 0;
        }).map(function(r) {
          return json_(r.value, {});
        });
      }
      if (Object.prototype.hasOwnProperty.call(reads, a)) return reads[a](db, u, p);
      var writes = {
        schoolPreview:schoolPreview_,schoolCommit:schoolCommit_,schoolPrepare:schoolPrepare_,
        userSave: userSave_,
        entitySave: entitySave_,
        enrolmentEnd: enrolmentEnd_,
        gradesSave: gradesSave_,
        examSave: examSave_,
        prepareExam: prepareExam_,
        saveMarks: saveMarks_,
        submit: submit_,
        remarkSave: remarkSave_,
        finalize: finalize_,
        reopen: reopen_,
        pdfRetry: pdfRetry_,
        archive: archiveQueue_,
        newYear: newYear_,
        rosterImport: rosterImport_,
        historicalImport: historicalImport_
      };
      if (a === 'logout') {
        db.setState('session:' + hash_(envelope.token), null);
        return commit_(db, envelope.request_id, u, {
          action: a
        }, {});
      }
      need_(Object.prototype.hasOwnProperty.call(writes, a), 'Operasi tidak dikenali.');
      var payload = {
          action: a,
          payload: p
        },
        repeat = replay_(db, envelope.request_id, u, payload);
      if (repeat) {
        if (a === 'newYear' && repeat.value.activate) activateYear_(repeat.value);
        return repeat.value;
      }
      var arch = db.state('archive:' + config_().year);
      need_(!arch || ['QUEUED', 'PROCESSING'].indexOf(arch.status) < 0 || a === 'archive',
        'Tahun sedang diarkibkan. Tunggu arkib selesai.');
      var result = writes[a](db, u, p, envelope.request_id);
      var committed = commit_(db, envelope.request_id, u, payload, result);
      if(a==='schoolCommit')schoolApplyProfile_(db);
      if (a === 'newYear' && committed.activate) activateYear_(committed);
      return committed;
    });
    if (envelope.action === 'pdfDownload') {
      var result = pdfBytes_(data);
      locked_(function(db) {
        var u = session_(db, envelope.token),
          latest = pdfReference_(db, u, envelope.payload);
        need_(latest.file_id === data.file_id && latest.revision === data.revision, 'PDF telah berubah. Muat semula keputusan.');
      });
      data = result;
    }
    return {
      ok: true,
      data: data
    };
  } catch (e) {
    if (!e.code) console.error('MPS RPC internal failure; inspect operation diagnostics.');
    return {
      ok: false,
      error: {
        code: e.code || 'INTERNAL',
        message: e.code ? e.message : 'Operasi gagal. Cuba semula; hubungi pentadbir jika berulang.',
        details: e.details || null
      }
    };
  }
}

function activateYear_(value) {
  CONFIG_REQUEST_ = null;
  PropertiesService.getScriptProperties().setProperties({
    ACADEMIC_YEAR: value.year,
    SPREADSHEET_ID: value.spreadsheet
  });
  CONFIG_REQUEST_ = null;
}
