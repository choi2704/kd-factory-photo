
const root = document.getElementById("factoryList");
const notice = document.getElementById("notice");
let currentFilter = "working";

if(!configured){ notice.classList.add("show"); document.getElementById("syncText").textContent="설정 필요"; }
else document.getElementById("syncText").textContent="실시간 연결됨";

document.querySelectorAll(".filter").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".filter").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter=btn.dataset.filter;
    loadOrders();
  }
});

async function loadOrders(){
  if(!configured){root.innerHTML='<div class="empty">config.js 설정 후 사용 가능합니다.</div>';return}
  const {data,error}=await db.from("production_orders").select("*").eq("status",currentFilter).order("created_at",{ascending:true});
  if(error){root.innerHTML='<div class="empty">'+esc(connectionHelp(error))+'</div>';return}
  render(data||[]);
}

function render(rows){
  if(!rows.length){root.innerHTML='<div class="empty">표시할 주문이 없습니다.</div>';return}
  root.innerHTML=rows.map(o=>`
    <article class="order-card" data-id="${o.id}">
      <div class="factory-customer">${esc(o.customer)}</div>
      <div class="factory-info"><b>연락처</b>${esc(o.phone||"-")}</div>
      <div class="factory-info"><b>주소</b>${esc(o.address||"-")}</div>
      <div class="factory-order"><b>주문내역</b><div>${esc(o.items)}</div></div>
      ${o.memo?`<div class="factory-info"><b>메모</b>${esc(o.memo)}</div>`:""}
      ${o.status==="working" ? `
        <div class="photo-area">
          <div class="photo-title">📷 작업완료 사진 <span class="photo-optional">(선택)</span></div>
          <div class="photo-choice-row">
            <label class="photo-choice camera-choice">
              📷 지금 촬영
              <input class="photo-camera-input" type="file" accept="image/*" capture="environment">
            </label>
            <label class="photo-choice album-choice">
              🖼 앨범에서 선택
              <input class="photo-album-input" type="file" accept="image/*">
            </label>
          </div>
          <img class="preview" alt="미리보기">
          <div class="photo-help">사진이 없어도 바로 작업완료할 수 있습니다.</div>
        </div>
        <button class="big-complete">✓ 작업완료</button>
      ` : `
        <span class="badge done">✓ 작업완료</span>
        ${o.completed_at?`<div class="factory-info"><b>완료</b>${fmtDate(o.completed_at)}</div>`:""}
        ${o.photo_url?`<a href="${esc(o.photo_url)}" target="_blank"><img class="done-photo-large" src="${esc(o.photo_url)}"></a>`:""}
        <button class="undo-complete">작업완료 취소 → 작업중으로</button>
      `}
    </article>`).join("");

  root.querySelectorAll(".order-card").forEach(card=>{
    const id=card.dataset.id;
    const cameraInput=card.querySelector(".photo-camera-input");
    const albumInput=card.querySelector(".photo-album-input");
    const preview=card.querySelector(".preview");
    const btn=card.querySelector(".big-complete");
    const undoBtn=card.querySelector(".undo-complete");

    const setPreview=(input,otherInput)=>{
      const f=input?.files?.[0];
      if(!f){preview.style.display="none";return}
      if(otherInput) otherInput.value="";
      preview.src=URL.createObjectURL(f);
      preview.style.display="block";
    };

    if(cameraInput && preview){
      cameraInput.onchange=()=>setPreview(cameraInput,albumInput);
    }
    if(albumInput && preview){
      albumInput.onchange=()=>setPreview(albumInput,cameraInput);
    }

    if(btn) btn.onclick=()=>completeOrder(id, cameraInput, albumInput, btn);
    if(undoBtn) undoBtn.onclick=()=>undoComplete(id, undoBtn);
  });
}

async function completeOrder(id,cameraInput,albumInput,btn){
  const file=cameraInput?.files?.[0] || albumInput?.files?.[0] || null;
  const message=file ? "사진과 함께 작업완료 처리할까요?" : "사진 없이 작업완료 처리할까요?";
  if(!confirm(message)) return;

  btn.disabled=true;
  btn.textContent=file ? "사진 업로드 중..." : "완료 처리 중...";

  let photo_url=null;

  if(file){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`${id}/${Date.now()}.${ext}`;
    const {error:upErr}=await db.storage.from("completion-photos").upload(path,file,{
      cacheControl:"3600",upsert:false,contentType:file.type||"image/jpeg"
    });

    if(upErr){
      alert("사진 업로드 오류: "+upErr.message);
      btn.disabled=false;
      btn.textContent="✓ 작업완료";
      return;
    }

    const {data:urlData}=db.storage.from("completion-photos").getPublicUrl(path);
    photo_url=urlData.publicUrl;
  }

  const payload={
    status:"done",
    completed_at:new Date().toISOString()
  };
  if(photo_url) payload.photo_url=photo_url;

  const {error:updateErr}=await db.from("production_orders").update(payload).eq("id",id);

  if(updateErr){
    alert("완료 처리 오류: "+updateErr.message);
    btn.disabled=false;
    btn.textContent="✓ 작업완료";
    return;
  }

  loadOrders();
}


async function undoComplete(id, btn){
  if(!confirm("작업완료를 취소하고 다시 작업중으로 돌릴까요?")) return;

  btn.disabled = true;
  btn.textContent = "작업중으로 변경 중...";

  const {error} = await db
    .from("production_orders")
    .update({
      status:"working",
      completed_at:null
    })
    .eq("id",id);

  if(error){
    alert("상태 변경 오류: " + connectionHelp(error));
    btn.disabled = false;
    btn.textContent = "작업완료 취소 → 작업중으로";
    return;
  }

  loadOrders();
}

if(configured){
  db.channel("factory-orders")
    .on("postgres_changes",{event:"*",schema:"public",table:"production_orders"},()=>loadOrders())
    .subscribe();
}
loadOrders();
