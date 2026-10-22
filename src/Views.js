/* Small authorized selectors: never cache permissions, sessions, exam states or active marks. */
function examView_(e) {
  var out = {};
  ['exam_id', 'academic_year', 'exam_type', 'opening_date', 'closing_date', 'status', 'grading_version', 'template_version'].forEach(function(k) {
    out[k] = e[k];
  });
  return out;
}

function sessionContext_(db, u) {
  var exams = db.read('EXAMS').filter(function(e) {
    return String(e.academic_year) === String(config_().year);
  });
  var assigned = db.read('ASSIGNMENTS').filter(function(a) {
    return a.user_id === u.user_id && bool_(a.active);
  });
  return {
    user: publicUser_(u),
    exams: exams.map(examView_),
    classes: db.read('CLASSES').filter(function(c) {
      return role_(u, 'ADMINISTRATOR') || assigned.some(function(a) {
        return a.class_id === c.class_id;
      });
    }).map(function(c) {
      return {
        class_id: c.class_id,
        class_name: c.class_name,
        year_level: c.year_level,
        academic_stage: c.academic_stage,
        academic_year: c.academic_year
      };
    })
  };
}

function pdfReference_(db, u, p) {
  readable_(db, u, p.exam_id, p.class_id);
  var m = metadata_(db, p.exam_id, p.class_id);
  need_(m && m.finalized_at && m.pdf_status === 'COMPLETED' && Number(m.pdf_revision) === Number(m.class_finalization_revision), 'PDF rasmi belum tersedia atau sudah lapuk.');
  var build = db.state('pdfbuild:' + key_([m.review_id, m.pdf_revision]));
  return {
    file_id: m.pdf_file_id,
    revision: Number(m.pdf_revision),
    validation: build && build.validation || null
  };
}

function pdfBytes_(reference) {
  var file = DriveApp.getFileById(reference.file_id),
    blob = file.getBlob(),
    bytes = blob.getBytes();
  need_(bytes.length <= 12 * 1024 * 1024, 'PDF terlalu besar. Hubungi pentadbir untuk akses Drive khusus.');
  need_(file.getMimeType() === MimeType.PDF, 'Jenis fail PDF tidak sah.');
  if (reference.validation) need_(reference.validation.sha256 === hash_(Utilities.base64Encode(bytes)), 'Fail PDF berubah selepas pengesahan. Hubungi pentadbir.');
  return {
    name: file.getName(),
    base64: Utilities.base64Encode(bytes),
    mime: 'application/pdf'
  };
}
