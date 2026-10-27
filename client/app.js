(function(M) {
  M.expire = () => {
    M.invalidateViews();M.stopRefresh();
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
    await M.guard();M.view('dashboard');
    let d=prefetched||await M.read(M.adminMode?'dashboard':'personalDashboard');if(d.user.roles.includes('ADMINISTRATOR')&&!M.adminMode&&!d.tasks.length){M.adminMode=true;d=await M.read('dashboard');}M.teacherFocus=d.teacher_exam_focus||'UASA';
    M.context=null;M.remarkFlush=null;
    const isAdmin=d.user.roles.includes('ADMINISTRATOR'),admin=isAdmin&&!!M.adminMode,exam=M.currentExam(d.exams),tasks=d.tasks.filter(t=>!exam||t.exam.exam_id===exam.exam_id);
    const count=t=>Object.values(t.stats.status).reduce((n,v)=>n+Number(v||0),0),progress=t=>count(t)?Math.round(100*(count(t)-Number(t.stats.status.EMPTY||0))/count(t)):0;
    const total=tasks.reduce((n,t)=>n+count(t),0),empty=tasks.reduce((n,t)=>n+Number(t.stats.status.EMPTY||0),0),final=tasks.filter(t=>t.metadata?.finalized_at).length,subs=tasks.flatMap(t=>t.submissions||[]),submitted=subs.filter(s=>['SUBMITTED','AMENDED'].includes(s.status)).length;
    const content=document.querySelector('#content');
    const taskState=t=>t.metadata?.finalized_at?'verified':t.assignment.subject_code&&t.submission&&t.submission.submission_status!=='DRAFT'?'submitted':count(t)&&progress(t)===100?'filled':'pending';
    content.innerHTML=`<p class="welcome-greeting">Selamat datang, Cikgu ${M.esc(d.user.full_name)}!</p><p class="eyebrow">${admin?'PUSAT PENTADBIR':'TUGASAN SAYA'}</p><h2>${exam?M.esc(exam.exam_type+' '+exam.academic_year):'Workspace sekolah'}</h2><p>${exam?M.esc(exam.status)+' · Pengisian sehingga '+M.date(exam.closing_date):'Peperiksaan belum disediakan.'}</p>${M.refreshBar()}${isAdmin?`<button id="switch-admin-mode" class="secondary">${admin?'Tugasan Saya':'Pentadbiran Sekolah'}</button>`:''}${admin?`<div class="metrics"><div class="metric"><strong>${total?Math.round(100*(total-empty)/total):0}%</strong><span>Pengisian</span></div><div class="metric"><strong>${submitted}/${subs.length}</strong><span>Subjek dihantar</span></div><div class="metric"><strong>${final}/${tasks.length}</strong><span>Kelas disahkan</span></div><div class="metric"><strong>${empty}</strong><span>Markah belum diisi</span></div></div><div class="workspace-actions"><button id="home-monitor">Pantau Guru</button><button id="home-analysis">Analisis</button><button id="home-import">Urus Sekolah</button></div><p class="muted">Mulakan dengan kelas yang belum lengkap. TB lalai tidak menaikkan peratus pengisian.</p>`:`<div class="role-switch"><button data-role-view="subject" aria-pressed="true">Subjek Saya</button>${tasks.some(t=>!t.assignment.subject_code)?'<button data-role-view="class" aria-pressed="false">Kelas Saya</button>':''}</div><p id="role-help">Isi markah, simpan dan hantar untuk semakan guru kelas.</p>`}<div class="task-grid">${tasks.map((t,i)=>`<article class="task-card task-${taskState(t)}" data-role-card="${t.assignment.subject_code?'subject':'class'}"><span class="status-badge">${t.metadata?.finalized_at?'Kelas disahkan':t.assignment.subject_code?taskState(t)==='submitted'?'Selesai dihantar':taskState(t)==='filled'?'Lengkap diisi · Belum disahkan':t.submission?'Draf · Sedang diisi':'Belum disediakan':t.gate?.ready?'Sedia disemak':'Menunggu guru subjek'}</span><h3>${M.esc(t.class.class_name)}${t.assignment.subject_code?' · '+M.esc(t.assignment.subject_code):''}</h3><p>${count(t)?progress(t)+'% diisi · '+Number(t.stats.status.EMPTY||0)+' belum diisi':'Markah belum disediakan'}</p><progress max="100" value="${progress(t)}"></progress>${!t.assignment.subject_code&&t.gate&&!t.gate.ready?`<p>Belum dihantar: ${M.esc(t.gate.missing.join(', '))}</p>`:''}<button data-task="${i}" ${t.exam.status==='DRAFT'?'disabled':''}>${t.assignment.subject_code?(taskState(t)==='submitted'||taskState(t)==='verified'?'Lihat Markah':taskState(t)==='filled'||Number(t.stats.status.SCORED||0)+Number(t.stats.status.TH||0)>0?'Kemaskini Markah':'Isi Markah'):admin?'Lihat Kelas':'Semak Kelas & Ulasan'}</button></article>`).join('')}</div>${!tasks.length?'<p class="empty-state">Tugasan belum disediakan. Hubungi pentadbir.</p>':''}`;
    if(isAdmin)document.querySelector('#switch-admin-mode').onclick=()=>M.run(async()=>{M.adminMode=!admin;await M.renderDashboard();});
    if(!admin){let mode=tasks.some(t=>t.assignment.subject_code)?'subject':'class';const choose=()=>{content.querySelectorAll('[data-role-card]').forEach(c=>c.hidden=c.dataset.roleCard!==mode);content.querySelectorAll('[data-role-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roleView===mode)));document.querySelector('#role-help').textContent=mode==='class'?'Pantau penghantaran subjek. Edit, ulasan dan pengesahan dibuka selepas semua subjek dihantar.':'Isi markah, simpan dan hantar untuk semakan guru kelas.';};content.querySelectorAll('[data-role-view]').forEach(b=>b.onclick=()=>{mode=b.dataset.roleView;M.roleTab=mode;choose();});if(M.roleTab&&tasks.some(t=>(t.assignment.subject_code?'subject':'class')===M.roleTab))mode=M.roleTab;choose();}
    content.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>M.run(async()=>{const t=tasks[Number(b.dataset.task)];M.authStore('setItem','mps-last-task',JSON.stringify({e:t.exam.exam_id,c:t.class.class_id,s:t.assignment.subject_code}));if(t.assignment.subject_code)await M.openMarks(t.exam.exam_id,t.class.class_id,t.assignment.subject_code);else await M.openReview(t.exam.exam_id,t.class.class_id);}));
    if(admin){document.querySelector('#home-import').onclick=()=>M.run(()=>M.openAdmin());document.querySelector('#home-analysis').onclick=()=>M.run(()=>M.openAnalytics());document.querySelector('#home-monitor').onclick=()=>M.run(()=>M.openAnalytics());}
    M.view('dashboard',async()=>{const fresh=await M.read(M.adminMode?'dashboard':'personalDashboard',{},true);if(M.viewName==='dashboard')await M.renderDashboard(fresh);});M.bindRefresh();M.prefetchRole();
  };
  M.renderDashboard=M.openDashboard;
  const enter = async (prefetched = null) => {
    M.adminMode=false;
    const d = prefetched || await M.call('personalDashboard');
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

        const code = String(f.get('code')).trim().toLowerCase();
        const alias = '';

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

        if(session.change_required){M.startPinChange(session,code);document.querySelector('#login-status').textContent='Tetapkan PIN enam digit di bawah.';await M.hideLoader();return;}
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
      'Gunakan emel sekolah dan PIN anda. Kali pertama: BBB8307, kemudian tetapkan PIN enam digit.';
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
