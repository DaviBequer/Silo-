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
  document.getElementById('atzConversa').style.display = atzAba === 'conversa' ? '' : 'none';
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
  resposta:{ type:'string', description:'UMA frase curta (até 15 palavras). Não liste os itens nem repita valores: o app mostra a lista. Só pergunte o que estiver faltando de verdade (banco ou cartão quando há mais de um, parcelas, valor confuso); se não falta nada, algo como "Anotado."' },
  aprendidos:{ type:'array', description:'Quando a pessoa ensinar a categoria de um nome ("Top é mercado", "120 no Top, mercado"): {nome, categoria}. Vazio se não ensinou nada.', items:{ type:'object', properties:{
    nome:{ type:'string' }, categoria:{ type:'string', description:'uma categoria exata da lista' }
  }, required:['nome','categoria'] } },
  itens:{ type:'array', description:'A lista COMPLETA e atualizada do que vai ser lançado (inclua os itens anteriores que continuam valendo, com as correções que a pessoa pediu)', items:{ type:'object', properties:{
    tipo:{ type:'string', enum:['vista','parcelada','pix','recebi','conta','saldo','fatura'] },
    descricao:{ type:'string', description:'o nome que a pessoa falou (a loja ou o que comprou: "Top", "Farmácia"), curto, com maiúscula. Não troque pelo nome da categoria. Vazio em saldo e fatura' },
    valor:{ type:'number', description:'em reais. Parcelada: o valor TOTAL da compra ("2x de 150" = 300). Saldo/fatura: o valor que a pessoa viu no banco' },
    categoria:{ type:'string', description:'uma categoria exata da lista (vista e pix); vazio nos outros' },
    categoriaDuvida:{ type:'boolean', description:'true se você não tem certeza da categoria (nome que não está nos apelidos nem nos já usados e que você não conhece)' },
    cartao:{ type:'string', description:'nome exato de um cartão da lista (vista, parcelada, fatura); vazio nos outros' },
    banco:{ type:'string', description:'nome exato de um banco da lista (pix, recebi, saldo; conta se disse de onde pagou); vazio se não sabe' },
    parcelas:{ type:'integer', description:'número de parcelas (parcelada); 1 nos outros' },
    proximaFatura:{ type:'boolean', description:'true se a compra no cartão cai só na próxima fatura' },
    conta:{ type:'string', description:'chave exata da conta da lista (tipo conta); vazio nos outros' }
  }, required:['tipo','descricao','valor','categoria','categoriaDuvida','cartao','banco','parcelas','proximaFatura','conta'] } }
}, required:['transcricao','resposta','aprendidos','itens'] };

/* o que a lista muda em cada cartão e banco (para a IA e para os Detalhes) */
function atzConferencia(itens){
  itens = itens || atzItens;
  const cartoes = (state.cartoesTracker || []).map(c=>{
    const m = faturaAbertaMes(c), noApp = faturaCartaoNoMes(c, m);
    const meus = itens.filter(i=>i.cartaoId === c.id);
    const novos = meus.filter(i=>!i.proximaFatura && (i.tipo === 'vista' || i.tipo === 'parcelada'))
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
    hoje: calISO(new Date()),
    bancos: bancosDoUsuario().map(b=>({ nome: b.nome, saldoNoApp: Number(b.valor) || 0 })),
    cartoes: conf.cartoes.map(x=>({ nome: x.c.nome, faturaAberta: monthLabel(x.m), faturaNoApp: Math.round(x.noApp * 100) / 100, novosNestaConversa: Math.round(x.novos * 100) / 100, faturaInformada: x.informado, faltaParaBater: x.falta })),
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
    const ap = apelidos[atzChaveNome(i.descricao)], apOk = ap && cats.includes(ap.categoria);
    return {
      tipo: i.tipo, descricao: String(i.descricao || '').trim() || (conta ? conta.desc : ''), valor: Math.round(Number(i.valor) * 100) / 100,
      categoria: !comCat ? '' : apOk ? ap.categoria : cats.includes(i.categoria) ? i.categoria : vozAdivinharCategoria(i.descricao),
      duvida: comCat && !apOk && (!!i.categoriaDuvida || !cats.includes(i.categoria)),
      cartaoId: c ? c.id : '', cartaoNome: c ? c.nome : '', bancoId: b ? b.id : '', bancoNome: b ? b.nome : '',
      parcelas: i.tipo === 'parcelada' ? Math.max(2, Math.min(48, parseInt(i.parcelas) || 2)) : 1,
      proximaFatura: !!i.proximaFatura && ['vista','parcelada'].includes(i.tipo), conta: conta ? conta.key : '', ok: false
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
  atzAba = 'conversa'; atzOcupado = true; renderAtualizar(); atzRenderConversa('Ouvindo o áudio…', true);
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
  atzAba = 'conversa'; atzOcupado = true; renderAtualizar(); atzRenderConversa(audio ? 'Ouvindo o áudio…' : 'Entendendo…', true);
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
      `CARTÃO E BANCO: se a lista de cartões tem UM só cartão, toda compra no crédito é nele: preencha e NÃO pergunte qual cartão. O mesmo para banco: com um só banco, use ele. ` +
      `Só pergunte o cartão ou o banco quando houver mais de um e a fala não disser qual. Se faltar o número de parcelas ou algo for ambíguo, deixe vazio e PERGUNTE.\n` +
      `CATEGORIA: a descricao é o nome que a pessoa falou ("Top", "JK", "Drogasil"). Para escolher a categoria, veja primeiro "apelidos" (a pessoa ensinou: vale sempre), ` +
      `depois "nomesJaUsados" (o que ela já lançou e em que categoria), depois o que você sabe de lojas do Brasil. Se ainda não tiver certeza, escolha a mais provável e marque categoriaDuvida true. ` +
      `Se a pessoa disser a categoria junto com o nome ("120 no Top, mercado") ou ensinar ("Top é mercado"), use essa categoria e ponha {nome, categoria} em aprendidos.\n` +
      `NÃO faça contas de quanto falta para bater a fatura ou o saldo: o app calcula e escreve logo depois da sua resposta. ` +
      `O app já pergunta o que falta explicar (fatura e saldo): não repita esses valores. Quando a pessoa contar o que gastou para explicar a diferença, lance como pix (banco) ou vista (cartão). ` +
      `Se ela disser que não lembra o resto ("não sei", "o resto não lembro"), lance um pix "Gasto não identificado" (categoria Outros) no banco com o valor que falta (diferenca do contexto, em positivo), ou uma vista "Compra não identificada" no cartão com faltaParaBater. ` +
      `A pessoa pode corrigir ou tirar itens ("tira a farmácia", "o mercado foi 130"): devolva sempre a lista completa já corrigida. Não invente itens.\n\n` +
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
    atzItens = atzManterConfirmados(antes, atzNormalizarItens(r.itens));
    /* a conta da falta é do app (a IA erra soma): a resposta ganha as linhas com os números certos (aparecem nos Detalhes) */
    const conf = atzConferencia(), contas = [];
    conf.cartoes.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.falta) < 0.01 ? `Fatura ${x.c.nome}: bateu ✓` : x.falta > 0 ? `Fatura ${x.c.nome}: faltam ${fmtMoney(x.falta)} para bater. Que compras faltam?` : `Fatura ${x.c.nome}: passou ${fmtMoney(-x.falta)} do valor do banco. Algum valor ficou errado?`));
    conf.bancos.filter(x=>x.informado !== null).forEach(x=>contas.push(Math.abs(x.dif) < 0.01 ? `Saldo ${x.b.nome}: bateu ✓` : x.dif < 0 ? `${x.b.nome}: faltam ${fmtMoney(-x.dif)} para fechar o saldo. O que mais saiu dele?` : `Saldo ${x.b.nome}: entrou ${fmtMoney(x.dif)} a mais. Recebeu algum valor?`));
    const ks = new Set(antes.map(atzChave)), kn = new Set(atzItens.map(atzChave));
    atzConversa.push({ quem:'ia', texto: String(r.resposta || 'Anotado.').trim(),
      novos: atzItens.filter(i=>!ks.has(atzChave(i))).map(atzChave), tirados: antes.filter(i=>!kn.has(atzChave(i))), contas,
      aprendeu: aprendeu.map(a=>`${a.nome.trim()} → ${a.categoria}`) });
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
/* um item com o círculo de confirmar, a categoria (toque troca) e o × */
function atzItemHtml(i, k, dup){
  const falta = atzFaltaNoItem(i), info = !atzGravavel(i);
  const cats = ['vista','pix'].includes(i.tipo) ? vozCategoriasCartao() : null;
  const onde = [ATZ_TIPOS[i.tipo], i.tipo === 'conta' ? '' : (i.cartaoNome || i.bancoNome), i.tipo === 'parcelada' ? i.parcelas + 'x de ' + fmtMoney(i.valor / i.parcelas) : '', i.proximaFatura ? 'próxima fatura' : ''].filter(Boolean).join(' · ');
  const nome = i.descricao || (i.tipo === 'saldo' ? 'Saldo' : i.tipo === 'fatura' ? 'Fatura' : 'Item');
  const cat = cats ? `<label class="atz-cat${i.duvida ? ' duv' : ''}" title="Trocar a categoria">${escBanco(i.categoria || 'Outros')}${i.duvida ? '?' : ''}<select aria-label="Categoria" onchange="atzTrocarCategoria(${k}, this.value)">${cats.map(c=>`<option${c === i.categoria ? ' selected' : ''}>${escBanco(c)}</option>`).join('')}</select></label>` : '';
  return `<div class="atz-it${i.ok && !falta ? ' ok' : ''}${falta ? ' falta' : ''}${info ? ' info' : ''}${dup ? ' dup' : ''}">
    ${info ? '<span class="atz-chk" title="Valor que você viu no banco">i</span>'
      : `<button type="button" class="atz-chk" ${falta ? 'disabled' : ''} title="${falta ? 'Responda antes: ' + falta : i.ok ? 'Desmarcar' : 'Confirmar'}" aria-label="${i.ok ? 'Desmarcar' : 'Confirmar'}" aria-pressed="${!!i.ok}" onclick="atzConfirmar(${k})">${ATZ_ICO_OK}</button>`}
    <div class="atz-it-txt"><b>${escBanco(nome)}${cat}</b><small>${escBanco(onde)}${falta ? ` <em>${falta}</em>` : ''}${dup ? ` <em class="atz-dup" title="${escBanco(dup.texto)}">${escBanco(dup.curto)}</em>` : ''}</small></div>
    <b class="atz-valor">${fmtMoney(i.valor)}</b>
    <button type="button" class="ico-btn atz-tirar" aria-label="Tirar" title="Tirar" onclick="atzTirarItem(${k})">${CU_ICO.x}</button>
  </div>`;
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
      ? `<div class="atz-msg eu${m.voz ? ' voz' : ''}">${m.voz ? `<span class="atz-aud">${ATZ_ICO_MIC} ${atzTempo(m.dur || 0)}</span>` : ''}${m.texto ? lvEsc(m.texto) : '<span class="atz-aud-espera">…</span>'}</div>`
    : m.erro ? `<div class="atz-msg ia erro">${lvEsc(m.texto)}</div>`
    : `<div class="atz-msg ia">
        ${m.texto ? `<p>${lvEsc(m.texto)}</p>` : ''}
        ${lista(porMsg[mi] || [])}
        ${(m.tirados || []).length ? `<ul class="atz-msg-lista tirados">${m.tirados.map(tirado).join('')}</ul>` : ''}
        ${(m.aprendeu || []).length ? `<div class="atz-aprendeu">Aprendi: ${lvEsc(m.aprendeu.join(', '))}</div>` : ''}
        ${atzDetalhes ? (m.contas || []).map(c=>`<div class="atz-msg-conta${/bateu/.test(c) ? ' ok' : ''}">${lvEsc(c)}</div>`).join('') : ''}
      </div>`).join('')
    + (soltos.length ? `<div class="atz-msg ia">${lista(soltos)}</div>` : '');
  const gravaveis = atzItens.filter(atzGravavel), ok = gravaveis.filter(atzConfirmado).length;
  const total = atzItens.filter(i=>['vista','parcelada','pix','conta'].includes(i.tipo)).reduce((s, i)=>s + i.valor, 0);
  el.classList.toggle('det', atzDetalhes);
  el.innerHTML = `
    <div class="atz-placa">
      <div class="atz-placa-info"><span>Nesta conversa</span><b>${fmtMoney(total)}</b><small>${gravaveis.length ? `${ok} de ${gravaveis.length} confirmado${ok === 1 ? '' : 's'}` : 'nada anotado ainda'}</small></div>
      <button type="button" class="atz-tg${atzDetalhes ? ' on' : ''}" role="switch" aria-checked="${atzDetalhes}" onclick="atzDetalhesAlternar()"><i></i>Detalhes</button>
      ${gravaveis.length ? `<button type="button" class="btn atz-gravar" ${ok ? '' : 'disabled'} onclick="atzGravar()">${ok ? 'Gravar ' + ok : 'Gravar'}</button>` : ''}
    </div>
    <div class="atz-corpo">
      ${atzDetalhes ? `<div class="atz-det">${atzDetalhesHtml(conf)}</div>` : ''}
      <div class="atz-chat"><div class="atz-msgs">${msgs || `<div class="atz-msg ia">Toque no microfone e fale tudo de uma vez, como um áudio. Por exemplo: "gastei 120 no Top no crédito, 45 na farmácia no Pix do Inter e paguei a luz. A fatura do Nubank está 1.850." Cada item aparece aqui com um círculo: toque para confirmar e depois em Gravar.</div>`}
        ${pensando ? `<div class="atz-msg ia pensando"><i></i><i></i><i></i><span>${lvEsc(typeof pensando === 'string' ? pensando : '')}</span></div>` : ''}</div>
        ${atzConversa.length && !pensando ? '<button type="button" class="link-txt atz-limpar" onclick="atzLimpar()">Começar de novo</button>' : ''}</div>
    </div>`;
  /* fala nova: a última mensagem fica logo abaixo da faixa (a resposta inteira à vista) */
  const m = el.querySelector('.atz-msgs'), caixa = document.getElementById('atzConteudo'), placa = el.querySelector('.atz-placa');
  if(rolar && m && caixa) requestAnimationFrame(()=>{
    const ult = m.lastElementChild; if(!ult) return;
    const topo = ult.getBoundingClientRect().top - caixa.getBoundingClientRect().top + caixa.scrollTop - (placa ? placa.offsetHeight : 0) - 12;
    caixa.scrollTo({ top: Math.max(0, topo), behavior:'smooth' });
  });
}
function atzDetalhesAlternar(){
  atzDetalhes = !atzDetalhes;
  try{ localStorage.setItem('siloe-atz-detalhes', atzDetalhes ? '1' : '0'); }catch(e){}
  atzRenderConversa();
}
function atzConfirmar(k){ const i = atzItens[k]; if(!i || atzFaltaNoItem(i)) return; i.ok = !i.ok; renderAtualizar(); }
function atzTirarItem(k){ atzItens.splice(k, 1); renderAtualizar(); }
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
  const comSaldo = new Set(itens.filter(i=>i.tipo === 'saldo').map(i=>i.bancoId)), n = itens.length;
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
const ATZ_SILENCIO = 2500, ATZ_GRAV_MAX = 180;
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
