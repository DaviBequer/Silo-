/* ================= SILOÉ — APP INTEGRADO DE GESTÃO PESSOAL ================= */
/* Este arquivo contém APENAS estado, persistência, helpers e navegação.
   Cada app tem seu próprio arquivo de módulo para render/lógica específica. */

/* ================= ESTADO ================= */
const STORAGE_KEY = 'siloe-data-v1';
const MES_ATUAL_KEY = 'siloe-mes-atual';
let mesAtualRef = localStorage.getItem(MES_ATUAL_KEY);
if(!mesAtualRef){
  mesAtualRef = monthKey(new Date());
  localStorage.setItem(MES_ATUAL_KEY, mesAtualRef);
}

const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const PADRAO_SEGQUI_HORAS = 9;
const PADRAO_SEX_HORAS = 8;
const DIZIMO_PERCENT = 0.10;

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
    ponto:{ valorHora:0, padraoHoras:8, days:{} }
  };
}
let state = novoEstado();

/* ================= PERSISTÊNCIA ================= */
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){ console.error('Erro ao salvar', e); }
}
function carregar(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const saved = JSON.parse(raw);
      state = Object.assign(novoEstado(), saved);
      ['davi','cris'].forEach(u=>{
        if(!state.users[u]) state.users[u] = { income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } };
        if(!state.users[u].incomeExtra) state.users[u].incomeExtra = {};
        if(!state.users[u].extras){
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
      if(!state.cartoesTracker) state.cartoesTracker = [];
      if(!state.comprasTracker) state.comprasTracker = [];
      if(!state.metas) state.metas = [];
      if(!state.pagamentosParciais) state.pagamentosParciais = {};
      if(!state.contasArquivadas) state.contasArquivadas = {};
      if(state.reserva === undefined) state.reserva = 0;
      if(!state.receitas) state.receitas = [];
      if(!state.receitaCategorias) state.receitaCategorias = [];
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
      });
      if(!state.tarefas) state.tarefas = [];
      if(!state.tarefaCategorias) state.tarefaCategorias = [];
      (state.tarefas||[]).forEach(t=>{ if(t.tempoGasto===undefined) t.tempoGasto=0; if(t.timerStart===undefined) t.timerStart=null; });
      (state.cartoesTracker||[]).forEach(c=>{ if(!c.credoVista) c.credoVista=[]; });
      (state.comprasTracker||[]).forEach(cp=>{ if(cp.pago === undefined) cp.pago=false; });
      delete state.config;
    }
  }catch(e){ }
  limparDadosAntigos();
  renderAll();
}

/* ================= LIMPEZA AUTOMÁTICA ================= */
function limparDadosAntigos(){
  const limitePlanner = todayKey();
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
      if(item.recorrente) return true;
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
function popularSelectMes(selectId){
  const el = document.getElementById(selectId);
  if(!el) return;
  const valorAtual = el.value;
  const base = keyToDate(todayKey());
  let html = '<option value="">Selecione...</option>';
  for(let i=-36;i<=24;i++){
    const d = new Date(base.getFullYear(), base.getMonth()+i, 1);
    const key = monthKey(d);
    html += `<option value="${key}">${MES_NOMES_LONGOS[d.getMonth()]} de ${d.getFullYear()}</option>`;
  }
  el.innerHTML = html;
  if(valorAtual) el.value = valorAtual;
}
function daysInMonth(key){ const d=keyToDate(key); return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function todayKey(){ return mesAtualRef; }
function mesFinanceiroAtual(){ return addMonths(todayKey(), 1); }

/* Formatação de dinheiro */
function fmtMoney(v){ return (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtMoneySigned(v){ return v>=0 ? fmtMoney(v) : '-'+fmtMoney(Math.abs(v)); }
function parseMoney(str){
  if(!str) return 0;
  const cleaned = String(str).replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g,'');
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}
function maskMoneyInput(el){
  let digits = el.value.replace(/\D/g,'');
  if(digits===''){ el.value=''; return; }
  digits = digits.replace(/^0+(?=\d)/,'');
  while(digits.length<3) digits = '0'+digits;
  let cents = digits.slice(-2);
  let intPart = digits.slice(0,-2).replace(/^0+(?=\d)/,'');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  el.value = intPart+','+cents;
}
function handleMoneyKeydown(event){
  if(event.key !== 'Enter') return;
  event.preventDefault();
  event.target.blur();
  const td = event.target.closest('td');
  const nextTd = td && td.nextElementSibling;
  const nextInput = nextTd ? nextTd.querySelector('input') : null;
  if(nextInput){ nextInput.focus(); nextInput.select(); }
}


/* ================= LOGO PERSONALIZADA (REMOVIDO - já vem no arquivo) ================= */
function aplicarLogoSalva(){
  try{
    const saved = localStorage.getItem('siloe-logo');
    if(saved){
      const img = document.getElementById('headerLogoImg');
      img.src = saved;
      img.style.display = '';
      document.getElementById('headerLogoFallback').style.display = 'none';
    }
  }catch(e){ }
}

/* ================= ÍCONES SVG ================= */
const ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const ICON_PRATO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>';
const ICON_RECEITA_EMPTY = '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h1v11"/><path d="M6 2v6"/><path d="M9 2v6"/><path d="M18 2c-2 0-3.5 1.5-3.5 4v4.5c0 1.4 1.1 2.5 2.5 2.5v9"/></svg>';
const ICON_CLOCK_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
const ICON_PORCOES_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const ICON_DUPLICATE_SM = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
const ICON_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const ICON_CHART = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>';
const ICON_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_WALLET = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>';
const ICON_TREND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';

/* ================= NAVEGAÇÃO DE ABAS ================= */
function switchAba(aba){
  document.querySelectorAll('.aba').forEach(el=>el.classList.remove('active'));
  document.getElementById('aba-'+aba).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.aba===aba));
  if(aba==='ponto') renderPonto();
  if(aba==='planner') renderPlanner();
  if(aba==='panorama') renderPanorama();
  if(aba==='receitas') renderReceitas();
  if(aba==='louvor') renderLouvor();
  if(aba==='mercado') renderMercado();
}
function switchUser(user){
  state.currentUser = user;
  document.getElementById('tabDavi').classList.toggle('active', user==='davi');
  document.getElementById('tabCris').classList.toggle('active', user==='cris');
  renderPlanner();
  persist();
}

/* ================= CÁLCULOS FINANCEIROS COMPARTILHADOS ================= */
function rendaBaseForMonth(user, mKey){
  if(user === 'davi'){
    const mesAnterior = addMonths(mKey, -1);
    return computePontoMes(mesAnterior).valorReceber;
  }
  return state.users[user].income[mKey] || 0;
}
function extraTotalForMonth(user, mKey){
  return (state.users[user].extras||[]).reduce((sum,e)=>{
    const fim = e.mesFim || e.mesInicio;
    if(mKey >= e.mesInicio && mKey <= fim) return sum + (Number(e.valor)||0);
    return sum;
  }, 0);
}
function incomeForMonth(user, mKey){
  const isAtual = mKey === mesFinanceiroAtual();
  const saldo = isAtual ? (state.users[user].saldoAtual || 0) : 0;
  if(isAtual && state.users[user].usarSaldoComoBase){
    return saldo;
  }
  const base = rendaBaseForMonth(user, mKey);
  const extra = extraTotalForMonth(user, mKey);
  return base + extra + saldo;
}
function dizimoForMonth(user, mKey){
  if(user !== 'davi') return 0;
  const base = rendaBaseForMonth(user, mKey);
  return base * DIZIMO_PERCENT;
}
function futuroValorNoMes(item, mKey){
  if(item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined){
    return item.mes === mKey ? (Number(item.valor)||0) : 0;
  }
  if(item.recorrente){
    return mKey >= item.mesInicio ? (Number(item.valor)||0) : 0;
  }
  const parcelas = item.parcelas || 1;
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio, i));
  const idx = meses.indexOf(mKey);
  if(idx === -1) return 0;
  if(item.replicar === false){
    return Number((item.valores||{})[meses[idx]]) || 0;
  }
  return Number(item.valor) || 0;
}
function expensesForMonth(user, mKey){
  const ex = state.users[user].expenses;
  let total = 0;
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.mesInicio && mKey < item.mesInicio) return;
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
      if(state.paid[paidKey]) return;
      total += Number(item.valor)||0;
    });
  });
  ex.futuro.forEach(item=>{
    const v = futuroValorNoMes(item, mKey);
    if(v<=0) return;
    const paidKey = mKey+'_'+user+'_futuro_'+item.id;
    if(state.paid[paidKey]) return;
    total += v;
  });
  (state.users[user].cartoes||[]).forEach(c=>{ total += Number((c.gastos||{})[mKey]) || 0; });
  total += dizimoForMonth(user, mKey);
  return total;
}
function saldoForMonth(user, mKey){ return incomeForMonth(user,mKey) - expensesForMonth(user,mKey); }
function saldoHouseholdForMonth(mKey){ return saldoForMonth('davi',mKey) + saldoForMonth('cris',mKey); }
function getPanoWindowMonths(){
  if(state.panoOffset < 0) state.panoOffset = 0;
  const base = addMonths(mesFinanceiroAtual(), state.panoOffset);
  const arr = [];
  for(let i=0;i<6;i++) arr.push(addMonths(base,i));
  return arr;
}

/* ================= MONTH PICKER ================= */
const monthPickers = {};
function createMonthPicker(pickerId, hiddenInputId, defaultKey, onChange){
  const key = defaultKey || mesFinanceiroAtual();
  monthPickers[pickerId] = { year: keyToDate(key).getFullYear(), hiddenInputId, onChange };
  document.getElementById(hiddenInputId).value = defaultKey || '';
  document.getElementById(pickerId+'Btn').textContent = defaultKey ? monthLabelExtenso(defaultKey) : 'Selecione o mês';
  document.getElementById(pickerId+'Panel').style.display = 'none';
}
function toggleAccordion(bodyId){
  const body = document.getElementById(bodyId);
  const chevron = document.getElementById(bodyId+'Chevron');
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  if(chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}
function toggleMonthPicker(pickerId){
  const panel = document.getElementById(pickerId+'Panel');
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if(!isOpen){
    renderMonthPickerGrid(pickerId);
    setTimeout(()=>{ panel.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50);
  }
}
function shiftPickerYear(pickerId, delta){
  monthPickers[pickerId].year += delta;
  renderMonthPickerGrid(pickerId);
}
function renderMonthPickerGrid(pickerId){
  const st = monthPickers[pickerId];
  const hiddenVal = document.getElementById(st.hiddenInputId).value;
  document.getElementById(pickerId+'Year').textContent = st.year;
  const grid = document.getElementById(pickerId+'Grid');
  const hoje = mesFinanceiroAtual();
  let html = '';
  for(let m=0;m<12;m++){
    const key = st.year+'-'+String(m+1).padStart(2,'0');
    const isSelected = key === hiddenVal;
    const isCurrent = key === hoje;
    html += `<button type="button" class="month-picker-cell ${isSelected?'selected':''} ${isCurrent?'current':''}" onclick="selectPickerMonth('${pickerId}','${key}')">${MES_NOMES_LONGOS[m].slice(0,3)}</button>`;
  }
  grid.innerHTML = html;
}
function selectPickerMonth(pickerId, key){
  document.getElementById(monthPickers[pickerId].hiddenInputId).value = key;
  document.getElementById(pickerId+'Btn').textContent = monthLabelExtenso(key);
  document.getElementById(pickerId+'Panel').style.display = 'none';
  if(monthPickers[pickerId].onChange) monthPickers[pickerId].onChange();
}

/* ================= RENDER FUNCTIONS (CHAMADAS DOS MÓDULOS) ================= */
/* Estas são funções vazias/stubs que serão sobrescritas pelos módulos correspondentes */
function renderAll(){
  if(typeof renderPanorama === 'function') renderPanorama();
  if(typeof renderPlanner === 'function') renderPlanner();
  if(typeof renderPonto === 'function') renderPonto();
}
function renderPanorama(){}
function renderPlanner(){}
function renderPonto(){}
function renderReceitas(){}
function renderLouvor(){}
function renderMercado(){}

/* ================= CONCLUIR MÊS ================= */
function abrirConcluirMesModal(){
  const mesPontoAtual = todayKey();
  const mesPontoProximo = addMonths(mesPontoAtual, 1);
  const mesContasAtual = mesFinanceiroAtual();
  const mesContasProximo = addMonths(mesContasAtual, 1);
  
  document.getElementById('concluirMesInfo').innerHTML =
    `<div class="mc-field"><label>Ponto PJ</label>${monthLabel(mesPontoAtual)} → ${monthLabel(mesPontoProximo)}</div>` +
    `<div class="mc-field"><label>Contas (Panorama / Planner)</label>${monthLabel(mesContasAtual)} → ${monthLabel(mesContasProximo)}</div>`;
  
  document.getElementById('modalConcluirMes').classList.add('active');
}
function confirmarConcluirMes(){
  mesAtualRef = addMonths(mesAtualRef, 1);
  localStorage.setItem(MES_ATUAL_KEY, mesAtualRef);
  state.panoOffset = 0;
  state.pontoOffset = 0;
  state.focusMonth = mesFinanceiroAtual();
  closeModal('modalConcluirMes');
  renderAll();
  showToast('Mês concluído — avançou para ' + monthLabel(mesFinanceiroAtual()));
}

/* ================= MODAIS ================= */
function closeModal(id){ 
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.modal-overlay').forEach(ov=>{
    ov.addEventListener('click', e=>{ 
      if(e.target===ov){
        ov.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });
});

/* ================= TOAST ================= */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}

/* ================= CONFIRMAÇÃO (iOS-like) ================= */
function iosConfirm(msg){
  return new Promise(resolve=>{
    window.iosConfirmMsg = msg;
    window.iosConfirmResolver = resolve;
    document.getElementById('iosConfirmText').textContent = msg;
    document.getElementById('iosConfirmModal').classList.add('active');
  });
}
function iosConfirmResolver(v){
  document.getElementById('iosConfirmModal').classList.remove('active');
  if(window.iosConfirmResolver) window.iosConfirmResolver(v);
}

/* ================= IMPORT/EXPORT ================= */
function calcularStorageUsage(){
  let usado = 0;
  try{
    // Calcular tamanho REAL em bytes de TODOS os items do localStorage
    for(let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if(value){
        // Usar TextEncoder para contar bytes REAL (UTF-8)
        const keyBytes = new TextEncoder().encode(key).length;
        const valueBytes = new TextEncoder().encode(value).length;
        usado += keyBytes + valueBytes;
      }
    }
  }catch(e){}
  const total = 5 * 1024 * 1024; // 5MB
  const percentual = Math.min(100, Math.round((usado / total) * 100));
  return { usado, total, percentual };
}
function abrirImportExportModal(){
  document.getElementById('modalImportExport').classList.add('active');
  document.body.style.overflow = 'hidden';
  const storage = calcularStorageUsage();
  const usedMB = (storage.usado / (1024*1024)).toFixed(2);
  document.getElementById('storageBar').style.width = storage.percentual + '%';
  document.getElementById('storagePercent').textContent = storage.percentual + '%';
  document.getElementById('storageUsed').textContent = usedMB + ' MB';
}
function exportarDadosApp(){
  const versaoEl = document.querySelector('.header-version');
  const backup = {
    app: 'Siloe',
    versaoApp: versaoEl ? versaoEl.textContent.trim() : '',
    exportadoEm: new Date().toISOString(),
    mesAtual: mesAtualRef,
    logo: localStorage.getItem('siloe-logo') || null,
    state: state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `siloe-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeModal('modalImportExport');
  showToast('Backup exportado');
}
function triggerImportarDados(){
  document.getElementById('importFileInput').click();
}
function onImportFileSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    let backup;
    try{
      backup = JSON.parse(e.target.result);
    }catch(err){
      showToast('Não foi possível ler esse arquivo.');
      event.target.value = '';
      return;
    }
    if(!backup || typeof backup !== 'object' || !backup.state){
      showToast('Esse arquivo não é um backup válido do Siloé.');
      event.target.value = '';
      return;
    }
    iosConfirm('Importar vai substituir TODOS os dados atuais do app por esse backup. Continuar?').then(ok=>{
      event.target.value = '';
      if(!ok) return;
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.state));
        if(backup.mesAtual) localStorage.setItem(MES_ATUAL_KEY, backup.mesAtual);
        if(backup.logo) localStorage.setItem('siloe-logo', backup.logo);
        location.reload();
      }catch(err){
        showToast('Erro ao importar os dados.');
      }
    });
  };
  reader.readAsText(file);
}

/* ================= INIT ================= */
carregar();
aplicarLogoSalva();

/* ================= SERVICE WORKER ================= */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Erro ao registrar service worker', e));
  });
}
