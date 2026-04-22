const state={sportId:'4',endpoint:'scores',viewMode:'cards',data:null,logOpen:false,autoTimer:null};
const $=id=>document.getElementById(id);
const panelCards=$('panelCards'),panelTable=$('panelTable'),panelRaw=$('panelRaw'),rawJson=$('rawJson'),loader=$('loader'),errorBox=$('errorBox'),errorMsg=$('errorMsg'),logInner=$('logInner'),logCount=$('logCount'),logDrawer=$('logDrawer'),cacheStats=$('cacheStats');
function updateClock(){$('clock').textContent=new Date().toLocaleTimeString('en-GB',{hour12:false})}
updateClock();setInterval(updateClock,1000);
let logEntries=[];
function addLog(msg,type='req'){logEntries.unshift({msg,type,ts:new Date().toLocaleTimeString('en-GB',{hour12:false})});if(logEntries.length>50)logEntries.pop();renderLog()}
function renderLog(){logCount.textContent=logEntries.length;logInner.innerHTML=logEntries.map(e=>`<div class="log-entry log-${e.type}"><span class="log-time">${e.ts}</span><span>${e.type==='ok'?'✓':e.type==='err'?'✗':'→'}</span><span class="log-msg">${esc(e.msg)}</span></div>`).join('')}
$('logToggle').addEventListener('click',()=>{state.logOpen=!state.logOpen;logDrawer.classList.toggle('open',state.logOpen)});
async function fetchData(endpoint,sportId){
  showLoader(true);hideError();
  const t0=performance.now();
  const url='/api/'+endpoint+'?sportId='+sportId;
  addLog('GET '+url);
  try{
    const res=await fetch(url);
    const json=await res.json();
    const ms=Math.round(performance.now()-t0);
    if(!json.success)throw new Error(typeof json.error==='object'?JSON.stringify(json.error):json.error||'Error');
    addLog('200 OK '+ms+'ms'+(json.cached?' [CACHED]':''),'ok');
    state.data=json.data;
    updateStats(json.data,json.cached,ms);
    render(json.data);
    fetchCacheStats();
  }catch(e){addLog('ERR: '+e.message,'err');showError(e.message)}
  finally{showLoader(false)}
}
async function fetchRaw(){
  const p=$('customPath').value.trim()||'/sports/getPriveteData';
  const params=$('customParams').value.trim();
  showLoader(true);hideError();
  addLog('GET /api/raw?path='+p);
  try{
    const res=await fetch('/api/raw?path='+encodeURIComponent(p)+(params?'&'+params:''));
    const json=await res.json();
    if(!json.success)throw new Error(JSON.stringify(json.error));
    addLog('200 OK [RAW]','ok');
    state.data=json.data;
    updateStats(json.data,json.cached,0);
    render(json.data);
  }catch(e){addLog('ERR: '+e.message,'err');showError(e.message)}
  finally{showLoader(false)}
}
async function fetchCacheStats(){
  try{const res=await fetch('/api/health');const json=await res.json();const s=json.cache;
  cacheStats.innerHTML='Hits: '+s.hits+'<br>Misses: '+s.misses+'<br>Keys: '+s.keys+'<br>Up: '+Math.round(json.uptime)+'s'}catch(_){}
}
function render(data){const items=norm(data);switch(state.viewMode){case'cards':renderCards(items);break;case'table':renderTable(items);break;case'raw':rawJson.textContent=JSON.stringify(data,null,2);break}}
function norm(data){if(!data)return[];if(Array.isArray(data))return data;for(const k of['data','events','result','response','matches','scores','sports','markets','items']){if(Array.isArray(data[k]))return data[k]}return typeof data==='object'?[data]:[]}
function renderCards(items){
  if(!items.length){panelCards.innerHTML='<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-text">No data</div></div>';return}
  panelCards.innerHTML='<div class="cards-grid">'+items.slice(0,60).map((ev,i)=>{
    const name=ev?.event?.name||ev?.matchName||ev?.name||ev?.title||'Unknown';
    const isLive=ev?.inPlay||ev?.status==='live'||ev?.isLive;
    const score=ev?.score||(ev?.homeScore!=null?ev.homeScore+' – '+ev.awayScore:null);
    const market=ev?.marketName||ev?.market||ev?.competition||'';
    const time=ev?.openDate||ev?.startTime||ev?.date||'';
    const back=ev?.back||ev?.backOdds;const lay=ev?.lay||ev?.layOdds;const odds=ev?.odds||ev?.price;
    return`<div class="event-card ${isLive?'live':'pre'}" style="animation-delay:${i*.03}s">
      <div class="event-card-header"><div class="event-name">${esc(name)}</div><div class="event-status ${isLive?'status-live':'status-pre'}">${isLive?'🔴 LIVE':'⏳ PRE'}</div></div>
      <div class="event-meta">${score?'<div class="event-score">'+esc(score)+'</div>':''}${market?'<div class="event-market">'+esc(market)+'</div>':''}${time?'<div class="event-time">'+esc(String(time).slice(0,20))+'</div>':''}</div>
      ${(back||lay||odds)?'<div class="event-odds">'+(back?'<div class="odd-box"><div class="odd-label">BACK</div><div class="odd-value">'+back+'</div></div>':'')+(lay?'<div class="odd-box"><div class="odd-label">LAY</div><div class="odd-value">'+lay+'</div></div>':'')+(odds?'<div class="odd-box"><div class="odd-label">ODDS</div><div class="odd-value">'+odds+'</div></div>':'')+'</div>':''}
    </div>`}).join('')+'</div>'
}
function renderTable(items){
  if(!items.length){panelTable.innerHTML='<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-text">No data</div></div>';return}
  const flat=o=>{const r={};for(const[k,v]of Object.entries(o||{})){r[k]=Array.isArray(v)?'['+v.length+']':v}return r};
  const cols=Object.keys(flat(items[0])).slice(0,10);
  panelTable.innerHTML='<div class="data-table-wrap"><table class="data-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+items.slice(0,100).map(row=>{const f=flat(row);return'<tr>'+cols.map(c=>'<td title="'+esc(String(f[c]??''))+'">'+esc(String(f[c]??'—').slice(0,50))+'</td>').join('')+'</tr>'}).join('')+'</tbody></table></div>'
}
function updateStats(data,cached,ms){const items=norm(data);const live=items.filter(e=>e?.inPlay||e?.isLive).length;$('statTotal').textContent=items.length+' Events';$('statLive').textContent=live+' Live';$('statCached').textContent=cached?'⚡ Cached':'🔄 Fresh';$('statTime').textContent=ms+'ms'}
function showLoader(on){loader.classList.toggle('show',on);[panelCards,panelTable,panelRaw].forEach(p=>p.style.opacity=on?'0.3':'1')}
function showError(msg){errorBox.style.display='block';errorMsg.textContent=msg}
function hideError(){errorBox.style.display='none'}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
document.querySelectorAll('.sport-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.sport-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.sportId=btn.dataset.sport;go()}));
document.querySelectorAll('.feed-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.feed-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.endpoint=btn.dataset.endpoint;go()}));
document.querySelectorAll('.view-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.view-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.viewMode=btn.dataset.view;panelCards.classList.toggle('active',state.viewMode==='cards');panelTable.classList.toggle('active',state.viewMode==='table');panelRaw.classList.toggle('active',state.viewMode==='raw');if(state.data)render(state.data)}));
panelCards.classList.add('active');
$('fetchRaw').addEventListener('click',fetchRaw);
$('autoRefresh').addEventListener('change',function(){clearInterval(state.autoTimer);if(this.checked)state.autoTimer=setInterval(go,30000)});
function go(){fetchData(state.endpoint,state.sportId);clearInterval(state.autoTimer);if($('autoRefresh').checked)state.autoTimer=setInterval(go,30000)}
go();fetchCacheStats();state.autoTimer=setInterval(go,30000);
