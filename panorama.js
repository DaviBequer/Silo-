/* ================= RENDER: PANORAMA ================= */
/* ================= PLANEJADOR DE METAS / SIMULADOR ================= */
/* ================= DASHBOARD (abas Geral / Cartão) ================= */
let dashTabAtiva = 'geral';
function switchDashTab(tab){
  dashTabAtiva = tab;
  const aba = document.getElementById('aba-planner');
  if(aba) aba.dataset.tab = tab;
  document.querySelectorAll('.dash-tab').forEach(el=>el.classList.toggle('active', el.dataset.dtab===tab));
  renderPanorama();
  if(tab==='emprestimo' && typeof renderEmprestimos==='function') renderEmprestimos();
  window.scrollTo(0,0);
  if(typeof applyAllLayouts==='function') setTimeout(applyAllLayouts, 60);
}
/* usuário que o Dashboard está mostrando (Davi ou Cris) */
function userDash(){ return state.currentUser || 'davi'; }

/* Redesenha o que depende de cálculo: acumulado do Geral, acumulado do Cartão e, se estiver aberta, a tela Contas a pagar */
function renderPanorama(){
  const months = getPanoWindowMonths();
  if(!months.includes(state.focusMonth)) state.focusMonth = months[0];
  const lbl = monthLabel(months[0])+' – '+monthLabel(months[5]);
  ['panoWindowLabel','panoWindowLabelCartao'].forEach(id=>{ const el = document.getElementById(id); if(el) el.textContent = lbl; });
  renderResumoMes();
  renderAcumTable(months);
  renderAcumCartao(months);
  const cp = document.getElementById('pageContasPagar');
  if(cp && cp.classList.contains('active')) renderContasPagar();
}

/* Resumo do mês atual no topo do Dashboard: o que entra, o que falta pagar e quanto sobra */
function renderResumoMes(){
  const elMes = document.getElementById('resumoMesLabel');
  if(!elMes || !state.users) return;
  if(typeof renderHeaderHoje==='function') renderHeaderHoje();   // "falta pagar" do cabeçalho acompanha
  const u = userDash(), mKey = mesFinanceiroAtual();
  const saldo = state.users[u].saldoAtual || 0;
  const entra = incomeForMonth(u, mKey) - saldo;
  const sai = expensesForMonth(u, mKey);
  const sobra = saldoForMonth(u, mKey);
  elMes.textContent = monthLabelLong(mKey);
  document.getElementById('resumoEntra').textContent = fmtMoney(entra);
  document.getElementById('resumoSai').textContent = fmtMoney(sai);
  const elSobra = document.getElementById('resumoSobra');
  elSobra.textContent = fmtMoneySigned(sobra);
  elSobra.className = 'resumo-stat-val ' + (sobra >= 0 ? 'pos' : 'neg');
  /* atalhos: cartão / empréstimo contando (ou não) neste mês */
  const elInc = document.getElementById('resumoInclui');
  if(elInc){
    const chip = (tipo, rotulo, valor)=>{
      const on = incluiNoGeral(tipo, mKey);
      return `<button type="button" class="inclui-chip${on?' on':''}" onclick="toggleGeralMes('${tipo}','${mKey}')" title="${on?'Toque para tirar deste mês':'Toque para contar neste mês'}"><span class="mini-switch${on?' on':''}"><span></span></span>${rotulo} <b>${fmtMoney(valor)}</b></button>`;
    };
    let h = '';
    if(u==='davi' && (state.cartoesTracker||[]).length) h += chip('cartao', 'Cartão', cartaoValorGeralNoMes(mKey));
    if(u==='davi' && (state.emprestimos||[]).length) h += chip('emprestimo', 'Empréstimo', emprestimoValorGeralNoMes(mKey));
    elInc.innerHTML = h;
    elInc.style.display = h ? '' : 'none';
  }
  const dizimoAberto = (u==='davi' && dizimoValorCheio(u, mKey) > 0 && !dizimoPagoNoMes(u, mKey)) ? 1 : 0;
  const abertas = getContasDoMes(mKey, u).filter(it=>!state.paid[mKey+'_'+it.user+'_'+it.cat+'_'+it.id]).length + cpExtrasAbertosNoMes(mKey, u) + dizimoAberto;
  document.getElementById('resumoContasAbertas').textContent = abertas ? abertas+' em aberto ›' : 'tudo pago ›';
}

/* ===== Detalhe do "Vai entrar" e do "Falta pagar" (toque nos números do resumo) =====
   As listas somam exatamente o número mostrado no resumo. */
function rdLinha(o){
  const ico = o.logoUrl ? `<img src="${o.logoUrl}" class="conta-logo" alt="">` : `<span class="gm-inicial${o.icoClasse?' '+o.icoClasse:''}">${o.ico || escBanco((o.nome||'?').charAt(0).toUpperCase())}</span>`;
  return `<div class="gm-linha${o.feito?' pago':''}">${ico}<div class="gm-info"><div class="gm-nome">${escBanco(o.nome)}</div>${o.sub?`<div class="gm-sub">${o.sub}</div>`:''}</div><div class="gm-valor">${fmtMoney(o.valor)}</div></div>`;
}
function rdGrupo(nome, linhas){
  const ativas = linhas.filter(l=>!l.feito), sub = ativas.reduce((s,l)=>s+l.valor, 0);
  if(!linhas.length) return '';
  return `<div class="gm-grupo"><div class="gm-grupo-topo"><span>${nome}</span><span>${fmtMoney(sub)}</span></div>${linhas.map(rdLinha).join('')}</div>`;
}
function abrirDetalheResumo(tipo){
  const u = userDash(), mKey = mesFinanceiroAtual();
  let html = '', total = 0, titulo = '', cor = '';
  if(tipo === 'entra'){
    titulo = 'Vai entrar'; cor = 'pos';
    const recebido = salarioRecebidoNoMes(u, mKey), base = rendaBaseForMonth(u, mKey);
    const salario = [{ nome: u==='davi' ? 'Salário' : 'Renda', ico:'R$', icoClasse:'pos',
      sub: recebido ? '✓ recebido · já está no saldo' : (u==='davi' ? 'Ponto PJ de '+monthLabelLong(addMonths(mKey,-1)) : ''), valor: base, feito: recebido }];
    const extras = (state.users[u].extras||[]).filter(e=>extraNoPeriodo(e, mKey)).map(e=>{
      const rec = extraRecebidoNoMes(e, mKey);
      return { nome: e.desc || 'Extra', ico:'+', icoClasse:'pos', sub: rec ? '✓ recebido · já está no saldo' : (e.dia ? 'dia '+e.dia : ''), valor: Number(e.valor)||0, feito: rec };
    });
    html = rdGrupo('Renda', salario) + rdGrupo('Extras', extras);
    total = incomeForMonth(u, mKey) - (state.users[u].saldoAtual || 0);
  } else {
    titulo = 'Falta pagar'; cor = 'neg';
    const contas = gastosDoMes(u, mKey).filter(g=>g.restante > 0.004).sort((a,b)=>b.restante-a.restante).map(g=>({
      nome: g.desc, logoUrl: g.logoUrl, valor: g.restante,
      sub: g.restante < g.valor - 0.004 ? `pago em parte · total ${fmtMoney(g.valor)}` : (g.dia ? 'dia '+g.dia : '')
    }));
    html += rdGrupo('Contas', contas);
    const diz = dizimoForMonth(u, mKey);
    if(diz > 0.004) html += rdGrupo('Dízimo', [{ nome:'Dízimo', ico:'♡', sub:'10% do salário', valor: diz }]);
    if(u === 'davi'){
      if(incluiNoGeral('cartao', mKey)){
        const cartoes = (state.cartoesTracker||[]).map(c=>({ nome: c.nome || 'Cartão', logoUrl: c.logoUrl, sub: c.vencimento ? 'fatura · vence dia '+c.vencimento : 'fatura', valor: faturaRestanteNoMes(c, mKey) })).filter(c=>c.valor > 0.004);
        html += rdGrupo('Cartão', cartoes);
      }
      if(incluiNoGeral('emprestimo', mKey)){
        const emps = (state.emprestimos||[]).map(emp=>{
          const n = empPendentes(emp).filter(k=>monthKey(empVencimento(emp,k))===mKey).length;
          return { nome: emp.nome || 'Empréstimo', logoUrl: emp.logoUrl, sub: n>1 ? n+' parcelas' : 'parcela do mês', valor: n*(Number(emp.valorParcela)||0) };
        }).filter(e=>e.valor > 0.004);
        html += rdGrupo('Empréstimo', emps);
      }
    }
    total = expensesForMonth(u, mKey);
  }
  document.getElementById('resumoDetalheTopo').innerHTML = `<div class="rd-rotulo">${titulo} · ${monthLabelLong(mKey)}</div><div class="rd-total ${cor}">${fmtMoney(total)}</div>`;
  document.getElementById('resumoDetalheLista').innerHTML = html || `<div class="gm-vazio">${tipo==='entra'?'Nada para entrar neste mês.':'Nada para pagar neste mês. ✓'}</div>`;
  document.getElementById('modalResumoDetalhe').dataset.modo = 'resumo';
  document.getElementById('modalResumoDetalhe').classList.add('active');
  document.body.style.overflow = 'hidden';
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

/* Preenche o valor da meta com o total em aberto nos cartões, pra simular um empréstimo que quita tudo */
function usarTotalCartoesNaMeta(){
  const total = totalCartoesNoMesAtual();
  if(!total){ showToast('Não há valor em aberto nos cartões'); return; }
  document.getElementById('simMetaValor').value = total.toFixed(2).replace('.',',');
  if(!document.getElementById('simMetaNome').value.trim()) document.getElementById('simMetaNome').value = 'Empréstimo (quitar cartão)';
  showToast('Valor dos cartões preenchido: ' + fmtMoney(total));
}
function adicionarMetaSimulador(){  const nome = document.getElementById('simMetaNome').value.trim();
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
  const alertaHtml = primeiroMesComImpacto ? `<div style="margin-top:var(--s4)">${bannerGeo('negativo','alerta','Saldo ficaria negativo',`Primeiro mês no vermelho: ${primeiroMesComImpacto.label}`)}</div>` : '';
  
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

function categoryTotalForMonth(cat, mKey){
  let total = 0;
  ['davi'].forEach(user=>{ // Dashboard: só Davi
    const ex = state.users[user].expenses;
    if(cat==='futuro'){
      ex.futuro.forEach(item=>{
        const v = futuroValorNoMes(item, mKey);
        if(v<=0) return;
        const paidKey = mKey+'_'+user+'_futuro_'+item.id;
        if(state.paid[paidKey]) return;
        total += restanteConta(paidKey, v);
      });
    } else {
      ex[cat].forEach(item=>{
        if(item.mesInicio && mKey < item.mesInicio) return;
        const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
        if(state.paid[paidKey]) return;
        total += restanteConta(paidKey, Number(item.valor)||0);
      });
    }
  });
  return total;
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

function expenseBreakdownForMonth(user, mKey){
  const ex = state.users[user].expenses;
  const breakdown = { moradia:0, assinatura:0, fixo:0, futuro:0, cartao:0, dizimo:0 };
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.mesInicio && mKey < item.mesInicio) return;
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
      if(state.paid[paidKey]) return;
      breakdown[cat] += restanteConta(paidKey, Number(item.valor)||0);
    });
  });
  ex.futuro.forEach(item=>{
    const v = futuroValorNoMes(item, mKey);
    if(v<=0) return;
    const paidKey = mKey+'_'+user+'_futuro_'+item.id;
    if(state.paid[paidKey]) return;
    breakdown.futuro += restanteConta(paidKey, v);
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
  [userDash()].forEach(user=>{
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
  const sobraTotal = saldoForMonth(userDash(), mKey);

  // Como chegou no acumulado
  let acumuladoHtml = '';
  let rodante = 0;
  mesesAteAqui.forEach(m=>{
    const s = saldoForMonth(userDash(), m);
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

/* Linha do tempo dos meses (usada no acumulado do Geral e no do Cartão) */
function desenharTimeline(wrapId, months, vals, onclickFn){
  const wrap = document.getElementById(wrapId);
  if(!wrap) return;
  const hoje = mesFinanceiroAtual();
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const range = (max-min) || 1;
  const chartTop = 26, chartH = 40, chartBottom = chartTop + chartH;
  const n = months.length;
  const stepX = n>1 ? 268/(n-1) : 0;
  const pts = months.map((mKey,i)=>{
    const v = vals[i];
    const x = 16 + i*stepX;
    const y = chartBottom - ((v-min)/range)*chartH;
    return {x,y,v,mKey};
  });
  const line = pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = pts.map(p=>{
    const isSelected = p.mKey===state.focusMonth;
    const isHoje = p.mKey===hoje;
    const cor = isSelected ? 'var(--gold)' : (isHoje ? 'var(--gold)' : 'var(--text-faint)');
    const r = isSelected||isHoje ? 4 : 2.5;
    return `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${cor}" style="cursor:pointer" onclick="${onclickFn(p.mKey)}"/>`;
  }).join('');
  const labels = pts.map(p=>{
    const cor = p.v>=0 ? 'var(--success)' : 'var(--danger)';
    const peso = p.mKey===state.focusMonth ? '800' : '600';
    return `<text x="${p.x}" y="${chartTop-10}" text-anchor="middle" font-size="9" font-weight="${peso}" fill="${cor}">${fmtMoneyCompactSigned(p.v)}</text>`;
  }).join('');
  const meses = pts.map(p=>{
    const isSelected = p.mKey===state.focusMonth;
    return `<div class="acum-timeline-mes${isSelected?' selected':''}" onclick="${onclickFn(p.mKey)}">${monthLabel(p.mKey)}</div>`;
  }).join('');
  wrap.innerHTML = `
    <svg viewBox="0 0 300 ${chartBottom+6}" width="100%" height="${chartBottom+6}" style="overflow:visible">
      <polyline points="${line}" fill="none" stroke="var(--line)" stroke-width="2"/>
      ${labels}
      ${dots}
    </svg>
    <div class="acum-timeline-meses">${meses}</div>
  `;
}
function renderAcumTable(months){
  const u = userDash();
  const vals = months.map(mKey=>saldoForMonth(u, mKey));
  desenharTimeline('acumTimelineWrap', months, vals, m=>`selectFocusMonth('${m}');abrirDetalheAcumulado('${m}')`);
}
/* Acumulado do Cartão: sobra do Geral (contas) − fatura dos cartões no mês */
function faturaTotalNoMes(mKey){
  return (state.cartoesTracker||[]).reduce((s,c)=>s+faturaRestanteNoMes(c, mKey), 0);
}
function sobraDoGeralNoMes(mKey){
  let sobra = 0;
  try{ sobra = Number(dadosDoMes(mKey).sobra) || 0; }catch(e){ sobra = 0; }
  /* se o cartão já entrou no Geral, devolve aqui para não descontar a fatura duas vezes */
  if(!(state.historicoMeses && state.historicoMeses[mKey])) sobra += extrasGeralNoMes('davi', mKey).cartao;
  return sobra;
}
function renderAcumCartao(months){
  months = months || getPanoWindowMonths();
  const vals = months.map(mKey=>sobraDoGeralNoMes(mKey) - faturaTotalNoMes(mKey));
  desenharTimeline('acumCartaoWrap', months, vals, m=>`selectFocusMonth('${m}');abrirDetalheCartaoMes('${m}')`);
}
function abrirDetalheCartaoMes(mKey){
  const sobra = sobraDoGeralNoMes(mKey);
  const cartoes = state.cartoesTracker || [];
  const linhas = cartoes.map(c=>{
    const f = faturaRestanteNoMes(c, mKey);
    const paga = faturaStatus(c, mKey).st==='pago';
    return `<div class="simulador-linha"><span class="label">${c.nome}${paga?' · paga ✓':''}</span><span class="valor">-${fmtMoney(f)}</span></div>`;
  }).join('') || '<div class="simulador-linha"><span class="label">Nenhum cartão cadastrado</span><span class="valor"></span></div>';
  const fatura = faturaTotalNoMes(mKey);
  const resta = sobra - fatura;
  document.getElementById('detalheAcumuladoTitulo').textContent = monthLabelExtensoCurto(mKey);
  document.getElementById('detalheAcumuladoConteudo').innerHTML = `
    <div class="simulador-painel">
      <h4>${ICON_WALLET}Sobra − fatura em ${monthLabelExtensoCurto(mKey)}</h4>
      <div class="simulador-linha"><span class="label">Sobra do Geral</span><span class="valor" style="color:${sobra>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(sobra)}</span></div>
      ${linhas}
      <div class="simulador-linha" style="border-top:2px solid var(--primary);margin-top:8px;padding-top:10px"><span class="label" style="font-weight:900">Resta</span><span class="valor" style="font-weight:900;color:${resta>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(resta)}</span></div>
    </div>`;
  document.getElementById('modalDetalheAcumulado').classList.add('active');
}

function selectFocusMonth(mKey){
  state.focusMonth = mKey;
  renderPanorama();
  persist();
}
function shiftPanoWindow(delta){
  state.panoOffset = Math.max(-1, Math.min(36, state.panoOffset + delta));
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
function getContasDoMes(mKey, usuario){
  let items = [];
  [usuario || 'davi'].forEach(u=>{
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
  const renda = incomeForMonth('davi', mKey); // Dashboard: só Davi
  const gastoTotal = expensesForMonth('davi', mKey);
  return { renda, gastoTotal, sobra: renda-gastoTotal };
}
/* ================= PREVISÃO DO PRÓXIMO MÊS ================= */
/* "Certo": moradia/fixo/assinatura recorrentes + Contas Futuras + parcelas de cartão já agendadas (datas conhecidas).
   "Estimado": crédito à vista do cartão, projetado pela média dos últimos 3 meses (é o único gasto sem data previsível). */
/* ================= RESUMO GERAL (página dedicada) ================= */
/* ================= EXPORTAR RESUMO FINANCEIRO EM PDF ================= */
/* ================= VILÃO DO ORÇAMENTO ================= */
/* ================= FLUXO DE CAIXA DIÁRIO ================= */
/* ================= PARCELAS TERMINANDO ================= */
/* ================= LEMBRETE DE VENCIMENTO ================= */
function diasParaVencimento(it, mKey){
  const d = keyToDate(mKey);
  const alvo = new Date(d.getFullYear(), d.getMonth(), parseInt(it.dia)||1);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.round((alvo - hoje) / 86400000);
}
function contasEmAbertoNoMes(mKey){
  return getContasDoMes(mKey).filter(it=>{
    const paidKey = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    return !state.paid[paidKey];
  }).length;
}
/* ================= CONTAS A PAGAR DO MÊS (recebi / paguei / contas) ================= */
let contasPagarMes = null;
function abrirContasPagar(mKey){
  contasPagarMes = (typeof mKey==='string' && /^\d{4}-\d{2}$/.test(mKey)) ? mKey : mesFinanceiroAtual();
  document.getElementById('pageContasPagar').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderContasPagar();
}
function cpNavMes(delta){
  const novo = addMonths(contasPagarMes || mesFinanceiroAtual(), delta);
  if(novo < todayKey() || novo > addMonths(mesFinanceiroAtual(), 36)) return;
  contasPagarMes = novo;
  renderContasPagar();
}
function fecharContasPagar(){
  document.getElementById('pageContasPagar').classList.remove('active');
  document.body.style.overflow = '';
  renderPlanner();   // garante que o Dashboard mostra o que foi marcado/desmarcado lá
}
/* Finalizar = conclui o mês atual e já passa para o próximo (se a tela estiver mostrando outro mês, só salva) */
async function finalizarContasPagar(){
  const mKey = contasPagarMes || mesFinanceiroAtual();
  if(mKey !== mesFinanceiroAtual()){
    persist(); fecharContasPagar(); renderPlanner(); renderPanorama();
    showToast('Contas de '+monthLabel(mKey)+' salvas');
    return;
  }
  const abertas = contasEmAbertoNoMes(mKey) + cpExtrasAbertosNoMes(mKey, userDash());
  if(abertas > 0){
    const ok = await iosConfirm(`Ainda há ${abertas} conta${abertas>1?'s':''} em aberto em ${monthLabel(mKey)}. Concluir o mês e passar para ${monthLabel(addMonths(mKey,1))} mesmo assim?`);
    if(!ok) return;
  }
  fecharContasPagar();
  concluirMesAtual();
}
function cpAtualizarTudo(){
  persist();
  renderPlanner();
  renderPanorama();   // redesenha também esta tela (ela está aberta)
}
function cpToggleSalario(u, mKey){
  setSalarioRecebido(u, mKey, !salarioRecebidoNoMes(u, mKey));
  cpAtualizarTudo();
}
function cpToggleExtra(u, id, mKey){
  const e = (state.users[u].extras||[]).find(x=>x.id===id);
  if(!e) return;
  setExtraRecebido(u, id, mKey, !extraRecebidoNoMes(e, mKey));
  cpAtualizarTudo();
}
function cpToggleDizimo(u, mKey){
  setDizimoPago(u, mKey, !dizimoPagoNoMes(u, mKey));
  cpAtualizarTudo();
}
const CP_ICON_OK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
/* linha padrão da tela Contas do mês: logo · título/sub · valor · bolinha de feito */
function cpItem(o){
  const logo = o.logoUrl
    ? `<img src="${o.logoUrl}" class="cp-logo" alt="">`
    : `<div class="cp-logo cp-logo-ph">${o.icone || (o.titulo||'?').charAt(0).toUpperCase()}</div>`;
  return `<div class="cp-item${o.feito?' feito':''}${o.parcial?' parcial':''}" ${o.attrs||''}>
    ${logo}
    <div class="cp-item-info">
      <div class="cp-item-tit">${o.titulo}${o.tag||''}</div>
      ${o.sub?`<div class="cp-item-sub">${o.sub}</div>`:''}
    </div>
    <div class="cp-item-val">${fmtMoney(o.valor)}${o.valorSub?`<small>${o.valorSub}</small>`:''}</div>
    <span class="cp-check" aria-hidden="true">${o.feito?CP_ICON_OK:''}</span>
  </div>`;
}
function cpBloco(titulo, dica, corpo){
  return `<div class="cp-bloco"><div class="cp-bloco-titulo">${titulo}${dica?`<small>${dica}</small>`:''}</div>${corpo}</div>`;
}
/* parcelas de empréstimo que vencem no mês (pagas e a pagar) */
function cpParcelasEmprestimoNoMes(mKey){
  const out = [];
  (state.emprestimos||[]).forEach(emp=>{
    for(let k=1; k<=emp.numParcelas; k++){
      const venc = empVencimento(emp, k);
      if(monthKey(venc)===mKey) out.push({ emp, k, venc, pago: empParcela(emp, k) });
    }
  });
  return out.sort((a,b)=>a.venc-b.venc);
}
/* itens de cartão/empréstimo que entram na tela (só se estiverem ligados no Geral do mês) */
function cpExtrasDoMes(mKey, u){
  const cartoes = (u==='davi' && incluiNoGeral('cartao', mKey))
    ? (state.cartoesTracker||[]).map(c=>({ c, f: faturaStatus(c, mKey) })).filter(x=>x.f.total>0.004 || x.f.pago>0.004)
    : [];
  const parcelas = (u==='davi' && incluiNoGeral('emprestimo', mKey) && typeof empVencimento==='function') ? cpParcelasEmprestimoNoMes(mKey) : [];
  return { cartoes, parcelas };
}
function cpExtrasAbertosNoMes(mKey, u){
  const x = cpExtrasDoMes(mKey, u);
  return x.cartoes.filter(i=>i.f.st!=='pago').length + x.parcelas.filter(p=>!p.pago).length;
}
function renderContasPagar(){
  const mKey = contasPagarMes || mesFinanceiroAtual();
  const u = userDash();
  const nomeU = u==='davi' ? 'Davi' : 'Cris';
  document.getElementById('contasPagarMesLabel').textContent = monthLabel(mKey)+' · '+nomeU;
  const podeVoltar = mKey > todayKey();
  let totalPagar = 0, totalPago = 0, nItens = 0, nFeitos = 0;
  const conta = (valor, feito, pagoParcial)=>{ nItens++; if(feito){ nFeitos++; totalPago += valor; } else { totalPago += (pagoParcial||0); totalPagar += Math.max(0, valor-(pagoParcial||0)); } };

  /* --- Recebimentos --- */
  const salario = rendaBaseForMonth(u, mKey);
  const extras = (state.users[u].extras||[]).filter(e=>extraNoPeriodo(e, mKey));
  let receb = '', aReceber = 0;
  if(salario > 0 || salarioRecebidoNoMes(u, mKey)){
    const ok = salarioRecebidoNoMes(u, mKey);
    if(!ok) aReceber += salario;
    receb += cpItem({ titulo:'Salário', sub: u==='davi' ? 'Ponto PJ de '+monthLabel(addMonths(mKey,-1)) : 'Renda do mês', valor:salario, feito:ok, icone:'$', attrs:`onclick="cpToggleSalario('${u}','${mKey}')"` });
  }
  extras.forEach(e=>{
    const ok = extraRecebidoNoMes(e, mKey);
    if(!ok) aReceber += Number(e.valor)||0;
    receb += cpItem({ titulo:e.desc, sub:'Extra', valor:Number(e.valor)||0, feito:ok, icone:'+', attrs:`onclick="cpToggleExtra('${u}','${e.id}','${mKey}')"` });
  });

  /* --- Contas (dízimo + contas do mês e atrasadas do mês anterior) --- */
  let contasHtml = '';
  if(u==='davi'){
    const dz = dizimoValorCheio(u, mKey);
    const ok = dizimoPagoNoMes(u, mKey);
    if(dz > 0 || ok){
      conta(dz, ok);
      contasHtml += cpItem({ titulo:'Dízimo', sub:'10% da renda', valor:dz, feito:ok, icone:'%', attrs:`onclick="cpToggleDizimo('${u}','${mKey}')"` });
    }
  }
  const mesAnteriorKey = addMonths(mKey, -1);
  const arquivadas = state.contasArquivadas || {};
  let itemsAtual = getContasDoMes(mKey, u).map(it=>Object.assign({}, it, { mesOrigem: mKey }))
    .filter(it=> !arquivadas[mKey+'_'+it.user+'_'+it.cat+'_'+it.id]);
  let itemsAnterior = getContasDoMes(mesAnteriorKey, u).map(it=>Object.assign({}, it, { mesOrigem: mesAnteriorKey }))
    .filter(it=>{ const pk = mesAnteriorKey+'_'+it.user+'_'+it.cat+'_'+it.id; return !state.paid[pk] && !arquivadas[pk]; });
  const items = itemsAnterior.concat(itemsAtual).sort((a,b)=> a.mesOrigem!==b.mesOrigem ? (a.mesOrigem<b.mesOrigem?-1:1) : (a.dia||1)-(b.dia||1));
  items.forEach(it=>{
    const paidKey = it.mesOrigem+'_'+it.user+'_'+it.cat+'_'+it.id;
    const isPaid = !!state.paid[paidKey];
    const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
    const isParcial = !isPaid && valorPago > 0;
    conta(Number(it.valor)||0, isPaid, valorPago);
    const diasVenc = !isPaid ? diasParaVencimento(it, it.mesOrigem) : null;
    const corDia = diasVenc===null ? '' : (diasVenc<0?' atrasada':(diasVenc<=3?' urgente':''));
    const quando = diasVenc===null ? `dia ${it.dia}` : (diasVenc<0 ? `venceu dia ${it.dia}` : (diasVenc===0 ? 'vence hoje' : (diasVenc<=3 ? `vence em ${diasVenc} dia${diasVenc>1?'s':''}` : `dia ${it.dia}`)));
    contasHtml += cpItem({
      titulo: it.desc, logoUrl: it.logoUrl,
      sub: `<span class="cp-dia${corDia}">${quando}</span>`,
      tag: it.mesOrigem!==mKey ? `<span class="cp-tag">${monthLabel(it.mesOrigem)}</span>` : '',
      valor: Number(it.valor)||0, valorSub: isParcial ? 'pago '+fmtMoney(valorPago) : '',
      feito: isPaid, parcial: isParcial,
      attrs: `onpointerdown="contaTapStart(event,'${paidKey}','${it.user}','${it.cat}','${it.id}','${it.mesOrigem}')" onpointerup="contaTapEnd(event,'${paidKey}')" onpointercancel="contaTapCancel()" onpointerleave="contaTapCancel()"`
    });
  });

  /* --- Cartão e Empréstimo (se ligados no Geral deste mês) --- */
  const ex = cpExtrasDoMes(mKey, u);
  let cartaoHtml = '';
  ex.cartoes.forEach(({c, f})=>{
    const ok = f.st==='pago';
    conta(ok ? f.pago : f.total, ok, ok ? 0 : f.pago);
    const sub = f.datas ? (venceHojeFatura(f) ? 'vence hoje · sem juros' : (f.st==='vencido' ? 'vencida · gerando juros' : 'vence '+fmtDiaMesCurto(f.datas.vence))) : 'Fatura '+monthLabel(mKey);
    cartaoHtml += cpItem({ titulo:c.nome, logoUrl:c.logoUrl, sub:`<span class="cp-dia${f.st==='vencido'?' atrasada':''}">${sub}</span>`,
      valor: ok ? f.pago : f.total, valorSub: (!ok && f.pago>0.004) ? 'pago '+fmtMoney(f.pago) : '', feito: ok, parcial: !ok && f.pago>0.004,
      attrs:`onclick="abrirPagarFatura('${c.id}','${mKey}')"` });
  });
  let empHtml = '';
  ex.parcelas.forEach(({emp, k, venc, pago})=>{
    conta(pago ? pago.valorPago : emp.valorParcela, !!pago);
    empHtml += cpItem({ titulo:escapeHtmlEmp(emp.nome||'Empréstimo'), logoUrl:emp.logoUrl,
      sub:`Parcela ${k} de ${emp.numParcelas} · vence ${String(venc.getDate()).padStart(2,'0')}/${String(venc.getMonth()+1).padStart(2,'0')}`,
      valor: pago ? pago.valorPago : emp.valorParcela, valorSub: pago && pago.tipo==='antecipada' ? 'antecipada' : '', feito: !!pago,
      attrs: pago ? `onclick="desfazerParcelaEmp('${emp.id}',${k})"` : `onclick="abrirPagarParcelaEmp('${emp.id}',${k})"` });
  });

  /* --- montagem --- */
  const pct = nItens ? Math.round(nFeitos/nItens*100) : 0;
  let html = `<div class="cp-mes-nav">
    <button type="button" onclick="cpNavMes(-1)" ${podeVoltar?'':'disabled'} aria-label="Mês anterior">◀</button>
    <div class="cp-mes-label">${monthLabelLong(mKey)}${mKey===mesFinanceiroAtual()?' <small>atual</small>':''}</div>
    <button type="button" onclick="cpNavMes(1)" aria-label="Próximo mês">▶</button>
  </div>
  <div class="cp-resumo">
    <div class="cp-resumo-lbl">Falta pagar</div>
    <div class="cp-resumo-val">${fmtMoney(totalPagar)}</div>
    <div class="cp-resumo-bar"><div style="width:${pct}%"></div></div>
    <div class="cp-resumo-sub"><span><b>${nFeitos} de ${nItens}</b> pagas · ${fmtMoney(totalPago)}</span>${aReceber>0.004?`<span>a receber <b>${fmtMoney(aReceber)}</b></span>`:''}</div>
  </div>`;
  if(receb) html += cpBloco('Recebimentos', 'toque quando cair na conta', receb);
  html += cpBloco('Contas', 'toque = paga · segure = pagamento parcial',
    contasHtml || `<div class="empty-state"><div class="title">Nenhuma conta neste mês</div><div class="desc">Adicione gastos no Dashboard</div></div>`);
  if(cartaoHtml) html += cpBloco('Cartão', 'toque para pagar a fatura', cartaoHtml);
  if(empHtml) html += cpBloco('Empréstimo', 'toque para pagar a parcela', empHtml);
  document.getElementById('contasPagarConteudo').innerHTML = html;
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
  renderPlanner();
  renderPanorama();
  if(navigator.vibrate) navigator.vibrate([10,30,10]);
}
function togglePaid(paidKey){
  state.paid[paidKey] = !state.paid[paidKey];
  if(state.paid[paidKey] && state.pagamentosParciais) delete state.pagamentosParciais[paidKey];
  persist();
  renderPlanner();   // listas do Dashboard (paga/aberta e o resumo de cada bloco)
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
      comprimirImagemDataUrl(e.target.result).then(url=>{
        item.logoUrl = url;
        persist();
        document.getElementById('editarContaLogoPreview').innerHTML = `<img src="${item.logoUrl}" class="conta-logo-grande">`;
        renderPanorama();
      });
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
    renderPanorama();
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
  renderPlanner();
  showToast('Conta atualizada');
}

/* ================= META PARA SAIR DO PJ ================= */
function gastosBrutosMes(user, mKey){
  const ex = state.users[user].expenses;
  let t = 0;
  ['moradia','assinatura','fixo'].forEach(cat=> ex[cat].forEach(i=>{
    if(i.mesInicio && mKey < i.mesInicio) return;
    t += Number(i.valor)||0;
  }));
  ex.futuro.forEach(i=>{ t += futuroValorNoMes(i, mKey); });
  (state.users[user].cartoes||[]).forEach(c=>{ t += Number((c.gastos||{})[mKey]) || 0; });
  return t;
}

/* ================= HISTÓRICO DE MESES =================
   Mês atual (em andamento, calculado agora) + cada mês concluído (resumo guardado ao tocar em Finalizar, em Contas do mês).
   Toque num mês para ver para onde foi o dinheiro. */
const HIST_ROTULOS = [['moradia','Moradia'],['assinatura','Assinaturas'],['fixo','Fixos'],['futuro','Contas futuras'],['dizimo','Dízimo'],['cartao','Cartão'],['emprestimo','Empréstimo']];
function abrirHistoricoMeses(){
  const atual = mesFinanceiroAtual();
  const fechados = Object.entries(state.historicoMeses||{}).filter(([m])=>m!==atual).sort((a,b)=>b[0].localeCompare(a[0]));
  const meses = [[atual, Object.assign(resumoCompletoDoMes(atual), { andamento:true })], ...fechados];
  const maior = Math.max(1, ...meses.map(([,r])=>Math.max(r.renda||0, r.gastoTotal||0)));
  const linhaMes = ([m, r], i)=>{
    const sobra = (r.renda||0) - (r.gastoTotal||0);
    const anterior = meses[i+1] ? (meses[i+1][1].renda||0) - (meses[i+1][1].gastoTotal||0) : null;
    const comp = anterior===null ? '' : `<span class="hm-comp ${sobra>=anterior?'pos':'neg'}">${sobra>=anterior?'▲':'▼'} ${fmtMoney(Math.abs(sobra-anterior))}</span>`;
    const detalhe = r.v===2 ? HIST_ROTULOS.map(([k, nome])=>{
      const v = k in (r.contas||{}) ? r.contas[k] : (r[k]||0);
      return v > 0.004 ? `<div class="hm-cat"><span>${nome}</span><div class="hm-cat-barra"><div style="width:${Math.round(v/Math.max(1,r.gastoTotal)*100)}%"></div></div><b>${fmtMoney(v)}</b></div>` : '';
    }).join('') + `<div class="hm-cat hm-cat-renda"><span>Salário + extras</span><div></div><b>${fmtMoney(r.salario||0)} + ${fmtMoney(r.extras||0)}</b></div>`
      : '<div class="gm-vazio">Mês fechado antes do resumo detalhado.</div>';
    return `<details class="hm-mes"${i===0?' open':''}>
      <summary>
        <div class="hm-topo"><span class="hm-nome">${monthLabelLong(m)}${r.andamento?' <small>em andamento</small>':''}</span><span class="hm-sobra ${sobra>=0?'pos':'neg'}">${fmtMoneySigned(sobra)}</span></div>
        <div class="hm-barras"><div class="hm-barra entra" style="width:${Math.round((r.renda||0)/maior*100)}%"></div><div class="hm-barra sai" style="width:${Math.round((r.gastoTotal||0)/maior*100)}%"></div></div>
        <div class="hm-legenda"><span>Entrou <b>${fmtMoney(r.renda||0)}</b></span><span>Saiu <b>${fmtMoney(r.gastoTotal||0)}</b></span>${comp}</div>
      </summary>
      <div class="hm-detalhe">${detalhe}</div>
    </details>`;
  };
  document.getElementById('historicoMesesLista').innerHTML = meses.map(linhaMes).join('')
    + (fechados.length ? '' : '<div class="hm-dica">Os meses aparecem aqui quando você toca em Finalizar, em Contas do mês. O resumo fica guardado mesmo depois que os dados do mês são limpos.</div>');
  document.getElementById('modalHistoricoMeses').classList.add('active');
  document.body.style.overflow = 'hidden';
}
