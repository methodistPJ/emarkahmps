function classSubmissionGate_(db, e, c) {
  var cls = class_(db, c), subjects = subjectsExam_(db, e, cls.year_level);
  var missing = subjects.filter(function(sub) {
    var r = submission_(db, e, c, sub.subject_code);
    return !r || ['SUBMITTED', 'AMENDED'].indexOf(r.submission_status) < 0 || !bool_(r.tb_acknowledged);
  }).map(function(sub) { return sub.subject_code; });
  return {ready: subjects.length > 0 && missing.length === 0, missing: missing};
}
function requireClassSubmissions_(db, e, c) {
  var gate = classSubmissionGate_(db, e, c);
  need_(gate.ready, 'Semua guru subjek mesti selesai mengisi dan menghantar dahulu. Belum dihantar: ' + gate.missing.join(', '));
}
function verificationView_(db, e, c) {
  var m = metadata_(db, e, c), previous = db.state('class-verification:' + key_([e, c]));
  var id = m && m.finalized_at ? m.finalized_by : previous && previous.user_id;
  var user = id && db.find('USERS', 'user_id', id);
  return {confirmed: !!(m && m.finalized_at), name: user ? user.full_name : previous && previous.name || '', at: m && m.finalized_at || previous && previous.at || '', pending: !!(previous && !(m && m.finalized_at))};
}

function reviewGet_(db, u, p) {
  readable_(db, u, p.exam_id, p.class_id);
  var c = class_(db, p.class_id),
    rows = db.marks(p.exam_id, p.class_id),
    reviews = db.read('CLASS_REVIEWS').filter(function(r) {
      return r.exam_id === p.exam_id && r.class_id === p.class_id;
    }),
    subjects = subjectsExam_(db, p.exam_id, c.year_level);
  return {
    class: c,
    exam: exam_(db, p.exam_id),
    marks: rows,
    rules: rules_(db, exam_(db, p.exam_id).grading_version),
    subjects: subjects,
    subject_teachers: subjects.map(function(sub) {
      var users = db.read('USERS');
      return {subject_code: sub.subject_code, names: db.read('ASSIGNMENTS').filter(function(a) {return a.class_id === p.class_id && String(a.academic_year) === String(exam_(db,p.exam_id).academic_year) && a.subject_code === sub.subject_code && a.assignment_type === 'SUBJECT_TEACHER' && bool_(a.active);}).map(function(a) {var u=users.find(function(x){return x.user_id===a.user_id;});return u?u.full_name:'';}).filter(Boolean)};
    }),
    reviews: reviews,
    submissions: db.read('SUBMISSIONS').filter(function(s) {
      return s.exam_id === p.exam_id && s.class_id === p.class_id;
    }),
    editable: canClass_(db, u, p.exam_id, p.class_id) && classSubmissionGate_(db, p.exam_id, p.class_id).ready,
    gate: classSubmissionGate_(db, p.exam_id, p.class_id),
    verification: verificationView_(db, p.exam_id, p.class_id),
    readiness: readiness_(db, p.exam_id, p.class_id),
    job: jobView_(db,p.exam_id,p.class_id)
  };
}

function remarkSave_(db, u, p, req) {
  need_(canClass_(db, u, p.exam_id, p.class_id), 'Akses guru kelas diperlukan.');
  writable_(db, p.exam_id, p.class_id);
  requireClassSubmissions_(db, p.exam_id, p.class_id);
  need_(Array.isArray(p.changes) && p.changes.length > 0 && p.changes.length <= 100,
    'Kelompok ulasan tidak sah.');
  var all = db.read('CLASS_REVIEWS'),
    seen = {},
    changed = [];
  p.changes.forEach(function(c) {
    need_(!seen[c.student_id], 'Murid berulang.');
    seen[c.student_id] = true;
    var r = all.find(function(r) {
      return r.review_id === key_([p.exam_id, p.class_id, c.student_id]) && r.record_type ===
        'STUDENT';
    });
    need_(r, 'Murid tidak dijumpai.');
    if (Number(c.version) !== Number(r.record_version)) fail_('CONFLICT',
      'Ulasan berubah. Muat semula dan semak.', {
        student_id: c.student_id,
        current: {
          remark: r.class_teacher_remark,
          record_version: r.record_version
        }
      });
    need_(typeof c.remark === 'string' && c.remark.length <= config_().maxRemark && !/[\r\n]/.test(c
      .remark), 'Ulasan maksimum 300 aksara dalam satu perenggan.');
    var n = Object.assign({}, r, {
      class_teacher_remark: c.remark.trim(),
      record_version: Number(r.record_version) + 1,
      remark_updated_at: now_()
    });
    changed.push(n);
    audit_(db, u, req, 'REMARK_SAVE', 'CLASS_REVIEWS', r.review_id, {
      remark: r.class_teacher_remark
    }, {
      remark: n.class_teacher_remark
    }, '');
  });
  changed.forEach(function(r) {
    db.put('CLASS_REVIEWS', r);
  });
  return {
    reviews: changed.map(function(r) {
      return {
        student_id: r.student_id,
        class_teacher_remark: r.class_teacher_remark,
        record_version: r.record_version
      };
    })
  };
}

function readiness_(db, e, c) {
  var cls = class_(db, c),
    marks = db.marks(e, c),
    subs = subjectsExam_(db, e, cls.year_level),
    reviews = db.read('CLASS_REVIEWS').filter(function(r) {
      return r.exam_id === e && r.class_id === c && r.record_type === 'STUDENT';
    }),
    missingSubs = subs.filter(function(s) {
      var r = submission_(db, e, c, s.subject_code);
      return !r || ['SUBMITTED', 'AMENDED'].indexOf(r.submission_status) < 0 || !bool_(r.tb_acknowledged);
    }).map(function(s) {
      return s.subject_code;
    }),
    empty = marks.filter(function(m) {
      return m.mark_status === 'EMPTY';
    }).length,
    missing = reviews.filter(function(r) {
      return !String(r.class_teacher_remark || '').trim();
    }).length;
  return {
    students: reviews.length,
    empty: empty,
    missingRemarks: missing,
    missingSubmissions: missingSubs,
    amendments: marks.filter(function(m) {
      return !!m.amendment_reason;
    }).length,
    tb: marks.filter(function(m) {
      return m.mark_status === 'TB';
    }).length,
    coverage: coverage_(db,e,c,marks,reviews,subs),
    ready: reviews.length > 0 && !empty && !missing && !missingSubs.length && coverage_(db,e,c,marks,reviews,subs).valid,
    revisionHash: hash_(JSON.stringify([marks.map(function(m) {
      return [m.mark_id, m.record_version];
    }), reviews.map(function(r) {
      return [r.review_id, r.record_version];
    }), subs.map(function(s) {
      var r = submission_(db, e, c, s.subject_code);
      return r ? [r.submission_id, r.revision, r.submission_status] : null;
    })]))
  };
}

function finalize_(db, u, p, req) {
  need_(canClass_(db, u, p.exam_id, p.class_id), 'Guru kelas sahaja boleh memuktamadkan.');
  var ex = exam_(db, p.exam_id),
    m = metadata_(db, p.exam_id, p.class_id);
  need_(ex.status === 'OPEN' || ex.status === 'CLOSED', 'Peperiksaan tidak boleh dimuktamadkan.');
  need_(m, 'Kelas belum disediakan.');
  var ready = readiness_(db, p.exam_id, p.class_id);
  need_(ready.ready, 'Penghantaran, markah atau ulasan belum lengkap.');
  need_(p.revisionHash === ready.revisionHash, 'Rekod berubah. Semak pengesahan semula.');
  need_(p.confirmed === true, 'Pengesahan seluruh kelas diperlukan.');
  if (m.finalized_at) {
    audit_(db, u, req, 'CLASS_RECONFIRM', 'CLASS_REVIEWS', m.review_id, null, {revision: m.class_finalization_revision}, 'Semakan semula keputusan yang telah disahkan; tiada perubahan markah atau PDF');
    return {revision: m.class_finalization_revision, pdf_status: m.pdf_status};
  }
  var marks = db.marks(p.exam_id, p.class_id),
    cls = class_(db, p.class_id),
    rules = rules_(db, ex.grading_version),
    subjects = subjectsExam_(db, p.exam_id, cls.year_level),
    rev = Number(m.class_finalization_revision || 0) + 1;
  db.read('CLASS_REVIEWS').filter(function(r) {
    return r.exam_id === p.exam_id && r.class_id === p.class_id && r.record_type === 'STUDENT';
  }).forEach(function(r) {
    var studentMarks = marks.filter(function(x) {
      return x.student_id === r.student_id;
    }).map(function(x) {
      var y = Object.assign({}, x);
      y.grade = y.mark_status === 'SCORED' ? grade_(Number(y.score), rules) : '';
      return y;
    });
    r.result_snapshot = JSON.stringify({
      student_id: r.student_id,
      name: r.student_name_snapshot,
      class_name: cls.class_name,
      year_level: cls.year_level,
      exam_type: ex.exam_type,
      academic_year: ex.academic_year,
      marks: studentMarks,
      subjects: subjects,
      remark: r.class_teacher_remark,
      grading_version: ex.grading_version,
      template_version: ex.template_version,
      class_teacher: u.full_name,
      headmistress: config_().head,
      school: config_().school
    });
    r.class_finalization_revision = rev;
    r.finalized_by = u.user_id;
    r.finalized_at = now_();
    db.put('CLASS_REVIEWS', r);
  });
  var before = Object.assign({}, m);
  m.class_finalization_revision = rev;
  m.finalized_at = now_();
  m.finalized_by = u.user_id;
  m.pdf_status = 'QUEUED';
  m.pdf_revision = rev;
  m.job_lease = '';
  m.job_owner = '';
  m.job_attempts = 0;
  m.job_error = '';
  m.pdf_file_id = '';
  m.pdf_url = '';
  m.result_snapshot = JSON.stringify({
    students: ready.students,
    grading_version: ex.grading_version,
    template_version: ex.template_version,
    revisionHash: ready.revisionHash,
    fingerprint: snapshotFingerprint_(db.read('CLASS_REVIEWS').filter(function(r){return r.record_type==='STUDENT'&&r.exam_id===p.exam_id&&r.class_id===p.class_id;}).map(function(r){return [r.student_id,r.result_snapshot];}))
  });
  db.put('CLASS_REVIEWS', m);
  db.setState('class-verification:' + key_([p.exam_id, p.class_id]), {user_id: u.user_id, name: u.full_name, at: m.finalized_at});
  audit_(db, u, req, 'CLASS_FINALIZE', 'CLASS_REVIEWS', m.review_id, before, m, 'Seluruh kelas disahkan');
  return {
    revision: rev,
    pdf_status: 'QUEUED'
  };
}

function reopen_(db, u, p, req) {
  admin_(u);
  text_(p.reason, 300);
  var m = metadata_(db, p.exam_id, p.class_id);
  need_(m, 'Kelas tiada.');
  var ex = exam_(db, p.exam_id);
  need_(ex.status !== 'ARCHIVED', 'Peperiksaan telah diarkib.');
  if (p.subject_code) {
    need_(!m.finalized_at, 'Buka semula kelas dahulu.');
    var s = submission_(db, p.exam_id, p.class_id, p.subject_code);
    need_(s, 'Penghantaran tiada.');
    var old = Object.assign({}, s);
    s.submission_status = 'DRAFT';
    db.put('SUBMISSIONS', s);
    audit_(db, u, req, 'SUBMISSION_REOPEN', 'SUBMISSIONS', s.submission_id, old, s, p.reason);
    return s;
  }
  need_(m.finalized_at, 'Kelas belum dimuktamadkan.');
  var before = Object.assign({}, m);
  db.setState('class-verification:' + key_([p.exam_id, p.class_id]), {user_id: m.finalized_by, name: (db.find('USERS', 'user_id', m.finalized_by) || {}).full_name || '', at: m.finalized_at});
  m.finalized_at = '';
  m.pdf_status = 'OUTDATED';
  m.job_lease = '';
  m.job_owner = '';
  db.put('CLASS_REVIEWS', m);
  audit_(db, u, req, 'CLASS_REOPEN', 'CLASS_REVIEWS', m.review_id, before, m, p.reason);
  return {
    status: 'OUTDATED'
  };
}

function coverage_(db,e,c,marks,reviews,subs){var keys=Object.create(null),students=Object.create(null),issues=[];reviews.forEach(function(r){if(students[r.student_id])issues.push('ID murid berulang.');students[r.student_id]=true;});marks.forEach(function(m){var k=key_([m.student_id,m.subject_code]);if(keys[k])issues.push('Rekod markah berulang.');keys[k]=true;if(!students[m.student_id]||!subs.some(function(s){return s.subject_code===m.subject_code;}))issues.push('Rekod di luar kohort atau subjek.');if(['SCORED','TH','TB','EMPTY'].indexOf(m.mark_status)<0)issues.push('Status markah tidak sah.');});reviews.forEach(function(r){subs.forEach(function(s){if(!keys[key_([r.student_id,s.subject_code])])issues.push('Rekod wajib tidak ditemui.');});});return {valid:issues.length===0,expected:reviews.length*subs.length,actual:marks.length,issues:Array.from(new Set(issues))};}
function jobView_(db,e,c){var m=metadata_(db,e,c);if(!m)return null;var build=db.state('pdfbuild:'+key_([m.review_id,m.pdf_revision])),snap=json_(m.result_snapshot,{});return {status:m.pdf_status,revision:m.pdf_revision,completed_students:build?build.cursor:0,total_students:snap.students||0,error:m.job_error||'',lease:m.job_lease||''};}

function snapshotFingerprint_(records){return hash_(JSON.stringify(records.slice().sort(function(a,b){return String(a[0]).localeCompare(String(b[0]));})));}
