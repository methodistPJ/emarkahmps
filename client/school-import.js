(function(M) {
  M.openSchoolImport = async legacy => {
    const section = document.querySelector('#admin-section');
    section.innerHTML = `<section class="setup-wizard"><p class="eyebrow">SCHOOL SETUP</p><h3>Satu Workbook. Persediaan Sekolah.</h3><p>Lengkapkan sekolah, kelas, murid, guru, tugasan, subjek dan exam dalam satu Excel. Ganti semua baris contoh sebelum import sebenar. Dalam 03_STUDENTS, isi religion_subject (PI/PM) dan elective_subject (BA/BC/BT) untuk setiap murid aktif. Guru hanya melihat murid yang mengambil subjek mereka.</p><ol class="setup-steps">${['Muat turun','Upload Excel','Validasi','Pratonton','Sahkan','Selesai'].map((s,i)=>`<li data-setup-step="${i+1}">${i+1}. ${s}</li>`).join('')}</ol><div class="toolbar"><button id="setup-download">Muat Turun Template Excel</button><button id="legacy-import" class="secondary">Import CSV / Sejarah Lama</button></div><label id="setup-drop" class="setup-drop">Pilih atau seret satu fail .xlsx (maksimum 8MB)<input id="setup-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label><p id="setup-status" role="status" aria-live="polite">Sedia untuk workbook.</p><div id="setup-issues"></div><div id="setup-preview"></div><div id="setup-result"></div><div id="setup-readiness"></div></section>`;
    let documentData = null,
      preview = null,
      commitId = null,
      credentials = null,
      committed = false;
    const status = s => section.querySelector('#setup-status').textContent = s,
      stage = n => section.querySelectorAll('[data-setup-step]').forEach(li => {
        li.classList.toggle('step-current', Number(li.dataset.setupStep) === n);
        if (Number(li.dataset.setupStep) === n) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
    stage(1);
    const busy = async fn => {
      if (M.schoolBusy) throw new Error('Import sedang diproses.');
      M.schoolBusy = true;
      const controls = [...section.querySelectorAll('button,input')].map(x => [x, x.disabled]);
      controls.forEach(([x]) => x.disabled = true);
      try {
        return await fn();
      } finally {
        M.schoolBusy = false;
        if (section.isConnected) controls.forEach(([x, disabled]) => {
          if (x.isConnected) x.disabled = disabled;
        });
      }
    };
    const issues = list => {
      section.querySelector('#setup-issues').innerHTML = list.length ? '<div class="table-scroll"><table><thead><tr><th>Worksheet</th><th>Baris</th><th>Medan</th><th>Tindakan</th></tr></thead><tbody>' + list.slice(0, 150).map(e => `<tr><td>${M.esc(e.sheet)}</td><td>${e.row||'—'}</td><td>${M.esc(e.field)}</td><td>${M.esc(e.message)}</td></tr>`).join('') + '</tbody></table></div>' : '';
    };
    const load = async file => busy(async () => {
      documentData = null;
      preview = null;
      commitId = null;
      credentials = null;
      committed = false;
      section.querySelector('#setup-preview').replaceChildren();
      section.querySelector('#setup-result').replaceChildren();
      issues([]);
      M.notice('');
      stage(2);
      status('Membaca workbook secara setempat…');
      try {
        documentData = await M.readSchoolXlsx(file);
        stage(3);
        status('Mengesahkan data dan hubungan dengan database…');
        preview = await M.call('schoolPreview', {
          document: documentData
        }, true);
        preview = {
          ...preview,
          ...await M.call('schoolPreviewDetails', {
            preview_id: preview.preview_id,
            document: documentData
          })
        };
        issues(preview.errors.concat(preview.warnings));
        if (preview.errors.length) {
          status(preview.errors.length + ' ralat. Betulkan workbook dan upload semula. Tiada data sekolah ditulis.');
          return;
        }
        stage(4);
        status('Validasi selesai. Pratonton sah selama 15 minit; perubahan database akan memerlukan validasi semula.');
        section.querySelector('#setup-preview').innerHTML = '<h4>Pratonton Perubahan</h4>' + countTable(preview.counts) + `<p>${preview.newTeachers.length} akaun baharu memerlukan kod pengaktifan individu. PIN akaun sedia ada dikekalkan.</p><details><summary>${preview.change_count} perubahan dirancang (100 pertama)</summary><pre>${M.esc(JSON.stringify(preview.changes,null,2))}</pre></details><label><input id="setup-confirm-check" type="checkbox"> Saya telah mengganti/menyemak semua data contoh dan meluluskan perubahan ini.</label><button id="setup-commit">Sahkan Persediaan Sekolah</button>`;
        section.querySelector('#setup-commit').onclick = () => M.run(commit);
      } catch (e) {
        issues(e.issues || []);
        status(e.message);
        throw e;
      }
    });

    function countTable(counts) {
      return '<div class="table-scroll"><table><thead><tr><th>Rekod</th><th>Cipta</th><th>Kemas Kini</th><th>Kekal</th><th>Konflik</th></tr></thead><tbody>' + Object.entries(counts).map(([t, c]) => `<tr><td>${M.esc(t)}</td><td>${c.create}</td><td>${c.update}</td><td>${c.skip}</td><td>${c.conflict}</td></tr>`).join('') + '</tbody></table></div>';
    }
    const commit = async () => {
      if (committed) return;
      if (!section.querySelector('#setup-confirm-check').checked) throw new Error('Tandakan pengesahan selepas menyemak pratonton.');
      return busy(async () => {
        stage(5);
        try {
          if (!credentials) {
            credentials = [];
            for (const [i, t] of preview.newTeachers.entries()) {
              status(`Menyediakan credential selamat ${i+1} daripada ${preview.newTeachers.length} guru…`);
              credentials.push({
                teacher_ref: t.teacher_ref,
                salt: t.salt,
                proof: await M.temporaryProof('BBB8307', t.salt, t.iterations)
              });
            }
          }
          commitId = commitId || M.uid();
          status('Menyimpan melalui transaksi sekolah. Jangan tutup tab…');
          const result = await M.call('schoolCommit', {
            preview_id: preview.preview_id,
            document: documentData,
            credentials,
            confirmed: true
          }, true, commitId);
          committed = true;
          documentData = null;
          credentials = null;
          stage(6);
          status('Transaksi selesai dan disahkan oleh backend.');
          section.querySelector('#setup-preview').replaceChildren();
          section.querySelector('#setup-result').innerHTML = '<h4>Persediaan Disimpan</h4>' + countTable(result.counts) + '<p>Seterusnya: semak readiness, keluarkan kod pengaktifan secara peribadi dan sediakan exam selepas semakan.</p>';
          M.notice('Persediaan sekolah disimpan.');
          const checks = await Promise.allSettled([M.refreshAdminData ? M.refreshAdminData() : Promise.resolve(), readiness()]);
          if (checks.some(x => x.status === 'rejected')) status('Import telah disimpan. Semak semula readiness/masuk semula Pentadbiran untuk memuat status terkini.');
        } catch (e) {
          status(e.message + ' Jika timeout, cuba butang yang sama untuk menggunakan request ID asal. Jika refresh, validasi semula workbook; padanan stabil melindungi daripada pendua.');
          throw e;
        }
      });
    };
    section.querySelector('#setup-download').onclick = () => {
      const bytes = Uint8Array.from(atob(window.MPS_SCHOOL_TEMPLATE), c => c.charCodeAt(0));
      M.download('MPS-eAssessment-School-Setup-2026.xlsx', new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      stage(2);
      status('Template dimuat turun. Ganti semua baris contoh sebelum upload.');
    };
    section.querySelector('#legacy-import').onclick = () => {
      if (M.schoolBusy) return;
      legacy();
    };
    section.querySelector('#setup-file').onchange = e => M.run(() => load(e.target.files[0]));
    const drop = section.querySelector('#setup-drop');
    drop.ondragover = e => {
      e.preventDefault();
      drop.classList.add('drag-active');
    };
    drop.ondragleave = () => drop.classList.remove('drag-active');
    drop.ondrop = e => {
      e.preventDefault();
      drop.classList.remove('drag-active');
      if (e.dataTransfer.files.length !== 1) return M.notice('Pilih tepat satu workbook.', true);
      M.run(() => load(e.dataTransfer.files[0]));
    };
    async function readiness() {
      const d = await M.call('schoolReadiness'),
        node = section.querySelector('#setup-readiness');
      node.innerHTML = `<h4>Readiness Sekolah ${M.esc(d.academic_year)}</h4><p>${d.classes} kelas · ${d.students} murid · ${d.active_enrolments} enrolmen aktif · ${d.teachers} guru · ${d.subjects} subjek</p><p>${d.class_teachers} tugasan guru kelas · ${d.subject_teachers} tugasan subjek</p><p>${d.ready?'Struktur sekolah lengkap. Semak pengaktifan guru dan tarikh exam sebelum membuka.':'Terdapat perkara yang belum lengkap.'}</p><ul>${d.warnings.map(w=>`<li>${M.esc(w)}</li>`).join('')}${d.missing.map(e=>`<li>${M.esc(e.class_id||'')} ${M.esc(e.subject_code||'')}: ${M.esc(e.message)}</li>`).join('')}</ul><button id="refresh-school-readiness">Semak Semula Readiness</button><h4>Akaun Menunggu Pengaktifan</h4><p>Sahkan identiti guru sebelum mengeluarkan kod. Kod dipaparkan sekali sahaja, luput 48 jam dan kod lama dibatalkan apabila dikeluarkan semula.</p><div class="table-scroll"><table><thead><tr><th>Pilih</th><th>Guru</th><th>Pengenalan</th></tr></thead><tbody>${d.pending_activation.map(t=>`<tr><td><input type="checkbox" data-activate="${M.esc(t.user_id)}" aria-label="Pilih ${M.esc(t.full_name)}"></td><td>${M.esc(t.full_name)}</td><td>${M.esc(t.identification_code)} ${M.esc(t.account_alias)}</td></tr>`).join('')}</tbody></table></div><button id="issue-activation">Keluarkan / Keluarkan Semula Kod Terpilih</button><div id="issued-activation" aria-live="polite"></div><h4>Peperiksaan</h4>${d.exams.map(e=>`<p>${M.esc(e.exam_type)}: ${M.esc(e.status)} · Niat: ${M.esc(e.intent?.intended_status||'DRAFT')} <button data-school-prepare="${M.esc(e.exam_id)}" ${d.ready&&e.status==='DRAFT'?'':'disabled'}>Sediakan & Buka Selepas Semakan</button></p>`).join('')}`;
      node.querySelector('#refresh-school-readiness').onclick = () => M.run(readiness);
      node.querySelector('#issue-activation').onclick = () => M.run(async () => {
        const ids = [...node.querySelectorAll('[data-activate]:checked')].map(x => x.dataset.activate);
        if (!ids.length || ids.length > 30) throw new Error('Pilih 1–30 guru.');
        if (!confirm('Identiti guru telah disahkan dan kod akan diedarkan secara peribadi? Kod lama dibatalkan.')) return;
        const r = await M.call('issueActivation', {
          user_ids: ids
        }, true);
        node.querySelector('#issued-activation').innerHTML = '<h4>Kod Peribadi — Jangan Kongsi Skrin</h4><p>' + M.esc(r.message) + '</p>' + r.codes.map(c => `<p>${M.esc(c.full_name)}: <code>${M.esc(c.code)}</code> · luput ${M.date(new Date(c.expires).toISOString())}</p>`).join('') + '<button id="hide-activation-codes">Padam Paparan Kod</button>';
        node.querySelector('#hide-activation-codes').onclick = () => node.querySelector('#issued-activation').replaceChildren();
      });
      node.querySelectorAll('[data-school-prepare]').forEach(b => b.onclick = () => M.run(async () => {
        if (!confirm('Bekukan cohort dan subjek, kemudian buka exam mengikut tarikh konfigurasi? Ini tindakan berasingan daripada import.')) return;
        await M.call('schoolPrepare', {
          exam_id: b.dataset.schoolPrepare,
          confirmed: true
        }, true);
        await readiness();
      }));
    }
    await readiness();
  };
})(window.MPS);
