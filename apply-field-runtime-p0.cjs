#!/usr/bin/env node
/**
 * TSUMS Field Runtime P0 review patch. Non-Canonical, Public-Layer.
 * Generates an independent candidate. Does NOT change main or the original input.
 * Expects upstream index.html Git blob SHA 564c388a06b4f548b3de78c3185e2cfcb706ccdd.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const input = process.argv[2] || 'index.html';
const output = process.argv[3] || 'index.field-runtime-p0-review.html';
if (path.resolve(input) === path.resolve(output)) throw new Error('Refusing to overwrite original input');
const original = fs.readFileSync(input);
const blobHash = crypto.createHash('sha1').update(`blob ${original.length}\0`).update(original).digest('hex');
if (blobHash !== '564c388a06b4f548b3de78c3185e2cfcb706ccdd') {
  throw new Error(`Baseline mismatch: expected 564c388a..., got ${blobHash}. Re-audit the current source before patching.`);
}
let s = original.toString('utf8');
const changes = [];
function replaceOnce(oldText, newText, label) {
  const parts = s.split(oldText);
  if (parts.length !== 2) throw new Error(`${label}: expected exactly one match, found ${parts.length - 1}`);
  s = parts.join(newText); changes.push(label);
}
replaceOnce(
  'function put(n,o){return new Promise((res,rej)=>{const r=store(n,"readwrite").put(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}',
  'function put(n,o){return new Promise((res,rej)=>{const tx=db.transaction(n,"readwrite"),r=tx.objectStore(n).put(o);let settled=false;const fail=()=>{if(!settled){settled=true;rej(tx.error||r.error||new Error("LOCAL_TRANSACTION_ABORTED"))}};tx.oncomplete=()=>{if(!settled){settled=true;res(r.result)}};tx.onabort=fail;tx.onerror=fail})}',
  'Resolve IndexedDB put on transaction completion'
);
const a = s.indexOf('async function appendFieldEvent('), b = s.indexOf('\n}', a) + 2;
if (a < 0 || b <= a) throw new Error('appendFieldEvent function boundary missing');
let block = s.slice(a, b);
if (!block.includes('v06WriteLock=v06WriteLock.then(async()=>{') || !block.includes(' return v06WriteLock;')) {
  throw new Error('appendFieldEvent queue mismatch');
}
block = block
  .replace('v06WriteLock=v06WriteLock.then(async()=>{', 'const operation=v06WriteLock.catch(()=>{}).then(async()=>{')
  .replace('  await put(EVENTS,event);await renderAll();return event;',
    '  await put(EVENTS,event);try{await renderAll()}catch(error){console.error("event render after commit",error)}return event;')
  .replace(' return v06WriteLock;', ' v06WriteLock=operation.catch(()=>{});\n return operation;');
s = s.slice(0, a) + block + s.slice(b);
changes.push('Write queue failure isolation and postcommit render isolation');
replaceOnce(
  '<button class="fieldCheckinButton" id="runtimeQuickCheckin">快速回報</button>',
  '<button class="fieldCheckinButton" id="runtimeQuickCheckin" type="button">快速回報｜CHECK-IN</button>\n  <div id="runtimeCheckinCommitState" role="status" aria-live="polite" class="voiceCaptureState">CHECK-IN 尚未執行｜本機保存不等於遠端收到</div>',
  'Visible CHECK-IN local status'
);
replaceOnce('.fieldCheckinButton{width:100%;min-height:58px;', '.fieldCheckinButton{width:100%;min-height:80px;', '80px CHECK-IN target');
replaceOnce(
  '$("#quickWait").onclick=()=>v06DirectDecision("WAIT");$("#quickRetreat").onclick=()=>v06DirectDecision("RETREAT");$("#quickSOS").onclick=()=>v06DirectDecision("SOS");',
  '/* Protected Field Runtime control binds these actions once in later controller. */',
  'Remove early overridden quick-action bindings'
);
const qs = s.indexOf('async function v063QuickCheckin(){'), qe = s.indexOf('\nfunction v063HoldAction(', qs);
if (qs < 0 || qe <= qs) throw new Error('v063QuickCheckin function boundary missing');
const replacement = `let v063CheckinInFlight=false;
let v063CheckinLastSavedAt=0;
function v063CheckinState(message,isError=false){
 const el=$("#runtimeCheckinCommitState");
 if(el){el.textContent=message;el.style.color=isError?"#ffb1a9":""}
}
async function v063QuickCheckin(){
 const button=$("#runtimeQuickCheckin");
 if(v063CheckinInFlight||Date.now()-v063CheckinLastSavedAt<900)return;
 if(!db||!currentTripId){v063CheckinState("無法保存：尚未建立或載入行程",true);return}
 const intentId=crypto.randomUUID(),observedAt=isoNow(),tripId=currentTripId;
 const actor=$("#fieldActor").value.trim()||"未具名";
 v063CheckinInFlight=true;button.disabled=true;
 v063CheckinState("正在儲存本機紀錄…");
 try{
  const e=await appendFieldEvent("CHECK_IN",{
   lifecycle_stage:4,module_refs:["C2","C3"],actor,observed_at:observedAt,
   observed_fact:"快速回報",source_state:"USER_RECORDED",input_source:"MANUAL",
   confirmed_by_user:true,idempotency_key:"CHECK_IN:"+intentId,
   structured_payload:{intent_id:intentId,commit_semantics:"LOCAL_FIRST",trip_id:tripId},
   location_status:"PENDING",location_origin:"NOT_RECORDED"
  });
  if(!e?.event_id||e.trip_id!==tripId)throw new Error("CHECKIN_LOCAL_COMMIT_UNVERIFIED");
  v063CheckinLastSavedAt=Date.now();
  v063CheckinState("已儲存於本機｜尚未同步（SYNC_PENDING）｜GPS 待取得");
  v063SetVoiceState("CHECK-IN 已儲存於本機｜GPS 結果另存");
  try{navigator.vibrate?.(60)}catch(_){}
  let request;
  try{request=WebLocationAdapter.request({timeout:8000})}
  catch(error){request={requested_at:isoNow(),promise:Promise.resolve({location_status:"UNAVAILABLE",location_origin:"NOT_RECORDED",record:null,error_code:"ADAPTER_ERROR"})}}
  request.promise.then(async r=>{
   if(currentTripId!==tripId){v063CheckinState("CHECK-IN 已儲存｜行程已切換，GPS 補充未寫入",true);return}
   try{
    await appendFieldEvent("CHECK_IN_LOCATION_SUPPLEMENT",{
     lifecycle_stage:4,module_refs:["C2","C3"],actor,
     observed_fact:r.location_status==="RECORDED"?"Check-in 位置已補充":"Check-in 定位結果已記錄",
     evidence_refs:[e.event_id],source_state:"DEVICE_RECORDED",input_source:"RECORDED_GPS",
     confirmed_by_user:false,location_record:r.record,
     location_requested_at:r.location_requested_at||request.requested_at,
     location_captured_at:r.location_captured_at||null,location_status:r.location_status,
     location_origin:r.location_origin,
     structured_payload:{parent_event_id:e.event_id,gps_error_code:r.error_code||null},
     idempotency_key:"CHECK_IN_GPS:"+intentId
    });
    v063CheckinState(r.location_status==="RECORDED"?"已儲存於本機｜GPS 結果已追加｜尚未同步":"已儲存於本機｜GPS 未取得且結果已記錄｜尚未同步");
   }catch(error){console.error("GPS supplement not persisted",error);v063CheckinState("CHECK-IN 已儲存於本機｜GPS 補充未成功保存",true)}
  }).catch(error=>{console.error("GPS adapter failed",error);v063CheckinState("CHECK-IN 已儲存於本機｜GPS 回報未完成",true)});
 }catch(error){
  console.error("CHECK-IN local commit failed",error);
  v063CheckinState("本機寫入失敗｜未完成 CHECK-IN，請重試",true);
  v063SetVoiceState("CHECK-IN 未儲存｜請重試");
 }finally{button.disabled=false;v063CheckinInFlight=false}
}
$("#runtimeQuickCheckin").onclick=v063QuickCheckin;
`;
s = s.slice(0, qs) + replacement + s.slice(qe);
changes.push('CHECK-IN action time / transaction / deferred GPS / error states');
replaceOnce(
  '$("#quickWait").onclick=()=>v06DirectDecision("WAIT");',
  '$("#quickWait").textContent="WAIT｜按住約 1 秒";\n$("#quickWait").setAttribute("aria-label","WAIT，按住約 1 秒後開啟人工決策");\nv063HoldAction($("#quickWait"),900,"WAIT",()=>v06DirectDecision("WAIT"));',
  'WAIT protected hold trial'
);
replaceOnce('btn.onpointerleave=e=>{if(e.buttons===0)reset()};', 'btn.onpointerleave=reset;', 'Cancel protected hold when dragged away');
const scripts = [...s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc\s*=/.test(m[1]) && !/type\s*=\s*["'](?:application\/json|application\/ld\+json)/i.test(m[1]));
scripts.forEach((m, i) => { try { new Function(m[2]); } catch (e) { throw new Error(`Script block ${i+1} syntax: ${e.message}`); }});
fs.writeFileSync(output, s, {flag:'wx'});
const outbuf=fs.readFileSync(output);
const result={input,output,source_git_blob_sha1:blobHash,sha256:crypto.createHash('sha256').update(outbuf).digest('hex'),bytes:outbuf.length,script_blocks_parsed:scripts.length,changes};
console.log(JSON.stringify(result,null,2));
