#!/usr/bin/env node
/**
 * TSUMS Step 5 S5-05 Public-Layer repair candidate.
 * Runs only against a review copy. Never edits the input, git, live trips or ports.
 * Creates a separate candidate and prints its SHA-256.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const input=process.argv[2],output=process.argv[3];
if(!input||!output){console.error('USAGE: node TSUMS_Step5_S505_Atomic_Fix_20261022.cjs <v5-review-input.html> <v5-s505-review-output.html>');process.exit(2)}
if(path.resolve(input)===path.resolve(output))throw Error('REFUSE_OVERWRITE_INPUT');
let src=fs.readFileSync(input,'utf8');
function replaceOne(needle,replacement,label){const count=src.split(needle).length-1;if(count!==1)throw Error(`${label}: expected one match; found ${count}`);src=src.replace(needle,replacement)}
replaceOne(
 'V0641_PENDING_PRE_DECISION={choice,actor,reasonCode,reason,gate,overrideRecord,review_fingerprint:fp,',
 'V0641_PENDING_PRE_DECISION={trip_id:t.id,prepared_at:isoNow(),choice,actor,reasonCode,reason,gate,overrideRecord,review_fingerprint:fp,',
 'Bind pending intent to exact trip and preparation time');
const begin=src.indexOf('async function v0641CommitPreDecision(){');
const next=src.indexOf('\n$$(',begin);
if(begin<0||next<0||next<=begin)throw Error('Step5 commit function boundary not found');
const old=src.slice(begin,next);
if(!old.includes('await put(TRIPS,t);')||!old.includes('await appendEvent(p.choice,'))throw Error('UNEXPECTED_S5_COMMIT_SOURCE');
const patch=String.raw`/* Step 5 S5-05: an evidence event and the corresponding trip decision commit atomically.
   Public-Layer only. The application retains all legal/sovereign decision boundaries. */
let V0641_DECISION_COMMIT_BUSY=false;
function v0641NormalizedGate(g){return {hard:(g.hard||[]).map(x=>({code:x.code,message:x.message})),override:(g.override||[]).map(x=>({code:x.code,message:x.message})),warning:(g.warning||[]).map(x=>({code:x.code,message:x.message})),unknown:(g.unknown||[]).map(x=>({code:x.code,message:x.message}))}}
async function v0641AtomicDecisionPair(tripId,expectedTrip,tripToSave,expectedEvents,event){
 if(!db||!db.objectStoreNames.contains(TRIPS)||!db.objectStoreNames.contains(EVENTS)||!db.objectStoreNames.contains(FIELD_SESSIONS))throw Error('S5_DB_UNAVAILABLE');
 return new Promise((resolve,reject)=>{
  const tx=db.transaction([TRIPS,EVENTS,FIELD_SESSIONS],'readwrite');
  let finished=false;
  const fail=e=>{if(finished)return;finished=true;reject(tx.error||e||new Error('S5_ATOMIC_TRANSACTION_ABORTED'))};
  tx.oncomplete=()=>{if(!finished){finished=true;resolve(event)}};
  tx.onerror=()=>{}; // onabort is the terminal outcome
  tx.onabort=()=>fail(tx.error||new Error('S5_ATOMIC_TRANSACTION_ABORTED'));
  const tripStore=tx.objectStore(TRIPS),eventStore=tx.objectStore(EVENTS),sessionStore=tx.objectStore(FIELD_SESSIONS);
  const tripRead=tripStore.get(tripId),eventsRead=eventStore.index('trip_id').getAll(tripId),sessionsRead=sessionStore.index('trip_id').getAll(tripId);
  let remaining=3;
  const checkAndPut=()=>{
   if(--remaining)return;
   try{
    const inDBTrip=tripRead.result,actualEvents=(eventsRead.result||[]).sort((a,b)=>a.sequence-b.sequence),actualSessions=sessionsRead.result||[];
    if(!inDBTrip||stable(inDBTrip)!==expectedTrip)throw Error('S5_STALE_TRIP_STATE_RECONFIRM_REQUIRED');
    if(actualSessions.length)throw Error('S5_FIELD_ALREADY_STARTED_PREDECISION_NOT_ALLOWED');
    const a=actualEvents.at(-1),b=expectedEvents.at(-1);
    if(actualEvents.length!==expectedEvents.length||a?.event_id!==b?.event_id||a?.sequence!==b?.sequence||a?.event_hash!==b?.event_hash)throw Error('S5_STALE_EVENT_SEQUENCE_RECONFIRM_REQUIRED');
    tripStore.put(tripToSave);
    eventStore.put(event); // throws or constraint failure => whole transaction rolls back, including tripStore.put
   }catch(error){
    tx.abort(); // the transaction's abort handler reports failure
    if(!finished){finished=true;reject(error)}
   }
  };
  for(const r of [tripRead,eventsRead,sessionsRead])r.onsuccess=checkAndPut;
 });
}
async function v0641CommitPreDecision(){
 if(V0641_DECISION_COMMIT_BUSY)return;
 const p=V0641_PENDING_PRE_DECISION;if(!p)return;
 V0641_DECISION_COMMIT_BUSY=true;
 try{
  const tRaw=await currentTrip();
  if(!tRaw||!currentTripId||p.trip_id!==currentTripId||p.trip_id!==tRaw.id)throw Error('S5_TRIP_SWITCHED_RECONFIRM_REQUIRED');
  if(await v0646HasFieldStarted())throw Error('S5_FIELD_ALREADY_STARTED_PREDECISION_NOT_ALLOWED');
  const expectedTrip=stable(tRaw),t=await v0641MigrateControlSchema(tRaw);
  const authority=await v0641AuthorityState(t);
  if(!authority.fresh||!authority.candidates.includes(p.actor))throw Error('S5_AUTHORITY_CHANGED_RECONFIRM_REQUIRED');
  const gate=await v0641GateAssessment(),actualGate=v0641NormalizedGate(gate),preparedGate=v0641NormalizedGate(p.gate);
  const fp=await v0641ReviewFingerprint(t);
  if(stable(actualGate)!==stable(preparedGate)||stable(fp)!==stable(p.review_fingerprint))throw Error('S5_GATE_CHANGED_RECONFIRM_REQUIRED');
  if(p.choice==='GO'&&gate.hard.length)throw Error('S5_GO_HARD_BLOCKED');
  if(p.choice==='GO'&&gate.override.length&&!p.overrideRecord)throw Error('S5_GO_OVERRIDE_RECORD_REQUIRED');
  if(!['GO','WAIT','RETREAT'].includes(p.choice)||!p.actor||!p.reason||!p.reasonCode)throw Error('S5_DECISION_INCOMPLETE');
  // The prepared fingerprint in older v5 included the full gate shape; compare against the original structure too.
  const freshOriginal=await v062Signature({trip_id:t.id,choice:p.choice,actor:p.actor,reasonCode:p.reasonCode,reason:p.reason,gate:{hard:gate.hard,override:gate.override,warning:gate.warning,unknown:gate.unknown},review_fingerprint:fp,override:p.overrideRecord});
  if(freshOriginal!==p.snapshot_hash)throw Error('S5_PREPARED_SNAPSHOT_CHANGED_RECONFIRM_REQUIRED');
  const es=await eventsFor(t.id);
  const t0='T0,'+crypto.randomUUID().slice(0,8),decidedAt=isoNow(),recordId=crypto.randomUUID();
  const decisionRecord={decision_record_id:recordId,decision_state:p.choice,decision_maker:p.actor,authority_state:'HUMAN_CONFIRMED',reason_code:p.reasonCode,reason_text:p.reason,evidence_refs:p.evidence_refs,scope:p.scope,valid_until:p.valid_until,decided_at:decidedAt,t0_id:t0,snapshot_id:p.snapshot_id,snapshot_hash:p.snapshot_hash,gate_summary:{hard_blockers:gate.hard.length,override_required:gate.override.length,warnings:gate.warning.length,unknowns:gate.unknown.length},override:p.overrideRecord,review_fingerprint:fp,time_basis:'DEVICE_CLOCK + EVENT_SEQUENCE'};
  const prior=t.prestart?.decision_record;
  t.prestart={...(t.prestart||{}),weather_profile:t.prestart?.weather_profile||v0646WeatherProfileFromUI(),issues:[...gate.hard,...gate.override,...gate.warning,...gate.unknown].map(x=>x.message),decision:p.choice,actor:p.actor,reason:p.reason,reason_code:p.reasonCode,decision_record:decisionRecord,decided_at:decidedAt};
  // Prior records remain as independent append-only EVENTS; this field references the predecessor.
  if(prior?.decision_record_id)decisionRecord.supersedes_decision_record_id=prior.decision_record_id;
  const recorded_at=isoNow(),last=es.filter(e=>e.chain_scope==='PRETRIP_ARCHIVE').at(-1),sequence=(es.at(-1)?.sequence||0)+1;
  const base={event_id:crypto.randomUUID(),trip_id:t.id,sequence,event_type:p.choice,lifecycle_stage:3,module_refs:['C1','C3'],source_state:'USER_RECORDED',determination_layer:'UNCLASSIFIED',observed_at:recorded_at,recorded_at,synced_at:null,actor:p.actor,actor_role:null,observed_fact:'Pre-Start Decision '+p.choice+'｜'+p.reasonCode,location_state:'',communication_state:null,risk_state_before:last?.risk_state_after||'OPEN',risk_state_after:riskAfter(p.choice,last?.risk_state_after||'OPEN'),duty_signal:gate.hard.length?'PRE_START_HARD_BLOCKER_PRESENT':gate.override.length?'PRE_START_OVERRIDE_RECORDED':(gate.warning.length||gate.unknown.length)?'PRE_START_REVIEW_REQUIRED':'PRE_START_REVIEW_COMPLETED',decision_required:true,authorized_role:'BOUND_DECISION_AUTHORITY',human_decision:p.choice,decision_reason:p.reason,t0_id:t0,corrects_event_id:null,evidence_refs:p.evidence_refs||[],evidence_object_type:'DECISION_RECORD',structured_payload:decisionRecord,idempotency_key:'PRESTART_DECISION:'+p.snapshot_hash+':'+p.prepared_at,chain_scope:'PRETRIP_ARCHIVE',record_kind:'PRETRIP_ARCHIVE_RECORD',previous_hash:null};
  const event={...base,event_hash:await sha256(stable(base))};
  await v0641AtomicDecisionPair(t.id,expectedTrip,t,es,event);
  V0641_PENDING_PRE_DECISION=null;
  $('#prestartDecisionConfirmDialog').close();
  try{await renderAll();await renderPrestart()}catch(error){console.error('S5_POSTCOMMIT_RENDER_FAILED',error)}
  alert(p.choice+' 正式人工決策與證據事件已共同提交本機存檔');
 }finally{V0641_DECISION_COMMIT_BUSY=false}
}`;
src=src.slice(0,begin)+patch+src.slice(next);
// Patcher validates every inline script block, including existing P2 scripts, before writing.
const blocks=[...src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!/\bsrc\s*=/.test(x[1]));
for(let i=0;i<blocks.length;i++){
 try{new Function(blocks[i][2])}catch(e){throw Error(`SCRIPT_${i+1}_SYNTAX:${e.message}`)}
}
fs.writeFileSync(output,src,{flag:'wx'});
const b=fs.readFileSync(output);
console.log(JSON.stringify({status:'S5-05 ATOMIC REPAIR CANDIDATE ONLY',input,output,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length,script_blocks_checked:blocks.length,never_modified:['input','main','ports','live trips'],browser_qa:'PENDING'},null,2));
