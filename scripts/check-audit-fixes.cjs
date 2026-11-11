const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const engine=require('./test-engine.cjs'),key='dongda-mvp-v1';
const clone=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const project=(s,extra={})=>({id:s.uid++,reg:'home',line:'fj',name:'测试工程',ck:'soe',dev:null,V:1200,C:1000,dur:10,done:0,elapsed:0,pm:s.pms[0].id,cost:0,billed:0,claimed:0,advLeft:0,stopFor:0,...extra});

test('01–02 import rejects executable text and unknown/invalid events without changing state',async()=>{
  const e=engine(),{g}=e;g.save();const raw=e.store.get(key),original=g.S;
  for(const change of [s=>s.cn='<img src=x onerror=alert(1)>',s=>s.queue=[{type:'unknown'}],s=>s.pms=[null],s=>s.pms[0].sal='bad',s=>s.queue=[{type:'cert',c:{line:'fj',lv:100,t:0,no:'x'}}],s=>s.recv=[{id:999,ck:'unknown',name:'x',amount:1,due:1}],s=>s.queue=[{type:'pdec',pid:1,k:'unknown',v:1,x:.1,fine:1}]]){
    const s=clone(original);change(s);await g.readJSON({text:async()=>JSON.stringify(s)});assert.equal(g.S,original);assert.equal(e.store.get(key),raw);assert.ok(e.get('#bk-msg').textContent.includes('无法识别'));
  }
  assert.ok(!g.certHTML({line:'fj',lv:0,t:0,no:'<img>'}).includes('<img>'));
});
test('02 stored unknown events are recoverable and never create an empty dialog',()=>{
  const e=engine(),s=clone(e.g.S);s.queue=[{type:'unknown'}];e.store.set(key,JSON.stringify(s));const loaded=e.g.load();assert.equal(loaded.queue[0].type,'recovery');assert.ok(e.store.has(key+'-before-import'));e.g.S=loaded;e.g.renderModal();assert.match(e.get('#modal').innerHTML,/查看存档/);e.g.choose('ok');assert.equal(e.g.S.queue.length,0);
});
test('03 failed auto-save remains visible and retry preserves the current progress',()=>{
  const e=engine(),{g}=e;assert.equal(g.save(),true);e.failWrites(true);g.act('borrow',{dataset:{v:100}});assert.equal(g.S.cash,1000);assert.equal(JSON.parse(e.store.get(key)).cash,900);assert.equal(g.UI.unsaved,true);assert.equal(e.get('#save-status').hidden,false);e.failWrites(false);assert.equal(g.save(),true);assert.equal(g.UI.unsaved,false);assert.equal(JSON.parse(e.store.get(key)).cash,1000);
});
test('01–03 successful import keeps a rollback copy, failed writes preserve auto and manual saves',async()=>{
  const e=engine(),{g}=e;g.save();const raw=e.store.get(key),candidate=clone(g.S);candidate.t=2;candidate.cash=850;e.store.set('dongda-slot-1','manual');await g.readJSON({text:async()=>JSON.stringify(candidate)});assert.equal(g.S.t,2);assert.equal(e.store.get(key+'-before-import'),raw);assert.equal(e.store.get('dongda-slot-1'),'manual');
  const now=e.store.get(key);e.failWrites(true);await g.readJSON({text:async()=>raw});assert.equal(g.S.t,2);assert.equal(e.store.get(key),now);assert.equal(g.loadState(JSON.parse(raw),'手动档'),false);assert.equal(g.S.t,2);
});
test('04,08,09 project revenue and cost reconcile after extensions, additions, locks and delays',()=>{
  const e=engine(),{g}=e,s=g.S,p=project(s,{done:8,elapsed:8,cost:800,billed:960,claimed:816});s.projects=[p];s.year.rev=960;s.year.cost=800;e.random(.5);const remaining=g.planCost(p)*2;
  g.doPdec({pid:p.id,k:'noise'},'a');near(g.planCost(p)*3,remaining);
  g.doPdec({pid:p.id,k:'sub',x:.05},'a');near(g.planCost(p)*3,remaining*1.05);
  const before=p.cost;g.doPdec({pid:p.id,k:'mat'},'a');near(p.cost-before,remaining*1.05*.01);
  for(let i=0;i<3;i++)g.tickProject(p);near(s.year.rev,1200);near(p.billed,1200);near(p.cost,800+remaining*1.05*1.01);near(s.year.cost,p.cost);assert.equal(s.projects.length,0);
  const q=project(s);s.projects=[q];s.year.rev=0;g.doPdec({pid:q.id,k:'add',v:120},'a');while(s.projects.length)g.tickProject(q);near(s.year.rev,q.V);
});
test('04 forecast and actual progress use the same remaining work after a stopped month',()=>{
  const e=engine(),{g}=e,s=g.S,p=project(s,{dur:4,stopFor:1});s.projects=[p];e.random(.5);const before=g.planCost(p),flow=g.projectCF(p);g.tickProject(p);near(p.cost,before*.2);assert.equal(p.done,0);near(g.planCost(p),before);near(flow.detail.out[0],p.cost);
});
test('05 existing project forecasts include future invoices, commercial paper and final settlements',()=>{
  const e=engine(),{g}=e,s=g.S,p=project(s,{ck:'gov',done:1,elapsed:1,billed:120,claimed:96});s.projects=[p];assert.ok(g.forecast().slice(3).some(f=>f.inf>0));const before=JSON.stringify(p);g.forecast();assert.equal(JSON.stringify(p),before);
  const d=s.devs[0];d.h=.6;const T={ck:'dev',reg:'home',line:'fj',dev:d.id,V:1200,est:1000,dur:10};const cf=g.hypo(T,1,s.pms[0].id);near(cf.detail.inf[2],51);near(cf.detail.inf[0],0);
  const finishedSoon=project(s,{ck:'gov',dur:2,done:1,billed:600,claimed:480});const final=g.projectCF(finishedSoon);assert.ok(final.detail.inf[4]>0,'settlement must be scheduled');
});
test('06,10 manual costs enter monthly profit, current tax is accrued once and not charged twice on payment',()=>{
  const e=engine(),{g}=e,s=g.S;g.act('hire',{dataset:{id:s.pmMarket[0].id}});e.random(.5);g.advance();near(s.mProf,g.yNet(s.year));near(g.prof12(),s.mProf*12);
  const f=engine(),q=f.g.S;q.cash=100000;q.year.rev=1200;q.year.cost=1000;q.t=11;f.random(.5);near(f.g.net(),100000-50);f.g.advance();const tax=q.taxDue.reduce((a,x)=>a+x.a,0);near(f.g.net(),q.cash-tax);near(q.years[0].prof,f.g.yNet({rev:1200,cost:1000,ovh:6,int:0,other:0,sub:0}));q.queue=[];const oldNet=f.g.net();f.g.advance();assert.ok(f.g.net()<oldNet);near(q.taxDue.reduce((a,x)=>a+x.a,0),tax*.75);
});
test('07 every open region retains a tender after expanding nationally and overseas',()=>{
  const e=engine(),{g}=e,s=g.S;const regions=['home','prov','nw','cy','jjj','yrd','gba','me','af','sea'];s.t=60;s.cash=1e6;s.qual=s.mq=3;s.regions=Object.fromEntries(regions.map(k=>[k,1]));s.tenders=[];e.random(.5);for(let i=0;i<12;i++){g.advance();for(const k of regions)assert.ok(s.tenders.some(t=>t.reg===k),k);s.queue=[];}
});
test('11 forced property disposal records the loss in annual profit',()=>{
  const e=engine(),s=e.g.S;s.cash=-10;s.loan=10000;s.props=[{id:s.uid++,name:'抵债房',book:100}];e.random(.5);e.g.advance();assert.equal(s.props.length,0);assert.ok(s.year.other< -19&&s.year.other> -22);
});
test('12–13 first-month milestones and completed landmarks survive save migration',()=>{
  const e=engine(),{g}=e,s=g.S,T=s.tenders.find(t=>t.line==='fj');e.random(0);g.resolveBid({T,pm:s.pms[0].id,ratio:.8,bond:T.V*.02});g.checkAch();assert.equal(s.ms.win1,0);assert.equal(s.ach.win1,0);
  s.projects=[];const p=project(s,{name:'江州中心（420米超高层）',lm:true,done:10,elapsed:10,billed:1200,claimed:1000});s.projects=[p];g.complete(p);assert.equal(s.doneList[0].lm,true);assert.match(g.skylineHTML(),/class="sk-lm"/);const old=clone(s);delete old.doneList[0].lm;assert.equal(g.prepareState(old).doneList[0].lm,true);
  const f=engine(),T0=f.g.S.tenders.find(t=>t.line==='fj');f.random(0);f.g.UI.open=T0.id;f.g.UI.pm=f.g.S.pms[0].id;f.g.UI.ratio=.8;f.g.act('submit');f.g.advance();assert.equal(f.g.S.ach.win1,0);assert.equal(f.g.S.chron.find(x=>x.x.includes('达成成就「开门红」')).t,0);
});
test('15–17 first-month document dates, opening tender guarantee and PPP wording',()=>{
  const e=engine(),{g}=e;g.S.t=1;assert.match(g.noticeHTML({n:'测试',t:0,V:900,r:.9,reg:'home'},0),/<br>2026年1月/);assert.match(g.payTerm({ck:'gov',kind:'ppp'}),/^40%/);
  for(let i=1;i<=2000;i++){g.newGame('pri','std','now');assert.ok(g.S.tenders.some(t=>!g.isLocked(t)&&g.S.pms.some(p=>p.busy==null&&p.skill>=g.minSkill(t))&&t.V*.02<=g.S.cash));}
});
test('18–23 recovery entry, starting performance and municipal art match their meaning',()=>{
  const e=engine(),{g}=e;g.S.queue=[{type:'setup'}];g.renderModal();assert.match(e.get('#modal').innerHTML,/从 JSON 恢复/);assert.equal(g.S.doneList[0].count,1);assert.match(g.S.doneList[0].name,/1项/);assert.equal(g.kindOf('产业园市政基础设施','sz'),'pipe');assert.equal(g.kindOf('污水处理厂扩建','sz'),'water');g.S.queue=[];g.renderMap();assert.match(e.get('#map-access').innerHTML,/省内地市/);
});
test('legacy v5 checkpoint loads, preserves money and continues; synthetic v1–v4 still migrate',()=>{
  const e=engine(),{g}=e;
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-v5-year-24.json'),'utf8')),loaded=g.prepareState(old);assert.equal(loaded.cash,old.cash);assert.equal(loaded.loan,old.loan);assert.equal(loaded.t,24);g.S=loaded;g.advance();assert.equal(loaded.t,25);
  for(const v of [1,2,3,4]){const s=clone(engine(v).g.S);s.v=v;for(const k of ['monthBase','certs','tut','era','cn'])delete s[k];
    if(v<=4)for(const k of ['bg','dk','ppps'])delete s[k];
    if(v<=3){for(const k of ['macro','subs','subInv'])delete s[k];delete s.year.sub;for(const p of s.pms.concat(s.pmMarket))delete p.tr;}
    if(v<=2){for(const k of ['regions','ms','chron','awards','lms','pipe','lmCount','years','ipo','ach','maxV','regPerf','yMin','mRev','mProf'])delete s[k];for(const t of s.tenders)delete t.reg;}
    if(v===1){for(const k of ['mq','mPerfSum','mPerfCount','rivals','deadRiv'])delete s[k];for(const t of s.tenders){delete t.line;delete t.rivals;}}
    const migrated=g.prepareState(s);assert.equal(migrated.v,5);assert.equal(migrated.cash,s.cash);}
});

test('on-time delivery helps credit recover below 70 and respects both reward boundaries',()=>{
  for(const [credit,reward] of [[60,3],[69.9,3],[70,2],[84.9,2],[85,1]]){
    const {g}=engine(),s=g.S;
    s.rep=credit;
    const p=project(s,{dur:4,done:4,elapsed:4,billed:1200,pm:null});
    s.projects=[p];
    g.complete(p);
    near(s.rep,credit+reward);
    assert.ok(s.log.some(entry=>entry.x.includes(`按期交付 信用分+${reward}`)));
  }
});

test('only a one-month rain delay receives the lower penalty, including after loading a save',()=>{
  const scenarios=[
    {rain:1,other:0,oldDelay:0,penalty:1},
    {rain:2,other:0,oldDelay:0,penalty:3},
    {rain:1,other:1,oldDelay:0,penalty:3},
    {rain:0,other:0,oldDelay:1,penalty:2},
  ];
  for(const {rain,other,oldDelay,penalty} of scenarios){
    const e=engine(),{g}=e,s=g.S;
    const p=project(s,{dur:4,done:3,elapsed:3+oldDelay,billed:900,pm:null,stopFor:other});
    s.projects=[p];
    e.random(.01);
    for(let month=0;month<rain+other;month++)g.tickProject(p);
    g.S=g.prepareState(s);
    e.random(.5);
    g.tickProject(g.S.projects[0]);
    assert.equal(g.S.rep,70-penalty);
    assert.ok(g.S.log.some(entry=>entry.x.includes(`信用分-${penalty}`)));
    assert.equal(g.S.projects.length,0);
  }
});

test('a major accident still deducts 10 immediately and two months of non-weather delay deduct 3 more',()=>{
  const e=engine(),{g}=e,s=g.S;
  const pm=s.pms[0];
  pm.skill=4;
  pm.tr=null;
  const p=project(s,{dur:4,done:2,elapsed:2,billed:600});
  s.projects=[p];
  e.random(.11);
  g.tickProject(p);
  assert.equal(s.rep,60);
  assert.equal(p.stopFor,2);
  e.random(.5);
  for(let month=0;month<3;month++)g.tickProject(p);
  assert.equal(s.rep,57);
  assert.equal(s.projects.length,0);
});

test('the displayed credit does not round into an unmet landmark tender requirement',()=>{
  const {g}=engine(),s=g.S;
  const tender={reg:'home',line:'fj',needQ:0,repReq:72};
  for(const [credit,display,locked] of [[71.6,'71.6',true],[71.99,'71.9',true],[72,'72.0',false]]){
    s.rep=credit;
    assert.equal(g.formatCredit(),display);
    assert.equal(Boolean(g.isLocked(tender)),locked);
  }
});
