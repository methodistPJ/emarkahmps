function rosterImport_(db, u, p, req) {
  admin_(u);
  need_(Array.isArray(p.rows) && p.rows.length && p.rows.length <= 100,
    'Import 1–100 rekod setiap kelompok.');
  var names = {},
    ids = {},
    result = [];
  p.rows.forEach(function(row) {
    var name = text_(row.full_name, 140),
      sid = String(row.student_id || ''),
      c = class_(db, row.class_id);
    need_(!names[name.toUpperCase()] || sid, 'Nama berulang memerlukan ID stabil.');
    names[name.toUpperCase()] = true;
    var old = sid && db.find('STUDENTS', 'student_id', sid);
    need_(!sid || old, 'ID lama tidak dikenali. Kosongkan untuk murid baharu.');
    need_(!old || !ids[sid], 'ID berulang dalam import.');
    ids[sid] = true;
    need_(old || !db.read('STUDENTS').some(function(s) {
      return s.full_name.toUpperCase() === name.toUpperCase();
    }), 'Nama sepadan sudah ada. Nyatakan student_id selepas semakan.');
    var student = old || {
      student_id: id_(),
      full_name: name,
      student_status: 'ACTIVE',
      created_at: now_(),
      updated_at: now_()
    };
    if (!old) db.put('STUDENTS', student);
    var enrol = entitySave_(db, u, {
      table: 'ENROLMENTS',
      record: {
        student_id: student.student_id,
        class_id: c.class_id,
        start_date: row.start_date || String(c.academic_year) + '-01-01',
        status: 'ACTIVE'
      },
      reason: 'Import senarai disemak'
    }, req);
    result.push({
      student_id: student.student_id,
      name: name,
      enrolment_id: enrol.enrolment_id
    });
  });
  audit_(db, u, req, 'ROSTER_IMPORT', 'STUDENTS', 'batch', null, {
    count: result.length
  }, 'Padanan ID stabil');
  return {
    students: result
  };
}

function historicalImport_(db, u, p, req) {
  admin_(u);
  need_(p.confirmed === true && p.document && p.document.kind === 'MPS_LEGACY_REVIEW',
    'Fail semakan migrasi diperlukan.');
  var doc = p.document;
  need_(String(doc.year) !== String(config_().year), 'Data sejarah mesti dipisahkan daripada tahun aktif.');
  need_(Array.isArray(doc.students) && doc.students.length > 0 && doc.students.length <= 1000,
    'Bilangan murid migrasi tidak sah.');
  var decisions = p.decisions || {},
    rules = rules_(db, 'v1'),
    classes = {},
    names = {},
    sourceRows = [];
  doc.students.forEach(function(s) {
    text_(s.name, 140);
    var name = s.name.trim().toUpperCase();
    need_(!names[name], 'Nama berulang dalam sejarah memerlukan semakan identiti manual sebelum import.');
    names[name] = true;
    need_(Number(s.year_level) >= 1 && Number(s.year_level) <= 6 && s.marks && Object.keys(s.marks)
      .length <= 14, 'Rekod sejarah tidak sah.');
    classes[s.class_name] = s.year_level;
    Object.keys(s.marks).forEach(function(code) {
      var original = s.marks[code],
        ref = s.source_sheet + '!' + original.cell,
        decision = original.value === null ? decisions[ref] : original.value;
      need_(decision !== undefined, 'Kosong sejarah belum disemak: ' + ref);
      var value = markValue_(decision, rules);
      sourceRows.push([s.source_sheet, s.source_row, s.name, code, JSON.stringify(original
          .original_value === undefined ? original.value : original.original_value), original
        .grade || '', value.mark_status, value.score, value.grade, ref
      ]);
    });
  });
  var archive = folder_(folder_(rootFolder_(), 'ARKIB DATABASE'), String(doc.year)),
    book = SpreadsheetApp.create('MPS_MIGRASI_UPSA_' + doc.year + '_' + req),
    b = new Db_(book);
  Object.keys(SCHEMA_).forEach(function(t) {
    var s = book.getSheetByName(t) || book.insertSheet(t);
    s.getRange(1, 1, 1, SCHEMA_[t].length).setValues([SCHEMA_[t]]);
  });
  var examId = 'LEGACY_UPSA_' + doc.year;
  Object.keys(classes).forEach(function(name) {
    b.put('CLASSES', {
      class_id: key_([doc.year, name]),
      academic_year: doc.year,
      year_level: classes[name],
      academic_stage: Number(classes[name]) <= 3 ? 1 : 2,
      class_name: name,
      active: true
    });
  });
  b.put('EXAMS', {
    exam_id: examId,
    academic_year: doc.year,
    exam_type: 'UPSA',
    status: 'CLOSED',
    grading_version: 'v1',
    template_version: 'replacement-v1',
    subject_snapshot: JSON.stringify(db.read('SUBJECTS').map(function(s) {
      var n = Object.assign({}, s);
      n.offered_year_levels = json_(s.offered_year_levels, []);
      return n;
    }))
  });
  db.read('GRADE_RULES').filter(function(r) {
    return r.grading_version === 'v1';
  }).forEach(function(r) {
    var n = Object.assign({}, r);
    delete n._row;
    b.put('GRADE_RULES', n);
  });
  db.read('SUBJECTS').forEach(function(r) {
    var n = Object.assign({}, r);
    delete n._row;
    b.put('SUBJECTS', n);
  });
  doc.students.forEach(function(s) {
    var sid = id_(),
      cid = key_([doc.year, s.class_name]);
    b.put('STUDENTS', {
      student_id: sid,
      full_name: s.name,
      student_status: 'ACTIVE',
      created_at: now_(),
      updated_at: now_()
    });
    b.put('ENROLMENTS', {
      enrolment_id: id_(),
      student_id: sid,
      academic_year: doc.year,
      class_id: cid,
      status: 'ACTIVE',
      start_date: doc.year + '-01-01'
    });
    Object.keys(s.marks).forEach(function(code) {
      var o = s.marks[code],
        value = markValue_(o.value === null ? decisions[s.source_sheet + '!' + o.cell] : o.value,
          rules);
      b.put('MARKS', Object.assign({
        mark_id: key_([examId, sid, code]),
        exam_id: examId,
        student_id: sid,
        subject_code: code,
        class_id_snapshot: cid,
        student_name_snapshot: s.name,
        year_level_snapshot: s.year_level,
        record_version: 1,
        updated_by: u.user_id,
        updated_at: now_(),
        default_tb: false
      }, value));
    });
  });
  writePlan_(book, Object.keys(b.staged).map(function(k) {
    return b.staged[k];
  }));
  var imports = book.insertSheet('_IMPORT_SOURCE');
  ensureGrid_(imports,sourceRows.length+1,10);
  imports.getRange(1, 1, sourceRows.length + 1, 10).setValues([
    ['sheet', 'row', 'name', 'subject', 'original_value', 'original_grade', 'reviewed_status', 'score',
      'recalculated_grade', 'source_cell'
    ]
  ].concat(sourceRows).map(function(row) {
    return row.map(function(v) {
      return typeof v === 'string' && /^[=+@]/.test(v) ? "'" + v : v;
    });
  }));
  book.insertSheet('_IMPORT_METADATA').getRange(1, 1, 5, 2).setValues([
    ['key', 'value'],
    ['source_sha256', doc.source_sha256 || ''],
    ['source_headers', JSON.stringify(doc.source_headers || {})],
    ['issues', JSON.stringify(doc.issues || [])],
    ['grade_discrepancies', JSON.stringify(doc.discrepancies || [])]
  ]);
  DriveApp.getFileById(book.getId()).moveTo(archive);
  audit_(db, u, req, 'HISTORICAL_IMPORT', 'ARCHIVE', book.getId(), null, {
    sha256: doc.source_sha256,
    count: doc.students.length,
    sourceCells: sourceRows.length
  }, 'Original preserved; reviewed results in separate workbook.');
  return {
    file_id: book.getId(),
    url: book.getUrl(),
    count: doc.students.length
  };
}
