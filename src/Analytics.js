function analytics_(db, u, p) {
  need_(['CURRENT', 'OFFICIAL'].indexOf(p.mode) >= 0, 'Pilih Analisis Semasa atau Rasmi.');
  var e = exam_(db, p.exam_id),
    classes = db.read('CLASSES').filter(function(c) {
      return String(c.academic_year) === String(e.academic_year) && (!p.class_id || c.class_id === p
        .class_id) && (!p.year_level || Number(c.year_level) === Number(p.year_level)) && (!p.stage ||
        Number(c.academic_stage) === Number(p.stage));
    }),
    marks = [];
  classes.forEach(function(c) {
    var classAccess = role_(u, 'ADMINISTRATOR') || canClass_(db, u, e.exam_id, c.class_id),
      assigned = assignments_(db, u, e.exam_id).filter(function(a) {
        return a.class_id === c.class_id && a.assignment_type === 'SUBJECT_TEACHER' && role_(u,
          'SUBJECT_TEACHER');
      }).map(function(a) {
        return a.subject_code;
      });
    if (!classAccess && !assigned.length) return;
    var m = metadata_(db, e.exam_id, c.class_id),
      rows = p.mode === 'OFFICIAL' ? (m && m.finalized_at ? db.read('CLASS_REVIEWS').filter(function(r) {
        return r.exam_id === e.exam_id && r.class_id === c.class_id && r.record_type === 'STUDENT';
      }).reduce(function(a, r) {
        return a.concat(json_(r.result_snapshot, {}).marks || []);
      }, []) : []) : db.marks(e.exam_id, c.class_id);
    marks = marks.concat(rows.filter(function(r) {
      return (classAccess || assigned.indexOf(r.subject_code) >= 0) && (!p.subject_code || r
        .subject_code === p.subject_code) && (!p.student_id || r.student_id === p.student_id);
    }));
  });
  var groups = {};
  marks.forEach(function(m) {
    var cls = classes.find(function(c) {
        return c.class_id === m.class_id_snapshot;
      }),
      k = key_([cls.class_id, m.subject_code]);
    if (!groups[k]) groups[k] = {
      class_id: cls.class_id,
      class_name: cls.class_name,
      year_level: cls.year_level,
      stage: cls.academic_stage,
      subject: m.subject_code,
      rows: []
    };
    groups[k].rows.push(m);
  });
  var bySubject = {};
  marks.forEach(function(m) {
    (bySubject[m.subject_code] || (bySubject[m.subject_code] = [])).push(m);
  });
  return {
    mode: p.mode,
    exam: e,
    summary: statistics_(marks),
    subjects: Object.keys(bySubject).map(function(s) {
      return {
        subject: s,
        stats: statistics_(bySubject[s])
      };
    }),
    groups: Object.keys(groups).map(function(k) {
      var g = groups[k];
      return {
        class_id: g.class_id,
        class_name: g.class_name,
        year_level: g.year_level,
        stage: g.stage,
        subject: g.subject,
        stats: statistics_(g.rows)
      };
    }),
    dataset: marks.map(function(m) {
      return {
        student_id: m.student_id,
        name: m.student_name_snapshot,
        class_id: m.class_id_snapshot,
        subject: m.subject_code,
        score: m.score,
        status: m.mark_status,
        grade: m.grade
      };
    })
  };
}

function compare_(db, u, p) {
  var left = analytics_(db, u, Object.assign({}, p, {
      exam_id: p.left_exam
    })),
    right = analytics_(db, u, Object.assign({}, p, {
      exam_id: p.right_exam
    })),
    l = {},
    pairs = [];
  left.dataset.filter(function(m) {
    return m.status === 'SCORED';
  }).forEach(function(m) {
    l[key_([m.student_id, m.subject])] = m;
  });
  right.dataset.filter(function(m) {
    return m.status === 'SCORED';
  }).forEach(function(m) {
    var a = l[key_([m.student_id, m.subject])];
    if (a) pairs.push({
      student_id: m.student_id,
      name: m.name,
      subject: m.subject,
      left: Number(a.score),
      right: Number(m.score),
      change: Number(m.score) - Number(a.score),
      left_class: a.class_id,
      right_class: m.class_id
    });
  });
  return {
    left: left,
    right: right,
    matched: pairs,
    matchedAverageChange: pairs.length ? Number((pairs.reduce(function(n, x) {
      return n + x.change;
    }, 0) / pairs.length).toFixed(2)) : null,
    note: 'Padanan student_id + subjek dengan markah angka dalam kedua-dua peperiksaan. Purata kohort penuh mungkin berubah kerana komposisi murid.'
  };
}
