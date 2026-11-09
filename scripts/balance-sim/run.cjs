// 平衡性回归：node scripts/balance-sim/run.cjs [每组局数=300] [月数=120]
// 三种自动玩家：normal=项目经理空了就投标、不看现金；cautious=参考现金预测谨慎投标；ui=只在「若中标」最低现金+可用授信≥0 时投标
const {play}=require('./bot.cjs');
const N=+process.argv[2]||300,M=+process.argv[3]||120;
const groups=[{policy:'normal'},{policy:'cautious'},{policy:'ui'},{policy:'normal',bg:'soe'},{policy:'normal',bg:'gk'},{policy:'normal',dk:'easy'},{policy:'normal',dk:'hard'},{policy:'normal',era:'y21'},{policy:'normal',era:'y08'}];
console.log(`每组 ${N} 局 × ${M} 个月`);
for(const c of groups){let o=0,o24=0,q2=0;const nets=[];
  for(let i=0;i<N;i++){const r=play(c,M);if(r.over){o++;if(r.t<=24)o24++;}else{nets.push(r.net);if(r.qual>=2)q2++;}}
  nets.sort((a,b)=>a-b);
  console.log(`${[c.policy,c.bg,c.dk,c.era].filter(Boolean).join('/').padEnd(16)} 破产 ${String(Math.round(o/N*100)).padStart(3)}%  2年内 ${String(Math.round(o24/N*100)).padStart(3)}%  房建一级以上 ${String(Math.round(q2/N*100)).padStart(3)}%  幸存者净资产中位 ${nets.length?Math.round(nets[nets.length>>1])+'万':'-'}`);}
