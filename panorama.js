/* ================= RENDER: PANORAMA ================= */
/* ================= PLANEJADOR DE METAS / SIMULADOR ================= */
/* ================= DASHBOARD (abas Geral / Cartão) ================= */
let dashTabAtiva = 'geral';
function switchDashTab(tab){
  dashTabAtiva = tab;
  const aba = document.getElementById('aba-planner');
  if(aba) aba.dataset.tab = tab;
  document.querySelectorAll('.dash-tab').forEach(el=>el.classList.toggle('active', el.dataset.dtab===tab));
  const nomeV = document.getElementById('dashVoltarNome'); if(nomeV) nomeV.textContent = tab === 'cartao' ? 'Cartões' : tab === 'emprestimo' ? 'Empréstimo' : '';
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
  renderResumoMes();
  renderOndeVai();
  const cp = document.getElementById('pageContasPagar');
  if(cp && cp.classList.contains('active')) renderContasPagar();
}

/* atalhos redondos: no celular aparecem 4 + "Mais", que abre a 2ª linha com o resto (no computador ficam todos à mostra) */
function atalhosFim(){}
function atalhosMais(btn){
  const aberto = document.getElementById('resumoAtalhos').classList.toggle('aberto');
  btn.setAttribute('aria-expanded', String(aberto));
}

/* Resumo do mês no topo de Finanças (v12): placa grafite com o saldo, a sobra prevista, os dias que faltam e os bancos; depois os blocos do mês */
function renderResumoMes(){
  const elMes = document.getElementById('resumoMesLabel');
  if(!elMes || !state.users) return;
  if(typeof renderHeaderHoje==='function') renderHeaderHoje();   // "falta pagar" do cabeçalho acompanha
  const u = userDash(), mKey = mesFinanceiroAtual();
  const sobra = saldoForMonth(u, mKey);
  elMes.textContent = monthLabelLong(mKey);
  const elSobra = document.getElementById('resumoSobra');
  elSobra.textContent = fmtMoneySigned(sobra);
  elSobra.className = sobra >= 0 ? 'pos' : 'neg';
  const elTipo = document.getElementById('resumoPrevTipo'); if(elTipo) elTipo.textContent = sobra >= 0 ? 'sobra prevista' : 'falta prevista';
  const hoje = new Date(), faltam = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate() - hoje.getDate();
  const elF = document.getElementById('resumoFaltam'); if(elF) elF.textContent = faltam ? 'faltam ' + faltam + ' dia' + (faltam > 1 ? 's' : '') : 'último dia';
  renderCarteira();
  renderBlocosMes(u, mKey);
  renderCurvaSaldo(u, mKey);
  renderProxContas(u, mKey);  /* atalhos: cartão / empréstimo contando (ou não) neste mês */
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
  document.getElementById('resumoContasAbertas').textContent = abertas ? '· ' + abertas + ' em aberto' : '· tudo pago';
}

/* cor de cada banco pelo nome (quando o Davi não escolheu uma); banco desconhecido ganha uma cor neutra da lista */
const BANCO_CORES = [
  [/nu ?bank|nubank/i, '#7a1fc9'], [/inter\b/i, '#ff7a1a'], [/viacred|ailos/i, '#0b4f8f'], [/sicredi/i, '#3a8a2e'], [/sicoob/i, '#00505c'],
  [/ita[uú]/i, '#ec7000'], [/bradesco/i, '#cc092f'], [/santander/i, '#d40000'], [/caixa/i, '#005ca9'], [/brasil|\bbb\b/i, '#0038a8'],
  [/c6/i, '#2b2b2b'], [/picpay/i, '#11a84e'], [/mercado ?pago/i, '#009ee3'], [/pagbank|pagseguro/i, '#1aa58a'], [/neon/i, '#00a5e0'], [/next/i, '#0b8f5a']
];
const BANCO_NEUTRAS = ['#3a3d42', '#3f5e8c', '#7a5b3a', '#4b6b5a'];
function corDoBanco(nome, i){
  const achou = BANCO_CORES.find(([re])=>re.test(nome || ''));
  return achou ? achou[1] : BANCO_NEUTRAS[(i || 0) % BANCO_NEUTRAS.length];
}
/* cor do cartãozinho: a escolhida no banco, senão a da tabela. ViaCredi: a cor tirada da logo saía verde; o fundo do cartão é azul (pedido do Davi) */
function corDoCartaoBanco(b){
  const cor = b.cor || corDoBanco(b.nome, b.i);
  if(/viacred|ailos/i.test(b.nome || '')){
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
    if(m && parseInt(m[2], 16) > parseInt(m[3], 16)) return corDoBanco(b.nome, b.i);   // esverdeado → azul da ViaCredi
  }
  return cor;
}
/* bancos como cartõezinhos em fila dentro da placa (escolha A do Davi): só a logo redonda, o chip e o saldo.
   Maior saldo primeiro; zerado fica apagado no fim (ou some, com "Esconder bancos zerados") */
function renderCarteira(){
  const el = document.getElementById('resumoCarteira'); if(!el) return;
  const us = state.users[state.currentUser] || {};
  let lista = (us.bancos || []).map((b, i)=>({ ...b, i }));   // na ordem escolhida na janela dos bancos (setas)
  if(us.esconderZerados) lista = lista.filter(b=>Math.abs(b.valor || 0) > 0.004);
  if(!lista.length){ el.innerHTML = '<span class="cc-vazio">toque para separar o saldo por banco</span>'; return; }
  el.innerHTML = lista.map(b=>{
    const zero = Math.abs(b.valor || 0) < 0.005;
    const logo = b.logoUrl ? `<img src="${b.logoUrl}" alt="">` : escBanco((b.nome || '?').trim().charAt(0).toUpperCase());
    return `<div class="cc${zero ? ' zero' : ''}" style="--c:${corDoCartaoBanco(b)}" title="${escBanco(b.nome)}">
      <div class="cc-topo"><span class="cc-logo">${logo}</span><span class="cc-chip"></span></div>
      <b><small>R$</small>${fmtMoney(Math.abs(b.valor || 0)).replace(/^R\$\s?/, '').replace(/^/, (b.valor || 0) < -0.004 ? '-' : '')}</b>
    </div>`;
  }).join('');
}
/* números do mês: Sobra e Pago com anel; Fixos e Parcelado com barrinha (só nesses dois, pedido do Davi); Cris não tem cartão */
const FIN_ICO = {
  fixo:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8"/><path d="M5 13a7 7 0 0 0 14 0"/>',
  pix:'<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M12 2.2c.7 0 1.4.3 1.9.8l2.6 2.6c-.9 0-1.8.4-2.4 1L12 8.7 9.9 6.6c-.6-.6-1.5-1-2.4-1L10.1 3c.5-.5 1.2-.8 1.9-.8zM5.7 7.1h1.8c.6 0 1.2.2 1.6.7L11.3 10a1 1 0 0 0 1.4 0l2.2-2.2c.4-.4 1-.7 1.6-.7h1.8l2.7 2.7c1.1 1.1 1.1 2.8 0 3.9l-2.7 2.7h-1.8c-.6 0-1.2-.2-1.6-.7L12.7 14a1 1 0 0 0-1.4 0l-2.2 2.2c-.4.4-1 .7-1.6.7H5.7L3 14.2c-1.1-1.1-1.1-2.8 0-3.9zM7.5 18.4c.9 0 1.8-.4 2.4-1l2.1-2.1 2.1 2.1c.6.6 1.5 1 2.4 1L13.9 21c-1 1-2.8 1-3.8 0z"/>',
  vista:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h3"/>',
  parcelado:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 6v12M15 6v12" stroke-dasharray="2 2"/><path d="M3.8 7h4.4v10H3.8z" fill="currentColor" stroke="none" opacity=".35"/>'
};
function finIco(d){ return `<span class="fb-ico"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></span>`; }
function blocosMesDados(u, mKey){
  const saldo = state.users[u].saldoAtual || 0;
  const entra = incomeForMonth(u, mKey) - saldo, sobra = saldoForMonth(u, mKey);
  const contas = gastosDoMes(u, mKey).map(g=>({ valor: g.valor, falta: g.restante }));
  const totContas = contas.reduce((s, c)=>s + c.valor, 0), faltaContas = contas.reduce((s, c)=>s + Math.max(0, c.falta), 0);
  const pix = (state.lancamentos || []).filter(la=>la.mKey === mKey && (la.usuario || 'davi') === u).reduce((s, la)=>s + (Number(la.valor) || 0), 0);
  let vista = 0, parcelado = 0, parcTot = 0, parcPagas = 0;
  if(u === 'davi') (state.cartoesTracker || []).forEach(c=>{
    const f = faturaPartes(c, faturaAbertaMes(c));
    vista += f.totalVista;
    parcelado += f.totalParcelas;
    f.parcelas.forEach(p=>{ parcTot += p.n; parcPagas += p.k - 1; });   // parcela k de n neste mês
  });
  /* falta = o mesmo número da tela Contas do mês (contas, atrasadas, dízimo, cartão e empréstimo) */
  const falta = expensesForMonth(u, mKey), ex = cpExtrasDoMes(mKey, u);
  const pagoTudo = (totContas - faltaContas) + (dizimoPagoNoMes(u, mKey) ? dizimoValorCheio(u, mKey) : 0)
    + ex.cartoes.reduce((s, x)=>s + x.f.pago, 0) + ex.parcelas.reduce((s, p)=>s + (p.pago ? p.pago.valorPago : 0), 0);
  return { entra, sobra, totContas, faltaContas, falta, pagoTudo, pix, vista, parcelado, parcTot, parcPagas };
}
function renderBlocosMes(u, mKey){
  const el = document.getElementById('resumoBlocos'); if(!el) return;
  const d = blocosMesDados(u, mKey);
  const pago = d.pagoTudo + d.falta > 0 ? Math.round(d.pagoTudo / (d.pagoTudo + d.falta) * 100) : 100;
  const pSobra = d.entra + (state.users[u].saldoAtual || 0) > 0 ? Math.max(0, Math.min(100, Math.round(d.sobra / (d.entra + (state.users[u].saldoAtual || 0)) * 100))) : 0;
  const bloco = (o)=>`<button type="button" class="fb" onclick="${o.on}">${o.ico}<span class="fb-txt"><small>${o.rot}</small><b>${o.val}</b>${o.barra != null ? `<i class="fb-barra"><i style="width:${o.barra}%"></i></i>` : ''}${o.sub ? `<em>${o.sub}</em>` : ''}</span></button>`;
  const anel = p=>`<span class="fb-anel" style="--p:${p}"></span>`;
  const b = [
    bloco({ ico: anel(pSobra), rot: d.sobra >= 0 ? 'Sobra' : 'Falta', val: fmtMoney(d.sobra), on: "abrirDetalheResumo('entra')" }),
    bloco({ ico: anel(pago), rot: 'Pago', val: pago + '%', sub: d.falta > 0.004 ? 'falta ' + fmtMoney(d.falta) : 'tudo pago', on: 'abrirContasPagar()' }),
    bloco({ ico: finIco(FIN_ICO.fixo), rot: 'Contas', val: fmtMoney(d.pagoTudo + d.falta), barra: pago, on: `abrirContasPagar('${mKey}')` }),
    bloco({ ico: finIco(FIN_ICO.pix), rot: 'Pix no mês', val: fmtMoney(d.pix), on: `abrirFoco('pix','${mKey}')` })
  ];
  if(u === 'davi' && (state.cartoesTracker || []).length){
    b.push(bloco({ ico: finIco(FIN_ICO.vista), rot: 'Crédito à vista', val: fmtMoney(d.vista), on: `abrirFoco('vista','${mKey}')` }));
    b.push(bloco({ ico: finIco(FIN_ICO.parcelado), rot: 'Parcelado', val: fmtMoney(d.parcelado), barra: d.parcTot ? Math.round(d.parcPagas / d.parcTot * 100) : null, on: `abrirFoco('parcelado','${mKey}')` }));
  }
  el.innerHTML = b.join('');
}
/* curva: hoje (saldo) → fim deste mês (sobra) → acumulado dos próximos 4 meses; toque num mês abre o detalhe */
let curvaSel = null, curvaLarg = 0, curvaObs = null;   // mês tocado ('hoje' ou mKey); sem toque = fim do mês atual
function curvaEscolher(m){ curvaSel = m; renderCurvaSaldo(userDash(), mesFinanceiroAtual()); }
function renderCurvaSaldo(u, mKey){
  const el = document.getElementById('resumoProximos'); if(!el) return;
  const saldo = state.users[u].saldoAtual || 0, nome = m=>monthLabel(m).slice(0, 3);
  let acum = saldoForMonth(u, mKey);
  const pts = [{ rot:'Hoje', v: saldo, id:'hoje' }, { rot: nome(mKey), v: acum, muda: acum - saldo, id: mKey }];
  for(let i = 1; i <= 4; i++){ const m = addMonths(mKey, i), muda = saldoForMonth(u, m); acum += muda; pts.push({ rot: nome(m), v: acum, muda, id: m }); }
  /* desenha na largura real do bloco, para a letra do gráfico não esticar */
  if(!curvaObs){ curvaObs = new ResizeObserver(()=>{ if(el.clientWidth && el.clientWidth !== curvaLarg) renderCurvaSaldo(userDash(), mesFinanceiroAtual()); }); curvaObs.observe(el); }
  curvaLarg = el.clientWidth;
  const W = Math.max(240, (curvaLarg || 352) - 32), H = 170, L = 12, R = 12, T = 16, B = 138, n = pts.length;
  const vs = pts.map(p=>p.v), max = Math.max(0, ...vs), min = Math.min(0, ...vs), faixa = (max - min) || 1;
  const x = i=>L + i * (W - L - R) / (n - 1), y = v=>T + (max - v) * (B - T) / faixa, zero = y(0);
  const P = pts.map((p, i)=>[x(i), y(p.v)]);
  let d = `M${P[0][0]},${P[0][1]}`;
  for(let i = 0; i < n - 1; i++){   // curva suave (Catmull-Rom)
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  const a = Math.max(0, pts.findIndex(p=>p.id === curvaSel)) || 1, s = curvaSel === 'hoje' ? 0 : a, sel = pts[s], corte = (zero - T) / (B - T), slot = (W - L - R) / (n - 1);
  const sub = s === 0 ? 'saldo de hoje' : `${sel.muda < 0 ? '−' : '+'}${fmtMoney(Math.abs(sel.muda))} no mês · fim de ${sel.rot}`;
  el.innerHTML = `<div class="curva-rot">Quanto fica no banco</div><div class="curva-num${sel.v < 0 ? ' neg' : ''}">${fmtMoneySigned(sel.v)}</div>
    <div class="curva-sub"><span>${sub}</span>${s ? `<button type="button" onclick="abrirDetalheAcumulado('${sel.id}')">ver o mês</button>` : ''}</div>
    <div class="curva-graf"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>
        <linearGradient id="curvaLinha" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${T}" y2="${B}"><stop offset="${corte}" stop-color="#9fc1e6"/><stop offset="${corte}" stop-color="#f4a696"/></linearGradient>
        <linearGradient id="curvaFundo" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9fc1e6" stop-opacity=".28"/><stop offset="1" stop-color="#9fc1e6" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${x(n - 1)},${zero} L${x(0)},${zero} Z" fill="url(#curvaFundo)"/>
      <line x1="0" x2="${W}" y1="${zero}" y2="${zero}" stroke="#b9c6d8" stroke-opacity=".4" stroke-dasharray="3 5"/>
      <line x1="${x(s)}" x2="${x(s)}" y1="${T - 6}" y2="${B + 4}" stroke="#fff" stroke-opacity=".35"/>
      <path d="${d}" fill="none" stroke="url(#curvaLinha)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${P[s][0]}" cy="${P[s][1]}" r="6" fill="#fff" stroke="#1b2638" stroke-width="2"/>
      ${pts.map((p, i)=>`<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="13" font-weight="${i === s ? 600 : 400}" fill="${i === s ? '#fff' : '#b9c6d8'}">${p.rot}</text>`).join('')}
    </svg>${pts.map((p, i)=>`<button type="button" style="left:${Math.max(0, x(i) - slot / 2)}px;width:${slot}px" aria-label="${p.rot}: ${fmtMoneySigned(p.v)}" aria-pressed="${i === s}" onclick="curvaEscolher('${p.id}')"></button>`).join('')}</div>`;
}
/* próximas contas em aberto (pela data): calendário com o dia no meio, nome e o mês embaixo, valor à direita (v12) */
function renderProxContas(u, mKey){
  const el = document.getElementById('resumoProxContas'); if(!el) return;
  const hoje = new Date().getDate();
  const abertas = getContasDoMes(mKey, u).filter(it=>!state.paid[mKey + '_' + it.user + '_' + it.cat + '_' + it.id])
    .map(it=>({ ...it, falta: typeof restanteConta === 'function' ? restanteConta(mKey + '_' + it.user + '_' + it.cat + '_' + it.id, it.valor) : it.valor }))
    .filter(it=>it.falta > 0.004);
  if(!abertas.length){ el.innerHTML = '<div class="pc-vazio">Tudo pago neste mês</div>'; return; }
  el.innerHTML = abertas.slice(0, 8).map(it=>{
    const quando = it.dia === hoje ? 'hoje' : monthLabelLong(mKey).split(' ')[0].toLowerCase();
    return `<button type="button" class="pc-item" onclick="abrirContasPagar()"><span class="cal${it.dia === hoje ? ' hoje' : ''}"><b>${it.dia}</b></span><b>${escBanco(it.desc)}</b><small>${quando}</small><span class="pc-valor">${fmtMoney(it.falta)}</span></button>`;
  }).join('');
}

/* ===== Detalhe do "Vai entrar" e do "Falta pagar" (toque nos números do resumo) =====
   As listas somam exatamente o número mostrado no resumo. */
/* linha de lista (v12, escolha C): a logo da conta, senão o calendário com o dia, senão a inicial */
function gmCal(dia){ return `<span class="cal"><b>${dia}</b></span>`; }
function rdLinha(o){
  const ico = o.logoUrl ? `<img src="${o.logoUrl}" class="conta-logo" alt="">` : o.dia ? gmCal(o.dia) : `<span class="gm-inicial${o.icoClasse?' '+o.icoClasse:''}">${o.ico || escBanco((o.nome||'?').charAt(0).toUpperCase())}</span>`;
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
  const breakdown = { moradia:0, assinatura:0, fixo:0, futuro:0, cartao:0, dizimo:0 };
  gastosDoMes(user, mKey).forEach(g=>{ breakdown[g.cat] += g.restante; });
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
        <div class="simulador-linha" style="border-top:2px solid var(--slate-200);margin-top:4px;padding-top:8px"><span class="label" style="font-weight:600">Sobra ${user==='davi'?'Davi':'Cris'}</span><span class="valor" style="font-weight:900">${fmtMoneySigned(renda-bd.total)}</span></div>
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

function selectFocusMonth(mKey){
  state.focusMonth = mKey;
  renderPanorama();
  persist();
}
/* as contas do mês (gastosDoMes) em ordem de vencimento, com "(k/n)" no nome das parceladas */
function getContasDoMes(mKey, usuario){
  return gastosDoMes(usuario || 'davi', mKey)
    .map(g=>Object.assign({}, g, { dia: g.dia||1, desc: g.desc + (g.parcela ? ' ('+g.parcela.atual+'/'+g.parcela.total+')' : '') }))
    .sort((a,b)=> a.dia - b.dia);
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
  return getContasDoMes(mKey).filter(it=>!it.pago).length;
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
  if(novo < addMonths(mesFinanceiroAtual(), -36) || novo > addMonths(mesFinanceiroAtual(), 36)) return;
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
  /* sempre pergunta: concluir avança o mês do app (dá para desfazer por 6 s no aviso) */
  const ok = await iosConfirm(abertas > 0
    ? `Ainda há ${abertas} conta${abertas>1?'s':''} em aberto em ${monthLabel(mKey)}. Concluir o mês e passar para ${monthLabel(addMonths(mKey,1))} mesmo assim?`
    : `Concluir ${monthLabel(mKey)} e passar para ${monthLabel(addMonths(mKey,1))}?`);
  if(!ok) return;
  fecharContasPagar();
  concluirMesAtual();
}
function cpAtualizarTudo(){
  persist();
}
function cpToggleSalario(u, mKey){
  ganhoAlternar(u, 'sal_'+u+'_'+mKey, rendaBaseForMonth(u, mKey), u==='davi' ? 'Salário' : 'Renda', salarioRecebidoNoMes(u, mKey), on=>setSalarioRecebido(u, mKey, on));
}
function cpToggleExtra(u, id, mKey){
  const e = (state.users[u].extras||[]).find(x=>x.id===id);
  if(!e) return;
  ganhoAlternar(u, 'ext_'+u+'_'+id+'_'+mKey, Number(e.valor)||0, e.desc || 'Extra', extraRecebidoNoMes(e, mKey), on=>setExtraRecebido(u, id, mKey, on));
}
/* Concluir ganho: pergunta em qual banco caiu e soma lá. Desmarcar devolve. marcar(bool) liga/desliga o "recebido". */
let ganhoFim = null;
function ganhoAlternar(u, chave, valor, nome, recebido, marcar){
  if(recebido){ desfazerNoBanco(u, chave); marcar(false); persist(); return; }
  const bancos = state.users[u].bancos || [];
  ganhoFim = i=>{
    closeModal('modalPergunta');
    const b = i === null ? null : bancos[i];
    comDesfazer(b ? `+${fmtMoney(valor)} no ${b.nome}` : `${nome}: recebido`, ()=>{
      if(b) registrarNoBanco(u, chave, valor, b.nome);
      else if(i !== null) registrarNoBanco(u, chave, valor, '');
      marcar(true);
      persist();
    });
  };
  if(!bancos.length){ ganhoFim(-1); return; }
  document.getElementById('perguntaTitulo').textContent = 'Em qual banco caiu?';
  document.getElementById('perguntaCorpo').innerHTML = `<div class="modal-destaque"><span>${escBanco(nome)}</span><b>${fmtMoney(valor)}</b></div>
    ${bancos.map((b, i)=>`<button type="button" class="gm-linha pg-banco" onclick="ganhoFim(${i})">${b.logoUrl ? `<img src="${b.logoUrl}" class="conta-logo" alt="">` : `<span class="gm-inicial">${escBanco((b.nome||'?').charAt(0).toUpperCase())}</span>`}<span class="gm-nome">${escBanco(b.nome)}</span><span class="gm-valor">${fmtMoney(Number(b.valor)||0)}</span></button>`).join('')}
    <button type="button" class="modal-link pg-ja" onclick="ganhoFim(null)">Já está no saldo, só marcar como recebido</button>`;
  document.getElementById('modalPergunta').classList.add('active');
}
/* ===== PAGAR: toda conta, dízimo, fatura e parcela tira do banco escolhido ===== */
/* escolha do banco (já vem o último usado). "Não mexer no saldo" é para quando o saldo informado já desconta. Sem banco cadastrado não pergunta. */
function pgBancosHtml(u, rotulo, o = {}){
  const bancos = state.users[u].bancos || [], cartoes = o.comCartao && u === 'davi' ? (state.cartoesTracker || []) : [];
  if(!bancos.length && !cartoes.length) return '';
  const ultimo = (state.ultimoBanco || {})[u], selC = o.forma && o.forma.cartao ? o.forma.cartao.id : null;
  const sel = (o.forma && o.forma.banco) || (bancos.some(b=>b.nome === ultimo) ? ultimo : (bancos[0] || {}).nome);
  const pre = cartoes.length ? 'Pix ' : '';
  return `<div class="field full"><label>${rotulo || (cartoes.length ? 'Como pagou' : 'De qual banco saiu')}</label><div class="pg-bancos">${bancos.map(b=>`<button type="button" class="dif-chip${!selC && b.nome === sel ? ' active' : ''}" data-banco="${escBanco(b.nome)}" onclick="pgEscolher(this)">${pre}${escBanco(b.nome)}</button>`).join('')}${cartoes.map(c=>`<button type="button" class="dif-chip${c.id === selC ? ' active' : ''}" data-cartao="${escBanco(c.id)}" onclick="pgEscolher(this)">Cartão ${escBanco(c.nome)}</button>`).join('')}<button type="button" class="dif-chip" data-nao="1" onclick="pgEscolher(this)">Não mexer no saldo</button></div></div>`;
}
function pgEscolher(btn){ btn.parentElement.querySelectorAll('.dif-chip').forEach(b=>b.classList.toggle('active', b === btn)); }
/* nome do banco; null = não mexer no saldo; '' = sem banco cadastrado (mexe só no saldo geral) */
function pgBancoDe(raiz){
  const on = raiz.querySelector('.pg-bancos .dif-chip.active');
  if(!on) return '';
  return on.dataset.nao || on.dataset.cartao ? null : on.dataset.banco;
}
function pgCartaoDe(raiz){
  const on = raiz.querySelector('.pg-bancos .dif-chip.active'), id = on && on.dataset.cartao;
  return id ? (state.cartoesTracker || []).find(c=>c.id === id) || null : null;
}
function pgGuardarUltimo(u, banco){ if(banco) (state.ultimoBanco = state.ultimoBanco || {})[u] = banco; }
function saiuDoBanco(u, chave, valor, banco){
  if(banco === null) return;
  registrarNoBanco(u, chave, -valor, banco);
  pgGuardarUltimo(u, banco);
}
/* devolve ao banco o que uma conta tirou (pagamento e pagamento parcial) */
function contaDevolver(paidKey){
  const u = paidKey.split('_')[1];
  desfazerNoBanco(u, 'pag_'+paidKey);
  desfazerNoBanco(u, 'par_'+paidKey);
  contaTirarDoCartao(paidKey);
}
let pagarFim = null;
const pagoMsg = (nome, v, banco, cartao)=>cartao ? `${nome}: ${fmtMoney(v)} na fatura do ${cartao.nome}` : `${nome} pago: ${fmtMoney(v)}${banco ? ' · '+banco : ''}`;
function pagarPerguntar(o){
  document.getElementById('perguntaTitulo').textContent = o.titulo || 'Pagar';
  const fmt = v=>Number(v).toFixed(2).replace('.', ',');
  document.getElementById('perguntaCorpo').innerHTML = `${o.extra || `<div class="modal-destaque"><span>${escBanco(o.nome)}${o.exato ? ' · previsto' : ''}</span><b>${fmtMoney(o.valor)}</b></div>`}
    <form onsubmit="event.preventDefault();pagarConfirmar()">
      <div class="field full"><label for="perguntaValor">${o.rotulo || (o.exato ? 'Valor exato pago' : 'Valor pago')}</label><div class="input-money"><input type="text" id="perguntaValor" inputmode="numeric" placeholder="0,00" value="${o.exato ? '' : fmt(o.valor)}" oninput="maskMoneyInput(this)"></div></div>
      ${pgBancosHtml(o.u, o.rotuloForma, o)}
      <div class="modal-actions"><button type="button" class="btn btn-outline btn-block" onclick="closeModal('modalPergunta')">Cancelar</button><button class="btn btn-block">${o.botao || 'Pagar'}</button></div>
    </form>`;
  pagarFim = (v, banco, cartao)=>comDesfazer(pagoMsg(o.nome, v, banco, cartao), ()=>{ o.aoPagar(v, banco, cartao); persist(); });
  document.getElementById('modalPergunta').classList.add('active');
  if(o.exato) document.getElementById('perguntaValor').focus();
}
function pagarConfirmar(){
  const inp = document.getElementById('perguntaValor'), v = parseMoney(inp.value);
  if(!(v > 0)){ showToast('Digite o valor pago'); inp.focus(); return; }
  const banco = pgBancoDe(document.getElementById('perguntaCorpo'));
  inp.blur();
  closeModal('modalPergunta');
  pagarFim(v, banco, pgCartaoDe(document.getElementById('perguntaCorpo')));
}
function abrirHistoricoVariaveis(){
  const contas = historicoVariaveis(state.currentUser);
  document.getElementById('perguntaTitulo').textContent = 'Histórico das variáveis';
  document.getElementById('perguntaCorpo').innerHTML = contas.length ? contas.map(c=>`<div class="gm-grupo"><div class="gm-grupo-topo"><span>${escBanco(c.desc)}</span>${c.meses.length > 1 ? `<span>média ${fmtMoney(c.media)}</span>` : ''}</div>
    ${c.meses.map(m=>`<div class="gm-linha"><div class="gm-info"><div class="gm-nome">${monthLabelLong(m.mKey)}</div></div><div class="gm-valor">${fmtMoney(m.valor)}</div></div>`).join('') || '<div class="gm-vazio">Nenhum valor registrado ainda.</div>'}</div>`).join('')
    : '<div class="gm-vazio">Nenhuma conta está marcada como Variável.</div>';
  document.getElementById('modalPergunta').classList.add('active');
}
function cpToggleDizimo(u, mKey){
  const chave = 'diz_'+u+'_'+mKey;
  if(dizimoPagoNoMes(u, mKey)){ desfazerNoBanco(u, chave); setDizimoPago(u, mKey, false); cpAtualizarTudo(); return; }
  pagarPerguntar({ u, nome:'Dízimo', valor: dizimoValorCheio(u, mKey), aoPagar:(v, banco)=>{ saiuDoBanco(u, chave, v, banco); setDizimoPago(u, mKey, true); } });
}
const CP_ICON_OK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
/* linha padrão da tela Contas do mês: logo · título/sub · valor · bolinha de feito */
function cpItem(o){
  const logo = o.logoUrl
    ? `<img src="${o.logoUrl}" class="cp-logo" alt="">`
    : o.dia ? gmCal(o.dia) : `<div class="cp-logo cp-logo-ph">${o.icone || (o.titulo||'?').charAt(0).toUpperCase()}</div>`;
  return `<div class="cp-item${o.feito?' feito':''}${o.parcial?' parcial':''}" ${o.attrs||''}>
    ${logo}
    <div class="cp-item-info">
      <div class="cp-item-tit">${o.titulo}${o.tag||''}</div>
      ${o.sub?`<div class="cp-item-sub">${o.sub}</div>`:''}
    </div>
    <div class="cp-item-val">${fmtMoney(o.valor)}${o.valorSub?`<small>${o.valorSub}</small>`:''}</div>
    ${o.acao||''}<span class="cp-check" aria-hidden="true">${o.feito?CP_ICON_OK:''}</span>
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
    .filter(it=>{ const pk = mesAnteriorKey+'_'+it.user+'_'+it.cat+'_'+it.id; return !state.paid[pk] && !arquivadas[pk] && it.tipo !== 'meta'; });
  const items = itemsAnterior.concat(itemsAtual).sort((a,b)=> a.mesOrigem!==b.mesOrigem ? (a.mesOrigem<b.mesOrigem?-1:1) : (a.dia||1)-(b.dia||1));
  items.forEach(it=>{
    const paidKey = it.mesOrigem+'_'+it.user+'_'+it.cat+'_'+it.id;
    const isPaid = !!state.paid[paidKey];
    const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
    const noCartao = isPaid ? 0 : Math.min(Number(it.valor)||0, contaUsadaNoCartao(paidKey));
    const isParcial = !isPaid && (valorPago > 0 || noCartao > 0);
    conta(Number(it.valor)||0, isPaid, valorPago + noCartao);
    if(it.tipo === 'meta' && !isPaid){
      const usado = valorPago + contaUsadaNoCartao(paidKey), dif = (Number(it.valor)||0) - usado;
      contasHtml += cpItem({ titulo: it.desc, logoUrl: it.logoUrl, icone: it.desc.charAt(0).toUpperCase(),
        sub: usado > 0.004 ? `gastou ${fmtMoney(usado)}` : 'toque para lançar uma compra',
        valor: Number(it.valor)||0, valorSub: dif < -0.004 ? `passou ${fmtMoney(-dif)}` : `sobra ${fmtMoney(dif)}`, parcial: usado > 0.004,
        attrs: `onclick="togglePaid('${paidKey}')"` });
      return;
    }
    const diasVenc = !isPaid ? diasParaVencimento(it, it.mesOrigem) : null;
    const corDia = diasVenc===null ? '' : (diasVenc<0?' atrasada':(diasVenc<=3?' urgente':''));
    const quando = diasVenc===null ? `dia ${it.dia}` : (diasVenc<0 ? `venceu dia ${it.dia}` : (diasVenc===0 ? 'vence hoje' : (diasVenc<=3 ? `vence em ${diasVenc} dia${diasVenc>1?'s':''}` : `dia ${it.dia}`)));
    contasHtml += cpItem({
      titulo: it.desc, logoUrl: it.logoUrl, dia: it.dia,
      sub: `<span class="cp-dia${corDia}">${quando}</span>`,
      tag: it.mesOrigem!==mKey ? `<span class="cp-tag">${monthLabel(it.mesOrigem)}</span>` : '',
      valor: Number(it.valor)||0, valorSub: !isParcial ? '' : [valorPago > 0 ? 'pago '+fmtMoney(valorPago) : '', noCartao > 0 ? fmtMoney(noCartao)+' no cartão' : ''].filter(Boolean).join(' · '),
      feito: isPaid, parcial: isParcial,
      acao: isPaid ? '' : `<button type="button" class="cp-parte ico-btn" title="Paguei só uma parte" aria-label="Paguei só uma parte" onclick="event.stopPropagation();abrirEditarConta('${paidKey}','${it.user}','${it.cat}','${it.id}','${it.mesOrigem}')">${ICO(ICO_D.parte, 18)}</button>`,
      attrs: `onclick="togglePaid('${paidKey}')"`
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
    <button type="button" onclick="cpNavMes(-1)" aria-label="Mês anterior"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.4 6 14 4.6 6.6 12l7.4 7.4 1.4-1.4-6-6z"/></svg></button>
    <div class="cp-mes-label">${monthLabelLong(mKey)}${mKey===mesFinanceiroAtual()?' <small>atual</small>':''}</div>
    <button type="button" onclick="cpNavMes(1)" aria-label="Próximo mês"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.6 18 10 19.4l7.4-7.4L10 4.6 8.6 6l6 6z"/></svg></button>
  </div>
  <div class="cp-resumo">
    <div class="cp-resumo-lbl">Falta pagar</div>
    <div class="cp-resumo-val">${fmtMoney(totalPagar)}</div>
    <div class="cp-resumo-bar"><div style="width:${pct}%"></div></div>
    <div class="cp-resumo-sub"><span><b>${nFeitos} de ${nItens}</b> pagas · ${fmtMoney(totalPago)}</span>${aReceber>0.004?`<span>a receber <b>${fmtMoney(aReceber)}</b></span>`:''}</div>
    ${mKey===mesFinanceiroAtual()?`<div class="cp-resumo-sub cp-resumo-saldo"><span>${(state.users[u].bancos||[]).map(b=>`${escBanco(b.nome)} <b>${fmtMoney(Number(b.valor)||0)}</b>`).join(' · ') || `Saldo <b>${fmtMoney(state.users[u].saldoAtual||0)}</b>`}</span><span>depois de tudo sobra <b>${fmtMoney(saldoForMonth(u, mKey))}</b></span></div>`:''}
  </div>`;
  /* filtro Todas / Em aberto / Pagas (v12, escolha C do Davi): esconde pelo CSS (data-filtro) */
  html += `<div class="sec-filtro cp-filtro">${[['todas','Todas'],['aberto','Em aberto'],['pagas','Pagas']].map(([k, t])=>`<button type="button" class="${cpFiltro === k ? 'on' : ''}" onclick="cpFiltrar('${k}')">${t}</button>`).join('')}</div>`;
  if(receb) html += cpBloco('Recebimentos', 'toque quando cair na conta', receb);
  html += cpBloco('Contas', 'toque = paga · ◐ = pagou só uma parte',
    contasHtml || `<div class="empty-state"><div class="title">Nenhuma conta neste mês</div><div class="desc">Adicione gastos no Dashboard</div></div>`);
  if(cartaoHtml) html += cpBloco('Cartão', 'toque para pagar a fatura', cartaoHtml);
  if(empHtml) html += cpBloco('Empréstimo', 'toque para pagar a parcela', empHtml);
  const cont = document.getElementById('contasPagarConteudo');
  cont.innerHTML = html;
  cont.dataset.filtro = cpFiltro;
}
let cpFiltro = 'todas';
function cpFiltrar(f){ cpFiltro = f; renderContasPagar(); }

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

function togglePaid(paidKey){
  if(state.paid[paidKey]){ contaDevolver(paidKey); marcarContaPaga(paidKey, false); persist(); return; }
  const [mKey, u] = paidKey.split('_');
  const g = gastosDoMes(u, mKey).find(x=>x.paidKey === paidKey);
  const item = contaDoPaidKey(paidKey), variavel = item?.tipo === 'variavel', forma = contaForma(item, u);
  if(!g){ marcarContaPaga(paidKey); persist(); return; }
  if(item?.tipo === 'meta'){
    pagarPerguntar({ u, nome: g.desc, valor: g.restante, exato: true, titulo: g.desc, rotulo: 'Quanto gastou', rotuloForma: 'Como pagou', botao: 'Lançar', comCartao: true, forma,
      extra: contaDetalheHtml(paidKey, item), aoPagar:(v, banco, cartao)=>{ metaLancar(paidKey, v, banco, cartao); pgGuardarUltimo(u, banco); } });
    return;
  }
  if(!variavel && g.restante <= 0.004){ marcarContaPaga(paidKey); persist(); return; }   // já gasta toda no cartão: nada sai do banco
  const aoPagar = (v, banco, cartao)=>{
    if(cartao) contaNoCartao(paidKey, cartao, v);
    else{ saiuDoBanco(u, 'pag_'+paidKey, v, banco); marcarContaPaga(paidKey); }
    const real = lancValor(g.valor + v - g.restante);   // pagou diferente do previsto: vale o pago, só neste mês
    if(variavel || Math.abs(real - g.valor) > 0.004) (state.valoresReais = state.valoresReais || {})[paidKey] = real;
  };
  /* método já escolhido no cadastro e valor certo: um toque só, com Desfazer */
  if(forma && !variavel){
    comDesfazer(pagoMsg(g.desc, g.restante, forma.banco, forma.cartao), ()=>{ aoPagar(g.restante, forma.banco || null, forma.cartao); persist(); });
    return;
  }
  pagarPerguntar({ u, nome: g.desc, valor: g.restante, exato: variavel, titulo: variavel ? 'Qual foi o valor exato?' : 'Pagar', comCartao: true, forma, aoPagar });
}

function getGastoItemRef(user, cat, id){
  return state.users[user].expenses[cat].find(i=>i.id===id);
}

let editandoConta = null;
function abrirEditarConta(paidKey, user, cat, id, mKey){
  const item = getGastoItemRef(user, cat, id);
  if(!item) return;
  editandoConta = { paidKey, user, cat, id, mKey };
  const valorTotal = (state.valoresReais||{})[paidKey] || (cat==='futuro' ? futuroValorNoMes(item, mKey) : item.valor);
  const valorPago = (state.pagamentosParciais||{})[paidKey] || 0;
  const isPaid = !!state.paid[paidKey];

  document.getElementById('editarContaTitulo').textContent = item.desc;
  document.getElementById('editarContaValorTotal').textContent = fmtMoney(valorTotal);
  document.getElementById('editarContaValorPago').value = valorPago ? valorPago.toFixed(2).replace('.',',') : '';
  document.getElementById('editarContaLogoPreview').innerHTML = item.logoUrl
    ? `<img src="${item.logoUrl}" class="conta-logo-grande">`
    : `<div class="conta-logo-grande conta-logo-placeholder">${item.desc.charAt(0).toUpperCase()}</div>`;
  document.getElementById('editarContaPagaCheck').checked = isPaid;
  document.getElementById('editarContaBancos').innerHTML = pgBancosHtml(user);
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
  const valorTotal = (state.valoresReais||{})[paidKey] || (cat==='futuro' ? futuroValorNoMes(item, mKey) : item.valor);
  const valorPago = parseMoney(document.getElementById('editarContaValorPago').value);
  const pagaIntegral = document.getElementById('editarContaPagaCheck').checked;

  if(!state.pagamentosParciais) state.pagamentosParciais = {};
  const banco = pgBancoDe(document.getElementById('modalEditarConta'));
  const parteAntes = state.pagamentosParciais[paidKey] || 0, comRegistro = !!(state.ganhoNoBanco || {})['par_'+paidKey];
  const jaPaga = !!state.paid[paidKey] && !(state.ganhoNoBanco || {})['pag_'+paidKey];   // paga antes desta versão: já saiu do saldo
  const faltaAntes = restanteConta(paidKey, valorTotal);
  contaDevolver(paidKey);
  /* pagamento parcial anterior a esta versão já saiu do saldo: tira só a diferença */
  const aTirar = v=>comRegistro ? v : Math.max(0, v - parteAntes);
  if(pagaIntegral || valorPago >= valorTotal){
    if(!jaPaga){ const v = valorPago > 0 ? valorPago : parteAntes + faltaAntes; saiuDoBanco(user, 'pag_'+paidKey, aTirar(v), banco); }
    marcarContaPaga(paidKey, true, valorPago);
  } else if(valorPago > 0){
    saiuDoBanco(user, 'par_'+paidKey, aTirar(valorPago), banco);
    marcarContaPaga(paidKey, false);
    state.pagamentosParciais[paidKey] = valorPago;
  } else {
    marcarContaPaga(paidKey, false);
    delete state.pagamentosParciais[paidKey];
  }
  persist();
  closeEditarConta();
  showToast('Conta atualizada');
}


/* ================= HISTÓRICO DE MESES =================
   Mês atual (em andamento, calculado agora) + cada mês concluído (resumo guardado ao tocar em Finalizar, em Contas do mês).
   Toque num mês para ver para onde foi o dinheiro. */
const HIST_ROTULOS = [['moradia','Moradia'],['assinatura','Assinaturas'],['fixo','Fixos'],['futuro','Contas futuras'],['dizimo','Dízimo'],['cartao','Cartão'],['emprestimo','Empréstimo']];
/* Histórico de meses (v12, escolha B do Davi): um cartão por mês deslizando para o lado (o atual em grafite); tocar mostra o detalhe embaixo */
let hmMeses = [], hmSel = 0;
function abrirHistoricoMeses(){
  const atual = mesFinanceiroAtual();
  const fechados = Object.entries(state.historicoMeses||{}).filter(([m])=>m!==atual).sort((a,b)=>b[0].localeCompare(a[0]));
  hmMeses = [[atual, Object.assign(resumoCompletoDoMes(atual), { andamento:true })], ...fechados];
  hmSel = 0;
  const cartao = ([m, r], i)=>{
    const sobra = (r.renda||0) - (r.gastoTotal||0);
    const anterior = hmMeses[i+1] ? (hmMeses[i+1][1].renda||0) - (hmMeses[i+1][1].gastoTotal||0) : null;
    const comp = anterior===null ? '' : `<span class="hm-comp ${sobra>=anterior?'pos':'neg'}">${sobra>=anterior?'▲':'▼'} ${fmtMoney(Math.abs(sobra-anterior))}</span>`;
    return `<button type="button" class="hm-cartao${i===0?' on':''}" data-i="${i}" onclick="hmEscolher(${i})">
      <span class="hm-nome">${monthLabelLong(m)}${r.andamento?' · em andamento':''}</span>
      <b class="hm-sobra ${sobra>=0?'pos':'neg'}">${fmtMoneySigned(sobra)}</b>
      <span class="hm-legenda">entrou ${fmtMoney(r.renda||0)}<br>saiu ${fmtMoney(r.gastoTotal||0)}</span>${comp}
    </button>`;
  };
  document.getElementById('historicoMesesLista').innerHTML = `<div class="hm-rolo">${hmMeses.map(cartao).join('')}</div><div class="hm-detalhe" id="hmDetalhe"></div>`
    + (fechados.length ? '' : '<div class="hm-dica">Os meses aparecem aqui quando você toca em Finalizar, em Contas do mês. O resumo fica guardado mesmo depois que os dados do mês são limpos.</div>');
  hmEscolher(0);
  document.getElementById('modalHistoricoMeses').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function hmEscolher(i){
  hmSel = i;
  document.querySelectorAll('.hm-cartao').forEach(b=>b.classList.toggle('on', Number(b.dataset.i) === i));
  const [m, r] = hmMeses[i] || []; const el = document.getElementById('hmDetalhe'); if(!el || !r) return;
  el.innerHTML = `<div class="hm-det-tit">${monthLabelLong(m)}</div>` + (r.v===2 ? HIST_ROTULOS.map(([k, nome])=>{
      const v = k in (r.contas||{}) ? r.contas[k] : (r[k]||0);
      return v > 0.004 ? `<div class="hm-cat"><span>${nome}</span><div class="hm-cat-barra"><div style="width:${Math.round(v/Math.max(1,r.gastoTotal)*100)}%"></div></div><b>${fmtMoney(v)}</b></div>` : '';
    }).join('') + `<div class="hm-cat hm-cat-renda"><span>Salário + extras</span><div></div><b>${fmtMoney(r.salario||0)} + ${fmtMoney(r.extras||0)}</b></div>`
    : '<div class="gm-vazio">Mês fechado antes do resumo detalhado.</div>');
}

/* ===== PARA ONDE VAI O DINHEIRO: tudo o que sai no mês (pago ou não), por grupo;
   o cartão entra aberto pelas categorias das compras à vista/assinaturas + parcelas ===== */
let ondeVaiMes = null;
const ONDE_VAI_CORES = ['#1b2638','#9fc1e6','#8b8f95','#3f6ea3','#5a6b7a','#b8c6da','#2f7a63','#b0483a','#6e5a8f','#475165'];   // v12: grafite, latão e neutros
function ondeVaiDados(u, mKey){
  const g = {}, vista = {}, pix = {}, envelope = {};
  const soma = (obj, nome, v)=>{ v = Number(v)||0; if(v > 0.004) obj[nome] = (obj[nome]||0) + v; };
  const sa = s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if(u === 'davi'){
    (state.cartoesTracker||[]).forEach(c=>{
      Object.entries(cartaoGastosPorMes(c, mKey).porCategoria).forEach(([cat, v])=>soma(vista, cat === 'Ajuste' ? 'Ajuste da fatura' : cat, v));
      soma(g, 'Parcelas no cartão', faturaPartes(c, mKey).totalParcelas);   // antes do controle do cartão: fica tudo de fora
    });
  }
  /* compras faladas no Pix/débito */
  (state.lancamentos||[]).filter(la=>la.mKey === mKey && (la.usuario || 'davi') === u).forEach(la=>soma(pix, la.categoria || 'Outros', la.valor));
  /* conta fixa com o mesmo nome de uma categoria (ex.: "Mercado") é uma reserva para esse gasto:
     o que já foi no cartão ou no Pix sai da conta, para não contar duas vezes (mesma regra de contaUsadaNoCartao) */
  getContasDoMes(mKey, u).forEach(it=>{
    if(it.noCartao) return;   // paga no cartão: já conta na fatura
    let v = Number(it.valor) || 0;
    const usado = contaUsadaNoCartao(mKey + '_' + it.user + '_' + it.cat + '_' + it.id);
    if(usado > 0){
      [vista, pix].forEach(o=>Object.keys(o).forEach(c=>{ if(sa(c) === sa(it.desc)) envelope[c] = (envelope[c]||0) + v; }));
      v -= Math.min(v, usado);
    }
    soma(g, CATEGORIA_LABELS[it.cat] || 'Contas', v);
  });
  soma(g, 'Dízimo', dizimoValorCheio(u, mKey));
  const tv = Object.values(vista).reduce((s,v)=>s+v, 0), tp = Object.values(pix).reduce((s,v)=>s+v, 0);
  if(tv > 0.004) g['Cartão à vista'] = tv;
  if(tp > 0.004) g['Pix e débito'] = tp;
  if(u === 'davi') soma(g, 'Empréstimo', emprestimoValorGeralNoMes(mKey));
  const subs = o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([n, x])=>[n, x, envelope[n] || 0]);
  return Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([nome, v])=>({ nome, v,
    sub: nome === 'Cartão à vista' ? subs(vista) : nome === 'Pix e débito' ? subs(pix) : null }));
}
function ondeVaiMudarMes(d){ ondeVaiMes = addMonths(ondeVaiMes || mesFinanceiroAtual(), d); renderOndeVai(); }
function renderOndeVai(){
  const el = document.getElementById('ondeVaiConteudo'); if(!el || !state.users) return;
  const u = userDash(), mKey = ondeVaiMes || mesFinanceiroAtual();
  document.getElementById('ondeVaiMes').textContent = monthLabelLong(mKey);
  const dados = ondeVaiDados(u, mKey), total = dados.reduce((s,d)=>s + d.v, 0);
  /* comparação com o mês anterior: seta e % em cada linha (gasto subiu = vermelho, caiu = verde) */
  const antes = {}; ondeVaiDados(u, addMonths(mKey, -1)).forEach(d=>{ antes[d.nome] = d.v; (d.sub||[]).forEach(([n, x])=>{ antes[d.nome + '|' + n] = x; }); });
  const totalAntes = Object.keys(antes).filter(k=>!k.includes('|')).reduce((s,k)=>s + antes[k], 0);
  const varia = (agora, ant)=>{
    if(!(ant > 0.004)) return agora > 0.004 ? '<span class="ov-var novo">novo</span>' : '';
    const p = Math.round((agora - ant) / ant * 100);
    if(Math.abs(p) < 1) return '<span class="ov-var">=</span>';
    return `<span class="ov-var ${p > 0 ? 'sobe' : 'desce'}">${p > 0 ? '↑' : '↓'} ${Math.abs(p)}%</span>`;   // gasto subiu = vermelho, caiu = verde
  };

  if(!total){ el.innerHTML = `<div class="gm-vazio">Nada saindo em ${monthLabelLong(mKey)}.</div>`; return; }
  const cor = i=>ONDE_VAI_CORES[i % ONDE_VAI_CORES.length];
  el.innerHTML = `
    <div class="ov-total"><span>Sai no mês ${varia(total, totalAntes)}</span><b>${fmtMoney(total)}</b></div>
    <div class="ov-barra">${dados.map((d, i)=>`<i style="flex:${d.v};background:${cor(i)}" title="${escBanco(d.nome)}"></i>`).join('')}</div>
    <div class="ov-lista">${dados.map((d, i)=>`
      <div class="ov-linha${d.nome === 'Pix e débito' ? ' ov-clica' : ''}"${d.nome === 'Pix e débito' ? ` onclick="abrirLancamentos('${mKey}')"` : ''}><span class="ov-ponto" style="background:${cor(i)}"></span><span class="ov-nome">${escBanco(d.nome)} ${varia(d.v, antes[d.nome])}</span><span class="ov-pct">${Math.round(d.v/total*100)}%</span><span class="ov-valor">${fmtMoney(d.v)}</span><i class="ov-barrinha"><i style="width:${Math.max(2, Math.round(d.v/total*100))}%;background:${cor(i)}"></i></i></div>${(d.sub||[]).map(([n,v,env])=>`
      <div class="ov-linha ov-sub"><span></span><span class="ov-nome">${escBanco(n)} ${varia(v, antes[d.nome + '|' + n])}${env ? ` <small>de ${fmtMoney(env)} reservados</small>` : ''}</span><span class="ov-pct"></span><span class="ov-valor">${fmtMoney(v)}</span></div>`).join('')}`).join('')}
    </div>
    ${u === 'davi' && (state.cartoesTracker||[]).length ? `<div class="sf-nota">Dica: no microfone do saldo, fale “no cartão: mercado 120, farmácia 45” e as compras entram aqui por categoria.</div>` : ''}`;
}

/* lista das compras faladas no Pix/débito de um mês (toque em "Pix e débito" no gráfico) */
function abrirLancamentos(mKey){
  const u = userDash();
  const lista = (state.lancamentos||[]).filter(la=>la.mKey === mKey && (la.usuario || 'davi') === u).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  const total = lista.reduce((s,la)=>s + (Number(la.valor)||0), 0);
  document.getElementById('resumoDetalheTopo').innerHTML = `<div class="rd-rotulo">Pix e débito · ${monthLabelLong(mKey)}</div><div class="rd-total neg">${fmtMoney(total)}</div>`;
  document.getElementById('resumoDetalheLista').innerHTML = lista.length ? lista.map(la=>`
    <div class="gm-linha">${la.data ? gmCal(Number(String(la.data).split('-')[2]) || '?') : `<span class="gm-inicial">${escBanco((la.categoria||'?').charAt(0))}</span>`}
      <div class="gm-info"><div class="gm-nome">${escBanco(la.descricao)}</div><div class="gm-sub">${escBanco(la.categoria||'Outros')}${la.banco ? ' · ' + escBanco(la.banco) : ''} · ${String(la.data||'').split('-').reverse().slice(0,2).join('/')}</div></div>
      <div class="gm-valor">${fmtMoney(la.valor)}</div>
      <button type="button" class="ico-btn" title="Excluir" aria-label="Excluir" onclick="excluirLancamento('${la.id}','${mKey}')">${ICO(ICO_D.lixo, 16)}</button>
    </div>`).join('') : `<div class="gm-vazio">Nenhuma compra falada no Pix/débito neste mês.</div>`;
  document.getElementById('modalResumoDetalhe').dataset.modo = 'lancamentos';
  document.getElementById('modalResumoDetalhe').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function excluirLancamento(id, mKey){
  comDesfazer('Compra excluída (o saldo do banco não muda)', ()=>{
    state.lancamentos = (state.lancamentos||[]).filter(la=>la.id !== id);
    persist(); abrirLancamentos(mKey);
  }, ()=>{ if(document.getElementById('modalResumoDetalhe').dataset.modo === 'lancamentos') abrirLancamentos(mKey); });
}
/* ================= EXTRATO (v14.8): cada compra que entrou no app, pela DATA DA COMPRA (a que foi dita no Assistente),
   não pelo dia em que foi lançada. Cartão à vista, cartão parcelado e Pix/débito; abas Tudo · Cartão · Pix e débito ================= */
let extMes = null, extFiltro = 'tudo', extEditando = false, extVisiveis = [];
function extratoItens(){
  const out = [], u = state.currentUser;
  const dataDe = (iso, ts)=>iso || (ts ? calISO(new Date(ts)) : '');
  if(u === 'davi') (state.cartoesTracker || []).forEach(c=>{
    (c.credoVista || []).forEach(cv=>{
      if(cv.ajuste) return;
      out.push({ ref: { t: 'cv', c: c.id, id: cv.id }, data: dataDe(cv.data, Number(cv.criadoEm) || atzTsDoId(cv.id, 'cv')), tipo: 'cartao', desc: cv.descricao || 'Compra', cat: cv.categoria || 'Outros', onde: c.nome, valor: Number(cv.valor) || 0, logo: c.logoUrl });
    });
  });
  if(u === 'davi') (state.comprasTracker || []).forEach(cp=>{
    const c = (state.cartoesTracker || []).find(x=>x.id === cp.cartaoId);
    const n = Number(cp.parcelas) || 1, total = Number(cp.valorTotal) || 0;
    out.push({ ref: { t: 'cp', id: cp.id }, data: dataDe(cp.data, Number(cp.criadoEm) || atzTsDoId(cp.id, 'cp')), tipo: 'cartao', parc: true, desc: cp.nome || 'Compra', cat: n > 1 ? `${n}x de ${fmtMoney(total / n)}` : 'Parcelada', onde: c ? c.nome : 'Cartão', valor: total, logo: c && c.logoUrl });
  });
  (state.lancamentos || []).filter(la=>(la.usuario || 'davi') === u).forEach(la=>{
    out.push({ ref: { t: 'la', id: la.id }, data: dataDe(la.data, atzTsDoId(la.id, 'la')), tipo: 'pix', desc: la.descricao || 'Compra', cat: la.categoria || 'Outros', onde: la.banco || 'Pix/débito', valor: Number(la.valor) || 0 });
  });
  return out.filter(x=>x.data).sort((a, b)=>b.data.localeCompare(a.data));
}
function abrirExtrato(){
  extMes = extMes || calISO(new Date()).slice(0, 7);
  document.getElementById('pageExtrato').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderExtrato();
}
function fecharExtrato(){ document.getElementById('pageExtrato').classList.remove('active'); document.body.style.overflow = ''; }
function extratoMes(d){ extMes = addMonths(extMes, d); renderExtrato(); }
function extratoFiltro(f){ extFiltro = f; renderExtrato(); }
function renderExtrato(){
  document.getElementById('extMesLabel').textContent = monthLabelLong(extMes);
  document.querySelectorAll('#extAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.f === extFiltro));
  const doMes = extratoItens().filter(x=>x.data.slice(0, 7) === extMes);
  const itens = extFiltro === 'tudo' ? doMes : doMes.filter(x=>x.tipo === extFiltro);
  extVisiveis = itens;
  document.getElementById('pageExtrato').classList.toggle('editando', extEditando);
  const be = document.getElementById('extEditarBtn'); if(be){ be.classList.toggle('on', extEditando); be.textContent = extEditando ? 'Pronto' : 'Editar'; }
  const soma = t=>doMes.filter(x=>x.tipo === t).reduce((s, x)=>s + x.valor, 0);
  const total = itens.reduce((s, x)=>s + x.valor, 0);
  document.getElementById('extTotal').innerHTML = `<span class="placa-lbl" style="margin-top:0">${extFiltro === 'tudo' ? 'Gasto no mês' : extFiltro === 'cartao' ? 'No cartão' : 'No Pix e débito'}</span>
    <b class="ext-total">${fmtMoney(total)}</b>
    <div class="ext-partes"><span>Cartão <b>${fmtMoney(soma('cartao'))}</b></span><span>Pix e débito <b>${fmtMoney(soma('pix'))}</b></span><span>${itens.length} compra${itens.length === 1 ? '' : 's'}</span></div>`;
  /* vazio com caminho: lançar pelo Assistente ou olhar o mês anterior */
  if(!itens.length){
    const mesAntes = monthLabelLong(addMonths(extMes, -1)).split(' ')[0].toLowerCase();
    document.getElementById('extLista').innerHTML = `<div class="ext-vazio">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>
      <p>Nenhuma compra em ${monthLabelLong(extMes).toLowerCase()}${extFiltro === 'tudo' ? '' : ' nesta aba'}.</p>
      <div class="ext-vazio-acoes"><button type="button" class="btn" onclick="fecharExtrato(); abrirAtualizar()">Lançar gasto</button><button type="button" class="btn btn-outline" onclick="extratoMes(-1)">Ver ${mesAntes}</button></div>
    </div>`;
    return;
  }
  /* um grupo por dia, do mais novo para o mais antigo */
  const dias = {};
  itens.forEach(x=>{ (dias[x.data] = dias[x.data] || []).push(x); });
  const semana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  document.getElementById('extLista').innerHTML = Object.keys(dias).sort().reverse().map(d=>{
    const dt = calParse(d), lista = dias[d];
    return `<div class="ext-dia"><div class="ext-dia-topo">${gmCal(dt.getDate())}<span class="ext-dia-txt"><b>${dt.getDate()} de ${MES_NOMES_LONGOS[dt.getMonth()].toLowerCase()}</b><small>${semana[dt.getDay()]}</small></span><em>${fmtMoney(lista.reduce((s, x)=>s + x.valor, 0))}</em></div>
      ${lista.map(x=>{
        /* ícone do que foi comprado (o mesmo do Assistente: carrinho, cápsula, prato…) + selinho de como pagou;
           sem categoria conhecida, tenta pelo nome da compra */
        const catIco = typeof atzIcoCategoria === 'function' && atzIcoCategoria(x.cat) === ATZ_ICO_OUTROS ? x.desc : x.cat;
        const ico = typeof atzIcoItem === 'function' ? atzIcoItem({ tipo: x.parc ? 'parcelada' : x.tipo === 'pix' ? 'pix' : 'vista', categoria: catIco }, 17) : '';
        const como = x.tipo === 'pix' ? `<em class="ext-como pix">Pix/débito</em> ${escBanco(x.onde)}` : `<em class="ext-como">Cartão</em> ${escBanco(x.onde)}`;
        const cat = x.cat && x.cat !== 'Outros' && semAcentoCore(x.cat) !== semAcentoCore(x.desc) ? ' · ' + escBanco(x.cat) : '';
        return `<div class="ext-linha"${extEditando ? ` role="button" tabindex="0" onclick="extratoEditar(${extVisiveis.indexOf(x)})"` : ''}>${ico}<span class="ext-info"><b>${escBanco(x.desc)}</b><small>${como}${cat}</small></span><span class="ext-valor">${fmtMoney(x.valor)}</span></div>`;
      }).join('')}</div>`;
  }).join('');
}
/* ---------- editar pelo Extrato (v15.1): "Editar" no alto liga o modo; tocar numa compra abre a janela ----------
   Muda a compra de verdade (à vista do cartão, parcelada ou Pix/débito). O saldo do banco não muda (como ao apagar um lançamento). */
function extratoRedesenhar(){ renderExtrato(); renderPlanner(); renderPanorama(); }
function extratoModoEditar(){ extEditando = !extEditando; renderExtrato(); if(extEditando) showToast('Toque numa compra para editar'); }
function extratoAchar(ref){
  if(ref.t === 'cv'){ const c = (state.cartoesTracker || []).find(x=>x.id === ref.c); return { c, o: c && (c.credoVista || []).find(x=>x.id === ref.id) }; }
  if(ref.t === 'cp') return { o: (state.comprasTracker || []).find(x=>x.id === ref.id) };
  return { o: (state.lancamentos || []).find(x=>x.id === ref.id) };
}
function extratoEditar(k){
  const x = extVisiveis[k]; if(!x || !x.ref) return;
  const { o } = extratoAchar(x.ref); if(!o) return;
  const parc = x.ref.t === 'cp';
  const nome = parc ? o.nome : o.descricao, valor = parc ? o.valorTotal : o.valor;
  const cats = typeof vozCategoriasCartao === 'function' ? vozCategoriasCartao() : [];
  const catAtual = o.categoria || 'Outros';
  if(!parc && !cats.includes(catAtual)) cats.unshift(catAtual);
  document.getElementById('extEditJanela')?.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay active'; ov.id = 'extEditJanela';
  ov.onclick = e=>{ if(e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="modal"><div class="modal-header"><h3>Editar compra</h3>
      <button class="modal-close" aria-label="Fechar" onclick="document.getElementById('extEditJanela').remove()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg></button></div>
    <div class="ext-edit-onde">${x.tipo === 'pix' ? 'Pix/débito' : parc ? 'Cartão parcelado' : 'Cartão'} · ${escBanco(x.onde)}</div>
    <div class="field"><label>Nome</label><input type="text" id="extEdNome" value="${escBanco(nome || '')}"></div>
    <div class="field"><label>${parc ? 'Valor total' : 'Valor'}</label><div class="input-money"><span>R$</span><input type="text" inputmode="numeric" id="extEdValor" value="${(Number(valor) || 0).toFixed(2).replace('.', ',')}" oninput="maskMoneyInput(this)"></div></div>
    ${parc ? `<div class="field"><label>Parcelas</label><input type="number" min="1" max="48" id="extEdParc" value="${Number(o.parcelas) || 1}"></div>`
      : `<div class="field"><label>Categoria</label><select id="extEdCat">${cats.map(c=>`<option${c === catAtual ? ' selected' : ''}>${escBanco(c)}</option>`).join('')}</select></div>`}
    <div class="field"><label>Data da compra</label><input type="date" id="extEdData" value="${x.data || ''}"></div>
    <div class="modal-actions">
      <button class="btn btn-outline btn-block ext-apagar" onclick="extratoApagar(${k})">Apagar</button>
      <button class="btn btn-block" onclick="extratoSalvar(${k})">Salvar</button>
    </div></div>`;
  document.body.appendChild(ov);
  if(typeof melhorarCampoData === 'function') melhorarCampoData(ov.querySelector('#extEdData'));
  const selCat = ov.querySelector('#extEdCat'); if(selCat && typeof melhorarSelect === 'function') try{ melhorarSelect(selCat); }catch(e){}
}
function extratoSalvar(k){
  const x = extVisiveis[k]; if(!x) return;
  const ov = document.getElementById('extEditJanela');
  const nome = ov.querySelector('#extEdNome').value.trim() || 'Compra';
  const valor = parseMoney(ov.querySelector('#extEdValor').value);
  const data = ov.querySelector('#extEdData').value || x.data;
  if(!(valor > 0)){ showToast('Coloque o valor'); return; }
  const cat = ov.querySelector('#extEdCat') ? ov.querySelector('#extEdCat').value : null;
  const parcelas = ov.querySelector('#extEdParc') ? Math.max(1, parseInt(ov.querySelector('#extEdParc').value, 10) || 1) : null;
  comDesfazer('Compra editada', ()=>{
    const { c, o } = extratoAchar(x.ref); if(!o) return;
    if(x.ref.t === 'cp'){
      Object.assign(o, { nome, valorTotal: valor, parcelas, data });
    } else {
      Object.assign(o, { descricao: nome, valor, categoria: cat, data });
      /* à vista: a data decide a fatura (mesma regra do Assistente: depois do fechamento vai para a fatura seguinte) */
      if(x.ref.t === 'cv' && c && data !== x.data && typeof atzFaturaDaData === 'function') o.mKey = atzFaturaDaData(c, data);
    }
    persist();
  }, extratoRedesenhar);
  ov.remove();
  extratoRedesenhar();
}
async function extratoApagar(k){
  const x = extVisiveis[k]; if(!x) return;
  if(!(await iosConfirm(`Apagar "${x.desc}" (${fmtMoney(x.valor)})?${x.tipo === 'pix' ? ' O saldo do banco não muda.' : ''}`))) return;
  comDesfazer('Compra apagada', ()=>{
    if(x.ref.t === 'cv'){ const c = (state.cartoesTracker || []).find(y=>y.id === x.ref.c); if(c) c.credoVista = (c.credoVista || []).filter(y=>y.id !== x.ref.id); }
    else if(x.ref.t === 'cp') state.comprasTracker = (state.comprasTracker || []).filter(y=>y.id !== x.ref.id);
    else state.lancamentos = (state.lancamentos || []).filter(y=>y.id !== x.ref.id);
    persist();
  }, extratoRedesenhar);
  document.getElementById('extEditJanela')?.remove();
  extratoRedesenhar();
}

/* ================= FOCO (v15.6): tocar num bloco de Finanças abre só aquilo — Fixos, Pix no mês, Crédito à vista, Parcelado —
   com a soma e a quantidade no alto (mesmo visual do Extrato) ================= */
/* focoDesloc: meses para trás/frente com as setas (cartão: a partir da fatura aberta de cada um) */
let focoTipo = null, focoMes = null, focoDesloc = 0;
function abrirFoco(tipo, mKey){
  focoTipo = tipo; focoMes = mKey || mesFinanceiroAtual(); focoDesloc = 0;
  document.getElementById('pageFoco').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderFoco();
}
function focoMudarMes(d){ focoDesloc += d; renderFoco(); }
function fecharFoco(){ document.getElementById('pageFoco').classList.remove('active'); document.body.style.overflow = ''; }
/* v15.7 (layout L2 escolhido): uma coluna por grupo; a placa tem a barra de quanto cada grupo pesa (L4);
   no Fixos, em cada coluna as em aberto vêm primeiro e as pagas ficam separadas embaixo (L5) */
const FOCO_CORES = ['#9fc1e6', '#8fa3b8', '#9fb08a', '#b98a7a', '#9a8fb0', '#c9d3e2'];
function focoLinha(ico, nome, sub, valor, extra){
  return `<div class="foco-linha">${ico}<span class="foco-meio"><span class="foco-l1"><b>${escBanco(nome)}</b><span class="foco-val">${fmtMoney(valor)}</span></span><span class="foco-l2"><small>${sub}</small>${extra ? `<small class="foco-extra">${extra}</small>` : ''}</span></span></div>`;
}
const focoIco = (tipo, cat)=>typeof atzIcoItem === 'function' ? atzIcoItem({ tipo, categoria: cat }, 17) : '';
function focoData(iso){ return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
/* junta itens {grupo, valor, html, pago} em colunas; passou de `max` grupos, o resto vira "Outros" */
function focoAgrupar(itens, max){
  const m = {};
  itens.forEach(it=>{ const g = it.grupo || 'Outros'; (m[g] = m[g] || { nome: g, total: 0, itens: [] }); m[g].total += it.valor; m[g].itens.push(it); });
  let grupos = Object.values(m).sort((a, b)=>b.total - a.total);
  if(max && grupos.length > max){
    const resto = grupos.slice(max - 1), outros = { nome: 'Outros', total: 0, itens: [] };
    resto.forEach(g=>{ outros.total += g.total; outros.itens.push(...g.itens); });
    grupos = grupos.slice(0, max - 1).concat(outros);
  }
  return grupos;
}
function renderFoco(){
  const u = state.currentUser, mKey = addMonths(focoMes, focoDesloc), mesCartao = c=>addMonths(faturaAbertaMes(c), focoDesloc);
  const titulo = { pix:'Pix no mês', vista:'Crédito à vista', parcelado:'Parcelado' }[focoTipo] || '';
  document.getElementById('focoTitulo').textContent = titulo;
  document.getElementById('focoMesLabel').textContent = (focoTipo === 'vista' || focoTipo === 'parcelado') && !focoDesloc ? 'Fatura aberta' : monthLabelLong(focoTipo === 'vista' || focoTipo === 'parcelado' ? addMonths(mesFinanceiroAtual(), focoDesloc) : mKey);
  let rotulo = '', total = 0, stats = [], grupos = [];
  if(focoTipo === 'pix'){
    const itens = (state.lancamentos || []).filter(la=>la.mKey === mKey && (la.usuario || 'davi') === u).sort((a, b)=>String(b.data || '').localeCompare(String(a.data || '')));
    total = itens.reduce((s, la)=>s + (Number(la.valor) || 0), 0);
    rotulo = 'Pix e débito em ' + monthLabelLong(mKey).toLowerCase();
    stats = [['', `${itens.length} compra${itens.length === 1 ? '' : 's'}`]];
    grupos = focoAgrupar(itens.map(la=>({ grupo: la.categoria, valor: Number(la.valor) || 0,
      html: focoLinha(focoIco('pix', la.categoria || la.descricao), la.descricao || 'Compra', `${escBanco(la.banco || 'Pix/débito')}${la.data ? ' · ' + focoData(la.data) : ''}`, Number(la.valor) || 0) })), 6);
  } else if(focoTipo === 'vista'){
    const itens = [];
    (state.cartoesTracker || []).forEach(c=>{ const m = mesCartao(c); (c.credoVista || []).filter(cv=>cv.mKey === m && !cv.ajuste).forEach(cv=>itens.push({ ...cv, cartao: c.nome, m })); });
    itens.sort((a, b)=>String(b.data || '').localeCompare(String(a.data || '')));
    total = itens.reduce((s, cv)=>s + (Number(cv.valor) || 0), 0);
    rotulo = focoDesloc ? 'Na fatura de ' + monthLabelLong(addMonths(mesFinanceiroAtual(), focoDesloc)).toLowerCase() : 'Na fatura aberta';
    const cartoes = new Set(itens.map(cv=>cv.cartao)).size;
    stats = [['', `${itens.length} compra${itens.length === 1 ? '' : 's'}`], ...(cartoes > 1 ? [['', `${cartoes} cartões`]] : [])];
    grupos = focoAgrupar(itens.map(cv=>({ grupo: cv.categoria, valor: Number(cv.valor) || 0,
      html: focoLinha(focoIco('vista', cv.categoria || cv.descricao), cv.descricao || 'Compra', `${escBanco(cv.cartao)} · fatura ${monthLabel(cv.m)}${cv.data ? ' · ' + focoData(cv.data) : ''}`, Number(cv.valor) || 0) })), 6);
  } else if(focoTipo === 'parcelado'){
    const itens = [];
    (state.cartoesTracker || []).forEach(c=>{
      const m = mesCartao(c);
      (state.comprasTracker || []).filter(x=>x.cartaoId === c.id && !x.pago && x.mesInicio).forEach(x=>{
        const v = compraTrackerValorNoMes(x, m); if(!v) return;
        const n = Math.max(1, Number(x.parcelas) || 1); let k = 1; while(k < n && addMonths(x.mesInicio, k - 1) !== m) k++;
        itens.push({ nome: x.nome || 'Compra', cartao: c.nome, k, n, v, falta: v * (n - k), total: Number(x.valorTotal) || v * n });
      });
    });
    itens.sort((a, b)=>(a.n - a.k) - (b.n - b.k));
    total = itens.reduce((s, x)=>s + x.v, 0);
    const resta = itens.reduce((s, x)=>s + x.falta, 0);
    rotulo = 'Parcelas desta fatura';
    stats = [['Faltam depois desta', fmtMoney(resta), 'foco-latao'], ['', `${itens.length} compra${itens.length === 1 ? '' : 's'}`]];
    grupos = focoAgrupar(itens.map(x=>({ grupo: 'Cartão ' + x.cartao, valor: x.v,
      html: focoLinha(focoIco('parcelada'), x.nome, `<b>${x.k} de ${x.n}</b>${x.n - x.k ? ' · faltam ' + (x.n - x.k) : ' · última'}`, x.v, `de ${fmtMoney(x.total)}`) })));
  }
  document.getElementById('focoPlaca').innerHTML = focoPlacaHtml(rotulo, total, stats, grupos);
  document.getElementById('focoLista').innerHTML = grupos.length ? `<div class="foco-cols">${grupos.map((g, i)=>focoColuna(g, FOCO_CORES[i % FOCO_CORES.length])).join('')}</div>` : '<div class="gm-vazio">Nada aqui neste mês.</div>';
}
function focoPlacaHtml(rotulo, total, stats, grupos){
  const soma = grupos.reduce((s, g)=>s + g.total, 0) || 1;
  const barra = grupos.length > 1 ? `<div class="foco-seg">${grupos.map((g, i)=>`<span style="width:${(g.total / soma * 100).toFixed(2)}%;background:${FOCO_CORES[i % FOCO_CORES.length]}"></span>`).join('')}</div>
    <div class="foco-leg">${grupos.map((g, i)=>`<span><i style="background:${FOCO_CORES[i % FOCO_CORES.length]}"></i>${escBanco(g.nome)} <b>${fmtMoney(g.total)}</b></span>`).join('')}</div>` : '';
  return `<div class="foco-placa-topo"><div class="foco-placa-total"><span class="placa-lbl" style="margin-top:0">${rotulo}</span><b class="ext-total">${fmtMoney(total)}</b></div>
    ${stats.map(([l, v, cls])=>`<div class="foco-stat${l ? '' : ' so'}">${l ? `<span>${l}</span>` : ''}<b class="${cls || ''}">${v}</b></div>`).join('')}</div>${barra}`;
}
function focoColuna(g, cor){
  const abertas = g.itens.filter(it=>!it.pago), pagas = g.itens.filter(it=>it.pago);
  return `<div class="foco-col"><div class="foco-col-topo"><i style="background:${cor}"></i><b>${escBanco(g.nome)}</b><em>${fmtMoney(g.total)}</em></div>
    ${abertas.map(it=>it.html).join('')}${pagas.length && abertas.length ? `<div class="foco-col-sep">Pagas · ${pagas.length}</div>` : ''}${pagas.map(it=>it.html).join('')}</div>`;
}
