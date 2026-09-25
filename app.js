/* ========== RENDERIZAÇÃO ========== */
function renderAll(){
  renderPanorama();
  renderPlanner();
  renderPonto();
  renderReceitas();
  renderLouvor();
  renderMercado();
}

/* ========== STORAGE & BACKUP ========== */
function calcularStorageUsage(){
  let usado = 0;
  console.log('[CALC-STORAGE] Iniciando cálculo');
  try{
    console.log('[CALC-STORAGE] localStorage.length:', localStorage.length);
    for(let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      if(key){
        const value = localStorage.getItem(key) || '';
        const keyBytes = new TextEncoder().encode(key).length;
        const valueBytes = new TextEncoder().encode(value).length;
        const total = keyBytes + valueBytes;
        console.log(`[CALC-STORAGE] "${key}": ${total} bytes (key:${keyBytes} + value:${valueBytes})`);
        usado += total;
      }
    }
  }catch(e){
    console.error('[CALC-STORAGE] ERRO:', e);
  }
  const total = 5 * 1024 * 1024;
  const percentual = Math.min(100, Math.round((usado / total) * 100));
  console.log('[CALC-STORAGE] RESULTADO:', { usado, total, percentual });
  return { usado, total, percentual };
}

/* ========== CHANGELOG ========== */
/* Cada edição feita: adicionar um item novo no topo da versão atual (ou uma versão nova no topo do array). Textos curtos e gerais. */
const CHANGELOG = [
  { versao: 'v2.33', itens: [
    'Dashboard: gastos, sobra, contas a pagar e o cartão "Meta para sair do PJ" agora só do Davi — a Cris fica só no Planner (dela)',
    'Meta para sair do PJ: a ajuda da Cris agora vem dos extras dela marcados "vai ajudar o Davi", sem campo manual',
    'Planner: seções Moradia/Assinaturas/Fixos/Contas Futuras podem ser fechadas tocando no título (fecham sozinhas quando vazias)',
    'Contas a pagar: "dia X" agora mostra quantos dias faltam de verdade, mesmo olhando outro mês',
    'Removido o campo "Já recebi" do fluxo mensal (o toggle do saldo em conta já resolve isso)',
    'Ícones das contas um pouco maiores'
  ]},
  { versao: 'v2.32', itens: [
    'Planner: status das contas (aberta, parcial, paga) com botão para registrar pagamento; pagamento parcial agora reduz o que falta pagar',
    'Planner: campo "Já recebi" para a renda do mês e botão "+ Gasto futuro" na faixa',
    'Dashboard: cartão "Meta para sair do PJ" com contribuição da Cris e projeção de 3 meses'
  ]},
  { versao: 'v2.31', itens: [
    'Planner: faixa fixa no topo com saldo em conta, a receber, a pagar e sobra prevista do mês, sempre visível enquanto você edita'
  ]},
  { versao: 'v2.30', itens: [
    'Corrigido: no computador, o Dashboard ficava aparecendo em cima das outras abas',
    'Dashboard no computador agora ocupa a tela toda, com os cartões distribuídos em colunas'
  ]},
  { versao: 'v2.29', itens: [
    'Corrigido: botão "Resumo Geral" agora sempre abre a página (antes, se algum cálculo desse errado, o clique não fazia nada; agora mostra o erro na tela em vez de travar em silêncio)',
    'Resumo Geral em 2 colunas no computador, aproveitando a tela larga'
  ]},
  { versao: 'v2.28', itens: [
    'Categorias do Mercado/Estoque e do Crédito à Vista do cartão agora podem ser criadas por você (chip "+ Nova"), além das categorias padrão'
  ]},
  { versao: 'v2.27', itens: [
    'Novo botão "Resumo" no topo: página dedicada com saldo do mês, Vilão do Orçamento, comparativo, previsão do próximo mês, gasto por categoria e Contas Futuras',
    'Exportar PDF do resumo financeiro completo, com tabelas de texto (não imagem), pronto pra mandar pra análise'
  ]},
  { versao: 'v2.26', itens: [
    'Crédito à Vista do cartão agora tem categoria e mês, pra achar o gargalo real das comprinhas do dia a dia',
    'Novo card "Previsão do próximo mês" no Dashboard, com peso maior pras Contas Futuras (o dado mais confiável)'
  ]},
  { versao: 'v2.25', itens: [
    'Corrigido: não dava mais pra sair do Estúdio do Louvor no computador (o painel ficava com prioridade errada e cobria o botão de voltar)',
    'Corrigido: campo harmônico mostrava a "preparação" errada — agora mostra de verdade a dominante de cada acorde (ex: acorde C tem G7 embaixo, não C7)',
    'Novo: mudar o tom agora transpõe de verdade o texto da música (não só o PDF)',
    'Louvor: página de edição não parece mais uma caixa de texto dentro da folha — o texto flui direto na "folha"',
    'Louvor: acorde de preparação agora aparece separado, com borda pontilhada, igual o modelo de referência',
    'Dashboard no computador aproveita melhor a largura da tela, em 3 colunas'
  ]},
  { versao: 'v2.24', itens: [
    'Panorama virou Dashboard, com ícone novo e cor corrigida quando selecionado',
    'Dashboard: gráficos com legenda ao lado (não mais embaixo), textos maiores, mais espaçamento entre as seções',
    '"Planeje Suas Compras Futuras" mudou do Dashboard pro Planner',
    'Dashboard agora só tem 2 abas (Resumo e Contas) — o Ponto PJ entrou dentro do Resumo',
    'Comparativo agora mostra mês anterior E 3 meses atrás, e o app passou a guardar de verdade os números de cada mês fechado',
    'Vilão do Orçamento ganhou um "i" explicando o que ele mostra',
    'Cor de alerta ajustada pra combinar melhor com o resto do app',
    'Dashboard em telas de computador agora usa 2 colunas em vez de ficar tudo esticado numa coluna só',
    'Extras (Planner) podem ter o dia do mês que costumam cair, usado no Fluxo de Caixa',
    'Cartão de crédito: agora dá pra editar a logo da compra direto pela lista, ver detalhes não fecha mais sozinho ao marcar como pago, cartão ganhou ícone próprio, e a tela de editar cartão ficou melhor organizada em telas grandes'
  ]},
  { versao: 'v2.23', itens: [
    '[Teste] Escanear QR de cupom fiscal no Mercado, abre o link no navegador pra você conferir o que dá pra aproveitar'
  ]},
  { versao: 'v2.22', itens: [
    'Novo: Panorama dividido em abas internas (Resumo / Contas / Ponto) pra não depender só de scroll',
    'Novo: busca única (ícone de lupa no topo) que procura em contas, receitas, louvor e mercado de uma vez',
    'Novo: backup automático diário guardado neste navegador, com opção de restaurar (não substitui exportar de vez em quando)',
    'Ajustado: telas grandes de computador agora aproveitam melhor o espaço',
    'Novo: barra "Biblioteca / Estúdio" no Louvor pra alternar rápido entre a lista de músicas e a música que você está editando'
  ]},
  { versao: 'v2.21', itens: [
    'Novo: gráfico de tendência semanal no Ponto PJ (compara cada semana com o padrão)',
    'Novo: meta diária sugerida no Ponto PJ (quanto trabalhar por dia útil pra bater a meta do mês)',
    'Novo: botão nas Receitas pra mandar os ingredientes que faltam direto pra lista de compras do Mercado',
    'Histórico de preço por item no Mercado já existia — conferido e funcionando'
  ]},
  { versao: 'v2.20', itens: [
    'Novo: duplicar uma conta com 1 toque',
    'Novo: arquivar conta em vez de excluir (com opção de restaurar depois)',
    'Novo: "Contas Futuras" agora tem botões separados pra conta simples e conta parcelada/recorrente',
    'Novo: aviso quando 2 ou mais parcelas (de conta ou cartão) terminam no mesmo mês',
    'Limite do cartão com barra de comprometimento já existia — conferido e funcionando'
  ]},
  { versao: 'v2.19', itens: [
    'Novo: "Vilão do Orçamento" mostra qual categoria mais cresceu em relação ao mês anterior',
    'Novo: gasto essencial mínimo do mês, calculado automaticamente',
    'Novo: marcar conta como essencial ou não-essencial',
    'Novo: aviso quando uma assinatura muda de valor (compara com o valor anterior)',
    'Novo: o dia de vencimento agora muda de cor conforme a proximidade (vermelho = urgente, laranja = próximo)'
  ]},
  { versao: 'v2.18', itens: [
    'Novo: comparativo do mês atual com o mesmo mês do ano passado',
    'Novo: simulador de aumento de renda dentro do "Gerar Orçamento" (não altera seus dados reais)',
    'Novo: gastos podem ser marcados como Fixa ou Variável, com sugestão de média das últimas alterações',
    'Novo: Reserva agora tem meta e "quanto guardar por mês", com barra de progresso e previsão de quando bate a meta'
  ]},
  { versao: 'v2.17', itens: [
    'Removida a aba de Tarefas do Planner'
  ]},
  { versao: 'v2.16', itens: [
    'Novo: Fluxo de Caixa do mês (dia a dia, mostra se o saldo fica apertado em algum ponto antes do fim do mês)',
    'Novo: aviso de "Parcelas Terminando" (quando uma parcela acaba, mostra quanto isso libera de sobra)',
    'Novo: selo "NOVA" em contas que apareceram pela primeira vez',
    'Novo: aviso "Vencendo em breve" configurável (quantos dias antes avisar) em Contas a Pagar'
  ]},
  { versao: 'v2.15', itens: [
    'Corrigido: arquivos do app ficavam presos em cache antigo mesmo depois de atualizar — agora cada versão força o navegador a baixar os arquivos certos'
  ]},
  { versao: 'v2.14', itens: [
    'Corrigido: navegação travava no Panorama e as outras abas só apareciam rolando pra baixo — havia uma função de troca de aba antiga e duplicada; removidas todas as duplicatas escondidas no código (mesma causa do bug de rolagem anterior)'
  ]},
  { versao: 'v2.13', itens: [
    'Corrigido: troca de aba não reseta mais a rolagem (não precisa mais arrastar até o fim pra aba nova aparecer)',
    'Louvor: filtro "Atual" novo (mostra em produção ou com data de hoje em diante), botão de funil pra mostrar/ocultar os filtros, tom e agendamento já na criação do louvor, permite salvar como rascunho sem título',
    'Louvor: slides agora sempre com o título à esquerda e o texto centralizado, com margem lateral no preview'
  ]},
  { versao: 'v2.12', itens: [
    'Ajustado: tag de mês das contas antigas não corta mais em Contas a Pagar'
  ]},
  { versao: 'v2.11', itens: [
    'Adicionado: lista de atualizações aqui em cima, mostrando o que foi mexido em cada versão'
  ]},
  { versao: 'v2.10', itens: [
    'Corrigido: app travava a rolagem depois de fechar alguns avisos/modais',
    'Ajustado: Contas a Pagar não corta mais dia, nome ou valor'
  ]}
];

function renderChangelog(){
  const el = document.getElementById('changelogList');
  if(!el) return;
  el.innerHTML = CHANGELOG.map(v => `
    <div style="padding:8px 10px;background:var(--card-2);border-radius:8px">
      <div style="font-weight:700;font-size:12px;color:var(--text);margin-bottom:3px">${v.versao}</div>
      ${v.itens.map(txt => `<div style="font-size:11.5px;color:var(--text-faint);line-height:1.4">• ${txt}</div>`).join('')}
    </div>
  `).join('');
}

function renderBackupsAutoLista(){
  const el = document.getElementById('backupsAutoLista');
  if(!el) return;
  const backups = listarBackupsAutomaticos();
  if(backups.length===0){
    el.innerHTML = `<div class="empty-state-sm" style="padding:8px 0">Nenhum backup automático ainda</div>`;
    return;
  }
  el.innerHTML = backups.map(b=>{
    const dataLabel = new Date(b.dia+'T00:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
    return `<div class="busca-resultado-item" style="padding:8px 4px">
      <span class="busca-resultado-icon">🕐</span>
      <div class="busca-resultado-info"><div class="busca-resultado-label">${dataLabel}</div><div class="busca-resultado-meta">${b.versao||''}</div></div>
      <button class="link-btn-sm" onclick="restaurarBackupAutomatico('${b.dia}')">Restaurar</button>
    </div>`;
  }).join('');
}

function abrirImportExportModal(){
  console.log('[STORAGE DEBUG] Abrindo modal');
  document.getElementById('modalImportExport').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderChangelog();
  renderBackupsAutoLista();
  
  console.log('[STORAGE DEBUG] localStorage.length:', localStorage.length);
  const storage = calcularStorageUsage();
  console.log('[STORAGE DEBUG] calcularStorageUsage retornou:', storage);
  
  const usedMB = (storage.usado / (1024*1024)).toFixed(2);
  console.log('[STORAGE DEBUG] usedMB:', usedMB);
  
  const bar = document.getElementById('storageBar');
  console.log('[STORAGE DEBUG] bar element:', bar);
  
  bar.style.width = storage.percentual + '%';
  let gradient;
  if(storage.percentual <= 33) gradient = '#10b981';
  else if(storage.percentual <= 66) gradient = '#f59e0b';
  else gradient = '#ef4444';
  bar.style.background = gradient;
  
  console.log('[STORAGE DEBUG] Atualizando percentual para:', storage.percentual + '%');
  document.getElementById('storagePercent').textContent = storage.percentual + '%';
  
  console.log('[STORAGE DEBUG] Atualizando usado para:', usedMB + ' MB');
  document.getElementById('storageUsed').textContent = usedMB + ' MB';
  
  console.log('[STORAGE DEBUG] Done!');
}

/* exportarDadosApp / triggerImportarDados / onImportFileSelected vivem em mercado.js */

/* ========== BUSCA GLOBAL ========== */
/* ---------- Nova categoria (genérico: Mercado/Estoque e Cartão à vista) ---------- */
function abrirNovaCategoriaExtra(alvo){
  document.getElementById('categoriaExtraAlvo').value = alvo;
  document.getElementById('categoriaExtraNome').value = '';
  document.getElementById('modalCategoriaExtra').classList.add('active');
}
function salvarCategoriaExtra(){
  const alvo = document.getElementById('categoriaExtraAlvo').value;
  const nome = document.getElementById('categoriaExtraNome').value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  const config = alvo==='mercado'
    ? { customKey:'mercadoCategoriasCustom', base:MERCADO_CATEGORIAS }
    : { customKey:'credoVistaCategoriasCustom', base:CREDOVISTA_CATEGORIAS };
  if(!state[config.customKey]) state[config.customKey] = [];
  const jaExiste = config.base.some(c=>c.toLowerCase()===nome.toLowerCase()) || state[config.customKey].some(c=>c.toLowerCase()===nome.toLowerCase());
  if(jaExiste){ showToast('Essa categoria já existe'); closeModal('modalCategoriaExtra'); return; }
  state[config.customKey].push(nome);
  persist();
  closeModal('modalCategoriaExtra');
  if(alvo==='mercado'){
    window.estFormCategoriaSelecionada = nome;
    renderEstFormCategoriaChips();
  } else {
    window.credoVistaCategoriaSelecionada = nome;
    renderCredoVistaCategoriaChips();
  }
  showToast('Categoria criada');
}
function abrirBuscaGlobal(){
  document.getElementById('buscaGlobalInput').value = '';
  document.getElementById('buscaGlobalResultados').innerHTML = '';
  document.getElementById('modalBuscaGlobal').classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>{ const el = document.getElementById('buscaGlobalInput'); if(el) el.focus(); }, 150);
}
function onBuscaGlobalInput(v){
  const termo = v.trim().toLowerCase();
  const el = document.getElementById('buscaGlobalResultados');
  if(termo.length < 2){ el.innerHTML = ''; return; }
  const resultados = [];

  ['davi','cris'].forEach(u=>{
    ['moradia','fixo','assinatura','futuro'].forEach(cat=>{
      (state.users[u].expenses[cat]||[]).forEach(item=>{
        if(item.arquivado) return;
        if((item.desc||'').toLowerCase().includes(termo)){
          resultados.push({ label:item.desc, meta:'Conta · '+(u==='davi'?'Davi':'Cris')+' · '+fmtMoney(item.valor), icon:'💰', onclick:`irParaBuscaConta('${u}','${cat}','${item.id}')` });
        }
      });
    });
  });

  (state.receitas||[]).forEach(r=>{
    if((r.nome||'').toLowerCase().includes(termo)){
      resultados.push({ label:r.nome, meta:'Receita', icon:'🍲', onclick:`irParaBuscaReceita('${r.id}')` });
    }
  });

  (state.louvores||[]).forEach(l=>{
    if((l.titulo||'').toLowerCase().includes(termo) || (l.artista||'').toLowerCase().includes(termo)){
      resultados.push({ label:l.titulo||'Sem título', meta:'Louvor · '+(l.artista||''), icon:'🎵', onclick:`irParaBuscaLouvor('${l.id}')` });
    }
  });

  (state.estoque||[]).forEach(e=>{
    if((e.nome||'').toLowerCase().includes(termo)){
      resultados.push({ label:e.nome, meta:'Mercado', icon:'🛒', onclick:`irParaBuscaMercado('${e.id}')` });
    }
  });

  if(resultados.length===0){
    el.innerHTML = `<div class="empty-state-sm">Nada encontrado</div>`;
    return;
  }
  el.innerHTML = resultados.slice(0,40).map(r=>
    `<div class="busca-resultado-item" onclick="${r.onclick}">
      <span class="busca-resultado-icon">${r.icon}</span>
      <div class="busca-resultado-info"><div class="busca-resultado-label">${r.label}</div><div class="busca-resultado-meta">${r.meta}</div></div>
    </div>`
  ).join('');
}
function irParaBuscaConta(user, cat, id){
  closeModal('modalBuscaGlobal');
  state.currentUser = user;
  switchAba('planner');
  setTimeout(()=>editGasto(cat, id), 200);
}
function irParaBuscaReceita(id){
  closeModal('modalBuscaGlobal');
  switchAba('receitas');
  setTimeout(()=>abrirReceitaDetalhe(id), 200);
}
function irParaBuscaLouvor(id){
  closeModal('modalBuscaGlobal');
  switchAba('louvor');
  setTimeout(()=>abrirLouvorDetalhe(id), 200);
}
function irParaBuscaMercado(id){
  closeModal('modalBuscaGlobal');
  switchAba('mercado');
  setTimeout(()=>abrirEstoqueForm(id), 200);
}

function closeModal(modalId){
  const modal = document.getElementById(modalId);
  if(modal){
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ========== NAVEGAÇÃO ========== */
/* switchAba e switchUser vivem em core.js */
