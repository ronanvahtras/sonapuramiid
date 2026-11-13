const MAX=4;
const $=id=>document.getElementById(id);
const board=$("board"), svg=$("links");
const parent=c=>(c-1)>>1, depth=i=>Math.floor(Math.log2(i+1));
const key=(a,b)=>a<b?a+"|"+b:b+"|"+a;
const fmt=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
// The game's day follows Tallinn time, so the daily puzzle changes for everyone at once.
const today=()=>{try{return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Tallinn",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
  catch(e){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}};
const dayNum=()=>{const [y,m,d]=today().split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch(e){return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const starsHtml=n=>`<span class="stars">${"★".repeat(n)}<span class="off">${"★".repeat(3-n)}</span></span>`;

let view="home", hist=[], dailyS=null, campS=null, S=null, N=15, pairs, solParent, solDepth, tiles={}, paths=[], hits=[], marks=[], sel=null, lastTick=0;
const API=typeof SUPABASE_URL==="string"&&SUPABASE_URL&&typeof SUPABASE_KEY==="string"&&SUPABASE_KEY?SUPABASE_URL+"/rest/v1/":"";
let lb={state:API?"loading":"off",rows:[]};
const NICK_RE=/^[A-Za-zÕÄÖÜŠŽõäöüšž0-9 _.\-]{2,16}$/;

function prep(){
  const z=P[S.pz]; N=z.w.length; pairs={}; solParent={}; solDepth={};
  z.w.forEach((w,i)=>{solDepth[w]=depth(i); if(i){solParent[w]=z.w[parent(i)]; pairs[z.w[parent(i)]+">"+w]=z.s[i-1];}});
  z.x.forEach(([a,b,c,d])=>{pairs[a+">"+b]=[c,d]});
}
function judge(c){
  const C=S.order[c], Pw=S.order[parent(c)], hit=pairs[Pw+">"+C]; // upper word first, lower word second
  if(!hit) return ["x",null];
  return [(solParent[C]===Pw && solDepth[Pw]===depth(parent(c)))?"g":"o",hit];
}
function validCount(o){let n=0;for(let c=1;c<o.length;c++) if(pairs[o[parent(c)]+">"+o[c]]) n++;return n}
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function startGame(mode,pz,lvl,seed){
  S={mode,pz,lvl,order:[],checks:0,links:[],done:false,won:false,showSol:false,dirty:true,moves:0,ms:0,started:false,stars:0,known:{},pins:{},msg:""};
  prep(); S.links=Array(N).fill(null);
  const r=seed?rng(seed):Math.random, lim=N>7?2:1; let o,t=0,v;
  do{o=P[pz].w.slice();for(let i=N-1;i>0;i--){const j=Math.floor(r()*(i+1));[o[i],o[j]]=[o[j],o[i]]} v=validCount(o)}
  while((v>lim||v===N-1) && ++t<500);
  if(v===N-1){[o[0],o[1]]=[o[1],o[0]]}
  S.order=o; if(mode==="camp") campS=S; build(); render();
}
function showSolved(mode,pz,lvl,rec){
  const sol=P[pz].w, mine=!rec.won&&Array.isArray(rec.order)&&rec.order.length===sol.length&&rec.order.every(w=>sol.includes(w))?rec.order:null;
  S={mode,pz,lvl,order:(mine||sol).slice(),noAttempt:!rec.won&&!mine,checks:rec.checks||0,links:[],done:true,won:!!rec.won,dirty:false,moves:rec.moves||0,ms:rec.ms||0,started:true,stars:0,old:true,known:{},pins:{},msg:""};
  prep(); S.links=Array(N).fill(null); for(let c=1;c<N;c++) S.links[c]=S.won||S.noAttempt?"g":judge(c)[0]; build(); render();
}
function build(){
  board.querySelectorAll(".tile").forEach(e=>e.remove()); svg.innerHTML=""; tiles={}; paths=[]; sel=null;
  for(let c=1;c<N;c++){const p=document.createElementNS("http://www.w3.org/2000/svg","path");p.setAttribute("pathLength","100");svg.appendChild(p);paths[c]=p}
  marks=[];for(let c=1;c<N;c++){const m=document.createElementNS("http://www.w3.org/2000/svg","g");m.setAttribute("class","mk");
    m.innerHTML='<circle r="7"></circle><text y="3.5"></text>';m.style.display="none";svg.appendChild(m);marks[c]=m}
  hits=[];for(let c=1;c<N;c++){const h=document.createElementNS("http://www.w3.org/2000/svg","path");h.setAttribute("class","hit");h.addEventListener("click",()=>pin(c));svg.appendChild(h);hits[c]=h}
  S.order.forEach(w=>{const b=document.createElement("button");b.className="tile";b.type="button";b.textContent=w;
    b.addEventListener("click",()=>tap(w));board.appendChild(b);tiles[w]=b});
}
function geom(W){
  // Apex at the top. On a narrow board the widest row is stacked in pairs under each parent.
  const D=depth(N-1)+1, leaves=2**(D-1), stag=leaves>=8&&W/leaves<84;
  const cols=stag?leaves/2:leaves, slot=W/cols, small=W<640;
  const tw=Math.min(slot-(stag?18:8),160), th=small?42:54, pitch=small?78:104, off=th+10;
  const pos=i=>{const d=depth(i),k=i-(2**d-1),n=2**d;
    if(stag&&d===D-1) return{x:slot*((k>>1)+.5),y:pitch*(d+.5)+(k%2?off:0),low:k%2};
    return{x:W*(k+.5)/n,y:pitch*(d+.5)}};
  const path=c=>{const a=pos(parent(c)),b=pos(c);
    if(b.low){const gx=a.x+slot/2-2; // route down the gap beside the column, then into the lower tile
      return `M${a.x},${a.y} L${gx-10},${a.y} Q${gx},${a.y} ${gx},${a.y+10} L${gx},${b.y-10} Q${gx},${b.y} ${gx-10},${b.y} L${b.x},${b.y}`}
    return `M${a.x},${a.y} C${a.x},${(a.y+b.y)/2} ${b.x},${(a.y+b.y)/2} ${b.x},${b.y}`};
  return{H:D*pitch+(stag?off:0),tw,th,fs:tw<82?13:tw<100?15:17,pos,path};
}
function layout(){
  const W=board.clientWidth, g=geom(W); board.style.height=g.H+"px"; svg.setAttribute("viewBox",`0 0 ${W} ${g.H}`);
  S.order.forEach((w,i)=>{const p=g.pos(i),t=tiles[w];
    t.style.width=g.tw+"px";t.style.height=g.th+"px";t.style.fontSize=g.fs+"px";
    t.style.transform=`translate(${p.x-g.tw/2}px,${p.y-g.th/2}px)`});
  for(let c=1;c<N;c++){const d=g.path(c);paths[c].setAttribute("d",d);hits[c].setAttribute("d",d);
    const q=paths[c].getPointAtLength(paths[c].getTotalLength()/2);marks[c].setAttribute("transform",`translate(${q.x},${q.y})`)}
}
function drawSolution(){ // read-only copy of the solved pyramid, shown beside a failed attempt
  const b=$("board2"), W=b.clientWidth, g=geom(W); b.style.height=g.H+"px";
  let h=`<svg viewBox="0 0 ${W} ${g.H}" aria-hidden="true">`;
  for(let c=1;c<N;c++) h+=`<path class="g" d="${g.path(c)}"/>`;
  h+="</svg>";
  P[S.pz].w.forEach((w,i)=>{const p=g.pos(i);
    h+=`<div class="tile" style="width:${g.tw}px;height:${g.th}px;font-size:${g.fs}px;transform:translate(${p.x-g.tw/2}px,${p.y-g.th/2}px)">${w}</div>`});
  b.innerHTML=h;
}
function render(){
  const game=view==="daily"||view==="play";
  $("homeView").hidden=view!=="home"; $("lbView").hidden=view!=="lb"; $("privView").hidden=view!=="priv";
  $("levelsView").hidden=view!=="levels"; $("homeBtn").hidden=view==="home";
  $("gameView").style.display=game?"flex":"none";
  if(view==="home"){renderHome();return}
  if(view==="lb"){renderLb();return}
  if(view==="priv"){$("privContact").textContent=(typeof SITE_CONTACT==="string"&&SITE_CONTACT)?`Kui soovid oma tulemuse kustutamist või sul on küsimusi, kirjuta aadressil ${SITE_CONTACT}. Lisa oma hüüdnimi ja kuupäev.`:"Kontaktaadress lisatakse siia peagi. Seni kustuvad tulemused iseenesest 30 päeva pärast.";return}
  if(view==="levels"){renderLevels();return}
  const camp=S.mode==="camp", failed=S.done&&!S.won, cmp=failed&&!S.noAttempt;
  $("cmp").classList.toggle("two",cmp); $("solCol").hidden=!cmp;
  $("mineCap").hidden=!failed; $("mineCap").textContent=S.noAttempt?"Lahendus":"Sinu katse";
  layout(); if(cmp) drawSolution();
  // Each state also has a symbol on the line, so it does not depend on colour alone.
  for(let c=1;c<N;c++){const st=S.links[c]==="g"?"g":pinned(c)?"p":S.links[c]||"";
    paths[c].setAttribute("class",st); marks[c].style.display=st?"":"none"; marks[c].setAttribute("class","mk "+st);
    marks[c].lastChild.textContent={g:"✓",o:"↔",p:"●",x:"×"}[st]||""}
  const selG=sel===null?[]:groupOf(S.order.indexOf(sel));
  S.order.forEach((w,i)=>{tiles[w].classList.toggle("sel",selG.includes(i));
    const near=[i,2*i+1,2*i+2].filter(c=>c>0&&c<N);
    tiles[w].classList.toggle("lock",!S.done&&near.some(c=>S.links[c]==="g"));
    tiles[w].classList.toggle("pin",!S.done&&near.some(c=>pinned(c)&&S.links[c]!=="g"))});
  $("app").classList.toggle("done",S.done);
  $("gameLabel").textContent=camp?`Tase ${S.lvl+1}`:`Päevamäng · ${today().split("-").reverse().join(".")}`;
  $("time").textContent=fmt(S.ms/1000); $("moves").textContent=S.moves;
  $("tries").innerHTML=Array.from({length:MAX},(_,i)=>`<i class="${i<S.checks?"used":""}"></i>`).join("");
  $("checkBtn").disabled=S.done||!S.dirty; $("checkBtn").hidden=S.done;
  $("nextBtn").hidden=!(camp&&S.won&&S.lvl<CAMP.length-1);
  $("retryBtn").hidden=!camp;
  $("levelsBtn").hidden=!camp;
  const rows=[];
  for(let c=1;c<N;c++) if(S.links[c]==="g"||S.links[c]==="o"){const j=judge(c); if(j[1]) rows.push(`<li class="${S.links[c]}"><b>${j[1][0]}</b>${j[1][1]}</li>`)}
  $("found").hidden=!rows.length; $("words").innerHTML=rows.join("");
  let msg="Puuduta kaht sõna, et need vahetada. Loe ülevalt alla: ülemine sõna + alumine sõna peab andma liitsõna. Puuduta joont, et paar lukku panna.";
  if(camp&&!S.started){const L=CAMP[S.lvl];msg+=` Kolm tähte: alla ${fmt(L[1])}, kaks: alla ${fmt(L[2])}.`}
  if(!camp&&!S.started&&!S.ms) msg+=" Aeg hakkab jooksma esimesest puudutusest.";
  if(S.msg&&!S.done) msg=S.msg;
  if(S.won) msg=`<b>Valmis!</b> Aeg ${fmt(S.ms/1000)}, käike ${S.moves}, kontrollimisi ${S.checks}.`+(camp?" "+starsHtml(S.stars):(S.old?" Uus püramiid tuleb homme.":""));
  else if(S.done) msg=(S.noAttempt?"<b>See on lahendus.</b>":"<b>Kontrollimised said otsa.</b> Võrdle oma katset lahendusega.")+(camp?"":" Uus püramiid tuleb homme.");
  else if(S.checks&&!S.msg){const n=S.links.filter(l=>l==="g").length,o=S.links.filter(l=>l==="o").length;
    msg=`Õiges kohas <b>${n}</b>, vales kohas <b>${o}</b>. Kontrollimisi alles ${MAX-S.checks}.`}
  $("status").innerHTML=msg;
  $("lbBtn").hidden=camp||!S.done||lb.state==="off";
  $("shareBtn").hidden=camp||!S.done; if(!S.done){$("shareNote").hidden=true}
  $("reportBtn").hidden=!API||!(rows.length||S.done);
}
function renderHome(){
  const rec=store.get("sp-daily",null), st=store.get("sp-camp",{}), stats=store.get("sp-stats",null);
  $("subDaily").textContent=rec&&rec.date===today()?(rec.won?`Täna tehtud · ${fmt(rec.ms/1000)} · ${rec.moves} käiku`:"Täna ei õnnestunud. Homme tuleb uus."):"Tänane püramiid ootab. Üks katse päevas.";
  $("subCamp").textContent=`Üksikmäng · ${CAMP.length} taset · ${Object.values(st).reduce((a,b)=>a+b,0)}/${CAMP.length*3} tähte`;
  $("optLb").hidden=lb.state==="off";
  $("subLb").textContent=lb.state==="ok"?(lb.rows.length?`${lb.rows.length} lõpetajat täna`:"Täna pole veel keegi lõpetanud"):lb.state==="loading"?"Laen…":"Edetabelit ei saa praegu kätte";
  $("statsSec").hidden=!(stats&&stats.played);
  if(stats&&stats.played){const streak=stats.last>=dayNum()-1?stats.streak:0;
    $("statsLine").textContent=`Mängitud ${stats.played} · võidetud ${stats.won} · seeria ${streak} päeva · pikim seeria ${stats.max}`+(stats.best!=null?` · parim aeg ${fmt(stats.best)}`:"")}
  const n=store.get("sp-nick","");
  $("nickLine").hidden=$("nickEdit").hidden=!API||!n; $("nickLine").textContent=n?`Hüüdnimi: ${n}`:"";
}
function renderLevels(){
  const st=store.get("sp-camp",{}); const box=$("levels"); box.innerHTML="";
  $("campTitle").textContent=`Kampaania · ${CAMP.length} taset`;
  CAMP.forEach((L,i)=>{const n=P[L[0]].w.length, open=i===0||st[i-1]>0;
    const b=document.createElement("button"); b.className="lvl"; b.disabled=!open;
    b.innerHTML=`<span class="n">${i+1}</span>${starsHtml(st[i]||0)}<span class="sz">${n} sõna${open?"":" · lukus"}</span>`;
    b.addEventListener("click",()=>{hist.push(view);view="play";startGame("camp",L[0],i)}); box.appendChild(b)});
}
// Every pair that has been checked keeps its verdict for the rest of the game.
const pk=c=>S.order[parent(c)]+">"+S.order[c];
const pinned=c=>!S.done&&!!S.pins[pk(c)];
function pin(c){ // tap a line: lock or unlock that pair by hand (purple)
  if(S.done||S.links[c]==="g"||S.links[c]==="x") return;
  if(!S.started){S.started=true;lastTick=Date.now()}
  const k=pk(c); if(S.pins[k]) delete S.pins[k]; else S.pins[k]=1;
  sel=null; S.msg=""; render();
}
function refreshLinks(){for(let c=1;c<N;c++) S.links[c]=S.known[pk(c)]?judge(c)[0]:null}
// Tiles joined by green links, or by links the player pinned, form a group that only moves as a whole.
function groupOf(i){
  const g=[i];
  for(let n=0;n<g.length;n++){const s=g[n], nb=[];
    const tied=c=>S.links[c]==="g"||pinned(c);
    if(s>0&&tied(s)) nb.push(parent(s));
    [2*s+1,2*s+2].forEach(c=>{if(c<N&&tied(c)) nb.push(c)});
    nb.forEach(x=>{if(!g.includes(x)) g.push(x)})}
  return g;
}
const idx=i=>i-(2**depth(i)-1);
function rel(top,s){const l=depth(s)-depth(top); if(l<0) return null; const j=idx(s)-idx(top)*2**l; return j<0||j>=2**l?null:[l,j]}
function at(top,r){return 2**(depth(top)+r[0])-1+idx(top)*2**r[0]+r[1]}
function move(a,b){
  const ga=groupOf(a), gb=groupOf(b), ta=Math.min(...ga), tb=Math.min(...gb), rs=new Map();
  ga.forEach(s=>{const r=rel(ta,s);rs.set(r.join(),r)}); gb.forEach(s=>{const r=rel(tb,s);rs.set(r.join(),r)});
  for(let grew=true;grew;){grew=false;
    for(const r of [...rs.values()]) for(const top of [ta,tb]){const s=at(top,r); if(s>=N) return false;
      for(const m of groupOf(s)){const q=rel(top,m); if(!q) return false; if(!rs.has(q.join())){rs.set(q.join(),q);grew=true}}}}
  const A=[...rs.values()].map(r=>at(ta,r)), B=[...rs.values()].map(r=>at(tb,r));
  if(A.some(x=>B.includes(x))) return false;
  A.forEach((x,i)=>{[S.order[x],S.order[B[i]]]=[S.order[B[i]],S.order[x]]});
  return true;
}
function tap(w){
  if(S.done) return;
  if(!S.started){S.started=true;lastTick=Date.now()}
  S.msg="";
  const i=S.order.indexOf(w);
  if(sel===null) sel=w;
  else if(groupOf(S.order.indexOf(sel)).includes(i)) sel=null;
  else{
    if(move(S.order.indexOf(sel),i)){S.dirty=true;S.moves++;refreshLinks()}
    else S.msg="<b>Lukus paar ei mahu sinna.</b> See liigub ainult tervikuna. Lilla luku saad maha, kui puudutad joont.";
    sel=null;
  }
  render();
}
function tick(){
  if(!S||!S.started||S.done||document.hidden||(view!=="daily"&&view!=="play")){lastTick=Date.now();return}
  const now=Date.now(); S.ms+=Math.min(now-lastTick,2000); lastTick=now;
  $("time").textContent=fmt(S.ms/1000);
}
function check(){
  if(S.done||!S.dirty) return;
  tick(); S.checks++; S.dirty=false; let ok=0;
  for(let c=1;c<N;c++){S.known[pk(c)]=1; if(judge(c)[1]) ok++}
  S.pins={}; refreshLinks(); S.msg=""; // verdicts replace the player's own locks
  if(ok===N-1){S.done=S.won=true; for(let c=1;c<N;c++) S.links[c]="g"; finish()}
  else if(S.checks>=MAX){S.done=true; finish()}
  sel=null; render();
}
function finish(){
  if(S.mode==="camp"){
    if(!S.won) return;
    const L=CAMP[S.lvl], t=S.ms/1000; S.stars=t<=L[1]?3:t<=L[2]?2:1;
    const st=store.get("sp-camp",{}); if((st[S.lvl]||0)<S.stars){st[S.lvl]=S.stars;store.set("sp-camp",st)}
  }else{
    store.set("sp-daily",{date:today(),won:S.won,ms:S.ms,moves:S.moves,checks:S.checks,order:S.won?null:S.order});
    const st=store.get("sp-stats",{played:0,won:0,streak:0,max:0,best:null,last:null}), dn=dayNum();
    st.played++;
    if(S.won){st.won++; st.streak=st.last===dn-1?st.streak+1:1; st.max=Math.max(st.max,st.streak);
      const sec=Math.round(S.ms/1000); st.best=st.best==null?sec:Math.min(st.best,sec); st.last=dn}
    else st.streak=0;
    store.set("sp-stats",st);
    if(S.won) submitScore();
  }
}
function loadDaily(){
  const pz=DAILY[dayNum()%DAILY.length], rec=store.get("sp-daily",null);
  if(rec&&rec.date===today()) showSolved("daily",pz,null,rec);
  else if(dailyS&&dailyS.day===today()&&!dailyS.done){S=dailyS;prep();build();lastTick=Date.now();render()}
  else{startGame("daily",pz,null,dayNum());S.day=today();dailyS=S}
}
// Screens: home, daily, levels, play, lb, priv. "Tagasi" walks back through the screens visited.
function show(v){
  if(v==="daily"){view="daily";loadDaily()}
  else if(v==="play"&&campS){view="play";S=campS;S.pins=S.pins||{};prep();build();lastTick=Date.now();render()}
  else{view=v==="play"?"levels":v;render();if(view==="lb") loadLb()}
}
function nav(v){if(v!==view) hist.push(view);show(v)}
function back(){show(hist.pop()||"home")}
function openHome(){hist=[];view="home";render()}

// Daily leaderboard, kept in Supabase (tables and rules: supabase/setup.sql). There are no
// accounts: a player is a random id kept in this browser plus a nickname of their choice.
async function api(path,opt={}){
  const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),10000);
  try{
    const r=await fetch(API+path,{...opt,signal:ctl.signal,headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json",...(opt.headers||{})}});
    if(!r.ok){const e=new Error("http "+r.status);e.status=r.status;throw e}
    return opt.method==="POST"?null:await r.json();
  }finally{clearTimeout(t)}
}
function playerId(){
  let id=store.get("sp-player",null);
  if(!id){id=crypto.randomUUID?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));store.set("sp-player",id)}
  return id;
}
const myRec=()=>{const r=store.get("sp-daily",null);return r&&r.date===today()&&r.won?r:null};
async function loadLb(){
  if(!API) return; if(lb.state!=="ok"){lb.state="loading";renderLb()}
  try{
    const rows=await api(`scores?day=eq.${today()}&select=nick,seconds,moves&order=seconds.asc,moves.asc&limit=200`);
    lb={state:"ok",rows:rows.map(r=>({n:String(r.nick).slice(0,16),t:Number(r.seconds),m:Number(r.moves)})).filter(r=>isFinite(r.t)&&isFinite(r.m)),fail:lb.fail};
  }catch(e){lb.state="slow"}
  renderLb();
}
async function submitScore(){
  const rec=myRec(); if(!API||!rec||rec.sub) return;
  const n=store.get("sp-nick",""); if(!n){openNick();return}
  try{
    await api("scores",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({day:today(),player:playerId(),nick:n,seconds:Math.max(5,Math.round(rec.ms/1000)),moves:rec.moves,checks:rec.checks})});
    rec.sub=true; store.set("sp-daily",rec); lb.fail=false;
  }catch(e){
    if(e.status===409){rec.sub=true;store.set("sp-daily",rec)} // already on the board for today
    else lb.fail=true;
  }
  await loadLb();
}
function renderLb(){
  if(view==="home"){renderHome();return}
  if(view!=="lb") return;
  const ol=$("lb"), note=$("lbNote"), rec=myRec(), nick=store.get("sp-nick",""); ol.innerHTML=""; let n="";
  const me=rec&&rec.sub?lb.rows.findIndex(r=>r.n===nick&&r.t===Math.max(5,Math.round(rec.ms/1000))&&r.m===rec.moves):-1;
  $("lbAdd").hidden=!(API&&rec&&!rec.sub&&lb.state!=="off");
  if(lb.state==="loading") n="Laen edetabelit…";
  else if(lb.state==="slow") n="Edetabelit ei õnnestu praegu kätte saada. Proovi hiljem uuesti.";
  else if(lb.state==="off") n="Edetabel ei ole sisse lülitatud.";
  else if(lb.fail) n="Sinu tulemust ei õnnestunud salvestada. Proovi uuesti nupust «Lisa minu tulemus».";
  else if(!lb.rows.length) n="Täna pole veel keegi lõpetanud. Ole esimene!";
  else{const k=lb.rows.length;
    n=me<0?"Järjestus: kiireim aeg, võrdse aja korral vähem käike."
      :k===1?"Oled täna esimene lõpetaja."
      :`Olid kiirem kui ${Math.round((k-1-me)/(k-1)*100)}% tänastest mängijatest (${me+1}. koht ${k} seast).`}
  note.textContent=n;
  if(lb.state!=="ok") return;
  lb.rows.forEach((r,i)=>{const li=document.createElement("li"); if(i===me) li.className="me";
    const a=document.createElement("span");a.className="rk";a.textContent=i+1;
    const b=document.createElement("span");b.className="nm";b.textContent=r.n;
    const c=document.createElement("span");c.textContent=fmt(r.t);
    const d=document.createElement("span");d.className="mv";d.textContent=r.m+" käiku";
    li.append(a,b,c,d); ol.appendChild(li)});
}
// Nickname dialog
function openNick(){$("nickInput").value=store.get("sp-nick","");$("nickErr").textContent="";$("nickDlg").classList.add("open");$("nickInput").focus()}
function closeNick(){$("nickDlg").classList.remove("open")}
$("nickForm").addEventListener("submit",e=>{e.preventDefault();
  const v=$("nickInput").value.trim().replace(/\s+/g," ");
  if(!NICK_RE.test(v)){$("nickErr").textContent="Hüüdnimes peab olema 2–16 märki: tähed, numbrid, tühik, punkt, alakriips või sidekriips.";return}
  store.set("sp-nick",v); closeNick(); renderHome(); submitScore()});
$("nickSkip").onclick=closeNick;
$("nickPriv").onclick=()=>{closeNick();nav("priv")};
$("nickEdit").onclick=openNick;
$("lbAdd").onclick=()=>{lb.fail=false;submitScore()};
$("privLink").onclick=()=>nav("priv");
// Share today's result
async function share(){
  const rec=store.get("sp-daily",null); if(!rec||rec.date!==today()) return;
  const d=today().split("-").reverse().slice(0,2).join(".");
  const text=(rec.won?`Sõnapüramiid ${d} · ${fmt(rec.ms/1000)} · ${rec.moves} käiku · ${rec.checks} kontrolli`:`Sõnapüramiid ${d} · täna jäi püramiid lahendamata`)+"\n"+location.origin+location.pathname;
  const note=$("shareNote"); note.hidden=false;
  try{if(navigator.share){await navigator.share({text});note.hidden=true;return}}catch(e){if(e&&e.name==="AbortError"){note.hidden=true;return}}
  try{await navigator.clipboard.writeText(text);note.textContent="Tulemus on kopeeritud. Kleebi see sõnumisse."}
  catch(e){note.textContent=text}
}
$("shareBtn").onclick=share;
// Report a word
function openReport(){
  const found=[]; for(let c=1;c<N;c++){const j=judge(c); if(j[1]&&(S.links[c]==="g"||S.links[c]==="o")) found.push(j[1][0])}
  $("repList").innerHTML=found.map(w=>`<option value="${w}">`).join("");
  $("repWord").value="";$("repNote").value="";$("repErr").textContent="";$("repDlg").classList.add("open");$("repWord").focus();
}
$("reportBtn").onclick=openReport;
$("repClose").onclick=()=>$("repDlg").classList.remove("open");
$("repForm").addEventListener("submit",async e=>{e.preventDefault();
  const word=$("repWord").value.trim(), note=$("repNote").value.trim();
  if(word.length<2){$("repErr").textContent="Kirjuta sõna, mille kohta teade käib.";return}
  $("repErr").textContent="Saadan…";
  try{await api("reports",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({puzzle:S?S.pz:"-",word,note})});
    $("repErr").textContent="Aitäh! Teade on saadetud.";$("repWord").value="";$("repNote").value=""}
  catch(err){$("repErr").textContent="Teadet ei õnnestunud saata. Proovi hiljem uuesti."}});
// Install to home screen
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;$("installBtn").hidden=false});
$("installBtn").onclick=async()=>{if(!installEvt) return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;$("installBtn").hidden=true};
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!navigator.standalone) $("iosHint").hidden=false;
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});

$("checkBtn").onclick=check;
$("retryBtn").onclick=()=>startGame("camp",S.pz,S.lvl);
$("nextBtn").onclick=()=>startGame("camp",CAMP[S.lvl+1][0],S.lvl+1);
$("levelsBtn").onclick=()=>nav("levels");
$("optDaily").onclick=()=>nav("daily");
$("optCamp").onclick=()=>nav("levels");
$("optLb").onclick=()=>nav("lb");
$("lbBtn").onclick=()=>nav("lb");
$("homeBtn").onclick=back;
$("title").onclick=openHome;
// Guide: each step plays a small looping scene. slots = tile positions, links = slot pairs,
// frames = what changes: tap (pointer target), sel (highlighted slots), swap (slot pairs),
// cls (link index -> state), cap (caption).
const GUIDE=[
 {title:"Loe ülevalt alla",text:"Iga joon ühendab kaks sõna. Ülemine sõna on liitsõna esimene pool ja alumine sõna teine pool. Tagurpidi ei loeta kunagi.",
  slots:[[160,40],[85,130],[235,130]],links:[[0,1],[0,2]],tiles:["õun","mahl","puu"],
  frames:[{cls:{0:"hl",1:""},cap:"õun + mahl = õunamahl"},{cls:{0:"",1:"hl"},cap:"õun + puu = õunapuu"},{cls:{0:"",1:""},cap:"Alati ülemine sõna enne, alumine järel."}]},
 {title:"Vaheta sõnu",text:"Puuduta üht sõna ja siis teist: need vahetavad kohad. Iga vahetus on üks käik. Püramiid on valmis, kui iga joon annab liitsõna.",
  slots:[[160,40],[85,130],[235,130]],links:[[0,1],[0,2]],tiles:["mahl","õun","puu"],
  frames:[{tap:["s",0],sel:[0],cap:"Puuduta sõna mahl."},{tap:["s",1],sel:[],swap:[[0,1]],cap:"Puuduta sõna õun: sõnad vahetavad kohad."},{cls:{0:"hl",1:"hl"},cap:"Nüüd saab lugeda: õunamahl ja õunapuu."}]},
 {title:"Kontrolli",text:"Kontrolli näitab iga joone kohta, kas paar sobib. Kontrollida saab ainult neli korda, nii et mõtle enne läbi. Kontrollitud paar jätab oma värvi meelde.",
  slots:[[160,30],[85,95],[235,95],[85,160]],links:[[0,1],[0,2],[1,3]],tiles:["töö","päev","raamat","kell"],btn:[272,160],
  frames:[{tap:["b"],cls:{0:"g",1:"o",2:"x"},cap:"Vajuta Kontrolli."},{tap:["l",0],cap:"Roheline: tööpäev on õige paar õiges kohas."},{tap:["l",1],cap:"Kollane: tööraamat on päris sõna, aga lahenduses on raamat mujal."},{tap:["l",2],cap:"Katkine joon: päev + kell ei anna liitsõna."}]},
 {title:"Lukusta paar",text:"Kui arvad, et kaks sõna käivad kokku, puuduta neid ühendavat joont. Joon muutub lillaks ja paar liigub edaspidi koos. Uus puudutus joonel võtab luku maha. Rohelised paarid on alati lukus.",
  slots:[[160,30],[85,95],[235,95],[85,160],[235,160]],links:[[0,1],[0,2],[1,3],[2,4]],tiles:["õun","kell","puu","torn","leht"],
  frames:[{tap:["l",3],cls:{3:"p"},cap:"Puuduta joont: puu ja leht on nüüd lukus."},{tap:["s",2],sel:[2,4],cap:"Puuduta paari: mõlemad sõnad on valitud."},{tap:["s",1],sel:[],swap:[[1,2],[3,4]],cls:{3:"",2:"p"},cap:"Puuduta sihtkohta: paar liigub koos."}]},
 {title:"Päevamäng ja kampaania",text:"Päevamäng: kõigil on sama püramiid ja üks katse päevas. Aeg hakkab jooksma esimesest puudutusest ning tulemus läheb edetabelisse aja ja käikude järgi. Kampaania: kümme kasvavat taset, kus kiire lahendus annab kuni kolm tähte.",
  art:[["0:42 · 9 käiku",80],["★ ★ ★",130]],frames:[{cap:"Mida kiiremini ja vähemate käikudega, seda parem."}]}
];
let gI=0, gTimers=[], gEl=null;
const SVGNS="http://www.w3.org/2000/svg";
function gClear(){gTimers.forEach(clearTimeout);gTimers=[]}
function gShow(i){
  gI=i; gClear(); const G=GUIDE[i], svgEl=$("gSvg");
  $("gStep").textContent=`Samm ${i+1}/${GUIDE.length}`; $("gTitle").textContent=G.title; $("gText").textContent=G.text;
  $("gPrev").disabled=i===0; $("gNext").textContent=i===GUIDE.length-1?"Mängima":"Järgmine";
  svgEl.innerHTML=""; const mk=(t,a)=>{const e=document.createElementNS(SVGNS,t);for(const k in a)e.setAttribute(k,a[k]);svgEl.appendChild(e);return e};
  gEl={paths:[],tiles:[],ptr:null,btn:null};
  if(G.art){G.art.forEach(([t,y])=>{mk("text",{x:160,y,"text-anchor":"middle","class":"big"}).textContent=t})}
  else{
    G.links.forEach(([a,b])=>gEl.paths.push(mk("path",{d:`M${G.slots[a][0]},${G.slots[a][1]} L${G.slots[b][0]},${G.slots[b][1]}`,pathLength:100})));
    G.tiles.forEach(w=>{const g=mk("g",{"class":"gt"});const r=document.createElementNS(SVGNS,"rect");r.setAttribute("x",-38);r.setAttribute("y",-15);r.setAttribute("width",76);r.setAttribute("height",30);
      const t=document.createElementNS(SVGNS,"text");t.setAttribute("text-anchor","middle");t.setAttribute("y",5);t.textContent=w;g.append(r,t);gEl.tiles.push(g)});
    if(G.btn){const g=mk("g",{"class":"gt inv"});g.style.transform=`translate(${G.btn[0]}px,${G.btn[1]}px)`;const r=document.createElementNS(SVGNS,"rect");r.setAttribute("x",-40);r.setAttribute("y",-14);r.setAttribute("width",80);r.setAttribute("height",28);
      const t=document.createElementNS(SVGNS,"text");t.setAttribute("text-anchor","middle");t.setAttribute("y",5);t.textContent="Kontrolli";g.append(r,t);gEl.btn=g}
    gEl.ptr=mk("circle",{r:11,"class":"ptr"});
  }
  gPlay();
}
function gPlay(){ // run the frames of the current step in a loop
  const G=GUIDE[gI]; if(!G.frames) return;
  let at=G.tiles?G.tiles.map((_,k)=>k):[], cls={}, sel=[];           // at[tile]=slot
  const draw=()=>{if(G.art) return;
    gEl.tiles.forEach((g,k)=>{const s=G.slots[at[k]];g.style.transform=`translate(${s[0]}px,${s[1]}px)`;g.classList.toggle("sel",sel.includes(at[k]))});
    gEl.paths.forEach((p,k)=>p.setAttribute("class",cls[k]||""))};
  draw(); $("gCap").textContent=G.frames[0].cap; if(gEl.ptr) gEl.ptr.classList.remove("on");
  let t=600;
  G.frames.forEach(f=>{
    gTimers.push(setTimeout(()=>{ $("gCap").textContent=f.cap;
      if(gEl.ptr){ if(f.tap){let q; if(f.tap[0]==="s") q=G.slots[f.tap[1]]; else if(f.tap[0]==="b") q=G.btn; else{const [a,b]=G.links[f.tap[1]];q=[(G.slots[a][0]+G.slots[b][0])/2,(G.slots[a][1]+G.slots[b][1])/2]}
          gEl.ptr.style.transform=`translate(${q[0]}px,${q[1]}px)`;gEl.ptr.classList.add("on")} else gEl.ptr.classList.remove("on")}
    },t));
    gTimers.push(setTimeout(()=>{
      if(f.swap) f.swap.forEach(([a,b])=>{at=at.map(s=>s===a?b:s===b?a:s)});
      if(f.cls) Object.assign(cls,f.cls); if(f.sel) sel=f.sel; draw();
    },t+(f.tap?550:0)));
    t+=2600;
  });
  gTimers.push(setTimeout(gPlay,t+400));
}
function openGuide(){$("help").classList.add("open");gShow(0)}
function closeGuide(){$("help").classList.remove("open");gClear()}
$("helpBtn").onclick=openGuide; $("optGuide").onclick=openGuide; $("helpClose").onclick=closeGuide;
$("gPrev").onclick=()=>gShow(Math.max(0,gI-1));
$("gNext").onclick=()=>{if(gI===GUIDE.length-1) closeGuide(); else gShow(gI+1)};
window.addEventListener("resize",()=>{if(S&&(view==="daily"||view==="play")) render()});
setInterval(tick,500);
function setTheme(m){
  if(m==="light"||m==="dark") document.documentElement.setAttribute("data-mode",m); else{m="system";document.documentElement.removeAttribute("data-mode")}
  store.set("sp-theme",m);
  $("theme").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===m));
}
$("theme").querySelectorAll("button").forEach(b=>b.onclick=()=>setTheme(b.dataset.m));
setTheme(store.get("sp-theme","system"));

function start(){
  view="home"; render();
  if(API) loadLb().then(()=>{const r=myRec(); if(r&&!r.sub&&store.get("sp-nick","")) submitScore()});
  if(!store.get("sp-guide",0)){store.set("sp-guide",1); if(store.get("sp-guide",0)) openGuide()}
}
start();
