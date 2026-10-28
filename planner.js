/* ================= RENDER: PLANNER ================= */

function renderPlanner(){
  const u = state.currentUser;
  document.getElementById('saldoAtualInput').value = state.users[u].saldoAtual ? state.users[u].saldoAtual.toFixed(2).replace('.',',') : '';
  renderSaldoBancos();
  const hdr = document.querySelector('.header');
  if(hdr) document.documentElement.style.setProperty('--header-h', hdr.offsetHeight+'px');

  renderRendaTable();
  ['moradia','assinatura','fixo','futuro'].forEach(cat=> renderGastoGrid(cat));
  renderCartaoTrackerList();
  renderReservaBadge();
  renderResumoMes();
}

let fluxoMesesExpandido = true;   // v12 (escolha A do Davi): os 12 meses sempre à vista
function toggleFluxoMeses(){
  fluxoMesesExpandido = !fluxoMesesExpandido;
  renderRendaTable();
}
function renderRendaTable(){
  const u = state.currentUser;
  const months = [];
  const numMeses = fluxoMesesExpandido ? 12 : 6;
  for(let i=0;i<numMeses;i++) months.push(addMonths(mesFinanceiroAtual(), i));
  const hoje = mesFinanceiroAtual();
  const btnToggle = document.getElementById('btnToggleFluxoMeses');
  if(btnToggle) btnToggle.classList.toggle('expandido', fluxoMesesExpandido);

  const thead = `<tr><th style="text-align:left;padding-left:10px">Categoria</th>${months.map(mKey=>{
    const isCurrent = mKey===hoje;
    return `<th class="${isCurrent?'current-col':''}">${monthLabel(mKey).slice(0,3)}${isCurrent?'<small>atual</small>':''}</th>`;
  }).join('')}<th></th></tr>`;

  const rendaRow = `<tr><td class="row-label">Renda</td>${months.map(mKey=>{
    if(salarioRecebidoNoMes(u, mKey)){
      return `<td class="cell-money-clickable ${mKey===hoje?'current-col':''}" onclick="abrirContasPagar('${mKey}')"><span class="cell-money-empty feito-tag">✓ recebido</span></td>`;
    }
    if(u==='davi'){
      const val = rendaBaseForMonth(u, mKey);
      return `<td class="${mKey===hoje?'current-col':''}" style="font-weight:700">${fmtMoney(val)}</td>`;
    }
    const val = state.users[u].income[mKey] || 0;
    return `<td class="cell-money ${mKey===hoje?'current-col':''}"><input type="text" inputmode="numeric" enterkeyhint="next" value="${val?val.toFixed(2).replace('.',','):''}" placeholder="0,00" oninput="maskMoneyInput(this)" onchange="setIncome('${u}','${mKey}', this.value)" onkeydown="handleMoneyKeydown(event)"></td>`;
  }).join('')}<td></td></tr>`;

  const extraRow = `<tr><td class="row-label">Extra</td>${months.map(mKey=>{
    const val = extraTotalForMonth(u, mKey);
    const nRec = extrasRecebidosNoMes(u, mKey).length;
    const vazio = nRec ? '<span class="cell-money-empty">✓ recebido</span>' : '<span class="cell-money-empty">+ Extra</span>';
    return `<td class="cell-money cell-money-clickable ${mKey===hoje?'current-col':''}" onclick="abrirRendaExtraModal('${u}','${mKey}')">${val?fmtMoney(val)+(nRec?'<div class="extra-rec-nota">+'+nRec+' recebido'+(nRec>1?'s':'')+'</div>':''):vazio}</td>`;
  }).join('')}<td></td></tr>`;

  const dizimoRow = (u!=='davi') ? '' : `<tr><td class="row-label" style="color:var(--text-faint)">Dízimo</td>${months.map(mKey=>{
    if(dizimoPagoNoMes(u, mKey)){
      return `<td class="cell-money-clickable ${mKey===hoje?'current-col':''}" onclick="abrirContasPagar('${mKey}')"><span class="cell-money-empty feito-tag">✓ pago</span></td>`;
    }
    const val = dizimoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}" style="color:var(--text-faint);font-weight:600">${fmtMoney(val)}</td>`;
  }).join('')}<td></td></tr>`;

  /* Gastos: o que falta pagar das contas do mês; toque abre cada gasto separado */
  const gastosRow = `<tr><td class="row-label">Gastos</td>${months.map(mKey=>{
    const val = gastosRestantesNoMes(u, mKey);
    const todos = gastosDoMes(u, mKey);
    const tudoPago = todos.length && val < 0.005;
    return `<td class="cell-money cell-money-clickable ${mKey===hoje?'current-col':''}" onclick="abrirGastosDoMes('${mKey}')">${tudoPago?'<span class="cell-money-empty feito-tag">✓ pago</span>':(val>0.004?fmtMoney(val):'<span class="cell-money-empty">—</span>')}</td>`;
  }).join('')}<td></td></tr>`;

  /* Cartão e Empréstimo: interruptor no rótulo = todos os meses; toque na célula = só aquele mês */
  const linhaGeral = (tipo, rotulo, valorFn)=>{
    const ligadoGeral = geralCfg()[tipo] !== false;
    return `<tr class="geral-extra-row"><td class="row-label"><span class="geral-extra-lbl">${rotulo}<button type="button" class="mini-switch${ligadoGeral?' on':''}" onclick="toggleGeralTudo('${tipo}')" title="Contar em todos os meses" aria-pressed="${ligadoGeral}"><span></span></button></span></td>${months.map(mKey=>{
      const v = valorFn(mKey);
      const on = incluiNoGeral(tipo, mKey);
      return `<td class="cell-money-clickable geral-extra-cell${on?'':' fora'}${mKey===hoje?' current-col':''}" onclick="toggleGeralMes('${tipo}','${mKey}')" title="${on?'Contando — toque para tirar deste mês':'Fora — toque para contar neste mês'}">${v>0.004?fmtMoney(v):'<span class="cell-money-empty">—</span>'}<small>${on?'conta':'fora'}</small></td>`;
    }).join('')}<td></td></tr>`;
  };
  const cartaoRow = (u==='davi' && (state.cartoesTracker||[]).length) ? linhaGeral('cartao', 'Cartão', cartaoValorGeralNoMes) : '';
  const empRow = (u==='davi' && (state.emprestimos||[]).length) ? linhaGeral('emprestimo', 'Empréstimo', emprestimoValorGeralNoMes) : '';

  const sobraRow = `<tr class="total-row"><td class="row-label">Sobra estimada</td>${months.map(mKey=>{
    const s = saldoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}"><span class="total-value" style="color:${s>=0?'var(--success)':'var(--danger)'}">${fmtMoneySigned(s)}</span></td>`;
  }).join('')}<td></td></tr>`;

  /* acumulado (v12, escolha A): a sobra somando mês a mês, começando pelo saldo de hoje */
  let acum = state.users[u].saldoAtual || 0;
  const acumRow = `<tr class="acum-row"><td class="row-label">Acumulado</td>${months.map((mKey, i)=>{
    acum = i === 0 ? saldoForMonth(u, mKey) : acum + saldoForMonth(u, mKey);
    return `<td class="${mKey===hoje?'current-col':''}"><span class="${acum>=0?'pos':'neg'}">${fmtCompacto(acum)}</span></td>`;
  }).join('')}<td></td></tr>`;

  document.getElementById('rendaTableThead').innerHTML = thead;
  document.getElementById('rendaTableBody').innerHTML = rendaRow + extraRow + dizimoRow + gastosRow + cartaoRow + empRow + sobraRow + acumRow;
}

/* janela com cada gasto do mês, agrupado como nas seções do Dashboard */
const GASTO_GRUPOS = [['moradia','Moradia'],['assinatura','Assinaturas'],['fixo','Fixos'],['futuro','Contas Futuras']];
function abrirGastosDoMes(mKey){
  const u = state.currentUser;
  const lista = gastosDoMes(u, mKey);
  const total = lista.reduce((s,g)=>s+g.valor, 0), falta = lista.reduce((s,g)=>s+g.restante, 0);
  document.getElementById('gastosMesTitulo').textContent = 'Gastos · ' + monthLabelLong(mKey);
  const linha = g=>{
    const logo = g.logoUrl ? `<img src="${g.logoUrl}" class="conta-logo" alt="">` : g.dia ? gmCal(g.dia) : `<span class="gm-inicial">${escBanco((g.desc||'?').charAt(0).toUpperCase())}</span>`;
    const parcial = !g.pago && g.restante < g.valor - 0.004;
    const sub = g.pago ? 'pago' : (parcial ? `falta ${fmtMoney(g.restante)}` : (g.dia ? 'dia '+g.dia : ''));
    return `<div class="gm-linha${g.pago?' pago':''}">${logo}<div class="gm-info"><div class="gm-nome">${escBanco(g.desc)}</div>${sub?`<div class="gm-sub">${sub}</div>`:''}</div><div class="gm-valor">${fmtMoney(g.valor)}</div></div>`;
  };
  const html = GASTO_GRUPOS.map(([cat, nome])=>{
    const itens = lista.filter(g=>g.cat===cat).sort((a,b)=>(a.pago-b.pago) || (b.valor-a.valor));
    if(!itens.length) return '';
    const sub = itens.reduce((s,g)=>s+g.valor, 0);
    return `<div class="gm-grupo"><div class="gm-grupo-topo"><span>${nome}</span><span>${fmtMoney(sub)}</span></div>${itens.map(linha).join('')}</div>`;
  }).join('');
  document.getElementById('gastosMesLista').innerHTML = html || '<div class="gm-vazio">Nenhum gasto neste mês.</div>';
  document.getElementById('gastosMesTotal').innerHTML = `<span>Total do mês <b>${fmtMoney(total)}</b></span><span class="${falta>0.004?'neg':'pos'}">${falta>0.004?'Falta pagar '+fmtMoney(falta):'✓ Tudo pago'}</span>`;
  document.getElementById('modalGastosMes').classList.add('active');
  document.body.style.overflow = 'hidden';
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
  renderSaldoBancos();
  renderRendaTable();
  renderPanorama();
  persist();
}
/* ===== SALDO POR BANCO =====
   Opcional: você anota quanto tem em cada banco e a soma vira o "Saldo em conta".
   O campo do saldo continua aceitando digitar direto; se ficar diferente da soma, a linha dos bancos avisa. */
function escBanco(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function bancosDoUsuario(){ const us = state.users[state.currentUser]; if(!us.bancos) us.bancos = []; return us.bancos; }
function totalBancos(lista){ return Math.round(lista.reduce((s,b)=>s + (Number(b.valor)||0), 0)*100)/100; }
function abrirBancosModal(){
  const el = document.getElementById('bancosLista');
  el.innerHTML = '';
  const lista = bancosDoUsuario();
  if(lista.length) lista.forEach(b=>adicionarBancoLinha(false, b));
  else adicionarBancoLinha(false);
  atualizarTotalBancos();
  const ez = document.getElementById('bancosEsconderZerados'); if(ez) ez.checked = !!(state.users[state.currentUser] || {}).esconderZerados;
  document.getElementById('modalBancos').classList.add('active');
  document.body.style.overflow = 'hidden';
}
/* cada banco: logo redonda (toque = escolher a imagem; v12, a logo é a que o Davi importar), cor do cartão, nome e saldo.
   logo e cor ficam guardadas na própria linha (dataset) e voltam no salvarBancos */
function bancoLogoHtml(b, i){
  const cor = (b && b.cor) || corDoBanco(b && b.nome, i);
  return b && b.logoUrl ? `<img src="${b.logoUrl}" alt="">` : `<span style="background:${cor}">${escBanco(((b && b.nome) || '?').trim().charAt(0).toUpperCase() || '?')}</span>`;
}
function adicionarBancoLinha(focar, b){
  const el = document.getElementById('bancosLista');
  const linha = document.createElement('div');
  linha.className = 'banco-linha';
  const i = el.children.length;
  linha.dataset.logo = (b && b.logoUrl) || '';
  linha.dataset.cor = (b && b.cor) || '';
  const valor = b && b.valor ? Number(b.valor).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') : '';
  linha.innerHTML = `<button type="button" class="banco-logo" title="Logo do banco" aria-label="Logo do banco" onclick="bancoLogoEscolher(this)">${bancoLogoHtml(b, i)}</button>
    <input type="text" class="banco-nome" placeholder="Banco" value="${escBanco(b ? b.nome : '')}" autocomplete="off">
    <div class="input-money banco-valor"><input type="text" inputmode="numeric" placeholder="0,00" value="${valor}" oninput="maskMoneyInput(this);atualizarTotalBancos()"></div>
    <label class="banco-cor" title="Cor do cartão" aria-label="Cor do cartão"><input type="color" value="${(b && b.cor) || corDoBanco(b && b.nome, i)}" onchange="bancoCorMudou(this)"></label>
    <button type="button" class="btn-icon-sm banco-del" aria-label="Remover banco" onclick="this.closest('.banco-linha').remove();atualizarTotalBancos()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></button>`;
  el.appendChild(linha);
  if(focar) linha.querySelector('.banco-nome').focus();
}
let bancoLogoLinha = null;
function bancoLogoEscolher(btn){
  bancoLogoLinha = btn.closest('.banco-linha');
  if(bancoLogoLinha.dataset.logo){   // já tem logo: tocar de novo tira
    bancoLogoLinha.dataset.logo = '';
    btn.innerHTML = bancoLogoHtml({ nome: bancoLogoLinha.querySelector('.banco-nome').value, cor: bancoLogoLinha.dataset.cor }, 0);
    return;
  }
  document.getElementById('bancoLogoArquivo').click();
}
function bancoLogoEscolhida(ev){
  const file = ev.target.files[0]; ev.target.value = '';
  const linha = bancoLogoLinha; if(!file || !linha) return;
  const r = new FileReader();
  r.onload = e=>comprimirImagemDataUrl(e.target.result, 160).then(url=>{
    linha.dataset.logo = url;
    linha.querySelector('.banco-logo').innerHTML = `<img src="${url}" alt="">`;
    /* a cor do cartão vira a cor que mais aparece na logo (dá para trocar depois no seletor) */
    const pintar = ()=>{
      const c = corDaLogo(url); if(!c) return;
      const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(c.fundo); if(!m) return;
      const hex = '#' + [m[1], m[2], m[3]].map(n=>(+n).toString(16).padStart(2, '0')).join('');
      linha.dataset.cor = hex;
      const inp = linha.querySelector('.banco-cor input'); if(inp) inp.value = hex;
    };
    if(corDaLogo(url, pintar)) pintar();
  });
  r.readAsDataURL(file);
}
function bancoCorMudou(inp){
  const linha = inp.closest('.banco-linha'); linha.dataset.cor = inp.value;
  if(!linha.dataset.logo) linha.querySelector('.banco-logo').innerHTML = bancoLogoHtml({ nome: linha.querySelector('.banco-nome').value, cor: inp.value }, 0);
}
function lerBancosDaJanela(){
  return [...document.querySelectorAll('#bancosLista .banco-linha')].map(l=>({
    nome: l.querySelector('.banco-nome').value.trim(),
    valor: parseMoney(l.querySelector('.banco-valor input').value),
    logoUrl: l.dataset.logo || '',
    cor: l.dataset.cor || ''
  })).filter(b=>b.nome || b.valor);
}
function atualizarTotalBancos(){
  const lista = lerBancosDaJanela();
  document.getElementById('bancosTotal').innerHTML = `<span>Total em ${lista.length} banco${lista.length===1?'':'s'}</span><b>${fmtMoney(totalBancos(lista))}</b>`;
}
function salvarBancos(){
  const lista = lerBancosDaJanela().map((b,i)=>{
    const o = { id: 'bc'+Date.now().toString(36)+i, nome: b.nome || 'Banco', valor: b.valor };
    if(b.logoUrl) o.logoUrl = b.logoUrl;
    if(b.cor) o.cor = b.cor;
    return o;
  });
  const us = state.users[state.currentUser];
  us.bancos = lista;
  const ez = document.getElementById('bancosEsconderZerados');
  if(ez){ if(ez.checked) us.esconderZerados = true; else delete us.esconderZerados; }
  if(lista.length) us.saldoAtual = totalBancos(lista);
  closeModal('modalBancos');
  renderPlanner();
  renderPanorama();
  persist();
  showToast(lista.length ? 'Saldo em conta: '+fmtMoney(us.saldoAtual) : 'Bancos removidos');
}
/* linha embaixo do saldo: cada banco com o valor; avisa se o saldo digitado não bate com a soma */
function renderSaldoBancos(){
  const el = document.getElementById('saldoBancosInfo'); if(!el) return;
  const us = state.users[state.currentUser];
  const lista = us.bancos || [];
  if(!lista.length){ el.style.display = 'none'; return; }
  const total = totalBancos(lista);
  const difere = Math.abs(total - (us.saldoAtual||0)) > 0.004;
  /* os bancos aparecem na carteira (cartões empilhados); aqui fica só o aviso quando a soma não bate */
  if(!difere){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.classList.toggle('difere', difere);
  el.innerHTML = `<span class="saldo-bancos-lista">${lista.map(b=>`<span>${escBanco(b.nome)} <b>${fmtMoney(b.valor)}</b></span>`).join('')}</span>`
    + (difere ? `<span class="saldo-bancos-aviso">Soma ${fmtMoney(total)}</span>` : '');
}
/* ===== METAS DE ECONOMIA (reserva, viagem...): state.metasEconomia = [{ id, nome, guardado, alvo, porMes }] ===== */
function metasEconomia(){ if(!state.metasEconomia) state.metasEconomia = []; return state.metasEconomia; }
function metaPct(m){ return m.alvo > 0 ? Math.min(100, Math.round((Number(m.guardado)||0) / m.alvo * 100)) : 0; }
function openReservaModal(){
  metaMexendo = null;
  metaFormFechar();
  document.getElementById('modalReserva').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function renderMetasLista(){
  const el = document.getElementById('metasLista'); if(!el) return;
  const lista = metasEconomia();
  if(!lista.length){ el.innerHTML = `<div class="gm-vazio">Nenhuma meta ainda. Crie uma: reserva, viagem, carro…</div>`; return; }
  const total = lista.reduce((s,m)=>s + (Number(m.guardado)||0), 0);
  el.innerHTML = `<div class="metas-total"><span>Guardado ao todo</span><b>${fmtMoney(total)}</b></div>` + lista.map(m=>{
    const falta = Math.max(0, (m.alvo||0) - (Number(m.guardado)||0)), pct = metaPct(m);
    const meses = falta > 0 && m.porMes > 0 ? Math.ceil(falta / m.porMes) : 0;
    const sub = !m.alvo ? 'sem valor alvo' : falta <= 0 ? 'Meta batida ✓' : `faltam ${fmtMoney(falta)}${meses ? ` · ${meses} ${meses===1?'mês':'meses'} no ritmo de ${fmtMoney(m.porMes)}` : ''}`;
    return `<div class="meta-item">
      <button type="button" class="meta-item-topo" onclick="metaFormAbrir('${m.id}')">
        <span class="meta-item-nome">${escBanco(m.nome||'Meta')}</span>
        <span class="meta-item-valor">${fmtMoney(m.guardado||0)}${m.alvo ? `<small> de ${fmtMoney(m.alvo)}</small>` : ''}</span>
      </button>
      ${m.alvo ? `<div class="reserva-proj-barra"><div class="reserva-proj-barra-fill" style="width:${pct}%"></div></div>` : ''}
      <div class="meta-item-rodape"><span class="${falta<=0 && m.alvo ? 'reserva-proj-ok' : ''}">${sub}</span>
        <span class="meta-item-botoes"><button type="button" class="ico-btn" title="Tirei" aria-label="Tirei dinheiro" onclick="metaMexer('${m.id}',-1)">${ICO(ICO_D.menos, 20)}</button><button type="button" class="ico-btn" title="Guardei" aria-label="Guardei dinheiro" onclick="metaMexer('${m.id}',1)">${ICO(ICO_D.mais, 20)}</button></span></div>
      ${metaMexendo && metaMexendo.id === m.id ? `<form class="meta-mexer" onsubmit="event.preventDefault();metaMexerOk()"><span>${metaMexendo.sinal > 0 ? 'Guardei' : 'Tirei'}</span><div class="input-money"><input type="text" id="metaMexerValor" inputmode="numeric" placeholder="0,00" oninput="maskMoneyInput(this)" enterkeyhint="done"></div><button type="submit" class="btn btn-sm">OK</button></form>` : ''}
    </div>`;
  }).join('');
}
function metaFormAbrir(id){
  const m = id ? metasEconomia().find(x=>x.id===id) : null;
  const din = v => v ? Number(v).toFixed(2).replace('.',',') : '';
  document.getElementById('metaId').value = m ? m.id : '';
  document.getElementById('metaNome').value = m ? m.nome : '';
  document.getElementById('reservaValorInput').value = din(m && m.guardado);
  document.getElementById('reservaMetaInput').value = din(m && m.alvo);
  document.getElementById('reservaAporteInput').value = din(m && m.porMes);
  ['reservaValorInput','reservaMetaInput','reservaAporteInput'].forEach(k=>{ const e = document.getElementById(k); if(e.value) maskMoneyInput(e); });
  document.getElementById('metaExcluirBtn').style.display = m ? '' : 'none';
  document.getElementById('metasLista').style.display = 'none';
  document.getElementById('metasAcoes').style.display = 'none';
  document.getElementById('metaForm').style.display = '';
  atualizarReservaProjecao();
  if(!m) setTimeout(()=>document.getElementById('metaNome').focus(), 60);
}
function metaFormFechar(){
  document.getElementById('metaForm').style.display = 'none';
  document.getElementById('metasLista').style.display = '';
  document.getElementById('metasAcoes').style.display = '';
  renderMetasLista();
}
function atualizarReservaProjecao(){
  const el = document.getElementById('reservaProjecao');
  if(!el) return;
  const atual = parseMoney(document.getElementById('reservaValorInput').value) || 0;
  const meta = parseMoney(document.getElementById('reservaMetaInput').value) || 0;
  const aporte = parseMoney(document.getElementById('reservaAporteInput').value) || 0;
  if(meta <= 0){ el.innerHTML = ''; return; }
  const falta = Math.max(0, meta - atual);
  const pct = Math.min(100, Math.round((atual/meta)*100));
  let linhaMeses = '';
  if(falta > 0 && aporte > 0){
    const meses = Math.ceil(falta/aporte);
    linhaMeses = `<div class="reserva-proj-linha">No ritmo de ${fmtMoney(aporte)}/mês, faltam <b>${meses} ${meses===1?'mês':'meses'}</b> pra bater a meta</div>`;
  } else if(falta === 0){
    linhaMeses = `<div class="reserva-proj-linha reserva-proj-ok">Meta batida ✓</div>`;
  }
  el.innerHTML = `
    <div class="reserva-proj-barra"><div class="reserva-proj-barra-fill" style="width:${pct}%"></div></div>
    <div class="reserva-proj-linha">${fmtMoney(atual)} de ${fmtMoney(meta)} (${pct}%)${falta>0?' · faltam '+fmtMoney(falta):''}</div>
    ${linhaMeses}
  `;
}
function salvarReserva(){
  const id = document.getElementById('metaId').value;
  const nome = document.getElementById('metaNome').value.trim();
  if(!nome){ showToast('Dê um nome para a meta'); document.getElementById('metaNome').focus(); return; }
  const dados = { nome,
    guardado: parseMoney(document.getElementById('reservaValorInput').value) || 0,
    alvo: parseMoney(document.getElementById('reservaMetaInput').value) || 0,
    porMes: parseMoney(document.getElementById('reservaAporteInput').value) || 0 };
  const m = id ? metasEconomia().find(x=>x.id===id) : null;
  if(m) Object.assign(m, dados); else metasEconomia().push({ id:'me'+Date.now(), ...dados });
  persist();
  metaFormFechar();
  renderReservaBadge();
  showToast('Meta salva');
}
function excluirMetaEconomia(){
  const id = document.getElementById('metaId').value;
  const m = metasEconomia().find(x=>x.id===id); if(!m) return;
  if(!confirm(`Excluir a meta "${m.nome}"?`)) return;
  state.metasEconomia = metasEconomia().filter(x=>x.id!==id);
  persist();
  metaFormFechar();
  renderReservaBadge();
}
/* + Guardar / − Tirar: abre um campo de valor dentro da meta; OK soma/subtrai do guardado */
let metaMexendo = null;
function metaMexer(id, sinal){
  metaMexendo = (metaMexendo && metaMexendo.id === id && metaMexendo.sinal === sinal) ? null : { id, sinal };
  renderMetasLista();
  const e = document.getElementById('metaMexerValor'); if(e) e.focus();
}
function metaMexerOk(){
  const mm = metaMexendo; if(!mm) return;
  const m = metasEconomia().find(x=>x.id===mm.id);
  const v = parseMoney(document.getElementById('metaMexerValor').value) || 0;
  metaMexendo = null;
  if(!m || !(v > 0)){ renderMetasLista(); return; }
  m.guardado = Math.max(0, Math.round(((Number(m.guardado)||0) + mm.sinal*v)*100)/100);
  persist();
  renderMetasLista();
  renderReservaBadge();
  showToast(mm.sinal > 0 && m.alvo && m.guardado >= m.alvo ? `Meta "${m.nome}" batida!` : `${m.nome}: ${fmtMoney(m.guardado)}`);
}function renderReservaBadge(){
  const el = document.getElementById('reservaBadge');
  if(!el) return;
  const lista = metasEconomia().filter(m=>(Number(m.guardado)||0) > 0 || m.alvo > 0);
  if(!lista.length){ el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const total = lista.reduce((s,m)=>s + (Number(m.guardado)||0), 0);
  const comAlvo = lista.filter(m=>m.alvo > 0);
  const pctTxt = comAlvo.length === 1 ? ` <span class="reserva-badge-pct">${metaPct(comAlvo[0])}%</span>` : (comAlvo.length > 1 ? ` <span class="reserva-badge-pct">${comAlvo.length} metas</span>` : '');
  el.innerHTML = `<span>Guardado</span><b>${fmtMoney(total)}</b>${pctTxt}`;
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

let gastoMostrarArquivados = {};
function toggleArquivadosGasto(cat){
  gastoMostrarArquivados[cat] = !gastoMostrarArquivados[cat];
  renderGastoGrid(cat);
}
function desarquivarGasto(cat, id){
  const item = state.users[state.currentUser].expenses[cat].find(i=>i.id===id);
  if(!item) return;
  item.arquivado = false;
  renderGastoGrid(cat);
  renderPanorama();
  persist();
  showToast('Conta restaurada');
}
function toggleSecaoGasto(cat){
  const atual = secoesGastoColapsadas[cat];
  const colapsadaAgora = atual===undefined ? true : atual;   // começa sempre fechada
  secoesGastoColapsadas[cat] = !colapsadaAgora;
  renderGastoGrid(cat);
}
/* Resumo no topo de cada bloco de contas: total do mês atual e, se já pagou algo, pago / falta com barra */
function renderResumoSecaoGasto(cat){
  const secao = document.getElementById('secao-'+cat);
  if(!secao) return;
  let el = secao.querySelector('.sec-resumo');
  if(!el){
    el = document.createElement('div');
    el.className = 'sec-resumo';
    secao.querySelector('.section-head').insertAdjacentElement('afterend', el);
  }
  const u = state.currentUser, mKey = mesFinanceiroAtual();
  const contas = getContasDoMes(mKey, u).filter(it=>it.cat===cat);
  let total = 0, falta = 0;
  contas.forEach(it=>{
    const v = Number(it.valor)||0;
    const pk = mKey+'_'+u+'_'+cat+'_'+it.id;
    total += v;
    if(!state.paid[pk]) falta += restanteConta(pk, v);
  });
  const pago = Math.max(0, total - falta);
  /* total do mês em dourado no cabeçalho da seção (v12, mistura B do Davi) */
  const head = secao.querySelector('.section-head');
  let ht = head.querySelector('.sec-head-total');
  if(!ht){ ht = document.createElement('span'); ht.className = 'sec-head-total'; head.querySelector('.section-title').after(ht); }
  ht.textContent = total > 0.004 ? fmtMoney(total) : '';
  if(total < 0.005){ el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  const pct = Math.min(100, Math.round(pago/total*100));
  el.innerHTML = pago < 0.005
    ? `<div class="sec-resumo-linha"><span>Total em ${monthLabel(mKey)}</span><b>${fmtMoney(total)}</b></div>`
    : `<div class="sec-resumo-linha"><span>Total em ${monthLabel(mKey)}</span><b>${fmtMoney(total)}</b></div>
       <div class="sec-resumo-bar"><div style="width:${pct}%"></div></div>
       <div class="sec-resumo-linha sec-resumo-sub"><span class="pago">Pago ${fmtMoney(pago)}</span><span class="${falta<0.005?'pago':''}">${falta<0.005?'✓ tudo pago':'Falta '+fmtMoney(falta)}</span></div>`;
}
const gastoFiltro = {};   // filtro de cada seção (só na tela): 'todas' | 'aberto' | 'pagas'
function gastoFiltrar(cat, f){ gastoFiltro[cat] = f; renderGastoGrid(cat); }
function renderGastoGrid(cat){
  renderResumoSecaoGasto(cat);
  const u = state.currentUser;
  const todos = state.users[u].expenses[cat];
  const items = todos.filter(i=>!i.arquivado);
  const arquivados = todos.filter(i=>i.arquivado);
  const secao = document.getElementById('secao-'+cat);
  if(secao){
    const colapsada = secoesGastoColapsadas[cat]!==undefined ? secoesGastoColapsadas[cat] : true;   // ao abrir o app, todas fechadas
    secao.classList.toggle('collapsed', colapsada);
  }
  const grid = document.getElementById('grid-'+cat);
  /* filtro Todas / Em aberto / Pagas (v12, escolha C do Davi), por seção */
  const mFil = mesFinanceiroAtual(), filtro = gastoFiltro[cat] || 'todas';
  const pagaNoMes = item=>!!state.paid[mFil+'_'+u+'_'+cat+'_'+item.id];
  const filtrados = filtro === 'pagas' ? items.filter(pagaNoMes) : filtro === 'aberto' ? items.filter(i=>!pagaNoMes(i)) : items;
  const chips = items.length ? `<div class="sec-filtro">${[['todas','Todas'],['aberto','Em aberto'],['pagas','Pagas']].map(([k, t])=>`<button type="button" class="${filtro === k ? 'on' : ''}" onclick="gastoFiltrar('${cat}','${k}')">${t}</button>`).join('')}</div>` : '';
  if(!items || items.length===0){
    grid.innerHTML = `<div class="empty-state"><div class="title">Nada por aqui</div><div class="desc">Toque em + para incluir um gasto</div></div>`;
  }else if(!filtrados.length){
    grid.innerHTML = chips + `<div class="gm-vazio">${filtro === 'pagas' ? 'Nenhuma paga ainda' : 'Tudo pago'} em ${monthLabel(mFil)}.</div>`;
  }else{
  grid.innerHTML = chips + filtrados.map(item=>{
    const metaTxt = cat==='futuro' ? futuroDescricaoMeta(item) : (item.logoUrl ? 'dia '+(item.dia||1) : 'todo mês')+(item.mesInicio?' · a partir de '+monthLabel(item.mesInicio):'');
    const valorTxt = cat==='futuro'
      ? (item.recorrente || (item.parcelas||1)<=1 || item.replicar!==false
          ? fmtMoney(item.valor)
          : 'Variável')
      : fmtMoney(item.valor);
    /* logo da conta, senão o calendário com o dia (v12, escolha A do Davi) */
    const logo = item.logoUrl
      ? `<img src="${item.logoUrl}" class="conta-logo">`
      : (cat !== 'futuro' ? gmCal(item.dia || 1) : `<div class="conta-logo conta-logo-placeholder">${item.desc.charAt(0).toUpperCase()}</div>`);
    const mAtual = mesFinanceiroAtual();
    const pk = mAtual+'_'+u+'_'+cat+'_'+item.id;
    const ativoNoMes = cat==='futuro' ? futuroValorNoMes(item, mAtual)>0 : !(item.mesInicio && mAtual < item.mesInicio);
    const pago = !!state.paid[pk];
    const parc = (state.pagamentosParciais||{})[pk] || 0;
    const statusTxt = !ativoNoMes ? '' : (pago ? ' · <b class="lr-paga">✓ paga</b>' : (parc>0 ? ' · <b style="color:var(--warning)">pago '+fmtMoney(parc)+'</b>' : ' · aberta'));
    const btnPagar = !ativoNoMes ? '' : `<button class="btn-icon-sm" title="Registrar pagamento" onclick="abrirEditarConta('${pk}','${u}','${cat}','${item.id}','${mAtual}')">$</button>`;
    return `<div class="list-row">
      ${logo}
      <div class="lr-info">
        <div class="lr-desc">${item.desc}</div>
        ${item.descricao?`<div class="lr-caption">${item.descricao}</div>`:''}
        <div class="lr-meta">${metaTxt}${statusTxt}</div>
      </div>
      <div class="lr-right">
        <div class="lr-actions">
          ${btnPagar}
          <button class="btn-icon-sm" onclick="editGasto('${cat}','${item.id}')">${ICON_EDIT}</button>
          <button class="btn-icon-sm" onclick="deleteGasto('${cat}','${item.id}')">${ICON_TRASH}</button>
        </div>
        <div class="lr-value">${valorTxt}</div>
      </div>
    </div>`;
  }).join('');
  }
  const arqEl = document.getElementById('grid-'+cat+'-arquivados');
  if(arqEl){
    if(arquivados.length===0){ arqEl.innerHTML = ''; }
    else{
      const aberto = !!gastoMostrarArquivados[cat];
      arqEl.innerHTML = `<button class="link-btn-sm" onclick="toggleArquivadosGasto('${cat}')">${aberto?'Ocultar':'Ver'} arquivados (${arquivados.length})</button>` +
        (aberto ? arquivados.map(item=>`<div class="list-row list-row-arquivado">
          <div class="lr-info"><div class="lr-desc">${item.desc}</div></div>
          <div class="lr-right">
            <div class="lr-actions">
              <button class="btn-icon-sm" title="Restaurar" onclick="desarquivarGasto('${cat}','${item.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
              <button class="btn-icon-sm" onclick="deleteGasto('${cat}','${item.id}')">${ICON_TRASH}</button>
            </div>
            <div class="lr-value">${fmtMoney(item.valor)}</div>
          </div>
        </div>`).join('') : '');
    }
  }
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
/* Valor da parcela de uma compra do cartão (Tracker) num mês qualquer, não só "hoje" */
function compraTrackerValorNoMes(item, mKey){
  if(item.pago) return 0;
  const parcelas = Math.min(120, Math.max(1, Number(item.parcelas)||1));
  if(!item.mesInicio) return 0;
  const valorParcela = (Number(item.valorTotal)||0) / parcelas;
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio, i));
  return meses.includes(mKey) ? valorParcela : 0;
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
let cartoesExpandidos = {};
let secoesGastoColapsadas = {};
let quitadasMostrarPorCartao = {};
let faturaMesSelecionado = {};
/* Fatura de um cartão num mês: parcelas + à vista + assinaturas */
function faturaCartaoNoMes(cartao, mKey){
  const compras = (state.comprasTracker||[]).filter(c=>c.cartaoId===cartao.id);
  const totalParcelas = compras.reduce((s,item)=>s+compraTrackerValorNoMes(item, mKey), 0);
  const totalVista = (cartao.credoVista||[]).filter(cv=>cv.mKey===mKey).reduce((s,cv)=>s+Number(cv.valor||0), 0);
  const totalAssinaturas = (cartao.assinaturas||[]).reduce((s,a)=>s+assinaturaValorNoMes(a, mKey), 0);
  return totalParcelas + totalVista + totalAssinaturas;
}
/* ================= STATUS DA FATURA DO CARTÃO ================= */
/* Fatura "M" = a que fecha no dia de fechamento do mês M e vence no dia de vencimento (no mesmo mês, ou no seguinte se o vencimento é menor que o fechamento) */
function diaNoMesData(mKey, dia){
  const d = keyToDate(mKey);
  return new Date(d.getFullYear(), d.getMonth(), Math.min(Math.max(1, dia), daysInMonth(mKey)));
}
function cartaoDatasFatura(cartao, mKey){
  const fech = parseInt(cartao.fechamento)||0, venc = parseInt(cartao.vencimento)||0;
  if(!fech || !venc) return null;
  return { fecha: diaNoMesData(mKey, fech), vence: venc > fech ? diaNoMesData(mKey, venc) : diaNoMesData(addMonths(mKey,1), venc) };
}
function fmtDiaMesCurto(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
function faturaRegistro(cartao, mKey){ return (state.faturasCartao||{})[cartao.id+'_'+mKey] || null; }
function faturaPagaValor(cartao, mKey){ const r = faturaRegistro(cartao, mKey); return r ? (Number(r.pago)||0) : 0; }
/* "considerar paga": a fatura fica quitada com o valor informado, mesmo que diferente do total calculado */
function faturaQuitada(cartao, mKey){ const r = faturaRegistro(cartao, mKey); return !!(r && r.quitada); }
/* quanto ainda falta pagar da fatura (o que já foi pago deixa de contar) */
function faturaRestanteNoMes(cartao, mKey){
  if(faturaQuitada(cartao, mKey)) return 0;
  return Math.max(0, faturaCartaoNoMes(cartao, mKey) - faturaPagaValor(cartao, mKey));
}
/* st: aberto | fechado (aguardando pagamento) | vencido (gerando juros) | parcial (pago em parte) | pago | vazio */
function faturaStatus(cartao, mKey){
  const total = faturaCartaoNoMes(cartao, mKey), pago = faturaPagaValor(cartao, mKey);
  const quitada = faturaQuitada(cartao, mKey);
  const resta = quitada ? 0 : Math.max(0, total - pago);
  const datas = cartaoDatasFatura(cartao, mKey);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  let st;
  if(quitada) st = 'pago';
  else if(total < 0.005 && pago < 0.005) st = 'vazio';
  else if(pago > 0 && resta < 0.005) st = 'pago';
  else if(!datas) st = pago > 0 ? 'parcial' : 'aberto';
  else if(hoje < datas.fecha) st = pago > 0 ? 'parcial' : 'aberto';
  else if(hoje > datas.vence) st = 'vencido';
  else st = pago > 0 ? 'parcial' : 'fechado';
  return { st, total, pago, resta, datas };
}
/* fatura que está aberta hoje: a compra nova entra nela. No dia do fechamento ela já fecha e abre a do mês seguinte. */
function faturaAbertaMes(cartao){
  const hoje = new Date();
  const mReal = monthKey(hoje);
  const fech = parseInt(cartao && cartao.fechamento)||0;
  if(!fech) return mesFinanceiroAtual();
  return hoje.getDate() >= Math.min(fech, daysInMonth(mReal)) ? addMonths(mReal, 1) : mReal;
}
/* fatura em destaque no cartão: a escolhida na faixa de meses, senão a mais antiga ainda por pagar, senão a aberta */
function faturaFocoMes(cartao){
  const sel = faturaMesSelecionado[cartao.id];
  if(sel) return sel;
  const mReal = monthKey(new Date());
  for(let i=-3;i<=0;i++){
    const m = addMonths(mReal, i);
    const s = faturaStatus(cartao, m);
    if((s.st==='vencido' || s.st==='fechado' || s.st==='parcial') && s.resta > 0.005) return m;
  }
  return faturaAbertaMes(cartao);
}
/* juros só a partir do dia seguinte ao vencimento: no próprio dia ainda dá para pagar sem juros */
function venceHojeFatura(f){
  if(!f.datas || f.st==='pago' || f.resta < 0.005) return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return hoje.getTime() === f.datas.vence.getTime();
}
const FATURA_ROTULO = { aberto:'Aberta', fechado:'Fechada · aguardando pagamento', vencido:'VENCIDA · gerando juros', parcial:'Pago em parte', pago:'Paga', vazio:'Sem fatura' };
function faturaCaixaHtml(cartao){
  const mKey = faturaFocoMes(cartao);
  const f = faturaStatus(cartao, mKey);
  const datasTxt = f.datas ? `fecha ${fmtDiaMesCurto(f.datas.fecha)} · vence ${fmtDiaMesCurto(f.datas.vence)}` : 'cadastre o fechamento e o vencimento no cartão';
  let detalhe = '';
  if(f.st==='pago'){
    const reg = faturaRegistro(cartao, mKey);
    const ult = reg && reg.pagamentos && reg.pagamentos.length ? reg.pagamentos[reg.pagamentos.length-1].em : null;
    detalhe = `Pago ${fmtMoney(f.pago)}${ult?' em '+fmtDiaMesCurto(new Date(ult)):''}${Math.abs(f.pago-f.total)>=0.01?' · fatura '+fmtMoney(f.total):''}`;
  } else if(f.pago > 0){
    detalhe = `Pago ${fmtMoney(f.pago)} · falta ${fmtMoney(f.resta)}`;
  } else if(f.st!=='vazio'){
    detalhe = `Valor ${fmtMoney(f.total)}`;
  }
  const botao = (f.st==='vazio') ? '' : (f.st==='pago'
    ? `<button type="button" class="fat-btn" onclick="abrirPagarFatura('${cartao.id}','${mKey}')">Ver / desfazer</button>`
    : `<button type="button" class="fat-btn pagar" onclick="abrirPagarFatura('${cartao.id}','${mKey}')">Pagar</button>`);
  return `<div class="fat-box ${f.st}">
    <div class="fat-top"><span class="fat-pill ${f.st}">${f.st==='pago'?'✓ ':''}${venceHojeFatura(f)?'Vence hoje · sem juros':FATURA_ROTULO[f.st]}</span><span class="fat-mes">Fatura ${monthLabel(mKey)}</span></div>
    <div class="fat-linha"><span>${detalhe}</span>${botao}</div>
    <div class="fat-datas">${datasTxt}</div>
  </div>`;
}
let pagarFaturaAlvo = null;
function abrirPagarFatura(cartaoId, mKey){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao) return;
  pagarFaturaAlvo = { cartaoId, mKey };
  renderPagarFatura();
  document.getElementById('modalPagarFatura').classList.add('active');
}
function renderPagarFatura(){
  const { cartaoId, mKey } = pagarFaturaAlvo;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  const f = faturaStatus(cartao, mKey);
  const reg = faturaRegistro(cartao, mKey);
  document.getElementById('pagarFaturaTitulo').textContent = cartao.nome+' · '+monthLabel(mKey);
  const hist = reg && reg.pagamentos && reg.pagamentos.length
    ? reg.pagamentos.map(p=>`<div class="simulador-linha"><span class="label">Pago em ${fmtDiaMesCurto(new Date(p.em))}</span><span class="valor">${fmtMoney(p.valor)}</span></div>`).join('')
    : '';
  document.getElementById('pagarFaturaResumo').innerHTML = `
    <div class="simulador-linha"><span class="label">Valor da fatura</span><span class="valor">${fmtMoney(f.total)}</span></div>
    ${hist}
    <div class="simulador-linha" style="border-top:2px solid var(--primary);margin-top:6px;padding-top:8px"><span class="label" style="font-weight:900">Total pago</span><span class="valor" style="font-weight:900">${fmtMoney(f.pago)}</span></div>
    ${f.st==='vencido' ? '<div class="fat-aviso-juros">Fatura vencida: está gerando juros.</div>' : ''}`;
  const quitada = f.st==='pago';
  document.getElementById('pagarFaturaCampo').style.display = quitada ? 'none' : '';
  document.getElementById('pagarFaturaBtnConfirmar').style.display = quitada ? 'none' : '';
  document.getElementById('pagarFaturaBtnDesfazer').style.display = (f.pago>0) ? '' : 'none';
  document.getElementById('pagarFaturaValor').value = f.resta.toFixed(2).replace('.',',');
  document.getElementById('pagarFaturaQuitar').checked = true;
  atualizarNotaPagarFatura();
}
function atualizarNotaPagarFatura(){
  const quitar = document.getElementById('pagarFaturaQuitar').checked;
  document.getElementById('pagarFaturaNota').textContent = quitar
    ? 'A fatura fica paga com o valor que você digitar, mesmo que seja diferente do total (juros, desconto, ajuste).'
    : 'Se pagar menos que o valor, fica como pagamento parcial (laranja).';
}
function confirmarPagarFatura(){
  if(!pagarFaturaAlvo) return;
  const { cartaoId, mKey } = pagarFaturaAlvo;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao) return;
  const f = faturaStatus(cartao, mKey);
  const quitar = document.getElementById('pagarFaturaQuitar').checked;
  let v = parseMoney(document.getElementById('pagarFaturaValor').value);
  if(!(v>0)){ showToast('Digite o valor pago'); return; }
  if(!quitar) v = Math.min(v, f.resta > 0 ? f.resta : v);
  if(!state.faturasCartao) state.faturasCartao = {};
  const k = cartaoId+'_'+mKey;
  const reg = state.faturasCartao[k] || { pago:0, pagamentos:[] };
  if(quitar) reg.quitada = true;
  reg.pago = Math.round(((Number(reg.pago)||0) + v)*100)/100;
  reg.pagamentos = (reg.pagamentos||[]).concat([{ valor:v, em:Date.now() }]);
  state.faturasCartao[k] = reg;
  persist();
  closeModal('modalPagarFatura');
  const depois = faturaStatus(cartao, mKey);
  renderCartaoTrackerList(); renderPanorama(); renderRendaTable();
  showToast(depois.st==='pago' ? 'Fatura paga' : 'Pagamento parcial registrado · falta '+fmtMoney(depois.resta));
}
async function desfazerPagamentoFatura(){
  if(!pagarFaturaAlvo) return;
  const ok = await iosConfirm('Apagar os pagamentos registrados dessa fatura?');
  if(!ok) return;
  const { cartaoId, mKey } = pagarFaturaAlvo;
  if(state.faturasCartao) delete state.faturasCartao[cartaoId+'_'+mKey];
  persist();
  closeModal('modalPagarFatura');
  renderCartaoTrackerList(); renderPanorama(); renderRendaTable();
  showToast('Pagamentos da fatura apagados');
}
function gerarFaturaMensalHtml(cartao){
  const inicio = [todayKey(), mesFinanceiroAtual()].sort()[0];
  const selecionado = faturaMesSelecionado[cartao.id];
  const meses = [];
  for(let i=0;i<13;i++) meses.push(addMonths(inicio, i));
  return meses.map(mKey=>{
    const f = faturaStatus(cartao, mKey);
    const sel = selecionado===mKey ? ' selected' : '';
    const marca = f.st==='pago' ? '<span class="fm-ok">✓</span>' : (f.st==='vencido' ? '<span class="fm-ok venc">!</span>' : '');
    return `<div class="ct-fatura-chip st-${f.st}${sel}" onclick="toggleFaturaMes('${cartao.id}','${mKey}')">
      <div class="fm-mes">${monthLabel(mKey)}${marca}</div>
      <div class="fm-valor">${fmtMoney(faturaQuitada(cartao, mKey) ? f.pago : f.total)}</div>
    </div>`;
  }).join('');
}
function toggleFaturaMes(cartaoId, mKey){
  faturaMesSelecionado[cartaoId] = faturaMesSelecionado[cartaoId]===mKey ? null : mKey;
  renderCartaoTrackerList();
}
function scrollFaturaMensal(cartaoId, dir){
  document.getElementById('faturaStrip-'+cartaoId)?.scrollBy({left: dir*140, behavior:'smooth'});
}
function renderCartaoTrackerList(){
  const list = document.getElementById('cartaoTrackerList');
  if(!list) return;
  if(typeof renderAcumCartao==='function') renderAcumCartao();
  const cartoes = state.cartoesTracker || [];
  if(cartoes.length === 0){
    list.innerHTML = `<div class="empty-state"><div class="title">Nenhum cartão cadastrado</div><div class="desc">Toque em "+ Cartão" pra começar</div></div>`;
    return;
  }
  list.innerHTML = cartoes.map(cartao=>{
    const mesSelecionado = faturaMesSelecionado[cartao.id];
    const todasCompras = (state.comprasTracker||[]).filter(c=>c.cartaoId===cartao.id);
    const compras = todasCompras
      .filter(item=>compraTrackerCalc(item).status!=='concluido')
      .filter(item=>!mesSelecionado || compraTrackerValorNoMes(item, mesSelecionado)>0)
      .sort((a,b)=>compraTrackerCalc(a).restam - compraTrackerCalc(b).restam);
    const quitadas = todasCompras.filter(item=>compraTrackerCalc(item).status==='concluido');
    const usado = todasCompras.reduce((s,item)=>{
      if(item.pago) return s; // pago não entra no cálculo
      const c = compraTrackerCalc(item);
      return s + (c.status==='concluido' ? 0 : c.restante);
    },0) + (cartao.credoVista?.reduce((s,v)=>s+Number(v.valor||0), 0) || 0)
      + (cartao.assinaturas||[]).reduce((s,a)=>s+assinaturaValorNoMes(a, mesFinanceiroAtual()), 0);
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
        return `<div class="compra-tracker-item${pagoClass}" ondblclick="openCompraTrackerModal('${cartao.id}','${item.id}')" data-id="${item.id}" data-cartao="${cartao.id}" data-longpress-timer="">
          <div class="ct-top">
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              ${compraLogo}
              <div style="min-width:0">
                <div class="ct-nome${pagoClass}">${item.nome}</div>
                ${item.descricao?`<div class="lr-caption">${item.descricao}</div>`:''}
              </div>
            </div>
            <div class="ct-actions">
              <button class="btn-icon-sm" title="Editar" onclick="openCompraTrackerModal('${cartao.id}','${item.id}')">${ICON_EDIT}</button>
              <button class="btn-icon-sm" title="Marcar como ${item.pago?'pendente':'pago'}" onclick="toggleCompraPago('${item.id}')" style="color:${item.pago?'var(--success)':'var(--slate-400)'}">${item.pago?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/></svg>'}</button>
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

    const quitadasHtml = quitadas.length === 0 ? '' :
      `<div class="ct-quitadas-tit">${quitadasMostrarPorCartao[cartao.id] ? `Quitadas (${quitadas.length})` : ''}</div>` +
      (quitadasMostrarPorCartao[cartao.id] ? quitadas.map(item=>`<div class="compra-tracker-item pago">
        <div class="ct-top">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            <div class="ct-nome pago">${item.nome}</div>
          </div>
          <div class="ct-actions"><button class="btn-icon-sm" onclick="excluirCompraTracker('${item.id}')">${ICON_TRASH}</button></div>
        </div>
        <div class="ct-meta">Quitada · ${fmtMoney(compraTrackerCalc(item).total)}</div>
      </div>`).join('') : '');

    const cor = corDaLogo(cartao.logoUrl, renderCartaoTrackerList) || (cartao.logoUrl ? null : { fundo: corDoBanco(cartao.nome, 0), texto: '#fff' });   // sem logo: cor pelo nome do banco
    return `<div class="cartao-card-item">
      <div class="ct-face${cor?' colorida':''}"${estiloFaceCor(cor)}>
      <div class="ct-top">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          ${cartao.logoUrl?`<img src="${cartao.logoUrl}" class="conta-logo-sm">`:`<div class="conta-logo-sm conta-logo-placeholder">${cartao.nome.charAt(0).toUpperCase()}</div>`}
          <div class="ct-nome-cartao">${cartao.nome}</div>
        </div>
        <div class="ct-actions">
          <button class="btn-icon-sm${quitadasMostrarPorCartao[cartao.id]?' ativo':''}" onclick="toggleQuitadasCartao('${cartao.id}')" title="Ver quitadas" aria-label="Ver quitadas">${ICON_EYE}</button>
          <button class="btn-icon-sm" title="Editar cartão" aria-label="Editar cartão" onclick="openCartaoCardModal('${cartao.id}')">${ICON_EDIT}</button>
          <button class="btn-icon-sm" title="Excluir cartão" aria-label="Excluir cartão" onclick="excluirCartaoCard('${cartao.id}')">${ICON_TRASH}</button>
        </div>
      </div>
      <span class="ct-chip" aria-hidden="true"></span>
      <div class="ct-disponivel-lbl">Fatura de ${monthLabel(faturaAbertaMes(cartao)).toLowerCase()}</div>
      <div class="ct-disponivel-val">${fmtMoney(faturaCartaoNoMes(cartao, faturaAbertaMes(cartao)))}</div>
      <div class="ct-bar"><div class="ct-bar-fill" style="width:${percentUsado}%"></div></div>
      <div class="ct-foot"><span>Disponível ${fmtMoney(disponivel)} de ${fmtMoney(limite)}</span><span>Fecha ${cartao.fechamento||'—'} · vence ${cartao.vencimento||'—'}</span></div>
      </div>
      ${faturaCaixaHtml(cartao)}
      <div class="ct-fatura-mensal">
        <button class="btn-icon-sm" onclick="scrollFaturaMensal('${cartao.id}',-1)">‹</button>
        <div class="ct-fatura-mensal-strip" id="faturaStrip-${cartao.id}">${gerarFaturaMensalHtml(cartao)}</div>
        <button class="btn-icon-sm" onclick="scrollFaturaMensal('${cartao.id}',1)">›</button>
      </div>
      <button type="button" class="ct-toggle-compras ico-btn${cartoesExpandidos[cartao.id]?' aberto':''}" id="cartaoToggle-${cartao.id}" onclick="toggleCartaoDetalhes('${cartao.id}')" title="Detalhes" aria-label="Ver ou ocultar detalhes">${ICO(ICO_D.abaixo, 20)}</button>
      <div class="compras-do-cartao${cartoesExpandidos[cartao.id]?' expanded':''}" id="cartaoDetalhes-${cartao.id}">
        <div class="placa ct-placa-fatura"><span class="placa-lbl" style="margin-top:0">Fatura de ${monthLabelLong(mesSelecionado || faturaAbertaMes(cartao)).toLowerCase()}</span><b>${fmtMoney(faturaCartaoNoMes(cartao, mesSelecionado || faturaAbertaMes(cartao)))}</b></div>
        ${comprasHtml}
        ${quitadasHtml}
        <div class="credo-vista-list">
          ${(cartao.credoVista||[]).filter(cv=>!mesSelecionado || cv.mKey===mesSelecionado).map(cv=>`<div class="credo-vista-item" onclick="openCredoVistaModal('${cartao.id}','${cv.id}')"><span class="cv-cat-badge">${cv.categoria||'Outros'}</span><span class="cv-desc">${cv.descricao||'Crédito à vista'}</span><span class="cv-valor">${fmtMoney(cv.valor)}</span><button class="btn-icon-sm" aria-label="Excluir" onclick="event.stopPropagation();excluirCredoVista('${cartao.id}','${cv.id}')">${ICON_TRASH}</button></div>`).join('')}
          ${(cartao.assinaturas||[]).filter(a=>!mesSelecionado || assinaturaValorNoMes(a, mesSelecionado)>0).map(a=>`<div class="credo-vista-item" onclick="openAssinaturaModal('${cartao.id}','${a.id}')"><span class="cv-cat-badge">${a.categoria||'Outros'}</span><span class="cv-desc">${a.nome}${a.canceladoApartirDe?' · cancelada':''} <span class="badge-teste">Assinatura</span></span><span class="cv-valor">${fmtMoney(a.valor)}</span><button class="btn-icon-sm" aria-label="Excluir" onclick="event.stopPropagation();excluirAssinatura('${cartao.id}','${a.id}')">${ICON_TRASH}</button></div>`).join('')}
        </div>
        ${gastosDashboardAberto[cartao.id] ? renderCartaoGastosDashboard(cartao, mesSelecionado || mesFinanceiroAtual()) : ''}
        <div class="ico-linha">
          <button type="button" class="ico-btn" title="Compra à vista" aria-label="Compra à vista" onclick="openCredoVistaModal('${cartao.id}')">${ICO(ICO_D.vista, 20)}</button>
          <button type="button" class="ico-btn" title="Compra parcelada" aria-label="Compra parcelada" onclick="openCompraTrackerModal('${cartao.id}')">${ICO(ICO_D.parcelada, 20)}</button>
          <button type="button" class="ico-btn" title="Assinatura" aria-label="Assinatura" onclick="openAssinaturaModal('${cartao.id}')">${ICO(ICO_D.assinatura, 20)}</button>
          <button type="button" class="ico-btn" title="Conferir a fatura fechada (PDF)" aria-label="Conferir a fatura fechada em PDF" onclick="fpdfEscolher('${cartao.id}')">${ICO('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>', 20)}</button>
          <button type="button" class="ico-btn" title="Ajuste da fatura" aria-label="Ajuste da fatura" onclick="abrirAjusteFatura('${cartao.id}')">${ICO(ICO_D.ajuste, 20)}</button>
          <button type="button" class="ico-btn${gastosDashboardAberto[cartao.id]?' ativo':''}" title="Gastos por categoria" aria-label="Gastos por categoria" onclick="toggleGastosDashboard('${cartao.id}')">${ICO(ICO_D.grafico, 20)}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
/* ===== AJUSTE DA FATURA: você informa o valor que o banco mostra; a diferença vira um lançamento "Ajuste de fatura" ===== */
let ajusteFaturaAlvo = null;
function abrirAjusteFatura(cartaoId){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao) return;
  ajusteFaturaAlvo = { cartaoId, mKey: faturaAbertaMes(cartao) };
  document.getElementById('ajusteFaturaValor').value = '';
  renderAjusteFatura();
  document.getElementById('modalAjusteFatura').classList.add('active');
}
function ajusteFaturaNavMes(delta){
  if(!ajusteFaturaAlvo) return;
  ajusteFaturaAlvo.mKey = addMonths(ajusteFaturaAlvo.mKey, delta);
  renderAjusteFatura();
}
function renderAjusteFatura(){
  const { cartaoId, mKey } = ajusteFaturaAlvo;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  const noApp = faturaCartaoNoMes(cartao, mKey);
  document.getElementById('ajusteFaturaTitulo').textContent = cartao.nome;
  document.getElementById('ajusteFaturaMes').textContent = 'Fatura ' + monthLabel(mKey) + (mKey===faturaAbertaMes(cartao) ? ' · aberta' : '');
  const informado = parseMoney(document.getElementById('ajusteFaturaValor').value);
  const temValor = document.getElementById('ajusteFaturaValor').value.trim() !== '';
  const dif = Math.round((informado - noApp)*100)/100;
  document.getElementById('ajusteFaturaResumo').innerHTML = `
    <div class="simulador-linha"><span class="label">No app hoje</span><span class="valor">${fmtMoney(noApp)}</span></div>
    ${temValor ? `<div class="simulador-linha"><span class="label">Valor no banco</span><span class="valor">${fmtMoney(informado)}</span></div>
    <div class="simulador-linha" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span class="label" style="font-weight:800">Ajuste</span><span class="valor" style="font-weight:800;color:${Math.abs(dif)<0.01?'var(--text-dim)':(dif>0?'var(--danger)':'var(--success)')}">${Math.abs(dif)<0.01?'nenhum, já bate':(dif>0?'+':'−')+fmtMoney(Math.abs(dif))}</span></div>` : ''}`;
}
function confirmarAjusteFatura(){
  if(!ajusteFaturaAlvo) return;
  const { cartaoId, mKey } = ajusteFaturaAlvo;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao) return;
  if(document.getElementById('ajusteFaturaValor').value.trim()===''){ showToast('Digite o valor atual da fatura'); return; }
  const informado = parseMoney(document.getElementById('ajusteFaturaValor').value);
  const dif = Math.round((informado - faturaCartaoNoMes(cartao, mKey))*100)/100;
  if(Math.abs(dif) < 0.01){ closeModal('modalAjusteFatura'); showToast('A fatura já bate com o app'); return; }
  const hoje = new Date();
  const data = String(hoje.getDate()).padStart(2,'0')+'/'+String(hoje.getMonth()+1).padStart(2,'0');
  if(!cartao.credoVista) cartao.credoVista = [];
  cartao.credoVista.push({ id:'cv'+Date.now(), descricao:'Ajuste de fatura · '+data, valor:dif, categoria:'Ajuste', mKey, ajuste:true, criadoEm:Date.now() });
  persist();
  closeModal('modalAjusteFatura');
  renderCartaoTrackerList();
  renderPanorama();
  showToast('Ajuste de '+(dif>0?'+':'−')+fmtMoney(Math.abs(dif))+' lançado em '+monthLabel(mKey));
}
function toggleQuitadasCartao(cartaoId){
  quitadasMostrarPorCartao[cartaoId] = !quitadasMostrarPorCartao[cartaoId];
  renderCartaoTrackerList();
}
function toggleCartaoDetalhes(cartaoId){
  cartoesExpandidos[cartaoId] = !cartoesExpandidos[cartaoId];
  const el = document.getElementById('cartaoDetalhes-'+cartaoId);
  if(el) el.classList.toggle('expanded', cartoesExpandidos[cartaoId]);
  const bt = document.getElementById('cartaoToggle-'+cartaoId);
  if(bt) bt.classList.toggle('aberto', !!cartoesExpandidos[cartaoId]);
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
      cartaoCardLogoUrlAtual = item.logoUrl || null;
    }
  }else{
    document.getElementById('cartaoCardNome').value = '';
    document.getElementById('cartaoCardFechamento').value = '';
    document.getElementById('cartaoCardVencimento').value = '';
    document.getElementById('cartaoCardLimite').value = '';
    cartaoCardLogoUrlAtual = null;
  }
  renderCartaoCardLogoPreview();
  document.getElementById('modalCartaoCard').classList.add('active');
}
let cartaoCardLogoUrlAtual = null;
function renderCartaoCardLogoPreview(){
  const el = document.getElementById('cartaoCardLogoPreview');
  if(!el) return;
  const nome = document.getElementById('cartaoCardNome').value || '?';
  el.innerHTML = cartaoCardLogoUrlAtual
    ? `<img src="${cartaoCardLogoUrlAtual}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${nome.charAt(0).toUpperCase()}</div>`;
}
function onCartaoCardLogoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{ comprimirImagemDataUrl(e.target.result).then(url=>{ cartaoCardLogoUrlAtual = url; renderCartaoCardLogoPreview(); }); };
  reader.readAsDataURL(file);
}
function removerCartaoCardLogo(){
  cartaoCardLogoUrlAtual = null;
  renderCartaoCardLogoPreview();
}
function salvarCartaoCard(){
  const id = document.getElementById('cartaoCardId').value;
  const nome = document.getElementById('cartaoCardNome').value.trim();
  const fechamento = Math.min(31, Math.max(1, parseInt(document.getElementById('cartaoCardFechamento').value) || 1));
  const vencimento = Math.min(31, Math.max(1, parseInt(document.getElementById('cartaoCardVencimento').value) || 1));
  const limite = parseMoney(document.getElementById('cartaoCardLimite').value);
  const logoUrl = cartaoCardLogoUrlAtual;
  if(!nome){ showToast('Digite o nome do cartão'); return; }
  if(!state.cartoesTracker) state.cartoesTracker = [];
  if(id){
    const item = state.cartoesTracker.find(i=>i.id===id);
    if(item) Object.assign(item, { nome, fechamento, vencimento, limite, logoUrl });
  } else {
    state.cartoesTracker.push({ id: 'crd'+Date.now(), nome, fechamento, vencimento, limite, logoUrl });
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
  initCompraTrackerGestures();
}

/* Gestos nas compras: clicar e segurar 4s exclui (duplo clique para editar já está no item) */
let compraGestosAtivos = false;
function initCompraTrackerGestures(){
  if(compraGestosAtivos) return;
  compraGestosAtivos = true;
  let timer = null, x0 = 0, y0 = 0;
  const cancelar = ()=>{ if(timer){ clearTimeout(timer); timer = null; } };
  document.addEventListener('pointerdown', ev=>{
    const item = ev.target.closest && ev.target.closest('.compra-tracker-item');
    if(!item || ev.target.closest('button,input,select,a')) return;
    const id = item.dataset.id;
    if(!id) return;
    x0 = ev.clientX; y0 = ev.clientY;
    cancelar();
    timer = setTimeout(()=>{ timer = null; excluirCompraTracker(id); }, 4000);
  });
  document.addEventListener('pointermove', ev=>{
    if(timer && (Math.abs(ev.clientX-x0)>10 || Math.abs(ev.clientY-y0)>10)) cancelar();
  });
  ['pointerup','pointercancel','pointerleave'].forEach(t=>document.addEventListener(t, cancelar));
}
initCompraTrackerGestures();

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
  reader.onload = e=>{ comprimirImagemDataUrl(e.target.result).then(url=>{ compraTrackerLogoUrlAtual = url; renderCompraTrackerLogoPreview(); }); };
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
    const cartaoRef = (state.cartoesTracker||[]).find(c=>c.id===(cartaoId || document.getElementById('compraTrackerCartaoId').value)) || state.cartoesTracker[0];
    createMonthPicker('compraTrackerMesInicioPicker', 'compraTrackerMesInicio', faturaAbertaMes(cartaoRef));
  }
  renderCompraTrackerLogoPreview();
  document.getElementById('modalCompraTracker').classList.add('active');
}
/* trocou de cartão numa compra nova: o mês de início vai para a fatura que está aberta naquele cartão */
function onCompraCartaoChange(){
  if(document.getElementById('compraTrackerId').value) return;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===document.getElementById('compraTrackerCartaoId').value);
  if(cartao) createMonthPicker('compraTrackerMesInicioPicker', 'compraTrackerMesInicio', faturaAbertaMes(cartao));
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
const CREDOVISTA_CATEGORIAS = ['Alimentação','Transporte','Farmácia','Lazer','Mercado','Outros'];
window.credoVistaCategoriaSelecionada = 'Outros';
function selecionarCredoVistaCategoria(c){
  window.credoVistaCategoriaSelecionada = c;
  renderCredoVistaCategoriaChips();
}
function renderCredoVistaCategoriaChips(){
  const el = document.getElementById('credoVistaCategoriaChips');
  if(!el) return;
  const cats = getCategoriasComCustom(CREDOVISTA_CATEGORIAS, 'credoVistaCategoriasCustom');
  el.innerHTML = cats.map(c=>
    `<button type="button" class="dif-chip${window.credoVistaCategoriaSelecionada===c?' active':''}" onclick="selecionarCredoVistaCategoria('${c}')">${c}</button>`
  ).join('') + `<button type="button" class="dif-chip cat-chip-add" onclick="abrirNovaCategoriaExtra('credoVista')">+ Nova</button>`;
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
      window.credoVistaCategoriaSelecionada = item.categoria || 'Outros';
      createMonthPicker('credoVistaMesPicker', 'credoVistaMes', item.mKey || faturaAbertaMes(cartao));
    }
  }else{
    document.getElementById('credoVistaDescricao').value = '';
    document.getElementById('credoVistaValor').value = '';
    window.credoVistaCategoriaSelecionada = 'Outros';
    createMonthPicker('credoVistaMesPicker', 'credoVistaMes', faturaAbertaMes((state.cartoesTracker||[]).find(c=>c.id===cartaoId)));
  }
  renderCredoVistaCategoriaChips();
  document.getElementById('modalCredoVista').classList.add('active');
}
function salvarCredoVista(){
  const cartaoId = document.getElementById('credoVistaCartaoId').value;
  const credoId = document.getElementById('credoVistaId').value;
  const descricao = document.getElementById('credoVistaDescricao').value.trim();
  const valor = parseMoney(document.getElementById('credoVistaValor').value);
  const categoria = window.credoVistaCategoriaSelecionada || 'Outros';
  const cartaoRef = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  const mKey = document.getElementById('credoVistaMes').value || faturaAbertaMes(cartaoRef);   // mês da fatura (a aberta hoje, a menos que você troque)
  if(!valor){ showToast('Digite o valor'); return; }
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao){ showToast('Cartão não encontrado'); return; }
  if(!cartao.credoVista) cartao.credoVista = [];
  if(credoId){
    const item = cartao.credoVista.find(cv=>cv.id===credoId);
    if(item) Object.assign(item, { descricao, valor, categoria, mKey });
  } else {
    cartao.credoVista.push({ id: 'cv'+Date.now(), descricao, valor, categoria, mKey });
  }
  persist();
  closeModal('modalCredoVista');
  renderCartaoTrackerList();
  renderPanorama();
  showToast('Crédito salvo');
}
/* Total de crédito à vista por categoria, num mês de referência (fallback 'Outros'/mês atual pra itens antigos) */
function credoVistaTotalPorCategoria(mKey){
  const totais = {};
  (state.cartoesTracker||[]).forEach(cartao=>{
    (cartao.credoVista||[]).forEach(cv=>{
      const catRef = cv.categoria || 'Outros';
      const mesRef = cv.mKey || mesFinanceiroAtual();
      if(mesRef !== mKey) return;
      totais[catRef] = (totais[catRef]||0) + Number(cv.valor||0);
    });
  });
  return totais;
}
function excluirCredoVista(cartaoId, credoId){
  comDesfazer('Compra excluída', ()=>{
    const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
    if(cartao) cartao.credoVista = (cartao.credoVista||[]).filter(cv=>cv.id!==credoId);
    persist();
    renderCartaoTrackerList();
    renderPanorama();
  });
}

/* --- Assinaturas do cartão: recorrência mensal, sem precisar relançar --- */
window.assinaturaCategoriaSelecionada = 'Outros';
function selecionarAssinaturaCategoria(c){
  window.assinaturaCategoriaSelecionada = c;
  renderAssinaturaCategoriaChips();
}
function renderAssinaturaCategoriaChips(){
  const el = document.getElementById('assinaturaCategoriaChips');
  if(!el) return;
  const cats = getCategoriasComCustom(CREDOVISTA_CATEGORIAS, 'credoVistaCategoriasCustom');
  el.innerHTML = cats.map(c =>
    `<button type="button" class="dif-chip${window.assinaturaCategoriaSelecionada===c?' active':''}" onclick="selecionarAssinaturaCategoria('${c}')">${c}</button>`
  ).join('') + `<button type="button" class="dif-chip cat-chip-add" onclick="abrirNovaCategoriaExtra('assinatura')">+ Nova</button>`;
}
function openAssinaturaModal(cartaoId, assinaturaId){
  document.getElementById('assinaturaCartaoId').value = cartaoId;
  document.getElementById('assinaturaId').value = assinaturaId || '';
  document.getElementById('modalAssinaturaTitle').textContent = assinaturaId ? 'Editar Assinatura' : 'Nova Assinatura';
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  const item = assinaturaId ? cartao?.assinaturas?.find(a=>a.id===assinaturaId) : null;
  document.getElementById('assinaturaNome').value = item?.nome || '';
  document.getElementById('assinaturaValor').value = item ? (item.valor||0).toFixed(2).replace('.',',') : '';
  window.assinaturaCategoriaSelecionada = item?.categoria || 'Outros';
  createMonthPicker('assinaturaMesInicioPicker', 'assinaturaMesInicio', item?.mesInicio || mesFinanceiroAtual());
  const btnCancelar = document.getElementById('btnCancelarAssinatura');
  if(btnCancelar) btnCancelar.style.display = (item && !item.canceladoApartirDe) ? '' : 'none';
  renderAssinaturaCategoriaChips();
  document.getElementById('modalAssinatura').classList.add('active');
}
function salvarAssinatura(){
  const cartaoId = document.getElementById('assinaturaCartaoId').value;
  const assinaturaId = document.getElementById('assinaturaId').value;
  const nome = document.getElementById('assinaturaNome').value.trim();
  const valor = parseMoney(document.getElementById('assinaturaValor').value);
  const categoria = window.assinaturaCategoriaSelecionada || 'Outros';
  const mesInicio = document.getElementById('assinaturaMesInicio').value || mesFinanceiroAtual();
  if(!nome){ showToast('Digite o nome da assinatura'); return; }
  if(!valor){ showToast('Digite o valor'); return; }
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  if(!cartao){ showToast('Cartão não encontrado'); return; }
  if(!cartao.assinaturas) cartao.assinaturas = [];
  if(assinaturaId){
    const item = cartao.assinaturas.find(a=>a.id===assinaturaId);
    if(item) Object.assign(item, { nome, valor, categoria, mesInicio });
  } else {
    cartao.assinaturas.push({ id: 'as'+Date.now(), nome, valor, categoria, mesInicio, canceladoApartirDe: null });
  }
  persist();
  closeModal('modalAssinatura');
  renderCartaoTrackerList();
  showToast('Assinatura salva');
}
function cancelarAssinatura(){
  const cartaoId = document.getElementById('assinaturaCartaoId').value;
  const assinaturaId = document.getElementById('assinaturaId').value;
  const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
  const item = cartao?.assinaturas?.find(a=>a.id===assinaturaId);
  if(!item) return;
  item.canceladoApartirDe = mesFinanceiroAtual();
  persist();
  closeModal('modalAssinatura');
  renderCartaoTrackerList();
  showToast('Assinatura cancelada a partir de ' + monthLabel(item.canceladoApartirDe));
}
function excluirAssinatura(cartaoId, assinaturaId){
  comDesfazer('Assinatura excluída', ()=>{
    const cartao = (state.cartoesTracker||[]).find(c=>c.id===cartaoId);
    if(cartao) cartao.assinaturas = (cartao.assinaturas||[]).filter(a=>a.id!==assinaturaId);
    persist();
    renderCartaoTrackerList();
  });
}
/* Valor da assinatura num mês qualquer: cobra a partir do mês de início, e para de cobrar a partir do mês de cancelamento */
function assinaturaValorNoMes(item, mKey){
  if(!item.mesInicio || mKey < item.mesInicio) return 0;
  if(item.canceladoApartirDe && mKey >= item.canceladoApartirDe) return 0;
  return Number(item.valor||0);
}

/* --- Dashboard de gastos do cartão: à vista + assinaturas do mês, por categoria e por nome --- */
function cartaoGastosPorMes(cartao, mKey){
  const porCategoria = {}, porNome = {};
  (cartao.credoVista||[]).filter(cv=>cv.mKey===mKey).forEach(cv=>{
    const cat = cv.categoria || 'Outros', nome = cv.descricao || 'Crédito à vista';
    porCategoria[cat] = (porCategoria[cat]||0) + Number(cv.valor||0);
    porNome[nome] = (porNome[nome]||0) + Number(cv.valor||0);
  });
  (cartao.assinaturas||[]).forEach(a=>{
    const valor = assinaturaValorNoMes(a, mKey);
    if(!valor) return;
    const cat = a.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat]||0) + valor;
    porNome[a.nome] = (porNome[a.nome]||0) + valor;
  });
  return { porCategoria, porNome };
}
let gastosDashboardAberto = {};
function toggleGastosDashboard(cartaoId){
  gastosDashboardAberto[cartaoId] = !gastosDashboardAberto[cartaoId];
  renderCartaoTrackerList();
}
function renderCartaoGastosDashboard(cartao, mKey){
  const { porCategoria, porNome } = cartaoGastosPorMes(cartao, mKey);
  const catEntries = Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]);
  if(!catEntries.length) return `<div class="ct-sem-compra">Nenhum gasto em ${monthLabel(mKey)}</div>`;
  const nomeEntries = Object.entries(porNome).sort((a,b)=>b[1]-a[1]);
  const maiorCat = Math.max(...catEntries.map(e=>e[1]));
  const maiorNome = Math.max(...nomeEntries.map(e=>e[1]));
  const barRow = (label, valor, maior) => `<div class="bar-row"><div class="bar-label" style="width:96px">${label}</div><div class="bar-container"><div class="bar-fill" style="width:${Math.max(4,Math.round(valor/maior*100))}%;background:var(--primary)"></div></div><div class="bar-valor">${fmtMoney(valor)}</div></div>`;
  return `<div class="ponto-semanas-titulo" style="margin-top:var(--s3)">Por categoria · ${monthLabel(mKey)}</div>
    <div class="bar-chart">${catEntries.map(([c,v])=>barRow(c,v,maiorCat)).join('')}</div>
    <div class="ponto-semanas-titulo" style="margin-top:var(--s3)">Por nome</div>
    <div class="bar-chart">${nomeEntries.map(([n,v])=>barRow(n,v,maiorNome)).join('')}</div>`;
}
function excluirCompraTracker(id){
  comDesfazer('Parcelada excluída', ()=>{
    state.comprasTracker = (state.comprasTracker||[]).filter(i=>i.id!==id);
    persist();
    renderCartaoTrackerList();
    renderPanorama();
  });
}

/* ================= CARTÕES DE CRÉDITO ================= */
/* ================= MODAL GASTO ================= */
function updateGastoFieldsVisibility(){
  const cat = document.getElementById('gastoCat').value;
  const isFuturo = cat === 'futuro';
  document.getElementById('gastoDiaWrap').style.display = isFuturo ? 'none' : '';
  document.getElementById('gastoMesInicioSimplesWrap').style.display = isFuturo ? 'none' : '';
  document.getElementById('gastoRecorrenteWrap').style.display = (isFuturo && gastoFuturoModo==='parcelada') ? '' : 'none';
  document.getElementById('gastoMesInicioWrap').style.display = isFuturo ? '' : 'none';

  if(!isFuturo){
    document.getElementById('gastoParcelasWrap').style.display = 'none';
    document.getElementById('gastoReplicarWrap').style.display = 'none';
    document.getElementById('gastoParcelasValoresWrap').style.display = 'none';
    document.getElementById('gastoValorWrap').style.display = '';
    return;
  }

  if(gastoFuturoModo === 'simples'){
    document.getElementById('gastoRecorrente').checked = false;
    document.getElementById('gastoParcelas').value = 1;
    document.getElementById('gastoReplicar').checked = true;
    document.getElementById('gastoMesInicioLabel').textContent = 'Mês';
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
let gastoTipoAtual = 'fixa';
let gastoEssencialAtual = true;
function renderGastoTipoChips(){
  const el = document.getElementById('gastoTipoChips');
  if(!el) return;
  el.innerHTML = ['fixa','variavel'].map(t=>
    `<button type="button" class="dif-chip${gastoTipoAtual===t?' active':''}" onclick="setGastoTipo('${t}')">${t==='fixa'?'Fixa':'Variável'}</button>`
  ).join('');
}
function renderGastoEssencialChips(){
  const el = document.getElementById('gastoEssencialChips');
  if(!el) return;
  el.innerHTML = [[true,'Essencial'],[false,'Não essencial']].map(([v,label])=>
    `<button type="button" class="dif-chip${gastoEssencialAtual===v?' active':''}" onclick="setGastoEssencial(${v})">${label}</button>`
  ).join('');
}
function setGastoEssencial(v){
  gastoEssencialAtual = v;
  renderGastoEssencialChips();
}
function setGastoTipo(t){
  gastoTipoAtual = t;
  renderGastoTipoChips();
  atualizarGastoMediaHint();
}
function mediaHistoricoGasto(item){
  if(!item || !item.historico || item.historico.length===0) return null;
  const ultimos = item.historico.slice(-3);
  const soma = ultimos.reduce((s,h)=>s+(Number(h.valor)||0),0);
  return soma / ultimos.length;
}
function atualizarGastoMediaHint(){
  const hint = document.getElementById('gastoMediaHint');
  if(!hint) return;
  const id = document.getElementById('gastoId').value;
  const cat = document.getElementById('gastoCat').value;
  if(gastoTipoAtual!=='variavel' || !id){ hint.style.display='none'; hint.innerHTML=''; return; }
  const item = state.users[state.currentUser].expenses[cat].find(i=>i.id===id);
  const media = mediaHistoricoGasto(item);
  if(media===null){ hint.style.display='none'; hint.innerHTML=''; return; }
  hint.style.display = 'block';
  hint.innerHTML = `<button type="button" class="gasto-media-hint-btn" onclick="usarMediaGasto(${media.toFixed(2)})">Média das últimas alterações: ${fmtMoney(media)} · usar</button>`;
}
function usarMediaGasto(valor){
  document.getElementById('gastoValor').value = valor.toFixed(2).replace('.',',');
}
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
  reader.onload = e=>{ comprimirImagemDataUrl(e.target.result).then(url=>{ gastoLogoUrlAtual = url; renderGastoLogoPreview(); }); };
  reader.readAsDataURL(file);
}
function removerGastoLogo(){
  gastoLogoUrlAtual = null;
  renderGastoLogoPreview();
}

let gastoFuturoModo = 'parcelada';
function openGastoModal(cat, id, modo){
  document.getElementById('gastoCat').value = cat;
  document.getElementById('gastoId').value = id || '';
  document.getElementById('modalGastoTitle').textContent = id ? 'Editar Gasto' : (cat==='futuro' ? (modo==='simples' ? 'Nova Conta Simples' : 'Nova Conta Parcelada/Recorrente') : 'Adicionar Gasto');

  if(id){
    const item = state.users[state.currentUser].expenses[cat].find(i=>i.id===id);
    if(item){
      document.getElementById('gastoDesc').value = item.desc;
      document.getElementById('gastoDescricaoBreve').value = item.descricao || '';
      gastoLogoUrlAtual = item.logoUrl || null;
      document.getElementById('gastoValor').value = (item.valor||0).toFixed(2).replace('.',',');
      document.getElementById('gastoDia').value = item.dia || '';
      gastoTipoAtual = item.tipo || 'fixa';
      gastoEssencialAtual = item.essencial !== false;
      createMonthPicker('gastoMesInicioSimplesPicker', 'gastoMesInicioSimples', item.mesInicio || null);

      if(cat==='futuro'){
        const isLegado = item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined;
        gastoFuturoModo = (item.recorrente || (item.parcelas||1)>1) ? 'parcelada' : 'simples';
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
    gastoTipoAtual = 'fixa';
    gastoEssencialAtual = true;
    gastoFuturoModo = modo || 'parcelada';
    createMonthPicker('gastoMesInicioSimplesPicker', 'gastoMesInicioSimples', null);
    document.getElementById('gastoRecorrente').checked = false;
    createMonthPicker('gastoMesInicioPicker', 'gastoMesInicio', mesFinanceiroAtual(), onGastoMesInicioChange);
    document.getElementById('gastoParcelas').value = 1;
    document.getElementById('gastoReplicar').checked = true;
  }
  document.getElementById('gastoTipoWrap').style.display = cat==='futuro' ? 'none' : 'block';
  document.getElementById('gastoEssencialWrap').style.display = cat==='futuro' ? 'none' : 'block';
  renderGastoTipoChips();
  renderGastoEssencialChips();
  atualizarGastoMediaHint();
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
    novo = { desc, descricao, logoUrl, valor, dia, mesInicio, tipo: gastoTipoAtual, essencial: gastoEssencialAtual };
  }

  const list = state.users[state.currentUser].expenses[cat];
  if(id){
    const item = list.find(i=>i.id===id);
    if(item){
      if(cat!=='futuro' && Number(item.valor)!==novo.valor && Number(item.valor)>0){
        item.historico = (item.historico||[]).concat([{ mKey: mesFinanceiroAtual(), valor: item.valor }]).slice(-6);
      }
      Object.assign(item, novo);
    }
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
  comDesfazer('Conta excluída', ()=>{
    const list = state.users[state.currentUser].expenses[cat];
    const idx = list.findIndex(i=>i.id===id);
    if(idx>-1) list.splice(idx,1);
    renderPlanner();
    renderPanorama();
    persist();
  });
}

