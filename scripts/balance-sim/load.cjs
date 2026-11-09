// 从 dongda-mvp.html 抽出游戏脚本，去掉界面渲染，在 Node 里直接调用游戏逻辑
const fs=require('fs'),path=require('path');
require('./stub.cjs');
const src=fs.readFileSync(path.join(__dirname,'..','..','dongda-mvp.html'),'utf8');
let body=src.split('<script>')[2].split('</script>')[0];
body=body.replace("window.claude?.hot?.snapshot?.(()=>({s:S}));","").replace("window.claude?.hot?.ready?window.claude.hot.ready(start):start(window.claude?.hot?.data??{});",
 "render=()=>{};save=()=>{};renderTut=()=>{};renderModal=()=>{};globalThis.G={get S(){return S},newGame,advance,act,choose,bidCalc,minSkill,isLocked,forecast,hypo,net,limit,recvSum,backlog,upgrade,UI};");
new Function(body)();
module.exports=globalThis.G;
