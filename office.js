const listEl = document.getElementById("list");
const notice = document.getElementById("notice");

let editingId = null;
let currentStatusFilter = "all";
let cachedRows = [];

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

shipDate.value = todayISO();

document.querySelectorAll(".summary-filter").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".summary-filter").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    render(cachedRows);
  });
});

async function loadOrders(){
  if(!configured){
    listEl.innerHTML='<div class="empty">config.js 설정 후 사용 가능합니다.</div>';
    return;
  }

  const {data,error}=await db
    .from("production_orders")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){
    listEl.innerHTML='<div class="empty">불러오기 오류: '+esc(connectionHelp(error))+'</div>';
    return;
  }

  cachedRows = data || [];
  render(cachedRows);
}

function render(rows){
  total.textContent=rows.length;
  workingCount.textContent=rows.filter(x=>x.status==="working").length;
  doneCount.textContent=rows.filter(x=>x.status==="done").length;

  const filtered = currentStatusFilter==="all"
    ? rows
    : rows.filter(x=>x.status===currentStatusFilter);

  if(!filtered.length){
    listEl.innerHTML='<div class="empty">표시할 주문이 없습니다.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(o=>`
    <div class="row order-card-3col">
      <div>
        <div class="customer">${esc(o.customer)}</div>
        <span class="badge ${o.status==="done"?"done":"working"}">
          ${o.status==="done"?"✓ 작업완료":"작업중"}
        </span>
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

  listEl.querySelectorAll(".edit-btn").forEach(btn=>{
    btn.onclick=()=>startEdit(btn.dataset.id, rows);
  });
  listEl.querySelectorAll(".delete").forEach(btn=>{
    btn.onclick=()=>removeOrder(btn.dataset.id);
  });
}

function startEdit(id, rows){
  const order = rows.find(o=>String(o.id)===String(id));
  if(!order) return;

  editingId = order.id;
  customer.value = order.customer || "";
  phone.value = order.phone || "";
  address.value = order.address || "";
  shipDate.value = order.ship_date || todayISO();
  deliveryDetails.value = order.delivery_details || "";
  items.value = order.items || "";
  memo.value = order.memo || "";

  formTitle.textContent = "주문 내용 수정";
  submitBtn.textContent = "수정 저장";
  cancelEditBtn.style.display = "block";
  window.scrollTo({top:0,behavior:"smooth"});
}

function cancelEdit(){
  editingId = null;
  orderForm.reset();
  shipDate.value = todayISO();
  formTitle.textContent = "새 주문 등록";
  submitBtn.textContent = "주문 등록";
  cancelEditBtn.style.display = "none";
}
cancelEditBtn.onclick = cancelEdit;

async function removeOrder(id){
  if(!confirm("이 주문을 삭제할까요?")) return;
  const {error}=await db.from("production_orders").delete().eq("id",id);
  if(error){ alert(connectionHelp(error)); return; }
  if(editingId===id) cancelEdit();
}

orderForm.addEventListener("submit", async e=>{
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
    if(error){ alert("수정 오류: "+connectionHelp(error)); return; }
    cancelEdit();
  }else{
    const {error}=await db.from("production_orders").insert({...payload,status:"working"});
    if(error){ alert("등록 오류: "+connectionHelp(error)); return; }
    orderForm.reset();
    shipDate.value = todayISO();
  }
});

refreshBtn.onclick=loadOrders;

if(configured){
  db.channel("office-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadOrders())
    .subscribe();
}
loadOrders();
