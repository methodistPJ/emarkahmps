const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict');
let passed = 0;
const tests = [];

function test(name, fn) {
  tests.push([name, fn]);
}
class Sheet {
  constructor(name) {
    this.name = name;
    this.cells = [];this.formats={};this.maxRows=1000;this.maxCols=26;
  }
  getMaxRows(){return this.maxRows;}
  getMaxColumns(){return this.maxCols;}
  insertRowsAfter(_,n){this.maxRows+=n;}
  insertColumnsAfter(_,n){this.maxCols+=n;}
  getLastRow() {
    return this.cells.reduce((n, r, i) => r.some(v => v !== '' && v !== undefined) ? i + 1 : n, 0);
  }
  getRange(r, c, n = 1, m = 1) {
    const s = this;
    return {
      getRow(){return r;},getNumRows(){return n;},getNumColumns(){return m;},
      setNumberFormat(format){for(let i=0;i<n;i++)for(let j=0;j<m;j++)s.formats[(r+i)+':'+(c+j)]=format;return this;},
      createTextFinder(text){return {matchEntireCell(){return this;},useRegularExpression(){return this;},findAll(){const matches=[];for(let i=0;i<n;i++)if(String(s.cells[r+i-1]?.[c-1])===text)matches.push({getRow:()=>r+i});return matches;}};},
      getValues() {
        return Array.from({
          length: n
        }, (_, i) => Array.from({
          length: m
        }, (_, j) => s.cells[r + i - 1]?.[c + j - 1] ?? ''));
      },
      setValues(values) {
        assert.equal(values.length, n);
        values.forEach((row, i) => {
          assert.equal(row.length, m);
          s.cells[r + i - 1] ||= [];
          row.forEach((v,j)=>{if(typeof v==='string'&&v.startsWith("'"))v=v.slice(1);else if(typeof v==='string'&&/^0[0-9]+$/.test(v)&&s.formats[(r+i)+':'+(c+j)]!=='@')v=Number(v);s.cells[r+i-1][c+j-1]=v;});
        });
        return this;
      },
      setValue(v) {
        return this.setValues([
          [v]
        ]);
      }
    };
  }
  clearContents() {
    this.cells = [];this.formats={};this.maxRows=1000;this.maxCols=26;
  }
  setFrozenRows() {}
  hideSheet() {}
}
class Book {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(n) {
    return this.sheets[n] || null;
  }
  insertSheet(n) {
    return this.sheets[n] = new Sheet(n);
  }
  getId() {
    return 'TEST-BOOK';
  }
  getUrl() {
    return 'test://book';
  }
}
const book = new Book(),
  props = {
    SPREADSHEET_ID: 'test',
    AUTH_PEPPER: crypto.randomBytes(32).toString('base64url'),
    ACADEMIC_YEAR: '2027',
    DRIVE_PARENT_ID: 'test'
  };
const context = vm.createContext({
  console,
  Date,
  Math,
  JSON,
  Uint8Array,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => props[k] || null,
      setProperty: (k, v) => props[k] = v,
      deleteProperty:k=>delete props[k],setProperties:o=>Object.assign(props,o)
    })
  },
  SpreadsheetApp: {
    openById: () => book,
    flush() {}
  },
  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock() {}
    })
  },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: {
      SHA_256: 'sha256'
    },
    Charset: {
      UTF_8: 'utf8'
    },
    computeDigest: (_, s) => [...crypto.createHash('sha256').update(s).digest()],
    computeHmacSha256Signature: (s, key) => [...crypto.createHmac('sha256', key).update(s).digest()],
    base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
    base64Encode:bytes=>Buffer.from(bytes).toString('base64'),newBlob:s=>({getBytes:()=>[...Buffer.from(s)]})
  },
  DocumentApp: {},
  DriveApp: {},
  MimeType: {
    PDF: 'application/pdf'
  },
  ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=>'processQueue_'}]}

});
const root=path.resolve(process.env.MPS_SOURCE||path.join(__dirname,'../src'));
for (const file of fs.readdirSync(root).filter(n => n.endsWith('.js') && n !==
    'PdfLib.js')) {
  const src = fs.readFileSync(path.join(root,file), 'utf8');
  new vm.Script(src, {
    filename: file
  });
  vm.runInContext(src, context);
  for (const match of src.matchAll(/^(?:async )?function (\w+)\(/gm)) assert.ok(process.env.MPS_BASELINE==='1'||match[1].endsWith('_') || [
    'doGet', 'rpc'
  ].includes(match[1]), 'Unexpected public function ' + match[1]);
}
const plain = x => JSON.parse(JSON.stringify(x)),
  db = () => new context.Db_(book),
  admin = {
    user_id: 'admin',
    full_name: 'Administrator fixture',
    roles: '["ADMINISTRATOR"]'
  },
  teacher = {
    user_id: 'teacher',
    full_name: 'Subject fixture',
    roles: '["SUBJECT_TEACHER"]'
  },
  ct = {
    user_id: 'classTeacher',
    full_name: 'Class fixture',
    roles: '["CLASS_TEACHER"]'
  };
for (const [n, headers] of Object.entries(context.SCHEMA_)) book.insertSheet(n).getRange(1, 1, 1, headers
  .length).setValues([headers]);

function mutate(fn) {
  let d = db();
  const result = fn(d);
  context.commit_(d, crypto.randomUUID().replaceAll('-', ''), admin, {}, result || {});
  return plain(result || {});
}
mutate(d => {
  for (const u of [admin, teacher, ct]) d.put('USERS', {
    ...u,
    active: true,
    auth_version: 1
  });
  context.SUBJECT_SEED_.forEach((s, i) => d.put('SUBJECTS', {
    subject_code: s[0],
    subject_name: s[1],
    offered_year_levels: JSON.stringify(i >= 12 ? [4, 5, 6] : [1, 2, 3, 4, 5, 6]),
    display_order: i,
    default_status: ['PI', 'PM', 'BA', 'BC', 'BT'].includes(s[0]) ? 'TB' : 'EMPTY',
    active: true
  }));
  [
    [0, 19, 'F'],
    [20, 34, 'E'],
    [35, 49, 'D'],
    [50, 65, 'C'],
    [66, 81, 'B'],
    [82, 100, 'A']
  ].forEach(g => d.put('GRADE_RULES', {
    rule_id: g[2],
    grading_version: 'v1',
    minimum_score: g[0],
    maximum_score: g[1],
    grade: g[2]
  }));
  for (const [cid, level] of [
      ['C4', 4],
      ['C2', 2]
    ]) {
    d.put('CLASSES', {
      class_id: cid,
      academic_year: '2027',
      year_level: level,
      academic_stage: level < 4 ? 1 : 2,
      class_name: 'Class ' + cid,
      active: true
    });
    for (let n = 1; n <= 2; n++) {
      const sid = cid + 'S' + n;
      d.put('STUDENTS', {
        student_id: sid,
        full_name: 'Fixture ' + sid,
        student_status: 'ACTIVE'
      });
      d.put('ENROLMENTS', {
        enrolment_id: sid,
        student_id: sid,
        academic_year: '2027',
        class_id: cid,
        status: 'ACTIVE'
      });
    }
    d.put('ASSIGNMENTS', {
      assignment_id: cid + 'CT',
      academic_year: '2027',
      class_id: cid,
      user_id: ct.user_id,
      assignment_type: 'CLASS_TEACHER',
      active: true
    });
  }
  context.SUBJECT_SEED_.forEach((s, i) => d.put('ASSIGNMENTS', {
    assignment_id: 'A' + i,
    academic_year: '2027',
    class_id: 'C4',
    subject_code: s[0],
    user_id: teacher.user_id,
    assignment_type: 'SUBJECT_TEACHER',
    active: true
  }));
  d.put('EXAMS', {
    exam_id: 'UPSA',
    academic_year: '2027',
    exam_type: 'UPSA',
    status: 'DRAFT',
    opening_date: '2020-01-01T00:00:00Z',
    closing_date: '2099-01-01T00:00:00Z',
    grading_version: 'v1',
    template_version: 'replacement-v1'
  });
});
test('Grade boundaries 0–100 and invalid inputs', () => {
  const rules = context.rules_(db(), 'v1');
  context.validateRules_(rules);
  for (let i = 0; i <= 100; i++) {
    const expected = i >= 82 ? 'A' : i >= 66 ? 'B' : i >= 50 ? 'C' : i >= 35 ? 'D' : i >= 20 ? 'E' : 'F';
    assert.equal(context.grade_(i, rules), expected);
  }
  for (const bad of [-1, 101, 'NaN', '2.5', '1e2', '=1']) assert.throws(() => context.markValue_(bad,
    rules));
  assert.equal(context.markValue_(0, rules).grade, 'F');
  assert.equal(context.markValue_('TH ', rules).mark_status, 'TH');
  assert.equal(context.markValue_('TB', rules).grade, '');
  assert.equal(context.markValue_('', rules).mark_status, 'EMPTY');
  const overlapping = plain(rules);
  overlapping[1].minimum_score = 19;
  assert.throws(() => context.validateRules_(overlapping));
});
test('Prepare exam has correct Tahap coverage and default TB', () => {
  mutate(d => context.prepareExam_(d, admin, {
    exam_id: 'UPSA'
  }, 'prepare'));
  assert.equal(db().marks('UPSA', 'C4').length, 28);
  assert.equal(db().marks('UPSA', 'C2').length, 24);
  assert.equal(db().marks('UPSA', 'C2', 'SEJ').length, 0);
  assert.equal(db().marks('UPSA', 'C4').filter(m => m.mark_status === 'TB').length, 10);
  assert.throws(() => context.prepareExam_(db(), admin, {
    exam_id: 'UPSA'
  }, 'again'));
});
test('Teacher RBAC and stale version rejected', () => {
  const rows = db().marks('UPSA', 'C4', 'BM'),
    m = rows[0];
  const p = {
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: [{
      mark_id: m.mark_id,
      version: 1,
      value: 0
    }]
  };
  mutate(d => context.saveMarks_(d, teacher, p, 'save'));
  assert.equal(db().marks('UPSA', 'C4', 'BM')[0].score, 0);
  assert.throws(() => context.saveMarks_(db(), teacher, p, 'stale'), e => e.code === 'CONFLICT');
  assert.throws(() => context.marksGet_(db(), teacher, {
    exam_id: 'UPSA',
    class_id: 'C2',
    subject_code: 'BM'
  }));
  assert.throws(() => context.reviewGet_(db(), teacher, {
    exam_id: 'UPSA',
    class_id: 'C4'
  }));
});
test('Batch rejects all changes when any conflict exists', () => {
  const rows = db().marks('UPSA', 'C4', 'BI'),
    p = {
      exam_id: 'UPSA',
      class_id: 'C4',
      changes: [{
        mark_id: rows[0].mark_id,
        version: 1,
        value: 80
      }, {
        mark_id: rows[1].mark_id,
        version: 99,
        value: 70
      }]
    };
  assert.throws(() => context.saveMarks_(db(), teacher, p, 'bad'));
  assert.equal(db().marks('UPSA', 'C4', 'BI')[0].mark_status, 'EMPTY');
});
test('A teacher with both roles can use ordinary entry for an assigned subject', () => {
  ct.roles = '["CLASS_TEACHER","SUBJECT_TEACHER"]';
  mutate(d => {
    const account = d.find('USERS', 'user_id', ct.user_id);
    account.roles = ct.roles;
    d.put('USERS', account);
    d.put('ASSIGNMENTS', {
      assignment_id: 'multi-role-BM',
      academic_year: '2027',
      class_id: 'C4',
      user_id: ct.user_id,
      subject_code: 'BM',
      assignment_type: 'SUBJECT_TEACHER',
      active: true
    });
  });
  const mark = db().marks('UPSA', 'C4', 'BM')[0];
  mutate(d => context.saveMarks_(d, ct, {
    mode: 'SUBJECT_ENTRY',
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: [{
      mark_id: mark.mark_id,
      version: mark.record_version,
      value: 35
    }]
  }, 'multi-role-save'));
  assert.equal(db().marks('UPSA', 'C4', 'BM')[0].grade, 'D');
  assert.equal(db().marks('UPSA', 'C4', 'BM')[0].amendment_reason, '');
});
test('Submission requires completeness and default TB acknowledgement', () => {
  assert.throws(() => context.submit_(db(), teacher, {
    exam_id: 'UPSA',
    class_id: 'C4',
    subject_code: 'BM'
  }, 'bad'));
  const rows = db().marks('UPSA', 'C4', 'PI'),
    p = {
      exam_id: 'UPSA',
      class_id: 'C4',
      subject_code: 'PI',
      versions: rows.map(m => [m.mark_id, Number(m.record_version)])
    };
  assert.throws(() => context.submit_(db(), teacher, p, 'bad'));
  assert.throws(() => context.submit_(db(), teacher, {
    ...p,
    tb_acknowledged: true
  }, 'bad'));
  mutate(d => context.submit_(d, teacher, {
    ...p,
    tb_acknowledged: true,
    all_tb_acknowledged: true
  }, 'submit'));
  assert.throws(() => context.saveMarks_(db(), teacher, {
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: [{
      mark_id: rows[0].mark_id,
      version: 1,
      value: 90
    }]
  }, 'bad'));
});
test('Class teacher amendment preserves teacher submission revision', () => {
  const blocked = db().marks('UPSA', 'C4', 'PI')[0];
  assert.equal(context.reviewGet_(db(),ct,{exam_id:'UPSA',class_id:'C4'}).editable,false);
  assert.throws(()=>context.saveMarks_(db(),ct,{mode:'CLASS_REVIEW',exam_id:'UPSA',class_id:'C4',changes:[{mark_id:blocked.mark_id,version:blocked.record_version,value:83,reason:'Blocked until all submit'}]},'gate'),/Semua guru subjek/);
  assert.throws(()=>context.remarkSave_(db(),ct,{exam_id:'UPSA',class_id:'C4',changes:[]},'gate'),/Semua guru subjek/);
  for(const subject of context.SUBJECT_SEED_.map(s=>s[0]).filter(s=>s!=='PI')){
    let rows=db().marks('UPSA','C4',subject);
    mutate(d=>context.saveMarks_(d,teacher,{exam_id:'UPSA',class_id:'C4',changes:rows.map(m=>({mark_id:m.mark_id,version:m.record_version,value:m.mark_status==='TB'?'TB':82}))},'fill'));
    rows=db().marks('UPSA','C4',subject);
    mutate(d=>context.submit_(d,teacher,{exam_id:'UPSA',class_id:'C4',subject_code:subject,versions:rows.map(m=>[m.mark_id,Number(m.record_version)]),tb_acknowledged:true,all_tb_acknowledged:true},'submit'));
  }

  assert.equal(context.reviewGet_(db(),ct,{exam_id:'UPSA',class_id:'C4'}).editable,true);
  const m = db().marks('UPSA', 'C4', 'PI')[0],
    before = plain(context.submission_(db(), 'UPSA', 'C4', 'PI'));
  assert.throws(() => context.saveMarks_(db(), ct, {
    mode: 'CLASS_REVIEW',
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: [{
      mark_id: m.mark_id,
      version: 1,
      value: 83
    }]
  }, 'bad'));
  mutate(d => context.saveMarks_(d, ct, {
    mode: 'CLASS_REVIEW',
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: [{
      mark_id: m.mark_id,
      version: 1,
      value: 83,
      reason: 'Correction fixture'
    }]
  }, 'amend'));
  const after = context.submission_(db(), 'UPSA', 'C4', 'PI');
  assert.equal(after.submitted_versions, before.submitted_versions);
  assert.equal(after.submission_status, 'AMENDED');
  assert.equal(after.submitted_by, 'teacher');
  const refreshedRows=context.entryMarks_(db(),'UPSA','C4','PI');
  const resubmitted=mutate(d=>context.submit_(d,teacher,{exam_id:'UPSA',class_id:'C4',subject_code:'PI',versions:refreshedRows.map(m=>[m.mark_id,Number(m.record_version)]),tb_acknowledged:true,all_tb_acknowledged:true},'reconfirm'));
  assert.equal(resubmitted.submission_status,'AMENDED');
  assert.equal(resubmitted.submitted_versions,before.submitted_versions);
  assert.ok(db().read('AUDIT_LOG').some(a => a.action === 'CLASS_AMENDMENT'));
});
test('Finalization blocks missing remarks/submissions, then freezes whole class', () => {
  assert.throws(() => context.finalize_(db(), ct, {
    exam_id: 'UPSA',
    class_id: 'C4',
    confirmed: true
  }, 'bad'));
  for (const subject of context.SUBJECT_SEED_.map(s => s[0])) {
    let rows = db().marks('UPSA', 'C4', subject);
    if (context.submission_(db(), 'UPSA', 'C4', subject).submission_status === 'DRAFT') {
      mutate(d => context.saveMarks_(d, teacher, {
        exam_id: 'UPSA',
        class_id: 'C4',
        changes: rows.map(m => ({
          mark_id: m.mark_id,
          version: m.record_version,
          value: m.mark_status === 'TB' ? 'TB' : 82
        }))
      }, 'fill'));
      rows = db().marks('UPSA', 'C4', subject);
      mutate(d => context.submit_(d, teacher, {
        exam_id: 'UPSA',
        class_id: 'C4',
        subject_code: subject,
        versions: rows.map(m => [m.mark_id, Number(m.record_version)]),
        tb_acknowledged: true,
        all_tb_acknowledged: true
      }, 'submit'));
    }
  }
  const reviews = db().read('CLASS_REVIEWS').filter(r => r.class_id === 'C4' && r.record_type ===
    'STUDENT');
  mutate(d => context.remarkSave_(d, ct, {
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: reviews.map(r => ({
      student_id: r.student_id,
      version: r.record_version,
      remark: 'Reviewed fixture remark.'
    }))
  }, 'remarks'));
  let ready = context.readiness_(db(), 'UPSA', 'C4');
  assert.equal(ready.ready, true);
  assert.throws(() => context.finalize_(db(), ct, {
    exam_id: 'UPSA',
    class_id: 'C4',
    confirmed: true,
    revisionHash: 'old'
  }, 'bad'));
  mutate(d => context.finalize_(d, ct, {
    exam_id: 'UPSA',
    class_id: 'C4',
    confirmed: true,
    revisionHash: ready.revisionHash
  }, 'finalize'));
  const meta = context.metadata_(db(), 'UPSA', 'C4');
  assert.equal(meta.pdf_status, 'QUEUED');
  assert.equal(meta.class_finalization_revision, 1);
  const repeated=mutate(d=>context.finalize_(d, ct, {exam_id:'UPSA',class_id:'C4',confirmed:true,revisionHash:ready.revisionHash}, 'again'));
  assert.equal(repeated.revision,1);
  assert.equal(context.verificationView_(db(),'UPSA','C4').name,ct.full_name);
  assert.throws(() => context.saveMarks_(db(), ct, {
    mode: 'CLASS_REVIEW',
    exam_id: 'UPSA',
    class_id: 'C4',
    changes: []
  }, 'bad'));
  const snap = JSON.parse(db().read('CLASS_REVIEWS').find(r => r.class_id === 'C4' && r.record_type ===
    'STUDENT').result_snapshot);
  assert.equal(snap.marks.length, 14);
  assert.equal(snap.grading_version, 'v1');
});
test('Official analytics uses frozen data; percentages count A–F', () => {
  const official = context.analytics_(db(), teacher, {
    exam_id: 'UPSA',
    mode: 'OFFICIAL'
  });
  assert.equal(official.dataset.length, 28);
  const stats = context.statistics_([{
    mark_status: 'SCORED',
    score: 0,
    grade: 'F'
  }, {
    mark_status: 'SCORED',
    score: 100,
    grade: 'A'
  }, {
    mark_status: 'TH'
  }, {
    mark_status: 'TB'
  }, {
    mark_status: 'EMPTY'
  }]);
  assert.equal(stats.grades.F, 1);
  assert.equal(stats.average, 50);
  assert.equal(stats.percentages.F, 50);
  assert.equal(stats.applicable, 4);
  assert.equal(Object.values(stats.percentages).reduce((a, b) => a + b), 100);
});
test('Reopen requires admin, invalidates PDF and official analytics', () => {
  assert.throws(() => context.reopen_(db(), ct, {
    exam_id: 'UPSA',
    class_id: 'C4',
    reason: 'test'
  }, 'bad'));
  mutate(d => context.reopen_(d, admin, {
    exam_id: 'UPSA',
    class_id: 'C4',
    reason: 'Correction authorized'
  }, 'reopen'));
  assert.equal(context.metadata_(db(), 'UPSA', 'C4').pdf_status, 'OUTDATED');
  assert.equal(context.analytics_(db(), teacher, {
    exam_id: 'UPSA',
    mode: 'OFFICIAL'
  }).dataset.length, 0);
  assert.throws(() => context.pdfDownload_(db(), ct, {
    exam_id: 'UPSA',
    class_id: 'C4'
  }));
});
test('Request idempotency binds payload and actor', () => {
  const d = db(),
    req = 'test-request-000001',
    payload = {
      action: 'example'
    },
    result = {
      saved: true
    };
  context.commit_(d, req, teacher, payload, result);
  assert.equal(context.replay_(db(), req, teacher, payload).value.saved, true);
  assert.equal(context.replay_(db(), req, ct, payload), null);
  assert.throws(() => context.replay_(db(), req, teacher, {
    action: 'other'
  }));
});
test('Prepared write-ahead journal replays after interrupted write', () => {
  const s = book.getSheetByName('_OPS'),
    op = 'crash',
    record = {
      table: '_STATE',
      row: book.getSheetByName('_STATE').getLastRow() + 1,
      values: ['recovery', '{"ok":true}']
    },
    rows = [
      [op, 'recovery-request', 'teacher', 'x', 'PREPARED', '{}', 0, '{"pieces":1}', ''],
      [op, 'recovery-request', 'teacher', 'x', 'PIECE', '', 1, JSON.stringify([record]), '']
    ];
  s.getRange(s.getLastRow() + 1, 1, 2, 9).setValues(rows);
  props.RECOVERY_ROW = String(s.getLastRow() - 1);
  context.recover_(book);
  assert.equal(db().state('recovery').ok, true);
  context.recover_(book);
  assert.equal(db().read('_STATE').filter(r => r.state_id === 'recovery').length, 1);
});
test('Authentication hashes PIN verifier, collision handling, cooldown, revocation', () => {
  const proof = crypto.randomBytes(32).toString('base64url'),
    salt = context.authSalt_('000123', 'alpha');
  mutate(d => context.userSave_(d, admin, {
    full_name: 'Auth fixture',
    identification_code: '000123',
    account_alias: 'alpha',
    roles: ['SUBJECT_TEACHER'],
    active: true,
    proof,
    salt
  }, 'user'));
  assert.throws(() => context.userSave_(db(), admin, {
    full_name: 'Duplicate',
    identification_code: '000123',
    account_alias: 'alpha',
    roles: ['SUBJECT_TEACHER'],
    proof,
    salt
  }, 'bad'));
  mutate(d => context.userSave_(d, admin, {
    full_name: 'Collision fixture',
    identification_code: '000123',
    account_alias: 'beta',
    roles: ['SUBJECT_TEACHER'],
    proof,
    salt: context.authSalt_('000123', 'beta')
  }, 'collision'));
  const session = context.login_(db(), {
    code: '000123',
    alias: 'alpha',
    proof
  });
  assert.equal(context.session_(db(), session.token).full_name, 'Auth fixture');
  assert.ok(!db().read('USERS').find(r => r.full_name === 'Auth fixture').authentication_data.includes(
    proof));
  mutate(d => {
    const r = d.find('USERS', 'user_id', session.user.user_id);
    r.auth_version++;
    d.put('USERS', r);
  });
  assert.throws(() => context.session_(db(), session.token), e => e.code === 'SESSION');
  for (let i = 0; i < 5; i++) assert.throws(() => context.login_(db(), {
    code: '000999',
    alias: '',
    proof
  }));
  assert.throws(() => context.challenge_(db(), {
    code: '000999',
    alias: ''
  }), e => e.code === 'COOLDOWN');
});
test('Expired sessions and unauthenticated RPC fail closed', () => {
  assert.equal(context.rpc({
    action: 'adminData',
    payload: {}
  }).ok, false);
  assert.throws(() => context.session_(db(), 'bad'));
});
test('025849 account creation, real PBKDF2 login, alias and deactivation preserve six digits',()=>{
 const code='025849',alias='leading',pin='Synthetic-only-PIN-123',salt=context.authSalt_(code,alias);
 const proof=crypto.pbkdf2Sync(pin,salt,context.config_().iterations,32,'sha256').toString('base64url');
 mutate(d=>context.userSave_(d,admin,{full_name:'Leading zero fixture',identification_code:code,account_alias:alias,roles:['SUBJECT_TEACHER'],active:true,proof,salt},'leading'));
 const row=db().read('USERS').find(u=>u.identification_code===code);
 assert.equal(typeof row.identification_code,'string');
 assert.equal(book.getSheetByName('USERS').formats[row._row+':'+(context.SCHEMA_.USERS.indexOf('identification_code')+1)],'@');
 const session=context.login_(db(),{code,alias,proof});assert.equal(context.session_(db(),session.token).full_name,'Leading zero fixture');
 assert.throws(()=>context.login_(db(),{code,alias,proof:crypto.randomBytes(32).toString('base64url')}));
 mutate(d=>{const u=d.find('USERS','user_id',row.user_id);u.active=false;d.put('USERS',u);});
 assert.throws(()=>context.session_(db(),session.token));
});
test('RPC prototype actions and public installer are unavailable',()=>{
 assert.equal(typeof context.runInstallation,'undefined');
 for(const action of ['toString','__proto__','constructor','runInstallation'])assert.equal(context.rpc({action,payload:{}}).ok,false);
});
test('Readiness rejects a missing student-subject cell even without EMPTY records',()=>{
 const d=db(),exam=d.find('EXAMS','exam_id','UPSA'),marks=d.marks('UPSA','C4');
 const reviews=d.read('CLASS_REVIEWS').filter(r=>r.exam_id==='UPSA'&&r.class_id==='C4'&&r.record_type==='STUDENT');
 assert.equal(context.coverage_(d,exam,null,marks.slice(1),reviews,context.subjectsExam_(d,'UPSA',4)).valid,false);
});
test('Each WAL flush interruption recovers safely without duplicate state rows',()=>{
 for(let barrier=1;barrier<=4;barrier++){
  const d=db(),key='crash-barrier-'+barrier;d.setState(key,{barrier});
  let calls=0;const original=context.SpreadsheetApp.flush;context.SpreadsheetApp.flush=()=>{if(++calls===barrier)throw new Error('injected interruption');};
  assert.throws(()=>context.commit_(d,crypto.randomUUID().replaceAll('-',''),admin,{barrier},{}));context.SpreadsheetApp.flush=original;
  context.recover_(book);context.recover_(book);
  if(barrier===1)assert.equal(db().state(key),null);else assert.equal(db().state(key).barrier,barrier);
  assert.ok(db().read('_STATE').filter(r=>r.state_id===key).length<=1);
 }
});
test('Admin health, prepared exam state and grade-row payload boundaries',()=>{
 assert.throws(()=>context.health_(db(),ct));assert.ok(Array.isArray(context.health_(db(),admin).issues));
 const exam=db().find('EXAMS','exam_id','UPSA');assert.throws(()=>context.examSave_(db(),admin,{record:{...exam,status:'DRAFT'}},'demote'),/DRAFT/);
 const d=db(),old=db().read('GRADE_RULES').map(r=>({...r,_row:2}));context.gradesSave_(d,admin,{version:'v-safe',rules:old},'safe-rules');
 const staged=Object.values(d.staged).filter(p=>p.table==='GRADE_RULES');assert.equal(staged.length,6);assert.ok(staged.every(p=>p.row>db().read('GRADE_RULES').length+1));
});
test('Corrupt PREPARED piece fails closed until the original journal is restored',()=>{
 const d=db();d.setState('corrupt-recovery-fixture',{ok:true});let count=0;const original=context.SpreadsheetApp.flush;context.SpreadsheetApp.flush=()=>{if(++count===2)throw new Error('crash');};
 assert.throws(()=>context.commit_(d,crypto.randomUUID().replaceAll('-',''),admin,{},{}));context.SpreadsheetApp.flush=original;
 const start=Number(props.RECOVERY_ROW),sheet=book.sheets._OPS,saved=sheet.cells[start][0];sheet.cells[start][0]='wrong-operation';
 assert.throws(()=>context.recover_(book));assert.equal(Number(props.RECOVERY_ROW),start);assert.equal(db().state('corrupt-recovery-fixture'),null);
 sheet.cells[start][0]=saved;context.recover_(book);assert.equal(db().state('corrupt-recovery-fixture').ok,true);
});
test('Archive rejects incomplete exams and next year before archive', () => {
  assert.throws(() => context.archiveQueue_(db(), admin, {
    year: '2027',
    confirmed: true
  }, 'bad'));
  assert.throws(() => context.newYear_(db(), admin, {
    year: '2028',
    confirmed: true
  }, 'bad'));
});
test('Archive copy verifies hashes and next year preserves IDs without promoting', () => {
  mutate(d=>d.put('STUDENTS',{student_id:'000001',full_name:'Leading-zero synthetic pupil',student_status:'ACTIVE'}));
  const books = {
      'test': book
    },
    files = {},
    folders = {};
  let count = 0;
  const iterator = values => {
    let i = 0;
    return {
      hasNext: () => i < values.length,
      next: () => values[i++]
    };
  };

  function fileFor(id) {
    return files[id] || (files[id] = {
      id,
      name: id,
      parent: null,
      getId() {
        return this.id;
      },
      getName() {
        return this.name;
      },
      moveTo(parent) {
        this.parent = parent.id;
        return this;
      }
    });
  }

  function folder(id) {
    return folders[id] || (folders[id] = {
      id,
      getFoldersByName(name) {
        return iterator(Object.values(folders).filter(f => f.parent === id && f.name === name));
      },
      createFolder(name) {
        const f = folder('folder' + (++count));
        f.parent = id;
        f.name = name;
        return f;
      },
      getFilesByName(name) {
        return iterator(Object.values(files).filter(f => f.parent === id && f.name === name));
      },
      createFile(name, content) {
        const f = fileFor('manifest' + (++count));
        f.parent = id;
        f.name = name;
        f.content = content;
        return f;
      }
    });
  }
  context.DriveApp = {
    getFolderById: folder,
    getFileById: fileFor
  };
  context.MimeType.PLAIN_TEXT = 'text/plain';
  context.SpreadsheetApp.create = name => {
    const b = new Book(),
      id = 'book' + (++count);
    b.getId = () => id;
    b.getUrl = () => `test://${id}`;
    books[id] = b;
    fileFor(id).name = name;
    return b;
  };
  context.SpreadsheetApp.openById = id => books[id] || book;
  mutate(d => {
    d.put('EXAMS', {
      exam_id: 'UASA',
      academic_year: '2027',
      exam_type: 'UASA',
      status: 'CLOSED'
    });
    d.read('EXAMS').forEach(e => {
      e.status = 'CLOSED';
      d.put('EXAMS', e);
    });
    d.read('CLASS_REVIEWS').filter(r => r.record_type === 'CLASS').forEach(m => {
      m.finalized_at = '2027-12-01T00:00:00Z';
      m.pdf_status = 'COMPLETED';
      d.put('CLASS_REVIEWS', m);
    });
  });
  mutate(d => context.archiveQueue_(d, admin, {
    year: '2027',
    confirmed: true
  }, 'archive'));
  context.archiveStep_();
  const archived = db().state('archive:2027');
  assert.equal(archived.status, 'COMPLETED');
  assert.ok(archived.manifest.MARKS.rows > 0);
  assert.equal(books[archived.file_id].getSheetByName('USERS').getRange(2, 5, 1, 1).getValues()[0][0],
    '');
  assert.equal(db().find('EXAMS', 'exam_id', 'UPSA').status, 'ARCHIVED');
  const result = mutate(d => context.newYear_(d, admin, {
    year: '2028',
    confirmed: true
  }, 'new-year-test'));
  const next = new context.Db_(books[result.spreadsheet]);
  assert.equal(next.read('STUDENTS').length, db().read('STUDENTS').length);
  assert.equal(next.read('STUDENTS')[0].student_id, db().read('STUDENTS')[0].student_id);
  assert.ok(next.read('USERS').some(u=>u.identification_code==='025849'));
  assert.ok(next.read('STUDENTS').some(s=>s.student_id==='000001'));
  assert.equal(next.read('ENROLMENTS').length, 0);
  assert.equal(next.read('MARKS').length, 0);
  assert.equal(next.read('ASSIGNMENTS').length, 0);
});
module.exports={context,book,props,db,admin,teacher,ct,mutate,Sheet,Book,test,tests,plain};
if(require.main===module)(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
      console.log('PASS ' + name);
    } catch (e) {
      console.error('FAIL ' + name);
      console.error(e.stack);
      process.exitCode = 1;
    }
  }
  console.log(
    `${passed}/${tests.length} tests passed (isolated Google-service mocks; not live integration).`);
})();
