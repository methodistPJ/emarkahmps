function exam_(db, e) {
  var x = db.find('EXAMS', 'exam_id', e);
  need_(x, 'Peperiksaan tidak dijumpai.');
  return x;
}

function class_(db, c) {
  var x = db.find('CLASSES', 'class_id', c);
  need_(x, 'Kelas tidak dijumpai.');
  return x;
}

function assignments_(db, u, e) {
  var exam = exam_(db, e);
  return db.read('ASSIGNMENTS').filter(function(a) {
    return a.user_id === u.user_id && String(a.academic_year) === String(exam.academic_year) && bool_(a
      .active);
  });
}

function canClass_(db, u, e, c) {
  return role_(u, 'CLASS_TEACHER') && assignments_(db, u, e).some(function(a) {
    return a.class_id === c && a.assignment_type === 'CLASS_TEACHER';
  });
}

function canSubject_(db, u, e, c, s) {
  return role_(u, 'SUBJECT_TEACHER') && assignments_(db, u, e).some(function(a) {
    return a.class_id === c && a.subject_code === s && a.assignment_type === 'SUBJECT_TEACHER';
  });
}

function readable_(db, u, e, c, s) {
  if (role_(u, 'ADMINISTRATOR') || canClass_(db, u, e, c) || s && canSubject_(db, u, e, c, s)) return;
  fail_('FORBIDDEN', 'Kelas atau subjek ini bukan tugasan anda.');
}

function rules_(db, v) {
  return db.read('GRADE_RULES').filter(function(r) {
    return String(r.grading_version) === String(v);
  }).sort(function(a, b) {
    return Number(a.minimum_score) - Number(b.minimum_score);
  });
}

function validateRules_(rules) {
  need_(rules.length === 6, 'Enam julat gred A–F diperlukan.');
  var expected = ['F', 'E', 'D', 'C', 'B', 'A'];
  rules.sort(function(a, b) {
    return a.minimum_score - b.minimum_score;
  });
  rules.forEach(function(r, i) {
    need_(r.grade === expected[i] && Number.isInteger(Number(r.minimum_score)) && Number.isInteger(Number(
        r.maximum_score)) && Number(r.minimum_score) === (i === 0 ? 0 : Number(rules[i - 1]
        .maximum_score) + 1) && Number(r.maximum_score) >= Number(r.minimum_score),
      'Julat gred bertindih, berjurang atau tidak sah.');
  });
  need_(Number(rules[5].maximum_score) === 100, 'Gred mesti meliputi 0–100.');
  return rules;
}

function grade_(score, rules) {
  var r = rules.find(function(r) {
    return score >= Number(r.minimum_score) && score <= Number(r.maximum_score);
  });
  need_(r, 'Markah tidak diliputi aturan gred.');
  return r.grade;
}

function markValue_(raw, rules) {
  var x = String(raw === null || raw === undefined ? '' : raw).trim().toUpperCase();
  if (x === '' || x === 'EMPTY') return {
    score: '',
    mark_status: 'EMPTY',
    grade: ''
  };
  if (x === 'TB' || x === 'TH') return {
    score: '',
    mark_status: x,
    grade: ''
  };
  need_(/^\d{1,3}$/.test(x) && Number(x) <= 100, 'Markah mesti nombor bulat 0–100, TB atau TH.');
  return {
    score: Number(x),
    mark_status: 'SCORED',
    grade: grade_(Number(x), rules)
  };
}

function metadata_(db, e, c) {
  return db.find('CLASS_REVIEWS', 'review_id', key_([e, c, 'CLASS']));
}

function writable_(db, e, c) {
  var ex = exam_(db, e),
    m = metadata_(db, e, c);
  need_(m && m.record_type === 'CLASS', 'Kelas belum disediakan untuk peperiksaan.');
  need_(!m.finalized_at, 'Kelas sudah dimuktamadkan. Pentadbir perlu membuka semula.');
  need_(ex.status === 'OPEN' && Date.now() >= Date.parse(ex.opening_date) && Date.now() <= Date.parse(ex
    .closing_date), 'Tempoh pengisian ditutup.');
}

function submission_(db, e, c, s) {
  return db.find('SUBMISSIONS', 'submission_id', key_([e, c, s]));
}

function subjectsExam_(db, e, level) {
  return json_(exam_(db, e).subject_snapshot, []).filter(function(s) {
    return s.offered_year_levels.map(Number).indexOf(Number(level)) >= 0;
  }).sort(function(a, b) {
    return a.display_order - b.display_order;
  });
}

function statistics_(marks) {
  var g = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0
    },
    status = {
      SCORED: 0,
      TH: 0,
      TB: 0,
      EMPTY: 0
    },
    sum = 0;
  marks.forEach(function(m) {
    status[m.mark_status]++;
    if (m.mark_status === 'SCORED') {
      g[m.grade]++;
      sum += Number(m.score);
    }
  });
  return {
    total: marks.length,
    applicable: marks.length - status.TB,
    status: status,
    grades: g,
    average: status.SCORED ? Number((sum / status.SCORED).toFixed(2)) : null,
    percentages: Object.keys(g).reduce(function(a, k) {
      a[k] = status.SCORED ? Number((100 * g[k] / status.SCORED).toFixed(2)) : 0;
      return a;
    }, {}),
    denominator: 'SCORED sahaja; TH, TB dan EMPTY dilaporkan berasingan.'
  };
}
