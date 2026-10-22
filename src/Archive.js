function folder_(parent, name) {
  var found = parent.getFoldersByName(name);
  if (found.hasNext()) return found.next();
  return parent.createFolder(name);
}

function rootFolder_() {
  need_(config_().parent, 'DRIVE_PARENT_ID belum dikonfigurasi.');
  return DriveApp.getFolderById(config_().parent);
}

function archiveQueue_(db, u, p, req) {
  admin_(u);
  need_(String(p.year) === String(config_().year), 'Hanya tahun aktif boleh diarkibkan.');
  need_(p.confirmed === true, 'Sahkan arkib tahun akademik.');
  var exams = db.read('EXAMS').filter(function(e) {
    return String(e.academic_year) === String(p.year);
  });
  need_(exams.some(function(e) {
    return e.exam_type === 'UPSA';
  }) && exams.some(function(e) {
    return e.exam_type === 'UASA';
  }), 'UPSA dan UASA diperlukan.');
  need_(exams.every(function(e) {
    return e.status === 'CLOSED' || e.status === 'FINALIZED' || e.status === 'ARCHIVING';
  }), 'Tutup semua peperiksaan dahulu.');
  var classes = db.read('CLASS_REVIEWS').filter(function(r) {
    return r.record_type === 'CLASS' && exams.some(function(e) {
      return e.exam_id === r.exam_id;
    });
  });
  need_(classes.length && classes.every(function(m) {
    return m.finalized_at && m.pdf_status === 'COMPLETED';
  }), 'Semua kelas mesti dimuktamadkan dan PDF selesai.');
  var existing = db.state('archive:' + p.year);
  need_(!existing || existing.status === 'FAILED', 'Arkib sudah dijadualkan atau selesai.');
  db.setState('archive:' + p.year, Object.assign({}, existing || {}, {
    status: 'QUEUED',
    year: p.year,
    actor: u.user_id,
    attempts: 0
  }));
  exams.forEach(function(e) {
    e.status = 'ARCHIVING';
    db.put('EXAMS', e);
  });
  audit_(db, u, req, 'ARCHIVE_QUEUE', 'EXAMS', String(p.year), null, {
    status: 'QUEUED'
  }, 'Tutup & arkib tahun');
  return {
    status: 'QUEUED'
  };
}

function archiveStep_() {
  var task = locked_(function(db) {
    var states = db.read('_STATE'),
      r = states.find(function(r) {
        if (r.state_id.indexOf('archive:') !== 0) return false;
        var x = json_(r.value, {});
        return x.status === 'QUEUED' || x.status === 'PROCESSING' && Number(x.lease) < Date.now();
      });
    if (!r) return null;
    var x = json_(r.value, {});
    x.status = 'PROCESSING';
    x.lease = Date.now() + 480000;
    x.owner = id_();
    db.setState(r.state_id, x);
    commit_(db, id_(), {
      user_id: 'WORKER'
    }, {
      action: 'claimArchive'
    }, {});
    return x;
  });
  if (!task) return;
  try {
    var data = locked_(function(db) {
      var out = {};
      Object.keys(SCHEMA_).filter(function(t) {
        return t[0] !== '_';
      }).forEach(function(t) {
        out[t] = db.read(t).map(function(r) {
          var n = Object.assign({}, r);
          delete n._row;
          if (t === 'USERS') {
            n.authentication_data = '';
            n.identification_code = '';
            n.auth_version = '';
          }
          return SCHEMA_[t].map(function(k) {
            return n[k] === undefined ? '' : n[k];
          });
        });
      });
      return out;
    });
    var parent = folder_(folder_(rootFolder_(), 'ARKIB DATABASE'), String(task.year)),
      state = locked_(function(db) {
        return db.state('archive:' + task.year);
      });
    var book = state.file_id ? SpreadsheetApp.openById(state.file_id) : SpreadsheetApp.create('MPS_ARKIB_' +
      task.year);
    if (!state.file_id) {
      DriveApp.getFileById(book.getId()).moveTo(parent);
      locked_(function(db) {
        var current = db.state('archive:' + task.year);
        need_(current.owner === task.owner, 'Lease arkib berubah.');
        current.file_id = book.getId();
        db.setState('archive:' + task.year, current);
        commit_(db, id_(), {
          user_id: 'WORKER'
        }, {
          action: 'archiveFile'
        }, {});
      });
    }
    var manifest = {};
    Object.keys(data).forEach(function(t) {
      var sheet = book.getSheetByName(t) || book.insertSheet(t),
        rows = [SCHEMA_[t]].concat(data[t]);
      sheet.clearContents();
      ensureGrid_(sheet,rows.length,SCHEMA_[t].length);
      SCHEMA_[t].forEach(function(field,col){if(/_id$|_code$|_date$/.test(field))sheet.getRange(1,col+1,rows.length,1).setNumberFormat('@');});
      sheet.getRange(1, 1, rows.length, SCHEMA_[t].length).setValues(rows.map(function(row) {
        return row.map(function(v) {
          return typeof v === 'string' && /^[=+@]/.test(v) ? "'" + v : v;
        });
      }));
      manifest[t] = {
        rows: data[t].length,
        hash: hash_(JSON.stringify(rows))
      };
    });
    SpreadsheetApp.flush();
    Object.keys(manifest).forEach(function(t) {
      var actual = book.getSheetByName(t).getRange(1, 1, data[t].length + 1, SCHEMA_[t].length)
        .getValues();
      need_(hash_(JSON.stringify(actual)) === manifest[t].hash, 'Pengesahan arkib gagal: ' + t);
    });
    var manifests = parent.getFilesByName('manifest_' + task.year + '.json');
    if (!manifests.hasNext()) parent.createFile('manifest_' + task.year + '.json', JSON.stringify(manifest,
      null, 2), MimeType.PLAIN_TEXT);
    locked_(function(db) {
      var current = db.state('archive:' + task.year);
      need_(current.owner === task.owner, 'Lease arkib berubah.');
      current.status = 'COMPLETED';
      current.manifest = manifest;
      current.completed = now_();
      db.setState('archive:' + task.year, current);
      db.read('EXAMS').filter(function(e) {
        return String(e.academic_year) === String(task.year);
      }).forEach(function(e) {
        e.status = 'ARCHIVED';
        db.put('EXAMS', e);
      });
      audit_(db, {
        user_id: task.actor
      }, id_(), 'ARCHIVE_COMPLETE', 'EXAMS', String(task.year), null, {
        file_id: book.getId(),
        manifest: manifest
      }, 'Disahkan melalui hash setiap jadual');
      commit_(db, id_(), {
        user_id: 'WORKER'
      }, {
        action: 'archiveComplete'
      }, {});
    });
  } catch (e) {
    locked_(function(db) {
      var x = db.state('archive:' + task.year);
      if (!x || x.owner !== task.owner) return;
      x.status = 'FAILED';
      x.error = 'Arkib gagal. Semak log pemasangan dan cuba semula.';
      db.setState('archive:' + task.year, x);
      commit_(db, id_(), {
        user_id: 'WORKER'
      }, {
        action: 'archiveFailed'
      }, {});
    });
    console.error('MPS archive job failed; inspect authorized queue status.');
  }
}

function newYear_(db, u, p, req) {
  admin_(u);
  need_(/^20\d{2}$/.test(String(p.year)) && Number(p.year) > Number(config_().year),
    'Pilih tahun baharu selepas tahun aktif.');
  var old = db.state('archive:' + config_().year);
  need_(old && old.status === 'COMPLETED', 'Arkib tahun aktif mesti selesai dahulu.');
  need_(p.confirmed === true, 'Sahkan pengaktifan tahun.');
  var name = 'MPS_AKTIF_' + p.year + '_' + req,
    files = rootFolder_().getFilesByName(name),
    book = files.hasNext() ? SpreadsheetApp.openById(files.next().getId()) : SpreadsheetApp.create(name);
  Object.keys(SCHEMA_).forEach(function(t) {
    var sheet = book.getSheetByName(t) || book.insertSheet(t);
    sheet.getRange(1, 1, 1, SCHEMA_[t].length).setValues([SCHEMA_[t]]);
    if (t[0] === '_') sheet.hideSheet();
  });
  ['STUDENTS', 'USERS', 'SUBJECTS', 'GRADE_RULES'].forEach(function(t) {
    var rows = db.read(t).map(function(r) {
      return SCHEMA_[t].map(function(k) {
        return r[k] === undefined ? '' : r[k];
      });
    });
    if(rows.length)SCHEMA_[t].forEach(function(field,col){if(/_id$|_code$|_date$/.test(field)){book.getSheetByName(t).getRange(2,col+1,rows.length,1).setNumberFormat('@');rows.forEach(function(row){if(row[col]!==''&&row[col]!=null)row[col]=String(row[col]);});}});
    if(t==='USERS'&&rows.length){var col=SCHEMA_.USERS.indexOf('identification_code');book.getSheetByName(t).getRange(2,col+1,rows.length,1).setNumberFormat('@');rows.forEach(function(row){row[col]=String(row[col]);});}
    if(rows.length)ensureGrid_(book.getSheetByName(t),rows.length+1,SCHEMA_[t].length);
    if (rows.length) book.getSheetByName(t).getRange(2, 1, rows.length, SCHEMA_[t].length).setValues(rows
      .map(function(row) {
        return row.map(function(v) {
          return typeof v === 'string' && /^[=+@]/.test(v) ? "'" + v : v;
        });
      }));
  });
  var state = db.read('_STATE').filter(function(r) {
    return r.state_id.indexOf('session:') === 0 && json_(r.value, {}).expires > Date.now() || r.state_id
      .indexOf('archive:') === 0;
  }).map(function(r) {
    return [r.state_id, r.value];
  });
  if(state.length)ensureGrid_(book.getSheetByName('_STATE'),state.length+1,2);
  if (state.length) book.getSheetByName('_STATE').getRange(2, 1, state.length, 2).setValues(state);
  DriveApp.getFileById(book.getId()).moveTo(rootFolder_());
  SpreadsheetApp.flush();
  db.setState('next-year', {
    year: String(p.year),
    spreadsheet: book.getId()
  });
  audit_(db, u, req, 'NEW_YEAR', 'EXAMS', String(p.year), {
    year: config_().year
  }, {
    year: p.year,
    spreadsheet: book.getId()
  }, 'Database baharu; identiti stabil dikekalkan; enrolmen dan tugasan perlu disediakan');
  return {
    year: String(p.year),
    spreadsheet: book.getId(),
    activate: true
  };
}
