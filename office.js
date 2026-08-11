
const listEl = document.getElementById("list");
const notice = document.getElementById("notice");
if(!configured){ notice.classList.add("show"); document.getElementById("syncText").textContent="설정 필요"; }
else document.getElementById("syncText").textContent="실시간 연결됨";

async function loadOrders(){
  if(!configured){ listEl.innerHTML='<div class="empty">config.js 설정 후 사용 가능합니다.</div>'; return; }
  const {data,error}=await db.from("production_orders").select("*").order("created_at",{ascending:false});
  if(error){listEl.innerHTML='<div class="empty">불러오기 오류: '+esc(connectionHelp(error))+'</div>';return}
  render(data||[]);
}
function render(rows){
  total.textContent=rows.length;
  workingCount.textContent=rows.filter(x=>x.status==="working").length;
  doneCount.textContent=rows.filter(x=>x.status==="done").length;
  if(!rows.length){listEl.innerHTML='<div class="empty">등록된 주문이 없습니다.</div>';return}
  listEl.innerHTML=rows.map(o=>`
    <div class="row">
      <div>
        <div class="customer">${esc(o.customer)}</div>
        <span class="badge ${o.status==="done"?"done":"working"}">${o.status==="done"?"✓ 작업완료":"작업중"}</span>
      </div>
      <div class="details">${esc(o.items)}${o.address?`\n주소: ${esc(o.address)}`:""}${o.completed_at?`\n완료: ${fmtDate(o.completed_at)}`:""}
        ${o.photo_url?`<br><a class="photo-link" href="${esc(o.photo_url)}" target="_blank">📷 완료사진 크게 보기</a><br><img class="done-photo" src="${esc(o.photo_url)}" alt="완료사진">`:""}
      </div>
      <button class="delete" data-id="${o.id}">삭제</button>
    </div>`).join("");
  listEl.querySelectorAll(".delete").forEach(b=>b.onclick=()=>removeOrder(b.dataset.id));
}
async function removeOrder(id){
  if(!confirm("이 주문을 삭제할까요?")) return;
  const {error}=await db.from("production_orders").delete().eq("id",id);
  if(error) alert(connectionHelp(error));
}
orderForm.addEventListener("submit", async e=>{
  e.preventDefault();
  if(!configured){alert("먼저 config.js에 Supabase 정보를 넣어주세요.");return}
  const payload={
    customer:customer.value.trim(),phone:phone.value.trim(),address:address.value.trim(),
    items:items.value.trim(),memo:memo.value.trim(),status:"working"
  };
  const {error}=await db.from("production_orders").insert(payload);
  if(error){alert(connectionHelp(error));return}
  e.target.reset();
});
refreshBtn.onclick=loadOrders;

if(configured){
  db.channel("office-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadOrders())
    .subscribe();
}
loadOrders();
