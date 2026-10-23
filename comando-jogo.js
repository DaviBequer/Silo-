/* ========== COMANDO — GAMIFICAÇÃO ==========
   Base: os dois estudos que o Davi mandou (Habitica/RPG e análise de 25 apps pelo Octalysis):
   - XP + níveis com patente (progresso visível), barra de progresso (elemento "híbrido", o mais usado);
   - feedback imediato ("+20 XP" ao marcar, comemoração ao subir de nível);
   - conquistas (emblemas) e desafio da semana (objetivo com prazo);
   - escudo da sequência = gerenciamento de recurso (motivação intrínseca): protege um dia perdido;
   - sem ranking/competição e sem punição (os estudos apontam efeito contrário); interface enxuta.
   Dados: state.comando.jogo = { xp (já garantido), tot:{ordens,alta,dias,sabot,desafios}, escudos,
   semana:{chave,ordens,alta,ganhou}, conquistas:{id: data}, nivelVisto, dias:{AAAA-MM-DD: xp} }.
   O XP de HOJE é calculado das ordens marcadas (desmarcar devolve) e só vira "garantido" na virada do dia. */

const JG_XP_PRIO = { 1:30, 2:20, 3:10 };   // sem prioridade = 10
const JG_XP_DIA = 50;                       // fechar o dia (+5 por dia de sequência, até +50)
const JG_XP_SABOT = 5;                      // anotar uma sabotagem (até 3 por dia)
const JG_XP_CONQUISTA = 25;
const JG_XP_DESAFIO = 100;
const JG_ESCUDOS_MAX = 2;
/* modo bruto (pedido do Davi: "bruta de verdade") */
const JG_MULTA = { 1:25, 2:15, 3:10 };       // ordem não cumprida no fim do dia (sem prioridade = 10)
const JG_MULTA_DIA = 40;                      // dia não fechado (e cada dia sem abrir o app, até 5)
const JG_MULTA_SEQ = 50;                      // perder a sequência (+5 por dia que tinha, até 150)
const JG_MULTA_ADIAR = { 1:15, 2:8, 3:5 };    // jogar uma ordem para outro dia
/* v9.0: o padrão é o modo CALMO (sem multa, sem rebaixar, sem sargento); as multas só valem com state.comando.modo = 'bruto' */
function jgBruto(){ return !!(state.comando && state.comando.modo === 'bruto'); }
const JG_PATENTES = [[1,'Recruta'],[3,'Soldado'],[5,'Cabo'],[8,'Sargento'],[12,'Tenente'],[17,'Capitão'],[23,'Major'],[30,'Coronel'],[40,'General']];

/* ícones preenchidos */
const JG_ICO = {
  fogo:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z"/></svg>',
  escudo:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 5v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V5l-8-3z"/></svg>',
  estrela:'<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  alvo:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  medalha:'<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h4l1.5 4L14 2h3l-3 7.2A6 6 0 1 1 9.9 9.2z" opacity=".55"/><circle cx="12" cy="15" r="5.2"/></svg>',
  cadeado:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>'
};

/* ---------- estado ---------- */
function jgEstado(){
  const c = state.comando;
  if(!c.jogo){
    /* começa contando o histórico que já existe (dias fechados) */
    const dias = (c.diasFechados || []).length;
    c.jogo = { xp: dias * JG_XP_DIA, tot:{ ordens:0, alta:0, dias, sabot:(c.sabotagens||[]).length, desafios:0 }, escudos:0, semana:null, conquistas:{}, nivelVisto:0, dias:{} };
  }
  const j = c.jogo;
  j.tot = Object.assign({ ordens:0, alta:0, dias:0, sabot:0, desafios:0 }, j.tot);
  j.conquistas = j.conquistas || {}; j.dias = j.dias || {};
  return j;
}
function jgDiaKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function jgSemanaChave(diaKey){   // segunda-feira da semana
  const d = new Date(diaKey + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return jgDiaKey(d);
}

/* ---------- XP de hoje (vem das ordens marcadas) ---------- */
function jgValorOrdem(o){ return JG_XP_PRIO[o.prio] || 10; }
const JG_XP_ORDENS_MAX = 200;   // teto de XP das ordens por dia (criar 50 ordens bobas não vira patente)
const JG_IMPREVISTOS_SEMANA = 3;   // "não deu": tira a ordem do dia sem multa
function jgHoje(){
  let xp = 0, ordens = 0, alta = 0;
  const ini = new Date().setHours(0,0,0,0);
  (state.comando.ordens || []).forEach(o=>{
    const subs = o.sub || [];
    /* subtarefa feita em outro dia (tarefa que ficou para trás) já rendeu: só conta a de hoje */
    const frac = subs.length ? subs.filter(s=>s.feito && !(s.feitoEm < ini)).length / subs.length : (o.feito ? 1 : 0);
    xp += Math.round(jgValorOrdem(o) * frac);
    if(o.feito){ ordens++; if(o.prio === 1) alta++; }
  });
  return { xp: Math.min(xp, JG_XP_ORDENS_MAX), ordens, alta };
}
function jgXpTotal(){ return jgEstado().xp + jgHoje().xp; }
function jgGanhar(n, dia){ const j = jgEstado(); j.xp += n; const k = dia || diaKeyHoje(); j.dias[k] = (j.dias[k] || 0) + n; }

/* ---------- nível e patente ---------- */
function jgNivel(xp){
  let nivel = 1, base = 0, passo = 100;
  while(xp >= base + passo){ base += passo; nivel++; passo = 100 + 50 * (nivel - 1); }
  return { nivel, dentro: xp - base, passo };
}
function jgPatente(nivel){ let p = JG_PATENTES[0][1]; JG_PATENTES.forEach(([n, t])=>{ if(nivel >= n) p = t; }); return p; }

/* ---------- contar um dia (virada ou fim da revisão) ----------
   rev = foto do dia (ordens com escolha fiz / não / imprevisto); st = { fechou, livre, perdeuSeq, seqAntes } */
function jgAplicarDia(rev, st){
  const j = jgEstado(), dia = rev.dia;
  const outros = j.dias[dia] || 0;   // o que já tinha entrado no dia: fechar o dia, medalhas, sabotagens, adiamentos
  /* "fiz" marcado na revisão vale a ordem inteira (menos o que já rendeu em outros dias) */
  const fezXp = o=>o.escolha === 'fiz' ? 1 - (o.frac - o.fracXp) : o.fracXp;
  const xp = Math.min(JG_XP_ORDENS_MAX, Math.round(rev.ordens.reduce((s, o)=>s + jgValorOrdem(o) * fezXp(o), 0)));
  j.xp += xp;
  j.dias[dia] = outros + xp;
  const r = j.relatorio = { dia, linhas: [], visto: false };
  if(xp) r.linhas.push(['Ordens cumpridas', xp]);
  if(outros) r.linhas.push([outros > 0 ? (rev.fechouNaRevisao ? 'Dia fechado na revisão' : 'Dia fechado, medalhas e bônus') : 'Adiamentos e desistências', outros]);
  const imp = rev.ordens.filter(o=>o.escolha === 'imprevisto').length;
  if(imp) r.linhas.push([`${imp} imprevisto${imp > 1 ? 's' : ''} (sem multa)`, 0]);
  const contaveis = rev.ordens.filter(o=>o.escolha !== 'imprevisto');
  if(st.livre) r.linhas.push([rev.folga ? 'Folga: nada contou' : 'Só imprevistos: nada contou', 0]);
  else if(!st.fechou && jgBruto()){
    /* modo bruto: ordem não cumprida custa (Alta 25, Média 15, outras 10; com subtarefas, a parte que faltou) */
    let multa = 0, falhas = 0;
    contaveis.forEach(o=>{ const falta = o.escolha === 'fiz' ? 0 : 1 - o.frac; if(falta > 0){ multa += Math.round((JG_MULTA[o.prio] || 10) * falta); falhas++; } });
    if(multa){ jgPerder(multa, dia); r.linhas.push([`${falhas} orde${falhas > 1 ? 'ns' : 'm'} descumprida${falhas > 1 ? 's' : ''}`, -multa]); }
    jgPerder(JG_MULTA_DIA, dia); r.linhas.push(['Dia não fechado', -JG_MULTA_DIA]);
  }
  if(rev.diasSemAbrir > 0){
    if(rev.perdoarAusencia || !jgBruto()) r.linhas.push([`${rev.diasSemAbrir} dia${rev.diasSemAbrir > 1 ? 's' : ''} fora (impossibilitado): sem multa`, 0]);
    else { const m = Math.min(rev.diasSemAbrir, 5) * JG_MULTA_DIA; jgPerder(m, dia); r.linhas.push([`${rev.diasSemAbrir} dia${rev.diasSemAbrir > 1 ? 's' : ''} sem aparecer (desertor)`, -m]); }
  }
  if(st.perdeuSeq && !rev.perdoarAusencia && jgBruto()){ const m = Math.min(150, JG_MULTA_SEQ + st.seqAntes * 5); jgPerder(m, dia); r.linhas.push([`Sequência de ${st.seqAntes} dia${st.seqAntes > 1 ? 's' : ''} perdida`, -m]); }
  /* contadores (medalhas e missão da semana) */
  const feitas = rev.ordens.filter(o=>o.escolha === 'fiz');
  j.tot.ordens += feitas.length; j.tot.alta += feitas.filter(o=>o.prio === 1).length;
  const ch = jgSemanaChave(dia);
  if(!j.semana || j.semana.chave !== ch) j.semana = { chave: ch, ordens:0, alta:0, perfeitos:0, ganhou:false };
  j.semana.ordens += feitas.length; j.semana.alta += feitas.filter(o=>o.prio === 1).length;
  if(contaveis.length && contaveis.every(o=>o.escolha === 'fiz')) j.semana.perfeitos = (j.semana.perfeitos || 0) + 1;
  r.total = r.linhas.reduce((s, l)=>s + l[1], 0);
  if(!jgBruto()) r.visto = true;   // calmo: sem relatório na tela (fica guardado para "revisar ontem de novo")
  else if(!r.linhas.length) j.relatorio = null;
  /* guarda só os últimos 60 dias de histórico */
  const chaves = Object.keys(j.dias).sort(); if(chaves.length > 60) chaves.slice(0, chaves.length - 60).forEach(k=>delete j.dias[k]);
}
/* ---------- modo bruto: perder XP, rebaixar, relatório do sargento ---------- */
function jgPerder(n, diaKey){
  const j = jgEstado();
  const tira = Math.min(n, j.xp);   // o XP nunca fica negativo
  j.xp -= tira;
  if(tira) j.rebaixar = true;
  const k = diaKey || diaKeyHoje(); j.dias[k] = (j.dias[k] || 0) - tira;
  return tira;
}
/* jogar uma ordem para outro dia também custa (é adiar) */
function jgMultaAdiar(o){
  if(!jgBruto()) return 0;
  const m = JG_MULTA_ADIAR[o.prio] || 5;
  return jgPerder(m);
}
function jgFecharRelatorio(){ const j = jgEstado(); if(j.relatorio) j.relatorio.visto = true; persist(); renderComando(); }
/* a voz do sargento */
const JG_SARGENTO = {
  cumpriu: ['Cumprido.', 'Mais uma. Não para.', 'Isso. Próxima.', 'Sem descanso.', 'Assim que se faz.', 'Continua, soldado.'],
  tudo: ['Missão cumprida. Agora feche o dia.', 'Tudo cumprido. Fecha o dia e descansa.'],
  falta: ['Faltam {n}. Sem desculpas.', '{n} ordens esperando. Levanta.', 'Ainda faltam {n}. O dia não espera.', 'Fraqueza é parar agora. Faltam {n}.'],
  tarde: ['O dia está acabando e faltam {n}. Mexa-se.', 'Já é tarde. {n} ordens abertas. Vergonha.'],
  vazio: ['Sem ordens não há missão. Escreva a primeira.'],
  fechado: ['Dia fechado. Amanhã tem mais.', 'Dever cumprido. Descansa, soldado.']
};
function jgFrase(tipo, n){
  const l = JG_SARGENTO[tipo]; const f = l[(new Date().getDate() + (n || 0)) % l.length];
  return f.replace('{n}', n);
}
function jgOrdemDoSargento(){
  const c = state.comando, ords = cmdOrdensHoje(), faltam = ords.filter(o=>!o.feito).length;
  if(c.revisao) return 'Antes de tudo: revise ontem. Seja honesto.';
  if(!(c.juramento && c.juramentoDia === diaKeyHoje()) && !c.diaFechado) return 'Assine o juramento de hoje. Palavra dada é palavra cumprida.';
  if(c.diaFechado) return jgFrase('fechado');
  if(cmdEhFolga(diaKeyHoje())) return 'Folga autorizada. Descansa e volta amanhã.';
  if(!ords.length) return jgFrase('vazio');
  if(!faltam) return jgFrase('tudo');
  return jgFrase(new Date().getHours() >= 18 ? 'tarde' : 'falta', faltam);
}
function jgRelatorioHtml(){
  const r = jgEstado().relatorio;
  if(state.comando.revisao) return cmdRevisaoHtml();   // primeiro a revisão; o relatório vem depois dela
  if(!r || r.visto) return '';
  const dia = new Date(r.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'2-digit' });
  return `
    <div class="jg-relatorio${r.total < 0 ? ' ruim' : ''}">
      <div class="jg-rel-topo"><span>Relatório do sargento</span><small>${dia}</small></div>
      ${r.linhas.map(([t, v])=>`<div class="jg-rel-linha"><span>${cmdEsc(t)}</span><b class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${v ? v + ' XP' : '—'}</b></div>`).join('')}
      <div class="jg-rel-total"><span>Saldo do dia</span><b class="${r.total < 0 ? 'neg' : 'pos'}">${r.total > 0 ? '+' : ''}${r.total} XP</b></div>
      <div class="jg-rel-frase">${r.total < 0 ? 'Inaceitável. Hoje você recupera.' : 'Bom trabalho. Repete hoje.'}</div>
      <button type="button" class="btn btn-block" onclick="jgFecharRelatorio()">Entendido</button>
      ${cmdPodeRevisarDeNovo() ? `<button type="button" class="cmd-rev-denovo" onclick="cmdReabrirRevisao()">Esqueceu de marcar algo? Revisar ontem de novo</button>` : ''}
    </div>`;
}
/* dia perdido: um escudo segura a sequência */
function jgUsarEscudo(){
  const j = jgEstado();
  if(j.escudos > 0){ j.escudos--; return true; }
  return false;
}
/* chamado em cmdMarcarDiaFechado (depois de somar a sequência) */
function jgDiaFechado(dia){
  const j = jgEstado(), c = state.comando;
  j.tot.dias++;
  const xp = JG_XP_DIA + Math.min(50, c.streak * 5);
  jgGanhar(xp, dia);
  if(c.streak > 0 && c.streak % 7 === 0 && j.escudos < JG_ESCUDOS_MAX){ j.escudos++; if(!cmdSimulando) setTimeout(()=>showToast('Ganhou um escudo: ele protege a sequência num dia perdido'), 1600); }
  if(dia === diaKeyHoje() && !cmdSimulando){
    if(new Date().getHours() < 12) j.madrugou = true;
    setTimeout(()=>showToast(`Dia fechado: +${xp} XP`), 300);
  }
}
function jgSabotagem(){
  const j = jgEstado();
  j.tot.sabot++;
  const hoje = diaKeyHoje();
  const deHoje = (state.comando.sabotagens || []).filter(s=>jgDiaKey(new Date(s.data)) === hoje).length;
  if(deHoje <= 3){ jgGanhar(JG_XP_SABOT); return JG_XP_SABOT; }
  return 0;
}

/* ---------- desafio da semana ---------- */
const JG_DESAFIOS = [
  { id:'fechar5', txt:'Feche 5 dias nesta semana', alvo:5 },
  { id:'ordens20', txt:'Conclua 20 ordens nesta semana', alvo:20 },
  { id:'alta5', txt:'Conclua 5 ordens de prioridade Alta', alvo:5 },
  { id:'perfeito3', txt:'Cumpra 100% das ordens em 3 dias', alvo:3 },
  { id:'sabot3', txt:'Anote 3 sabotagens (consciência vence o hábito)', alvo:3 }
];
function jgDesafioAtual(){
  const ch = jgSemanaChave(diaKeyHoje());
  const idx = Math.floor(new Date(ch + 'T12:00:00').getTime() / (7 * 864e5));
  return { ch, d: JG_DESAFIOS[((idx % JG_DESAFIOS.length) + JG_DESAFIOS.length) % JG_DESAFIOS.length] };
}
function jgDesafioProgresso(){
  const j = jgEstado(), c = state.comando, { ch, d } = jgDesafioAtual(), h = jgHoje();
  const base = j.semana && j.semana.chave === ch ? j.semana : { ordens:0, alta:0 };
  let feito = 0;
  if(d.id === 'fechar5') feito = (c.diasFechados || []).filter(k=>jgSemanaChave(k) === ch).length;
  else if(d.id === 'ordens20') feito = base.ordens + h.ordens;
  else if(d.id === 'alta5') feito = base.alta + h.alta;
  else if(d.id === 'perfeito3'){ const ho = cmdOrdensHoje(); feito = (base.perfeitos || 0) + (ho.length && ho.every(o=>o.feito) ? 1 : 0); }
  else if(d.id === 'sabot3') feito = (c.sabotagens || []).filter(s=>jgSemanaChave(jgDiaKey(new Date(s.data))) === ch).length;
  return { d, ch, feito: Math.min(feito, d.alvo), ganhou: !!(j.semana && j.semana.chave === ch && j.semana.ganhou) };
}

/* ---------- conquistas ---------- */
const JG_CONQUISTAS = [
  { id:'primeira', nome:'Primeiro passo', desc:'Concluir a primeira ordem', ok:s=>s.ordens >= 1 },
  { id:'dia1', nome:'Dia fechado', desc:'Fechar o primeiro dia', ok:s=>s.dias >= 1 },
  { id:'juramento', nome:'Palavra dada', desc:'Assinar o juramento', ok:s=>s.juramento },
  { id:'seq3', nome:'Embalo', desc:'3 dias seguidos', ok:s=>s.recorde >= 3 },
  { id:'seq7', nome:'Semana firme', desc:'7 dias seguidos', ok:s=>s.recorde >= 7 },
  { id:'seq21', nome:'21 dias', desc:'21 dias seguidos', ok:s=>s.recorde >= 21 },
  { id:'seq66', nome:'Hábito formado', desc:'66 dias seguidos', ok:s=>s.recorde >= 66 },
  { id:'ordens50', nome:'Cumpridor', desc:'50 ordens concluídas', ok:s=>s.ordens >= 50 },
  { id:'ordens200', nome:'Incansável', desc:'200 ordens concluídas', ok:s=>s.ordens >= 200 },
  { id:'alta10', nome:'O mais difícil primeiro', desc:'10 ordens de prioridade Alta', ok:s=>s.alta >= 10 },
  { id:'madrugador', nome:'Madrugador', desc:'Fechar o dia antes do meio-dia', ok:s=>s.madrugou },
  { id:'consciente', nome:'Consciente', desc:'Anotar 10 sabotagens', ok:s=>s.sabot >= 10 },
  { id:'desafio1', nome:'Desafiante', desc:'Vencer um desafio da semana', ok:s=>s.desafios >= 1 },
  { id:'desafio5', nome:'Veterano', desc:'Vencer 5 desafios da semana', ok:s=>s.desafios >= 5 },
  { id:'nivel5', nome:'Cabo', desc:'Chegar ao nível 5', ok:s=>s.nivel >= 5 },
  { id:'nivel12', nome:'Oficial', desc:'Chegar ao nível 12 (Tenente)', ok:s=>s.nivel >= 12 }
];
function jgResumo(){
  const j = jgEstado(), c = state.comando, h = jgHoje();
  return { ordens: j.tot.ordens + h.ordens, alta: j.tot.alta + h.alta, dias: j.tot.dias, sabot: j.tot.sabot, desafios: j.tot.desafios,
    recorde: Math.max(c.recorde || 0, c.streak || 0), juramento: !!c.juramento, madrugou: !!j.madrugou, nivel: jgNivel(jgXpTotal()).nivel };
}

/* ---------- conferência: desafio vencido, conquistas, subiu de nível (chamado no renderComando) ---------- */
let jgFila = [];
function jgChecar(){
  const j = jgEstado();
  const primeira = !j.nivelVisto;   // primeira vez: conquistas do histórico entram sem festa
  let mudou = false;
  const dp = jgDesafioProgresso();
  if(!dp.ganhou && dp.feito >= dp.d.alvo){
    if(!j.semana || j.semana.chave !== dp.ch) j.semana = { chave: dp.ch, ordens:0, alta:0, perfeitos:0, ganhou:false };
    j.semana.ganhou = true; j.tot.desafios++;
    jgGanhar(JG_XP_DESAFIO);
    jgFila.push({ tipo:'desafio', titulo:'Missão cumprida!', texto: dp.d.txt, xp: JG_XP_DESAFIO });
    mudou = true;
  }
  const s = jgResumo();
  JG_CONQUISTAS.forEach(q=>{
    if(j.conquistas[q.id] || !q.ok(s)) return;
    j.conquistas[q.id] = diaKeyHoje();
    jgGanhar(JG_XP_CONQUISTA);
    if(!primeira) jgFila.push({ tipo:'conquista', titulo:'Medalha: ' + q.nome, texto: q.desc, xp: JG_XP_CONQUISTA });
    mudou = true;
  });
  const nv = jgNivel(jgXpTotal()).nivel;
  if(!j.nivelVisto) j.nivelVisto = nv;   // primeira vez: sem festa pelo histórico antigo
  else if(nv > j.nivelVisto){
    const patenteNova = jgPatente(nv) !== jgPatente(j.nivelVisto);
    j.nivelVisto = nv;
    jgFila.push({ tipo:'nivel', nivel: nv, patente: jgPatente(nv), novaPatente: patenteNova });
    mudou = true;
  } else if(j.rebaixar && nv < j.nivelVisto){
    // só multa rebaixa (desmarcar uma ordem não conta)
    const perdeuPatente = jgPatente(nv) !== jgPatente(j.nivelVisto);
    j.nivelVisto = nv;
    jgFila.push({ tipo:'rebaixado', nivel: nv, patente: jgPatente(nv), perdeuPatente });
    mudou = true;
  }
  if(j.rebaixar){ delete j.rebaixar; mudou = true; }
  if(mudou){ persist(); setTimeout(jgMostrarFila, 450); }
}
/* comemorações uma de cada vez */
function jgMostrarFila(){
  if(document.getElementById('jgFesta') || !jgFila.length) return;
  const e = jgFila.shift();
  const el = document.createElement('div');
  el.id = 'jgFesta'; el.className = 'jg-festa' + (e.tipo === 'nivel' ? ' nivel' : e.tipo === 'rebaixado' ? ' nivel rebaixado' : '');
  el.innerHTML = e.tipo === 'rebaixado'
    ? `<div class="jg-festa-card"><div class="jg-festa-rotulo">Rebaixado</div><div class="jg-festa-nivel">${e.nivel}</div><div class="jg-festa-titulo">${e.perdeuPatente ? 'Perdeu a patente. Agora: ' : 'Voltou para o nível ' + e.nivel + ' · '}${e.patente}</div><div class="jg-festa-texto">Ordem descumprida tem preço. Recupere.</div><div class="jg-festa-toque">Toque para continuar</div></div>`
    : e.tipo === 'nivel'
    ? `<div class="jg-festa-card"><div class="jg-festa-rotulo">Subiu de nível</div><div class="jg-festa-nivel">${e.nivel}</div><div class="jg-festa-titulo">${jgBruto() ? (e.novaPatente ? 'Nova patente: ' : '') + e.patente : 'Continue assim.'}</div><div class="jg-festa-toque">Toque para continuar</div></div>`
    : `<div class="jg-festa-card"><span class="jg-festa-ico">${e.tipo === 'desafio' ? JG_ICO.alvo : JG_ICO.medalha}</span><div class="jg-festa-titulo">${cmdEsc(e.titulo)}</div><div class="jg-festa-texto">${cmdEsc(e.texto)}</div><div class="jg-festa-xp">+${e.xp} XP</div></div>`;
  const fechar = ()=>{ el.classList.add('saindo'); setTimeout(()=>{ el.remove(); jgMostrarFila(); }, 260); };
  el.addEventListener('click', fechar);
  document.body.appendChild(el);
  if(navigator.vibrate) try{ navigator.vibrate(e.tipo === 'nivel' ? [30,60,30,60,80] : [25,40,25]); }catch(_){}
  if(e.tipo !== 'nivel' && e.tipo !== 'rebaixado') setTimeout(()=>{ if(el.isConnected) fechar(); }, 2600);
}

/* "+20 XP" subindo de onde tocou */
function jgFlutuar(alvo, xp){
  if(!xp || !alvo) return;
  const r = alvo.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'jg-flutua' + (xp < 0 ? ' menos' : '');
  el.textContent = (xp > 0 ? '+' : '') + xp + ' XP' + (xp > 0 && jgBruto() ? ' · ' + jgFrase('cumpriu', Math.floor(Math.random() * 6)) : '');
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = r.top + 'px';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1100);
}

/* ---------- telas ---------- */
function jgJogadorHtml(){
  const j = jgEstado(), c = state.comando, xp = jgXpTotal(), nv = jgNivel(xp), hoje = jgHoje().xp + (j.dias[diaKeyHoje()] || 0);
  const proxPatente = JG_PATENTES.find(([n])=>n > nv.nivel);
  const pct = Math.round(nv.dentro / nv.passo * 100);
  /* calmo: só uma linha discreta de progresso */
  if(!jgBruto()) return `
    ${jgRelatorioHtml()}
    <div class="jg-calmo">
      <div class="jg-calmo-linha"><span>Nível ${nv.nivel}</span><span>${nv.dentro} / ${nv.passo} XP${hoje > 0 ? ` · +${hoje} hoje` : ''}</span></div>
      <div class="jg-barra jg-barra-fina"><div style="width:${pct}%"></div></div>
    </div>`;
  return `
    ${jgRelatorioHtml()}
    <div class="jg-sargento"><span>Sargento</span>${cmdEsc(jgOrdemDoSargento())}</div>
    <div class="jg-jogador">
      <div class="jg-nivel"><span>${nv.nivel}</span></div>
      <div class="jg-info">
        <div class="jg-patente">${jgPatente(nv.nivel)} <small>nível ${nv.nivel}</small></div>
        <div class="jg-barra"><div style="width:${pct}%"></div></div>
        <div class="jg-xp">${nv.dentro} / ${nv.passo} XP <span>· ${proxPatente ? `${proxPatente[1]} no nível ${proxPatente[0]}` : 'patente máxima'}</span></div>
      </div>
    </div>
    <div class="jg-chips">
      <span class="jg-chip fogo" title="Dias seguidos">${JG_ICO.fogo}${c.streak}</span>
      <span class="jg-chip escudo${j.escudos ? '' : ' vazio'}" title="Escudos: protegem a sequência num dia perdido (ganha 1 a cada 7 dias seguidos)">${JG_ICO.escudo}${j.escudos}/${JG_ESCUDOS_MAX}</span>
      <span class="jg-chip estrela${hoje < 0 ? ' neg' : ''}" title="XP de hoje">${JG_ICO.estrela}${hoje > 0 ? '+' : ''}${hoje} hoje</span>
    </div>`;
}
function jgDesafioHtml(){
  const p = jgDesafioProgresso(), pct = Math.round(p.feito / p.d.alvo * 100);
  const fim = new Date(p.ch + 'T12:00:00'); fim.setDate(fim.getDate() + 6);
  const faltamDias = Math.max(0, Math.round((fim - new Date().setHours(12,0,0,0)) / 864e5));
  return `
    <div class="cmd-card jg-desafio${p.ganhou ? ' ganhou' : ''}">
      <div class="cmd-card-topo"><span class="cmd-card-titulo">Missão da semana</span><span class="cmd-card-conta">${p.ganhou ? 'cumprida ✓' : `+${JG_XP_DESAFIO} XP`}</span></div>
      <div class="jg-desafio-txt"><span class="jg-desafio-ico">${JG_ICO.alvo}</span>${cmdEsc(p.d.txt)}</div>
      <div class="jg-barra jg-barra-desafio"><div style="width:${pct}%"></div></div>
      <div class="jg-xp">${p.feito} de ${p.d.alvo} <span>· ${p.ganhou ? 'nova missão na segunda' : faltamDias === 0 ? 'último dia' : `faltam ${faltamDias} dia${faltamDias > 1 ? 's' : ''}`}</span></div>
    </div>`;
}
let jgConquistasAbertas = false;
function jgConquistasHtml(){
  const j = jgEstado(), ganhas = JG_CONQUISTAS.filter(q=>j.conquistas[q.id]).length;
  const lista = jgConquistasAbertas ? `<div class="jg-conquistas">${JG_CONQUISTAS.map(q=>{
    const ok = !!j.conquistas[q.id];
    return `<div class="jg-conq${ok ? ' ok' : ''}" title="${cmdEsc(q.desc)}"><span class="jg-conq-ico">${ok ? JG_ICO.medalha : JG_ICO.cadeado}</span><b>${cmdEsc(q.nome)}</b><small>${cmdEsc(q.desc)}</small></div>`;
  }).join('')}</div>` : '';
  return `
    <div class="cmd-card">
      <button type="button" class="jg-conq-topo" onclick="jgConquistasAbertas=!jgConquistasAbertas;renderComando()">
        <span class="cmd-card-titulo">Medalhas</span>
        <span class="jg-conq-resumo">${ganhas} de ${JG_CONQUISTAS.length}<i class="${jgConquistasAbertas ? 'aberto' : ''}">${ICO(ICO_D.abaixo, 16)}</i></span>
      </button>
      <div class="jg-barra jg-barra-fina"><div style="width:${Math.round(ganhas / JG_CONQUISTAS.length * 100)}%"></div></div>
      ${lista}
    </div>`;
}
