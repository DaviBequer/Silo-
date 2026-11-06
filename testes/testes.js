/* Testes automáticos do Siloé — rodar numa aba ?teste (não grava nada):
   carregar /testes/testes.js e chamar  await rodarTestes()  → devolve { ok, falhas, total }.
   Os testes usam dados de mentira e devolvem os dados reais no fim. */
async function rodarTestes(){
  const resultados = [];
  const t = (nome, cond, detalhe) => resultados.push({ nome, ok: !!cond, detalhe: cond ? '' : (detalhe === undefined ? '' : JSON.stringify(detalhe)) });
  const igual = (nome, obtido, esperado) => t(nome, JSON.stringify(obtido) === JSON.stringify(esperado), { obtido, esperado });
  const perto = (nome, obtido, esperado) => t(nome, Math.abs(obtido - esperado) < 0.005, { obtido, esperado });
  const real = state;
  const M = mesFinanceiroAtual();
  try{
    /* ---------- utilidades ---------- */
    perto('parseMoney 1.234,56', parseMoney('1.234,56'), 1234.56);
    perto('parseMoney vazio', parseMoney(''), 0);
    igual('addMonths vira o ano', addMonths('2026-12', 1), '2027-01');
    igual('addMonths para trás', addMonths('2027-01', -2), '2026-11');
    const el = { value: '123456' }; maskMoneyInput(el); igual('máscara de dinheiro', el.value, '1.234,56');
    igual('fmtMoney', fmtMoney(1234.5).replace(/\s/g, ' '), 'R$ 1.234,50');
    igual('dias do mês (fev bissexto)', daysInMonth('2028-02'), 29);

    /* ---------- contas do mês ---------- */
    state = novoEstado();
    state.incluirGeral = { cartao:false, emprestimo:false, meses:{} };
    const ex = state.users.davi.expenses;
    ex.fixo.push({ id:'f1', desc:'Luz', valor:100 }, { id:'f2', desc:'Água', valor:80 });
    ex.moradia.push({ id:'m1', desc:'Aluguel', valor:900, mesInicio: addMonths(M, 1) });   // ainda não começou
    ex.futuro.push({ id:'p1', desc:'Geladeira', valor:300, parcelas:3, mesInicio: addMonths(M, -1) });
    perto('gastos: fixos + parcela, sem o que não começou', expensesForMonth('davi', M), 480);
    state.paid[M + '_davi_fixo_f2'] = true;
    perto('conta paga sai da soma', expensesForMonth('davi', M), 400);
    state.pagamentosParciais[M + '_davi_fixo_f1'] = 40;
    perto('pagamento parcial: só o que falta', expensesForMonth('davi', M), 360);
    perto('aluguel começa no mês seguinte', expensesForMonth('davi', addMonths(M, 1)), 100 + 80 + 900 + 300);
    perto('parcela acaba depois da 3ª', expensesForMonth('davi', addMonths(M, 2)), 100 + 80 + 900);
    igual('lista de gastos do mês', gastosDoMes('davi', M).map(g=>[g.desc, g.restante]), [['Luz', 60], ['Água', 0], ['Geladeira', 300]]);
    /* todas as telas leem a mesma lista (v17.0): conta arquivada some de todas; parcela k/n no nome */
    ex.fixo.push({ id:'fa', desc:'Academia', valor:50, arquivado:true });
    igual('Contas do mês sem a arquivada, em ordem, com a parcela', getContasDoMes(M, 'davi').map(c=>c.desc), ['Luz', 'Água', 'Geladeira (2/3)']);
    perto('"Para onde vai" bate com o que falta', (b=>b.fixo + b.futuro)(expenseBreakdownForMonth('davi', M)), 360);
    igual('contas em aberto', contasEmAbertoNoMes(M), 2);
    perto('blocos: total e falta das contas', (d=>d.totContas * 1000 + d.faltaContas)(blocosMesDados('davi', M)), 480 * 1000 + 360);
    state.users.davi.saldoAtual = 1000;
    perto('saldo do mês = saldo em conta − o que falta', saldoForMonth('davi', M), 1000 - 360);

    /* ---------- meta das vendas ---------- */
    garantirVendas().metas[M] = 1500;
    perto('meta: contas sobram → a meta inteira vem das vendas', vendasAlvoComissao(M, 800), 1500);
    perto('meta: contas faltam → cobre a falta + a meta', vendasAlvoComissao(M, -536.64), 2036.64);
    igual('meta: mês sem meta', vendasAlvoComissao(addMonths(M, 5), 0), null);

    /* ---------- ponto ---------- */
    igual('ponto: dia normal 9h', dayTotalMinutes({ entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:'17:00', extra:0 }), 540);
    igual('ponto: com 30 min de extra', dayTotalMinutes({ entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:'16:00', extra:30 }), 510);
    igual('ponto: só manhã', dayTotalMinutes({ entrada:'08:00', almocoSaida:'12:00', almocoVolta:null, saida:null, extra:0 }), 240);
    igual('ponto: folga', dayTotalMinutes({ entrada:null, almocoSaida:null, almocoVolta:null, saida:null, extra:0 }), 0);
    const hoje = new Date(); hoje.setHours(12,0,0,0);
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const dia = { entrada:'07:00', almocoSaida:'12:00', almocoVolta:'13:00', saida:'17:00', extra:0 };
    igual('ponto: hoje fica aberto', pontoDiaPrecisaAtencao(dia, hoje, hoje, true, false), true);
    igual('ponto: dia trancado fecha', pontoDiaPrecisaAtencao({ ...dia, concluido:true }, ontem, hoje, false, false), false);
    igual('ponto: dia que não chegou fecha', pontoDiaPrecisaAtencao(dia, amanha, hoje, false, false), false);
    igual('ponto: passou sem trancar fica aberto', pontoDiaPrecisaAtencao(dia, ontem, hoje, false, false), true);

    /* ---------- mescla entre aparelhos ---------- */
    igual('mescla: cada lado mudou um campo', mesclarValor({ a:1, b:1 }, { a:2, b:1 }, { a:1, b:3 }), { a:2, b:3 });
    igual('mescla: mesmo campo → vence este aparelho', mesclarValor({ a:1 }, { a:2 }, { a:3 }), { a:2 });
    igual('mescla: listas item a item', mesclarValor(
      [{ id:1, v:'a' }, { id:2, v:'b' }],
      [{ id:1, v:'A' }, { id:2, v:'b' }],
      [{ id:1, v:'a' }, { id:2, v:'B' }, { id:3, v:'c' }]
    ), [{ id:1, v:'A' }, { id:2, v:'B' }, { id:3, v:'c' }]);
    igual('mescla: item apagado de um lado some', mesclarValor([{ id:1 }, { id:2 }], [{ id:1 }], [{ id:1 }, { id:2 }]), [{ id:1 }]);

    /* ---------- louvor: tom e medley ---------- */
    igual('tom: C sobe 2 = D', lvTransposeChord('C', 2, 'D', 'C'), 'D');
    igual('tom: baixo junto (G/B → A/C#)', lvTransposeChord('G/B', 2, 'D', 'C'), 'A/C#');
    state.louvores = [{ id:'s1', titulo:'Hino Teste', tomOriginal:'C', conteudo:'[Refrão]\nC      G\nSanto, santo\n--\n[Ponte]\nF\nGlória' }];
    igual('medley: partes da música', lmPartes(state.louvores[0]).map(p=>p.nome), ['Refrão', 'Ponte']);
    const md = { musicas:[{ id:'s1', tom:'D', menor:false }], seq:[{ id:'s1', parte:'Refrão' }, { id:'s1', parte:'Refrão' }, { id:'s1', parte:'Ponte' }, { id:'s1', parte:'Refrão' }] };
    const txt = lmGerarTexto(md);
    t('medley: nome e tom da música', txt.includes('[♪ Hino Teste — Tom D]'), txt);
    t('medley: refrão seguido vira 2x', txt.includes('[Refrão | 2x]'), txt);
    t('medley: acordes no tom novo', /^D\s+A$/m.test(txt), txt);
    t('medley: volta do refrão vira Repete', txt.includes('[Repete - Refrão]'), txt);

    /* ---------- slides: "-" sozinho nas partes grandes ---------- */
    const seis = '[Refrão]\nC\nL1\nL2\nG\nL3\nL4\nL5\nL6';
    igual('slides: acorde vai junto com a letra', lvQuebrarSlides('[R]\nL1\nL2\nL3\nG\nL4\nL5\nL6'), '[R]\nL1\nL2\nL3\n-\nG\nL4\nL5\nL6');
    igual('slides: posição do corte', lvQuebrarSlides(seis), '[Refrão]\nC\nL1\nL2\nG\nL3\n-\nL4\nL5\nL6');
    igual('slides: 5 linhas curtas ficam juntas; 5 compridas viram 3+2; 7 = 4+3', [lvDivisaoSlides(['a','b','c','d','e']), lvDivisaoSlides(['Faz romper muitas fontes em meio ao deserto','b','c','d','e']), lvDivisaoSlides(['1','2','3','4','5','6','7'])], [[5],[3,2],[4,3]]);
    igual('slides: parte grande sem "-" divide na hora', lvParseContent('[A]\n1\n2\n3\n4\n5\n6').slides.map(s=>s.lines.length), [3,3]);
    igual('slides: parte pequena não muda', lvQuebrarSlides('[A]\nL1\nL2\nL3\nL4'), '[A]\nL1\nL2\nL3\nL4');
    igual('slides: "-" que já existe conta', lvQuebrarSlides('[A]\nL1\nL2\nL3\n-\nL4\nL5\nL6'), '[A]\nL1\nL2\nL3\n-\nL4\nL5\nL6');
    igual('vezes: lê "| 2x" e o jeito antigo', ['Refrão | 2x','Refrão 3x','Refrão (2x)','Parte 2'].map(x=>lvVezesDoRotulo(x).vezes), [2,3,2,1]);
    igual('vezes: Repete logo depois vira 2x', lvNormalizarVezes('[Refrão]\nL1\n--\n[Repete - Refrão]\n--\n[Ponte]\nP\n--\n[Repete - Refrão 2x]'), '[Refrão | 2x]\nL1\n--\n[Ponte]\nP\n--\n[Repete - Refrão | 2x]');
    igual('vezes: organizar junta bloco repetido e "(3x)"', lviBlocosParaTexto(lviMontaBlocos(lviTextoParaLinhas('[Refrão]\nsanto\ndigno\nsanto\ndigno\n\n[Ponte]\nglória\n(3x)')).secoes), '[Refrão | 2x]\nSanto\nDigno\n--\n[Ponte | 3x]\nGlória');
    igual('vezes: slide sabe o 2x (e o Repete usa o dele)', lvParseContent('[Refrão | 2x]\nL1\n--\n[Ponte]\nP\n--\n[Repete - Refrão]').slides.map(s=>s.vezes), [2,1,1]);
    /* salvar e redesenhar (v17.4): várias mudanças seguidas = um aviso só, depois da ação */
    let avisos = 0; aoMudarEstado(()=>{ avisos++; });
    avisarMudanca(); avisarMudanca(); avisarMudanca();
    const avisosNaHora = avisos; await Promise.resolve(); await Promise.resolve();
    igual('salvar: 3 mudanças seguidas → 1 redesenho, depois da ação', [avisosNaHora, avisos], [0, 1]);
    ouvintesEstado.pop();
    /* module Cifra (v17.3): um lugar só sabe o que é cada linha */
    const cifraT = '[Intro]\nG  D/F#  Em\n\n[Refrão | 2x]\n   C        G\nSanto é o Senhor\n-\nDigno de louvor\n--\n---';
    igual('cifra: tipo de cada linha', cifraT.split('\n').map(lvTipoLinha), ['parte','acorde','vazia','parte','acorde','letra','marca','letra','marca','marca']);
    igual('cifra: nomes das partes', lvRotulosDe(cifraT), ['Intro', 'Refrão | 2x']);
    igual('cifra: só a letra', lvSoLetra(cifraT), ['Santo é o Senhor', 'Digno de louvor']);
    igual('cifra: realce do editor', ['[Intro]', 'G  D', '-', 'Santo'].map(x=>lvRealceLinha(x, new Set(['Santo'])).replace(/>.*$/, '>')), ['<span class="rl-bloco">', '<span class="rl-acorde">', '<span class="rl-marca">', '<span class="rl-olhar">']);
    igual('créditos saem, letra fica', ['Composta por Fulano','feat. Ciclano','Ministério: Zoe','(Ao vivo)','@cantor.oficial','Autor da minha fé','Santo, santo','Instrumental'].map(lviEhInfoNaoLetra), [true,true,true,true,true,false,false,false]);
    const comIntro = lviBlocosParaTexto(lviMontaBlocos(lviTextoParaLinhas('[Introdução]\nD   A   G\n\nComposição: Fulano\nOlha eu aqui\n\n[Refrão]\nSanto é o Senhor')).secoes);
    igual('Introdução fica; créditos no meio saem', comIntro, '[Introdução]\nD   A   G\n--\n[Primeira Parte]\nOlha eu aqui\n--\n[Refrão]\nSanto é o Senhor');
    igual('texto: Deus, Ele, Tu com maiúscula; início maiúsculo; sem ponto no meio', lviCorrigirLinha({ text:'  eu sei que ele VIVE. jesus  é o senhor.', chords:[] })[0].text, 'Eu sei que Ele vive Jesus é o Senhor');
    igual('texto: acordes acompanham quando sai espaço/ponto', lviCorrigirLinha({ text:'a  b. c', chords:[{name:'D', idx:6}] })[0].chords[0].idx, 4);
    igual('texto: nome próprio fica, verso grande quebra na vírgula', lviCorrigirLinha({ text:'Glória a Israel nas alturas, paz na terra aos homens de boa vontade', chords:[] }).map(r=>r.text), ['Glória a Israel nas alturas,', 'Paz na terra aos homens de boa vontade']);
    const lt = lviJuntarComLetras('[Intro]\nD  A\n\nD           A\nsanto santo santo é o senhor deus do céu e da terra\nG\ndigno\n\n[Refrão]\nE\naleluia aleluia', [['Santo, santo, santo é o Senhor', 'Deus do céu e da terra digno'], ['Aleluia, aleluia'], ['Santo, santo, santo é o Senhor', 'Deus do céu e da terra digno'], ['Aleluia, aleluia']]);
    t('Letras: acordes do Cifra Club na letra do Letras', lt && lt.texto.startsWith('[Intro]\nD   A') && lt.texto.includes('D             A\nSanto, santo, santo') && lt.texto.includes('                       G\nDeus do céu e da terra digno') && lt.texto.includes('[Refrão]\nE\nAleluia'), lt && lt.texto);
    const ltDoc = lviMontaBlocos(lviTextoParaLinhas(lt ? lt.texto : ''));
    t('Letras: refrão repetido vira "Repete - Refrão"', lviBlocosParaTexto(ltDoc.secoes).includes('[Repete - Refrão]'), lviBlocosParaTexto(ltDoc.secoes));
    igual('Cifra Club: espaço invisível no começo da linha não esconde os acordes', lviTextoParaLinhas('​D        A\n​Santo santo é o Senhor').map(r=>r.type + ':' + (r.chords || []).length), ['lyric:2']);
    /* v14.8: compra com o nome e o valor de uma conta paga a conta; compra pequena só desconta (conta-limite) */
    {
      const vv = { e: state.users.davi.expenses, p: state.paid, cv: state.cartoesTracker, la: state.lancamentos };
      state.users.davi.expenses = { moradia:[], assinatura:[], fixo:[], futuro:[] }; state.paid = {};
      const m = mesFinanceiroAtual();
      state.users.davi.expenses.assinatura = [{ id:'tsp', desc:'Spotify', valor:21.9, dia:8 }];
      state.users.davi.expenses.fixo = [{ id:'tme', desc:'Mercado', valor:850, dia:5 }];
      state.cartoesTracker = [{ id:'tc', nome:'Nubank', fechamento:5, vencimento:12, credoVista:[{ id:'cv1', descricao:'Top', valor:1200, categoria:'Mercado', mKey:m, data:'2026-10-25' }], assinaturas:[] }];
      state.lancamentos = [];
      igual('Spotify no cartão marca a conta Spotify como paga', atzContasPagasPeloItem([{ tipo:'vista', descricao:'Spotify', valor:21.9 }]).map(c=>c.desc), ['Spotify']);
      igual('Mercado 10 não marca a conta Mercado inteira', atzContasPagasPeloItem([{ tipo:'pix', descricao:'Mercado', valor:10 }]).length, 0);
      const cm = contaPorNome('mercado', m);
      igual('conta-limite: gasto e quanto passou', [cm && cm.limite, cm && cm.gasto], [850, 1200]);
      state.users.davi.expenses = vv.e; state.paid = vv.p; state.cartoesTracker = vv.cv; state.lancamentos = vv.la;
    }
    /* v15.5: fatura antes do controle do cartão (parcelada antiga sem as compras à vista da época) fica de fora */
    {
      const fa = '2026-11', c = { id:'tctl', nome:'X', fechamento:5, vencimento:12, credoVista:[{ id:'a', valor:300, mKey: fa }], assinaturas:[] };
      const cp0 = state.comprasTracker; state.comprasTracker = [{ id:'tp', cartaoId:'tctl', valorTotal:1200, parcelas:12, mesInicio: addMonths(fa, -8) }];
      igual('controle automático = 1ª compra à vista; antes fica 0; depois conta', [cartaoControleDesde(c), faturaCartaoNoMes(c, addMonths(fa, -2)), faturaCartaoNoMes(c, fa)], [fa, 0, 400]);
      c.controleDesde = addMonths(fa, -3);
      igual('controle escolhido à mão', [faturaCartaoNoMes(c, addMonths(fa, -3)), faturaCartaoNoMes(c, addMonths(fa, -4))], [100, 0]);
      state.comprasTracker = cp0;
    }
    /* capotraste: Cifra Club "Tom: F# (com forma de E) · Capotraste 2ª casa" — a cifra vem na forma E */
    const ousado = '[Intro] C#m  B4  A9  E\n\n[Primeira Parte]\nC#m        B4\nAntes de eu falar\nA9            E\nTu cantavas sobre mim\n\n[Refrão]\nE\nOh, impressionante\nB4          C#m   A9\nInfinito e ousado amor';
    igual('capo: a página diz a casa', ccCapoDaCifra({ capo: 2 }, 'F#', ousado), 2);
    igual('capo: "com forma de E" com tom F#', ccCapoDaCifra({ forma: 'E' }, 'F#', ousado), 2);
    igual('capo: descoberto pelos acordes (forma E, tom F#)', ccCapoDaCifra({}, 'F#', ousado), 2);
    igual('capo: acordes já no tom da página = sem capo', ccCapoDaCifra({}, 'E', ousado), 0);
    const lc = { tomOriginal: 'F#', tomModoMenor: false, transpose: 0, capo: 2, conteudo: 'E  B4\nOh' };
    igual('capo: forma de E com tom F#', [lvFormaAtual(lc), lvTomAtual(lc)], ['E', 'F#']);
    lvMudarCapo(lc, 0);
    igual('capo: tirar o capo escreve os acordes no tom que soa', [lc.conteudo.split('\n')[0].trim().split(/\s+/), lvTomAtual(lc)], [['F#', 'C#4'], 'F#']);
    lvMudarCapo(lc, 4);
    igual('capo na 4ª: forma de D, continua soando F#', [lc.conteudo.split('\n')[0].trim().split(/\s+/), lvFormaAtual(lc), lvTomAtual(lc)], [['D', 'A4'], 'D', 'F#']);
    t('Letras: outra música não junta',lviJuntarComLetras('D\nsanto santo santo', [['Outra letra que não tem nada a ver']]) === null);
    const harpa = lviPadraoHarpa(lviMontaBlocos(lviTextoParaLinhas('[Primeira Parte]\num dois três\n\n[Refrão]\nquatro cinco\n\n[Segunda Parte]\nseis sete\n\n[Terceira Parte]\noito nove')).secoes);
    igual('Harpa: refrão depois de cada parte', harpa.map(s=>s.repeatOf ? 'R' : s.name), ['Primeira Parte', 'Refrão', 'Segunda Parte', 'R', 'Terceira Parte', 'R']);
    igual('PDF do Siloé: rótulos com letras espaçadas', ['I N T R O','P R I M E I R A PA R T E','R E F R Ã O | 2 x','R E P E T E - R E F R Ã O','Santo é o Senhor'].map(lviRotuloDe), ['Intro','Primeira Parte','Refrão | 2x','Repete - Refrão',null]);
    igual('IA: instruções do usuário e modo fiel no pedido', [lviRegrasIA().includes('INSTRUÇÕES DO USUÁRIO'), lviRegrasIA().includes('MODO FIEL')], [true, false]);
    igual('slides: 9 linhas viram 3+3+3', (lvQuebrarSlides('[A]\n1\n2\n3\n4\n5\n6\n7\n8\n9'.replace(/\d/g, d=>'linha '+d)).match(/^-$/gm) || []).length, 2);

    /* ---------- importação: acordes na sílaba certa pelo PDF ---------- */
    const linhas = [{ type:'lyric', text:'Louvai a Jesus', chords:[{ name:'D', idx:0 }, { name:'Bm', idx:5 }] }];
    lviCorrigirAcordesPeloPdf(linhas, [{ text:'Louvai a Jesus', chords:[{ name:'D', idx:0 }, { name:'Bm', idx:9 }] }]);
    igual('importação: acorde vai para a posição do PDF', linhas[0].chords.map(c=>c.idx), [0, 9]);
    t('importação: linha marcada como conferida', linhas[0].conferido === true);

    /* ---------- ditado do cartão ---------- */
    state.cartoesTracker = [{ id:'c1', nome:'Inter', fechamento:5, vencimento:12, credoVista:[], assinaturas:[] }];
    state.users.davi.bancos = [{ id:'b1', nome:'Nubank', valor:100 }];
    const dit = vozEntenderSimples('no cartão Inter: mercado 120, farmácia 45,50 e uber 18', bancosDoUsuario(), []);
    igual('cartão: entende como compras no cartão', [dit.acao, dit.cartao], ['cartao', 'Inter']);
    igual('cartão: separa as compras com categoria', dit.itens.map(i=>[i.descricao, i.valor, i.categoria]), [['Mercado',120,'Mercado'],['Farmácia',45.5,'Farmácia'],['Uber',18,'Transporte']]);
    igual('cartão: compra no banco continua compra', vozEntenderSimples('comprei 50 no mercado no Nubank', bancosDoUsuario(), []).acao, 'compra');

    /* ---------- para onde vai o dinheiro ---------- */
    state.cartoesTracker[0].credoVista.push({ id:'v1', descricao:'Mercado', valor:200, categoria:'Mercado', mKey:M });
    const ov = ondeVaiDados('davi', M);
    const cv = ov.find(d=>d.nome === 'Cartão à vista');
    t('gráfico: cartão à vista com as categorias', cv && cv.v === 200 && cv.sub[0][0] === 'Mercado', ov);
    t('gráfico: contas entram pelo grupo', ov.some(d=>d.nome === 'Fixos' && Math.abs(d.v - 180) < 0.01), ov);
    ex.fixo.push({ id:'f3', desc:'Mercado', valor:850 });
    const ov2 = ondeVaiDados('davi', M);
    t('gráfico: mercado no cartão desconta da conta Mercado', ov2.some(d=>d.nome === 'Fixos' && Math.abs(d.v - (180 + 650)) < 0.01), ov2);
    perto('conta Mercado: falta só o que não foi no cartão', gastosDoMes('davi', M).find(g=>g.desc === 'Mercado').restante, 650);
    state.cartoesTracker[0].credoVista[0].valor = 900;
    perto('conta Mercado: cartão passou da conta → falta 0', gastosDoMes('davi', M).find(g=>g.desc === 'Mercado').restante, 0);
    state.cartoesTracker[0].credoVista[0].valor = 200;
    ex.fixo.pop();

    /* ---------- culto ---------- */
    state.cultos = [{ id:'cu1', data:'2020-01-05', partes:[{ id:'p1', nome:'Hinos', quem:'Davi', musicas:['s1'] }] }];
    const txtCulto = cultoTexto(state.cultos[0]);
    t('culto: texto do WhatsApp é a lista numerada', txtCulto.includes('1. Hino Teste - C') && !txtCulto.includes('Hinos'), txtCulto);
    state.louvores.push({ id:'s2', titulo:'Outro Hino', tomOriginal:'G', conteudo:'' });
    state.cultos[0].partes.push({ id:'p2', nome:'Final', quem:'', musicas:['s2'] });
    state.cultos[0].ordemWhats = ['s2'];
    igual('culto: ordem do WhatsApp não mexe nas partes', [cultoTexto(state.cultos[0]).split('\n').slice(2), state.cultos[0].partes.map(p=>p.nome)], [['1. Outro Hino - G', '2. Hino Teste - C'], ['Hinos', 'Final']]);
    let erroTela = '';
    try{ cultoData = '2020-01-05'; cultoAba = 'roteiro'; renderCulto(); cultoNovaParte(); renderCultoHistorico(); renderCultoBotao(); }catch(e){ erroTela = String(e && e.stack || e); }
    t('culto: telas desenham sem erro e Adicionar parte funciona', !erroTela && state.cultos[0].partes.length === 3, erroTela || state.cultos[0].partes.length);
    state.cultos[0].partes.pop(); cultoData = '';
    const hist = cultoHistoricoDados();
    igual('culto: histórico conta a música tocada', hist.map(h=>[h.l.id, h.n]).sort(), [['s1', 1], ['s2', 1]]);

    /* ---------- assistente ---------- */
    const cats = vozCategoriasCartao();
    igual('assistente: categoria sai do nome', ['Mercado Top', 'mercado do Top', 'Farmácia Drogasil', 'supermercado Angeloni', 'Mercado'].map(d=>atzLimparNome(d, cats)),
      [{ nome:'Top', cat:'Mercado' }, { nome:'Top', cat:'Mercado' }, { nome:'Drogasil', cat:'Farmácia' }, { nome:'Angeloni', cat:'Mercado' }, { nome:'Mercado', cat:'Mercado' }]);
    const cInter = state.cartoesTracker[0];   // fechamento dia 5
    igual('assistente: fatura pela data (antes, no dia e depois do fechamento)', ['2026-10-04', '2026-10-05', '2026-10-20'].map(d=>atzFaturaDaData(cInter, d)), ['2026-10', '2026-11', '2026-11']);
    igual('assistente: fatura em dezembro vira o ano', atzFaturaDaData(cInter, '2026-12-28'), '2027-01');
    const depoisDeHoje = new Date(); depoisDeHoje.setDate(depoisDeHoje.getDate() + 1);
    igual('assistente: data no futuro vira hoje', atzDataValida(calISO(depoisDeHoje)), calISO(new Date()));
    igual('assistente: data inválida vira hoje', atzDataValida('25/10'), calISO(new Date()));
    const norm = atzNormalizarItens([{ tipo:'vista', descricao:'mercado Top', valor:80, categoria:'', categoriaDuvida:false, cartao:'', banco:'', parcelas:1, data:'2026-10-04', proximaFatura:false, conta:'' },
      { tipo:'pix', descricao:'Padaria', valor:18, categoria:'Alimentação', categoriaDuvida:false, cartao:'', banco:'', parcelas:1, data:'', proximaFatura:false, conta:'' }]);
    igual('assistente: um só cartão e um só banco são usados sem perguntar', norm.map(i=>[i.descricao, i.categoria, i.cartaoNome || i.bancoNome, atzFaltaNoItem(i)]), [['Top', 'Mercado', 'Inter', ''], ['Padaria', 'Alimentação', 'Nubank', '']]);
    const itensAntes = atzItens;
    atzItens = norm;
    cInter.credoVista.push({ id:'cvdup', descricao:'Top', valor:80, categoria:'Mercado', mKey:M, criadoEm: Date.now() - 864e5 });
    atzItens.push(Object.assign({}, norm[1]));
    const dups = atzDuplicados();
    igual('assistente: acha repetido no app e repetido na conversa', dups.map(d=>d ? d.curto.split(' em ')[0] : null), ['já lançado', null, 'repetido nesta conversa']);
    cInter.credoVista.pop();
    atzItens = itensAntes;
    let erroAtz = '';
    try{ atzConversa = [{ quem:'eu', texto:'teste' }, { quem:'ia', texto:'Anotado.', novos: norm.map(atzChave) }]; atzItens = norm; atzRenderConversa(); atzDetalhes = true; atzRenderConversa(); atzDetalhes = false; atzAba = 'passo'; atzRenderConversa(); atzAba = 'conversa'; }
    catch(e){ erroAtz = String(e && e.stack || e); }
    finally{ atzConversa = []; atzItens = []; }
    t('assistente: tela desenha sem erro (conversa, detalhes, passo a passo)', !erroAtz, erroAtz);

    /* ---------- faturas do cartão ---------- */
    const cF = { id:'cf', nome:'Teste', fechamento:6, vencimento:12, credoVista:[{ id:'v9', descricao:'Loja', valor:100, categoria:'Outros', mKey:M }], assinaturas:[{ id:'a9', nome:'Música', valor:20, mesInicio: addMonths(M, -2) }] };
    state.cartoesTracker.push(cF);
    state.comprasTracker = [{ id:'cp9', nome:'TV', cartaoId:'cf', valorTotal:300, parcelas:3, mesInicio: addMonths(M, -1) }];
    perto('fatura: à vista + parcela + assinatura', faturaCartaoNoMes(cF, M), 100 + 100 + 20);
    perto('fatura: parcela acaba depois da 3ª', faturaCartaoNoMes(cF, addMonths(M, 2)), 20);
    /* module Fatura (v17.1): partes, data, vencimento e situação num lugar só */
    igual('fatura: partes (à vista, parcela k de n, assinatura)', (f=>[f.totalVista, f.parcelas.map(p=>[p.k, p.n, p.valor]), f.totalAssinaturas])(faturaPartes(cF, M)), [100, [[2, 3, 100]], 20]);
    igual('fatura: em qual fatura cai a compra', ['2026-10-05', '2026-10-06', '2026-12-31'].map(d=>faturaDaData(cF, d)), ['2026-10', '2026-11', '2027-01']);
    igual('fatura: aberta hoje', faturaAbertaMes(cF, new Date(2026, 9, 6)), '2026-11');
    igual('fatura: mês pelo vencimento (vence depois do fechamento)', faturaDoVencimento(cF, '2026-11-12'), '2026-11');
    igual('fatura: mês pelo vencimento (vence antes do fechamento)', faturaDoVencimento({ fechamento:25, vencimento:3 }, '2026-11-03'), '2026-10');
    const dM = keyToDate(M), diaM = d=>new Date(dM.getFullYear(), dM.getMonth(), d);
    igual('fatura: situação antes, depois do fechamento e vencida', [faturaStatus(cF, M, diaM(3)).st, faturaStatus(cF, M, diaM(8)).st, faturaStatus(cF, M, diaM(20)).st], ['aberto', 'fechado', 'vencido']);
    state.faturasCartao = { ['cf_' + M]: { pago: 50 } };
    igual('fatura: pagou uma parte', (s=>[s.st, s.resta])(faturaStatus(cF, M, diaM(8))), ['parcial', 170]);
    state.faturasCartao = {};
    /* module Lançamentos (v17.2): toda gravação de gasto sai no mesmo formato */
    state.comprasTracker = [];
    const cvA = lancarVista(cF, { descricao:'Pão', valor:10.006, categoria:'Mercado', data:'2026-10-05' }), cvB = lancarVista(cF, { valor:5, data:'2026-10-06' });
    igual('lançar à vista: fatura pela data, nome padrão, valor arredondado', [cvA.mKey, cvB.mKey, cvB.descricao, cvA.valor, cvA.id !== cvB.id], ['2026-10', '2026-11', 'Crédito à vista', 10.01, true]);
    const cpA = lancarParcelada(cF, { nome:'Sofá', valorTotal:1200, parcelas:4, data:'2026-10-06' });
    igual('lançar parcelada: 1ª parcela na fatura da data', [cpA.mesInicio, cpA.cartaoId, compraParcelaNoMes(cpA, '2026-11').valor], ['2026-11', 'cf', 300]);
    const laA = lancarPix({ descricao:'Feira', valor:30, banco:'Nubank', mKey:M });
    igual('lançar Pix: registro com usuário e banco', [laA.mKey, laA.usuario, laA.banco, laA.categoria], [M, state.currentUser, 'Nubank', 'Outros']);
    state.pagamentosParciais = { ['x_k']: 20 };
    marcarContaPaga('x_k');
    igual('pagar conta: paga e tira o pagamento parcial', [state.paid['x_k'], 'x_k' in state.pagamentosParciais], [true, false]);
    marcarContaPaga('x_k', false);
    igual('desmarcar conta paga', state.paid['x_k'], false);

    /* conta variável: valor exato só no mês pago; conta fixa ignora */
    const exTeste = state.users.davi.expenses.fixo;
    exTeste.push({ id:'tvar', desc:'Luz var', valor:100, dia:9, tipo:'variavel' }, { id:'tfix', desc:'Fixa', valor:50, dia:9 });
    const mProx = addMonths(M, 1), kVar = M+'_davi_fixo_tvar', kFix = M+'_davi_fixo_tfix';
    const vDe = (m, id)=>gastosDoMes('davi', m).find(g=>g.id === id).valor;
    marcarContaPaga(kVar, true, 143.2); marcarContaPaga(kFix, true, 70);
    igual('conta variável: exato no mês pago, aproximado no próximo, fixa não muda', [vDe(M,'tvar'), vDe(mProx,'tvar'), vDe(M,'tfix')], [143.2, 100, 50]);
    marcarContaPaga(kVar, false);
    igual('desmarcar conta variável volta ao aproximado', vDe(M,'tvar'), 100);
    state.users.davi.expenses.fixo = exTeste.filter(i=>i.id !== 'tvar' && i.id !== 'tfix');

    /* ganho: soma no banco escolhido, desmarcar devolve no mesmo banco */
    const usG = state.users.davi, bancosG = usG.bancos, saldoG = usG.saldoAtual;
    usG.bancos = [{ id:'a', nome:'A', valor:10 }, { id:'b', nome:'B', valor:20 }];
    registrarGanho('davi', 'sal_t', 100.5, 'B');
    igual('ganho soma só no banco escolhido e no saldo', [usG.bancos[0].valor, usG.bancos[1].valor, usG.saldoAtual], [10, 120.5, 130.5]);
    usG.bancos = usG.bancos.map(b=>({ ...b, id: b.id + 'novo' }));   // salvarBancos troca os ids
    desfazerGanho('davi', 'sal_t');
    igual('desmarcar ganho devolve, mesmo com id novo', [usG.bancos[1].valor, usG.saldoAtual, 'sal_t' in state.ganhoNoBanco], [20, 30, false]);
    desfazerGanho('davi', 'sal_t');
    igual('ganho antigo sem registro: desmarcar não mexe no saldo', usG.bancos[1].valor, 20);
    usG.bancos = bancosG; usG.saldoAtual = saldoG;
    state.lancamentos = state.lancamentos.filter(l=>l !== laA); cF.credoVista = cF.credoVista.filter(cv=>cv !== cvA && cv !== cvB);
    state.comprasTracker = []; state.cartoesTracker.pop();

    /* importar planilha (v17.8): ler as linhas, gravar no mês escolhido e "do zero" */
    const cImp = { id:'cimp', nome:'Nubank', fechamento:5, vencimento:12, credoVista:[] };
    state.cartoesTracker.push(cImp);
    igual('planilha: valor e data em vários jeitos', [impValor('R$ 1.234,56'), impValor(23.5), impValor('10.5'), impData('05/10/2026'), impData('5/1/26'), impData(46300)], [1234.56, 23.5, 10.5, '2026-10-05', '2026-01-05', '2026-10-05']);
    const impL = impInterpretar([
      ['Data', 'Nome', 'Categoria', 'Valor total', 'Forma', 'Cartão ou banco', 'Tipo', 'Parcelas'],
      ['05/10/2026', 'Mercado', 'Mercado', 'R$ 100,00', 'Cartão', 'nubank', 'À vista', ''],
      ['12/10/2026', 'Tênis', 'Lazer', 300, 'Cartão', 'Nubank', 'Parcelado', 3],
      ['18/10/2026', 'Padaria', '', 20, 'Pix', 'Banco X', '', ''],
      ['', 'Sem valor', '', '', 'Cartão', 'Nubank', '', ''],
      ['', 'Cartão errado', '', 50, 'Cartão', 'Itaú Black', '', ''] ]);
    igual('planilha: tipo de cada linha e o que tem problema', impL.map(l=>[l.tipo, l.parcelas, l.cat, !!l.erro]), [['vista', 1, 'Mercado', false], ['parcelada', 3, 'Lazer', false], ['pix', 1, 'Outros', false], ['vista', 1, 'Outros', true], ['vista', 1, 'Outros', true]]);
    const laVelho = lancarPix({ descricao:'Antigo', valor:9, mKey:M }), laOutro = lancarPix({ descricao:'Outro mês', valor:9, mKey:addMonths(M, -1) });
    lancarVista(cImp, { descricao:'Velho', valor:1, mKey:M });
    impApagarGastos(M);
    igual('planilha: do zero no mês apaga só aquele mês', [state.lancamentos.includes(laVelho), state.lancamentos.includes(laOutro), cImp.credoVista.length], [false, true, 0]);
    impGravarLinhas(impL.filter(l=>!l.erro), M);
    igual('planilha: tudo entra no mês escolhido', [cImp.credoVista.map(cv=>[cv.mKey, cv.valor]), state.comprasTracker.map(cp=>[cp.mesInicio, cp.valorTotal, cp.parcelas]), state.lancamentos.filter(l=>l.descricao === 'Padaria').map(l=>l.mKey)], [[[M, 100]], [[M, 300, 3]], [M]]);
    igual('planilha: coluna Fatura em vários jeitos', ['10/2026', '9/26', 'out/2026', 'Outubro de 2026', '2026-08', '05/10/2026', new Date(2026, 6, 1), ''].map(impMes), ['2026-10', '2026-09', '2026-10', '2026-10', '2026-08', '2026-10', '2026-07', '']);
    const impF = impInterpretar([['Fatura', 'Valor', 'Forma', 'Cartão'], ['08/2026', 10, 'Cartão', 'Nubank'], ['', 21, 'Pix', '']]);
    cImp.credoVista = []; impGravarLinhas(impF, M);
    igual('planilha: cada linha no mês da Fatura; sem Fatura, no mês padrão', [cImp.credoVista.map(cv=>cv.mKey), state.lancamentos.filter(l=>l.valor === 21 && l.mKey === M).length], [['2026-08'], 1]);
    state.lancamentos = state.lancamentos.filter(l=>l !== laOutro && l.descricao !== 'Padaria' && l.valor !== 21);
    state.comprasTracker = []; state.cartoesTracker.pop();
    const bImp = bancosDoUsuario(), bAntes = bImp.map(b=>b.valor), saldoAntes = state.users[state.currentUser].saldoAtual;
    bImp.push({ id:'bimp', nome:'Banco Teste', valor:500 });
    const sImp = impLerSaldos([['Banco', 'Saldo atual'], ['banco teste', 'R$ 0,00'], ['Não Existe', 10], ['Outro', '']]);
    igual('planilha: aba Saldos (vazio não mexe, banco errado avisa)', sImp.map(x=>[x.valor, !!x.banco, !!x.erro]), [[0, true, false], [10, false, true]]);
    impGravarSaldos(sImp.filter(x=>!x.erro));
    igual('planilha: recebido e transferência não viram gasto', impInterpretar([['Valor', 'Forma'], [100, 'Recebido'], [50, 'Transferência'], [20, 'Pix']]).map(l=>!!l.erro), [true, true, false]);
    igual('planilha: saldo do banco fica o da planilha', bImp.find(b=>b.id === 'bimp').valor, 0);
    bImp.pop(); bImp.forEach((b, i)=>{ b.valor = bAntes[i]; }); state.users[state.currentUser].saldoAtual = saldoAntes;

    /* maior ↔ menor pelos graus (v18.5) */
    const grauT = (t, a, ma, b, mb)=>lvMudarModoTexto(t, a, ma, b, mb);
    igual('graus: Cm Ab Eb Bb → Eb Cm Gm Dº e volta', [grauT('Cm  Ab  Eb  Bb', 'Eb', true, 'Eb', false), grauT('Eb  Cm  Gm  Dº', 'Eb', false, 'Eb', true)], ['Eb  Cm  Gm  Dº', 'Cm  Ab  Eb  Bb']);
    igual('graus: sétima e baixo', grauT('Cm7  Ab/C  Fm7', 'Eb', true, 'Eb', false), 'Eb7M Cm/Eb Ab7M');
    igual('graus: G7 continua dominante e nota fora do campo mantém o sufixo', [grauT('G7', 'Eb', true, 'Eb', false), grauT('Bb7', 'Eb', false, 'Eb', true), grauT('B7', 'Eb', true, 'Eb', false)], ['Bb7', 'G7', 'D7']);
    igual('graus: letra não muda e maior vai para outro menor', [grauT('Cm Ab\nCantarei a Ti', 'Eb', true, 'Eb', false).split('\n')[1], grauT('G  Em  C', 'G', false, 'Bb', true)], ['Cantarei a Ti', 'Gm Eb  Cm']);

    /* ---------- proteção contra perda ---------- */
    const baseP = JSON.stringify({ louvores: [1,2,3,4,5,6].map(i=>({ id:'l'+i, revisar:[1,2,3,4,5,6] })), cultos:[{ id:'c1' }, { id:'c2' }, { id:'c3' }] });
    igual('perda: apagar todas as músicas pede confirmação', perdaGrande(baseP, { louvores:[], cultos:[{ id:'c1' }, { id:'c2' }, { id:'c3' }] }).map(x=>[x.p, x.n0, x.n1]), [['louvores', 6, 0]]);
    igual('perda: tirar uma música não pede', perdaGrande(baseP, JSON.parse(baseP.replace('{"id":"l6","revisar":[1,2,3,4,5,6]},', '').replace(',{"id":"l6","revisar":[1,2,3,4,5,6]}', ''))).length, 0);
    const semRevisar = JSON.parse(baseP); semRevisar.louvores[0].revisar = [];
    igual('perda: lista pequena de dentro de uma música não conta', perdaGrande(baseP, semRevisar).length, 0);
    igual('perda: cultos sumindo pede confirmação', perdaGrande(baseP, { louvores: JSON.parse(baseP).louvores }).map(x=>x.p), ['cultos']);

    /* ---------- telas: abrem sem erro ---------- */
    let erroTelas = '';
    const abas = ['planner', 'ponto', 'vendas', 'louvor', 'ajustes', 'trabalho'];
    try{
      abas.forEach(a=>switchAba(a));
      renderPanorama(); renderPlanner(); renderPonto(); renderVendas(); renderLouvorLista(); renderAjustes();
      abrirContasPagar(M); fecharContasPagar();
      abrirHistoricoMeses(); closeModal('modalHistoricoMeses');
      abrirCulto(); fecharCulto();
      abrirAtualizar('resumo'); abrirAtualizar('conversa'); fecharAtualizar();
      switchAba('planner');
    }catch(e){ erroTelas = String(e && e.stack || e); }
    t('telas: abas e telas cheias abrem sem erro', !erroTelas, erroTelas);

    /* ---------- dados que não podem sumir (conselho 27/10) ---------- */
    state.paid['2020-01_davi_fixo_f1'] = true;
    state.ponto.days['2020-01'] = { '5': { entrada:'08:00', saida:'17:00' } };
    state.users.davi.income['2020-01'] = 1234;
    limparDadosAntigos();
    t('limpeza: conta paga, dia do ponto e renda de meses antigos continuam', state.paid['2020-01_davi_fixo_f1'] === true && !!state.ponto.days['2020-01'] && state.users.davi.income['2020-01'] === 1234);
    delete state.paid['2020-01_davi_fixo_f1']; delete state.ponto.days['2020-01']; delete state.users.davi.income['2020-01'];
    igual('mescla da cópia pendente: junta o que cada aparelho mudou', mesclarValor({ a:1, b:1, l:[{ id:'x', v:1 }] }, { a:2, b:1, l:[{ id:'x', v:1 }, { id:'y', v:2 }] }, { a:1, b:3, l:[{ id:'x', v:9 }] }), { a:2, b:3, l:[{ id:'x', v:9 }, { id:'y', v:2 }] });

    /* ---------- imagens separadas dos dados ---------- */
    const img = 'data:image/png;base64,' + 'A'.repeat(3000);
    const json = JSON.stringify({ x:1, logo: img, outra: img, pequena: 'data:image/png;base64,AAAA' });
    const { leve, novas } = await window.SiloSupabase.imagens.separar(json);
    t('imagens: grande sai do registro', !leve.includes('AAAAAAAAAA') && leve.includes('"img:'), leve.slice(0, 200));
    igual('imagens: a mesma imagem vai uma vez só', novas.length, 1);
    t('imagens: pequena fica no registro', leve.includes('data:image/png;base64,AAAA"'));
  } catch(e){
    t('erro inesperado nos testes', false, String(e && e.stack || e));
  } finally {
    state = real;
  }
  const falhas = resultados.filter(r=>!r.ok);
  return { ok: resultados.length - falhas.length, falhas, total: resultados.length };
}
