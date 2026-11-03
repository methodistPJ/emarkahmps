/* Exam-only soft withdrawal. Physical rows and block offsets never move. */
function examExcluded_(db, e, c, student) {
  var b = db.state('block:' + key_([e, c]));
  return !!(b && b.excluded && Object.prototype.hasOwnProperty.call(b.excluded, student));
}
function examReviews_(db, e, c) {
  return db.read('CLASS_REVIEWS').filter(function(r) {
    return r.exam_id === e && r.class_id === c &&
      (r.record_type !== 'STUDENT' || !examExcluded_(db, e, c, r.student_id));
  });
}
function examRoster_(db, u, p) {
  admin_(u);
  var ex = exam_(db, p.exam_id), cls = class_(db, p.class_id);
  need_(String(ex.academic_year) === String(cls.academic_year), 'Tahun kelas tidak sepadan.');
  var b = db.state('block:' + key_([p.exam_id, p.class_id]));
  need_(b, 'Kelas belum disediakan untuk peperiksaan ini.');
  return {
    exam: examView_(ex), class: cls,
    students: db.read('CLASS_REVIEWS').filter(function(r) {
      return r.exam_id === p.exam_id && r.class_id === p.class_id && r.record_type === 'STUDENT';
    }).map(function(r) {
      return {student_id: r.student_id, name: r.student_name_snapshot,
        excluded: examExcluded_(db, p.exam_id, p.class_id, r.student_id),
        withdrawal: b.excluded && b.excluded[r.student_id] || null};
    }).sort(function(a, b) {return a.name.localeCompare(b.name, 'ms');})
  };
}
function examStudentExclude_(db, u, p, req) {
  admin_(u);
  need_(p.confirmed === true, 'Sahkan murid dan peperiksaan yang dipilih.');
  var reason = text_(p.reason, 300), ex = exam_(db, p.exam_id), cls = class_(db, p.class_id);
  need_(['OPEN', 'CLOSED', 'DRAFT'].indexOf(ex.status) >= 0, 'Peperiksaan dimuktamadkan atau diarkib tidak boleh diubah.');
  need_(String(ex.academic_year) === String(config_().year) && String(cls.academic_year) === String(ex.academic_year), 'Hanya peperiksaan tahun aktif boleh diubah.');
  var key = 'block:' + key_([p.exam_id, p.class_id]), b = db.state(key), m = metadata_(db, p.exam_id, p.class_id);
  need_(b && m, 'Kelas belum disediakan.');
  var review = db.find('CLASS_REVIEWS', 'review_id', key_([p.exam_id, p.class_id, p.student_id]));
  need_(review && review.record_type === 'STUDENT', 'Murid tiada dalam kelas peperiksaan ini.');
  need_(p.student_name === review.student_name_snapshot, 'Nama murid berubah. Muat semula dan semak.');
  if (examExcluded_(db, p.exam_id, p.class_id, p.student_id)) return {excluded: true, already_excluded: true};
  need_(examReviews_(db, p.exam_id, p.class_id).filter(function(r) {return r.record_type === 'STUDENT';}).length > 1,
    'Murid terakhir tidak boleh dikeluarkan. Hubungi pentadbir sistem untuk menutup kelas peperiksaan.');
  b.excluded = Object.assign(Object.create(null), b.excluded || {});
  b.excluded[p.student_id] = {at: now_(), by: u.user_id, reason: reason};
  db.setState(key, b);
  // Invalidate finalized snapshots and any in-flight PDF lease without touching scores.
  var wasFinalized = !!m.finalized_at;
  if (wasFinalized) db.setState('class-verification:' + key_([p.exam_id, p.class_id]),
    {user_id: m.finalized_by, name: (db.find('USERS', 'user_id', m.finalized_by) || {}).full_name || '', at: m.finalized_at});
  m.finalized_at = ''; m.finalized_by = '';
  m.pdf_status = wasFinalized || m.pdf_file_id ? 'OUTDATED' : 'NONE';
  m.job_owner = ''; m.job_lease = ''; m.job_error = '';
  m.record_version = Number(m.record_version || 0) + 1;
  db.put('CLASS_REVIEWS', m);
  // Keep submitted subjects submitted; update their recorded cohort for auditability.
  db.read('SUBMISSIONS').filter(function(s) {return s.exam_id === p.exam_id && s.class_id === p.class_id;}).forEach(function(s) {
    if (s.submission_status !== 'DRAFT') {
      s.submitted_versions = JSON.stringify(entryMarks_(db, p.exam_id, p.class_id, s.subject_code).map(function(r) {return [r.mark_id, Number(r.record_version)];}));
      s.revision = Number(s.revision || 0) + 1;
      db.put('SUBMISSIONS', s);
    }
  });
  audit_(db, u, req, 'EXAM_STUDENT_EXCLUDE', 'CLASS_REVIEWS', review.review_id, null,
    {exam_id: p.exam_id, class_id: p.class_id, student_id: p.student_id, name: review.student_name_snapshot, previous_finalized: wasFinalized}, reason);
  return {excluded: true, student_id: p.student_id, name: review.student_name_snapshot, needs_class_confirmation: wasFinalized};
}
