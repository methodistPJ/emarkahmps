(function(M) {
  M.temporaryProof = async (pin, salt, iterations) => {
    if (pin !== 'BBB8307') throw new Error('Gunakan PIN sementara sekolah BBB8307.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const raw = new Uint8Array(await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations
    }, key, 256));
    return btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  };
  M.installOnboarding = () => {
    const box = document.querySelector('#activation-panel');
    if (!box || !window.google?.script?.run) return;
    box.innerHTML = '<details><summary>Guru baharu: Aktifkan Akaun</summary><p>PIN sementara BBB8307 sahaja tidak mencukupi. Dapatkan kod pengaktifan individu daripada pentadbir selepas identiti anda disahkan.</p><form id="activation-form"><label>Kod guru<input name="code" required pattern="([0-9]{6}|[A-Za-z][A-Za-z0-9_-]{1,29})" minlength="2" maxlength="30" autocapitalize="characters" spellcheck="false" autocomplete="username"></label><label>PIN sementara<input type="password" name="temporary_pin" minlength="7" maxlength="7" required autocomplete="off"></label><label>Kod pengaktifan individu<input name="activation_code" minlength="24" maxlength="24" required autocomplete="off"></label><button>Sahkan Pengaktifan</button></form><div id="activation-next"></div><p id="activation-status" role="status" aria-live="polite"></p></details>';
    document.querySelector('#activation-form').onsubmit = e => {
      e.preventDefault();
      M.run(async () => {
        const status = document.querySelector('#activation-status'),
          f = new FormData(e.target),
          code = String(f.get('code')).trim().toUpperCase(),
          alias = String(f.get('alias') || '').trim().toLowerCase();
        status.textContent = 'Mengesahkan maklumat…';
        try {
          const challenge = await M.call('challenge', {
              code,
              alias
            }),
            proof = await M.temporaryProof(f.get('temporary_pin'), challenge.salt, challenge.iterations),
            verified = await M.call('activationBegin', {
              code,
              alias,
              proof,
              activation_code: String(f.get('activation_code')).trim()
            });
          e.target.reset();
          e.target.hidden = true;
          status.textContent = 'Identiti disahkan. Tetapkan PIN individu dalam masa 10 minit.';
          document.querySelector('#activation-next').innerHTML = '<form id="permanent-pin-form"><label>PIN individu baharu (10–64 aksara)<input type="password" name="pin" minlength="10" maxlength="64" required autocomplete="new-password"></label><label>Sahkan PIN individu<input type="password" name="confirm" minlength="10" maxlength="64" required autocomplete="new-password"></label><button>Tetapkan PIN & Masuk Workspace</button></form>';
          document.querySelector('#permanent-pin-form').onsubmit = event => {
            event.preventDefault();
            M.run(async () => {
              const next = new FormData(event.target),
                pin = String(next.get('pin'));
              try {
                if (pin !== next.get('confirm')) throw new Error('Pengesahan PIN tidak sepadan.');
                const permanent = await M.proof(pin, verified.salt, verified.iterations);
                status.textContent = 'Menetapkan PIN individu…';
                await M.call('activationFinish', {
                  ticket: verified.ticket,
                  proof: permanent,
                  salt: verified.salt,
                  pin_length: pin.length
                });
                event.target.reset();
                document.querySelector('#activation-next').replaceChildren();
                status.textContent = 'PIN individu telah ditetapkan. Log masuk menggunakan PIN baharu jika sambungan berikut terputus.';
                const session = await M.call('login', {
                  code,
                  alias,
                  proof: permanent
                });
                M.token = session.token;
                M.authStore('setItem', 'mps-token', M.token);
                await M.enterWorkspace();
              } catch (error) {
                status.textContent = error.message;
                throw error;
              }
            });
          };
        } catch (error) {
          status.textContent = error.message;
          throw error;
        }
      });
    };
  };
})(window.MPS);
