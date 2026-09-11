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
  renderPlannerSaldoModoBtn();
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
function toggleUsarSaldoComoBase(){
  const u = state.currentUser;
  state.users[u].usarSaldoComoBase = !state.users[u].usarSaldoComoBase;
  persist();
  renderPlannerSaldoModoBtn();
  renderRendaTable();
  renderPanorama();
}
function renderPlannerSaldoModoBtn(){
  const u = state.currentUser;
  const btn = document.getElementById('btnSaldoModo');
  if(!btn) return;
  const ativo = !!state.users[u].usarSaldoComoBase;
  btn.classList.toggle('active', ativo);
  btn.textContent = ativo
    ? '✓ Calculando pelo saldo em conta — toque pra voltar a somar a renda'
    : 'Já recebi tudo e comecei a pagar? Toque pra calcular só pelo saldo em conta';
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

