// STEP 10: 랭킹 제출 및 실제 순위 표시. 서버 성공 전에는 순위를 표시하지 않는다.
const configured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
let lastCompletionState=null, rankingBusy=false, displayedDay='', resultDay='', rankResult=null, lookupDay='';
function playerId(){let id=readStorage('sudoku-player-id');if(!id){id=crypto.randomUUID();writeStorage('sudoku-player-id',id);}return id;}
async function rpc(name,body){
    const response=await fetch(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();
}
function rankForm(){
    const eligible=state.mode==='daily'&&state.day===dateKey()&&state.won&&state.hints===3&&state.rankEligible;
    const dialog=$('completion');
    $('reopen-completion').hidden=!state.won;
    if(!state.won){if(dialog.open)dialog.close();lastCompletionState=null;}
    else if(lastCompletionState!==state){lastCompletionState=state;dialog.showModal();}
    $('completion-stats').textContent=`소요 시간 ${formatTime(state.seconds)} · 실수 ${state.mistakes}회`;
    $('close-completion').disabled=rankingBusy;
    const submitted=eligible&&readStorage('sudoku-submitted-day')===state.day;
    $('ranking-form').hidden=!eligible||submitted;
    $('submit-ranking').disabled=!configured||rankingBusy;
    $('result').hidden=!(eligible&&submitted&&resultDay===state.day&&rankResult);
    $('completion-message').textContent=!eligible?'완료! 오늘의 도전에서 힌트 없이 완성하면 랭킹에 참여할 수 있어요.':!configured?'완료! Supabase 연결 후 제출할 수 있어요.':submitted?'오늘의 기록이 등록되었습니다.':'닉네임을 입력하고 오늘의 기록을 제출하세요.';
    if(!$('result').hidden){$('result-rank').textContent=`${rankResult.rank}위`;$('result-detail').textContent=`${rankResult.nickname} · ${formatTime(rankResult.seconds)} · 실수 ${rankResult.mistakes}회`;
    }else if(submitted&&configured&&lookupDay!==state.day){lookupDay=state.day;refreshMyRank(state.day,false).catch(()=>{lookupDay='';$('completion-message').textContent='순위 조회 실패. 랭킹 새로고침으로 다시 확인하세요.';});}
}
async function refreshMyRank(day,celebrate){
    const rows=await rpc('sudoku_my_rank',{p_day:day,p_player:playerId()});
    if(!rows.length)throw new Error('순위 없음');
    rankResult=rows[0];resultDay=day;rankForm();
    if(celebrate&&state.mode==='daily'&&state.day===day&&state.won&&readStorage('sudoku-celebrated-day')!==day){writeStorage('sudoku-celebrated-day',day);confetti();}
}
async function loadRanking(){
    const day=dateKey();displayedDay=day;$('ranking-date').textContent=day+' · 한국 시간';
    if(!configured){$('ranking-status').textContent='Supabase 설정 후 랭킹을 사용할 수 있습니다.';return;}
    $('ranking-status').textContent='랭킹 불러오는 중…';
    try{const rows=await rpc('sudoku_leaderboard',{p_day:day});if(displayedDay!==day)return;
    $('ranking-list').replaceChildren();rows.forEach((r,i)=>{const li=document.createElement('li');for(const value of [i+1,r.nickname,`${formatTime(r.seconds)} · 실수 ${r.mistakes}`]){const span=document.createElement('span');span.textContent=value;li.appendChild(span);}$('ranking-list').appendChild(li);});
    $('ranking-status').textContent=rows.length?'상위 20명':'아직 등록된 기록이 없습니다.';
    }catch(e){$('ranking-status').textContent='랭킹 연결 실패. 새로고침을 눌러 주세요.';console.warn(e);}
}
$('refresh-ranking').addEventListener('click',()=>{loadRanking();if(configured&&readStorage('sudoku-submitted-day')===dateKey())refreshMyRank(dateKey(),false).catch(console.warn);});
$('nickname').value=readStorage('sudoku-nickname')||'';
$('ranking-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!configured||rankingBusy||$('ranking-form').hidden)return;
    const nickname=$('nickname').value.trim();if(nickname.length<2||nickname.length>20){$('completion-message').textContent='닉네임은 2~20자로 입력해 주세요.';return;}
    rankingBusy=true;$('submit-ranking').disabled=true;$('close-completion').disabled=true;const day=state.day;
    try{
        const submittedScore=await rpc('sudoku_submit',{p_day:day,p_player:playerId(),p_nickname:nickname,p_seconds:Math.max(1,state.seconds),p_mistakes:state.mistakes});
        // The insert and rank calculation are one server transaction. Persist success immediately.
        writeStorage('sudoku-submitted-day',day);writeStorage('sudoku-nickname',nickname);
        rankResult={rank:submittedScore.rank,nickname:submittedScore.nickname,seconds:submittedScore.seconds,mistakes:submittedScore.mistakes};
        resultDay=day;rankForm();
        if(state.mode==='daily'&&state.day===day&&state.won&&readStorage('sudoku-celebrated-day')!==day){writeStorage('sudoku-celebrated-day',day);confetti();}
        await loadRanking();
    }catch(e){$('completion-message').textContent='제출 또는 순위 조회 실패. 다시 시도해 주세요.';console.warn(e);}finally{rankingBusy=false;$('submit-ranking').disabled=!configured;$('close-completion').disabled=false;}
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
document.addEventListener('sudoku:render',()=>{rankForm();if(displayedDay!==dateKey())loadRanking();});rankForm();loadRanking();
