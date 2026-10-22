/* 강동자바라 개인용 도면·촬영관리 v1.2 — 서버/로그인/외부 전송 없음 */
(() => {
  'use strict';
  const DB_NAME = 'kd_personal_drawing_shoot_v1';
  const DB_VERSION = 1;
  const $ = (id) => document.getElementById(id);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dateDisplay = (s) => s ? String(s).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1.$2.$3') : '';
  const id = () => (crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sizeTxt = (n) => n > 1024*1024 ? `${(n / (1024*1024)).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`;
  const kinds = {photo:'사진', video:'영상', both:'사진 + 영상', drawing:'도면 확인', other:'기타'};
  const statuses = {planned:'예정',doing:'진행중',done:'완료'};
  let db;
  let projects = [], events = [], files = [];
  let viewMonth = new Date(); viewMonth.setDate(1);
  let selectedDay = today(), currentTab = 'calendar', searchTerm = '';
  let editingProjectId = null, editingEventId = null, detailProjectId = null, modalMedia = [], eventModalMedia = [];
  let toastTimeout, objectURLs = new Map();
  const strokes = [];
  let drawing = false, activeStroke = null;
  let sketchCanvas, sketchCtx;

  function notify(message, bad=false) {
    const node = $('toast'); node.textContent = message;
    node.style.background = bad ? '#9c433d' : '#173c59';
    node.classList.add('show'); clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => node.classList.remove('show'), 3600);
  }
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const store of ['projects','events','files']) if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, {keyPath:'id'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('다른 창에서 데이터베이스를 사용 중입니다.'));
    });
  }
  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName,'readonly'), req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  function transact(stores, change) {
    return new Promise((resolve,reject) => {
      let tx;
      try { tx = db.transaction(stores, 'readwrite'); change(tx); }
      catch (e) { reject(e); return; }
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('저장공간 사용이 중단되었습니다.'));
      tx.onerror = () => {}; // tx.onabort receives final cause
    });
  }
  async function reload() {
    [projects, events, files] = await Promise.all([getAll('projects'),getAll('events'),getAll('files')]);
    projects.sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
    renderAll();
  }
  function renderAll() {
    renderStats(); renderCalendar(); renderSelected(); renderUpcoming(); renderProjects(); renderSchedule();
  }
  function projectBy(idValue) { return projects.find(p => p.id === idValue); }
  function eventBy(idValue) { return events.find(e => e.id === idValue); }
  function eventSort(a,b) { return `${a.date}T${a.time||'00:00'}`.localeCompare(`${b.date}T${b.time||'00:00'}`); }
  function matchingProject(p) { return !searchTerm || [p.name,p.category,p.customer,p.size,p.special,p.shots].some(s=>String(s ?? '').toLowerCase().includes(searchTerm)); }
  function matchingEvent(e) { const p=projectBy(e.projectId); return !searchTerm || [e.title,e.date,e.memo,e.location,p?.name,p?.customer,p?.special].some(s=>String(s??'').toLowerCase().includes(searchTerm)); }
  function switchTab(tab) {
    currentTab=tab;
    document.querySelectorAll('[data-tab]').forEach(b => {b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));});
    for (const name of ['calendar','projects','schedule']) $(name+'View').classList.toggle('active', name===tab);
    renderAll();
  }
  function renderStats() {
    const active=events.filter(e=>e.status!=='done'), cur=today();
    $('statsProducts').innerHTML=`${projects.length}<span>건</span>`;
    $('statsUpcoming').innerHTML=`${active.filter(e=>e.date>=cur).length}<span>건</span>`;
    $('statsToday').innerHTML=`${events.filter(e=>e.date===cur).length}<span>건</span>`;
    $('statsDone').innerHTML=`${events.filter(e=>e.status==='done').length}<span>건</span>`;
  }
  function renderCalendar() {
    const y=viewMonth.getFullYear(), m=viewMonth.getMonth();
    $('monthLabel').textContent = `${y}년 ${m+1}월`;
    const firstWeekday = new Date(y,m,1).getDay();
    const daysInMonth = new Date(y,m+1,0).getDate();
    const cellCount = Math.ceil((firstWeekday+daysInMonth)/7)*7;
    let html='';
    for (let i=0;i<cellCount;i++) {
      const d=new Date(y,m,1-firstWeekday+i), date=localDate(d), activeMonth=d.getMonth()===m;
      const entries=events.filter(e=>e.date===date && matchingEvent(e)).sort(eventSort);
      html+=`<div class="day-cell ${activeMonth?'':'outside'} ${date===selectedDay?'selected':''} ${date===today()?'today':''} ${i%7===0?'sun':''} ${i%7===6?'sat':''}" data-date="${date}" role="button" tabindex="0" aria-label="${date} 일정 ${entries.length}건"><div class="day-top"><span class="day-num">${d.getDate()}</span>${entries.length>3?`<span class="more-events">+${entries.length-3}</span>`:''}</div><div class="day-items">${entries.slice(0,3).map(e=>`<button type="button" class="cal-event ${esc(e.type)} ${e.status==='done'?'is-done':''}" data-event="${esc(e.id)}" title="${esc(e.title)}"><span class="dot ${esc(e.type)}"></span><span class="cal-event-text">${e.status==='done'?'✓ ':''}${esc(e.title)}</span></button>`).join('')}</div></div>`;
    }
    $('calendarGrid').innerHTML=html;
  }
  function renderChecklist(e) {
    if (!Array.isArray(e.checklist) || !e.checklist.length) return '';
    const done=e.checklist.filter(c=>c.done).length;
    return `<div class="checklist-widget"><strong>촬영 체크리스트</strong>${e.checklist.map((item,i)=>`<label><input type="checkbox" data-check-event="${esc(e.id)}" data-check-index="${i}" ${item.done?'checked':''}><span>${esc(item.text)}</span></label>`).join('')}<span class="shot-progress">${done} / ${e.checklist.length} 완료</span></div>`;
  }
  function fileForEvent(eventId) { return files.filter(f => f.eventId === eventId && f.group === 'eventDrawing'); }
  function eventDrawingGallery(e) {
    const drawings=fileForEvent(e.id);
    if (!drawings.length) return '';
    return `<div class="event-drawing-gallery"><strong>▤ 첨부 도면 ${drawings.length}개 · 눌러서 확인</strong><div class="event-drawing-thumbs">${drawings.map(f=>{
      const src=f.type?.startsWith('image/')?objectURL(f):null;
      return `<button type="button" class="event-drawing-thumb" data-preview-file="${esc(f.id)}" title="${esc(f.name)}">${src?`<img src="${esc(src)}" alt="${esc(f.name)}">`:'<span class="pdf-symbol">PDF</span>'}<small>${esc(f.name)}</small></button>`;
    }).join('')}</div></div>`;
  }
  function eventCard(e) {
    const p=projectBy(e.projectId);
    const drawings=fileForEvent(e.id);
    return `<div class="selected-event"><span class="tag ${esc(e.type)}">${esc(kinds[e.type]||'기타')}</span> <span class="status-tag ${esc(e.status)}">${esc(statuses[e.status]||'예정')}</span>${drawings.length?` <span class="tag file-count">▤ 도면 ${drawings.length}</span>`:''}<h4>${esc(e.title)}</h4><div class="small-meta">${e.time ? `🕒 ${esc(e.time)}<br>`:''}${p ? `▤ ${esc(p.name)}<br>`:''}${e.location? `⌁ ${esc(e.location)}`:''}</div>${eventDrawingGallery(e)}${renderChecklist(e)}<div class="se-actions"><button type="button" class="tiny-btn" data-edit-event="${esc(e.id)}">수정</button>${p?`<button type="button" class="tiny-btn" data-open-project="${esc(p.id)}">제품 도면</button>`:''}<button type="button" class="tiny-btn" data-toggle-event="${esc(e.id)}">${e.status==='done'?'예정으로 변경':'✓ 완료'}</button><button type="button" class="tiny-btn action-danger" data-remove-event="${esc(e.id)}">삭제</button></div></div>`;
  }
  function renderSelected() {
    const d = new Date(`${selectedDay}T12:00:00`);
    $('selectedLabel').textContent=`${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
    const chosen=events.filter(e=>e.date===selectedDay && matchingEvent(e)).sort(eventSort);
    $('selectedEvents').innerHTML=chosen.length ? chosen.map(eventCard).join('') : '<div class="empty-small">선택한 날짜에 일정이 없습니다.<br>＋ 일정 버튼으로 추가해 보세요.</div>';
  }
  function renderUpcoming() {
    const next=events.filter(e=>e.status!=='done' && e.date>=today() && matchingEvent(e)).sort(eventSort).slice(0,6);
    $('upcomingEvents').innerHTML=next.length ? next.map(e=>{const d = new Date(`${e.date}T12:00:00`);return `<button type="button" class="upcoming-item" data-open-event="${esc(e.id)}"><div class="upcoming-day"><b>${d.getDate()}</b>${d.getMonth()+1}월</div><div class="upcoming-text"><b>${esc(e.title)}</b><span>${esc(e.time||'시간 미정')} · ${esc(kinds[e.type])}</span></div></button>`;}).join('') : '<div class="empty-small">다가오는 촬영 일정이 없습니다.</div>';
  }
  function fileForProject(projectId,kind='') { return files.filter(f=>f.projectId===projectId && (!kind||f.group===kind)); }
  function objectURL(f) {
    if (!f) return null;
    if (objectURLs.has(f.id)) return objectURLs.get(f.id);
    const blob=f.blob instanceof Blob ? f.blob : null;
    if (!blob) return null;
    const url=URL.createObjectURL(blob); objectURLs.set(f.id,url); return url;
  }
  function renderProjects() {
    const category=$('projectCategory').value;
    const filtered=projects.filter(p=>(category==='all'||p.category===category)&&matchingProject(p));
    $('projectResult').textContent=`${filtered.length}건 표시`;
    $('projectGrid').innerHTML=filtered.length ? filtered.map(p=>{
      const preview=fileForProject(p.id).find(f=>f.type?.startsWith('image/'));
      const src=preview?objectURL(preview):null;
      return `<article class="project-card" data-open-project="${esc(p.id)}" role="button" tabindex="0"><div class="project-thumb">${src?`<img src="${esc(src)}" alt="${esc(p.name)} 도면 또는 제품 사진">`:'<span class="placeholder-icon">▤</span>'}<span class="category-chip">${esc(p.category||'기타 제작품')}</span></div><div class="project-info"><h3>${esc(p.name)}</h3><p>${p.customer?'현장/고객: '+esc(p.customer):'현장/고객 미입력'}</p><p>${p.size?'규격: '+esc(p.size):'규격 미입력'}</p><p class="project-note">${esc(p.special||'제작 특이사항을 등록할 수 있습니다.')}</p></div><div class="project-foot"><span>첨부 ${fileForProject(p.id).length}개 · 일정 ${events.filter(e=>e.projectId===p.id).length}건</span><button type="button" data-open-project="${esc(p.id)}">상세 보기 →</button></div></article>`;
    }).join('') : `<div class="empty-large"><div class="empty-icon">▤</div><h3>${projects.length?'검색 결과가 없습니다':'등록된 제품이 없습니다'}</h3><p>${projects.length?'검색어나 종류를 변경해 보세요.':'새 제품을 등록하고 도면을 첨부해 보세요.'}</p><button type="button" class="btn btn-primary" data-create-project>＋ 제품 등록</button></div>`;
  }
  function renderSchedule() {
    const status=$('eventStatusFilter').value, kind=$('eventTypeFilter').value;
    const rows=events.filter(e=>(status==='all'||e.status===status)&&(kind==='all'||e.type===kind)&&matchingEvent(e)).sort(eventSort);
    $('eventResult').textContent=`${rows.length}건 표시`;
    $('scheduleRows').innerHTML=rows.length ? rows.map(e=>{
      const p=projectBy(e.projectId);
      const drawingCount=fileForEvent(e.id).length;
      return `<tr><td class="table-date">${esc(dateDisplay(e.date))}<span>${esc(e.time||'시간 미정')}</span></td><td><div class="table-title">${esc(e.title)}</div><div class="table-sub">${esc(kinds[e.type])} ${e.location?' · '+esc(e.location):''}</div>${drawingCount?`<button type="button" class="schedule-file-link" data-edit-event="${esc(e.id)}">▤ 첨부 도면 ${drawingCount}개 보기</button>`:''}</td><td class="table-project">${p?`<button type="button" class="tiny-btn" data-open-project="${esc(p.id)}">${esc(p.name)}</button>`:'—'}</td><td><span class="status-tag ${esc(e.status)}">${esc(statuses[e.status])}</span></td><td><div class="table-actions"><button type="button" class="tiny-btn" data-edit-event="${esc(e.id)}">수정</button><button type="button" class="tiny-btn" data-toggle-event="${esc(e.id)}">${e.status==='done'?'예정':'완료'}</button><button type="button" class="tiny-btn action-danger" data-remove-event="${esc(e.id)}">삭제</button></div></td></tr>`;
    }).join('') : '<tr class="blank-row"><td colspan="5">조건에 맞는 일정이 없습니다. ＋ 새 일정 등록을 눌러 주세요.</td></tr>';
  }
  function showModal(which) { $(which).hidden=false; document.body.style.overflow='hidden'; }
  function closeModal(which) { $(which).hidden=true; if (!document.querySelector('.modal-backdrop:not([hidden])')) document.body.style.overflow=''; }
  function showProject(idValue=null) {
    editingProjectId=idValue;
    const p=idValue?projectBy(idValue):null;
    if (idValue&&!p) {notify('제품을 찾을 수 없습니다.',true);return;}
    $('projectForm').reset();
    $('projectModalTitle').textContent=p?'제품 / 도면 수정':'제품 / 도면 등록';
    $('projectSaveBtn').textContent=p?'제품 수정 저장':'제품 · 도면 저장';
    for (const [field,key] of [['pName','name'],['pCategory','category'],['pCustomer','customer'],['pSize','size'],['pSpecial','special'],['pShots','shots']]) {
      if (p) $(field).value=p[key] ?? '';
    }
    modalMedia=p?fileForProject(p.id).map(f=>({...f,existing:true})):[];
    $('drawingInput').value=''; $('referenceInput').value='';
    $('sketchBox').hidden=true; strokes.length=0; redrawSketch();
    renderMedia(); showModal('projectModal');
  }
  function showEvent(idValue=null, date=null, projectId=null) {
    editingEventId=idValue;
    const e=idValue?eventBy(idValue):null;
    if (idValue&&!e) {notify('일정을 찾을 수 없습니다.',true);return;}
    $('eventForm').reset();
    eventModalMedia=e?fileForEvent(e.id).map(f=>({...f,existing:true})):[];
    $('eventDrawingInput').value='';
    renderEventDrawings();
    $('eventModalTitle').textContent=e?'촬영 / 작업 일정 수정':'새 촬영 일정';
    $('eventSaveBtn').textContent=e?'일정 수정 저장':'일정 저장';
    $('eProject').innerHTML='<option value="">연결 안 함 (독립 일정)</option>'+projects.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.customer?' · '+esc(p.customer):''}</option>`).join('');
    if (e) {
      for (const [field,key] of [['eTitle','title'],['eDate','date'],['eTime','time'],['eType','type'],['eStatus','status'],['eProject','projectId'],['eLocation','location'],['eMemo','memo']]) $(field).value=e[key]??'';
      $('eChecklist').value=(e.checklist||[]).map(c=>c.text).join('\n');
    } else {
      $('eDate').value=date||selectedDay||today();
      if (projectId) $('eProject').value=projectId;
      const p=projectId?projectBy(projectId):null;
      if (p && p.shots) $('eChecklist').value=p.shots;
    }
    renderLinkedProjectDrawings();
    showModal('eventModal');
  }
  function renderEventDrawings() {
    const node=$('eventDrawingsList');
    node.innerHTML=eventModalMedia.length ? eventModalMedia.map(f=>{
      const src=f.type?.startsWith('image/')?objectURL(f):null;
      return `<div class="file-item"><div class="file-thumbnail">${src?`<img src="${esc(src)}" alt="">`:'PDF'}</div><div class="file-item-info"><button type="button" data-preview-file="${esc(f.id)}" title="클릭하여 도면 열기">${esc(f.name)}</button><small>${sizeTxt(f.size||0)} · ${f.existing?'저장된 도면':'저장 대기'}</small></div><button type="button" class="file-remove" data-drop-event-media="${esc(f.id)}" aria-label="${esc(f.name)} 첨부 제거">×</button></div>`;
    }).join('') : '<div class="file-empty">아직 등록된 도면이 없습니다. 여러 파일을 한 번에 선택할 수 있습니다.</div>';
  }
  function addEventDrawings(input) {
    for (const f of Array.from(input.files || [])) {
      const image=f.type.startsWith('image/'), pdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
      if (!image && !pdf) {notify('도면은 이미지(JPG, PNG 등) 또는 PDF만 첨부할 수 있습니다.',true);continue;}
      if (f.size>25*1024*1024) {notify(`${f.name}: 도면 파일은 25MB 이하만 첨부할 수 있습니다.`,true);continue;}
      eventModalMedia.push({id:id(),group:'eventDrawing',eventId:editingEventId||'',name:f.name,type:f.type||(pdf?'application/pdf':'application/octet-stream'),size:f.size,blob:f,existing:false,createdAt:new Date().toISOString()});
    }
    input.value='';renderEventDrawings();
  }
  function renderLinkedProjectDrawings() {
    const node=$('linkedProjectDrawings');
    const projectId=$('eProject').value;
    const drawings=projectId?fileForProject(projectId,'drawing'):[];
    node.hidden=!drawings.length;
    if (!drawings.length) {node.innerHTML='';return;}
    node.innerHTML=`<strong>▤ 선택한 제품에 이미 등록된 도면 ${drawings.length}개</strong><div>${drawings.map(f=>`<button type="button" class="tiny-btn" data-preview-file="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div><small>이 도면은 기존 제품 보관함에 저장되어 있습니다. 일정에도 별도로 올릴 필요는 없습니다.</small>`;
  }
  function renderMedia() {
    for (const group of ['drawing','reference']) {
      const target=$(group==='drawing'?'drawingsList':'referencesList');
      const found=modalMedia.filter(f=>f.group===group);
      target.innerHTML=found.length ? found.map(f=>`<div class="file-item"><div class="file-thumbnail">${f.type.startsWith('image/')?'사진':f.type.startsWith('video/')?'영상':f.type.includes('pdf')?'PDF':'파일'}</div><div class="file-item-info"><button type="button" data-preview-file="${esc(f.id)}" title="클릭하면 열기">${esc(f.name)}</button><small>${sizeTxt(f.size || 0)}</small></div><button type="button" class="file-remove" data-drop-media="${esc(f.id)}" aria-label="첨부 제거">×</button></div>`).join('') : '<div class="file-empty">등록된 자료가 없습니다.</div>';
    }
  }
  function addMedia(input,group) {
    const items=Array.from(input.files||[]);
    for (const f of items) {
      const isImage=f.type.startsWith('image/'), isVideo=f.type.startsWith('video/'), isPdf=f.type==='application/pdf'||/\.pdf$/i.test(f.name);
      const approved=group==='drawing' ? (isImage||isPdf) : (isImage||isVideo);
      const limit=isVideo?60*1024*1024:25*1024*1024;
      if (!approved) { notify('첨부 가능한 형식은 이미지, PDF(도면), 영상(참고)입니다.',true);continue; }
      if (f.size>limit) {notify(`${f.name}: 파일당 최대 ${isVideo?'60':'25'}MB까지 가능합니다.`,true);continue;}
      modalMedia.push({id:id(),group,projectId:editingProjectId||'',name:f.name,type:f.type||(isPdf?'application/pdf':'application/octet-stream'),size:f.size,blob:f,existing:false,createdAt:new Date().toISOString()});
    }
    input.value='';renderMedia();
  }
  async function saveProject(evt) {
    evt.preventDefault();
    const name=$('pName').value.trim(); if (!name) return;
    const old=editingProjectId?projectBy(editingProjectId):null, projectId=editingProjectId||id();
    const p={id:projectId,name,category:$('pCategory').value,customer:$('pCustomer').value.trim(),size:$('pSize').value.trim(),special:$('pSpecial').value.trim(),shots:$('pShots').value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const changed=modalMedia.filter(f=>!f.existing).map(f=>({...f,projectId,existing:undefined}));
    const keep=new Set(modalMedia.map(f=>f.id)), removed=files.filter(f=>f.projectId===projectId&&!keep.has(f.id));
    const saveBtn=$('projectSaveBtn'); saveBtn.disabled=true;
    try {
      await transact(['projects','files'], tx=>{
        tx.objectStore('projects').put(p);
        for (const f of removed) tx.objectStore('files').delete(f.id);
        for (const f of changed) tx.objectStore('files').put(f);
      });
      for (const f of removed) releaseObjectURL(f.id);
      closeModal('projectModal'); await reload();
      notify(old?'제품 및 도면을 수정했습니다.':'제품 및 도면을 등록했습니다.');
    } catch(err) { console.error(err);notify('저장에 실패했습니다. 브라우저 저장공간을 확인하고 영상 용량을 줄여 주세요.',true); }
    finally { saveBtn.disabled=false; }
  }
  async function saveEvent(evt) {
    evt.preventDefault();
    const title=$('eTitle').value.trim(), date=$('eDate').value;
    if (!title||!date) return;
    const old=editingEventId?eventBy(editingEventId):null;
    const oldChecklist=(old?.checklist||[]);
    const checklist=$('eChecklist').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((text,i)=>({text,done:oldChecklist[i]?.text===text?Boolean(oldChecklist[i].done):false}));
    const e={id:old?.id||id(),title,date,time:$('eTime').value,projectId:$('eProject').value,type:$('eType').value,status:$('eStatus').value,location:$('eLocation').value.trim(),memo:$('eMemo').value.trim(),checklist,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    const keep=new Set(eventModalMedia.map(f=>f.id));
    const removed=files.filter(f=>f.eventId===e.id && f.group==='eventDrawing' && !keep.has(f.id));
    const added=eventModalMedia.filter(f=>!f.existing).map(f=>({id:f.id,group:'eventDrawing',eventId:e.id,name:f.name,type:f.type,size:f.size,blob:f.blob,createdAt:f.createdAt}));
    const saveBtn=$('eventSaveBtn');saveBtn.disabled=true;
    try {
      await transact(['events','files'],tx=>{
        tx.objectStore('events').put(e);
        for (const f of removed) tx.objectStore('files').delete(f.id);
        for (const f of added) tx.objectStore('files').put(f);
      });
      removed.forEach(f=>releaseObjectURL(f.id));
      closeModal('eventModal'); selectedDay=date;const d=new Date(`${date}T12:00:00`);viewMonth=new Date(d.getFullYear(),d.getMonth(),1);
      await reload();switchTab('calendar');
      notify(old?`일정과 도면을 수정했습니다. (도면 ${eventModalMedia.length}개)`:`일정과 도면을 저장했습니다. (도면 ${eventModalMedia.length}개)`);
    } catch(err) {console.error(err);notify('일정 또는 첨부 도면을 저장할 수 없습니다. 저장공간을 확인하세요.',true);} finally{saveBtn.disabled=false;}
  }
  function renderDetail(idValue) {
    const p=projectBy(idValue);if(!p)return;
    detailProjectId=idValue; $('detailTitle').textContent=p.name;
    const cell=(label,content,wide=false)=>`<div class="detail-row ${wide?'wide':''}"><strong>${label}</strong><div>${content||'—'}</div></div>`;
    const media=fileForProject(p.id);
    const fileGrid=(group)=>{const subset=media.filter(f=>f.group===group);return subset.length?`<div class="detail-files">${subset.map(f=>{const src=f.type.startsWith('image/')?objectURL(f):null;return `<button type="button" class="detail-file" data-preview-file="${esc(f.id)}"><div class="file-visual">${src?`<img src="${esc(src)}" alt="${esc(f.name)}">`:f.type.startsWith('video/')?'▶':f.type.includes('pdf')?'PDF':'▤'}</div><span title="${esc(f.name)}">${esc(f.name)}</span></button>`;}).join('')}</div>`:'<div class="file-empty">첨부된 자료가 없습니다.</div>';};
    const related=events.filter(e=>e.projectId===p.id).sort(eventSort);
    $('detailContent').innerHTML=`<div class="detail-grid">${cell('제품 종류',esc(p.category))}${cell('현장 / 고객',esc(p.customer))}${cell('규격 / 치수',esc(p.size))}${cell('제작 특이사항',esc(p.special),true)}${cell('필요한 촬영 장면',esc(p.shots),true)}</div><div class="detail-section"><h3>▤ 도면 · 치수 자료 (${media.filter(f=>f.group==='drawing').length})</h3>${fileGrid('drawing')}</div><div class="detail-section"><h3>▧ 참고 사진 · 영상 (${media.filter(f=>f.group==='reference').length})</h3>${fileGrid('reference')}</div><div class="detail-section"><h3>▦ 관련 촬영 일정 (${related.length})</h3><div class="detail-related">${related.length?related.map(e=>`<button type="button" data-open-event="${esc(e.id)}"><b>${esc(dateDisplay(e.date))} · ${esc(e.title)}</b><span>${esc(kinds[e.type])} · ${esc(statuses[e.status])}</span></button>`).join(''):'<div class="file-empty">이 제품과 연결된 일정이 없습니다.</div>'}</div></div>`;
    showModal('detailModal');
  }
  function releaseObjectURL(fId) { const url=objectURLs.get(fId);if(url){URL.revokeObjectURL(url);objectURLs.delete(fId);} }
  function previewFile(fId) {
    const f=eventModalMedia.find(f=>f.id===fId)||modalMedia.find(f=>f.id===fId)||files.find(f=>f.id===fId);
    if (!f) { notify('첨부 파일이 없습니다.',true);return; }
    const url=objectURL(f);if (!url) {notify('파일을 열 수 없습니다.',true);return;}
    const w=window.open(url,'_blank','noopener');
    if (!w) {const a=document.createElement('a');a.href=url;a.download=f.name;a.click();notify('파일을 다운로드했습니다.');}
  }
  async function deleteEvent(eId) {
    const e=eventBy(eId);if (!e||!confirm(`'${e.title}' 일정을 삭제할까요?`))return;
    const attached=fileForEvent(eId);
    if (attached.length && !confirm(`이 일정에 첨부된 도면 ${attached.length}개도 함께 삭제됩니다. 계속할까요?`)) return;
    try {await transact(['events','files'],tx=>{
      tx.objectStore('events').delete(eId);
      for (const f of attached)tx.objectStore('files').delete(f.id);
    });attached.forEach(f=>releaseObjectURL(f.id));await reload();notify('일정과 첨부 도면을 삭제했습니다.');}
    catch(err){console.error(err);notify('일정을 삭제할 수 없습니다.',true);}
  }
  async function deleteProject(pId) {
    const p=projectBy(pId);if(!p)return;
    const related=events.filter(e=>e.projectId===pId).length;
    if(!confirm(`'${p.name}' 제품과 첨부 도면을 삭제할까요?${related?`\n연결된 일정 ${related}건은 삭제되지 않고, 제품 연결만 해제됩니다.`:''}`))return;
    const attachments=fileForProject(pId);
    try {await transact(['projects','events','files'],tx=>{
      tx.objectStore('projects').delete(pId);
      for(const f of attachments)tx.objectStore('files').delete(f.id);
      for(const e of events.filter(e=>e.projectId===pId))tx.objectStore('events').put({...e,projectId:''});
    });
    attachments.forEach(f=>releaseObjectURL(f.id));closeModal('detailModal');await reload();notify('제품을 삭제했습니다. 연결된 일정은 보존됩니다.');
    }catch(err){console.error(err);notify('삭제하지 못했습니다.',true);}
  }
  async function toggleStatus(eId) {
    const e=eventBy(eId);if(!e)return;
    try {await transact(['events'],tx=>tx.objectStore('events').put({...e,status:e.status==='done'?'planned':'done',updatedAt:new Date().toISOString()}));await reload();}
    catch(err){console.error(err);notify('상태 변경에 실패했습니다.',true);}
  }
  async function toggleCheck(eId,index,checked) {
    const e=eventBy(eId);if(!e||!e.checklist?.[index])return;
    const checklist=e.checklist.map((item,i)=>({...item,done:i===index?checked:item.done}));
    try {await transact(['events'],tx=>tx.objectStore('events').put({...e,checklist,updatedAt:new Date().toISOString()}));await reload();}
    catch(err){console.error(err);notify('체크 항목을 저장하지 못했습니다.',true);}
  }
  function setupSketch() {
    sketchCanvas=$('sketchCanvas');sketchCtx=sketchCanvas.getContext('2d');redrawSketch();
    const point=(ev)=>{const bounds=sketchCanvas.getBoundingClientRect();return {x:(ev.clientX-bounds.left)*sketchCanvas.width/bounds.width,y:(ev.clientY-bounds.top)*sketchCanvas.height/bounds.height};};
    sketchCanvas.addEventListener('pointerdown',ev=>{drawing=true;activeStroke=[point(ev)];strokes.push(activeStroke);sketchCanvas.setPointerCapture(ev.pointerId);redrawSketch();});
    sketchCanvas.addEventListener('pointermove',ev=>{if(!drawing||!activeStroke)return;activeStroke.push(point(ev));redrawSketch();});
    const finish=()=>{drawing=false;activeStroke=null;};
    sketchCanvas.addEventListener('pointerup',finish);sketchCanvas.addEventListener('pointercancel',finish);
    $('undoSketch').addEventListener('click',()=>{strokes.pop();redrawSketch();});
    $('clearSketch').addEventListener('click',()=>{if(strokes.length && confirm('스케치의 모든 선을 지울까요?')){strokes.length=0;redrawSketch();}});
    $('saveSketch').addEventListener('click',()=>{
      if(!strokes.length){notify('먼저 도면을 그려 주세요.',true);return;}
      sketchCanvas.toBlob(blob=>{
        if(!blob){notify('스케치를 저장할 수 없습니다.',true);return;}
        modalMedia.push({id:id(),group:'drawing',projectId:editingProjectId||'',name:`간단도면_${today()}_${String(Date.now()).slice(-4)}.png`,type:'image/png',size:blob.size,blob,existing:false,createdAt:new Date().toISOString()});
        renderMedia();notify('스케치를 도면 목록에 추가했습니다. 제품 저장 버튼도 눌러 주세요.');
      },'image/png');
    });
  }
  function redrawSketch() {
    if(!sketchCanvas||!sketchCtx)return;
    const ctx=sketchCtx, w=sketchCanvas.width,h=sketchCanvas.height;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    ctx.lineWidth=.65;ctx.strokeStyle='#edf2f5';
    for(let x=0;x<=w;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<=h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.lineWidth=3;ctx.strokeStyle='#173c59';ctx.lineCap='round';ctx.lineJoin='round';
    for(const points of strokes){if(!points.length)continue;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);if(points.length===1)ctx.lineTo(points[0].x+.01,points[0].y+.01);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();}
  }
  function blobAsBase64(blob) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
  }
  function base64ToBlob(b64,mime) {
    const byteCharacters=atob(b64), slices=[];
    for(let i=0;i<byteCharacters.length;i+=1024*256){const slice=byteCharacters.slice(i,i+1024*256), bytes=new Uint8Array(slice.length);for(let j=0;j<slice.length;j++)bytes[j]=slice.charCodeAt(j);slices.push(bytes);}
    return new Blob(slices,{type:mime||'application/octet-stream'});
  }
  async function backup() {
    const btn=$('backupBtn');btn.disabled=true;btn.textContent='백업 만드는 중…';
    try {
      const data={application:'kd-personal-shoot-planner',version:1,exportedAt:new Date().toISOString(),projects,events,files:[]};
      for(const f of files) data.files.push({id:f.id,projectId:f.projectId||'',eventId:f.eventId||'',group:f.group,name:f.name,type:f.type,size:f.size,createdAt:f.createdAt,base64:await blobAsBase64(f.blob)});
      const json=JSON.stringify(data),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`강동자바라_개인도면촬영_백업_${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      notify(`백업 완료 · 제품 ${projects.length}건, 일정 ${events.length}건, 첨부 ${files.length}개`);
    } catch(err) {console.error(err);notify('백업을 만들지 못했습니다. 첨부 영상이 너무 크면 영상 원본을 별도로 보관하세요.',true);}
    finally{btn.disabled=false;btn.textContent='⇩ 백업 저장';}
  }
  async function restore(sourceFile) {
    if(!sourceFile)return;
    if(sourceFile.size>400*1024*1024){notify('백업 파일이 너무 큽니다(400MB 초과).',true);return;}
    const btn=$('restoreBtn');btn.disabled=true;
    try {
      const data=JSON.parse(await sourceFile.text());
      if(data.application!=='kd-personal-shoot-planner'||data.version!==1||!Array.isArray(data.projects)||!Array.isArray(data.events)||!Array.isArray(data.files))throw Error('강동자바라 개인 도면·촬영 백업 파일이 아닙니다.');
      if(!confirm(`백업 내용을 불러오면 현재 PC의 제품 ${projects.length}건과 일정 ${events.length}건을 백업 내용으로 교체합니다.\n\n백업 파일: 제품 ${data.projects.length}건, 일정 ${data.events.length}건, 첨부 ${data.files.length}개\n\n계속할까요?`))return;
      const imported=[];
      for(const entry of data.files) {
        const validProjectFile=['drawing','reference'].includes(entry.group) && !!entry.projectId;
        const validEventFile=entry.group==='eventDrawing' && !!entry.eventId;
        if(typeof entry.base64!=='string'||!entry.id||!entry.name||(!validProjectFile&&!validEventFile))throw Error('첨부파일 정보가 손상되었습니다.');
        imported.push({id:entry.id,projectId:entry.projectId||'',eventId:entry.eventId||'',group:entry.group,name:entry.name,type:entry.type||'application/octet-stream',size:entry.size||0,createdAt:entry.createdAt||'',blob:base64ToBlob(entry.base64,entry.type)});
      }
      for(const a of data.projects)if(!a.id||typeof a.name!=='string')throw Error('제품 정보가 손상되었습니다.');
      for(const a of data.events)if(!a.id||!a.date||!a.title)throw Error('일정 정보가 손상되었습니다.');
      await transact(['projects','events','files'],tx=>{
        for(const key of ['projects','events','files'])tx.objectStore(key).clear();
        for(const p of data.projects)tx.objectStore('projects').put(p);
        for(const e of data.events)tx.objectStore('events').put(e);
        for(const f of imported)tx.objectStore('files').put(f);
      });
      for(const key of objectURLs.keys())releaseObjectURL(key);
      await reload();notify('백업 불러오기 완료! 모든 도면과 일정이 복원되었습니다.');
    } catch(err){console.error(err);notify(`백업을 불러올 수 없습니다: ${err.message}`,true);}
    finally{btn.disabled=false;$('restoreInput').value='';}
  }
  function attachListeners() {
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
    for(const key of ['newProjectBtn','newProjectBtn2'])$(key).addEventListener('click',()=>showProject());
    for(const key of ['newEventBtn','newEventBtn2'])$(key).addEventListener('click',()=>showEvent());
    $('addSelectedDate').addEventListener('click',()=>showEvent(null,selectedDay));
    $('prevMonth').addEventListener('click',()=>{viewMonth.setMonth(viewMonth.getMonth()-1);renderCalendar();});
    $('nextMonth').addEventListener('click',()=>{viewMonth.setMonth(viewMonth.getMonth()+1);renderCalendar();});
    $('todayBtn').addEventListener('click',()=>{const d=new Date();viewMonth=new Date(d.getFullYear(),d.getMonth(),1);selectedDay=today();renderCalendar();renderSelected();});
    $('searchInput').addEventListener('input',ev=>{searchTerm=ev.target.value.trim().toLowerCase();renderAll();});
    $('projectCategory').addEventListener('change',renderProjects);
    $('eventStatusFilter').addEventListener('change',renderSchedule);
    $('eventTypeFilter').addEventListener('change',renderSchedule);
    $('projectForm').addEventListener('submit',saveProject);
    $('eventForm').addEventListener('submit',saveEvent);
    $('eventDrawingInput').addEventListener('change',ev=>addEventDrawings(ev.target));
    $('eProject').addEventListener('change',renderLinkedProjectDrawings);
    $('drawingInput').addEventListener('change',ev=>addMedia(ev.target,'drawing'));
    $('referenceInput').addEventListener('change',ev=>addMedia(ev.target,'reference'));
    $('toggleSketch').addEventListener('click',()=>{$('sketchBox').hidden=!$('sketchBox').hidden;if(!$('sketchBox').hidden)redrawSketch();});
    $('helpBtn').addEventListener('click',()=>showModal('helpModal'));
    $('backupBtn').addEventListener('click',backup);
    $('restoreBtn').addEventListener('click',()=>$('restoreInput').click());
    $('restoreInput').addEventListener('change',ev=>restore(ev.target.files[0]));
    $('detailEdit').addEventListener('click',()=>{const value=detailProjectId;closeModal('detailModal');showProject(value);});
    $('detailDelete').addEventListener('click',()=>deleteProject(detailProjectId));
    $('detailAddEvent').addEventListener('click',()=>{const value=detailProjectId;closeModal('detailModal');showEvent(null,selectedDay,value);});
    document.addEventListener('click',ev=>{
      const t=ev.target;
      const close=t.closest('[data-close]');if(close){closeModal(close.dataset.close);return;}
      const dropped=t.closest('[data-drop-media]');if(dropped){modalMedia=modalMedia.filter(f=>f.id!==dropped.dataset.dropMedia);renderMedia();return;}
      const droppedEvent=t.closest('[data-drop-event-media]');if(droppedEvent){eventModalMedia=eventModalMedia.filter(f=>f.id!==droppedEvent.dataset.dropEventMedia);renderEventDrawings();return;}
      const preview=t.closest('[data-preview-file]');if(preview){previewFile(preview.dataset.previewFile);return;}
      const edit=t.closest('[data-edit-event]');if(edit){showEvent(edit.dataset.editEvent);return;}
      const toggle=t.closest('[data-toggle-event]');if(toggle){toggleStatus(toggle.dataset.toggleEvent);return;}
      const remove=t.closest('[data-remove-event]');if(remove){deleteEvent(remove.dataset.removeEvent);return;}
      const create=t.closest('[data-create-project]');if(create){showProject();return;}
      const openProj=t.closest('[data-open-project]');if(openProj){renderDetail(openProj.dataset.openProject);return;}
      const openEvt=t.closest('[data-open-event]');if(openEvt){closeModal('detailModal');showEvent(openEvt.dataset.openEvent);return;}
      const calEvt=t.closest('[data-event]');if(calEvt){showEvent(calEvt.dataset.event);return;}
      const cell=t.closest('[data-date]');if(cell){selectedDay=cell.dataset.date;const d=new Date(`${selectedDay}T12:00:00`);viewMonth=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar();renderSelected();}
    });
    document.addEventListener('change',ev=>{if(ev.target.matches('[data-check-event]'))toggleCheck(ev.target.dataset.checkEvent,Number(ev.target.dataset.checkIndex),ev.target.checked);});
    document.addEventListener('keydown',ev=>{
      if(ev.key==='Escape') { const open=[...document.querySelectorAll('.modal-backdrop:not([hidden])')];if(open.length)closeModal(open.at(-1).id); }
      if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.day-cell[data-date],.project-card[data-open-project]')) {ev.preventDefault();ev.target.click();}
    });
    document.querySelectorAll('.modal-backdrop').forEach(el=>el.addEventListener('mousedown',ev=>{if(ev.target===el)closeModal(el.id);}));
    window.addEventListener('beforeunload',()=>{for(const key of objectURLs.keys())releaseObjectURL(key);});
  }
  async function init() {
    try {
      if(!('indexedDB' in window))throw new Error('이 브라우저는 로컬 데이터 저장 기능을 지원하지 않습니다.');
      db=await openDB();setupSketch();attachListeners();await reload();
    } catch(err) {
      console.error('초기화 실패',err);
      document.querySelector('.page-intro p').textContent=`저장공간을 열 수 없습니다: ${err.message}. 크롬/엣지에서 다시 열거나 브라우저 개인정보 보호 설정을 확인하세요.`;
      notify('저장소를 열지 못했습니다. 사용 방법 안내를 확인하세요.',true);
    }
  }
  init();
})();
