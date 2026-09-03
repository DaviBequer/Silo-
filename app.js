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
    semanaOffset:0,
    semanaAgenda:{},
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
      if(state.reserva === undefined) state.reserva = 0;
      if(!state.receitas) state.receitas = [];
      if(!state.receitaCategorias) state.receitaCategorias = [];
      if(!state.louvores) state.louvores = [];
      if(!state.estoque) state.estoque = [];
      state.estoque.forEach(e=>{ if(!e.precos) e.precos = []; if(!e.historicoCompras) e.historicoCompras = []; });
      if(!state.listaCompras) state.listaCompras = [];
      state.listaCompras.forEach(it=>{ if(it.noCarrinho===undefined) it.noCarrinho = false; });
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

/* ================= CÁLCULOS FINANCEIROS ================= */
const DIZIMO_PERCENT = 0.10;

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
  const base = rendaBaseForMonth(user, mKey);
  const extra = extraTotalForMonth(user, mKey);
  const saldo = (mKey === mesFinanceiroAtual()) ? (state.users[user].saldoAtual || 0) : 0;
  return base + extra + saldo;
}
function dizimoForMonth(user, mKey){
  if(user !== 'davi') return 0;
  const base = rendaBaseForMonth(user, mKey);
  return base * DIZIMO_PERCENT;
}

/* ================= RENDA EXTRA (múltiplas entradas, por período) ================= */
let rendaExtraUser = null;
function abrirRendaExtraModal(user, mKey){
  rendaExtraUser = user;
  document.getElementById('rendaExtraModalUsuario').textContent = user==='davi'?'Davi':'Cris';
  resetarFormExtraItem();
  createMonthPicker('extraMesInicioPicker','extraMesInicio', mKey);
  createMonthPicker('extraMesFimPicker','extraMesFim', mKey);
  renderRendaExtraLista();
  document.getElementById('modalRendaExtra').classList.add('active');
}
function resetarFormExtraItem(){
  document.getElementById('extraItemId').value = '';
  document.getElementById('extraItemDesc').value = '';
  document.getElementById('extraItemValor').value = '';
  document.getElementById('extraFormTitulo').textContent = 'Novo Extra';
}
function renderRendaExtraLista(){
  const lista = (state.users[rendaExtraUser].extras||[]).slice().sort((a,b)=> b.mesInicio.localeCompare(a.mesInicio));
  const el = document.getElementById('rendaExtraLista');
  if(lista.length===0){
    el.innerHTML = `<div class="empty-state-sm">Nenhum extra cadastrado ainda</div>`;
    return;
  }
  el.innerHTML = lista.map(e=>{
    const fim = e.mesFim || e.mesInicio;
    const periodo = e.mesInicio===fim ? monthLabelExtensoCurto(e.mesInicio) : `${monthLabelExtensoCurto(e.mesInicio)} – ${monthLabelExtensoCurto(fim)}`;
    return `<div class="renda-extra-item">
      <div class="rei-info">
        <div class="rei-desc">${e.desc}</div>
        <div class="rei-periodo">${periodo}</div>
      </div>
      <div class="rei-valor">${fmtMoney(e.valor)}</div>
      <div class="rei-actions">
        <button class="btn-icon-sm" onclick="editarExtraItem('${e.id}')">${ICON_EDIT}</button>
        <button class="btn-icon-sm" onclick="excluirExtraItem('${e.id}')">${ICON_TRASH}</button>
      </div>
    </div>`;
  }).join('');
}
function editarExtraItem(id){
  const item = (state.users[rendaExtraUser].extras||[]).find(e=>e.id===id);
  if(!item) return;
  document.getElementById('extraItemId').value = item.id;
  document.getElementById('extraItemDesc').value = item.desc;
  document.getElementById('extraItemValor').value = Number(item.valor).toFixed(2).replace('.',',');
  selectPickerMonth('extraMesInicioPicker', item.mesInicio);
  selectPickerMonth('extraMesFimPicker', item.mesFim||item.mesInicio);
  document.getElementById('extraFormTitulo').textContent = 'Editar Extra';
}
function salvarExtraItem(){
  const id = document.getElementById('extraItemId').value;
  const desc = document.getElementById('extraItemDesc').value.trim();
  const valor = parseMoney(document.getElementById('extraItemValor').value);
  const mesInicio = document.getElementById('extraMesInicio').value;
  const mesFim = document.getElementById('extraMesFim').value;
  if(!desc){ showToast('Digite uma descrição'); return; }
  if(!valor){ showToast('Digite um valor'); return; }
  if(!mesInicio || !mesFim){ showToast('Selecione o período'); return; }
  if(mesFim < mesInicio){ showToast('Mês final não pode ser antes do inicial'); return; }
  if(!state.users[rendaExtraUser].extras) state.users[rendaExtraUser].extras = [];
  if(id){
    const item = state.users[rendaExtraUser].extras.find(e=>e.id===id);
    if(item){ item.desc=desc; item.valor=valor; item.mesInicio=mesInicio; item.mesFim=mesFim; }
  } else {
    state.users[rendaExtraUser].extras.push({ id:'ex'+Date.now(), desc, valor, mesInicio, mesFim });
  }
  persist();
  resetarFormExtraItem();
  renderRendaExtraLista();
  renderRendaTable();
  renderPanorama();
  showToast('Extra salvo');
}
function excluirExtraItem(id){
  state.users[rendaExtraUser].extras = (state.users[rendaExtraUser].extras||[]).filter(e=>e.id!==id);
  persist();
  renderRendaExtraLista();
  renderRendaTable();
  renderPanorama();
}
function closeRendaExtraModal(){
  document.getElementById('modalRendaExtra').classList.remove('active');
  rendaExtraUser = null;
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
  renderPanoCharts();
  renderPanoPonto();

  const userSection = document.getElementById('panoUserSection');
  const colsHtml = ['davi','cris'].map(u=>{
    const receita = incomeForMonth(u, state.focusMonth);
    const gastos = expensesForMonth(u, state.focusMonth);
    const sobra = receita - gastos;
    return `<div class="ucc-col">
      <div class="u-name">${u==='davi'?'Davi':'Cris'}</div>
      <div class="u-row" style="cursor:pointer" onclick="abrirDetalheAcumulado('${state.focusMonth}')"><span class="lbl">Receita</span><span class="u-receita">${fmtMoney(receita)}</span></div>
      <div class="u-row" style="cursor:pointer" onclick="abrirDetalheAcumulado('${state.focusMonth}')"><span class="lbl">Gastos</span><span class="u-gastos">${fmtMoney(gastos)}</span></div>
      <div class="u-sobra ${sobra>=0?'positive':'negative'}"><span class="lbl">Sobra</span><span>${fmtMoneySigned(sobra)}</span></div>
    </div>`;
  }).join('<div class="ucc-divider"></div>');
  userSection.innerHTML = `<div class="user-card-combined">${colsHtml}</div>`;

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
    <div class="summary-row summary-row-clickable" onclick="abrirDetalheCategoria('moradia','${mKeyAtual}')"><span>Moradia</span><span class="summary-value">${fmtMoney(moradia)}</span></div>
    <div class="summary-row summary-row-clickable" onclick="abrirDetalheCategoria('fixo','${mKeyAtual}')"><span>Fixos</span><span class="summary-value">${fmtMoney(fixo)}</span></div>
    <div class="summary-row summary-row-clickable" onclick="abrirDetalheCategoria('assinatura','${mKeyAtual}')"><span>Assinaturas</span><span class="summary-value">${fmtMoney(assinatura)}</span></div>
    <div class="summary-row summary-row-clickable" onclick="abrirDetalheCategoria('futuro','${mKeyAtual}')"><span>Contas Futuras</span><span class="summary-value">${fmtMoney(futuro)}</span></div>
    <div class="summary-row"><span>Cartões</span><span class="summary-value">${fmtMoney(totalCartoes)}</span></div>
  `;
}

const CATEGORIA_LABELS = { moradia:'Moradia', fixo:'Fixos', assinatura:'Assinaturas', futuro:'Contas Futuras' };
function abrirDetalheCategoria(cat, mKey){
  const itens = getContasDoMes(mKey).filter(it=>it.cat===cat);
  const total = itens.reduce((s,it)=>s+(Number(it.valor)||0),0);
  document.getElementById('detalheCategoriaTitulo').textContent = `${CATEGORIA_LABELS[cat]} — ${monthLabelExtensoCurto(mKey)}`;
  const conteudo = itens.length===0
    ? `<div class="empty-state-sm">Nenhum item nesta categoria</div>`
    : `<div class="detalhe-categoria-lista">${itens.map(it=>{
        const logo = it.logoUrl
          ? `<img src="${it.logoUrl}" class="conta-logo">`
          : `<div class="conta-logo conta-logo-placeholder">${it.desc.charAt(0).toUpperCase()}</div>`;
        return `<div class="detalhe-categoria-item">
          ${logo}
          <div class="dci-info">
            <div class="dci-desc">${it.desc}</div>
            <div class="dci-meta"><span class="user-tag ${it.user}">${it.user==='davi'?'Davi':'Cris'}</span> · dia ${it.dia}</div>
          </div>
          <div class="dci-valor">${fmtMoney(it.valor)}</div>
        </div>`;
      }).join('')}
      <div class="detalhe-categoria-total"><span>Total</span><span>${fmtMoney(total)}</span></div>
      </div>`;
  document.getElementById('detalheCategoriaConteudo').innerHTML = conteudo;
  document.getElementById('modalDetalheCategoria').classList.add('active');
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

function renderPanoCharts(){
  const wrap = document.getElementById('trendChartWrap');
  if(!wrap) return;
  const mKey = state.focusMonth;
  const renda = incomeForMonth('davi', mKey) + incomeForMonth('cris', mKey);
  const bdDavi = expenseBreakdownForMonth('davi', mKey);
  const bdCris = expenseBreakdownForMonth('cris', mKey);
  const cats = ['moradia','fixo','assinatura','futuro','cartao','dizimo'];
  const catColors = { moradia:'#2B3038', fixo:'#0EA5E9', assinatura:'#DB8B18', futuro:'#E0342B', cartao:'#1C9D5B', dizimo:'#7B5FA6' };
  const catLabels = { moradia:'Moradia', fixo:'Fixos', assinatura:'Assinaturas', futuro:'Contas Futuras', cartao:'Cartão', dizimo:'Dízimo' };
  const totals = {};
  let gastosTotal = 0;
  cats.forEach(c=>{ totals[c] = (bdDavi[c]||0)+(bdCris[c]||0); gastosTotal += totals[c]; });
  const sobra = renda - gastosTotal;

  const pctGasto = renda>0 ? Math.min(100,(gastosTotal/renda)*100) : (gastosTotal>0?100:0);
  const gradGanhos = `conic-gradient(var(--danger) 0% ${pctGasto.toFixed(2)}%, var(--success) ${pctGasto.toFixed(2)}% 100%)`;

  let acc = 0;
  const catsComValor = cats.filter(c=>totals[c]>0);
  const segs = catsComValor.map(c=>{
    const pct = gastosTotal>0 ? (totals[c]/gastosTotal*100) : 0;
    const seg = `${catColors[c]} ${acc.toFixed(2)}% ${(acc+pct).toFixed(2)}%`;
    acc += pct;
    return seg;
  });
  const gradCat = segs.length ? `conic-gradient(${segs.join(',')})` : `conic-gradient(var(--line) 0% 100%)`;
  const legendCat = catsComValor.length ? catsComValor.map(c=>{
    const pct = gastosTotal>0 ? (totals[c]/gastosTotal*100) : 0;
    return `<div class="donut-legend-item"><i style="background:${catColors[c]}"></i><span>${catLabels[c]}</span><b>${pct.toFixed(0)}%</b></div>`;
  }).join('') : `<div class="donut-legend-item"><span>Sem gastos no mês</span></div>`;

  wrap.innerHTML = `
    <div class="donut-row">
      <div class="donut-card">
        <div class="donut-wrap" style="background:${gradGanhos}"><div class="donut-hole"><div class="donut-hole-label">Ganho</div><div class="donut-hole-value">${fmtMoney(renda)}</div></div></div>
        <div class="donut-legend">
          <div class="donut-legend-item"><i style="background:var(--success)"></i><span>Sobra</span><b>${fmtMoneySigned(sobra)}</b></div>
          <div class="donut-legend-item"><i style="background:var(--danger)"></i><span>Gastos</span><b>${fmtMoney(gastosTotal)}</b></div>
        </div>
      </div>
      <div class="donut-card">
        <div class="donut-wrap" style="background:${gradCat}"><div class="donut-hole"><div class="donut-hole-label">Gastos</div><div class="donut-hole-value">${fmtMoney(gastosTotal)}</div></div></div>
        <div class="donut-legend">${legendCat}</div>
      </div>
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
        ${bd.moradia>0?`<div class="simulador-linha summary-row-clickable" onclick="abrirDetalheCategoria('moradia','${mKey}')"><span class="label">Moradia</span><span class="valor">-${fmtMoney(bd.moradia)}</span></div>`:''}
        ${bd.fixo>0?`<div class="simulador-linha summary-row-clickable" onclick="abrirDetalheCategoria('fixo','${mKey}')"><span class="label">Fixos</span><span class="valor">-${fmtMoney(bd.fixo)}</span></div>`:''}
        ${bd.assinatura>0?`<div class="simulador-linha summary-row-clickable" onclick="abrirDetalheCategoria('assinatura','${mKey}')"><span class="label">Assinaturas</span><span class="valor">-${fmtMoney(bd.assinatura)}</span></div>`:''}
        ${bd.futuro>0?`<div class="simulador-linha summary-row-clickable" onclick="abrirDetalheCategoria('futuro','${mKey}')"><span class="label">Contas Futuras</span><span class="valor">-${fmtMoney(bd.futuro)}</span></div>`:''}
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
    return `<div class="check-item-compact ${isPaid?'paid':''}"
      onpointerdown="contaTapStart(event,'${paidKey}','${it.user}','${it.cat}','${it.id}','${mKey}')" onpointerup="contaTapEnd(event,'${paidKey}')" onpointercancel="contaTapCancel()" onpointerleave="contaTapCancel()">
      ${logo}
      <div class="info">
        <div class="desc">${it.desc}</div>
        <div class="meta"><span class="user-tag ${it.user}">${it.user==='davi'?'Davi':'Cris'}</span> · dia ${it.dia} · ${fmtMoney(it.valor)}${isParcial?` <span style="color:var(--warning);font-weight:700">· pago ${fmtMoney(valorPago)}</span>`:''}</div>
      </div>
    </div>`;
  }).join('');
}
let contaTapTimer = null;
let iosConfirmResolve = null;
function iosConfirm(msg){
  document.getElementById('iosConfirmMsg').textContent = msg;
  document.getElementById('iosConfirmOverlay').classList.add('show');
  return new Promise(resolve=>{ iosConfirmResolve = resolve; });
}
function iosConfirmResolver(v){
  document.getElementById('iosConfirmOverlay').classList.remove('show');
  if(iosConfirmResolve) iosConfirmResolve(v);
  iosConfirmResolve = null;
}

let contaTapLongFired = false;
function contaTapStart(ev, paidKey, user, cat, id, mKey){
  if(ev.pointerType==='mouse' && ev.button!==0) return;
  contaTapLongFired = false;
  contaTapTimer = setTimeout(()=>{
    contaTapLongFired = true;
    if(navigator.vibrate) navigator.vibrate(12);
    abrirEditarConta(paidKey, user, cat, id, mKey);
  }, 500);
}
function contaTapEnd(ev, paidKey){
  clearTimeout(contaTapTimer);
  if(!contaTapLongFired){
    const isPaid = !!state.paid[paidKey];
    if(isPaid){
      iosConfirm('Cancelar?').then(ok=>{ if(ok) togglePaid(paidKey); });
    }else{
      togglePaid(paidKey);
    }
  }
}
function contaTapCancel(){
  clearTimeout(contaTapTimer);
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
  switchTarefasSubtab('tarefas');
  renderTarefasModal();
  if(tarefaTimerInterval) clearInterval(tarefaTimerInterval);
  tarefaTimerInterval = setInterval(tickTarefaTimers, 1000);
}
function closeTarefasPage(){
  document.getElementById('pageTarefas').classList.remove('active');
  if(tarefaTimerInterval){ clearInterval(tarefaTimerInterval); tarefaTimerInterval = null; }
}
function switchTarefasSubtab(tab){
  document.getElementById('subtabTarefas').style.display = tab==='tarefas' ? '' : 'none';
  document.getElementById('subtabSemana').style.display = tab==='semana' ? '' : 'none';
  document.getElementById('subtabBtnTarefas').classList.toggle('active', tab==='tarefas');
  document.getElementById('subtabBtnSemana').classList.toggle('active', tab==='semana');
  if(tab==='semana') renderSemana();
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
    const val = extraTotalForMonth(u, mKey);
    return `<td class="cell-money cell-money-clickable ${mKey===hoje?'current-col':''}" onclick="abrirRendaExtraModal('${u}','${mKey}')">${val?fmtMoney(val):'<span class="cell-money-empty">+ Extra</span>'}</td>`;
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
  function finalizarExclusao(){
    state.cartoesTracker = (state.cartoesTracker||[]).filter(i=>i.id!==id);
    state.comprasTracker = (state.comprasTracker||[]).filter(c=>c.cartaoId!==id);
    persist();
    renderCartaoTrackerList();
  }
  if(temCompras){
    iosConfirm('Este cartão tem compras lançadas. Excluir também vai excluir todas as compras dele.').then(ok=>{
      if(ok) finalizarExclusao();
    });
  }else{
    finalizarExclusao();
  }
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
    state.ponto.days[mKey][dia] = isWeekend
      ? { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0, confirmado:{} }
      : { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:tempoPadraoSaida(mKey,dia), extra:0, confirmado:{} };
  }
  if(!state.ponto.days[mKey][dia].confirmado) state.ponto.days[mKey][dia].confirmado = {};
  return state.ponto.days[mKey][dia];
}
const TEMPO_PADRAO = { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:'17:00' };
function tempoPadraoSaida(mKey, dia){
  const d = keyToDate(mKey); d.setDate(dia);
  return d.getDay()===5 ? '16:00' : '17:00';
}
function toggleDiaConcluido(dia){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  d.concluido = !d.concluido;
  renderPonto();
  persist();
  if(navigator.vibrate) navigator.vibrate(10);
}
function ajustarTempo(dia, campo, isRight){
  const mKey = pontoMonthKeyAtual();
  const d = getDia(mKey, dia);
  if(d.concluido) return;
  if(!d[campo]){
    d[campo] = campo==='saida' ? tempoPadraoSaida(mKey, dia) : TEMPO_PADRAO[campo];
  } else {
    let min = timeToMin(d[campo]) + (isRight ? 1 : -1);
    min = ((min % 1440) + 1440) % 1440;
    d[campo] = minToTime(min);
  }
  d.confirmado[campo] = true;
  renderPonto();
  persist();
  if(navigator.vibrate) navigator.vibrate(6);
}
let tempoPressTimer = null;
function tempoTapStart(e, dia, campo){
  if(e.cancelable) e.preventDefault();
  if(tempoPressTimer) clearTimeout(tempoPressTimer);
  tempoPressTimer = setTimeout(()=>{
    tempoPressTimer = null;
    const mKey = pontoMonthKeyAtual();
    const d = getDia(mKey, dia);
    if(d.concluido) return;
    d[campo] = null;
    d.confirmado[campo] = false;
    renderPonto();
    persist();
    if(navigator.vibrate) navigator.vibrate(20);
  }, 550);
}
function tempoTapEnd(e, dia, campo){
  if(e.cancelable) e.preventDefault();
  if(tempoPressTimer){
    clearTimeout(tempoPressTimer);
    tempoPressTimer = null;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
    const isRight = (clientX - rect.left) > rect.width/2;
    ajustarTempo(dia, campo, isRight);
  }
}
function tempoTapCancel(){
  if(tempoPressTimer){ clearTimeout(tempoPressTimer); tempoPressTimer = null; }
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
  state.ponto.days[mKey][dia] = { entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0, confirmado:{} };
  renderPonto();
  persist();
}
function dayTotalMinutes(d){
  const { entrada, almocoSaida, almocoVolta, saida } = d;
  let periodo = 0;
  if(entrada && almocoSaida && almocoVolta && saida){
    const manha = timeToMin(almocoSaida) - timeToMin(entrada);
    const tarde = timeToMin(saida) - timeToMin(almocoVolta);
    periodo = Math.max(0, manha) + Math.max(0, tarde);
  }else if(entrada && saida && !almocoSaida && !almocoVolta){
    periodo = Math.max(0, timeToMin(saida) - timeToMin(entrada));
  }else if(entrada && almocoSaida && !almocoVolta && !saida){
    periodo = Math.max(0, timeToMin(almocoSaida) - timeToMin(entrada));
  }else if(almocoVolta && saida && !entrada && !almocoSaida){
    periodo = Math.max(0, timeToMin(saida) - timeToMin(almocoVolta));
  }
  return periodo + (d.extra||0);
}

function renderPonto(){
  const mKey = pontoMonthKeyAtual();
  ensurePontoMonth(mKey);
  document.getElementById('pontoMesLabel').textContent = monthLabelLong(mKey);
  document.getElementById('pontoValorHora').value = state.ponto.valorHora ? state.ponto.valorHora.toFixed(2).replace('.',',') : '';

  const totalDias = daysInMonth(mKey);
  const lista = document.getElementById('pontoDiasLista');
  const hoje = new Date();
  const nowMin = hoje.getHours()*60 + hoje.getMinutes();
  let rows = '';
  for(let dia=1; dia<=totalDias; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const isWeekend = dateObj.getDay()===0 || dateObj.getDay()===6;
    const isHoje = dateObj.getFullYear()===hoje.getFullYear() && dateObj.getMonth()===hoje.getMonth() && dateObj.getDate()===hoje.getDate();
    const total = dayTotalMinutes(d);
    const extraVal = d.extra ? String(Math.floor(d.extra/60)).padStart(2,'0')+':'+String(d.extra%60).padStart(2,'0') : '';
    const travado = !!d.concluido;
    const tapAttrs = (campo)=> travado ? '' : `onpointerdown="tempoTapStart(event,${dia},'${campo}')" onpointerup="tempoTapEnd(event,${dia},'${campo}')" onpointercancel="tempoTapCancel()" onpointerleave="tempoTapCancel()" oncontextmenu="return false"`;
    const statusClasse = (campo)=>{
      if(d.confirmado && d.confirmado[campo]) return 'ph-confirmado';
      if(isHoje && d[campo] && nowMin > timeToMin(d[campo])) return 'ph-atrasado';
      return '';
    };
    rows += `<div class="ponto-dia-row ${isWeekend?'weekend':''} ${travado?'travado':''}">
      <div class="pd-head">
        <div class="pd-data">${String(dia).padStart(2,'0')} <small>${DIA_SEMANA[dateObj.getDay()]}</small></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="pd-total ${total===0?'zero':''}">${minToHoursLabel(total)}</div>
          <button class="btn-icon-sm ${travado?'concluido-ativo':''}" onclick="toggleDiaConcluido(${dia})" title="${travado?'Reabrir dia':'Marcar como concluído'}">${travado?ICON_CHECK:ICON_UNLOCK}</button>
          <button class="btn-icon-sm" onclick="zerarDia(${dia})" title="Não trabalhei" ${travado?'disabled':''}>${ICON_BAN}</button>
        </div>
      </div>
      <div class="ponto-horarios-grid">
        <div class="ph-item"><div class="ph-lbl">Entrada</div><div class="ph-tempo-tap ${statusClasse('entrada')}" ${tapAttrs('entrada')}>${d.entrada||'--:--'}</div></div>
        <div class="ph-item"><div class="ph-lbl">Almoço</div><div class="ph-tempo-tap ${statusClasse('almocoSaida')}" ${tapAttrs('almocoSaida')}>${d.almocoSaida||'--:--'}</div></div>
        <div class="ph-item"><div class="ph-lbl">Volta</div><div class="ph-tempo-tap ${statusClasse('almocoVolta')}" ${tapAttrs('almocoVolta')}>${d.almocoVolta||'--:--'}</div></div>
        <div class="ph-item"><div class="ph-lbl">Saída</div><div class="ph-tempo-tap ${statusClasse('saida')}" ${tapAttrs('saida')}>${d.saida||'--:--'}</div></div>
      </div>
      <div class="ponto-extra-row">
        <div class="ph-item"><div class="ph-lbl">Hora extra</div><input type="text" value="${extraVal}" placeholder="00:00" onchange="setExtra(${dia}, this.value)" ${travado?'disabled':''}></div>
      </div>
    </div>`;
  }
  lista.innerHTML = rows;
  renderPontoSummary();
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

/* ================= PONTO PJ: CONFIGURAÇÃO E EXPORTAÇÃO PDF ================= */
function openPontoConfigModal(){
  document.getElementById('pontoConfigNome').value = state.ponto.nomeUsuario || '';
  document.getElementById('modalPontoConfig').classList.add('active');
}
function salvarPontoConfig(){
  const nome = document.getElementById('pontoConfigNome').value.trim();
  state.ponto.nomeUsuario = nome;
  persist();
  closeModal('modalPontoConfig');
  showToast('Configuração salva');
}

let pontoExportTipo = 'mes';
let pontoExportSemanaIdx = 0;

function openPontoExportModal(){
  pontoExportTipo = 'mes';
  pontoExportSemanaIdx = 0;
  document.querySelectorAll('#pontoExportTipoChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val==='mes');
  });
  document.getElementById('pontoExportSemanaField').style.display = 'none';
  renderPontoExportSemanaChips();
  document.getElementById('modalPontoExport').classList.add('active');
}
function selecionarPontoExportTipo(val){
  pontoExportTipo = val;
  document.querySelectorAll('#pontoExportTipoChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val===val);
  });
  document.getElementById('pontoExportSemanaField').style.display = val==='semana' ? 'block' : 'none';
}
function pontoSemanasDoMes(mKey){
  const totalDias = daysInMonth(mKey);
  const semanas = [];
  for(let inicio=1; inicio<=totalDias; inicio+=7){
    const fim = Math.min(inicio+6, totalDias);
    semanas.push({ inicio, fim });
  }
  return semanas;
}
function renderPontoExportSemanaChips(){
  const mKey = pontoMonthKeyAtual();
  const semanas = pontoSemanasDoMes(mKey);
  const el = document.getElementById('pontoExportSemanaChips');
  el.innerHTML = semanas.map((s,i)=>
    `<button type="button" class="dif-chip${i===0?' active':''}" onclick="selecionarPontoExportSemana(${i})">${String(s.inicio).padStart(2,'0')}–${String(s.fim).padStart(2,'0')}</button>`
  ).join('');
}
function selecionarPontoExportSemana(idx){
  pontoExportSemanaIdx = idx;
  document.querySelectorAll('#pontoExportSemanaChips .dif-chip').forEach((el,i)=>{
    el.classList.toggle('active', i===idx);
  });
}

function gerarPdfPonto(){
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.');
    return;
  }
  const mKey = pontoMonthKeyAtual();
  const semanas = pontoSemanasDoMes(mKey);
  let diaIni = 1, diaFim = daysInMonth(mKey);
  let periodoLabel = monthLabelLong(mKey);
  if(pontoExportTipo === 'semana'){
    const s = semanas[pontoExportSemanaIdx] || semanas[0];
    diaIni = s.inicio; diaFim = s.fim;
    periodoLabel = `${monthLabelLong(mKey)} — dias ${String(diaIni).padStart(2,'0')} a ${String(diaFim).padStart(2,'0')}`;
  }

  const valorHora = state.ponto.valorHora || 0;
  const linhas = [];
  let totalMinPeriodo = 0;
  for(let dia=diaIni; dia<=diaFim; dia++){
    const d = getDia(mKey, dia);
    const dateObj = keyToDate(mKey); dateObj.setDate(dia);
    const totalMin = dayTotalMinutes(d);
    if(totalMin<=0 && !d.entrada) continue;
    totalMinPeriodo += totalMin;
    const horas = Math.floor(totalMin/60), minutos = totalMin%60;
    const valorDia = (totalMin/60) * valorHora;
    linhas.push([
      `${String(dia).padStart(2,'0')} (${DIA_SEMANA[dateObj.getDay()]})`,
      d.entrada || '--:--',
      d.almocoSaida || '--:--',
      d.almocoVolta || '--:--',
      d.saida || '--:--',
      `${String(horas).padStart(2,'0')}h${String(minutos).padStart(2,'0')}m`,
      fmtMoney(valorDia)
    ]);
  }

  if(linhas.length===0){
    showToast('Nenhum dia trabalhado nesse período');
    return;
  }

  const valorTotalPeriodo = (totalMinPeriodo/60) * valorHora;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const nome = state.ponto.nomeUsuario || '';
  const pageW = 595;
  const marginX = 40;

  /* ---- Cabeçalho ---- */
  const graphite = [37,41,46];
  doc.setFillColor(...graphite);
  doc.rect(0,0,pageW,86,'F');
  doc.setFillColor(255,255,255);
  doc.roundedRect(marginX,18,44,44,10,10,'F');
  doc.setDrawColor(...graphite);
  doc.setLineWidth(1.6);
  doc.circle(marginX+22,40,9,'S');
  doc.line(marginX+22,40,marginX+22,35);
  doc.line(marginX+22,40,marginX+26,42);

  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(15);
  doc.text('REGISTRO DE PONTO PJ', marginX+58, 36);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10.5);
  if(nome) doc.text(nome, marginX+58, 53);
  doc.setFontSize(9.5);
  doc.setTextColor(220,220,224);
  doc.text(periodoLabel, marginX+58, nome ? 68 : 53);

  /* ---- Cards de resumo ---- */
  const cardsY = 106;
  const cardH = 56;
  const gap = 12;
  const cardW = (pageW - marginX*2 - gap*2) / 3;
  const totalHorasLabel = minToHoursLabel(totalMinPeriodo);
  const cards = [
    { label:'TOTAL DE HORAS', value: totalHorasLabel, accent:graphite },
    { label:'VALOR TOTAL', value: fmtMoney(valorTotalPeriodo), accent:[28,157,91] },
    { label:'VALOR POR HORA', value: fmtMoney(valorHora), accent:[59,110,165] },
  ];
  cards.forEach((c,i)=>{
    const x = marginX + i*(cardW+gap);
    doc.setDrawColor(225,225,228);
    doc.setLineWidth(1);
    doc.roundedRect(x,cardsY,cardW,cardH,8,8,'S');
    doc.setFillColor(...c.accent);
    doc.roundedRect(x+12,cardsY+12,6,6,2,2,'F');
    doc.setTextColor(120,120,124);
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.text(c.label, x+24, cardsY+16);
    doc.setTextColor(30,30,32);
    doc.setFontSize(15);
    doc.text(c.value, x+12, cardsY+38);
  });

  /* ---- Tabela ---- */
  doc.autoTable({
    startY: cardsY + cardH + 24,
    head: [['Dia','Entrada','Almoço','Volta','Saída','Horas','Valor']],
    body: linhas,
    theme: 'grid',
    headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9 },
    bodyStyles: { fontSize:9, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[247,247,248] },
    styles: { lineColor:[230,230,232], lineWidth:0.5 },
    margin: { left:marginX, right:marginX }
  });

  /* ---- Rodapé ---- */
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setTextColor(140,140,144);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text(`Cálculo das horas considerando intervalo de almoço. Valor da hora: ${fmtMoney(valorHora)}.`, marginX, finalY);

  const fileName = `Ponto_${nome ? nome.replace(/\s+/g,'_')+'_' : ''}${mKey}${pontoExportTipo==='semana' ? '_semana'+(pontoExportSemanaIdx+1) : ''}.pdf`;

  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type:'application/pdf' });
  if(navigator.canShare && navigator.canShare({ files:[file] })){
    navigator.share({ files:[file], title:'Registro de Ponto PJ', text:periodoLabel }).catch(()=>{
      doc.save(fileName);
    });
  }else{
    doc.save(fileName);
  }
  closeModal('modalPontoExport');
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
let receitaFiltroAtivo = 'todas';
let receitaSearchQuery = '';
let receitaCategoriaSelecionada = null;
let receitaDificuldadeSelecionada = '';
let receitaCorSelecionada = '';
let receitaDetalheAtualId = null;
let receitaChecklistState = {};
const RECEITA_CORES = ['#2B3038','#E0342B','#DB8B18','#1C9D5B','#0EA5E9','#7B5FA6','#1A1A1A','#FFFFFF','#7A4A2B','#8A8F98'];

/* ---------- TELA PRINCIPAL ---------- */
function renderReceitas(){
  renderReceitaFilterChips();
  renderReceitaGrid();
}

function renderReceitaFilterChips(){
  const el = document.getElementById('receitaFilterChips');
  const cats = state.receitaCategorias || [];
  let html = '';
  html += chipReceitaFiltro('todas', 'Todas');
  html += chipReceitaFiltro('favoritos', 'Favoritos');
  html += chipReceitaFiltro('recentes', 'Recentes');
  cats.forEach(c=>{
    html += `<button class="filter-chip${receitaFiltroAtivo===c.id?' active':''}" onclick="selecionarReceitaFiltro('${c.id}')">${c.nome}<span class="filter-chip-del" onclick="event.stopPropagation();excluirReceitaCategoria('${c.id}')">×</span></button>`;
  });
  html += `<button class="filter-chip filter-chip-add" onclick="openReceitaCategoriaModal()">+ Categoria</button>`;
  el.innerHTML = html;
}
function chipReceitaFiltro(val, label){
  return `<button class="filter-chip${receitaFiltroAtivo===val?' active':''}" onclick="selecionarReceitaFiltro('${val}')">${label}</button>`;
}
function selecionarReceitaFiltro(val){
  receitaFiltroAtivo = val;
  renderReceitas();
}
function excluirReceitaCategoria(id){
  iosConfirm('Excluir esta categoria? As receitas dela ficarão sem categoria.').then(ok=>{
    if(!ok) return;
    state.receitaCategorias = (state.receitaCategorias||[]).filter(c=>c.id!==id);
    (state.receitas||[]).forEach(r=>{ if(r.categoriaId===id) r.categoriaId=null; });
    if(receitaFiltroAtivo===id) receitaFiltroAtivo='todas';
    persist();
    renderReceitas();
  });
}
function onReceitaSearchInput(val){
  receitaSearchQuery = val.trim().toLowerCase();
  document.getElementById('receitaSearchClear').style.display = receitaSearchQuery ? 'block' : 'none';
  renderReceitaGrid();
}
function limparReceitaSearch(){
  receitaSearchQuery = '';
  document.getElementById('receitaSearchInput').value = '';
  document.getElementById('receitaSearchClear').style.display = 'none';
  renderReceitaGrid();
}
function getReceitasFiltradas(){
  let list = state.receitas || [];
  if(receitaFiltroAtivo === 'favoritos'){
    list = list.filter(r=>r.favorito);
  } else if(receitaFiltroAtivo === 'recentes'){
    list = [...list].sort((a,b)=>(b.atualizadoEm||b.criadoEm||0)-(a.atualizadoEm||a.criadoEm||0)).slice(0,8);
  } else if(receitaFiltroAtivo !== 'todas'){
    list = list.filter(r=>r.categoriaId===receitaFiltroAtivo);
  }
  if(receitaSearchQuery){
    list = list.filter(r=>{
      const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
      const alvo = [r.nome, cat?cat.nome:'', ...(r.ingredientes||[]).map(i=>i.nome)].join(' ').toLowerCase();
      return alvo.includes(receitaSearchQuery);
    });
  }
  if(receitaFiltroAtivo !== 'recentes'){
    list = [...list].sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));
  }
  return list;
}

function renderReceitaGrid(){
  const el = document.getElementById('receitaGrid');
  const list = getReceitasFiltradas();
  if(!list.length){
    const msg = receitaSearchQuery ? 'Nenhuma receita encontrada.' : (state.receitas||[]).length ? 'Nenhuma receita nesse filtro.' : null;
    if(msg){
      el.innerHTML = `<div class="receita-empty"><div class="receita-empty-icon">${ICON_RECEITA_EMPTY}</div><div class="receita-empty-title">${msg}</div></div>`;
    }else{
      el.innerHTML = `<div class="receita-empty"><div class="receita-empty-icon">${ICON_RECEITA_EMPTY}</div><div class="receita-empty-title">Seu livro de receitas está vazio</div><div class="receita-empty-sub">Guarde suas receitas favoritas com fotos, ingredientes e modo de preparo.</div><button class="btn" onclick="openReceitaModal()">Criar primeira receita</button></div>`;
    }
    return;
  }
  el.innerHTML = list.map(r=>receitaCardHtml(r)).join('');
}

function receitaCardHtml(r){
  const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
  const dataTxt = (r.atualizadoEm||r.criadoEm) ? new Date(r.atualizadoEm||r.criadoEm).toLocaleDateString('pt-BR') : '';
  const foto = r.fotoUrl
    ? `<img src="${r.fotoUrl}" class="receita-card-img" loading="lazy">`
    : `<div class="receita-card-img receita-card-img-placeholder" style="${r.cor?`background:${r.cor}22`:''}">${ICON_PRATO}</div>`;
  return `<div class="receita-card" onclick="abrirReceitaDetalhe('${r.id}')">
    <div class="receita-card-media">
      ${foto}
      <button class="receita-card-fav${r.favorito?' active':''}" onclick="event.stopPropagation();toggleFavoritoReceita('${r.id}')" aria-label="Favoritar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${r.favorito?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      ${cat?`<span class="receita-card-cat">${cat.nome}</span>`:''}
    </div>
    <div class="receita-card-body">
      <div class="receita-card-nome">${r.nome}</div>
      <div class="receita-card-meta">
        ${r.tempo?`<span>${ICON_CLOCK_SM}${r.tempo}</span>`:''}
        ${r.porcoes?`<span>${ICON_PORCOES_SM}${r.porcoes} porções</span>`:''}
      </div>
      ${dataTxt?`<div class="receita-card-data">Editado em ${dataTxt}</div>`:''}
    </div>
    <div class="receita-card-menu-wrap" onclick="event.stopPropagation()">
      <button class="receita-card-menu-btn" onclick="toggleReceitaCardMenu('${r.id}', event)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="19" r="1.1"/></svg></button>
      <div class="receita-card-menu" id="receitaCardMenu-${r.id}" style="display:none">
        <button onclick="openReceitaModal('${r.id}')">${ICON_EDIT} Editar</button>
        <button onclick="duplicarReceita('${r.id}')">${ICON_DUPLICATE_SM} Duplicar</button>
        <button onclick="excluirReceita('${r.id}')" style="color:var(--danger)">${ICON_TRASH} Excluir</button>
      </div>
    </div>
  </div>`;
}

function toggleReceitaCardMenu(id, event){
  event.stopPropagation();
  document.querySelectorAll('.receita-card-menu').forEach(m=>{ if(m.id !== 'receitaCardMenu-'+id) m.style.display='none'; });
  const menu = document.getElementById('receitaCardMenu-'+id);
  menu.style.display = menu.style.display==='block' ? 'none' : 'block';
}
document.addEventListener('click', ()=>{ document.querySelectorAll('.receita-card-menu').forEach(m=>m.style.display='none'); });

function toggleFavoritoReceita(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  r.favorito = !r.favorito;
  vibrar();
  persist();
  renderReceitaGrid();
  if(receitaDetalheAtualId === id) renderReceitaDetalheConteudo(r);
}
function vibrar(ms){
  if(navigator.vibrate){ try{ navigator.vibrate(ms||12); }catch(e){} }
}

function duplicarReceita(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  const copia = JSON.parse(JSON.stringify(r));
  copia.id = 'rc'+Date.now();
  copia.nome = r.nome + ' (cópia)';
  copia.favorito = false;
  copia.criadoEm = Date.now();
  copia.atualizadoEm = Date.now();
  state.receitas.push(copia);
  persist();
  renderReceitas();
  showToast('Receita duplicada');
}
function excluirReceita(id){
  iosConfirm('Excluir esta receita?').then(ok=>{
    if(!ok) return;
    state.receitas = (state.receitas||[]).filter(r=>r.id!==id);
    persist();
    renderReceitas();
    showToast('Receita removida');
  });
}

/* ---------- DETALHES (fullpage) ---------- */
function abrirReceitaDetalhe(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  receitaDetalheAtualId = id;
  renderReceitaDetalheConteudo(r);
  document.getElementById('receitaDetalheHeaderTitle').textContent = r.nome;
  document.getElementById('pageReceitaDetalhe').classList.add('active');
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
}
function closeReceitaDetalhe(){
  document.getElementById('pageReceitaDetalhe').classList.remove('active');
  receitaDetalheAtualId = null;
}
function toggleReceitaDetalheMenu(){
  const el = document.getElementById('receitaDetalheMenuDropdown');
  el.style.display = el.style.display==='block' ? 'none' : 'block';
}
function renderReceitaDetalheConteudo(r){
  const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
  const dificuldadeLbl = {facil:'Fácil',media:'Média',dificil:'Difícil'}[r.dificuldade] || '';
  const heroStyle = r.fotoUrl ? `background-image:url('${r.fotoUrl}')` : `background:${r.cor||'var(--primary)'}`;

  const ingredientesHtml = (r.ingredientes && r.ingredientes.length)
    ? r.ingredientes.map((ing,i)=>{
        const checked = !!receitaChecklistState[r.id+':'+i];
        const txt = [ing.quantidade, ing.unidade, ing.nome].filter(Boolean).join(' ');
        return `<div class="receita-check-item${checked?' checked':''}" onclick="toggleIngredienteCheck('${r.id}',${i})">
          <div class="receita-check-box">${checked?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          <span>${txt}</span>
        </div>`;
      }).join('')
    : '<div class="receita-detalhe-vazio">Nenhum ingrediente adicionado.</div>';

  const passosHtml = (r.passos && r.passos.filter(p=>p.trim()).length)
    ? r.passos.filter(p=>p.trim()).map((p,i)=>`<div class="receita-passo-item"><div class="receita-passo-num">${i+1}</div><div class="receita-passo-txt">${p}</div></div>`).join('')
    : '<div class="receita-detalhe-vazio">Nenhum passo adicionado.</div>';

  document.getElementById('receitaDetalheConteudo').innerHTML = `
    <div class="receita-hero" style="${heroStyle}">
      <div class="receita-hero-gradient"></div>
      <button class="receita-hero-fav${r.favorito?' active':''}" onclick="toggleFavoritoReceita('${r.id}')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="${r.favorito?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <div class="receita-hero-info">
        ${cat?`<span class="receita-hero-cat">${cat.nome}</span>`:''}
        <div class="receita-hero-nome">${r.nome}</div>
        <div class="receita-hero-meta">
          ${r.tempo?`<span>${ICON_CLOCK_SM}${r.tempo}</span>`:''}
          ${r.porcoes?`<span>${ICON_PORCOES_SM}${r.porcoes} porções</span>`:''}
          ${dificuldadeLbl?`<span class="dif-badge dif-${r.dificuldade}">${dificuldadeLbl}</span>`:''}
        </div>
      </div>
    </div>
    <div class="receita-detalhe-body">
      <div class="receita-view-section-title">Ingredientes</div>
      <div class="receita-check-lista">${ingredientesHtml}</div>

      <div class="receita-view-section-title">Modo de Preparo</div>
      <div class="receita-passos-view">${passosHtml}</div>

      ${r.observacoes ? `<div class="receita-view-section-title">Observações</div><div class="receita-obs-view">${r.observacoes}</div>` : ''}
    </div>
  `;
}
function toggleIngredienteCheck(recId, idx){
  const key = recId+':'+idx;
  receitaChecklistState[key] = !receitaChecklistState[key];
  vibrar(8);
  const r = (state.receitas||[]).find(r=>r.id===recId);
  if(r) renderReceitaDetalheConteudo(r);
}
function compartilharReceitaAtual(){
  const r = (state.receitas||[]).find(r=>r.id===receitaDetalheAtualId);
  if(!r) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const ingTxt = (r.ingredientes||[]).map(i=>'• '+[i.quantidade,i.unidade,i.nome].filter(Boolean).join(' ')).join('\n');
  const passosTxt = (r.passos||[]).filter(p=>p.trim()).map((p,i)=>(i+1)+'. '+p).join('\n');
  const texto = `${r.nome}\n\nIngredientes:\n${ingTxt}\n\nModo de Preparo:\n${passosTxt}`;
  if(navigator.share){
    navigator.share({ title: r.nome, text: texto }).catch(()=>{});
  }else if(navigator.clipboard){
    navigator.clipboard.writeText(texto).then(()=>showToast('Receita copiada'));
  }else{
    showToast('Compartilhamento não suportado neste dispositivo');
  }
}
function editarReceitaAtual(){
  if(!receitaDetalheAtualId) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const id = receitaDetalheAtualId;
  closeReceitaDetalhe();
  openReceitaModal(id);
}
function excluirReceitaAtual(){
  if(!receitaDetalheAtualId) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const idAlvo = receitaDetalheAtualId;
  iosConfirm('Excluir esta receita?').then(ok=>{
    if(!ok) return;
    state.receitas = (state.receitas||[]).filter(r=>r.id!==idAlvo);
    persist();
    closeReceitaDetalhe();
    renderReceitas();
    showToast('Receita removida');
  });
}

/* ---------- CATEGORIA (seletor customizado) ---------- */
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

/* ---------- FOTO (com compressão) ---------- */
function renderReceitaFotoPreview(){
  const el = document.getElementById('receitaFotoPreview');
  el.innerHTML = receitaFotoUrlAtual
    ? `<img src="${receitaFotoUrlAtual}">`
    : `<div class="receita-form-foto-placeholder">${ICON_PRATO}<span>Adicionar foto</span></div>`;
}
function onReceitaFotoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  comprimirImagem(file, 900, 0.8).then(dataUrl=>{
    receitaFotoUrlAtual = dataUrl;
    renderReceitaFotoPreview();
  });
  event.target.value = '';
}
function removerReceitaFoto(){
  receitaFotoUrlAtual = null;
  renderReceitaFotoPreview();
}
function comprimirImagem(file, maxDim, qualidade){
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > maxDim || h > maxDim){
          if(w > h){ h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = ()=> resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Seletor de Unidade genérico (substitui <select> nativo) ---------- */
let unidadePickerTargetEl = null;
function abrirUnidadePicker(triggerEl){
  unidadePickerTargetEl = triggerEl;
  const atual = triggerEl.dataset.valor || '';
  let opts = UNIDADES_MEDIDA.slice();
  if(atual && !opts.includes(atual)) opts = [atual, ...opts];
  document.getElementById('unidadePickerLista').innerHTML = opts.map(u=>
    `<div class="unidade-picker-opt${atual===u?' selected':''}" onclick="selecionarUnidadePicker('${u}')">${u}${atual===u?ICON_CHECK:''}</div>`
  ).join('');
  document.getElementById('modalUnidadePicker').classList.add('active');
}
function selecionarUnidadePicker(u){
  if(unidadePickerTargetEl){
    unidadePickerTargetEl.dataset.valor = u;
    unidadePickerTargetEl.querySelector('.unidade-picker-valor').textContent = u;
  }
  unidadePickerTargetEl = null;
  closeModal('modalUnidadePicker');
}

/* ---------- INGREDIENTES (quantidade + unidade + nome) ---------- */
const UNIDADES_MEDIDA = ['g','ml','xícaras','unidades'];
function unidadeSelectHtml(className, valorAtual){
  const valor = valorAtual || '';
  return `<div class="unidade-picker ${className}" data-valor="${valor}" onclick="abrirUnidadePicker(this)">
    <span class="unidade-picker-valor">${valor || 'Unid.'}</span>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </div>`;
}
function ingredienteRowHtml(ing, i){
  const q = (ing && ing.quantidade || '').toString().replace(/"/g,'&quot;');
  const u = (ing && ing.unidade || '').toString();
  const n = (ing && ing.nome || '').toString().replace(/"/g,'&quot;');
  return `<div class="receita-ing-row">
    <div class="receita-ing-num">${i+1}</div>
    <input type="text" class="receita-ing-qtd" placeholder="Qtd" value="${q}">
    ${unidadeSelectHtml('receita-ing-un', u)}
    <input type="text" class="receita-ing-nome" placeholder="Ingrediente" value="${n}">
    <button type="button" class="btn-icon-sm" onclick="removerIngredienteCampo(this)">${ICON_TRASH}</button>
  </div>`;
}
function renderIngredientesCampos(valores){
  const lista = document.getElementById('receitaIngredientesLista');
  const vals = (valores && valores.length) ? valores : [{},{},{}];
  lista.innerHTML = vals.map((v,i)=>ingredienteRowHtml(v,i)).join('');
}
function addIngredienteCampo(){
  const lista = document.getElementById('receitaIngredientesLista');
  const n = lista.children.length;
  const wrap = document.createElement('div');
  wrap.innerHTML = ingredienteRowHtml({}, n);
  const row = wrap.firstElementChild;
  lista.appendChild(row);
  row.querySelector('.receita-ing-qtd').focus();
}
function removerIngredienteCampo(btn){
  const row = btn.closest('.receita-ing-row');
  row.remove();
  document.querySelectorAll('#receitaIngredientesLista .receita-ing-num').forEach((el,i)=>{ el.textContent = i+1; });
}
function coletarIngredientes(){
  return Array.from(document.querySelectorAll('#receitaIngredientesLista .receita-ing-row')).map(row=>({
    quantidade: row.querySelector('.receita-ing-qtd').value.trim(),
    unidade: (row.querySelector('.receita-ing-un').dataset.valor||'').trim(),
    nome: row.querySelector('.receita-ing-nome').value.trim()
  })).filter(i=>i.nome || i.quantidade || i.unidade);
}

/* ---------- MODO DE PREPARO (passos) ---------- */
function passoRowHtml(txt, i){
  const v = (txt||'').replace(/"/g,'&quot;');
  return `<div class="receita-passo-row">
    <div class="receita-passo-num">${i+1}</div>
    <textarea class="receita-passo-input" rows="2" placeholder="Descreva o passo ${i+1}...">${txt||''}</textarea>
    <button type="button" class="btn-icon-sm" onclick="removerPassoCampo(this)">${ICON_TRASH}</button>
  </div>`;
}
function renderPassosCampos(valores){
  const lista = document.getElementById('receitaPassosLista');
  const vals = (valores && valores.length) ? valores : ['', ''];
  lista.innerHTML = vals.map((v,i)=>passoRowHtml(v,i)).join('');
}
function addPassoCampo(){
  const lista = document.getElementById('receitaPassosLista');
  const n = lista.children.length;
  const wrap = document.createElement('div');
  wrap.innerHTML = passoRowHtml('', n);
  const row = wrap.firstElementChild;
  lista.appendChild(row);
  row.querySelector('.receita-passo-input').focus();
}
function removerPassoCampo(btn){
  const row = btn.closest('.receita-passo-row');
  row.remove();
  document.querySelectorAll('#receitaPassosLista .receita-passo-num').forEach((el,i)=>{ el.textContent = i+1; });
}
function coletarPassos(){
  return Array.from(document.querySelectorAll('#receitaPassosLista .receita-passo-input'))
    .map(t=>t.value.trim());
}

/* ---------- ARRASTAR PRA REORDENAR (ingredientes e passos) ---------- */
function attachDragReorder(listId, rowSelector, handleSelector, numSelector){
  const list = document.getElementById(listId);
  if(!list || list.dataset.reorderAttached) return;
  list.dataset.reorderAttached = '1';
  let dragEl = null;

  list.addEventListener('pointerdown', (e)=>{
    const handle = e.target.closest(handleSelector);
    if(!handle) return;
    const row = handle.closest(rowSelector);
    if(!row) return;
    e.preventDefault();
    dragEl = row;
    row.classList.add('dragging-row');
    try{ handle.setPointerCapture(e.pointerId); }catch(err){}

    function onMove(ev){
      if(!dragEl) return;
      const rows = Array.from(list.querySelectorAll(rowSelector));
      const y = ev.clientY;
      let placed = false;
      for(const r of rows){
        if(r===dragEl) continue;
        const rect = r.getBoundingClientRect();
        const mid = rect.top + rect.height/2;
        if(y < mid){
          if(r.previousElementSibling !== dragEl) list.insertBefore(dragEl, r);
          placed = true;
          break;
        }
      }
      if(!placed && list.lastElementChild !== dragEl) list.appendChild(dragEl);
    }
    function onUp(){
      if(dragEl) dragEl.classList.remove('dragging-row');
      dragEl = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      list.querySelectorAll(rowSelector).forEach((row,i)=>{
        const numEl = row.querySelector(numSelector);
        if(numEl) numEl.textContent = i+1;
      });
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}
attachDragReorder('receitaIngredientesLista', '.receita-ing-row', '.receita-ing-num', '.receita-ing-num');
attachDragReorder('receitaPassosLista', '.receita-passo-row', '.receita-passo-num', '.receita-passo-num');

/* ---------- DIFICULDADE E COR ---------- */
function selecionarDificuldade(val){
  receitaDificuldadeSelecionada = receitaDificuldadeSelecionada===val ? '' : val;
  document.getElementById('receitaDificuldade').value = receitaDificuldadeSelecionada;
  document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val === receitaDificuldadeSelecionada);
  });
}
function renderCorChips(){
  const el = document.getElementById('receitaCorChips');
  el.innerHTML = RECEITA_CORES.map(c=>`<button type="button" class="cor-chip${receitaCorSelecionada===c?' selected':''}" style="background:${c}" onclick="selecionarCor('${c}')"></button>`).join('')
    + `<button type="button" class="cor-chip cor-chip-none${receitaCorSelecionada===''?' selected':''}" onclick="selecionarCor('')">✕</button>`;
}
function selecionarCor(val){
  receitaCorSelecionada = val;
  document.getElementById('receitaCor').value = val;
  renderCorChips();
}
function toggleReceitaFormFavorito(){
  const btn = document.getElementById('receitaFormFavBtn');
  const ativo = btn.classList.toggle('active');
  btn.querySelector('svg').setAttribute('fill', ativo ? 'currentColor' : 'none');
}

/* ---------- FORMULÁRIO (fullpage assistente) ---------- */
function openReceitaModal(id){
  document.getElementById('receitaId').value = id || '';
  document.getElementById('receitaFormTitulo').textContent = id ? 'Editar Receita' : 'Nova Receita';
  document.getElementById('receitaCatPickerPanel').style.display = 'none';
  document.getElementById('receitaCatNovaInput').value = '';
  const favBtn = document.getElementById('receitaFormFavBtn');

  if(id){
    const r = (state.receitas||[]).find(r=>r.id===id);
    if(r){
      document.getElementById('receitaNome').value = r.nome;
      document.getElementById('receitaTempo').value = r.tempo || '';
      document.getElementById('receitaPorcoes').value = r.porcoes || '';
      document.getElementById('receitaObservacoes').value = r.observacoes || '';
      receitaFotoUrlAtual = r.fotoUrl || null;
      selecionarReceitaCategoria(r.categoriaId || null);
      renderIngredientesCampos(r.ingredientes || []);
      renderPassosCampos(r.passos || []);
      receitaDificuldadeSelecionada = r.dificuldade || '';
      document.getElementById('receitaDificuldade').value = receitaDificuldadeSelecionada;
      document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>{
        el.classList.toggle('active', el.dataset.val === receitaDificuldadeSelecionada);
      });
      receitaCorSelecionada = r.cor || '';
      favBtn.classList.toggle('active', !!r.favorito);
      favBtn.querySelector('svg').setAttribute('fill', r.favorito ? 'currentColor' : 'none');
    }
  }else{
    document.getElementById('receitaNome').value = '';
    document.getElementById('receitaTempo').value = '';
    document.getElementById('receitaPorcoes').value = '';
    document.getElementById('receitaObservacoes').value = '';
    receitaFotoUrlAtual = null;
    selecionarReceitaCategoria(null);
    renderIngredientesCampos([]);
    renderPassosCampos([]);
    receitaDificuldadeSelecionada = '';
    document.getElementById('receitaDificuldade').value = '';
    document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>el.classList.remove('active'));
    receitaCorSelecionada = '';
    favBtn.classList.remove('active');
    favBtn.querySelector('svg').setAttribute('fill', 'none');
  }
  renderReceitaFotoPreview();
  renderCorChips();
  document.getElementById('pageReceitaForm').classList.add('active');
}
function closeReceitaForm(){
  document.getElementById('pageReceitaForm').classList.remove('active');
}
function salvarReceita(){
  const id = document.getElementById('receitaId').value;
  const nome = document.getElementById('receitaNome').value.trim();
  const categoriaId = document.getElementById('receitaCategoriaSelect').value || null;
  const tempo = document.getElementById('receitaTempo').value.trim();
  const porcoes = document.getElementById('receitaPorcoes').value.trim();
  const dificuldade = document.getElementById('receitaDificuldade').value || '';
  const cor = document.getElementById('receitaCor').value || '';
  const observacoes = document.getElementById('receitaObservacoes').value.trim();
  const fotoUrl = receitaFotoUrlAtual;
  const ingredientes = coletarIngredientes();
  const passos = coletarPassos();
  const favorito = document.getElementById('receitaFormFavBtn').classList.contains('active');
  if(!nome){ showToast('Digite o nome da receita'); return; }
  if(!state.receitas) state.receitas = [];
  if(id){
    const r = state.receitas.find(r=>r.id===id);
    if(r) Object.assign(r, { nome, categoriaId, tempo, porcoes, dificuldade, cor, observacoes, fotoUrl, ingredientes, passos, favorito, atualizadoEm: Date.now() });
  }else{
    state.receitas.push({ id:'rc'+Date.now(), nome, categoriaId, tempo, porcoes, dificuldade, cor, observacoes, fotoUrl, ingredientes, passos, favorito, criadoEm: Date.now(), atualizadoEm: Date.now() });
  }
  persist();
  closeReceitaForm();
  renderReceitas();
  showToast('Receita salva');
}
/* ================= SEMANA (Bullet Journal) ================= */
const DIAS_SEMANA_NOMES = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const PERIODOS_SEMANA = [
  { key:'manha', label:'Manhã', icon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>' },
  { key:'tarde', label:'Tarde', icon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1"/><path d="M18.4 5.6l-.7.7"/><path d="M21 12h-1"/><path d="M4 12H3"/><path d="M6.3 6.3l-.7-.7"/><path d="M17 20H7a5 5 0 0 1 10 0Z"/></svg>' },
  { key:'noite', label:'Noite', icon:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>' }
];

function fmtDateKeyLocal(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function getSemanaDates(offset){
  const now = new Date();
  now.setHours(0,0,0,0);
  const dow = now.getDay();
  const diffToMonday = (dow===0) ? -6 : (1-dow);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset*7);
  const dates = [];
  for(let i=0;i<7;i++){
    const d = new Date(monday);
    d.setDate(monday.getDate()+i);
    dates.push(d);
  }
  return dates;
}
function navSemana(delta){
  state.semanaOffset = (state.semanaOffset||0) + delta;
  persist();
  renderSemana();
}
function renderSemana(){
  const dates = getSemanaDates(state.semanaOffset||0);
  const hojeKey = fmtDateKeyLocal(new Date());
  const primeiro = dates[0], ultimo = dates[6];
  const lbl = primeiro.getMonth()===ultimo.getMonth()
    ? `${primeiro.getDate()} – ${ultimo.getDate()} ${MES_NOMES[primeiro.getMonth()]} ${ultimo.getFullYear()}`
    : `${primeiro.getDate()} ${MES_NOMES[primeiro.getMonth()]} – ${ultimo.getDate()} ${MES_NOMES[ultimo.getMonth()]} ${ultimo.getFullYear()}`;
  document.getElementById('semanaLabel').textContent = lbl;

  const html = dates.map((d,i)=>{
    const key = fmtDateKeyLocal(d);
    const isHoje = key === hojeKey;
    const dia = state.semanaAgenda[key] || {};
    const periodosHtml = PERIODOS_SEMANA.map(p=>{
      const itens = dia[p.key] || [];
      const itensHtml = itens.length
        ? itens.map(it=>`
          <div class="semana-item${it.feito?' feito':''}">
            <div class="semana-item-check" onclick="toggleSemanaItem('${key}','${p.key}','${it.id}')">${it.feito?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
            <span onclick="toggleSemanaItem('${key}','${p.key}','${it.id}')">${it.texto}</span>
            <button class="semana-item-del" onclick="excluirSemanaItem('${key}','${p.key}','${it.id}')">×</button>
          </div>`).join('')
        : '';
      return `<div class="semana-periodo">
        <div class="semana-periodo-head">
          <span class="semana-periodo-lbl">${p.icon}${p.label}</span>
          <button class="semana-periodo-add" onclick="openSemanaItemModal('${key}','${p.key}')">+</button>
        </div>
        <div class="semana-periodo-itens">${itensHtml}</div>
      </div>`;
    }).join('');
    return `<div class="semana-dia${isHoje?' hoje':''}">
      <div class="semana-dia-head"><span class="semana-dia-nome">${DIAS_SEMANA_NOMES[i]}</span><span class="semana-dia-num">${d.getDate()}</span></div>
      ${periodosHtml}
    </div>`;
  }).join('');
  document.getElementById('semanaDiasLista').innerHTML = html;
}
function openSemanaItemModal(diaKey, periodo, itemId){
  document.getElementById('semanaItemDiaKey').value = diaKey;
  document.getElementById('semanaItemPeriodo').value = periodo;
  document.getElementById('semanaItemId').value = itemId || '';
  document.getElementById('semanaItemTexto').value = '';
  if(itemId){
    const dia = state.semanaAgenda[diaKey] || {};
    const item = (dia[periodo]||[]).find(i=>i.id===itemId);
    if(item) document.getElementById('semanaItemTexto').value = item.texto;
  }
  document.getElementById('modalSemanaItem').classList.add('active');
}
function salvarSemanaItem(){
  const diaKey = document.getElementById('semanaItemDiaKey').value;
  const periodo = document.getElementById('semanaItemPeriodo').value;
  const itemId = document.getElementById('semanaItemId').value;
  const texto = document.getElementById('semanaItemTexto').value.trim();
  if(!texto){ showToast('Digite uma descrição'); return; }
  if(!state.semanaAgenda[diaKey]) state.semanaAgenda[diaKey] = {};
  if(!state.semanaAgenda[diaKey][periodo]) state.semanaAgenda[diaKey][periodo] = [];
  const lista = state.semanaAgenda[diaKey][periodo];
  if(itemId){
    const item = lista.find(i=>i.id===itemId);
    if(item) item.texto = texto;
  }else{
    lista.push({ id:'sm'+Date.now(), texto, feito:false });
  }
  persist();
  closeModal('modalSemanaItem');
  renderSemana();
}
function toggleSemanaItem(diaKey, periodo, itemId){
  const item = (state.semanaAgenda[diaKey]?.[periodo]||[]).find(i=>i.id===itemId);
  if(!item) return;
  item.feito = !item.feito;
  persist();
  renderSemana();
}
function excluirSemanaItem(diaKey, periodo, itemId){
  if(!state.semanaAgenda[diaKey] || !state.semanaAgenda[diaKey][periodo]) return;
  state.semanaAgenda[diaKey][periodo] = state.semanaAgenda[diaKey][periodo].filter(i=>i.id!==itemId);
  persist();
  renderSemana();
}

/* ================= LOUVOR ================= */
const LOUVOR_CATEGORIAS = ['Louvor','Harpa Cristã','Corinhos'];
let louvorFiltroAtivo = 'Todas';
let louvorSearchTerm = '';
let louvorAtualId = null;
let lvSlideIndex = 0;

function getLouvorAtual(){ return state.louvores.find(l=>l.id===louvorAtualId); }

function renderLouvor(){
  renderLouvorFilterChips();
  renderLouvorLista();
}
function renderLouvorFilterChips(){
  const el = document.getElementById('louvorFilterChips');
  const chips = ['Todas', ...LOUVOR_CATEGORIAS];
  el.innerHTML = chips.map(c=>
    `<button class="filter-chip${louvorFiltroAtivo===c?' active':''}" onclick="setLouvorFiltro('${c}')">${c}</button>`
  ).join('');
}
function setLouvorFiltro(c){
  louvorFiltroAtivo = c;
  renderLouvorFilterChips();
  renderLouvorLista();
}
function onLouvorSearchInput(v){
  louvorSearchTerm = v.trim().toLowerCase();
  document.getElementById('louvorSearchClear').style.display = v ? 'block' : 'none';
  renderLouvorLista();
}
function limparLouvorSearch(){
  louvorSearchTerm = '';
  document.getElementById('louvorSearchInput').value = '';
  document.getElementById('louvorSearchClear').style.display = 'none';
  renderLouvorLista();
}
function renderLouvorLista(){
  const el = document.getElementById('louvorLista');
  let items = state.louvores.slice();
  if(louvorFiltroAtivo !== 'Todas') items = items.filter(l=>l.categoria===louvorFiltroAtivo);
  if(louvorSearchTerm){
    items = items.filter(l=>
      (l.titulo||'').toLowerCase().includes(louvorSearchTerm) ||
      (l.artista||'').toLowerCase().includes(louvorSearchTerm)
    );
  }
  items.sort((a,b)=> (a.titulo||'').localeCompare(b.titulo||''));
  if(items.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Nenhum louvor encontrado</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  el.innerHTML = items.map(l=>{
    ensureLouvorConfig(l);
    const tomAtual = lvTomAtual(l);
    return `<div class="lv-card" onclick="abrirLouvorDetalhe('${l.id}')">
      <div class="lv-card-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
      <div class="lv-card-info">
        <div class="lv-card-titulo">${l.titulo||'Sem título'}</div>
        <div class="lv-card-meta">${l.artista||'Artista desconhecido'} · ${l.categoria||'Louvor'}</div>
      </div>
      ${tomAtual?`<div class="lv-card-tom">${tomAtual}</div>`:''}
    </div>`;
  }).join('');
}

/* ---------- Novo louvor ---------- */
function openLouvorForm(){
  document.getElementById('lvNovoTitulo').value = '';
  document.getElementById('lvNovoArtista').value = '';
  window.lvNovoCategoriaSelecionada = 'Louvor';
  renderLvNovoCategoriaChips();
  document.getElementById('pageLouvorForm').classList.add('active');
}
function closeLouvorForm(){
  document.getElementById('pageLouvorForm').classList.remove('active');
}
function renderLvNovoCategoriaChips(){
  document.getElementById('lvNovoCategoriaChips').innerHTML = LOUVOR_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${window.lvNovoCategoriaSelecionada===c?' active':''}" onclick="selecionarLvNovaCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarLvNovaCategoria(c){
  window.lvNovoCategoriaSelecionada = c;
  renderLvNovoCategoriaChips();
}
function criarLouvor(){
  const titulo = document.getElementById('lvNovoTitulo').value.trim();
  if(!titulo){ document.getElementById('lvNovoTitulo').focus(); return; }
  const id = 'lv_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const novo = {
    id,
    titulo,
    artista: document.getElementById('lvNovoArtista').value.trim(),
    categoria: window.lvNovoCategoriaSelecionada || 'Louvor',
    tom: '',
    transpose: 0,
    colunas: 2,
    conteudo: '',
    criadoEm: Date.now()
  };
  state.louvores.push(novo);
  persist();
  closeLouvorForm();
  renderLouvor();
  abrirLouvorDetalhe(id);
}

/* ---------- Detalhe / Edição ---------- */
function abrirLouvorDetalhe(id){
  louvorAtualId = id;
  const l = getLouvorAtual();
  if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  document.getElementById('lvTitulo').value = l.titulo || '';
  document.getElementById('lvArtista').value = l.artista || '';
  document.getElementById('lvConteudo').value = l.conteudo || '';
  renderLvCategoriaChips();
  atualizarLvTomBox();
  switchLouvorSubtab('edicao');
  document.getElementById('pageLouvorDetalhe').classList.add('active');
}
function closeLouvorDetalhe(){
  document.getElementById('pageLouvorDetalhe').classList.remove('active');
  louvorAtualId = null;
  renderLouvor();
}
function renderLvCategoriaChips(){
  const l = getLouvorAtual(); if(!l) return;
  document.getElementById('lvCategoriaChips').innerHTML = LOUVOR_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${l.categoria===c?' active':''}" onclick="selecionarLvCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarLvCategoria(c){
  const l = getLouvorAtual(); if(!l) return;
  l.categoria = c;
  renderLvCategoriaChips();
  persist();
}
function salvarLouvorCampo(){
  const l = getLouvorAtual(); if(!l) return;
  l.titulo = document.getElementById('lvTitulo').value;
  l.artista = document.getElementById('lvArtista').value;
  l.conteudo = document.getElementById('lvConteudo').value;
  document.getElementById('louvorDetalheHeaderTitle').textContent = l.titulo || 'Sem título';
  persist();
}
function excluirLouvorAtual(){
  const l = getLouvorAtual(); if(!l) return;
  iosConfirm(`Excluir "${l.titulo||'este louvor'}"?`).then(ok=>{
    if(!ok) return;
    state.louvores = state.louvores.filter(x=>x.id!==l.id);
    persist();
    closeLouvorDetalhe();
  });
}

function switchLouvorSubtab(tab){
  document.querySelectorAll('.lv-subtab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  document.querySelectorAll('.lv-panel').forEach(el=>el.classList.remove('active'));
  if(tab==='edicao') document.getElementById('lvPanelEdicao').classList.add('active');
  if(tab==='pdf'){
    document.getElementById('lvPanelPdf').classList.add('active');
    renderLouvorPdfPreview();
  }
  if(tab==='slides'){
    document.getElementById('lvPanelSlides').classList.add('active');
    lvSlideIndex = 0;
    renderLouvorSlidePreview();
  }
}

/* ---------- Configurações padrão (PDF e Slides) ---------- */
function ensureLouvorConfig(l){
  if(!l.colunas) l.colunas = 2;
  if(l.pdfTamanhoTexto === undefined) l.pdfTamanhoTexto = 11;
  if(l.pdfTamanhoTitulo === undefined) l.pdfTamanhoTitulo = 17;
  if(l.pdfOrientacao === undefined) l.pdfOrientacao = 'retrato';
  if(l.pdfAlturaLinha === undefined) l.pdfAlturaLinha = 1.5;
  if(l.pdfEspacamento === undefined) l.pdfEspacamento = 0;
  if(l.pdfMargem === undefined) l.pdfMargem = 40;
  if(l.slideTituloTamanho === undefined) l.slideTituloTamanho = 44;
  if(l.slideTituloAlinhamento === undefined) l.slideTituloAlinhamento = 'center';
  if(l.slideTextoTamanho === undefined) l.slideTextoTamanho = 32;
  if(l.slideTextoAlinhamento === undefined) l.slideTextoAlinhamento = 'center';
  if(l.slideAlturaLinha === undefined) l.slideAlturaLinha = 1.4;
  if(l.slideEspacamento === undefined) l.slideEspacamento = 0;
  if(l.transpose === undefined) l.transpose = 0;
  if(l.tomOriginal === undefined){
    let base = (l.tom||'').trim();
    let isMinor = false;
    if(/m$/i.test(base) && !/maj$/i.test(base)){ isMinor = true; base = base.slice(0,-1); }
    const m = base.match(/^([A-G])(#|b)?/);
    l.tomOriginal = m ? (m[1]+(m[2]||'')) : '';
    l.tomModoMenor = isMinor;
  }
  if(l.tomModoMenor === undefined) l.tomModoMenor = false;
}
function lvTomAtual(l){
  if(!l.tomOriginal) return '';
  const rootAtual = lvShiftNote(l.tomOriginal, l.transpose||0) || l.tomOriginal;
  if(l.tomModoMenor){
    const idx = LV_CHROMATIC.indexOf(rootAtual);
    const relIdx = idx===-1 ? null : (idx+9)%12;
    return (relIdx!==null ? LV_CHROMATIC[relIdx] : rootAtual) + 'm';
  }
  return rootAtual;
}
function atualizarLvTomBox(){
  const l = getLouvorAtual(); if(!l) return;
  document.getElementById('lvTomBoxValor').textContent = lvTomAtual(l) || '—';
}

/* ---------- Seletor de Tom (grid cromático + relativo menor no duplo toque) ---------- */
const LV_TOM_GRID = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B'];
function lvNotasEquivalentes(a,b){
  if(!a || !b) return false;
  let ia = LV_CHROMATIC.indexOf(a); if(ia===-1) ia = LV_FLAT.indexOf(a);
  let ib = LV_CHROMATIC.indexOf(b); if(ib===-1) ib = LV_FLAT.indexOf(b);
  return ia!==-1 && ia===ib;
}
function abrirLvTomPicker(){
  renderLvTomGrid();
  document.getElementById('modalLvTom').classList.add('active');
}
function renderLvTomGrid(){
  const l = getLouvorAtual(); if(!l) return;
  const atualBase = lvTomAtual(l).replace(/m$/,'');
  document.getElementById('lvTomGrid').innerHTML = LV_TOM_GRID.map(nota=>{
    const isActive = lvNotasEquivalentes(nota, atualBase);
    return `<button type="button" class="lv-tom-grid-btn${isActive?' active':''}" onclick="lvTomGridClick('${nota}')">${nota}</button>`;
  }).join('');
}
let lvTomClickTimer = null;
function lvTomGridClick(nota){
  if(lvTomClickTimer){
    clearTimeout(lvTomClickTimer);
    lvTomClickTimer = null;
    lvTomGridEscolher(nota, true);
  }else{
    lvTomClickTimer = setTimeout(()=>{
      lvTomClickTimer = null;
      lvTomGridEscolher(nota, false);
    }, 280);
  }
}
function lvTomGridEscolher(nota, modoMenor){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  let idxNota = LV_CHROMATIC.indexOf(nota); if(idxNota===-1) idxNota = LV_FLAT.indexOf(nota);
  let idxOriginal = LV_CHROMATIC.indexOf(l.tomOriginal); if(idxOriginal===-1) idxOriginal = LV_FLAT.indexOf(l.tomOriginal);
  if(idxOriginal===-1){
    l.tomOriginal = nota;
    l.transpose = 0;
  }else{
    l.transpose = ((idxNota - idxOriginal)%12+12)%12;
  }
  l.tomModoMenor = modoMenor;
  persist();
  atualizarLvTomBox();
  renderLouvorPdfPreview();
  closeModal('modalLvTom');
}

/* ---------- Motor de cifras: detecção automática, seções e marcadores ----------
   Sintaxe do texto bruto:
   [Nome da Seção]  -> cabeçalho de seção (Refrão, Primeira Parte...)
   Linha só com acordes (ex: "E   A9   B") -> detectada automaticamente, fica laranja no PDF
   -    (um traço sozinho)  -> quebra para o próximo slide (continua a mesma seção)
   --   (dois traços)       -> linha divisória no PDF
   ---  (três traços)       -> força quebra de coluna no PDF
------------------------------------------------------------------------------ */
const LV_CHORD_SUFFIXES = ['maj7','majsus4','madd9','madd11','msus2','msus4','mdim7','m7b5','m7M','maj9','maj','min','dim7','dim','aug','sus2','sus4','add9','add11','add2',
  'm7','m9','m6','m11','m13','7M','9M','6','7','9','11','13','m','M'];
const LV_CHORD_SUFFIX_RE = LV_CHORD_SUFFIXES.sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
const LV_CHORD_RE = new RegExp(`^[A-G](#|b)?(${LV_CHORD_SUFFIX_RE})?(\\/[A-G](#|b)?)?$`);
function isChordLine(line){
  const trimmed = line.trim();
  if(!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.every(t=>LV_CHORD_RE.test(t));
}
const LV_CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LV_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
function lvShiftNote(note, delta){
  let idx = LV_CHROMATIC.indexOf(note);
  if(idx===-1) idx = LV_FLAT.indexOf(note);
  if(idx===-1) return null;
  return LV_CHROMATIC[((idx+delta)%12+12)%12];
}
function lvTransposeChord(chord, delta){
  if(!chord || !delta) return chord;
  const m = chord.match(/^([A-G])(#|b)?/);
  if(!m) return chord;
  const rootFull = m[1] + (m[2]||'');
  let rest = chord.slice(rootFull.length);
  const newRoot = lvShiftNote(rootFull, delta);
  if(!newRoot) return chord;
  const slashIdx = rest.indexOf('/');
  if(slashIdx !== -1){
    const bassPart = rest.slice(slashIdx+1);
    const bm = bassPart.match(/^([A-G])(#|b)?/);
    if(bm){
      const bassFull = bm[1] + (bm[2]||'');
      const newBass = lvShiftNote(bassFull, delta) || bassFull;
      const bassRest = bassPart.slice(bassFull.length);
      return newRoot + rest.slice(0,slashIdx) + '/' + newBass + bassRest;
    }
  }
  return newRoot + rest;
}
function lvTransposeChordLine(line, delta){
  if(!delta) return line;
  return line.replace(/\S+/g, tok => lvTransposeChord(tok, delta));
}

/* Faz uma única passada pelo texto bruto e devolve:
   items -> sequência pra montar o PDF (seções, pares cifra+letra, divisores, quebras de coluna, espaços em branco)
   slides -> lista de slides (cada um só com as linhas de letra, sem cifra), quebrados por seção e por "-" */
function lvParseContent(conteudo){
  const rawLines = (conteudo||'').split('\n');
  const items = [];
  let pendingChord = null;
  let currentLabel = '';
  const slides = [];
  let currentSlideLines = null;

  function flushPendingChord(){
    if(pendingChord !== null){
      items.push({ type:'pair', chordLine: pendingChord, lyricLine: '' });
      pendingChord = null;
    }
  }
  function startNewSlide(){
    currentSlideLines = [];
    slides.push({ label: currentLabel, lines: currentSlideLines });
  }

  rawLines.forEach(raw=>{
    const trimmed = raw.trim();
    if(trimmed === '---'){ flushPendingChord(); items.push({type:'colbreak'}); return; }
    if(trimmed === '--'){ flushPendingChord(); items.push({type:'divider'}); return; }
    if(trimmed === '-'){ flushPendingChord(); startNewSlide(); return; }
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if(sectionMatch){
      flushPendingChord();
      currentLabel = sectionMatch[1];
      items.push({ type:'section', label: currentLabel });
      startNewSlide();
      return;
    }
    if(trimmed === ''){
      flushPendingChord();
      items.push({ type:'blank' });
      return;
    }
    if(isChordLine(trimmed)){
      flushPendingChord();
      pendingChord = raw;
      return;
    }
    items.push({ type:'pair', chordLine: pendingChord||'', lyricLine: raw });
    pendingChord = null;
    if(currentSlideLines === null) startNewSlide();
    currentSlideLines.push(raw);
  });
  flushPendingChord();
  return { items, slides: slides.filter(s=>s.lines.length>0) };
}

/* ---------- PDF ---------- */
function setLouvorColunas(n){
  const l = getLouvorAtual(); if(!l) return;
  l.colunas = n;
  persist();
  renderLouvorPdfPreview();
}
function setLvPdfOrientacao(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfOrientacao = v;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfTamanhoTexto(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfTamanhoTexto = Math.max(8, Math.min(16, l.pdfTamanhoTexto + delta));
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfTamanhoTitulo(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfTamanhoTitulo = Math.max(12, Math.min(26, l.pdfTamanhoTitulo + delta));
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfAlturaLinha(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfAlturaLinha = Math.round(Math.max(1.0, Math.min(2.2, l.pdfAlturaLinha + delta))*10)/10;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfEspacamento(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfEspacamento = Math.round(Math.max(0, Math.min(3, l.pdfEspacamento + delta))*10)/10;
  persist();
  renderLouvorPdfPreview();
}
function ajustarLvPdfMargem(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.pdfMargem = Math.max(20, Math.min(72, l.pdfMargem + delta));
  persist();
  renderLouvorPdfPreview();
}
function renderLouvorPdfPreview(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('lvColuna1').classList.toggle('active', l.colunas===1);
  document.getElementById('lvColuna2').classList.toggle('active', l.colunas===2);
  document.getElementById('lvOrientRetrato').classList.toggle('active', l.pdfOrientacao==='retrato');
  document.getElementById('lvOrientPaisagem').classList.toggle('active', l.pdfOrientacao==='paisagem');
  document.getElementById('lvPdfTextoLabel').textContent = l.pdfTamanhoTexto+'pt';
  document.getElementById('lvPdfTituloLabel').textContent = l.pdfTamanhoTitulo+'pt';
  document.getElementById('lvPdfAlturaLinhaLabel').textContent = l.pdfAlturaLinha.toFixed(1);
  document.getElementById('lvPdfEspacamentoLabel').textContent = l.pdfEspacamento.toFixed(1);
  document.getElementById('lvPdfMargemLabel').textContent = l.pdfMargem+'pt';

  const delta = l.transpose || 0;
  const { items } = lvParseContent(l.conteudo);
  const lineStyle = `line-height:${l.pdfAlturaLinha};letter-spacing:${l.pdfEspacamento}px`;
  let bodyHtml = '';
  items.forEach(it=>{
    if(it.type==='section'){
      bodyHtml += `<div class="lv-sheet-section-wrap"><span class="lv-sheet-section">${it.label}</span></div>`;
    }else if(it.type==='divider'){
      bodyHtml += `<div class="lv-sheet-divider"></div>`;
    }else if(it.type==='colbreak'){
      bodyHtml += `<div class="lv-colbreak"></div>`;
    }else if(it.type==='blank'){
      bodyHtml += `<div class="lv-sheet-blank"></div>`;
    }else if(it.type==='pair'){
      const chordLine = lvTransposeChordLine(it.chordLine||'', delta);
      bodyHtml += chordLine.trim() ? `<div class="lv-sheet-chordline" style="font-size:${l.pdfTamanhoTexto}px;${lineStyle}">${chordLine}</div>` : '';
      bodyHtml += `<div class="lv-sheet-lyricline" style="font-size:${l.pdfTamanhoTexto}px;${lineStyle}">${it.lyricLine || ' '}</div>`;
    }
  });
  const tomAtual = lvTomAtual(l);
  const previewEl = document.getElementById('lvPdfPreview');
  previewEl.classList.toggle('paisagem', l.pdfOrientacao==='paisagem');
  previewEl.style.padding = l.pdfMargem+'px';
  previewEl.innerHTML = `
    <div class="lv-sheet-header">
      <div class="lv-sheet-header-text">
        <div class="lv-sheet-title" style="font-size:${l.pdfTamanhoTitulo}px">${l.titulo||'Sem título'}</div>
        <div class="lv-sheet-artist">${l.artista||''}</div>
      </div>
      ${tomAtual?`<div class="lv-sheet-tom-box"><span>TOM</span><b>${tomAtual}</b></div>`:''}
    </div>
    <div class="lv-sheet-cols" style="column-count:${l.colunas}">${bodyHtml || '<p class="empty-hint">Sem conteúdo ainda.</p>'}</div>
  `;
}
function exportarLouvorPdf(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4', orientation: l.pdfOrientacao==='paisagem' ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = l.pdfMargem;
  const orange = [219,139,24];
  const delta = l.transpose || 0;
  const tomAtual = lvTomAtual(l);

  doc.setTextColor(20,20,22);
  doc.setFont('helvetica','bold');
  doc.setFontSize(l.pdfTamanhoTitulo+2);
  doc.text(l.titulo||'Sem título', marginX, 34);
  doc.setFont('helvetica','normal');
  doc.setFontSize(11);
  doc.setTextColor(140,140,144);
  doc.text(l.artista||'', marginX, 52);

  if(tomAtual){
    const boxW = 66, boxH = 46, boxX = pageW - marginX - boxW, boxY = 16;
    doc.setDrawColor(222,222,226);
    doc.setLineWidth(1);
    doc.roundedRect(boxX, boxY, boxW, boxH, 8, 8, 'S');
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.setTextColor(150,150,154);
    doc.text('TOM', boxX+boxW/2, boxY+16, { align:'center' });
    doc.setFontSize(17);
    doc.setTextColor(30,30,32);
    doc.text(tomAtual, boxX+boxW/2, boxY+35, { align:'center' });
  }

  doc.setDrawColor(230,230,233);
  doc.setLineWidth(1);
  doc.line(marginX, 70, pageW-marginX, 70);

  const { items } = lvParseContent(l.conteudo);
  const cols = l.colunas || 2;
  const colWidth = cols===2 ? (pageW - marginX*2 - 20)/2 : (pageW - marginX*2);
  const colX = [marginX, marginX + colWidth + 20];
  const startY = 96;
  let colIdx = 0, y = startY;
  const fontSize = l.pdfTamanhoTexto;
  const lineH = fontSize * l.pdfAlturaLinha;
  doc.setFont('courier','normal');
  doc.setFontSize(fontSize);
  if(doc.setCharSpace) doc.setCharSpace(l.pdfEspacamento);

  function nextColumnOrPage(){
    if(cols===2 && colIdx===0){ colIdx = 1; y = startY; }
    else { doc.addPage(); colIdx = 0; y = startY; }
  }
  function ensureSpace(need){
    if(y + need > pageH - marginX) nextColumnOrPage();
  }

  items.forEach(it=>{
    if(it.type==='colbreak'){ nextColumnOrPage(); return; }
    if(it.type==='divider'){
      ensureSpace(lineH);
      doc.setDrawColor(210,210,214);
      doc.line(colX[colIdx], y-4, colX[colIdx]+colWidth, y-4);
      y += lineH*0.7;
      return;
    }
    if(it.type==='blank'){ ensureSpace(lineH*0.7); y += lineH*0.7; return; }
    if(it.type==='section'){
      ensureSpace(lineH*1.6);
      if(doc.setCharSpace) doc.setCharSpace(0);
      doc.setFillColor(118,124,133);
      const label = it.label.toUpperCase();
      doc.setFont('helvetica','bold');
      doc.setFontSize(fontSize-2);
      const textW = doc.getTextWidth(label);
      const pillW = textW + 20, pillH = fontSize+6, pillX = colX[colIdx]+colWidth/2-pillW/2;
      doc.roundedRect(pillX, y-fontSize+2, pillW, pillH, pillH/2, pillH/2, 'F');
      doc.setTextColor(255,255,255);
      doc.text(label, colX[colIdx]+colWidth/2, y+2, { align:'center' });
      y += lineH*1.3;
      doc.setFont('courier','normal');
      doc.setFontSize(fontSize);
      if(doc.setCharSpace) doc.setCharSpace(l.pdfEspacamento);
      return;
    }
    if(it.type==='pair'){
      const chordLine = lvTransposeChordLine(it.chordLine||'', delta);
      ensureSpace(lineH*2);
      if(chordLine.trim()){
        doc.setTextColor(...orange);
        doc.text(chordLine, colX[colIdx], y);
        y += lineH*0.85;
      }
      doc.setTextColor(40,40,40);
      doc.text(it.lyricLine || ' ', colX[colIdx], y);
      y += lineH;
    }
  });

  const tomRaiz = lvShiftNote(l.tomOriginal, l.transpose||0) || l.tomOriginal || '';
  const nomePartes = [l.artista, l.titulo||'Sem título', tomRaiz].filter(Boolean);
  const nomeArquivo = nomePartes.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  doc.save(`${nomeArquivo}.pdf`);
}

/* ---------- Slides ---------- */
function ajustarLvSlideTituloTamanho(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTituloTamanho = Math.max(20, Math.min(70, l.slideTituloTamanho + delta));
  persist();
  renderLouvorSlidePreview();
}
function setLvSlideTituloAlinhamento(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTituloAlinhamento = v;
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideTextoTamanho(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTextoTamanho = Math.max(16, Math.min(56, l.slideTextoTamanho + delta));
  persist();
  renderLouvorSlidePreview();
}
function setLvSlideTextoAlinhamento(v){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideTextoAlinhamento = v;
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideAlturaLinha(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideAlturaLinha = Math.round(Math.max(1.0, Math.min(2.5, l.slideAlturaLinha + delta))*10)/10;
  persist();
  renderLouvorSlidePreview();
}
function ajustarLvSlideEspacamento(delta){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  l.slideEspacamento = Math.round(Math.max(0, Math.min(3, l.slideEspacamento + delta))*10)/10;
  persist();
  renderLouvorSlidePreview();
}
function lvAlinhamentoChips(grupo, valorAtual){
  const opcoes = [['left','Esquerda'],['center','Centro'],['right','Direita'],['justify','Justificado']];
  return opcoes.map(([v,label])=>
    `<button type="button" class="dif-chip${valorAtual===v?' active':''}" onclick="${grupo}('${v}')">${label}</button>`
  ).join('');
}
function renderLouvorSlideConfigPainel(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  document.getElementById('lvSlideTituloTamanhoLabel').textContent = l.slideTituloTamanho+'pt';
  document.getElementById('lvSlideTextoTamanhoLabel').textContent = l.slideTextoTamanho+'pt';
  document.getElementById('lvSlideTituloAlinhamentoChips').innerHTML = lvAlinhamentoChips('setLvSlideTituloAlinhamento', l.slideTituloAlinhamento);
  document.getElementById('lvSlideTextoAlinhamentoChips').innerHTML = lvAlinhamentoChips('setLvSlideTextoAlinhamento', l.slideTextoAlinhamento);
  document.getElementById('lvSlideAlturaLinhaLabel').textContent = l.slideAlturaLinha.toFixed(1);
  document.getElementById('lvSlideEspacamentoLabel').textContent = l.slideEspacamento.toFixed(1);
}
function renderLouvorSlidePreview(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  renderLouvorSlideConfigPainel();
  const { slides } = lvParseContent(l.conteudo);
  const total = slides.length + 1;
  if(lvSlideIndex >= total) lvSlideIndex = total-1;
  if(lvSlideIndex < 0) lvSlideIndex = 0;
  document.getElementById('lvSlideCounter').textContent = `${lvSlideIndex+1} / ${total}`;
  const el = document.getElementById('lvSlidePreview');
  const alinhaFlex = { left:'flex-start', center:'center', right:'flex-end', justify:'center' };
  const espacamentoStyle = `letter-spacing:${l.slideEspacamento}px`;
  if(lvSlideIndex === 0){
    el.style.alignItems = alinhaFlex[l.slideTituloAlinhamento] || 'center';
    el.innerHTML = `<div class="lv-slide-title" style="font-size:${l.slideTituloTamanho/10}vw;text-align:${l.slideTituloAlinhamento};line-height:${l.slideAlturaLinha};${espacamentoStyle}">${l.titulo||'Sem título'}</div><div class="lv-slide-artist">${l.artista||''}</div>`;
  }else{
    const s = slides[lvSlideIndex-1];
    const lyricText = s.lines.join('\n');
    el.style.alignItems = alinhaFlex[l.slideTextoAlinhamento] || 'center';
    el.innerHTML = `<div class="lv-slide-lyric" style="font-size:${l.slideTextoTamanho/10}vw;text-align:${l.slideTextoAlinhamento};line-height:${l.slideAlturaLinha};${espacamentoStyle}">${lyricText.replace(/\n/g,'<br>')}</div>`;
  }
}
function lvSlideNav(delta){
  const l = getLouvorAtual(); if(!l) return;
  const { slides } = lvParseContent(l.conteudo);
  const total = slides.length + 1;
  lvSlideIndex = Math.max(0, Math.min(total-1, lvSlideIndex + delta));
  renderLouvorSlidePreview();
}
function exportarLouvorSlides(){
  const l = getLouvorAtual(); if(!l) return;
  ensureLouvorConfig(l);
  const PptxCtor = window.pptxgen || window.PptxGenJS;
  if(typeof PptxCtor === 'undefined'){
    showToast('Não foi possível carregar o gerador de slides.');
    return;
  }
  const pres = new PptxCtor();
  pres.defineLayout({ name:'WIDE', width:13.333, height:7.5 });
  pres.layout = 'WIDE';
  const graphiteHex = '25292E';
  const alinhaPptx = { left:'left', center:'center', right:'right', justify:'justify' };

  const capa = pres.addSlide();
  capa.background = { color: graphiteHex };
  capa.addText(l.titulo||'Sem título', { x:0.5,y:2.6,w:12.3,h:1.4, fontSize:l.slideTituloTamanho*0.85, bold:true, color:'FFFFFF', align:alinhaPptx[l.slideTituloAlinhamento]||'center', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  capa.addText(l.artista||'', { x:0.5,y:4.0,w:12.3,h:0.8, fontSize:22, color:'CCCCCC', align:alinhaPptx[l.slideTituloAlinhamento]||'center' });

  const { slides } = lvParseContent(l.conteudo);
  slides.forEach(s=>{
    const slide = pres.addSlide();
    slide.background = { color: graphiteHex };
    const lyricText = s.lines.join('\n');
    slide.addText(lyricText, { x:0.6,y:0.6,w:12.1,h:6.3, fontSize:l.slideTextoTamanho*0.85, bold:true, color:'FFFFFF', align:alinhaPptx[l.slideTextoAlinhamento]||'center', valign:'middle', lineSpacingMultiple:l.slideAlturaLinha, charSpacing:l.slideEspacamento });
  });

  const nomePartesSlides = [l.artista, l.titulo||'Sem título'].filter(Boolean);
  const nomeArquivoSlides = nomePartesSlides.join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  pres.writeFile({ fileName: `${nomeArquivoSlides}.pptx` });
}

/* ================= MERCADO: Lista de Compras + Estoque de Casa ================= */
const MERCADO_CATEGORIAS = ['Alimentos','Limpeza','Higiene','Bebidas','Outros'];

let mercadoEstoqueFiltroAtivo = 'Todas';
let estoqueItemAtualId = null;

function uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function renderMercado(){
  renderMercadoNovoItemUnidadeSelect();
  renderListaComprasView();
  renderMercadoEstoqueFilterChips();
  renderEstoqueView();
}
function renderMercadoNovoItemUnidadeSelect(){
  const el = document.getElementById('mercadoNovoItemUnidade');
  if(el && !el.dataset.valor){
    el.dataset.valor = UNIDADES_MEDIDA[0];
    el.querySelector('.unidade-picker-valor').textContent = UNIDADES_MEDIDA[0];
  }
}
function switchMercadoSubtab(tab){
  document.getElementById('subtabBtnMercadoLista').classList.toggle('active', tab==='lista');
  document.getElementById('subtabBtnMercadoEstoque').classList.toggle('active', tab==='estoque');
  document.getElementById('subtabBtnMercadoDashboard').classList.toggle('active', tab==='dashboard');
  document.getElementById('mercadoSubtabLista').style.display = tab==='lista' ? 'block' : 'none';
  document.getElementById('mercadoSubtabEstoque').style.display = tab==='estoque' ? 'block' : 'none';
  document.getElementById('mercadoSubtabDashboard').style.display = tab==='dashboard' ? 'block' : 'none';
  if(tab==='lista') renderListaComprasView();
  if(tab==='estoque') renderEstoqueView();
  if(tab==='dashboard') renderMercadoDashboard();
}

/* ---------- Lista de Compras ---------- */
const ICON_CART_SMALL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
function encontrarEstoquePorNome(nome){
  const alvo = (nome||'').trim().toLowerCase();
  return state.estoque.find(e=>e.nome.trim().toLowerCase()===alvo);
}
function renderListaComprasView(){
  const el = document.getElementById('mercadoListaCompras');
  const autoItens = state.estoque.filter(e=> e.quantidadeAtual < e.quantidadeMinima);
  const manualItens = state.listaCompras.slice().sort((a,b)=>b.criadoEm-a.criadoEm);

  if(autoItens.length===0 && manualItens.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Lista vazia</div><div class="desc">Adicione um item ou espere o estoque acabar</div></div>`;
    return;
  }

  let html = '';
  autoItens.forEach(e=>{
    html += `<div class="mercado-item" onclick="abrirFinalizarCompra('${e.id}')">
      <div class="mercado-check pending">${ICON_CART_SMALL}</div>
      <div class="mercado-item-info">
        <div class="mercado-item-nome">${e.nome}<span class="mercado-badge-auto">Pendente</span></div>
        <div class="mercado-item-meta">${e.categoria} · tem ${e.quantidadeAtual}${e.unidade}, mínimo ${e.quantidadeMinima}${e.unidade}</div>
      </div>
      <div class="mercado-item-qtd">+${e.quantidadeReposicao||e.quantidadeMinima}${e.unidade}</div>
    </div>`;
  });
  manualItens.forEach(it=>{
    const match = encontrarEstoquePorNome(it.nome);
    if(match){
      html += `<div class="mercado-item" onclick="abrirFinalizarCompra('${match.id}','${it.id}')">
        <div class="mercado-check pending">${ICON_CART_SMALL}</div>
        <div class="mercado-item-info">
          <div class="mercado-item-nome">${it.nome}<span class="mercado-badge-auto">Pendente</span></div>
          <div class="mercado-item-meta">Vinculado ao estoque · ${match.categoria}</div>
        </div>
        <div class="mercado-item-qtd">${it.quantidade}${it.unidade}</div>
        <button class="mercado-item-del" onclick="event.stopPropagation();excluirItemManual('${it.id}')">✕</button>
      </div>`;
    }else if(it.noCarrinho){
      html += `<div class="mercado-item carrinho" onclick="abrirFinalizarAvulso('${it.id}')">
        <div class="mercado-check checked">${ICON_CHECK}</div>
        <div class="mercado-item-info">
          <div class="mercado-item-nome">${it.nome}<span class="mercado-badge-carrinho">No carrinho</span></div>
          <div class="mercado-item-meta">Toque pra finalizar a compra</div>
        </div>
        <div class="mercado-item-qtd">${it.quantidade}${it.unidade}</div>
        <button class="mercado-item-del" onclick="event.stopPropagation();excluirItemManual('${it.id}')">✕</button>
      </div>`;
    }else{
      html += `<div class="mercado-item" onclick="marcarItemNoCarrinho('${it.id}')">
        <div class="mercado-check"></div>
        <div class="mercado-item-info">
          <div class="mercado-item-nome">${it.nome}</div>
          <div class="mercado-item-meta">Item avulso · sem controle de estoque</div>
        </div>
        <div class="mercado-item-qtd">${it.quantidade}${it.unidade}</div>
        <button class="mercado-item-del" onclick="event.stopPropagation();excluirItemManual('${it.id}')">✕</button>
      </div>`;
    }
  });
  el.innerHTML = html;
}
function adicionarItemManualCompra(){
  const input = document.getElementById('mercadoNovoItemInput');
  const nome = input.value.trim();
  if(!nome) return;
  const qtd = parseFloat(document.getElementById('mercadoNovoItemQtd').value) || 1;
  const unidade = document.getElementById('mercadoNovoItemUnidade').dataset.valor || 'unidades';
  state.listaCompras.push({ id: uid('mc'), nome, quantidade:qtd, unidade, noCarrinho:false, criadoEm: Date.now() });
  input.value = '';
  document.getElementById('mercadoNovoItemQtd').value = '';
  input.focus();
  persist();
  renderListaComprasView();
}
function excluirItemManual(id){
  state.listaCompras = state.listaCompras.filter(it=>it.id!==id);
  persist();
  renderListaComprasView();
}
function marcarItemNoCarrinho(id){
  const it = state.listaCompras.find(x=>x.id===id);
  if(!it) return;
  it.noCarrinho = true;
  persist();
  renderListaComprasView();
  if(navigator.vibrate) navigator.vibrate(10);
}

/* ---------- Finalizar Compra de item avulso (sem estoque prévio) ---------- */
let favManualItemId = null;
let favAdicionarEstoque = false;
function abrirFinalizarAvulso(manualItemId){
  const it = state.listaCompras.find(x=>x.id===manualItemId);
  if(!it) return;
  favManualItemId = manualItemId;
  document.getElementById('favItemNome').textContent = it.nome;
  document.getElementById('favQuantidade').value = it.quantidade || 1;
  document.getElementById('favUnidade').textContent = it.unidade || 'unidades';
  document.getElementById('favValor').value = '';
  setFavAdicionarEstoque(false);
  window.favCategoriaSelecionada = 'Alimentos';
  renderFavCategoriaChips();
  document.getElementById('favQtdMinima').value = '';
  document.getElementById('favQtdReposicao').value = '';
  document.getElementById('modalFinalizarAvulso').classList.add('active');
}
function setFavAdicionarEstoque(v){
  favAdicionarEstoque = v;
  document.getElementById('favEstoqueSim').classList.toggle('active', v);
  document.getElementById('favEstoqueNao').classList.toggle('active', !v);
  document.getElementById('favEstoqueCamposWrap').style.display = v ? 'block' : 'none';
}
function renderFavCategoriaChips(){
  document.getElementById('favCategoriaChips').innerHTML = MERCADO_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${window.favCategoriaSelecionada===c?' active':''}" onclick="selecionarFavCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarFavCategoria(c){
  window.favCategoriaSelecionada = c;
  renderFavCategoriaChips();
}
function confirmarFinalizarAvulso(){
  const it = state.listaCompras.find(x=>x.id===favManualItemId);
  if(!it) return;
  const qtd = parseFloat(document.getElementById('favQuantidade').value) || 0;
  const valor = parseFloat(document.getElementById('favValor').value);

  if(favAdicionarEstoque){
    const qtdMinima = parseFloat(document.getElementById('favQtdMinima').value) || 0;
    const qtdReposicao = parseFloat(document.getElementById('favQtdReposicao').value) || qtdMinima;
    const temPreco = !isNaN(valor) && valor>0;
    state.estoque.push({
      id: uid('est'), nome: it.nome, categoria: window.favCategoriaSelecionada,
      quantidadeAtual: qtd, unidade: it.unidade, quantidadeMinima: qtdMinima, quantidadeReposicao: qtdReposicao,
      precos: temPreco ? [{ valor, data: Date.now() }] : [],
      historicoCompras: [{ data: Date.now(), quantidadeComprada: qtd, valorUnitario: temPreco?valor:null, saldoAntesCorrigido:0, zerou:true, diasDesdeUltima:null }],
      criadoEm: Date.now()
    });
  }

  state.listaCompras = state.listaCompras.filter(x=>x.id!==favManualItemId);
  persist();
  closeModal('modalFinalizarAvulso');
  favManualItemId = null;
  renderListaComprasView();
  renderEstoqueView();
}

/* ---------- Finalizar Compra (dá entrada no estoque + registra e compara preço) ---------- */
let fcEstoqueId = null;
let fcManualItemId = null;
function abrirFinalizarCompra(estoqueId, manualItemId){
  const e = state.estoque.find(x=>x.id===estoqueId);
  if(!e) return;
  fcEstoqueId = estoqueId;
  fcManualItemId = manualItemId || null;
  document.getElementById('fcItemNome').textContent = e.nome;
  document.getElementById('fcSaldoAtual').value = e.quantidadeAtual;
  document.getElementById('fcQuantidade').value = e.quantidadeReposicao || e.quantidadeMinima || 1;
  document.getElementById('fcUnidade').textContent = e.unidade;
  document.getElementById('fcValor').value = '';
  document.getElementById('fcComparacao').style.display = 'none';
  document.getElementById('modalFinalizarCompra').classList.add('active');
}
function zerarSaldoFinalizar(){
  document.getElementById('fcSaldoAtual').value = 0;
}
function atualizarComparacaoPreco(){
  const e = state.estoque.find(x=>x.id===fcEstoqueId);
  const el = document.getElementById('fcComparacao');
  if(!e || !e.precos || e.precos.length===0){ el.style.display='none'; return; }
  const novoValor = parseFloat(document.getElementById('fcValor').value);
  if(isNaN(novoValor)){ el.style.display='none'; return; }
  const anterior = e.precos[e.precos.length-1].valor;
  const diff = novoValor - anterior;
  const pct = anterior>0 ? (diff/anterior*100) : 0;
  let linha;
  if(Math.abs(diff) < 0.005){
    linha = `Igual ao preço anterior (R$ ${anterior.toFixed(2).replace('.',',')})`;
  }else if(diff > 0){
    linha = `▲ Subiu R$ ${diff.toFixed(2).replace('.',',')} (${pct.toFixed(0)}%) — antes R$ ${anterior.toFixed(2).replace('.',',')}`;
  }else{
    linha = `▼ Desceu R$ ${Math.abs(diff).toFixed(2).replace('.',',')} (${Math.abs(pct).toFixed(0)}%) — antes R$ ${anterior.toFixed(2).replace('.',',')}`;
  }
  el.textContent = linha;
  el.style.display = 'block';
}
function confirmarFinalizarCompra(){
  const e = state.estoque.find(x=>x.id===fcEstoqueId);
  if(!e) return;
  const saldoAtualCorrigido = Math.max(0, parseFloat(document.getElementById('fcSaldoAtual').value) || 0);
  const qtd = parseFloat(document.getElementById('fcQuantidade').value) || 0;
  const valor = parseFloat(document.getElementById('fcValor').value);
  if(!e.precos) e.precos = [];
  if(!isNaN(valor) && valor>0) e.precos.push({ valor, data: Date.now() });

  if(!e.historicoCompras) e.historicoCompras = [];
  const agora = Date.now();
  let diasDesdeUltima = null;
  if(e.historicoCompras.length>0){
    const ultima = e.historicoCompras[e.historicoCompras.length-1];
    diasDesdeUltima = Math.round((agora - ultima.data)/86400000);
  }
  e.historicoCompras.push({
    data: agora,
    quantidadeComprada: qtd,
    valorUnitario: (!isNaN(valor) && valor>0) ? valor : null,
    saldoAntesCorrigido: saldoAtualCorrigido,
    zerou: saldoAtualCorrigido<=0,
    diasDesdeUltima
  });

  e.quantidadeAtual = Math.round((saldoAtualCorrigido + qtd)*100)/100;
  if(fcManualItemId) state.listaCompras = state.listaCompras.filter(it=>it.id!==fcManualItemId);
  persist();
  closeModal('modalFinalizarCompra');
  fcEstoqueId = null; fcManualItemId = null;
  renderListaComprasView();
  renderEstoqueView();
}

/* ---------- Estoque de Casa ---------- */
function renderMercadoEstoqueFilterChips(){
  const chips = ['Todas', ...MERCADO_CATEGORIAS];
  document.getElementById('mercadoEstoqueFilterChips').innerHTML = chips.map(c=>
    `<button class="filter-chip${mercadoEstoqueFiltroAtivo===c?' active':''}" onclick="setMercadoEstoqueFiltro('${c}')">${c}</button>`
  ).join('');
}
function setMercadoEstoqueFiltro(c){
  mercadoEstoqueFiltroAtivo = c;
  renderMercadoEstoqueFilterChips();
  renderEstoqueView();
}
function renderEstoqueView(){
  const el = document.getElementById('mercadoEstoqueLista');
  let items = state.estoque.slice();
  if(mercadoEstoqueFiltroAtivo !== 'Todas') items = items.filter(e=>e.categoria===mercadoEstoqueFiltroAtivo);
  items.sort((a,b)=> a.nome.localeCompare(b.nome));
  if(items.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Nenhum item no estoque</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  el.innerHTML = items.map(e=>{
    const abaixo = e.quantidadeAtual < e.quantidadeMinima;
    const ultimoPreco = (e.precos && e.precos.length) ? e.precos[e.precos.length-1].valor : null;
    return `<div class="mercado-item ${abaixo?'repor':''}">
      <div class="mercado-item-info" onclick="abrirEstoqueForm('${e.id}')">
        <div class="mercado-item-nome">${e.nome}${abaixo?'<span class="mercado-badge-auto">Repor</span>':''}</div>
        <div class="mercado-item-meta">${e.categoria} · mínimo ${e.quantidadeMinima}${e.unidade}${ultimoPreco!==null?` · R$ ${ultimoPreco.toFixed(2).replace('.',',')}/${e.unidade}`:''}</div>
      </div>
      <div class="mercado-item-stepper">
        <button onclick="ajustarEstoqueQtdRapido('${e.id}', -1)">−</button>
        <span>${e.quantidadeAtual}${e.unidade}</span>
        <button onclick="ajustarEstoqueQtdRapido('${e.id}', 1)">+</button>
      </div>
    </div>`;
  }).join('');
}
function ajustarEstoqueQtdRapido(id, delta){
  const e = state.estoque.find(x=>x.id===id);
  if(!e) return;
  e.quantidadeAtual = Math.max(0, Math.round((e.quantidadeAtual + delta)*100)/100);
  persist();
  renderEstoqueView();
  renderListaComprasView();
}
function abrirEstoqueForm(id){
  estoqueItemAtualId = id;
  const e = id ? state.estoque.find(x=>x.id===id) : null;
  document.getElementById('modalEstoqueItemTitulo').textContent = e ? 'Editar item' : 'Novo item';
  document.getElementById('estItemNome').value = e ? e.nome : '';
  document.getElementById('estItemQtdAtual').value = e ? e.quantidadeAtual : '';
  document.getElementById('estItemQtdMinima').value = e ? e.quantidadeMinima : '';
  document.getElementById('estItemQtdReposicao').value = e ? (e.quantidadeReposicao||'') : '';
  document.getElementById('btnExcluirEstoqueItem').style.display = e ? 'block' : 'none';
  document.getElementById('btnVerHistoricoItem').style.display = (e && e.historicoCompras && e.historicoCompras.length>0) ? 'block' : 'none';
  const temPreco = e && e.precos && e.precos.length>0;
  document.getElementById('estItemPrecoInicialWrap').style.display = temPreco ? 'none' : 'block';
  document.getElementById('estItemPrecoInicial').value = '';
  document.getElementById('estItemPrecoAtualWrap').style.display = temPreco ? 'block' : 'none';
  if(temPreco){
    const ultimo = e.precos[e.precos.length-1];
    const dataStr = new Date(ultimo.data).toLocaleDateString('pt-BR');
    document.getElementById('estItemPrecoAtualValor').textContent = `R$ ${ultimo.valor.toFixed(2).replace('.',',')} em ${dataStr}`;
  }
  window.estFormCategoriaSelecionada = e ? e.categoria : 'Alimentos';
  window.estFormUnidadeSelecionada = e ? e.unidade : 'un';
  renderEstFormCategoriaChips();
  renderEstFormUnidadeChips();
  document.getElementById('modalEstoqueItem').classList.add('active');
}
function renderEstFormCategoriaChips(){
  document.getElementById('estItemCategoriaChips').innerHTML = MERCADO_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${window.estFormCategoriaSelecionada===c?' active':''}" onclick="selecionarEstFormCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarEstFormCategoria(c){
  window.estFormCategoriaSelecionada = c;
  renderEstFormCategoriaChips();
}
function renderEstFormUnidadeChips(){
  document.getElementById('estItemUnidadeChips').innerHTML = UNIDADES_MEDIDA.map(u=>
    `<button type="button" class="dif-chip${window.estFormUnidadeSelecionada===u?' active':''}" onclick="selecionarEstFormUnidade('${u}')">${u}</button>`
  ).join('');
}
function selecionarEstFormUnidade(u){
  window.estFormUnidadeSelecionada = u;
  renderEstFormUnidadeChips();
}
function salvarEstoqueItem(){
  const nome = document.getElementById('estItemNome').value.trim();
  if(!nome){ document.getElementById('estItemNome').focus(); return; }
  const qtdAtual = parseFloat(document.getElementById('estItemQtdAtual').value) || 0;
  const unidade = window.estFormUnidadeSelecionada || 'un';
  const qtdMinima = parseFloat(document.getElementById('estItemQtdMinima').value) || 0;
  const qtdReposicao = parseFloat(document.getElementById('estItemQtdReposicao').value) || qtdMinima;
  const precoInicial = parseFloat(document.getElementById('estItemPrecoInicial').value);
  if(estoqueItemAtualId){
    const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
    e.nome = nome; e.categoria = window.estFormCategoriaSelecionada; e.quantidadeAtual = qtdAtual;
    e.unidade = unidade; e.quantidadeMinima = qtdMinima; e.quantidadeReposicao = qtdReposicao;
    if(!e.precos) e.precos = [];
    if((!e.precos || e.precos.length===0) && !isNaN(precoInicial) && precoInicial>0){
      e.precos.push({ valor: precoInicial, data: Date.now() });
    }
  }else{
    const precos = (!isNaN(precoInicial) && precoInicial>0) ? [{ valor: precoInicial, data: Date.now() }] : [];
    state.estoque.push({ id: uid('est'), nome, categoria: window.estFormCategoriaSelecionada, quantidadeAtual: qtdAtual, unidade, quantidadeMinima: qtdMinima, quantidadeReposicao: qtdReposicao, precos, historicoCompras:[], criadoEm: Date.now() });
  }
  persist();
  closeModal('modalEstoqueItem');
  renderEstoqueView();
  renderListaComprasView();
}
function excluirEstoqueItemAtual(){
  if(!estoqueItemAtualId) return;
  const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
  iosConfirm(`Excluir "${e?.nome||'este item'}"?`).then(ok=>{
    if(!ok) return;
    state.estoque = state.estoque.filter(x=>x.id!==estoqueItemAtualId);
    persist();
    closeModal('modalEstoqueItem');
    renderEstoqueView();
    renderListaComprasView();
  });
}

/* ---------- Histórico de compras (por item) ---------- */
function abrirHistoricoItem(){
  const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
  if(!e) return;
  document.getElementById('histItemTitulo').textContent = `Histórico — ${e.nome}`;
  const hist = (e.historicoCompras||[]).slice().reverse();
  document.getElementById('histItemLista').innerHTML = hist.map(h=>{
    const dataStr = new Date(h.data).toLocaleDateString('pt-BR');
    const diasStr = h.diasDesdeUltima!==null ? `${h.diasDesdeUltima} dia${h.diasDesdeUltima===1?'':'s'} desde a compra anterior${h.zerou?' · zerou antes de repor':''}` : 'Primeira compra registrada';
    const valorStr = h.valorUnitario!==null ? `R$ ${h.valorUnitario.toFixed(2).replace('.',',')}` : '—';
    return `<div class="mkt-hist-item">
      <div>
        <div class="mkt-hist-data">${dataStr} · +${h.quantidadeComprada}${e.unidade}</div>
        <div class="mkt-hist-dias">${diasStr}</div>
      </div>
      <div class="mkt-hist-valor">${valorStr}</div>
    </div>`;
  }).join('') || '<p class="empty-hint">Sem compras registradas ainda.</p>';
  document.getElementById('modalHistoricoItem').classList.add('active');
}

/* ---------- Dashboard ---------- */
function renderMercadoDashboard(){
  const agora = new Date();
  const mesAtual = agora.getMonth(), anoAtual = agora.getFullYear();

  let gastoMes = 0;
  const gastoPorCategoria = {};
  state.estoque.forEach(e=>{
    (e.historicoCompras||[]).forEach(h=>{
      const d = new Date(h.data);
      if(d.getMonth()===mesAtual && d.getFullYear()===anoAtual && h.valorUnitario){
        const total = h.valorUnitario * h.quantidadeComprada;
        gastoMes += total;
        gastoPorCategoria[e.categoria] = (gastoPorCategoria[e.categoria]||0) + total;
      }
    });
  });
  document.getElementById('mktGastoMes').textContent = 'R$ '+gastoMes.toFixed(2).replace('.',',');

  const itensFalta = state.estoque.filter(e=>e.quantidadeAtual < e.quantidadeMinima).length;
  document.getElementById('mktItensFalta').textContent = itensFalta;

  const ranking = state.estoque
    .map(e=>{
      const dias = (e.historicoCompras||[]).map(h=>h.diasDesdeUltima).filter(d=>d!==null && d>0);
      if(dias.length===0) return null;
      const media = dias.reduce((a,b)=>a+b,0)/dias.length;
      return { nome:e.nome, media };
    })
    .filter(Boolean)
    .sort((a,b)=>a.media-b.media)
    .slice(0,5);
  const rankEl = document.getElementById('mktRankingGiro');
  rankEl.innerHTML = ranking.length ? ranking.map(r=>
    `<div class="mkt-rank-item"><span class="mkt-rank-nome">${r.nome}</span><span class="mkt-rank-valor">${r.media.toFixed(0)} dias</span></div>`
  ).join('') : '<p class="empty-hint">Ainda sem dados suficientes — finalize compras mais de uma vez pra ver o giro.</p>';

  const catEl = document.getElementById('mktGastoCategoria');
  const categoriasComGasto = Object.entries(gastoPorCategoria).sort((a,b)=>b[1]-a[1]);
  const maiorGasto = categoriasComGasto.length ? categoriasComGasto[0][1] : 0;
  catEl.innerHTML = categoriasComGasto.length ? categoriasComGasto.map(([cat,valor])=>{
    const pct = maiorGasto>0 ? (valor/maiorGasto*100) : 0;
    return `<div class="mkt-cat-bar-row">
      <div class="mkt-cat-bar-head"><span>${cat}</span><span>R$ ${valor.toFixed(2).replace('.',',')}</span></div>
      <div class="mkt-cat-bar-track"><div class="mkt-cat-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') : '<p class="empty-hint">Nenhuma compra finalizada este mês ainda.</p>';
}

setInterval(()=>{
  const abaPonto = document.getElementById('aba-ponto');
  if(abaPonto && abaPonto.classList.contains('active')) renderPonto();
}, 60000);

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Erro ao registrar service worker', e));
  });
}
