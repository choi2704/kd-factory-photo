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

  const filtered = currentStatusFilter === "all"
    ? rows
    : rows.filter(x=>x.status===currentStatusFilter);

  if(!filtered.length){
    const msg = currentStatusFilter==="working"
      ? "작업중인 주문이 없습니다."
      : currentStatusFilter==="done"
      ? "작업완료된 주문이 없습니다."
      : "등록된 주문이 없습니다.";
    listEl.innerHTML='<div class="empty">'+msg+'</div>';
    return;
  }

  listEl.innerHTML=filtered.map(o=>`
    <div class="row">
      <div>
        <div class="customer">${esc(o.customer)}</div>
        <span class="badge ${o.status==="done"?"done":"working"}">
          ${o.status==="done"?"✓ 작업완료":"작업중"}
        </span>
      </div>

      <div class="details">
        ${esc(o.items)}
        ${o.phone?`\n연락처: ${esc(o.phone)}`:""}
        ${o.address?`\n주소: ${esc(o.address)}`:""}
        ${o.memo?`\n메모: ${esc(o.memo)}`:""}
        ${o.completed_at?`\n완료: ${fmtDate(o.completed_at)}`:""}

        ${o.photo_url?`
          <br>
          <a class="photo-link" href="${esc(o.photo_url)}" target="_blank">📷 완료사진 크게 보기</a>
          <br>
          <img class="done-photo" src="${esc(o.photo_url)}" alt="완료사진">
        `:""}
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
  items.value = order.items || "";
  memo.value = order.memo || "";

  document.getElementById("formTitle").textContent = "주문 내용 수정";
  document.getElementById("submitBtn").textContent = "수정 저장";
  document.getElementById("cancelEditBtn").style.display = "block";

  window.scrollTo({top:0, behavior:"smooth"});
  customer.focus();
}

function cancelEdit(){
  editingId = null;
  orderForm.reset();
  document.getElementById("formTitle").textContent = "새 주문 등록";
  document.getElementById("submitBtn").textContent = "주문 등록";
  document.getElementById("cancelEditBtn").style.display = "none";
}

document.getElementById("cancelEditBtn").onclick = cancelEdit;

async function removeOrder(id){
  if(!confirm("이 주문을 삭제할까요?")) return;

  const {error}=await db
    .from("production_orders")
    .delete()
    .eq("id",id);

  if(error){
    alert(connectionHelp(error));
    return;
  }

  if(editingId===id) cancelEdit();
}

orderForm.addEventListener("submit", async e=>{
  e.preventDefault();

  if(!configured){
    alert("먼저 config.js에 Supabase 정보를 넣어주세요.");
    return;
  }

  const payload={
    customer:customer.value.trim(),
    phone:phone.value.trim(),
    address:address.value.trim(),
    items:items.value.trim(),
    memo:memo.value.trim()
  };

  if(editingId){
    const {error}=await db
      .from("production_orders")
      .update(payload)
      .eq("id",editingId);

    if(error){
      alert("수정 오류: "+connectionHelp(error));
      return;
    }

    alert("주문 내용이 수정되었습니다.");
    cancelEdit();
  }else{
    const {error}=await db
      .from("production_orders")
      .insert({...payload,status:"working"});

    if(error){
      alert("등록 오류: "+connectionHelp(error));
      return;
    }

    e.target.reset();
  }
});

refreshBtn.onclick=loadOrders;

if(configured){
  db.channel("office-orders")
    .on("postgres_changes",
      {event:"*",schema:"public",table:"production_orders"},
      ()=>loadOrders()
    )
    .subscribe();
}

loadOrders();
