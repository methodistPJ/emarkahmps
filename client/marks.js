(function(M) {
  M.pending = new Map();
  M.inflight = null;
  M.saveTimer = null;
  M.draftKey = '';
  M.context = null;
  M.saving = false;
  M.conflict = null;
  M.invalid = new Set();
  M.persist=()=>M.writeDraft(M.draftKey,{time:Date.now(),pending:[...M.pending],inflight:M.inflight,invalid:[...M.rawDrafts]});
  M.saveLabel = s => {
    const node = document.querySelector('#save-status');
    if(node)node.textContent=M.invalid.size?'Nilai tidak sah masih ada. Perubahan ini belum disimpan.':M.storageFault&&(M.pending.size||M.inflight)?'Pemulihan tempatan gagal; tunggu pengesahan server.':s;
  };
  M.queue = (mark, value, reason = '') => {
    M.pending.set(mark.mark_id, {
      mark_id: mark.mark_id,
      version: Number(mark.record_version),
      value,
      reason
    });
    M.persist();
    M.saveLabel('Terdapat perubahan belum dihantar.');
    clearTimeout(M.saveTimer);
    M.saveTimer = setTimeout(() => M.run(M.flush), 650);
  };
  M.flush = async () => {
    if (M.saving) {
      await M.savePromise;
      return M.flush();
    }
    if(M.blockedDrafts.has(M.draftKey))throw new Error('Pulihkan atau eksport draf rosak dahulu.');
    if(M.invalid.size)throw new Error('Betulkan nilai tidak sah dahulu; draf masih dikekalkan.');
    if (M.conflict) throw new Error('Selesaikan konflik dahulu.');
    if (!M.pending.size && !M.inflight) return;
    M.saving = true;
    M.savePromise = (async () => {
      if (!M.inflight) {
        M.inflight = {
          id: M.uid(),
          payload: {
            exam_id: M.context.exam_id,
            class_id: M.context.class_id,
            mode: M.context.mode || 'SUBJECT_ENTRY',
            changes: [...M.pending.values()]
          }
        };
        M.pending.clear();
        M.persist();
      }
      M.saveLabel('Menyimpan…');
      try {
        const saved = await M.call('saveMarks', M.inflight.payload, true, M.inflight.id);
        saved.marks.forEach(row => {
          const existing = M.currentMarks.find(x => x.mark_id === row.mark_id);
          Object.assign(existing, row);
          const pending = M.pending.get(row.mark_id);
          if (pending) pending.version = Number(row.record_version);
        });
        M.inflight = null;
        M.latestSave=new Date();
        M.persist();
        M.saveLabel(M.pending.size ? 'Terdapat perubahan belum dihantar.' :
          'Semua perubahan disimpan.');
      } catch (e) {
        M.saveLabel(e.code === 'NETWORK' ? 'Sambungan terputus. Perubahan belum disimpan.' :
          'Gagal menyimpan.');
        if (e.code === 'CONFLICT') {
          M.conflict = e;
          const box = document.querySelector('#conflict');
          if (box) {
            box.hidden = false;
            box.innerHTML =
              `<p>${M.esc(e.message)} Nilai semasa: ${M.esc(e.details?.current?.score??e.details?.current?.remark??e.details?.current?.mark_status)}.</p><button id="discard-conflict">Buang perubahan tempatan & muat semula</button><p class="muted">Catat nilai yang ingin dikekalkan sebelum memuat semula. Kemudian masukkan semula selepas menyemak rekod semasa.</p>`;
            document.querySelector('#discard-conflict').onclick = () => M.run(async () => {
              if(!confirm('Buang semua draf tempatan yang belum diselaraskan? Eksport dahulu jika perlu.'))return;
              M.pending.clear();
              M.inflight = null;
              M.conflict = null;
              M.persist();
              await M.openCurrent();
            });
          }
        }
        if(e.code!=='CONFLICT')M.recoveryPanel();
        throw e;
      } finally {
        M.saving = false;
      }
    })();
    await M.savePromise;
    if (M.pending.size) await M.flush();
  };
  M.guard = async () => {
    if(M.schoolBusy)throw new Error('Import sedang diproses. Tunggu keputusan sebelum berpindah paparan.');
    if(M.activeCorruptKey())throw new Error('Pulihkan atau eksport draf rosak dahulu.');
    if (M.invalid.size) throw new Error('Betulkan nilai tidak sah sebelum meneruskan.');
    await M.flush();
    if (M.remarkFlush) await M.remarkFlush();
  };
  M.openMarks = async (exam_id, class_id, subject_code) => {
    await M.guard();
    const nextContext={exam_id,class_id,subject_code};
    const data=await M.call('marksGet',nextContext);
    M.context=nextContext;M.openCurrent=()=>M.openMarks(exam_id,class_id,subject_code);M.remarkFlush=null;
    M.currentMarks = data.marks;
    M.draftKey = `mps-draft:${M.user.user_id}:${exam_id}:${class_id}:${subject_code}`;
    M.pending = new Map();
    M.inflight = null;
    const saved=M.readDraft(M.draftKey);
    M.rawDrafts=new Map(saved?.invalid||[]);M.invalid=new Set(M.rawDrafts.keys());
    if(saved) {
      M.pending = new Map(saved.pending);
      M.inflight = saved.inflight;
    }
    const locked=!!data.metadata?.finalized_at||data.submission?.submission_status!=='DRAFT';
    const content = document.querySelector('#content');
    content.innerHTML =
      `<p class="eyebrow">SMART MARKS ENTRY</p><h2>${M.esc(subject_code)} <em>/ Pengisian</em></h2><p class="save-status" id="save-status" role="status">${M.pending.size||M.inflight?'Perubahan tempatan dipulihkan. Tekan Cuba Simpan.':'Semua perubahan disimpan.'}</p><div id="conflict" class="conflict" hidden></div><div class="toolbar"><label>Cari murid<input id="mark-search" type="search"></label><label>Status<select id="mark-filter"><option value="">Semua</option><option value="EMPTY">Belum diisi</option><option value="TB">TB</option><option value="TH">TH</option><option value="SCORED">Markah angka</option></select></label><button id="retry-save">Cuba Simpan</button><button id="submit-marks" ${locked?'disabled':''}>Semak & Sahkan</button></div><p>${locked?'Subjek dikunci selepas penghantaran atau pemuktamadan.':'Masukkan 0–100, TB atau TH. Enter untuk murid seterusnya.'}</p><div class="table-scroll"><table><thead><tr><th>Bil.</th><th>Nama Murid</th><th>Markah / Status</th><th>Gred</th></tr></thead><tbody id="marks-body"></tbody></table></div><details><summary>Tampal markah secara kelompok</summary><p>Satu nilai setiap baris, mengikut susunan murid penuh. Semak bilangan sebelum menyimpan.</p><textarea id="paste-values" aria-label="Markah kelompok"></textarea><button id="apply-paste" ${locked?'disabled':''}>Semak & Terapkan</button></details><div id="submission-review"></div>`;
    const render = () => {
      const search = document.querySelector('#mark-search').value.toLowerCase(),
        filter = document.querySelector('#mark-filter').value;
      document.querySelector('#marks-body').innerHTML = M.currentMarks.map((m, i) => {
        const value = M.rawDrafts.get(m.mark_id) ?? M.pending.get(m.mark_id)?.value ?? M.inflight?.payload.changes.find(c => c
          .mark_id === m.mark_id)?.value ?? M.display(m);
        return `<tr ${m.student_name_snapshot.toLowerCase().includes(search)&&(!filter||m.mark_status===filter)?'':'hidden'}><td>${i+1}</td><td>${M.esc(m.student_name_snapshot)}</td><td><input class="mark-input" data-id="${M.esc(m.mark_id)}" aria-label="Markah ${M.esc(m.student_name_snapshot)}" inputmode="text" value="${M.esc(value)}" ${locked?'readonly':''}></td><td class="grade-preview">${M.esc(M.grade(value,data.rules))}</td></tr>`;
      }).join('');
    };
    render();M.recoveryPanel();
    document.querySelector('#mark-search').oninput = render;
    document.querySelector('#mark-filter').onchange = render;
    document.querySelector('#marks-body').oninput = e => {
      if (!e.target.matches('.mark-input') || locked) return;
      const m = M.currentMarks.find(x => x.mark_id === e.target.dataset.id),
        preview = M.grade(e.target.value, data.rules);
      e.target.closest('tr').querySelector('.grade-preview').textContent = preview;
      if (preview === 'Tidak sah') {
        M.invalid.add(m.mark_id);M.rawDrafts.set(m.mark_id,e.target.value);M.pending.delete(m.mark_id);M.persist();e.target.setAttribute('aria-invalid','true');
        M.saveLabel('Nilai tidak sah. Betulkan sebelum menyimpan.');
        return;
      }
      M.invalid.delete(m.mark_id);M.rawDrafts.delete(m.mark_id);e.target.removeAttribute('aria-invalid');
      M.queue(m, e.target.value);
    };
    document.querySelector('#marks-body').onkeydown = e => {
      if (['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        const inputs = [...document.querySelectorAll('.mark-input')].filter(x => !x.closest('tr')
            .hidden),
          index = inputs.indexOf(e.target),
          next = inputs[index + (e.key === 'ArrowUp' ? -1 : 1)];
        if (next) {
          e.preventDefault();
          next.focus();
          next.select();
        }
      }
    };
    document.querySelector('#retry-save').onclick = () => M.run(M.flush);
    document.querySelector('#apply-paste').onclick = () => M.run(async () => {
      const values = document.querySelector('#paste-values').value.split(/\r?\n/);
      if (values.at(-1) === '') values.pop();
      if (values.length !== M.currentMarks.length) throw new Error(
        'Bilangan nilai mesti sama dengan bilangan murid.');
      if (values.some(v => M.grade(v, data.rules) === 'Tidak sah')) throw new Error(
        'Terdapat nilai tidak sah.');
      if (!confirm(`Terapkan ${values.length} nilai mengikut susunan murid?`)) return;
      M.invalid.clear();M.rawDrafts.clear();
      M.currentMarks.forEach((m, i) => M.queue(m, values[i]));
      render();
      await M.flush();
    });
    document.querySelector('#submit-marks').onclick = () => M.run(async () => {
      if(M.activeCorruptKey())throw new Error('Pulihkan atau eksport draf rosak dahulu.');
    if (M.invalid.size) throw new Error('Betulkan nilai tidak sah dahulu.');
      await M.flush();
      const latest = await M.call('marksGet', M.context),
        count = {
          SCORED: 0,
          TH: 0,
          TB: 0,
          EMPTY: 0
        };
      latest.marks.forEach(m => count[m.mark_status]++);
      document.querySelector('#submission-review').innerHTML =
        `<section class="panel"><h3>Semakan Penghantaran</h3><p>${latest.marks.length} murid · Angka ${count.SCORED} · TH ${count.TH} · TB ${count.TB} · EMPTY ${count.EMPTY}</p><label><input type="checkbox" id="tb-ack"> Saya telah menyemak semua status TB${count.TB===latest.marks.length?' — SEMUA MURID TB':''}.</label><button id="confirm-submit" ${count.EMPTY?'disabled':''}>Sahkan Penghantaran ${M.esc(subject_code)}</button></section>`;
      document.querySelector('#confirm-submit').onclick = () => M.run(async () => {
        const ack = document.querySelector('#tb-ack').checked;
        await M.call('submit', {
          ...M.context,
          tb_acknowledged: ack,
          all_tb_acknowledged: ack,
          versions: latest.marks.map(m => [m.mark_id, Number(m.record_version)])
        }, true);
        await M.openMarks(exam_id, class_id, subject_code);
        M.notice('Markah dihantar dan dikunci.');
      });
    });
  };
})(window.MPS);
