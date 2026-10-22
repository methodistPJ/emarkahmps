(function(M) {
  M.expire = () => {
    M.refreshAdminData=null;document.querySelector('#issued-activation')?.replaceChildren();
    clearTimeout(M.saveTimer);
    clearTimeout(M.remarkTimer);
    M.token = '';
    M.authStore('removeItem','mps-token');
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
    document.querySelector('#content').innerHTML =
      `<p class="eyebrow">YOUR ASSESSMENT WORKSPACE</p><h2>Every step <em>counts.</em></h2><p>Pilih tugasan untuk menyambung pengisian atau semakan kelas.</p><div class="table-scroll"><table><thead><tr><th>Peperiksaan</th><th>Kelas</th><th>Subjek / Tugas</th><th>Angka / TH / TB / EMPTY</th><th>Status</th><th>Tarikh Akhir</th><th>Tindakan</th></tr></thead><tbody>${d.tasks.map((t,i)=>`<tr><td>${M.esc(t.exam.exam_type+' '+t.exam.academic_year)}</td><td>${M.esc(t.class.class_name)}</td><td>${M.esc(t.assignment.subject_code||'Semakan Kelas')}</td><td>${Object.values(t.stats.status).join(' / ')}</td><td>${M.esc(t.submission?.submission_status||t.metadata?.pdf_status||t.exam.status)}</td><td>${M.date(t.exam.closing_date)}</td><td><button data-task="${i}">${t.assignment.subject_code?'Sambung Pengisian':'Semak Kelas'}</button></td></tr>`).join('')}</tbody></table></div>${!d.tasks.length?'<p class="empty-state">Belum ada tugasan. Hubungi pentadbir untuk menyediakan peperiksaan dan tugasan anda.</p>':''}`;
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => M.run(async () => {
      const t = d.tasks[Number(b.dataset.task)];
      M.authStore('setItem','mps-last-task', JSON.stringify({
        e: t.exam.exam_id,
        c: t.class.class_id,
        s: t.assignment.subject_code
      }));
      if (t.assignment.subject_code) await M.openMarks(t.exam.exam_id, t.class.class_id, t
        .assignment.subject_code);
      else await M.openReview(t.exam.exam_id, t.class.class_id);
    }));
    let last=null;try{last=JSON.parse(M.authStore('getItem','mps-last-task')||'null');}catch(e){}
    if (last && d.tasks.some(t => t.exam.exam_id === last.e && t.class.class_id === last.c && (t
        .assignment.subject_code || '') === (last.s || ''))) {
      const button = document.createElement('button');
      button.textContent = 'Sambung Tugasan Terakhir';
      button.onclick = () => M.run(() => last.s ? M.openMarks(last.e, last.c, last.s) : M.openReview(
        last.e, last.c));
      document.querySelector('#content').append(button);
    }
  };
  const enter = async (prefetched=null) => {
    const d = prefetched || await M.call('dashboard');
    if(M.user?.user_id===d.user.user_id)await M.guard();
    else if(M.storageFault&&(M.pending.size||M.inflight||M.rawDrafts.size||M.remarkPending.size||M.remarkInflight))throw new Error('Draf belum diselaraskan dan browser tidak dapat menyimpannya. Log masuk akaun asal untuk memulihkan draf sebelum menukar pengguna.');
    // Keep stored drafts scoped to their user, but never display a previous user's screen after login.
    M.pending = new Map();
    M.inflight = null;
    M.remarkPending = new Map();
    M.remarkInflight = null;
    M.remarkFlush = null;
    M.context = null;
    M.conflict = null;
    M.invalid.clear();M.rawDrafts.clear();M.storageFault=false;
    document.querySelector('#content').replaceChildren();
    M.notice(M.authStorageFault?'Simpanan browser tidak tersedia. Sesi ini memerlukan log masuk semula selepas refresh.':'');
    M.user = d.user;
    document.querySelector('main').hidden = true;
    document.querySelector('#workspace').hidden = false;
    document.querySelector('#user-label').textContent = M.user.full_name;
    document.querySelector('#admin-nav').hidden = !M.user.roles.includes('ADMINISTRATOR');
    await M.openDashboard(d);
  };
  M.enterWorkspace=enter;M.installOnboarding();
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

      const code = f.get('code');
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

      M.authStore('setItem','mps-token',M.token);

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
  document.querySelectorAll('[data-route]').forEach(button=>button.onclick=()=>M.run(()=>({dashboard:M.openDashboard,analytics:M.openAnalytics,admin:M.openAdmin}[button.dataset.route])()));
  document.querySelector('#logout').onclick = () => M.run(async () => {
    await M.guard();
    M.checkLogoutDrafts();
    await M.call('logout', {}, true);
    try{for(const k of Object.keys(sessionStorage))if(k==='mps-token'||k==='mps-last-task'||k.startsWith('mps-draft:'+M.user.user_id+':')||k.startsWith('mps-remarks:'+M.user.user_id+':'))sessionStorage.removeItem(k);}catch(e){}
    M.pending.clear();
    M.inflight = null;
    M.remarkPending.clear();
    M.remarkInflight = null;
    M.remarkFlush = null;
    M.currentMarks=[];M.context=null;M.openCurrent=null;M.user=null;document.querySelector('#content').replaceChildren();
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
      'Enam digit pengenalan mengenal pasti akaun. PIN individu mengesahkan akses anda.';
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
        M.authStore('removeItem','mps-token');
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
