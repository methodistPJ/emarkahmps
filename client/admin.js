(function(M) {
  const fields = {
    CLASSES: [
      ['class_id', 'ID kelas (kosong untuk baharu)'],
      ['class_name', 'Nama kelas'],
      ['academic_year', 'Tahun akademik', 'number'],
      ['year_level', 'Tahun murid', 'number'],
      ['active', 'Aktif', 'checkbox']
    ],
    STUDENTS: [
      ['student_id', 'ID murid (kosong untuk baharu)'],
      ['full_name', 'Nama penuh'],
      ['student_status', 'Status', 'select', ['ACTIVE', 'LEFT', 'GRADUATED']]
    ],
    ENROLMENTS: [
      ['student_id', 'ID murid'],
      ['class_id', 'ID kelas'],
      ['start_date', 'Tarikh mula', 'date'],
      ['status', 'Status', 'select', ['ACTIVE', 'ENDED']]
    ],
    ASSIGNMENTS: [
      ['assignment_id', 'ID tugasan (kosong untuk baharu)'],
      ['user_id', 'ID guru'],
      ['class_id', 'ID kelas'],
      ['subject_code', 'Kod subjek'],
      ['assignment_type', 'Jenis tugasan', 'select', ['SUBJECT_TEACHER', 'CLASS_TEACHER']],
      ['active', 'Aktif', 'checkbox']
    ],
    SUBJECTS: [
      ['subject_code', 'Kod subjek'],
      ['subject_name', 'Nama subjek'],
      ['offered_year_levels', 'Tahun ditawarkan (contoh: 1,2,3)'],
      ['display_order', 'Susunan', 'number'],
      ['default_status', 'Status awal', 'select', ['EMPTY', 'TB']],
      ['active', 'Aktif', 'checkbox']
    ],
    EXAMS: [
      ['exam_id', 'ID peperiksaan (kosong untuk baharu)'],
      ['academic_year', 'Tahun akademik', 'number'],
      ['exam_type', 'Jenis', 'select', ['UPSA', 'UASA']],
      ['opening_date', 'Mula (waktu Malaysia)', 'datetime-local'],
      ['closing_date', 'Akhir (waktu Malaysia)', 'datetime-local'],
      ['status', 'Status', 'select', ['DRAFT', 'OPEN', 'CLOSED', 'FINALIZED']],
      ['grading_version', 'Versi gred'],
      ['template_version', 'Versi template']
    ],
    USERS: [
      ['user_id', 'ID akaun (kosong untuk baharu)'],
      ['full_name', 'Nama guru'],
      ['identification_code', 'Enam digit pengenalan'],
      ['account_alias', 'Alias unik jika pengenalan bertindih'],
      ['pin', 'PIN baharu (10–64 aksara; kosong untuk kekalkan)', 'password'],
      ['active', 'Aktif', 'checkbox'],
      ['revoke', 'Batalkan sesi terdahulu', 'checkbox']
    ]
  };
  M.openAdmin = async () => {
    await M.guard();
    if (!M.user.roles.includes('ADMINISTRATOR')) throw new Error('Akses pentadbir diperlukan.');
    const d=await M.call('adminData');let dash={tasks:[]},jobs=[];
    let table = 'CLASSES';
    document.querySelector('#content').innerHTML =
      `<p class="eyebrow">ADMINISTRATION</p><h2>Keep everything <em>on track.</em></h2><p>Tahun aktif ${M.esc(d.settings.year)}. Tetapan ID Google, nama sekolah dan Guru Besar berada dalam Script Properties.</p><div class="metrics"><div class="metric"><strong>${d.ENROLMENTS.filter(n=>String(n.academic_year)===String(d.settings.year)&&n.status==='ACTIVE').length}</strong><span>Murid aktif</span></div><div class="metric"><strong>${d.CLASSES.filter(c=>String(c.academic_year)===String(d.settings.year)).length}</strong><span>Kelas tahun aktif</span></div><div class="metric"><strong>${d.ASSIGNMENTS.filter(a=>a.active===true).length}</strong><span>Tugasan aktif</span></div><div class="metric"><strong>${d.EXAMS.filter(e=>e.status==='FINALIZED').length}</strong><span>Peperiksaan dimuktamadkan</span></div></div><div class="tabs">${Object.keys(fields).map(t=>`<button data-admin-table="${t}">${M.esc({CLASSES:'Kelas',STUDENTS:'Murid',ENROLMENTS:'Enrolmen',ASSIGNMENTS:'Tugasan Guru',SUBJECTS:'Subjek',EXAMS:'Peperiksaan',USERS:'Akaun Guru'}[t])}</button>`).join('')}<button id="grades-tab">Aturan Gred</button><button id="import-tab">Import</button><button id="operations-tab">Pemantauan & Arkib</button><button id="audit-tab">Audit</button><button id="health-tab">Kesihatan Sistem</button></div><div id="admin-section"></div>`;
    const section = document.querySelector('#admin-section');
    M.refreshAdminData=async()=>{const fresh=await M.call('adminData');Object.assign(d,fresh);const nodes=document.querySelectorAll('#content > .metrics .metric strong'),year=String(d.settings.year),values=[d.ENROLMENTS.filter(x=>String(x.academic_year)===year&&x.status==='ACTIVE').length,d.CLASSES.filter(x=>String(x.academic_year)===year).length,d.ASSIGNMENTS.filter(x=>String(x.academic_year)===year&&x.active===true).length,d.EXAMS.filter(x=>x.status==='FINALIZED').length];nodes.forEach((node,i)=>node.textContent=values[i]);};
    document.querySelector('#health-tab').onclick=()=>M.run(async()=>{const h=await M.call('health');section.innerHTML='<h3>Kesihatan Sistem</h3><p>Versi '+M.esc(h.release)+' · Tahun '+M.esc(h.academic_year)+'</p><p>Trigger: '+h.queue_triggers+' · Worker terakhir: '+M.esc(h.worker?.last_completed||'Belum tersedia')+'</p><p>'+M.esc(h.issues.join('; ')||'Tiada isu konfigurasi dikesan.')+'</p><p class="muted">'+M.esc(h.boundaries)+'</p>';});
    const edit = (record = {}) => {
      const defs = fields[table];
      section.innerHTML =
        `<h3>${M.esc(table)}</h3><p>Gunakan ID sedia ada untuk mengemas kini. Senarai di bawah boleh dipilih untuk menyunting.</p><form id="entity-form" class="admin-form"><div class="grid">${defs.map(([k,label,type='text',options])=>`<label>${M.esc(label)}${type==='select'?`<select name="${k}">${options.map(o=>`<option ${record[k]===o?'selected':''}>${o}</option>`).join('')}</select>`:type==='checkbox'?`<input name="${k}" type="checkbox" ${(record[k]===true||record[k]===undefined&&k==='active')?'checked':''}>`:`<input name="${k}" type="${type}" value="${M.esc(type==='password'?'':type==='datetime-local'&&record[k]?new Date(Date.parse(record[k])+8*3600000).toISOString().slice(0,16):record[k]??(k==='academic_year'?d.settings.year:k==='grading_version'?'v1':k==='template_version'?'replacement-v1':''))}">`}</label>`).join('')}</div>${table==='USERS'?`<fieldset><legend>Peranan (boleh lebih daripada satu)</legend>${['SUBJECT_TEACHER','CLASS_TEACHER','ADMINISTRATOR'].map(r=>`<label><input type="checkbox" name="roles" value="${r}" ${JSON.parse(record.roles||'[]').includes(r)?'checked':''}> ${r}</label>`).join('')}</fieldset>`:''}<button>Simpan</button><button type="button" class="secondary" id="new-record">Rekod Baharu</button></form><h3>Senarai Sedia Ada</h3><div class="table-scroll"><table><thead><tr>${defs.filter(x=>!['pin','revoke'].includes(x[0])).map(x=>`<th>${M.esc(x[1])}</th>`).join('')}<th>Tindakan</th></tr></thead><tbody>${d[table].map((r,i)=>`<tr>${defs.filter(x=>!['pin','revoke'].includes(x[0])).map(x=>`<td>${M.esc(r[x[0]])}</td>`).join('')}<td><button data-edit="${i}">Pilih</button>${table==='EXAMS'&&r.status==='DRAFT'?`<button data-prepare="${M.esc(r.exam_id)}">Sediakan Peperiksaan</button>`:''}${table==='ENROLMENTS'&&r.status==='ACTIVE'?`<button data-end="${M.esc(r.enrolment_id)}">Tamatkan Enrolmen</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
      document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => edit(d[table][Number(b
        .dataset.edit)]));
      document.querySelector('#new-record').onclick = () => edit();
      M.namedSelectors(d,record,table);
      document.querySelectorAll('[data-prepare]').forEach(b => b.onclick = () => M.run(async () => {
        if (!confirm(
            'Bekukan senarai murid dan subjek semasa, kemudian sediakan markah peperiksaan ini?'
          )) return;
        await M.call('prepareExam', {
          exam_id: b.dataset.prepare
        }, true);
        await M.openAdmin();
      }));
      document.querySelectorAll('[data-end]').forEach(b => b.onclick = () => M.run(async () => {
        const end_date = prompt('Tarikh tamat YYYY-MM-DD'),
          reason = prompt('Sebab tamat atau berpindah kelas');
        if (!end_date || !reason) return;
        await M.call('enrolmentEnd', {
          enrolment_id: b.dataset.end,
          end_date,
          reason
        }, true);
        await M.openAdmin();
      }));
      document.querySelector('#entity-form').onsubmit = e => {
        e.preventDefault();
        M.run(async () => {
          const f = new FormData(e.target),
            r = Object.fromEntries(f);
          defs.forEach(([k, , type]) => {
            if (type === 'checkbox') r[k] = f.has(k);
            if (type === 'number') r[k] = Number(r[k]);
            if (type === 'datetime-local' && r[k]) r[k] = new Date(r[k] + ':00+08:00')
              .toISOString();
          });
          if (table === 'SUBJECTS') r.offered_year_levels = JSON.stringify(String(r
            .offered_year_levels).replace(/[\[\]]/g, '').split(',').map(Number));
          if (table === 'USERS') {
            r.roles = f.getAll('roles');
            if (r.pin) {
              const challenge = await M.call('challenge', {
                code: r.identification_code,
                alias: r.account_alias
              });
              r.salt = challenge.salt;
              r.proof = await M.proof(r.pin, r.salt, challenge.iterations);
            }
            delete r.pin;
            await M.call('userSave', r, true);
          } else await M.call(table === 'EXAMS' ? 'examSave' : 'entitySave', {
            table,
            record: r
          }, true);
          await M.openAdmin();
          M.notice('Rekod disimpan.');
        });
      };
    };
    document.querySelectorAll('[data-admin-table]').forEach(b => b.onclick = () => {
      table = b.dataset.adminTable;
      edit();
    });
    edit();
    document.querySelector('#grades-tab').onclick = () => {
      section.innerHTML =
        `<h3>Aturan Gred Berpusat</h3><p>Versi sedia ada tidak diubah. Cipta versi untuk peperiksaan baharu.</p><form id="grade-form"><label>Nama versi<input name="version" required></label><table><thead><tr><th>Gred</th><th>Minimum</th><th>Maksimum</th></tr></thead><tbody>${[['F',0,19],['E',20,34],['D',35,49],['C',50,65],['B',66,81],['A',82,100]].map(([g,min,max])=>`<tr><td>${g}</td><td><input name="${g}-min" type="number" value="${min}" required></td><td><input name="${g}-max" type="number" value="${max}" required></td></tr>`).join('')}</tbody></table><button>Simpan Versi Baharu</button></form><p>Versi sedia ada: ${[...new Set(d.GRADE_RULES.map(r=>r.grading_version))].map(M.esc).join(', ')}</p>`;
      document.querySelector('#grade-form').onsubmit = e => {
        e.preventDefault();
        M.run(async () => {
          const f = new FormData(e.target);
          await M.call('gradesSave', {
            version: f.get('version'),
            rules: ['F', 'E', 'D', 'C', 'B', 'A'].map(g => ({
              grade: g,
              minimum_score: Number(f.get(g + '-min')),
              maximum_score: Number(f.get(g + '-max')),
              description: ''
            }))
          }, true);
          await M.openAdmin();
        });
      };
    };
    const legacyImport = () => {
      section.innerHTML =
        `<h3>Import Senarai Murid</h3><p>CSV header: full_name,student_id,class_id,start_date. student_id kosong untuk murid baharu; padankan ID lama secara nyata. Tahun tidak dinaikkan secara automatik.</p><input id="roster-file" type="file" accept=".csv" aria-label="CSV murid"><button id="import-roster">Semak & Import CSV</button><div id="roster-preview"></div><h3>Migrasi Excel Lama</h3><p>Gunakan tools/legacy_import.py untuk menghasilkan JSON semakan daripada Excel asal atau CSV kelas. Muat naik JSON tersebut. Data disimpan dalam workbook sejarah berasingan.</p><input id="historical-file" type="file" accept=".json" aria-label="Fail migrasi disemak"><div id="migration-preview"></div>`;
      document.querySelector('#import-roster').onclick = () => M.run(async () => {
        const file = document.querySelector('#roster-file').files[0];
        if (!file) throw new Error('Pilih CSV.');
        const parsed = M.parseCSV(await file.text()),
          headers = parsed.shift().map(x => x.trim()),
          rows = parsed.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ||
            ''
          ])));
        document.querySelector('#roster-preview').textContent =
          `${rows.length} murid: ${rows.slice(0,8).map(r=>r.full_name).join(', ')}.`;
        if (!confirm(`Import ${rows.length} rekod yang telah dipadankan ID dan kelas?`)) return;
        for (let i = 0; i < rows.length; i += 100) await M.call('rosterImport', {
          rows: rows.slice(i, i + 100)
        }, true);
        M.notice('Senarai murid diimport.');
      });
      document.querySelector('#historical-file').onchange = e => M.run(async () => {
        const doc = JSON.parse(await e.target.files[0].text()),
          blank = doc.students.flatMap(s => Object.entries(s.marks).filter(([, m]) => m
            .value === null).map(([subject, m]) => ({
            ref: s.source_sheet + '!' + m.cell,
            subject,
            name: s.name
          })));
        document.querySelector('#migration-preview').innerHTML =
          `<p>${doc.students.length} murid sejarah; ${blank.length} kosong memerlukan keputusan jelas. ${doc.discrepancies?.length||0} percanggahan gred.</p><details><summary>Semak percanggahan gred</summary><pre>${M.esc(JSON.stringify(doc.discrepancies,null,2))}</pre></details><label>Status pilihan untuk kosong PI/PM/BA/BC/BT<select id="bulk-migration-status"><option value="">Belum diputuskan</option><option value="TB">TB selepas semakan</option><option value="EMPTY">Kekalkan EMPTY selepas semakan</option></select></label><button id="bulk-migration">Terapkan keputusan kepada kosong subjek pilihan</button><div class="table-scroll"><table><thead><tr><th>Rujukan</th><th>Murid</th><th>Subjek</th><th>Keputusan</th></tr></thead><tbody>${blank.map(b=>`<tr><td>${M.esc(b.ref)}</td><td>${M.esc(b.name)}</td><td>${M.esc(b.subject)}</td><td><select data-decision="${M.esc(b.ref)}" data-subject="${M.esc(b.subject)}"><option value="">Belum disemak</option><option>EMPTY</option><option>TB</option><option>TH</option></select></td></tr>`).join('')}</tbody></table></div><button id="confirm-migration">Import Sejarah Disemak</button>`;
        document.querySelector('#bulk-migration').onclick = () => {
          const value = document.querySelector('#bulk-migration-status').value;
          if (value && confirm(
              'Anda telah menyemak semua kosong subjek pilihan dan mahu menggunakan keputusan ini?'
            )) document.querySelectorAll('[data-decision]').forEach(s => {
            if (['PI', 'PM', 'BA', 'BC', 'BT'].includes(s.dataset.subject)) s.value =
              value;
          });
        };
        document.querySelector('#confirm-migration').onclick = () => M.run(async () => {
          const decisions = {};
          for (const s of document.querySelectorAll('[data-decision]')) {
            if (!s.value) throw new Error('Semak semua kosong dahulu.');
            decisions[s.dataset.decision] = s.value;
          }
          if (!confirm(
              'Import ke workbook sejarah berasingan, dengan nilai asal kekal dalam jejak migrasi?'
            )) return;
          const result = await M.call('historicalImport', {
            document: doc,
            decisions,
            confirmed: true
          }, true);
          M.notice('Migrasi selesai dalam workbook berasingan: ' + result.file_id);
        });
      });
    };
    document.querySelector('#import-tab').onclick=()=>M.run(()=>M.openSchoolImport(legacyImport));
    document.querySelector('#audit-tab').onclick = () => M.run(async () => {
      const rows = await M.call('audit');
      section.innerHTML =
        `<h3>Audit — 500 peristiwa terkini</h3><div class="table-scroll"><table><thead><tr><th>Masa</th><th>Pelaku</th><th>Tindakan</th><th>Rekod</th><th>Sebab</th><th>Butiran</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${M.date(r.timestamp)}</td><td>${M.esc(r.actor_id)}</td><td>${M.esc(r.action)}</td><td>${M.esc(r.entity_id)}</td><td>${M.esc(r.reason)}</td><td><details><summary>Sebelum / Selepas</summary><pre>${M.esc(r.old_value)}\n${M.esc(r.new_value)}</pre></details></td></tr>`).join('')}</tbody></table></div>`;
    });
    document.querySelector('#operations-tab').onclick = () => M.run(async()=>{
      [dash,jobs]=await Promise.all([M.call('dashboard'),M.call('jobs')]);
      section.innerHTML =
        `<h3>Pemantauan Peperiksaan</h3><div class="toolbar"><label>Tapis kelas, tahun, tahap, subjek, guru atau status<input id="monitor-filter" placeholder="Carian"></label></div><div class="table-scroll"><table><thead><tr><th>Peperiksaan</th><th>Kelas / Tahap</th><th>Angka / TH / TB / EMPTY</th><th>Penghantaran</th><th>PDF</th><th>Tindakan</th></tr></thead><tbody>${dash.tasks.map(t=>{const subs=d.ASSIGNMENTS.filter(a=>a.class_id===t.class.class_id);const terms=[t.exam.exam_type,t.class.class_name,t.class.year_level,'Tahap '+t.class.academic_stage,...subs.flatMap(a=>[a.subject_code,d.USERS.find(u=>u.user_id===a.user_id)?.full_name])].join(' ');return `<tr data-monitor="${M.esc(terms.toLowerCase())}"><td>${M.esc(t.exam.exam_type+' '+t.exam.academic_year)}</td><td>${M.esc(t.class.class_name)} / ${t.class.academic_stage}</td><td>${Object.values(t.stats.status).join(' / ')}</td><td>${t.metadata?.finalized_at?'Muktamad':'Dalam semakan'}</td><td>${M.esc(t.metadata?.pdf_status||'NONE')} ${M.esc(t.metadata?.job_error||'')}</td><td><button data-monitor-review="${M.esc(t.exam.exam_id)}" data-class="${M.esc(t.class.class_id)}">Semak</button><button data-reopen="${M.esc(t.exam.exam_id)}" data-class="${M.esc(t.class.class_id)}">Buka Semula</button><button data-pdfretry="${M.esc(t.exam.exam_id)}" data-class="${M.esc(t.class.class_id)}">Cuba PDF</button></td></tr>`;}).join('')}</tbody></table></div><h3>Arkib Tahunan</h3><p>${jobs.map(j=>`${M.esc(j.year)}: ${M.esc(j.status)} ${M.esc(j.error||'')}`).join('<br>')||'Belum ada arkib.'}</p><button id="archive-year">Tutup & Arkib Tahun Akademik</button><form id="new-year-form"><label>Tahun akademik baharu<input name="year" type="number" min="2020" max="2099" required></label><button>Mulakan Tahun Akademik Baharu</button></form>`;
      document.querySelector('#monitor-filter').oninput = e => document.querySelectorAll(
        '[data-monitor]').forEach(row => row.hidden = !row.dataset.monitor.includes(e.target.value
        .toLowerCase()));
      document.querySelectorAll('[data-monitor-review]').forEach(b => b.onclick = () => M.run(() => M
        .openReview(b.dataset.monitorReview, b.dataset.class)));
      document.querySelectorAll('[data-reopen]').forEach(b => b.onclick = () => M.run(async () => {
        const subject_code = prompt(
            'Kod subjek untuk buka penghantaran; kosong untuk buka seluruh kelas'),
          reason = prompt('Sebab pembukaan semula');
        if (subject_code === null || !reason) return;
        await M.call('reopen', {
          exam_id: b.dataset.reopen,
          class_id: b.dataset.class,
          subject_code: subject_code.toUpperCase().trim(),
          reason
        }, true);
        await M.openAdmin();
      }));
      document.querySelectorAll('[data-pdfretry]').forEach(b => b.onclick = () => M.run(async () => {
        await M.call('pdfRetry', {
          exam_id: b.dataset.pdfretry,
          class_id: b.dataset.class
        }, true);
        M.notice('PDF dijadualkan semula.');
      }));
      document.querySelector('#archive-year').onclick = () => M.run(async () => {
        if (!confirm(
            'Arkib kedua-dua peperiksaan tahun aktif? Data akan dikunci sepanjang proses.'))
          return;
        await M.call('archive', {
          year: d.settings.year,
          confirmed: true
        }, true);
        await M.openAdmin();
      });
      document.querySelector('#new-year-form').onsubmit = e => {
        e.preventDefault();
        M.run(async () => {
          const year = new FormData(e.target).get('year');
          if (!confirm('Aktifkan tahun ' + year +
              ' selepas arkib selesai? Import senarai kelas dan murid sebenar selepas ini.'))
            return;
          await M.call('newYear', {
            year,
            confirmed: true
          }, true);
          await M.openAdmin();
        });
      };
    });
  };
})(window.MPS);
