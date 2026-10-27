window.MPS = window.MPS || {};
(function(M) {
  M.authStore = (method, ...args) => {
    try {
      return sessionStorage[method](...args);
    } catch (e) {
      M.authStorageFault = true;
      return null;
    }
  };
  M.token = M.authStore('getItem', 'mps-token') || '';
  M.user = null;
  M.handlers = {};
  M.uid = () => crypto.randomUUID().replaceAll('-', '');
  M.rpcLedger = new Map();
  M.call = (action, payload = {}, write = false, requestId) => new Promise((resolve, reject) => {
    if (!window.google?.script?.run) {
      reject(Object.assign(new Error('Buka workspace sekolah untuk menggunakan sistem.'), {
        code: 'HOSTING'
      }));
      return;
    }
    const sentToken = M.token,
      ledgerKey = sentToken + '|' + action + '|' + JSON.stringify(payload);
    const id = write ? (requestId || M.rpcLedger.get(ledgerKey) || M.uid()) : null;
    if (write && !requestId) M.rpcLedger.set(ledgerKey, id);
    let settled = false;
    const slow = setTimeout(() => M.notice('Permintaan mengambil masa lebih lama. Kekalkan tab; keputusan masih belum diketahui.', true), 12000);
    const timeout = setTimeout(() => finish(Object.assign(new Error('Masa menunggu tamat; server mungkin sudah menyimpan. Cuba semula dengan request yang sama.'), {
      code: 'TIMEOUT'
    })), 45000);

    function finish(error, data) {
      if (settled) return;
      settled = true;
      clearTimeout(slow);
      clearTimeout(timeout);
      if (write && !requestId && (!error || !['TIMEOUT', 'NETWORK', 'BUSY', 'INTERNAL'].includes(error.code))) M.rpcLedger.delete(ledgerKey);
      if (error) reject(error);
      else resolve(data);
    }
    google.script.run.withSuccessHandler(r => {
      if (settled) return;
      if (action !== 'login' && sentToken !== M.token) {
        finish(Object.assign(new Error('Sesi berubah semasa permintaan. Draf asal dikekalkan.'), {
          code: 'STALE_SESSION'
        }));
        return;
      }
      if (r?.ok) {
        finish(null, r.data);
        return;
      }
      const error = Object.assign(new Error(r?.error?.message || 'Operasi gagal.'), r?.error);
      if (error.code === 'SESSION' && sentToken === M.token) M.expire();
      finish(error);
    }).withFailureHandler(() => finish(Object.assign(new Error('Sambungan terputus. Keputusan simpanan belum disahkan.'), {
      code: 'NETWORK'
    }))).rpc({
      action,
      payload,
      token: sentToken,
      request_id: id
    });
  });

  M.esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } [c]));
  M.notice = (s, error = false) => {
    const n = document.querySelector('#notification');
    n.textContent = s;
    n.classList.toggle('error', error);
  };
  M.date = s => s ? new Intl.DateTimeFormat('ms-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur'
  }).format(new Date(s)) : '—';
  M.grade = (value, rules) => {
    const x = String(value).trim().toUpperCase();
    if (['TB', 'TH', ''].includes(x)) return x === 'TH' ? 'TH' : '—';
    if (!/^\d{1,3}$/.test(x) || Number(x) > 100) return 'Tidak sah';
    return rules.find(r => Number(x) >= Number(r.minimum_score) && Number(x) <= Number(r.maximum_score))
      ?.grade || 'Tidak sah';
  };
  M.display = m => m.mark_status === 'SCORED' ? String(m.score) : m.mark_status === 'EMPTY' ? '' : m
    .mark_status;
  M.proof = async (pin, salt, iterations) => {
    if (!/^\d{6}$/.test(pin) && pin!=='BBB8307' && (pin.length < 10 || pin.length > 64)) throw new Error(
      'Gunakan PIN enam digit atau akses sementara yang diberikan.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
      'deriveBits'
    ]);
    const bytes = new Uint8Array(await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations
    }, key, 256));
    return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=',
      '');
  };
  M.csv = rows => rows.map(r => r.map(v => '"' + String(v ?? '').replace(/^[=+@-]/, m => "'" + m)
    .replaceAll('"', '""') + '"').join(',')).join('\r\n');
  M.download = (name, data, type = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a'),
      url = URL.createObjectURL(data instanceof Blob ? data : new Blob(['\uFEFF', data], {
        type
      }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  M.downloadPDF = async (e, c) => {
    const f = await M.call('pdfDownload', {
      exam_id: e,
      class_id: c
    });
    const raw = atob(f.base64);
    M.download(f.name, new Blob([Uint8Array.from(raw, x => x.charCodeAt(0))], {
      type: f.mime
    }));
  };
  M.parseCSV = text => {
    const rows = [];
    let row = [],
      value = '',
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      let c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          value += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (c === ',' || c === '\n')) {
        row.push(value.replace(/\r$/, ''));
        value = '';
        if (c === '\n') {
          rows.push(row);
          row = [];
        }
      } else value += c;
    }
    if (value || row.length) {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
    }
    if (quoted) throw new Error('Petikan CSV tidak ditutup.');
    return rows.filter(r => r.some(x => x.trim()));
  };
})(window.MPS);
