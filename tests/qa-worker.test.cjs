const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let state='QUEUED',steps=0,scheduled=0,clock=0,delay=0,job=JSON.stringify({book:'copy-only',folder:'private-copy'});
const c=vm.createContext({Date:{now:()=>clock},PropertiesService:{getScriptProperties:()=>({getProperty:()=>job})},json_:(s,f)=>s?JSON.parse(s):f,SpreadsheetApp:{openById:id=>{assert.equal(id,'copy-only');return {}; }},Db_:function(){this.read=()=>[{record_type:'CLASS',pdf_status:state}];},ScriptApp:{newTrigger:name=>{assert.equal(name,'acceptanceWorker_');return {timeBased(){return this;},after(ms){assert.equal(ms,60000);return this;},create(){scheduled++;}};}},pdfStep_:async()=>{steps++;clock+=delay;}});
vm.runInContext(fs.readFileSync(__dirname+'/../src/Maintenance.js','utf8'),c);
(async()=>{
 await c.acceptanceWorker_();assert.equal(steps,2);assert.equal(scheduled,1);assert.equal(c.QA_CONFIG_,null);assert.equal(c.CONFIG_REQUEST_,null);
 steps=scheduled=clock=0;delay=100000;await c.acceptanceWorker_();assert.equal(steps,1);assert.equal(scheduled,1);
 for(state of ['COMPLETED','FAILED']){steps=scheduled=clock=0;delay=0;await c.acceptanceWorker_();assert.equal(steps,1);assert.equal(scheduled,0);}
 job=null;steps=0;await c.acceptanceWorker_();assert.equal(steps,0);
 console.log('PASS copy PDF worker bounds each invocation, schedules continuation for pending jobs, stops completed/failed jobs and restores production configuration.');
})().catch(e=>{console.error(e);process.exitCode=1;});
