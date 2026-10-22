/* MPS e-Assessment. All helper functions end in _ and are not callable by clients. */
var SCHEMA_ = {
  STUDENTS: ['student_id', 'full_name', 'student_status', 'created_at', 'updated_at'],
  ENROLMENTS: ['enrolment_id', 'student_id', 'academic_year', 'class_id', 'start_date', 'end_date',
    'status'
  ],
  CLASSES: ['class_id', 'academic_year', 'year_level', 'academic_stage', 'class_name', 'active'],
  USERS: ['user_id', 'full_name', 'identification_code', 'account_alias', 'authentication_data', 'roles',
    'active', 'auth_version', 'created_at', 'updated_at'
  ],
  ASSIGNMENTS: ['assignment_id', 'academic_year', 'user_id', 'class_id', 'subject_code', 'assignment_type',
    'active'
  ],
  SUBJECTS: ['subject_code', 'subject_name', 'offered_year_levels', 'display_order', 'default_status',
    'active'
  ],
  EXAMS: ['exam_id', 'academic_year', 'exam_type', 'opening_date', 'closing_date', 'status',
    'grading_version', 'template_version', 'finalized_at', 'subject_snapshot'
  ],
  GRADE_RULES: ['rule_id', 'grading_version', 'minimum_score', 'maximum_score', 'grade', 'description',
    'active'
  ],
  MARKS: ['mark_id', 'exam_id', 'student_id', 'subject_code', 'class_id_snapshot', 'student_name_snapshot',
    'year_level_snapshot', 'score', 'mark_status', 'grade', 'record_version', 'updated_by', 'updated_at',
    'default_tb', 'amendment_reason'
  ],
  SUBMISSIONS: ['submission_id', 'exam_id', 'class_id', 'subject_code', 'submitted_by', 'submitted_at',
    'submission_status', 'revision', 'submitted_versions', 'tb_acknowledged', 'amended_by', 'amended_at'
  ],
  CLASS_REVIEWS: ['review_id', 'record_type', 'exam_id', 'class_id', 'student_id', 'student_name_snapshot',
    'class_teacher_remark', 'record_version', 'remark_updated_at', 'class_finalization_revision',
    'finalized_by', 'finalized_at', 'result_snapshot', 'pdf_status', 'pdf_file_id', 'pdf_url',
    'pdf_revision', 'job_lease', 'job_owner', 'job_attempts', 'job_error'
  ],
  AUDIT_LOG: ['event_id', 'request_id', 'actor_id', 'action', 'entity_type', 'entity_id', 'old_value',
    'new_value', 'reason', 'timestamp'
  ],
  _STATE: ['state_id', 'value'],
  _OPS: ['op_id', 'request_id', 'actor_id', 'payload_hash', 'status', 'response', 'piece_index', 'plan',
    'created_at'
  ]
};
var SUBJECT_SEED_ = [
  ['BM', 'Bahasa Melayu'],
  ['BI', 'Bahasa Inggeris'],
  ['MM', 'Matematik'],
  ['SN', 'Sains'],
  ['PI', 'Pendidikan Islam'],
  ['PM', 'Pendidikan Moral'],
  ['BA', 'Bahasa Arab'],
  ['BC', 'Bahasa Cina'],
  ['BT', 'Bahasa Tamil'],
  ['PJPK', 'Pendidikan Jasmani dan Kesihatan'],
  ['MZ', 'Pendidikan Muzik'],
  ['PSV', 'Pendidikan Seni Visual'],
  ['SEJ', 'Sejarah'],
  ['RBT', 'Reka Bentuk dan Teknologi']
];

var CONFIG_REQUEST_ = null;
function config_() {
  if (CONFIG_REQUEST_) return CONFIG_REQUEST_;
  var p = PropertiesService.getScriptProperties();
  CONFIG_REQUEST_ = {
    spreadsheet: p.getProperty('SPREADSHEET_ID'),
    parent: p.getProperty('DRIVE_PARENT_ID'),
    school: p.getProperty('SCHOOL_NAME') || 'SK Methodist Petaling Jaya',
    head: p.getProperty('HEADMISTRESS_NAME') || 'PUAN ROZANI BINTI MURI',
    year: p.getProperty('ACADEMIC_YEAR') || '2026',
    secret: p.getProperty('AUTH_PEPPER'),
    sessionMinutes: Number(p.getProperty('SESSION_MINUTES') || 120),
    maxRemark: 300,
    iterations: 600000
  };
  return CONFIG_REQUEST_;
}

function now_() {
  return new Date().toISOString();
}

function id_() {
  return Utilities.getUuid();
}

function fail_(code, message, details) {
  var e = new Error(message);
  e.code = code;
  e.details = details || null;
  throw e;
}

function need_(condition, message) {
  if (!condition) fail_('VALIDATION', message);
}

function json_(s, fallback) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

function text_(x, max) {
  need_(typeof x === 'string' && x.trim().length > 0 && x.length <= max,
    'Teks diperlukan atau terlalu panjang.');
  return x.trim();
}

function bool_(x) {
  return x === true || x === 'true';
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8).map(
    function(x) {
      return ('0' + ((x + 256) % 256).toString(16)).slice(-2);
    }).join('');
}

function hmac_(s) {
  need_(config_().secret && config_().secret.length >= 43, 'AUTH_PEPPER belum dikonfigurasi.');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(s), config_().secret))
    .replace(/=+$/, '');
}

function equal_(a, b) {
  a = String(a);
  b = String(b);
  var n = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
}

function key_(parts) {
  return parts.map(function(x) {
    return encodeURIComponent(String(x));
  }).join('|');
}

function role_(u, r) {
  return json_(u.roles, []).indexOf(r) >= 0;
}

function admin_(u) {
  if (!role_(u, 'ADMINISTRATOR')) fail_('FORBIDDEN', 'Akses pentadbir diperlukan.');
}
