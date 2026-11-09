const G=require('./load.cjs');
const UI=G.UI;
function bestRatio(T,pmId,targetP,minGm){let best=null;
  for(let r=1;r>=0.8;r-=0.005){const c=G.bidCalc(T,r,pmId);if(c.P>=targetP){if(c.gm>=minGm)best={r,c};break;}}
  return best;}
// peak working capital estimate for a project of value V
const wcNeed=V=>0.4*V;
function play(opts,months=120,seed){
  const {bg='pri',dk='std',era='now',policy='naive',targetP=.4,minGm=.08}=opts;
  G.newGame(bg,dk,era);const S=()=>G.S;
  const st={over:false,t:null,bail:null,tax:0,boom:0,boomN:0,lossProj:0,projN:0,maxMat:100,pl:{},peakBids:0,causes:[]};
  for(let m=0;m<months;m++){
    const s=S();
    // upgrades
    for(const l of ['fj','sz'])G.upgrade(l);
    // hire if all busy
    const free=()=>s.pms.filter(p=>p.busy==null);
    if(!free().length&&s.pmMarket.length&&s.cash>(policy==='naive'?300:1500)){const c=s.pmMarket.sort((a,b)=>b.skill-a.skill)[0];G.act('hire',{dataset:{id:c.id}});}
    // bid
    let committed=0;
    const tenders=s.tenders.slice().sort((a,b)=>b.V-a.V);
    for(const T of tenders){
      if(G.isLocked(T))continue;
      const pm=free().filter(p=>p.skill>=G.minSkill(T)).sort((a,b)=>a.skill-b.skill)[0];if(!pm)continue;
      const b=bestRatio(T,pm.id,targetP,minGm);if(!b)continue;
      if(policy==='cautious'){
        const fc=G.forecast();const minC=Math.min(...fc.map(f=>f.c));
        const room=minC+(G.limit()-s.loan);
        if(room-committed-wcNeed(T.V)*b.c.P<300)continue;
      }
      if(policy==='ui'){const F=G.forecast(G.hypo(T,b.r,pm.id));const mn=Math.min(...F.map(f=>f.c));if(mn+Math.max(0,G.limit()-s.loan)<0)continue;}
      if(s.cash<T.V*.02)continue;
      UI.open=T.id;UI.pm=pm.id;UI.ratio=b.r;G.act('submit');committed+=wcNeed(T.V)*b.c.P;
    }
    st.peakBids=Math.max(st.peakBids,s.bids.length);
    const cash0=s.cash,y0=s.t%12===11;
    const projBefore=new Map(s.projects.map(p=>[p.id,p]));
    const yb={...s.year};const K=['rev','cost','ovh','int','other','sub'];
    G.advance();
    {const s3=S();const rep=s3.queue.find(q=>q.type==='report');const ya=rep?rep.y:s3.year;for(const k of K)st.pl[k]=(st.pl[k]||0)+((ya[k]||0)-(yb[k]||0));if(rep)st.pl.tax=(st.pl.tax||0)+(rep.y.tax||0);st.pl.m=(st.pl.m||0)+1;}
    const s2=S();
    // drain queue
    let guard=0;
    while(s2.queue.length&&guard++<50){const e=s2.queue[0];
      if(e.type==='over'){st.over=true;st.t=s2.t;break;}
      if(e.type==='boom'){st.boom+=e.amount;st.boomN++;}
      const opt={boom:'a',rush:'a',pdec:'a',poach:'a',acquire:'b'}[e.type]||'a';
      G.choose(opt);}
    if(st.over){st.log=s2.log.slice(0,25).map(x=>x.x);break;}
    if(s2.bail!=null&&st.bail==null)st.bail=s2.bail;
    st.maxMat=Math.max(st.maxMat,s2.mat);
  }
  const s=S();
  st.qual=s.qual;st.net=G.net();st.cash=s.cash;st.loan=s.loan;st.t=st.t??s.t;
  st.lossProj=s.doneList.filter(d=>d.gm!=null&&d.gm<0).length;st.projN=s.doneList.filter(d=>d.gm!=null).length;
  st.avgGm=s.doneList.filter(d=>d.gm!=null).reduce((a,d)=>a+d.gm,0)/Math.max(1,st.projN);
  st.years=s.years.map(y=>Math.round(y.prof));
  return st;
}
module.exports={play,G};
if(require.main===module){
  const N=+process.argv[2]||300;const cfgs=JSON.parse(process.argv[3]||'[{"policy":"naive"},{"policy":"cautious"}]');const M=+process.argv[4]||120;
  for(const c of cfgs){const R=[];for(let i=0;i<N;i++)R.push(play(c,M));
    const over=R.filter(r=>r.over);const ts=over.map(r=>r.t).sort((a,b)=>a-b);
    const q=p=>ts.length?ts[Math.floor(p*(ts.length-1))]:'-';
    const surv=R.filter(r=>!r.over);
    console.log(JSON.stringify(c),`破产率 ${(over.length/N*100).toFixed(1)}%  破产月份 p25/p50/p75=${q(.25)}/${q(.5)}/${q(.75)}  ≤12月:${over.filter(r=>r.t<=12).length} ≤24月:${over.filter(r=>r.t<=24).length}  动用过救急:${R.filter(r=>r.bail!=null).length}  平均毛利:${(R.reduce((a,r)=>a+r.avgGm,0)/N*100).toFixed(1)}%  亏损项目占比:${(R.reduce((a,r)=>a+r.lossProj,0)/Math.max(1,R.reduce((a,r)=>a+r.projN,0))*100).toFixed(1)}%  幸存者终局资质均值:${(surv.reduce((a,r)=>a+r.qual,0)/Math.max(1,surv.length)).toFixed(2)} 净资产中位:${surv.length?Math.round(surv.map(r=>r.net).sort((a,b)=>a-b)[surv.length>>1]):'-'}  峰值同时投标中位:${R.map(r=>r.peakBids).sort((a,b)=>a-b)[N>>1]}`);
  }
}
