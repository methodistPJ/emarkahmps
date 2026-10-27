(function(M) {
  M.remarkPending = new Map();
  M.remarkInflight = null;
  M.remarkFlush = null;
  M.openReview = async (exam_id, class_id, prefetched=null) => {
    await M.guard();M.view('review');
    const nextContext={exam_id,class_id,mode:'CLASS_REVIEW'};
    const previousSection=prefetched?document.querySelector('[data-section][aria-pressed=true]')?.dataset.section:null;
    const previousStudents=prefetched?[...document.querySelectorAll('details[data-student][open]')].map(n=>n.dataset.student):[];
    const d=prefetched||await M.call('reviewGet',nextContext);
    M.viewPayload=d;M.context=nextContext;M.openCurrent=()=>M.openReview(exam_id,class_id);
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
    const gate=d.gate||{ready:d.readiness.missingSubmissions.length===0,missing:d.readiness.missingSubmissions};
    const verification=d.verification||{confirmed:!!meta?.finalized_at,name:'',at:meta?.finalized_at};
    const ownConfirmation=verification.confirmed?`Markah ini telah disemak dan disahkan oleh ${verification.name===M.user.full_name?'anda':M.esc(verification.name||'guru kelas')} pada ${M.date(verification.at)}.`:M.confirmation(verification);
    content.innerHTML =
      `<p class="eyebrow">KELAS SAYA</p><h2>${M.esc(d.class.class_name)} / ${M.esc(d.exam.exam_type)}</h2>${ownConfirmation?`<p class="confirmed-banner">${ownConfirmation}</p>`:''}${!gate.ready?`<p class="attention-banner">Menunggu semua guru subjek selesai mengisi dan menghantar. Belum dihantar: ${M.esc(gate.missing.join(', '))}. Edit, ulasan dan pengesahan belum dibuka.</p>`:''}<p id="save-status" class="save-status" role="status">${M.remarkPending.size||M.remarkInflight?'Draf ulasan dipulihkan.':'Keputusan semasa.'}</p>${M.refreshBar()}<div class="section-tabs"><button data-section="overview">Kemajuan Subjek</button><button data-section="matrix">Keputusan Murid</button><button data-section="remarks">Ulasan Guru</button><button data-section="verification">${M.user.roles.includes('ADMINISTRATOR')?'Pengesahan & Slip':'Pengesahan Kelas'}</button></div>
<section id="overview"><div class="compact-grid">${d.subjects.map(sub=>{const rows=d.marks.filter(m=>m.subject_code===sub.subject_code&&!(m.mark_status==='TB'&&m.default_tb)),done=rows.filter(m=>m.mark_status!=='EMPTY').length,status=d.submissions.find(s=>s.subject_code===sub.subject_code)?.submission_status||'DRAFT';return `<article class="analysis-card"><h4>${M.esc(sub.subject_name||sub.subject_code)}</h4><span class="status-badge">${M.esc(status)}</span><p>${M.esc(d.subject_teachers?.find(t=>t.subject_code===sub.subject_code)?.names.join(', ')||'')}</p><p>${rows.length?Math.round(100*done/rows.length):100}% pengisian · ${done}/${rows.length}</p><progress max="100" value="${rows.length?100*done/rows.length:100}"></progress></article>`;}).join('')}</div></section>
<section id="matrix" hidden><div class="toolbar"><label>Cari murid<input id="review-search" type="search"></label><label><input type="checkbox" id="incomplete-only"> Belum lengkap sahaja</label></div><div class="student-cards">${students.map(s=>`<details data-accordion data-student="${M.esc(s.student_id)}"><summary>${M.esc(s.student_name_snapshot)} <span class="status-badge">${d.marks.filter(m=>m.student_id===s.student_id&&m.mark_status==='EMPTY').length?'Belum lengkap':'Markah lengkap'}</span></summary><div class="table-scroll"><table><thead><tr><th>Subjek</th><th>Markah</th><th>Gred</th></tr></thead><tbody>${d.subjects.map(sub=>{const m=d.marks.find(x=>x.student_id===s.student_id&&x.subject_code===sub.subject_code);return `<tr><td>${M.esc(sub.subject_code)}</td><td><button class="matrix-button" data-mark="${M.esc(m?.mark_id||'')}" ${editable?'':'disabled'}>${M.esc(m?M.display(m)||'EMPTY':'—')}</button></td><td>${M.esc(m?.grade||'—')}${m?.amendment_reason?' · Dipinda':''}</td></tr>`;}).join('')}</tbody></table></div><p>Ulasan: ${M.esc(s.class_teacher_remark||'Belum diisi')}</p></details>`).join('')}</div><div id="amend-panel"></div><div id="conflict" class="conflict" hidden></div></section>
<section id="remarks" hidden><p>Ulasan wajib bagi setiap murid. Maksimum 300 aksara.</p><div class="toolbar"><label>Templat ulasan<select id="remark-template"><option value="">Pilih…</option><option>Teruskan usaha dan amalkan pembelajaran yang konsisten.</option><option>Tingkatkan latihan dan dapatkan bimbingan bagi topik yang belum dikuasai.</option></select></label><button id="bulk-remark" ${editable?'':'disabled'}>Terapkan kepada ulasan kosong</button><button id="retry-remarks" ${editable?'':'disabled'}>${students.some(s=>s.class_teacher_remark)?'Kemaskini':'Simpan Ulasan'}</button><button id="export-remarks" class="secondary">Eksport Draf Pemulihan</button><button id="discard-remarks" class="secondary">Buang draf & muat semula</button></div><div class="student-cards">${students.map(s=>{const value=M.remarkPending.get(s.student_id)?.remark??M.remarkInflight?.payload.changes.find(c=>c.student_id===s.student_id)?.remark??s.class_teacher_remark??'';return `<details data-accordion><summary>${M.esc(s.student_name_snapshot)} · ${value.trim()?'Ada ulasan':'Belum diisi'}</summary><textarea data-remark="${M.esc(s.student_id)}" maxlength="300" aria-label="Ulasan ${M.esc(s.student_name_snapshot)}" ${editable?'':'readonly'}>${M.esc(value)}</textarea><small class="remark-length">${value.length}/300</small></details>`;}).join('')}</div></section>
<section id="verification" hidden><div id="readiness"></div><button id="refresh-verification">Semak Kesiapsiagaan</button><button id="finalize-class" ${d.editable?'':'disabled'}>${meta?.finalized_at?'Sahkan Semula':'Sahkan Kelas'}</button><button id="download-class" ${M.user.roles.includes('ADMINISTRATOR')?'':'hidden'} ${meta?.pdf_status==='COMPLETED'?'':'disabled'}>Muat Turun PDF Kelas</button><div id="slip-preview"></div></section>`;
    M.accordions(content);M.bindRefresh();
    document.querySelectorAll('[data-section]').forEach(b => b.onclick = () => {
      ['overview', 'matrix', 'remarks', 'verification'].forEach(id => document.getElementById(id).hidden =
        id !== b.dataset.section);
      content.querySelectorAll('[data-section]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    });
    const filterStudents=()=>content.querySelectorAll('[data-student]').forEach(row=>{const student=students.find(s=>s.student_id===row.dataset.student),q=document.querySelector('#review-search').value.toLowerCase();row.hidden=!student.student_name_snapshot.toLowerCase().includes(q)||document.querySelector('#incomplete-only').checked&&!d.marks.some(m=>m.student_id===row.dataset.student&&m.mark_status==='EMPTY');});
    document.querySelector('#incomplete-only').onchange=filterStudents;document.querySelector('#review-search').oninput=filterStudents;
    document.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => {
      const mark = d.marks.find(m => m.mark_id === b.dataset.mark);
      b.closest('details').append(document.querySelector('#amend-panel'));
      document.querySelector('#amend-panel').innerHTML =
        `<form id="amend-form" class="panel"><h3>Pindaan ${M.esc(mark.subject_code)}</h3><p>${M.esc(mark.student_name_snapshot)} · Semasa ${M.esc(M.display(mark))}</p><label>Nilai baharu<input name="value" value="${M.esc(M.display(mark))}" required></label><label>Sebab pindaan<input name="reason" maxlength="300" required></label><button>Simpan Pindaan</button></form>`;
      document.querySelector('#amend-form input[name=value]').oninput=e=>{e.target.value=M.limitMark(e.target.value);};
      document.querySelector('#amend-form').onsubmit = e => {
        e.preventDefault();
        M.feedback('Menyimpan pindaan…',async () => {
          const f = new FormData(e.target);
          M.queue(mark, M.limitMark(f.get('value')), f.get('reason'));
          await M.flush();
          await M.openReview(exam_id, class_id);
        });
      };
    });
    const queueRemark = (s, value) => {
      if(!editable)return;
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
      if(!editable)return;
      t.value = t.value.replace(/[\r\n]+/g, ' ');
      t.nextElementSibling.textContent = t.value.length + '/300';
      queueRemark(students.find(s => s.student_id === t.dataset.remark), t.value);
    });
    document.querySelector('#export-remarks').onclick=M.exportDraft;
    document.querySelector('#retry-remarks').onclick = () => M.feedback('Menyimpan ulasan…',async()=>{await M.remarkFlush();document.querySelector('#retry-remarks').textContent='Kemaskini';},'Ulasan berjaya disimpan');
    document.querySelector('#discard-remarks').onclick = () => M.run(async () => {
      if (!confirm('Buang semua draf ulasan tempatan dan muat semula?')) return;
      M.remarkPending.clear();
      M.remarkInflight = null;remarkConflict=false;
      persist();
      await M.openReview(exam_id, class_id);
    });
    document.querySelector('#bulk-remark').onclick = () => M.feedback('Menyimpan ulasan…',async () => {
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
        `<h3>Semakan seluruh kelas</h3>${latest.coverage&&!latest.coverage.valid?'<p class="error">Liputan murid × subjek tidak lengkap. Hubungi pentadbir.</p>':''}${jobProgress&&M.user.roles.includes('ADMINISTRATOR')?`<p class="job-progress">PDF: ${M.esc(jobProgress.status)} · ${jobProgress.completed_students}/${jobProgress.total_students} snapshot murid telah diproses.</p>`:''}<p>${latest.students} murid · ${latest.empty} markah EMPTY · ${latest.missingRemarks} ulasan kosong · ${latest.amendments} pindaan guru kelas.</p><p>Subjek belum disahkan: ${M.esc(latest.missingSubmissions.join(', ')||'Tiada')}. TB: ${latest.tb}.</p><p>Status: ${meta?.finalized_at?'Dimuktamadkan':latest.ready?'Sedia disahkan':'Belum lengkap'}${M.user.roles.includes('ADMINISTRATOR')?' · PDF: '+M.esc(meta?.pdf_status||'NONE'):''}</p>${meta?.job_error?`<p class="error">${M.esc(meta.job_error)}</p>`:''}`;
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
      if(!M.user.roles.includes('ADMINISTRATOR'))return;
      document.querySelector('#slip-preview').innerHTML =
        `<details><summary>Pratonton kandungan murid pertama</summary><p>${M.esc(s.student_name_snapshot)}</p><p>${marks.map(m=>`${M.esc(m.subject_code)}: ${M.esc(M.display(m)||'EMPTY')} (${M.esc(m.grade||m.mark_status)})`).join(' · ')}</p><p>${M.esc(s.class_teacher_remark)}</p><p class="muted">Susun atur A4 disahkan oleh penjana PDF selepas pemuktamadan.</p></details>`;
    });
    document.querySelector('#finalize-class').onclick = () => M.feedback('Menyemak dan mengesahkan kelas…',async () => {
      await M.guard();
      M.checkOtherDrafts();
      const current = await M.call('reviewGet', M.context);
      latest = current.readiness;
      renderReady();
      if (!latest.ready) throw new Error('Lengkapkan penghantaran, markah dan ulasan dahulu.');
      if (!confirm(
          `Sahkan ${latest.students} murid dalam seluruh kelas? Keputusan akan dikunci. PDF hanya dijana oleh pentadbir.`
        )) return;
      await M.call('finalize', {
        ...M.context,
        revisionHash: latest.revisionHash,
        confirmed: true
      }, true);
      await M.openReview(exam_id, class_id);
      M.notice('Seluruh kelas disahkan. Pentadbir boleh menjana PDF selepas ini.');
    });
    M.view('review',async()=>{const fresh=await M.call('reviewGet',nextContext);const stamp=x=>JSON.stringify([x.marks.map(m=>m.record_version),x.reviews.map(r=>[r.record_version,r.pdf_status,r.finalized_at]),x.submissions]);if(M.viewName==='review'&&JSON.stringify(M.context)===JSON.stringify(nextContext)&&!M.dirty()&&!document.activeElement?.matches('input,textarea,select')&&stamp(fresh)!==stamp(d))await M.renderReview(exam_id,class_id,fresh);});
    if(previousSection)document.querySelector('[data-section="'+previousSection+'"]')?.click();
    previousStudents.forEach(id=>{const n=[...content.querySelectorAll('details[data-student]')].find(x=>x.dataset.student===id);if(n)n.open=true;});
    document.querySelector('#download-class').onclick = () => M.run(() => M.downloadPDF(exam_id,
      class_id));
  };
  M.renderReview=M.openReview;
})(window.MPS);
