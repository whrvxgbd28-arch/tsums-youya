/* TSUMS P10 QA-062 | DOM integration adapter | 2026-10-24
   Public Layer interface only. NOT a medical device or Protected-Core runtime.
   This script augments existing labelled non-interactive cards without replacing P9/P11.
*/
(() => {
  'use strict';
  if (window.__TSUMS_QA062__) return;
  window.__TSUMS_QA062__ = { version: 'QA-062', release: 'INTEGRATION_CANDIDATE' };

  const RULES = [
    ['氧｜氣體交換','medical','氧｜氣體交換'],
    ['溫｜熱平衡','medical','溫｜熱平衡'],
    ['血｜循環代謝','medical','血｜循環代謝'],
    ['腦｜神經中樞','medical','腦｜神經中樞'],
    ['動｜組織完整性','medical','動｜組織完整性'],
    ['事故 / SOS 事件','rescue','事故／SOS 事件'],
    ['救援受理','rescue','救援受理'],
    ['最後有效位置','rescue','最後有效位置'],
    ['通報交接','rescue','通報交接'],
    ['撤退 / 避難位置','retreat','撤退／避難位置'],
    ['接駁與交通','retreat','接駁與交通'],
    ['留守人','retreat','留守人'],
    ['保險 / 外援受理','retreat','保險／外援受理'],
    ['場域封閉','ecology','場域封閉'],
    ['生態 / 棲地警訊','ecology','生態／棲地警訊'],
    ['敏感座標外送','protected','敏感座標外送'],
    ['受保護知識','protected','受保護知識'],
    ['行動網路','comms','行動網路'],
    ['無線電','comms','無線電'],
    ['衛星電話','comms','衛星電話'],
    ['追蹤器','comms','追蹤器'],
    ['CHECK-IN','checkin','CHECK-IN']
  ];
  const STATUS_TEXT = /(未確認|待確認|未接入|待建立|尚未|UNKNOWN|未查核|禁止預設|不可展示|未取得|未記錄|已存在|待載入)/;
  const norm = s => (s || '').replace(/[\s｜|]+/g,'').replace(/[／/]+/g,'/').replace(/\u00a0/g,'').trim();
  const text = v => String(v == null ? '' : v).trim();
  const short = (s,n=1200) => text(s).slice(0,n);
  const now = () => new Date().toISOString();
  const rid = () => crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let host, shadow, sheet, info, modal, subject, textarea, operator, obsTime, source, stateSelect, summaryText, photoInput, recordButton, saveButton, mediaPreview, historyList;
  let currentCategory = 'rescue', currentLabel = '現場觀察', latestMediaId = null, recording = null, stream = null, audioChunks = [], audioStopRequested = false;
  let dbPromise;
  let mounting = false;

  function alertStatus(message, error=false) {
    if (!info) return;
    info.textContent = message;
    info.dataset.error = error ? '1' : '0';
  }
  function secure() {return !!(window.isSecureContext && crypto && crypto.subtle && indexedDB)}
  function db() {
    if (!secure()) return Promise.reject(new Error('需要 HTTPS／localhost、安全雜湊與 IndexedDB'));
    if (!dbPromise) {
      dbPromise = new Promise((res, rej) => {
        const req = indexedDB.open('TSUMS_P10_QA062_LOCAL', 1);
        req.onupgradeneeded = () => { const d=req.result; if(!d.objectStoreNames.contains('events')) {const s=d.createObjectStore('events',{keyPath:'id'});s.createIndex('byCategory','category');s.createIndex('byAt','savedAt');} };
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error || new Error('本機資料庫無法開啟'));
        req.onblocked = () => rej(new Error('本機資料庫被其他分頁阻擋'));
      }).catch(e => {dbPromise=undefined;throw e;});
    }
    return dbPromise;
  }
  async function append(event) {
    const d=await db();
    return new Promise((resolve,reject)=>{
      const tr=d.transaction('events','readwrite');
      tr.oncomplete=()=>resolve(event.id);
      tr.onerror=()=>reject(tr.error||new Error('資料寫入失敗'));
      tr.onabort=()=>reject(tr.error||new Error('交易中止'));
      tr.objectStore('events').add(event); // APPEND ONLY: never update original events
    });
  }
  async function allEvents() {
    const d=await db();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction('events','readonly'); const req=tx.objectStore('events').getAll();
      req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));
      req.onerror=()=>reject(req.error);
    });
  }
  async function shaBytes(buffer) {
    const hashed=await crypto.subtle.digest('SHA-256',buffer);
    return [...new Uint8Array(hashed)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function hashText(s) {return shaBytes(new TextEncoder().encode(s));}
  async function mediaSave(file,kind) {
    if(currentCategory==='protected') throw new Error('受保護知識與敏感座標欄位不接受媒體原件；僅登錄治理狀態');
    if(!file || !file.size) throw new Error('沒有取得可保存的媒體檔案');
    if(file.size>30*1024*1024) throw new Error('媒體超過 30MB，未保存。請縮短錄音或改用短幅影像');
    alertStatus('媒體正在雜湊與寫入本機；尚未保存成功…');
    const hash=await shaBytes(await file.arrayBuffer());
    const ev={id:rid(),kind:'media.raw',category:currentCategory,label:currentLabel,mediaType:kind,mime:file.type||'application/octet-stream',byteSize:file.size,hashSha256:hash,blob:file,deviceTime:now(),savedAt:now(),verified:false,transmission:'NOT_SENT',rights:'LOCAL_RESTRICTED',note:'原件為裝置檔案；裝置時間不是可信時間認證；SHA-256 不等於數位簽章'};
    await append(ev);latestMediaId=ev.id;
    mediaPreview.textContent=`${kind==='photo'?'照片':'錄音'}原件已提交本機交易；SHA-256：${hash.slice(0,16)}…；尚未人工覆核／尚未傳送`;
    alertStatus('本機保存交易已完成；此紀錄尚未人工覆核、尚未對外傳送');
    return ev;
  }
  function defaultState(){
    if(currentCategory==='protected') return ['未查核','外送禁止（預設）','授權待查核','已記錄拒絕外送'];
    if(currentCategory==='rescue') return ['尚未確認','現場觀察','人工通報嘗試','外部回執待核對'];
    if(currentCategory==='comms') return ['未確認','無訊號（人工觀察）','有訊號（人工觀察）','人工聯繫嘗試','已收到外部回執（待核驗）'];
    if(currentCategory==='retreat') return ['待確認','已記錄撤退方案','已人工聯繫（待回執）','聯繫失敗','待人工複核'];
    if(currentCategory==='medical') return ['未確認','人工觀察無明顯異常','人工觀察異常','無法觀察'];
    return ['未查核','人工觀察記錄','疑似異常（未核定）','需權責查證'];
  }
  function setCategory(category,label) {
    currentCategory=category; currentLabel=label; latestMediaId=null;
    sheet.querySelector('#q62heading').textContent=label;
    sheet.querySelector('#q62category').textContent=category==='protected'?'權利控制｜限記狀態':`Public Layer｜${category}`;
    subject.value='';textarea.value='';operator.value='';obsTime.value=new Date().toISOString().slice(0,16);
    source.value='人工現場觀察';
    stateSelect.replaceChildren(...defaultState().map(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;return o;}));
    summaryText.value='';mediaPreview.textContent='原件尚未拍攝／錄製';
    sheet.querySelector('#q62photo').disabled=category==='protected';
    recordButton.disabled=category==='protected';
    sheet.querySelector('#q62geo').disabled=category==='protected'||category==='ecology';
    sheet.querySelector('#q62protectedhint').hidden=category!=='protected';
    textarea.disabled=category==='protected';
    textarea.placeholder=category==='protected'?'此欄關閉：只允許選擇權利／授權狀態，不收集受保護內容':'僅寫所見、所聞、誰說、時間、處置；不得補造判斷';
    summaryText.readOnly=category==='protected';
    sheet.hidden=false;modal.hidden=false;
    sheet.querySelector('#q62heading').focus();
    alertStatus(secure()?'可操作；尚未保存任何新資料':'目前安全環境不可用：不可保存。請使用 HTTPS 或 localhost',!secure());
  }
  function closeDrawer(){
    if(recording) stopVoice();
    if(sheet) sheet.hidden=true;
    if(modal)modal.hidden=true;
  }
  function createUI() {
    host=document.createElement('div');host.id='tsums-qa062-root';host.style.cssText='position:relative;z-index:2147483600';document.body.append(host);
    shadow=host.attachShadow({mode:'open'});
    const css=document.createElement('style');css.textContent=`
      :host{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#ffe2b6;--bg:#1a130e;--gold:#cc9e5b}
      *{box-sizing:border-box}button,select,input,textarea{font:inherit}button{cursor:pointer}
      .bar{position:fixed;inset:auto 0 0;z-index:99999;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px max(12px,env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:#120e0bfa;border-top:1px solid #9c743d}
      .bar button{min-height:70px;border-radius:16px;border:2px solid #d7a86a;background:#433020;color:#ffe2b6;font-weight:750;font-size:18px;padding:10px 4px}
      .bar button:first-child{background:#64361f}.hotline{position:absolute;right:12px;top:-29px;background:#24180f;border:1px solid #b48c5b;color:#ffe3b3;border-radius:9px 9px 0 0;padding:5px 11px;text-decoration:none;font-size:12px}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid white;outline-offset:2px}
      .scrim{position:fixed;inset:0;background:#000b;z-index:999998} .panel{position:fixed;z-index:999999;inset:3vh 2vw auto;max-height:92dvh;overflow:auto;max-width:700px;margin:auto;background:#20170f;border:2px solid var(--gold);border-radius:18px;padding:16px 15px 25px;box-shadow:0 10px 40px #000d}
      h2{margin:0 0 7px;font-size:22px;line-height:1.5}h3{font-size:17px;margin:8px 0}small,.hint{font-size:12px;color:#d5bd94;line-height:1.6}.row{display:flex;gap:9px;align-items:center;justify-content:space-between}.stack{display:grid;gap:10px;margin-top:12px}.ctrl{display:grid;gap:6px;font-size:14px}
      .ctrl :is(input,select,textarea){width:100%;border:1px solid #a58655;background:#110c08;color:#ffe4bd;border-radius:9px;padding:12px;min-height:43px}
      textarea{min-height:95px;resize:vertical}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.action{background:#57361e;border:1px solid #ddae68;color:#ffe6bd;font-weight:650;border-radius:10px;min-height:49px;padding:9px 10px}.action:disabled{opacity:.45;cursor:not-allowed}.action.outline{background:#251c13}.action.red{background:#6b2c25;border-color:#d7a28d}.status{background:#100c09;border:1px solid #967140;padding:12px;border-radius:9px;min-height:49px;line-height:1.55;word-break:break-word}.status[data-error='1']{border-color:#e5a89b;color:#ffd3cd}.close{color:#ffe5be;background:#3b2c1c;border:1px solid #ae8b5d;border-radius:8px;padding:8px 11px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .log{padding:10px;border:1px solid #8d724e;border-radius:9px;margin-top:8px;font-size:12px;overflow-wrap:anywhere}.pill{display:inline-block;border:1px solid #9d7446;border-radius:20px;padding:4px 9px}.hidden{display:none!important}
      [hidden]{display:none!important}
    `;
    shadow.append(css);
    const bar=document.createElement('nav');bar.className='bar';bar.setAttribute('aria-label','P10 影像與語音快捷操作');bar.innerHTML=`<button type="button" id="q62quickphoto">📷 拍照記錄</button><button type="button" id="q62quickvoice">🎙️ 語音速記</button><a class="hotline" href="tel:119" aria-label="緊急撥號119，需有電信連線">緊急撥號 119 ↗</a>`;
    modal=document.createElement('div');modal.className='scrim';modal.hidden=true;modal.addEventListener('click',closeDrawer);
    sheet=document.createElement('section');sheet.className='panel';sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','q62heading');
    sheet.innerHTML=`<div class="row"><div><small id="q62category">Public Layer</small><h2 id="q62heading" tabindex="-1">現場紀錄</h2></div><button class="close" id="q62close" type="button">關閉</button></div>
      <p class="hint">裝置時間僅為本機記錄，不等於可信 T₀,k 認證。拍照／錄音不等於辨識、摘要覆核或外部送達。急救與求援優先。</p>
      <div class="actions"><button type="button" class="action" id="q62photo">📷 拍照／選圖</button><button type="button" class="action" id="q62voice">🎙️ 開始錄音</button></div>
      <input type="file" accept="image/*" capture="environment" id="q62file" hidden>
      <div class="status" id="q62media" role="status">原件尚未拍攝／錄製</div>
      <div class="stack">
      <label class="ctrl">觀察對象或事件代號（避免直接填傷患個資）<input id="q62subject" maxlength="80" placeholder="例如：現場A／行動紀錄"></label>
      <label class="ctrl">人工選擇狀態<select id="q62state"></select></label>
      <label class="ctrl">人工現場觀察／補記<textarea id="q62note" maxlength="1200" placeholder="僅寫所見、所聞、誰說、時間、處置；不得補造判斷"></textarea></label>
      <div class="grid2"><label class="ctrl">裝置上的觀察時間<input id="q62time" type="datetime-local"></label><label class="ctrl">來源<select id="q62source"><option>人工現場觀察</option><option>儀器畫面（人工抄錄）</option><option>照片原件</option><option>錄音原件</option><option>他人口述（待查證）</option><option>外部正式文件（待查核）</option></select></label></div>
      <label class="ctrl">操作者（姓名或授權代號）<input id="q62operator" maxlength="80" autocomplete="off" placeholder="人工確認紀錄者"></label>
      <button type="button" id="q62geo" class="action outline">取得定位（只在此刻、經人工確認；非敏感類）</button>
      <p id="q62protectedhint" class="hint" hidden>受保護知識僅得登錄授權／權利狀態，禁止輸入其實質內容。敏感座標外送預設禁止。</p>
      <button type="button" class="action" id="q62preview">產生候選摘要（僅整理人工輸入）</button>
      <label class="ctrl">候選摘要／人工修正<textarea id="q62summary" maxlength="1800" placeholder="請先產生候選摘要，再由人覆核"></textarea></label>
      <button type="button" class="action" id="q62save">人工確認並保存摘要</button>
      <div class="status" id="q62info" role="status" aria-live="polite">尚未保存</div>
      <div class="row"><a href="tel:119" style="color:#ffdfae;font-size:13px" id="q62emergency">緊急時開啟 119 撥號（需電信連線）</a><button type="button" id="q62history" class="action outline">查看本機紀錄</button></div>
      <div id="q62records" aria-live="polite"></div>
      </div>`;
    shadow.append(modal, sheet, bar);
    info=sheet.querySelector('#q62info');mediaPreview=sheet.querySelector('#q62media');subject=sheet.querySelector('#q62subject');textarea=sheet.querySelector('#q62note');operator=sheet.querySelector('#q62operator');obsTime=sheet.querySelector('#q62time');source=sheet.querySelector('#q62source');stateSelect=sheet.querySelector('#q62state');summaryText=sheet.querySelector('#q62summary');photoInput=sheet.querySelector('#q62file');recordButton=sheet.querySelector('#q62voice');saveButton=sheet.querySelector('#q62save');historyList=sheet.querySelector('#q62records');
    sheet.querySelector('#q62close').addEventListener('click',closeDrawer);
    sheet.querySelector('#q62photo').addEventListener('click',()=>photoInput.click());
    photoInput.addEventListener('change',async()=>{const file=photoInput.files?.[0];photoInput.value='';if(file)try{await mediaSave(file,'photo');updateLabels();}catch(e){alertStatus(`影像未保存：${e.message}`,true);}});
    recordButton.addEventListener('click',()=>recording?stopVoice():startVoice());
    sheet.querySelector('#q62preview').addEventListener('click',previewSummary);
    saveButton.addEventListener('click',saveVerified);
    sheet.querySelector('#q62history').addEventListener('click',showHistory);
    sheet.querySelector('#q62geo').addEventListener('click',captureLocation);
    shadow.querySelector('#q62quickphoto').addEventListener('click',()=>{setCategory('rescue','現場快拍／救援佐證');photoInput.click();});
    shadow.querySelector('#q62quickvoice').addEventListener('click',()=>{setCategory('rescue','現場語音速記／交接');startVoice();});
    document.addEventListener('keydown',e=>{
      if(!sheet||sheet.hidden)return;
      if(e.key==='Escape'){e.preventDefault();closeDrawer();}
      if(e.key==='Tab'){const focusables=[...shadow.querySelectorAll('.panel :is(button,input,select,textarea,a):not([disabled])')].filter(x=>x.offsetParent!==null); const first=focusables[0], last=focusables[focusables.length-1];if(e.shiftKey&&shadow.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&shadow.activeElement===last){e.preventDefault();first.focus();}}
    });
    document.body.style.paddingBottom='max(92px, env(safe-area-inset-bottom))';
  }
  function previewSummary(){
    const parts=[`分類：${currentLabel}`,`人工狀態：${stateSelect.value}`];
    if(subject.value.trim())parts.push(`事件代號：${short(subject.value,80)}`);
    if(textarea.value.trim())parts.push(`人工觀察：${short(textarea.value)}`);
    parts.push(`來源：${source.value}`,`使用者填寫觀察時間：${obsTime.value||'未提供'}`,`本機生成時間：${now()}`);
    if(latestMediaId)parts.push(`已有另存媒體原件：${latestMediaId}`);
    parts.push('以上為人工輸入的結構化候選摘要，非影像 AI 判讀、非語音轉寫、非醫療診斷或官方受理。');
    summaryText.value=parts.join('\n');
    alertStatus('候選摘要已產生（尚未保存）；請人工核對並確認');
  }
  async function saveVerified(){
    if(!operator.value.trim()){alertStatus('請填寫操作者／授權代號；尚未保存',true);operator.focus();return;}
    if(!secure()){alertStatus('安全來源不可用：請以 HTTPS／localhost 開啟，沒有保存任何紀錄',true);return;}
    if(!summaryText.value.trim()){alertStatus('請先產生或填寫候選摘要並人工覆核；尚未保存',true);return;}
    if(currentCategory==='protected' && /(-?\d{1,2}\.\d{4,}\s*[,，]\s*-?\d{2,3}\.\d{4,})/.test(summaryText.value+' '+subject.value)){alertStatus('疑似精確座標，不得寫入敏感資訊紀錄',true);return;}
    const canonical=JSON.stringify({category:currentCategory,label:currentLabel,operator:short(operator.value,80),source:source.value,observationTime:obsTime.value||null,summary:short(summaryText.value,1800),linkedMediaId:latestMediaId});
    saveButton.disabled=true; alertStatus('正在計算雜湊並寫入本機…');
    try{
      const ev={id:rid(),kind:'note.verified',category:currentCategory,label:currentLabel,operator:short(operator.value,80),source:source.value,observationTime:obsTime.value||null,deviceTime:now(),savedAt:now(),state:stateSelect.value,summary:short(summaryText.value,1800),hashSha256:await hashText(canonical),linkedMediaId:latestMediaId,verifiedByOperator:true,transmission:'NOT_SENT',receipt:'NOT_CONFIRMED',rights:'LOCAL_RESTRICTED'};
      await append(ev); alertStatus(`人工覆核紀錄已本機保存：${ev.id}；尚未外送／無回執`);await updateLabels();
    }catch(e){alertStatus(`紀錄未保存：${e.message}`,true);}finally{saveButton.disabled=false;}
  }
  async function captureLocation(){
    if(currentCategory==='protected')return alertStatus('敏感座標外送預設禁止；不提供 GPS 輸入',true);
    if(!navigator.geolocation)return alertStatus('此裝置不支援取得位置',true);
    alertStatus('等待本次定位許可；取得後只填入人工觀察欄位，不自動送出或保存');
    navigator.geolocation.getCurrentPosition(p=>{
      textarea.value+=(textarea.value?'\n':'')+`人工觸發當下裝置定位：${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}；精度估計±${Math.round(p.coords.accuracy)}m；尚未覆核／禁止外送`;alertStatus('座標僅填入草稿，尚未保存，請查核是否涉及敏感資訊');
    },e=>alertStatus('定位未取得：'+e.message,true),{enableHighAccuracy:false,timeout:12000,maximumAge:0});
  }
  async function startVoice(){
    if(currentCategory==='protected')return alertStatus('此類資料禁止錄製受保護知識或敏感座標原音',true);
    if(recording)return;
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)return alertStatus('瀏覽器不提供錄音；請改以人工文字速記',true);
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'';
      audioChunks=[];audioStopRequested=false;
      recording=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      const rec=recording;
      rec.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data)};
      rec.onerror=()=>{alertStatus('錄音發生錯誤，未保證保存',true);cleanupVoice()};
      rec.onstop=async()=>{
        const blob=new Blob(audioChunks,{type:rec.mimeType||'audio/mp4'});cleanupVoice();
        if(!audioStopRequested)return alertStatus('錄音中斷且未完成保存',true);
        try{await mediaSave(blob,'voice');await updateLabels();}catch(e){alertStatus('音訊未保存：'+e.message,true);}
      };
      rec.start(1000);recordButton.textContent='■ 停止錄音並保存';recordButton.classList.add('red');alertStatus('正在錄音；請於現場確認合法性與隱私。停止後才嘗試保存');
      setTimeout(()=>{if(recording===rec)stopVoice()},60000);
    }catch(e){cleanupVoice();alertStatus('麥克風不可用／未授權：'+e.message,true);}
  }
  function stopVoice(){if(!recording)return;audioStopRequested=true;try{recording.stop()}catch(e){cleanupVoice();alertStatus('錄音停止失敗：'+e.message,true);}}
  function cleanupVoice(){try{stream?.getTracks().forEach(x=>x.stop())}catch(e){}stream=null;recording=null;recordButton.textContent='🎙️ 開始錄音';recordButton.classList.remove('red');}
  async function showHistory(){
    historyList.textContent='讀取本機紀錄中…';
    try{const rows=(await allEvents()).filter(x=>x.category===currentCategory).slice(0,20);historyList.replaceChildren();if(!rows.length)historyList.textContent='沒有可讀取的本機紀錄';
      for(const x of rows){const box=document.createElement('div');box.className='log';const h=document.createElement('strong');h.textContent=`${x.kind==='media.raw'?'原始媒體':'人工覆核'}／${x.label}／${x.savedAt}`;const p=document.createElement('p');p.textContent=`雜湊：${x.hashSha256.slice(0,20)}…｜本機受限｜未送達`;
      box.append(h,p);if(x.summary){const p2=document.createElement('p');p2.textContent=x.summary;box.append(p2)}historyList.append(box)}
    }catch(e){historyList.textContent='本機紀錄讀取失敗：'+e.message;}
  }
  const bindingMap=[];
  function originalCard(node,category){
    if(!node) return null;
    let elem=node.parentElement;let candidates=[];
    for(let i=0;i<5&&elem;i++,elem=elem.parentElement){
      if(['BODY','MAIN','HTML'].includes(elem.tagName))break;
      const content=norm(elem.textContent);
      const len=content.length;
      if(len>=6&&len<125&&(STATUS_TEXT.test(elem.textContent)||elem.matches('button,[role="button"]'))){
        const children=[...elem.children].filter(x=>x.tagName!=='SCRIPT');
        if(children.length<=8)candidates.push({elem,len});
      }
    }
    return candidates.sort((a,b)=>a.len-b.len)[0]?.elem||null;
  }
  function findStaticCards(){
    if(!document.body)return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){return n.parentElement?.closest('#tsums-qa062-root,script,style,noscript,[data-qa062-bound]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];let cur;while(cur=walker.nextNode()){const t=norm(cur.nodeValue);if(t&&t.length<60)nodes.push({node:cur,t});}
    for(const [raw,category,label] of RULES){
      const wanted=norm(raw);
      for(const {node,t} of nodes){
        if(t!==wanted && t!==norm(label))continue;
        const card=originalCard(node,category);
        if(!card||card.dataset.qa062Bound)continue;
        if(card.querySelector('[data-qa061-open],[data-qa060-open],[data-qa059-note],[data-tsums-medical-domain]'))continue; // already wired prototypes
        if(card.matches('button,a,[role="button"]'))continue; // avoid overriding existing actions
        card.dataset.qa062Bound='true';
        card.setAttribute('aria-label',`${label}，點擊快速紀錄`);
        const b=document.createElement('button');b.type='button';b.textContent='＋ 記錄';b.className='tsums-q62-entry';b.style.cssText='display:block;margin:8px 0 0 auto;border:1px solid #c99a56;background:#48321d;color:#ffe0a3;border-radius:9px;min-height:39px;padding:7px 12px;font:600 15px -apple-system,sans-serif;cursor:pointer';
        b.addEventListener('click',e=>{e.stopPropagation();setCategory(category,label);});
        card.append(b);bindingMap.push({label,category,card,button:b});
        card.style.cursor='pointer';
        card.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea,[role="button"]'))return;setCategory(category,label);});
        break;
      }
    }
  }
  async function updateLabels(){
    try{const rows=await allEvents();for(const {category,label,button} of bindingMap){const ct=rows.filter(x=>x.category===category&&x.label===label).length;button.textContent=ct?`＋ 記錄（本機 ${ct} 筆）`:'＋ 記錄';}}catch(e){/* do not falsely update */}
  }
  function reconcileToolbar(){
    // Existing P10 bottom: 119 and one-key location. Only replace exact two-item bar, not generic emergency links.
    const clickable=[...document.querySelectorAll('a,button,[role="button"]')].filter(x=>!x.closest('#tsums-qa062-root'));
    const phone=clickable.find(x=>/119/.test(x.textContent||'')&&/緊急撥號/.test(x.textContent||''));
    if(!phone)return;
    const sibling=clickable.find(x=>/一鍵定位/.test(x.textContent||'')&&x.parentElement===phone.parentElement);
    if(!sibling)return;
    const dock=phone.parentElement;
    let p=dock, fixed=false; for(let i=0;i<4&&p;i++,p=p.parentElement){if(['fixed','sticky'].includes(getComputedStyle(p).position)){fixed=true;break;}}
    if(!fixed)return;
    // Do not delete the original controls: P9/P11 must restore their own dock on route switch.
    window.__TSUMS_QA062__.originalDock=dock;
    window.__TSUMS_QA062__.originalDockDisplay=dock.style.display;
    dock.style.display='none'; // Only hidden while P10 is the visible page.
    window.__TSUMS_QA062__.toolbarReplaced=true;
  }
  function isP10Document(){
    const bodytext=document.body?.innerText||'';
    return bodytext.includes('本區主責')&&(
      bodytext.includes('生態／權利邊界')||bodytext.includes('撤退路線與外援')||bodytext.includes('生命徵候與醫學')||bodytext.includes('事故求援交付')||bodytext.includes('行動網路')
    );
  }
  function syncPage(){
    const visible=isP10Document();
    if(!mounting){if(visible)boot();return;}
    if(host){const wanted=visible?'':'none';if(host.style.display!==wanted)host.style.display=wanted;}
    const d=window.__TSUMS_QA062__.originalDock;
    if(d && d.isConnected){const display=visible?'none':window.__TSUMS_QA062__.originalDockDisplay;if(d.style.display!==display)d.style.display=display;}
    if(!visible && sheet && !sheet.hidden)closeDrawer();
  }
  function boot(){
    if(mounting||!isP10Document())return;
    mounting=true;
    createUI();findStaticCards();reconcileToolbar();updateLabels();
    window.__TSUMS_QA062__.foundCardCount=()=>bindingMap.filter(x=>x.card.isConnected).length;
    window.__TSUMS_QA062__.open=(category,label)=>setCategory(category,label);
    window.__TSUMS_QA062__.storageCheck=async()=>({count:(await allEvents()).length,secure:secure()});
  }
  function observeRoutes(){
    let scheduled=false;
    const obs=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;syncPage();if(mounting&&isP10Document())findStaticCards();},50);});
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden']});
    syncPage();
    window.addEventListener('hashchange',syncPage);window.addEventListener('popstate',syncPage);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeRoutes,{once:true});else observeRoutes();
})();
