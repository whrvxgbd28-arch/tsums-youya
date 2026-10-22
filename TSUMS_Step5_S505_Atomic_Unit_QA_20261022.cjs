#!/usr/bin/env node
/* Public-layer transactional failure injection, Node built-ins only, in-memory IDB semantics.
   Does not operate a browser, real IndexedDB, Codespaces or live data. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const file=process.argv[2];if(!file||!fs.existsSync(file)){console.error('USAGE: node TSUMS_Step5_S505_Atomic_Unit_QA_20261022.cjs <s505-review.html>');process.exit(2)}
const source=fs.readFileSync(file,'utf8');
function pick(name){const pos=source.indexOf('async function '+name+'(');if(pos<0)throw Error('MISSING '+name);const end=source.indexOf('\n}',pos);if(end<0)throw Error('MISSING END '+name);return source.slice(pos,end+2)}
const rows=[];
const clone=x=>JSON.parse(JSON.stringify(x));
const stable=o=>JSON.stringify(o);
function makeEnvironment(failEvent=false){
 const tables={trips:new Map(),events:new Map(),field_sessions:new Map()};
 const ctx={TRIPS:'trips',EVENTS:'events',FIELD_SESSIONS:'field_sessions',stable,Promise,Error,console};
 ctx.db={objectStoreNames:{contains:n=>n in tables},transaction(names,mode){
  if(mode!=='readwrite'||!['trips','events','field_sessions'].every(n=>names.includes(n)))throw Error('NO_ATOMIC_MULTI_STORE');
  let local={trips:new Map([...tables.trips].map(([k,v])=>[k,clone(v)])),events:new Map([...tables.events].map(([k,v])=>[k,clone(v)])),field_sessions:new Map([...tables.field_sessions].map(([k,v])=>[k,clone(v)]))};
  let pending=0,aborted=false,done=false,finishScheduled=false;
  const tx={error:null,oncomplete:null,onabort:null,onerror:null,abort(){if(aborted||done)return;aborted=true;setImmediate(()=>tx.onabort?.())},objectStore(n){
   return {get(k){return request(()=>local[n].get(k))},index(field){return {getAll(key){return request(()=>[...local[n].values()].filter(v=>v[field]===key))}}},put(value){
    if(failEvent&&n==='events')throw Error('SYNTHETIC_EVENT_PUT_FAIL');
    return request(()=>{local[n].set(value.id??value.event_id??value.session_id,clone(value));return value.id||value.event_id})
   }};
  }};
  function scheduleFinish(){if(pending||aborted||done||finishScheduled)return;finishScheduled=true;setImmediate(()=>{finishScheduled=false;if(pending||aborted||done)return;done=true;for(const n of names)tables[n]=local[n];tx.oncomplete?.()})}
  function request(f){pending++;const r={onsuccess:null,onerror:null,result:undefined,error:null};setImmediate(()=>{if(aborted){pending--;return}try{r.result=f();r.onsuccess?.()}catch(e){tx.error=e;tx.abort()}finally{pending--;scheduleFinish()}});return r}
  return tx;
 }};
 const c=vm.createContext(ctx);vm.runInContext(pick('v0641AtomicDecisionPair'),c);
 return {tables,ctx:c};
}
async function run(label,fn){try{const detail=await fn();rows.push({id:label,status:'PASS',detail})}catch(e){rows.push({id:label,status:'FAIL',detail:String(e.message||e)})}}
(async()=>{
 await run('S5_ATOMIC_BOTH_COMMIT',async()=>{
  const s=makeEnvironment(),t={id:'QA',prestart:{decision:'WAIT'}},after={...t,prestart:{decision:'GO'}},event={event_id:'E1',trip_id:'QA',sequence:1,event_type:'GO',event_hash:'HASH'};
  s.tables.trips.set('QA',clone(t));await s.ctx.v0641AtomicDecisionPair('QA',stable(t),after,[],event);
  if(s.tables.trips.get('QA').prestart.decision!=='GO'||s.tables.events.size!==1)throw Error('ATOMIC_PAIR_MISSING');return 'Both stores committed in a single simulated transaction';
 });
 await run('S5_ATOMIC_ROLLBACK_IF_EVENT_FAILS',async()=>{
  const s=makeEnvironment(true),t={id:'QA',prestart:{decision:'WAIT'}},after={...t,prestart:{decision:'GO'}},event={event_id:'E1',trip_id:'QA',sequence:1,event_type:'GO'};
  s.tables.trips.set('QA',clone(t));let failed=false;try{await s.ctx.v0641AtomicDecisionPair('QA',stable(t),after,[],event)}catch(e){failed=true}
  if(!failed||s.tables.trips.get('QA').prestart.decision!=='WAIT'||s.tables.events.size)throw Error('PARTIAL_COMMIT');return 'Injected event-store failure leaves prior WAIT unchanged, no unpaired GO';
 });
 await run('S5_ATOMIC_STALE_WRITE_REJECTED',async()=>{
  const s=makeEnvironment(),t={id:'QA',prestart:{decision:'WAIT'}},tNew={...t,prestart:{decision:'RETREAT'}},ev={event_id:'E1',trip_id:'QA',sequence:1,event_type:'RETREAT'};
  s.tables.trips.set('QA',clone(t));let failed=false;try{await s.ctx.v0641AtomicDecisionPair('QA','WRONG_SNAPSHOT',tNew,[],ev)}catch(e){failed=true}
  if(!failed||s.tables.trips.get('QA').prestart.decision!=='WAIT'||s.tables.events.size)throw Error('STALE_ACCEPTED');return 'Stale trip rejected without modifying decision or event chain';
 });
 const report={scope:'In-memory IndexedDB transaction simulation (not real IndexedDB)',candidate:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),results:rows,all_pass:rows.every(r=>r.status==='PASS'),real_browser_qa:'BLOCKED_BY_CONTAINER_BROWSER_NAVIGATION_POLICY',codespaces_qa:'PENDING'};
 console.log(JSON.stringify(report,null,2));process.exitCode=report.all_pass?0:1;
})().catch(e=>{console.error(e);process.exitCode=2});
