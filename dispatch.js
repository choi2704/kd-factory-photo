const listEl = document.getElementById("dispatchList");
const notice = document.getElementById("notice");
const modal = document.getElementById("dispatchModal");
let dispatchRows = [];
let currentFilter = "all";
let selectedState = "waiting";
let selectedOrder = null;

if(!configured){
  notice.classList.add("show");
  syncText.textContent = "설정 필요";
}else{
  syncText.textContent = "실시간 연결됨";
}

function fmtDate(v){
  if(!v) return "-";
  const s = String(v);
  return s.length >= 10 ? `${Number(s.slice(5,7))}/${Number(s.slice(8,10))}` : s;
}
function fmtMoney(v){
  const n = Number(v||0);
  return n ? n.toLocaleString("ko-KR")+"원" : "-";
}
function stateLabel(v){
  if(v==="assigned") return "배차완료";
  if(v==="delivered") return "배송완료";
  return "배차대기";
}

async function loadDispatch(){
  if(!configured){
    listEl.innerHTML = '<div class="empty">config.js 설정 후 사용 가능합니다.</div>';
    return;
  }

  const {data,error} = await db
    .from("production_orders")
    .select("*")
    .not("ship_date","is",null)
    .order("ship_date",{ascending:true})
    .order("created_at",{ascending:false});

  if(error){
    listEl.innerHTML = '<div class="empty">불러오기 오류: '+esc(connectionHelp(error))+'</div>';
    return;
  }

  dispatchRows = data || [];
  updateCounts();
  renderDispatch();
}

function updateCounts(){
  dispatchAll.textContent = dispatchRows.length;
  dispatchWaiting.textContent = dispatchRows.filter(o=>(o.dispatch_status||"waiting")==="waiting").length;
  dispatchAssigned.textContent = dispatchRows.filter(o=>o.dispatch_status==="assigned").length;
  dispatchDelivered.textContent = dispatchRows.filter(o=>o.dispatch_status==="delivered").length;
}

function renderDispatch(){
  const q = dispatchSearch.value.trim().toLowerCase();
  let rows = dispatchRows.filter(o=>{
    const state = o.dispatch_status || "waiting";
    const filterOk = currentFilter==="all" || state===currentFilter;
    const searchOk = !q || String(o.customer||"").toLowerCase().includes(q);
    return filterOk && searchOk;
  });

  if(!rows.length){
    listEl.innerHTML = '<div class="empty">표시할 출고 주문이 없습니다.</div>';
    return;
  }

  listEl.innerHTML = rows.map(o=>{
    const state = o.dispatch_status || "waiting";
    const vehicle = o.dispatch_vehicle || "-";
    const driver = o.dispatch_driver || "-";
    const phone = o.dispatch_driver_phone || "-";
    return `
      <button class="dispatch-card" data-id="${o.id}" type="button">
        <div class="dispatch-card-top">
          <div>
            <div class="dispatch-customer">${esc(o.customer)}</div>
            <div class="dispatch-shipdate">출고 ${esc(o.ship_date||"-")}</div>
          </div>
          <span class="dispatch-badge ${state}">${stateLabel(state)}</span>
        </div>
        <div class="dispatch-items">${esc(o.items||"-")}</div>
        <div class="dispatch-card-info">
          <div><span>차량</span><b>${esc(vehicle)}</b></div>
          <div><span>기사</span><b>${esc(driver)}</b></div>
          <div><span>연락처</span><b>${esc(phone)}</b></div>
          <div><span>운임</span><b>${fmtMoney(o.dispatch_fee)}</b></div>
        </div>
      </button>
    `;
  }).join("");

  listEl.querySelectorAll(".dispatch-card").forEach(btn=>{
    btn.onclick = ()=>openDispatch(btn.dataset.id);
  });
}

function setState(state){
  selectedState = state;
  document.querySelectorAll(".dispatch-state").forEach(b=>{
    b.classList.toggle("active", b.dataset.state===state);
  });
}

function openDispatch(id){
  const o = dispatchRows.find(x=>String(x.id)===String(id));
  if(!o) return;
  selectedOrder = o;

  dispatchOrderId.value = o.id;
  dispatchModalTitle.textContent = o.customer || "배차정보";
  dispatchModalSub.textContent = `출고일 ${o.ship_date||"-"}`;
  dispatchOrderInfo.innerHTML = `
    <div><span>주문내역</span><b>${esc(o.items||"-")}</b></div>
    <div><span>배송내용</span><b>${esc(o.delivery_details||"-")}</b></div>
    <div><span>주소</span><b>${esc(o.address||"-")}</b></div>
  `;

  dispatchVehicle.value = o.dispatch_vehicle || "";
  dispatchDriver.value = o.dispatch_driver || "";
  dispatchDriverPhone.value = o.dispatch_driver_phone || "";
  dispatchFee.value = o.dispatch_fee || "";
  dispatchMemo.value = o.dispatch_memo || "";
  dispatchReceipt.value = "";

  if(o.dispatch_receipt_url){
    receiptPreview.src = o.dispatch_receipt_url;
    receiptPreviewWrap.style.display = "block";
  }else{
    receiptPreview.src = "";
    receiptPreviewWrap.style.display = "none";
  }

  setState(o.dispatch_status || "waiting");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
}

function closeDispatch(){
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
  selectedOrder = null;
}

dispatchClose.onclick = closeDispatch;
modal.addEventListener("click", e=>{
  if(e.target===modal) closeDispatch();
});

document.querySelectorAll(".dispatch-summary-card").forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll(".dispatch-summary-card").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderDispatch();
  };
});
document.querySelectorAll(".dispatch-state").forEach(btn=>{
  btn.onclick = ()=>setState(btn.dataset.state);
});

dispatchSearch.addEventListener("input",renderDispatch);
dispatchRefresh.onclick = loadDispatch;

dispatchReceipt.addEventListener("change",()=>{
  const file = dispatchReceipt.files?.[0];
  if(!file) return;
  receiptPreview.src = URL.createObjectURL(file);
  receiptPreviewWrap.style.display = "block";
});

async function uploadReceipt(orderId,file){
  if(!file) return selectedOrder?.dispatch_receipt_url || null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `dispatch/${orderId}-${Date.now()}.${ext}`;
  const {error} = await db.storage.from("completion-photos").upload(path,file,{upsert:true});
  if(error) throw error;
  const {data} = db.storage.from("completion-photos").getPublicUrl(path);
  return data.publicUrl;
}

dispatchForm.addEventListener("submit", async e=>{
  e.preventDefault();
  if(!selectedOrder) return;

  const saveBtn = dispatchForm.querySelector(".dispatch-save");
  saveBtn.disabled = true;
  saveBtn.textContent = "저장 중...";

  try{
    const receiptUrl = await uploadReceipt(selectedOrder.id,dispatchReceipt.files?.[0]);
    const feeRaw = String(dispatchFee.value||"").replace(/[^0-9]/g,"");

    const payload = {
      dispatch_status:selectedState,
      dispatch_vehicle:dispatchVehicle.value.trim(),
      dispatch_driver:dispatchDriver.value.trim(),
      dispatch_driver_phone:dispatchDriverPhone.value.trim(),
      dispatch_fee:feeRaw ? Number(feeRaw) : null,
      dispatch_memo:dispatchMemo.value.trim(),
      dispatch_receipt_url:receiptUrl
    };

    const {error} = await db
      .from("production_orders")
      .update(payload)
      .eq("id",selectedOrder.id);

    if(error) throw error;

    closeDispatch();
    await loadDispatch();
  }catch(err){
    alert("저장 오류: "+connectionHelp(err));
  }finally{
    saveBtn.disabled = false;
    saveBtn.textContent = "저장";
  }
});

if(configured){
  db.channel("dispatch-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadDispatch())
    .subscribe();
}

loadDispatch();
