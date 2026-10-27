const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let calls=[],resolveRead,focused=false,hidden=false;const cacheResponse={n:1};const nodes={};
const document={get hidden(){return hidden;},get activeElement(){return {matches:()=>focused};},querySelector:s=>null};
let timer;const M={token:'one',user:{user_id:'one'},pending:new Map(),invalid:new Set(),remarkPending:new Map(),call:async(a,p,w)=>{calls.push({a,w});if(a==='slow')return new Promise(r=>resolveRead=r);return structuredClone(cacheResponse);}};
const c=vm.createContext({window:{MPS:M},document,Map,Set,Date,JSON,Error,Promise,structuredClone,setInterval:fn=>(timer=fn,1),clearInterval:()=>{},console});vm.runInContext(fs.readFileSync(__dirname+'/../client/experience.js','utf8'),c);
(async()=>{
assert.equal(M.limitMark('101'),'100');assert.equal(M.limitMark('999999999'),'100');assert.equal(M.limitMark('TH'),'TH');assert.equal(M.limitMark('100'),'100');
const a=await M.read('dashboard');a.n=99;assert.equal((await M.read('dashboard')).n,1);assert.equal(calls.length,1);
await M.call('saveMarks',{},true);await M.read('dashboard');assert.equal(calls.length,3);
M.token='two';await M.read('dashboard');assert.equal(calls.length,4);
let refreshes=0;M.view('test',async()=>refreshes++);await M.refreshView();assert.equal(refreshes,1);
M.pending.set('dirty',{});await M.refreshView();assert.equal(refreshes,1);M.pending.clear();
focused=true;await M.refreshView();assert.equal(refreshes,1);focused=false;
hidden=true;await M.refreshView();assert.equal(refreshes,1);hidden=false;
await M.refreshView();assert.equal(refreshes,1);M.invalidateViews();
let release;M.view('test',async()=>{refreshes++;await new Promise(r=>release=r);});const first=M.refreshView();await M.refreshView();assert.equal(refreshes,2);release();await first;
const late=M.read('slow');M.invalidateViews();resolveRead({n:10});await assert.rejects(late,e=>e.code==='STALE_VIEW');
M.stopRefresh();console.log('PASS score cap, isolated read-ahead cache, write invalidation, role switch, hidden/focused/dirty refresh guards and no overlapping refresh.');
})().catch(e=>{console.error(e);process.exitCode=1});
