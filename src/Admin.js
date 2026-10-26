function adminData_(db, u) {
  admin_(u);
  var out = {};
  ['STUDENTS', 'ENROLMENTS', 'CLASSES', 'USERS', 'ASSIGNMENTS', 'SUBJECTS', 'EXAMS', 'GRADE_RULES'].forEach(
    function(t) {
      out[t] = db.read(t).map(function(r) {
        var x = Object.assign({}, r);
        delete x.authentication_data;
        delete x._row;
        return x;
      });
    });
  out.settings = {
    year: config_().year,
    teacher_exam_focus: teacherExamFocus_(db),
    school: config_().school,
    headmistress: config_().head
  };
  return out;
}

function entitySave_(db, u, p, req) {
  admin_(u);
  var t = p.table,
    r = Object.assign({}, p.record),
    old, id;
  delete r._row;
  if (t === 'CLASSES') {
    id = r.class_id || id_();
    old = db.find(t, 'class_id', id);
    need_(!old || !db.read('EXAMS').some(function(e) {
      return String(e.academic_year) === String(old.academic_year) && e.status !== 'DRAFT';
    }), 'Kelas peperiksaan yang telah disediakan tidak boleh diubah.');
    r.class_id = id;
    r.class_name = text_(r.class_name, 60);
    need_(!db.read(t).some(function(c) {
      return c.class_id !== id && String(c.academic_year) === String(r.academic_year) && c
        .class_name === r.class_name;
    }), 'Nama kelas bagi tahun ini sudah ada.');
    need_(Number.isInteger(Number(r.year_level)) && r.year_level >= 1 && r.year_level <= 6,
      'Tahun 1–6 diperlukan.');
    r.academic_stage = Number(r.year_level) <= 3 ? 1 : 2;
    need_(/^20\d{2}$/.test(String(r.academic_year)), 'Tahun akademik tidak sah.');
    r.active = bool_(r.active);
  } else if (t === 'STUDENTS') {
    id = r.student_id || id_();
    old = db.find(t, 'student_id', id);
    r.student_id = id;
    r.full_name = text_(r.full_name, 140);
    need_(['ACTIVE', 'LEFT', 'GRADUATED'].indexOf(r.student_status) >= 0, 'Status murid tidak sah.');
    r.created_at = old ? old.created_at : now_();
    r.updated_at = now_();
  } else if (t === 'ENROLMENTS') {
    id = r.enrolment_id || id_();
    old = db.find(t, 'enrolment_id', id);
    need_(!old, 'Tutup enrolmen lama, cipta rekod keahlian baharu.');
    need_(db.find('STUDENTS', 'student_id', r.student_id), 'ID murid tidak dijumpai.');
    var c = class_(db, r.class_id);
    r.academic_year = c.academic_year;
    r.enrolment_id = id;
    need_(['ACTIVE', 'ENDED'].indexOf(r.status) >= 0, 'Status enrolmen tidak sah.');
    need_(!db.read(t).some(function(x) {
      return x.student_id === r.student_id && String(x.academic_year) === String(r.academic_year) && x
        .status === 'ACTIVE';
    }), 'Murid sudah mempunyai enrolmen aktif. Tamatkan rekod lama dahulu.');
    need_(Number.isFinite(Date.parse(r.start_date)), 'Tarikh mula diperlukan.');
    r.end_date = r.end_date || '';
  } else if (t === 'ASSIGNMENTS') {
    id = r.assignment_id || id_();
    old = db.find(t, 'assignment_id', id);
    var c = class_(db, r.class_id),
      teacher = db.find('USERS', 'user_id', r.user_id);
    need_(teacher && bool_(teacher.active), 'Guru aktif diperlukan.');
    r.academic_year = c.academic_year;
    r.assignment_id = id;
    need_(['SUBJECT_TEACHER', 'CLASS_TEACHER'].indexOf(r.assignment_type) >= 0 && role_(teacher, r
      .assignment_type), 'Peranan guru tidak sepadan.');
    if (r.assignment_type === 'CLASS_TEACHER') {
      r.subject_code = '';
      need_(!db.read(t).some(function(x) {
        return x.assignment_id !== id && x.class_id === r.class_id && x.assignment_type ===
          'CLASS_TEACHER' && bool_(x.active) && bool_(r.active);
      }), 'Kelas sudah mempunyai guru kelas aktif.');
    } else need_(db.find('SUBJECTS', 'subject_code', r.subject_code), 'Kod subjek diperlukan.');
    r.active = bool_(r.active);
  } else if (t === 'SUBJECTS') {
    id = r.subject_code;
    need_(/^[A-Z]{2,8}$/.test(id), 'Kod subjek tidak sah.');
    old = db.find(t, 'subject_code', id);
    r.subject_name = text_(r.subject_name, 80);
    var levels = Array.isArray(r.offered_year_levels) ? r.offered_year_levels : json_(r.offered_year_levels,
      []);
    need_(levels.length && levels.every(function(x) {
      return Number.isInteger(Number(x)) && x >= 1 && x <= 6;
    }), 'Senarai tahun subjek tidak sah.');
    r.offered_year_levels = JSON.stringify(levels.map(Number));
    need_(['TB', 'EMPTY'].indexOf(r.default_status) >= 0, 'Nilai awal mesti TB atau EMPTY.');
    r.display_order = Number(r.display_order);
    need_(Number.isFinite(r.display_order), 'Susunan tidak sah.');
    r.active = bool_(r.active);
  } else fail_('VALIDATION', 'Jadual ini tidak boleh disunting melalui operasi umum.');
  if (old) r._row = old._row;
  db.put(t, r);
  audit_(db, u, req, 'ENTITY_SAVE', t, id, old, r, p.reason || 'Pengurusan pentadbir');
  return r;
}

function enrolmentEnd_(db, u, p, req) {
  admin_(u);
  var r = db.find('ENROLMENTS', 'enrolment_id', p.enrolment_id);
  need_(r, 'Enrolmen tiada.');
  var old = Object.assign({}, r);
  need_(Number.isFinite(Date.parse(p.end_date)), 'Tarikh tamat tidak sah.');
  r.status = 'ENDED';
  r.end_date = p.end_date;
  db.put('ENROLMENTS', r);
  audit_(db, u, req, 'ENROLMENT_END', 'ENROLMENTS', r.enrolment_id, old, r, text_(p.reason, 300));
  return r;
}

function gradesSave_(db, u, p, req) {
  admin_(u);
  var v = text_(p.version, 40);
  need_(!db.read('GRADE_RULES').some(function(r) {
    return r.grading_version === v;
  }), 'Versi gred sudah ada. Cipta versi baharu.');
  validateRules_(p.rules);
  p.rules.forEach(function(r) {
    var safe = {minimum_score:r.minimum_score,maximum_score:r.maximum_score,grade:r.grade,description:r.description||''};
    db.put('GRADE_RULES', Object.assign({}, safe, {
      rule_id: key_([v, r.grade]),
      grading_version: v,
      active: true
    }));
  });
  audit_(db, u, req, 'GRADE_VERSION_CREATE', 'GRADE_RULES', v, null, p.rules, 'Versi baharu');
  return {
    version: v
  };
}

function examSave_(db, u, p, req) {
  admin_(u);
  var r = Object.assign({}, p.record);
  delete r._row;
  var old = r.exam_id && db.find('EXAMS', 'exam_id', r.exam_id);
  need_(['UPSA', 'UASA'].indexOf(r.exam_type) >= 0, 'Jenis UPSA atau UASA diperlukan.');
  need_(/^20\d{2}$/.test(String(r.academic_year)), 'Tahun tidak sah.');
  need_(!db.read('EXAMS').some(function(x) {
    return x.exam_id !== r.exam_id && String(x.academic_year) === String(r.academic_year) && x
      .exam_type === r.exam_type;
  }), 'Peperiksaan jenis ini sudah ada bagi tahun tersebut.');
  need_(r.template_version === 'replacement-v1', 'Versi layout yang tersedia ialah replacement-v1.');
  need_(Date.parse(r.opening_date) < Date.parse(r.closing_date), 'Tempoh peperiksaan tidak sah.');
  need_(['DRAFT', 'OPEN', 'CLOSED', 'FINALIZED'].indexOf(r.status) >= 0, 'Status peperiksaan tidak sah.');
  if (old && old.status !== 'DRAFT') {
    need_(String(r.academic_year) === String(old.academic_year) && r.exam_type === old.exam_type && r
      .grading_version === old.grading_version && r.template_version === old.template_version,
      'Tahun, jenis, gred dan template peperiksaan yang disediakan dikunci.');
    r.subject_snapshot = old.subject_snapshot;
  } else {
    validateRules_(rules_(db, r.grading_version));
    r.subject_snapshot = '';
  }
  need_(!old || r.status !== 'DRAFT' || old.status === 'DRAFT', 'Peperiksaan yang disediakan tidak boleh kembali ke DRAFT.');
  need_(!old || old.status !== 'ARCHIVING', 'Tahun sedang diarkibkan.');
  need_(!old || old.status !== 'ARCHIVED', 'Peperiksaan arkib dikunci.');
  need_(!old || old.status !== 'DRAFT' || r.status === 'DRAFT',
    'Gunakan Sediakan Peperiksaan untuk membuka DRAFT.');
  need_(old || r.status === 'DRAFT', 'Cipta DRAFT dahulu, kemudian Sediakan Peperiksaan.');
  if (r.status === 'FINALIZED') need_(db.read('CLASS_REVIEWS').filter(function(m) {
    return m.record_type === 'CLASS' && m.exam_id === r.exam_id;
  }).every(function(m) {
    return !!m.finalized_at && m.pdf_status === 'COMPLETED';
  }), 'Semua kelas dan PDF mesti selesai.');
  r.exam_id = old ? old.exam_id : id_();
  if (old) r._row = old._row;
  r.finalized_at = r.status === 'FINALIZED' ? now_() : '';
  db.put('EXAMS', r);
  audit_(db, u, req, 'EXAM_SAVE', 'EXAMS', r.exam_id, old, r, 'Konfigurasi peperiksaan');
  return r;
}

function prepareExam_(db, u, p, req) {
  admin_(u);
  var e = exam_(db, p.exam_id);
  need_(e.status === 'DRAFT' && !db.read('CLASS_REVIEWS').some(function(r) {
    return r.exam_id === e.exam_id;
  }), 'Peperiksaan sudah disediakan.');
  var subjects = db.read('SUBJECTS').filter(function(s) {
    return bool_(s.active);
  }).map(function(s) {
    var n = Object.assign({}, s);
    delete n._row;
    n.offered_year_levels = json_(s.offered_year_levels, []);
    return n;
  });
  need_(subjects.length, 'Subjek tiada.');
  e.subject_snapshot = JSON.stringify(subjects);
  var classes = db.read('CLASSES').filter(function(c) {
    return String(c.academic_year) === String(e.academic_year) && bool_(c.active);
  });
  need_(classes.length, 'Kelas tiada.');
  var students = db.read('STUDENTS'), participationEnabled = db.state('school-participation:' + e.academic_year);
  var enrolments = db.read('ENROLMENTS').filter(function(n) { return String(n.academic_year) === String(e.academic_year); });
  var studentIndex = {}; students.forEach(function(s) { studentIndex[s.student_id] = s; });
  classes.forEach(function(c) {
    var selections = participationEnabled ? db.state('school-participation:' + e.academic_year + ':' + c.class_id) : null;
    need_(!participationEnabled || selections, 'Pilihan subjek kelas belum lengkap.');
    var roster = enrolments.filter(function(n) {
      return n.class_id === c.class_id && n.status === 'ACTIVE';
    }).map(function(n) {
      return studentIndex[n.student_id];
    }).filter(function(s) {
      return s && s.student_status === 'ACTIVE';
    }).sort(function(a, b) {
      return a.full_name.localeCompare(b.full_name, 'ms');
    });
    need_(roster.length && roster.length <= 60, 'Setiap kelas mesti mempunyai 1–60 murid aktif.');
    var subs = subjects.filter(function(s) {
      return s.offered_year_levels.indexOf(Number(c.year_level)) >= 0;
    });
    need_(subs.length > 0 && subs.length <= 14, 'Liputan 1–14 subjek diperlukan bagi layout v1.');
    var start = Math.max(db.sheet('MARKS').getLastRow(), db.read('MARKS').reduce(function(n, m) {
        return Math.max(n, m._row);
      }, 1)) + 1,
      count = 0, subjectBlocks = {}, cohortSelections = {};
    if (selections) roster.forEach(function(student) {
      var chosen = selections[student.student_id];
      need_(Array.isArray(chosen) && chosen.length === 2 && ['PI','PM'].indexOf(chosen[0]) >= 0 && ['BA','BC','BT'].indexOf(chosen[1]) >= 0, 'Pilihan subjek murid belum lengkap.');
      need_(chosen.every(function(code) { return subs.some(function(sub) { return sub.subject_code === code; }); }), 'Subjek pilihan murid tidak ditawarkan.');
      cohortSelections[student.student_id] = chosen;
    });
    subs.forEach(function(s) {
      subjectBlocks[s.subject_code] = {start: start + count, count: roster.length};
      var noParticipants = selections && OPTIONAL_SUBJECTS_.indexOf(s.subject_code) >= 0 && !roster.some(function(student) { return cohortSelections[student.student_id].indexOf(s.subject_code) >= 0; });
      db.put('SUBMISSIONS', {
        submission_id: key_([e.exam_id, c.class_id, s.subject_code]),
        exam_id: e.exam_id,
        class_id: c.class_id,
        subject_code: s.subject_code,
        submission_status: noParticipants ? 'SUBMITTED' : 'DRAFT',
        revision: noParticipants ? 1 : 0,
        tb_acknowledged: !!noParticipants,
        submitted_by: noParticipants ? u.user_id : '',
        submitted_at: noParticipants ? now_() : ''
      });
      roster.forEach(function(student) {
        var initial = selections && OPTIONAL_SUBJECTS_.indexOf(s.subject_code) >= 0 ? (cohortSelections[student.student_id].indexOf(s.subject_code) >= 0 ? 'EMPTY' : 'TB') : s.default_status;
        db.put('MARKS', {
          mark_id: key_([e.exam_id, student.student_id, s.subject_code]),
          exam_id: e.exam_id,
          student_id: student.student_id,
          subject_code: s.subject_code,
          class_id_snapshot: c.class_id,
          student_name_snapshot: student.full_name,
          year_level_snapshot: c.year_level,
          score: '',
          grade: '',
          mark_status: initial,
          record_version: 1,
          default_tb: initial === 'TB',
          updated_at: now_()
        });
        count++;
      });
    });
    db.setState('block:' + key_([e.exam_id, c.class_id]), {
      start: start,
      count: count,
      subjects: subjectBlocks,
      participation: selections ? cohortSelections : null
    });
    roster.forEach(function(s) {
      db.put('CLASS_REVIEWS', {
        review_id: key_([e.exam_id, c.class_id, s.student_id]),
        record_type: 'STUDENT',
        exam_id: e.exam_id,
        class_id: c.class_id,
        student_id: s.student_id,
        student_name_snapshot: s.full_name,
        class_teacher_remark: '',
        record_version: 1
      });
    });
    db.put('CLASS_REVIEWS', {
      review_id: key_([e.exam_id, c.class_id, 'CLASS']),
      record_type: 'CLASS',
      exam_id: e.exam_id,
      class_id: c.class_id,
      class_finalization_revision: 0,
      pdf_status: 'NONE'
    });
  });
  e.status = 'OPEN';
  db.put('EXAMS', e);
  audit_(db, u, req, 'EXAM_PREPARE', 'EXAMS', e.exam_id, null, {
    classes: classes.length
  }, 'Kohort dan subjek dibekukan');
  return {
    classes: classes.length
  };
}

function publicInfo_(db) {
  var counts = bool_(PropertiesService.getScriptProperties().getProperty('PUBLIC_COUNTS'));
  var year = config_().year,
    ex = db.read('EXAMS').filter(function(e) {
      return String(e.academic_year) === String(year);
    }).sort(function(a, b) {
      return Date.parse(b.opening_date) - Date.parse(a.opening_date);
    }),
    current = ex.find(function(e) {
      return e.status === 'OPEN';
    }) || ex[0];
  return {
    school: config_().school,
    year: year,
    students: counts ? db.read('ENROLMENTS').filter(function(n) {
      return String(n.academic_year) === String(year) && n.status === 'ACTIVE';
    }).length : null,
    classes: counts ? db.read('CLASSES').filter(function(c) {
      return String(c.academic_year) === String(year) && bool_(c.active);
    }).length : null,
    subjects: db.read('SUBJECTS').filter(function(s) {
      return bool_(s.active);
    }).length,
    exam: current ? {
      type: current.exam_type,
      status: current.status
    } : null
  };
}

function teacherExamFocusSave_(db, u, p, req) {
  admin_(u);
  need_(['UPSA', 'UASA', 'ALL'].indexOf(p.exam_type) >= 0, 'Pilih UPSA, UASA atau semua peperiksaan.');
  var key = 'teacher-exam-focus:' + config_().year, old = teacherExamFocus_(db);
  db.setState(key, {exam_type: p.exam_type});
  audit_(db, u, req, 'TEACHER_EXAM_FOCUS', '_STATE', key, {exam_type: old}, {exam_type: p.exam_type}, 'Paparan peperiksaan guru');
  return {exam_type: p.exam_type};
}
