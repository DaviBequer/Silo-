/* ========== EMPRÉSTIMO — parcelas, amortização (antecipar do fim) e desconto obtido ==========
   Tabela Price: parcelas iguais. Cada parcela fica "pendente", "paga" (no vencimento) ou
   "antecipada" (paga antes, com desconto dos juros que não correram). */

/* empréstimo mexe na sobra do Geral e na tela Contas do mês: redesenha as duas */
function empAtualizarOutrasTelas(){
  if(typeof renderPlanner==='function') renderPlanner();
  if(typeof renderPanorama==='function') renderPanorama();
  if(typeof renderVendas==='function') renderVendas();   // saldo devedor e sugestão de amortização
}
function garantirEmprestimos(){
  if(!Array.isArray(state.emprestimos)) state.emprestimos = [];
  return state.emprestimos;
}
function empPorId(id){ return garantirEmprestimos().find(e=>e.id===id); }
function empHojeISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function empDataBR(iso){ if(!iso) return ''; const [y,m,d]=iso.split('-'); return d+'/'+m+'/'+y; }
function empFmtValorInput(v){ return v ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : ''; }

/* vencimento da parcela k (1..n): mesmo dia do 1º vencimento, k-1 meses depois */
function empVencimento(emp, k){
  const [y,m,d] = emp.primeiroVenc.split('-').map(Number);
  const ultimoDia = new Date(y, m-1+k, 0).getDate();
  return new Date(y, m-1+(k-1), Math.min(d, ultimoDia));
}
/* taxa mensal: a informada, ou a que fecha valor recebido × parcela × prazo (Price) */
function empTaxa(emp){
  if(emp.taxaMensal > 0) return emp.taxaMensal/100;
  const PV = emp.valorRecebido, P = emp.valorParcela, n = emp.numParcelas;
  if(!(PV>0) || !(P>0) || !(n>0) || P*n <= PV) return 0;
  let lo = 0, hi = 1;
  for(let it=0; it<100; it++){
    const i = (lo+hi)/2;
    const pv = P*(1-Math.pow(1+i,-n))/i;
    if(pv > PV) lo = i; else hi = i;
  }
  return (lo+hi)/2;
}
/* quanto vale hoje a parcela k (desconta os juros dos dias que faltam até o vencimento) */
function empValorPresente(emp, k, hoje){
  const i = empTaxa(emp);
  const dias = (empVencimento(emp, k) - hoje) / 86400000;
  if(i <= 0 || dias <= 0) return emp.valorParcela;
  return emp.valorParcela / Math.pow(1+i, dias/30);
}
function empParcela(emp, k){ return (emp.pagas && emp.pagas[k]) || null; }
function empPendentes(emp){
  const out = [];
  for(let k=1; k<=emp.numParcelas; k++) if(!empParcela(emp,k)) out.push(k);
  return out;
}
function empResumo(emp){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let pago = 0, desconto = 0, qtdPagas = 0, qtdAntecipadas = 0;
  Object.keys(emp.pagas||{}).forEach(k=>{
    const p = emp.pagas[k];
    pago += p.valorPago;
    if(p.tipo==='antecipada'){ qtdAntecipadas++; desconto += Math.max(0, emp.valorParcela - p.valorPago); }
    else qtdPagas++;
  });
  const pend = empPendentes(emp);
  const saldoHoje = pend.reduce((s,k)=>s+empValorPresente(emp,k,hoje), 0);
  const vencidas = pend.filter(k=>empVencimento(emp,k) < hoje).length;
  return { pago, desconto, qtdPagas, qtdAntecipadas, pend, saldoHoje, vencidas,
    totalContratado: emp.valorParcela*emp.numParcelas,
    ultimaPendente: pend.length ? pend[pend.length-1] : null };
}

/* ---------- tela ---------- */
let empListaAberta = {};
function renderEmprestimos(){
  const wrap = document.getElementById('emprestimoLista');
  if(!wrap) return;
  const lista = garantirEmprestimos();
  if(!lista.length){
    wrap.innerHTML = `<div class="card emp-vazio">
      <div class="emp-vazio-tit">Nenhum empréstimo cadastrado</div>
      <div class="emp-vazio-sub">Cadastre para acompanhar o que já pagou, as parcelas que faltam e o desconto de cada amortização.</div>
      <button type="button" class="resumo-btn" style="justify-content:center" onclick="abrirFormEmprestimo()">Cadastrar empréstimo</button>
    </div>`;
    return;
  }
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  wrap.innerHTML = lista.map(emp=>{
    const r = empResumo(emp);
    const quitadas = emp.numParcelas - r.pend.length;
    const pct = Math.round(quitadas/emp.numParcelas*100);
    const taxa = empTaxa(emp)*100;
    const quitado = r.pend.length===0;
    const aberta = !!empListaAberta[emp.id];
    const linhas = [];
    for(let k=1; k<=emp.numParcelas; k++){
      const p = empParcela(emp,k);
      const venc = empVencimento(emp,k);
      let chip, valor = fmtMoney(emp.valorParcela), extra = '';
      if(p && p.tipo==='antecipada'){ chip = '<span class="emp-chip ante">antecipada</span>'; valor = fmtMoney(p.valorPago); extra = `<small class="emp-desc">−${fmtMoney(Math.max(0,emp.valorParcela-p.valorPago))}</small>`; }
      else if(p){ chip = '<span class="emp-chip paga">paga</span>'; valor = fmtMoney(p.valorPago); }
      else if(venc < hoje){ chip = '<span class="emp-chip venc">vencida</span>'; }
      else chip = '<span class="emp-chip pend">a pagar</span>';
      linhas.push(`<div class="emp-parc ${p?'feita':''}" ${p?`onclick="desfazerParcelaEmp('${emp.id}',${k})" title="Toque para desfazer"`:''}>
        <span class="emp-parc-n">${k}</span>
        <span class="emp-parc-data">${String(venc.getDate()).padStart(2,'0')}/${String(venc.getMonth()+1).padStart(2,'0')}/${venc.getFullYear()}</span>
        ${chip}
        <span class="emp-parc-val">${valor}${extra}</span>
      </div>`);
    }
    const cor = corDaLogo(emp.logoUrl, renderEmprestimos);
    return `<div class="card resumo-card emp-card">
      <div class="ct-face${cor?' colorida':''}"${estiloFaceCor(cor)}>
      <div class="resumo-topo">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          ${emp.logoUrl?`<img src="${emp.logoUrl}" class="conta-logo-sm" alt="">`:''}
          <div style="min-width:0">
          <div class="resumo-mes">${escapeHtmlEmp(emp.nome||'Empréstimo')}</div>
          <div class="emp-sub">${emp.numParcelas}× ${fmtMoney(emp.valorParcela)}${taxa>0?' · '+taxa.toFixed(2).replace('.',',')+'% a.m.':''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-icon-sm" onclick="abrirFormEmprestimo('${emp.id}')" title="Editar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
          <button class="btn-icon-sm" onclick="excluirEmprestimo('${emp.id}')" title="Excluir"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>
      <div class="resumo-label">${quitado?'Empréstimo quitado':'Para quitar hoje (estimado)'}</div>
      <div class="ponto-valor-grande">${quitado?'✓':fmtMoney(r.saldoHoje)}</div>
      <div class="emp-progresso"><div style="width:${pct}%"></div></div>
      <div class="ponto-horas-sub"><span>${quitadas} de ${emp.numParcelas}</span> parcelas quitadas${r.vencidas?` · <b class="emp-alerta">${r.vencidas} vencida${r.vencidas>1?'s':''}</b>`:''}</div>
      </div>
      <div class="resumo-stats">
        <div class="resumo-stat"><div class="resumo-stat-lbl">Já paguei</div><div class="resumo-stat-val">${fmtMoney(r.pago)}</div></div>
        <div class="resumo-stat"><div class="resumo-stat-lbl">Faltam</div><div class="resumo-stat-val">${r.pend.length} parcela${r.pend.length===1?'':'s'}</div></div>
        <div class="resumo-stat"><div class="resumo-stat-lbl">Desconto</div><div class="resumo-stat-val pos">${fmtMoney(r.desconto)}</div></div>
      </div>
      ${quitado?'':`<div class="emp-acoes">
        <button type="button" class="resumo-btn" onclick="abrirPagarParcelaEmp('${emp.id}')"><span>Pagar ${r.pend[0]}ª parcela</span><span class="resumo-btn-info">${fmtMoney(emp.valorParcela)} ›</span></button>
        <button type="button" class="emp-btn-sec" onclick="abrirAmortizarEmp('${emp.id}')">Amortizar</button>
      </div>`}
      <button type="button" class="emp-toggle" onclick="empListaAberta['${emp.id}']=!empListaAberta['${emp.id}'];renderEmprestimos()">${aberta?'Esconder':'Ver'} parcelas</button>
      ${aberta?`<div class="emp-parcelas">${linhas.join('')}</div>`:''}
    </div>`;
  }).join('') + `<button type="button" class="emp-novo" onclick="abrirFormEmprestimo()">+ Novo empréstimo</button>`;
}
function escapeHtmlEmp(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- cadastro / edição ---------- */
let empEditandoId = null;
let empLogoAtual = null;
function renderEmpLogoPreview(){
  /* a própria logo é o botão (tocar coloca, troca ou remove) */
  document.getElementById('empLogoPreview').innerHTML = empLogoAtual ? `<img src="${empLogoAtual}" alt="">` : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';
}
function onEmpLogoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{ comprimirImagemDataUrl(e.target.result).then(url=>{ empLogoAtual = url; renderEmpLogoPreview(); }); };
  reader.readAsDataURL(file);
  event.target.value = '';
}
function removerEmpLogo(){ empLogoAtual = null; renderEmpLogoPreview(); }
function abrirFormEmprestimo(id){
  empEditandoId = id || null;
  const emp = id ? empPorId(id) : null;
  document.getElementById('empFormTitulo').textContent = emp ? 'Editar empréstimo' : 'Novo empréstimo';
  document.getElementById('empNome').value = emp ? emp.nome : '';
  document.getElementById('empValorRecebido').value = emp ? empFmtValorInput(emp.valorRecebido) : '';
  document.getElementById('empValorParcela').value = emp ? empFmtValorInput(emp.valorParcela) : '';
  document.getElementById('empNumParcelas').value = emp ? emp.numParcelas : '';
  document.getElementById('empPrimeiroVenc').value = emp ? emp.primeiroVenc : '';
  document.getElementById('empTaxa').value = emp && emp.taxaMensal ? String(emp.taxaMensal).replace('.',',') : '';
  empLogoAtual = emp ? (emp.logoUrl || null) : null;
  renderEmpLogoPreview();
  document.getElementById('empSimQtd').value = 1;
  document.getElementById('empSimData').value = '';
  atualizarPreviaFormEmp();
  document.getElementById('modalEmprestimo').classList.add('active');
}
function lerFormEmp(){
  return {
    nome: document.getElementById('empNome').value.trim(),
    valorRecebido: parseMoney(document.getElementById('empValorRecebido').value),
    valorParcela: parseMoney(document.getElementById('empValorParcela').value),
    numParcelas: parseInt(document.getElementById('empNumParcelas').value) || 0,
    primeiroVenc: document.getElementById('empPrimeiroVenc').value,
    taxaMensal: parseFloat(String(document.getElementById('empTaxa').value).replace(',','.')) || 0
  };
}
/* ---------- simulador (no cadastro) ---------- */
function empPct(x, casas){ return (x*100).toLocaleString('pt-BR',{minimumFractionDigits:casas||2, maximumFractionDigits:casas||2})+'%'; }
function empNum(x, casas){ return x.toLocaleString('pt-BR',{minimumFractionDigits:casas, maximumFractionDigits:casas}); }
/* parcela fixa (Price) para valor PV, taxa i e n parcelas */
function empParcelaPrice(PV, i, n){
  if(!(PV>0) || !(n>0)) return 0;
  if(!(i>0)) return PV/n;
  return PV*i/(1-Math.pow(1+i,-n));
}
/* a conta do desconto, parcela por parcela, para conferir com o banco */
function empDetalheAntecipacao(emp, ks, dia){
  const i = empTaxa(emp);
  let custo = 0;
  const linhas = ks.map(k=>{
    const venc = empVencimento(emp, k);
    const meses = Math.max(0, (venc - dia)/86400000/30);
    const vp = empValorPresente(emp, k, dia);
    custo += vp;
    return `<div class="emp-conta-linha">
      <div><b>Parcela ${k}</b> · vence ${venc.toLocaleDateString('pt-BR')} · faltam ${empNum(meses,1)} meses</div>
      <div class="emp-conta-formula">${fmtMoney(emp.valorParcela)} ÷ (1 + ${empPct(i)})<sup>${empNum(meses,1)}</sup> = <b>${fmtMoney(vp)}</b> <span class="emp-pos">(−${fmtMoney(emp.valorParcela-vp)})</span></div>
    </div>`;
  });
  const MAX = 6;
  const visiveis = linhas.length > MAX ? linhas.slice(0, MAX/2).concat([`<div class="emp-conta-linha emp-conta-mais">… mais ${linhas.length-MAX} parcelas na mesma conta …</div>`], linhas.slice(-MAX/2)) : linhas;
  return { html: visiveis.join(''), custo, nominal: ks.length*emp.valorParcela };
}
function empUsarParcelaCalculada(valor){
  document.getElementById('empValorParcela').value = empFmtValorInput(valor);
  atualizarPreviaFormEmp();
}
function mudarQtdSimEmp(delta){
  const el = document.getElementById('empSimQtd');
  const max = parseInt(el.max)||1;
  el.value = Math.min(max, Math.max(1, (parseInt(el.value)||1) + delta));
  atualizarPreviaFormEmp();
}
function atualizarPreviaFormEmp(){
  const f = lerFormEmp();
  const elContas = document.getElementById('empSimContas');
  const elDesc = document.getElementById('empSimDesconto');
  const elAnte = document.getElementById('empSimAntecipacao');
  /* parcela: a digitada ou, se vazia, a calculada pela taxa */
  const iInformada = f.taxaMensal/100;
  const parcelaPelaTaxa = (iInformada>0 && f.valorRecebido>0 && f.numParcelas>0) ? empParcelaPrice(f.valorRecebido, iInformada, f.numParcelas) : 0;
  const sim = Object.assign({}, f);
  if(!(sim.valorParcela>0) && parcelaPelaTaxa>0) sim.valorParcela = Math.round(parcelaPelaTaxa*100)/100;
  if(!(sim.valorParcela>0 && sim.numParcelas>0)){
    elContas.innerHTML = `<div class="emp-previa">Preencha <b>valor</b>, <b>nº de parcelas</b> e a <b>parcela</b> ou a <b>taxa</b> para ver a simulação.</div>`;
    elAnte.style.display = 'none';
    return;
  }
  const i = empTaxa(sim);
  const total = sim.valorParcela*sim.numParcelas;
  const juros = total - sim.valorRecebido;
  let html = `<div class="emp-sim-grid">
    <div><span>Parcela${f.valorParcela>0?'':' (pela taxa)'}</span><b>${fmtMoney(sim.valorParcela)}</b></div>
    <div><span>Total a pagar</span><b>${fmtMoney(total)}</b></div>
    ${sim.valorRecebido>0?`<div><span>Vou pagar a mais</span><b class="emp-alerta">${fmtMoney(juros)}</b><small>${empPct(juros/sim.valorRecebido,1)} do valor</small></div>`:''}
    <div><span>Taxa${f.taxaMensal>0?'':' (calculada)'}</span><b>${i>0?empPct(i)+' a.m.':'—'}</b>${i>0?`<small>${empPct(Math.pow(1+i,12)-1,1)} ao ano</small>`:''}</div>
  </div>`;
  if(!(f.valorParcela>0) && parcelaPelaTaxa>0){
    html += `<button type="button" class="emp-usar" onclick="empUsarParcelaCalculada(${sim.valorParcela})">Usar ${fmtMoney(sim.valorParcela)} como parcela</button>`;
  } else if(parcelaPelaTaxa>0 && Math.abs(parcelaPelaTaxa - f.valorParcela) >= 0.05){
    const taxaReal = empTaxa(Object.assign({}, f, {taxaMensal:0}));
    html += `<div class="emp-previa emp-aviso">Com ${empPct(iInformada)} a.m. a parcela seria <b>${fmtMoney(parcelaPelaTaxa)}</b>, mas a sua é <b>${fmtMoney(f.valorParcela)}</b>${taxaReal>0?`, o que dá <b>${empPct(taxaReal)} a.m.</b> de taxa efetiva`:''}. A diferença costuma ser IOF, seguro ou tarifa (o CET).</div>`;
  }
  elContas.innerHTML = html;

  /* antecipação: últimas N parcelas, pagas na data escolhida */
  if(!(i>0)){ elAnte.style.display = 'none'; return; }
  elAnte.style.display = '';
  const elQtd = document.getElementById('empSimQtd');
  elQtd.max = sim.numParcelas;
  const qtd = Math.min(sim.numParcelas, Math.max(1, parseInt(elQtd.value)||1));
  if(!sim.primeiroVenc){ const d=new Date(); d.setMonth(d.getMonth()+1); sim.primeiroVenc = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  const elData = document.getElementById('empSimData');
  if(!elData.value) elData.value = empHojeISO();
  const dia = new Date(elData.value+'T00:00:00');
  const ks = []; for(let k=sim.numParcelas-qtd+1; k<=sim.numParcelas; k++) ks.push(k);
  const det = empDetalheAntecipacao(sim, ks, dia);
  elDesc.innerHTML = `<div class="emp-sim-grid">
      <div><span>Valor das parcelas</span><b>${fmtMoney(det.nominal)}</b></div>
      <div><span>Pagaria</span><b>${fmtMoney(det.custo)}</b></div>
      <div><span>Desconto</span><b class="emp-pos">${fmtMoney(det.nominal-det.custo)}</b><small>${empPct((det.nominal-det.custo)/det.nominal,1)} das parcelas</small></div>
    </div>
    <details class="emp-conta"><summary>Ver a conta</summary>
      <div class="emp-conta-expl">Cada parcela é trazida para a data do pagamento descontando os juros dos meses que faltam: <b>parcela ÷ (1 + taxa)<sup>meses</sup></b>.${f.primeiroVenc?'':' Sem 1º vencimento, considerei daqui a 1 mês.'}</div>
      ${det.html}
    </details>`;
}
function salvarEmprestimo(){
  const f = lerFormEmp();
  if(!(f.valorParcela>0) || !(f.numParcelas>0) || !f.primeiroVenc){ showToast('Preencha parcela, nº de parcelas e 1º vencimento'); return; }
  f.logoUrl = empLogoAtual || null;
  const lista = garantirEmprestimos();
  if(empEditandoId){
    const emp = empPorId(empEditandoId);
    Object.assign(emp, f);
    Object.keys(emp.pagas||{}).forEach(k=>{ if(Number(k) > emp.numParcelas) delete emp.pagas[k]; });
  } else {
    lista.push(Object.assign({ id:'emp'+Date.now(), pagas:{}, criadoEm: Date.now() }, f));
  }
  persist();
  closeModal('modalEmprestimo');
  renderEmprestimos(); empAtualizarOutrasTelas();
  showToast('Empréstimo salvo');
}
async function excluirEmprestimo(id){
  const emp = empPorId(id);
  if(!emp) return;
  const ok = await iosConfirm(`Excluir "${emp.nome||'este empréstimo'}" e todo o histórico de pagamentos?`);
  if(!ok) return;
  state.emprestimos = garantirEmprestimos().filter(e=>e.id!==id);
  persist();
  renderEmprestimos(); empAtualizarOutrasTelas();
}

/* ---------- pagar a próxima parcela ---------- */
let empPagarId = null, empPagarK = null;
function abrirPagarParcelaEmp(id, kEspecifica){
  const emp = empPorId(id);
  const k = (kEspecifica && !empParcela(emp, kEspecifica)) ? kEspecifica : empPendentes(emp)[0];
  if(!k) return;
  empPagarId = id; empPagarK = k;
  const venc = empVencimento(emp, k);
  document.getElementById('empPagarInfo').textContent = `Parcela ${k} de ${emp.numParcelas} · vence ${venc.toLocaleDateString('pt-BR')}`;
  document.getElementById('empPagarValor').value = empFmtValorInput(emp.valorParcela);
  document.getElementById('empPagarData').value = empHojeISO();
  document.getElementById('modalEmpPagar').classList.add('active');
}
function confirmarPagarParcelaEmp(){
  const emp = empPorId(empPagarId);
  const k = emp && ((empPagarK && !empParcela(emp, empPagarK)) ? empPagarK : empPendentes(emp)[0]);
  if(!k) return;
  const valor = parseMoney(document.getElementById('empPagarValor').value);
  if(!(valor>0)){ showToast('Informe o valor pago'); return; }
  if(!emp.pagas) emp.pagas = {};
  emp.pagas[k] = { tipo:'paga', valorPago: valor, data: document.getElementById('empPagarData').value || empHojeISO() };
  persist();
  closeModal('modalEmpPagar');
  renderEmprestimos(); empAtualizarOutrasTelas();
  showToast('Parcela '+k+' paga');
}

/* ---------- amortizar: antecipa as últimas parcelas ---------- */
let empAmortId = null;
let empAmortModo = 'parcelas';   // 'parcelas' (quantas do fim) | 'valor' (quanto quero amortizar)
function abrirAmortizarEmp(id, valorSugerido){
  const emp = empPorId(id);
  const pend = empPendentes(emp);
  if(!pend.length) return;
  empAmortId = id;
  const qtd = document.getElementById('empAmortQtd');
  qtd.max = pend.length;
  qtd.value = 1;
  document.getElementById('empAmortData').value = empHojeISO();
  document.getElementById('empAmortAlvo').value = valorSugerido ? empFmtValorInput(valorSugerido) : '';
  selecionarModoAmortEmp(valorSugerido ? 'valor' : 'parcelas');
  document.getElementById('modalEmpAmortizar').classList.add('active');
}
function selecionarModoAmortEmp(modo){
  empAmortModo = modo;
  document.querySelectorAll('#empAmortModoChips .dif-chip').forEach(el=>el.classList.toggle('active', el.dataset.val===modo));
  document.getElementById('empAmortQtdField').style.display = modo==='parcelas' ? '' : 'none';
  document.getElementById('empAmortAlvoField').style.display = modo==='valor' ? '' : 'none';
  if(modo==='valor') aplicarValorAlvoAmortEmp(); else atualizarAmortizacaoEmp(true);
}
/* por valor: quantas parcelas do fim cabem no valor (pelo valor de hoje de cada uma) */
function empQtdPorValor(emp, valor, dataISO){
  const dia = dataISO ? new Date(dataISO+'T00:00:00') : new Date(); dia.setHours(0,0,0,0);
  const pend = empPendentes(emp).slice().reverse();   // da última para a primeira
  let qtd = 0, custo = 0;
  for(const k of pend){
    const vp = empValorPresente(emp, k, dia);
    if(custo + vp > valor + 0.005) break;
    custo += vp; qtd++;
  }
  const proxima = pend[qtd] ? empValorPresente(emp, pend[qtd], dia) : 0;
  return { qtd, custo, sobra: Math.max(0, valor - custo), proxima };
}
function aplicarValorAlvoAmortEmp(){
  const emp = empPorId(empAmortId);
  if(!emp) return;
  const alvo = parseMoney(document.getElementById('empAmortAlvo').value);
  const r = empQtdPorValor(emp, alvo, document.getElementById('empAmortData').value);
  const nota = document.getElementById('empAmortAlvoNota');
  if(!(alvo>0)){ nota.textContent = 'Digite quanto quer usar para amortizar.'; document.getElementById('empAmortQtd').value = 1; atualizarAmortizacaoEmp(true); return; }
  if(r.qtd===0){
    nota.innerHTML = `Esse valor não cobre nem a última parcela hoje (<b>${fmtMoney(r.proxima)}</b>).`;
    document.getElementById('empAmortQtd').value = 1;
  } else {
    nota.innerHTML = `Quita as <b>${r.qtd} últimas parcela${r.qtd>1?'s':''}</b> por cerca de <b>${fmtMoney(r.custo)}</b>${r.sobra>0.01?` · sobram <b>${fmtMoney(r.sobra)}</b>${r.proxima?` (a próxima custaria ${fmtMoney(r.proxima)})`:''}`:''}.`;
    document.getElementById('empAmortQtd').value = r.qtd;
  }
  atualizarAmortizacaoEmp(true);
}
function empParcelasAmortizar(emp, qtd){ return empPendentes(emp).slice(-qtd); }
function empEstimativaAmort(emp, qtd, dataISO){
  const dia = dataISO ? new Date(dataISO+'T00:00:00') : new Date();
  dia.setHours(0,0,0,0);
  const ks = empParcelasAmortizar(emp, qtd);
  const vps = ks.map(k=>empValorPresente(emp, k, dia));
  return { ks, vps, custo: vps.reduce((a,b)=>a+b,0), nominal: ks.length*emp.valorParcela };
}
function mudarQtdAmortEmp(delta){
  const el = document.getElementById('empAmortQtd');
  const max = parseInt(el.max)||1;
  el.value = Math.min(max, Math.max(1, (parseInt(el.value)||1) + delta));
  atualizarAmortizacaoEmp(true);
}
/* recalcula a estimativa; se "preencherValor", põe a estimativa no campo de valor pago */
function atualizarAmortizacaoEmp(preencherValor){
  const emp = empPorId(empAmortId);
  if(!emp) return;
  const elQtd = document.getElementById('empAmortQtd');
  const max = parseInt(elQtd.max)||1;
  const qtd = Math.min(max, Math.max(1, parseInt(elQtd.value)||1));
  const est = empEstimativaAmort(emp, qtd, document.getElementById('empAmortData').value);
  if(preencherValor) document.getElementById('empAmortValor').value = empFmtValorInput(Math.round(est.custo*100)/100);
  const pago = parseMoney(document.getElementById('empAmortValor').value);
  const desc = est.nominal - pago;
  const faixa = est.ks.length===1 ? 'parcela '+est.ks[0] : 'parcelas '+est.ks[0]+' a '+est.ks[est.ks.length-1];
  const dataISO = document.getElementById('empAmortData').value;
  const dia = dataISO ? new Date(dataISO+'T00:00:00') : new Date(); dia.setHours(0,0,0,0);
  const det = empDetalheAntecipacao(emp, est.ks, dia);
  document.getElementById('empAmortInfo').innerHTML =
    `<div class="emp-previa">Antecipando a${est.ks.length>1?'s':''} ${faixa} (${fmtMoney(est.nominal)} no total).<br>
     Estimativa pela taxa: <b>${fmtMoney(est.custo)}</b> · desconto <b class="emp-pos">${fmtMoney(Math.max(0, est.nominal-est.custo))}</b>
     <details class="emp-conta"><summary>Ver a conta</summary>
       <div class="emp-conta-expl">Taxa usada: <b>${empPct(empTaxa(emp))} a.m.</b> Cada parcela: <b>parcela ÷ (1 + taxa)<sup>meses até o vencimento</sup></b>.</div>
       ${det.html}
     </details></div>
     ${pago>0?`<div class="emp-previa">Com o valor informado, seu desconto fica em <b class="emp-pos">${fmtMoney(Math.max(0,desc))}</b>.</div>`:''}`;
}
function confirmarAmortizacaoEmp(){
  const emp = empPorId(empAmortId);
  if(!emp) return;
  const qtd = Math.max(1, parseInt(document.getElementById('empAmortQtd').value)||1);
  const data = document.getElementById('empAmortData').value || empHojeISO();
  const est = empEstimativaAmort(emp, qtd, data);
  const pago = parseMoney(document.getElementById('empAmortValor').value);
  if(!(pago>0)){ showToast('Informe quanto você pagou'); return; }
  if(!emp.pagas) emp.pagas = {};
  /* divide o valor pago entre as parcelas na proporção do valor presente de cada uma */
  let distribuido = 0;
  est.ks.forEach((k,idx)=>{
    let v = idx===est.ks.length-1 ? pago - distribuido : Math.round(pago * (est.vps[idx]/est.custo) * 100)/100;
    distribuido += v;
    emp.pagas[k] = { tipo:'antecipada', valorPago: v, data };
  });
  persist();
  closeModal('modalEmpAmortizar');
  renderEmprestimos(); empAtualizarOutrasTelas();
  showToast(est.ks.length+' parcela'+(est.ks.length>1?'s':'')+' antecipada'+(est.ks.length>1?'s':'')+' · desconto '+fmtMoney(Math.max(0, est.nominal-pago)));
}

/* ---------- desfazer ---------- */
async function desfazerParcelaEmp(id, k){
  const emp = empPorId(id);
  const p = emp && empParcela(emp, k);
  if(!p) return;
  const ok = await iosConfirm(`Desfazer o pagamento da parcela ${k} (${p.tipo==='antecipada'?'antecipada':'paga'} em ${empDataBR(p.data)} · ${fmtMoney(p.valorPago)})?`);
  if(!ok) return;
  delete emp.pagas[k];
  persist();
  renderEmprestimos(); empAtualizarOutrasTelas();
}
