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
    cartoesTracker:[],
    comprasTracker:[],
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
function fmtMoneySigned(v){ return v>=0 ? fmtMoney(v) : '('+fmtMoney(Math.abs(v))+')'; }
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
  event.target.blur(); // garante que onchange (que salva o valor) rode antes de pular
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

/* ================= NAVEGAÇÃO DE ABAS ================= */
function switchAba(aba){
  document.querySelectorAll('.aba').forEach(el=>el.classList.remove('active'));
  document.getElementById('aba-'+aba).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.aba===aba));
  if(aba==='ponto') renderPonto();
  if(aba==='planner') renderPlanner();
  if(aba==='panorama') renderPanorama();
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
  const base = rendaBaseForMonth(user, mKey) + ((state.users[user].incomeExtra||{})[mKey] || 0);
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
      <div class="u-row"><span class="lbl">Receita</span><span class="u-receita">${fmtMoney(receita)}</span></div>
      <div class="u-row"><span class="lbl">Gastos</span><span class="u-gastos">${fmtMoney(gastos)}</span></div>
      ${gastosComparativo}
      <div class="u-sobra ${sobra>=0?'positive':'negative'}"><span class="lbl">Sobra</span><span>${fmtMoney(sobra)}</span></div>
    </div>`;
  }).join('');

  document.getElementById('contasMesLabel').textContent = monthLabel(state.focusMonth);
  renderChecklist();
  renderSumarioPanorama();
}

function renderSumarioPanorama(){
  const summary = document.getElementById('sumarioPanorama');
  if(!summary) return;
  const mKeyAtual = state.focusMonth;
  const rendaTotal = (incomeForMonth('davi', mKeyAtual) || 0) + (incomeForMonth('cris', mKeyAtual) || 0);
  const gastoTotal = (expensesForMonth('davi', mKeyAtual) || 0) + (expensesForMonth('cris', mKeyAtual) || 0);
  const totalCartoes = (state.cartoesTracker||[]).reduce((s,c)=>{
    const compras = (state.comprasTracker||[]).filter(cp=>cp.cartaoId===c.id && !cp.pago);
    const usado = compras.reduce((s2,item)=>{ const calc=compraTrackerCalc(item); return s2 + (calc.status==='concluido'?0:calc.restante); },0) + (c.credoVista?.reduce((s2,v)=>s2+Number(v.valor||0),0)||0);
    return s + usado;
  },0);
  const dizimo = (state.users.davi.income[mKeyAtual] || 0) * 0.1;
  summary.innerHTML = `<div class="summary-row"><span>Renda Total</span><span class="summary-value">${fmtMoney(rendaTotal)}</span></div><div class="summary-row"><span>Gasto Total</span><span class="summary-value">${fmtMoney(gastoTotal)}</span></div><div class="summary-row"><span>Cartões</span><span class="summary-value">${fmtMoney(totalCartoes)}</span></div><div class="summary-row"><span>Dízimo (visual)</span><span class="summary-value">${fmtMoney(dizimo)}</span></div>`;
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
  const valores = months.map(mKey=>{ acumulado += saldoHouseholdForMonth(mKey); return acumulado; });
  const w = 320, h = 110, pad = 8;
  const min = Math.min(0, ...valores), max = Math.max(0, ...valores);
  const range = (max-min) || 1;
  const stepX = (w-pad*2) / (months.length-1 || 1);
  const pts = valores.map((v,i)=>{
    const x = pad + i*stepX;
    const y = h-pad - ((v-min)/range)*(h-pad*2);
    return [x,y];
  });
  const pathD = pts.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const zeroY = h-pad - ((0-min)/range)*(h-pad*2);
  const circles = pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="var(--primary-dark)"><title>${monthLabel(months[i])}: ${fmtMoney(valores[i])}</title></circle>`).join('');
  wrap.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;display:block">
    <line x1="${pad}" y1="${zeroY.toFixed(1)}" x2="${w-pad}" y2="${zeroY.toFixed(1)}" stroke="var(--slate-300)" stroke-width="1" stroke-dasharray="3,3"/>
    <path d="${pathD}" fill="none" stroke="var(--primary-dark)" stroke-width="2"/>
    ${circles}
  </svg>`;
}

function renderAcumTable(months){
  let acumulado = 0;
  const rows = months.map(mKey=>{
    const sobra = saldoHouseholdForMonth(mKey);
    acumulado += sobra;
    const isSelected = mKey === state.focusMonth;
    return `<tr class="${isSelected?'selected-row':''}" onclick="selectFocusMonth('${mKey}')" style="cursor:pointer">
      <td class="row-label">${monthLabel(mKey)}${isSelected?' •':''}</td>
      <td style="font-weight:700">${sobra>=0?fmtMoney(sobra):'('+fmtMoney(Math.abs(sobra))+')'}</td>
      <td style="font-weight:800">${acumulado>=0?fmtMoney(acumulado):'('+fmtMoney(Math.abs(acumulado))+')'}</td>
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
        items.push({ user:u, cat, id:item.id, desc:item.desc, valor:item.valor, dia:item.dia||1 });
      });
    });
    state.users[u].expenses.futuro.forEach(item=>{
      const v = futuroValorNoMes(item, mKey);
      if(v > 0){
        const p = futuroParcelaNoMes(item, mKey);
        items.push({ user:u, cat:'futuro', id:item.id, desc:item.desc + (p?' ('+p.atual+'/'+p.total+')':''), valor:v, dia:item.dia||1 });
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
  const isRealCurrentMonth = mKey === mesFinanceiroAtual();
  const today = new Date();
  const todayDay = today.getDate();
  const items = getContasDoMes(mKey);

  const list = document.getElementById('contasChecklist');
  if(items.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="title">Nenhuma conta neste mês</div><div class="desc">Adicione gastos no Planner</div></div>`;
    return;
  }
  list.innerHTML = items.map(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    const isPaid = !!state.paid[paidKey];
    let cls = '';
    if(isPaid) cls='paid';
    else if(isRealCurrentMonth && it.dia < todayDay) cls='overdue';
    else if(isRealCurrentMonth && it.dia - todayDay <= 3 && it.dia - todayDay >= 0) cls='urgent';
    return `<div class="check-item ${cls}">
      <input type="checkbox" ${isPaid?'checked':''} onchange="togglePaid('${paidKey}')">
      <div class="info">
        <div class="desc">${it.desc} <span class="badge ${it.user==='davi'?'blue':'lavender'}">${it.user}</span></div>
        <div class="meta">Vence dia ${it.dia} · ${fmtMoney(it.valor)}</div>
      </div>
    </div>`;
  }).join('');
}
function togglePaid(paidKey){
  state.paid[paidKey] = !state.paid[paidKey];
  renderChecklist();
  persist();
}

/* ================= RENDER: PLANNER ================= */
function renderPlanner(){
  const u = state.currentUser;
  document.getElementById('saldoAtualInput').value = state.users[u].saldoAtual ? state.users[u].saldoAtual.toFixed(2).replace('.',',') : '';
  document.getElementById('btnAddCartao').style.display = (u==='davi') ? '' : 'none';

  renderRendaTable();
  ['moradia','assinatura','fixo','futuro'].forEach(cat=> renderGastoGrid(cat));
  renderCartaoTrackerList();
}

function renderRendaTable(){
  const u = state.currentUser;
  const months = [];
  for(let i=0;i<6;i++) months.push(addMonths(mesFinanceiroAtual(), i));
  const cartoes = (u==='davi') ? (state.users[u].cartoes || []) : [];
  const hoje = mesFinanceiroAtual();

  const thead = `<tr><th style="text-align:left;padding-left:10px">Categoria</th>${months.map(mKey=>{
    const isCurrent = mKey===hoje;
    return `<th class="${isCurrent?'current-col':''}">${monthLabel(mKey)}${isCurrent?'<small>Atual</small>':''}</th>`;
  }).join('')}<th>Ações</th></tr>`;

  const rendaRow = `<tr><td class="row-label">Renda${u==='davi'?' <span style="font-weight:500;color:var(--slate-400);font-size:9px;text-transform:none">(auto)</span>':''}</td>${months.map(mKey=>{
    if(u==='davi'){
      const val = rendaBaseForMonth(u, mKey);
      const mesOrigem = monthLabel(addMonths(mKey,-1));
      return `<td class="${mKey===hoje?'current-col':''}" style="font-weight:700;color:var(--slate-700)" title="Calculado a partir do Ponto PJ de ${mesOrigem}">${fmtMoney(val)}</td>`;
    }
    const val = state.users[u].income[mKey] || 0;
    return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setIncome('${u}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
  }).join('')}<td></td></tr>`;

  const extraRow = `<tr><td class="row-label">Extra</td>${months.map(mKey=>{
    const val = (state.users[u].incomeExtra && state.users[u].incomeExtra[mKey]) || 0;
    return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setIncomeExtra('${u}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
  }).join('')}<td></td></tr>`;

  const dizimoRow = (u!=='davi') ? '' : `<tr><td class="row-label" style="color:var(--slate-500)">Dízimo (10%)</td>${months.map(mKey=>{
    const val = dizimoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}" style="color:var(--slate-500);font-weight:600">${fmtMoney(val)}</td>`;
  }).join('')}<td></td></tr>`;

  const cartaoRows = (u!=='davi') ? '' : (cartoes.length === 0
    ? `<tr><td class="row-label" style="color:var(--slate-400);font-weight:500" colspan="${months.length+2}">Nenhum cartão cadastrado — toque em "+ Cartão" acima</td></tr>`
    : cartoes.map(c=>{
      return `<tr class="cartao-row"><td class="row-label">${c.nome}</td>${months.map(mKey=>{
        const val = (c.gastos||{})[mKey] || 0;
        return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setCartaoGasto('${c.id}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
      }).join('')}<td><span class="cartao-actions"><button class="btn-icon-sm" onclick="editCartao('${c.id}')">${ICON_EDIT}</button><button class="btn-icon-sm" onclick="deleteCartao('${c.id}')">${ICON_TRASH}</button></span></td></tr>`;
    }).join(''));

  const sobraRow = `<tr class="total-row"><td class="row-label">Sobra estimada</td>${months.map(mKey=>{
    const s = saldoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}"><span class="total-value">${s>=0?fmtMoney(s):'('+fmtMoney(Math.abs(s))+')'}</span></td>`;
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
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="title">Nada por aqui</div><div class="desc">Toque em Add para incluir um gasto</div></div>`;
    return;
  }
  grid.innerHTML = items.map(item=>{
    const metaTxt = cat==='futuro' ? futuroDescricaoMeta(item) : ('Vence dia '+(item.dia||1)+(item.mesInicio?' · a partir de '+monthLabel(item.mesInicio):''));
    const valorTxt = cat==='futuro'
      ? (item.recorrente || (item.parcelas||1)<=1 || item.replicar!==false
          ? fmtMoney(item.valor)
          : 'Variável')
      : fmtMoney(item.valor);
    return `<div class="gasto-item ${cat}">
      <div class="top-row">
        <div class="desc">${item.desc}</div>
        <div class="valor">${valorTxt}</div>
      </div>
      <div class="meta">${metaTxt}</div>
      <div class="actions">
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
        return `<div class="compra-tracker-item${pagoClass}">
          <div class="ct-top">
            <div class="ct-nome${pagoClass}">${item.nome}</div>
            <div class="ct-actions">
              <button class="btn-icon-sm" title="Marcar como ${item.pago?'pendente':'pago'}" onclick="toggleCompraPago('${item.id}')" style="color:${item.pago?'var(--green)':'var(--slate-400)'}">${item.pago?'✓':'◯'}</button>
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
      <div class="ct-datas">Fecha dia ${cartao.fechamento||'—'} · vence dia ${cartao.vencimento||'—'}</div>
      <div class="ct-row" style="margin-top:8px">
        <span class="ct-parcela">Usado ${fmtMoney(usado)}</span>
        <span class="ct-total">Disponível ${fmtMoney(disponivel)} de ${fmtMoney(limite)}</span>
      </div>
      <div class="ct-bar"><div class="ct-bar-fill limite" style="width:${percentUsado}%"></div></div>
      <div class="compras-do-cartao">${comprasHtml}</div>
      <div class="credo-vista-list">
        ${(cartao.credoVista||[]).map(cv=>`<div class="credo-vista-item"><span class="cv-desc">${cv.descricao||'Crédito à vista'}</span><span class="cv-valor">${fmtMoney(cv.valor)}</span><button class="btn-icon-sm" onclick="excluirCredoVista('${cartao.id}','${cv.id}')">${ICON_TRASH}</button></div>`).join('')}
      </div>
      <button class="btn btn-sm btn-outline" style="width:100%;margin-top:10px" onclick="openCompraTrackerModal('${cartao.id}')">+ Compra parcelada</button>
      <button class="btn btn-sm btn-outline" style="width:100%;margin-top:6px" onclick="openCredoVistaModal('${cartao.id}')">+ Crédito à vista</button>
    </div>`;
  }).join('');
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
function openCompraTrackerModal(cartaoId, compraId){
  if(!(state.cartoesTracker||[]).length){ showToast('Cadastre um cartão primeiro'); return; }
  popularSelectMes('compraTrackerMesInicio');
  popularSelectCartoes('compraTrackerCartaoId', cartaoId);
  document.getElementById('compraTrackerId').value = compraId || '';
  document.getElementById('modalCompraTrackerTitle').textContent = compraId ? 'Editar Compra' : 'Nova Compra';
  if(compraId){
    const item = (state.comprasTracker||[]).find(i=>i.id===compraId);
    if(item){
      document.getElementById('compraTrackerNome').value = item.nome;
      document.getElementById('compraTrackerCartaoId').value = item.cartaoId;
      document.getElementById('compraTrackerValor').value = (item.valorTotal||0).toFixed(2).replace('.',',');
      document.getElementById('compraTrackerParcelas').value = item.parcelas || 1;
      document.getElementById('compraTrackerMesInicio').value = item.mesInicio || '';
    }
  }else{
    document.getElementById('compraTrackerNome').value = '';
    document.getElementById('compraTrackerValor').value = '';
    document.getElementById('compraTrackerParcelas').value = 1;
    document.getElementById('compraTrackerMesInicio').value = mesFinanceiroAtual();
  }
  document.getElementById('modalCompraTracker').classList.add('active');
}
function salvarCompraTracker(){
  const id = document.getElementById('compraTrackerId').value;
  const nome = document.getElementById('compraTrackerNome').value.trim();
  const cartaoId = document.getElementById('compraTrackerCartaoId').value;
  const valorTotal = parseMoney(document.getElementById('compraTrackerValor').value);
  const parcelas = Math.max(1, parseInt(document.getElementById('compraTrackerParcelas').value) || 1);
  const mesInicio = document.getElementById('compraTrackerMesInicio').value || null;
  if(!nome){ showToast('Digite o nome da compra'); return; }
  if(!cartaoId){ showToast('Selecione o cartão'); return; }
  if(!state.comprasTracker) state.comprasTracker = [];
  if(id){
    const item = state.comprasTracker.find(i=>i.id===id);
    if(item) Object.assign(item, { nome, cartaoId, valorTotal, parcelas, mesInicio });
  } else {
    state.comprasTracker.push({ id: 'cp'+Date.now(), nome, cartaoId, valorTotal, parcelas, mesInicio });
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

function openGastoModal(cat, id){
  popularSelectMes('gastoMesInicioSimples');
  popularSelectMes('gastoMesInicio');
  document.getElementById('gastoCat').value = cat;
  document.getElementById('gastoId').value = id || '';
  document.getElementById('modalGastoTitle').textContent = id ? 'Editar Gasto' : 'Adicionar Gasto';

  if(id){
    const item = state.users[state.currentUser].expenses[cat].find(i=>i.id===id);
    if(item){
      document.getElementById('gastoDesc').value = item.desc;
      document.getElementById('gastoValor').value = (item.valor||0).toFixed(2).replace('.',',');
      document.getElementById('gastoDia').value = item.dia || '';
      document.getElementById('gastoMesInicioSimples').value = item.mesInicio || '';

      if(cat==='futuro'){
        const isLegado = item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined;
        document.getElementById('gastoRecorrente').checked = !!item.recorrente;
        document.getElementById('gastoMesInicio').value = isLegado ? (item.mes||'') : (item.mesInicio||'');
        document.getElementById('gastoParcelas').value = item.parcelas || 1;
        document.getElementById('gastoReplicar').checked = item.replicar !== false;
        updateGastoFieldsVisibility();
        if(item.replicar === false) renderParcelasValoresInputs(item.valores);
      }
    }
  }else{
    document.getElementById('gastoDesc').value = '';
    document.getElementById('gastoValor').value = '';
    document.getElementById('gastoDia').value = '';
    document.getElementById('gastoMesInicioSimples').value = '';
    document.getElementById('gastoRecorrente').checked = false;
    document.getElementById('gastoMesInicio').value = mesFinanceiroAtual();
    document.getElementById('gastoParcelas').value = 1;
    document.getElementById('gastoReplicar').checked = true;
  }
  updateGastoFieldsVisibility();
  document.getElementById('modalGasto').classList.add('active');
}
function editGasto(cat, id){ openGastoModal(cat, id); }
function saveGasto(){
  const cat = document.getElementById('gastoCat').value;
  const id = document.getElementById('gastoId').value;
  const desc = document.getElementById('gastoDesc').value.trim();
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
    novo = { desc, recorrente, mesInicio, parcelas, replicar, valor, valores };
  }else{
    const valor = parseMoney(document.getElementById('gastoValor').value);
    const mesInicio = document.getElementById('gastoMesInicioSimples').value || null;
    novo = { desc, valor, dia, mesInicio };
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
  const tbody = document.getElementById('pontoTbody');
  let rows = '';
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const isWeekend = dateObj.getDay()===0 || dateObj.getDay()===6;
    const total = dayTotalMinutes(d);
    const extraVal = d.extra ? String(Math.floor(d.extra/60)).padStart(2,'0')+':'+String(d.extra%60).padStart(2,'0') : '';
    rows += `<tr class="${isWeekend?'weekend':''} ${d.extra?'hora-extra-row':''}">
      <td class="dia-cell">${String(dia).padStart(2,'0')}<small>${DIA_SEMANA[dateObj.getDay()]}</small></td>
      <td>${tempoCellHtml(dia,'entrada',d.entrada)}</td>
      <td>${tempoCellHtml(dia,'almocoSaida',d.almocoSaida)}</td>
      <td>${tempoCellHtml(dia,'almocoVolta',d.almocoVolta)}</td>
      <td>${tempoCellHtml(dia,'saida',d.saida)}</td>
      <td><input type="text" class="extra-input" value="${extraVal}" placeholder="00:00" onchange="setExtra(${dia}, this.value)"></td>
      <td class="dia-total ${total===0?'zero':''}">${minToHoursLabel(total)}</td>
      <td><button class="btn-icon-sm" onclick="zerarDia(${dia})" title="Não trabalhei">${ICON_BAN}</button></td>
    </tr>`;
  }
  tbody.innerHTML = rows;
  renderPontoSummary();
}

function tempoCellHtml(dia, campo, valor){
  const modifiedClass = valor ? 'modified' : '';
  return `<div class="tempo-cell">
    <button class="arrow-btn" onclick="adjustTempo(${dia},'${campo}',-1)">◀</button>
    <span class="tempo-val ${modifiedClass}">${valor || '--:--'}</span>
    <button class="arrow-btn" onclick="adjustTempo(${dia},'${campo}',1)">▶</button>
  </div>`;
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
    avisoEl.textContent = `⚠ Ainda há ${abertas} conta${abertas>1?'s':''} em aberto em ${monthLabel(mesContasAtual)}. Você pode concluir mesmo assim.`;
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
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Erro ao registrar service worker', e));
  });
}
