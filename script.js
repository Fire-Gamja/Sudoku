// STEP 05: 직접 작성한 실습 문제를 그대로 보존
const puzzle = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

// STEP 06: 게임 상태와 DOM 요소. 원본 문제와 사용자 입력을 분리한다.
const board = document.getElementById("board");
const $ = id => document.getElementById(id);
const copy = grid => grid.map(row => [...row]);
const emptyNotes = () => Array.from({length:81}, () => []);
const levels = {easy:36,normal:42,hard:48,expert:54}; // 목표 빈칸 수 (기술적 난이도 등급은 아님)
let state, selected = -1, noteMode = false, history = [];
const cells = [];
const storageKey = 'study-sudoku-v1';
const dateKey = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function readStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeStorage(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }

// STEP 07: 규칙 검사와 백트래킹. 0은 빈칸이다.
function candidates(grid,row,col) {
    const used = new Set();
    for(let i=0;i<9;i++){ used.add(grid[row][i]); used.add(grid[i][col]); }
    const r0=Math.floor(row/3)*3, c0=Math.floor(col/3)*3;
    for(let r=r0;r<r0+3;r++) for(let c=c0;c<c0+3;c++) used.add(grid[r][c]);
    return [1,2,3,4,5,6,7,8,9].filter(n=>!used.has(n));
}
function findEmpty(grid) {
    // 후보가 가장 적은 빈칸부터 탐색하면 불필요한 재귀를 줄일 수 있다.
    let best=null;
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(grid[r][c]===0){
        const options=candidates(grid,r,c);
        if(!best || options.length<best.options.length) best={r,c,options};
        if(options.length===0) return best;
    }
    return best;
}
function shuffle(array,rng=Math.random) {
    for(let i=array.length-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [array[i],array[j]]=[array[j],array[i]];}
    return array;
}
function solve(grid,rng=null) {
    const spot=findEmpty(grid);
    if(!spot) return true;
    const {r,c,options}=spot;
    for(const n of rng?shuffle(options,rng):options){
        grid[r][c]=n;
        if(solve(grid,rng)) return true;
        grid[r][c]=0; // 실패하면 이전 상태로 돌아간다.
    }
    return false;
}
function countSolutions(grid,limit=2) {
    const spot=findEmpty(grid);
    if(!spot) return 1;
    let count=0;
    for(const n of spot.options){
        grid[spot.r][spot.c]=n;
        count+=countSolutions(grid,limit-count);
        grid[spot.r][spot.c]=0;
        if(count>=limit) break;
    }
    return count;
}
// 날짜 기반 난수: 같은 날짜에는 같은 퍼즐을 생성한다.
function seededRandom(text) {
    let seed=2166136261;
    for(const ch of text) seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
    return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function generate(difficulty,rng=Math.random) {
    const solution=Array.from({length:9},()=>Array(9).fill(0));
    solve(solution,rng);
    const initial=copy(solution);
    let removed=0;
    for(const i of shuffle(Array.from({length:81},(_,i)=>i),rng)){
        if(removed>=levels[difficulty]) break;
        const r=Math.floor(i/9),c=i%9,old=initial[r][c];
        initial[r][c]=0;
        if(countSolutions(initial)===1) removed++;
        else initial[r][c]=old;
    }
    return {initial,solution};
}
function start(mode,difficulty,practice=false) {
    const day=dateKey();
    let data;
    if(practice){const solution=copy(puzzle);solve(solution);data={initial:copy(puzzle),solution};}
    else data=generate(difficulty,mode==='daily'?seededRandom(day):Math.random);
    state={...data,mode,difficulty,day,rankEligible:!practice,values:copy(data.initial),notes:emptyNotes(),seconds:0,mistakes:0,hints:3,won:false};
    selected=-1;noteMode=false;history=[];render();save();
}

// STEP 06: 기존 81개 셀 생성 반복문을 유지하고 클릭 이벤트를 연결한다.
for(let i=0;i<81;i++){
    const cell=document.createElement('button');
    cell.type='button';cell.classList.add('cell');
    const row=Math.floor(i/9),col=i%9;
    if(row===2||row===5) cell.classList.add('border-bottom');
    if(col===2||col===5) cell.classList.add('border-right');
    cell.addEventListener('click',()=>{selected=i;render();});
    board.appendChild(cell);cells.push(cell);
}
for(let n=1;n<=9;n++){
    const button=document.createElement('button');button.textContent=n;
    button.addEventListener('click',()=>inputNumber(n));$('keypad').appendChild(button);
}
function render(){
    for(let i=0;i<81;i++){
        const r=Math.floor(i/9),c=i%9,cell=cells[i],n=state.values[r][c],fixed=state.initial[r][c]!==0;
        cell.classList.toggle('number-main',fixed);
        cell.classList.toggle('selected',i===selected);
        const sr=Math.floor(selected/9),sc=selected%9;
        cell.classList.toggle('related',selected>=0&&(r===sr||c===sc||(Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc/3))));
        cell.classList.toggle('wrong',n!==0&&n!==state.solution[r][c]);
        cell.textContent=n||'';
        if(!n&&state.notes[i].length){
            const notes=document.createElement('span');notes.className='notes';
            for(let k=1;k<=9;k++){const span=document.createElement('span');span.textContent=state.notes[i].includes(k)?k:'';notes.appendChild(span);}
            cell.appendChild(notes);
        }
        cell.setAttribute('aria-label',`${r+1}행 ${c+1}열 ${n||'빈칸'}${fixed?' 기본 숫자':''}`);
        cell.setAttribute('aria-pressed',String(i===selected));
    }
    $('daily').classList.toggle('active',state.mode==='daily');$('free').classList.toggle('active',state.mode==='free');
    $('new').disabled=state.mode==='daily';$('difficulty').value=state.difficulty;$('difficulty').disabled=state.mode==='daily';
    $('note').classList.toggle('active',noteMode);$('note').textContent='메모 '+(noteMode?'ON':'OFF');$('note').setAttribute('aria-pressed',String(noteMode));
    $('mistakes').textContent=state.mistakes;$('hints').textContent=state.hints;
    $('undo').disabled=!history.length||state.won;$('hint').disabled=!state.hints||state.won;
    $('status').textContent=state.won?'완성! 모든 숫자를 정확하게 채웠어요.':state.mode==='daily'?`${state.day} · 오늘의 공통 퍼즐`:'자유롭게 새로운 퍼즐에 도전하세요.';
    updateTimer();renderRecord();document.dispatchEvent(new Event("sudoku:render"));
}
// STEP 08: 사용자 입력, 메모, 힌트, 되돌리기.
function editable(){return selected>=0&&!state.won&&state.initial[Math.floor(selected/9)][selected%9]===0;}
function snapshot(){history.push({values:copy(state.values),notes:state.notes.map(a=>[...a])});if(history.length>100)history.shift();}
function inputNumber(n){
    if(!editable())return;
    const r=Math.floor(selected/9),c=selected%9;
    if(noteMode&&n!==0){
        if(state.values[r][c]!==0)return;
        snapshot();const notes=state.notes[selected];
        state.notes[selected]=notes.includes(n)?notes.filter(x=>x!==n):[...notes,n];
    }else{
        if(state.values[r][c]===n&&!state.notes[selected].length)return;
        snapshot();state.values[r][c]=n;state.notes[selected]=[];
        if(n!==0&&n!==state.solution[r][c])state.mistakes++;
        if(n!==0&&n===state.solution[r][c])clearPeerNotes(r,c,n);
    }
    finishIfSolved();render();save();
}
function clearPeerNotes(r,c,n){
    for(let i=0;i<81;i++){
        const rr=Math.floor(i/9),cc=i%9;
        if(rr===r||cc===c||(Math.floor(rr/3)===Math.floor(r/3)&&Math.floor(cc/3)===Math.floor(c/3))) state.notes[i]=state.notes[i].filter(x=>x!==n);
    }
}
function hint(){
    if(state.won||state.hints===0)return;
    if(!editable()||state.values[Math.floor(selected/9)][selected%9]===state.solution[Math.floor(selected/9)][selected%9]) selected=state.values.flat().findIndex((n,i)=>n!==state.solution.flat()[i]);
    if(!editable())return;
    snapshot();const r=Math.floor(selected/9),c=selected%9,n=state.solution[r][c];
    state.values[r][c]=n;state.notes[selected]=[];state.hints--;clearPeerNotes(r,c,n);finishIfSolved();render();save();
}
function undo(){if(!history.length||state.won)return;const old=history.pop();state.values=old.values;state.notes=old.notes;render();save();}
function toggleNote(){noteMode=!noteMode;render();}
function finishIfSolved(){
    if(!state.values.every((row,r)=>row.every((n,c)=>n===state.solution[r][c])))return;
    state.won=true;
    const record=readStorage('study-sudoku-record')||{};
    const key=state.mode==='daily'?'daily':state.difficulty;
    if(record[key]===undefined||state.seconds<record[key])record[key]=state.seconds;
    writeStorage('study-sudoku-record',record);
}
function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function updateTimer(){$('timer').textContent=formatTime(state.seconds);}
function renderRecord(){const record=readStorage('study-sudoku-record')||{};const key=state.mode==='daily'?'daily':state.difficulty;$('record').textContent=record[key]===undefined?'—':formatTime(record[key]);}
// STEP 09: 브라우저 저장 및 일일 퍼즐 이어하기.
function save(){writeStorage(storageKey,state);if(state.mode==='daily')writeStorage(storageKey+'-daily',state);}
function restore(saved){state=saved;selected=-1;noteMode=false;history=[];render();}
function daily(){const saved=readStorage(storageKey+'-daily');if(saved&&saved.day===dateKey()){restore(saved);save();}else start('daily','normal');}
function confirmNew(){return state.won||confirm('현재 게임을 초기화할까요?');}
$('daily').addEventListener('click',()=>{if(state.mode!=='daily'||state.day!==dateKey())daily();});
$('free').addEventListener('click',()=>{if(state.mode!=='free')start('free','easy');});
$('new').addEventListener('click',()=>{if(state.mode!=='daily'&&confirmNew())start(state.mode,state.difficulty);});
$('difficulty').addEventListener('change',()=>{const level=$('difficulty').value;if(confirmNew())start('free',level);else render();});
$('practice').addEventListener('click',()=>{if(confirmNew())start('free','hard',true);});
$('note').addEventListener('click',toggleNote);$('erase').addEventListener('click',()=>inputNumber(0));$('hint').addEventListener('click',hint);$('undo').addEventListener('click',undo);
document.addEventListener('keydown',e=>{
    if($('completion').open||e.ctrlKey||e.metaKey||e.altKey||e.target.tagName==='SELECT'||e.target.tagName==='INPUT')return;
    if(/^[1-9]$/.test(e.key)){e.preventDefault();inputNumber(Number(e.key));}
    else if(e.key==='Delete'||e.key==='Backspace'||e.key==='0'){e.preventDefault();inputNumber(0);}
    else if(e.key.toLowerCase()==='n'){e.preventDefault();toggleNote();}
    else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
        e.preventDefault();if(selected<0)selected=0;else{let r=Math.floor(selected/9),c=selected%9;if(e.key==='ArrowUp')r--;if(e.key==='ArrowDown')r++;if(e.key==='ArrowLeft')c--;if(e.key==='ArrowRight')c++;selected=Math.max(0,Math.min(8,r))*9+Math.max(0,Math.min(8,c));}render();cells[selected].focus();
    }
});
const saved=readStorage(storageKey);
if(saved&&(saved.mode==='free'||saved.day===dateKey()))restore(saved);else daily();
setInterval(()=>{if(!state.won&&!document.hidden){state.seconds++;updateTimer();save();}},1000);
