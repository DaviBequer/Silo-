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
  /* a ligação com o Google saiu (a pedido): limpa o que ela deixou nos dados */
  if(state.comando.google){
    delete state.comando.google;
    state.comando.ordens.forEach(o=>{ delete o.tarefaId; delete o.sincEm; delete o.mudouEm; });
    persist();
  }
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
    state.comando.ordens.forEach(o=>o.feito=false);
    state.comando.diaFechado = false;
    state.comando.ultimoDia = hoje;
    persist();
  }
}

function abrirComando(){
  garantirEstadoComando();
  document.getElementById('pageComando').classList.add('active');
  renderComando();
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
  r.onresult = e=>{ let t = ''; for(const res of e.results) t += res[0].transcript; inp.value = base + t.trim(); falou = true; if(typeof jarvisTexto==='function') jarvisTexto(t.trim()); };
  r.onerror = e=>{ if(e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('Permita o uso do microfone para ditar'); };
  r.onend = ()=>{
    cmdReconhecendo = null;
    btn.classList.remove('ouvindo');
    if(typeof jarvisFechar==='function') jarvisFechar();
    if(falou && inputId === 'cmdNovaOrdem' && inp.value.trim()) adicionarOrdemComando();
  };
  try{
    r.start(); cmdReconhecendo = r; btn.classList.add('ouvindo');
    if(typeof jarvisAbrir==='function') jarvisAbrir({ titulo: inputId === 'cmdNovaOrdem' ? 'Fale a ordem do dia' : 'Fale o que te sabota', aoParar: ()=>{ try{ r.stop(); }catch(_){ jarvisFechar(); } } });
    else showToast('Pode falar…');
  }
  catch(e){ showToast('Não consegui ligar o microfone'); }
}

function toggleOrdemComando(id){
  const o = state.comando.ordens.find(x=>x.id===id);
  if(!o) return;
  o.feito = !o.feito;
  persist();
  renderComando();
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
  if(novo !== o.texto){ o.texto = novo; persist(); }
  renderComando();
}
function adicionarOrdemComando(){
  const inp = document.getElementById('cmdNovaOrdem');
  const texto = (inp && inp.value || '').trim();
  if(!texto){ inp?.focus(); return; }
  state.comando.ordens.push({ id:'o'+Date.now(), texto, feito:false });
  persist();
  renderComando();
  document.getElementById('cmdNovaOrdem')?.focus();
}
async function excluirOrdemComando(id){
  const ok = await iosConfirm('Remover esta ordem?');
  if(!ok) return;
  state.comando.ordens = state.comando.ordens.filter(x=>x.id!==id);
  persist();
  renderComando();
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
