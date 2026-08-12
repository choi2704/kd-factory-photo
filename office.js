const listEl = document.getElementById("list");
const notice = document.getElementById("notice");
const calendarEl = document.getElementById("shippingCalendar");

let editingId = null;
let currentStatusFilter = "all";
let cachedRows = [];
let calendarDate = new Date();

if(!configured){
  notice.classList.add("show");
  document.getElementById("syncText").textContent="설정 필요";
}else{
  document.getElementById("syncText").textContent="실시간 연결됨";
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

shipDate.value = todayISO();

document.querySelectorAll(".summary-filter").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".summary-filter").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    render(cachedRows);
  });
});

prevMonth.onclick=()=>{
  calendarDate.setMonth(calendarDate.getMonth()-1);
  renderCalendar(cachedRows);
};
nextMonth.onclick=()=>{
  calendarDate.setMonth(calendarDate.getMonth()+1);
  renderCalendar(cachedRows);
};
todayMonth.onclick=()=>{
  calendarDate = new Date();
  renderCalendar(cachedRows);
};

async function loadOrders(){
  if(!configured){
    listEl.innerHTML='<div class="empty">config.js 설정 후 사용 가능합니다.</div>';
    calendarEl.innerHTML='<div class="empty">config.js 설정 후 사용 가능합니다.</div>';
    return;
  }
  const {data,error}=await db.from("production_orders").select("*").order("created_at",{ascending:false});
  if(error){
    const msg=esc(connectionHelp(error));
    listEl.innerHTML='<div class="empty">불러오기 오류: '+msg+'</div>';
    calendarEl.innerHTML='<div class="empty">불러오기 오류: '+msg+'</div>';
    return;
  }
  cachedRows=data||[];
  render(cachedRows);
  renderCalendar(cachedRows);
}

function render(rows){
  total.textContent=rows.length;
  workingCount.textContent=rows.filter(x=>x.status==="working").length;
  doneCount.textContent=rows.filter(x=>x.status==="done").length;

  const filtered=currentStatusFilter==="all"?rows:rows.filter(x=>x.status===currentStatusFilter);
  if(!filtered.length){
    listEl.innerHTML='<div class="empty">표시할 주문이 없습니다.</div>';
    return;
  }

  listEl.innerHTML=filtered.map(o=>`
    <div class="row order-card-3col">
      <div>
        <div class="customer">${esc(o.customer)}</div>
        <span class="badge ${o.status==="done"?"done":"working"}">${o.status==="done"?"✓ 작업완료":"작업중"}</span>
        ${o.ship_date?`<div class="ship-date-mini">출고 ${esc(o.ship_date)}</div>`:""}
      </div>
      <div class="details">
        ${esc(o.items)}
        ${o.phone?`\n연락처: ${esc(o.phone)}`:""}
        ${o.address?`\n주소: ${esc(o.address)}`:""}
        ${o.delivery_details?`\n배송: ${esc(o.delivery_details)}`:""}
        ${o.memo?`\n메모: ${esc(o.memo)}`:""}
      </div>
      <div class="action-row">
        <button class="edit-btn" data-id="${o.id}">수정</button>
        <button class="delete" data-id="${o.id}">삭제</button>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".edit-btn").forEach(btn=>btn.onclick=()=>startEdit(btn.dataset.id,rows));
  listEl.querySelectorAll(".delete").forEach(btn=>btn.onclick=()=>removeOrder(btn.dataset.id));
}

function renderCalendar(rows){
  const y=calendarDate.getFullYear();
  const m=calendarDate.getMonth();
  calendarTitle.textContent=`${y}년 ${m+1}월`;

  const first=new Date(y,m,1);
  const last=new Date(y,m+1,0);
  const startDay=first.getDay();
  const totalDays=last.getDate();

  let html='<div class="cal-head sun">일</div><div class="cal-head">월</div><div class="cal-head">화</div><div class="cal-head">수</div><div class="cal-head">목</div><div class="cal-head">금</div><div class="cal-head sat">토</div>';

  for(let i=0;i<startDay;i++) html+='<div class="cal-cell empty-cell"></div>';

  for(let d=1;d<=totalDays;d++){
    const key=dateKey(y,m,d);
    const dayRows=rows.filter(o=>o.ship_date===key);
    const isToday=key===todayISO();

    html+=`<div class="cal-cell ${isToday?"today":""}">
      <div class="cal-date">${d}</div>
      <div class="cal-orders">
        ${dayRows.map(o=>`<button class="cal-company" data-id="${o.id}" type="button">${esc(o.customer)}</button>`).join("")}
      </div>
    </div>`;
  }

  calendarEl.innerHTML=html;
  calendarEl.querySelectorAll(".cal-company").forEach(btn=>{
    btn.onclick=()=>openOrderPopup(btn.dataset.id);
  });
}

function openOrderPopup(id){
  const o=cachedRows.find(x=>String(x.id)===String(id));
  if(!o) return;

  const popup=window.open("","_blank","width=650,height=760,scrollbars=yes");
  if(!popup){ alert("팝업 차단을 해제해 주세요."); return; }

  popup.document.write(`
    <!doctype html><html lang="ko"><head><meta charset="utf-8">
    <title>${esc(o.customer)} - 출고정보</title>
    <style>
      body{font-family:Arial,"Malgun Gothic",sans-serif;margin:0;background:#eef4f8;color:#102333}
      .box{max-width:620px;margin:20px auto;background:white;border-radius:16px;padding:22px}
      h1{font-size:28px;margin:0 0 16px;color:#143c5b}
      .status{display:inline-block;padding:7px 11px;border-radius:999px;background:${o.status==="done"?"#e5f7ed":"#fff0e4"};font-weight:900}
      .row{padding:14px 0;border-bottom:1px solid #dde6ec}
      .label{font-size:14px;color:#607687;font-weight:900;margin-bottom:5px}
      .value{font-size:20px;font-weight:800;white-space:pre-wrap;line-height:1.5}
      img{max-width:100%;border-radius:12px;margin-top:10px}
    </style></head><body><div class="box">
      <h1>${esc(o.customer)}</h1>
      <span class="status">${o.status==="done"?"✓ 작업완료":"작업중"}</span>
      <div class="row"><div class="label">출고일</div><div class="value">${esc(o.ship_date||"-")}</div></div>
      <div class="row"><div class="label">연락처</div><div class="value">${esc(o.phone||"-")}</div></div>
      <div class="row"><div class="label">주소</div><div class="value">${esc(o.address||"-")}</div></div>
      <div class="row"><div class="label">주문내역</div><div class="value">${esc(o.items||"-")}</div></div>
      <div class="row"><div class="label">배송내용</div><div class="value">${esc(o.delivery_details||"-")}</div></div>
      <div class="row"><div class="label">메모</div><div class="value">${esc(o.memo||"-")}</div></div>
      ${o.photo_url?`<div class="row"><div class="label">작업완료 사진</div><img src="${esc(o.photo_url)}"></div>`:""}
    </div></body></html>
  `);
  popup.document.close();
}

function startEdit(id, rows){
  const order=rows.find(o=>String(o.id)===String(id));
  if(!order) return;
  editingId=order.id;
  customer.value=order.customer||"";
  phone.value=order.phone||"";
  address.value=order.address||"";
  shipDate.value=order.ship_date||todayISO();
  deliveryDetails.value=order.delivery_details||"";
  items.value=order.items||"";
  memo.value=order.memo||"";
  formTitle.textContent="주문 내용 수정";
  submitBtn.textContent="수정 저장";
  cancelEditBtn.style.display="block";
  window.scrollTo({top:0,behavior:"smooth"});
}

function cancelEdit(){
  editingId=null;
  orderForm.reset();
  shipDate.value=todayISO();
  formTitle.textContent="새 주문 등록";
  submitBtn.textContent="주문 등록";
  cancelEditBtn.style.display="none";
}
cancelEditBtn.onclick=cancelEdit;

async function removeOrder(id){
  if(!confirm("이 주문을 삭제할까요?")) return;
  const {error}=await db.from("production_orders").delete().eq("id",id);
  if(error) alert(connectionHelp(error));
}

orderForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const payload={
    customer:customer.value.trim(),
    phone:phone.value.trim(),
    address:address.value.trim(),
    ship_date:shipDate.value||null,
    delivery_details:deliveryDetails.value.trim(),
    items:items.value.trim(),
    memo:memo.value.trim()
  };

  if(editingId){
    const {error}=await db.from("production_orders").update(payload).eq("id",editingId);
    if(error){alert(connectionHelp(error));return}
    cancelEdit();
  }else{
    const {error}=await db.from("production_orders").insert({...payload,status:"working"});
    if(error){alert(connectionHelp(error));return}
    orderForm.reset();
    shipDate.value=todayISO();
  }
});

refreshBtn.onclick=loadOrders;

if(configured){
  db.channel("office-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadOrders())
    .subscribe();
}
loadOrders();
