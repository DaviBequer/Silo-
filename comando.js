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
    /* com meta do dia: ontem conta se bateu o % até a hora, mesmo sem ter tocado em Fechar */
    if(!eraPrimeiraVez && !state.comando.diaFechado && cmdDiaProdutivo(state.comando.ultimoDia)) cmdMarcarDiaFechado();
    if(!eraPrimeiraVez && typeof jgFecharDia === 'function') jgFecharDia(state.comando.ultimoDia);   // XP de ontem fica garantido
    const quebrou = !eraPrimeiraVez && !state.comando.diaFechado;
    if(quebrou && typeof jgUsarEscudo === 'function' && state.comando.streak > 0 && jgUsarEscudo()){
      state.comando.rupturaHoje = 'escudo';   // o escudo segurou a sequência
    } else if(quebrou){
      state.comando.streak = 0;
      state.comando.rupturaHoje = true;
    } else {
      state.comando.rupturaHoje = false;
    }
    state.comando.ordens.forEach(o=>{
      o.feito = false; delete o.feitoEm; (o.sub||[]).forEach(s=>{ s.feito = false; delete s.feitoEm; });
      if(o.adiadaAte && o.adiadaAte <= hoje) delete o.adiadaAte;   // chegou o dia: volta para a lista
    });
    state.comando.diaFechado = false;
    state.comando.ultimoDia = hoje;
    persist();
  }
}

function abrirComando(){ switchAba('comando'); }

function cmdEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
const CMD_MIC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>';
const CMD_MAIS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const CMD_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CMD_SUB = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h10"/><path d="M8 12h12"/><path d="M8 19h12"/><path d="M4 12v7"/></svg>';
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

/* ---------- prioridade e adiar ----------
   o.prio = 1 Alta · 2 Média · 3 Baixa (sem = sem prioridade); a lista mostra as de maior prioridade primeiro.
   o.adiadaAte = 'AAAA-MM-DD': some de hoje e volta nesse dia (não conta no dia, nem na meta). */
const CMD_PRIO = { 1:'Alta', 2:'Média', 3:'Baixa' };
const CMD_BANDEIRA = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h13l-2.5 4.5L17 13H4"/></svg>';
const CMD_BANDEIRA_VAZIA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 4h13l-2.5 4.5L17 13H4"/></svg>';
const CMD_MAIS_OPCOES = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const CMD_VOLTAR = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>';
let cmdAcoesAberta = null;   // ordem com as opções abertas (só na tela)
let cmdNovaPrio = 0;         // prioridade da próxima ordem
function cmdOrdensHoje(){
  const hoje = diaKeyHoje();
  return state.comando.ordens
    .map((o, i)=>({ o, i }))
    .filter(x=>!x.o.adiadaAte || x.o.adiadaAte <= hoje)
    .sort((a, b)=>(a.o.prio || 9) - (b.o.prio || 9) || a.i - b.i)
    .map(x=>x.o);
}
function cmdOrdensAdiadas(){
  const hoje = diaKeyHoje();
  return state.comando.ordens.filter(o=>o.adiadaAte && o.adiadaAte > hoje).sort((a, b)=>a.adiadaAte.localeCompare(b.adiadaAte));
}
function cmdDiaMais(n){ const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() + n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function cmdNomeDia(iso){
  if(iso === cmdDiaMais(1)) return 'amanhã';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' }).replace('.', '');
}
function cmdAcoesHtml(o){
  const prio = [1,2,3,0].map(p=>`<button type="button" class="cmd-chip${(o.prio||0)===p?' ativo':''}${p?' p'+p:''}" onclick="cmdDefinirPrio('${o.id}',${p})">${p ? CMD_PRIO[p] : 'Sem'}</button>`).join('');
  return `
    <div class="cmd-acoes">
      <div class="cmd-acoes-linha"><span>Prioridade</span><div class="cmd-chips">${prio}</div></div>
      <div class="cmd-acoes-linha"><span>Jogar para</span><div class="cmd-chips">
        <button type="button" class="cmd-chip" onclick="cmdAdiar('${o.id}','${cmdDiaMais(1)}')">Amanhã</button>
        <button type="button" class="cmd-chip" onclick="cmdAdiar('${o.id}','${cmdDiaMais(2)}')">${cmdNomeDia(cmdDiaMais(2))}</button>
        <button type="button" class="cmd-chip" onclick="cmdEscolherDia('${o.id}', this)">Escolher dia</button>
        <input type="hidden" id="cmdAdiarData-${o.id}" onchange="if(this.value)cmdAdiar('${o.id}',this.value)">
      </div></div>
      <button type="button" class="cmd-acoes-remover" onclick="excluirOrdemComando('${o.id}')">${CMD_X} Remover ordem</button>
    </div>`;
}
function cmdAbrirAcoes(id){ cmdAcoesAberta = cmdAcoesAberta === id ? null : id; renderComando(); }
function cmdDefinirPrio(id, p){
  const o = cmdOrdem(id); if(!o) return;
  if(p) o.prio = p; else delete o.prio;
  cmdAcoesAberta = null;
  persist();
  renderComando();
}
function cmdCiclarNovaPrio(){
  cmdNovaPrio = (cmdNovaPrio + 1) % 4;   // sem → Alta → Média → Baixa → sem
  const b = document.getElementById('cmdNovaPrioBtn');
  if(b){ b.className = 'cmd-btn-icone cmd-prio-btn' + (cmdNovaPrio ? ' p' + cmdNovaPrio : ''); b.innerHTML = cmdNovaPrio ? CMD_BANDEIRA : CMD_BANDEIRA_VAZIA; b.title = b.ariaLabel = 'Prioridade: ' + (CMD_PRIO[cmdNovaPrio] || 'sem'); }
  showToast('Prioridade da nova ordem: ' + (CMD_PRIO[cmdNovaPrio] || 'sem'));
  document.getElementById('cmdNovaOrdem')?.focus();
}
function cmdEscolherDia(id, btn){
  const inp = document.getElementById('cmdAdiarData-' + id); if(!inp) return;
  if(typeof abrirCalendario === 'function') abrirCalendario(inp, btn);
  else inp.showPicker?.();
}
function cmdAdiar(id, dia){
  const o = cmdOrdem(id); if(!o || !dia) return;
  if(dia <= diaKeyHoje()){ showToast('Escolha um dia depois de hoje'); return; }
  cmdAcoesAberta = null;
  comDesfazer(`Ordem jogada para ${cmdNomeDia(dia)}`, ()=>{
    o.adiadaAte = dia;
    cmdMarcar(o, false);
    persist();
    cmdChecarMeta();
    renderComando();
  }, ()=>{ if(document.getElementById('aba-comando')?.classList.contains('active')) renderComando(); });
}
function cmdTrazerHoje(id){
  const o = cmdOrdem(id); if(!o) return;
  delete o.adiadaAte;
  persist();
  renderComando();
}

function renderComando(){
  const c = state.comando;
  if(typeof jgChecar === 'function') jgChecar();   // desafio vencido, conquistas, subiu de nível
  const ordensHoje = cmdOrdensHoje();
  const total = ordensHoje.length, feitas = ordensHoje.filter(o=>o.feito).length;
  const todasFeitas = total > 0 && feitas === total;
  const pct = total ? Math.round(feitas/total*100) : 0;

  const ordensHtml = ordensHoje.map(o=>{
    const subs = o.sub || [], subFeitas = subs.filter(s=>s.feito).length, aberta = !!cmdSubAberta[o.id];
    const acoes = cmdAcoesAberta === o.id;
    return `
    <div class="cmd-ordem${o.feito?' feita':''}${o.prio?' p'+o.prio:''}">
      <button type="button" class="cmd-check" onclick="toggleOrdemComando('${o.id}')" aria-label="${o.feito?'Desmarcar':'Marcar como feita'}">${o.feito?CMD_CHECK:''}</button>
      <div class="cmd-ordem-texto" id="ordemTexto-${o.id}" onclick="editarOrdemComando('${o.id}')">${cmdEsc(o.texto)}${o.prio ? `<span class="cmd-prio-tag p${o.prio}">${CMD_PRIO[o.prio]}</span>` : ''}</div>
      <button type="button" class="cmd-sub-btn${aberta?' aberta':''}${subs.length?' tem':''}" onclick="event.stopPropagation();cmdAbrirSub('${o.id}')" aria-label="Subtarefas" title="Subtarefas">${subs.length ? `${subFeitas}/${subs.length}` : CMD_SUB}</button>
      <button type="button" class="btn-icon-sm cmd-ordem-del${acoes?' aberta':''}" onclick="event.stopPropagation();cmdAbrirAcoes('${o.id}')" aria-label="Prioridade, adiar, remover" title="Prioridade, adiar, remover">${CMD_MAIS_OPCOES}</button>
    </div>${acoes ? cmdAcoesHtml(o) : ''}${aberta ? `
    <div class="cmd-subs">
      ${subs.map(s=>`
      <div class="cmd-sub${s.feito?' feita':''}">
        <button type="button" class="cmd-check cmd-check-sub" onclick="toggleSubComando('${o.id}','${s.id}')" aria-label="${s.feito?'Desmarcar':'Marcar como feita'}">${s.feito?CMD_CHECK:''}</button>
        <div class="cmd-ordem-texto" id="subTexto-${s.id}" onclick="editarSubComando('${o.id}','${s.id}')">${cmdEsc(s.texto)}</div>
        <button type="button" class="btn-icon-sm cmd-ordem-del" onclick="excluirSubComando('${o.id}','${s.id}')" aria-label="Remover subtarefa" title="Remover">${CMD_X}</button>
      </div>`).join('')}
      <form class="cmd-sub-nova" onsubmit="event.preventDefault();adicionarSubComando('${o.id}')">
        <input type="text" id="cmdNovaSub-${o.id}" class="cmd-campo" placeholder="Nova subtarefa" autocomplete="off" enterkeyhint="done" onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();adicionarSubComando('${o.id}')}">
        <button type="submit" class="cmd-btn-icone" aria-label="Adicionar subtarefa" title="Adicionar">${CMD_MAIS}</button>
      </form>
    </div>` : ''}`;
  }).join('') || `<div class="cmd-vazio">Nenhuma ordem. Escreva ou dite a primeira abaixo.</div>`;

  const faltam = total - feitas;
  const botaoFechar = c.diaFechado
    ? `<button type="button" class="cmd-fechar fechado" disabled>${CMD_CHECK} ${cmdMeta() ? 'Dia produtivo' : 'Dia fechado'}</button>`
    : cmdMeta() ? ''   // com meta, o dia fecha sozinho ao bater o %
    : todasFeitas
      ? `<button type="button" class="btn btn-block cmd-fechar" onclick="fecharDiaComando()">Fechar o dia</button>`
      : `<button type="button" class="cmd-fechar" disabled>${total ? `Falta${faltam>1?'m':''} ${faltam} orde${faltam>1?'ns':'m'} para fechar o dia` : 'Adicione uma ordem para começar'}</button>`;

  const adiadas = cmdOrdensAdiadas();
  const adiadasHtml = adiadas.length ? `
        <div class="cmd-adiadas">
          <div class="cmd-adiadas-titulo">Para outros dias</div>
          ${adiadas.map(o=>`
          <div class="cmd-adiada">
            <span class="cmd-adiada-dia">${cmdNomeDia(o.adiadaAte)}</span>
            <span class="cmd-adiada-texto">${cmdEsc(o.texto)}${o.prio ? `<span class="cmd-prio-tag p${o.prio}">${CMD_PRIO[o.prio]}</span>` : ''}</span>
            <button type="button" class="btn-icon-sm" onclick="cmdTrazerHoje('${o.id}')" aria-label="Trazer para hoje" title="Trazer para hoje">${CMD_VOLTAR}</button>
          </div>`).join('')}
        </div>` : '';

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
      ${c.rupturaHoje === 'escudo' ? `<div class="cmd-ruptura escudo">Ontem não foi fechado, mas um escudo salvou sua sequência.</div>` : c.rupturaHoje ? `<div class="cmd-ruptura">Ontem não foi fechado — a sequência recomeçou. Reorganize e siga.</div>` : ''}
      ${typeof jgJogadorHtml === 'function' ? jgJogadorHtml() : ''}
    </div>

    <div class="cmd-grade">
      <div class="cmd-card cmd-card-ordens">
        <div class="cmd-card-topo"><span class="cmd-card-titulo">Ordens de hoje</span><span class="cmd-card-conta">${feitas} de ${total}</span></div>
        <div class="cmd-barra"><div style="width:${cmdMeta() ? Math.round(cmdProgresso()*100) : pct}%"></div>${cmdMeta() ? `<i class="cmd-barra-meta" style="left:${cmdMeta().pct}%"></i>` : ''}</div>
        ${cmdMetaHtml()}
        <div class="cmd-ordens">${ordensHtml}</div>
        <form class="cmd-nova" onsubmit="event.preventDefault();adicionarOrdemComando()">
          <input type="text" id="cmdNovaOrdem" class="cmd-campo" placeholder="Nova ordem" autocomplete="off" enterkeyhint="send" onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();adicionarOrdemComando()}">
          <button type="button" class="cmd-btn-icone cmd-prio-btn${cmdNovaPrio?' p'+cmdNovaPrio:''}" id="cmdNovaPrioBtn" onclick="cmdCiclarNovaPrio()" aria-label="Prioridade: ${CMD_PRIO[cmdNovaPrio]||'sem'}" title="Prioridade: ${CMD_PRIO[cmdNovaPrio]||'sem'}">${cmdNovaPrio?CMD_BANDEIRA:CMD_BANDEIRA_VAZIA}</button>
          <button type="button" class="cmd-btn-icone" id="cmdMic" onclick="cmdDitar('cmdNovaOrdem', this)" aria-label="Ditar por voz" title="Ditar por voz">${CMD_MIC}</button>
          <button type="submit" class="cmd-btn-icone escuro" aria-label="Adicionar ordem" title="Adicionar">${CMD_MAIS}</button>
        </form>
        ${botaoFechar}
        ${adiadasHtml}
      </div>

      <div class="cmd-coluna">
        ${typeof jgDesafioHtml === 'function' ? jgDesafioHtml() : ''}
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Juramento</span></div>
          ${juramentoHtml}
        </div>
        <div class="cmd-card">
          <div class="cmd-card-topo"><span class="cmd-card-titulo">Peguei-me sabotando</span></div>
          <div class="cmd-desc">Anote na hora o que quase te derrubou.</div>
          <form class="cmd-nova" onsubmit="event.preventDefault();registrarSabotagemComando()">
            <input type="text" id="sabotagemInput" class="cmd-campo" placeholder="O que aconteceu agora?" autocomplete="off" enterkeyhint="send" onkeydown="if(event.key==='Enter'&&!event.isComposing){event.preventDefault();registrarSabotagemComando()}">
            <button type="button" class="cmd-btn-icone" onclick="cmdDitar('sabotagemInput', this)" aria-label="Ditar por voz" title="Ditar por voz">${CMD_MIC}</button>
            <button type="submit" class="cmd-btn-icone escuro" aria-label="Registrar" title="Registrar">${CMD_MAIS}</button>
          </form>
          ${sabotagensHtml ? `<div class="cmd-sabs">${sabotagensHtml}</div>` : ''}
        </div>
        ${typeof jgConquistasHtml === 'function' ? jgConquistasHtml() : ''}
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
  /* com subtarefas, a ordem só conclui quando todas estiverem feitas */
  if((o.sub||[]).length){
    const faltam = o.sub.filter(s=>!s.feito).length;
    if(faltam){ cmdSubAberta[o.id] = true; renderComando(); showToast(`Falta${faltam>1?'m':''} ${faltam} subtarefa${faltam>1?'s':''} para concluir`); }
    return;
  }
  cmdComXp(`[onclick="toggleOrdemComando('${id}')"]`, ()=>cmdMarcar(o, !o.feito));
}
/* marca/desmarca mostrando o XP ganho (ou devolvido) no lugar do toque */
function cmdComXp(seletor, marcar){
  const antes = typeof jgHoje === 'function' ? jgHoje().xp : 0;
  const alvo = document.querySelector(seletor);
  marcar();
  if(typeof jgFlutuar === 'function') jgFlutuar(alvo, jgHoje().xp - antes);
  persist();
  cmdChecarMeta();
  renderComando();
}
/* ---------- subtarefas: cada ordem pode ter uma lista; todas feitas = ordem feita ---------- */
let cmdSubAberta = {};   // ordem id → lista aberta (só na tela)
function cmdOrdem(id){ return state.comando.ordens.find(x=>x.id===id); }
function cmdAbrirSub(id){
  cmdSubAberta[id] = !cmdSubAberta[id];
  renderComando();
  if(cmdSubAberta[id] && !(cmdOrdem(id)?.sub||[]).length) document.getElementById('cmdNovaSub-'+id)?.focus();
}
function cmdAtualizarOrdemPelasSubs(o){
  if(!(o.sub||[]).length) return;
  const todas = o.sub.every(s=>s.feito);
  if(todas !== !!o.feito) cmdMarcar(o, todas);
}
function cmdMarcar(x, feito){ x.feito = feito; if(feito) x.feitoEm = Date.now(); else delete x.feitoEm; }

/* ---------- meta do dia: "80% até 18:00" — batendo o % até a hora, o dia é produtivo (fecha sozinho) ----------
   Cada ordem vale 1; com subtarefas, vale a fração feita (2 de 4 = 0,5). Só conta o que foi marcado até a hora. */
function cmdMeta(){ const m = state.comando.metaDia; return m && m.hora && m.pct ? m : null; }
function cmdLimite(diaKey){ const m = cmdMeta(); return m ? new Date(diaKey + 'T' + m.hora + ':00').getTime() : null; }
function cmdProgresso(ate){
  const ords = cmdOrdensHoje(); if(!ords.length) return 0;
  const vale = x=>x.feito && !(ate && x.feitoEm > ate);
  return ords.reduce((s, o)=>s + ((o.sub||[]).length ? o.sub.filter(vale).length / o.sub.length : (vale(o) ? 1 : 0)), 0) / ords.length;
}
function cmdDiaProdutivo(diaKey){
  const m = cmdMeta(); if(!m) return false;
  return cmdProgresso(cmdLimite(diaKey)) * 100 >= m.pct - 0.001;
}
function cmdChecarMeta(){
  const c = state.comando, m = cmdMeta();
  if(!m || c.diaFechado || Date.now() > cmdLimite(c.ultimoDia)) return;
  if(cmdProgresso() * 100 >= m.pct - 0.001){
    cmdMarcarDiaFechado();
    persist();
    showToast(`Meta batida: dia produtivo! ${c.streak} dia${c.streak===1?'':'s'} seguido${c.streak===1?'':'s'}`);
  }
}
function cmdMarcarDiaFechado(){
  const c = state.comando;
  c.diaFechado = true;
  c.diasFechados = (c.diasFechados || []).filter(d=>d !== c.ultimoDia).concat(c.ultimoDia).slice(-60);   // bolinhas da semana
  c.streak += 1;
  c.recorde = Math.max(c.recorde, c.streak);
  c.rupturaHoje = false;
  if(typeof jgDiaFechado === 'function') jgDiaFechado();
}
let cmdMetaEditando = false;
function cmdEditarMeta(v){ cmdMetaEditando = v; renderComando(); }
function cmdSalvarMeta(){
  const hora = document.getElementById('cmdMetaHora').value, pct = Number(document.getElementById('cmdMetaPct').value);
  state.comando.metaDia = hora && pct ? { hora, pct } : null;
  cmdMetaEditando = false;
  persist();
  cmdChecarMeta();
  renderComando();
}
function cmdTirarMeta(){ state.comando.metaDia = null; cmdMetaEditando = false; persist(); renderComando(); }
function cmdMetaHtml(){
  const m = cmdMeta(), c = state.comando;
  if(cmdMetaEditando){
    const pcts = [50,60,70,75,80,90,100];
    return `<form class="cmd-meta-form" onsubmit="event.preventDefault();cmdSalvarMeta()">
      <span>Produtivo com</span>
      <select id="cmdMetaPct" class="cmd-campo">${pcts.map(p=>`<option value="${p}"${(m ? m.pct : 80)===p?' selected':''}>${p}%</option>`).join('')}</select>
      <span>até</span>
      <input type="time" id="cmdMetaHora" class="cmd-campo" value="${m ? m.hora : '18:00'}">
      <button type="submit" class="cmd-btn-icone escuro" aria-label="Salvar meta">${CMD_CHECK}</button>
      ${m ? `<button type="button" class="link-btn-sm" onclick="cmdTirarMeta()">Tirar meta</button>` : ''}
    </form>`;
  }
  if(!m) return `<button type="button" class="cmd-meta-linha vazia" onclick="cmdEditarMeta(true)">Definir meta do dia (ex.: 80% até 18:00)</button>`;
  const agora = Math.round(cmdProgresso() * 100), passou = Date.now() > cmdLimite(c.ultimoDia);
  const estado = c.diaFechado ? `<b class="ok">dia produtivo ✓</b>` : passou ? `<b class="neg">meta perdida hoje</b>` : `agora <b>${agora}%</b>`;
  return `<button type="button" class="cmd-meta-linha" onclick="cmdEditarMeta(true)"><span>Meta: <b>${m.pct}%</b> até <b>${m.hora}</b></span><span>${estado}</span></button>`;
}
function adicionarSubComando(id){
  const o = cmdOrdem(id), inp = document.getElementById('cmdNovaSub-'+id);
  const texto = (inp && inp.value || '').trim();
  if(!o || !texto){ inp?.focus(); return; }
  if(!o.sub) o.sub = [];
  o.sub.push({ id:'s'+Date.now(), texto, feito:false });
  o.feito = false;
  persist();
  renderComando();
  document.getElementById('cmdNovaSub-'+id)?.focus();
}
function toggleSubComando(id, subId){
  const o = cmdOrdem(id), s = o && (o.sub||[]).find(x=>x.id===subId);
  if(!s) return;
  cmdComXp(`[onclick="toggleSubComando('${id}','${subId}')"]`, ()=>{ cmdMarcar(s, !s.feito); cmdAtualizarOrdemPelasSubs(o); });
}
function editarSubComando(id, subId){
  const o = cmdOrdem(id), s = o && (o.sub||[]).find(x=>x.id===subId);
  if(!s) return;
  const el = document.getElementById('subTexto-'+subId);
  el.outerHTML = `<input type="text" id="subTexto-${subId}" class="cmd-campo cmd-editando" value="${cmdEsc(s.texto)}" onblur="salvarSubComando('${id}','${subId}',this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  document.getElementById('subTexto-'+subId).focus();
}
function salvarSubComando(id, subId, texto){
  const o = cmdOrdem(id), s = o && (o.sub||[]).find(x=>x.id===subId);
  if(!s) return;
  const novo = (texto||'').trim() || s.texto;
  if(novo !== s.texto){ s.texto = novo; persist(); }
  renderComando();
}
function excluirSubComando(id, subId){
  comDesfazer('Subtarefa removida', ()=>{
    const o = cmdOrdem(id); if(!o) return;
    o.sub = (o.sub||[]).filter(x=>x.id!==subId);
    cmdAtualizarOrdemPelasSubs(o);
    persist();
    renderComando();
  }, ()=>{ if(document.getElementById('aba-comando')?.classList.contains('active')) renderComando(); });
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
  state.comando.ordens.push(Object.assign({ id:'o'+Date.now(), texto, feito:false }, cmdNovaPrio ? { prio: cmdNovaPrio } : {}));
  persist();
  renderComando();
  document.getElementById('cmdNovaOrdem')?.focus();
}
function excluirOrdemComando(id){
  cmdAcoesAberta = null;
  comDesfazer('Ordem removida', ()=>{
    state.comando.ordens = state.comando.ordens.filter(x=>x.id!==id);
    persist();
    cmdChecarMeta();
    renderComando();
  }, ()=>{ if(document.getElementById('aba-comando')?.classList.contains('active')) renderComando(); });
}
function fecharDiaComando(){
  const c = state.comando;
  if(c.diaFechado || !cmdOrdensHoje().length || !cmdOrdensHoje().every(o=>o.feito)) return;
  cmdMarcarDiaFechado();
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
  const xp = typeof jgSabotagem === 'function' ? jgSabotagem() : 0;
  if(xp) jgFlutuar(input, xp);
  input.value = '';
  persist();
  renderComando();
}
