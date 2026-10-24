(function(M) {
  M.expire = () => {
    M.refreshAdminData = null;
    document.querySelector('#issued-activation')?.replaceChildren();
    clearTimeout(M.saveTimer);
    clearTimeout(M.remarkTimer);
    M.token = '';
    M.authStore('removeItem', 'mps-token');
    document.querySelector('main').hidden = false;
    document.querySelector('#workspace').hidden = true;
    document.querySelector('#login-status').textContent =
      'Sesi tamat. Log masuk semula untuk menyimpan draf tempatan.';
  };
  M.openDashboard = async (prefetched = null) => {
    await M.guard();
    const d = prefetched || await M.call('dashboard');
    M.context = null;
    M.remarkFlush = null;
    const admin = d.user.roles.includes('ADMINISTRATOR');
    const count = t => Object.values(t.stats.status).reduce((n, v) => n + Number(v || 0), 0);
    const progress = t => count(t) ? Math.round(100 * (count(t) - Number(t.stats.status.EMPTY || 0)) / count(t)) : 0;
    const title = t => t.assignment.subject_code ? 'Isi Markah' : admin ? 'Lihat Kelas' : 'Semak Kelas & Ulasan';
    const cards = d.tasks.map((t, i) => `<article class="task-card"><p class="eyebrow">${M.esc(t.exam.exam_type+' '+t.exam.academic_year)} · ${M.esc(t.exam.status)}</p><h3>${M.esc(t.class.class_name)}${t.assignment.subject_code?' · '+M.esc(t.assignment.subject_code):''}</h3><p>${count(t)?progress(t)+'% sel lengkap · '+Number(t.stats.status.EMPTY||0)+' belum diisi':'Markah peperiksaan belum disediakan'}</p><progress max="100" value="${progress(t)}" aria-label="Kelengkapan ${M.esc(t.class.class_name)}"></progress><p>${t.metadata?.finalized_at?'Kelas dimuktamadkan':M.esc(t.submission?.submission_status||'Belum dimuktamadkan')} · Akhir: ${M.date(t.exam.closing_date)}</p><button data-task="${i}" ${t.exam.status==='DRAFT'?'disabled':''}>${title(t)}</button></article>`).join('');
    const total = d.tasks.reduce((n, t) => n + count(t), 0),
      empty = d.tasks.reduce((n, t) => n + Number(t.stats.status.EMPTY || 0), 0),
      final = d.tasks.filter(t => t.metadata?.finalized_at).length;
    document.querySelector('#content').innerHTML = `<p class="eyebrow">${admin?'PUSAT PEMANTAUAN PENTADBIR':'TUGASAN SAYA'}</p><h2>${admin?'Progress & Analisis Sekolah':'Apa perlu saya buat?'}</h2><p>${admin?'Isi data sekolah secara pukal, kemudian pantau pengisian markah dan semakan kelas di sini.':'Pilih kelas dan subjek di bawah. Akaun, kelas dan tugasan disediakan oleh pentadbir; guru tidak perlu mendaftar sendiri.'}</p>${admin?`<div class="toolbar"><button id="home-import">1. Isi / Import Data Sekolah</button><button id="home-analysis">Lihat Analisis</button><button id="home-monitor">Progress Terperinci</button><span id="home-data-link"></span></div><div class="metrics"><div class="metric"><strong>${total?Math.round(100*(total-empty)/total)+'%':'—'}</strong><span>Sel markah lengkap</span></div><div class="metric"><strong>${empty}</strong><span>Sel belum diisi</span></div><div class="metric"><strong>${final} / ${d.tasks.length}</strong><span>Kelas-peperiksaan dimuktamadkan</span></div></div><aside class="setup-help"><h3>Semua nama dimasukkan sekali dalam satu fail</h3><p>Isi senarai kelas, murid, guru, guru kelas dan guru subjek dalam templat Excel. Import satu fail untuk menyediakan semua rekod; tidak perlu daftar satu demi satu. Jika mengisi melalui Google Sheets, muat turun sebagai Excel (.xlsx) sebelum import.</p><p>Perubahan dalam fail persediaan hanya digunakan selepas import dan pengesahan. Pangkalan data operasi bukan templat pengisian.</p><button id="home-template" class="secondary">Muat Turun Templat Nama Murid & Guru</button></aside>`:''}<h3>${admin?'Progress mengikut kelas dan peperiksaan':'Isi markah / semak kelas'}</h3><p class="muted">Peratus mengira SCORED, TH dan TB sebagai sel lengkap. TB lalai termasuk dalam kiraan; penghantaran subjek dan pengesahan kelas masih diperlukan.</p><div class="task-grid">${cards}</div>${!d.tasks.length?`<p class="empty-state">${admin?'Belum ada tugasan peperiksaan. Mulakan dengan Isi / Import Data Sekolah, semak kelengkapan dan sediakan peperiksaan.':'Tugasan belum disediakan. Hubungi pentadbir; anda tidak perlu mendaftar murid atau kelas sendiri.'}</p>`:''}`;
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => M.run(async () => {
      const t = d.tasks[Number(b.dataset.task)];
      M.authStore('setItem', 'mps-last-task', JSON.stringify({
        e: t.exam.exam_id,
        c: t.class.class_id,
        s: t.assignment.subject_code
      }));
      if (t.assignment.subject_code) await M.openMarks(t.exam.exam_id, t.class.class_id, t.assignment.subject_code);
      else await M.openReview(t.exam.exam_id, t.class.class_id);
    }));
    let last = null;
    try {
      last = JSON.parse(M.authStore('getItem', 'mps-last-task') || 'null');
    } catch (e) {}
    if (last && d.tasks.some(t => t.exam.status !== 'DRAFT' && t.exam.exam_id === last.e && t.class.class_id === last.c && (t.assignment.subject_code || '') === (last.s || ''))) {
      const resume = document.createElement('button');
      resume.textContent = 'Sambung Tugasan Terakhir';
      resume.onclick = () => M.run(() => last.s ? M.openMarks(last.e, last.c, last.s) : M.openReview(last.e, last.c));
      document.querySelector('#content').append(resume);
    }
    if (admin) {
      document.querySelector('#home-import').onclick = () => M.run(() => M.openAdmin('import'));
      document.querySelector('#home-analysis').onclick = () => M.run(() => M.openAnalytics());
      document.querySelector('#home-monitor').onclick = () => M.run(() => M.openAdmin('operations'));
      document.querySelector('#home-template').onclick = () => {
        const bytes = Uint8Array.from(atob(window.MPS_SCHOOL_TEMPLATE), c => c.charCodeAt(0));
        M.download('MPS-eAssessment-School-Setup-2026.xlsx', new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }));
      };
      try {
        const links = await M.call('adminLinks');
        const host = document.querySelector('#home-data-link');
        if (host && links.database_url && /^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(links.database_url)) {
          const a = document.createElement('a');
          a.href = links.database_url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = 'Buka Pangkalan Data (Pentadbir)';
          host.append(a);
        }
      } catch (e) {
        /* The import and task controls remain usable if link lookup fails. */ }
    }
  };
  const enter = async (prefetched = null) => {
    const d = prefetched || await M.call('dashboard');
    if (M.user?.user_id === d.user.user_id) await M.guard();
    else if (M.storageFault && (M.pending.size || M.inflight || M.rawDrafts.size || M.remarkPending.size || M.remarkInflight)) throw new Error('Draf belum diselaraskan dan browser tidak dapat menyimpannya. Log masuk akaun asal untuk memulihkan draf sebelum menukar pengguna.');
    // Keep stored drafts scoped to their user, but never display a previous user's screen after login.
    M.pending = new Map();
    M.inflight = null;
    M.remarkPending = new Map();
    M.remarkInflight = null;
    M.remarkFlush = null;
    M.context = null;
    M.conflict = null;
    M.invalid.clear();
    M.rawDrafts.clear();
    M.storageFault = false;
    document.querySelector('#content').replaceChildren();
    M.notice(M.authStorageFault ? 'Simpanan browser tidak tersedia. Sesi ini memerlukan log masuk semula selepas refresh.' : '');
    M.user = d.user;
    document.querySelector('main').hidden = true;
    document.querySelector('#workspace').hidden = false;
    document.querySelector('#user-label').textContent = M.user.full_name;
    document.querySelector('#admin-nav').hidden = !M.user.roles.includes('ADMINISTRATOR');
    await M.openDashboard(d);
  };
  M.enterWorkspace = enter;
  M.installOnboarding();
  const login = document.querySelector('#login-form');

  login.onsubmit = e => {
    e.preventDefault();

    const button = login.querySelector('button');

    // Prevent duplicate login requests.
    if (button.disabled) return;

    button.disabled = true;

    const f = new FormData(login);

    (async () => {
      try {
        // Show loading immediately.
        M.showLoader('Mengesahkan akaun anda…');

        document.querySelector('#login-status').textContent =
          'Mengesahkan…';

        const code = String(f.get('code')).trim().toUpperCase();
        const alias = f.get('alias').trim().toLowerCase();

        // Step 1: Get authentication challenge.
        const challenge = await M.call('challenge', {
          code,
          alias
        });

        // Step 2: Generate secure PIN proof.
        document.querySelector('#loader-message').textContent =
          'Mengesahkan PIN individu…';

        const proof = await M.proof(
          f.get('pin'),
          challenge.salt,
          challenge.iterations
        );

        // Step 3: Authenticate user.
        const session = await M.call('login', {
          code,
          alias,
          proof
        });

        M.token = session.token;

        M.authStore('setItem', 'mps-token', M.token);

        login.reset();

        document.querySelector('#login-status').textContent = '';

        // Step 4: Load the dashboard.
        document.querySelector('#loader-message').textContent =
          'Menyediakan dashboard anda…';

        await enter();

        // Step 5: Hide loading only after dashboard is ready.
        await M.hideLoader();

      } catch (error) {

        // Display the actual error.
        document.querySelector('#login-status').textContent =
          error.message;

        // Do not leave the loading screen stuck.
        await M.hideLoader();

      } finally {

        button.disabled = false;

      }
    })();
  };
  M.installViewTransitions();
  document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => M.run(() => ({
    dashboard: M.openDashboard,
    analytics: M.openAnalytics,
    admin: M.openAdmin
  } [button.dataset.route])()));
  document.querySelector('#logout').onclick = () => M.run(async () => {
    await M.guard();
    M.checkLogoutDrafts();
    await M.call('logout', {}, true);
    try {
      for (const k of Object.keys(sessionStorage))
        if (k === 'mps-token' || k === 'mps-last-task' || k.startsWith('mps-draft:' + M.user.user_id + ':') || k.startsWith('mps-remarks:' + M.user.user_id + ':')) sessionStorage.removeItem(k);
    } catch (e) {}
    M.pending.clear();
    M.inflight = null;
    M.remarkPending.clear();
    M.remarkInflight = null;
    M.remarkFlush = null;
    M.currentMarks = [];
    M.context = null;
    M.openCurrent = null;
    M.user = null;
    document.querySelector('#content').replaceChildren();
    M.expire();
    document.querySelector('#login-status').textContent = 'Anda telah log keluar.';
  });
  window.addEventListener('beforeunload', e => {
    if (M.schoolBusy || M.invalid.size || M.pending.size || M.inflight || M.remarkPending.size || M.remarkInflight) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('online', () => M.run(M.guard));
  if (window.google?.script?.run) {
    login.hidden = false;
    document.querySelector('#static-access').hidden = true;
    document.querySelector('#hosting-note').textContent =
      'Kod guru mengenal pasti akaun. PIN individu mengesahkan akses anda.';
    document.querySelector('#workspace-link').href = '#access';
    M.call('public').then(p => {
      document.querySelector('#public-numbers').innerHTML = [
        ['Murid', p.students],
        ['Kelas', p.classes],
        ['Subjek', p.subjects],
        ['Tahun Akademik', p.year]
      ].map(([label, n]) =>
        `<div class="metric"><strong>${M.esc(n??'—')}</strong><span>${label}</span></div>`).join('');
      document.querySelector('#public-pulse').innerHTML =
        `<p>${p.exam?M.esc(p.exam.type)+' · '+M.esc(p.exam.status):'Tiada peperiksaan aktif'}</p><p>Tahap 1 · Tahun 1–3</p><p>Tahap 2 · Tahun 4–6</p>`;
    }).catch(() => {
      document.querySelector('#public-pulse').textContent = 'Maklumat peperiksaan belum tersedia.';
    });
    if (M.token) {
      M.run(async () => {
        try {
          // Show loading while restoring the session.
          M.showLoader('Memulihkan sesi anda…');

          // Restore user session and load dashboard.
          await enter();

        } catch (error) {
          // Clear an invalid session.
          if (error.code === 'SESSION') {
            M.token = '';
            M.authStore('removeItem', 'mps-token');
          }

          throw error;

        } finally {
          // Fade out after the dashboard is ready,
          // or after an error has been handled.
          await M.hideLoader();
        }
      });
    }
  } else {
    const url = window.MPS_CONFIG?.workspaceUrl;
    const valid = /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url || '');
    document.querySelectorAll('#workspace-link,#static-access').forEach(a => {
      a.href = valid ? url : '#access';
    });
    if (!valid) document.querySelector('#hosting-note').textContent =
      'Tetapkan workspaceUrl dalam config.js selepas deployment Apps Script.';
  }
})(window.MPS);
