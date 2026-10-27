/* Siloé — Falar: microfone e entendimento da fala em Finanças (saiu do planner.js em 27/10/2026, sem mudança) */
/* ================= FALAR (microfone ao lado do "Saldo em conta") =================
   Fala ou escreve: "comprei 50 no mercado no Nubank", "paguei a Celesc pelo Viacredi", "recebi 300 no Inter".
   O app entende (IA do Google se a chave estiver ligada; senão, regras simples), mostra o que vai mudar e só aplica
   ao confirmar: tira/soma no banco (e o Saldo em conta acompanha) e, se for conta do mês, marca como paga. */
let vozRec = null, vozPlano = null;
function vozAbrir(){
  document.getElementById('vozTexto').value = '';
  document.getElementById('vozResultado').innerHTML = '';
  vozPlano = null;
  document.getElementById('modalVoz').classList.add('active');
  document.body.style.overflow = 'hidden';
  vozOuvir();
}
function vozFechar(){ if(vozRec){ try{ vozRec.abort(); }catch(e){} vozRec = null; } closeModal('modalVoz'); }
function vozOuvir(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = document.getElementById('vozMic'), dica = document.getElementById('vozDica'), inp = document.getElementById('vozTexto');
  if(!SR){ dica.textContent = 'Ditado indisponível aqui: escreva abaixo ou use o microfone do teclado.'; inp.focus(); return; }
  if(vozRec){ vozRec.stop(); return; }
  const r = new SR();
  r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1;
  let falou = false;
  r.onresult = e=>{ let t = ''; for(const res of e.results) t += res[0].transcript; inp.value = t.trim(); falou = true; if(typeof jarvisTexto==='function') jarvisTexto(inp.value); };
  r.onerror = e=>{ if(e.error === 'not-allowed' || e.error === 'service-not-allowed') dica.textContent = 'Permita o microfone para falar (ou escreva abaixo).'; };
  r.onend = async ()=>{
    vozRec = null; mic.classList.remove('ouvindo');
    if(falou && inp.value.trim()){
      if(typeof jarvisPensando==='function') jarvisPensando('ENTENDENDO');
      try{ await vozEntender(); }finally{ if(typeof jarvisFechar==='function') jarvisFechar(); }
    } else if(typeof jarvisFechar==='function') jarvisFechar();
  };
  try{
    r.start(); vozRec = r; mic.classList.add('ouvindo'); dica.textContent = 'Ouvindo… fale a compra, a conta paga, o que recebeu ou as compras do cartão.';
    if(typeof jarvisAbrir==='function') jarvisAbrir({ titulo: 'Fale a compra, a conta paga ou o que recebeu', aoParar: ()=>{ try{ r.stop(); }catch(_){ jarvisFechar(); } } });
  }
  catch(e){ dica.textContent = 'Não consegui ligar o microfone: escreva abaixo.'; }
}
/* contas do mês ainda abertas (para "paguei a ...") */
function vozContasAbertas(){
  const mKey = mesFinanceiroAtual(), u = state.currentUser;
  return getContasDoMes(mKey, u).map(it=>{
    const key = mKey+'_'+it.user+'_'+it.cat+'_'+it.id;
    return { key, desc: it.desc || 'Conta', valor: state.paid[key] ? 0 : restanteConta(key, Number(it.valor)||0) };
  }).filter(c=>!state.paid[c.key] && c.valor > 0.004);
}
function vozSemAcento(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
/* sem IA: número + banco citado + palavras-chave */
function vozEntenderSimples(texto, bancos, contas){
  const t = vozSemAcento(texto);
  const m = t.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  let valor = m ? Number(m[1].includes(',') ? m[1].replace(/\./g,'').replace(',','.') : m[1]) : 0;
  const banco = bancos.find(b=>t.includes(vozSemAcento(b.nome)));
  const conta = contas.find(c=>vozSemAcento(c.desc).split(/\s+/).some(p=>p.length > 2 && t.includes(p)));
  let acao = /\b(recebi|caiu|entrou|ganhei|depositaram)\b/.test(t) ? 'recebimento' : 'compra';
  if(/\b(paguei|pagar|pago|quitei)\b/.test(t) && conta) acao = 'pagar_conta';
  if(acao === 'pagar_conta' && !valor) valor = conta.valor;
  const cartao = vozCartoes().find(c=>t.includes(vozSemAcento(c.nome)));
  const numeros = (t.match(/\d+(?:[.,]\d{1,2})?/g) || []).length;
  if(acao !== 'recebimento' && (/\b(cartao|credito)\b/.test(t) || (cartao && (numeros > 1 || !banco)))){
    const c = cartao || (vozCartoes().length === 1 ? vozCartoes()[0] : null);
    return { acao:'cartao', valor:0, banco:'', conta:'', descricao:'', cartao: c ? c.nome : '', itens: vozItensSimples(texto, c) };
  }
  const desc = texto.replace(/\b(comprei|gastei|paguei|recebi)\b/ig, '').replace(/\d+[.,]?\d*\s*(reais|real)?/ig, '').replace(new RegExp(banco ? banco.nome : '$^', 'ig'), '').replace(/\b(no|na|pelo|pela|do|da|de|com|em)\s*$/i, '').replace(/\s+/g,' ').trim();
  return { acao, valor, banco: banco ? banco.nome : '', conta: acao === 'pagar_conta' && conta ? conta.key : '', descricao: desc, categoria: vozAdivinharCategoria(desc) };
}
const VOZ_ESQUEMA = {
  type:'object',
  properties:{
    acao:{ type:'string', enum:['compra','pagar_conta','recebimento','cartao','nada'] },
    valor:{ type:'number', description:'Valor em reais (0 se não falou)' },
    banco:{ type:'string', description:'Nome exato de um banco da lista, ou vazio' },
    conta:{ type:'string', description:'Chave exata de uma conta da lista quando pagou uma conta do mês, ou vazio' },
    descricao:{ type:'string', description:'O que comprou / de onde veio, curto' },
    categoria:{ type:'string', description:'Na compra (Pix/débito): uma categoria exata da lista' },
    cartao:{ type:'string', description:'Nome exato de um cartão da lista quando acao = cartao, ou vazio' },
    itens:{ type:'array', description:'Compras no cartão (acao = cartao); vazio nas outras', items:{ type:'object', properties:{
      descricao:{ type:'string' }, valor:{ type:'number' }, categoria:{ type:'string', description:'Uma categoria exata da lista' }
    }, required:['descricao','valor','categoria'] } }
  },
  required:['acao','valor','banco','conta','descricao','categoria','cartao','itens']
};
/* --- compras no cartão ditadas de uma vez ("no Nubank: mercado 120, farmácia 45") → crédito à vista do mês da fatura --- */
const VOZ_CATEGORIA_PALAVRAS = [
  ['Mercado', /mercado|supermerc|atacad|feira|hortifruti|acougue/],
  ['Farmácia', /farmacia|remedio|drogaria/],
  ['Transporte', /uber|99|gasolina|combustivel|posto|onibus|estacionamento|pedagio|oficina/],
  ['Alimentação', /lanche|restaurante|ifood|padaria|pizza|almoco|jantar|cafe|sorvete|acai|hamburguer|comida/],
  ['Lazer', /cinema|netflix|spotify|show|passeio|jogo|viagem/]
];
function vozCartoes(){ return state.cartoesTracker || []; }
function vozCategoriasCartao(){ return getCategoriasComCustom(CREDOVISTA_CATEGORIAS, 'credoVistaCategoriasCustom'); }
function vozAdivinharCategoria(desc){
  const d = vozSemAcento(desc), cats = vozCategoriasCartao();
  const propria = cats.find(c=>c !== 'Outros' && d.includes(vozSemAcento(c)));
  if(propria) return propria;
  const achou = VOZ_CATEGORIA_PALAVRAS.find(([c, re])=>re.test(d) && cats.includes(c));
  return achou ? achou[0] : 'Outros';
}
/* sem IA: "mercado 120, farmácia 45 e uber 18,50" → itens */
function vozItensSimples(texto, cartao){
  let t = texto;
  if(cartao) t = t.replace(new RegExp(cartao.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
  t = t.replace(/\b(no|na|do|da|pelo|pela)\s+(cart[aã]o|cr[eé]dito)\b/ig, ' ').replace(/\b(cart[aã]o|cr[eé]dito|comprei|gastei|passei|paguei)\b/ig, ' ');
  const itens = [];
  const re = /([^\d,;:]*?)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:reais|real)?/ig;
  let m;
  while((m = re.exec(t))){
    const n = m[2].includes(',') ? Number(m[2].replace(/\./g,'').replace(',','.')) : Number(m[2]);
    const desc = m[1].replace(/^\s*(e|,|no|na|de|do|da|em|com)\s+/i, '').replace(/\s+(no|na|de|do|da|em|com|e)\s*$/i, '').replace(/[:\-–]/g, ' ').replace(/\s+/g, ' ').trim();
    if(n > 0) itens.push({ descricao: desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : 'Compra', valor: n, categoria: vozAdivinharCategoria(desc) });
  }
  return itens;
}
function vozAchaCartao(nome){ const n = vozSemAcento(nome); return n ? vozCartoes().find(c=>vozSemAcento(c.nome) === n) || vozCartoes().find(c=>n.includes(vozSemAcento(c.nome)) || vozSemAcento(c.nome).includes(n)) : null; }
async function vozEntender(){
  const texto = (document.getElementById('vozTexto').value || '').trim();
  const res = document.getElementById('vozResultado');
  if(!texto){ document.getElementById('vozTexto').focus(); return; }
  const bancos = bancosDoUsuario(), contas = vozContasAbertas();
  let p = null;
  if(typeof lviChaveIA === 'function' && lviChaveIA()){
    res.innerHTML = '<div class="voz-carregando">Entendendo…</div>';
    try{
      p = await lviPerguntarIA([{ type:'text', text:
        `Você organiza lançamentos de um app de finanças pessoais (Brasil, reais). A pessoa falou: "${texto}".\n` +
        `Bancos dela: ${JSON.stringify(bancos.map(b=>b.nome))}.\n` +
        `Contas do mês ainda abertas (chave, descrição, valor): ${JSON.stringify(contas.map(c=>[c.key, c.desc, c.valor]))}.\n` +
        `Cartões de crédito dela: ${JSON.stringify(vozCartoes().map(c=>c.nome))}. Categorias das compras no cartão: ${JSON.stringify(vozCategoriasCartao())}.\n` +
        `Regras: "comprei/gastei" = compra; "paguei a <conta da lista>" = pagar_conta (use a chave dela; valor = o falado ou o da conta); "paguei" algo que não está na lista = compra; "recebi/caiu/entrou" = recebimento. ` +
        `Na compra (Pix/débito), escolha a categoria exata da lista de categorias pelo que foi comprado (lanche = Alimentação). ` +
        `Compras no cartão de crédito (falou "cartão"/"crédito", ou citou um cartão da lista com uma ou várias compras) = cartao: ponha cada compra em itens (descrição curta com maiúscula, valor, categoria exata da lista; na dúvida "Outros") e o nome exato do cartão; valor = 0. ` +
        `Valores por extenso viram número ("cinquenta e dois e noventa" = 52.90). Banco só se for citado (nome exato da lista).` }], t=>{ res.innerHTML = `<div class="voz-carregando">${lvEsc(t)}</div>`; }, VOZ_ESQUEMA);
    }catch(e){ p = null; }
  }
  if(!p || p.acao === 'nada' || (p.acao === 'cartao' && !(p.itens||[]).length)) p = vozEntenderSimples(texto, bancos, contas);
  if(p.acao === 'cartao'){
    const cats = vozCategoriasCartao(), c = vozAchaCartao(p.cartao) || (vozCartoes().length === 1 ? vozCartoes()[0] : null);
    vozPlano = { acao:'cartao', cartaoId: c ? c.id : '', valor:0, bancoId:'', conta:'', descricao:'',
      itens: (p.itens||[]).filter(i=>Number(i.valor) > 0).map(i=>({ descricao: String(i.descricao||'Compra').trim(), valor: Math.round(Number(i.valor)*100)/100, categoria: cats.includes(i.categoria) ? i.categoria : vozAdivinharCategoria(i.descricao) })) };
    if(!vozPlano.itens.length) vozPlano.itens.push({ descricao:'', valor:0, categoria:'Outros' });
    vozRenderPlano();
    return;
  }
  if(p.conta && !contas.some(c=>c.key === p.conta)) p.conta = '';
  if(p.acao === 'pagar_conta' && !p.conta) p.acao = 'compra';
  if(p.acao === 'pagar_conta' && !(Number(p.valor) > 0)) p.valor = contas.find(c=>c.key === p.conta).valor;
  const banco = bancos.find(b=>vozSemAcento(b.nome) === vozSemAcento(p.banco));
  const catsV = vozCategoriasCartao();
  vozPlano = { acao: p.acao, valor: Math.round((Number(p.valor)||0)*100)/100, bancoId: banco ? banco.id : (bancos.length === 1 ? bancos[0].id : ''), conta: p.conta || '', descricao: p.descricao || texto,
    categoria: catsV.includes(p.categoria) ? p.categoria : vozAdivinharCategoria(p.descricao || texto) };
  vozRenderPlano();
}
function vozRenderPlano(){
  const res = document.getElementById('vozResultado'); if(!vozPlano) return;
  const bancos = bancosDoUsuario(), contas = vozContasAbertas(), us = state.users[state.currentUser];
  const pl = vozPlano, sinal = pl.acao === 'recebimento' ? 1 : -1;
  const banco = bancos.find(b=>b.id === pl.bancoId);
  const tipos = [['compra','Compra'],['pagar_conta','Conta paga'],['recebimento','Recebi']];
  if(vozCartoes().length) tipos.push(['cartao','Cartão']);
  const abas = `<div class="dash-tabs voz-tipos">${tipos.map(([k,n])=>`<button type="button" class="dash-tab${pl.acao===k?' active':''}" onclick="vozMudar('acao','${k}')">${n}</button>`).join('')}</div>`;
  if(pl.acao === 'cartao'){
    const cats = vozCategoriasCartao();
    res.innerHTML = `
    <div class="voz-plano">
      ${abas}
      <div class="field"><label>Cartão</label><div class="voz-bancos">${vozCartoes().map(c=>`<button type="button" class="dif-chip${c.id===pl.cartaoId?' active':''}" onclick="vozMudar('cartaoId','${c.id}')">${escBanco(c.nome)}</button>`).join('')}</div></div>
      <div class="voz-itens">${pl.itens.map((it, i)=>`
        <div class="voz-item">
          <input type="text" class="voz-item-desc" value="${escBanco(it.descricao)}" placeholder="O que foi" oninput="vozPlano.itens[${i}].descricao=this.value">
          <div class="input-money voz-item-valor"><input type="text" inputmode="numeric" value="${it.valor ? it.valor.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') : ''}" oninput="maskMoneyInput(this);vozPlano.itens[${i}].valor=parseMoney(this.value);vozAtualizarResumo()"></div>
          <select class="voz-item-cat" onchange="vozPlano.itens[${i}].categoria=this.value">${cats.map(c=>`<option${c===it.categoria?' selected':''}>${escBanco(c)}</option>`).join('')}</select>
          <button type="button" class="btn-icon-sm" aria-label="Tirar" onclick="vozItemTirar(${i})">${ICON_TRASH}</button>
        </div>`).join('')}
      </div>
      <button type="button" class="link-btn-sm" onclick="vozItemNovo()">+ Outra compra</button>
      <div class="voz-resumo" id="vozResumo">${vozResumoHtml()}</div>
      <button type="button" class="btn btn-block" onclick="vozConfirmar()">Confirmar</button>
    </div>`;
    return;
  }
  res.innerHTML = `
    <div class="voz-plano">
      ${abas}
      ${pl.acao === 'pagar_conta' ? `<div class="field"><label>Conta</label><select onchange="vozMudar('conta', this.value)"><option value="">Escolha a conta</option>${contas.map(c=>`<option value="${c.key}"${c.key===pl.conta?' selected':''}>${escBanco(c.desc)} · ${fmtMoney(c.valor)}</option>`).join('')}</select></div>` : `<div class="field"><label>${pl.acao==='recebimento'?'De onde veio':'O que foi'}</label><input type="text" value="${escBanco(pl.descricao)}" oninput="vozPlano.descricao=this.value"></div>`}
      ${pl.acao === 'compra' ? `<div class="field"><label>Categoria</label><select onchange="vozPlano.categoria=this.value">${vozCategoriasCartao().map(c=>`<option${c===pl.categoria?' selected':''}>${escBanco(c)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label>Valor</label><div class="input-money"><input type="text" inputmode="numeric" value="${pl.valor ? pl.valor.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') : ''}" oninput="maskMoneyInput(this);vozPlano.valor=parseMoney(this.value);vozAtualizarResumo()"></div></div>
      ${bancos.length ? `<div class="field"><label>Banco</label><div class="voz-bancos">${bancos.map(b=>`<button type="button" class="dif-chip${b.id===pl.bancoId?' active':''}" onclick="vozMudar('bancoId','${b.id}')">${escBanco(b.nome)}</button>`).join('')}</div></div>` : ''}
      <div class="voz-resumo" id="vozResumo">${vozResumoHtml()}</div>
      <button type="button" class="btn btn-block" onclick="vozConfirmar()">Confirmar</button>
    </div>`;
}
function vozResumoHtml(){
  const pl = vozPlano, us = state.users[state.currentUser], sinal = pl.acao === 'recebimento' ? 1 : -1;
  if(pl.acao === 'cartao'){
    const c = vozCartoes().find(x=>x.id === pl.cartaoId);
    const total = pl.itens.reduce((s,i)=>s + (Number(i.valor)||0), 0);
    if(!c) return `<div class="voz-aviso">Escolha o cartão</div>`;
    const mKey = faturaAbertaMes(c);
    return `<div><span>${pl.itens.length} ${pl.itens.length === 1 ? 'compra' : 'compras'} à vista</span><b>${fmtMoney(total)}</b></div>
      <div><span>Fatura de ${monthLabel(mKey)} · ${escBanco(c.nome)}</span><b>${fmtMoney(faturaCartaoNoMes(c, mKey))} → ${fmtMoney(faturaCartaoNoMes(c, mKey) + total)}</b></div>`;
  }
  const banco = bancosDoUsuario().find(b=>b.id === pl.bancoId);
  const linhas = [];
  if(banco) linhas.push(`<div><span>${escBanco(banco.nome)}</span><b>${fmtMoney(banco.valor)} → ${fmtMoney((Number(banco.valor)||0) + sinal*pl.valor)}</b></div>`);
  const total = banco ? totalBancos(bancosDoUsuario()) : (us.saldoAtual||0);
  linhas.push(`<div><span>Saldo em conta</span><b>${fmtMoney(total)} → ${fmtMoney(total + sinal*pl.valor)}</b></div>`);
  if(pl.acao === 'pagar_conta' && pl.conta){ const c = vozContasAbertas().find(x=>x.key === pl.conta); if(c) linhas.push(`<div><span>${escBanco(c.desc)}</span><b>marca como paga</b></div>`); }
  if(bancosDoUsuario().length && !banco) linhas.push(`<div class="voz-aviso">Escolha o banco</div>`);
  return linhas.join('');
}
function vozAtualizarResumo(){ const el = document.getElementById('vozResumo'); if(el) el.innerHTML = vozResumoHtml(); }
function vozMudar(campo, v){
  const antes = vozPlano.acao;
  vozPlano[campo] = v;
  if(campo === 'conta'){ const c = vozContasAbertas().find(x=>x.key === v); if(c) vozPlano.valor = c.valor; }
  if(campo === 'acao' && v === 'cartao' && antes !== 'cartao'){
    if(!vozPlano.itens || !vozPlano.itens.length) vozPlano.itens = [{ descricao: vozPlano.descricao || '', valor: vozPlano.valor || 0, categoria: vozPlano.categoria || vozAdivinharCategoria(vozPlano.descricao) }];
    if(!vozPlano.cartaoId && vozCartoes().length === 1) vozPlano.cartaoId = vozCartoes()[0].id;
  }
  if(campo === 'acao' && antes === 'cartao' && v !== 'cartao' && vozPlano.itens && vozPlano.itens.length){
    vozPlano.descricao = vozPlano.itens.map(i=>i.descricao).filter(Boolean).join(', ');
    vozPlano.valor = Math.round(vozPlano.itens.reduce((s,i)=>s + (Number(i.valor)||0), 0)*100)/100;
    vozPlano.categoria = vozPlano.itens[0].categoria || 'Outros';
    if(!vozPlano.bancoId && bancosDoUsuario().length === 1) vozPlano.bancoId = bancosDoUsuario()[0].id;
  }
  vozRenderPlano();
}
function vozItemNovo(){ vozPlano.itens.push({ descricao:'', valor:0, categoria:'Outros' }); vozRenderPlano(); const d = document.querySelectorAll('.voz-item-desc'); if(d.length) d[d.length-1].focus(); }
function vozItemTirar(i){ vozPlano.itens.splice(i, 1); if(!vozPlano.itens.length) vozPlano.itens.push({ descricao:'', valor:0, categoria:'Outros' }); vozRenderPlano(); }
function vozConfirmarCartao(){
  const pl = vozPlano, c = vozCartoes().find(x=>x.id === pl.cartaoId);
  if(!c){ showToast('Escolha o cartão'); return; }
  const itens = pl.itens.filter(i=>Number(i.valor) > 0);
  if(!itens.length){ showToast('Diga ou digite o valor'); return; }
  const mKey = faturaAbertaMes(c), agora = Date.now();
  if(!c.credoVista) c.credoVista = [];
  itens.forEach((i, n)=>c.credoVista.push({ id:'cv'+agora+'_'+n, descricao: String(i.descricao||'').trim() || 'Crédito à vista', valor: Math.round(Number(i.valor)*100)/100, categoria: i.categoria || 'Outros', mKey, criadoEm: agora }));
  const total = itens.reduce((s,i)=>s + Number(i.valor), 0);
  persist();
  vozFechar();
  renderPlanner(); renderPanorama();
  showToast(`${itens.length} ${itens.length === 1 ? 'compra' : 'compras'} no ${c.nome} · ${fmtMoney(total)} na fatura de ${monthLabel(mKey)}`);
}
function vozConfirmar(){
  const pl = vozPlano; if(!pl) return;
  if(pl.acao === 'cartao') return vozConfirmarCartao();
  if(!(pl.valor > 0)){ showToast('Diga ou digite o valor'); return; }
  const bancos = bancosDoUsuario(), us = state.users[state.currentUser];
  if(bancos.length && !pl.bancoId){ showToast('Escolha o banco'); return; }
  if(pl.acao === 'pagar_conta' && !pl.conta){ showToast('Escolha a conta'); return; }
  const sinal = pl.acao === 'recebimento' ? 1 : -1;
  const banco = bancos.find(b=>b.id === pl.bancoId);
  if(banco){ banco.valor = Math.round(((Number(banco.valor)||0) + sinal*pl.valor)*100)/100; us.saldoAtual = totalBancos(bancos); }
  else us.saldoAtual = Math.round(((us.saldoAtual||0) + sinal*pl.valor)*100)/100;
  if(pl.acao === 'pagar_conta'){ state.paid[pl.conta] = true; if(state.pagamentosParciais) delete state.pagamentosParciais[pl.conta]; }
  /* compra no Pix/débito fica registrada (com categoria) para aparecer em "Para onde vai o dinheiro" */
  if(pl.acao === 'compra'){
    if(!state.lancamentos) state.lancamentos = [];
    state.lancamentos.push({ id:'la'+Date.now(), mKey: mesFinanceiroAtual(), data: calISO(new Date()), descricao: String(pl.descricao||'').trim() || 'Compra', valor: pl.valor, categoria: pl.categoria || 'Outros', banco: banco ? banco.nome : '', usuario: state.currentUser });
  }
  persist();
  vozFechar();
  renderPlanner(); renderPanorama();
  showToast(`${pl.acao==='recebimento'?'+':'−'} ${fmtMoney(pl.valor)}${banco?' · '+banco.nome:''} · saldo ${fmtMoney(us.saldoAtual)}`);
}


