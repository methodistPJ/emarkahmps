import {
  fileURLToPath
} from 'node:url';
const {
  chromium
} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(process.env.MPS_SOURCE||path.join(path.dirname(fileURLToPath(import.meta.url)),'../src'));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true
});
const page = await browser.newPage({
  viewport: {
    width: 1440,
    height: 1000
  }
});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => {
  const rules = [
    [0, 19, 'F'],
    [20, 34, 'E'],
    [35, 49, 'D'],
    [50, 65, 'C'],
    [66, 81, 'B'],
    [82, 100, 'A']
  ].map(([minimum_score, maximum_score, grade]) => ({
    minimum_score,
    maximum_score,
    grade
  }));
  const user = {
    user_id: 'test-user',
    full_name: 'Isolated Browser Fixture',
    roles: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ADMINISTRATOR']
  };
  const exam = {
      exam_id: 'E',
      exam_type: 'UPSA',
      academic_year: '2027',
      status: 'OPEN',
      closing_date: '2099-01-01T00:00:00Z'
    },
    cls = {
      class_id: 'C',
      class_name: 'Fixture Class',
      academic_stage: 2,
      year_level: 4
    },
    subjects = [{
      subject_code: 'BM',
      subject_name: 'Bahasa Melayu'
    }, {
      subject_code: 'PI',
      subject_name: 'Pendidikan Islam'
    }];
  let marks = [{
    mark_id: 'm1',
    student_id: 's1',
    subject_code: 'BM',
    student_name_snapshot: 'Test Student A',
    mark_status: 'SCORED',
    score: 0,
    grade: 'F',
    record_version: 1
  }, {
    mark_id: 'm2',
    student_id: 's2',
    subject_code: 'BM',
    student_name_snapshot: 'Test Student B',
    mark_status: 'EMPTY',
    score: '',
    grade: '',
    record_version: 1
  }, {
    mark_id: 'p1',
    student_id: 's1',
    subject_code: 'PI',
    student_name_snapshot: 'Test Student A',
    mark_status: 'TB',
    score: '',
    grade: '',
    record_version: 1
  }, {
    mark_id: 'p2',
    student_id: 's2',
    subject_code: 'PI',
    student_name_snapshot: 'Test Student B',
    mark_status: 'TH',
    score: '',
    grade: '',
    record_version: 1
  }];
  let sub = {
      submission_status: 'DRAFT'
    },
    metadata = {
      record_type: 'CLASS',
      pdf_status: 'NONE',
      finalized_at: '',
      class_finalization_revision: 0
    };
  let students = [{
    record_type: 'STUDENT',
    student_id: 's1',
    student_name_snapshot: 'Test Student A',
    record_version: 1,
    class_teacher_remark: ''
  }, {
    record_type: 'STUDENT',
    student_id: 's2',
    student_name_snapshot: 'Test Student B',
    record_version: 1,
    class_teacher_remark: ''
  }];
  window.__requests = [];
  window.__envelopes = [];
  window.__failSave = false;
  window.__conflict = false;
  const stats = rows => ({
    status: {
      SCORED: rows.filter(m => m.mark_status === 'SCORED').length,
      TH: rows.filter(m => m.mark_status === 'TH').length,
      TB: rows.filter(m => m.mark_status === 'TB').length,
      EMPTY: rows.filter(m => m.mark_status === 'EMPTY').length
    },
    grades: {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 1
    },
    average: 0,
    percentages: {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 100
    },
    denominator: 'SCORED sahaja'
  });
  const dispatch = (action, p) => {
    window.__requests.push({
      action,
      payload: p
    });
    switch (action) {
      case 'public':
        return {
          school: 'Fixture school', year: '2027', students: null, classes: null, subjects: 14, exam: {
            type: 'UPSA',
            status: 'OPEN'
          }
        };
      case 'challenge':
        return {
          salt: 'test-salt', iterations: 1000
        };
      case 'login':
        return {
          token: 'x'.repeat(43), expires: Date.now() + 3600000, user
        };
      case 'dashboard':
        return {
          user, exams: [exam], tasks: [{
            exam,
            class: cls,
            assignment: {
              subject_code: 'BM'
            },
            stats: stats(marks),
            submission: sub,
            metadata
          }, {
            exam,
            class: cls,
            assignment: {
              subject_code: '',
              assignment_type: 'CLASS_TEACHER'
            },
            stats: stats(marks),
            metadata
          }]
        };
      case 'marksGet':
        return {
          marks: marks.filter(m => m.subject_code === p.subject_code), rules, subjects, submission: sub,
            metadata
        };
      case 'saveMarks':
        if (window.__failSave) throw new Error('network');
        if (window.__conflict) return {
          error: {
            code: 'CONFLICT',
            message: 'Markah berubah.',
            details: {
              mark_id: 'm2',
              current: {
                score: 77,
                record_version: 2
              }
            }
          }
        };
        const changed = p.changes.map(c => {
          const m = marks.find(m => m.mark_id === c.mark_id),
            value = String(c.value).trim();
          Object.assign(m, {
            mark_status: value === '' ? 'EMPTY' : ['TH', 'TB'].includes(value) ? value :
              'SCORED',
            score: /^\d+$/.test(value) ? Number(value) : '',
            record_version: Number(m.record_version) + 1,
            grade: /^\d+$/.test(value) ? rules.find(r => Number(value) >= r.minimum_score &&
              Number(value) <= r.maximum_score).grade : ''
          });
          return m;
        });
        return {
          marks: changed
        };
      case 'submit':
        sub = {
          submission_status: 'SUBMITTED'
        };
        return sub;
      case 'reviewGet':
        return {
          class: cls, exam, marks, rules, subjects, reviews: [metadata, ...students], submissions:
            subjects.map(s => ({
              subject_code: s.subject_code,
              submission_status: 'SUBMITTED'
            })), editable: true, readiness: {
              students: 2,
              empty: marks.filter(m => m.mark_status === 'EMPTY').length,
              missingRemarks: students.filter(s => !s.class_teacher_remark).length,
              missingSubmissions: [],
              amendments: 0,
              tb: 1,
              ready: students.every(s => s.class_teacher_remark) && marks.every(m => m.mark_status !==
                'EMPTY'),
              revisionHash: 'fixture-revision'
            }
        };
      case 'remarkSave':
        return {
          reviews: p.changes.map(c => {
            const s = students.find(s => s.student_id === c.student_id);
            s.class_teacher_remark = c.remark;
            s.record_version++;
            return s;
          })
        };
      case 'finalize':
        metadata = {
          ...metadata,
          finalized_at: new Date().toISOString(),
          pdf_status: 'QUEUED'
        };
        return {
          pdf_status: 'QUEUED'
        };
      case 'schoolReadiness':return {academic_year:'2027',classes:0,students:0,active_enrolments:0,teachers:0,subjects:14,class_teachers:0,subject_teachers:0,pending_activation:[],warnings:[],missing:[],exams:[],ready:false};
      case 'sessionContext': return {user,exams:[exam],classes:[cls]};
      case 'health': return {release:'fixture',academic_year:'2027',queue_triggers:1,worker:{},issues:[],boundaries:'Synthetic fixture'};
      case 'audit':return [];
      case 'adminData':
        return {
          settings: {
              year: '2027'
            }, CLASSES: [cls], STUDENTS: [], ENROLMENTS: [], USERS: [], ASSIGNMENTS: [], SUBJECTS:
            subjects, EXAMS: [exam], GRADE_RULES: rules
        };
      case 'jobs':
        return [];
      case 'analytics':
        return {
          mode: p.mode, exam, summary: stats(marks), subjects: [{
            subject: 'BM',
            stats: stats(marks.filter(m => m.subject_code === 'BM'))
          }], groups: [], dataset: []
        };
      case 'logout':
        return {};
      default:
        return {};
    }
  };
  window.google = {
    script: {
      run: {
        withSuccessHandler(success) {
          return {
            withFailureHandler(failure) {
              return {
                rpc(e) {
                  window.__envelopes.push(structuredClone(e));
                  setTimeout(() => {
                    try {
                      const d = dispatch(e.action, e.payload);
                      success(d?.error ? {
                        ok: false,
                        error: d.error
                      } : {
                        ok: true,
                        data: structuredClone(d)
                      });
                    } catch (err) {
                      failure(err);
                    }
                  }, 20);
                }
              };
            }
          };
        }
      }
    }
  };
});
try {
  await page.goto('file://' + (path.join(root, 'Workspace.html')));
  fs.mkdirSync(path.resolve(root, '../tests/artifacts'), {
    recursive: true
  });
  await page.screenshot({
    path: path.resolve(root, '../tests/artifacts/landing.png'),
    fullPage: true
  });
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#login-form input[name=code]').fill('000123');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#login-form input[name=pin]').fill('Test-only-secret-123');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#login-form button').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-task="0"]').waitFor();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-task="0"]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('.mark-input').nth(1).fill('100');
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent ===
    'Semua perubahan disimpan.');
  assert.equal(await page.locator('.grade-preview').nth(1).textContent(), 'A');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('.mark-input').nth(1).press('ArrowUp');
  assert.equal(await page.locator('.mark-input').first().evaluate(el => document.activeElement === el), true);
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#mark-search').fill('Student A');
  assert.equal(await page.locator('#marks-body tr:visible').count(), 1);
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#mark-search').fill('');
  await page.evaluate(() => window.__failSave = true);
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('.mark-input').nth(1).fill('83');
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent.includes('terputus'));
  assert.equal(await page.evaluate(() => Object.values(sessionStorage).some(v => v.includes('"value":"83"'))),
    true);
  await page.evaluate(() => window.__failSave = false);
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#retry-save').click();
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent ===
    'Semua perubahan disimpan.');
  const saves = await page.evaluate(() => window.__envelopes.filter(e => e.action === 'saveMarks'));
  assert.equal(saves.at(-1).request_id, saves.at(-2).request_id, 'Network retry must preserve request ID');
  await page.evaluate(() => window.__conflict = true);
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('.mark-input').nth(1).fill('91');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#discard-conflict').waitFor();
  await page.evaluate(() => window.__conflict = false);
  page.once('dialog', d => d.accept());
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#discard-conflict').click();
  await page.waitForFunction(() => document.querySelectorAll('.mark-input')[1]?.value === '83');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#submit-marks').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#confirm-submit').waitFor();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#confirm-submit').click();
  await page.waitForFunction(() => document.querySelector('.mark-input')?.readOnly);
  assert.equal(await page.locator('.mark-input').first().getAttribute('readonly'), '');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-route=dashboard]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-task="1"]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-section=remarks]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-remark]').first().fill('Reviewed fixture remark.');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-remark]').nth(1).fill('Second reviewed fixture remark.');
  await page.waitForFunction(() => document.querySelector('#save-status')?.textContent ===
    'Ulasan disimpan.');
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-section=verification]').click();
  page.once('dialog', d => d.accept());
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#finalize-class').click();
  await page.waitForFunction(() => document.querySelector('#readiness')?.textContent.includes('QUEUED'));
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-route=analytics]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#analytics-form button').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#analytics-output svg').first().waitFor();
  assert.ok(await page.locator('#analytics-output').textContent());
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-route=admin]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#entity-form').waitFor();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  for(const table of ['STUDENTS','ENROLMENTS','ASSIGNMENTS','SUBJECTS','EXAMS','USERS','CLASSES']){
    await page.locator('[data-admin-table="'+table+'"]').click();
    await page.locator('#entity-form').waitFor();
    await page.locator('#new-record').click();
    if(table==='ASSIGNMENTS')assert.equal(await page.locator('select[name=class_id]').count(),1);
    if(table==='USERS'){await page.locator('[name=identification_code]').fill('025849');assert.equal(await page.locator('[name=identification_code]').inputValue(),'025849');}
  }
  await page.locator('#grades-tab').click();await page.locator('#grade-form').waitFor();
  await page.locator('#import-tab').click();await page.locator('#legacy-import').click();await page.locator('#import-roster').click();
  assert.ok((await page.locator('#notification').textContent()).includes('Pilih CSV'));
  await page.locator('#audit-tab').click();await page.getByRole('heading',{name:'Audit — 500 peristiwa terkini'}).waitFor();
  await page.locator('#health-tab').click();await page.getByRole('heading',{name:'Kesihatan Sistem'}).waitFor();
  await page.locator('#operations-tab').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('#archive-year').waitFor();
  await page.setViewportSize({width:820,height:1180});
  await page.locator('[data-route=dashboard]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-task="0"]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:path.resolve(root,'../tests/artifacts/ipad.png'),fullPage:true});
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-route=dashboard]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  await page.locator('[data-task="0"]').click();
  await page.locator('#mps-loader').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    true);
  assert.deepEqual(errors, []);
  fs.mkdirSync(path.resolve(root, '../tests/artifacts'), {
    recursive: true
  });
  await page.screenshot({
    path: path.resolve(root, '../tests/artifacts/mobile.png'),
    fullPage: true
  });
  await page.setViewportSize({
    width: 1440,
    height: 1000
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve(root, '../tests/artifacts/desktop.png'),
    fullPage: false
  });
  console.log(
    'PASS browser: login, provisional grade, keyboard, search, interrupted save recovery, submission lock, remarks, class finalization, analytics, admin, responsive layout; isolated fixtures.'
  );
} finally {
  await browser.close();
}
