import {app} from "../firebase.js";
import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {getAuth,signInAnonymously,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getDatabase,ref,onValue,runTransaction,set,remove} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const outletApp=initializeApp(app.options,"tenueOutletPublic");
const outletAuth=getAuth(outletApp);
const outletDb=getDatabase(outletApp);
let outletUserPromise=null;
function getOutletUser(){
  if(!outletUserPromise){
    outletUserPromise=new Promise((resolve,reject)=>{
      let unsubscribe=()=>{};
      unsubscribe=onAuthStateChanged(outletAuth,user=>{
        unsubscribe();
        if(user){resolve(user);return;}
        signInAnonymously(outletAuth).then(credential=>resolve(credential.user)).catch(reject);
      },reject);
    });
  }
  return outletUserPromise;
}

const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euro=n=>new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(Number(n)||0);
let groups={},selected=null,storeOpen=false,storeSettings={open:false};

function refreshStore(){
  const now=Date.now(),a=Number(storeSettings.openAt)||0,z=Number(storeSettings.closeAt)||0;
  storeOpen=a||z?Boolean(a&&z&&now>=a&&now<z):storeSettings.open===true;
  if(!storeOpen){
    let msg="De volgende verkoopronde is nog niet geopend.";
    if(a&&now<a){
      const sec=Math.ceil((a-now)/1000);
      msg="De verkoop start over "+Math.floor(sec/3600)+" uur, "+Math.floor(sec%3600/60)+" minuten en "+sec%60+" seconden.";
    }else if(z&&now>=z)msg="Deze verkoopronde is afgelopen.";
    $("outlet").innerHTML='<div class="closed"><h2>De HV Novitas Outlet is momenteel gesloten</h2><p>'+msg+'</p></div>';
  }else render();
}

function render(){
  const active=Object.entries(groups).filter(([,g])=>g.active).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
  if(!active.length){$("outlet").innerHTML='<p class="empty">Er staan momenteel geen artikelen in de Tenue Outlet.</p>';return;}
  $("outlet").innerHTML=active.map(([gid,g])=>{
    const items=Object.entries(g.items||{}).sort((a,b)=>(a[1].createdAt||0)-(b[1].createdAt||0));
    if(!items.length)return "";
    return '<section class="group"><h2>'+esc(g.title)+'</h2><img class="photo" src="'+esc(g.imageUrl)+'" alt="'+esc(g.title)+'"><div class="items">'+items.map(([iid,it])=>{
      const status=it.status||"available",label={available:"Beschikbaar",reserved:"Gereserveerd",sold:"Verkocht"}[status]||"Niet beschikbaar";
      return '<div class="item"><div class="details"><strong>'+esc(it.type)+(it.number?' · rugnummer '+esc(it.number):"")+'</strong><small>Maat '+esc(it.size)+'</small></div><div class="price">'+euro(it.price)+'</div><div class="actions">'+(status==="available"?'<button class="reserve" data-reserve="'+esc(gid)+':'+esc(iid)+'">Reserveer</button>':'<span class="status '+esc(status)+'">'+label+'</span>')+'</div></div>';
    }).join("")+'</div></section>';
  }).join("")||'<p class="empty">Er zijn nog geen artikelen toegevoegd.</p>';
}

$("outlet").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.reserve){
    if(!storeOpen){refreshStore();return;}
    const [gid,iid]=b.dataset.reserve.split(":");selected={gid,iid};
    const it=groups[gid]?.items?.[iid];
    $("modalItem").textContent=it?it.type+" · maat "+it.size+" · "+euro(it.price):"";
    $("buyer").value="";$("buyerEmail").value="";$("modalMessage").textContent="";$("modal").classList.add("open");$("buyer").focus();
  }
});

$("cancel").addEventListener("click",()=>{$("modal").classList.remove("open");selected=null;});

$("confirm").addEventListener("click",async()=>{
  const name=$("buyer").value.trim();
  const email=$("buyerEmail").value.trim();
  if(!name){$("modalMessage").textContent="Vul je naam in.";return;}
  if(!email||!$("buyerEmail").checkValidity()){$("modalMessage").textContent="Vul een geldig e-mailadres in.";return;}
  if(!selected)return;
  if(!storeOpen){refreshStore();$("modal").classList.remove("open");selected=null;return;}
  const {gid,iid}=selected,button=$("confirm");
  button.disabled=true;$("modalMessage").textContent="Reservering controleren…";
  let reservationRef=null;
  let reservationStage="anoniem aanmelden";
  try{
    const user=await getOutletUser();
    reservationStage="reserveringsnaam privé opslaan";
    reservationRef=ref(outletDb,"tenueOutlet/reservationsPrivate/"+gid+"/"+iid+"/"+user.uid);
    await set(reservationRef,{name,email,createdAt:Date.now()});
    reservationStage="artikel blokkeren in de voorraad";
    const itemRef=ref(outletDb,"tenueOutlet/groups/"+gid+"/items/"+iid);
    const result=await runTransaction(itemRef,current=>{
      if(!current||current.status!=="available"||current.reservationUid)return;
      return {...current,status:"reserved",reservationUid:user.uid,reservedAt:Date.now()};
    });
    if(result.committed){
      $("modalMessage").textContent="Reservering bevestigd. Het artikel is nu voor anderen geblokkeerd.";
      $("modal").classList.remove("open");selected=null;
    }else{
      try{await remove(reservationRef);}catch(cleanupError){console.warn("Tijdelijke reserveringsnaam kon niet worden opgeruimd.",cleanupError);}
      $("modalMessage").textContent="Helaas, iemand anders was net eerder. Dit artikel is niet meer beschikbaar.";
      $("modal").classList.remove("open");selected=null;
    }
  }catch(err){
    console.error("Tenue Outlet reservering mislukt tijdens: "+reservationStage,err);
    if(reservationRef){
      try{await remove(reservationRef);}catch(cleanupError){console.warn("Tijdelijke reserveringsnaam kon niet worden opgeruimd.",cleanupError);}
    }
    const errorCode=String(err?.code||"onbekende fout");
    if(errorCode==="auth/operation-not-allowed"||errorCode==="auth/admin-restricted-operation"){
      $("modalMessage").textContent="Anoniem aanmelden staat nog niet aan in Firebase. Schakel Authentication > Sign-in method > Anonymous in en laad deze pagina opnieuw.";
    }else if(errorCode==="PERMISSION_DENIED"||String(err?.message||"").includes("PERMISSION_DENIED")){
      $("modalMessage").textContent="Firebase weigert de bewerking tijdens: "+reservationStage+". Controleer of de database-regels gepubliceerd zijn en of de winkel en verkoopronde open zijn. Foutcode: "+errorCode;
    }else{
      $("modalMessage").textContent="Er ging iets mis tijdens: "+reservationStage+". Foutcode: "+errorCode+". Probeer de pagina opnieuw te laden.";
    }
  }finally{button.disabled=false;}
});

onValue(ref(outletDb,"tenueOutlet/settings"),snap=>{storeSettings=snap.val()||{open:false};refreshStore();},err=>{
  console.error(err);storeOpen=false;$("outlet").innerHTML='<p class="empty">De winkelstatus kon niet worden geladen. Reserveren is tijdelijk uitgeschakeld.</p>';
});
setInterval(refreshStore,1000);
onValue(ref(outletDb,"tenueOutlet/groups"),snap=>{groups=snap.val()||{};refreshStore();},err=>{
  console.error(err);$("outlet").innerHTML='<p class="empty">De voorraad kon niet worden geladen. Probeer het later opnieuw.</p>';
});
