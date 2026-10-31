/* ================= ASSISTENTE (Finanças): conversa com a IA + resumão =================
   Botão "Assistente" (1º atalho) → tela cheia com duas abas:
   - Conversa (abre nela): fala (o áudio vai direto para a IA, sem o ditado do navegador) ou escreve em texto corrido
     ("120 no Top no crédito; no Pix do Inter padaria 18; paguei a luz; saldo do Inter 2.300"). A IA monta os itens
     dentro das respostas; cada item tem um ✓ para a pessoa confirmar, e "Gravar" grava só os confirmados (com Desfazer).
     A faixa grafite mostra o total; "Detalhes" (escondido por padrão) mostra quanto falta em cada cartão, o saldo antes
     e depois de cada banco e as contas em aberto.
   - Resumo: última atualização, contas a pagar, cartões, bancos, histórico de gastos e "Onde cortar?".
   Categorias: a IA usa os nomes que a pessoa já lançou e os "apelidos" (state.iaApelidos: "top" → Mercado), aprendidos
   quando a pessoa troca a categoria de um item ou diz "Top é mercado". Lista em Ajustes → Recursos.
   Itens: vista | parcelada | pix | recebi | conta | saldo | fatura (fatura e saldo são o valor que a pessoa viu no banco). */
let atzAba = 'conversa', atzConversa = [], atzItens = [], atzOcupado = false, atzCortar = null;
let atzDetalhes = (()=>{ try{ return localStorage.getItem('siloe-atz-detalhes') === '1'; }catch(e){ return false; } })();

function abrirAtualizar(aba){
  atzAba = aba || 'conversa';
  document.getElementById('pageAtualizar').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderAtualizar();
}
function fecharAtualizar(){
  if(atzGrav) atzGravParar(false);
  document.getElementById('pageAtualizar').classList.remove('active');
  document.body.style.overflow = '';
}
function atzTrocarAba(a){ atzAba = a; renderAtualizar(); }
function renderAtualizar(rolar){
  document.querySelectorAll('#atzAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.aba === atzAba));
  document.getElementById('atzResumo').style.display = atzAba === 'resumo' ? '' : 'none';
  document.getElementById('atzConversa').style.display = atzAba === 'resumo' ? 'none' : '';
  const n = atzItens.filter(i=>i.tipo !== 'fatura').length;
  document.getElementById('atzAbaConversaN').textContent = n ? n : '';
  if(atzAba === 'resumo') atzRenderResumo(); else atzRenderConversa(null, rolar);
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
  const totalFaturas = cartoes.reduce((s, x)=>s + x.total, 0);
  const mesAtual = mesFinanceiroAtual();
  const pixMes = (state.lancamentos || []).filter(la=>la.mKey === mesAtual && (la.usuario || 'davi') === state.currentUser).reduce((s, la)=>s + (Number(la.valor) || 0), 0);
  const parte = (v, t)=>t > 0 ? Math.max(0, Math.min(100, v / t * 100)) : 0;
  el.innerHTML = `
    <div class="atz-ultima${q && q.dias >= ATZ_DIAS_AVISO ? ' velha' : ''}">
      <span>Última atualização</span><b>${q ? q.texto : 'ainda não atualizou por aqui'}</b>
      ${q && q.dias >= ATZ_DIAS_AVISO ? `<small>Faz ${q.dias} dias: fale o que gastou desde então</small>` : ''}
    </div>

    <div class="atz-kpis">
      <div class="atz-kpi"><span>Contas a pagar</span><b>${fmtMoney(totalContas)}</b><small>${contas.length ? contas.length + (contas.length === 1 ? ' conta aberta' : ' contas abertas') : 'tudo pago'}</small></div>
      <div class="atz-kpi"><span>Faturas abertas</span><b>${fmtMoney(totalFaturas)}</b><small>${cartoes.length} ${cartoes.length === 1 ? 'cartão' : 'cartões'}</small></div>
      <div class="atz-kpi"><span>Nos bancos</span><b>${fmtMoney(totalBancos(bancos))}</b><small>${bancos.length} ${bancos.length === 1 ? 'banco' : 'bancos'}</small></div>
      <div class="atz-kpi"><span>Pix e débito</span><b>${fmtMoney(pixMes)}</b><small>em ${monthLabel(mesAtual)}</small></div>
    </div>

    <div class="atz-grade">
      <section class="atz-bloco atz-b-contas">
        <div class="atz-sec"><span>Contas a pagar</span>${contas.length ? `<b>${fmtMoney(totalContas)}</b>` : ''}</div>
        ${contas.length ? `<div class="atz-lista">${contas.map(c=>`<div class="atz-linha"><span>${escBanco(c.desc)}</span><b>${fmtMoney(c.valor)}</b></div>`).join('')}</div>
          <button type="button" class="link-txt atz-mais" onclick="abrirContasPagar()">Marcar contas pagas</button>`
          : '<div class="atz-vazio">Tudo pago neste mês.</div>'}
      </section>

      <section class="atz-bloco atz-b-cartoes">
        <div class="atz-sec"><span>Cartões</span><small>fatura aberta</small></div>
        ${cartoes.length ? cartoes.map(x=>`
          <div class="atz-cartao">
            <div class="atz-cartao-topo"><b>${escBanco(x.c.nome)}</b><small>${monthLabel(x.m)}</small><b class="atz-valor">${fmtMoney(x.total)}</b>
              <button type="button" class="ico-btn" title="Conferir com a fatura em PDF" aria-label="Conferir com a fatura em PDF" onclick="fpdfEscolher('${x.c.id}')">${ICO(ICO_D.baixar, 18)}</button></div>
            <div class="atz-cartao-barra" aria-hidden="true"><i style="width:${parte(x.vista, x.total)}%"></i><i style="width:${parte(x.parcelas, x.total)}%"></i><i style="width:${parte(x.assin, x.total)}%"></i></div>
            <div class="atz-cartao-partes"><span><em class="c1"></em>à vista ${fmtMoney(x.vista)}</span><span><em class="c2"></em>parcelas ${fmtMoney(x.parcelas)}</span>${x.assin ? `<span><em class="c3"></em>assinaturas ${fmtMoney(x.assin)}</span>` : ''}</div>
          </div>`).join('') : '<div class="atz-vazio">Nenhum cartão cadastrado.</div>'}
      </section>

      <section class="atz-bloco atz-b-bancos">
        <div class="atz-sec"><span>Bancos</span>${bancos.length ? `<b>${fmtMoney(totalBancos(bancos))}</b>` : ''}</div>
        ${bancos.length ? `<div class="atz-lista">${bancos.map(b=>`<div class="atz-linha"><span>${escBanco(b.nome)}</span><b>${fmtMoney(b.valor)}</b></div>`).join('')}</div>` : '<div class="atz-vazio">Nenhum banco cadastrado.</div>'}
      </section>

      <section class="atz-bloco atz-b-hist">
        <div class="atz-sec"><span>Histórico de gastos</span><small>${hist.length} lançamentos</small></div>
        ${hist.length ? `<div class="atz-hist">${hist.slice(0, atzHistMostrar).map((h, i)=>{
          const q2 = atzQuandoTexto(h.quando);
          return `<div class="atz-hist-item${i === 0 ? ' ultima' : ''}">
            <div><b>${escBanco(h.desc)}</b><small>${ATZ_TIPO_NOME[h.tipo]} · ${escBanco(h.onde)}${h.tipo === 'parcelada' ? ` · ${h.parcelas}x` : ''}${h.tipo !== 'parcelada' ? ' · ' + escBanco(h.cat) : ''} · ${q2.texto}</small></div>
            <b class="atz-valor">${fmtMoney(h.valor)}</b>
          </div>`; }).join('')}</div>
          ${hist.length > atzHistMostrar ? `<button type="button" class="link-txt atz-mais" onclick="atzHistMostrar+=30;atzRenderResumo()">Ver mais</button>` : ''}`
          : '<div class="atz-vazio">Ainda não há gastos lançados. Toque no microfone e fale o que gastou.</div>'}
      </section>

      <section class="atz-bloco atz-b-cortar">
        <div class="atz-sec"><span>Onde cortar?</span><button type="button" class="link-txt" onclick="atzOndeCortar()">${atzCortar ? 'Analisar de novo' : 'Analisar com a IA'}</button></div>
        <div id="atzCortar">${atzCortarHtml()}</div>
      </section>
    </div>`;
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
  transcricao:{ type:'string', description:'Se a última fala veio em ÁUDIO: o que a pessoa disse, escrito certinho (valores em algarismos, nomes de banco/cartão como na lista). Se veio em texto: repita o texto.' },
  resposta:{ type:'string', description:'Curtíssima: só "Anotado." (ou "Corrigido.", "Tirei."). O app mostra tudo na tela: não liste itens nem valores. Só quando faltar algo de verdade (banco ou cartão quando há mais de um, parcelas, valor confuso) faça UMA pergunta curta.' },
  aprendidos:{ type:'array', description:'Quando a pessoa ensinar a categoria de um nome ("Top é mercado", "120 no Top, mercado"): {nome, categoria}. Vazio se não ensinou nada.', items:{ type:'object', properties:{
    nome:{ type:'string' }, categoria:{ type:'string', description:'uma categoria exata da lista' }
  }, required:['nome','categoria'] } },
  itens:{ type:'array', description:'A lista COMPLETA e atualizada do que vai ser lançado (inclua os itens anteriores que continuam valendo, com as correções que a pessoa pediu)', items:{ type:'object', properties:{
    tipo:{ type:'string', enum:['vista','parcelada','pix','recebi','conta','saldo','fatura'] },
    descricao:{ type:'string', description:'o nome que a pessoa falou (a loja ou o que comprou: "Top", "Farmácia"), curto, com maiúscula. NUNCA ponha a categoria no nome: "mercado Top" = descricao "Top" e categoria Mercado; "farmácia Drogasil" = "Drogasil" e Farmácia. Só use a palavra da categoria como nome se for a única coisa dita ("gastei 50 no mercado" = "Mercado"). Vazio em saldo e fatura' },
    valor:{ type:'number', description:'em reais. Parcelada: o valor TOTAL da compra ("2x de 150" = 300). Saldo/fatura: o valor que a pessoa viu no banco' },
    categoria:{ type:'string', description:'uma categoria exata da lista (vista e pix); vazio nos outros' },
    categoriaDuvida:{ type:'boolean', description:'true se você não tem certeza da categoria (nome que não está nos apelidos nem nos já usados e que você não conhece)' },
    cartao:{ type:'string', description:'nome exato de um cartão da lista (vista, parcelada, fatura); vazio nos outros' },
    banco:{ type:'string', description:'nome exato de um banco da lista (pix, recebi, saldo; conta se disse de onde pagou); vazio se não sabe' },
    parcelas:{ type:'integer', description:'número de parcelas (parcelada); 1 nos outros' },
    data:{ type:'string', description:'dia da compra, AAAA-MM-DD. "No dia 25…" vale para essa compra e para as próximas até a pessoa falar outro dia. Dia sem mês = o mais recente que já passou (nunca no futuro). Sem dia falado = hoje' },
    proximaFatura:{ type:'boolean', description:'true SÓ se a pessoa disse que foi para a próxima fatura (o app já decide a fatura pela data e o fechamento do cartão)' },
    conta:{ type:'string', description:'chave exata da conta da lista (tipo conta); vazio nos outros' }
  }, required:['tipo','descricao','valor','categoria','categoriaDuvida','cartao','banco','parcelas','data','proximaFatura','conta'] } }
}, required:['transcricao','resposta','aprendidos','itens'] };

/* o que a lista muda em cada cartão e banco (para a IA e para os Detalhes) */
function atzConferencia(itens){
  itens = itens || atzItens;
  const cartoes = (state.cartoesTracker || []).map(c=>{
    const m = faturaAbertaMes(c), noApp = faturaCartaoNoMes(c, m);
    const meus = itens.filter(i=>i.cartaoId === c.id);
    const novos = meus.filter(i=>(i.tipo === 'vista' || i.tipo === 'parcelada') && atzFaturaDoItem(c, i) === m)
      .reduce((s, i)=>s + (i.tipo === 'parcelada' ? i.valor / Math.max(1, i.parcelas || 1) : i.valor), 0);
    const inf = meus.filter(i=>i.tipo === 'fatura').pop();
    const informado = inf ? inf.valor : null;
    return { c, m, noApp, novos, informado, mexeu: meus.length > 0, falta: informado === null ? null : Math.round((informado - noApp - novos) * 100) / 100 };
  });
  const bancos = bancosDoUsuario().map(b=>{
    const meus = itens.filter(i=>i.bancoId === b.id);
    const sai = meus.filter(i=>i.tipo === 'pix' || i.tipo === 'conta').reduce((s, i)=>s + i.valor, 0);
    const entra = meus.filter(i=>i.tipo === 'recebi').reduce((s, i)=>s + i.valor, 0);
    const esperado = Math.round(((Number(b.valor) || 0) - sai + entra) * 100) / 100;
    const inf = meus.filter(i=>i.tipo === 'saldo').pop();
    const informado = inf ? inf.valor : null;
    return { b, esperado, informado, mexeu: meus.length > 0, dif: informado === null ? null : Math.round((informado - esperado) * 100) / 100 };
  });
  return { cartoes, bancos };
}
/* nome → chave dos apelidos ("Top", "top " → "top") */
function atzChaveNome(nome){ return vozSemAcento(nome).replace(/\s+/g, ' ').trim(); }
function atzContexto(){
  const conf = atzConferencia();
  /* o que a pessoa já lançou e em que categoria (o mais novo vale) */
  const vistos = new Set(), jaUsados = [];
  for(const h of atzHistorico()){
    const k = atzChaveNome(h.desc);
    if(h.tipo === 'parcelada' || !k || vistos.has(k) || /nao identificad/.test(k)) continue;
    vistos.add(k); jaUsados.push(`${h.desc} → ${h.cat}`);
    if(jaUsados.length >= 80) break;
  }
  return {
    hoje: calISO(new Date()), diaDaSemana: ATZ_DIAS[new Date().getDay()],
    bancos: bancosDoUsuario().map(b=>({ nome: b.nome, saldoNoApp: Number(b.valor) || 0 })),
    cartoes: conf.cartoes.map(x=>({ nome: x.c.nome, fechamentoDia: parseInt(x.c.fechamento) || null, vencimentoDia: parseInt(x.c.vencimento) || null, faturaAberta: monthLabel(x.m), faturaNoApp: Math.round(x.noApp * 100) / 100, novosNestaConversa: Math.round(x.novos * 100) / 100, faturaInformada: x.informado, faltaParaBater: x.falta })),
    conferenciaDosBancos: conf.bancos.filter(x=>x.informado !== null).map(x=>({ banco: x.b.nome, saldoEsperado: x.esperado, saldoInformado: x.informado, diferenca: x.dif })),
    contasAbertas: vozContasAbertas().map(c=>({ chave: c.key, conta: c.desc, valor: c.valor })),
    categorias: vozCategoriasCartao(),
    apelidos: Object.values(state.iaApelidos || {}).map(a=>`${a.nome} → ${a.categoria}`),
    nomesJaUsados: jaUsados
  };
}
function atzItensParaIA(){
  return atzItens.map(i=>({ tipo: i.tipo, descricao: i.descricao, valor: i.valor, categoria: i.categoria || '', categoriaDuvida: !!i.duvida, cartao: i.cartaoNome || '', banco: i.bancoNome || '', parcelas: i.parcelas || 1, proximaFatura: !!i.proximaFatura, conta: i.conta || '' }));
}
/* resposta da IA → itens do app (nomes viram ids; o que não se encaixa fica marcado para a pessoa ver).
   Um só cartão (ou um só banco) = usa esse. Apelido aprendido manda na categoria. */
function atzNormalizarItens(lista){
  const bancos = bancosDoUsuario(), contas = vozContasAbertas(), cats = vozCategoriasCartao(), apelidos = state.iaApelidos || {};
  return (lista || []).filter(i=>i && ATZ_TIPOS[i.tipo] && Number(i.valor) > 0).map(i=>{
    const c = ['vista','parcelada','fatura'].includes(i.tipo) ? (vozAchaCartao(i.cartao) || (vozCartoes().length === 1 ? vozCartoes()[0] : null)) : null;
    const b = bancos.find(x=>vozSemAcento(x.nome) === vozSemAcento(i.banco)) || bancos.find(x=>i.banco && vozSemAcento(i.banco).includes(vozSemAcento(x.nome)))
      || (['pix','recebi','saldo'].includes(i.tipo) && bancos.length === 1 ? bancos[0] : null);
    const conta = i.tipo === 'conta' ? contas.find(x=>x.key === i.conta) : null;
    const comCat = ['vista','pix'].includes(i.tipo);
    const nm = comCat ? atzLimparNome(i.descricao, cats) : { nome: String(i.descricao || '').trim(), cat: '' };
    const ap = apelidos[atzChaveNome(nm.nome)], apOk = ap && cats.includes(ap.categoria);
    return {
      tipo: i.tipo, descricao: nm.nome || (conta ? conta.desc : ''), valor: Math.round(Number(i.valor) * 100) / 100,
      categoria: !comCat ? '' : apOk ? ap.categoria : cats.includes(i.categoria) ? i.categoria : nm.cat || vozAdivinharCategoria(nm.nome),
      duvida: comCat && !apOk && (!!i.categoriaDuvida || !cats.includes(i.categoria)),
      cartaoId: c ? c.id : '', cartaoNome: c ? c.nome : '', bancoId: b ? b.id : '', bancoNome: b ? b.nome : '',
      parcelas: i.tipo === 'parcelada' ? Math.max(2, Math.min(48, parseInt(i.parcelas) || 2)) : 1,
      data: atzDataValida(i.data),
      proximaFatura: !!i.proximaFatura && ['vista','parcelada'].includes(i.tipo), conta: conta ? conta.key : '', ok: false
    };
  });
}
/* data da compra: AAAA-MM-DD válida e nunca no futuro (sem data = hoje) */
function atzDataValida(s){
  const hoje = calISO(new Date());
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? calParse(s) : null;
  return d && !isNaN(d) ? (calISO(d) > hoje ? hoje : calISO(d)) : hoje;
}
/* em qual fatura cai uma compra feita no dia: no dia do fechamento ou depois, a fatura daquele mês já fechou → vai para a do mês seguinte
   (mesma regra do faturaAbertaMes). Sem fechamento no cartão: a aberta. */
function atzFaturaDaData(c, iso){
  const fech = parseInt(c && c.fechamento) || 0, d = iso ? calParse(iso) : null;
  if(!fech || !d || isNaN(d)) return faturaAbertaMes(c);
  const m = monthKey(d);
  return d.getDate() >= Math.min(fech, daysInMonth(m)) ? addMonths(m, 1) : m;
}
function atzFaturaDoItem(c, i){
  let m = atzFaturaDaData(c, i.data);
  if(i.proximaFatura && m === faturaAbertaMes(c)) m = addMonths(m, 1);
  return m;
}
/* compra no cartão que não cai na fatura aberta: o item avisa em qual fatura vai */
function atzFaturaOutra(i){
  if(!['vista','parcelada'].includes(i.tipo) || !i.cartaoId) return '';
  const c = vozCartoes().find(x=>x.id === i.cartaoId); if(!c) return '';
  const m = atzFaturaDoItem(c, i), aberta = faturaAbertaMes(c);
  return m === aberta ? '' : `fatura de ${monthLabel(m)}${m < aberta ? ' (já fechou)' : ''}`;
}
const atzDiaCurto = iso=>{ const d = calParse(iso); return d && !isNaN(d) ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : ''; };
/* a categoria nunca fica no nome: "Mercado Top" → "Top" (+ categoria Mercado). Se só sobrou a categoria, ela é o nome. */
const ATZ_NOME_SOBRA = /^(no|na|do|da|de|em|o|a)$/;
function atzLimparNome(desc, cats){
  const palavras = String(desc || '').trim().split(/\s+/).filter(Boolean);
  const chaves = cats.map(c=>[vozSemAcento(c), c]).concat([['supermercado', 'Mercado'], ['mercadinho', 'Mercado']]);
  let cat = '';
  const resto = palavras.filter(p=>{ const n = vozSemAcento(p); const a = chaves.find(([k])=>k === n); if(a && cats.includes(a[1])){ cat = cat || a[1]; return false; } return true; })
    .filter((p, k, arr)=>!(ATZ_NOME_SOBRA.test(vozSemAcento(p)) && (k === 0 || k === arr.length - 1)));
  if(!resto.length) return { nome: palavras.join(' '), cat };
  const nome = resto.join(' ');
  return { nome: nome.charAt(0).toUpperCase() + nome.slice(1), cat };
}
const ATZ_TIPOS = { vista:'Cartão à vista', parcelada:'Cartão parcelado', pix:'Pix/débito', recebi:'Recebi', conta:'Conta paga', saldo:'Saldo no banco', fatura:'Fatura no banco' };
/* o que ainda falta para o item poder ser gravado */
function atzFaltaNoItem(i){
  if(['vista','parcelada','fatura'].includes(i.tipo) && !i.cartaoId) return 'qual cartão?';
  if(['pix','recebi','saldo'].includes(i.tipo) && !i.bancoId && bancosDoUsuario().length) return 'qual banco?';
  if(i.tipo === 'conta' && !i.conta) return 'qual conta?';
  return '';
}
const atzChave = i=>[i.tipo, vozSemAcento(i.descricao), i.valor, i.cartaoId, i.bancoId].join('|');
/* a IA devolve a lista inteira a cada fala: o ✓ e a categoria trocada à mão continuam nos itens que não mudaram */
function atzManterConfirmados(antes, novos){
  const velhos = {};
  antes.forEach(i=>{ (velhos[atzChave(i)] = velhos[atzChave(i)] || []).push(i); });
  novos.forEach(i=>{
    const v = (velhos[atzChave(i)] || []).shift(); if(!v) return;
    i.ok = !!v.ok;
    if(v.catManual){ i.categoria = v.categoria; i.duvida = false; i.catManual = true; }
  });
  return novos;
}
const atzGravavel = i=>i.tipo !== 'fatura';
const atzConfirmado = i=>atzGravavel(i) && i.ok && !atzFaltaNoItem(i);

function atzTemIA(){
  if(typeof lviChaveIA === 'function' && lviChaveIA()) return true;
  showToast('O Assistente usa a IA: ligue a chave em Ajustes → Recursos'); return false;
}
async function atzEnviar(texto){
  texto = String(texto || '').trim();
  if(!texto || atzOcupado || !atzTemIA()) return;
  const inp = document.getElementById('atzTexto'); inp.value = ''; inp.style.height = 'auto';
  const msg = { quem:'eu', texto };
  atzConversa.push(msg);
  await atzPerguntar(msg, null);
}
async function atzEnviarAudio(blob, dur){
  if(atzOcupado || !atzTemIA()) return;
  const msg = { quem:'eu', voz: true, dur, texto:'' };
  atzConversa.push(msg);
  if(atzAba === 'resumo') atzAba = 'conversa'; atzOcupado = true; renderAtualizar(); atzRenderConversa('Ouvindo o áudio…', true);
  let audio;
  try{ audio = await atzAudioParaEnviar(blob); }
  catch(e){
    msg.texto = '(áudio)'; atzOcupado = false;
    atzConversa.push({ quem:'ia', texto:'Não consegui ler o áudio. Tente de novo ou escreva.', erro: true });
    renderAtualizar(true); return;
  }
  atzOcupado = false;
  await atzPerguntar(msg, audio);
}
/* manda a fala (texto ou áudio) com o contexto do app; a IA devolve a lista inteira */
async function atzPerguntar(msg, audio){
  if(atzAba === 'resumo') atzAba = 'conversa'; atzOcupado = true; renderAtualizar(); atzRenderConversa(audio ? 'Ouvindo o áudio…' : 'Entendendo…', true);
  try{
    const historico = atzConversa.filter(m=>m !== msg).slice(-16).map(m=>(m.quem === 'eu' ? 'Pessoa: ' : 'Você: ') + m.texto).join('\n')
      + '\nPessoa: ' + (audio ? '[a fala está no ÁUDIO anexado]' : msg.texto);
    const partes = [{ type:'text', text:
      `Você é o assistente de finanças do app Siloé (Brasil, reais). A pessoa está atualizando os gastos falando em texto corrido, numa conversa com você.\n` +
      (audio ? `A última fala veio em ÁUDIO (anexado): ouça com atenção os valores e os nomes de banco e cartão (estão no contexto) e escreva em transcricao o que ela disse. ` +
        `Escreva SÓ o que dá para ouvir de verdade: se o áudio for silêncio, chiado, música ou barulho sem fala clara, deixe transcricao VAZIA, devolva a LISTA ATUAL sem nenhuma mudança e não invente nada.\n` : '') +
      `Tipos de item: vista (compra no cartão de crédito à vista), parcelada (compra no cartão em N vezes; valor = TOTAL), pix (compra no Pix ou débito, com o banco), ` +
      `recebi (dinheiro que entrou num banco), conta (pagou uma conta da lista contasAbertas: use a chave), saldo (o saldo que a pessoa viu no banco: "o Inter está 2.300"), ` +
      `fatura (o total que a pessoa viu na fatura aberta do cartão: "a fatura do Nubank está 1.850").\n` +
      `Regras: "no Pix do Nubank"/"no débito do Inter" = pix com aquele banco. "No cartão"/"no crédito" = vista, ou parcelada se falou em vezes. ` +
      `"Foi para a próxima fatura" = proximaFatura true. Valores por extenso viram número. ` +
      `DATAS: cada item tem a data da compra. "No dia 25 comprei…" vale para aquela compra e para as seguintes até a pessoa falar outro dia ("já no dia 24…"). "Ontem", "anteontem", "sábado" contam a partir de hoje (no contexto). Sem dia falado = hoje. O app decide em qual fatura cai pela data e pelo fechamento do cartão: não marque proximaFatura por causa da data.
` +
      `CARTÃO E BANCO: se a lista de cartões tem UM só cartão, toda compra no crédito é nele: preencha e NÃO pergunte qual cartão. O mesmo para banco: com um só banco, use ele. ` +
      `Só pergunte o cartão ou o banco quando houver mais de um e a fala não disser qual. Se faltar o número de parcelas ou algo for ambíguo, deixe vazio e PERGUNTE.\n` +
      `CATEGORIA: a descricao é o nome que a pessoa falou ("Top", "JK", "Drogasil"). Para escolher a categoria, veja primeiro "apelidos" (a pessoa ensinou: vale sempre), ` +
      `depois "nomesJaUsados" (o que ela já lançou e em que categoria), depois o que você sabe de lojas do Brasil. Se ainda não tiver certeza, escolha a mais provável e marque categoriaDuvida true. ` +
      `Se a pessoa disser a categoria junto com o nome ("120 no Top, mercado") ou ensinar ("Top é mercado"), use essa categoria e ponha {nome, categoria} em aprendidos.\n` +
      `NÃO faça contas de quanto falta para bater a fatura ou o saldo: o app calcula e escreve logo depois da sua resposta. ` +
      `O app já pergunta o que falta explicar (fatura e saldo): não repita esses valores. Quando a pessoa contar o que gastou para explicar a diferença, lance como pix (banco) ou vista (cartão). ` +
      `Se ela disser que não lembra o resto ("não sei", "o resto não lembro"), lance um pix "Gasto não identificado" (categoria Outros) no banco com o valor que falta (diferenca do contexto, em positivo), ou uma vista "Compra não identificada" no cartão com faltaParaBater. ` +
      `A pessoa pode corrigir ou tirar itens ("tira a farmácia", "o mercado foi 130"): devolva sempre a lista completa já corrigida. Não invente itens.\n\n` +
      (atzAba === 'passo' && atzPassos()[atzPassoI] ? `O APP PERGUNTOU À PESSOA: "${atzPassoPergunta(atzPassos()[atzPassoI])}" (a fala responde isso).
` : '') +
      `CONTEXTO: ${JSON.stringify(atzContexto())}\n\nLISTA ATUAL: ${JSON.stringify(atzItensParaIA())}\n\nCONVERSA:\n${historico}` }];
    if(audio) partes.push({ type:'audio', data: audio.b64, mime_type: audio.mime });
    const r = await lviPerguntarIA(partes, t=>atzRenderConversa(t), ATZ_ESQUEMA, true);
    if(audio) msg.texto = String(r.transcricao || '').trim();
    /* áudio sem fala (barulho, silêncio): a IA às vezes inventa uma frase; sem transcrição nada muda */
    if(audio && !msg.texto){
      msg.texto = '(áudio sem fala)';
      atzConversa.push({ quem:'ia', texto:'Não ouvi nada no áudio. Fale mais perto do microfone ou escreva.' });
      atzOcupado = false; renderAtualizar(true); return;
    }
    const cats = vozCategoriasCartao(), aprendeu = (r.aprendidos || []).filter(a=>a && String(a.nome || '').trim() && cats.includes(a.categoria));
    aprendeu.forEach(a=>atzAprender(a.nome, a.categoria, true));
    if(aprendeu.length) persist();
    const antes = atzItens;
    atzItens = atzManterConfirmados(antes, atzNormalizarItens(r.itens)); atzEditando = -1;
    /* a conta da falta é do app (a IA erra soma): a resposta ganha as linhas com os números certos (aparecem nos Detalhes) */
    const conf = atzConferencia(), contas = [];
    conf.cartoes.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.falta) < 0.01 ? `Fatura ${x.c.nome}: bateu ✓` : x.falta > 0 ? `Fatura ${x.c.nome}: faltam ${fmtMoney(x.falta)} para bater. Que compras faltam?` : `Fatura ${x.c.nome}: passou ${fmtMoney(-x.falta)} do valor do banco. Algum valor ficou errado?`));
    conf.bancos.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.dif) < 0.01 ? `Saldo ${x.b.nome}: bateu ✓` : x.dif < 0 ? `${x.b.nome}: faltam ${fmtMoney(-x.dif)} para fechar o saldo. O que mais saiu dele?` : `Saldo ${x.b.nome}: entrou ${fmtMoney(x.dif)} a mais. Recebeu algum valor?`));
    const ks = new Set(antes.map(atzChave)), kn = new Set(atzItens.map(atzChave));
    atzConversa.push({ quem:'ia', texto: String(r.resposta || 'Anotado.').trim(),
      novos: atzItens.filter(i=>!ks.has(atzChave(i))).map(atzChave), tirados: antes.filter(i=>!kn.has(atzChave(i))), contas,
      aprendeu: aprendeu.map(a=>`${a.nome.trim()} → ${a.categoria}`) });
    if(atzAba === 'passo') atzPassoAvancar(antes);
  }catch(e){
    if(audio && !msg.texto) msg.texto = '(áudio)';
    atzConversa.push({ quem:'ia', texto: 'Não consegui falar com a IA agora (' + ((e && e.message) || 'erro') + '). Tente de novo.', erro: true });
  }
  atzOcupado = false;
  renderAtualizar(true);
}

const ATZ_ICO_OK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ATZ_ICO_MIC = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V21h-2v-3.1A7 7 0 0 1 5 11z"/></svg>';
const atzTempo = s=>Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
/* repetido: o mesmo valor já lançado no mesmo cartão/banco (à vista e Pix: últimos 120 dias; parcelada: último ano),
   ou o mesmo item duas vezes nesta conversa. Atualizando do zero a pessoa fala coisa que já estava no app. */
const ATZ_DUP_DIAS = { vista: 120, pix: 120, parcelada: 365 };
function atzDuplicados(){
  const hist = atzHistorico(), agora = Date.now();
  const dia = ts=>{ const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); };
  const onde = i=>i.tipo === 'pix' ? i.bancoNome : i.cartaoNome;
  return atzItens.map((i, k)=>{
    if(!ATZ_DUP_DIAS[i.tipo] || !onde(i)) return null;
    const antes = atzItens.slice(0, k).find(o=>o.tipo === i.tipo && onde(o) === onde(i) && Math.abs(o.valor - i.valor) < 0.01);
    if(antes) return { curto: 'repetido nesta conversa', texto: `${i.descricao || 'Item'} ${fmtMoney(i.valor)} aparece duas vezes nesta conversa.` };
    const h = hist.find(h=>h.tipo === i.tipo && h.onde === onde(i) && Math.abs(h.valor - i.valor) < 0.01 && agora - h.quando < ATZ_DUP_DIAS[i.tipo] * 864e5);
    if(!h) return null;
    return { curto: `já lançado em ${dia(h.quando)}`, texto: `${i.descricao || 'Item'} ${fmtMoney(i.valor)} parece repetido: já tem "${h.desc}" de ${fmtMoney(h.valor)} no ${h.onde}, lançado em ${dia(h.quando)}. Se for outra compra, confirme.` };
  });
}
/* ícones do Assistente (traço fino, como o resto do app): tipo = como pagou; categoria = o que comprou */
const ATZ_ICO_TIPO = {
  vista:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h3"/>',
  parcelada:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M9 6v12M15 6v12" stroke-dasharray="2 2"/><path d="M3.8 7h4.4v10H3.8z" fill="currentColor" stroke="none" opacity=".35"/>',
  pix: FIN_ICO.pix,
  recebi:'<rect x="2.5" y="6.5" width="19" height="11" rx="2"/><circle cx="12" cy="12" r="2.3"/><path d="M6 10v4M18 10v4"/>',
  conta:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="m9 11 2 2 4-4"/>',
  saldo:'<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18"/>',
  fatura:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'
};
const ATZ_ICO_CAT = [
  [/mercad|supermerc|atacad|feira/, '<path d="M3 4h2l2.2 11h10.6L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/><path d="M9 7.5V5h3v2.5M13.5 7.5V4h3.5v3.5"/>'],
  [/farm|saude|remed|medic|hospital/, '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-40 12 12)"/><path d="m9.3 9.3 5.4 5.4" transform="rotate(5 12 12)"/>'],
  [/combust|gasolin|posto/, '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M4 21h12M7.5 7h5"/><path d="M15 10h1.5a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 0 3 0V8.5L18 6"/>'],
  [/aliment|restaur|lanche|comida|padaria|ifood|delivery/, '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7h3"/>'],
  [/transp|uber|onibus|carro|estacion/, '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v2H3z"/><circle cx="7.5" cy="13" r=".8"/><circle cx="16.5" cy="13" r=".8"/>'],
  [/lazer|cinema|stream|diver/, '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/>'],
  [/roupa|vest|calcad/, '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>'],
  [/casa|morad|aluguel/, '<path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>'],
  [/pet|cachorr|gato|racao|veterin/, '<circle cx="5.5" cy="10" r="1.8"/><circle cx="9.5" cy="5.8" r="1.8"/><circle cx="14.5" cy="5.8" r="1.8"/><circle cx="18.5" cy="10" r="1.8"/><path d="M12 11.5c-2.6 0-5 3.6-5 6 0 1.6 1.2 2.5 2.6 2.5 1 0 1.6-.6 2.4-.6s1.4.6 2.4.6c1.4 0 2.6-.9 2.6-2.5 0-2.4-2.4-6-5-6z"/>'],
  [/multa|taxa|samae|agua|luz|energia|conta|boleto|imposto/, '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>']
];
const ATZ_ICO_OUTROS = '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>';
const atzSvg = (d, t)=>`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
function atzIcoCategoria(cat){ const n = vozSemAcento(cat); const a = ATZ_ICO_CAT.find(([re])=>re.test(n)); return a ? a[1] : ATZ_ICO_OUTROS; }
/* círculo do item: com categoria = o que comprou + selinho de como pagou; sem categoria = o tipo */
function atzIcoItem(i, t){
  const temCat = ['vista','pix'].includes(i.tipo);
  return `<span class="atz-ci">${atzSvg(temCat ? atzIcoCategoria(i.categoria) : ATZ_ICO_TIPO[i.tipo], t || 17)}${temCat ? `<span class="atz-ci-sel">${atzSvg(ATZ_ICO_TIPO[i.tipo], 9)}</span>` : ''}</span>`;
}
/* conferência que aparece sempre (mesmo com Detalhes desligado) quando a pessoa fala a fatura ou o saldo:
   tudo o que já está na fatura do app (à vista, parcelas, assinaturas), o que entra agora e quanto falta para chegar no valor do banco */
function atzFaturaPartes(c, m){
  const vista = (c.credoVista || []).filter(cv=>cv.mKey === m).map(cv=>({ nome: cv.descricao || 'Compra', valor: Number(cv.valor) || 0 }));
  const parcelas = (state.comprasTracker || []).filter(cp=>cp.cartaoId === c.id).map(cp=>{
    const v = compraTrackerValorNoMes(cp, m); if(!(v > 0)) return null;
    let n = 1, mm = cp.mesInicio; while(mm && mm < m && n < 200){ mm = addMonths(mm, 1); n++; }
    return { nome: `${cp.nome || 'Compra'} ${n}/${cp.parcelas}`, valor: v };
  }).filter(Boolean);
  const assin = (c.assinaturas || []).map(a=>({ nome: a.nome || 'Assinatura', valor: assinaturaValorNoMes(a, m) })).filter(a=>a.valor > 0);
  return { vista, parcelas, assin };
}
function atzConferenciasHtml(conf){
  const soma = l=>l.reduce((s, x)=>s + x.valor, 0);
  const lista = l=>l.map(x=>`<div class="atz-linha"><span>${escBanco(x.nome)}</span><b>${fmtMoney(x.valor)}</b></div>`).join('');
  const st = (dif, txtFalta, txtPassou)=>Math.abs(dif) < 0.01 ? '<span class="atz-pill ok">bateu ✓</span>' : dif > 0 ? `<span class="atz-pill err">${txtFalta}</span>` : `<span class="atz-pill err">${txtPassou}</span>`;
  const cartoes = conf.cartoes.filter(x=>x.informado !== null).map(x=>{
    const p = atzFaturaPartes(x.c, x.m), novos = atzItens.filter(i=>i.cartaoId === x.c.id && (i.tipo === 'vista' || i.tipo === 'parcelada') && atzFaturaDoItem(x.c, i) === x.m)
      .map(i=>({ nome: i.descricao + (i.tipo === 'parcelada' ? ` 1/${i.parcelas}` : ''), valor: i.tipo === 'parcelada' ? i.valor / Math.max(1, i.parcelas) : i.valor }));
    const grupo = (rot, l)=>l.length ? `<details class="atz-fat-g"><summary><span>${rot} <small>${l.length}</small></span><b>${fmtMoney(soma(l))}</b></summary>${lista(l)}</details>` : '';
    return `<div class="atz-fat">
      <div class="atz-det-topo"><span>Fatura ${escBanco(x.c.nome)} · ${monthLabel(x.m)}</span>${st(x.falta, 'faltam ' + fmtMoney(x.falta), 'passou ' + fmtMoney(-x.falta))}</div>
      ${grupo('À vista no app', p.vista)}${grupo('Parcelas no app', p.parcelas)}${grupo('Assinaturas', p.assin)}${grupo('Desta conversa', novos)}
      <div class="atz-linha atz-total"><span>Somando tudo</span><b>${fmtMoney(x.noApp + x.novos)}</b></div>
      <div class="atz-linha atz-total"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>
      ${(()=>{ const fora = atzItens.filter(i=>i.cartaoId === x.c.id && (i.tipo === 'vista' || i.tipo === 'parcelada') && atzFaturaDoItem(x.c, i) !== x.m);
        return fora.length ? `<div class="atz-fat-fora">${fora.map(i=>`${escBanco(i.descricao || 'Compra')} ${fmtMoney(i.valor)} vai para a ${escBanco(atzFaturaOutra(i))}`).join('<br>')}: não conta nesta.</div>` : ''; })()}
      ${x.falta > 0.009 ? `<div class="atz-fat-falta">Faltam <b>${fmtMoney(x.falta)}</b> para chegar em ${fmtMoney(x.informado)}. Fale as compras que faltam desse cartão.</div>
        <button type="button" class="link-txt atz-naolembro" onclick="atzSemExplicar('cartao','${x.c.id}')">Não lembro: lançar ${fmtMoney(x.falta)} como compra não identificada</button>`
        : x.falta < -0.009 ? `<div class="atz-fat-falta">O app passou ${fmtMoney(-x.falta)} do valor do banco. Veja se algum item está repetido ou com o valor errado.</div>` : ''}
    </div>`;
  }).join('');
  const bancos = conf.bancos.filter(x=>x.informado !== null).map(x=>`<div class="atz-fat">
      <div class="atz-det-topo"><span>Saldo ${escBanco(x.b.nome)}</span>${st(-x.dif, 'falta explicar ' + fmtMoney(-x.dif), 'entrou ' + fmtMoney(x.dif) + ' a mais')}</div>
      <div class="atz-linha"><span>Esperado pelo app</span><b>${fmtMoney(x.esperado)}</b></div>
      <div class="atz-linha atz-total"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>
      ${x.dif < -0.009 ? `<div class="atz-fat-falta">Saíram <b>${fmtMoney(-x.dif)}</b> que o app não sabe. O que mais você gastou no ${escBanco(x.b.nome)}?</div>
        <button type="button" class="link-txt atz-naolembro" onclick="atzSemExplicar('banco','${x.b.id}')">Não lembro: lançar ${fmtMoney(-x.dif)} como gasto não identificado</button>` : ''}
    </div>`).join('');
  return cartoes || bancos ? `<div class="atz-fats">${cartoes}${bancos}</div>` : '';
}
/* editar um item (toque no nome): nome, valor, categoria, parcelas, cartão ou banco */
const ATZ_ICO_LAPIS = '<svg class="atz-lapis" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
let atzEditando = -1;
function atzEditar(k){
  atzEditando = k; atzRenderConversa();
  const ed = document.querySelector('.atz-ed'), el = document.getElementById('atzEdNome');
  /* o editor vai para o alto da tela antes do teclado abrir */
  if(ed) ed.scrollIntoView({ block:'start' });
  if(el) el.focus({ preventScroll: true });
}
function atzEditorHtml(i, k){
  const opc = (lista, atual)=>lista.map(x=>`<option value="${escBanco(x.id)}"${x.id === atual ? ' selected' : ''}>${escBanco(x.nome)}</option>`).join('');
  const comCat = ['vista','pix'].includes(i.tipo), comCartao = ['vista','parcelada','fatura'].includes(i.tipo), comBanco = ['pix','recebi','saldo','conta'].includes(i.tipo);
  return `<form class="atz-ed" onsubmit="event.preventDefault();atzSalvarEdicao(${k})" onfocusin="atzEdVisivel(event.target)">
    <label class="atz-ed-l"><span>Nome</span><input id="atzEdNome" type="text" value="${escBanco(i.descricao)}" autocomplete="off"></label>
    <label class="atz-ed-l"><span>${i.tipo === 'parcelada' ? 'Valor total' : 'Valor'}</span><input id="atzEdValor" type="text" inputmode="decimal" value="${String(i.valor.toFixed(2)).replace('.', ',')}"></label>
    ${comCat ? `<label class="atz-ed-l"><span>Categoria</span><select id="atzEdCat">${vozCategoriasCartao().map(c=>`<option${c === i.categoria ? ' selected' : ''}>${escBanco(c)}</option>`).join('')}</select></label>` : ''}
    ${atzGravavel(i) ? `<label class="atz-ed-l"><span>Dia</span><input id="atzEdData" type="date" max="${calISO(new Date())}" value="${i.data || calISO(new Date())}"></label>` : ''}
    ${i.tipo === 'parcelada' ? `<label class="atz-ed-l"><span>Parcelas</span><input id="atzEdParc" type="number" inputmode="numeric" min="2" max="48" value="${i.parcelas}"></label>` : ''}
    ${comCartao ? `<label class="atz-ed-l"><span>Cartão</span><select id="atzEdCartao"><option value="">Escolha</option>${opc(vozCartoes(), i.cartaoId)}</select></label>` : ''}
    ${comBanco ? `<label class="atz-ed-l"><span>Banco</span><select id="atzEdBanco"><option value="">${i.tipo === 'conta' ? 'Não mexer no banco' : 'Escolha'}</option>${opc(bancosDoUsuario(), i.bancoId)}</select></label>` : ''}
    <div class="atz-ed-acoes"><button type="button" class="link-txt" onclick="atzEditando=-1;atzRenderConversa()">Cancelar</button><button type="submit" class="btn btn-sm">Salvar</button></div>
  </form>`;
}
function atzSalvarEdicao(k){
  const i = atzItens[k]; if(!i) return;
  const v = id=>{ const el = document.getElementById(id); return el ? el.value : null; };
  const antes = atzChave(i);
  const nome = String(v('atzEdNome') || '').trim(); if(nome) i.descricao = nome;
  const tx = String(v('atzEdValor') || '').trim(), valor = Number(tx.includes(',') ? tx.replace(/\./g, '').replace(',', '.') : tx);
  if(valor > 0) i.valor = Math.round(valor * 100) / 100;
  const cat = v('atzEdCat');
  if(cat && cat !== i.categoria){ i.categoria = cat; i.duvida = false; i.catManual = true; atzAprender(i.descricao, cat); }
  else if(cat && i.duvida){ i.duvida = false; i.catManual = true; atzAprender(i.descricao, cat); }
  const dt = v('atzEdData'); if(dt) i.data = atzDataValida(dt);
  const parc = parseInt(v('atzEdParc')); if(parc >= 2) i.parcelas = Math.min(48, parc);
  const cid = v('atzEdCartao'); if(cid !== null){ const c = vozCartoes().find(x=>x.id === cid); i.cartaoId = c ? c.id : ''; i.cartaoNome = c ? c.nome : ''; }
  const bid = v('atzEdBanco'); if(bid !== null){ const b = bancosDoUsuario().find(x=>x.id === bid); i.bancoId = b ? b.id : ''; i.bancoNome = b ? b.nome : ''; }
  /* a resposta onde o item apareceu continua apontando para ele */
  const depois = atzChave(i);
  if(depois !== antes) atzConversa.forEach(m=>{ if(m.novos) m.novos = m.novos.map(c=>c === antes ? depois : c); });
  atzEditando = -1;
  renderAtualizar();
}
/* um item (estilo R2): círculo de confirmar, ícone, nome, "categoria · cartão" (toque na categoria troca), valor e × */
function atzItemHtml(i, k, dup){
  if(atzEditando === k) return atzEditorHtml(i, k);
  const falta = atzFaltaNoItem(i), info = !atzGravavel(i);
  const cats = ['vista','pix'].includes(i.tipo) ? vozCategoriasCartao() : null;
  const onde = [i.tipo === 'pix' ? 'Pix ' + i.bancoNome : ['vista','parcelada','fatura'].includes(i.tipo) ? (i.cartaoNome ? 'Cartão ' + i.cartaoNome : '') : i.bancoNome,
    i.data ? atzDiaCurto(i.data) : '', atzFaturaOutra(i)].filter(Boolean).join(' · ');
  const nome = i.descricao || (i.tipo === 'saldo' ? 'Saldo' : i.tipo === 'fatura' ? 'Fatura' : 'Item');
  const cat = cats ? `<label class="atz-cat${i.duvida ? ' duv' : ''}" title="Trocar a categoria">${escBanco(i.categoria || 'Outros')}${i.duvida ? '?' : ''}<select aria-label="Categoria" onchange="atzTrocarCategoria(${k}, this.value)">${cats.map(c=>`<option${c === i.categoria ? ' selected' : ''}>${escBanco(c)}</option>`).join('')}</select></label>`
    : i.tipo === 'parcelada' ? `<span>${i.parcelas}x de ${fmtMoney(i.valor / i.parcelas)}</span>` : `<span>${escBanco(ATZ_TIPOS[i.tipo])}</span>`;
  return `<div class="atz-it${i.ok && !falta ? ' ok' : ''}${atzBateu === k ? ' bate' : ''}${falta ? ' falta' : ''}${info ? ' info' : ''}${dup ? ' dup' : ''}">
    ${info ? '<span class="atz-chk" title="Valor que você viu no banco">i</span>'
      : `<button type="button" class="atz-chk" ${falta ? 'disabled' : ''} title="${falta ? 'Responda antes: ' + falta : i.ok ? 'Desmarcar' : 'Confirmar'}" aria-label="${i.ok ? 'Desmarcar' : 'Confirmar'}" aria-pressed="${!!i.ok}" onclick="atzConfirmar(${k})">${ATZ_ICO_OK}</button>`}
    ${atzIcoItem(i)}
    <div class="atz-it-txt"><button type="button" class="atz-it-nome" title="Editar" onclick="atzEditar(${k})"><b>${escBanco(nome)}</b>${ATZ_ICO_LAPIS}</button><small>${cat}${onde ? ' · ' + escBanco(onde) : ''}${falta ? ` <em>${falta}</em>` : ''}${dup ? ` <em class="atz-dup" title="${escBanco(dup.texto)}">${escBanco(dup.curto)}</em>` : ''}</small></div>
    <b class="atz-valor">${fmtMoney(i.valor)}</b>
    <button type="button" class="ico-btn atz-tirar" aria-label="Tirar" title="Tirar" onclick="atzTirarItem(${k})">${CU_ICO.x}</button>
    ${atzLimiteHtml(i)}
  </div>`;
}
/* compra com a categoria de uma conta-limite (Mercado de R$ 850): mostra como a conta fica com essa compra */
function atzLimiteHtml(i){
  if(!['vista', 'pix'].includes(i.tipo) || !i.categoria || typeof contaPorNome !== 'function') return '';
  const c = contaPorNome(i.categoria, mesFinanceiroAtual()); if(!c) return '';
  const depois = Math.round((c.gasto + (Number(i.valor) || 0)) * 100) / 100, dif = c.limite - depois;
  return `<div class="atz-limite${dif < -0.004 ? ' passou' : ''}"><span>${escBanco(c.desc)}: ${fmtMoney(depois)} de ${fmtMoney(c.limite)}</span><b>${dif < -0.004 ? 'passou ' + fmtMoney(-dif) : 'falta ' + fmtMoney(dif)}</b></div>`;
}
/* faixa do alto: total grande, quanto foi para cada categoria (barra + valor + %) e os itens bem pequenos */
const ATZ_CORES = ['#c9a86a','#8fb3a0','#d39a7a','#a3a9cf','#c7b4d6','#9cc3cf','#d8c38f','#b9a48f'];
let atzFaixaMin = false;
function atzFaixaHtml(){
  const gastos = atzItens.filter(i=>['vista','parcelada','pix','conta'].includes(i.tipo));
  const total = gastos.reduce((s, i)=>s + i.valor, 0);
  const gravaveis = atzItens.filter(atzGravavel), ok = gravaveis.filter(atzConfirmado).length;
  const porCat = {};
  gastos.forEach(i=>{ const c = i.tipo === 'parcelada' ? 'Parcelado' : i.tipo === 'conta' ? 'Contas' : (i.categoria || 'Outros'); porCat[c] = (porCat[c] || 0) + i.valor; });
  const cats = Object.entries(porCat).sort((a, b)=>b[1] - a[1]).map(([c, v], n)=>({ c, v, cor: ATZ_CORES[n % ATZ_CORES.length], p: total ? Math.round(v / total * 100) : 0 }));
  const outros = atzItens.filter(i=>!gastos.includes(i));
  return `<div class="atz-placa${atzFaixaMin ? ' min' : ''}">
    <div class="atz-placa-topo">
      <button type="button" class="atz-placa-info" onclick="atzFaixaAlternar()" aria-expanded="${!atzFaixaMin}"><span>Nesta conversa</span><b>${fmtMoney(total)}</b><small>${gravaveis.length ? `${gravaveis.length} ${gravaveis.length === 1 ? 'item' : 'itens'} · ${ok} confirmado${ok === 1 ? '' : 's'}` : 'nada anotado ainda'}</small></button>
      <div class="atz-placa-acoes">
        <button type="button" class="atz-tg${atzDetalhes ? ' on' : ''}" role="switch" aria-checked="${atzDetalhes}" onclick="atzDetalhesAlternar()"><i></i>Detalhes</button>
        ${gravaveis.length ? `<button type="button" class="btn atz-gravar" ${ok ? '' : 'disabled'} onclick="atzGravar()">${ok ? 'Gravar ' + ok : 'Gravar'}</button>` : ''}
      </div>
    </div>
    ${!atzFaixaMin && cats.length ? `<div class="atz-fx-barra">${cats.map(x=>`<i style="width:${Math.max(2, x.v / total * 100)}%;background:${x.cor}"></i>`).join('')}</div>
      <div class="atz-fx-cats">${cats.map(x=>`<span><em style="background:${x.cor}"></em>${escBanco(x.c)} <b>${fmtMoney(x.v)}</b> <small>${x.p}%</small></span>`).join('')}</div>` : ''}
    ${!atzFaixaMin && atzItens.length ? `<div class="atz-fx-its">${[...gastos, ...outros].map(i=>`<span class="atz-fx-it${i.ok ? ' ok' : ''}">${atzIcoItem(i, 10)}${escBanco(i.descricao || ATZ_TIPOS[i.tipo])} <b>${fmtMoney(i.valor)}</b></span>`).join('')}</div>` : ''}
  </div>`;
}
function atzFaixaAlternar(){ atzFaixaMin = !atzFaixaMin; atzRenderConversa(); }

/* ---------- passo a passo: o app pergunta banco por banco, cartão por cartão e as contas ---------- */
let atzPassoI = 0;
function atzPassos(){
  const p = bancosDoUsuario().map(b=>({ tipo:'banco', id: b.id, nome: b.nome }));
  (state.cartoesTracker || []).forEach(c=>p.push({ tipo:'cartao', id: c.id, nome: c.nome }));
  if(vozContasAbertas().length) p.push({ tipo:'contas' });
  return p;
}
function atzPassoPergunta(p){
  if(!p) return '';
  if(p.tipo === 'banco') return `Quanto está o saldo do ${p.nome} agora? Se gastou algo nele (Pix, débito), fale também.`;
  if(p.tipo === 'cartao'){ const c = (state.cartoesTracker || []).find(x=>x.id === p.id); return `Quanto está a fatura aberta do ${p.nome}${c ? ' (' + monthLabel(faturaAbertaMes(c)) + ')' : ''}? Fale também as compras que ainda não estão no app.`; }
  return 'Quais destas contas você já pagou? Toque nelas ou fale.';
}
function atzPassoHtml(conf){
  const passos = atzPassos(), p = passos[atzPassoI];
  if(!passos.length) return '';
  const barra = `<div class="atz-passo-prog"><i style="width:${Math.min(100, atzPassoI / passos.length * 100)}%"></i></div>`;
  if(!p) return `<div class="atz-passo">${barra}<b>Pronto, passou por tudo.</b><small>Confira os itens, toque nos círculos e em Gravar.</small>
    <div class="atz-passo-acoes"><button type="button" class="link-txt" onclick="atzPassoIr(-1)">Voltar</button><button type="button" class="link-txt" onclick="atzPassoIr(-${passos.length})">Começar de novo</button></div></div>`;
  let st = '';
  if(p.tipo === 'banco'){ const x = conf.bancos.find(b=>b.b.id === p.id); if(x && x.informado !== null) st = Math.abs(x.dif) < 0.01 ? '<span class="atz-pill ok">bateu ✓</span>' : x.dif < 0 ? `<span class="atz-pill err">faltam ${fmtMoney(-x.dif)}: o que mais saiu?</span> <button type="button" class="link-txt" onclick="atzSemExplicar('banco','${p.id}')">Não lembro</button>` : `<span class="atz-pill err">entrou ${fmtMoney(x.dif)} a mais: recebeu algo?</span>`; }
  if(p.tipo === 'cartao'){ const x = conf.cartoes.find(c=>c.c.id === p.id); if(x && x.informado !== null) st = Math.abs(x.falta) < 0.01 ? '<span class="atz-pill ok">bateu ✓</span>' : x.falta > 0 ? `<span class="atz-pill err">faltam ${fmtMoney(x.falta)}: que compras faltam?</span> <button type="button" class="link-txt" onclick="atzSemExplicar('cartao','${p.id}')">Não lembro</button>` : `<span class="atz-pill err">passou ${fmtMoney(-x.falta)}: algum valor errado?</span>`; }
  const chips = p.tipo === 'contas' ? `<div class="atz-passo-chips">${vozContasAbertas().map((c, n)=>{ const tem = atzItens.some(i=>i.tipo === 'conta' && i.conta === c.key);
    return `<button type="button" class="${tem ? 'on' : ''}" onclick="atzPassoConta(${n})">${escBanco(c.desc)} <small>${fmtMoney(c.valor)}</small></button>`; }).join('')}</div>` : '';
  return `<div class="atz-passo">${barra}<span class="atz-passo-n">${atzPassoI + 1} de ${passos.length}</span><b>${lvEsc(atzPassoPergunta(p))}</b>${st ? `<div class="atz-passo-st">${st}</div>` : ''}${chips}
    <div class="atz-passo-acoes">${atzPassoI ? '<button type="button" class="link-txt" onclick="atzPassoIr(-1)">Voltar</button>' : '<span></span>'}<button type="button" class="btn btn-sm" onclick="atzPassoIr(1)">${/bateu/.test(st) ? 'Próximo' : 'Pular'}</button></div></div>`;
}
function atzPassoIr(d){ atzPassoI = Math.max(0, Math.min(atzPassos().length, atzPassoI + d)); atzRenderConversa(); }
/* v15.3: a resposta mexeu no banco/cartão da pergunta → vai sozinho para o próximo.
   Fica só se o saldo/fatura informado não bateu (aí a pergunta do que falta aparece no próprio passo) */
function atzPassoAvancar(antes){
  const p = atzPassos()[atzPassoI]; if(!p || p.tipo === 'contas') return;
  const ks = new Set(antes.map(atzChave));
  const mexeu = atzItens.some(i=>!ks.has(atzChave(i)) && (p.tipo === 'banco' ? i.bancoId === p.id : i.cartaoId === p.id));
  if(!mexeu) return;
  const conf = atzConferencia();
  const x = p.tipo === 'banco' ? conf.bancos.find(b=>b.b.id === p.id) : conf.cartoes.find(c=>c.c.id === p.id);
  const falta = x && x.informado !== null ? Math.abs(p.tipo === 'banco' ? x.dif : x.falta) : 0;
  if(falta >= 0.01) return;
  atzPassoI = Math.min(atzPassos().length, atzPassoI + 1);
}
/* v15.3: ver todos os itens numa lista só (sem a conversa no meio) e confirmar todos de uma vez */
let atzSoLista = false;
function atzVerLista(v){ atzSoLista = v; atzEditando = -1; atzRenderConversa(); }
function atzConfirmarTodos(){
  let n = 0;
  atzItens.forEach(i=>{ if(atzGravavel(i) && !atzFaltaNoItem(i) && !i.ok){ i.ok = true; n++; } });
  renderAtualizar();
  showToast(n ? `${n} ${n === 1 ? 'item confirmado' : 'itens confirmados'}` : 'Os que faltam precisam de resposta antes (cartão, banco…)');
}
/* v15.3: a transcrição do áudio saiu errada → tocar na fala põe o texto na caixa para corrigir e mandar de novo */
function atzCorrigirFala(mi){
  const m = atzConversa[mi]; if(!m || m.quem !== 'eu' || !m.texto || /^\(/.test(m.texto)) return;
  if(atzEditando >= 0){ atzEditando = -1; atzRenderConversa(); }   // a caixa de digitar some enquanto edita
  const inp = document.getElementById('atzTexto');
  inp.value = 'Corrigindo o que eu disse: ' + m.texto;
  inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 140) + 'px';
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  showToast('Corrija o texto e envie: a lista é ajustada');
}
/* conta tocada no passo a passo: entra (ou sai) da lista sem passar pela IA */
function atzPassoConta(n){
  const c = vozContasAbertas()[n]; if(!c) return;
  const k = atzItens.findIndex(i=>i.tipo === 'conta' && i.conta === c.key);
  if(k >= 0) atzItens.splice(k, 1);
  else {
    const item = { tipo:'conta', descricao: c.desc, valor: Math.round(Number(c.valor) * 100) / 100, categoria:'', duvida:false, cartaoId:'', cartaoNome:'', bancoId:'', bancoNome:'', parcelas:1, proximaFatura:false, conta: c.key, ok:false };
    atzItens.push(item);
    atzConversa.push({ quem:'ia', texto:'Anotado.', novos:[atzChave(item)] });
  }
  renderAtualizar(true);
}
/* Detalhes: cada cartão e banco mexido (antes → depois, quanto falta) e as contas em aberto */
function atzDetalhesHtml(conf){
  const pill = (classe, txt)=>`<span class="atz-pill ${classe}">${txt}</span>`;
  const cartoes = conf.cartoes.filter(x=>x.mexeu).map(x=>{
    const st = x.informado === null ? '' : Math.abs(x.falta) < 0.01 ? pill('ok', 'bateu ✓') : x.falta > 0 ? pill('err', 'faltam ' + fmtMoney(x.falta)) : pill('err', 'passou ' + fmtMoney(-x.falta));
    return `<div class="atz-det-bloco"><div class="atz-det-topo"><span>Cartão ${escBanco(x.c.nome)}</span>${st}</div>
      <div class="atz-linha"><span>Fatura de ${monthLabel(x.m)} no app</span><b>${fmtMoney(x.noApp)}</b></div>
      ${x.novos > 0.009 ? `<div class="atz-linha"><span>Desta conversa</span><b>+ ${fmtMoney(x.novos)}</b></div>` : ''}
      ${x.informado !== null ? `<div class="atz-linha"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>` : ''}
      ${x.falta > 0.009 ? `<button type="button" class="link-txt atz-naolembro" onclick="atzSemExplicar('cartao','${x.c.id}')">Não lembro: lançar ${fmtMoney(x.falta)} como compra não identificada</button>` : ''}
    </div>`; }).join('');
  const bancos = conf.bancos.filter(x=>x.mexeu).map(x=>{
    const antes = Number(x.b.valor) || 0;
    const st = x.informado === null ? '' : Math.abs(x.dif) < 0.01 ? pill('ok', 'bateu ✓') : x.dif < 0 ? pill('err', 'falta explicar ' + fmtMoney(-x.dif)) : pill('err', 'entrou ' + fmtMoney(x.dif) + ' a mais');
    return `<div class="atz-det-bloco"><div class="atz-det-topo"><span>${escBanco(x.b.nome)}</span>${st}</div>
      <div class="atz-linha"><span>Agora no app</span><b>${fmtMoney(antes)}</b></div>
      ${Math.abs(x.esperado - antes) > 0.009 ? `<div class="atz-linha"><span>Depois desta conversa</span><b>${fmtMoney(x.esperado)}</b></div>` : ''}
      ${x.informado !== null ? `<div class="atz-linha"><span>No banco</span><b>${fmtMoney(x.informado)}</b></div>` : ''}
      ${x.dif < -0.009 ? `<button type="button" class="link-txt atz-naolembro" onclick="atzSemExplicar('banco','${x.b.id}')">Não lembro: lançar ${fmtMoney(-x.dif)} como gasto não identificado</button>` : ''}
    </div>`; }).join('');
  const abertas = vozContasAbertas();
  const contas = abertas.length ? `<div class="atz-det-bloco"><div class="atz-det-topo"><span>Contas em aberto</span><small>${abertas.length}</small></div>
    ${abertas.slice(0, 5).map(c=>`<div class="atz-linha"><span>${escBanco(c.desc)}</span><b>${fmtMoney(c.valor)}</b></div>`).join('')}
    ${abertas.length > 5 ? `<div class="atz-linha"><span>e mais ${abertas.length - 5}</span><b>${fmtMoney(abertas.slice(5).reduce((s, c)=>s + c.valor, 0))}</b></div>` : ''}</div>` : '';
  return (cartoes || bancos ? '' : '<div class="atz-vazio">Nenhum cartão ou banco mudou ainda. Fale um gasto, a fatura ou o saldo de um banco.</div>') + cartoes + bancos + contas;
}
function atzRenderConversa(pensando, rolar){
  const el = document.getElementById('atzConversa'); if(!el) return;
  const conf = atzConferencia();
  /* cada item aparece na última resposta em que entrou (ou mudou) */
  const ultimo = {}, porMsg = {}, soltos = [];
  atzConversa.forEach((m, mi)=>(m.novos || []).forEach(c=>{ ultimo[c] = mi; }));
  atzItens.forEach((i, k)=>{ const mi = ultimo[atzChave(i)]; if(mi === undefined) soltos.push(k); else (porMsg[mi] = porMsg[mi] || []).push(k); });
  const dups = atzDuplicados();
  const lista = ks=>ks.length ? `<div class="atz-its">${ks.map(k=>atzItemHtml(atzItens[k], k, dups[k])).join('')}</div>`
    + ks.filter(k=>dups[k]).map(k=>`<div class="atz-aviso-dup">${lvEsc(dups[k].texto)}</div>`).join('') : '';
  const tirado = i=>`<li>${escBanco(i.descricao || ATZ_TIPOS[i.tipo])} <b>${fmtMoney(i.valor)}</b></li>`;
  const msgs = atzConversa.map((m, mi)=>m.quem === 'eu'
      ? `<div class="atz-msg eu${m.voz ? ' voz' : ''}"${m.texto && m.texto[0] !== '(' ? ` role="button" tabindex="0" title="Tocar para corrigir o que foi entendido" onclick="atzCorrigirFala(${mi})"` : ''}>${m.voz ? `<span class="atz-aud">${ATZ_ICO_MIC} ${atzTempo(m.dur || 0)}</span>` : ''}${m.texto ? lvEsc(m.texto) : '<span class="atz-aud-espera">…</span>'}</div>`
    : m.erro ? `<div class="atz-msg ia erro">${lvEsc(m.texto)}</div>`
    : `<div class="atz-msg ia">
        ${m.texto ? `<p>${lvEsc(m.texto)}</p>` : ''}
        ${lista(porMsg[mi] || [])}
        ${(m.tirados || []).length ? `<ul class="atz-msg-lista tirados">${m.tirados.map(tirado).join('')}</ul>` : ''}
        ${(m.aprendeu || []).length ? `<div class="atz-aprendeu">Aprendi: ${lvEsc(m.aprendeu.join(', '))}</div>` : ''}
      </div>`).join('')
    + (soltos.length ? `<div class="atz-msg ia">${lista(soltos)}</div>` : '');
  const passo = atzAba === 'passo' ? atzPassoHtml(conf) : '';
  el.classList.toggle('det', atzDetalhes);
  /* editando no celular: a placa, os detalhes e a barra de digitar saem do caminho (o teclado tampava tudo) */
  document.getElementById('pageAtualizar').classList.toggle('atz-editando', atzEditando >= 0);
  /* com 2+ itens: Conversa ou Lista (todos juntos) + Confirmar todos */
  const lista2 = atzSoLista && atzItens.length;
  const ferr = atzItens.length >= 2 ? `<div class="atz-ferr"><div class="atz-ferr-seg"><button type="button" class="${lista2 ? '' : 'on'}" onclick="atzVerLista(false)">Conversa</button><button type="button" class="${lista2 ? 'on' : ''}" onclick="atzVerLista(true)">Lista <small>${atzItens.length}</small></button></div>
    ${atzItens.some(i=>atzGravavel(i) && !i.ok) ? '<button type="button" class="atz-ferr-todos" onclick="atzConfirmarTodos()">Confirmar todos</button>' : ''}</div>` : '';
  const corpoMsgs = lista2 ? `<div class="atz-msg ia atz-lista-tudo">${lista(atzItens.map((_, k)=>k))}</div>` : msgs;
  el.innerHTML = `
    ${atzFaixaHtml()}
    <div class="atz-corpo">
      ${atzDetalhes ? `<div class="atz-det">${atzDetalhesHtml(conf)}</div>` : ''}
      <div class="atz-chat">${ferr}<div class="atz-msgs">${corpoMsgs || (passo ? '' : `<div class="atz-msg ia">Fale ou escreva o que você gastou.</div>`)}
        ${pensando ? `<div class="atz-msg ia pensando"><i></i><i></i><i></i><span>${lvEsc(typeof pensando === 'string' ? pensando : '')}</span></div>` : ''}</div>
        ${atzConferenciasHtml(conf)}
        ${passo}
        ${atzConversa.length && !pensando ? '<button type="button" class="link-txt atz-limpar" onclick="atzLimpar()">Começar de novo</button>' : ''}</div>
    </div>`;
  /* fala nova: a última mensagem fica logo abaixo da faixa (a resposta inteira à vista) */
  const m = el.querySelector('.atz-msgs'), caixa = document.getElementById('atzConteudo'), placa = el.querySelector('.atz-placa');
  if(rolar && m && caixa) requestAnimationFrame(()=>{
    const ult = m.lastElementChild; if(!ult) return;
    ult.classList.add('ef-nova');   // E15: os itens da resposta nova entram em cascata
    const topo = ult.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop - (placa ? placa.offsetHeight : 0) - 12;
    caixa.scrollTo({ top: Math.max(0, topo), behavior:'smooth' });
  });
}
function atzDetalhesAlternar(){
  atzDetalhes = !atzDetalhes;
  try{ localStorage.setItem('siloe-atz-detalhes', atzDetalhes ? '1' : '0'); }catch(e){}
  atzRenderConversa();
}
/* E12: o item que acabou de ganhar o ✓ "bate" (só ele, só nesse desenho) */
let atzBateu = -1;
function atzConfirmar(k){ const i = atzItens[k]; if(!i || atzFaltaNoItem(i)) return; i.ok = !i.ok; atzBateu = i.ok ? k : -1; renderAtualizar(); atzBateu = -1; }
function atzTirarItem(k){ atzItens.splice(k, 1); atzEditando = -1; renderAtualizar(); }
function atzTrocarCategoria(k, cat){
  const i = atzItens[k]; if(!i) return;
  i.categoria = cat; i.duvida = false; i.catManual = true;
  atzAprender(i.descricao, cat);
  renderAtualizar();
}
/* "Não lembro": o que falta explicar vira um item (Pix "Gasto não identificado" no banco, ou compra no cartão) */
function atzSemExplicar(onde, id){
  const conf = atzConferencia();
  let item = null;
  if(onde === 'banco'){
    const x = conf.bancos.find(b=>b.b.id === id); if(!x || !(x.dif < -0.009)) return;
    item = { tipo:'pix', descricao:'Gasto não identificado', valor: Math.round(-x.dif * 100) / 100, categoria:'Outros', cartaoId:'', cartaoNome:'', bancoId: x.b.id, bancoNome: x.b.nome, parcelas:1, proximaFatura:false, conta:'', ok:false };
  } else {
    const x = conf.cartoes.find(c=>c.c.id === id); if(!x || !(x.falta > 0.009)) return;
    item = { tipo:'vista', descricao:'Compra não identificada', valor: Math.round(x.falta * 100) / 100, categoria:'Outros', cartaoId: x.c.id, cartaoNome: x.c.nome, bancoId:'', bancoNome:'', parcelas:1, proximaFatura:false, conta:'', ok:false };
  }
  atzItens.push(item);
  atzConversa.push({ quem:'ia', texto:'Lancei o que faltou como não identificado. Confirme se está certo.', novos:[atzChave(item)] });
  renderAtualizar(true);
}
function atzLimpar(){ atzConversa = []; atzItens = []; renderAtualizar(); }

/* ---------- apelidos de categoria ("Top" → Mercado), aprendidos na conversa ---------- */
function atzAprender(nome, cat, semGravar){
  const k = atzChaveNome(nome);
  if(!k || /nao identificad/.test(k)) return;
  if(!state.iaApelidos) state.iaApelidos = {};
  state.iaApelidos[k] = { nome: String(nome).trim(), categoria: cat };
  if(!semGravar) persist();
  atzRenderApelidos();
}
function atzEsquecerApelido(k){
  if(!state.iaApelidos || !state.iaApelidos[k]) return;
  delete state.iaApelidos[k];
  persist();
  atzRenderApelidos();
}
function atzRenderApelidos(){
  const el = document.getElementById('iaApelidosLista'); if(!el) return;
  const lista = Object.entries(state.iaApelidos || {}).sort((a, b)=>a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
  el.innerHTML = lista.length ? lista.map(([k, a])=>`<div class="atz-ap"><span>${escBanco(a.nome)}</span><b>${escBanco(a.categoria)}</b>
      <button type="button" class="ico-btn" aria-label="Esquecer" title="Esquecer" onclick="atzEsquecerApelido('${escBanco(k).replace(/'/g, '&#39;')}')">${CU_ICO.x}</button></div>`).join('')
    : '<div class="atz-vazio">Ainda nada. Quando você trocar a categoria de um gasto no Assistente, ou disser "Top é mercado", aparece aqui.</div>';
}

/* grava só os itens confirmados (com Desfazer). Banco com saldo confirmado fica com o saldo informado (o Pix dele só entra no histórico);
   nos outros, Pix/conta tiram e "recebi" soma. Os que não foram confirmados continuam na conversa. */
/* contas em aberto que uma compra paga por inteiro: mesmo nome (Spotify no cartão = conta Spotify) e valor de pelo menos 90% do que falta.
   Compra menor (Mercado 10 de uma conta de 850) não marca: ela já desconta da conta pela categoria (contaUsadaNoCartao) */
function atzContasPagasPeloItem(itens){
  const contas = vozContasAbertas(), usadas = new Set(), out = [];
  const nome = s=>vozSemAcento(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  itens.filter(i=>['vista', 'parcelada', 'pix'].includes(i.tipo)).forEach(i=>{
    const d = nome(i.descricao);
    if(!d) return;
    const c = contas.find(c=>{
      if(usadas.has(c.key)) return false;
      const n = nome(c.desc);
      return n && (n === d || (n.length > 3 && (` ${d} `).includes(` ${n} `)) || (d.length > 3 && (` ${n} `).includes(` ${d} `)));
    });
    if(c && (Number(i.valor) || 0) >= c.valor * 0.9){ usadas.add(c.key); out.push(c); }
  });
  return out;
}
async function atzGravar(){
  const itens = atzItens.filter(atzConfirmado);
  if(!itens.length) return;
  const conf = atzConferencia([...itens, ...atzItens.filter(i=>i.tipo === 'fatura')]), agora = Date.now(), hoje = calISO(new Date()), mKey = mesFinanceiroAtual();
  /* ainda tem diferença sem explicar: avisa antes (o saldo fica o do banco, mas sem dizer onde foi o dinheiro) */
  const soltas = [...conf.bancos.filter(x=>x.informado !== null && x.dif < -0.009).map(x=>`${fmtMoney(-x.dif)} no ${x.b.nome}`),
    ...conf.cartoes.filter(x=>x.informado !== null && x.falta > 0.009).map(x=>`${fmtMoney(x.falta)} na fatura ${x.c.nome}`)];
  if(soltas.length && !(await iosConfirm(`Ainda falta explicar ${soltas.join(' e ')}. Gravar assim mesmo?`))) return;
  /* repetidos confirmados: pergunta de novo antes de lançar em dobro */
  const dups = atzDuplicados(), repetidos = itens.filter(i=>dups[atzItens.indexOf(i)]);
  if(repetidos.length && !(await iosConfirm(`${repetidos.length === 1 ? 'Um item parece repetido' : repetidos.length + ' itens parecem repetidos'} (${repetidos.map(i=>(i.descricao || 'Item') + ' ' + fmtMoney(i.valor)).join(', ')}): já estão no app. Gravar mesmo assim?`))) return;
  /* compra no cartão ou no Pix com o nome de uma conta do mês (ex.: Spotify) e do valor dela: a conta fica paga também */
  const pagas = atzContasPagasPeloItem(itens);
  const comSaldo = new Set(itens.filter(i=>i.tipo === 'saldo').map(i=>i.bancoId)), n = itens.length;
  comDesfazer(`${n} ${n === 1 ? 'item gravado' : 'itens gravados'}${pagas.length ? ' · ' + pagas.map(p=>p.desc).join(', ') + (pagas.length === 1 ? ' marcada como paga' : ' marcadas como pagas') : ''}`, ()=>{
    const bancos = bancosDoUsuario(), us = state.users[state.currentUser];
    const banco = id=>bancos.find(b=>b.id === id);
    const mexe = (id, v)=>{ const b = banco(id); if(b && !comSaldo.has(id)) b.valor = Math.round(((Number(b.valor) || 0) + v) * 100) / 100; };
    if(!state.lancamentos) state.lancamentos = [];
    if(!state.comprasTracker) state.comprasTracker = [];
    itens.forEach((i, k)=>{
      const id = agora + '_' + k;
      if(i.tipo === 'vista'){
        const c = (state.cartoesTracker || []).find(x=>x.id === i.cartaoId); if(!c) return;
        if(!c.credoVista) c.credoVista = [];
        c.credoVista.push({ id:'cv' + id, descricao: i.descricao || 'Compra', valor: i.valor, categoria: i.categoria || 'Outros', mKey: atzFaturaDoItem(c, i), data: i.data || hoje, criadoEm: agora });
      } else if(i.tipo === 'parcelada'){
        const c = (state.cartoesTracker || []).find(x=>x.id === i.cartaoId); if(!c) return;
        state.comprasTracker.push({ id:'cp' + id, nome: i.descricao || 'Compra', descricao:'', logoUrl:'', cartaoId: c.id, valorTotal: i.valor, parcelas: i.parcelas, mesInicio: atzFaturaDoItem(c, i), data: i.data || hoje, criadoEm: agora });
      } else if(i.tipo === 'pix'){
        const b = banco(i.bancoId);
        state.lancamentos.push({ id:'la' + id, mKey, data: i.data || hoje, descricao: i.descricao || 'Compra', valor: i.valor, categoria: i.categoria || 'Outros', banco: b ? b.nome : '', usuario: state.currentUser });
        mexe(i.bancoId, -i.valor);
      } else if(i.tipo === 'recebi'){
        mexe(i.bancoId, i.valor);
      } else if(i.tipo === 'conta'){
        state.paid[i.conta] = true;
        if(state.pagamentosParciais) delete state.pagamentosParciais[i.conta];
        if(i.bancoId) mexe(i.bancoId, -i.valor);
      }
    });
    pagas.forEach(p=>{ state.paid[p.key] = true; if(state.pagamentosParciais) delete state.pagamentosParciais[p.key]; });
    /* saldo confirmado: vale o do banco (o "não identificado" só entra se a pessoa pediu: vira item Pix na lista) */
    conf.bancos.filter(x=>x.informado !== null).forEach(x=>{ const b = banco(x.b.id); if(b) b.valor = x.informado; });
    if(bancos.length) us.saldoAtual = totalBancos(bancos);
    state.ultimaAtualizacao = agora;
    persist();
  }, ()=>{ if(document.getElementById('pageAtualizar').classList.contains('active')) renderAtualizar(); });
  atzItens = atzItens.filter(i=>!itens.includes(i));
  if(!atzItens.some(atzGravavel)){ atzConversa = []; atzItens = []; }
  renderPlanner(); renderPanorama();
  renderAtualizar();
}

/* ---------- microfone: grava o áudio e manda para a IA ----------
   O ditado do navegador errava números e nomes de banco e repetia trechos no Android. Agora o app grava (MediaRecorder),
   para sozinho depois de ATZ_SILENCIO ms de silêncio (ou ao tocar de novo) e manda o áudio para o Gemini, que ouve e
   entende junto, sabendo os bancos e cartões. O áudio vira WAV 16 kHz mono (formato que o Gemini sempre aceita). */
const ATZ_SILENCIO = 1500, ATZ_GRAV_MAX = 180;
let atzGrav = null;
async function atzMicrofone(){
  if(atzGrav){ atzGravParar(true); return; }
  if(atzOcupado || !atzTemIA()) return;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder){ showToast('Gravação indisponível aqui: use o microfone do teclado'); document.getElementById('atzTexto').focus(); return; }
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch(e){ showToast('Permita o microfone (ou escreva)'); return; }
  const tipo = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  let rec;
  try{ rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined); }
  catch(e){ stream.getTracks().forEach(t=>t.stop()); showToast('Não consegui ligar o microfone: escreva'); return; }
  const g = atzGrav = { rec, stream, partes: [], t0: Date.now(), enviar: false, falou: false, quieto: 0, niveis: new Array(14).fill(0) };
  rec.ondataavailable = e=>{ if(e.data && e.data.size) g.partes.push(e.data); };
  rec.onstop = ()=>{
    stream.getTracks().forEach(t=>t.stop());
    const dur = (Date.now() - g.t0) / 1000;
    /* sem fala nenhuma não manda: com áudio vazio a IA inventa uma frase */
    if(g.enviar && g.an && !g.falou){ showToast('Não ouvi nada: fale mais perto do microfone'); return; }
    if(g.enviar && dur > 0.8 && g.partes.length) atzEnviarAudio(new Blob(g.partes, { type: rec.mimeType || tipo || 'audio/webm' }), dur);
  };
  /* nível do som: desenha a onda e percebe o silêncio depois que a pessoa começou a falar */
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    g.ctx = new Ctx(); g.an = g.ctx.createAnalyser(); g.an.fftSize = 1024;
    g.ctx.createMediaStreamSource(stream).connect(g.an);
    g.buf = new Float32Array(g.an.fftSize);
  }catch(e){ g.an = null; }
  rec.start(250);
  document.getElementById('atzMic').classList.add('ouvindo');
  document.querySelector('.atz-barra').classList.add('gravando');
  g.timer = setInterval(()=>{
    const seg = (Date.now() - g.t0) / 1000;
    let nivel = 0;
    if(g.an){
      (g.an.getFloatTimeDomainData ? g.an.getFloatTimeDomainData(g.buf) : null);
      let s = 0; for(let i = 0; i < g.buf.length; i++) s += g.buf[i] * g.buf[i];
      nivel = Math.sqrt(s / g.buf.length);
      if(nivel > 0.03) g.falou = true;
      g.quieto = nivel < 0.015 ? g.quieto + 100 : 0;
    }
    g.niveis.shift(); g.niveis.push(Math.min(1, nivel * 9));
    const t = document.getElementById('atzGravTempo'); if(t) t.textContent = atzTempo(seg);
    const ond = document.getElementById('atzGravOnda');
    if(ond) ond.innerHTML = g.niveis.map(v=>`<i style="height:${Math.round(12 + v * 88)}%"></i>`).join('');
    if((g.falou && g.quieto >= ATZ_SILENCIO) || seg >= ATZ_GRAV_MAX) atzGravParar(true);
  }, 100);
}
function atzGravParar(enviar){
  const g = atzGrav; if(!g) return;
  atzGrav = null; g.enviar = !!enviar;
  clearInterval(g.timer);
  try{ if(g.ctx) g.ctx.close(); }catch(e){}
  try{ if(g.rec.state !== 'inactive') g.rec.stop(); else g.stream.getTracks().forEach(t=>t.stop()); }catch(e){ g.stream.getTracks().forEach(t=>t.stop()); }
  const mic = document.getElementById('atzMic'); if(mic) mic.classList.remove('ouvindo');
  const barra = document.querySelector('.atz-barra'); if(barra) barra.classList.remove('gravando');
}
/* áudio gravado → {b64, mime}: WAV 16 kHz mono; se o aparelho não decodificar, vai como foi gravado */
async function atzAudioParaEnviar(blob){
  const paraB64 = buf=>{ const u = new Uint8Array(buf); let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const bruto = await blob.arrayBuffer();
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext, ctx = new Ctx();
    let audio;
    try{ audio = await ctx.decodeAudioData(bruto.slice(0)); } finally{ try{ ctx.close(); }catch(e){} }
    const taxa = 16000, n = Math.max(1, Math.ceil(audio.duration * taxa));
    const off = new OfflineAudioContext(1, n, taxa), src = off.createBufferSource();
    src.buffer = audio; src.connect(off.destination); src.start();
    const d = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + d.length * 2));
    const txt = (o, s)=>{ for(let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, taxa, true);
    out.setUint32(28, taxa * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); txt(36, 'data'); out.setUint32(40, d.length * 2, true);
    for(let i = 0; i < d.length; i++){ const s = Math.max(-1, Math.min(1, d[i])); out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return { b64: paraB64(out.buffer), mime: 'audio/wav' };
  }catch(e){
    return { b64: paraB64(bruto), mime: String(blob.type || 'audio/webm').split(';')[0] };
  }
}
/* campo do editor em foco: espera o teclado abrir e deixa o campo à vista */
function atzEdVisivel(campo){ setTimeout(()=>{ try{ campo.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){} }, 320); }
