const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['tools/verify.cjs','tests/backend.test.cjs','tests/reliability.test.cjs','tests/pdf.test.cjs','tests/concurrency.test.cjs','tests/school.test.cjs','tests/school-scale.test.cjs']){const r=spawnSync(process.execPath,[path.join(root,file)],{stdio:'inherit',cwd:root,env:{...process.env,MPS_SOURCE:path.join(root,'src'),MPS_BASELINE:'0'}});if(r.status!==0)process.exit(r.status||1);}
console.log('Core suites passed. Browser and optional Python legacy helper tests are separate.');
