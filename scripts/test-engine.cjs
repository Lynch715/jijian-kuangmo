// Load the actual single-file game in an isolated VM. No browser profile or real saves are touched.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../dongda-mvp.html'),'utf8');
module.exports=function engine(seed=1){
  let rng=seed>>>0,forced=null,writeFail=false;const elements=new Map(),store=new Map();
  function element(){return {innerHTML:'',textContent:'',hidden:false,style:{},dataset:{},children:[],clientWidth:360,classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this[k]=v;},appendChild(x){x.parent=this;this.children.push(x);},get firstChild(){return this.children[0];},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);},focus(){},click(){}};}
  const get=k=>{if(!elements.has(k))elements.set(k,element());return elements.get(k);};
  const math=Object.create(Math);math.random=()=>forced??((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  const c={console,Math:math,Date,performance:{now:()=>0},setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},scrollTo(){},addEventListener(){},matchMedia:()=>({matches:false}),navigator:{clipboard:{writeText:async()=>{}}},localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(writeFail)throw new Error('quota');store.set(k,String(v));},removeItem:k=>store.delete(k)},document:{querySelector:get,querySelectorAll:()=>[],getElementById:get,createElement:element,addEventListener(){},documentElement:element(),body:element()}};c.window=c;vm.createContext(c);
  const expose='newGame,advance,act,choose,bidCalc,minSkill,isLocked,forecast,hypo,projectCF,planCost,projectFactor,doPdec,tickProject,resolveBid,complete,prof12,yProf,yNet,taxLiability,net,limit,noticeHTML,skylineHTML,kindOf,payTerm,render,renderModal,renderSave,renderHonor,renderMap,readJSON,loadState,prepareState,migrate,save,load,start,checkAch,sceneSVG,certHTML';
  const bootstrap='window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});';
  if(!source.includes(bootstrap))throw new Error('Game bootstrap changed; update test loader.');
  const body=source.split('<script>')[2].split('</script>')[0].replace(bootstrap,`globalThis.G={get S(){return S},set S(s){S=s},UI,${expose}};render=()=>{};renderTut=()=>{};`);
  vm.runInContext(body,c);const g=c.G;g.newGame('pri','std','now');g.S.queue=[];
  return {g,store,get,random:v=>forced=v,failWrites:v=>writeFail=v};
};
