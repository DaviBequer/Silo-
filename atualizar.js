/* ================= ATUALIZAR (Finanças): resumão + conversa com a IA =================
   Botão "Atualizar" (1º atalho, no lugar de Falar e Pagar) → tela cheia com duas abas:
   - Resumo: última atualização, contas a pagar, cartões (fatura aberta: à vista / parcelas / assinaturas), bancos,
     histórico de gastos (cartão à vista, parcelado, Pix/débito) e "Onde cortar?" (a IA lê o histórico).
   - Conversa: fala ou escreve em texto corrido ("fatura do Nubank está 1.850; no Nubank à vista mercado 120…;
     no Pix do Inter padaria 18; paguei a luz; saldo do Inter 2.300"). A IA monta a lista do que vai entrar, pergunta
     quando tem dúvida e diz quanto falta para bater a fatura/saldo. Nada é gravado até "Gravar tudo" (com Desfazer).
   Itens: vista | parcelada | pix | recebi | conta | saldo | fatura (fatura e saldo são o valor que a pessoa viu no banco). */
let atzAba = 'resumo', atzConversa = [], atzItens = [], atzOcupado = false, atzRec = null, atzNaoIdent = {}, atzCortar = null;

function abrirAtualizar(aba){
  atzAba = aba || 'resumo';
  document.getElementById('pageAtualizar').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderAtualizar();
}
function fecharAtualizar(){
  if(atzRec){ try{ atzRec.abort(); }catch(e){} atzRec = null; }
  document.getElementById('pageAtualizar').classList.remove('active');
  document.body.style.overflow = '';
}
function atzTrocarAba(a){ atzAba = a; renderAtualizar(); }
function renderAtualizar(){
  document.querySelectorAll('#atzAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.aba === atzAba));
  document.getElementById('atzResumo').style.display = atzAba === 'resumo' ? '' : 'none';
  document.getElementById('atzConversa').style.display = atzAba === 'conversa' ? '' : 'none';
  const n = atzItens.length;
  document.getElementById('atzAbaConversaN').textContent = n ? n : '';
  if(atzAba === 'resumo') atzRenderResumo(); else atzRenderConversa();
}

/* ---------- datas ---------- */
const ATZ_DIAS = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
function atzQuandoTexto(ts){
  const d = new Date(ts), hoje = new Date(); hoje.setHours(0,0,0,0);
  const dia = new Date(d); dia.setHours(0,0,0,0);
  const dias = Math.round((hoje - dia) / 864e5);
  const hora = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `${ATZ_DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  return { texto: `${quando} às ${hora}`, dias };
}
/* última vez que algo foi lançado: a gravação do Atualizar ou o lançamento mais novo (cartão/Pix) */
function atzUltimaAtualizacao(){
  let ult = Number(state.ultimaAtualizacao) || 0;
  atzHistorico().slice(0, 1).forEach(h=>{ if(h.quando > ult) ult = h.quando; });
  return ult;
}

/* ---------- histórico de gastos (como o extrato do banco) ---------- */
function atzTsDoId(id, prefixo){ const n = Number(String(id || '').slice(prefixo.length).split('_')[0]); return n > 1e12 ? n : 0; }
function atzHistorico(){
  const out = [], u = state.currentUser;
  (state.cartoesTracker || []).forEach(c=>(c.credoVista || []).forEach(cv=>{
    const quando = Number(cv.criadoEm) || atzTsDoId(cv.id, 'cv');
    out.push({ quando, tipo:'vista', onde: c.nome, desc: cv.descricao || 'Compra', valor: Number(cv.valor) || 0, cat: cv.categoria || 'Outros', mKey: cv.mKey });
  }));
  (state.comprasTracker || []).forEach(cp=>{
    const c = (state.cartoesTracker || []).find(x=>x.id === cp.cartaoId);
    const quando = Number(cp.criadoEm) || atzTsDoId(cp.id, 'cp');
    out.push({ quando, tipo:'parcelada', onde: c ? c.nome : 'Cartão', desc: cp.nome || 'Compra', valor: Number(cp.valorTotal) || 0, parcelas: Number(cp.parcelas) || 1, cat: 'Parcelada', mKey: cp.mesInicio });
  });
  (state.lancamentos || []).filter(la=>(la.usuario || 'davi') === u).forEach(la=>{
    const quando = atzTsDoId(la.id, 'la') || (calParse(la.data) || new Date(0)).getTime();
    out.push({ quando, tipo:'pix', onde: la.banco || 'Pix/débito', desc: la.descricao || 'Compra', valor: Number(la.valor) || 0, cat: la.categoria || 'Outros', mKey: la.mKey });
  });
  return out.filter(h=>h.quando).sort((a, b)=>b.quando - a.quando);
}
const ATZ_TIPO_NOME = { vista:'Cartão à vista', parcelada:'Cartão parcelado', pix:'Pix/débito' };

/* ---------- aba Resumo ---------- */
function atzRenderResumo(){
  const el = document.getElementById('atzResumo');
  const ult = atzUltimaAtualizacao(), q = ult ? atzQuandoTexto(ult) : null;
  const contas = vozContasAbertas(), totalContas = contas.reduce((s, c)=>s + c.valor, 0);
  const bancos = bancosDoUsuario(), hist = atzHistorico();
  const cartoes = (state.cartoesTracker || []).map(c=>{
    const m = faturaAbertaMes(c);
    const vista = (c.credoVista || []).filter(cv=>cv.mKey === m).reduce((s, cv)=>s + (Number(cv.valor) || 0), 0);
    const parcelas = (state.comprasTracker || []).filter(cp=>cp.cartaoId === c.id).reduce((s, cp)=>s + compraTrackerValorNoMes(cp, m), 0);
    const assin = (c.assinaturas || []).reduce((s, a)=>s + assinaturaValorNoMes(a, m), 0);
    return { c, m, total: faturaCartaoNoMes(c, m), vista, parcelas, assin };
  });
  el.innerHTML = `
    <div class="atz-ultima${q && q.dias >= ATZ_DIAS_AVISO ? ' velha' : ''}">
      <span>Última atualização</span><b>${q ? q.texto : 'ainda não atualizou por aqui'}</b>
      ${q && q.dias >= ATZ_DIAS_AVISO ? `<small>Faz ${q.dias} dias: fale o que gastou desde então</small>` : ''}
    </div>

    <div class="atz-sec"><span>Contas a pagar</span>${contas.length ? `<b>${fmtMoney(totalContas)}</b>` : ''}</div>
    ${contas.length ? `<div class="atz-lista">${contas.map(c=>`<div class="atz-linha"><span>${escBanco(c.desc)}</span><b>${fmtMoney(c.valor)}</b></div>`).join('')}</div>
      <button type="button" class="link-txt atz-mais" onclick="abrirContasPagar()">Marcar contas pagas</button>`
      : '<div class="atz-vazio">Tudo pago neste mês.</div>'}

    <div class="atz-sec"><span>Cartões</span><small>fatura aberta</small></div>
    ${cartoes.length ? cartoes.map(x=>`
      <div class="atz-cartao">
        <div class="atz-cartao-topo"><b>${escBanco(x.c.nome)}</b><small>${monthLabel(x.m)}</small><b class="atz-valor">${fmtMoney(x.total)}</b>
          <button type="button" class="ico-btn" title="Conferir com a fatura em PDF" aria-label="Conferir com a fatura em PDF" onclick="fpdfEscolher('${x.c.id}')">${ICO(ICO_D.baixar, 18)}</button></div>
        <div class="atz-cartao-partes"><span>à vista ${fmtMoney(x.vista)}</span><span>parcelas ${fmtMoney(x.parcelas)}</span>${x.assin ? `<span>assinaturas ${fmtMoney(x.assin)}</span>` : ''}</div>
      </div>`).join('') : '<div class="atz-vazio">Nenhum cartão cadastrado.</div>'}

    <div class="atz-sec"><span>Bancos</span>${bancos.length ? `<b>${fmtMoney(totalBancos(bancos))}</b>` : ''}</div>
    ${bancos.length ? `<div class="atz-lista">${bancos.map(b=>`<div class="atz-linha"><span>${escBanco(b.nome)}</span><b>${fmtMoney(b.valor)}</b></div>`).join('')}</div>` : '<div class="atz-vazio">Nenhum banco cadastrado.</div>'}

    <div class="atz-sec"><span>Histórico de gastos</span><small>${hist.length} lançamentos</small></div>
    ${hist.length ? `<div class="atz-hist">${hist.slice(0, atzHistMostrar).map((h, i)=>{
      const q2 = atzQuandoTexto(h.quando);
      return `<div class="atz-hist-item${i === 0 ? ' ultima' : ''}">
        <div><b>${escBanco(h.desc)}</b><small>${ATZ_TIPO_NOME[h.tipo]} · ${escBanco(h.onde)}${h.tipo === 'parcelada' ? ` · ${h.parcelas}x` : ''}${h.tipo !== 'parcelada' ? ' · ' + escBanco(h.cat) : ''} · ${q2.texto}</small></div>
        <b class="atz-valor">${fmtMoney(h.valor)}</b>
      </div>`; }).join('')}</div>
      ${hist.length > atzHistMostrar ? `<button type="button" class="link-txt atz-mais" onclick="atzHistMostrar+=30;atzRenderResumo()">Ver mais</button>` : ''}`
      : '<div class="atz-vazio">Ainda não há gastos lançados. Toque no microfone e fale o que gastou.</div>'}

    <div class="atz-sec"><span>Onde cortar?</span><button type="button" class="link-txt" onclick="atzOndeCortar()">${atzCortar ? 'Analisar de novo' : 'Analisar com a IA'}</button></div>
    <div id="atzCortar">${atzCortarHtml()}</div>`;
}
let atzHistMostrar = 30;
const ATZ_DIAS_AVISO = 5;

/* ---------- "Onde cortar?": a IA lê os gastos dos últimos 3 meses ---------- */
const ATZ_CORTAR_ESQUEMA = { type:'object', properties:{
  resumo:{ type:'string', description:'2 ou 3 frases simples sobre para onde está indo o dinheiro' },
  dicas:{ type:'array', items:{ type:'object', properties:{
    titulo:{ type:'string' }, detalhe:{ type:'string', description:'com os números (R$) que mostram o problema' }, economia:{ type:'number', description:'quanto daria para guardar por mês, em reais' }
  }, required:['titulo','detalhe','economia'] } }
}, required:['resumo','dicas'] };
async function atzOndeCortar(){
  if(typeof lviChaveIA !== 'function' || !lviChaveIA()){ showToast('Precisa da chave da IA (Ajustes → Recursos)'); return; }
  const el = document.getElementById('atzCortar');
  const desde = addMonths(mesFinanceiroAtual(), -2);
  const gastos = atzHistorico().filter(h=>h.mKey && h.mKey >= desde).map(h=>({ mes: h.mKey, tipo: ATZ_TIPO_NOME[h.tipo], onde: h.onde, o_que: h.desc, valor: h.valor, categoria: h.cat, parcelas: h.parcelas || 1 }));
  if(!gastos.length){ el.innerHTML = '<div class="atz-vazio">Ainda não há gastos suficientes. Lance alguns pelo microfone primeiro.</div>'; return; }
  el.innerHTML = '<div class="voz-carregando">Lendo os seus gastos…</div>';
  try{
    atzCortar = await lviPerguntarIA([{ type:'text', text:
      `Você ajuda uma família brasileira a cortar gastos. Mês atual: ${mesFinanceiroAtual()}. Abaixo os gastos lançados nos últimos 3 meses (cartão à vista, parcelado e Pix/débito).\n` +
      `Compare os meses, ache as categorias que mais cresceram, gastos pequenos que se repetem (padaria, lanche, Uber, delivery…) e compras parceladas que pesam. ` +
      `Dê até 5 dicas práticas, cada uma com os números que mostram o problema e quanto daria para guardar por mês. Português do Brasil, linguagem simples, sem julgar.\n` +
      JSON.stringify(gastos) }], t=>{ el.innerHTML = `<div class="voz-carregando">${lvEsc(t)}</div>`; }, ATZ_CORTAR_ESQUEMA);
    atzRenderResumo();
  }catch(e){ el.innerHTML = `<div class="drive-linha erro">${lvEsc(String(e && e.message || e))}</div>`; }
}
function atzCortarHtml(){
  if(!atzCortar) return '<div class="atz-vazio">A IA lê o histórico e mostra o que mais pesa e quanto dá para guardar.</div>';
  const total = (atzCortar.dicas || []).reduce((s, d)=>s + (Number(d.economia) || 0), 0);
  return `<div class="atz-cortar"><p>${lvEsc(atzCortar.resumo || '')}</p>
    ${(atzCortar.dicas || []).map(d=>`<div class="atz-dica"><b>${lvEsc(d.titulo)}</b><small>${lvEsc(d.detalhe)}</small>${d.economia > 0 ? `<em>guarda ${fmtMoney(d.economia)}/mês</em>` : ''}</div>`).join('')}
    ${total > 0 ? `<div class="atz-linha atz-total"><span>Dá para guardar por mês</span><b>${fmtMoney(total)}</b></div>` : ''}</div>`;
}

/* ---------- aba Conversa ---------- */
const ATZ_ESQUEMA = { type:'object', properties:{
  resposta:{ type:'string', description:'O que dizer para a pessoa: curto, em português. Confirme o que entendeu, diga quanto falta para bater a fatura/saldo e PERGUNTE o que estiver faltando (banco, cartão, parcelas, se é desta fatura ou da próxima).' },
  itens:{ type:'array', description:'A lista COMPLETA e atualizada do que vai ser lançado (inclua os itens anteriores que continuam valendo, com as correções que a pessoa pediu)', items:{ type:'object', properties:{
    tipo:{ type:'string', enum:['vista','parcelada','pix','recebi','conta','saldo','fatura'] },
    descricao:{ type:'string', description:'o que foi, curto, com maiúscula (vazio em saldo e fatura)' },
    valor:{ type:'number', description:'em reais. Parcelada: o valor TOTAL da compra ("2x de 150" = 300). Saldo/fatura: o valor que a pessoa viu no banco' },
    categoria:{ type:'string', description:'uma categoria exata da lista (vista e pix); vazio nos outros' },
    cartao:{ type:'string', description:'nome exato de um cartão da lista (vista, parcelada, fatura); vazio nos outros' },
    banco:{ type:'string', description:'nome exato de um banco da lista (pix, recebi, saldo; conta se disse de onde pagou); vazio se não sabe' },
    parcelas:{ type:'integer', description:'número de parcelas (parcelada); 1 nos outros' },
    proximaFatura:{ type:'boolean', description:'true se a compra no cartão cai só na próxima fatura' },
    conta:{ type:'string', description:'chave exata da conta da lista (tipo conta); vazio nos outros' }
  }, required:['tipo','descricao','valor','categoria','cartao','banco','parcelas','proximaFatura','conta'] } }
}, required:['resposta','itens'] };

/* o que a lista muda em cada cartão e banco (para a IA e para a tela) */
function atzConferencia(itens){
  itens = itens || atzItens;
  const cartoes = (state.cartoesTracker || []).map(c=>{
    const m = faturaAbertaMes(c), noApp = faturaCartaoNoMes(c, m);
    const meus = itens.filter(i=>i.cartaoId === c.id);
    const novos = meus.filter(i=>!i.proximaFatura && (i.tipo === 'vista' || i.tipo === 'parcelada'))
      .reduce((s, i)=>s + (i.tipo === 'parcelada' ? i.valor / Math.max(1, i.parcelas || 1) : i.valor), 0);
    const inf = meus.filter(i=>i.tipo === 'fatura').pop();
    const informado = inf ? inf.valor : null;
    return { c, m, noApp, novos, informado, falta: informado === null ? null : Math.round((informado - noApp - novos) * 100) / 100 };
  });
  const bancos = bancosDoUsuario().map(b=>{
    const meus = itens.filter(i=>i.bancoId === b.id);
    const sai = meus.filter(i=>i.tipo === 'pix' || i.tipo === 'conta').reduce((s, i)=>s + i.valor, 0);
    const entra = meus.filter(i=>i.tipo === 'recebi').reduce((s, i)=>s + i.valor, 0);
    const esperado = Math.round(((Number(b.valor) || 0) - sai + entra) * 100) / 100;
    const inf = meus.filter(i=>i.tipo === 'saldo').pop();
    const informado = inf ? inf.valor : null;
    return { b, esperado, informado, dif: informado === null ? null : Math.round((informado - esperado) * 100) / 100 };
  });
  return { cartoes, bancos };
}
function atzContexto(){
  const conf = atzConferencia();
  return {
    hoje: calISO(new Date()),
    bancos: bancosDoUsuario().map(b=>({ nome: b.nome, saldoNoApp: Number(b.valor) || 0 })),
    cartoes: conf.cartoes.map(x=>({ nome: x.c.nome, faturaAberta: monthLabel(x.m), faturaNoApp: Math.round(x.noApp * 100) / 100, novosNestaConversa: Math.round(x.novos * 100) / 100, faturaInformada: x.informado, faltaParaBater: x.falta })),
    conferenciaDosBancos: conf.bancos.filter(x=>x.informado !== null).map(x=>({ banco: x.b.nome, saldoEsperado: x.esperado, saldoInformado: x.informado, diferenca: x.dif })),
    contasAbertas: vozContasAbertas().map(c=>({ chave: c.key, conta: c.desc, valor: c.valor })),
    categorias: vozCategoriasCartao(),
    ultimosLancamentos: atzHistorico().slice(0, 6).map(h=>`${ATZ_TIPO_NOME[h.tipo]} · ${h.onde} · ${h.desc} · ${h.valor}`)
  };
}
function atzItensParaIA(){
  return atzItens.map(i=>({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, categoria: i.categoria || '', cartao: i.cartaoNome || '', banco: i.bancoNome || '', parcelas: i.parcelas || 1, proximaFatura: !!i.proximaFatura, conta: i.conta || '' }));
}
/* resposta da IA → itens do app (nomes viram ids; o que não se encaixa fica marcado para a pessoa ver) */
function atzNormalizarItens(lista){
  const bancos = bancosDoUsuario(), contas = vozContasAbertas(), cats = vozCategoriasCartao();
  return (lista || []).filter(i=>i && ATZ_TIPOS[i.tipo] && Number(i.valor) > 0).map(i=>{
    const c = ['vista','parcelada','fatura'].includes(i.tipo) ? (vozAchaCartao(i.cartao) || (vozCartoes().length === 1 ? vozCartoes()[0] : null)) : null;
    const b = bancos.find(x=>vozSemAcento(x.nome) === vozSemAcento(i.banco)) || bancos.find(x=>i.banco && vozSemAcento(i.banco).includes(vozSemAcento(x.nome)))
      || (['pix','recebi','saldo'].includes(i.tipo) && bancos.length === 1 ? bancos[0] : null);
    const conta = i.tipo === 'conta' ? contas.find(x=>x.key === i.conta) : null;
    return {
      tipo: i.tipo, descricao: String(i.descricao || '').trim() || (conta ? conta.desc : ''), valor: Math.round(Number(i.valor) * 100) / 100,
      categoria: ['vista','pix'].includes(i.tipo) ? (cats.includes(i.categoria) ? i.categoria : vozAdivinharCategoria(i.descricao)) : '',
      cartaoId: c ? c.id : '', cartaoNome: c ? c.nome : '', bancoId: b ? b.id : '', bancoNome: b ? b.nome : '',
      parcelas: i.tipo === 'parcelada' ? Math.max(2, Math.min(48, parseInt(i.parcelas) || 2)) : 1,
      proximaFatura: !!i.proximaFatura && ['vista','parcelada'].includes(i.tipo), conta: conta ? conta.key : ''
    };
  });
}
const ATZ_TIPOS = { vista:'Cartão à vista', parcelada:'Cartão parcelado', pix:'Pix/débito', recebi:'Recebi', conta:'Conta paga', saldo:'Saldo no banco', fatura:'Fatura no banco' };
/* o que ainda falta para o item poder ser gravado */
function atzFaltaNoItem(i){
  if(['vista','parcelada','fatura'].includes(i.tipo) && !i.cartaoId) return 'qual cartão?';
  if(['pix','recebi','saldo'].includes(i.tipo) && !i.bancoId && bancosDoUsuario().length) return 'qual banco?';
  if(i.tipo === 'conta' && !i.conta) return 'qual conta?';
  return '';
}

async function atzEnviar(texto){
  texto = String(texto || '').trim();
  if(!texto || atzOcupado) return;
  if(typeof lviChaveIA !== 'function' || !lviChaveIA()){ showToast('A conversa usa a IA: ligue a chave em Ajustes → Recursos'); return; }
  document.getElementById('atzTexto').value = '';
  atzConversa.push({ quem:'eu', texto });
  atzAba = 'conversa'; renderAtualizar();
  atzOcupado = true; atzRenderConversa('Entendendo…');
  try{
    const historico = atzConversa.slice(-16).map(m=>(m.quem === 'eu' ? 'Pessoa: ' : 'Você: ') + m.texto).join('\n');
    const r = await lviPerguntarIA([{ type:'text', text:
      `Você é o assistente de finanças do app Siloé (Brasil, reais). A pessoa está atualizando os gastos falando em texto corrido, numa conversa com você.\n` +
      `Tipos de item: vista (compra no cartão de crédito à vista), parcelada (compra no cartão em N vezes; valor = TOTAL), pix (compra no Pix ou débito, com o banco), ` +
      `recebi (dinheiro que entrou num banco), conta (pagou uma conta da lista contasAbertas: use a chave), saldo (o saldo que a pessoa viu no banco: "o Inter está 2.300"), ` +
      `fatura (o total que a pessoa viu na fatura aberta do cartão: "a fatura do Nubank está 1.850").\n` +
      `Regras: "no Pix do Nubank"/"no débito do Inter" = pix com aquele banco. "No cartão"/"no crédito" = vista, ou parcelada se falou em vezes. ` +
      `"Foi para a próxima fatura" = proximaFatura true. Valores por extenso viram número. Escolha a categoria pelo que foi comprado. ` +
      `Se faltar o banco, o cartão ou o número de parcelas, ou se algo for ambíguo, deixe vazio e PERGUNTE na resposta. ` +
      `NÃO faça contas de quanto falta para bater a fatura ou o saldo: o app calcula e escreve logo depois da sua resposta. ` +
      `Se no contexto faltaParaBater for maior que zero, pode perguntar se há mais compras desse cartão; se a diferença do saldo for negativa, pode perguntar se houve outro gasto nesse banco. ` +
      `A pessoa pode corrigir ou tirar itens ("tira a farmácia", "o mercado foi 130"): devolva sempre a lista completa já corrigida. Não invente itens.\n\n` +
      `CONTEXTO: ${JSON.stringify(atzContexto())}\n\nLISTA ATUAL: ${JSON.stringify(atzItensParaIA())}\n\nCONVERSA:\n${historico}` }],
      t=>atzRenderConversa(t), ATZ_ESQUEMA);
    atzItens = atzNormalizarItens(r.itens);
    /* a conta da falta é do app (a IA erra soma): a resposta ganha as linhas com os números certos */
    const conf = atzConferencia(), contas = [];
    conf.cartoes.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.falta) < 0.01 ? `Fatura ${x.c.nome}: bateu ✓` : x.falta > 0 ? `Fatura ${x.c.nome}: ainda faltam ${fmtMoney(x.falta)} para bater com o banco.` : `Fatura ${x.c.nome}: passou ${fmtMoney(-x.falta)} do valor do banco.`));
    conf.bancos.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.dif) < 0.01 ? `Saldo ${x.b.nome}: bateu ✓` : x.dif < 0 ? `Saldo ${x.b.nome}: ${fmtMoney(-x.dif)} saíram sem ser lançados.` : `Saldo ${x.b.nome}: entrou ${fmtMoney(x.dif)} a mais.`));
    atzConversa.push({ quem:'ia', texto: [String(r.resposta || 'Anotado.').trim(), ...contas].join('\n') });
  }catch(e){
    atzConversa.push({ quem:'ia', texto: 'Não consegui falar com a IA agora (' + ((e && e.message) || 'erro') + '). Tente de novo.', erro: true });
  }
  atzOcupado = false;
  renderAtualizar();
}
function atzRenderConversa(pensando){
  const el = document.getElementById('atzConversa'); if(!el) return;
  const conf = atzConferencia();
  const msgs = atzConversa.map(m=>`<div class="atz-msg ${m.quem}${m.erro ? ' erro' : ''}">${lvEsc(m.texto)}</div>`).join('');
  const contas = vozContasAbertas();
  const grupos = Object.keys(ATZ_TIPOS).map(t=>{
    const itens = atzItens.map((i, k)=>({ i, k })).filter(x=>x.i.tipo === t);
    if(!itens.length) return '';
    return `<div class="atz-grupo"><span>${ATZ_TIPOS[t]}</span>${itens.map(({ i, k })=>{
      const falta = atzFaltaNoItem(i);
      const onde = i.tipo === 'conta' ? '' : [i.cartaoNome || i.bancoNome, i.tipo === 'parcelada' ? i.parcelas + 'x de ' + fmtMoney(i.valor / i.parcelas) : '', i.proximaFatura ? 'próxima fatura' : '', i.categoria].filter(Boolean).join(' · ');
      return `<div class="atz-item${falta ? ' falta' : ''}">
        <div><b>${escBanco(i.descricao || (i.tipo === 'saldo' ? 'Saldo' : i.tipo === 'fatura' ? 'Fatura' : 'Item'))}</b><small>${escBanco(onde)}${falta ? ` <em>${falta}</em>` : ''}</small></div>
        <b class="atz-valor">${fmtMoney(i.valor)}</b>
        <button type="button" class="btn-icon-sm" aria-label="Tirar" title="Tirar" onclick="atzTirarItem(${k})">${CU_ICO.x}</button>
      </div>`; }).join('')}</div>`;
  }).join('');
  /* conferência: fatura e saldo informados contra o app */
  const confFat = conf.cartoes.filter(x=>x.informado !== null).map(x=>`
    <div class="atz-conf${Math.abs(x.falta) < 0.01 ? ' ok' : ''}">
      <b>Fatura ${escBanco(x.c.nome)} · ${monthLabel(x.m)}</b>
      <div class="atz-linha"><span>No app ${fmtMoney(x.noApp)} + novos ${fmtMoney(x.novos)}</span><b>${fmtMoney(x.noApp + x.novos)}</b></div>
      <div class="atz-linha"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>
      <div class="atz-linha atz-total"><span>${Math.abs(x.falta) < 0.01 ? 'Bateu' : x.falta > 0 ? 'Ainda falta lançar' : 'Passou do banco'}</span><b>${Math.abs(x.falta) < 0.01 ? '✓' : fmtMoney(Math.abs(x.falta))}</b></div>
    </div>`).join('');
  const confBan = conf.bancos.filter(x=>x.informado !== null).map(x=>{
    const sumiu = x.dif < -0.009;
    return `<div class="atz-conf${Math.abs(x.dif) < 0.01 ? ' ok' : ''}">
      <b>Saldo ${escBanco(x.b.nome)}</b>
      <div class="atz-linha"><span>Esperado pelo app</span><b>${fmtMoney(x.esperado)}</b></div>
      <div class="atz-linha"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>
      ${Math.abs(x.dif) < 0.01 ? '<div class="atz-linha atz-total"><span>Bateu</span><b>✓</b></div>'
        : sumiu ? `<label class="atz-naoident"><input type="checkbox"${atzNaoIdent[x.b.id] !== false ? ' checked' : ''} onchange="atzNaoIdent['${x.b.id}']=this.checked"><span>${fmtMoney(-x.dif)} saíram sem ser lançados: gravar como "Gasto não identificado"</span></label>`
        : `<div class="atz-linha atz-total"><span>Entrou a mais</span><b>${fmtMoney(x.dif)}</b></div>`}
    </div>`; }).join('');
  const prontos = atzItens.length && !atzItens.some(atzFaltaNoItem);
  el.innerHTML = `
    <div class="atz-msgs">${msgs || `<div class="atz-msg ia">Fale ou escreva tudo de uma vez, em texto corrido. Por exemplo: "a fatura do Nubank está 1.850. No Nubank à vista mercado 120 e farmácia 45; em duas vezes um tênis de 300 que foi para a próxima fatura. No Pix do Inter padaria 18. Paguei a luz. O Inter está com 2.300."</div>`}
      ${pensando ? `<div class="atz-msg ia pensando"><i></i><i></i><i></i><span>${lvEsc(typeof pensando === 'string' ? pensando : '')}</span></div>` : ''}</div>
    ${confFat || confBan ? `<div class="atz-confs">${confFat}${confBan}</div>` : ''}
    ${grupos ? `<div class="atz-sec"><span>Vai entrar</span><small>${atzItens.length} ${atzItens.length === 1 ? 'item' : 'itens'}</small></div>${grupos}
      <div class="atz-acoes"><button type="button" class="link-txt" onclick="atzLimpar()">Começar de novo</button>
        <button type="button" class="btn" ${prontos ? '' : 'disabled'} onclick="atzGravar()">${prontos ? 'Gravar tudo' : 'Falta responder'}</button></div>` : ''}`;
  const m = el.querySelector('.atz-msgs'); if(m) setTimeout(()=>{ const ult = m.lastElementChild; if(ult) ult.scrollIntoView({ block:'nearest', behavior:'smooth' }); }, 30);
}
function atzTirarItem(k){ atzItens.splice(k, 1); renderAtualizar(); }
function atzLimpar(){ atzConversa = []; atzItens = []; atzNaoIdent = {}; renderAtualizar(); }

/* grava tudo de uma vez (com Desfazer). Banco com saldo informado fica com o saldo informado (o Pix dele só entra no histórico);
   nos outros, Pix/conta tiram e "recebi" soma. */
function atzGravar(){
  if(!atzItens.length || atzItens.some(atzFaltaNoItem)) return;
  const conf = atzConferencia(), agora = Date.now(), hoje = calISO(new Date()), mKey = mesFinanceiroAtual();
  const comSaldo = new Set(atzItens.filter(i=>i.tipo === 'saldo').map(i=>i.bancoId));
  const itens = atzItens.slice(), n = itens.length;
  comDesfazer(`${n} ${n === 1 ? 'item gravado' : 'itens gravados'}`, ()=>{
    const bancos = bancosDoUsuario(), us = state.users[state.currentUser];
    const banco = id=>bancos.find(b=>b.id === id);
    const mexe = (id, v)=>{ const b = banco(id); if(b && !comSaldo.has(id)) b.valor = Math.round(((Number(b.valor) || 0) + v) * 100) / 100; };
    if(!state.lancamentos) state.lancamentos = [];
    if(!state.comprasTracker) state.comprasTracker = [];
    itens.forEach((i, k)=>{
      const id = agora + '_' + k;
      if(i.tipo === 'vista'){
        const c = (state.cartoesTracker || []).find(x=>x.id === i.cartaoId); if(!c) return;
        const m = faturaAbertaMes(c);
        if(!c.credoVista) c.credoVista = [];
        c.credoVista.push({ id:'cv' + id, descricao: i.descricao || 'Compra', valor: i.valor, categoria: i.categoria || 'Outros', mKey: i.proximaFatura ? addMonths(m, 1) : m, criadoEm: agora });
      } else if(i.tipo === 'parcelada'){
        const c = (state.cartoesTracker || []).find(x=>x.id === i.cartaoId); if(!c) return;
        const m = faturaAbertaMes(c);
        state.comprasTracker.push({ id:'cp' + id, nome: i.descricao || 'Compra', descricao:'', logoUrl:'', cartaoId: c.id, valorTotal: i.valor, parcelas: i.parcelas, mesInicio: i.proximaFatura ? addMonths(m, 1) : m, criadoEm: agora });
      } else if(i.tipo === 'pix'){
        const b = banco(i.bancoId);
        state.lancamentos.push({ id:'la' + id, mKey, data: hoje, descricao: i.descricao || 'Compra', valor: i.valor, categoria: i.categoria || 'Outros', banco: b ? b.nome : '', usuario: state.currentUser });
        mexe(i.bancoId, -i.valor);
      } else if(i.tipo === 'recebi'){
        mexe(i.bancoId, i.valor);
      } else if(i.tipo === 'conta'){
        state.paid[i.conta] = true;
        if(state.pagamentosParciais) delete state.pagamentosParciais[i.conta];
        if(i.bancoId) mexe(i.bancoId, -i.valor);
      }
    });
    /* saldo informado: vale o do banco; o que sumiu sem lançamento vira "Gasto não identificado" (se a caixinha ficou marcada) */
    conf.bancos.filter(x=>x.informado !== null).forEach(x=>{
      const b = banco(x.b.id); if(!b) return;
      if(x.dif < -0.009 && atzNaoIdent[b.id] !== false)
        state.lancamentos.push({ id:'la' + agora + '_ni_' + b.id, mKey, data: hoje, descricao:'Gasto não identificado', valor: Math.round(-x.dif * 100) / 100, categoria:'Outros', banco: b.nome, usuario: state.currentUser });
      b.valor = x.informado;
    });
    if(bancos.length) us.saldoAtual = totalBancos(bancos);
    state.ultimaAtualizacao = agora;
    persist();
  }, ()=>{ if(document.getElementById('pageAtualizar').classList.contains('active')) renderAtualizar(); });
  atzConversa = []; atzItens = []; atzNaoIdent = {};
  atzAba = 'resumo';
  renderPlanner(); renderPanorama();
  renderAtualizar();
}

/* ---------- microfone: fala corrida (continua ouvindo até tocar de novo) ---------- */
function atzMicrofone(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const inp = document.getElementById('atzTexto'), mic = document.getElementById('atzMic');
  if(!SR){ showToast('Ditado indisponível aqui: use o microfone do teclado'); inp.focus(); return; }
  if(atzRec){ atzRec.stop(); return; }
  const r = new SR();
  r.lang = 'pt-BR'; r.interimResults = true; r.continuous = true;
  const antes = inp.value.trim() ? inp.value.trim() + ' ' : '';
  r.onresult = e=>{ let t = ''; for(const res of e.results) t += res[0].transcript; inp.value = antes + t.trim(); };
  r.onerror = e=>{ if(e.error === 'not-allowed' || e.error === 'service-not-allowed') showToast('Permita o microfone (ou escreva)'); };
  r.onend = ()=>{ atzRec = null; mic.classList.remove('ouvindo'); if(inp.value.trim()) atzEnviar(inp.value); };
  try{ r.start(); atzRec = r; mic.classList.add('ouvindo'); }catch(e){ showToast('Não consegui ligar o microfone: escreva'); }
}
