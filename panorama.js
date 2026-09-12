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
    </div>
    <div style="margin-top:var(--s4);padding:var(--s3);background:var(--card-2);border-radius:var(--radius-md)">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-dim);margin-bottom:var(--s3)">Distribuição por Categoria (Ordenado)</div>
      <div class="bar-chart">${barChart}</div>
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
    return `<div class="check-item-compact ${isPaid?'paid':''}"
      onpointerdown="contaTapStart(event,'${paidKey}','${it.user}','${it.cat}','${it.id}','${it.mesOrigem}')" onpointerup="contaTapEnd(event,'${paidKey}')" onpointercancel="contaTapCancel()" onpointerleave="contaTapCancel()">
      ${logo}
      <div class="info">
        <div class="desc">${it.desc}${tagMes}</div>
        <div class="meta"><span class="user-tag ${it.user}">${it.user==='davi'?'Davi':'Cris'}</span> · dia ${it.dia} · ${fmtMoney(it.valor)}${isParcial?` <span style="color:var(--warning);font-weight:700">· pago ${fmtMoney(valorPago)}</span>`:''}</div>
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

