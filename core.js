/* ================= ESTADO ================= */
const STORAGE_KEY = 'siloe-data-v1';
const MES_ATUAL_KEY = 'siloe-mes-atual';
let mesAtualRef = localStorage.getItem(MES_ATUAL_KEY);
if(!mesAtualRef){
  // Primeira vez que o app roda neste dispositivo: parte do mês real como ponto de partida.
  // Depois disso, só muda quando o usuário concluir o mês manualmente.
  mesAtualRef = monthKey(new Date());
  localStorage.setItem(MES_ATUAL_KEY, mesAtualRef);
}
const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function novoEstado(){
  return {
    currentUser:'davi',
    panoOffset:0,
    pontoOffset:0,
    focusMonth:mesFinanceiroAtual(),
    users:{
      davi:{ income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } },
      cris:{ income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } }
    },
    paid:{},
    contasArquivadas:{},
    pagamentosParciais:{},
    historicoMeses:{},
    reserva:0,
    cartoesTracker:[],
    comprasTracker:[],
    metas:[],
    tarefas:[],
    tarefaCategorias:[],
    receitas:[],
    receitaCategorias:[],
    louvores:[],
    estoque:[],
    listaCompras:[],
    preListaCompras:[],
    semanaOffset:0,
    semanaAgenda:{},
    ponto:{ valorHora:0, padraoHoras:8, days:{} },
    configFonte:'system',
    layoutPrefs:{}
  };
}
const FONTES_APP = {
  system:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  inter:"'Inter',sans-serif",
  poppins:"'Poppins',sans-serif",
  nunito:"'Nunito',sans-serif"
};
function aplicarFonteApp(){
  const fonte = FONTES_APP[state.configFonte] || FONTES_APP.system;
  document.documentElement.style.setProperty('--font-body', fonte);
  document.querySelectorAll('.fonte-chip').forEach(el=>el.classList.remove('active'));
  const ativo = document.getElementById('fonteChip'+(state.configFonte||'system').charAt(0).toUpperCase()+(state.configFonte||'system').slice(1));
  ativo?.classList.add('active');
}
function setAppFonte(nome){
  state.configFonte = nome;
  persist();
  aplicarFonteApp();
}
function toggleFontePopup(){
  document.getElementById('fontePopup')?.classList.toggle('show');
}
let state = novoEstado();

/* ================= PERSISTÊNCIA (localStorage + Supabase fallback) ================= */
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){ console.error('Erro ao salvar local', e); }

  if(window.SiloSupabase && window.SiloSupabase.enabled){
    window.SiloSupabase.saveState(state).catch(()=>{});
  }
}
// Backup automático removido (v2.39) — guardava várias cópias inteiras do estado e ocupava espaço.
// Limpa qualquer backup antigo que já esteja salvo no navegador, pra liberar espaço.
try{ localStorage.removeItem('siloe-backups-auto'); }catch(e){}
async function carregar(){
  try{
    let saved = null;

    if(window.SiloSupabase && window.SiloSupabase.enabled){
      const remote = await window.SiloSupabase.loadState();
      if(remote) saved = remote;
    }

    if(!saved){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) saved = JSON.parse(raw);
    }

    if(saved){
      state = Object.assign(novoEstado(), saved);
      // garante estrutura de usuários/categorias mesmo se dados antigos incompletos
      ['davi','cris'].forEach(u=>{
        if(!state.users[u]) state.users[u] = { income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } };
        if(!state.users[u].incomeExtra) state.users[u].incomeExtra = {};
        if(!state.users[u].extras){
          // migração: valores antigos de incomeExtra (um por mês) viram entradas individuais
          state.users[u].extras = Object.keys(state.users[u].incomeExtra).filter(mKey=>state.users[u].incomeExtra[mKey]>0).map(mKey=>({
            id:'ex'+mKey+Math.random().toString(36).slice(2,6),
            desc:'Extra',
            valor:state.users[u].incomeExtra[mKey],
            mesInicio:mKey,
            mesFim:mKey
          }));
        }
        if(state.users[u].saldoAtual === undefined) state.users[u].saldoAtual = 0;
        if(state.users[u].usarSaldoComoBase === undefined) state.users[u].usarSaldoComoBase = false;
        if(!state.users[u].cartoes) state.users[u].cartoes = [];
        if(!state.users[u].expenses) state.users[u].expenses = { moradia:[], assinatura:[], fixo:[], futuro:[] };
        ['moradia','assinatura','fixo','futuro'].forEach(c=>{ if(!state.users[u].expenses[c]) state.users[u].expenses[c]=[]; });
      });
      if(!state.ponto) state.ponto = { valorHora:0, padraoHoras:8, days:{} };
      if(!state.ponto.days) state.ponto.days = {};
      if(state.ponto.nomeUsuario === undefined) state.ponto.nomeUsuario = '';
      if(!state.cartoesTracker) state.cartoesTracker = [];
      if(!state.comprasTracker) state.comprasTracker = [];
      if(!state.metas) state.metas = [];
      if(!state.pagamentosParciais) state.pagamentosParciais = {};
      if(!state.contasArquivadas) state.contasArquivadas = {};
      if(state.reserva === undefined) state.reserva = 0;
      if(!state.receitas) state.receitas = [];
      if(!state.receitaCategorias) state.receitaCategorias = [];
      if(!state.mercadoCategoriasCustom) state.mercadoCategoriasCustom = [];
      if(!state.credoVistaCategoriasCustom) state.credoVistaCategoriasCustom = [];
      if(!state.louvores) state.louvores = [];
      if(!state.estoque) state.estoque = [];
      state.estoque.forEach(e=>{ if(!e.precos) e.precos = []; if(!e.historicoCompras) e.historicoCompras = []; });
      if(!state.listaCompras) state.listaCompras = [];
      state.listaCompras.forEach(it=>{
        if(it.valor===undefined) it.valor = 0;
        if(it.pego===undefined) it.pego = false;
        if(!it.unidade) it.unidade = 'unidades';
        delete it.noCarrinho;
      });
      if(!state.preListaCompras) state.preListaCompras = [];
      if(state.semanaOffset === undefined) state.semanaOffset = 0;
      if(!state.semanaAgenda) state.semanaAgenda = {};
      state.receitas.forEach(r=>{
        if(r.favorito === undefined) r.favorito = false;
        if(!r.passos){
          r.passos = r.descricao ? [r.descricao] : [];
          r.observacoes = r.observacoes || '';
        }
        if(r.ingredientes && r.ingredientes.length && typeof r.ingredientes[0] === 'string'){
          r.ingredientes = r.ingredientes.map(txt=>({ nome: txt, quantidade:'', unidade:'' }));
        }
        if(!r.ingredientes) r.ingredientes = [];
        if(r.tempo === undefined) r.tempo = '';
        if(r.porcoes === undefined) r.porcoes = '';
        if(r.dificuldade === undefined) r.dificuldade = '';
        if(r.cor === undefined) r.cor = '';
      });
      if(!state.tarefas) state.tarefas = [];
      if(!state.tarefaCategorias) state.tarefaCategorias = [];
      (state.tarefas||[]).forEach(t=>{ if(t.tempoGasto===undefined) t.tempoGasto=0; if(t.timerStart===undefined) t.timerStart=null; });
      // migração: garantir campos novos
      (state.cartoesTracker||[]).forEach(c=>{ if(!c.credoVista) c.credoVista=[]; if(!c.assinaturas) c.assinaturas=[]; });
      (state.comprasTracker||[]).forEach(cp=>{ if(cp.pago === undefined) cp.pago=false; });
      delete state.config;
      if(!state.configFonte) state.configFonte = 'system';
      if(!state.layoutPrefs) state.layoutPrefs = {};
    } else {
      state = novoEstado();
    }
  }catch(e){
    console.error('[LOAD] Erro ao carregar estado:', e);
    state = novoEstado();
  }
  limparDadosAntigos();
  aplicarFonteApp();
  renderAll();
  if(typeof applyAllLayouts==='function') applyAllLayouts();
  if(typeof updateLayoutBtnVisibility==='function') updateLayoutBtnVisibility('panorama');
}

/* ================= LIMPEZA AUTOMÁTICA (mantém só mês atual + mês passado) ================= */
function limparDadosAntigos(){
  // Planner/Panorama operam 1 mês à frente: "mês passado" financeiro = mês real atual
  const limitePlanner = todayKey();
  // Ponto PJ é sempre em tempo real: "mês passado" real = mês real atual -1
  const limitePonto = addMonths(todayKey(), -1);

  ['davi','cris'].forEach(u=>{
    const us = state.users[u];
    Object.keys(us.income||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete us.income[mKey]; });
    Object.keys(us.incomeExtra||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete us.incomeExtra[mKey]; });
    us.extras = (us.extras||[]).filter(e=> (e.mesFim||e.mesInicio) >= limitePlanner);
    (us.cartoes||[]).forEach(c=>{
      Object.keys(c.gastos||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete c.gastos[mKey]; });
    });
    us.expenses.futuro = (us.expenses.futuro||[]).filter(item=>{
      if(item.recorrente) return true; // recorrente nunca expira sozinho
      const isLegado = item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined;
      if(isLegado) return item.mes >= limitePlanner;
      const parcelas = item.parcelas || 1;
      const fim = addMonths(item.mesInicio || limitePlanner, parcelas-1);
      return fim >= limitePlanner;
    });
  });
  Object.keys(state.ponto.days||{}).forEach(mKey=>{ if(mKey < limitePonto) delete state.ponto.days[mKey]; });
  Object.keys(state.paid||{}).forEach(pk=>{
    const mKey = pk.split('_')[0];
    if(mKey < limitePlanner) delete state.paid[pk];
  });
}

/* ================= HELPERS DE DATA ================= */
function monthKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function keyToDate(key){ const [y,m]=key.split('-').map(Number); return new Date(y, m-1, 1); }
function addMonths(key, n){ const d=keyToDate(key); d.setMonth(d.getMonth()+n); return monthKey(d); }
function monthLabel(key){ const d=keyToDate(key); return MES_NOMES[d.getMonth()]+' '+d.getFullYear(); }
function monthLabelLong(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+' de '+d.getFullYear(); }
function monthLabelExtensoCurto(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+'/'+String(d.getFullYear()).slice(-2); }
function monthLabelExtenso(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+'/'+d.getFullYear(); }
function daysInMonth(key){ const d=keyToDate(key); return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function todayKey(){ return mesAtualRef; }
function mesFinanceiroAtual(){ return addMonths(todayKey(), 1); } // Planner/Panorama sempre operam 1 mês à frente (trabalhou em X, recebe/paga em X+1)
async function aplicarMesAtualManual(){
  const valor = document.getElementById('mesAtualManualInput')?.value;
  if(!valor) return;
  const ok = await iosConfirm(`Definir ${monthLabel(valor)} como mês atual? Isso muda o que o app considera "hoje" no Planner, Ponto PJ, Dashboard e cartões.`);
  if(!ok) return;
  definirMesAtual(valor);
}
function definirMesAtual(valor){
  mesAtualRef = valor;
  localStorage.setItem(MES_ATUAL_KEY, valor);
  if(state.focusMonth) state.focusMonth = mesFinanceiroAtual();
  renderAll();
}
