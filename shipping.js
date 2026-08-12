const calendarEl = document.getElementById("shippingCalendar");
const notice = document.getElementById("notice");
let cachedRows = [];
let calendarDate = new Date();

if(!configured){
  notice.classList.add("show");
  syncText.textContent = "설정 필요";
}else{
  syncText.textContent = "실시간 연결됨";
}

function todayISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function dateKey(y,m,d){
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

prevMonth.onclick = ()=>{
  calendarDate.setMonth(calendarDate.getMonth()-1);
  renderCalendar();
};
nextMonth.onclick = ()=>{
  calendarDate.setMonth(calendarDate.getMonth()+1);
  renderCalendar();
};
todayMonth.onclick = ()=>{
  calendarDate = new Date();
  renderCalendar();
};

async function loadOrders(){
  if(!configured){
    calendarEl.innerHTML = '<div class="empty">config.js 설정 후 사용 가능합니다.</div>';
    return;
  }

  const {data,error} = await db
    .from("production_orders")
    .select("*")
    .order("ship_date",{ascending:true});

  if(error){
    calendarEl.innerHTML = '<div class="empty">불러오기 오류: '+esc(connectionHelp(error))+'</div>';
    return;
  }

  cachedRows = data || [];
  renderCalendar();
}

function renderCalendar(){
  const y = calendarDate.getFullYear();
  const m = calendarDate.getMonth();
  calendarTitle.textContent = `${y}년 ${m+1}월`;

  const first = new Date(y,m,1);
  const last = new Date(y,m+1,0);
  const startDay = first.getDay();
  const totalDays = last.getDate();

  let html = `
    <div class="cal-head sun">일</div>
    <div class="cal-head">월</div>
    <div class="cal-head">화</div>
    <div class="cal-head">수</div>
    <div class="cal-head">목</div>
    <div class="cal-head">금</div>
    <div class="cal-head sat">토</div>
  `;

  for(let i=0;i<startDay;i++){
    html += '<div class="cal-cell empty-cell"></div>';
  }

  for(let d=1; d<=totalDays; d++){
    const key = dateKey(y,m,d);
    const dayRows = cachedRows.filter(o=>o.ship_date===key);
    const isToday = key===todayISO();

    html += `
      <div class="cal-cell ${isToday?"today":""}">
        <div class="cal-date">${d}</div>
        <div class="cal-orders">
          ${dayRows.map(o=>`
            <button class="cal-company ${o.hanam_office ? "hanam" : ""}" data-id="${o.id}" type="button">
              ${esc(o.customer)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  calendarEl.innerHTML = html;

  calendarEl.querySelectorAll(".cal-company").forEach(btn=>{
    btn.onclick = ()=>openOrderPopup(btn.dataset.id);
  });
}

function openOrderPopup(id){
  const o = cachedRows.find(x=>String(x.id)===String(id));
  if(!o) return;

  const popup = window.open("","_blank","width=680,height=800,scrollbars=yes");
  if(!popup){
    alert("팝업 차단을 해제해 주세요.");
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <title>${esc(o.customer)} - 출고정보</title>
      <style>
        body{font-family:Arial,"Malgun Gothic",sans-serif;margin:0;background:#eef4f8;color:#102333}
        .box{max-width:620px;margin:20px auto;background:white;border-radius:16px;padding:22px}
        h1{font-size:30px;margin:0 0 16px;color:#143c5b}
        .status{display:inline-block;padding:7px 11px;border-radius:999px;background:${o.status==="done"?"#e5f7ed":"#fff0e4"};font-weight:900}
        .row{padding:14px 0;border-bottom:1px solid #dde6ec}
        .label{font-size:14px;color:#607687;font-weight:900;margin-bottom:5px}
        .value{font-size:20px;font-weight:800;white-space:pre-wrap;line-height:1.5}
        img{max-width:100%;border-radius:12px;margin-top:10px}
      </style>
    </head>
    <body>
      <div class="box">
        <h1>${esc(o.customer)}</h1>
        <span class="status">${o.status==="done"?"✓ 작업완료":"작업중"}</span>
        <div class="row"><div class="label">출고일</div><div class="value">${esc(o.ship_date||"-")}</div></div>
        <div class="row"><div class="label">출고 구분</div><div class="value">${o.hanam_office ? "하남 사무실 이동" : "당일 출고"}</div></div>
        <div class="row"><div class="label">연락처</div><div class="value">${esc(o.phone||"-")}</div></div>
        <div class="row"><div class="label">주소</div><div class="value">${esc(o.address||"-")}</div></div>
        <div class="row"><div class="label">주문내역</div><div class="value">${esc(o.items||"-")}</div></div>
        <div class="row"><div class="label">배송내용</div><div class="value">${esc(o.delivery_details||"-")}</div></div>
        <div class="row"><div class="label">메모</div><div class="value">${esc(o.memo||"-")}</div></div>
        ${o.photo_url?`<div class="row"><div class="label">작업완료 사진</div><img src="${esc(o.photo_url)}"></div>`:""}
      </div>
    </body>
    </html>
  `);
  popup.document.close();
}

if(configured){
  db.channel("shipping-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadOrders())
    .subscribe();
}
loadOrders();
