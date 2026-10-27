/* In-memory, session-scoped read-ahead; writes and expiry invalidate every cached view. */
(function(M){
  const cache=new Map(),pending=new Map();let generation=0,viewTimer=null,refreshBusy=false;
  M.invalidateViews=()=>{generation++;cache.clear();pending.clear();M.lastRevision=null;};
  const call=M.call;
  M.call=(action,payload={},write=false,id)=>{if(write)M.invalidateViews();return call(action,payload,write,id);};
  M.read=async(action,payload={},fresh=false)=>{
    const key=M.token+'|'+action+'|'+JSON.stringify(payload),entry=cache.get(key),epoch=generation;
    if(!fresh&&entry&&Date.now()-entry.time<20000)return structuredClone(entry.value);
    if(pending.has(key))return structuredClone(await pending.get(key));
    const task=M.call(action,payload);pending.set(key,task);
    try{const value=await task;if(epoch!==generation)throw Object.assign(new Error('Paparan berubah; data lama diabaikan.'),{code:'STALE_VIEW'});if(epoch===generation){if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),value});}return structuredClone(value);}
    finally{if(pending.get(key)===task)pending.delete(key);}
  };
  M.currentExam=exams=>exams.find(e=>e.exam_type===M.teacherFocus)||exams.find(e=>e.status==='OPEN'&&e.exam_type==='UASA')||exams.find(e=>e.status==='OPEN')||exams.find(e=>e.exam_type==='UASA')||exams[0];
  M.dirty=()=>!!(M.saving||M.pending?.size||M.inflight||M.remarkPending?.size||M.remarkInflight||M.invalid?.size||M.schoolBusy);
  M.stopRefresh=()=>{clearInterval(viewTimer);viewTimer=null;};
  M.view=(name,refresh)=>{
    M.stopRefresh();M.viewName=name;
    if(!refresh)return;
    const stamp=()=>{const n=document.querySelector('#view-updated');if(n)n.textContent='Data dimuat semula '+M.date(new Date().toISOString());};
    M.refreshView=async()=>{if(refreshBusy||document.hidden||!M.token||M.dirty()||document.querySelector('dialog[open]')||document.querySelector('#mps-loader:not([hidden])')||document.activeElement?.matches('input,textarea,select'))return;refreshBusy=true;try{const version=await M.call('revision');if(M.lastRevision===version.revision)return;await refresh();M.lastRevision=version.revision;stamp();}catch(e){if(e.code==='SESSION')M.stopRefresh();}finally{refreshBusy=false;}};
    stamp();viewTimer=setInterval(()=>M.refreshView(),45000);
  };
  M.statusLabel=s=>({DRAFT:'Draf',OPEN:'Dibuka',CLOSED:'Ditutup',FINALIZED:'Dimuktamadkan',SUBMITTED:'Dihantar',AMENDED:'Dikemas kini',EMPTY:'Belum diisi',SCORED:'Markah diisi',NONE:'Belum dijana',AWAITING_ADMIN:'Menunggu pentadbir',QUEUED:'Dalam giliran',PROCESSING:'Sedang diproses',COMPLETE:'Selesai',FAILED:'Gagal'}[s]||s);
  M.refreshBar=()=>'<div class="refresh-bar"><small id="view-updated">Data semasa</small><button type="button" id="view-refresh" class="secondary">Muat semula</button></div>';
  M.bindRefresh=()=>{const b=document.querySelector('#view-refresh');if(b)b.onclick=()=>M.run(async()=>{await M.guard();M.invalidateViews();await M.refreshView?.();});};
  M.prefetchRole=async()=>{const epoch=generation;try{const context=await M.read('sessionContext');if(epoch!==generation||!M.token)return;M.teacherFocus=context.teacher_exam_focus||'UASA';const e=M.currentExam(context.exams);if(e&&!document.hidden)await M.read('analytics',{exam_id:e.exam_id,mode:'CURRENT'});}catch(_){} };
  const dialog=()=>{let d=document.querySelector('#action-dialog');if(!d){d=document.createElement('dialog');d.id='action-dialog';d.setAttribute('aria-labelledby','action-title');d.oncancel=e=>e.preventDefault();document.body.append(d);}return d;};
  M.feedback=async(title,fn,success='Berjaya disimpan')=>{
    const d=dialog();if(d.open)return;
    d.innerHTML='<div class="action-spinner" aria-hidden="true"></div><h3 id="action-title">'+M.esc(title)+'</h3><p role="status">Sila tunggu. Proses sedang dijalankan.</p>';d.showModal();
    try{const result=await fn();d.innerHTML='<div class="action-success" aria-hidden="true">✓</div><h3 id="action-title">'+M.esc(success)+'</h3><p>Proses selesai.</p><button id="action-close" autofocus>OK</button>';d.querySelector('button').onclick=()=>d.close();d.querySelector('button').focus();return result;}
    catch(e){d.innerHTML='<h3 id="action-title">Belum berjaya</h3><p role="alert">'+M.esc(e.message)+'</p><p>Input anda dikekalkan. Semak sambungan atau arahan di atas sebelum cuba lagi.</p><button id="action-retry">Cuba Lagi</button> <button id="action-close" class="secondary">Tutup</button>';d.querySelector('#action-close').onclick=()=>d.close();d.querySelector('#action-retry').onclick=()=>{d.close();M.feedback(title,fn,success);};return null;}
  };
  M.subjectLabel=code=>({BM:'Bahasa Melayu',BI:'Bahasa Inggeris',MM:'Matematik',SN:'Sains',PI:'Pendidikan Islam',PM:'Pendidikan Moral',BA:'Bahasa Arab',BC:'Bahasa Cina',BT:'Bahasa Tamil',PJPK:'Pendidikan Jasmani & Kesihatan',MZ:'Pendidikan Muzik',PSV:'Pendidikan Seni Visual',SEJ:'Sejarah',RBT:'Reka Bentuk & Teknologi'}[code]||code);
  M.limitMark=(value,previous='')=>/^\d+$/.test(String(value).trim())&&Number(value)>100?previous:value;
  M.confirmation=v=>v?.confirmed?`Markah ini telah disemak dan disahkan oleh ${M.esc(v.name||'guru kelas')} pada ${M.date(v.at)}.`:v?.pending?'Perubahan belum disahkan semula oleh guru kelas.':'';
  M.accordions=root=>root.querySelectorAll('details[data-accordion]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)root.querySelectorAll('details[data-accordion]').forEach(other=>{if(other!==d&&!other.contains(d)&&!d.contains(other))other.open=false;});}));
  M.bindCharts=root=>root.querySelectorAll('[data-chart-mode]').forEach(b=>b.onclick=()=>{const chart=b.closest('.interactive-chart'),pct=b.dataset.chartMode==='percent',total=Number(chart.dataset.total)||1;chart.querySelectorAll('[data-chart-value]').forEach(n=>{const v=Number(n.dataset.chartValue);n.textContent=pct?(100*v/total).toFixed(1)+'%':v;});chart.querySelectorAll('[data-chart-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
})(window.MPS);
