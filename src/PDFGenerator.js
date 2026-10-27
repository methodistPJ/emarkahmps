/* Combined Docs output; append checkpoint is rolled back before retry. No official per-student PDF. */
function templateInstall_() {
  var parent = rootFolder_(),
    p = PropertiesService.getScriptProperties(),
    original = p.getProperty('SOURCE_TEMPLATE_ID') || '130SgR9FsbAVKJ1mfRaC9iF7RmA6Ubys3GlbNDI-qkiU';
  try {
    if (!p.getProperty('REFERENCE_TEMPLATE_COPY_ID')) {
      var copy = DriveApp.getFileById(original).makeCopy('MPS Original Template Reference — working copy',
        parent);
      p.setProperty('REFERENCE_TEMPLATE_COPY_ID', copy.getId());
    }
  } catch (e) {
    console.log('Original template unavailable; using complete replacement.');
  }
  if (p.getProperty('TEMPLATE_ID')) return p.getProperty('TEMPLATE_ID');
  var d = DocumentApp.create('MPS Assessment Template v1'),
    body = d.getBody();
  body.clear();
  pageStyle_(body);
  var subjects = SUBJECT_SEED_.map(function(s) {
    return {
      subject_code: s[0],
      subject_name: s[1]
    };
  });
  slip_(body, {
    school: config_().school,
    name: '{{NAMA}}',
    class_name: '{{KELAS}}',
    exam_type: '{{PEPERIKSAAN}}',
    academic_year: '{{TAHUN_AKADEMIK}}',
    remark: '{{ULASAN_GURU}}',
    class_teacher: '{{GURU_KELAS}}',
    headmistress: config_().head,
    subjects: subjects,
    marks: subjects.map(function(s) {
      return {
        subject_code: s.subject_code,
        mark_status: 'SCORED',
        score: '{{' + s.subject_code + '}}',
        grade: '{{GRED_' + s.subject_code + '}}'
      };
    })
  });
  d.saveAndClose();
  DriveApp.getFileById(d.getId()).moveTo(parent);
  p.setProperty('TEMPLATE_ID', d.getId());
  return d.getId();
}

function pageStyle_(body) {
  body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(35).setMarginBottom(35).setMarginLeft(42)
    .setMarginRight(42);
  body.setAttributes({
    FONT_FAMILY: 'Arial',
    FONT_SIZE: 10
  });
}

function para_(body, text, size, bold) {
  var p = body.appendParagraph(text);
  p.editAsText().setFontFamily('Arial').setFontSize(size || 10).setBold(!!bold);
  p.setSpacingBefore(0).setSpacingAfter(5).setLineSpacing(1.05);
  return p;
}

function slip_(body, s) {
  need_(s.name.length <= 140 && s.remark.length <= 300, 'Nama atau ulasan melebihi had layout.');
  para_(body, s.school.toUpperCase(), 14, true).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  para_(body, 'SLIP KEPUTUSAN ' + s.exam_type + ' ' + s.academic_year, 11, true).setAlignment(DocumentApp
    .HorizontalAlignment.CENTER);
  para_(body, 'Nama: ' + s.name, 10, true);
  para_(body, 'Kelas: ' + s.class_name, 10);
  var rows = [
    ['Mata Pelajaran', 'Markah', 'Gred']
  ];
  s.subjects.forEach(function(sub) {
    var m = s.marks.find(function(m) {
      return m.subject_code === sub.subject_code;
    });
    if (!m || m.mark_status === 'TB') return;
    need_(m.mark_status !== 'EMPTY', 'Snapshot mempunyai markah EMPTY.');
    rows.push([sub.subject_name, m.mark_status === 'TH' ? 'TH' : String(m.score), m.mark_status === 'TH' ?
      'TH' : m.grade
    ]);
  });
  need_(rows.length <= 15, 'Layout maksimum 14 subjek.');
  var t = body.appendTable(rows);
  t.setBorderWidth(0.4);
  t.setColumnWidth(0, 351);
  t.setColumnWidth(1, 80);
  t.setColumnWidth(2, 80);
  for (var r = 0; r < t.getNumRows(); r++) {
    var row = t.getRow(r);
    row.setMinimumHeight(22);
    for (var c = 0; c < 3; c++) {
      var cell = row.getCell(c);
      cell.setPaddingTop(3).setPaddingBottom(3).setPaddingLeft(6).setPaddingRight(6);
      var p = cell.getChild(0).asParagraph();
      p.editAsText().setFontFamily('Arial').setFontSize(10);
      p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
      if (r === 0) {
        cell.setBackgroundColor('#EEF1F6');
        p.editAsText().setBold(true);
      }
      if (c > 0) p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
  para_(body, 'Ulasan Guru Kelas', 10, true);
  para_(body, s.remark, 10);
  para_(body, '', 8);
  var signatures = body.appendTable([
    ['____________________', '____________________', '____________________'],
    ['Guru Kelas', 'Guru Besar', 'Ibu Bapa / Penjaga'],
    [s.class_teacher, s.headmistress, '']
  ]);
  signatures.setBorderWidth(0);
  for (var j = 0; j < 3; j++) {
    signatures.setColumnWidth(j, 170.33);
    for (var k = 0; k < 3; k++) {
      var sig = signatures.getRow(k).getCell(j);
      sig.setPaddingTop(2).setPaddingBottom(2);
      var sigParagraph = sig.getChild(0).asParagraph();
      sigParagraph.editAsText().setFontFamily('Arial').setFontSize(8);
      sigParagraph.setSpacingAfter(0).setSpacingBefore(0).setLineSpacing(1)
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
  para_(body, 'Digital Hub · SK Methodist PJ', 8).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}
async function pdfValidate_(blob, count) {
  var data = new Uint8Array(blob.getBytes().map(function(b) {
    return (b + 256) % 256;
  }));
  var pdf = await PDFLib.PDFDocument.load(data, {
    parseSpeed: Infinity,
    updateMetadata: false
  });
  need_(pdf.getPageCount() === count, 'Bilangan halaman PDF tidak sepadan dengan murid: ' + pdf
    .getPageCount() + '/' + count);
  pdf.getPages().forEach(function(p) {
    var size = p.getSize();
    need_(Math.abs(size.width - 595.28) < 2 && Math.abs(size.height - 841.89) < 2 && p.getRotation()
      .angle % 360 === 0, 'PDF mesti A4 portrait.');
  });
  return {
    pages: pdf.getPageCount(),
    sha256: hash_(Utilities.base64Encode(blob.getBytes()))
  };
}

function pdfRetry_(db, u, p, req) {
  admin_(u);
  var m = metadata_(db, p.exam_id, p.class_id);
  need_(m && m.finalized_at && ['FAILED', 'QUEUED', 'AWAITING_ADMIN', 'OUTDATED'].indexOf(m.pdf_status) >= 0,
    'Tiada job gagal untuk dicuba semula.');
  m.pdf_status = 'QUEUED';
  m.job_lease = '';
  m.job_owner = '';
  m.job_error = '';
  db.put('CLASS_REVIEWS', m);
  audit_(db, u, req, 'PDF_RETRY', 'CLASS_REVIEWS', m.review_id, null, {
    revision: m.pdf_revision
  }, 'Cuba semula');
  return {
    status: 'QUEUED'
  };
}

function pdfDownload_(db, u, p) {
  admin_(u);
  readable_(db, u, p.exam_id, p.class_id);
  var m = metadata_(db, p.exam_id, p.class_id);
  need_(m && m.finalized_at && m.pdf_status === 'COMPLETED' && Number(m.pdf_revision) === Number(m
    .class_finalization_revision), 'PDF rasmi belum tersedia atau sudah lapuk.');
  var file = DriveApp.getFileById(m.pdf_file_id),
    blob = file.getBlob();
  need_(blob.getBytes().length <= 12 * 1024 * 1024,
    'PDF terlalu besar. Pentadbir perlu memberikan akses Drive khusus.');
  return {
    name: file.getName(),
    base64: Utilities.base64Encode(blob.getBytes()),
    mime: 'application/pdf'
  };
}
async function pdfStep_() {
  var job = locked_(function(db) {
    var m = db.read('CLASS_REVIEWS').find(function(r) {
      return r.record_type === 'CLASS' && r.finalized_at && (r.pdf_status === 'QUEUED' || r
        .pdf_status === 'PROCESSING' && Date.parse(r.job_lease) < Date.now());
    });
    if (!m) return null;
    m.pdf_status = 'PROCESSING';
    m.job_owner = id_();
    m.job_lease = new Date(Date.now() + 480000).toISOString();
    db.put('CLASS_REVIEWS', m);
    commit_(db, id_(), {
      user_id: 'WORKER'
    }, {
      action: 'claimPDF'
    }, {});
    var rows = db.read('CLASS_REVIEWS').filter(function(r) {
      return r.record_type === 'STUDENT' && r.exam_id === m.exam_id && r.class_id === m.class_id &&
        Number(r.class_finalization_revision) === Number(m.class_finalization_revision);
    }).sort(function(a, b) {
      return a.student_name_snapshot.localeCompare(b.student_name_snapshot, 'ms');
    });
    var finalMeta=json_(m.result_snapshot,{}),fingerprint=snapshotFingerprint_(rows.map(function(r){return [r.student_id,r.result_snapshot];}));
    var snapshotError=!(rows.length>0&&rows.length===Number(finalMeta.students))?'Bilangan snapshot murid tidak sepadan.':finalMeta.fingerprint&&finalMeta.fingerprint!==fingerprint?'Snapshot rasmi berubah. Penjanaan dihentikan.':'';
    return {
      snapshotError:snapshotError,
      fingerprint:fingerprint,
      meta: m,
      snapshots: rows.map(function(r) {
        return json_(r.result_snapshot, null);
      }),
      build: db.state('pdfbuild:' + key_([m.review_id, m.pdf_revision]))
    };
  });
  if (!job) return;
  try {
    var m = job.meta;
    need_(!job.snapshotError,job.snapshotError);
    var
      key = 'pdfbuild:' + key_([m.review_id, m.pdf_revision]),
      build = job.build;
    need_(!build||!build.fingerprint||build.fingerprint===job.fingerprint,'Checkpoint tidak sepadan dengan snapshot.');
    if (!build) {
      var template = PropertiesService.getScriptProperties().getProperty('TEMPLATE_ID');
      need_(template, 'Pasang template dahulu.');
      var file = DriveApp.getFileById(template).makeCopy('MPS_TEMP_' + hash_(key).slice(0, 16),
          rootFolder_()),
        doc = DocumentApp.openById(file.getId());
      doc.getBody().clear();
      pageStyle_(doc.getBody());
      var initialChildren = doc.getBody().getNumChildren();
      doc.saveAndClose();
      build = {
        doc: file.getId(),
        cursor: 0,
        children: initialChildren,
        revision: m.pdf_revision,
        fingerprint:job.fingerprint
      };
      locked_(function(db) {
        var current = metadata_(db, m.exam_id, m.class_id);
        need_(current.job_owner === m.job_owner, 'Lease berubah.');
        db.setState(key, build);
        commit_(db, id_(), {
          user_id: 'WORKER'
        }, {
          action: 'pdfBuildCreate'
        }, {});
      });
    }
    var d = DocumentApp.openById(build.doc),
      body = d.getBody();
    while (body.getNumChildren() > build.children) body.removeChild(body.getChild(body.getNumChildren() -
      1));
    var end = Math.min(build.cursor + 4, job.snapshots.length);
    for (var i = build.cursor; i < end; i++) {
      if (i > 0) body.appendPageBreak();
      slip_(body, job.snapshots[i]);
    }
    build.fingerprint=job.fingerprint;
    build.cursor = end;
    build.children = body.getNumChildren();
    d.saveAndClose();
    if (end < job.snapshots.length) {
      locked_(function(db) {
        var current = metadata_(db, m.exam_id, m.class_id);
        need_(current.job_owner === m.job_owner && current.finalized_at && Number(current
          .pdf_revision) === Number(m.pdf_revision), 'Keputusan berubah semasa penjanaan.');
        db.setState(key, build);
        current.pdf_status = 'QUEUED';
        current.job_lease = '';
        db.put('CLASS_REVIEWS', current);
        commit_(db, id_(), {
          user_id: 'WORKER'
        }, {
          action: 'pdfCheckpoint'
        }, {});
      });
      return;
    }
    var blob = DriveApp.getFileById(build.doc).getAs(MimeType.PDF),
      validated = await pdfValidate_(blob, job.snapshots.length),
      snapshot = job.snapshots[0],
      folder = folder_(folder_(folder_(rootFolder_(), 'SLIP KEPUTUSAN'), String(snapshot.academic_year)),
        snapshot.exam_type),
      name = snapshot.exam_type + '_' + snapshot.academic_year + '_' + snapshot.class_name.replace(
        /[^a-zA-Z0-9]+/g, '_') + '_r' + m.pdf_revision + '_' + hash_(key).slice(0, 8)+'_'+job.fingerprint.slice(0,12) + '.pdf';
    var existing = folder.getFilesByName(name),
      hasExisting = existing.hasNext(),
      output = hasExisting ? existing.next() : folder.createFile(blob.setName(name));
    if(hasExisting){var provenance=json_(output.getDescription()||'',{});need_(provenance.snapshot===job.fingerprint,'Fail sedia ada tidak mempunyai bukti snapshot yang sepadan.');}else output.setDescription(JSON.stringify({mps_release:'1.0.3-rc.1',snapshot:job.fingerprint,revision:m.pdf_revision}));
    var check = await pdfValidate_(output.getBlob(), job.snapshots.length);
    check.snapshot=job.fingerprint;
    if (!hasExisting) need_(check.sha256 === validated.sha256, 'Semakan fail tersimpan gagal.');
    locked_(function(db) {
      var current = metadata_(db, m.exam_id, m.class_id);
      need_(current.job_owner === m.job_owner && current.finalized_at && Number(current
        .pdf_revision) === Number(m.pdf_revision), 'Job telah digantikan.');
      current.pdf_status = 'COMPLETED';
      current.pdf_file_id = output.getId();
      current.pdf_url = output.getUrl();
      current.job_lease = '';
      current.job_error = '';
      db.put('CLASS_REVIEWS', current);
      build.validation = check;
      db.setState(key, build);
      audit_(db, {
        user_id: 'WORKER'
      }, id_(), 'PDF_COMPLETE', 'CLASS_REVIEWS', m.review_id, null, {
        file_id: output.getId(),
        revision: m.pdf_revision,
        pages: validated.pages
      }, 'Page count and A4 checked');
      commit_(db, id_(), {
        user_id: 'WORKER'
      }, {
        action: 'pdfComplete'
      }, {});
    });
  } catch (e) {
    locked_(function(db) {
      var m = metadata_(db, job.meta.exam_id, job.meta.class_id);
      if (!m || m.job_owner !== job.meta.job_owner) return;
      m.pdf_status = 'FAILED';
      m.job_lease = '';
      m.job_attempts = Number(m.job_attempts || 0) + 1;
      m.job_error = e.code === 'VALIDATION' ? e.message :
        'Penjanaan gagal. Pentadbir boleh cuba semula selepas semakan konfigurasi.';
      db.put('CLASS_REVIEWS', m);
      commit_(db, id_(), {
        user_id: 'WORKER'
      }, {
        action: 'pdfFailed'
      }, {});
    });
    console.error('MPS PDF job failed; inspect authorized queue status.');
  }
}
async function processQueue_(){CONFIG_REQUEST_=null;try{await pdfStep_();archiveStep_();PropertiesService.getScriptProperties().setProperty('WORKER_LAST_OK',now_());}catch(e){console.error('MPS worker failed; inspect queue and pending recovery.');throw e;}}
