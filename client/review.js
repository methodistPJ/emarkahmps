(function(M) {
  M.remarkPending = new Map();
  M.remarkInflight = null;
  M.remarkFlush = null;
  M.openReview = async (exam_id, class_id) => {
    await M.guard();
    const nextContext={exam_id,class_id,mode:'CLASS_REVIEW'};
    const d=await M.call('reviewGet',nextContext);
    M.context=nextContext;M.openCurrent=()=>M.openReview(exam_id,class_id);
    M.draftKey=`mps-draft:${M.user.user_id}:${exam_id}:${class_id}:review`;
    M.pending=new Map();M.inflight=null;
    M.currentMarks = d.marks;
    const markDraft=M.readDraft(M.draftKey);
    M.rawDrafts=new Map(markDraft?.invalid||[]);M.invalid=new Set(M.rawDrafts.keys());
    if(markDraft) {
      M.pending = new Map(markDraft.pending);
      M.inflight = markDraft.inflight;
    }
    const meta = d.reviews.find(r => r.record_type === 'CLASS'),
      students = d.reviews.filter(r => r.record_type === 'STUDENT').sort((a, b) => a
        .student_name_snapshot.localeCompare(b.student_name_snapshot, 'ms'));
    const editable = d.editable && !meta?.finalized_at,
      key = `mps-remarks:${M.user.user_id}:${exam_id}:${class_id}`,
      stored=M.readDraft(key);
    M.remarkPending = new Map(stored ? stored.pending : []);
    M.remarkInflight = stored ? stored.inflight : null;
    let remarkSaving=false,remarkConflict=false;
    const persist = () => M.writeDraft(key,{
      time: Date.now(),
      pending: [...M.remarkPending],
      inflight: M.remarkInflight
    });
    M.remarkFlush = async () => {
      if(M.blockedDrafts.has(key))throw new Error('Pulihkan atau eksport draf ulasan rosak dahulu.');
      if(remarkConflict)throw new Error('Selesaikan konflik ulasan sebelum cuba lagi.');
      if (remarkSaving) {
        await M.remarkPromise;
        return M.remarkFlush();
      }
      if (!M.remarkPending.size && !M.remarkInflight) return;
      remarkSaving = true;
      M.remarkPromise = (async () => {
        if (!M.remarkInflight) {
          M.remarkInflight = {
            id: M.uid(),
            payload: {
              ...M.context,
              changes: [...M.remarkPending.values()]
            }
          };
          M.remarkPending.clear();
          persist();
        }
        M.saveLabel('Menyimpan ulasan…');
        try {
          const result = await M.call('remarkSave', M.remarkInflight.payload, true, M
            .remarkInflight.id);
          result.reviews.forEach(r => {
            Object.assign(students.find(s => s.student_id === r.student_id), r);
            const p = M.remarkPending.get(r.student_id);
            if (p) p.version = Number(r.record_version);
          });
          M.remarkInflight = null;
          persist();
          M.saveLabel(M.remarkPending.size?'Ulasan baharu belum dihantar.':'Ulasan disimpan.');
        } catch (e) {
          M.saveLabel('Ulasan belum disimpan.');
          if (e.code === 'CONFLICT') {
            remarkConflict=true;
            M.notice(
              'Konflik ulasan. Salin ulasan tempatan, kemudian buang draf untuk memuat nilai semasa.',
              true);
            document.querySelector('#discard-remarks').hidden = false;
          }
          throw e;
        } finally {
          remarkSaving = false;
        }
      })();
      await M.remarkPromise;
      if (M.remarkPending.size) await M.remarkFlush();
    };
    const content = document.querySelector('#content');
    content.innerHTML =
      `<p class="eyebrow">CLASS TEACHER WORKSPACE</p><h2>${M.esc(d.class.class_name)} <em>/ ${M.esc(d.exam.exam_type)}</em></h2><p id="save-status" class="save-status" role="status">${M.remarkPending.size||M.remarkInflight?'Draf ulasan dipulihkan.':'Keputusan semasa.'}</p><div class="tabs"><button data-section="matrix">Markah Keseluruhan</button><button data-section="remarks">Ulasan Guru</button><button data-section="verification">Pengesahan</button></div><section id="matrix"><label><input type="checkbox" id="incomplete-only"> Paparkan murid dengan markah belum lengkap sahaja</label><div class="table-scroll"><table><thead><tr><th class="frozen">Nama Murid</th>${d.subjects.map(s=>`<th>${M.esc(s.subject_code)}<br><small>${M.esc(d.submissions.find(x=>x.subject_code===s.subject_code)?.submission_status||'DRAFT')}</small></th>`).join('')}</tr></thead><tbody>${students.map(s=>`<tr data-student="${M.esc(s.student_id)}"><td class="frozen">${M.esc(s.student_name_snapshot)}</td>${d.subjects.map(sub=>{const m=d.marks.find(x=>x.student_id===s.student_id&&x.subject_code===sub.subject_code);return `<td><button class="matrix-button" data-mark="${M.esc(m?.mark_id||'')}" ${editable?'':'disabled'}>${M.esc(m?M.display(m)||'EMPTY':'—')} <small>${M.esc(m?.grade||'')}${m?.amendment_reason?' · Dipinda':''}</small></button></td>`;}).join('')}</tr>`).join('')}</tbody></table></div><div id="amend-panel"></div><div id="conflict" class="conflict" hidden></div></section>
 <section id="remarks" hidden><p>Ulasan wajib bagi setiap murid. Maksimum 300 aksara, satu perenggan.</p><div class="toolbar"><label>Templat ulasan<select id="remark-template"><option value="">Pilih…</option><option>Teruskan usaha dan amalkan pembelajaran yang konsisten.</option><option>Tingkatkan latihan dan dapatkan bimbingan bagi topik yang belum dikuasai.</option></select></label><button id="bulk-remark" ${editable?'':'disabled'}>Terapkan kepada ulasan kosong</button><button id="retry-remarks">Cuba Simpan</button><button id="export-remarks">Eksport Draf</button><button id="discard-remarks">Buang draf & muat semula</button></div><div class="table-scroll"><table><thead><tr><th>Murid</th><th>Ulasan</th></tr></thead><tbody>${students.map(s=>{const value=M.remarkPending.get(s.student_id)?.remark??M.remarkInflight?.payload.changes.find(c=>c.student_id===s.student_id)?.remark??s.class_teacher_remark;return `<tr><td>${M.esc(s.student_name_snapshot)}</td><td><textarea data-remark="${M.esc(s.student_id)}" maxlength="300" aria-label="Ulasan ${M.esc(s.student_name_snapshot)}" ${editable?'':'readonly'}>${M.esc(value)}</textarea><small class="remark-length">${value.length}/300</small></td></tr>`;}).join('')}</tbody></table></div></section>
 <section id="verification" hidden><div id="readiness"></div><button id="refresh-verification">Semak Kesiapsiagaan</button><button id="finalize-class" ${editable?'':'disabled'}>SAHKAN & JANA SLIP</button><button id="download-class" ${meta?.pdf_status==='COMPLETED'?'':'disabled'}>Muat Turun PDF Kelas</button><div id="slip-preview"></div></section>`;
    document.querySelectorAll('[data-section]').forEach(b => b.onclick = () => {
      ['matrix', 'remarks', 'verification'].forEach(id => document.getElementById(id).hidden =
        id !== b.dataset.section);
    });
    document.querySelector('#incomplete-only').onchange = e => document.querySelectorAll(
      '[data-student]').forEach(row => row.hidden = e.target.checked && !d.marks.some(m => m
      .student_id === row.dataset.student && m.mark_status === 'EMPTY'));
    document.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => {
      const mark = d.marks.find(m => m.mark_id === b.dataset.mark);
      document.querySelector('#amend-panel').innerHTML =
        `<form id="amend-form" class="panel"><h3>Pindaan ${M.esc(mark.subject_code)}</h3><p>${M.esc(mark.student_name_snapshot)} · Semasa ${M.esc(M.display(mark))}</p><label>Nilai baharu<input name="value" value="${M.esc(M.display(mark))}" required></label><label>Sebab pindaan<input name="reason" maxlength="300" required></label><button>Simpan Pindaan</button></form>`;
      document.querySelector('#amend-form').onsubmit = e => {
        e.preventDefault();
        M.run(async () => {
          const f = new FormData(e.target);
          M.queue(mark, f.get('value'), f.get('reason'));
          await M.flush();
          await M.openReview(exam_id, class_id);
        });
      };
    });
    const queueRemark = (s, value) => {
      M.remarkPending.set(s.student_id, {
        student_id: s.student_id,
        version: Number(s.record_version),
        remark: value.replace(/[\r\n]+/g, ' ')
      });
      persist();
      M.saveLabel('Ulasan belum dihantar.');
      clearTimeout(M.remarkTimer);
      M.remarkTimer = setTimeout(() => M.run(M.remarkFlush), 650);
    };
    document.querySelectorAll('[data-remark]').forEach(t => t.oninput = () => {
      t.value = t.value.replace(/[\r\n]+/g, ' ');
      t.nextElementSibling.textContent = t.value.length + '/300';
      queueRemark(students.find(s => s.student_id === t.dataset.remark), t.value);
    });
    document.querySelector('#export-remarks').onclick=M.exportDraft;
    document.querySelector('#retry-remarks').onclick = () => M.run(M.remarkFlush);
    document.querySelector('#discard-remarks').onclick = () => M.run(async () => {
      if (!confirm('Buang semua draf ulasan tempatan dan muat semula?')) return;
      M.remarkPending.clear();
      M.remarkInflight = null;remarkConflict=false;
      persist();
      await M.openReview(exam_id, class_id);
    });
    document.querySelector('#bulk-remark').onclick = () => M.run(async () => {
      const value = document.querySelector('#remark-template').value;
      if (!value) throw new Error('Pilih templat ulasan dahulu.');
      if (!confirm('Terapkan ulasan ini kepada murid yang ulasannya kosong selepas semakan?'))
        return;
      document.querySelectorAll('[data-remark]').forEach(t => {
        if (!t.value.trim()) {
          t.value = value;
          queueRemark(students.find(s => s.student_id === t.dataset.remark), value);
        }
      });
      await M.remarkFlush();
    });
    let latest=d.readiness;
    const jobProgress=d.job;
    const renderReady = () => {
      document.querySelector('#readiness').innerHTML =
        `<h3>Semakan seluruh kelas</h3>${latest.coverage&&!latest.coverage.valid?'<p class="error">Liputan murid × subjek tidak lengkap. Hubungi pentadbir.</p>':''}${jobProgress?`<p class="job-progress">PDF: ${M.esc(jobProgress.status)} · ${jobProgress.completed_students}/${jobProgress.total_students} snapshot murid telah diproses.</p>`:''}<p>${latest.students} murid · ${latest.empty} markah EMPTY · ${latest.missingRemarks} ulasan kosong · ${latest.amendments} pindaan guru kelas.</p><p>Subjek belum disahkan: ${M.esc(latest.missingSubmissions.join(', ')||'Tiada')}. TB: ${latest.tb}.</p><p>Status: ${meta?.finalized_at?'Dimuktamadkan':latest.ready?'Sedia disahkan':'Belum lengkap'} · PDF: ${M.esc(meta?.pdf_status||'NONE')}</p>${meta?.job_error?`<p class="error">${M.esc(meta.job_error)}</p>`:''}`;
    };
    renderReady();M.recoveryPanel();
    document.querySelector('#refresh-verification').onclick = () => M.run(async () => {
      await M.guard();
      M.checkOtherDrafts();
      const current = await M.call('reviewGet', M.context);
      latest = current.readiness;
      meta.pdf_status = current.reviews.find(r => r.record_type === 'CLASS').pdf_status;
      renderReady();
      document.querySelector('#download-class').disabled = meta.pdf_status !== 'COMPLETED';
      const s = students[0],
        marks = d.marks.filter(m => m.student_id === s.student_id && m.mark_status !== 'TB');
      document.querySelector('#slip-preview').innerHTML =
        `<details><summary>Pratonton kandungan murid pertama</summary><p>${M.esc(s.student_name_snapshot)}</p><p>${marks.map(m=>`${M.esc(m.subject_code)}: ${M.esc(M.display(m)||'EMPTY')} (${M.esc(m.grade||m.mark_status)})`).join(' · ')}</p><p>${M.esc(s.class_teacher_remark)}</p><p class="muted">Susun atur A4 disahkan oleh penjana PDF selepas pemuktamadan.</p></details>`;
    });
    document.querySelector('#finalize-class').onclick = () => M.run(async () => {
      await M.guard();
      M.checkOtherDrafts();
      const current = await M.call('reviewGet', M.context);
      latest = current.readiness;
      renderReady();
      if (!latest.ready) throw new Error('Lengkapkan penghantaran, markah dan ulasan dahulu.');
      if (!confirm(
          `Sahkan ${latest.students} murid dalam seluruh kelas? Keputusan akan dikunci dan satu PDF kelas dijadualkan.`
        )) return;
      await M.call('finalize', {
        ...M.context,
        revisionHash: latest.revisionHash,
        confirmed: true
      }, true);
      await M.openReview(exam_id, class_id);
      M.notice('Seluruh kelas disahkan. PDF sedang dijadualkan.');
    });
    document.querySelector('#download-class').onclick = () => M.run(() => M.downloadPDF(exam_id,
      class_id));
  };
})(window.MPS);
