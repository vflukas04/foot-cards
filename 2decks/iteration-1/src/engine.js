/* Foot Cards 2Decks – Iteration 1 · Regel-Engine (Regelstand 1.3)
   Reine Spiellogik ohne DOM. In Node: const E=require('./engine.js'); E.setData(require('./cards.json')); */
(function(root){
'use strict';
let D=null;
const COLS='ABCDE', NAME={B:'Blau',L:'Lila'}, OPP={B:'L',L:'B'}, FWD={B:1,L:-1};
const PASSES=['Querpass','Steilpass','Diagonalball','Flanke','Rückpass'];
const DRIB=['Dribbling','Übersteiger'];
const COUNTER={Passabfangen:PASSES,Tackling:DRIB,'Schuss blocken':['Schuss','Kopfball']};
const VAL={T:'Tempo',Z:'Zweikampf',S:'Schuss'};

function setData(d){D=d;}
const P=i=>D.players[i];
const col=f=>COLS.indexOf(f[0]), row=f=>+f.slice(1);
const fid=(c,r)=>COLS[c]+r;
const inb=(c,r)=>c>=0&&c<5&&r>=1&&r<=7;
function nbrs(f){const c=col(f),r=row(f),o=[];[[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{if(inb(c+a,r+b))o.push(fid(c+a,r+b));});return o;}
const ekey=(a,b)=>[a,b].sort((x,y)=>row(x)-row(y)||col(x)-col(y)).join('/');
const edgesOf=f=>nbrs(f).map(n=>ekey(f,n));
const other=(e,f)=>{const [a,b]=e.split('/');return a===f?b:a;};
const inBox=(t,f)=>{const c=col(f),r=row(f);return c>=1&&c<=3&&(t==='B'?r>=6:r<=2);};
const clone=o=>JSON.parse(JSON.stringify(o));
const sk=(e,t)=>e+'#'+t, edgeOf=k=>k.split('#')[0], teamOfKey=k=>k.split('#')[1];
const cardName=n=>n==='Ball sichern A'?'Ball sichern (alle)':n==='Ball sichern B'?'Ball sichern (gegnerische)':n;

/* ---------- Zufall (im Spielstand, damit Host und Gast gleich rechnen) ---------- */
function rnd(st){st.seed=(st.seed*1103515245+12345)%2147483648;return st.seed/2147483648;}
function shuffle(st,a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd(st)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---------- Neues Spiel ---------- */
function newGame(opt){
 opt=opt||{};
 const st={v:1,seq:0,seed:(opt.seed!=null?opt.seed:Math.floor(Math.random()*2147483647))||1,
  turn:'B',att:'B',phase:'choose',mode:null,turnNo:1,score:{B:0,L:0},
  settings:{oppField:!!opt.oppField,buildMany:opt.buildMany!==false},
  board:{},ball:{carrier:null,field:'C4'},cards:{},edges:{},
  hand:{B:{A:[],P:[]},L:{A:[],P:[]}},deck:{B:{A:[],P:[]},L:{A:[],P:[]}},disc:{B:{A:[],P:[]},L:{A:[],P:[]}},
  t:{placedP:0,placedA:0,moved:false,pendingMove:null,taktik:0},log:[],last:null,over:false};
 let id=0;
 for(const t of ['B','L']){
  st.deck[t].A=shuffle(st,D.actions.map(([n,a])=>{const k='c'+(id++);st.cards[k]={t,n,a};return k;}));
  st.deck[t].P=shuffle(st,D.players.map((p,i)=>i).filter(i=>P(i).team===t));
  st.hand[t].A=st.deck[t].A.splice(0,4); st.hand[t].P=st.deck[t].P.splice(0,2);
 }
 st.log.push(`Neues Spiel (Regelstand 1.3). Leere Matte, Ball frei auf C4. Blau beginnt. Starthand je 2 Spieler und 4 Aktionen. Je Kante ein Platz pro Team. Einstellungen: Aufbauen ${st.settings.buildMany?'beliebig viele Aktionen legen (Test)':'bis zu 2 Aktionen legen'}; Spieler auf Felder mit Gegenspieler ${st.settings.oppField?'erlaubt (Test)':'verboten'}.`);
 return st;
}

/* ---------- Abfragen ---------- */
const on=(st,f,t)=>Object.keys(st.board).map(Number).filter(i=>st.board[i]===f&&(!t||P(i).team===t));
const carrierField=st=>st.ball.carrier!=null?st.board[st.ball.carrier]:null;
function slotsAt(st,f){const o=[];for(const e of edgesOf(f))for(const t of ['B','L'])if(st.edges[sk(e,t)])o.push(sk(e,t));return o;}
function canCard(st,t,e){ if(st.edges[sk(e,t)]) return false; const fs=e.split('/'); return fs.some(f=>on(st,f,t).length)||fs.every(f=>!on(st,f).length); }
function canPlayer(st,t,f,moving){ if(on(st,f,t).length) return false; if(!moving&&!st.settings.oppField&&on(st,f,OPP[t]).length) return false; return true; }
function legalCardEdges(st,t){const o=[];for(let c=0;c<5;c++)for(let r=1;r<=7;r++){const f=fid(c,r);for(const e of edgesOf(f)) if(!o.includes(e)&&canCard(st,t,e)) o.push(e);}return o;}
function legalPlayerFields(st,t){const o=[];for(let c=0;c<5;c++)for(let r=1;r<=7;r++){const f=fid(c,r);if(canPlayer(st,t,f))o.push(f);}return o;}
function uses(st,cid,pl){const c=st.cards[cid],p=P(pl),u=[c.n];
 if(c.a==='aktiv')u.push(p.act); else if(c.a==='passiv')u.push(p.pas); else if(c.a==='sturm'&&p.area==='S'){u.push(p.act);u.push(p.pas);}
 return [...new Set(u)];}
function mods(st,f,t,excl){const m={T:0,Z:0,S:0,any:0},src=[];
 for(const e of slotsAt(st,f)){const x=st.edges[e]; if(!x||!x.open||x.used||(excl||[]).includes(e)) continue; const c=st.cards[x.c]; if(c.t!==t) continue;
  const k=D.info[c.n][3]; if(k==='*'){m.any++;src.push(cardName(c.n)+' +1');} else {m[k]++;src.push(cardName(c.n)+' +1 '+VAL[k]);}}
 return {m,src};}
const modv=(mm,k)=>(mm.m[k]||0)+mm.m.any;

/* ---------- Ziehen / Ablage ---------- */
function draw(st,t,k,n){const got=[];for(let i=0;i<n;i++){if(!st.deck[t][k].length){st.deck[t][k]=shuffle(st,st.disc[t][k]);st.disc[t][k]=[];if(st.deck[t][k].length)st.log.push(NAME[t]+': Ablagestapel neu gemischt.');}const x=st.deck[t][k].shift();if(x!==undefined){st.hand[t][k].push(x);got.push(x);}}return got;}
function discardEdge(st,e){const x=st.edges[e];st.disc[st.cards[x.c].t].A.push(x.c);delete st.edges[e];}
function removePlayer(st,i){st.disc[P(i).team].P.push(i);delete st.board[i];}

/* ---------- Ballwechsel / Tor / Abstoß ---------- */
function change(st,carrier,why){
 const old=st.att; const gone=[];
 for(const i of Object.keys(st.board).map(Number)){
  if(i===carrier) continue;
  const t=P(i).team;
  if(!edgesOf(st.board[i]).some(e=>st.edges[sk(e,t)]&&!st.edges[sk(e,t)].open)){removePlayer(st,i);gone.push(P(i).short);}
 }
 for(const e of Object.keys(st.edges)){const x=st.edges[e];if(st.cards[x.c].t===old||x.open)discardEdge(st,e);}
 st.att=P(carrier).team; st.ball={carrier,field:null};
 st.log.push(`${why?why+' ':''}Ballwechsel: ${P(carrier).short} hat den Ball, ${NAME[st.att]} greift an. Abgelegt: ${gone.join(', ')||'niemand'}.`);
 return gone;
}
function goal(st,t){
 st.score[t]++; const conc=OPP[t];
 for(const e of Object.keys(st.edges)) discardEdge(st,e);
 const mine=on2(st,conc).sort((a,b)=>dist(st.board[a],'C4')-dist(st.board[b],'C4'));
 st.att=conc; st.ball=mine.length?{carrier:mine[0],field:null}:{carrier:null,field:'C4'};
 st.log.push(`TOR für ${NAME[t]}! ${st.score.B}:${st.score.L}. Anstoß ${NAME[conc]} (Platzhalter): alle Aktionskarten abgelegt, Ball ${mine.length?'zu '+P(mine[0]).short:'frei auf C4'}.`);
}
const on2=(st,t)=>Object.keys(st.board).map(Number).filter(i=>P(i).team===t);
const dist=(a,b)=>Math.abs(col(a)-col(b))+Math.abs(row(a)-row(b));
function keeperSave(st,def){
 const gr=def==='B'?1:7;
 let mine=on2(st,def).sort((a,b)=>Math.abs(row(st.board[a])-gr)-Math.abs(row(st.board[b])-gr));
 let who=mine[0];
 if(who==null){const d=draw(st,def,'P',1);if(d.length){who=d[0];st.hand[def].P=st.hand[def].P.filter(x=>x!==who);const f=def==='B'?'C1':'C7';for(const i of on(st,f))removePlayer(st,i);st.board[who]=f;}}
 if(who==null){st.ball={carrier:null,field:def==='B'?'C1':'C7'};st.att=def;st.log.push('Gehalten. Kein Spieler für den Abstoß, Ball frei vor dem Tor.');return;}
 change(st,who,`Gehalten von ${D.keepers[def].name}. Abstoß zu ${P(who).short}.`);
}

/* ---------- freier Ball ---------- */
function enterField(st,i,f){
 if(st.ball.carrier!=null||st.ball.field!==f) return;
 const t=P(i).team, others=on(st,f,OPP[t]);
 let winner=i;
 if(others.length){const op=others.sort((a,b)=>P(b).Z-P(a).Z)[0];const a=P(i).Z,d=P(op).Z;const att=st.att;
  winner=a>d?i:a<d?op:(t===att?i:op);
  st.log.push(`Freier Ball auf ${f}: Zweikampf ${P(i).short} ${a} gegen ${P(op).short} ${d} → ${P(winner).short}.`);}
 if(P(winner).team===st.att){st.ball={carrier:winner,field:null};st.log.push(`${P(winner).short} holt den freien Ball auf ${f}.`);}
 else change(st,winner,`${P(winner).short} erobert den freien Ball auf ${f}.`);
}

/* ---------- Ziele von Aktionen ---------- */
function targets(st,use,ex,e){
 const t=P(ex).team, f=st.board[ex], nf=other(e,f), c0=col(f), r0=row(f), fw=FWD[t], cn=col(nf), rn=row(nf);
 const fwd=cn===c0&&rn===r0+fw, side=rn===r0, back=cn===c0&&rn===r0-fw;
 const hasBall=st.ball.carrier===ex;
 const freeOwn=x=>!on(st,x,t).length;
 const T=[];
 if(hasBall){
  if(use==='Querpass'&&side) T.push(nf);
  if(use==='Steilpass'&&fwd){T.push(nf);if(inb(c0,r0+2*fw))T.push(fid(c0,r0+2*fw));}
  if(use==='Diagonalball'&&fwd){for(const d of[-1,1])if(inb(c0+d,r0+fw))T.push(fid(c0+d,r0+fw));}
  if(use==='Rückpass'&&back) T.push(nf);
  if(use==='Flanke'&&(fwd||side)){for(let c=0;c<5;c++)for(let r=1;r<=7;r++){const x=fid(c,r);const d=dist(f,x);if(inBox(t,x)&&d>=2&&d<=3)T.push(x);}}
  if(use==='Dribbling'&&fwd&&freeOwn(nf)) T.push(nf);
  if(use==='Übersteiger'&&inb(c0,r0+fw)&&freeOwn(fid(c0,r0+fw))) T.push(fid(c0,r0+fw));
  if(use==='Schuss') T.push('Tor');
  if(use==='Ball sichern A'||use==='Ball sichern B') T.push(f);
 } else {
  if(use==='Sprint'&&fwd){for(const k of[1,2]){if(k===2&&P(ex).T<4)break;const x=fid(c0,r0+k*fw);if(inb(c0,r0+k*fw)&&freeOwn(x))T.push(x);}}
  if(use==='Pressing'){const bf=carrierField(st)||st.ball.field;if(bf){for(const x of nbrs(f))if(dist(x,bf)<dist(f,bf)&&freeOwn(x)&&(st.settings.oppField||true))T.push(x);}}
  const cf=carrierField(st);
  if(use==='Tackling'&&st.ball.carrier!=null&&P(st.ball.carrier).team!==t&&e.split('/').includes(cf)) T.push(cf);
 }
 if(use==='Taktik') T.push('Hand');
 return T;
}
function triggerOptions(st,t){
 const out=[];
 for(const [e,x] of Object.entries(st.edges)){
  if(x.used||st.cards[x.c].t!==t) continue;
  for(const f of edgeOf(e).split('/')) for(const ex of on(st,f,t)) for(const use of uses(st,x.c,ex)){
   const tg=targets(st,use,ex,edgeOf(e)); if(tg.length) out.push({e,ex,use,targets:tg});
  }
 }
 return out;
}

/* ---------- Falle suchen ---------- */
function findTrap(st,f,use,attT){
 const d=OPP[attT]; let best=null;
 for(const e of slotsAt(st,f)){const x=st.edges[e]; if(!x||!x.open||x.used||st.cards[x.c].t!==d) continue;
  for(const fl of edgeOf(e).split('/')) for(const pl of on(st,fl,d)) for(const u of uses(st,x.c,pl))
   if(COUNTER[u]&&COUNTER[u].includes(use)&&(!best||P(pl).Z>P(best.pl).Z)) best={e,pl,u};}
 return best;
}
function reveal(st,f){const o=[];for(const e of slotsAt(st,f))if(!st.edges[e].open){st.edges[e].open=true;o.push(e);}return o;}
function revText(st,f,list){return list.length?`Aufgedeckt an ${f}: `+list.map(e=>`${cardName(st.cards[st.edges[e].c].n)} ${edgeOf(e)} (${NAME[st.cards[st.edges[e].c].t]})`).join(', ')+'.':'';}

/* ---------- Schuss ---------- */
function shotPath(st,i,f){const t=P(i).team,r=row(f),c=col(f);const rows=[];if(t==='B')for(let x=r+1;x<=7;x++)rows.push(x);else for(let x=1;x<r;x++)rows.push(x);
 let n=0;for(const rr of rows)for(let cc=Math.min(c,2);cc<=Math.max(c,2);cc++)n+=on(st,fid(cc,rr)).length; n+=on(st,f,OPP[t]).length; return n;}
function shoot(st,i,f,kopf,res){
 const t=P(i).team,d=OPP[t];
 if(kopf){const rv=reveal(st,f);if(rv.length)res.push(revText(st,f,rv));const tr=findTrap(st,f,'Kopfball',t);if(tr){st.edges[tr.e].used=true;const a=P(i).S+modv(mods(st,f,t),'S'),b=P(tr.pl).Z+modv(mods(st,f,d,[tr.e]),'Z');res.push(`Falle Schuss blocken (${edgeOf(tr.e)}): ${P(i).short} ${a} gegen ${P(tr.pl).short} ${b}.`);if(b>a){change(st,tr.pl,res.join(' ')+` ${P(tr.pl).short} blockt.`);return 'lost';}}}
 const mm=mods(st,f,t),path=shotPath(st,i,f),r=row(f),dd=t==='B'?Math.max(0,6-r):Math.max(0,r-2);
 const a=P(i).S+modv(mm,'S')-path-dd, k=D.keepers[d].H+modv(mods(st,f,d),'S');
 const km=modv(mods(st,f,d),'S');const txt=`${kopf?'Kopfball':'Schuss'} ${P(i).short} von ${f}: Schuss ${P(i).S} + ${modv(mm,'S')} (Modifikatoren) − ${path} (Schussweg) − ${dd} (Entfernung) = ${a} gegen ${D.keepers[d].name} ${D.keepers[d].H} + ${km} = ${k}`;
 st.last={kind:'shot',text:txt+(a>k?' → TOR':' → gehalten')};
 if(a>k){st.log.push([...res,txt+' → TOR!'].join(' '));goal(st,t);st.turn=d;st.phase='choose';st.mode=null;st.t=freshT();return 'goal';}
 st.log.push([...res,txt+' → gehalten.'].join(' ')); keeperSave(st,d); return 'saved';
}

/* ---------- Auslösen ---------- */
function trigger(st,t,e,ex,use,tg){
 const x=st.edges[e], f=st.board[ex], res=[];
 const label=`${NAME[t]}: ${P(ex).short} (${f}) löst ${cardName(st.cards[x.c].n)}${use!==st.cards[x.c].n?' als '+cardName(use):''} auf ${edgeOf(e)} aus.`;
 res.push(label);
 const rv=reveal(st,f); x.open=true; x.used=true; const rt=revText(st,f,rv.filter(k=>k!==e)); if(rt)res.push(rt);
 const d=OPP[t];
 const isBall=st.ball.carrier===ex;
 if(use==='Taktik'){draw(st,t,'A',2);st.t.taktik=1;st.phase='taktik';res.push('Zieht 2 Aktionen und legt gleich 1 ab.');st.log.push(res.join(' '));return;}
 if(use==='Pressing'||use==='Sprint'){st.board[ex]=tg;res.push(`${P(ex).short} läuft ${f} → ${tg}.`);st.log.push(res.join(' '));enterField(st,ex,tg);return;}
 if(use==='Tackling'){const car=st.ball.carrier,cf=st.board[car];
  const a=P(car).Z+modv(mods(st,f,P(car).team),'Z'), b=P(ex).Z+modv(mods(st,f,t,[e]),'Z');
  const txt=`Tackling: ${P(ex).short} ${b} gegen ${P(car).short} ${a}`; st.last={kind:'duel',text:txt+(b>a?' → Ballgewinn':' → Ballführer bleibt am Ball')};
  if(b>a){res.push(txt+` → ${P(ex).short} erobert den Ball.`);change(st,ex,res.join(' '));}else{res.push(txt+' → Gleichstand oder weniger: der Ballführer bleibt am Ball.');st.log.push(res.join(' '));}
  return;}
 if(use==='Ball sichern A'||use==='Ball sichern B'){const gone=[];for(const k of slotsAt(st,f)){if(k===e)continue;if(use==='Ball sichern A'||st.cards[st.edges[k].c].t===d){gone.push(edgeOf(k)+' ('+NAME[teamOfKey(k)]+')');discardEdge(st,k);}}
  if(use==='Ball sichern A'){discardEdge(st,e);} res.push(`Ball gesichert: abgelegt ${gone.join(', ')||'nichts'}.`);st.log.push(res.join(' '));return;}
 if(!isBall) {st.log.push(res.join(' '));return;}
 // Falle
 const stat=use==='Steilpass'?'T':use==='Schuss'?'S':'Z';
 const tr=findTrap(st,f,use,t);
 if(tr){st.edges[tr.e].used=true;
  let a,b; if(use==='Schuss'){a=P(ex).S+modv(mods(st,f,t,[e]),'S');b=P(tr.pl).Z+modv(mods(st,f,d,[tr.e]),'Z');}
  else{a=P(ex)[stat]+modv(mods(st,f,t,[e]),stat);b=P(tr.pl)[stat]+modv(mods(st,f,d,[tr.e]),stat);}
  const txt=`Falle ${tr.u} (${edgeOf(tr.e)}): ${P(ex).short} ${a} gegen ${P(tr.pl).short} ${b}`;
  st.last={kind:'duel',text:txt+(b>a?' → abgefangen':' → durch')};
  if(b>a){res.push(txt+` → ${P(tr.pl).short} gewinnt.`);change(st,tr.pl,res.join(' '));return;}
  res.push(txt+' → hält stand.');}
 if(use==='Schuss'){shoot(st,ex,f,false,res);return;}
 if(DRIB.includes(use)){
  const opps=on(st,tg,d);
  if(opps.length){const op=opps.sort((p,q)=>P(q).Z-P(p).Z)[0];const a=P(ex).Z+modv(mods(st,f,t,[e]),'Z'),b=P(op).Z;
   const txt=`Dribbling in ${tg}: ${P(ex).short} ${a} gegen ${P(op).short} ${b}`; st.last={kind:'duel',text:txt+(a>=b?' → durch':' → verloren')};
   if(b>a){res.push(txt+` → ${P(op).short} gewinnt.`);change(st,op,res.join(' '));return;} res.push(txt+' → durch.');}
  st.board[ex]=tg; res.push(`${P(ex).short} dribbelt nach ${tg}.`); st.log.push(res.join(' ')); return;}
 if(PASSES.includes(use)){
  const c0=col(f),r0=row(f),c1=col(tg),r1=row(tg);
  if(use==='Steilpass'&&Math.abs(r1-r0)===2){const sk=fid(c0,(r0+r1)/2),opps=on(st,sk,d);
   if(opps.length){const rec=on(st,tg,t)[0];const op=opps.sort((p,q)=>P(q).T-P(p).T)[0];
    if(rec==null){res.push(`${P(op).short} auf dem übersprungenen Feld ${sk} fängt ab (kein Empfänger).`);change(st,op,res.join(' '));return;}
    const a=P(rec).T+modv(mods(st,f,t,[e]),'T'),b=P(op).T-1;const txt=`Übersprungenes Feld ${sk}: ${P(rec).short} ${a} gegen ${P(op).short} ${b} (−1)`;st.last={kind:'duel',text:txt};
    if(b>a){res.push(txt+` → ${P(op).short} fängt ab.`);change(st,op,res.join(' '));return;} res.push(txt+' → durch.');}}
  const rec=on(st,tg,t)[0], opps=on(st,tg,d);
  if(rec==null&&opps.length){const op=opps[0];res.push(`${cardName(use)} nach ${tg} landet bei ${P(op).short}.`);change(st,op,res.join(' '));return;}
  if(rec!=null&&opps.length){const s2=use==='Steilpass'?'T':'Z';const op=opps.sort((p,q)=>P(q)[s2]-P(p)[s2])[0];const a=P(rec)[s2]+modv(mods(st,f,t,[e]),s2),b=P(op)[s2];
   const txt=`Annahme auf ${tg}: ${P(rec).short} ${a} gegen ${P(op).short} ${b}`;st.last={kind:'duel',text:txt};
   if(b>a){res.push(txt+` → ${P(op).short} gewinnt.`);change(st,op,res.join(' '));return;} res.push(txt+' → angenommen.');}
  if(rec!=null){st.ball={carrier:rec,field:null};res.push(`${cardName(use)} ${f} → ${tg} zu ${P(rec).short}.`);
   if(use==='Flanke'){shoot(st,rec,tg,true,res);return;} st.log.push(res.join(' '));return;}
  st.ball={carrier:null,field:tg};res.push(`${cardName(use)} ${f} → ${tg} in den freien Raum.`);st.log.push(res.join(' '));return;}
 st.log.push(res.join(' '));
}

/* ---------- Zugablauf ---------- */
const maxA=st=>st.settings.buildMany?99:2;
function freshT(){return {placedP:0,placedA:0,moved:false,pendingMove:null,taktik:0};}
function actor(st){return st.turn;}
function hasLegalPlace(st,t){return st.hand[t].A.length>0&&legalCardEdges(st,t).length>0;}

/* Mögliche Aktionen für den, der am Zug ist (für Oberfläche und Bot). */
function options(st){
 const t=st.turn,o=[];
 if(st.over) return o;
 if(st.phase==='choose'){o.push({type:'mode',mode:'build'});o.push({type:'mode',mode:'exec'});}
 else if(st.phase==='draw'){o.push({type:'drawP'});o.push({type:'drawA'});}
 else if(st.phase==='build'){
  if(st.t.placedP===0&&st.t.placedA===0) for(const p of st.hand[t].P) for(const f of legalPlayerFields(st,t)) o.push({type:'placePlayer',p,f});
  if(st.t.placedP===0&&st.t.placedA<maxA(st)) for(const c of st.hand[t].A) for(const e of legalCardEdges(st,t)) o.push({type:'placeCard',c,e});
  o.push({type:'end'});}
 else if(st.phase==='move'){
  o.push({type:'skipMove'});
  const pay=Object.keys(st.edges).filter(e=>st.cards[st.edges[e].c].t===t);
  if(pay.length) for(const i of on2(st,t)) if(i!==st.ball.carrier) for(const f of nbrs(st.board[i])) if(canPlayer(st,t,f,true)) for(const e of pay) o.push({type:'move',p:i,f,pay:e});}
 else if(st.phase==='place'){
  for(const c of st.hand[t].A) for(const e of legalCardEdges(st,t)) o.push({type:'placeCard',c,e});
  if(!hasLegalPlace(st,t)) o.push({type:'skipPlace'});}
 else if(st.phase==='trigger'){
  for(const x of triggerOptions(st,t)) for(const tg of x.targets) o.push({type:'trigger',e:x.e,ex:x.ex,use:x.use,target:tg});
  o.push({type:'end'});}
 else if(st.phase==='taktik'){for(const c of st.hand[t].A) o.push({type:'discard',c});}
 return o;
}

function apply(st0,who,a){
 if(st0.over) throw new Error('Spiel beendet');
 if(who!==st0.turn) throw new Error('Nicht am Zug');
 const st=clone(st0), t=st.turn; st.last=null;
 const need=(c,m)=>{if(!c)throw new Error(m||'Nicht erlaubt');};
 switch(a.type){
  case 'mode':
   need(st.phase==='choose');
   if(a.mode==='build'){st.mode='build';st.phase='draw';st.log.push(`${NAME[t]} wählt Aufbauen.`);}
   else{st.mode='exec';const g=draw(st,t,'A',1);st.phase='move';st.log.push(`${NAME[t]} wählt Ausführen und zieht 1 Aktion.`);}
   break;
  case 'drawP': need(st.phase==='draw'); draw(st,t,'P',1); st.phase='build'; st.log.push(`${NAME[t]} zieht 1 Spieler.`); break;
  case 'drawA': need(st.phase==='draw'); draw(st,t,'A',2); st.phase='build'; st.log.push(`${NAME[t]} zieht 2 Aktionen.`); break;
  case 'placePlayer':
   need(st.phase==='build'&&st.t.placedP===0&&st.t.placedA===0&&st.hand[t].P.includes(a.p)&&canPlayer(st,t,a.f));
   st.hand[t].P=st.hand[t].P.filter(x=>x!==a.p); st.board[a.p]=a.f; st.t.placedP=1;
   st.log.push(`${NAME[t]} legt ${P(a.p).short} auf ${a.f}.`); enterField(st,a.p,a.f); break;
  case 'placeCard':
   need(st.hand[t].A.includes(a.c)&&canCard(st,t,a.e));
   if(st.phase==='build'){need(st.t.placedP===0&&st.t.placedA<maxA(st));st.t.placedA++;}
   else need(st.phase==='place');
   st.hand[t].A=st.hand[t].A.filter(x=>x!==a.c); st.edges[sk(a.e,t)]={c:a.c,open:false,used:false};
   st.log.push(`${NAME[t]} legt eine Karte verdeckt auf ${a.e}.`);
   if(st.phase==='place') st.phase='trigger';
   break;
  case 'skipMove': need(st.phase==='move'); st.phase=hasLegalPlace(st,t)?'place':'trigger'; if(st.phase==='trigger')st.log.push(`${NAME[t]} kann keine Karte legen.`); break;
  case 'move': {
   need(st.phase==='move'&&st.board[a.p]!=null&&P(a.p).team===t&&a.p!==st.ball.carrier&&nbrs(st.board[a.p]).includes(a.f)&&canPlayer(st,t,a.f,true)&&st.edges[a.pay]&&st.cards[st.edges[a.pay].c].t===t);
   const from=st.board[a.p], pc=st.edges[a.pay], pn=pc.open?cardName(st.cards[pc.c].n):'verdeckte Karte';
   discardEdge(st,a.pay); st.board[a.p]=a.f;
   st.log.push(`${NAME[t]} bewegt ${P(a.p).short} ${from} → ${a.f} und bezahlt mit ${pn} von ${edgeOf(a.pay)}.`);
   enterField(st,a.p,a.f); if(st.turn!==t) break;
   st.phase=hasLegalPlace(st,t)?'place':'trigger'; if(st.phase==='trigger')st.log.push(`${NAME[t]} kann keine Karte legen.`); break;}
  case 'skipPlace': need(st.phase==='place'&&!hasLegalPlace(st,t)); st.phase='trigger'; break;
  case 'trigger': {
   need(st.phase==='trigger'&&st.edges[a.e]&&!st.edges[a.e].used&&st.cards[st.edges[a.e].c].t===t&&st.board[a.ex]!=null&&edgeOf(a.e).split('/').includes(st.board[a.ex])&&P(a.ex).team===t);
   need(uses(st,st.edges[a.e].c,a.ex).includes(a.use)&&targets(st,a.use,a.ex,edgeOf(a.e)).includes(a.target),'Ziel nicht möglich');
   const before=st.score.B+st.score.L;
   trigger(st,t,a.e,a.ex,a.use,a.target);
   if(st.score.B+st.score.L>before) break; // Tor: Zugwechsel schon gesetzt
   break;}
  case 'discard': need(st.phase==='taktik'&&st.hand[t].A.includes(a.c)); st.hand[t].A=st.hand[t].A.filter(x=>x!==a.c); st.disc[t].A.push(a.c); st.phase='trigger'; st.log.push(`${NAME[t]} legt ${cardName(st.cards[a.c].n)} ab (Taktik).`); break;
  case 'end':
   need(st.phase==='build'||st.phase==='trigger');
   st.log.push(`${NAME[t]} beendet den Zug.`); st.turn=OPP[t]; st.phase='choose'; st.mode=null; st.t=freshT(); if(t==='L')st.turnNo++; break;
  case 'finish': st.over=true; st.log.push(`Spiel beendet. Endstand Blau ${st.score.B}:${st.score.L} Lila.`); break;
  case 'setting': st.settings[a.key]=a.value; st.log.push(`Einstellung: ${a.key==='oppField'?'Spieler auf Felder mit Gegenspieler legen '+(a.value?'erlaubt':'verboten'):a.key==='buildMany'?'Aufbauen: '+(a.value?'beliebig viele Aktionen legen':'bis zu 2 Aktionen legen'):a.key}.`); break;
  default: throw new Error('Unbekannte Aktion');
 }
 st.seq=(st0.seq||0)+1;
 return st;
}

/* ---------- einfacher Bot (zum Ausprobieren) ---------- */
function botAct(st){
 const o=options(st), t=st.turn;
 const pick=a=>a[Math.floor(Math.random()*a.length)];
 if(st.phase==='choose'){const m=(st.hand[t].A.length&&Math.random()<.55)?'exec':'build';return o.find(x=>x.mode===m);}
 if(st.phase==='draw') return o[st.hand[t].P.length?1:0];
 if(st.phase==='taktik') return o[0];
 if(st.phase==='trigger'){const tr=o.filter(x=>x.type==='trigger'&&(x.use==='Schuss'||x.use==='Tackling'||PASSES.includes(x.use)||DRIB.includes(x.use)));if(tr.length&&Math.random()<.8)return pick(tr);return o.find(x=>x.type==='end');}
 if(st.phase==='move') return o[0];
 if(st.phase==='place'){const c=o.filter(x=>x.type==='placeCard');return c.length?pick(c):o[0];}
 if(st.phase==='build'){const pp=o.filter(x=>x.type==='placePlayer'),pc=o.filter(x=>x.type==='placeCard');
  if(st.t.placedA<2&&pc.length&&Math.random()<.6)return pick(pc); if(pp.length&&!st.t.placedA)return pick(pp); return o.find(x=>x.type==='end');}
 return o[0];
}

const API={sk,edgeOf,teamOfKey,slotsAt,setData,newGame,apply,options,actor,botAct,triggerOptions,targets,uses,legalCardEdges,legalPlayerFields,canCard,canPlayer,edgesOf,nbrs,ekey,cardName,mods,shotPath,
 NAME,OPP,COLS,col,row,fid,inBox,get D(){return D;}};
if(typeof module!=='undefined'&&module.exports) module.exports=API; else root.FC=API;
})(typeof window!=='undefined'?window:this);
