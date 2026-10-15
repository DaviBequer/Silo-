/* ========== COMANDO — disciplina, ordens do dia, juramento ========== */

function diaKeyHoje(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function garantirEstadoComando(){
  if(!state.comando){
    state.comando = {
      ordens: [
        {id:'o1', texto:'Acordar no horário definido', feito:false},
        {id:'o2', texto:'Treinar / atividade física', feito:false},
        {id:'o3', texto:'30 min de foco em algo importante, sem tela', feito:false},
        {id:'o4', texto:'Zero adiamento na tarefa mais difícil do dia', feito:false}
      ],
      ultimoDia: null,
      diaFechado: false,
      streak: 0,
      recorde: 0,
      juramento: '',
      sabotagens: [],
      rupturaHoje: false
    };
  }
  if(!state.comando.sabotagens) state.comando.sabotagens = [];
  const hoje = diaKeyHoje();
  if(state.comando.ultimoDia !== hoje){
    const eraPrimeiraVez = !state.comando.ultimoDia;
    const quebrou = !eraPrimeiraVez && !state.comando.diaFechado;
    if(quebrou){
      state.comando.streak = 0;
      state.comando.rupturaHoje = true;
    } else {
      state.comando.rupturaHoje = false;
    }
    state.comando.ordens.forEach(o=>{ o.feito = false; o.mudouEm = 0; });   // mudouEm 0: o que foi feito hoje no Google vale
    state.comando.diaFechado = false;
    state.comando.ultimoDia = hoje;
    persist();
  }
}

function abrirComando(){
  garantirEstadoComando();
  document.getElementById('pageComando').classList.add('active');
  renderComando();
  if(googCfg().clientId) googCarregarScript().catch(()=>{});   // deixa pronto para o toque em "Conectar"
  if(googToken()) googSincronizar();
}
function fecharComando(){
  document.getElementById('pageComando').classList.remove('active');
}

function cmdEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
const CMD_MIC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>';
const CMD_MAIS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const CMD_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CMD_X = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/* últimos 7 dias: fechado (●) ou não (○); hoje com anel */
function cmdSemanaHtml(c){
  const fechados = new Set(c.diasFechados || []);
  const letras = ['D','S','T','Q','Q','S','S'];
  let html = '';
  for(let i = 6; i >= 0; i--){
    const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() - i);
    const k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const feito = fechados.has(k) || (i === 0 && c.diaFechado);
    html += `<div class="cmd-dia${feito?' feito':''}${i===0?' hoje':''}"><span>${letras[d.getDay()]}</span><i></i></div>`;
  }
  return html;
}

function renderComando(){
  const c = state.comando;
  const total = c.ordens.length, feitas = c.ordens.filter(o=>o.feito).length;
  const todasFeitas = total > 0 && feitas === total;
  const pct = total ? Math.round(feitas/total*100) : 0;

  const ordensHtml = c.ordens.map(o=>`
    <div class="cmd-ordem${o.feito?' feita':''}">
      <button type="button" class="cmd-check" onclick="toggleOrdemComando('${o.id}')" aria-label="${o.feito?'Desmarcar':'Marcar como feita'}">${o.feito?CMD_CHECK:''}</button>
      <div class="cmd-ordem-texto" id="ordemTexto-${o.id}" onclick="editarOrdemComando('${o.id}')">${cmdEsc(o.texto)}</div>
      <button type="button" class="btn-icon-sm cmd-ordem-del" onclick="event.stopPropagation();excluirOrdemComando('${o.id}')" aria-label="Remover ordem" title="Remover">${CMD_X}</button>
    </div>`).join('') || `<div class="cmd-vazio">Nenhuma ordem. Escreva ou dite a primeira abaixo.</div>`;

  const faltam = total - feitas;
  const botaoFechar = c.diaFechado
    ? `<button type="button" class="cmd-fechar fechado" disabled>${CMD_CHECK} Dia fechado</button>`
    : todasFeitas
      ? `<button type="button" class="btn btn-block cmd-fechar" onclick="fecharDiaComando()">Fechar o dia</button>`
      : `<button type="button" class="cmd-fechar" disabled>${total ? `Falta${faltam>1?'m':''} ${faltam} orde${faltam>1?'ns':'m'} para fechar o dia` : 'Adicione uma ordem para começar'}</button>`;

  const juramentoHtml = c.juramento ? `
      <blockquote class="cmd-juramento">${cmdEsc(c.juramento).replace(/\n/g,'<br>')}</blockquote>
      <div class="cmd-juramento-rodape"><span>Assinado</span><button type="button" class="cmd-link" onclick="editarJuramentoComando()">Reescrever</button></div>` : `
      <div class="cmd-desc">O compromisso que você assume com você mesmo. Sem meio-termo.</div>
      <textarea id="juramentoInput" class="cmd-campo cmd-juramento-input" placeholder="Eu me comprometo a…"></textarea>
      <button type="button" class="btn btn-block" style="margin-top:10px" onclick="assinarJuramentoComando()">Assinar</button>`;

  const sabotagensHtml = c.sabotagens.slice(-5).reverse().map(s=>`
      <div class="cmd-sab">
        <span class="cmd-sab-data">${new Date(s.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
        <span>${cmdEsc(s.nota)}</span>
      </div>`).join('');

  document.getElementById('comandoConteudo').innerHTML = `
    <div class="cmd-topo">
      <div class="cmd-rotulo">Disciplina</div>
      <div class="cmd-numero">${c.streak}<span>${c.streak===1?'dia seguido':'dias seguidos'}</span></div>
      <div class="cmd-sub">${c.recorde > 0 ? `Recorde: ${c.recorde} dia${c.recorde===1?'':'s'}` : 'Feche o dia cumprindo todas as ordens'}</div>
      <div class="cmd-semana">${cmdSemanaHtml(c)}</div>
      ${c.rupturaHoje ? `<div class="cmd-ruptura">Ontem não foi fechado — a sequência recomeçou. Reorganize e siga.</div>` : ''}
    </div>

    <div class="cmd-grade">
      <div class="cmd-card cmd-card-ordens">
        <div class="cmd-card-topo"><span class="cmd-card-titulo">Ordens de hoje</span><span class="cmd-card-conta">${feitas} de ${total}</span></div>
        <div class="cmd-barra"><div style="width:${pct}%"></div></div>
        <div class="cmd-ordens">${ordensHtml}</div>
        <form class="cmd-nova" onsubmit="event.preventDefault();adicionarOrdemComando()">
          <input type="text" id="cmdNovaOrdem" class="cmd-campo" placeholder="Nova ordem" autocomplete="off" enterkeyhint="done">
          <button type="button" class="cmd-btn-icone" id="cmdMic" onclick="cmdDitar('cmdNovaOrdem', this)" aria-label="Ditar por voz" title="Ditar por voz">${CMD_MIC}</button>
          <button type="submit" class="cmd-btn-icone escuro" aria-label="Adicionar ordem" title="Adicionar">${CMD_MAIS}</button>
        </form>
        ${botaoFechar}
      </div>

      <div class="cmd-coluna">
        ${googCardHtml()}
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Juramento</span></div>
          ${juramentoHtml}
        </div>
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Peguei-me sabotando</span></div>
          <div class="cmd-desc">Anote na hora o que quase te derrubou.</div>
          <form class="cmd-nova" onsubmit="event.preventDefault();registrarSabotagemComando()">
            <input type="text" id="sabotagemInput" class="cmd-campo" placeholder="O que aconteceu agora?" autocomplete="off" enterkeyhint="done">
            <button type="button" class="cmd-btn-icone" onclick="cmdDitar('sabotagemInput', this)" aria-label="Ditar por voz" title="Ditar por voz">${CMD_MIC}</button>
            <button type="submit" class="cmd-btn-icone escuro" aria-label="Registrar" title="Registrar">${CMD_MAIS}</button>
          </form>
          ${sabotagensHtml ? `<div class="cmd-sabs">${sabotagensHtml}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* Ditado por voz (reconhecimento de fala do navegador, em português). Na nova ordem, ao parar de falar já adiciona.
   Onde o navegador não tem isso (alguns iPhones no app instalado), o microfone do próprio teclado continua funcionando. */
let cmdReconhecendo = null;
function cmdDitar(inputId, btn){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const inp = document.getElementById(inputId);
  if(!SR){ showToast('Ditado indisponível aqui — use o microfone do teclado'); inp?.focus(); return; }
  if(cmdReconhecendo){ cmdReconhecendo.stop(); return; }
  const r = new SR();
  r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
  const base = inp.value.trim() ? inp.value.trim() + ' ' : '';
  let falou = false;
  r.onresult = e=>{ let t = ''; for(const res of e.results) t += res[0].transcript; inp.value = base + t.trim(); falou = true; };
  r.onerror = e=>{ if(e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('Permita o uso do microfone para ditar'); };
  r.onend = ()=>{
    cmdReconhecendo = null;
    btn.classList.remove('ouvindo');
    if(falou && inputId === 'cmdNovaOrdem' && inp.value.trim()) adicionarOrdemComando();
  };
  try{ r.start(); cmdReconhecendo = r; btn.classList.add('ouvindo'); showToast('Pode falar…'); }
  catch(e){ showToast('Não consegui ligar o microfone'); }
}

function toggleOrdemComando(id){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  o.feito = !o.feito;
  o.mudouEm = Date.now();
  persist();
  renderComando();
  googAgendarSync();
}
function editarOrdemComando(id){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  const el = document.getElementById('ordemTexto-'+id);
  el.outerHTML = `<input type="text" id="ordemTexto-${id}" class="cmd-campo cmd-editando" value="${cmdEsc(o.texto)}" onblur="salvarOrdemComando('${id}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  document.getElementById('ordemTexto-'+id).focus();
}
function salvarOrdemComando(id, texto){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  const novo = (texto||'').trim() || o.texto;
  if(novo !== o.texto){ o.texto = novo; o.mudouEm = Date.now(); persist(); googAgendarSync(); }
  renderComando();
}
function adicionarOrdemComando(){
  const inp = document.getElementById('cmdNovaOrdem');
  const texto = (inp && inp.value || '').trim();
  if(!texto){ inp?.focus(); return; }
  state.comando.ordens.push({ id:'o'+Date.now(), texto, feito:false, mudouEm:Date.now() });
  persist();
  renderComando();
  document.getElementById('cmdNovaOrdem')?.focus();
  googAgendarSync();
}
async function excluirOrdemComando(id){
  const ok = await iosConfirm('Remover esta ordem?');
  if(!ok) return;
  const o = state.comando.ordens.find(x=>x.id===id);
  if(o && o.tarefaId){ const g = googCfg(); g.removidas = (g.removidas||[]).concat(o.tarefaId); }   // sai do Google Tarefas também
  state.comando.ordens = state.comando.ordens.filter(x=>x.id!==id);
  persist();
  renderComando();
  googAgendarSync();
}
function fecharDiaComando(){
  const c = state.comando;
  if(c.diaFechado || !c.ordens.every(o=>o.feito)) return;
  c.diaFechado = true;
  c.diasFechados = (c.diasFechados || []).filter(d=>d !== c.ultimoDia).concat(c.ultimoDia).slice(-60);   // bolinhas da semana
  c.streak += 1;
  c.recorde = Math.max(c.recorde, c.streak);
  c.rupturaHoje = false;
  persist();
  renderComando();
}
function assinarJuramentoComando(){
  const texto = (document.getElementById('juramentoInput').value||'').trim();
  if(!texto) return;
  state.comando.juramento = texto;
  persist();
  renderComando();
}
async function editarJuramentoComando(){
  const ok = await iosConfirm('Reescrever o juramento?');
  if(!ok) return;
  state.comando.juramento = '';
  persist();
  renderComando();
}
function registrarSabotagemComando(){
  const input = document.getElementById('sabotagemInput');
  const nota = (input.value||'').trim();
  if(!nota) return;
  state.comando.sabotagens.push({data:new Date().toISOString(), nota});
  if(state.comando.sabotagens.length>50) state.comando.sabotagens = state.comando.sabotagens.slice(-50);
  input.value = '';
  persist();
  renderComando();
}

/* ========== GOOGLE AGENDA / TAREFAS ==========
   Login do Google direto no navegador (Google Identity Services, sem servidor). O ID do cliente (não é segredo)
   fica em state.comando.google.clientId; o acesso (1 h) fica só neste aparelho. Cada ordem vira uma tarefa com
   data de hoje na lista "Siloé · Ordens" (o Google Agenda mostra as tarefas); feita aqui ou lá, vale nos dois.
   Tarefa criada no Google vira ordem. A agenda de hoje aparece no Comando (só leitura). */
const GOOG_ESCOPOS = 'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar.events.readonly';
const GOOG_TAREFAS = 'https://tasks.googleapis.com/tasks/v1';
const GOOG_LISTA_NOME = 'Siloé · Ordens';
const GOOG_TOKEN_KEY = 'siloe-google-token';
let googTokenClient = null, googAgendaHoje = null, googSincronizando = false, googUltimaSync = 0, googErro = '', googTimer = null;

function googCfg(){ const c = state.comando || (state.comando = {}); if(!c.google) c.google = {}; return c.google; }
function googToken(){
  try{ const t = JSON.parse(localStorage.getItem(GOOG_TOKEN_KEY) || 'null'); if(t && t.token && t.exp > Date.now() + 60000) return t.token; }catch(e){}
  return '';
}
function googDiaKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function googCarregarScript(){
  return new Promise((ok, erro)=>{
    if(window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = ()=> ok(); s.onerror = ()=> erro(new Error('não consegui carregar o login do Google'));
    document.head.appendChild(s);
  });
}
function googSalvarClientId(){
  const v = (document.getElementById('googClientId')?.value || '').trim();
  if(!/\.apps\.googleusercontent\.com$/.test(v)){ showToast('Cole o ID que termina em .apps.googleusercontent.com'); return; }
  googCfg().clientId = v; googTokenClient = null;
  persist();
  googCarregarScript().catch(()=>{});
  renderComando();
}
async function googTrocarClientId(){
  if(!(await iosConfirm('Trocar o ID do cliente Google? Você vai precisar conectar de novo.'))) return;
  googDesconectar(true);
  googCfg().clientId = '';
  persist(); renderComando();
}
/* precisa ser chamado direto de um toque (o Google abre uma janelinha) */
function googConectar(){
  const id = (googCfg().clientId || '').trim();
  if(!id) return;
  if(!(window.google && google.accounts && google.accounts.oauth2)){
    googCarregarScript().then(()=>showToast('Pronto — toque de novo em Conectar')).catch(e=>showToast(e.message));
    return;
  }
  if(!googTokenClient || googTokenClient._id !== id){
    googTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: id, scope: GOOG_ESCOPOS, prompt: '',
      callback: googAoReceberToken,
      error_callback: e=>{ showToast(e && e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google — permita e toque de novo' : 'Login do Google cancelado'); }
    });
    googTokenClient._id = id;
  }
  googTokenClient.requestAccessToken();
}
function googAoReceberToken(r){
  if(!r || r.error){ showToast('Google: ' + ((r && (r.error_description || r.error)) || 'não autorizou')); return; }
  if(!google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/tasks')){ showToast('Marque a permissão do Google Tarefas para sincronizar as ordens'); return; }
  try{ localStorage.setItem(GOOG_TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 })); }catch(e){}
  googCfg().conectado = true; persist();
  showToast('Google conectado');
  googSincronizar();
}
function googDesconectar(silencioso){
  const t = googToken();
  if(t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, ()=>{});
  try{ localStorage.removeItem(GOOG_TOKEN_KEY); }catch(e){}
  googCfg().conectado = false; googAgendaHoje = null; googErro = '';
  persist();
  if(!silencioso){ renderComando(); showToast('Google desconectado'); }
}
async function googApi(metodo, url, corpo){
  const t = googToken();
  if(!t){ const e = new Error('sem acesso'); e.semToken = true; throw e; }
  const res = await fetch(url, { method: metodo, headers: Object.assign({ 'Authorization': 'Bearer ' + t }, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined });
  if(res.status === 401){ try{ localStorage.removeItem(GOOG_TOKEN_KEY); }catch(e){} const e = new Error('o acesso ao Google venceu'); e.semToken = true; throw e; }
  if(res.status === 204) return null;
  const j = await res.json().catch(()=>null);
  if(!res.ok){ const e = new Error((j && j.error && j.error.message) || ('erro ' + res.status)); e.status = res.status; throw e; }
  return j;
}
function googAgendarSync(){
  if(!googToken()) return;
  clearTimeout(googTimer);
  googTimer = setTimeout(()=>googSincronizar(), 1200);
}
async function googSincronizar(){
  if(googSincronizando || !googToken()) return;
  googSincronizando = true; googErro = '';
  googPintarStatus();
  const c = state.comando, g = googCfg();
  let mudou = false;
  try{
    /* lista "Siloé · Ordens" */
    if(g.listaId){ try{ await googApi('GET', `${GOOG_TAREFAS}/users/@me/lists/${encodeURIComponent(g.listaId)}`); }catch(e){ if(e.semToken) throw e; if(e.status === 404){ g.listaId = ''; mudou = true; } else throw e; } }
    if(!g.listaId){
      const ls = await googApi('GET', `${GOOG_TAREFAS}/users/@me/lists?maxResults=100`);
      const achou = (ls && ls.items || []).find(l=>l.title === GOOG_LISTA_NOME);
      g.listaId = achou ? achou.id : (await googApi('POST', `${GOOG_TAREFAS}/users/@me/lists`, { title: GOOG_LISTA_NOME })).id;
      c.ordens.forEach(o=>{ delete o.tarefaId; });   // lista nova: as ordens são ligadas de novo
      mudou = true;
    }
    const L = `${GOOG_TAREFAS}/lists/${encodeURIComponent(g.listaId)}/tasks`;
    /* ordens apagadas no app saem do Google */
    if((g.removidas || []).length){
      for(const id of g.removidas){ try{ await googApi('DELETE', `${L}/${encodeURIComponent(id)}`); }catch(e){ if(e.semToken) throw e; } }
      g.removidas = []; mudou = true;
    }
    const lista = await googApi('GET', `${L}?showCompleted=true&showHidden=true&maxResults=100`);
    const remotas = new Map((lista && lista.items || []).filter(t=>!t.deleted).map(t=>[t.id, t]));
    const hoje = diaKeyHoje(), hojeISO = hoje + 'T00:00:00.000Z';
    for(const o of c.ordens){
      const t = o.tarefaId && remotas.get(o.tarefaId);
      if(!t){
        const nova = await googApi('POST', L, { title: o.texto, due: hojeISO, status: o.feito ? 'completed' : 'needsAction' });
        o.tarefaId = nova.id; o.sincEm = Date.now(); mudou = true;
        continue;
      }
      remotas.delete(o.tarefaId);
      const remotoEm = Date.parse(t.updated) || 0;
      const dueHoje = String(t.due || '').slice(0,10) === hoje;
      const feitoHojeNoGoogle = t.status === 'completed' && t.completed && googDiaKey(new Date(t.completed)) === hoje;
      /* mudança mais nova no Google do que aqui: vale a do Google */
      if(remotoEm > (o.mudouEm || 0) && remotoEm > (o.sincEm || 0)){
        if(feitoHojeNoGoogle && !o.feito){ o.feito = true; o.mudouEm = remotoEm; mudou = true; }
        else if(dueHoje && t.status === 'needsAction' && o.feito){ o.feito = false; o.mudouEm = remotoEm; mudou = true; }
      }
      const patch = {};
      if(!dueHoje) patch.due = hojeISO;
      if(t.title !== o.texto) patch.title = o.texto;
      if((t.status === 'completed') !== !!o.feito){
        patch.status = o.feito ? 'completed' : 'needsAction';
        if(!o.feito) patch.completed = null;
      }
      if(Object.keys(patch).length){ await googApi('PATCH', `${L}/${encodeURIComponent(o.tarefaId)}`, patch); o.sincEm = Date.now(); mudou = true; }
    }
    /* tarefa criada no Google (celular, Agenda) que o app não conhece: vira ordem */
    for(const t of remotas.values()){
      const titulo = String(t.title || '').trim();
      if(!titulo) continue;
      if(t.status === 'completed' && !(t.completed && googDiaKey(new Date(t.completed)) === hoje)) continue;   // concluída em outro dia: fica lá
      c.ordens.push({ id: 'o' + Date.now() + Math.random().toString(36).slice(2,5), texto: titulo, feito: t.status === 'completed', tarefaId: t.id, mudouEm: Date.parse(t.updated) || Date.now(), sincEm: Date.now() });
      mudou = true;
    }
    /* compromissos de hoje (só leitura) */
    try{
      const ini = new Date(); ini.setHours(0,0,0,0);
      const fim = new Date(ini); fim.setDate(fim.getDate() + 1);
      const ev = await googApi('GET', `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=25&timeMin=${encodeURIComponent(ini.toISOString())}&timeMax=${encodeURIComponent(fim.toISOString())}`);
      googAgendaHoje = (ev && ev.items || []).filter(e=>e.status !== 'cancelled').map(e=>({
        titulo: e.summary || '(sem título)',
        hora: e.start && e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''
      }));
    }catch(e){ if(e.semToken) throw e; googAgendaHoje = null; }
    googUltimaSync = Date.now();
  }catch(e){
    googErro = e.semToken ? '' : ((e && e.message) || 'erro');
  }finally{
    googSincronizando = false;
    if(mudou) persist();
    if(document.getElementById('pageComando')?.classList.contains('active')) renderComando();
  }
}
function googAddDaAgenda(i){
  const ev = (googAgendaHoje || [])[i]; if(!ev) return;
  const texto = (ev.hora ? ev.hora + ' · ' : '') + ev.titulo;
  if(state.comando.ordens.some(o=>o.texto === texto)){ showToast('Já está nas ordens'); return; }
  state.comando.ordens.push({ id: 'o' + Date.now(), texto, feito: false, mudouEm: Date.now() });
  persist(); renderComando(); googAgendarSync();
  showToast('Virou ordem');
}
function googPintarStatus(){
  const el = document.getElementById('googStatus'); if(!el) return;
  el.textContent = googSincronizando ? 'Sincronizando…' : googErro ? 'Erro: ' + googErro : googUltimaSync ? 'Sincronizado' : '';
  el.classList.toggle('erro', !!googErro && !googSincronizando);
}
function googCardHtml(){
  const g = googCfg();
  if(!g.clientId) return `
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Google Agenda</span></div>
          <div class="cmd-desc">Suas ordens aparecem no Google Agenda (como tarefas) e os compromissos de hoje aparecem aqui. Para ligar, cole o ID do cliente Google que você criou.</div>
          <form class="cmd-nova" onsubmit="event.preventDefault();googSalvarClientId()">
            <input type="text" id="googClientId" class="cmd-campo" placeholder="ID do cliente Google" autocomplete="off" spellcheck="false">
            <button type="submit" class="cmd-btn-icone escuro" aria-label="Salvar ID" title="Salvar">${CMD_CHECK}</button>
          </form>
        </div>`;
  if(!googToken()) return `
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Google Agenda</span></div>
          <div class="cmd-desc">${g.conectado ? 'O acesso ao Google dura 1 hora por segurança. Toque para continuar sincronizando.' : 'Conecte sua conta Google para sincronizar as ordens e ver a agenda de hoje.'}</div>
          <button type="button" class="btn btn-block cmd-google-btn" onclick="googConectar()">${g.conectado ? 'Reconectar' : 'Conectar com Google'}</button>
          <div class="cmd-google-rodape"><span></span><button type="button" class="cmd-link" onclick="googTrocarClientId()">Trocar ID</button></div>
        </div>`;
  const agenda = googAgendaHoje === null
    ? `<div class="cmd-vazio">${googSincronizando ? 'Carregando a agenda…' : 'Toque em Sincronizar para ver a agenda.'}</div>`
    : googAgendaHoje.length
      ? googAgendaHoje.map((e,i)=>`<div class="cmd-evento"><span class="cmd-evento-hora">${e.hora || 'Dia todo'}</span><span class="cmd-evento-titulo">${cmdEsc(e.titulo)}</span><button type="button" class="btn-icon-sm" onclick="googAddDaAgenda(${i})" title="Virar ordem" aria-label="Virar ordem">${CMD_MAIS}</button></div>`).join('')
      : `<div class="cmd-vazio">Nada na agenda hoje.</div>`;
  const status = googSincronizando ? 'Sincronizando…' : googErro ? 'Erro: ' + cmdEsc(googErro) : googUltimaSync ? 'Sincronizado' : '';
  return `
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Agenda de hoje</span><span class="cmd-card-conta${googErro && !googSincronizando ? ' erro' : ''}" id="googStatus">${status}</span></div>
          <div class="cmd-eventos">${agenda}</div>
          <div class="cmd-google-rodape"><span>Ordens no Google Tarefas · “${GOOG_LISTA_NOME}”</span><span><button type="button" class="cmd-link" onclick="googSincronizar()">Sincronizar</button> · <button type="button" class="cmd-link" onclick="googDesconectar()">Desconectar</button></span></div>
        </div>`;
}
