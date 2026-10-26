(function(M) {
  M.namedSelectors = (data, record, table) => {
    const form = document.querySelector('#entity-form');
    if (!form) return;
    const foreign = {};
    if (['ENROLMENTS', 'ASSIGNMENTS'].includes(table)) foreign.class_id = data.CLASSES.map(x => [x.class_id, `${x.class_name} — ${x.academic_year}`]);
    if (table === 'ENROLMENTS') foreign.student_id = data.STUDENTS.map(x => [x.student_id, x.full_name]);
    if (table === 'ASSIGNMENTS') {
      foreign.user_id = data.USERS.map(x => [x.user_id, x.full_name]);
      foreign.subject_code = data.SUBJECTS.map(x => [x.subject_code, `${x.subject_code} — ${x.subject_name}`]);
    }
    Object.entries(foreign).forEach(([name, options]) => {
      const old = form.elements[name],
        select = document.createElement('select');
      select.name = name;
      select.innerHTML = '<option value="">Pilih…</option>' + options.map(([id, label]) => `<option value="${M.esc(id)}">${M.esc(label)}</option>`).join('');
      select.value = record[name] || '';
      if (!(name === 'subject_code')) select.required = true;
      old.replaceWith(select);
    });
    if (table === 'USERS') {
      const code = form.elements.identification_code;
      code.inputMode = 'text';
      code.pattern = '([0-9]{6}|[A-Za-z][A-Za-z0-9_-]{1,29})';
      code.minLength = 2;
      code.maxLength = 30;
      code.required = true;
      form.elements.pin.minLength = 10;
      form.elements.pin.maxLength = 64;
    }
    ['full_name', 'class_name', 'subject_name', 'academic_year', 'year_level', 'opening_date', 'closing_date', 'grading_version', 'template_version'].forEach(name => {
      if (form.elements[name]) form.elements[name].required = true;
    });
    const primary = {
      CLASSES: 'class_id',
      STUDENTS: 'student_id',
      ASSIGNMENTS: 'assignment_id',
      USERS: 'user_id',
      EXAMS: 'exam_id'
    } [table];
    if (primary && record[primary]) form.elements[primary].readOnly = true;
    const row = document.querySelector('#admin-section > .table-scroll');
    if (row) {
      const label = document.createElement('label');
      label.textContent = 'Cari dalam senarai';
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Nama, kelas, kod atau status';
      input.oninput = () => row.querySelectorAll('tbody tr').forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(input.value.toLowerCase()));
      label.append(input);
      row.before(label);
    }
  };
  document.addEventListener('submit', e => {
    M.lastSubmit = {
      form: e.target,
      time: performance.now()
    };
  }, true);
})(window.MPS);
