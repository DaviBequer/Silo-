/* dados de mentira para conferir o visual numa aba ?teste sem login (não grava nada) */
function mockVisual(){
  const lt = document.getElementById('loginTela'); if(lt){ lt.className = 'login-tela'; lt.style.display = 'none'; }
  document.getElementById('syncBanner')?.remove();
  const u = state.users.davi;
  u.bancos = [{id:'b1',nome:'Nubank',valor:824.21},{id:'b2',nome:'Inter',valor:2300},{id:'b3',nome:'ViaCredi',valor:800},{id:'b4',nome:'C6 Bank',valor:0}]; u.saldoAtual = 3924.21;
  const m = mesFinanceiroAtual();
  u.expenses.fixo = [{id:'f1',desc:'Internet',valor:99.9,dia:15},{id:'f2',desc:'Luz',valor:180,dia:27}]; u.expenses.moradia = [{id:'m1',desc:'Aluguel',valor:1200,dia:10}];
  state.paid[m+'_davi_moradia_m1'] = true;
  const fa = faturaAbertaMes({fechamento:5});
  state.cartoesTracker = [{id:'c1',nome:'Nubank',fechamento:5,vencimento:12,credoVista:[{id:'v1',descricao:'Mercado',valor:627,mKey:fa}],assinaturas:[]}];
  state.comprasTracker = [{id:'p1',nome:'Celular',cartaoId:'c1',valorTotal:3380,parcelas:10,mesInicio:addMonths(fa,-3)}];
  state.lancamentos = [{id:'l1',mKey:m,descricao:'Padaria',valor:219,categoria:'Mercado',banco:'Nubank',usuario:'davi'}];
  const am = calISO(new Date(Date.now()+86400000));
  state.louvores = [{id:'x1',titulo:'Cinco Letras Preciosas',artista:'Rose Nascimento',categoria:'Louvor',status:'finalizada',tomOriginal:'E',dataAgendamento:am,conteudo:'E\nTeste'},{id:'x2',titulo:'Mil Graus',artista:'Renascer Praise',categoria:'Louvor',status:'producao',tomOriginal:'A',conteudo:'A\nx'},{id:'x3',titulo:'Louvai a Jesus',artista:'',categoria:'Harpa Cristã',status:'finalizada',tomOriginal:'D',dataAgendamento:am,conteudo:'D\nx'},{id:'x4',titulo:'Fogo Puro',artista:'',categoria:'Corinhos',status:'producao',tomOriginal:'C',conteudo:'C\nx'}];
  document.body.classList.remove('carregando');
  document.documentElement.style.scrollBehavior = 'auto';
  renderAll();
}
