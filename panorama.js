/* ================= RENDER: PANORAMA ================= */
/* ================= PLANEJADOR DE METAS / SIMULADOR ================= */
let panoSubtabAtiva = 'resumo';
function switchPanoSubtab(tab){
  panoSubtabAtiva = tab;
  document.querySelectorAll('.pano-subtab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));
  document.getElementById('panoPanelResumo').classList.toggle('active', tab==='resumo');
  document.getElementById('panoPanelContas').classList.toggle('active', tab==='contas');
  window.scrollTo(0,0);
}

let simuladorMetas = [];
let simuladorAumentoRendaPercent = 0;

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
  simuladorAumentoRendaPercent = 0;
  document.getElementById('simuladorMetasForm').reset();
  document.getElementById('simAumentoRendaPct').value = 0;
  document.getElementById('addMetaAccordion').style.display = 'none';
  document.getElementById('addMetaAccordionChevron').style.transform = 'rotate(0deg)';
  createMonthPicker('simMetaMesPicker', 'simMetaMes', mesFinanceiroAtual());
  renderSimulador();
  document.getElementById('modalSimulador').classList.add('active');
}

function onSimAumentoRendaChange(v){
  simuladorAumentoRendaPercent = Math.max(0, Math.min(200, parseFloat(v)||0));
  renderSimulador();
}

function closeSimulador(){
  document.getElementById('modalSimulador').classList.remove('active');
  simuladorMetas = [];
  simuladorAumentoRendaPercent = 0;
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
    const rendaBase = (incomeForMonth('davi', mKey) || 0) + (incomeForMonth('cris', mKey) || 0);
    const renda = rendaBase * (1 + (simuladorAumentoRendaPercent||0)/100);
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

/* renderAll vive em app.js (chama todas as 6 abas) */

function renderPanorama(){
  const months = getPanoWindowMonths();
  document.getElementById('panoWindowLabel').textContent = monthLabel(months[0])+' – '+monthLabel(months[5]);

  if(!months.includes(state.focusMonth)) state.focusMonth = months[0];

  renderAcumTable(months);
  renderPanoCharts();
  renderPanoPonto();
  renderFluxoCaixa();
  renderParcelasTerminando();
  renderComparativoAno();
  renderVilaoOrcamento();
  renderPrevisaoProximoMes();

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
  renderVencendoEmBreve();
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
  const catsComValor = cats.filter(c=>totals[c]>0).sort((a,b)=>totals[b]-totals[a]);
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

  const barChart = catsComValor.length ? catsComValor.map(c=>{
    const pct = gastosTotal>0 ? (totals[c]/gastosTotal*100) : 0;
    return `<div class="bar-row"><div class="bar-label">${catLabels[c]}</div><div class="bar-container"><div class="bar-fill" style="width:${pct.toFixed(0)}%;background:${catColors[c]}"><div class="bar-percent">${pct.toFixed(0)}%</div></div></div></div>`;
  }).join('') : '';

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
        items.push({ user:u, cat, id:item.id, desc:item.desc, valor:item.valor, dia:item.dia||1, logoUrl:item.logoUrl||null, mesInicio:item.mesInicio||null, tipo:item.tipo||'fixa', essencial:item.essencial!==false, historico:item.historico||[] });
      });
    });
    state.users[u].expenses.futuro.forEach(item=>{
      const v = futuroValorNoMes(item, mKey);
      if(v > 0){
        const p = futuroParcelaNoMes(item, mKey);
        items.push({ user:u, cat:'futuro', id:item.id, desc:item.desc + (p?' ('+p.atual+'/'+p.total+')':''), valor:v, dia:item.dia||1, logoUrl:item.logoUrl||null, mesInicio:item.mesInicio||null });
      }
    });
  });
  items.sort((a,b)=> (a.dia||1) - (b.dia||1));
  return items;
}

/* ================= COMPARATIVO COM MESES ANTERIORES ================= */
function dadosDoMes(mKey){
  if(state.historicoMeses && state.historicoMeses[mKey]) return state.historicoMeses[mKey];
  const renda = incomeForMonth('davi', mKey) + incomeForMonth('cris', mKey);
  const gastoTotal = expensesForMonth('davi', mKey) + expensesForMonth('cris', mKey);
  return { renda, gastoTotal, sobra: renda-gastoTotal };
}
function renderComparativoAno(){
  const card = document.getElementById('cardComparativoAno');
  if(!card) return;
  const mKey = state.focusMonth;
  const mesAnterior = addMonths(mKey, -1);
  const mes3Atras = addMonths(mKey, -3);
  const atual = dadosDoMes(mKey);
  const anterior = dadosDoMes(mesAnterior);
  const tresAtras = dadosDoMes(mes3Atras);

  const temAnterior = anterior.gastoTotal>0 || anterior.renda>0;
  const tem3Atras = tresAtras.gastoTotal>0 || tresAtras.renda>0;
  if(!temAnterior && !tem3Atras){
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  function linhaComparativo(label, base){
    const diffGasto = base.gastoTotal>0 ? ((atual.gastoTotal-base.gastoTotal)/base.gastoTotal*100) : null;
    const seta = diffGasto===null ? '' : (diffGasto>0 ? '▲' : (diffGasto<0 ? '▼' : '–'));
    const cor = diffGasto===null ? 'var(--text-dim)' : (diffGasto>0 ? 'var(--warning)' : 'var(--success)');
    return `
      <div style="font-size:11px;color:var(--text-faint);font-weight:700;text-transform:uppercase;margin-top:var(--s2);margin-bottom:2px">${label}</div>
      <div class="comp-ano-linha"><span>Gastos</span><span>${fmtMoney(base.gastoTotal)} → ${fmtMoney(atual.gastoTotal)}</span>${diffGasto!==null?`<span style="color:${cor};font-weight:800">${seta} ${Math.abs(diffGasto).toFixed(0)}%</span>`:''}</div>
      <div class="comp-ano-linha"><span>Sobra</span><span>${fmtMoneySigned(base.sobra)} → ${fmtMoneySigned(atual.sobra)}</span></div>
    `;
  }

  let html = '';
  if(temAnterior) html += linhaComparativo('Comparado a '+monthLabel(mesAnterior), anterior);
  if(tem3Atras) html += linhaComparativo('Comparado a '+monthLabel(mes3Atras)+' (3 meses atrás)', tresAtras);
  document.getElementById('comparativoAnoBody').innerHTML = html;
}

/* ================= PREVISÃO DO PRÓXIMO MÊS ================= */
/* "Certo": moradia/fixo/assinatura recorrentes + Contas Futuras + parcelas de cartão já agendadas (datas conhecidas).
   "Estimado": crédito à vista do cartão, projetado pela média dos últimos 3 meses (é o único gasto sem data previsível). */
function calcularPrevisaoProximoMes(){
  const mKey = addMonths(mesFinanceiroAtual(), 1);
  let certo = 0;
  ['davi','cris'].forEach(user=>{
    ['moradia','fixo','assinatura'].forEach(cat=> certo += categoryTotalForMonth(cat, mKey));
  });
  const futuro = categoryTotalForMonth('futuro', mKey);
  certo += futuro;
  let cartaoParcelas = 0;
  (state.comprasTracker||[]).forEach(item=> cartaoParcelas += compraTrackerValorNoMes(item, mKey));
  certo += cartaoParcelas;
  const estimado = credoVistaMediaUltimosMeses(3);
  return { mKey, certo, estimado, total: certo+estimado, futuro, cartaoParcelas };
}
function renderPrevisaoProximoMes(){
  const card = document.getElementById('cardPrevisaoProximoMes');
  if(!card) return;
  const p = calcularPrevisaoProximoMes();
  card.style.display = 'block';
  document.getElementById('previsaoProximoMesTitulo').textContent = 'Previsão para ' + monthLabel(p.mKey);
  document.getElementById('previsaoProximoMesBody').innerHTML = `
    <div class="comp-ano-linha"><span>Total previsto</span><span style="font-weight:800">${fmtMoney(p.total)}</span></div>
    <div class="comp-ano-linha"><span>· Contas conhecidas (fixos, futuras, parcelas)</span><span>${fmtMoney(p.certo)}</span></div>
    <div class="comp-ano-linha"><span>· Estimativa cartão à vista (média 3 meses)</span><span>${fmtMoney(p.estimado)}</span></div>
    <div style="font-size:11px;color:var(--text-faint);margin-top:4px">Contas Futuras já agendadas: ${fmtMoney(p.futuro)} — é a parte mais confiável dessa previsão.</div>
  `;
}
/* ================= RESUMO GERAL (página dedicada) ================= */
function abrirResumoGeral(){
  document.getElementById('pageResumoGeral').classList.add('active');
  try{
    renderResumoGeral();
  }catch(e){
    console.error('[RESUMO-GERAL] erro ao montar a página:', e);
    document.getElementById('resumoGeralConteudo').innerHTML = `<div class="card"><div class="card-title"><div class="left">Não deu pra montar o Resumo Geral</div></div><div class="comp-ano-linha"><span>Erro: ${(e && e.message) ? e.message : e}</span></div><div style="font-size:11px;color:var(--text-faint);margin-top:6px">Manda um print dessa tela pro Claude poder corrigir.</div></div>`;
  }
}
function closeResumoGeral(){
  document.getElementById('pageResumoGeral').classList.remove('active');
}
function totalCartoesNoMesAtual(){
  return (state.cartoesTracker||[]).reduce((s,c)=>{
    const compras = (state.comprasTracker||[]).filter(cp=>cp.cartaoId===c.id && !cp.pago);
    const usado = compras.reduce((s2,item)=>{ const calc=compraTrackerCalc(item); return s2 + (calc.status==='concluido'?0:calc.restante); },0) + (c.credoVista?.reduce((s2,v)=>s2+Number(v.valor||0),0)||0);
    return s + usado;
  },0);
}
function renderResumoGeral(){
  const mKey = state.focusMonth;
  const dados = dadosDoMes(mKey);
  const vilao = calcularVilaoOrcamento(mKey);
  const essencialMin = calcularGastoEssencialMinimo(mKey);
  const mesAnterior = addMonths(mKey, -1);
  const anterior = dadosDoMes(mesAnterior);
  const previsao = calcularPrevisaoProximoMes();
  const contasFuturas = getContasDoMes(mKey).filter(it=>it.cat==='futuro');
  const totalCartoes = totalCartoesNoMesAtual();
  const categorias = [
    { label:'Moradia', valor: categoryTotalForMonth('moradia', mKey) },
    { label:'Fixos', valor: categoryTotalForMonth('fixo', mKey) },
    { label:'Assinaturas', valor: categoryTotalForMonth('assinatura', mKey) },
    { label:'Contas Futuras', valor: categoryTotalForMonth('futuro', mKey) },
    { label:'Cartão', valor: totalCartoes },
  ];
  const maiorCategoria = Math.max(1, ...categorias.map(c=>c.valor));
  const credoVistaCats = credoVistaTotalPorCategoria(mKey);
  const credoVistaEntries = Object.entries(credoVistaCats).sort((a,b)=>b[1]-a[1]);
  const maiorCredoVista = Math.max(1, ...credoVistaEntries.map(e=>e[1]));

  let html = `
    <div class="rg-hero">
      <div class="rg-hero-lbl">Saldo de ${monthLabel(mKey)}</div>
      <div class="rg-hero-val">${fmtMoneySigned(dados.sobra)}</div>
      <div class="rg-hero-row"><span>Renda ${fmtMoney(dados.renda)}</span><span>Gastos ${fmtMoney(dados.gastoTotal)}</span></div>
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Vilão do Orçamento</div></div>
      ${vilao ? `<div class="comp-ano-linha"><span>🔺 ${CATEGORIA_LABELS[vilao.cat]}</span><span>${fmtMoney(vilao.anterior)} → ${fmtMoney(vilao.atual)}</span><span style="color:var(--danger);font-weight:800">+${vilao.diffPct.toFixed(0)}%</span></div>` : `<div class="comp-ano-linha"><span>Nenhuma categoria disparou em relação ao mês passado</span></div>`}
      <div class="comp-ano-linha"><span>Gasto essencial mínimo</span><span style="font-weight:800">${fmtMoney(essencialMin)}</span></div>
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Comparado a ${monthLabel(mesAnterior)}</div></div>
      <div class="comp-ano-linha"><span>Gastos</span><span>${fmtMoney(anterior.gastoTotal)} → ${fmtMoney(dados.gastoTotal)}</span></div>
      <div class="comp-ano-linha"><span>Sobra</span><span>${fmtMoneySigned(anterior.sobra)} → ${fmtMoneySigned(dados.sobra)}</span></div>
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Previsão para ${monthLabel(previsao.mKey)}</div></div>
      <div class="comp-ano-linha"><span>Total previsto</span><span style="font-weight:800">${fmtMoney(previsao.total)}</span></div>
      <div class="comp-ano-linha"><span>· Contas conhecidas</span><span>${fmtMoney(previsao.certo)}</span></div>
      <div class="comp-ano-linha"><span>· Estimativa cartão à vista</span><span>${fmtMoney(previsao.estimado)}</span></div>
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Gasto por categoria — ${monthLabel(mKey)}</div></div>
      ${categorias.map(c=>`<div class="rg-cat-bar-row"><span>${c.label}</span><div class="rg-cat-bar-track"><div class="rg-cat-bar-fill" style="width:${Math.round(c.valor/maiorCategoria*100)}%"></div></div><span style="font-weight:700">${fmtMoney(c.valor)}</span></div>`).join('')}
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Contas Futuras de ${monthLabel(mKey)}</div></div>
      ${contasFuturas.length===0 ? '<div class="comp-ano-linha"><span>Nenhuma conta futura neste mês</span></div>' : contasFuturas.map(it=>`<div class="comp-ano-linha"><span>${it.desc}</span><span style="font-weight:700">${fmtMoney(it.valor)}</span></div>`).join('')}
    </div>

    <div class="card">
      <div class="card-title"><div class="left">Cartão — à vista por categoria (${monthLabel(mKey)})</div></div>
      ${credoVistaEntries.length===0 ? '<div class="comp-ano-linha"><span>Nenhum crédito à vista lançado neste mês</span></div>' : credoVistaEntries.map(([cat,valor])=>`<div class="rg-cat-bar-row"><span>${cat}</span><div class="rg-cat-bar-track"><div class="rg-cat-bar-fill" style="width:${Math.round(valor/maiorCredoVista*100)}%"></div></div><span style="font-weight:700">${fmtMoney(valor)}</span></div>`).join('')}
    </div>
  `;
  document.getElementById('resumoGeralConteudo').innerHTML = html;
}

/* ================= EXPORTAR RESUMO FINANCEIRO EM PDF ================= */
function exportarResumoFinanceiroPDF(){
  if(typeof window.jspdf === 'undefined'){
    showToast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.');
    return;
  }
  const mKey = state.focusMonth;
  const dados = dadosDoMes(mKey);
  const vilao = calcularVilaoOrcamento(mKey);
  const previsao = calcularPrevisaoProximoMes();
  const contasFuturas = getContasDoMes(mKey).filter(it=>it.cat==='futuro');
  const totalCartoes = totalCartoesNoMesAtual();
  const credoVistaCats = credoVistaTotalPorCategoria(mKey);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const graphite = [37,41,46];
  const pageW = 595;
  const marginX = 40;

  doc.setFillColor(...graphite);
  doc.rect(0,0,pageW,70,'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(15);
  doc.text('RESUMO FINANCEIRO — SILOÉ', marginX, 32);
  doc.setFont('helvetica','normal');
  doc.setFontSize(10.5);
  doc.text(monthLabelLong(mKey), marginX, 50);

  let y = 96;
  doc.setTextColor(30,30,32);
  doc.setFontSize(11);
  doc.setFont('helvetica','bold');
  doc.text(`Renda: ${fmtMoney(dados.renda)}   Gastos: ${fmtMoney(dados.gastoTotal)}   Sobra: ${fmtMoneySigned(dados.sobra)}`, marginX, y);
  y += 24;

  doc.autoTable({
    startY: y,
    head: [['Categoria','Valor no mês']],
    body: [
      ['Moradia', fmtMoney(categoryTotalForMonth('moradia', mKey))],
      ['Fixos', fmtMoney(categoryTotalForMonth('fixo', mKey))],
      ['Assinaturas', fmtMoney(categoryTotalForMonth('assinatura', mKey))],
      ['Contas Futuras', fmtMoney(categoryTotalForMonth('futuro', mKey))],
      ['Cartão (parcelas + à vista)', fmtMoney(totalCartoes)],
    ],
    theme: 'grid',
    headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9.5 },
    bodyStyles: { fontSize:9.5, textColor:[40,40,40] },
    styles: { lineColor:[230,230,232], lineWidth:0.5 },
    margin: { left:marginX, right:marginX }
  });
  y = doc.lastAutoTable.finalY + 24;

  if(contasFuturas.length){
    doc.autoTable({
      startY: y,
      head: [['Contas Futuras — ' + monthLabel(mKey), 'Valor']],
      body: contasFuturas.map(it=>[it.desc, fmtMoney(it.valor)]),
      theme: 'grid',
      headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9.5 },
      bodyStyles: { fontSize:9.5, textColor:[40,40,40] },
      styles: { lineColor:[230,230,232], lineWidth:0.5 },
      margin: { left:marginX, right:marginX }
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  const credoRows = Object.entries(credoVistaCats);
  if(credoRows.length){
    doc.autoTable({
      startY: y,
      head: [['Cartão à vista por categoria', 'Valor']],
      body: credoRows.map(([cat,valor])=>[cat, fmtMoney(valor)]),
      theme: 'grid',
      headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9.5 },
      bodyStyles: { fontSize:9.5, textColor:[40,40,40] },
      styles: { lineColor:[230,230,232], lineWidth:0.5 },
      margin: { left:marginX, right:marginX }
    });
    y = doc.lastAutoTable.finalY + 24;
  }

  doc.autoTable({
    startY: y,
    head: [['Previsão — ' + monthLabel(previsao.mKey), 'Valor']],
    body: [
      ['Contas conhecidas (fixos, futuras, parcelas)', fmtMoney(previsao.certo)],
      ['Estimativa cartão à vista (média 3 meses)', fmtMoney(previsao.estimado)],
      ['Total previsto', fmtMoney(previsao.total)],
    ],
    theme: 'grid',
    headStyles: { fillColor:graphite, textColor:255, fontStyle:'bold', fontSize:9.5 },
    bodyStyles: { fontSize:9.5, textColor:[40,40,40] },
    styles: { lineColor:[230,230,232], lineWidth:0.5 },
    margin: { left:marginX, right:marginX }
  });
  y = doc.lastAutoTable.finalY + 20;

  doc.setFontSize(8);
  doc.setTextColor(140,140,144);
  if(vilao){
    doc.text(`Vilão do orçamento: ${CATEGORIA_LABELS[vilao.cat]} subiu ${vilao.diffPct.toFixed(0)}% (${fmtMoney(vilao.anterior)} → ${fmtMoney(vilao.atual)})`, marginX, y);
  }

  const fileName = `Resumo Financeiro - ${monthLabel(mKey)}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type:'application/pdf' });
  if(navigator.canShare && navigator.canShare({ files:[file] })){
    navigator.share({ files:[file], title:'Resumo Financeiro', text:monthLabel(mKey) }).catch(()=>{
      doc.save(fileName);
    });
  }else{
    doc.save(fileName);
  }
}

function toggleVilaoInfo(){
  const el = document.getElementById('vilaoInfoPopup');
  if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
}
/* ================= VILÃO DO ORÇAMENTO ================= */
function calcularVilaoOrcamento(mKey){
  const categorias = ['moradia','fixo','assinatura','futuro'];
  const mesAnterior = addMonths(mKey, -1);
  let vilao = null;
  categorias.forEach(cat=>{
    const atual = categoryTotalForMonth(cat, mKey);
    const anterior = categoryTotalForMonth(cat, mesAnterior);
    if(anterior <= 0 || atual <= anterior) return;
    const diffPct = (atual-anterior)/anterior*100;
    if(!vilao || diffPct > vilao.diffPct){
      vilao = { cat, atual, anterior, diffPct };
    }
  });
  return vilao;
}
function calcularGastoEssencialMinimo(mKey){
  return getContasDoMes(mKey).reduce((s,it)=> it.essencial!==false ? s + (Number(it.valor)||0) : s, 0);
}
function renderVilaoOrcamento(){
  const card = document.getElementById('cardVilaoOrcamento');
  if(!card) return;
  const mKey = state.focusMonth;
  const vilao = calcularVilaoOrcamento(mKey);
  const essencialMin = calcularGastoEssencialMinimo(mKey);
  if(!vilao && essencialMin<=0){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  let html = '';
  if(vilao){
    html += `<div class="comp-ano-linha"><span>🔺 ${CATEGORIA_LABELS[vilao.cat]}</span><span>${fmtMoney(vilao.anterior)} → ${fmtMoney(vilao.atual)}</span><span style="color:var(--danger);font-weight:800">+${vilao.diffPct.toFixed(0)}%</span></div>`;
  }
  html += `<div class="comp-ano-linha"><span>Gasto essencial mínimo</span><span style="font-weight:800">${fmtMoney(essencialMin)}</span></div>`;
  document.getElementById('vilaoOrcamentoBody').innerHTML = html;
}

/* ================= FLUXO DE CAIXA DIÁRIO ================= */
function calcularFluxoCaixa(mKey){
  const eventos = {};
  const diaRecebimento = state.diaRecebimentoRenda || 5;
  ['davi','cris'].forEach(u=>{
    const isAtual = mKey === mesFinanceiroAtual();
    if(isAtual && state.users[u].usarSaldoComoBase){
      const saldo = state.users[u].saldoAtual || 0;
      if(saldo) eventos[diaRecebimento] = (eventos[diaRecebimento]||0) + saldo;
      return;
    }
    const base = rendaBaseForMonth(u, mKey) + (isAtual ? (state.users[u].saldoAtual||0) : 0);
    if(base) eventos[diaRecebimento] = (eventos[diaRecebimento]||0) + base;
    (state.users[u].extras||[]).forEach(e=>{
      const fim = e.mesFim || e.mesInicio;
      if(mKey >= e.mesInicio && mKey <= fim){
        const d = Math.min(Math.max(parseInt(e.dia)||diaRecebimento,1),28);
        eventos[d] = (eventos[d]||0) + (Number(e.valor)||0);
      }
    });
  });
  getContasDoMes(mKey).forEach(it=>{
    const d = Math.min(Math.max(parseInt(it.dia)||1,1),28);
    eventos[d] = (eventos[d]||0) - (Number(it.valor)||0);
  });
  const dias = Object.keys(eventos).map(Number).sort((a,b)=>a-b);
  let acumulado = 0;
  let pontos = [];
  let minPonto = null;
  dias.forEach(d=>{
    acumulado += eventos[d];
    const p = { dia:d, delta:eventos[d], saldo:acumulado };
    pontos.push(p);
    if(!minPonto || p.saldo < minPonto.saldo) minPonto = p;
  });
  return { pontos, minPonto, diaRecebimento };
}
function editarDiaRecebimento(){
  const atual = state.diaRecebimentoRenda || 5;
  const novo = prompt('Em que dia do mês a renda entra? (usado só pra estimar o fluxo de caixa)', atual);
  if(novo === null) return;
  const n = Math.min(28, Math.max(1, parseInt(novo)||5));
  state.diaRecebimentoRenda = n;
  persist();
  renderFluxoCaixa();
}
function renderFluxoCaixa(){
  const mKey = state.focusMonth;
  const labelEl = document.getElementById('fluxoCaixaMesLabel');
  if(!labelEl) return;
  labelEl.textContent = monthLabel(mKey);
  const { pontos, minPonto } = calcularFluxoCaixa(mKey);
  const resumoEl = document.getElementById('fluxoCaixaResumo');
  const listaEl = document.getElementById('fluxoCaixaLista');
  if(pontos.length===0){
    resumoEl.innerHTML = `<div class="empty-state-sm">Sem movimentações neste mês</div>`;
    listaEl.innerHTML = '';
    return;
  }
  if(minPonto && minPonto.saldo < 0){
    resumoEl.innerHTML = `<div class="fluxo-alerta negativo">⚠️ Ponto mais apertado: dia ${minPonto.dia}, saldo projetado ${fmtMoneySigned(minPonto.saldo)}</div>`;
  } else {
    resumoEl.innerHTML = `<div class="fluxo-alerta positivo">✓ O saldo projetado não fica negativo em nenhum dia deste mês</div>`;
  }
  listaEl.innerHTML = pontos.map(p=>{
    const isMin = minPonto && p.dia===minPonto.dia && p.saldo===minPonto.saldo;
    return `<div class="fluxo-linha${isMin?' fluxo-linha-min':''}">
      <span class="fluxo-dia">Dia ${p.dia}</span>
      <span class="fluxo-delta ${p.delta>=0?'positive':'negative'}">${fmtMoneySigned(p.delta)}</span>
      <span class="fluxo-saldo ${p.saldo>=0?'positive':'negative'}">${fmtMoneySigned(p.saldo)}</span>
    </div>`;
  }).join('');
}

/* ================= PARCELAS TERMINANDO ================= */
function getParcelasTerminando(mKeyRef, janelaMeses){
  const resultado = [];
  ['davi','cris'].forEach(u=>{
    (state.users[u].expenses.futuro||[]).forEach(item=>{
      if(item.recorrente) return;
      const parcelas = item.parcelas || 1;
      if(parcelas<=1 || !item.mesInicio) return;
      const mesFim = addMonths(item.mesInicio, parcelas-1);
      let dentro = false;
      let m = mKeyRef;
      for(let i=0;i<janelaMeses;i++){
        if(m===mesFim){ dentro = true; break; }
        m = addMonths(m,1);
      }
      if(dentro){
        resultado.push({ user:u, desc:item.desc, valor: futuroValorNoMes(item, mesFim), mesFim, origem:'conta' });
      }
    });
  });
  (state.comprasTracker||[]).forEach(item=>{
    if(item.pago || !item.mesInicio) return;
    const c = compraTrackerCalc(item);
    if(!c.mesFim || c.parcelas<=1) return;
    let dentro = false;
    let m = mKeyRef;
    for(let i=0;i<janelaMeses;i++){
      if(m===c.mesFim){ dentro = true; break; }
      m = addMonths(m,1);
    }
    if(dentro){
      resultado.push({ user:null, desc:item.nome+' (cartão)', valor:c.valorParcela, mesFim:c.mesFim, origem:'cartao' });
    }
  });
  resultado.sort((a,b)=> a.mesFim < b.mesFim ? -1 : 1);
  return resultado;
}
function renderParcelasTerminando(){
  const card = document.getElementById('cardParcelasTerminando');
  if(!card) return;
  const lista = getParcelasTerminando(state.focusMonth, 4);
  if(lista.length===0){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  const porMes = {};
  lista.forEach(p=>{ porMes[p.mesFim] = (porMes[p.mesFim]||0)+1; });
  const avisoJuntas = Object.keys(porMes).filter(m=>porMes[m]>=2)
    .map(m=>`<div class="fluxo-alerta negativo">⚠️ ${porMes[m]} parcelas terminam juntas em ${monthLabel(m)} — cuidado pra não gastar o alívio todo em outra coisa</div>`)
    .join('');
  document.getElementById('parcelasTerminandoLista').innerHTML = avisoJuntas + lista.map(p=>
    `<div class="parcela-fim-item">
      ${p.user?`<span class="user-tag ${p.user}">${p.user==='davi'?'Davi':'Cris'}</span>`:''}
      <span class="parcela-fim-desc">${p.desc}</span>
      <span class="parcela-fim-info">termina em <b>${monthLabel(p.mesFim)}</b> · libera ${fmtMoney(p.valor)}/mês</span>
    </div>`
  ).join('');
}

/* ================= LEMBRETE DE VENCIMENTO ================= */
function diasParaVencimento(it, mKey){
  if(mKey !== mesFinanceiroAtual()) return null;
  const d = keyToDate(mKey);
  const alvo = new Date(d.getFullYear(), d.getMonth(), parseInt(it.dia)||1);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.round((alvo - hoje) / 86400000);
}
function editarDiasAviso(){
  const atual = state.diasAvisoVencimento ?? 3;
  const novo = prompt('Avisar com quantos dias de antecedência antes do vencimento?', atual);
  if(novo === null) return;
  const n = Math.min(15, Math.max(0, parseInt(novo)||0));
  state.diasAvisoVencimento = n;
  persist();
  renderChecklist();
}
function renderVencendoEmBreve(){
  const el = document.getElementById('vencendoEmBreveBanner');
  if(!el) return;
  const mKey = state.focusMonth;
  const diasAviso = state.diasAvisoVencimento ?? 3;
  const itens = getContasDoMes(mKey).filter(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    if(state.paid[paidKey]) return false;
    const dias = diasParaVencimento(it, mKey);
    return dias !== null && dias >= 0 && dias <= diasAviso;
  });
  if(itens.length===0){ el.style.display = 'none'; el.innerHTML=''; return; }
  el.style.display = 'block';
  el.innerHTML = `<div class="vencendo-titulo">⏰ Vencendo em breve</div>` + itens.map(it=>{
    const dias = diasParaVencimento(it, mKey);
    const label = dias===0 ? 'vence hoje' : (dias===1 ? 'vence amanhã' : `vence em ${dias}d`);
    return `<div class="vencendo-item"><span>${it.desc}</span><span class="vencendo-tag">${label}</span></div>`;
  }).join('');
}
function contasEmAbertoNoMes(mKey){
  return getContasDoMes(mKey).filter(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    return !state.paid[paidKey];
  }).length;
}
function renderChecklist(){
  const mKey = state.focusMonth;
  const mesAnteriorKey = addMonths(mKey, -1);
  const arquivadas = state.contasArquivadas || {};

  let itemsAtual = getContasDoMes(mKey).map(it=>Object.assign({}, it, { mesOrigem: mKey }));
  let itemsAnterior = getContasDoMes(mesAnteriorKey).map(it=>Object.assign({}, it, { mesOrigem: mesAnteriorKey }));

  itemsAtual = itemsAtual.filter(it=> !arquivadas[mKey+'_'+it.user+'_'+it.cat+'_'+it.id]);
  itemsAnterior = itemsAnterior.filter(it=>{
    const pk = mesAnteriorKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    return !state.paid[pk] && !arquivadas[pk];
  });

  const items = itemsAnterior.concat(itemsAtual);

  const list = document.getElementById('contasChecklist');
  if(items.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="title">Nenhuma conta neste mês</div><div class="desc">Adicione gastos no Planner</div></div>`;
    return;
  }
  items.sort((a,b)=>{
    if(a.mesOrigem !== b.mesOrigem) return a.mesOrigem < b.mesOrigem ? -1 : 1;
    if(a.user !== b.user) return a.user === 'davi' ? -1 : 1;
    return (b.valor||0) - (a.valor||0);
  });
  list.innerHTML = items.map(it=>{
    const paidKey = it.mesOrigem+'_'+it.user+'_'+it.cat+'_'+it.id;
    const isPaid = !!state.paid[paidKey];
    const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
    const isParcial = !isPaid && valorPago > 0;
    const logo = it.logoUrl
      ? `<img src="${it.logoUrl}" class="conta-logo">`
      : `<div class="conta-logo conta-logo-placeholder">${it.desc.charAt(0).toUpperCase()}</div>`;
    const tagMes = it.mesOrigem !== mKey ? `<span class="conta-mes-tag">${monthLabel(it.mesOrigem)}</span>` : '';
    const isNova = it.mesInicio && it.mesInicio === it.mesOrigem;
    const diasAviso = state.diasAvisoVencimento ?? 3;
    const diasVenc = !isPaid ? diasParaVencimento(it, it.mesOrigem) : null;
    const venceEmBreve = diasVenc !== null && diasVenc >= 0 && diasVenc <= diasAviso;
    const valorMudouRecente = it.cat==='assinatura' && it.historico && it.historico.length>0 && it.historico[it.historico.length-1].mKey===mesFinanceiroAtual();
    const badges = `${isNova?'<span class="badge-nova">NOVA</span>':''}${it.tipo==='variavel'?'<span class="badge-variavel">VARIÁVEL</span>':''}${it.essencial===false?'<span class="badge-nao-essencial">NÃO ESSENCIAL</span>':''}${valorMudouRecente?`<span class="badge-mudou">valor mudou (era ${fmtMoney(it.historico[it.historico.length-1].valor)})</span>`:''}${venceEmBreve?`<span class="badge-vence">${diasVenc===0?'vence hoje':diasVenc===1?'vence amanhã':'vence em '+diasVenc+'d'}</span>`:''}`;
    const corDia = diasVenc===null ? '' : (diasVenc<=3?' dia-urgente':(diasVenc<=7?' dia-proximo':' dia-distante'));
    return `<div class="check-item-compact ${isPaid?'paid':''}"
      onpointerdown="contaTapStart(event,'${paidKey}','${it.user}','${it.cat}','${it.id}','${it.mesOrigem}')" onpointerup="contaTapEnd(event,'${paidKey}')" onpointercancel="contaTapCancel()" onpointerleave="contaTapCancel()">
      ${logo}
      <div class="info">
        <div class="desc">${it.desc}</div>
        <div class="meta"><span class="user-tag ${it.user}">${it.user==='davi'?'Davi':'Cris'}</span> · <span class="dia-tag${corDia}">dia ${it.dia}</span>${tagMes}</div>
        <div class="valor-linha">${fmtMoney(it.valor)}${isParcial?`<span class="valor-parcial">· pago ${fmtMoney(valorPago)}</span>`:''}</div>
        ${badges?`<div class="badges-linha">${badges}</div>`:''}
      </div>
    </div>`;
  }).join('');
}
let contaTapTimer = null;
let contaTapClickTimer = null;
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
  if(contaTapLongFired) return;
  if(contaTapClickTimer){
    clearTimeout(contaTapClickTimer);
    contaTapClickTimer = null;
    confirmarEArquivarConta(paidKey);
  }else{
    contaTapClickTimer = setTimeout(()=>{
      contaTapClickTimer = null;
      togglePaid(paidKey);
    }, 280);
  }
}
function contaTapCancel(){
  clearTimeout(contaTapTimer);
}
function confirmarEArquivarConta(paidKey){
  state.paid[paidKey] = true;
  if(!state.contasArquivadas) state.contasArquivadas = {};
  state.contasArquivadas[paidKey] = true;
  if(state.pagamentosParciais) delete state.pagamentosParciais[paidKey];
  persist();
  renderPanorama();
  if(navigator.vibrate) navigator.vibrate([10,30,10]);
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

