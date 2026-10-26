function dashboard_(db, u) {
  var exams = visibleExams_(db, u);
  var tasks = [];
  exams.forEach(function(e) {
    var assignments = role_(u, 'ADMINISTRATOR') ? db.read('CLASSES').filter(function(c) {
      return String(c.academic_year) === String(e.academic_year) && bool_(c.active);
    }).map(function(c) {
      return {
        class_id: c.class_id,
        assignment_type: 'MONITOR',
        subject_code: ''
      };
    }) : assignments_(db, u, e.exam_id);
    assignments.forEach(function(a) {
      var c = class_(db, a.class_id),
        marks = a.subject_code ? entryMarks_(db, e.exam_id, c.class_id, a.subject_code) : db.marks(e.exam_id, c.class_id),
        m = metadata_(db, e.exam_id, c.class_id);
      var block = a.subject_code && db.state('block:' + key_([e.exam_id, c.class_id]));
      if (a.subject_code && !marks.length && block && block.participation) return;
      tasks.push({
        exam: examView_(e),
        class: c,
        assignment: a,
        stats: statistics_(marks),
        submission: a.subject_code ? submission_(db, e.exam_id, c.class_id, a.subject_code) :
          null,
        metadata: m ? {
          finalized_at: m.finalized_at,
          pdf_status: m.pdf_status,
          pdf_revision: m.pdf_revision,
          revision: m.class_finalization_revision,
          job_error: m.job_error
        } : null
      });
    });
  });
  return {
    user: publicUser_(u),
    tasks: tasks,
    exams: exams.map(examView_)
  };
}

function marksGet_(db, u, p) {
  readable_(db, u, p.exam_id, p.class_id, p.subject_code);
  var c = class_(db, p.class_id);
  return {
    marks: p.subject_code ? entryMarks_(db, p.exam_id, p.class_id, p.subject_code) : db.marks(p.exam_id, p.class_id),
    rules: rules_(db, exam_(db, p.exam_id).grading_version),
    subjects: subjectsExam_(db, p.exam_id, c.year_level),
    submission: p.subject_code ? submission_(db, p.exam_id, p.class_id, p.subject_code) : null,
    metadata: metadata_(db, p.exam_id, p.class_id)
  };
}

function saveMarks_(db, u, p, req) {
  writable_(db, p.exam_id, p.class_id);
  need_(Array.isArray(p.changes) && p.changes.length > 0 && p.changes.length <= 60,
    'Kelompok markah tidak sah.');
  var classTeacher = p.mode === 'CLASS_REVIEW' && canClass_(db, u, p.exam_id, p.class_id),
    rows = db.marks(p.exam_id, p.class_id, classTeacher ? null : p.subject_code || null),
    rules = rules_(db, exam_(db, p.exam_id).grading_version),
    seen = {},
    updates = [];
  p.changes.forEach(function(change) {
    need_(!seen[change.mark_id], 'Markah berulang dalam permintaan.');
    seen[change.mark_id] = true;
    var m = rows.find(function(x) {
      return x.mark_id === change.mark_id;
    });
    need_(m, 'Rekod markah tidak dijumpai.');
    need_(takesSubject_(db, p.exam_id, p.class_id, m.subject_code, m.student_id) || classTeacher && change.value === 'TB', 'Murid tidak mengambil subjek ini.');
    if (!classTeacher) {
      need_(canSubject_(db, u, p.exam_id, p.class_id, m.subject_code), 'Subjek bukan tugasan anda.');
      var sub = submission_(db, p.exam_id, p.class_id, m.subject_code);
      need_(!sub || sub.submission_status === 'DRAFT', 'Subjek sudah dihantar.');
    } else text_(change.reason, 300);
    if (Number(change.version) !== Number(m.record_version)) fail_('CONFLICT',
      'Markah telah berubah. Semak nilai semasa sebelum cuba semula.', {
        mark_id: m.mark_id,
        current: {
          score: m.score,
          mark_status: m.mark_status,
          grade: m.grade,
          record_version: m.record_version
        }
      });
    var n = Object.assign({}, m, markValue_(change.value, rules), {
      record_version: Number(m.record_version) + 1,
      updated_by: u.user_id,
      updated_at: now_(),
      default_tb: false,
      amendment_reason: classTeacher ? change.reason : ''
    });
    updates.push({
      old: m,
      next: n
    });
  });
  updates.forEach(function(x) {
    db.put('MARKS', x.next);
    audit_(db, u, req, classTeacher ? 'CLASS_AMENDMENT' : 'MARK_SAVE', 'MARKS', x.next.mark_id, x.old, x
      .next, x.next.amendment_reason);
    var s = submission_(db, p.exam_id, p.class_id, x.next.subject_code);
    if (classTeacher && s && s.submission_status !== 'DRAFT') {
      s.submission_status = 'AMENDED';
      s.amended_by = u.user_id;
      s.amended_at = now_();
      db.put('SUBMISSIONS', s);
    }
  });
  return {
    marks: updates.map(function(x) {
      var n = x.next;
      return {
        mark_id: n.mark_id,
        score: n.score,
        mark_status: n.mark_status,
        grade: n.grade,
        record_version: n.record_version,
        amendment_reason: n.amendment_reason
      };
    })
  };
}

function submit_(db, u, p, req) {
  need_(canSubject_(db, u, p.exam_id, p.class_id, p.subject_code),
    'Hanya guru subjek ditugaskan boleh menghantar.');
  writable_(db, p.exam_id, p.class_id);
  var rows = entryMarks_(db, p.exam_id, p.class_id, p.subject_code),
    s = submission_(db, p.exam_id, p.class_id, p.subject_code);
  need_(rows.length && s, 'Subjek belum disediakan.');
  need_(s.submission_status === 'DRAFT', 'Subjek telah dihantar.');
  need_(rows.every(function(m) {
    return m.mark_status !== 'EMPTY';
  }), 'Markah EMPTY masih ada.');
  var tb = rows.filter(function(m) {
    return m.mark_status === 'TB';
  }).length;
  need_(!tb || p.tb_acknowledged === true, 'Sahkan bahawa semua TB telah disemak.');
  need_(tb !== rows.length || p.all_tb_acknowledged === true,
    'Semua murid TB. Pengesahan khusus diperlukan.');
  var versions = rows.map(function(m) {
    return [m.mark_id, Number(m.record_version)];
  });
  need_(JSON.stringify(p.versions) === JSON.stringify(versions),
    'Rekod berubah sejak semakan. Muat semula dahulu.');
  var before = Object.assign({}, s);
  s.submission_status = 'SUBMITTED';
  s.revision = Number(s.revision || 0) + 1;
  s.submitted_by = u.user_id;
  s.submitted_at = now_();
  s.submitted_versions = JSON.stringify(versions);
  s.tb_acknowledged = true;
  db.put('SUBMISSIONS', s);
  audit_(db, u, req, 'SUBMIT', 'SUBMISSIONS', s.submission_id, before, s, 'TB disemak');
  return s;
}
