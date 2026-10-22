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
  const hoje = diaKeyHoje(), c = state.comando;
  if(!c.folgas) c.folgas = [];
  /* tipo da ordem: todo dia (hábito) ou uma vez só (tarefa). As 4 ordens padrão são de todo dia; as outras antigas, de uma vez */
  c.ordens.forEach(o=>{ if(o.repete === undefined){ o.repete = /^o\d$/.test(o.id); o.semCusto = hoje; } });   // no dia da mudança, apagar ordem antiga é de graça
  if(c.ultimoDia !== hoje){
    if(c.revisao) cmdConcluirRevisao(true);   // a revisão de anteontem ficou esquecida: vale como estava
    if(c.ultimoDia){
      const dia = c.ultimoDia;
      /* com meta do dia: ontem conta se bateu o % até a hora, mesmo sem ter tocado em Fechar */
      if(!c.diaFechado && cmdDiaProdutivo(dia)) cmdMarcarDiaFechado(dia);
      const rev = { dia, ordens: cmdFotoDoDia(dia), diasSemAbrir: Math.max(0, cmdDiasEntre(dia, hoje) - 1), fechou: c.diaFechado, folga: cmdEhFolga(dia), perdoarAusencia: false };
      /* ficou algo sem marcar (e o dia não foi fechado nem era folga): o Davi revisa antes de contar.
         Ele pode ter feito e esquecido de anotar, ou ter tido um imprevisto. */
      const precisaRevisar = rev.diasSemAbrir > 0 || (!rev.fechou && !rev.folga && rev.ordens.some(o=>o.escolha !== 'fiz'));
      if(precisaRevisar) c.revisao = rev;
      else cmdAplicarDia(rev);
      cmdVirarOrdens(dia, hoje);
    }
    if(c.revisao) c.rupturaHoje = false;
    c.diaFechado = false;
    c.ultimoDia = hoje;
    persist();
  }
}

/* ---------- virada do dia: foto, revisão e contas ---------- */
function cmdDiasEntre(a, b){ return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
/* como estavam as ordens daquele dia (antes de zerar). frac = quanto ficou pronto; fracXp = quanto foi feito NAQUELE dia
   (subtarefas feitas em dias anteriores já renderam XP) */
function cmdFotoDoDia(dia){
  const ini = new Date(dia + 'T00:00:00').getTime();
  return cmdOrdensHoje(dia).map(o=>{
    const subs = o.sub || [], feitas = subs.filter(s=>s.feito);
    const frac = subs.length ? feitas.length / subs.length : (o.feito ? 1 : 0);
    const fracXp = subs.length ? feitas.filter(s=>!(s.feitoEm < ini)).length / subs.length : frac;
    return { id: o.id, texto: o.texto, prio: o.prio || 0, repete: !!o.repete, frac, fracXp, sub: subs.length ? `${feitas.length}/${subs.length}` : '', escolha: frac >= 1 ? 'fiz' : 'nao' };
  });
}
/* zera para o dia novo: hábitos desmarcam; tarefa de uma vez concluída sai; tarefa pendente continua (com a data de quando ficou para trás) */
function cmdVirarOrdens(dia, hoje){
  const c = state.comando;
  c.ordens = c.ordens.filter(o=>o.repete || !o.feito);
  c.ordens.forEach(o=>{
    if(o.repete){ o.feito = false; delete o.feitoEm; (o.sub||[]).forEach(s=>{ s.feito = false; delete s.feitoEm; }); }
    else if(!o.desde && !(o.adiadaAte && o.adiadaAte > dia) && o.imprevisto !== dia) o.desde = dia;
    if(o.adiadaAte && o.adiadaAte <= hoje) delete o.adiadaAte;   // chegou o dia: volta para a lista
    if(o.imprevisto && o.imprevisto < hoje) delete o.imprevisto;
  });
}
/* conta o dia (na hora da virada ou quando a revisão termina): XP, multas, sequência, escudo, relatório */
let cmdSimulando = false;
function cmdAplicarDia(rev){
  const c = state.comando;
  const contaveis = rev.ordens.filter(o=>o.escolha !== 'imprevisto');
  const tudoImprevisto = rev.ordens.length > 0 && !contaveis.length;
  const livre = rev.folga || tudoImprevisto;   // folga ou só imprevistos: nada conta, a sequência fica parada
  let fechou = rev.fechou || (c.diasFechados || []).includes(rev.dia);
  /* fez tudo (marcando na hora ou na revisão) e só esqueceu de tocar em Fechar: o dia fecha */
  if(!fechou && !livre && contaveis.length && contaveis.every(o=>o.escolha === 'fiz')){ cmdMarcarDiaFechado(rev.dia); fechou = true; rev.fechouNaRevisao = true; }
  /* sequência: dia não cumprido e cada dia sem abrir o app precisam de um escudo cada; sem escudo, zera */
  const seqAntes = c.streak;
  const falhas = (fechou || livre ? 0 : 1) + rev.diasSemAbrir;
  let perdeuSeq = false;
  if(!falhas) c.rupturaHoje = false;
  else if(c.streak > 0 && typeof jgEstado === 'function' && jgEstado().escudos >= falhas){ jgEstado().escudos -= falhas; c.rupturaHoje = 'escudo'; }
  else { perdeuSeq = c.streak > 0; c.streak = 0; c.rupturaHoje = true; }
  if(typeof jgAplicarDia === 'function') jgAplicarDia(rev, { fechou, livre, perdeuSeq, seqAntes });
  /* tarefa de uma vez que ele disse que fez: sai da lista */
  rev.ordens.forEach(f=>{ if(f.escolha === 'fiz' && !f.repete) c.ordens = c.ordens.filter(o=>o.id !== f.id); });
}

/* ---------- revisão de ontem ---------- */
function cmdRevisaoEscolher(id, escolha){
  const r = state.comando.revisao, o = r && r.ordens.find(x=>x.id === id); if(!o) return;
  if(escolha === 'imprevisto' && o.escolha !== 'imprevisto' && cmdImprevistosRestantes(r.dia) <= 0){ showToast(`Os ${JG_IMPREVISTOS_SEMANA} imprevistos desta semana já foram usados`); return; }
  o.escolha = escolha;
  persist(); renderComando();
}
function cmdRevisaoFolga(){
  const r = state.comando.revisao; if(!r) return;
  if(!r.folga && !cmdFolgaLivre(r.dia)){ showToast('A folga desta semana já foi usada'); return; }
  r.folga = !r.folga;
  persist(); renderComando();
}
function cmdRevisaoAusencia(){ const r = state.comando.revisao; if(!r) return; r.perdoarAusencia = !r.perdoarAusencia; persist(); renderComando(); }
function cmdConcluirRevisao(auto){
  const c = state.comando, r = c.revisao; if(!r) return;
  c.revisao = null;
  if(r.folga) cmdMarcarFolga(r.dia);
  r.ordens.filter(o=>o.escolha === 'imprevisto').forEach(()=>jgUsarImprevisto(r.dia));
  cmdAplicarDia(r);
  persist();
  if(!auto) renderComando();
}
/* quanto a revisão vai dar, antes de confirmar (roda numa cópia e desfaz) */
function cmdPreverRevisao(){
  const c = state.comando, r = c.revisao; if(!r) return null;
  const copia = JSON.stringify(c);
  cmdSimulando = true;
  try{ c.revisao = null; if(r.folga) cmdMarcarFolga(r.dia); cmdAplicarDia(JSON.parse(JSON.stringify(r))); return { total: c.jogo.relatorio ? c.jogo.relatorio.total : 0, streak: c.streak, ruptura: c.rupturaHoje }; }
  finally{ Object.keys(c).forEach(k=>delete c[k]); Object.assign(c, JSON.parse(copia)); cmdSimulando = false; }   // volta no MESMO objeto
}
function cmdRevisaoHtml(){
  const c = state.comando, r = c.revisao; if(!r) return '';
  const dia = new Date(r.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' });
  const prev = cmdPreverRevisao() || { total: 0 };
  const restam = cmdImprevistosRestantes(r.dia);
  const pend = r.fechou ? [] : r.ordens.filter(o=>o.frac < 1);   // dia fechado: só falta explicar os dias fora
  const chip = (o, v, txt)=>`<button type="button" class="cmd-chip${o.escolha === v ? ' ativo ' + v : ''}" onclick="cmdRevisaoEscolher('${o.id}','${v}')">${txt}</button>`;
  return `
    <div class="cmd-revisao">
      <div class="jg-rel-topo"><span>Revisão de ontem</span><small>${dia}</small></div>
      <div class="cmd-rev-desc">${pend.length ? 'Fez alguma coisa e não marcou? Teve imprevisto? Corrija antes de contar.' : 'Você ficou dias sem abrir o Comando.'}</div>
      ${r.folga ? '' : pend.map(o=>`
        <div class="cmd-rev-ordem">
          <div class="cmd-rev-texto">${cmdEsc(o.texto)}${o.prio ? `<span class="cmd-prio-tag p${o.prio}">${CMD_PRIO[o.prio]}</span>` : ''}${o.sub ? `<small> · ${o.sub}</small>` : ''}</div>
          <div class="cmd-chips">${chip(o, 'fiz', 'Fiz')}${chip(o, 'nao', 'Não fiz')}${chip(o, 'imprevisto', 'Imprevisto')}</div>
        </div>`).join('')}
      ${r.diasSemAbrir ? `<label class="cmd-rev-check"><input type="checkbox" ${r.perdoarAusencia ? 'checked' : ''} onchange="cmdRevisaoAusencia()"> Fiquei ${r.diasSemAbrir} dia${r.diasSemAbrir > 1 ? 's' : ''} sem abrir porque estava impossibilitado (doença, viagem) — sem multa, mas a sequência para</label>` : ''}
      <div class="cmd-rev-rodape">
        <button type="button" class="cmd-chip${r.folga ? ' ativo' : ''}" onclick="cmdRevisaoFolga()">${r.folga ? '✓ Ontem foi folga' : 'Ontem foi folga'}</button>
        <span class="cmd-rev-restam">Imprevistos: ${restam} de ${JG_IMPREVISTOS_SEMANA} · folga: ${cmdFolgaLivre(r.dia) || r.folga ? '1' : '0'} de 1 na semana</span>
      </div>
      <div class="jg-rel-total"><span>Resultado</span><b class="${prev.total < 0 ? 'neg' : 'pos'}">${prev.total > 0 ? '+' : ''}${prev.total} XP${prev.ruptura === true ? ' · sequência zera' : prev.ruptura === 'escudo' ? ' · usa escudo' : ''}</b></div>
      <button type="button" class="btn btn-block" onclick="cmdConcluirRevisao()">Concluir revisão</button>
    </div>`;
}

/* ---------- imprevisto e folga ---------- */
function cmdEhFolga(dia){ return (state.comando.folgas || []).includes(dia); }
function cmdFolgaLivre(dia){ const ch = jgSemanaChave(dia); return !(state.comando.folgas || []).some(f=>f !== dia && jgSemanaChave(f) === ch); }
function cmdMarcarFolga(dia){ const c = state.comando; if(!c.folgas.includes(dia)) c.folgas = c.folgas.concat(dia).slice(-20); }
function cmdImprevistosRestantes(dia){
  const j = jgEstado(), ch = jgSemanaChave(dia);
  const usados = j.imprevistos && j.imprevistos.chave === ch ? j.imprevistos.n : 0;
  const r = state.comando.revisao;
  const naRevisao = r && jgSemanaChave(r.dia) === ch ? r.ordens.filter(o=>o.escolha === 'imprevisto').length : 0;
  return Math.max(0, JG_IMPREVISTOS_SEMANA - usados - naRevisao);
}
function jgUsarImprevisto(dia){
  const j = jgEstado(), ch = jgSemanaChave(dia);
  if(!j.imprevistos || j.imprevistos.chave !== ch) j.imprevistos = { chave: ch, n: 0 };
  j.imprevistos.n++;
}
/* hoje: "não vai dar" — a ordem sai de hoje sem multa (hábito volta amanhã; tarefa continua amanhã) */
function cmdImprevisto(id){
  const o = cmdOrdem(id), hoje = diaKeyHoje(); if(!o) return;
  if(cmdImprevistosRestantes(hoje) <= 0){ showToast(`Os ${JG_IMPREVISTOS_SEMANA} imprevistos desta semana já foram usados. Adie ou cumpra.`); return; }
  cmdAcoesAberta = null;
  comDesfazer(`Imprevisto: sai de hoje sem multa (restam ${cmdImprevistosRestantes(hoje) - 1})`, ()=>{
    o.imprevisto = hoje; cmdMarcar(o, false); jgUsarImprevisto(hoje);
    persist(); cmdChecarMeta(); renderComando();
  }, ()=>{ if(document.getElementById('aba-comando')?.classList.contains('active')) renderComando(); });
}
async function cmdFolgaHoje(){
  const c = state.comando, hoje = diaKeyHoje();
  if(cmdEhFolga(hoje)){ c.folgas = c.folgas.filter(f=>f !== hoje); persist(); renderComando(); showToast('Folga cancelada'); return; }
  if(!cmdFolgaLivre(hoje)){ showToast('A folga desta semana já foi usada'); return; }
  if(!(await iosConfirm('Hoje é folga? Nada conta hoje: sem multa, e a sequência fica parada (não sobe nem zera). Só 1 por semana.'))) return;
  cmdMarcarFolga(hoje); persist(); renderComando();
}
function cmdDefinirRepete(id, repete){
  const o = cmdOrdem(id); if(!o) return;
  o.repete = repete; if(repete) delete o.desde;
  cmdAcoesAberta = null; persist(); renderComando();
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
function cmdOrdensHoje(diaKey){
  const hoje = diaKey || diaKeyHoje();   // diaKey: a lista como estava naquele dia (usado na virada)
  return state.comando.ordens
    .map((o, i)=>({ o, i }))
    .filter(x=>(!x.o.adiadaAte || x.o.adiadaAte <= hoje) && x.o.imprevisto !== hoje)
    .sort((a, b)=>(a.o.prio || 9) - (b.o.prio || 9) || a.i - b.i)
    .map(x=>x.o);
}
function cmdOrdensAdiadas(){
  const hoje = diaKeyHoje();
  return state.comando.ordens.filter(o=>(o.adiadaAte && o.adiadaAte > hoje) || o.imprevisto === hoje).sort((a, b)=>(a.adiadaAte || '').localeCompare(b.adiadaAte || ''));
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
      <div class="cmd-acoes-linha"><span>Repetir</span><div class="cmd-chips">
        <button type="button" class="cmd-chip${o.repete ? '' : ' ativo'}" onclick="cmdDefinirRepete('${o.id}',false)">Só uma vez</button>
        <button type="button" class="cmd-chip${o.repete ? ' ativo' : ''}" onclick="cmdDefinirRepete('${o.id}',true)">Todo dia</button>
      </div></div>
      <div class="cmd-acoes-linha"><span>Não vai dar hoje</span><div class="cmd-chips">
        <button type="button" class="cmd-chip" onclick="cmdImprevisto('${o.id}')">Imprevisto · sem multa (restam ${cmdImprevistosRestantes(diaKeyHoje())})</button>
      </div></div>
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
  const custo = typeof JG_MULTA_ADIAR !== 'undefined' ? (JG_MULTA_ADIAR[o.prio] || 5) : 0;
  comDesfazer(`Adiada para ${cmdNomeDia(dia)}${custo ? ` · −${custo} XP` : ''}`, ()=>{
    if(typeof jgMultaAdiar === 'function') jgMultaAdiar(o);   // modo bruto: adiar custa
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
  garantirEstadoComando();   // app aberto de um dia para o outro: a virada acontece aqui também
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
      <div class="cmd-ordem-texto" id="ordemTexto-${o.id}" onclick="editarOrdemComando('${o.id}')">${cmdEsc(o.texto)}${o.prio ? `<span class="cmd-prio-tag p${o.prio}">${CMD_PRIO[o.prio]}</span>` : ''}${cmdEtiquetaTipo(o)}</div>
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
    : cmdMeta()   // com meta, o dia fecha sozinho ao bater o % até a hora; passou da hora = não fecha mais
      ? `<button type="button" class="cmd-fechar${Date.now() > cmdLimite(c.ultimoDia) ? ' perdido' : ''}" disabled>${Date.now() > cmdLimite(c.ultimoDia) ? `Meta perdida: hoje o dia não fecha mais` : `Fecha sozinho ao chegar em ${cmdMeta().pct}% até ${cmdMeta().hora}`}</button>`
    : todasFeitas
      ? `<button type="button" class="btn btn-block cmd-fechar" onclick="fecharDiaComando()">Fechar o dia</button>`
      : `<button type="button" class="cmd-fechar" disabled>${total ? `Falta${faltam>1?'m':''} ${faltam} orde${faltam>1?'ns':'m'} para fechar o dia` : 'Adicione uma ordem para começar'}</button>`;

  const adiadas = cmdOrdensAdiadas();
  const adiadasHtml = adiadas.length ? `
        <div class="cmd-adiadas">
          <div class="cmd-adiadas-titulo">Para outros dias</div>
          ${adiadas.map(o=>`
          <div class="cmd-adiada">
            <span class="cmd-adiada-dia">${o.imprevisto === diaKeyHoje() ? 'imprevisto' : cmdNomeDia(o.adiadaAte)}</span>
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
      ${c.rupturaHoje === 'escudo' ? `<div class="cmd-ruptura escudo">Ontem você falhou. O escudo salvou a sequência — não conte com isso de novo.</div>` : c.rupturaHoje ? `<div class="cmd-ruptura">Ontem você falhou. Sequência zerada. Levanta e cumpre.</div>` : ''}
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
        <button type="button" class="cmd-folga-btn${cmdEhFolga(diaKeyHoje()) ? ' ativa' : ''}" onclick="cmdFolgaHoje()">${cmdEhFolga(diaKeyHoje()) ? 'Hoje é folga · cancelar' : cmdFolgaLivre(diaKeyHoje()) ? 'Hoje é folga? (1 por semana)' : 'Folga da semana já usada'}</button>
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
function cmdProgresso(ate, diaKey){
  const ords = cmdOrdensHoje(diaKey); if(!ords.length) return 0;
  const vale = x=>x.feito && !(ate && x.feitoEm > ate);
  return ords.reduce((s, o)=>s + ((o.sub||[]).length ? o.sub.filter(vale).length / o.sub.length : (vale(o) ? 1 : 0)), 0) / ords.length;
}
function cmdDiaProdutivo(diaKey){
  const m = cmdMeta(); if(!m) return false;
  return cmdProgresso(cmdLimite(diaKey), diaKey) * 100 >= m.pct - 0.001;
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
function cmdMarcarDiaFechado(dia){
  const c = state.comando; dia = dia || c.ultimoDia;
  if(dia === c.ultimoDia) c.diaFechado = true;
  c.diasFechados = (c.diasFechados || []).filter(d=>d !== dia).concat(dia).sort().slice(-60);   // bolinhas da semana
  c.streak += 1;
  c.recorde = Math.max(c.recorde, c.streak);
  c.rupturaHoje = false;
  if(typeof jgDiaFechado === 'function') jgDiaFechado(dia);
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
/* ordem de dias anteriores, não cumprida e apagada = desistência: custa igual a adiar (as criadas hoje saem de graça) */
function cmdOrdemDeHoje(o){
  const t = Number(String(o.id).slice(1));
  return t > 1e12 && t >= new Date().setHours(0,0,0,0);
}
function excluirOrdemComando(id){
  cmdAcoesAberta = null;
  const o = cmdOrdem(id);
  const custo = o && !o.feito && !cmdOrdemDeHoje(o) && o.semCusto !== diaKeyHoje() && typeof JG_MULTA_ADIAR !== 'undefined' ? (JG_MULTA_ADIAR[o.prio] || 5) : 0;
  comDesfazer(custo ? `Ordem removida · −${custo} XP (desistência)` : 'Ordem removida', ()=>{
    if(custo) jgPerder(custo);
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
/* etiqueta do tipo: hábito de todo dia (↻) ou tarefa que ficou para trás (atrasada N dias) */
function cmdEtiquetaTipo(o){
  if(o.repete) return `<span class="cmd-tipo-tag" title="Todo dia">↻ todo dia</span>`;
  if(o.desde){ const n = cmdDiasEntre(o.desde, diaKeyHoje()); if(n > 0) return `<span class="cmd-tipo-tag atrasada">atrasada ${n} dia${n > 1 ? 's' : ''}</span>`; }
  return '';
}
