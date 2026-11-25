// SUDOKU v1.4: independent daily and unlimited leaderboards.
const configured=Boolean(SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY);
const difficultyNames={easy:'쉬움',normal:'보통',hard:'어려움',expert:'전문가'};
let lastCompletionState=null,rankingBusy=false,displayedKey='',loadSeq=0,lookupKey='',dailyResult=null;
function playerId(){let id=readStorage('sudoku-player-id');if(!id){id=crypto.randomUUID();writeStorage('sudoku-player-id',id);}return id;}
async function rpc(name,body){
    const response=await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.message||'HTTP '+response.status);error.code=data.code;throw error;}
    return data;
}
function eligible(){return state.won&&state.hints===3&&state.rankEligible&&(state.mode==='free'||(state.mode==='daily'&&state.day===dateKey()));}
function submitted(){return state.mode==='daily'?readStorage('sudoku-submitted-day')===state.day:Boolean(state.freeRankResult);}
function rankForm(){
    const ok=eligible(),done=ok&&submitted(),dialog=$('completion');
    $('reopen-completion').hidden=!state.won;
    if(!state.won){if(dialog.open)dialog.close();lastCompletionState=null;}
    else if(lastCompletionState!==state){lastCompletionState=state;if(!dialog.open)dialog.showModal();}
    $('completion-stats').textContent=`소요 시간 ${formatTime(state.seconds)} · 실수 ${state.mistakes}회`;
    $('close-completion').disabled=rankingBusy;
    $('ranking-form').hidden=!ok||done;
    $('submit-ranking').disabled=!configured||rankingBusy;
    const result=state.mode==='free'?state.freeRankResult:(dailyResult?.day===state.day?dailyResult:null);
    $('result').hidden=!(done&&result);
    $('result').querySelector('small').textContent=state.mode==='free'?`${difficultyNames[state.difficulty]} 누적 순위 (최고 기록)`:'오늘의 순위';
    $('completion-message').textContent=!ok?'힌트 없이 완료한 정규 퍼즐만 랭킹에 참여할 수 있어요.':!configured?'Supabase 연결 후 제출할 수 있어요.':done?(state.mode==='free'?(result?.improved?'최고 기록이 등록되었습니다.':'기존 최고 기록을 유지합니다.'):'오늘의 기록이 등록되었습니다.'):'닉네임을 입력하고 기록을 제출하세요.';
    if(done&&result){
        $('result-rank').textContent=`${result.rank}위`;
        $('result-detail').textContent=`${result.nickname} · ${formatTime(result.seconds)} · 실수 ${result.mistakes}회`;
    }else if(done&&configured&&state.mode==='daily'&&lookupKey!==state.day){
        const day=state.day;lookupKey=day;
        refreshMyRank(day).catch(()=>{lookupKey='';if(state.day===day&&state.mode==='daily')$('completion-message').textContent='순위 조회 실패. 랭킹 새로고침으로 다시 확인하세요.';});
    }
}
async function refreshMyRank(day){
    const rows=await rpc('sudoku_my_rank',{p_day:day,p_player:playerId()});
    if(!rows.length)throw new Error('순위 없음');
    dailyResult={...rows[0],day};rankForm();
}
function rankingKey(){return state.mode==='free'?'free:'+state.difficulty:'daily:'+dateKey();}
async function loadRanking(){
    const free=state.mode==='free',day=dateKey(),difficulty=state.difficulty,key=rankingKey(),seq=++loadSeq;displayedKey=key;
    $('ranking-date').textContent=free?`${difficultyNames[difficulty]} · 전체 기간`:day+' · 한국 시간';
    $('ranking-date').closest('.panel').querySelector('h2').textContent=free?'무제한 플레이 랭킹':'오늘의 랭킹';
    $('ranking-date').closest('.panel').querySelector('.help').textContent=free?'난이도별 개인 최고 기록 · 실수 적은 순, 시간 빠른 순':'힌트 없이 완성한 첫 도전만 등록 · 실수 적은 순, 시간 빠른 순';
    $('ranking-list').replaceChildren();
    if(!configured){$('ranking-status').textContent='Supabase 설정 후 랭킹을 사용할 수 있습니다.';return;}
    $('ranking-status').textContent='랭킹 불러오는 중…';
    try{
        const rows=await rpc(free?'sudoku_free_leaderboard':'sudoku_leaderboard',free?{p_difficulty:difficulty}:{p_day:day});
        if(seq!==loadSeq||key!==rankingKey())return;
        rows.forEach((r,i)=>{const li=document.createElement('li');for(const value of [r.rank??i+1,r.nickname,`${formatTime(r.seconds)} · 실수 ${r.mistakes}`]){const span=document.createElement('span');span.textContent=value;li.appendChild(span);}$('ranking-list').appendChild(li);});
        $('ranking-status').textContent=rows.length?'상위 20명':'아직 등록된 기록이 없습니다.';
    }catch(e){if(seq===loadSeq)$('ranking-status').textContent='랭킹 연결 실패. 새로고침을 눌러 주세요.';console.warn(e);}
}
$('refresh-ranking').addEventListener('click',()=>{loadRanking();if(configured&&state.mode==='daily'&&submitted())refreshMyRank(state.day).catch(console.warn);});
$('nickname').value=readStorage('sudoku-nickname')||'';
$('ranking-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!configured||rankingBusy||!eligible()||submitted())return;
    const nickname=$('nickname').value.trim();if(nickname.length<2||nickname.length>20){$('completion-message').textContent='닉네임은 2~20자로 입력해 주세요.';return;}
    const game=state,free=game.mode==='free',day=game.day;
    rankingBusy=true;rankForm();
    try{
        const args={p_player:playerId(),p_nickname:nickname,p_seconds:Math.max(1,game.seconds),p_mistakes:game.mistakes};
        const result=await rpc(free?'sudoku_free_submit':'sudoku_submit',free?{...args,p_difficulty:game.difficulty}:{...args,p_day:day});
        writeStorage('sudoku-nickname',nickname);
        if(free){game.freeRankResult=result;if(state===game)save();}
        else{writeStorage('sudoku-submitted-day',day);dailyResult={...result,day};}
        if(state===game){
            rankForm();
            if(free||readStorage('sudoku-celebrated-day')!==day){if(!free)writeStorage('sudoku-celebrated-day',day);confetti();}
        }
        await loadRanking();
    }catch(e){
        if(!free&&(e.code==='23505'||e.message==='ALREADY_SUBMITTED')){
            try{await refreshMyRank(day);writeStorage('sudoku-submitted-day',day);rankForm();}catch(err){$('completion-message').textContent='이미 제출한 기록입니다. 순위 조회를 다시 시도해 주세요.';}
        }else $('completion-message').textContent='제출 실패. 다시 시도해 주세요.';
        console.warn(e);
    }finally{rankingBusy=false;$('submit-ranking').disabled=!configured;$('close-completion').disabled=false;}
});
// Canvas 폭죽: 제출 성공 시 1회, 약 2초 후 자동 종료. 모션 감소 설정 존중.
function confetti(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const canvas=$('confetti'),ctx=canvas.getContext('2d');if(!ctx)return;
    canvas.width=innerWidth;canvas.height=innerHeight;canvas.style.display='block';
    const colors=['#245bc1','#60a5fa','#f59e0b','#ec4899','#22c55e'];
    const particles=Array.from({length:150},(_,i)=>({x:canvas.width*(i%2?.25:.75),y:canvas.height*.65,vx:(Math.random()-.5)*12,vy:-5-Math.random()*13,rot:Math.random()*6,color:colors[i%colors.length]}));
    const start=performance.now();function frame(now){const elapsed=now-start;ctx.clearRect(0,0,canvas.width,canvas.height);if(elapsed>=2200){canvas.style.display='none';return;}ctx.globalAlpha=Math.min(1,(2200-elapsed)/500);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.22;p.rot+=.09;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.fillRect(-4,-3,8,6);ctx.restore();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
$('close-completion').addEventListener('click',()=>{if(!rankingBusy)$('completion').close();});
$('reopen-completion').addEventListener('click',()=>{if(state.won&&!$('completion').open)$('completion').showModal();});
$('completion').addEventListener('cancel',e=>{if(rankingBusy)e.preventDefault();});

document.addEventListener('sudoku:render',()=>{rankForm();if(displayedKey!==rankingKey())loadRanking();});
setInterval(()=>{if(displayedKey!==rankingKey()){rankForm();loadRanking();}},1000);
rankForm();loadRanking();
