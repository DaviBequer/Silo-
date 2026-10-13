/* ========== VENDAS — comissões do SaaS, metas de sobra mês a mês e amortização ==========
   Comissão de setup entra no mês da venda; a comissão da mensalidade começa no mês seguinte
   e se repete todo mês enquanto o cliente estiver ativo (cancelado em X = não paga mais a partir de X).
   As comissões aparecem só aqui (não mexem no Dashboard). A sobra base vem do Fluxo Mensal do Davi,
   com o empréstimo sempre dentro e o cartão sempre fora. */

function garantirVendas(){
  if(!state.vendas || typeof state.vendas !== 'object') state.vendas = {};
  const v = state.vendas;
  if(!v.config) v.config = {
    pctSetup: 70, pctRec: 30,   // exemplos iniciais, editáveis em Configurar
    modelos: [
      { id:'A', nome:'Plano A', setup:1500, mensal:300 },
      { id:'B', nome:'Plano B', setup:3000, mensal:500 }
    ]
  };
  if(!Array.isArray(v.lista)) v.lista = [];
  if(!v.metas || typeof v.metas !== 'object') v.metas = {};
  return v;
}
function vendasCfg(){ return garantirVendas().config; }
function vendasModelo(id){ return vendasCfg().modelos.find(m=>m.id===id) || null; }

/* ---------- comissões ---------- */
/* O app trabalha um mês à frente do calendário (o Dashboard mostra o mês seguinte ao de hoje).
   A data da venda é a do calendário; aqui ela vira o mês do app, para a venda de hoje cair no mês "atual" da tela. */
function vendasMesDoApp(dataISO){
  const m = String(dataISO||'').slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(m)) return '';
  const r = todayKey(), f = mesFinanceiroAtual();
  const desloc = (Number(f.slice(0,4))-Number(r.slice(0,4)))*12 + (Number(f.slice(5,7))-Number(r.slice(5,7)));
  return addMonths(m, desloc);
}
function vendaMes(v){ return vendasMesDoApp(v.data); }
function vendaComSetup(v){ return (Number(v.setup)||0) * (Number(vendasCfg().pctSetup)||0) / 100; }
function vendaComRec(v){ return (Number(v.mensal)||0) * (Number(vendasCfg().pctRec)||0) / 100; }
function vendaMesCancel(v){ return (v.status==='cancelado' && v.canceladoEm) ? vendasMesDoApp(v.canceladoEm) : null; }
function vendaAtivaNoMes(v, mKey){
  if(!vendaMes(v) || mKey < vendaMes(v)) return false;
  const c = vendaMesCancel(v);
  return !(v.status==='cancelado' && (!c || mKey >= c));
}
function vendaRecorreNoMes(v, mKey){
  return mKey >= addMonths(vendaMes(v), 1) && vendaAtivaNoMes(v, mKey);
}
function vendasSetupNoMes(mKey){ return garantirVendas().lista.filter(v=>vendaMes(v)===mKey).reduce((s,v)=>s+vendaComSetup(v), 0); }
function vendasRecNoMes(mKey){ return garantirVendas().lista.filter(v=>vendaRecorreNoMes(v, mKey)).reduce((s,v)=>s+vendaComRec(v), 0); }
function vendasComissaoNoMes(mKey){ return vendasSetupNoMes(mKey) + vendasRecNoMes(mKey); }
function vendasAtivosNoMes(mKey){ return garantirVendas().lista.filter(v=>vendaAtivaNoMes(v, mKey)).length; }

/* ---------- sobra ---------- */
/* Sobra estimada do Fluxo (Davi) com o empréstimo sempre dentro e o cartão sempre fora, independente dos interruptores */
function vendasSobraBase(mKey){
  const ex = extrasGeralNoMes('davi', mKey);
  return saldoForMonth('davi', mKey) + ex.total - emprestimoValorGeralNoMes(mKey);
}
function vendasMeses(){ const out = [], ini = mesFinanceiroAtual(); for(let i=0;i<12;i++) out.push(addMonths(ini, i)); return out; }
function vendasMeta(mKey){ const v = garantirVendas().metas[mKey]; return (v===undefined || v===null || v==='') ? null : Number(v); }
/* Quanto as comissões precisam render no mês para bater a meta.
   A sobra das contas NÃO conta para a meta:
   - contas já sobram → a meta inteira tem que vir das vendas (sobra 800, meta 1.500 → vender 1.500 em comissões);
   - contas faltam   → as vendas cobrem a falta e ainda sobram a meta (falta 536,64, meta 1.500 → 2.036,64). */
function vendasAlvoComissao(mKey, base){
  const meta = vendasMeta(mKey);
  if(meta === null) return null;
  if(base === undefined) base = vendasSobraBase(mKey);
  return meta + Math.max(0, -base);
}

/* Quantas vendas de um modelo faltam em cada mês. Vai mês a mês: as vendas "necessárias" de um mês
   já geram recorrência nos meses seguintes e diminuem a necessidade deles. */
function vendasNecessarias(modelo, meses){
  const cfg = vendasCfg();
  const cSetup = (Number(modelo.setup)||0) * (Number(cfg.pctSetup)||0) / 100;
  const cRec = (Number(modelo.mensal)||0) * (Number(cfg.pctRec)||0) / 100;
  const extra = {}, out = {};
  meses.forEach((m, i)=>{
    const alvo = vendasAlvoComissao(m);
    if(alvo === null){ out[m] = null; return; }
    const falta = alvo - (vendasComissaoNoMes(m) + (extra[m]||0));
    let n = 0;
    if(falta > 0.005) n = cSetup > 0 ? Math.ceil(falta / cSetup) : Infinity;
    out[m] = n;
    if(n > 0 && isFinite(n)) meses.slice(i+1).forEach(mm=>{ extra[mm] = (extra[mm]||0) + n*cRec; });
  });
  return out;
}

/* ---------- empréstimo (lê o cadastrado na aba Empréstimo) ---------- */
function vendasEmprestimoAtivo(){
  return (state.emprestimos||[]).find(e=>typeof empPendentes==='function' && empPendentes(e).length) || null;
}
function vendasSaldoDevedor(){
  let saldo = 0, parcelas = 0;
  (state.emprestimos||[]).forEach(e=>{ const r = empResumo(e); saldo += r.saldoHoje; parcelas += r.pend.length; });
  return { saldo, parcelas, tem: (state.emprestimos||[]).length > 0 };
}
function vendasAmortizar(valor){
  const emp = vendasEmprestimoAtivo();
  if(!emp){ showToast('Cadastre o empréstimo na aba Finanças → Empréstimo'); return; }
  abrirAmortizarEmp(emp.id, Math.round(valor*100)/100);
}

/* ---------- tela ---------- */
const VENDAS_ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const VENDAS_ICON_DEL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
function escVendas(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDataBR(iso){ if(!iso) return ''; const [y,m,d] = String(iso).split('-'); return d+'/'+m+'/'+y; }

function renderVendas(){
  const wrap = document.getElementById('vendasConteudo');
  if(!wrap || !state.users) return;
  const vd = garantirVendas(), cfg = vd.config;
  const mAtual = mesFinanceiroAtual();
  const meses = vendasMeses();
  const [mA, mB] = cfg.modelos;
  const necA = vendasNecessarias(mA, meses), necB = vendasNecessarias(mB, meses);
  const ativos = vd.lista.filter(v=>vendaAtivaNoMes(v, mAtual));
  const recAcumulada = ativos.reduce((s,v)=>s+vendaComRec(v), 0);
  const comMes = vendasComissaoNoMes(mAtual);
  const metaMes = vendasMeta(mAtual);
  const baseMes = vendasSobraBase(mAtual);
  const alvoMes = vendasAlvoComissao(mAtual, baseMes);
  const divida = vendasSaldoDevedor();

  /* resumo: meta = quanto as comissões precisam render (a sobra das contas não entra) */
  const faltaMes = alvoMes===null ? null : alvoMes - comMes;
  const pctMes = (alvoMes && alvoMes>0) ? Math.max(0, Math.min(100, Math.round(comMes/alvoMes*100))) : 0;
  const explicaMes = metaMes===null ? '' : (baseMes < 0
    ? `Meta ${fmtMoney(metaMes)} + cobrir a falta de ${fmtMoney(-baseMes)} = <b>${fmtMoney(alvoMes)}</b> em vendas`
    : `Meta <b>${fmtMoney(metaMes)}</b> em vendas · as contas já sobram ${fmtMoney(baseMes)}`);
  let html = `<div class="card resumo-card">
    <div class="resumo-topo">
      <div class="resumo-mes">Vendas · ${monthLabelLong(mAtual)}</div>
      <div style="display:flex;gap:6px"><button type="button" class="resumo-link" onclick="abrirVendasConfig('simulacao')">Simular</button><button type="button" class="resumo-link" onclick="abrirVendasConfig()">Configurar</button></div>
    </div>
    <div class="resumo-label">Comissão do mês</div>
    <div class="ponto-valor-grande">${fmtMoney(comMes)}</div>
    <div class="ponto-horas-sub"><span>${fmtMoney(vendasSetupNoMes(mAtual))}</span> de setup + <span>${fmtMoney(vendasRecNoMes(mAtual))}</span> de recorrência</div>
    <div class="resumo-stats">
      <div class="resumo-stat"><div class="resumo-stat-lbl">Recorrência/mês</div><div class="resumo-stat-val pos">${fmtMoney(recAcumulada)}</div></div>
      <div class="resumo-stat"><div class="resumo-stat-lbl">Clientes ativos</div><div class="resumo-stat-val">${ativos.length}</div></div>
      <div class="resumo-stat"><div class="resumo-stat-lbl">Saldo devedor</div><div class="resumo-stat-val vd-devedor${divida.tem?' neg':''}">${divida.tem?fmtMoney(divida.saldo):'—'}${divida.tem && divida.parcelas ? `<span class="vd-parcelas" title="${divida.parcelas} parcela${divida.parcelas===1?'':'s'} a pagar" aria-label="${divida.parcelas} parcela${divida.parcelas===1?'':'s'} a pagar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>${divida.parcelas}x</span>` : ''}</div></div>
    </div>
    ${metaMes===null
      ? `<div class="vd-meta-linha"><span>Sem meta para ${monthLabel(mAtual)}</span><button type="button" class="modal-link" onclick="abrirMetaVendas('${mAtual}')">Definir meta</button></div>`
      : `<div class="vd-meta-linha"><span>${explicaMes}</span><b class="${faltaMes>0.005?'neg':'pos'}">${faltaMes>0.005?'falta '+fmtMoney(faltaMes):'✓ bateu'}</b></div>
         <div class="vd-bar${faltaMes>0.005?' falta':''}"><div style="width:${pctMes}%"></div></div>`}
    <div class="resumo-rodape">
      <button type="button" class="resumo-btn" style="margin-left:auto" onclick="abrirFormVenda()"><span class="resumo-btn-ico">+</span><span>Nova venda</span></button>
    </div>
  </div>`;

  /* metas mês a mês */
  html += `<div class="card"><div class="card-title"><div class="left">Metas de sobra</div></div>
    <div class="vd-legenda">Meta = quanto as vendas precisam render. Se as contas já sobram, a meta inteira vem das vendas; se faltam, as vendas cobrem a falta e ainda sobram a meta.</div>
    ${meses.map(m=>{
      const base = vendasSobraBase(m), set = vendasSetupNoMes(m), rec = vendasRecNoMes(m);
      const com = set + rec, proj = base + com, meta = vendasMeta(m);
      const alvo = vendasAlvoComissao(m, base);
      const dif = alvo===null ? null : com - alvo;   // < 0: falta vender; > 0: passou da meta
      const pct = (alvo && alvo>0) ? Math.max(0, Math.min(100, Math.round(com/alvo*100))) : (dif!==null && dif>=0 ? 100 : 0);
      const nA = necA[m], nB = necB[m];
      /* quantas vendas faltam: dois blocos lado a lado, um por plano */
      const blocoPlano = (n, nome)=>`<div class="vd-precisa-op"><b>${isFinite(n)?n:'—'}</b><span>venda${n===1?'':'s'}<small>${escVendas(nome)}</small></span></div>`;
      const precisa = (dif!==null && dif < -0.005)
        ? `<div class="vd-precisa"><div class="vd-precisa-tit">Para bater a meta</div><div class="vd-precisa-ops">${blocoPlano(nA, mA.nome)}<div class="vd-precisa-ou">ou</div>${blocoPlano(nB, mB.nome)}</div></div>` : '';
      const amortizar = (dif!==null && dif > 0.005 && divida.tem && divida.parcelas)
        ? `<button type="button" class="vd-amortizar" onclick="vendasAmortizar(${Math.min(dif, divida.saldo).toFixed(2)})">Amortizar ${fmtMoney(Math.min(dif, divida.saldo))} do excedente ›</button>` : '';
      return `<div class="vd-mes${m===mAtual?' atual':''}">
        <div class="vd-mes-topo">
          <div class="vd-mes-nome">${monthLabel(m)}${m===mAtual?' <small>atual</small>':''}</div>
          <button type="button" class="vd-meta-btn" onclick="abrirMetaVendas('${m}')">${meta===null?'+ meta':'Meta '+fmtMoney(meta)}</button>
        </div>
        <div class="vd-conta">
          <span>Sobra <b class="${base<0?'neg':''}">${fmtMoneySigned(base)}</b></span>
          <span>+ comissões <b>${fmtMoney(set+rec)}</b>${rec>0.004?` <small>(${fmtMoney(rec)} recorrente)</small>`:''}</span>
          <span>= <b class="${proj<0?'neg':''}">${fmtMoneySigned(proj)}</b></span>
        </div>
        ${meta===null ? '' : `<div class="vd-bar${dif<-0.005?' falta':''}"><div style="width:${pct}%"></div></div>
        <div class="vd-status ${dif<-0.005?'neg':'pos'}">${dif<-0.005?'Falta vender '+fmtMoney(-dif)+(base<0?` <small>(${fmtMoney(-base)} da falta + ${fmtMoney(meta)} da meta)</small>`:''):'✓ Bateu'+(dif>0.005?' · passou '+fmtMoney(dif):'')}</div>`}
        ${precisa}${amortizar}
      </div>`;
    }).join('')}
  </div>`;

  /* vendas */
  const lista = vd.lista.slice().sort((a,b)=> String(b.data).localeCompare(String(a.data)));
  html += `<div class="card"><div class="card-title"><div class="left">Vendas</div><button class="section-add" onclick="abrirFormVenda()" aria-label="Nova venda"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button></div>
    ${lista.length ? lista.map(v=>{
      const mod = v.modelo==='P' ? 'Personalizado' : (vendasModelo(v.modelo)?.nome || v.modelo);
      const cancel = v.status==='cancelado';
      return `<div class="vd-venda${cancel?' cancelada':''}">
        <div class="vd-venda-info">
          <div class="vd-venda-nome">${escVendas(v.cliente||'Cliente')}</div>
          <div class="vd-venda-sub">${fmtDataBR(v.data)} · ${escVendas(mod)} · ${cancel?'cancelado'+(v.canceladoEm?' em '+fmtDataBR(v.canceladoEm):''):'ativo'}</div>
          <div class="vd-venda-sub">Setup ${fmtMoney(v.setup)} → <b>${fmtMoney(vendaComSetup(v))}</b> · Mensal ${fmtMoney(v.mensal)} → <b>${fmtMoney(vendaComRec(v))}/mês</b></div>
        </div>
        <div class="vd-venda-acoes">
          <button class="btn-icon-sm" onclick="abrirFormVenda('${v.id}')" title="Editar">${VENDAS_ICON_EDIT}</button>
          <button class="btn-icon-sm" onclick="excluirVenda('${v.id}')" title="Excluir">${VENDAS_ICON_DEL}</button>
        </div>
      </div>`;
    }).join('') : `<div class="empty-state"><div class="title">Nenhuma venda ainda</div><div class="desc">Toque em + para registrar a primeira</div></div>`}
  </div>`;

  wrap.innerHTML = html;
  if(typeof renderHeaderHoje==='function') renderHeaderHoje();   // a meta do mês entra no "falta pagar" do cabeçalho
}

/* ---------- venda: cadastro / edição ---------- */
let vendaEditandoId = null, vendaModeloSel = 'A', vendaStatusSel = 'ativo';
function abrirFormVenda(id){
  const vd = garantirVendas();
  const v = id ? vd.lista.find(x=>x.id===id) : null;
  vendaEditandoId = v ? v.id : null;
  document.getElementById('vendaFormTitulo').textContent = v ? 'Editar venda' : 'Nova venda';
  document.getElementById('vendaData').value = v ? v.data : empHojeISO();
  document.getElementById('vendaCliente').value = v ? (v.cliente||'') : '';
  document.getElementById('vendaSetup').value = v ? empFmtValorInput(Number(v.setup)||0) : '';
  document.getElementById('vendaMensal').value = v ? empFmtValorInput(Number(v.mensal)||0) : '';
  document.getElementById('vendaCancelData').value = v && v.canceladoEm ? v.canceladoEm : '';
  renderVendaModeloChips();
  selecionarModeloVenda(v ? v.modelo : 'A', !v);
  selecionarStatusVenda(v ? v.status : 'ativo');
  document.getElementById('modalVenda').classList.add('active');
}
function renderVendaModeloChips(){
  const [a, b] = vendasCfg().modelos;
  document.getElementById('vendaModeloChips').innerHTML =
    `<button type="button" class="dif-chip" data-val="A" onclick="selecionarModeloVenda('A', true)">${escVendas(a.nome)}</button>
     <button type="button" class="dif-chip" data-val="B" onclick="selecionarModeloVenda('B', true)">${escVendas(b.nome)}</button>
     <button type="button" class="dif-chip" data-val="P" onclick="selecionarModeloVenda('P', false)">Personalizado</button>`;
}
function selecionarModeloVenda(id, preencher){
  vendaModeloSel = id;
  document.querySelectorAll('#vendaModeloChips .dif-chip').forEach(el=>el.classList.toggle('active', el.dataset.val===id));
  const m = vendasModelo(id);
  if(preencher && m){
    document.getElementById('vendaSetup').value = empFmtValorInput(Number(m.setup)||0);
    document.getElementById('vendaMensal').value = empFmtValorInput(Number(m.mensal)||0);
  }
  atualizarPreviaVenda();
}
function selecionarStatusVenda(st){
  vendaStatusSel = st;
  document.querySelectorAll('#vendaStatusChips .dif-chip').forEach(el=>el.classList.toggle('active', el.dataset.val===st));
  document.getElementById('vendaCancelField').style.display = st==='cancelado' ? '' : 'none';
  if(st==='cancelado' && !document.getElementById('vendaCancelData').value) document.getElementById('vendaCancelData').value = empHojeISO();
}
function atualizarPreviaVenda(){
  const cfg = vendasCfg();
  const s = parseMoney(document.getElementById('vendaSetup').value), m = parseMoney(document.getElementById('vendaMensal').value);
  document.getElementById('vendaPrevia').innerHTML = (s>0 || m>0)
    ? `<div class="emp-previa">Você ganha <b>${fmtMoney(s*cfg.pctSetup/100)}</b> no mês da venda (${cfg.pctSetup}% do setup) e <b>${fmtMoney(m*cfg.pctRec/100)}/mês</b> a partir do mês seguinte (${cfg.pctRec}% da mensalidade).</div>` : '';
}
function salvarVenda(){
  const vd = garantirVendas();
  const dados = {
    data: document.getElementById('vendaData').value,
    cliente: document.getElementById('vendaCliente').value.trim(),
    modelo: vendaModeloSel,
    setup: parseMoney(document.getElementById('vendaSetup').value),
    mensal: parseMoney(document.getElementById('vendaMensal').value),
    status: vendaStatusSel,
    canceladoEm: vendaStatusSel==='cancelado' ? (document.getElementById('vendaCancelData').value || empHojeISO()) : null
  };
  if(!dados.cliente){
    const el = document.getElementById('vendaCliente');
    el.classList.add('campo-erro'); el.focus();
    el.addEventListener('input', ()=>el.classList.remove('campo-erro'), { once:true });
    showToast('Informe o nome do cliente'); return;
  }
  if(!dados.data){ showToast('Informe a data da venda'); return; }
  if(!(dados.setup>0) && !(dados.mensal>0)){ showToast('Informe o setup ou a mensalidade'); return; }
  if(vendaEditandoId){
    Object.assign(vd.lista.find(x=>x.id===vendaEditandoId), dados);
  } else {
    vd.lista.push(Object.assign({ id:'vd'+Date.now() }, dados));
  }
  persist();
  closeModal('modalVenda');
  renderVendas();
  showToast('Venda salva');
}
async function excluirVenda(id){
  const vd = garantirVendas();
  const v = vd.lista.find(x=>x.id===id);
  if(!v) return;
  const ok = await iosConfirm(`Excluir a venda de "${v.cliente||'cliente'}"? A comissão dela sai de todos os meses.`);
  if(!ok) return;
  vd.lista = vd.lista.filter(x=>x.id!==id);
  persist();
  renderVendas();
}

/* ---------- configuração ---------- */
function abrirVendasConfig(aba){
  const cfg = vendasCfg();
  document.getElementById('vcPctSetup').value = String(cfg.pctSetup).replace('.',',');
  document.getElementById('vcPctRec').value = String(cfg.pctRec).replace('.',',');
  cfg.modelos.forEach(m=>{
    document.getElementById('vcNome'+m.id).value = m.nome;
    document.getElementById('vcSetup'+m.id).value = empFmtValorInput(Number(m.setup)||0);
    document.getElementById('vcMensal'+m.id).value = empFmtValorInput(Number(m.mensal)||0);
  });
  const sel = document.getElementById('vcSimMes');
  sel.innerHTML = vendasMeses().map(m=>`<option value="${m}">${monthLabelLong(m)}</option>`).join('');
  sel.value = mesFinanceiroAtual();
  vcTrocarAba(aba || 'comissao');
  document.getElementById('modalVendasConfig').classList.add('active');
}
function vcTrocarAba(aba){
  document.querySelectorAll('#modalVendasConfig .vc-aba').forEach(b=>b.classList.toggle('active', b.dataset.aba===aba));
  document.getElementById('vcPainelComissao').style.display = aba==='comissao' ? '' : 'none';
  document.getElementById('vcPainelSimulacao').style.display = aba==='simulacao' ? '' : 'none';
  vcAtualizar();
}
/* lê o que está digitado (mesmo antes de salvar), para o resultado e a simulação já mostrarem */
function vcLerForm(){
  const pct = id => Math.max(0, Math.min(100, parseFloat(String(document.getElementById(id).value).replace(',','.')) || 0));
  const mod = id => ({ id, nome: document.getElementById('vcNome'+id).value.trim() || ('Plano '+id),
    setup: parseMoney(document.getElementById('vcSetup'+id).value), mensal: parseMoney(document.getElementById('vcMensal'+id).value) });
  return { pctSetup: pct('vcPctSetup'), pctRec: pct('vcPctRec'), modelos: [mod('A'), mod('B')] };
}
function vcSimMudar(id, delta){
  const el = document.getElementById('vcSimQtd'+id);
  el.value = Math.max(0, (parseInt(el.value)||0) + delta);
  vcAtualizar();
}
function vcAtualizar(){
  const f = vcLerForm();
  const ganho = m => ({ setup: m.setup*f.pctSetup/100, rec: m.mensal*f.pctRec/100 });
  f.modelos.forEach(m=>{
    const g = ganho(m);
    const el = document.getElementById('vcRecebe'+m.id);
    if(el) el.innerHTML = (m.setup>0 || m.mensal>0)
      ? `Você recebe <b>${fmtMoney(g.setup)}</b> no mês da venda + <b>${fmtMoney(g.rec)}/mês</b> a partir do mês seguinte <span>· em 12 meses: ${fmtMoney(g.setup + g.rec*11)}</span>`
      : 'Preencha o setup e a mensalidade para ver quanto você recebe.';
    const nm = document.getElementById('vcSimNome'+m.id); if(nm) nm.textContent = m.nome;
  });
  /* simulação */
  const out = document.getElementById('vcSimResultado'); if(!out) return;
  const qA = Math.max(0, parseInt(document.getElementById('vcSimQtdA').value)||0);
  const qB = Math.max(0, parseInt(document.getElementById('vcSimQtdB').value)||0);
  const mesVenda = document.getElementById('vcSimMes').value || mesFinanceiroAtual();
  const [A, B] = f.modelos, gA = ganho(A), gB = ganho(B);
  const setupTotal = qA*gA.setup + qB*gB.setup;
  const recTotal = qA*gA.rec + qB*gB.rec;
  if(!qA && !qB){ out.innerHTML = '<div class="vc-sim-vazio">Escolha quantas vendas de cada plano para ver o resultado.</div>'; return; }
  const meses = []; for(let i=0;i<6;i++) meses.push(addMonths(mesVenda, i));
  out.innerHTML = `<div class="vc-sim-res">
      <div><span>No mês da venda</span><b>${fmtMoney(setupTotal)}</b></div>
      <div><span>Por mês, depois</span><b class="pos">+ ${fmtMoney(recTotal)}</b></div>
      <div><span>Em 12 meses</span><b>${fmtMoney(setupTotal + recTotal*11)}</b></div>
    </div>
    <div class="vc-titulo" style="margin-top:16px">Sobra com essas vendas</div>
    ${meses.map(m=>{
      const atual = vendasSobraBase(m) + vendasComissaoNoMes(m);
      const extra = (m===mesVenda ? setupTotal : 0) + (m>mesVenda ? recTotal : 0);
      const comSim = atual + extra, meta = vendasMeta(m);
      /* mesma regra da meta: só as comissões contam (a sobra das contas não entra) */
      const alvo = vendasAlvoComissao(m), comissoes = vendasComissaoNoMes(m) + extra;
      const st = alvo===null ? '' : (comissoes >= alvo - 0.005 ? `<span class="pos">✓ bate a meta de ${fmtMoney(meta)}</span>` : `<span class="neg">falta ${fmtMoney(alvo-comissoes)} p/ meta</span>`);
      return `<div class="vc-sim-mes"><div class="vc-sim-mes-nome">${monthLabel(m)}</div>
        <div class="vc-sim-mes-val"><small>${fmtMoneySigned(atual)} →</small> <b class="${comSim<0?'neg':''}">${fmtMoneySigned(comSim)}</b></div>
        <div class="vc-sim-mes-st">${st}</div></div>`;
    }).join('')}
    <div class="vc-sim-nota">Simulação: não é registrada. Para valer, lance as vendas em "Nova venda".</div>`;
}
function salvarVendasConfig(){
  const cfg = vendasCfg();
  const pct = id => Math.max(0, Math.min(100, parseFloat(String(document.getElementById(id).value).replace(',','.')) || 0));
  cfg.pctSetup = pct('vcPctSetup');
  cfg.pctRec = pct('vcPctRec');
  cfg.modelos.forEach(m=>{
    m.nome = document.getElementById('vcNome'+m.id).value.trim() || ('Plano '+m.id);
    m.setup = parseMoney(document.getElementById('vcSetup'+m.id).value);
    m.mensal = parseMoney(document.getElementById('vcMensal'+m.id).value);
  });
  persist();
  closeModal('modalVendasConfig');
  renderVendas();
  showToast('Configuração salva');
}

/* ---------- meta do mês ---------- */
let vendasMetaMes = null;
function abrirMetaVendas(mKey){
  vendasMetaMes = mKey;
  const atual = vendasMeta(mKey);
  document.getElementById('vendaMetaTitulo').textContent = 'Meta de sobra · ' + monthLabelLong(mKey);
  document.getElementById('vendaMetaValor').value = atual===null ? '' : empFmtValorInput(atual);
  document.getElementById('vendaMetaInfo').innerHTML = `<div class="emp-previa">Sobra do Fluxo em ${monthLabel(mKey)}: <b>${fmtMoneySigned(vendasSobraBase(mKey))}</b> · comissões já previstas: <b>${fmtMoney(vendasComissaoNoMes(mKey))}</b></div>`;
  document.getElementById('modalVendaMeta').classList.add('active');
}
function salvarMetaVendas(limpar){
  const vd = garantirVendas();
  const txt = document.getElementById('vendaMetaValor').value.trim();
  if(limpar || txt==='') delete vd.metas[vendasMetaMes];
  else vd.metas[vendasMetaMes] = parseMoney(txt);
  persist();
  closeModal('modalVendaMeta');
  renderVendas();
}
