/* Source-compatible enhancements. No active mark/permission data is shared across users or tabs. */
(function(M) {
  M.blockedDrafts = new Set();
  M.checkOtherDrafts = () => {
    const prefix = 'mps-draft:' + M.user.user_id + ':' + M.context.exam_id + ':' + M.context.class_id;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key !== M.draftKey && key.startsWith(prefix)) {
          const d = JSON.parse(sessionStorage.getItem(key));
          if (d.pending?.length || d.inflight || d.invalid?.length) throw new Error('Masih ada draf subjek lain untuk kelas ini. Buka dan selaraskan draf tersebut sebelum pemuktamadan.');
        }
      }
    } catch (e) {
      throw new Error(e.message || 'Draf tempatan tidak dapat disemak.');
    }
  };
  M.checkLogoutDrafts = () => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k.startsWith('mps-draft:' + M.user.user_id + ':') || k.startsWith('mps-remarks:' + M.user.user_id + ':')) {
        let d;
        try {
          d = JSON.parse(sessionStorage.getItem(k));
        } catch (e) {
          throw new Error('Draf rosak masih ada. Eksport dan semak sebelum keluar.');
        }
        if (d.pending?.length || d.inflight || d.invalid?.length) throw new Error('Ada draf belum diselaraskan dalam tugasan lain. Buka dan selaraskannya sebelum keluar.');
      }
    }
  };
  M.activeCorruptKey = () => [...M.blockedDrafts].find(k => k === M.draftKey || M.context && k === `mps-remarks:${M.user.user_id}:${M.context.exam_id}:${M.context.class_id}`);
  M.rawDrafts = new Map();
  M.storageFault = false;
  M.latestSave = null;
  M.readDraft = (key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.pending) || d.inflight && (!d.inflight.id || !d.inflight.payload)) throw new Error();
      if (Date.now() - d.time > 8 * 3600000) {
        M.notice('Draf lama ditemui. Semak dengan rekod server sebelum menyimpan; semakan versi masih diwajibkan.', true);
        d.expired = true;
      }
      return d;
    } catch (e) {
      M.blockedDrafts.add(key);
      M.storageFault = true;
      M.notice('Draf tempatan tidak dapat dibaca. Jangan tutup tab; eksport draf atau hubungi pentadbir.', true);
      return null;
    }
  };
  M.writeDraft = (key, d) => {
    if (!key) return true;
    if (M.blockedDrafts.has(key)) {
      M.storageFault = true;
      return false;
    }
    try {
      const dirty = d.pending.length || d.inflight || d.invalid?.length;
      if (dirty) sessionStorage.setItem(key, JSON.stringify({
        ...d,
        version: 2
      }));
      else sessionStorage.removeItem(key);
      M.storageFault = false;
      return true;
    } catch (e) {
      M.storageFault = true;
      M.notice('Pemulihan tempatan tidak tersedia. Kekalkan tab terbuka sehingga simpanan server disahkan.', true);
      return false;
    }
  };
  M.exportDraft = () => {
    const data = {
      scope: M.context,
      marks: [...M.pending],
      inflight: M.inflight,
      invalid: [...M.rawDrafts],
      unreadable: [...M.blockedDrafts].filter(k => k.includes(':' + M.user.user_id + ':')).map(k => [k, sessionStorage.getItem(k)]),
      remarks: [...M.remarkPending],
      remarkInflight: M.remarkInflight
    };
    M.download('MPS-draf-peribadi.json', JSON.stringify(data, null, 2), 'application/json');
  };
  let count = 0,
    generation = 0;
  M.showLoader = (message = 'Memuatkan data…') => {
    count++;
    generation++;
    const l = document.querySelector('#mps-loader');
    l.hidden = false;
    l.classList.remove('is-closing');
    document.querySelector('#loader-message').textContent = message;
    document.querySelector('#workspace').setAttribute('aria-busy', 'true');
  };
  M.hideLoader = async () => {
    count = Math.max(0, count - 1);
    if (count) return;
    const epoch = generation,
      l = document.querySelector('#mps-loader');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (count || epoch !== generation) return;
    l.classList.add('is-closing');
    await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300));
    if (count || epoch !== generation) return;
    l.hidden = true;
    l.classList.remove('is-closing');
    document.querySelector('#workspace').setAttribute('aria-busy', 'false');
  };
  M.run = async fn => {
    const active = document.activeElement,
      button = active instanceof HTMLButtonElement ? active : (M.lastSubmit && performance.now() - M.lastSubmit.time < 50 ? M.lastSubmit.form.querySelector('button:not([type=button])') : null);
    if (button?.dataset.processing) return;
    const disabled = button?.disabled,
      label = button?.textContent;
    if (button) {
      button.dataset.processing = 'true';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Memproses…';
    }
    try {
      return await fn();
    } catch (e) {
      M.notice(e.message, true);
      return null;
    } finally {
      if (button?.isConnected) {
        button.disabled = disabled;
        button.textContent = label;
        button.removeAttribute('aria-busy');
        delete button.dataset.processing;
      }
    }
  };
  M.installViewTransitions = () => {
    let transitioning = false;
    ['openDashboard', 'openMarks', 'openReview', 'openAnalytics', 'openAdmin'].forEach(name => {
      const original = M[name];
      M[name] = async (...args) => {
        if (transitioning) throw new Error('Paparan sedang dimuatkan. Tunggu sebentar.');
        transitioning = true;
        const route = name === 'openAdmin' ? 'admin' : name === 'openAnalytics' ? 'analytics' : 'dashboard';
        M.notice('');
        M.showLoader('Menyediakan paparan…');
        try {
          const result = await original(...args);
          document.querySelectorAll('[data-route]').forEach(b => {
            const active = b.dataset.route === route;
            b.classList.toggle('nav-active', active);
            if (active) b.setAttribute('aria-current', 'page');
            else b.removeAttribute('aria-current');
          });
          const heading = document.querySelector('#content h2');
          if (heading) {
            heading.tabIndex = -1;
            heading.focus({
              preventScroll: true
            });
          }
          return result;
        } finally {
          await M.hideLoader();
          transitioning = false;
        }
      };
    });
  };
  M.recoveryPanel = () => {
    const corruptKey = M.activeCorruptKey();
    if (corruptKey) {
      const box = document.querySelector('#conflict');
      if (!box) return;
      box.hidden = false;
      box.innerHTML = '<p>Draf tidak dapat dibaca. Eksport salinan sebelum membuang draf rosak. Penyimpanan dan navigasi ditahan untuk melindungi draf.</p><button id=export-draft>Eksport Draf</button><button id=clear-corrupt>Buang Draf Rosak & Muat Semula</button>';
      document.querySelector('#export-draft').onclick = M.exportDraft;
      document.querySelector('#clear-corrupt').onclick = () => M.run(async () => {
        if (!confirm('Pastikan draf telah dieksport. Buang draf rosak ini?')) return;
        sessionStorage.removeItem(corruptKey);
        M.blockedDrafts.delete(corruptKey);
        M.storageFault = false;
        await M.openCurrent();
      });
      return;
    }
    if (!(M.pending.size || M.inflight || M.rawDrafts.size)) return;
    const node = document.querySelector('#conflict');
    if (!node) return;
    node.hidden = false;
    node.innerHTML = '<p>Draf tempatan dipulihkan. Semak nilainya sebelum menyimpan. Tiada draf dianggap sudah disimpan pada server.</p><button id="export-draft">Eksport Draf</button><button id="retry-draft">Cuba Simpan</button><button id="discard-draft">Buang Draf & Muat Semula</button>';
    document.querySelector('#export-draft').onclick = M.exportDraft;
    document.querySelector('#retry-draft').onclick = () => M.run(M.flush);
    document.querySelector('#discard-draft').onclick = () => M.run(async () => {
      if (!confirm('Buang draf markah yang belum diselaraskan? Eksport dahulu jika perlu.')) return;
      M.pending.clear();
      M.inflight = null;
      M.rawDrafts.clear();
      M.invalid.clear();
      M.persist();
      await M.openCurrent();
    });
  };
  document.addEventListener('click', e => {
    const tab = e.target.closest('.tabs button');
    if (tab) {
      tab.closest('.tabs').querySelectorAll('button').forEach(b => {
        const active = b === tab;
        b.classList.toggle('tab-active', active);
        b.setAttribute('aria-selected', String(active));
      });
    }
  });
})(window.MPS);
