function setupDay_(value){var time=Date.parse(value);return Number.isFinite(time)?new Date(time+8*3600000).toISOString().slice(0,10):null;}
/* Schema-compatible bulk setup. No infrastructure keys accepted from workbook. */
var SETUP_CONTRACT_ = {
  "version": "MPS-SCHOOL-1",
  "headerRow": 4,
  "sheets": {
    "01_SCHOOL": [
      "school_name",
      "academic_year",
      "headmistress_name",
      "grading_version",
      "template_version"
    ],
    "02_CLASSES": [
      "class_id",
      "class_name",
      "academic_year",
      "year_level",
      "active"
    ],
    "03_STUDENTS": [
      "student_id",
      "full_name",
      "class_id",
      "start_date",
      "student_status",
      "enrolment_status"
    ],
    "04_TEACHERS": [
      "teacher_ref",
      "full_name",
      "identification_code",
      "account_alias",
      "active",
      "role"
    ],
    "05_CLASS_TEACHERS": [
      "class_id",
      "teacher_ref",
      "academic_year",
      "active"
    ],
    "06_SUBJECT_ASSIGNMENTS": [
      "class_id",
      "subject_code",
      "teacher_ref",
      "academic_year",
      "active"
    ],
    "07_SUBJECTS": [
      "subject_code",
      "subject_name",
      "offered_year_levels",
      "display_order",
      "default_status",
      "active"
    ],
    "08_EXAMS": [
      "academic_year",
      "exam_type",
      "opening_date",
      "closing_date",
      "grading_version",
      "template_version",
      "intended_status"
    ]
  },
  "requiredSheets": [
    "00_START_HERE",
    "01_SCHOOL",
    "02_CLASSES",
    "03_STUDENTS",
    "04_TEACHERS",
    "05_CLASS_TEACHERS",
    "06_SUBJECT_ASSIGNMENTS",
    "07_SUBJECTS",
    "08_EXAMS",
    "09_VALIDATION_REFERENCE"
  ],
  "limits": {
    "compressedBytes": 8388608,
    "expandedBytes": 41943040,
    "partBytes": 12582912,
    "rows": 10000,
    "students": 2000,
    "teachers": 300,
    "classes": 60
  },
  "dateFields": [
    "start_date",
    "opening_date",
    "closing_date"
  ],
  "optionalFields": {
    "03_STUDENTS": [
      "religion_subject",
      "elective_subject"
    ]
  }
};

function setupId_(kind, key) {
  return 'S' + hash_('school:' + kind + ':' + key).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
}

function setupRef_(ref) {
  return 'school-teacher:' + hash_(ref);
}

function setupIssues_(sheet, row, field, message) {
  return {
    sheet: sheet,
    row: row,
    field: field,
    message: message
  };
}

function setupRows_(doc) {
  need_(doc && doc.version === SETUP_CONTRACT_.version && doc.sheets && typeof doc.sheets === 'object', 'Format workbook tidak disokong.');
  var total = 0;
  Object.keys(SETUP_CONTRACT_.sheets).forEach(function(s) {
    need_(Array.isArray(doc.sheets[s]), 'Worksheet wajib tiada: ' + s);
    total += doc.sheets[s].length;
  });
  need_(total <= SETUP_CONTRACT_.limits.rows, 'Workbook terlalu besar. Maksimum 10,000 rekod.');
  return doc.sheets;
}

function setupSnapshot_(db) {
  var tables = ['CLASSES', 'STUDENTS', 'ENROLMENTS', 'USERS', 'ASSIGNMENTS', 'SUBJECTS', 'EXAMS', 'GRADE_RULES', '_STATE'];
  return hash_(JSON.stringify(tables.map(function(t) {
    return [t, db.read(t).filter(function(r) {
      return t !== '_STATE' || /^school-(teacher|profile|intent|participation)/.test(r.state_id);
    })];
  })));
}

function schoolPlan_(db, u, p, forCommit) {
  admin_(u);
  var sheets = setupRows_(p.document),
    errors = [],
    warnings = [],
    changes = [],
    counts = {},
    newTeachers = [],
    teacherMap = Object.create(null),
    year = String(config_().year),
    fields = SETUP_CONTRACT_.sheets;
  var by = {};
  ['CLASSES', 'STUDENTS', 'USERS', 'ASSIGNMENTS', 'SUBJECTS', 'EXAMS', 'ENROLMENTS'].forEach(function(t) {
    by[t] = db.read(t);
    counts[t] = {
      create: 0,
      update: 0,
      skip: 0,
      conflict: 0
    };
  });
  Object.keys(by).forEach(function(t) {
    var primary = {
        CLASSES: 'class_id',
        STUDENTS: 'student_id',
        USERS: 'user_id',
        ASSIGNMENTS: 'assignment_id',
        SUBJECTS: 'subject_code',
        EXAMS: 'exam_id',
        ENROLMENTS: 'enrolment_id'
      } [t],
      seen = Object.create(null);
    by[t].forEach(function(r) {
      need_(typeof r[primary] === 'string' && r[primary] && !seen[r[primary]], 'Database ' + t + ' mempunyai ID rosak/pendua; semakan manual diperlukan.');
      seen[r[primary]] = true;
    });
  });

  function error(s, r, f, m) {
    errors.push(setupIssues_(s, r, f, m));
  }

  function text(v, max) {
    need_(typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max && !/[\r\n\u0000-\u001f]/.test(v), 'Teks wajib, maksimum ' + max + ' aksara.');
    return v.trim();
  }

  function identifier(v) {
    need_(typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v), 'ID mesti teks 1–80 aksara (huruf, digit, _, . atau -).');
    return v;
  }

  function flag(v) {
    need_(v === true || v === false || v === 'TRUE' || v === 'FALSE', 'Gunakan TRUE atau FALSE.');
    return v === true || v === 'TRUE';
  }

  function date(v) {
    need_(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\+08:00|Z))?$/.test(v) && Number.isFinite(Date.parse(v)), 'Gunakan tarikh ISO yyyy-mm-dd atau datetime ISO +08:00.');
    var day = v.slice(0, 10);
    need_(new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day, 'Tarikh tidak sah.');
    return v;
  }

  function rows(s, fn) {
    var seen = Object.create(null);
    sheets[s].forEach(function(raw, i) {
      var r = raw && raw.values || raw,
        row = raw && raw.row || i + 5;
      try {
        need_(r && typeof r === 'object' && !Array.isArray(r), 'Rekod tidak sah.');
        fields[s].forEach(function(f) {
          need_(Object.prototype.hasOwnProperty.call(r, f), 'Kolum tiada: ' + f);
        });
        need_(Object.keys(r).every(function(f) {
          return fields[s].indexOf(f) >= 0 || (SETUP_CONTRACT_.optionalFields[s] || []).indexOf(f) >= 0;
        }), 'Kolum tambahan tidak dibenarkan.');
        fn(r, row, seen);
      } catch (e) {
        error(s, row, e.field || '*', e.code ? e.message : 'Rekod tidak sah.');
      }
    });
  }

  function unique(seen, key) {
    need_(!seen[key], 'Rekod/kunci berulang dalam worksheet.');
    seen[key] = true;
  }

  function same(old, r) {
    return Object.keys(r).every(function(k) {
      if(['opening_date','closing_date'].indexOf(k)>=0)return Date.parse(old[k])===Date.parse(r[k]);
      if(k==='start_date')return setupDay_(old[k])===setupDay_(r[k]);
      return String(old[k] === undefined ? '' : old[k]) === String(r[k]);
    });
  }

  function stage(t, r, old) {
    if (old && same(old, r)) {
      counts[t].skip++;
      return old;
    }
    var n = Object.assign({}, old || {}, r);
    changes.push({
      table: t,
      record: n
    });
    counts[t][old ? 'update' : 'create']++;
    if (old) {
      by[t][by[t].indexOf(old)] = n;
    } else by[t].push(n);
    return n;
  }
  need_(sheets['01_SCHOOL'].length === 1, '01_SCHOOL mesti mengandungi tepat satu rekod.');
  var profile;
  rows('01_SCHOOL', function(r) {
    need_(String(r.academic_year) === year, 'Tahun workbook mesti sama dengan tahun aktif ' + year + '. Tukar tahun melalui aliran arkib.');
    profile = {
      school_name: text(r.school_name, 120),
      headmistress_name: text(r.headmistress_name, 120),
      academic_year: year,
      grading_version: text(r.grading_version, 40),
      template_version: r.template_version
    };
    need_(r.template_version === 'replacement-v1', 'Template mesti replacement-v1.');
    validateRules_(rules_(db, r.grading_version));
  });
  need_(sheets['02_CLASSES'].length <= 60 && sheets['03_STUDENTS'].length <= 2000 && sheets['04_TEACHERS'].length <= 300, 'Had import: 60 kelas, 2000 murid, 300 guru.');
  var prepared = by.EXAMS.some(function(e) {
    return String(e.academic_year) === year && e.status !== 'DRAFT';
  });
  rows('02_CLASSES', function(r, row, seen) {
    identifier(r.class_id);
    unique(seen, r.class_id);
    need_(String(r.academic_year) === year, 'Tahun kelas tidak sepadan.');
    var level = Number(r.year_level);
    need_(['number','string'].indexOf(typeof r.year_level)>=0 && Number.isInteger(level) && level >= 1 && level <= 6, 'Tahun murid mesti 1–6.');
    var old = by.CLASSES.find(function(x) {
        return x.class_id === r.class_id;
      }),
      n = {
        class_id: r.class_id,
        class_name: text(r.class_name, 60),
        academic_year: year,
        year_level: level,
        academic_stage: level <= 3 ? 1 : 2,
        active: flag(r.active)
      };
    need_(!by.CLASSES.some(function(x) {
      return x.class_id !== r.class_id && String(x.academic_year) === year && x.class_name === n.class_name;
    }), 'Nama kelas bertindih.');
    need_(!old || !bool_(old.active) || n.active, 'Penyahaktifan kelas sedia ada melalui Excel ditolak.');
    need_(!old || !prepared || same(old, n), 'Kelas bagi peperiksaan disediakan dikunci; guna semakan manual.');
    stage('CLASSES', n, old);
  });
  var studentSeen = {},
    studentNames = Object.create(null);
  rows('03_STUDENTS', function(r, row, seen) {
    identifier(r.student_id);
    unique(seen, r.student_id);
    studentSeen[r.student_id] = true;
    var c = by.CLASSES.find(function(x) {
      return x.class_id === r.class_id && String(x.academic_year) === year && bool_(x.active);
    });
    need_(c, 'class_id tiada atau tidak aktif.');
    need_(['ACTIVE', 'LEFT', 'GRADUATED'].indexOf(r.student_status) >= 0, 'Status murid tidak sah.');
    need_(['ACTIVE', 'ENDED'].indexOf(r.enrolment_status) >= 0, 'Status enrolmen tidak sah.');
    date(r.start_date);
    var old = by.STUDENTS.find(function(x) {
        return x.student_id === r.student_id;
      }),
      n = {
        student_id: r.student_id,
        full_name: text(r.full_name, 140),
        student_status: r.student_status
      };
    need_(!old || old.student_status === r.student_status, 'Perubahan status murid sedia ada memerlukan semakan manual.');
    var key = n.full_name.toUpperCase();
    if (studentNames[key]) warnings.push(setupIssues_('03_STUDENTS', row, 'full_name', 'Nama berulang; pastikan ID berbeza merujuk murid yang betul.'));
    studentNames[key] = true;
    var existing = by.ENROLMENTS.filter(function(x) {
        return x.student_id === r.student_id && String(x.academic_year) === year;
      }),
      en = existing.find(function(x) {
        return x.class_id === r.class_id && setupDay_(x.start_date) === setupDay_(r.start_date) && x.status === r.enrolment_status;
      });
    need_(en || !existing.length, 'Pertukaran kelas/tarikh/status enrolmen sedia ada ditolak. Semak sejarah secara manual.');
    need_(en || !prepared, 'Cohort telah disediakan; murid/enrolmen baharu memerlukan semakan manual.');
    need_(r.enrolment_status !== 'ACTIVE' || r.student_status === 'ACTIVE', 'Enrolmen aktif memerlukan murid ACTIVE.');
    if (!old) n.created_at = now_();
    if (!old || !same(old, n)) n.updated_at = now_();
    stage('STUDENTS', n, old);
    stage('ENROLMENTS', {
      enrolment_id: en ? en.enrolment_id : setupId_('enrolment', key_([year, r.student_id, r.class_id, r.start_date])),
      student_id: r.student_id,
      academic_year: year,
      class_id: r.class_id,
      start_date: en ? en.start_date : r.start_date,
      end_date: en ? en.end_date || '' : '',
      status: r.enrolment_status
    }, en);
  });
  // Participation is a year-specific setup snapshot; never inferred from name/religion.
  var participationRows = sheets['03_STUDENTS'], participationEnabled = participationRows.some(function(raw) {
    var r = raw.values || raw;
    return Object.prototype.hasOwnProperty.call(r, 'religion_subject') || Object.prototype.hasOwnProperty.call(r, 'elective_subject');
  });
  if (participationEnabled) {
    var selectionsByClass = Object.create(null);
    participationRows.forEach(function(raw, i) {
      var r = raw.values || raw, row = raw.row || i + 5;
      if (r.student_status !== 'ACTIVE' || r.enrolment_status !== 'ACTIVE') return;
      if (['PI','PM'].indexOf(r.religion_subject) < 0 || ['BA','BC','BT'].indexOf(r.elective_subject) < 0) {
        error('03_STUDENTS', row, 'religion_subject/elective_subject', 'Setiap murid aktif perlu PI atau PM serta BA, BC atau BT.');
      } else {
        if (!selectionsByClass[r.class_id]) selectionsByClass[r.class_id] = Object.create(null);
        selectionsByClass[r.class_id][r.student_id] = [r.religion_subject, r.elective_subject];
      }
    });
    // Partition by class: even 2,000 pupils stay below the Sheets per-cell text limit.
    var selectionStates = {'': {version: 1, classes: Object.keys(selectionsByClass).sort()}};
    Object.keys(selectionsByClass).forEach(function(cls) { selectionStates[':' + cls] = selectionsByClass[cls]; });
    Object.keys(selectionStates).forEach(function(suffix) {
      var selectionKey = 'school-participation:' + year + suffix, oldSelections = db.state(selectionKey), selections = selectionStates[suffix];
      function canonical(o) { return JSON.stringify(Object.keys(o || {}).sort().map(function(id) { return [id, o[id]]; })); }
      if (canonical(oldSelections) !== canonical(selections)) {
        if (prepared) error('03_STUDENTS', 4, 'religion_subject/elective_subject', 'Pilihan subjek peperiksaan yang sudah disediakan dikunci. Semakan pentadbir diperlukan.');
        else changes.push({state: selectionKey, value: selections});
      }
    });
  }
  var identities = Object.create(null);
  rows('04_TEACHERS', function(r, row, seen) {
    identifier(r.teacher_ref);
    unique(seen, r.teacher_ref);
    need_(typeof r.identification_code === 'string' && validLoginCode_(r.identification_code), 'identification_code mesti kod guru huruf besar 2–30 aksara (contoh AHMAD), atau teks enam digit untuk akaun lama.');
    need_(typeof r.account_alias === 'string' && /^[a-z0-9_-]{0,30}$/.test(r.account_alias), 'Alias tidak sah.');
    var idkey = key_([r.identification_code, r.account_alias]);
    unique(identities, idkey);
    var roles = text(r.role, 80).split('|').sort();
    need_(roles.length <= 2 && roles.every(function(v, i) {
      return ['CLASS_TEACHER', 'SUBJECT_TEACHER'].indexOf(v) >= 0 && roles.indexOf(v) === i;
    }), 'role: CLASS_TEACHER, SUBJECT_TEACHER atau CLASS_TEACHER|SUBJECT_TEACHER.');
    var ref = db.state(setupRef_(r.teacher_ref)),
      matches = by.USERS.filter(function(x) {
        return x.identification_code === r.identification_code && String(x.account_alias || '') === r.account_alias;
      });
    need_(matches.length <= 1, 'Identiti akaun database bertindih.');
    var old = ref ? by.USERS.find(function(x) {
      return x.user_id === ref.user_id;
    }) : matches[0];
    need_(!ref || old && old.identification_code === r.identification_code && String(old.account_alias || '') === r.account_alias, 'teacher_ref tidak boleh dipindahkan kepada identiti lain.');
    need_(!old || !matches.length || matches[0].user_id === old.user_id, 'teacher_ref/identiti bercanggah.');
    var active = flag(r.active);
    need_(!old || !bool_(old.active) || active, 'Penyahaktifan akaun sedia ada melalui Excel ditolak.');
    var finalRoles = old ? json_(old.roles, []) : [];
    roles.forEach(function(v) {
      if (finalRoles.indexOf(v) < 0) finalRoles.push(v);
    });
    finalRoles.sort();
    var n = {
      user_id: old ? old.user_id : setupId_('teacher', r.teacher_ref),
      full_name: text(r.full_name, 120),
      identification_code: r.identification_code,
      account_alias: r.account_alias,
      roles: old && JSON.stringify(json_(old.roles, []).slice().sort()) === JSON.stringify(finalRoles) ? old.roles : JSON.stringify(finalRoles),
      active: active
    };
    if (!old) {
      n.created_at = now_();
      n.auth_version = 1;
      newTeachers.push({
        teacher_ref: r.teacher_ref,
        user_id: n.user_id,
        code: r.identification_code,
        alias: r.account_alias,
        salt: authSalt_(r.identification_code, r.account_alias),
        iterations: config_().iterations
      });
      if (forCommit) {
        var credential = (p.credentials || []).find(function(x) {
          return x.teacher_ref === r.teacher_ref;
        });
        need_(credential && credential.salt === authSalt_(r.identification_code, r.account_alias) && /^[A-Za-z0-9_-]{43}$/.test(credential.proof || ''), 'Verifier onboarding tiada. Validasi dan cuba semula.');
        n.authentication_data = JSON.stringify({
          algorithm: 'PBKDF2-SHA256+HMAC-SHA256',
          iterations: config_().iterations,
          salt: credential.salt,
          digest: hmac_('pin:' + credential.proof),
          must_change: true
        });
      }
    }
    if (old && old.roles !== n.roles) n.auth_version = Number(old.auth_version) + 1;
    if (!old || !same(old, n)) n.updated_at = now_();
    var user = stage('USERS', n, old);
    teacherMap[r.teacher_ref] = user;
    if (!ref) changes.push({
      state: setupRef_(r.teacher_ref),
      value: {
        user_id: n.user_id
      }
    });
  });
  rows('07_SUBJECTS', function(r, row, seen) {
    unique(seen, r.subject_code);
    var seed = SUBJECT_SEED_.find(function(s) {
      return s[0] === r.subject_code;
    });
    need_(seed, 'Kod subjek tidak dikenali oleh backend.');
    var levels = String(r.offered_year_levels).split(',').map(Number),
      expected = ['SEJ', 'RBT'].indexOf(r.subject_code) >= 0 ? [4, 5, 6] : [1, 2, 3, 4, 5, 6];
    need_(JSON.stringify(levels) === JSON.stringify(expected), 'Liputan subjek mesti ' + expected.join(',') + '.');
    var def = ['PI', 'PM', 'BA', 'BC', 'BT'].indexOf(r.subject_code) >= 0 ? 'TB' : 'EMPTY';
    need_(r.default_status === def, 'Status awal backend: ' + def);
    need_(['number','string'].indexOf(typeof r.display_order)>=0 && Number.isInteger(Number(r.display_order)) && Number(r.display_order) > 0, 'Susunan mesti integer positif.');
    need_(flag(r.active), 'Semua 14 subjek backend mesti aktif.');
    var old = by.SUBJECTS.find(function(x) {
      return x.subject_code === r.subject_code;
    });
    stage('SUBJECTS', {
      subject_code: r.subject_code,
      subject_name: text(r.subject_name, 80),
      offered_year_levels: JSON.stringify(levels),
      display_order: Number(r.display_order),
      default_status: def,
      active: flag(r.active)
    }, old);
  });
  need_(sheets['07_SUBJECTS'].length === SUBJECT_SEED_.length, '07_SUBJECTS mesti menyenaraikan semua 14 kod backend.');

  function assignment(s, type) {
    rows(s, function(r, row, seen) {
      need_(String(r.academic_year) === year, 'Tahun tugasan tidak sepadan.');
      var c = by.CLASSES.find(function(x) {
          return x.class_id === r.class_id && String(x.academic_year) === year && bool_(x.active);
        }),
        t = teacherMap[r.teacher_ref],
        active = flag(r.active),
        subject = type === 'CLASS_TEACHER' ? '' : r.subject_code;
      need_(c && t, 'Rujukan kelas/guru mesti wujud dalam workbook/database.');
      need_(role_(t, type) && (!active || bool_(t.active)), 'Peranan/keaktifan guru tidak sepadan.');
      if (subject) {
        var sub = by.SUBJECTS.find(function(x) {
          return x.subject_code === subject && bool_(x.active);
        });
        need_(sub && json_(sub.offered_year_levels, []).indexOf(Number(c.year_level)) >= 0, 'Subjek tidak ditawarkan bagi kelas ini.');
      }
      var key = key_([year, c.class_id, type, subject]);
      unique(seen, key + (type === 'SUBJECT_TEACHER' ? ':' + t.user_id : ''));
      var old = by.ASSIGNMENTS.find(function(x) {
        return String(x.academic_year) === year && x.class_id === c.class_id && x.assignment_type === type && String(x.subject_code || '') === subject && bool_(x.active) && (type === 'CLASS_TEACHER' || x.user_id === t.user_id);
      });
      need_(!old || old.user_id === t.user_id && active, 'Menukar/menyahaktifkan guru tugasan sedia ada memerlukan semakan manual.');
      stage('ASSIGNMENTS', {
        assignment_id: old ? old.assignment_id : setupId_('assignment', key + (type === 'SUBJECT_TEACHER' ? ':' + t.user_id : '')),
        academic_year: year,
        user_id: t.user_id,
        class_id: c.class_id,
        subject_code: subject,
        assignment_type: type,
        active: active
      }, old);
    });
  }
  assignment('05_CLASS_TEACHERS', 'CLASS_TEACHER');
  assignment('06_SUBJECT_ASSIGNMENTS', 'SUBJECT_TEACHER');
  rows('08_EXAMS', function(r, row, seen) {
    unique(seen, r.exam_type);
    need_(String(r.academic_year) === year && ['UPSA', 'UASA'].indexOf(r.exam_type) >= 0, 'Exam mesti UPSA/UASA tahun aktif.');
    date(r.opening_date);
    date(r.closing_date);
    need_(Date.parse(r.opening_date) < Date.parse(r.closing_date), 'Tarikh tutup mesti selepas tarikh buka.');
    need_(['DRAFT', 'PREPARE', 'OPEN'].indexOf(r.intended_status) >= 0, 'intended_status: DRAFT, PREPARE atau OPEN.');
    need_(r.template_version === 'replacement-v1', 'Template mesti replacement-v1.');
    validateRules_(rules_(db, r.grading_version));
    var old = by.EXAMS.find(function(x) {
        return String(x.academic_year) === year && x.exam_type === r.exam_type;
      }),
      n = {
        exam_id: old ? old.exam_id : setupId_('exam', year + ':' + r.exam_type),
        academic_year: year,
        exam_type: r.exam_type,
        opening_date: r.opening_date,
        closing_date: r.closing_date,
        grading_version: r.grading_version,
        template_version: r.template_version
      };
    need_(!old || old.status === 'DRAFT' || same(old, n), 'Konfigurasi peperiksaan disediakan tidak boleh ditukar melalui import.');
    if (!old) {
      n.status = 'DRAFT';
      n.subject_snapshot = '';
      n.finalized_at = '';
    }
    stage('EXAMS', n, old);
    var intentKey = 'school-intent:' + n.exam_id,
      prior = db.state(intentKey);
    if (!prior || prior.intended_status !== r.intended_status) changes.push({
      state: intentKey,
      value: {
        intended_status: r.intended_status
      }
    });
  });
  if (profile) {
    var oldProfile = db.state('school-profile:' + year);
    if (JSON.stringify(oldProfile) !== JSON.stringify(profile)) changes.push({
      state: 'school-profile:' + year,
      value: profile
    });
  }
  Object.keys(counts).forEach(function(t) {
    counts[t].conflict = errors.filter(function(e) {
      return ({
        CLASSES: '02_CLASSES',
        STUDENTS: '03_STUDENTS',
        USERS: '04_TEACHERS',
        ASSIGNMENTS: '06_SUBJECT_ASSIGNMENTS',
        SUBJECTS: '07_SUBJECTS',
        EXAMS: '08_EXAMS'
      })[t] === e.sheet;
    }).length;
  });
  var description = changes.map(function(c) {
    return c.state ? {
      state: c.state,
      value: c.value
    } : {
      table: c.table,
      id: c.record[({
        USERS: 'user_id',
        CLASSES: 'class_id',
        STUDENTS: 'student_id',
        ENROLMENTS: 'enrolment_id',
        ASSIGNMENTS: 'assignment_id',
        SUBJECTS: 'subject_code',
        EXAMS: 'exam_id'
      })[c.table]],
      change: c.record._row ? 'update' : 'create'
    };
  });
  return {
    errors: errors,
    warnings: warnings,
    counts: counts,
    newTeachers: newTeachers,
    changes: changes,
    planSummary: description,
    profile: profile
  };
}

function schoolPreview_(db, u, p, req) {
  admin_(u);
  var before = setupSnapshot_(db),
    plan = schoolPlan_(db, u, p, false),
    ticket = id_(),
    hash = hash_(canonicalJson_(p.document));
  var preview = {
    actor: u.user_id,
    document_hash: hash,
    snapshot: before,
    expires: Date.now() + 15 * 60000
  };
  db.setState('school-preview:' + ticket, preview);
  audit_(db, u, req, 'SCHOOL_SETUP_PREVIEW', 'SCHOOL_SETUP', hash, null, {
    counts: plan.counts,
    errors: plan.errors.length
  }, 'Tiada data sekolah ditulis.');
  return {
    preview_id: ticket,
    document_hash: hash,
    expires: preview.expires
  };
}

function schoolCommit_(db, u, p, req) {
  admin_(u);
  need_(p.confirmed === true, 'Pengesahan pentadbir diperlukan.');
  var preview = db.state('school-preview:' + p.preview_id);
  need_(preview && preview.actor === u.user_id && preview.expires > Date.now(), 'Pratonton tamat tempoh. Validasi semula.');
  need_(preview.document_hash === hash_(canonicalJson_(p.document)), 'Workbook berubah selepas pratonton.');
  need_(preview.snapshot === setupSnapshot_(db), 'Data berubah selepas pratonton. Validasi semula; tiada data ditulis.');
  var plan = schoolPlan_(db, u, p, true);
  need_(!plan.errors.length, 'Validasi import gagal.', plan.errors);
  plan.changes.forEach(function(c) {
    if (c.state) db.setState(c.state, c.value);
    else db.put(c.table, c.record);
  });
  db.setState('school-preview:' + p.preview_id, null);
  var result = {
    verified: true,
    counts: plan.counts,
    change_count: plan.changes.length,
    document_hash: preview.document_hash,
    pending_activation: plan.newTeachers.length,
    examinations: 'DRAFT dipelihara; gunakan readiness untuk sediakan/buka secara nyata.'
  };
  db.setState('school-last-import:' + config_().year, {
    at: now_(),
    actor: u.user_id,
    hash: preview.document_hash,
    counts: plan.counts
  });
  audit_(db, u, req, 'SCHOOL_SETUP_COMMIT', 'SCHOOL_SETUP', preview.document_hash, null, result, 'Tiada deletion atau reset PIN sedia ada.');
  return result;
}

function schoolApplyProfile_(db) {
  var profile = db.state('school-profile:' + config_().year);
  if (!profile) return;
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SCHOOL_NAME') !== profile.school_name || props.getProperty('HEADMISTRESS_NAME') !== profile.headmistress_name) {
    props.setProperties({
      SCHOOL_NAME: profile.school_name,
      HEADMISTRESS_NAME: profile.headmistress_name
    });
    CONFIG_REQUEST_ = null;
  }
}

function schoolReadiness_(db, u) {
  admin_(u);
  var year = String(config_().year),
    classes = db.read('CLASSES').filter(function(c) {
      return String(c.academic_year) === year && bool_(c.active);
    }),
    enrol = db.read('ENROLMENTS').filter(function(e) {
      return String(e.academic_year) === year && e.status === 'ACTIVE';
    }),
    teachers = db.read('USERS').filter(function(t) {
      return bool_(t.active) && (role_(t, 'CLASS_TEACHER') || role_(t, 'SUBJECT_TEACHER'));
    }),
    assignments = db.read('ASSIGNMENTS').filter(function(a) {
      return String(a.academic_year) === year && bool_(a.active);
    }),
    subjects = db.read('SUBJECTS').filter(function(s) {
      return bool_(s.active);
    }),
    missing = [],
    warnings = [];
  classes.forEach(function(c) {
    var n = enrol.filter(function(e) {
      return e.class_id === c.class_id && db.read('STUDENTS').some(function(s) {
        return s.student_id === e.student_id && s.student_status === 'ACTIVE';
      });
    }).length;
    if (n < 1 || n > 60) missing.push({
      class_id: c.class_id,
      field: 'enrolments',
      message: 'Perlu 1–60 murid aktif.'
    });
    var required = [{
      subject_code: '',
      type: 'CLASS_TEACHER'
    }].concat(subjects.filter(function(s) {
      return json_(s.offered_year_levels, []).indexOf(Number(c.year_level)) >= 0;
    }).map(function(s) {
      return {
        subject_code: s.subject_code,
        type: 'SUBJECT_TEACHER'
      };
    }));
    required.forEach(function(r) {
      var found = assignments.filter(function(a) {
        return a.class_id === c.class_id && a.assignment_type === r.type && String(a.subject_code || '') === r.subject_code && teachers.some(function(t) {
          return t.user_id === a.user_id && role_(t, r.type);
        });
      });
      if (r.type === 'CLASS_TEACHER' ? found.length !== 1 : found.length < 1) missing.push({
        class_id: c.class_id,
        subject_code: r.subject_code,
        field: 'assignments',
        message: r.type === 'CLASS_TEACHER' ? 'Perlu tepat satu guru kelas aktif.' : 'Perlu sekurang-kurangnya satu guru subjek aktif.'
      });
    });
  });
  var pending = teachers.filter(function(t) {
    return !!json_(t.authentication_data, {}).must_change;
  });
  if (pending.length) warnings.push(pending.length + ' akaun guru menunggu pengaktifan.');
  if (!classes.length) missing.push({
    field: 'classes',
    message: 'Tiada kelas aktif.'
  });
  if (subjects.length !== 14) missing.push({
    field: 'subjects',
    message: 'Perlu semua 14 subjek backend aktif.'
  });
  var exams = db.read('EXAMS').filter(function(e) {
    return String(e.academic_year) === year;
  });
  ['UPSA','UASA'].forEach(function(type){if(!exams.some(function(e){return e.exam_type===type;}))warnings.push(type+' belum dikonfigurasi. Lengkapkan melalui worksheet08_EXAMS atau tab Peperiksaan.');});
  return {
    academic_year: year,
    ready: !missing.length,
    classes: classes.length,
    students: db.read('STUDENTS').filter(function(s) { return s.student_status === 'ACTIVE'; }).length,
    total_students: db.read('STUDENTS').length,
    active_enrolments: enrol.length,
    teachers: teachers.length,
    pending_activation: pending.map(function(t) {
      return {
        user_id: t.user_id,
        full_name: t.full_name,
        identification_code: t.identification_code,
        account_alias: t.account_alias
      };
    }),
    class_teachers: assignments.filter(function(a) {
      return a.assignment_type === 'CLASS_TEACHER';
    }).length,
    subject_teachers: assignments.filter(function(a) {
      return a.assignment_type === 'SUBJECT_TEACHER';
    }).length,
    subjects: subjects.length,
    missing: missing,
    warnings: warnings,
    exams: exams.map(function(e) {
      return {
        exam_id: e.exam_id,
        exam_type: e.exam_type,
        status: e.status,
        intent: db.state('school-intent:' + e.exam_id),
        ready: !missing.length
      };
    })
  };
}

function schoolPrepare_(db, u, p, req) {
  admin_(u);
  var readiness = schoolReadiness_(db, u);
  need_(readiness.ready, 'Lengkapkan readiness sekolah dahulu.', readiness.missing);
  var e = exam_(db, p.exam_id);
  need_(p.confirmed === true && e.status === 'DRAFT', 'Pengesahan exam DRAFT diperlukan.');
  return prepareExam_(db, u, p, req);
}

function schoolPreviewDetails_(db, u, p) {
  admin_(u);
  var ticket = db.state('school-preview:' + p.preview_id);
  need_(ticket && ticket.actor === u.user_id && ticket.expires > Date.now() && ticket.document_hash === hash_(canonicalJson_(p.document)), 'Pratonton tidak sah/tamat tempoh.');
  need_(ticket.snapshot === setupSnapshot_(db), 'Data berubah. Validasi semula.');
  var plan = schoolPlan_(db, u, p, false);
  return {
    errors: plan.errors,
    warnings: plan.warnings,
    counts: plan.counts,
    newTeachers: plan.newTeachers,
    changes: plan.planSummary.slice(0, 100),
    change_count: plan.changes.length
  };
}
