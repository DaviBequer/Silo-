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
      davi:{ income:{}, incomeExtra:{}, saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } },
      cris:{ income:{}, incomeExtra:{}, saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } }
    },
    paid:{},
    pagamentosParciais:{},
    reserva:0,
    cartoesTracker:[],
    comprasTracker:[],
    metas:[],
    tarefas:[],
    tarefaCategorias:[],
    receitas:[],
    receitaCategorias:[],
    ponto:{ valorHora:0, padraoHoras:8, days:{} }
  };
}
let state = novoEstado();

/* ================= PERSISTÊNCIA (localStorage do navegador) ================= */
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
      // garante estrutura de usuários/categorias mesmo se dados antigos incompletos
      ['davi','cris'].forEach(u=>{
        if(!state.users[u]) state.users[u] = { income:{}, incomeExtra:{}, saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } };
        if(!state.users[u].incomeExtra) state.users[u].incomeExtra = {};
        if(state.users[u].saldoAtual === undefined) state.users[u].saldoAtual = 0;
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
      if(state.reserva === undefined) state.reserva = 0;
      if(!state.receitas) state.receitas = [];
      if(!state.receitaCategorias) state.receitaCategorias = [];
      if(!state.tarefas) state.tarefas = [];
      if(!state.tarefaCategorias) state.tarefaCategorias = [];
      (state.tarefas||[]).forEach(t=>{ if(t.tempoGasto===undefined) t.tempoGasto=0; if(t.timerStart===undefined) t.timerStart=null; });
      // migração: garantir campos novos
      (state.cartoesTracker||[]).forEach(c=>{ if(!c.credoVista) c.credoVista=[]; });
      (state.comprasTracker||[]).forEach(cp=>{ if(cp.pago === undefined) cp.pago=false; });
      delete state.config;
    }
  }catch(e){ /* sem dados salvos ainda */ }
  limparDadosAntigos();
  renderAll();
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
function mesFinanceiroAtual(){ return addMonths(todayKey(), 1); } // Planner/Panorama sempre operam 1 mês à frente (trabalhou em X, recebe/paga em X+1)
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
function maskTempoInput(el){
  let digits = el.value.replace(/\D/g,'').slice(0,4);
  if(digits.length<=2){ el.value = digits; return; }
  let h = digits.slice(0,-2), m = digits.slice(-2);
  el.value = h+':'+m;
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

const PADRAO_SEGQUI_HORAS = 9;
const PADRAO_SEX_HORAS = 8;

/* ================= LOGO PERSONALIZADA (escolhida pelo usuário no dispositivo) ================= */
function triggerLogoUpload(){ document.getElementById('logoFileInput').click(); }
function onLogoFileSelected(ev){
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const dataUrl = e.target.result;
    try{ localStorage.setItem('siloe-logo', dataUrl); }catch(err){ console.error('Erro ao salvar logo', err); }
    aplicarLogoSalva();
    showToast('Logo atualizada');
  };
  reader.readAsDataURL(file);
}
function aplicarLogoSalva(){
  try{
    const saved = localStorage.getItem('siloe-logo');
    if(saved){
      const img = document.getElementById('headerLogoImg');
      img.src = saved;
      img.style.display = '';
      document.getElementById('headerLogoFallback').style.display = 'none';
    }
  }catch(e){ /* sem logo salva ainda */ }
}

/* ================= ÍCONES SVG (sem emoji) ================= */
const ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>';
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
}
function switchUser(user){
  state.currentUser = user;
  document.getElementById('tabDavi').classList.toggle('active', user==='davi');
  document.getElementById('tabCris').classList.toggle('active', user==='cris');
  renderPlanner();
  persist();
}

/* ================= CÁLCULOS FINANCEIROS ================= */
const DIZIMO_PERCENT = 0.10;

function rendaBaseForMonth(user, mKey){
  if(user === 'davi'){
    const mesAnterior = addMonths(mKey, -1);
    return computePontoMes(mesAnterior).valorReceber;
  }
  return state.users[user].income[mKey] || 0;
}
function incomeForMonth(user, mKey){
  const base = rendaBaseForMonth(user, mKey);
  const extra = (state.users[user].incomeExtra && state.users[user].incomeExtra[mKey]) || 0;
  const saldo = (mKey === mesFinanceiroAtual()) ? (state.users[user].saldoAtual || 0) : 0;
  return base + extra + saldo;
}
function dizimoForMonth(user, mKey){
  if(user !== 'davi') return 0;
  const base = rendaBaseForMonth(user, mKey);
  return base * DIZIMO_PERCENT;
}
function futuroValorNoMes(item, mKey){
  // compatibilidade com formato antigo (mês único)
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
      if(item.mesInicio && mKey < item.mesInicio) return; // ainda não começou a contar
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
      if(state.paid[paidKey]) return; // já pago neste mês, não conta mais
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

/* ================= RENDER: PANORAMA ================= */
/* ================= PLANEJADOR DE METAS / SIMULADOR ================= */
let simuladorMetas = [];

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

function openSimuladorModal(){
  simuladorMetas = [];
  document.getElementById('simuladorMetasForm').reset();
  document.getElementById('addMetaAccordion').style.display = 'none';
  document.getElementById('addMetaAccordionChevron').style.transform = 'rotate(0deg)';
  createMonthPicker('simMetaMesPicker', 'simMetaMes', mesFinanceiroAtual());
  renderSimulador();
  document.getElementById('modalSimulador').classList.add('active');
}

function closeSimulador(){
  document.getElementById('modalSimulador').classList.remove('active');
  simuladorMetas = [];
}

function adicionarMetaSimulador(){
  const nome = document.getElementById('simMetaNome').value.trim();
  const valor = parseMoney(document.getElementById('simMetaValor').value);
  const parcelas = Math.max(1, parseInt(document.getElementById('simMetaParcelas').value) || 1);
  const mes = document.getElementById('simMetaMes').value;
  
  if(!nome){ showToast('Digite o nome da meta'); return; }
  if(!valor){ showToast('Digite o valor'); return; }
  if(!mes){ showToast('Selecione o mês'); return; }
  
  simuladorMetas.push({
    id: 'meta_'+Date.now(),
    nome, valor, parcelas, mes
  });
  
  document.getElementById('simMetaNome').value = '';
  document.getElementById('simMetaValor').value = '';
  document.getElementById('simMetaParcelas').value = '1';
  
  renderSimulador();
}

function removerMetaSimulador(id){
  simuladorMetas = simuladorMetas.filter(m=>m.id!==id);
  renderSimulador();
}

function excluirMetaSalva(id){
  state.metas = (state.metas||[]).filter(m=>m.id!==id);
  persist();
  renderSimulador();
  showToast('Meta removida');
}

function impactoMetasNoMes(mKey){
  let impacto = 0;
  const todasMetas = [...simuladorMetas, ...(state.metas||[])];
  todasMetas.forEach(meta=>{
    const valorMes = meta.valor / meta.parcelas;
    for(let i=0;i<meta.parcelas;i++){
      if(addMonths(meta.mes, i) === mKey) impacto += valorMes;
    }
  });
  return impacto;
}

function calcularComparativoMeses(nMeses){
  const hoje = mesFinanceiroAtual();
  const meses = [];
  let acumulado = 0;
  for(let i=0;i<nMeses;i++){
    const mKey = addMonths(hoje, i);
    const renda = (incomeForMonth('davi', mKey) || 0) + (incomeForMonth('cris', mKey) || 0);
    const gasto = (expensesForMonth('davi', mKey) || 0) + (expensesForMonth('cris', mKey) || 0);
    const sobra = renda - gasto;
    const impacto = impactoMetasNoMes(mKey);
    const saldoFinal = sobra - impacto;
    if(i>0) acumulado += saldoFinal;
    meses.push({ mKey, label: monthLabel(mKey), renda, gasto, sobra, impacto, saldoFinal, acumulado: i===0 ? null : acumulado });
  }
  return meses;
}

function calcularImpactoSimulador(){
  const mKeyAtual = mesFinanceiroAtual();
  const rendaTotal = (incomeForMonth('davi', mKeyAtual) || 0) + (incomeForMonth('cris', mKeyAtual) || 0);
  const gastoTotal = (expensesForMonth('davi', mKeyAtual) || 0) + (expensesForMonth('cris', mKeyAtual) || 0);
  const saldoPrevisto = rendaTotal - gastoTotal;
  const totalCartoes = (state.cartoesTracker||[]).reduce((s,c)=>{
    const compras = (state.comprasTracker||[]).filter(cp=>cp.cartaoId===c.id && !cp.pago);
    const usado = compras.reduce((s2,item)=>{ const calc=compraTrackerCalc(item); return s2 + (calc.status==='concluido'?0:calc.restante); },0) + (c.credoVista?.reduce((s2,v)=>s2+Number(v.valor||0),0)||0);
    return s + usado;
  },0);
  return { rendaTotal, gastoTotal, saldoPrevisto, totalCartoes };
}

function renderSimulador(){
  const calc = calcularImpactoSimulador();
  
  const painelAtual = `
    <div class="simulador-linha">
      <span class="label">Saldo Disponível</span>
      <span class="valor">${fmtMoney(state.users.davi.saldoAtual + state.users.cris.saldoAtual)}</span>
    </div>
    <div class="simulador-linha">
      <span class="label">Receita (${monthLabel(mesFinanceiroAtual())})</span>
      <span class="valor">${fmtMoney(calc.rendaTotal)}</span>
    </div>
    <div class="simulador-linha">
      <span class="label">Gastos (${monthLabel(mesFinanceiroAtual())})</span>
      <span class="valor">${fmtMoney(calc.gastoTotal)}</span>
    </div>
    <div class="simulador-linha">
      <span class="label">Saldo Previsto</span>
      <span class="valor" style="color:${calc.saldoPrevisto>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(calc.saldoPrevisto)}</span>
    </div>
    <div class="simulador-linha">
      <span class="label">Cartões (abertos)</span>
      <span class="valor">${fmtMoney(calc.totalCartoes)}</span>
    </div>
  `;
  document.getElementById('simPainelAtual').innerHTML = painelAtual;
  
  // Lista de metas sendo montadas nesta sessão
  const listaHtml = simuladorMetas.length === 0
    ? '<div style="text-align:center;padding:16px;color:var(--slate-500);font-size:12px">Nenhuma meta adicionada ainda</div>'
    : simuladorMetas.map(meta => `
      <div class="simulador-meta-item">
        <div class="nome">${meta.nome}</div>
        <div class="info">
          <div style="margin-bottom:4px">${fmtMoney(meta.valor)} em ${meta.parcelas}x = ${fmtMoney(meta.valor/meta.parcelas)}/mês</div>
          <div style="font-size:11px;color:var(--slate-500)">Começa em ${monthLabel(meta.mes)}</div>
        </div>
        <button class="btn btn-sm btn-outline btn-remove" onclick="removerMetaSimulador('${meta.id}')">Remover</button>
      </div>
    `).join('');
  document.getElementById('simMetasLista').innerHTML = listaHtml;

  // Metas já salvas anteriormente
  const salvasWrap = document.getElementById('simMetasSalvas');
  if(salvasWrap){
    const salvas = state.metas || [];
    salvasWrap.innerHTML = salvas.length === 0 ? '' : `<h4 style="margin-top:0">${ICON_SAVE}Metas Salvas</h4>` + salvas.map(meta => `
      <div class="simulador-meta-item">
        <div class="nome">${meta.nome}</div>
        <div class="info">
          <div style="margin-bottom:4px">${fmtMoney(meta.valor)} em ${meta.parcelas}x = ${fmtMoney(meta.valor/meta.parcelas)}/mês</div>
          <div style="font-size:11px;color:var(--slate-500)">Começa em ${monthLabel(meta.mes)}</div>
        </div>
        <button class="btn btn-sm btn-outline btn-remove" onclick="excluirMetaSalva('${meta.id}')">Excluir</button>
      </div>
    `).join('');
  }
  
  // Comparativo lado a lado dos próximos meses
  const comparativo = calcularComparativoMeses(6);
  const comparativoHtml = `
    <div class="simulador-painel">
      <h4>${ICON_CHART}Comparativo dos Próximos Meses</h4>
      <div class="comparativo-scroll">
        ${comparativo.map(m => `
          <div class="comparativo-card ${m.mKey===mesFinanceiroAtual()?'atual':''}">
            <div class="cc-mes">${m.label}</div>
            <div class="cc-linha"><span>Renda</span><span>${fmtMoney(m.renda)}</span></div>
            <div class="cc-linha"><span>Gasto</span><span>${fmtMoney(m.gasto)}</span></div>
            <div class="cc-linha"><span>Sobra</span><span style="color:${m.sobra>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(m.sobra)}</span></div>
            ${m.impacto>0?`<div class="cc-linha cc-impacto"><span>Metas</span><span>-${fmtMoney(m.impacto)}</span></div>`:''}
            <div class="cc-linha cc-final"><span>Final</span><span style="color:${m.saldoFinal>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(m.saldoFinal)}</span></div>
            <div class="cc-linha cc-acumulado"><span>Acumulado</span><span>${m.acumulado===null?'—':fmtMoneySigned(m.acumulado)}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  const primeiroMesComImpacto = comparativo.find(m=>m.saldoFinal<0);
  const alertaHtml = primeiroMesComImpacto ? `<div class="simulador-alerta">${ICON_ALERT}Atenção: Saldo ficaria negativo em ${primeiroMesComImpacto.label}!</div>` : '';
  
  document.getElementById('simPainelSimulacao').innerHTML = comparativoHtml + alertaHtml;
}

function salvarMetas(){
  if(simuladorMetas.length === 0){ showToast('Adicione pelo menos uma meta'); return; }
  state.metas = [...(state.metas||[]), ...simuladorMetas];
  persist();
  simuladorMetas = [];
  renderSimulador();
  showToast('Metas salvas com sucesso!');
}

function renderAll(){ renderPanorama(); renderPlanner(); renderPonto(); }

function renderPanorama(){
  const months = getPanoWindowMonths();
  document.getElementById('panoWindowLabel').textContent = monthLabel(months[0])+' – '+monthLabel(months[5]);

  if(!months.includes(state.focusMonth)) state.focusMonth = months[0];

  renderAcumTable(months);
  renderTrendChart(months);
  renderPanoPonto();

  const mesAnterior = addMonths(state.focusMonth, -1);
  const userSection = document.getElementById('panoUserSection');
  userSection.innerHTML = ['davi','cris'].map(u=>{
    const receita = incomeForMonth(u, state.focusMonth);
    const gastos = expensesForMonth(u, state.focusMonth);
    const gastosAnterior = expensesForMonth(u, mesAnterior);
    const sobra = receita - gastos;
    const diffGastos = gastos - gastosAnterior;
    const pctGastos = gastosAnterior > 0 ? (diffGastos/gastosAnterior*100) : null;
    const gastosComparativo = pctGastos===null ? '' :
      `<div class="meta" style="margin-top:2px;color:${diffGastos>0?'var(--slate-700)':'var(--slate-500)'}">${diffGastos>=0?'▲':'▼'} ${Math.abs(pctGastos).toFixed(0)}% (${fmtMoneySigned(diffGastos)}) vs mês anterior</div>`;
    return `<div class="user-card ${u==='cris'?'cris':''}">
      <div class="u-name">${u==='davi'?'Davi':'Cris'}</div>
      <div class="u-row" style="cursor:pointer" onclick="abrirDetalheAcumulado('${state.focusMonth}')"><span class="lbl">Receita</span><span class="u-receita">${fmtMoney(receita)}</span></div>
      <div class="u-row" style="cursor:pointer" onclick="abrirDetalheAcumulado('${state.focusMonth}')"><span class="lbl">Gastos</span><span class="u-gastos">${fmtMoney(gastos)}</span></div>
      ${gastosComparativo}
      <div class="u-sobra ${sobra>=0?'positive':'negative'}"><span class="lbl">Sobra</span><span>${fmtMoneySigned(sobra)}</span></div>
    </div>`;
  }).join('');

  document.getElementById('contasMesLabel').textContent = monthLabel(state.focusMonth);
  renderChecklist();
  renderSumarioPanorama();
}

function categoryTotalForMonth(cat, mKey){
  let total = 0;
  ['davi','cris'].forEach(user=>{
    const ex = state.users[user].expenses;
    if(cat==='futuro'){
      ex.futuro.forEach(item=>{
        const v = futuroValorNoMes(item, mKey);
        if(v<=0) return;
        const paidKey = mKey+'_'+user+'_futuro_'+item.id;
        if(state.paid[paidKey]) return;
        total += v;
      });
    } else {
      ex[cat].forEach(item=>{
        if(item.mesInicio && mKey < item.mesInicio) return;
        const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
        if(state.paid[paidKey]) return;
        total += Number(item.valor)||0;
      });
    }
  });
  return total;
}
function renderSumarioPanorama(){
  const summary = document.getElementById('sumarioPanorama');
  if(!summary) return;
  const mKeyAtual = state.focusMonth;
  const rendaTotal = (incomeForMonth('davi', mKeyAtual) || 0) + (incomeForMonth('cris', mKeyAtual) || 0);
  const totalCartoes = (state.cartoesTracker||[]).reduce((s,c)=>{
    const compras = (state.comprasTracker||[]).filter(cp=>cp.cartaoId===c.id && !cp.pago);
    const usado = compras.reduce((s2,item)=>{ const calc=compraTrackerCalc(item); return s2 + (calc.status==='concluido'?0:calc.restante); },0) + (c.credoVista?.reduce((s2,v)=>s2+Number(v.valor||0),0)||0);
    return s + usado;
  },0);
  const moradia = categoryTotalForMonth('moradia', mKeyAtual);
  const assinatura = categoryTotalForMonth('assinatura', mKeyAtual);
  const fixo = categoryTotalForMonth('fixo', mKeyAtual);
  const futuro = categoryTotalForMonth('futuro', mKeyAtual);
  document.getElementById('sumarioPanoramaMes').textContent = monthLabel(mKeyAtual);
  summary.innerHTML = `
    <div class="summary-row"><span>Renda Total</span><span class="summary-value">${fmtMoney(rendaTotal)}</span></div>
    <div class="summary-row"><span>Moradia</span><span class="summary-value">${fmtMoney(moradia)}</span></div>
    <div class="summary-row"><span>Fixos</span><span class="summary-value">${fmtMoney(fixo)}</span></div>
    <div class="summary-row"><span>Assinaturas</span><span class="summary-value">${fmtMoney(assinatura)}</span></div>
    <div class="summary-row"><span>Contas Futuras</span><span class="summary-value">${fmtMoney(futuro)}</span></div>
    <div class="summary-row"><span>Cartões</span><span class="summary-value">${fmtMoney(totalCartoes)}</span></div>
  `;
}

function renderPanoPonto(){
  const atual = todayKey();
  const passado = addMonths(atual, -1);
  const rAtual = computePontoMes(atual);
  const rPassado = computePontoMes(passado);
  document.getElementById('panoPontoHoras').textContent = minToHoursLabel(rAtual.totalMin);
  document.getElementById('panoPontoValor').textContent = fmtMoney(rAtual.valorReceber);

  const diff = rAtual.valorReceber - rPassado.valorReceber;
  const pct = rPassado.valorReceber > 0 ? (diff/rPassado.valorReceber*100) : null;
  document.getElementById('panoPontoComparativo').textContent = pct===null
    ? 'Sem dados do mês anterior para comparar'
    : (diff>=0?'▲ ':'▼ ')+Math.abs(pct).toFixed(0)+'% ('+fmtMoneySigned(diff)+') vs mês anterior';
}

function renderTrendChart(months){
  const wrap = document.getElementById('trendChartWrap');
  if(!wrap) return;
  let acumulado = 0;
  const sobras = months.map(mKey=> saldoHouseholdForMonth(mKey));
  const acumulados = sobras.map(s=>{ acumulado += s; return acumulado; });

  const w = 320, h = 170, padL = 8, padR = 8, padTop = 14, padBottom = 26;
  const plotH = h - padTop - padBottom;
  const allVals = [...sobras, ...acumulados, 0];
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const range = (max-min) || 1;
  const scaleY = v => padTop + plotH - ((v-min)/range)*plotH;
  const zeroY = scaleY(0);

  const stepX = (w-padL-padR) / months.length;
  const barW = Math.min(22, stepX*0.42);

  const bars = sobras.map((s,i)=>{
    const cx = padL + stepX*i + stepX/2;
    const y1 = scaleY(Math.max(0,s));
    const y2 = scaleY(Math.min(0,s));
    const cor = s>=0 ? 'var(--success)' : 'var(--danger)';
    return `<rect x="${(cx-barW/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1,(y2-y1)).toFixed(1)}" rx="3" fill="${cor}" opacity="0.85"><title>${monthLabel(months[i])} · Sobra: ${fmtMoneySigned(s)}</title></rect>`;
  }).join('');

  const linePts = acumulados.map((v,i)=>{
    const x = padL + stepX*i + stepX/2;
    const y = scaleY(v);
    return [x,y];
  });
  const pathD = linePts.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const circles = linePts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--primary)" stroke="#fff" stroke-width="1.5"><title>${monthLabel(months[i])} · Acumulado: ${fmtMoneySigned(acumulados[i])}</title></circle>`).join('');

  const labels = months.map((m,i)=>{
    const cx = padL + stepX*i + stepX/2;
    return `<text x="${cx.toFixed(1)}" y="${h-8}" font-size="9" fill="var(--slate-400)" text-anchor="middle" font-weight="600">${monthLabel(m).slice(0,3)}</text>`;
  }).join('');

  wrap.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block">
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${w-padR}" y2="${zeroY.toFixed(1)}" stroke="var(--slate-200)" stroke-width="1"/>
      ${bars}
      <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="2"/>
      ${circles}
      ${labels}
    </svg>
    <div class="trend-legend">
      <span><i style="background:var(--success)"></i>Sobra do mês</span>
      <span><i style="background:var(--primary);border-radius:50%"></i>Acumulado</span>
    </div>
  `;
}

function expenseBreakdownForMonth(user, mKey){
  const ex = state.users[user].expenses;
  const breakdown = { moradia:0, assinatura:0, fixo:0, futuro:0, cartao:0, dizimo:0 };
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.mesInicio && mKey < item.mesInicio) return;
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
      if(state.paid[paidKey]) return;
      breakdown[cat] += Number(item.valor)||0;
    });
  });
  ex.futuro.forEach(item=>{
    const v = futuroValorNoMes(item, mKey);
    if(v<=0) return;
    const paidKey = mKey+'_'+user+'_futuro_'+item.id;
    if(state.paid[paidKey]) return;
    breakdown.futuro += v;
  });
  (state.users[user].cartoes||[]).forEach(c=>{ breakdown.cartao += Number((c.gastos||{})[mKey]) || 0; });
  breakdown.dizimo = dizimoForMonth(user, mKey);
  breakdown.total = breakdown.moradia + breakdown.assinatura + breakdown.fixo + breakdown.futuro + breakdown.cartao + breakdown.dizimo;
  return breakdown;
}

function abrirDetalheAcumulado(mKey){
  const months = getPanoWindowMonths();
  const idx = months.indexOf(mKey);
  const mesesAteAqui = idx >= 0 ? months.slice(0, idx+1) : [mKey];
  const hoje = mesFinanceiroAtual();

  // Composição do mês selecionado
  let composicaoHtml = '';
  ['davi','cris'].forEach(user=>{
    const renda = incomeForMonth(user, mKey);
    const bd = expenseBreakdownForMonth(user, mKey);
    composicaoHtml += `
      <div class="detalhe-usuario">
        <div class="detalhe-usuario-nome">${user==='davi'?'Davi':'Cris'}</div>
        <div class="simulador-linha"><span class="label">Renda</span><span class="valor" style="color:var(--success)">${fmtMoney(renda)}</span></div>
        ${bd.moradia>0?`<div class="simulador-linha"><span class="label">Moradia</span><span class="valor">-${fmtMoney(bd.moradia)}</span></div>`:''}
        ${bd.fixo>0?`<div class="simulador-linha"><span class="label">Fixos</span><span class="valor">-${fmtMoney(bd.fixo)}</span></div>`:''}
        ${bd.assinatura>0?`<div class="simulador-linha"><span class="label">Assinaturas</span><span class="valor">-${fmtMoney(bd.assinatura)}</span></div>`:''}
        ${bd.futuro>0?`<div class="simulador-linha"><span class="label">Contas Futuras</span><span class="valor">-${fmtMoney(bd.futuro)}</span></div>`:''}
        ${bd.cartao>0?`<div class="simulador-linha"><span class="label">Cartão</span><span class="valor">-${fmtMoney(bd.cartao)}</span></div>`:''}
        ${bd.dizimo>0?`<div class="simulador-linha"><span class="label">Dízimo</span><span class="valor">-${fmtMoney(bd.dizimo)}</span></div>`:''}
        <div class="simulador-linha" style="border-top:2px solid var(--slate-200);margin-top:4px;padding-top:8px"><span class="label" style="font-weight:800">Sobra ${user==='davi'?'Davi':'Cris'}</span><span class="valor" style="font-weight:900">${fmtMoneySigned(renda-bd.total)}</span></div>
      </div>
    `;
  });
  const sobraTotal = saldoHouseholdForMonth(mKey);

  // Como chegou no acumulado
  let acumuladoHtml = '';
  let rodante = 0;
  mesesAteAqui.forEach(m=>{
    const s = saldoHouseholdForMonth(m);
    rodante += s;
    const isAtual = m===mKey;
    acumuladoHtml += `<div class="simulador-linha ${isAtual?'':''}" style="${isAtual?'font-weight:900':''}"><span class="label">${monthLabelExtensoCurto(m)}</span><span class="valor" style="color:${s>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(s)}</span></div>`;
  });

  const modalContent = `
    <div class="simulador-painel">
      <h4>${ICON_WALLET}Composição de ${monthLabelExtensoCurto(mKey)}</h4>
      ${composicaoHtml}
      <div class="simulador-linha" style="border-top:2px solid var(--primary);margin-top:8px;padding-top:10px"><span class="label" style="font-weight:900;font-size:14px">Sobra Total do Mês</span><span class="valor" style="font-weight:900;font-size:16px;color:${sobraTotal>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(sobraTotal)}</span></div>
    </div>
    <div class="simulador-painel">
      <h4>${ICON_TREND}Como chegou no Acumulado ${mKey===hoje?'':('('+monthLabelExtensoCurto(mesesAteAqui[0])+' até '+monthLabelExtensoCurto(mKey)+')')}</h4>
      ${mKey===hoje ? '<div style="font-size:12px;color:var(--slate-500)">O mês atual não tem acumulado — ainda não há mês anterior pra somar.</div>' : acumuladoHtml}
      ${mKey!==hoje ? `<div class="simulador-linha" style="border-top:2px solid var(--primary);margin-top:8px;padding-top:10px"><span class="label" style="font-weight:900">Acumulado Final</span><span class="valor" style="font-weight:900;font-size:15px;color:${rodante>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(rodante)}</span></div>` : ''}
    </div>
  `;
  document.getElementById('detalheAcumuladoTitulo').textContent = monthLabelExtensoCurto(mKey);
  document.getElementById('detalheAcumuladoConteudo').innerHTML = modalContent;
  document.getElementById('modalDetalheAcumulado').classList.add('active');
}

function renderAcumTable(months){
  let acumulado = 0;
  const hoje = mesFinanceiroAtual();
  const rows = months.map(mKey=>{
    const sobra = saldoHouseholdForMonth(mKey);
    acumulado += sobra;
    const isSelected = mKey === state.focusMonth;
    const isHoje = mKey === hoje;
    const acumuladoTxt = isHoje ? '—' : `<span style="color:${acumulado>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(acumulado)}</span>`;
    return `<tr class="${isSelected?'selected-row':''}" onclick="selectFocusMonth('${mKey}');abrirDetalheAcumulado('${mKey}')" style="cursor:pointer">
      <td class="row-label">${monthLabel(mKey)}${isSelected?' •':''}</td>
      <td style="font-weight:700;color:${sobra>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(sobra)}</td>
      <td style="font-weight:800">${acumuladoTxt}</td>
    </tr>`;
  }).join('');
  document.getElementById('acumTableBody').innerHTML = rows;
}

function selectFocusMonth(mKey){
  state.focusMonth = mKey;
  renderPanorama();
  persist();
}
function shiftPanoWindow(delta){
  state.panoOffset = Math.max(0, state.panoOffset + delta);
  renderPanorama();
  persist();
}

function futuroParcelaNoMes(item, mKey){
  if(item.recorrente) return null;
  const parcelas = item.parcelas || 1;
  if(parcelas<=1 || !item.mesInicio) return null;
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio,i));
  const idx = meses.indexOf(mKey);
  if(idx===-1) return null;
  return { atual: idx+1, total: parcelas };
}
function getContasDoMes(mKey){
  let items = [];
  ['davi','cris'].forEach(u=>{
    ['moradia','assinatura','fixo'].forEach(cat=>{
      state.users[u].expenses[cat].forEach(item=>{
        if(item.mesInicio && mKey < item.mesInicio) return;
        items.push({ user:u, cat, id:item.id, desc:item.desc, valor:item.valor, dia:item.dia||1, logoUrl:item.logoUrl||null });
      });
    });
    state.users[u].expenses.futuro.forEach(item=>{
      const v = futuroValorNoMes(item, mKey);
      if(v > 0){
        const p = futuroParcelaNoMes(item, mKey);
        items.push({ user:u, cat:'futuro', id:item.id, desc:item.desc + (p?' ('+p.atual+'/'+p.total+')':''), valor:v, dia:item.dia||1, logoUrl:item.logoUrl||null });
      }
    });
  });
  items.sort((a,b)=> (a.dia||1) - (b.dia||1));
  return items;
}
function contasEmAbertoNoMes(mKey){
  return getContasDoMes(mKey).filter(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    return !state.paid[paidKey];
  }).length;
}
function renderChecklist(){
  const mKey = state.focusMonth;
  const items = getContasDoMes(mKey);

  const list = document.getElementById('contasChecklist');
  if(items.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="title">Nenhuma conta neste mês</div><div class="desc">Adicione gastos no Planner</div></div>`;
    return;
  }
  // ordenar: usuário (davi primeiro), depois valor decrescente
  items.sort((a,b)=>{
    if(a.user !== b.user) return a.user === 'davi' ? -1 : 1;
    return (b.valor||0) - (a.valor||0);
  });
  list.innerHTML = items.map(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    const isPaid = !!state.paid[paidKey];
    const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
    const isParcial = !isPaid && valorPago > 0;
    const logo = it.logoUrl
      ? `<img src="${it.logoUrl}" class="conta-logo">`
      : `<div class="conta-logo conta-logo-placeholder">${it.desc.charAt(0).toUpperCase()}</div>`;
    return `<div class="check-item-compact ${isPaid?'paid':''}" onclick="abrirEditarConta('${paidKey}','${it.user}','${it.cat}','${it.id}','${mKey}')">
      ${logo}
      <input type="checkbox" ${isPaid?'checked':''} onclick="event.stopPropagation()" onchange="togglePaid('${paidKey}')">
      <div class="info">
        <div class="desc">${it.desc}</div>
        <div class="meta"><span class="user-tag ${it.user}">${it.user==='davi'?'Davi':'Cris'}</span> · dia ${it.dia} · ${fmtMoney(it.valor)}${isParcial?` <span style="color:var(--warning);font-weight:700">· pago ${fmtMoney(valorPago)}</span>`:''}</div>
      </div>
    </div>`;
  }).join('');
}
function togglePaid(paidKey){
  state.paid[paidKey] = !state.paid[paidKey];
  if(state.paid[paidKey] && state.pagamentosParciais) delete state.pagamentosParciais[paidKey];
  persist();
  renderPanorama();
}

function getGastoItemRef(user, cat, id){
  return state.users[user].expenses[cat].find(i=>i.id===id);
}

let editandoConta = null;
function abrirEditarConta(paidKey, user, cat, id, mKey){
  const item = getGastoItemRef(user, cat, id);
  if(!item) return;
  editandoConta = { paidKey, user, cat, id, mKey };
  const valorTotal = cat==='futuro' ? futuroValorNoMes(item, mKey) : item.valor;
  const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
  const isPaid = !!state.paid[paidKey];

  document.getElementById('editarContaTitulo').textContent = item.desc;
  document.getElementById('editarContaValorTotal').textContent = fmtMoney(valorTotal);
  document.getElementById('editarContaValorPago').value = valorPago ? valorPago.toFixed(2).replace('.',',') : '';
  document.getElementById('editarContaLogoPreview').innerHTML = item.logoUrl
    ? `<img src="${item.logoUrl}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${item.desc.charAt(0).toUpperCase()}</div>`;
  document.getElementById('editarContaPagaCheck').checked = isPaid;
  document.getElementById('modalEditarConta').classList.add('active');
}
function closeEditarConta(){
  document.getElementById('modalEditarConta').classList.remove('active');
  editandoConta = null;
}
function onContaLogoSelected(event){
  const file = event.target.files[0];
  if(!file || !editandoConta) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const item = getGastoItemRef(editandoConta.user, editandoConta.cat, editandoConta.id);
    if(item){
      item.logoUrl = e.target.result;
      persist();
      document.getElementById('editarContaLogoPreview').innerHTML = `<img src="${item.logoUrl}" class="conta-logo-grande">`;
      renderChecklist();
    }
  };
  reader.readAsDataURL(file);
}
function removerContaLogo(){
  if(!editandoConta) return;
  const item = getGastoItemRef(editandoConta.user, editandoConta.cat, editandoConta.id);
  if(item){
    delete item.logoUrl;
    persist();
    document.getElementById('editarContaLogoPreview').innerHTML = `<div class="conta-logo-grande conta-logo-placeholder">${item.desc.charAt(0).toUpperCase()}</div>`;
    renderChecklist();
  }
}
function salvarPagamentoConta(){
  if(!editandoConta) return;
  const { paidKey, user, cat, id, mKey } = editandoConta;
  const item = getGastoItemRef(user, cat, id);
  if(!item) return;
  const valorTotal = cat==='futuro' ? futuroValorNoMes(item, mKey) : item.valor;
  const valorPago = parseMoney(document.getElementById('editarContaValorPago').value);
  const pagaIntegral = document.getElementById('editarContaPagaCheck').checked;

  if(!state.pagamentosParciais) state.pagamentosParciais = {};
  if(pagaIntegral || valorPago >= valorTotal){
    state.paid[paidKey] = true;
    delete state.pagamentosParciais[paidKey];
  } else if(valorPago > 0){
    state.paid[paidKey] = false;
    state.pagamentosParciais[paidKey] = valorPago;
  } else {
    state.paid[paidKey] = false;
    delete state.pagamentosParciais[paidKey];
  }
  persist();
  closeEditarConta();
  renderPanorama();
  showToast('Conta atualizada');
}

/* ================= RENDER: PLANNER ================= */
/* ================= LISTA DE TAREFAS (isolado, visual apenas) ================= */
let tarefaTimerInterval = null;

function openTarefasModal(){
  document.getElementById('pageTarefas').classList.add('active');
  renderTarefasModal();
  if(tarefaTimerInterval) clearInterval(tarefaTimerInterval);
  tarefaTimerInterval = setInterval(tickTarefaTimers, 1000);
}
function closeTarefasPage(){
  document.getElementById('pageTarefas').classList.remove('active');
  if(tarefaTimerInterval){ clearInterval(tarefaTimerInterval); tarefaTimerInterval = null; }
}
function novaTarefaCategoria(nome){
  if(!nome) return null;
  let cat = (state.tarefaCategorias||[]).find(c=>c.nome.toLowerCase()===nome.toLowerCase());
  if(!cat){
    cat = { id:'cat'+Date.now(), nome };
    state.tarefaCategorias.push(cat);
  }
  return cat.id;
}
function salvarTarefa(){
  const nome = document.getElementById('tarefaNome').value.trim();
  const desc = document.getElementById('tarefaDesc').value.trim();
  const catInput = document.getElementById('tarefaCategoria').value.trim();
  if(!nome){ showToast('Digite o nome da tarefa'); return; }
  const categoriaId = catInput ? novaTarefaCategoria(catInput) : null;
  state.tarefas.push({ id:'tf'+Date.now(), nome, desc, categoriaId, feita:false, tempoGasto:0, timerStart:null });
  persist();
  document.getElementById('tarefaNome').value = '';
  document.getElementById('tarefaDesc').value = '';
  document.getElementById('tarefaCategoria').value = '';
  renderTarefasModal();
}
function toggleTarefa(id){
  const t = state.tarefas.find(t=>t.id===id);
  if(t){ t.feita = !t.feita; persist(); renderTarefasModal(); }
}
function excluirTarefa(id){
  state.tarefas = state.tarefas.filter(t=>t.id!==id);
  persist();
  renderTarefasModal();
}
function excluirTarefaCategoria(id){
  state.tarefaCategorias = state.tarefaCategorias.filter(c=>c.id!==id);
  state.tarefas.forEach(t=>{ if(t.categoriaId===id) t.categoriaId=null; });
  persist();
  renderTarefasModal();
}
function iniciarTarefaTimer(id){
  const t = state.tarefas.find(t=>t.id===id);
  if(t && !t.timerStart){ t.timerStart = Date.now(); persist(); renderTarefasModal(); }
}
function pararTarefaTimer(id){
  const t = state.tarefas.find(t=>t.id===id);
  if(t && t.timerStart){
    t.tempoGasto = (t.tempoGasto||0) + Math.floor((Date.now()-t.timerStart)/1000);
    t.timerStart = null;
    persist();
    renderTarefasModal();
  }
}
function tickTarefaTimers(){
  (state.tarefas||[]).forEach(t=>{
    if(t.timerStart){
      const el = document.getElementById('timerDisplay-'+t.id);
      if(el){
        const total = (t.tempoGasto||0) + Math.floor((Date.now()-t.timerStart)/1000);
        el.textContent = formatTempoTarefa(total);
      }
    }
  });
}
function formatTempoTarefa(totalSegundos){
  const h = Math.floor(totalSegundos/3600);
  const m = Math.floor((totalSegundos%3600)/60);
  const s = totalSegundos%60;
  if(h>0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function renderTarefasModal(){
  const wrap = document.getElementById('tarefasLista');
  if(!wrap) return;
  const tarefas = state.tarefas || [];

  // Dashboard
  const totalTarefas = tarefas.length;
  const finalizadas = tarefas.filter(t=>t.feita).length;
  const percentConcluido = totalTarefas>0 ? Math.round((finalizadas/totalTarefas)*100) : 0;
  const contagemPorCategoria = {};
  tarefas.forEach(t=>{
    const catNome = t.categoriaId ? ((state.tarefaCategorias||[]).find(c=>c.id===t.categoriaId)?.nome || 'Sem categoria') : 'Sem categoria';
    contagemPorCategoria[catNome] = (contagemPorCategoria[catNome]||0) + 1;
  });
  const dashboard = `
    <div class="tarefas-dashboard">
      <div class="td-stats">
        <div class="td-stat"><div class="td-num">${totalTarefas}</div><div class="td-lbl">Total</div></div>
        <div class="td-stat"><div class="td-num">${finalizadas}</div><div class="td-lbl">Concluídas</div></div>
        <div class="td-stat"><div class="td-num">${totalTarefas-finalizadas}</div><div class="td-lbl">Pendentes</div></div>
      </div>
      <div class="td-progress-wrap">
        <div class="td-progress-label"><span>Progresso Geral</span><span>${percentConcluido}%</span></div>
        <div class="td-progress-bar"><div class="td-progress-fill" style="width:${percentConcluido}%"></div></div>
      </div>
      ${Object.keys(contagemPorCategoria).length>0 ? `<div class="td-categorias">${Object.entries(contagemPorCategoria).map(([nome,qtd])=>`<span class="td-cat-badge">${nome}: ${qtd}</span>`).join('')}</div>` : ''}
    </div>
  `;

  if(tarefas.length === 0){
    wrap.innerHTML = dashboard + `<div class="empty-state"><div class="title">Nenhuma tarefa ainda</div><div class="desc">Adicione sua primeira tarefa acima</div></div>`;
    return;
  }
  const grupos = {};
  tarefas.forEach(t=>{
    const key = t.categoriaId || '_sem';
    if(!grupos[key]) grupos[key] = [];
    grupos[key].push(t);
  });
  let html = dashboard;
  Object.keys(grupos).forEach(key=>{
    const cat = key==='_sem' ? null : (state.tarefaCategorias||[]).find(c=>c.id===key);
    const catNome = cat ? cat.nome : 'Sem categoria';
    html += `<div class="tarefa-categoria-header"><span>${catNome}</span>${cat?`<button class="btn-icon-sm" onclick="excluirTarefaCategoria('${cat.id}')">${ICON_TRASH}</button>`:''}</div>`;
    html += grupos[key].map(t=>{
      const tempoAtual = (t.tempoGasto||0) + (t.timerStart ? Math.floor((Date.now()-t.timerStart)/1000) : 0);
      return `
      <div class="tarefa-item ${t.feita?'feita':''}">
        <input type="checkbox" ${t.feita?'checked':''} onchange="toggleTarefa('${t.id}')">
        <div class="info">
          <div class="nome">${t.nome}</div>
          ${t.desc?`<div class="desc">${t.desc}</div>`:''}
          <div class="tarefa-timer-row">
            <span class="tarefa-timer-display" id="timerDisplay-${t.id}">${formatTempoTarefa(tempoAtual)}</span>
            ${t.timerStart
              ? `<button class="btn-sm-timer stop" onclick="pararTarefaTimer('${t.id}')">⏸ Parar</button>`
              : `<button class="btn-sm-timer start" onclick="iniciarTarefaTimer('${t.id}')">▶ Iniciar</button>`}
          </div>
        </div>
        <button class="btn-icon-sm tarefa-del" onclick="excluirTarefa('${t.id}')">${ICON_TRASH}</button>
      </div>
    `;}).join('');
  });
  wrap.innerHTML = html;
}

function renderPlanner(){
  const u = state.currentUser;
  document.getElementById('saldoAtualInput').value = state.users[u].saldoAtual ? state.users[u].saldoAtual.toFixed(2).replace('.',',') : '';
  document.getElementById('btnAddCartao').style.display = (u==='davi') ? '' : 'none';

  renderRendaTable();
  ['moradia','assinatura','fixo','futuro'].forEach(cat=> renderGastoGrid(cat));
  renderCartaoTrackerList();
  renderReservaBadge();
}

function renderRendaTable(){
  const u = state.currentUser;
  const months = [];
  for(let i=0;i<6;i++) months.push(addMonths(mesFinanceiroAtual(), i));
  const cartoes = (u==='davi') ? (state.users[u].cartoes || []) : [];
  const hoje = mesFinanceiroAtual();

  const thead = `<tr><th style="text-align:left;padding-left:10px">Categoria</th>${months.map(mKey=>{
    const isCurrent = mKey===hoje;
    return `<th class="${isCurrent?'current-col':''}">${monthLabel(mKey).slice(0,3)}${isCurrent?'<small>atual</small>':''}</th>`;
  }).join('')}<th></th></tr>`;

  const rendaRow = `<tr><td class="row-label">Renda</td>${months.map(mKey=>{
    if(u==='davi'){
      const val = rendaBaseForMonth(u, mKey);
      return `<td class="${mKey===hoje?'current-col':''}" style="font-weight:700">${fmtMoney(val)}</td>`;
    }
    const val = state.users[u].income[mKey] || 0;
    return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setIncome('${u}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
  }).join('')}<td></td></tr>`;

  const extraRow = `<tr><td class="row-label">Extra</td>${months.map(mKey=>{
    const val = (state.users[u].incomeExtra && state.users[u].incomeExtra[mKey]) || 0;
    return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setIncomeExtra('${u}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
  }).join('')}<td></td></tr>`;

  const dizimoRow = (u!=='davi') ? '' : `<tr><td class="row-label" style="color:var(--text-faint)">Dízimo</td>${months.map(mKey=>{
    const val = dizimoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}" style="color:var(--text-faint);font-weight:600">${fmtMoney(val)}</td>`;
  }).join('')}<td></td></tr>`;

  const cartaoRows = (u!=='davi') ? '' : (cartoes.length === 0
    ? `<tr><td class="row-label" style="color:var(--text-faint);font-weight:500" colspan="${months.length+2}">Nenhum cartão — toque em + acima</td></tr>`
    : cartoes.map(c=>{
      return `<tr class="cartao-row"><td class="row-label">${c.nome}</td>${months.map(mKey=>{
        const val = (c.gastos||{})[mKey] || 0;
        return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setCartaoGasto('${c.id}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
      }).join('')}<td><span class="cartao-actions"><button class="btn-icon-sm" onclick="editCartao('${c.id}')">${ICON_EDIT}</button><button class="btn-icon-sm" onclick="deleteCartao('${c.id}')">${ICON_TRASH}</button></span></td></tr>`;
    }).join(''));

  const sobraRow = `<tr class="total-row"><td class="row-label">Sobra estimada</td>${months.map(mKey=>{
    const s = saldoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}"><span class="total-value" style="color:${s>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(s)}</span></td>`;
  }).join('')}<td></td></tr>`;

  document.getElementById('rendaTableThead').innerHTML = thead;
  document.getElementById('rendaTableBody').innerHTML = rendaRow + extraRow + dizimoRow + cartaoRows + sobraRow;
}

function setIncome(user, mKey, valStr){
  if(user === 'davi') return; // renda do Davi é automática (vem do Ponto PJ)
  const v = parseMoney(valStr);
  state.users[user].income[mKey] = v;
  renderRendaTable();
  renderPanorama();
  persist();
}
function setIncomeExtra(user, mKey, valStr){
  const v = parseMoney(valStr);
  if(!state.users[user].incomeExtra) state.users[user].incomeExtra = {};
  state.users[user].incomeExtra[mKey] = v;
  renderRendaTable();
  renderPanorama();
  persist();
}
function setSaldoAtual(valStr){
  const v = parseMoney(valStr);
  state.users[state.currentUser].saldoAtual = v;
  renderRendaTable();
  renderPanorama();
  persist();
}

function openReservaModal(){
  document.getElementById('reservaValorInput').value = state.reserva ? state.reserva.toFixed(2).replace('.',',') : '';
  document.getElementById('modalReserva').classList.add('active');
}
function salvarReserva(){
  state.reserva = parseMoney(document.getElementById('reservaValorInput').value);
  persist();
  closeModal('modalReserva');
  renderReservaBadge();
  showToast('Reserva atualizada');
}
function renderReservaBadge(){
  const el = document.getElementById('reservaBadge');
  if(!el) return;
  if(state.reserva && state.reserva > 0){
    el.style.display = 'flex';
    el.innerHTML = `<span>Reservado</span><b>${fmtMoney(state.reserva)}</b>`;
  } else {
    el.style.display = 'none';
  }
}

function futuroParcelaAtual(item){
  if(item.recorrente) return null;
  const parcelas = item.parcelas || 1;
  if(parcelas<=1 || !item.mesInicio) return null;
  const hoje = mesFinanceiroAtual();
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio,i));
  let idx = meses.indexOf(hoje);
  if(idx===-1) idx = (hoje < meses[0]) ? 0 : parcelas-1;
  return { atual: idx+1, total: parcelas };
}
function futuroDescricaoMeta(item){
  if(item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined){
    return item.mes ? monthLabel(item.mes) : 'sem mês definido';
  }
  if(!item.mesInicio) return 'sem mês definido';
  if(item.recorrente) return 'Recorrente a partir de '+monthLabel(item.mesInicio);
  const parcelas = item.parcelas || 1;
  if(parcelas <= 1) return monthLabel(item.mesInicio);
  const fim = addMonths(item.mesInicio, parcelas-1);
  const p = futuroParcelaAtual(item);
  return monthLabel(item.mesInicio)+' a '+monthLabel(fim)+(p?' · '+p.atual+'/'+p.total:' · '+parcelas+'x');
}

function renderGastoGrid(cat){
  const u = state.currentUser;
  const items = state.users[u].expenses[cat];
  const grid = document.getElementById('grid-'+cat);
  if(!items || items.length===0){
    grid.innerHTML = `<div class="empty-state"><div class="title">Nada por aqui</div><div class="desc">Toque em + para incluir um gasto</div></div>`;
    return;
  }
  grid.innerHTML = items.map(item=>{
    const metaTxt = cat==='futuro' ? futuroDescricaoMeta(item) : ('dia '+(item.dia||1)+(item.mesInicio?' · a partir de '+monthLabel(item.mesInicio):''));
    const valorTxt = cat==='futuro'
      ? (item.recorrente || (item.parcelas||1)<=1 || item.replicar!==false
          ? fmtMoney(item.valor)
          : 'Variável')
      : fmtMoney(item.valor);
    const logo = item.logoUrl
      ? `<img src="${item.logoUrl}" class="conta-logo">`
      : `<div class="conta-logo conta-logo-placeholder">${item.desc.charAt(0).toUpperCase()}</div>`;
    return `<div class="list-row">
      ${logo}
      <div class="lr-info">
        <div class="lr-desc">${item.desc}</div>
        ${item.descricao?`<div class="lr-caption">${item.descricao}</div>`:''}
        <div class="lr-meta">${metaTxt}</div>
      </div>
      <div class="lr-value">${valorTxt}</div>
      <div class="lr-actions">
        <button class="btn-icon-sm" onclick="editGasto('${cat}','${item.id}')">${ICON_EDIT}</button>
        <button class="btn-icon-sm" onclick="deleteGasto('${cat}','${item.id}')">${ICON_TRASH}</button>
      </div>
    </div>`;
  }).join('');
}

/* ================= CARTÕES DE CRÉDITO — RASTREADOR (visual, não entra em nenhum cálculo) ================= */
function compraTrackerCalc(item){
  const total = Number(item.valorTotal)||0;
  const parcelas = Math.max(1, Number(item.parcelas)||1);
  const valorParcela = total/parcelas;
  const hoje = mesFinanceiroAtual();
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio, i));
  const idx = meses.indexOf(hoje);
  let parcelaAtual, pagas, status;
  if(!item.mesInicio){
    parcelaAtual = 0; pagas = 0; status = 'sem-inicio';
  } else if(idx === -1){
    if(hoje < meses[0]){ parcelaAtual = 0; pagas = 0; status = 'futuro'; }
    else { parcelaAtual = parcelas; pagas = parcelas; status = 'concluido'; }
  } else {
    parcelaAtual = idx+1; pagas = idx; status = 'andamento';
  }
  const restam = parcelas - pagas;
  const mesFim = item.mesInicio ? meses[parcelas-1] : null;
  const percentPago = parcelas>0 ? Math.round((pagas/parcelas)*100) : 0;
  const restante = valorParcela*restam;
  return { total, parcelas, valorParcela, parcelaAtual, pagas, restam, mesFim, percentPago, status, restante };
}
function popularSelectCartoes(selectId, selecionado){
  const el = document.getElementById(selectId);
  if(!el) return;
  const cartoes = state.cartoesTracker || [];
  el.innerHTML = cartoes.length
    ? cartoes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')
    : '<option value="">Cadastre um cartão primeiro</option>';
  if(selecionado) el.value = selecionado;
}
function renderCartaoTrackerList(){
  const list = document.getElementById('cartaoTrackerList');
  if(!list) return;
  const cartoes = state.cartoesTracker || [];
  if(cartoes.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="title">Nenhum cartão cadastrado</div><div class="desc">Toque em "+ Cartão" pra começar</div></div>`;
    return;
  }
  list.innerHTML = cartoes.map(cartao=>{
    const compras = (state.comprasTracker||[]).filter(c=>c.cartaoId===cartao.id);
    const usado = compras.reduce((s,item)=>{
      if(item.pago) return s; // pago não entra no cálculo
      const c = compraTrackerCalc(item);
      return s + (c.status==='concluido' ? 0 : c.restante);
    },0) + (cartao.credoVista?.reduce((s,v)=>s+Number(v.valor||0), 0) || 0);
    const limite = Number(cartao.limite)||0;
    const disponivel = Math.max(0, limite - usado);
    const percentUsado = limite>0 ? Math.min(100, Math.round((usado/limite)*100)) : 0;

    const comprasHtml = compras.length === 0
      ? `<div class="ct-sem-compra">Nenhuma compra lançada</div>`
      : compras.map(item=>{
        const c = compraTrackerCalc(item);
        let metaTxt;
        if(c.status === 'futuro') metaTxt = 'Começa em ' + monthLabel(item.mesInicio);
        else if(c.status === 'concluido') metaTxt = 'Quitada';
        else if(c.status === 'sem-inicio') metaTxt = 'Defina o mês de início';
        else metaTxt = `Faltam ${c.restam} ${c.restam===1?'mês':'meses'} · termina em ${monthLabel(c.mesFim)}`;
        const parcelaTxt = c.status==='sem-inicio' ? '—' : `${c.parcelaAtual}ª de ${c.parcelas}`;
        const pagoClass = item.pago ? ' pago' : '';
        const compraLogo = item.logoUrl
          ? `<img src="${item.logoUrl}" class="conta-logo-sm">`
          : `<div class="conta-logo-sm conta-logo-placeholder">${item.nome.charAt(0).toUpperCase()}</div>`;
        return `<div class="compra-tracker-item${pagoClass}">
          <div class="ct-top">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              ${compraLogo}
              <div style="min-width:0">
                <div class="ct-nome${pagoClass}">${item.nome}</div>
                ${item.descricao?`<div class="lr-caption">${item.descricao}</div>`:''}
              </div>
            </div>
            <div class="ct-actions">
              <button class="btn-icon-sm" title="Marcar como ${item.pago?'pendente':'pago'}" onclick="toggleCompraPago('${item.id}')" style="color:${item.pago?'var(--success)':'var(--slate-400)'}">${item.pago?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/></svg>'}</button>
              <button class="btn-icon-sm" onclick="openCompraTrackerModal('${cartao.id}','${item.id}')">${ICON_EDIT}</button>
              <button class="btn-icon-sm" onclick="excluirCompraTracker('${item.id}')">${ICON_TRASH}</button>
            </div>
          </div>
          <div class="ct-row">
            <span class="ct-parcela">${parcelaTxt} · ${fmtMoney(c.valorParcela)}/mês</span>
            <span class="ct-total">Total ${fmtMoney(c.total)}</span>
          </div>
          <div class="ct-bar"><div class="ct-bar-fill" style="width:${c.percentPago}%"></div></div>
          <div class="ct-meta">${metaTxt}</div>
        </div>`;
      }).join('');

    return `<div class="cartao-card-item">
      <div class="ct-top">
        <div class="ct-nome-cartao">${cartao.nome}</div>
        <div class="ct-actions">
          <button class="btn-icon-sm" onclick="openCartaoCardModal('${cartao.id}')">${ICON_EDIT}</button>
          <button class="btn-icon-sm" onclick="excluirCartaoCard('${cartao.id}')">${ICON_TRASH}</button>
        </div>
      </div>
      <div class="ct-disponivel-lbl">Disponível</div>
      <div class="ct-disponivel-val">${fmtMoney(disponivel)}</div>
      <div class="ct-bar"><div class="ct-bar-fill" style="width:${percentUsado}%"></div></div>
      <div class="ct-foot"><span>Gasto ${fmtMoney(usado)}</span><span>Fecha dia ${cartao.fechamento||'—'} · Total ${fmtMoney(limite)}</span></div>
      <div class="ct-toggle-compras" onclick="toggleCartaoDetalhes('${cartao.id}')">Ver detalhes</div>
      <div class="compras-do-cartao" id="cartaoDetalhes-${cartao.id}">
        ${comprasHtml}
        <div class="credo-vista-list">
          ${(cartao.credoVista||[]).map(cv=>`<div class="credo-vista-item"><span class="cv-desc">${cv.descricao||'Crédito à vista'}</span><span class="cv-valor">${fmtMoney(cv.valor)}</span><button class="btn-icon-sm" onclick="excluirCredoVista('${cartao.id}','${cv.id}')">${ICON_TRASH}</button></div>`).join('')}
        </div>
        <button class="btn btn-sm btn-outline" style="width:100%;margin-top:10px" onclick="openCompraTrackerModal('${cartao.id}')">+ Compra parcelada</button>
        <button class="btn btn-sm btn-outline" style="width:100%;margin-top:6px" onclick="openCredoVistaModal('${cartao.id}')">+ Crédito à vista</button>
      </div>
    </div>`;
  }).join('');
}
function toggleCartaoDetalhes(cartaoId){
  const el = document.getElementById('cartaoDetalhes-'+cartaoId);
  if(el) el.classList.toggle('expanded');
}

/* --- Cartão (fechamento/vencimento/limite) --- */
function openCartaoCardModal(id){
  document.getElementById('cartaoCardId').value = id || '';
  document.getElementById('modalCartaoCardTitle').textContent = id ? 'Editar Cartão' : 'Novo Cartão';
  if(id){
    const item = (state.cartoesTracker||[]).find(i=>i.id===id);
    if(item){
      document.getElementById('cartaoCardNome').value = item.nome;
      document.getElementById('cartaoCardFechamento').value = item.fechamento || '';
      document.getElementById('cartaoCardVencimento').value = item.vencimento || '';
      document.getElementById('cartaoCardLimite').value = (item.limite||0).toFixed(2).replace('.',',');
    }
  }else{
    document.getElementById('cartaoCardNome').value = '';
    document.getElementById('cartaoCardFechamento').value = '';
    document.getElementById('cartaoCardVencimento').value = '';
    document.getElementById('cartaoCardLimite').value = '';
  }
  document.getElementById('modalCartaoCard').classList.add('active');
}
function salvarCartaoCard(){
  const id = document.getElementById('cartaoCardId').value;
  const nome = document.getElementById('cartaoCardNome').value.trim();
  const fechamento = Math.min(31, Math.max(1, parseInt(document.getElementById('cartaoCardFechamento').value) || 1));
  const vencimento = Math.min(31, Math.max(1, parseInt(document.getElementById('cartaoCardVencimento').value) || 1));
  const limite = parseMoney(document.getElementById('cartaoCardLimite').value);
  if(!nome){ showToast('Digite o nome do cartão'); return; }
  if(!state.cartoesTracker) state.cartoesTracker = [];
  if(id){
    const item = state.cartoesTracker.find(i=>i.id===id);
    if(item) Object.assign(item, { nome, fechamento, vencimento, limite });
  } else {
    state.cartoesTracker.push({ id: 'crd'+Date.now(), nome, fechamento, vencimento, limite });
  }
  persist();
  closeModal('modalCartaoCard');
  renderCartaoTrackerList();
  showToast('Cartão salvo');
}
function excluirCartaoCard(id){
  const temCompras = (state.comprasTracker||[]).some(c=>c.cartaoId===id);
  if(temCompras && !confirm('Este cartão tem compras lançadas. Excluir o cartão também vai excluir todas as compras dele. Continuar?')) return;
  state.cartoesTracker = (state.cartoesTracker||[]).filter(i=>i.id!==id);
  state.comprasTracker = (state.comprasTracker||[]).filter(c=>c.cartaoId!==id);
  persist();
  renderCartaoTrackerList();
}

/* --- Compra (parcelamento vinculado a um cartão) --- */
let compraTrackerLogoUrlAtual = null;
function renderCompraTrackerLogoPreview(){
  const el = document.getElementById('compraTrackerLogoPreview');
  const nome = document.getElementById('compraTrackerNome').value || '?';
  el.innerHTML = compraTrackerLogoUrlAtual
    ? `<img src="${compraTrackerLogoUrlAtual}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${nome.charAt(0).toUpperCase()}</div>`;
}
function onCompraTrackerLogoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{ compraTrackerLogoUrlAtual = e.target.result; renderCompraTrackerLogoPreview(); };
  reader.readAsDataURL(file);
}
function removerCompraTrackerLogo(){
  compraTrackerLogoUrlAtual = null;
  renderCompraTrackerLogoPreview();
}

function openCompraTrackerModal(cartaoId, compraId){
  if(!(state.cartoesTracker||[]).length){ showToast('Cadastre um cartão primeiro'); return; }
  popularSelectCartoes('compraTrackerCartaoId', cartaoId);
  document.getElementById('compraTrackerId').value = compraId || '';
  document.getElementById('modalCompraTrackerTitle').textContent = compraId ? 'Editar Compra' : 'Nova Compra';
  if(compraId){
    const item = (state.comprasTracker||[]).find(i=>i.id===compraId);
    if(item){
      document.getElementById('compraTrackerNome').value = item.nome;
      document.getElementById('compraTrackerDescricao').value = item.descricao || '';
      compraTrackerLogoUrlAtual = item.logoUrl || null;
      document.getElementById('compraTrackerCartaoId').value = item.cartaoId;
      document.getElementById('compraTrackerValor').value = (item.valorTotal||0).toFixed(2).replace('.',',');
      document.getElementById('compraTrackerParcelas').value = item.parcelas || 1;
      createMonthPicker('compraTrackerMesInicioPicker', 'compraTrackerMesInicio', item.mesInicio || null);
    }
  }else{
    document.getElementById('compraTrackerNome').value = '';
    document.getElementById('compraTrackerDescricao').value = '';
    compraTrackerLogoUrlAtual = null;
    document.getElementById('compraTrackerValor').value = '';
    document.getElementById('compraTrackerParcelas').value = 1;
    createMonthPicker('compraTrackerMesInicioPicker', 'compraTrackerMesInicio', mesFinanceiroAtual());
  }
  renderCompraTrackerLogoPreview();
  document.getElementById('modalCompraTracker').classList.add('active');
}
function salvarCompraTracker(){
  const id = document.getElementById('compraTrackerId').value;
  const nome = document.getElementById('compraTrackerNome').value.trim();
  const descricao = document.getElementById('compraTrackerDescricao').value.trim();
  const logoUrl = compraTrackerLogoUrlAtual;
  const cartaoId = document.getElementById('compraTrackerCartaoId').value;
  const valorTotal = parseMoney(document.getElementById('compraTrackerValor').value);
  const parcelas = Math.max(1, parseInt(document.getElementById('compraTrackerParcelas').value) || 1);
  const mesInicio = document.getElementById('compraTrackerMesInicio').value || null;
  if(!nome){ showToast('Digite o nome da compra'); return; }
  if(!cartaoId){ showToast('Selecione o cartão'); return; }
  if(!state.comprasTracker) state.comprasTracker = [];
  if(id){
    const item = state.comprasTracker.find(i=>i.id===id);
    if(item) Object.assign(item, { nome, descricao, logoUrl, cartaoId, valorTotal, parcelas, mesInicio });
  } else {
    state.comprasTracker.push({ id: 'cp'+Date.now(), nome, descricao, logoUrl, cartaoId, valorTotal, parcelas, mesInicio });
  }
  persist();
  closeModal('modalCompraTracker');
  renderCartaoTrackerList();
  showToast('Compra salva');
}
function toggleCompraPago(id){
  const item = (state.comprasTracker||[]).find(i=>i.id===id);
  if(item){
    item.pago = !item.pago;
    persist();
    renderCartaoTrackerList();
    renderPanorama();
  }
}
function openCredoVistaModal(cartaoId, credoId){
  document.getElementById('credoVistaCartaoId').value = cartaoId;
  document.getElementById('credoVistaId').value = credoId || '';
  document.getElementById('modalCredoVistaTitle').textContent = credoId ? 'Editar Crédito à Vista' : 'Crédito à Vista';
  if(credoId){
    const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
    const item = cartao?.credoVista?.find(cv=>cv.id===credoId);
    if(item){
      document.getElementById('credoVistaDescricao').value = item.descricao || '';
      document.getElementById('credoVistaValor').value = (item.valor||0).toFixed(2).replace('.',',');
    }
  }else{
    document.getElementById('credoVistaDescricao').value = '';
    document.getElementById('credoVistaValor').value = '';
  }
  document.getElementById('modalCredoVista').classList.add('active');
}
function salvarCredoVista(){
  const cartaoId = document.getElementById('credoVistaCartaoId').value;
  const credoId = document.getElementById('credoVistaId').value;
  const descricao = document.getElementById('credoVistaDescricao').value.trim();
  const valor = parseMoney(document.getElementById('credoVistaValor').value);
  if(!valor){ showToast('Digite o valor'); return; }
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao){ showToast('Cartão não encontrado'); return; }
  if(!cartao.credoVista) cartao.credoVista = [];
  if(credoId){
    const item = cartao.credoVista.find(cv=>cv.id===credoId);
    if(item) Object.assign(item, { descricao, valor });
  } else {
    cartao.credoVista.push({ id: 'cv'+Date.now(), descricao, valor });
  }
  persist();
  closeModal('modalCredoVista');
  renderCartaoTrackerList();
  renderPanorama();
  showToast('Crédito salvo');
}
function excluirCredoVista(cartaoId, credoId){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(cartao) cartao.credoVista = (cartao.credoVista||[]).filter(cv=>cv.id!==credoId);
  persist();
  renderCartaoTrackerList();
  renderPanorama();
}
function excluirCompraTracker(id){
  state.comprasTracker = (state.comprasTracker||[]).filter(i=>i.id!==id);
  persist();
  renderCartaoTrackerList();
  renderPanorama();
}

/* ================= CARTÕES DE CRÉDITO ================= */
function openCartaoModal(id){
  if(state.currentUser !== 'davi'){ showToast('Cartões disponíveis apenas para o Davi'); return; }
  document.getElementById('cartaoId').value = id || '';
  document.getElementById('modalCartaoTitle').textContent = id ? 'Editar Cartão' : 'Novo Cartão';
  if(id){
    const c = state.users[state.currentUser].cartoes.find(x=>x.id===id);
    document.getElementById('cartaoNome').value = c ? c.nome : '';
  }else{
    document.getElementById('cartaoNome').value = '';
  }
  document.getElementById('modalCartao').classList.add('active');
}
function editCartao(id){ openCartaoModal(id); }
function saveCartao(){
  if(state.currentUser !== 'davi') return;
  const id = document.getElementById('cartaoId').value;
  const nome = document.getElementById('cartaoNome').value.trim();
  if(!nome){ showToast('Digite o nome do cartão'); return; }
  const list = state.users[state.currentUser].cartoes;
  if(id){
    const c = list.find(x=>x.id===id);
    if(c) c.nome = nome;
  }else{
    list.push({ id:'c'+Date.now()+Math.floor(Math.random()*1000), nome, gastos:{} });
  }
  closeModal('modalCartao');
  renderRendaTable();
  renderPanorama();
  persist();
  showToast('Cartão salvo');
}
function deleteCartao(id){
  if(state.currentUser !== 'davi') return;
  const list = state.users[state.currentUser].cartoes;
  const idx = list.findIndex(x=>x.id===id);
  if(idx>-1) list.splice(idx,1);
  renderRendaTable();
  renderPanorama();
  persist();
  showToast('Cartão removido');
}
function setCartaoGasto(cardId, mKey, valStr){
  if(state.currentUser !== 'davi') return;
  const v = parseMoney(valStr);
  const c = state.users[state.currentUser].cartoes.find(x=>x.id===cardId);
  if(!c) return;
  if(!c.gastos) c.gastos = {};
  c.gastos[mKey] = v;
  renderRendaTable();
  renderPanorama();
  persist();
}

/* ================= MODAL GASTO ================= */
function updateGastoFieldsVisibility(){
  const cat = document.getElementById('gastoCat').value;
  const isFuturo = cat === 'futuro';
  document.getElementById('gastoDiaWrap').style.display = isFuturo ? 'none' : '';
  document.getElementById('gastoMesInicioSimplesWrap').style.display = isFuturo ? 'none' : '';
  document.getElementById('gastoRecorrenteWrap').style.display = isFuturo ? '' : 'none';
  document.getElementById('gastoMesInicioWrap').style.display = isFuturo ? '' : 'none';

  if(!isFuturo){
    document.getElementById('gastoParcelasWrap').style.display = 'none';
    document.getElementById('gastoReplicarWrap').style.display = 'none';
    document.getElementById('gastoParcelasValoresWrap').style.display = 'none';
    document.getElementById('gastoValorWrap').style.display = '';
    return;
  }

  const recorrente = document.getElementById('gastoRecorrente').checked;
  document.getElementById('gastoMesInicioLabel').textContent = recorrente ? 'A partir do mês' : 'Primeira parcela no mês';

  if(recorrente){
    document.getElementById('gastoParcelasWrap').style.display = 'none';
    document.getElementById('gastoReplicarWrap').style.display = 'none';
    document.getElementById('gastoParcelasValoresWrap').style.display = 'none';
    document.getElementById('gastoValorWrap').style.display = '';
  }else{
    document.getElementById('gastoParcelasWrap').style.display = '';
    document.getElementById('gastoReplicarWrap').style.display = '';
    const replicar = document.getElementById('gastoReplicar').checked;
    document.getElementById('gastoValorWrap').style.display = replicar ? '' : 'none';
    document.getElementById('gastoParcelasValoresWrap').style.display = replicar ? 'none' : '';
    if(!replicar) renderParcelasValoresInputs();
  }
}
function onGastoRecorrenteChange(){ updateGastoFieldsVisibility(); }
function onGastoParcelasChange(){ updateGastoFieldsVisibility(); }
function onGastoReplicarChange(){ updateGastoFieldsVisibility(); }
function onGastoMesInicioChange(){
  const cat = document.getElementById('gastoCat').value;
  if(cat==='futuro' && !document.getElementById('gastoRecorrente').checked && !document.getElementById('gastoReplicar').checked){
    renderParcelasValoresInputs();
  }
}

function renderParcelasValoresInputs(existingValores){
  const parcelas = Math.max(1, parseInt(document.getElementById('gastoParcelas').value) || 1);
  const mesInicio = document.getElementById('gastoMesInicio').value;
  const container = document.getElementById('gastoParcelasValores');
  // preserva valores já digitados nesta sessão do modal
  const atuais = {};
  container.querySelectorAll('input[data-mes]').forEach(inp=>{ atuais[inp.dataset.mes] = inp.value; });

  if(!mesInicio){ container.innerHTML = '<div class="meta">Defina o mês de início primeiro</div>'; return; }
  let html = '';
  for(let i=0;i<parcelas;i++){
    const mKey = addMonths(mesInicio, i);
    const preset = atuais[mKey] !== undefined ? atuais[mKey] : ((existingValores && existingValores[mKey]!==undefined) ? Number(existingValores[mKey]).toFixed(2).replace('.',',') : '');
    html += `<div class="input-money"><input type="text" inputmode="numeric" data-mes="${mKey}" placeholder="0,00 — ${monthLabel(mKey)}" value="${preset}" oninput="maskMoneyInput(this)"></div>`;
  }
  container.innerHTML = html;
}

let gastoLogoUrlAtual = null;
function renderGastoLogoPreview(){
  const el = document.getElementById('gastoLogoPreview');
  const desc = document.getElementById('gastoDesc').value || '?';
  el.innerHTML = gastoLogoUrlAtual
    ? `<img src="${gastoLogoUrlAtual}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${desc.charAt(0).toUpperCase()}</div>`;
}
function onGastoLogoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{ gastoLogoUrlAtual = e.target.result; renderGastoLogoPreview(); };
  reader.readAsDataURL(file);
}
function removerGastoLogo(){
  gastoLogoUrlAtual = null;
  renderGastoLogoPreview();
}

function openGastoModal(cat, id){
  document.getElementById('gastoCat').value = cat;
  document.getElementById('gastoId').value = id || '';
  document.getElementById('modalGastoTitle').textContent = id ? 'Editar Gasto' : 'Adicionar Gasto';

  if(id){
    const item = state.users[state.currentUser].expenses[cat].find(i=>i.id===id);
    if(item){
      document.getElementById('gastoDesc').value = item.desc;
      document.getElementById('gastoDescricaoBreve').value = item.descricao || '';
      gastoLogoUrlAtual = item.logoUrl || null;
      document.getElementById('gastoValor').value = (item.valor||0).toFixed(2).replace('.',',');
      document.getElementById('gastoDia').value = item.dia || '';
      createMonthPicker('gastoMesInicioSimplesPicker', 'gastoMesInicioSimples', item.mesInicio || null);

      if(cat==='futuro'){
        const isLegado = item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined;
        document.getElementById('gastoRecorrente').checked = !!item.recorrente;
        createMonthPicker('gastoMesInicioPicker', 'gastoMesInicio', isLegado ? (item.mes||null) : (item.mesInicio||null), onGastoMesInicioChange);
        document.getElementById('gastoParcelas').value = item.parcelas || 1;
        document.getElementById('gastoReplicar').checked = item.replicar !== false;
        updateGastoFieldsVisibility();
        if(item.replicar === false) renderParcelasValoresInputs(item.valores);
      } else {
        createMonthPicker('gastoMesInicioPicker', 'gastoMesInicio', null, onGastoMesInicioChange);
      }
    }
  }else{
    document.getElementById('gastoDesc').value = '';
    document.getElementById('gastoDescricaoBreve').value = '';
    gastoLogoUrlAtual = null;
    document.getElementById('gastoValor').value = '';
    document.getElementById('gastoDia').value = '';
    createMonthPicker('gastoMesInicioSimplesPicker', 'gastoMesInicioSimples', null);
    document.getElementById('gastoRecorrente').checked = false;
    createMonthPicker('gastoMesInicioPicker', 'gastoMesInicio', mesFinanceiroAtual(), onGastoMesInicioChange);
    document.getElementById('gastoParcelas').value = 1;
    document.getElementById('gastoReplicar').checked = true;
  }
  renderGastoLogoPreview();
  updateGastoFieldsVisibility();
  document.getElementById('modalGasto').classList.add('active');
}
function editGasto(cat, id){ openGastoModal(cat, id); }
function saveGasto(){
  const cat = document.getElementById('gastoCat').value;
  const id = document.getElementById('gastoId').value;
  const desc = document.getElementById('gastoDesc').value.trim();
  const descricao = document.getElementById('gastoDescricaoBreve').value.trim();
  const logoUrl = gastoLogoUrlAtual;
  const dia = Math.min(31, Math.max(1, parseInt(document.getElementById('gastoDia').value) || 1));

  if(!desc){ showToast('Digite uma descrição'); return; }

  let novo;
  if(cat === 'futuro'){
    const recorrente = document.getElementById('gastoRecorrente').checked;
    const mesInicio = document.getElementById('gastoMesInicio').value || mesFinanceiroAtual();
    const parcelas = Math.max(1, parseInt(document.getElementById('gastoParcelas').value) || 1);
    const replicar = recorrente ? true : document.getElementById('gastoReplicar').checked;
    const valor = parseMoney(document.getElementById('gastoValor').value);
    let valores = {};
    if(!recorrente && !replicar){
      document.getElementById('gastoParcelasValores').querySelectorAll('input[data-mes]').forEach(inp=>{
        valores[inp.dataset.mes] = parseMoney(inp.value);
      });
    }
    novo = { desc, descricao, logoUrl, recorrente, mesInicio, parcelas, replicar, valor, valores };
  }else{
    const valor = parseMoney(document.getElementById('gastoValor').value);
    const mesInicio = document.getElementById('gastoMesInicioSimples').value || null;
    novo = { desc, descricao, logoUrl, valor, dia, mesInicio };
  }

  const list = state.users[state.currentUser].expenses[cat];
  if(id){
    const item = list.find(i=>i.id===id);
    if(item) Object.assign(item, novo);
  }else{
    list.push(Object.assign({ id: 'g'+Date.now()+Math.floor(Math.random()*1000) }, novo));
  }
  closeModal('modalGasto');
  renderPlanner();
  renderPanorama();
  persist();
  showToast('Gasto salvo');
}
function deleteGasto(cat, id){
  const list = state.users[state.currentUser].expenses[cat];
  const idx = list.findIndex(i=>i.id===id);
  if(idx>-1) list.splice(idx,1);
  renderPlanner();
  renderPanorama();
  persist();
  showToast('Gasto removido');
}

/* ================= PONTO PJ ================= */
function pontoMonthKeyAtual(){ return addMonths(todayKey(), state.pontoOffset); }
function ensurePontoMonth(mKey){
  if(!state.ponto.days[mKey]) state.ponto.days[mKey] = {};
}
function pontoNavMes(delta){
  state.pontoOffset += delta;
  renderPonto();
  persist();
}
function onValorHoraInput(el){
  state.ponto.valorHora = parseMoney(el.value);
  renderPontoSummary();
  persist();
}
function timeToMin(t){ if(!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; }
function minToTime(min){ if(min===null||min===undefined) return '--:--'; min=((min%1440)+1440)%1440; const h=Math.floor(min/60), m=min%60; return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }
function minToHoursLabel(min){ const sign = min<0?'-':''; min=Math.abs(Math.round(min)); const h=Math.floor(min/60), m=min%60; return sign+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); }

function getDia(mKey, dia){
  ensurePontoMonth(mKey);
  if(!state.ponto.days[mKey][dia]){
    const d = keyToDate(mKey); d.setDate(dia);
    const dow = d.getDay();
    const isWeekend = dow===0 || dow===6;
    const isSexta = dow===5;
    const saidaPadrao = isSexta ? '16:00' : '17:00';
    state.ponto.days[mKey][dia] = isWeekend
      ? { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0 }
      : { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:saidaPadrao, extra:0 };
  }
  return state.ponto.days[mKey][dia];
}
function adjustTempo(dia, campo, delta){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  const cur = d[campo];
  const base = cur ? timeToMin(cur) : 0;
  d[campo] = minToTime(base + delta);
  renderPonto();
  persist();
}
function setExtra(dia, valStr){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  if(!valStr){ d.extra = 0; }
  else{
    const partes = valStr.split(':');
    const h = parseInt(partes[0])||0;
    const m = parseInt(partes[1])||0;
    d.extra = Math.max(0, h*60+m);
  }
  renderPonto();
  persist();
}
function zerarDia(dia){
  const mKey = pontoMonthKeyAtual();
  state.ponto.days[mKey][dia] = { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0 };
  renderPonto();
  persist();
}
function dayTotalMinutes(d){
  if(!d.entrada || !d.almocoSaida || !d.almocoVolta || !d.saida) return (d.extra||0);
  const manha = timeToMin(d.almocoSaida) - timeToMin(d.entrada);
  const tarde = timeToMin(d.saida) - timeToMin(d.almocoVolta);
  return Math.max(0, manha) + Math.max(0, tarde) + (d.extra||0);
}

function renderPonto(){
  const mKey = pontoMonthKeyAtual();
  ensurePontoMonth(mKey);
  document.getElementById('pontoMesLabel').textContent = monthLabelLong(mKey);
  document.getElementById('pontoValorHora').value = state.ponto.valorHora ? state.ponto.valorHora.toFixed(2).replace('.',',') : '';

  const totalDias = daysInMonth(mKey);
  const lista = document.getElementById('pontoDiasLista');
  let rows = '';
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const isWeekend = dateObj.getDay()===0 || dateObj.getDay()===6;
    const total = dayTotalMinutes(d);
    const extraVal = d.extra ? String(Math.floor(d.extra/60)).padStart(2,'0')+':'+String(d.extra%60).padStart(2,'0') : '';
    rows += `<div class="ponto-dia-row ${isWeekend?'weekend':''}">
      <div class="pd-head">
        <div class="pd-data">${String(dia).padStart(2,'0')} <small>${DIA_SEMANA[dateObj.getDay()]}</small></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="pd-total ${total===0?'zero':''}">${minToHoursLabel(total)}</div>
          <button class="btn-icon-sm" onclick="zerarDia(${dia})" title="Não trabalhei">${ICON_BAN}</button>
        </div>
      </div>
      <div class="ponto-horarios-grid">
        <div class="ph-item"><div class="ph-lbl">Entrada</div><input type="text" inputmode="numeric" placeholder="00:00" maxlength="5" value="${d.entrada||''}" oninput="maskTempoInput(this)" onchange="setTempoDireto(${dia},'entrada',this.value)"></div>
        <div class="ph-item"><div class="ph-lbl">Almoço</div><input type="text" inputmode="numeric" placeholder="00:00" maxlength="5" value="${d.almocoSaida||''}" oninput="maskTempoInput(this)" onchange="setTempoDireto(${dia},'almocoSaida',this.value)"></div>
        <div class="ph-item"><div class="ph-lbl">Volta</div><input type="text" inputmode="numeric" placeholder="00:00" maxlength="5" value="${d.almocoVolta||''}" oninput="maskTempoInput(this)" onchange="setTempoDireto(${dia},'almocoVolta',this.value)"></div>
        <div class="ph-item"><div class="ph-lbl">Saída</div><input type="text" inputmode="numeric" placeholder="00:00" maxlength="5" value="${d.saida||''}" oninput="maskTempoInput(this)" onchange="setTempoDireto(${dia},'saida',this.value)"></div>
      </div>
      <div class="ponto-extra-row">
        <div class="ph-item"><div class="ph-lbl">Hora extra</div><input type="text" value="${extraVal}" placeholder="00:00" onchange="setExtra(${dia}, this.value)"></div>
      </div>
    </div>`;
  }
  lista.innerHTML = rows;
  renderPontoSummary();
}

function setTempoDireto(dia, campo, valStr){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  d[campo] = valStr || null;
  renderPonto();
  persist();
}

function computePontoMes(mKey){
  ensurePontoMonth(mKey);
  const totalDias = daysInMonth(mKey);
  let totalMin = 0, padraoMin = 0;
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey,dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const dow = dateObj.getDay();
    if(dow>=1 && dow<=4) padraoMin += PADRAO_SEGQUI_HORAS * 60;
    else if(dow===5) padraoMin += PADRAO_SEX_HORAS * 60;
    totalMin += dayTotalMinutes(d);
  }
  const valorHora = state.ponto.valorHora || 0;
  const diffMin = totalMin - padraoMin;
  const valorReceber = (totalMin/60) * valorHora;
  const impacto = (diffMin/60) * valorHora;
  return { totalMin, padraoMin, diffMin, valorReceber, impacto };
}

function renderPontoSummary(){
  const mKey = pontoMonthKeyAtual();
  const r = computePontoMes(mKey);

  document.getElementById('pontoTotalHoras').textContent = minToHoursLabel(r.totalMin);
  document.getElementById('pontoValorReceber').textContent = fmtMoney(r.valorReceber);
  document.getElementById('pontoPadrao').textContent = minToHoursLabel(r.padraoMin);
  document.getElementById('pontoDiferenca').textContent = (r.diffMin>=0?'+':'')+minToHoursLabel(r.diffMin);
  document.getElementById('pontoImpacto').textContent = (r.impacto>=0?'+':'-')+fmtMoney(Math.abs(r.impacto));

  renderPontoCompare();
}

function renderPontoCompare(){
  const passado = addMonths(todayKey(), -1);
  const atual = todayKey();
  const proximo = addMonths(todayKey(), 1);
  const meses = [passado, atual, proximo];
  const container = document.getElementById('pontoCompareStrip');
  if(!container) return;
  container.innerHTML = meses.map(mKey=>{
    const r = computePontoMes(mKey);
    const isAtual = mKey === atual;
    return `<div class="compare-col ${isAtual?'compare-atual':''}">
      <div class="compare-label">${monthLabel(mKey)}</div>
      <div class="compare-value">${minToHoursLabel(r.totalMin)}</div>
      <div class="compare-sub">${fmtMoney(r.valorReceber)}</div>
    </div>`;
  }).join('');
}

/* ================= CONCLUIR MÊS ================= */
function openConcluirMesModal(){
  const mesPontoAtual = todayKey();
  const mesContasAtual = mesFinanceiroAtual();
  const mesPontoProximo = addMonths(mesPontoAtual, 1);
  const mesContasProximo = addMonths(mesContasAtual, 1);

  document.getElementById('concluirMesInfo').innerHTML =
    `<div class="mc-field"><label>Ponto PJ</label>${monthLabel(mesPontoAtual)} → ${monthLabel(mesPontoProximo)}</div>` +
    `<div class="mc-field"><label>Contas (Panorama / Planner)</label>${monthLabel(mesContasAtual)} → ${monthLabel(mesContasProximo)}</div>`;

  const abertas = contasEmAbertoNoMes(mesContasAtual);
  const avisoEl = document.getElementById('concluirMesAviso');
  if(abertas > 0){
    avisoEl.style.display = 'block';
    avisoEl.innerHTML = `${ICON_ALERT}Ainda há ${abertas} conta${abertas>1?'s':''} em aberto em ${monthLabel(mesContasAtual)}. Você pode concluir mesmo assim.`;
  } else {
    avisoEl.style.display = 'none';
  }
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

/* ================= MODAIS (fechar) ================= */
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('active'); });
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

/* ================= INIT ================= */
carregar();
aplicarLogoSalva();

/* ================= PWA: registro do service worker ================= */
/* ================= RECEITAS ================= */
let receitaFotoUrlAtual = null;
let receitaFiltroCategoria = null;

function renderReceitas(){
  renderReceitaCatChips();
  renderReceitaLista();
}

function renderReceitaCatChips(){
  const el = document.getElementById('receitaCatChips');
  const cats = state.receitaCategorias || [];
  let html = `<button class="cat-chip${receitaFiltroCategoria===null?' active':''}" onclick="filtrarReceitaCategoria(null)">Todas</button>`;
  cats.forEach(c=>{
    html += `<button class="cat-chip${receitaFiltroCategoria===c.id?' active':''}" onclick="filtrarReceitaCategoria('${c.id}')">${c.nome}<span class="cat-chip-del" onclick="event.stopPropagation();excluirReceitaCategoria('${c.id}')">×</span></button>`;
  });
  el.innerHTML = html;
}
function filtrarReceitaCategoria(id){
  receitaFiltroCategoria = id;
  renderReceitas();
}
function excluirReceitaCategoria(id){
  if(!confirm('Excluir esta categoria? As receitas dela ficarão sem categoria.')) return;
  state.receitaCategorias = (state.receitaCategorias||[]).filter(c=>c.id!==id);
  (state.receitas||[]).forEach(r=>{ if(r.categoriaId===id) r.categoriaId=null; });
  if(receitaFiltroCategoria===id) receitaFiltroCategoria=null;
  persist();
  renderReceitas();
}

function renderReceitaLista(){
  const el = document.getElementById('receitaLista');
  let list = state.receitas || [];
  if(receitaFiltroCategoria!==null){
    list = list.filter(r=> receitaFiltroCategoria==='_sem' ? !r.categoriaId : r.categoriaId===receitaFiltroCategoria);
  }
  list = [...list].sort((a,b)=> (b.criadoEm||0) - (a.criadoEm||0));
  if(!list.length){
    el.innerHTML = `<div class="empty-state">Nenhuma receita ainda. Toque no + pra adicionar.</div>`;
    return;
  }
  el.innerHTML = list.map(r=>{
    const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
    const dataTxt = r.criadoEm ? new Date(r.criadoEm).toLocaleDateString('pt-BR') : '';
    const foto = r.fotoUrl
      ? `<img src="${r.fotoUrl}" class="receita-foto">`
      : `<div class="receita-foto receita-foto-placeholder">${r.nome.charAt(0).toUpperCase()}</div>`;
    const descCurta = (r.descricao||'').slice(0,70) + ((r.descricao||'').length>70?'…':'');
    return `<div class="receita-card" onclick="abrirVerReceita('${r.id}')">
      ${foto}
      <div class="receita-info">
        <div class="receita-nome">${r.nome}</div>
        ${descCurta?`<div class="receita-desc">${descCurta}</div>`:''}
        <div class="receita-meta">${cat?`<span class="receita-cat-badge">${cat.nome}</span>`:''}${dataTxt?`<span>${dataTxt}</span>`:''}</div>
      </div>
      <div class="receita-actions" onclick="event.stopPropagation()">
        <button class="btn-icon-sm" onclick="openReceitaModal('${r.id}')">${ICON_EDIT}</button>
        <button class="btn-icon-sm" onclick="excluirReceita('${r.id}')">${ICON_TRASH}</button>
      </div>
    </div>`;
  }).join('');
}

let receitaCategoriaSelecionada = null;

function toggleReceitaCatPicker(){
  const panel = document.getElementById('receitaCatPickerPanel');
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if(!isOpen){
    renderReceitaCatPickerGrid();
    setTimeout(()=>{ panel.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50);
  }
}
function renderReceitaCatPickerGrid(){
  const grid = document.getElementById('receitaCatPickerGrid');
  const cats = state.receitaCategorias || [];
  let html = `<div class="cat-picker-opt${receitaCategoriaSelecionada===null?' selected':''}" onclick="selecionarReceitaCategoria(null)">Sem categoria</div>`;
  html += cats.map(c=>`<div class="cat-picker-opt${receitaCategoriaSelecionada===c.id?' selected':''}" onclick="selecionarReceitaCategoria('${c.id}')">${c.nome}</div>`).join('');
  grid.innerHTML = html;
}
function selecionarReceitaCategoria(id){
  receitaCategoriaSelecionada = id;
  const cat = id ? (state.receitaCategorias||[]).find(c=>c.id===id) : null;
  document.getElementById('receitaCatPickerBtn').textContent = cat ? cat.nome : 'Sem categoria';
  document.getElementById('receitaCategoriaSelect').value = id || '';
  document.getElementById('receitaCatPickerPanel').style.display = 'none';
}
function criarCategoriaInline(){
  const input = document.getElementById('receitaCatNovaInput');
  const nome = input.value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  if(!state.receitaCategorias) state.receitaCategorias = [];
  let cat = state.receitaCategorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase());
  if(!cat){
    cat = { id:'rcat'+Date.now(), nome };
    state.receitaCategorias.push(cat);
    persist();
  }
  input.value = '';
  selecionarReceitaCategoria(cat.id);
  renderReceitaCatPickerGrid();
}

function renderReceitaFotoPreview(){
  const el = document.getElementById('receitaFotoPreview');
  const nome = document.getElementById('receitaNome').value || '?';
  el.innerHTML = receitaFotoUrlAtual
    ? `<img src="${receitaFotoUrlAtual}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${nome.charAt(0).toUpperCase()}</div>`;
}
function onReceitaFotoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{ receitaFotoUrlAtual = e.target.result; renderReceitaFotoPreview(); };
  reader.readAsDataURL(file);
}
function removerReceitaFoto(){
  receitaFotoUrlAtual = null;
  renderReceitaFotoPreview();
}

/* Ingredientes dinâmicos */
function renderIngredientesCampos(valores){
  const lista = document.getElementById('receitaIngredientesLista');
  const vals = (valores && valores.length) ? valores : ['', '', ''];
  lista.innerHTML = vals.map((v,i)=>`
    <div class="receita-ing-row">
      <div class="receita-ing-num">${i+1}</div>
      <input type="text" class="receita-ing-input" placeholder="Ex: 2 xícaras de farinha" value="${(v||'').replace(/"/g,'&quot;')}">
      <button type="button" class="btn-icon-sm" onclick="removerIngredienteCampo(this)">${ICON_TRASH}</button>
    </div>
  `).join('');
}
function addIngredienteCampo(){
  const lista = document.getElementById('receitaIngredientesLista');
  const n = lista.children.length + 1;
  const row = document.createElement('div');
  row.className = 'receita-ing-row';
  row.innerHTML = `<div class="receita-ing-num">${n}</div><input type="text" class="receita-ing-input" placeholder="Ex: 1 pitada de sal"><button type="button" class="btn-icon-sm" onclick="removerIngredienteCampo(this)">${ICON_TRASH}</button>`;
  lista.appendChild(row);
  row.querySelector('input').focus();
}
function removerIngredienteCampo(btn){
  const row = btn.closest('.receita-ing-row');
  row.remove();
  document.querySelectorAll('#receitaIngredientesLista .receita-ing-num').forEach((el,i)=>{ el.textContent = i+1; });
}
function coletarIngredientes(){
  return Array.from(document.querySelectorAll('#receitaIngredientesLista .receita-ing-input'))
    .map(inp=>inp.value.trim())
    .filter(v=>v.length>0);
}

function openReceitaModal(id){
  document.getElementById('receitaId').value = id || '';
  document.getElementById('modalReceitaTitle').textContent = id ? 'Editar Receita' : 'Nova Receita';
  document.getElementById('receitaCatPickerPanel').style.display = 'none';
  document.getElementById('receitaCatNovaInput').value = '';
  if(id){
    const r = (state.receitas||[]).find(r=>r.id===id);
    if(r){
      document.getElementById('receitaNome').value = r.nome;
      document.getElementById('receitaDescricao').value = r.descricao || '';
      receitaFotoUrlAtual = r.fotoUrl || null;
      selecionarReceitaCategoria(r.categoriaId || null);
      renderIngredientesCampos(r.ingredientes || []);
    }
  }else{
    document.getElementById('receitaNome').value = '';
    document.getElementById('receitaDescricao').value = '';
    receitaFotoUrlAtual = null;
    selecionarReceitaCategoria(null);
    renderIngredientesCampos([]);
  }
  renderReceitaFotoPreview();
  document.getElementById('modalReceita').classList.add('active');
}
function salvarReceita(){
  const id = document.getElementById('receitaId').value;
  const nome = document.getElementById('receitaNome').value.trim();
  const descricao = document.getElementById('receitaDescricao').value.trim();
  const categoriaId = document.getElementById('receitaCategoriaSelect').value || null;
  const fotoUrl = receitaFotoUrlAtual;
  const ingredientes = coletarIngredientes();
  if(!nome){ showToast('Digite o nome da receita'); return; }
  if(!state.receitas) state.receitas = [];
  if(id){
    const r = state.receitas.find(r=>r.id===id);
    if(r) Object.assign(r, { nome, descricao, categoriaId, fotoUrl, ingredientes });
  }else{
    state.receitas.push({ id:'rc'+Date.now(), nome, descricao, categoriaId, fotoUrl, ingredientes, criadoEm: Date.now() });
  }
  persist();
  closeModal('modalReceita');
  renderReceitas();
  showToast('Receita salva');
}
function excluirReceita(id){
  if(!confirm('Excluir esta receita?')) return;
  state.receitas = (state.receitas||[]).filter(r=>r.id!==id);
  persist();
  renderReceitas();
}
function abrirVerReceita(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
  const dataTxt = r.criadoEm ? new Date(r.criadoEm).toLocaleDateString('pt-BR') : '';
  const foto = r.fotoUrl ? `<img src="${r.fotoUrl}" class="receita-foto-grande">` : '';
  const ingredientesHtml = (r.ingredientes && r.ingredientes.length)
    ? `<div class="receita-view-section-title">Ingredientes</div><div class="receita-ing-view">${r.ingredientes.map((ing,i)=>`<div class="receita-ing-view-item"><div class="receita-ing-num">${i+1}</div>${ing}</div>`).join('')}</div>`
    : '';
  const preparoHtml = r.descricao
    ? `<div class="receita-view-section-title">Modo de Preparo</div><div style="white-space:pre-wrap;font-size:13.5px;color:var(--text-dim);line-height:1.6">${r.descricao}</div>`
    : '';
  document.getElementById('verReceitaNome').textContent = r.nome;
  document.getElementById('verReceitaConteudo').innerHTML = `
    ${foto}
    <div class="receita-meta" style="margin:10px 0">${cat?`<span class="receita-cat-badge">${cat.nome}</span>`:''}${dataTxt?`<span>${dataTxt}</span>`:''}</div>
    ${ingredientesHtml}
    ${preparoHtml}
    ${!ingredientesHtml && !preparoHtml ? '<div style="font-size:13px;color:var(--text-faint)">Sem ingredientes ou modo de preparo.</div>' : ''}
  `;
  document.getElementById('modalVerReceita').classList.add('active');
}

function openReceitaCategoriaModal(){
  document.getElementById('receitaCategoriaNome').value = '';
  document.getElementById('modalReceitaCategoria').classList.add('active');
}
function salvarReceitaCategoria(){
  const nome = document.getElementById('receitaCategoriaNome').value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  if(!state.receitaCategorias) state.receitaCategorias = [];
  const existe = state.receitaCategorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase());
  if(existe){ showToast('Essa categoria já existe'); return; }
  state.receitaCategorias.push({ id:'rcat'+Date.now(), nome });
  persist();
  closeModal('modalReceitaCategoria');
  renderReceitas();
  showToast('Categoria criada');
}

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Erro ao registrar service worker', e));
  });
}
