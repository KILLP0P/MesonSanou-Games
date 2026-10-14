import Phaser from 'phaser';
import { state, getSession, placeBet, payWin, canBet, formatEuros } from '../state.js';
import { createHud, makeButton } from '../ui.js';

const NAME_POOL = ["Sam Houser", "Dan Houser", "Terry Donovan", "Jamie King", "Gary Foreman", "Claude", "Tommy Vercetti", "Carl Johnson", "Sweet Johnson", "Big Smoke", "Ryder", "Cesar Vialpando", "Catalina", "Ken Rosenberg", "Lance Vance", "Toni Cipriani", "Salvatore Leone", "Niko Bellic", "Roman Bellic", "Little Jacob", "Brucie Kibbutz", "Luis Lopez", "Johnny Klebitz", "Michael De Santa", "Franklin Clinton", "Trevor Philips", "Lamar Davis", "Lester Crest", "Chop", "Packie McReary", "Arthur Morgan", "John Marston", "Dutch van der Linde", "Hosea Matthews", "Sadie Adler", "Charles Smith", "Micah Bell", "Javier Escuella", "Bill Williamson", "Abigail Roberts", "Jack Marston", "Lenny Summers", "Sean MacGuire", "Uncle", "Leopold Strauss", "Jimmy Hopkins", "Gary Smith", "Pete Kowalski", "Max Payne", "Cole Phelps"];
const PROBS=[.24,.19,.15,.12,.10,.08,.07,.05];
const COLORS=[0xef476f,0x06d6a0,0x4cc9f0,0xffd166,0xc77dff,0xff9f1c,0xf28482,0xb7e4c7];
const BETS=[5,10,20,50,100,200,500,1000,5000,10000];
const HISTORY='horse-history-eight-v1', DECK='horse-names-deck-v1';
const X=245, END=780, Y=160, GAP=32;
const money=formatEuros;
const signed=n=>`${n>0?'+':''}${money(n)}`;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function roster(){
 let deck=read(DECK,[]);if(!Array.isArray(deck))deck=[];
 deck=[...new Set(deck.filter(n=>NAME_POOL.includes(n)))];
 const names=[];
 while(names.length<8){if(!deck.length)deck=shuffle(NAME_POOL.filter(n=>!names.includes(n)));const n=deck.shift();if(!names.includes(n))names.push(n);}
 localStorage.setItem(DECK,JSON.stringify(deck));
 const probs=shuffle(PROBS);
 return names.map((name,i)=>({name,color:COLORS[i],prob:probs[i],odds:Math.floor(.92/probs[i]*100)/100}));
}
function orderFor(horses,forced=null){
 const remaining=horses.map((_,i)=>i),result=[];
 if(forced!==null){result.push(forced);remaining.splice(remaining.indexOf(forced),1);}
 while(remaining.length){let r=Math.random()*remaining.reduce((s,i)=>s+horses[i].prob,0);let index=remaining.length-1;
 for(let k=0;k<remaining.length;k++){r-=horses[remaining[k]].prob;if(r<=0){index=k;break;}}
 result.push(remaining.splice(index,1)[0]);}return result;
}

export default class HorseRaceScene extends Phaser.Scene {
 constructor(){super('HorseRaceScene');}
 create(){
  this.phase='idle';this.selected=0;this.betIndex=3;this.horses=roster();this.runners=[];this.modal=null;
  this.audio=null;this.startAudio=null;this.fallback=null;this.startedAt=Date.now();this.races=0;this.muted=false;
  createHud(this,'Carrera de caballos');this.buildTrack();this.buildUI();this.refresh();
  const key=()=>{if(this.phase==='idle'&&!this.modal)this.begin();};
  this.input.keyboard?.on('keydown-SPACE',key);
  this.events.once('shutdown',()=>{this.stopAudio();if(this.fallback)this.fallback.remove(false);this.input.keyboard?.off('keydown-SPACE',key);});
 }
 text(x,y,value,size=18,color='#ffffff'){
  return this.add.text(x,y,value,{fontFamily:'Arial',fontSize:`${size}px`,color,fontStyle:'bold',align:'center'}).setOrigin(.5);
 }
 button(x,y,width,label,fn,color='#457b9d',size=15){return makeButton(this,x,y,width,35,label,color,fn,size);}
 get bet(){return BETS[this.betIndex];}
 buildTrack(){
  this.add.rectangle(480,310,960,540,0x102b26);
  this.text(480,65,'ROCKSTAR DERBY · 8 CABALLOS',27,'#ffd166');
  this.add.rectangle(480,120,950,48,0x294452);
  for(let i=0;i<65;i++)this.add.circle(14+i*14.5,110+(i%3)*9,3,COLORS[i%8]);
  this.add.rectangle(480,143,950,4,0xf4e5bc);
  this.horses.forEach((h,i)=>{
   const y=Y+i*GAP;
   const lane=this.add.rectangle(480,y+8,940,31,i%2?0x967047:0x87623c).setStrokeStyle(1,0xc09a65);
   const label=this.text(112,y,`${i+1}. ${h.name} · ×${h.odds.toFixed(2)}`,11);
   const hit=this.add.rectangle(112,y+5,218,30,0x000000,.001).setInteractive({useHandCursor:true});
   hit.on('pointerdown',()=>{if(this.phase==='idle'&&!this.modal){this.selected=i;this.refresh();}});
   const gate=this.add.rectangle(X-28,y,5,28,0xd7e0ea);
   const horse=this.makeHorse(X,y,h.color,i);
   this.runners.push({lane,label,gate,horse,progress:0,rank:i});
  });
  for(let r=0;r<16;r++)for(let c=0;c<2;c++)this.add.rectangle(END+28+c*7,148+r*16,7,16,(r+c)%2?0xffffff:0x111111);
  this.text(END+34,134,'META',12,'#ffd166');
  this.ranking=this.text(887,271,'',12);
  this.add.rectangle(480,425,950,4,0xf4e5bc);
 }
 makeHorse(x,y,color,index){
  const root=this.add.container(x,y).setScale(.62),legs=[];
  root.add(this.add.ellipse(0,27,66,12,0x000000,.25));
  for(const lx of [-19,-10,13,21]){const leg=this.add.rectangle(lx,6,5,26,0x3a2215).setOrigin(.5,0);root.add(leg);legs.push(leg);}
  root.add([
   this.add.rectangle(-31,-4,7,26,0x2b1811).setAngle(30),
   this.add.ellipse(-2,-1,62,30,0x9b5a2e),
   this.add.rectangle(22,-14,17,33,0x9b5a2e).setAngle(25),
   this.add.ellipse(34,-30,29,16,0x9b5a2e),
   this.add.triangle(28,-40,0,10,4,0,9,10,0x6b3b21),
   this.add.circle(38,-33,2,0x111111),
   this.add.rectangle(-3,-12,24,9,color),
   this.add.rectangle(-4,-24,12,21,color).setAngle(-25),
   this.add.circle(3,-39,6,0xf5c7a0),this.add.ellipse(3,-43,15,9,color),
   this.text(-4,-3,String(index+1),12)
  ]);return{root,legs,y};
 }
 buildUI(){
  this.info=this.text(480,450,'Elige un caballo y tu apuesta',17,'#ffd166');
  this.betText=this.text(125,493,'',21,'#ffd166');
  this.button(40,493,45,'−',()=>this.changeBet(-1));this.button(210,493,45,'+',()=>this.changeBet(1));
  this.startButton=this.button(380,493,260,'APOSTAR Y CORRER',()=>this.begin(),'#2a9d8f',17);
  this.button(640,493,180,'HISTORIAL',()=>this.showHistory());
  this.button(850,493,150,'VOLVER',()=>this.exitSummary());
  this.selectionText=this.text(325,540,'',14,'#cccccc');
  this.button(665,540,90,'REGLAS',()=>this.rules(),'#465b78',12);
  this.soundButton=this.button(770,540,105,'SONIDO ON',()=>this.toggleSound(),'#465b78',12);
  this.button(885,540,90,'ADMIN',()=>this.admin(),'#713c65',12);
  this.countdown=this.text(480,270,'',54,'#ffd166').setDepth(70);
 }
 changeBet(d){if(this.phase!=='idle'||this.modal)return;this.betIndex=Phaser.Math.Clamp(this.betIndex+d,0,BETS.length-1);this.refresh();}
 refresh(){
  this.betText.setText(money(this.bet));const h=this.horses[this.selected];
  this.selectionText.setText(`${h.name} · ${Math.round(h.prob*100)}% · Premio bruto ${money(Math.round(this.bet*h.odds))}`);
  this.runners.forEach((r,i)=>r.lane.setStrokeStyle(i===this.selected?3:1,i===this.selected?0xffd166:0xc09a65));
  this.startButton.list[1].setText(this.phase==='idle'?'APOSTAR Y CORRER':'CARRERA EN CURSO');
  this.ranking.setText('POSICIONES\n\n'+[...this.runners].sort((a,b)=>a.rank-b.rank).map((r,i)=>`${i+1}. ${this.horses[this.runners.indexOf(r)].name}`).join('\n'));
 }
 rotate(){
  this.horses=roster();this.runners.forEach((r,i)=>{
   r.horse.root.destroy(true);r.horse=this.makeHorse(X,Y+i*GAP,this.horses[i].color,i);r.progress=0;r.rank=i;r.gate.setAlpha(1);
   r.label.setText(`${i+1}. ${this.horses[i].name} · ×${this.horses[i].odds.toFixed(2)}`);
  });this.info.setText('Nueva carrera · 8 nombres seleccionados del listado de 50');this.refresh();
 }
 toggleSound(){this.muted=!this.muted;this.soundButton.list[1].setText(this.muted?'SONIDO OFF':'SONIDO ON');if(this.audio)this.audio.muted=this.muted;if(this.startAudio)this.startAudio.muted=this.muted;}
 stopAudio(){
  if(this.startAudio){this.startAudio.onended=null;this.startAudio.onerror=null;this.startAudio.pause();this.startAudio=null;}
  if(this.audio){this.audio.pause();this.audio.currentTime=0;this.audio=null;}
 }
 playAudio(name,loop=false,volume=.6){
  if(this.audio)this.audio.pause();
  const a=new Audio(`${import.meta.env.BASE_URL}sfx/${name}`);a.loop=loop;a.volume=volume;a.muted=this.muted;this.audio=a;
  a.play().catch(e=>console.warn(`No se pudo reproducir ${name}`,e));return a;
 }
 begin(forced=null,test=false){
  if(this.phase!=='idle'||this.modal)return;
  if(!test&&!canBet(this.bet)){this.info.setText('Saldo insuficiente. Recarga en el menú principal.');return;}
  this.test=test;this.currentBet=this.bet;this.currentSelection=this.selected;this.beforeBalance=state.balance;
  this.order=orderFor(this.horses,forced);this.elapsed=0;this.slow=false;this.phase='starting';
  this.paths=this.horses.map((_,i)=>({duration:10000+this.order.indexOf(i)*450+Math.random()*100,previous:0,phase:Math.random()*6.28,frequency:1.5+Math.random(),amplitude:.12+Math.random()*.08}));
  this.runners.forEach((r,i)=>{r.progress=0;r.rank=i;r.horse.root.x=X;r.horse.root.y=r.horse.y;r.gate.setAlpha(1);});
  if(!test)placeBet(this.currentBet);
  this.info.setText(test?'ADMIN · prueba sin cambios de saldo':'Apuesta aceptada · esperando a que termine start.mp3');
  this.countdown.setText('PREPARADOS');this.refresh();this.playStart();
 }
 playStart(){
  this.stopAudio();let launched=false;
  const a=new Audio(`${import.meta.env.BASE_URL}sfx/start.mp3`);a.volume=.7;a.muted=this.muted;this.startAudio=a;
  const launch=()=>{
   if(launched||this.phase!=='starting'||!this.sys.isActive())return;launched=true;
   if(this.fallback){this.fallback.remove(false);this.fallback=null;}
   a.onended=null;a.onerror=null;a.pause();this.startAudio=null;
   this.countdown.setText('¡SALIDA!');this.time.delayedCall(450,()=>this.countdown.setText(''));
   this.phase='racing';this.elapsed=0;this.playAudio('horse.mp3',true,.45);
   this.runners.forEach(r=>this.tweens.add({targets:r.gate,alpha:0,duration:150}));
   this.info.setText(this.test?'ADMIN · Carrera de prueba':'¡Carrera en marcha!');
  };
  const fallback=()=>{if(launched||this.fallback)return;this.info.setText('start.mp3 no disponible · salida silenciosa en 3 segundos');this.fallback=this.time.delayedCall(3000,launch);};
  a.onended=launch;a.onerror=fallback;a.play().catch(fallback);
 }
 update(time,delta){
  if(this.phase!=='racing')return;
  const finishTime=this.paths[this.order[0]].duration;const slow=this.elapsed>=finishTime*.88;
  this.elapsed+=Math.min(delta,60)*(slow ? 0.4 : 1);
  if(slow&&!this.slow){this.slow=true;this.info.setText('¡RECTA FINAL! · CÁMARA LENTA');}
  this.paths.forEach((p,i)=>{
   const u=Math.min(1,this.elapsed/p.duration),taper=u<.72?1:Math.max(0,(.94-u)/.22);
   const wave=p.amplitude*Math.sin(u*6.28*p.frequency+p.phase)*4*u*(1-u)*taper;
   const progress=Math.max(p.previous,Math.min(u>=1?1:.995,u+wave));p.previous=progress;
   const r=this.runners[i];r.progress=progress;r.horse.root.x=X+(END-X)*progress;
   const phase=this.elapsed/85+i;r.horse.root.y=r.horse.y+Math.sin(phase*2)*1.5;
   r.horse.legs.forEach((leg,j)=>leg.setAngle(Math.sin(phase+j*Math.PI/2)*32));
  });
  [...this.runners].sort((a,b)=>b.progress-a.progress).forEach((r,i)=>r.rank=i);this.refresh();
  if(this.elapsed>=finishTime){this.phase='finished';this.finish();}
 }
 finish(){
  this.stopAudio();const winner=this.order[0],won=winner===this.currentSelection;
  const prize=won?Math.round(this.currentBet*this.horses[winner].odds):0;
  if(prize&&!this.test)payWin(prize);
  this.playAudio(won?'777.mp3':'fail.mp3',false,.65);
  const record={date:Date.now(),selected:this.horses[this.currentSelection].name,winner:this.horses[winner].name,
   order:this.order.map(i=>this.horses[i].name),bet:this.currentBet,prize,net:prize-this.currentBet,startBalance:this.beforeBalance,endBalance:state.balance};
  this.runners.forEach((r,i)=>{const rank=this.order.indexOf(i);r.rank=rank;r.horse.legs.forEach(l=>l.setAngle(0));this.tweens.add({targets:r.horse.root,x:END-rank*18,y:r.horse.y,duration:600});});
  if(!this.test){let h=read(HISTORY,[]);if(!Array.isArray(h))h=[];h.unshift(record);localStorage.setItem(HISTORY,JSON.stringify(h.slice(0,50)));this.races++;}
  this.info.setText(`Ganó ${record.winner} · Cobrado ${money(prize)} · Neto ${signed(record.net)}`);this.refresh();
  this.time.delayedCall(850,()=>this.result(record));
 }
 open(title){
  if(this.modal)return null;const root=this.add.container(0,0).setDepth(200);
  root.add(this.add.rectangle(480,310,960,620,0x000000,.95).setInteractive());
  root.add(this.add.rectangle(480,310,930,570,0x13202b).setStrokeStyle(3,0xffd166));
  root.add(this.text(480,60,title,26,'#ffd166'));
  const m={root,close:()=>{root.destroy(true);if(this.modal===m)this.modal=null;}};this.modal=m;return m;
 }
 mt(m,x,y,t,size=20,color='#ffffff'){const o=this.text(x,y,t,size,color);m.root.add(o);return o;}
 mb(m,x,y,w,t,fn,color='#457b9d'){const b=this.button(x,y,w,t,fn,color);m.root.add(b);return b;}
 result(r){
  const m=this.open(this.test?'ADMIN · RESULTADO NO CONTABILIZADO':'RESULTADO DE LA CARRERA');if(!m)return;
  this.mt(m,480,105,`GANADOR: ${r.winner}`,27,'#ffd166');
  this.mt(m,480,220,r.order.map((n,i)=>`${i+1}. ${n}`).join('\n'),17);
  this.mt(m,480,340,`PREMIO COBRADO: ${money(r.prize)}`,30,r.prize?'#7CFC00':'#cccccc');
  this.mt(m,480,390,`Apuesta ${money(r.bet)} · Neto ${signed(r.net)}`,23,r.net>0?'#7CFC00':'#ff6b6b');
  this.mt(m,480,440,this.test?'Saldo y estadísticas sin cambios.':`Crédito actual: ${money(state.balance)}`,18);
  this.mb(m,480,520,260,'CONTINUAR',()=>{this.stopAudio();m.close();this.phase='idle';this.test=false;this.rotate();},'#2a9d8f');
 }
 showHistory(){
  if(this.phase!=='idle'||this.modal)return;const m=this.open('ÚLTIMAS 50 CARRERAS');let page=0,layer;
  const draw=()=>{if(layer)layer.destroy(true);layer=this.add.container(0,0);m.root.add(layer);
   let h=read(HISTORY,[]);if(!Array.isArray(h))h=[];const pages=Math.max(1,Math.ceil(h.length/6));page=Phaser.Math.Clamp(page,0,pages-1);
   if(!h.length)layer.add(this.text(480,270,'Todavía no hay carreras guardadas.',22));
   h.slice(page*6,page*6+6).forEach((r,i)=>{const date=new Date(r.date).toLocaleTimeString('es-ES');layer.add(this.text(480,130+i*57,`${date} · Elegido ${r.selected} · Ganó ${r.winner}\nApuesta ${money(r.bet)} · Premio ${money(r.prize)} · Neto ${signed(r.net)} · Saldo ${money(r.endBalance)}`,15,r.net>0?'#7CFC00':'#cccccc'));});
   layer.add(this.text(480,500,`Página ${page+1}/${pages}`,17));};
  this.mb(m,270,500,150,'ANTERIOR',()=>{page--;draw();});this.mb(m,690,500,150,'SIGUIENTE',()=>{page++;draw();});this.mb(m,480,550,220,'CERRAR',()=>m.close());draw();
 }
 rules(){
  if(this.phase!=='idle'||this.modal)return;const m=this.open('REGLAS · APUESTA A GANADOR');
  this.mt(m,480,115,'8 nombres distintos por carrera, de un listado rotativo de 50.\nLas probabilidades se asignan de nuevo en cada carrera.',18);
  this.mt(m,480,280,this.horses.map(h=>`${h.name} · ${Math.round(h.prob*100)}% · cuota ×${h.odds.toFixed(2)}`).join('\n'),20,'#ffd166');
  this.mt(m,480,435,'El ganador se sortea antes de animar. El premio incluye la apuesta.\nNo se cambia la apuesta tras la salida. ADMIN no altera el saldo.\nstart.mp3 termina antes de la salida; horse.mp3 acompaña la carrera.',17,'#cccccc');
  this.mb(m,480,535,240,'CERRAR',()=>m.close());
 }
 exitSummary(){
  if(this.phase!=='idle'||this.modal)return;const m=this.open('RESUMEN DE SESIÓN'),s=getSession();
  const seconds=Math.floor((Date.now()-this.startedAt)/1000),w=s?.wagered||0,p=s?.won||0;
  this.mt(m,480,155,`Duración ${Math.floor(seconds/60)} min ${seconds%60} s · ${this.races} carreras`,23);
  this.mt(m,480,260,`Apostado ${money(w)}\nPremios cobrados ${money(p)}`,28,'#ffd166');
  this.mt(m,480,360,`RESULTADO NETO: ${signed(p-w)}`,30,p>w?'#7CFC00':'#ff6b6b');
  this.mt(m,480,425,`Crédito actual ${money(state.balance)}`,22);
  this.mb(m,290,520,300,'SEGUIR JUGANDO',()=>m.close(),'#2a9d8f');
  this.mb(m,670,520,300,'SALIR Y GUARDAR',()=>{this.stopAudio();m.close();this.scene.start('MenuScene');});
 }
 admin(){
  if(this.phase!=='idle'||this.modal)return;if(window.prompt('ADMIN · Código')!=='280816')return;
  const m=this.open('ADMIN · 8 GANADORES DE PRUEBA');
  this.mt(m,480,115,'Sin cobrar apuestas, sin pagos y sin historial.\nLos sonidos se reproducen igual que en una carrera normal.',18,'#ff9f1c');
  this.horses.forEach((h,i)=>this.mb(m,i%2?700:260,205+Math.floor(i/2)*70,410,`${i+1}. ${h.name}`,()=>{m.close();this.begin(i,true);},'#713c65'));
  this.mb(m,480,540,230,'CERRAR',()=>m.close());
 }
}
