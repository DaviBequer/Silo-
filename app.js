/* ========== CABEÇALHO: data de hoje, dias até o fim do mês e quanto falta pagar ========== */
/* Falta pagar = gastos do mês do Dashboard que ainda não foram pagos (some quando você paga)
   + a meta de sobra do mês definida em Vendas (o que você quer guardar também "precisa sair" do saldo) */
function headerFaltaPagar(){
  if(!remoteReady || !state || !state.users || typeof computePontoMes!=='function') return null;   // só depois que tudo carregou
  const u = (typeof userDash==='function') ? userDash() : 'davi';
  const m = mesFinanceiroAtual();
  const gastos = expensesForMonth(u, m);
  const meta = (u==='davi' && typeof vendasMeta==='function') ? (vendasMeta(m) || 0) : 0;
  return { m, gastos, meta, total: gastos + meta };
}
function headerFaltaDetalhe(){
  const f = headerFaltaPagar(); if(!f) return;
  showToast(f.meta ? `A juntar em ${monthLabel(f.m)}: ${fmtMoney(f.gastos)} de contas + ${fmtMoney(f.meta)} de meta` : `A pagar em ${monthLabel(f.m)}: ${fmtMoney(f.gastos)}`);
}
function renderHeaderHoje(){
  const el = document.getElementById('headerHoje');
  if(!el) return;
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const faltam = ultimo - hoje.getDate();
  const data = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' de '+MES_NOMES_LONGOS[hoje.getMonth()].toLowerCase();
  const dataCurta = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' '+MES_NOMES[hoje.getMonth()].toLowerCase();
  /* "14 dias – R$ 9.266,28": dias até o fim do mês e o que falta pagar */
  const resto = faltam===0 ? 'último dia' : faltam+' dia'+(faltam>1?'s':'');
  const restoCurto = resto;
  const f = headerFaltaPagar();
  const falta = f ? `<button type="button" class="hh-falta${f.total>0.004?'':' ok'}" onclick="headerFaltaDetalhe()" title="Gastos que faltam pagar${f.meta?' + meta de sobra':''} em ${monthLabel(f.m)}">${f.total>0.004?`<b>${fmtMoney(f.total)}</b> <span class="hh-rotulo">${f.meta?'a juntar':'a pagar'}</span>`:'<b>✓ Tudo pago</b>'}</button>` : '';
  el.innerHTML = `<div class="hh-linha1"><span class="hh-longo">${data}</span><span class="hh-curto">${dataCurta}</span></div>
    <div class="hh-linha2"><span class="hh-longo">${resto}</span><span class="hh-curto">${restoCurto}</span>${falta?'<span class="hh-sep">–</span>'+falta:''}</div>`;
}
renderHeaderHoje();
setInterval(renderHeaderHoje, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) renderHeaderHoje(); });

/* ========== ENTER = PRÓXIMO CAMPO (janelas e subpáginas) ==========
   Enter num campo pula para o próximo campo visível da mesma janela; no último, fecha o teclado.
   Campos que já tratam o Enter por conta própria (onkeydown) ficam de fora. */
function camposNavegaveis(container){
  return [...container.querySelectorAll('input, select, textarea')].filter(el=>
    !el.disabled && !el.readOnly && el.type!=='file' && el.type!=='checkbox' && el.type!=='radio' && el.type!=='hidden' &&
    el.offsetParent !== null);
}
function containerDoCampo(el){ return el.closest('.modal, .fullpage, .aba'); }
document.addEventListener('focusin', e=>{
  const el = e.target;
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.hasAttribute('onkeydown')) return;
  const box = containerDoCampo(el);
  if(!box || !box.closest('.modal, .fullpage')) return;
  const lista = camposNavegaveis(box);
  el.setAttribute('enterkeyhint', lista.indexOf(el) < lista.length-1 ? 'next' : 'done');   // tecla "Próximo" no teclado do celular
});
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter' || e.isComposing || e.defaultPrevented) return;
  const el = e.target;
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.hasAttribute('onkeydown')) return;
  const box = containerDoCampo(el);
  if(!box || !box.closest('.modal, .fullpage')) return;
  const lista = camposNavegaveis(box);
  const i = lista.indexOf(el);
  if(i === -1) return;
  e.preventDefault();   // o "change" do campo dispara sozinho quando o foco sai dele
  const prox = lista[i+1];
  if(prox){ prox.focus(); if(prox.select && prox.type!=='date' && prox.type!=='number') try{ prox.select(); }catch(_){} }
  else el.blur();
});

/* ========== RENDERIZAÇÃO ========== */
function renderAll(){
  marcarAbasUsuario();   // botões Davi/Cris sempre iguais aos dados mostrados
  renderPanorama();
  renderPlanner();
  renderPonto();
  renderLouvor();
  if(typeof renderEmprestimos==='function') renderEmprestimos();
  if(typeof renderVendas==='function') renderVendas();
  if(typeof renderVersiculo==='function') renderVersiculo();
  if(typeof atualizarSino==='function') atualizarSino();
}

/* ========== STORAGE & BACKUP ========== */
function calcularStorageUsage(){
  // Tamanho dos dados guardados no Supabase (estado completo em JSON)
  let usado = 0;
  try{
    usado = new TextEncoder().encode(JSON.stringify(state)).length;
  }catch(e){
    console.error('[CALC-STORAGE] ERRO:', e);
  }
  const total = 5 * 1024 * 1024;
  const percentual = Math.min(100, Math.round((usado / total) * 100));
  return { usado, total, percentual };
}

/* ========== CHANGELOG ========== */
/* Cada edição feita: adicionar um item novo no topo da versão atual (ou uma versão nova no topo do array). Textos curtos e gerais. */
const CHANGELOG = [
  { versao: 'v12.4', itens: [
    'Finanças: seções com o total dourado, filtro Todas/Em aberto/Pagas e o calendário do dia; Para onde vai com uma barra e a % por categoria; saldo dos próximos meses em área dourada',
    'Cartão no formato de cartão (logo, chip e a fatura dentro); faturas futuras e empréstimo em placa; Contas do mês com filtro; Histórico em cartões por mês; Assistente em grafite',
    'Ponto: Padrão/Diferença/Impacto dentro da placa, dias com calendário e sem o bater na hora; Vendas em placa; música com abas em pílula, tom em grafite e duas colunas; Culto, Medley, Comparar e Tom no padrão novo'
  ]},
  { versao: 'v12.3', itens: [
    'Janelas: o valor grande no meio e as escolhas curtas viram botões; ícones das abas novos (dinheiro, gráfico, ondas, controles) e botões de ícone num círculo',
    'Versículo centralizado; abertura no mármore com o nome, a saudação e a barra de carregamento em onda; entrada do PIN clara com a saudação'
  ]},
  { versao: 'v12.2', itens: [
    'Peças do app no visual novo (escolhidas uma a uma): janelas com o título numa faixa grafite, campos brancos com o valor em destaque, botões finos em caixa alta, abas em pílula, interruptores dourados',
    'Cabeçalho numa linha só (dias e o que falta pagar numa pílula), títulos de seção com traço dourado, botão Nova música e listas com o calendário do dia'
  ]},
  { versao: 'v12.1', itens: [
    'Colar do WhatsApp: a janela começa pela data do culto (calendário já abre); se o texto trouxer a data, ela vem marcada'
  ]},
  { versao: 'v12.0', itens: [
    'Visual novo no app inteiro (escolhido em 10 rodadas): fundo de mármore, placa grafite com dourado, letra Archivo e barra de baixo com a aba aberta em grafite',
    'Finanças: Davi/Cris dentro da placa do saldo, sobra prevista e dias que faltam, bancos como cartõezinhos só com a logo; blocos do mês (Sobra, Pago, Fixos, Pix, Crédito à vista, Parcelado) e contas com calendário',
    'Bancos: logo e cor de cada um e "Esconder bancos zerados"; "Atualizar" virou "Assistente"',
    'Louvor: placa do próximo culto e capas por tipo (Louvor, Harpa, Corinho de fogo) com o tom no canto; Trabalho: seletor Ponto/Vendas com as horas e a meta'
  ]},
  { versao: 'v11.4', itens: [
    'Louvor: música só com o PDF do Drive pode ser marcada como Pronto (botão no topo do Comparar); trocar o tom depois só muda a nota',
    'Importar e Cifra Club: no lugar das informações técnicas, uma onda animada com o que está fazendo, e a cifra aparece sendo escrita no editor',
    'Editor da música com uma fonte mais bonita (a mesma do PDF)'
  ]},
  { versao: 'v11.3', itens: [
    'Atualizar: resposta da IA curta, com cada compra numa linha e o que falta em destaque; a tela vai para a resposta nova',
    'IA da conversa mais rápida (pensa menos) e o microfone espera 5 segundos de silêncio'
  ] },
  { versao: 'v11.2', itens: [
    'Atualizar: microfone espera 4 segundos de silêncio e não repete mais as palavras',
    'Saldo ou fatura que não batem: o app pergunta o que foi gasto; só vira não identificado se você tocar em Não lembro (ou disser que não lembra)'
  ] },
  { versao: 'v11.1', itens: [
    'Linha do "-" à esquerda, junto do texto, com 35% da largura'
  ] },
  { versao: 'v11.0', itens: [
    'Visualizar e PDF: o "-" (próximo slide) mostra um respiro com meia linha no meio da parte'
  ] },
  { versao: 'v10.9', itens: [
    'Colar do WhatsApp: medley procura primeiro no Drive e vira um arquivo só (sem criar uma música para cada parte)',
    'Música: logo do Cifra Club abre no navegador a página de onde a cifra veio',
    'Cores mais fortes: linhas, ícones e textos claros mais escuros'
  ] },
  { versao: 'v10.8', itens: [
    'Atualizar no computador: números grandes no topo, três colunas (contas e bancos, cartões, histórico) e a conversa com a lista ao lado',
    'Drive: música que veio do Drive e foi passada para o app, quando está como Pronto, apaga o PDF antigo ao enviar (em produção o antigo fica para comparar)'
  ] },
  { versao: 'v10.7', itens: [
    'Drive: música só com o arquivo do Drive não gera PDF novo; o próprio arquivo é movido para a pasta atual (Som de Adoradores)'
  ] },
  { versao: 'v10.6', itens: [
    'Finanças: botão Atualizar (no lugar de Falar e Pagar) com resumão: última atualização, contas, cartões, bancos e histórico de gastos',
    'Conversa com a IA: fale tudo de uma vez (cartão à vista, parcelado, próxima fatura, Pix por banco, contas, saldos); ela pergunta o que faltar e o app mostra quanto falta para bater a fatura e o saldo',
    'Saldo que não bate vira Gasto não identificado; aviso no sino depois de 5 dias; Onde cortar? com a IA'
  ] },
  { versao: 'v10.5', itens: [
    'Música: botão Refazer pelo Cifra Club (cifra nova com a junção de hoje, mantém nome, data, roteiros e o tom; dá para desfazer)'
  ] },
  { versao: 'v10.4', itens: [
    'PDF no jeito do modelo: letra em Inconsolata, acordes laranja em negrito, etiquetas pequenas e cinza; encolhe para caber numa folha',
    'Slides: até 4 linhas; 5 curtas ficam juntas (compridas: 3+2); 6 ou mais dividem por igual; vale também para as músicas antigas',
    'Música: saíram Importar PDF, Atualizar pelo Drive e Imprimir (fica só o Baixar PDF)'
  ] },
  { versao: 'v10.3', itens: [
    'Cifra Club: acordes voltaram (o site passou a pôr um espaço invisível nas linhas) e as partes mantêm o nome da cifra (Pré-Refrão, Segunda Parte...)',
    'Música: abas Música (editor de texto inteiro, como Word), Visualizar (a folha do PDF) e Slides; sem edição linha por linha',
    'Editor: nome das partes [Refrão] mais visível e seleção mais forte'
  ] },
  { versao: 'v10.2', itens: [
    'Comparar: o PDF do Drive aparece direto no app (pelo acesso do Drive, sem guardar cópia), sem a tela de login do Google'
  ] },
  { versao: 'v10.1', itens: [
    'Cifra Club + Letras: o verso fica escrito como no Letras (uma linha só) com cada acorde na palavra certa; nenhum acorde se perde',
    'Busca do Cifra Club sem lupa: busca sozinha enquanto digita (ou no ✓ do teclado); janelas de busca mais altas',
    'Trocar de aba fecha a música, o Comparar e as outras telas cheias'
  ] },
  { versao: 'v10.0', itens: [
    'Comparar: botão ⇄ para passar o PDF do Drive para o padrão do app (agora funciona) e prévia do Drive pelo link, sem baixar',
    'Medley: olho para ver a letra e a cifra de cada parte, Salvar no topo, tela cabendo no celular; ordem só no editor',
    'Cifra Club: a IA dá nome às partes (Pré-Refrão, Refrão, Ponte...) e a cifra é obrigatória'
  ] },
  { versao: 'v9.9', itens: [
    'Culto: data sem "trocar data" (toque no nome), partes em cores e deslizando devagar ao mudar a ordem',
    'Sugestão da IA olha as músicas do app e os PDFs do Drive (nada de fora)',
    'Colar roteiro do WhatsApp foi para o + do Louvor'
  ] },
  { versao: 'v9.8', itens: [
    'Dados do Comando apagados do banco (ao abrir o app)'
  ]},
  { versao: 'v9.7', itens: [
    'Comando removido do app (aba, telas e código); a barra ficou com 4 abas: Finanças, Trabalho, Louvor e Ajustes'
  ]},
  { versao: 'v9.6', itens: [
    'Colar do WhatsApp: as opções aparecem dentro da própria música; medley sempre puxa a cifra das músicas e monta junto, com setas para a ordem e botão "Ordem das partes" depois de montar',
    'Painel da IA novo (papel): documento sendo lido, etapa atual, passos com ✓ ou girando e o registro ao vivo'
  ]},
  { versao: 'v9.5', itens: [
    'Colar do WhatsApp: medley vira uma música só no roteiro (as músicas sozinhas também ficam no app; o Drive recebe só o medley); opções do Cifra Club aparecem primeiro e só depois "digitar o cantor"; ícone de estado e animações em cada música',
    'Música só com o PDF do Drive: botão "Passar para o padrão do app" (o PDF continua para comparar; depois abre primeiro o app)'
  ]},
  { versao: 'v9.4', itens: [
    'Louvor: botão temporário "Limpar todas as músicas" no fim da lista (para testar a importação; com Desfazer)'
  ]},
  { versao: 'v9.3', itens: [
    'Colar do WhatsApp: botão "Colar o que copiei"; barrinha de carregamento em cada música com o passo (Drive, Cifra Club, Letras); sem cantor, pergunta qual é; não achou o certo, mostra as opções para escolher'
  ]},
  { versao: 'v9.2', itens: [
    'Sem caixas: os blocos viraram divisórias finas no app inteiro',
    'Culto: colar o roteiro do WhatsApp (ícone de prancheta) — lê parte, música, cantor e tom; usa a do app, senão o PDF do Drive (só o arquivo) ou cria pelo Cifra Club; acerta o tom pedido',
    'Música que veio do Drive só com o arquivo abre direto o PDF'
  ]},
  { versao: 'v9.1', itens: [
    'Visual "papel calmo" (o estilo 2 escolhido): fundo creme, tinta marrom-escura, números e títulos em letra de livro (Lora), linhas finas no lugar das caixas; próximas contas em lista'
  ]},
  { versao: 'v9.0', itens: [
    'Visual novo: minimalista preto e branco, uma letra só (Inter), sem sombras e sem foto de fundo; o visual militar saiu',
    'Aba Trabalho: Ponto e Vendas juntos (5 abas na barra)',
    'Comando calmo: sem multas, sem sargento e sem rebaixar; hábitos mostram os dias seguidos; check-in do dia (3 perguntas) e Diário'
  ]},
  { versao: 'v8.8', itens: [
    'Finanças: mais atalhos redondos embaixo do saldo (Empréstimo, Bancos, Simular, Histórico), arrastando para o lado; os ícones pequenos do topo saíram'
  ]},
  { versao: 'v8.7', itens: [
    'Ponto: topo arrumado (mês à esquerda, ícones à direita), ícone de PDF no exportar; nome do PDF automático (Davi), sem campo para preencher'
  ]},
  { versao: 'v8.6', itens: [
    'Ponto: ao segurar o horário aparece um balão em cima mostrando o número mudando (o dedo não esconde mais)'
  ]},
  { versao: 'v8.5', itens: [
    'Ponto: segurar no horário avança (ou volta) rápido, em 2 velocidades; tocar no nome (Entrada, Almoço…) apaga o horário'
  ]},
  { versao: 'v8.4', itens: [
    'Revisar ontem de novo (1 vez): desfaz o que foi contado e você marca o que fez — vale também para o dia que virou antes da revisão existir',
    'Juramento de cada dia: o de ontem não vale hoje (+10 XP ao assinar; botão Repetir)',
    'Versículo também no Comando, e todos os versículos agora são trechos maiores, inteiros na tela'
  ]},
  { versao: 'v8.3', itens: [
    'Revisão de ontem: fez e não marcou? Marque Fiz, Não fiz ou Imprevisto antes de contar',
    'Ordem de uma vez só (tarefa) ou todo dia (hábito): tarefa feita sai da lista; pendente continua como atrasada',
    'Imprevisto sem multa (3 por semana) e folga (1 por semana, a sequência fica parada)',
    'Fez tudo e esqueceu de fechar: o dia fecha sozinho; dias sem abrir agora contam e dá para dizer que estava impossibilitado'
  ]},
  { versao: 'v8.2', itens: [
    'Comando revisado: dia fechado não leva multa (nem por ordem criada depois de fechar)',
    'Apagar ordem antiga não cumprida custa XP (desistência); as criadas hoje saem de graça',
    'Teto de 200 XP por dia nas ordens; nova missão: 100% das ordens em 3 dias',
    'Virada do dia funciona com o app aberto de um dia para o outro; aviso quando a meta do dia foi perdida'
  ]},
  { versao: 'v8.1', itens: [
    'Visual militar no app inteiro: cáqui e oliva, latão, títulos retos em caixa alta, números em estêncil',
    'Comando bruto: ordem não cumprida, dia não fechado, sequência perdida, dias sem abrir e adiar custam XP — e pode ser rebaixado de patente',
    'Relatório do sargento todo dia de manhã e a voz do sargento cobrando no topo do Comando'
  ]},
  { versao: 'v8.0', itens: [
    'Comando virou jogo: XP por ordem (Alta 30, Média 20, outras 10), níveis com patente (Recruta a General) e comemoração ao subir',
    'Desafio da semana, 16 conquistas e escudos que salvam a sequência num dia perdido (1 a cada 7 dias seguidos)',
    'Fechar o dia dá +50 XP (mais bônus da sequência); anotar sabotagem também vale XP'
  ]},
  { versao: 'v7.9', itens: [
    'Versículo de Finanças com visual novo: caixa branca, aspas verdes, letra mais leve'
  ]},
  { versao: 'v7.8', itens: [
    'Comando e Ajustes agora são abas na barra de baixo (Ajustes = o antigo Dados do App)'
  ]},
  { versao: 'v7.7', itens: [
    'Comando: prioridade em cada ordem (Alta, Média, Baixa) — as mais importantes ficam em cima',
    'Comando: jogar a ordem para outro dia (amanhã, depois ou escolher no calendário)',
    'Comando: Enter ou Enviar no teclado do celular já adiciona a ordem'
  ]},
  { versao: 'v7.6', itens: [
    'PIN é sempre a entrada principal, sem pedir e-mail',
    'Nova aba Segurança em Dados do App: PIN, senha, e-mail e aparelhos conectados (desconectar um aparelho)'
  ]},
  { versao: 'v7.5', itens: [
    'Tela do PIN sem o campo de e-mail: o app usa o e-mail guardado no aparelho'
  ]},
  { versao: 'v7.4', itens: [
    'Visual novo no app inteiro: claro, caixas brancas com sombra suave, letra Manrope; serifa só no saldo e na previsão',
    'Finanças: bancos como cartões empilhados, previsão com barra, atalhos (Falar, Pagar, Cartões, Metas), curva do saldo e próximas contas',
    'Cartões com a frente inteira na cor do banco; cabeçalho claro; setas desenhadas no lugar de ◀ ▶'
  ]},
  { versao: 'v7.3', itens: [
    'Louvor: Edição e Visualizar viraram uma aba só, Música — a folha que você edita tocando (palavra, acorde, parte, título)',
    'Ícone T abre o modo texto para mexer na estrutura; linhas para conferir aparecem em amarelo na folha'
  ]},
  { versao: 'v7.2', itens: [
    'Instruções para a IA (Dados do App → Recursos): a IA segue as suas regras ao importar e organizar',
    'Drive: importa exatamente como está, sem reorganizar; nomes das partes dos PDFs do app lidos certinho',
    'Comparar com o original: o PDF do Drive ou o Cifra Club + Letras ao lado do que ficou no app',
    'Cifra Club mostra cada passo (Cifra Club, Letras, versos batidos); medley sem caracteres estranhos no PDF'
  ]},
  { versao: 'v7.1', itens: [
    'Letras ligado: a letra do Letras com os acordes do Cifra Club, quebrando os versos onde a cifra quebra',
    'Solo e final de várias linhas viram um bloco só; Suas, Juiz e Céu ficam como vieram'
  ]},
  { versao: 'v7.0', itens: [
    'Cifra Club: a letra vem do Letras (ordem e frases certas) com os acordes do Cifra Club; a música é criada e abre direto',
    'Drive: escolheu o PDF, a música é criada e abre direto (sem a tela de Nova música)',
    'Letras arrumadas sozinhas: Jesus, Deus, Ele, Tu, Teu com maiúscula; sem ponto no meio; verso grande vira dois',
    'Harpa: Parte, Refrão, Parte, Repete - Refrão…',
    'Culto: Cantor - Música e o tom, + só ícone, sem "Quem"; Drive pergunta se manda também no WhatsApp'
  ]},
  { versao: 'v6.9', itens: [
    'Segure o dedo num ícone para ver o nome dele',
    'Finanças no celular: só o essencial (resumo); a seta embaixo abre o resto',
    'Louvor: botão + não pula mais; Drive e Cifra Club com as logos no menu',
    'PDF do Drive: escolha Louvor, Harpa ou Corinhos para vir primeiro'
  ]},
  { versao: 'v6.8', itens: [
    'Louvor: parte repetida seguida vira "Primeira Parte | 2x" e "Repete - Refrão | 3x" (a importação percebe sozinha; músicas antigas ajustadas)',
    'Slides: "2x", "3x" no canto de cima à direita',
    'Importação: Intro/Introdução fica; compositor, cantor, créditos e avisos de site no meio da letra saem'
  ]},
  { versao: 'v6.7', itens: [
    'Visual: botões só com ícone, sem caixinha; Drive e WhatsApp com as logos; resumo sobre a foto com bordas que somem',
    'Finanças: próximos 3 meses no topo (sobra e acumulado); compra falada no Pix/débito fica registrada com categoria',
    'Finanças: gráfico compara com o mês passado; conferir a fatura fechada do cartão pelo PDF',
    'Louvor: Drive e WhatsApp dentro da música; trocar o tom troca o arquivo no Drive',
    'Louvor: Cifra Club dentro do app (link ou nome) e sugestão de repertório no Culto'
  ]},
  { versao: 'v6.6', itens: [
    'Culto: "Adicionar parte" voltou a funcionar; partes em branco somem sozinhas',
    'Culto: layout novo (linha do tempo das partes, data com setas) e "Ordem no WhatsApp"',
    'Culto: o texto do grupo agora é a lista numerada de louvores, na ordem que você escolher'
  ]},
  { versao: 'v6.5', itens: [
    'Louvor: o botão + abre um menu — Puxar do Drive, Importar PDF ou foto, Montar medley, Escrever à mão',
    'Louvor: a lista "Para criar" saiu (o Culto faz esse papel)'
  ]},
  { versao: 'v6.4', itens: [
    'Louvor: puxar PDF do Drive — criar música nova ou atualizar a cifra, ou só abrir o PDF',
    'Louvor: ao importar ou organizar, partes com mais de 4 linhas ganham "-" e viram slides menores'
  ]},
  { versao: 'v6.3', itens: [
    'Comando: subtarefas nas ordens — a ordem só conclui quando todas estiverem feitas',
    'Comando: meta do dia (ex.: 80% até 18:00) — batendo antes da hora, o dia conta como produtivo sozinho'
  ]},
  { versao: 'v6.2', itens: [
    'Computador: Finanças em painel de duas colunas (resumo e gráfico à esquerda, contas e análises à direita)',
    'Celular: Moradia, Assinaturas, Fixos e Contas futuras numa lista só',
    'Cartão: a cor do banco virou só um detalhe; botões pequenos todos no mesmo estilo; letras pequenas maiores',
    'Compras no cartão com o nome de uma conta (ex.: Mercado) descontam dessa conta, sem contar duas vezes',
    'Vendas deixa claro que a sobra é sem contar o cartão'
  ]},
  { versao: 'v6.1', itens: [
    'Cartão: botões + À vista, + Parcelada, + Assinatura e Ajuste; editar com um toque',
    'Desfazer por alguns segundos depois de excluir contas, extras e lançamentos do cartão',
    'Ponto: botão Bater ponto com a hora de agora; valor da hora foi para a engrenagem',
    'Contas do mês: botão "Parte" para pagamento parcial',
    'Topo mostra "a juntar"; resumo legível sobre a foto; versículo mais curto no celular; lápis para digitar o saldo',
    'Gráfico: Mercado/Gasolina no cartão desconta da conta reservada; Fluxo Mensal mostra que dá para arrastar',
    'Louvor: lista "Roteiro" virou "Para criar"; Vendas mostra o que falta do empréstimo'
  ]},
  { versao: 'v6.0', itens: [
    'Entrar com o PIN é a entrada principal (em aparelho novo pede o e-mail só na primeira vez); e-mail e senha ficam como opção',
    'Correções: tabela do Fluxo Mensal mostrava R$ duas vezes; seta do botão Culto'
  ]},
  { versao: 'v5.9', itens: [
    'Cartão por voz: fale várias compras de uma vez ("no cartão Inter: mercado 120, farmácia 45") e elas entram na fatura com categoria',
    'Para onde vai o dinheiro: gráfico do mês no Dashboard, com as compras do cartão por categoria',
    'Metas de economia: várias metas (reserva, viagem…) com barra, quanto falta e Guardar/Tirar',
    'Louvor: tela Culto com o roteiro por data, envio no WhatsApp, histórico das mais tocadas e botão do Drive',
    'Louvor: rolagem automática na tela cheia do Visualizar'
  ]},
  { versao: 'v5.8', itens: [
    'Faxina geral: visual refeito do zero numa identidade só (papel, tinta, verde; painéis pretos com brilho verde), mais leve e sem remendos',
    'Imagens (logos e foto de fundo) separadas dos dados: cada salvamento ficou ~4x menor (falta criar a tabela no Supabase)',
    'Mais animação: saldo conta mais devagar, barras enchem ao abrir, telas e janelas entram com mola; Jarvis no verde do app',
    'Topo: "14 dias – R$ 9.266,28"; versículo não fica mais por cima das abas no computador',
    'Correções: foto de fundo podia ser encolhida, Medley ficava aberto ao trocar de aba; código sem uso removido'
  ]},
  { versao: 'v5.7', itens: [
    'Versículo da Bíblia no topo de Finanças, um diferente a cada vez que o app abre',
    'Cabeçalho preto e a versão como "Nº"; no celular o topo mostra quantos dias faltam',
    'Imagem de fundo: barra para escolher quanto ela aparece; a foto fica desfocada atrás e os cartões em uma camada só',
    'Louvor: tela "Nova música" nova e painel da IA ao vivo (qual IA, tempo, etapas e o que encontrou)',
    'Dados do App em abas (Geral, Visual, Recursos, Conta) e sem barras de rolagem em todo o app',
    'Buscar: quando não acha, oferece pesquisar o louvor no Cifra Club'
  ]},
  { versao: 'v5.6', itens: [
    'Microfones no estilo Jarvis: anel brilhante girando, barras que reagem à fala e o texto aparecendo na hora',
    'Imagem de fundo: escolha uma foto em Dados do App (Suave, Médio ou Forte)',
    'Mais animações: onda ao tocar nos botões, abas e telas entrando deslizando, ícone da barra pulando',
    'Ponto: cada dia abre e fecha (fechados: trancados, futuros e folgas); Valor da hora alinhado',
    'Sino: o aviso só conta como lido quando você toca nele'
  ]},
  { versao: 'v5.5', itens: [
    'Entrar com PIN: crie um PIN de 6 números em Dados do App e, quando o app pedir para entrar, é só digitar o PIN (ele passa a ser a senha da conta)'
  ]},
  { versao: 'v5.4', itens: [
    'Notificações do celular: ao abrir, o app pede um endereço novo de notificação quando o antigo pode ter vencido'
  ]},
  { versao: 'v5.3', itens: [
    'Sino de notificações no topo: balança quando tem aviso novo (ponto não batido, quanto falta das vendas) e cada aviso leva até o lugar dele',
    'Notificações do celular: o app renova sozinho a inscrição quando o celular troca (antes parava de chegar)'
  ]},
  { versao: 'v5.2', itens: [
    'Louvor: compartilhe o PDF ou a foto da cifra com o Siloé (Compartilhar → Siloé) e ele já abre importando',
    'Pesquisou e não achou? Aparece o botão "Pesquisar no Cifra Club", que abre a busca lá',
    'IA: quando o Google está ocupado, o app insiste por cerca de 1 minuto (com a contagem na tela) e, se não der, mostra "Tentar com IA de novo"'
  ]},
  { versao: 'v5.1', itens: [
    'Louvor: Montar medley — escolha as músicas, toque nas partes na ordem em que vão cantar (pode repetir), mude o tom de cada uma e sai a cifra pronta, com PDF e slides',
    'O medley acompanha as correções das músicas originais',
    'Nova tela de adicionar louvor: a importação mostra cada passo e no fim o que foi conferido (linhas, partes, acordes com o PDF); o que não deu para conferir fica em amarelo'
  ]},
  { versao: 'v5.0', itens: [
    'Efeitos: cartões entram um após o outro, valores contam até o número certo e marcar algo como feito mostra um ✓ com vibração',
    'Textura de papel no fundo, sombras suaves nos cartões e botões que afundam ao tocar (desliga com "reduzir movimento")'
  ]},
  { versao: 'v4.9', itens: [
    'Microfone ao lado do Saldo em conta: fale uma compra, conta paga ou o que recebeu e o saldo do banco é atualizado (confirma antes)',
    'Louvor: acordes no lugar certo ao importar com IA (a posição vem do próprio PDF)',
    'Louvor: o PDF encolhe a letra só o necessário para caber em uma página'
  ]},
  { versao: 'v4.8', itens: [
    'Notificações no celular: aviso para bater o ponto e, às 18h, quanto falta vender (Dados do App → Ativar notificações)',
    'Abertura nova com efeitos (fundo preto, brilho e nome letra por letra) e ícone sem borda branca',
    'Comando sem a ligação com o Google (lista apagada da conta)'
  ]},
  { versao: 'v4.7', itens: [
    'Comando com visual novo: dias seguidos em destaque, semana em bolinhas, ordens com progresso e ditado por voz',
    'Comando ligado ao Google: ordens viram tarefas no Google Agenda/Tarefas (feito lá ou aqui vale nos dois) e a agenda de hoje aparece no app',
    'Finanças: seções sempre fechadas ao abrir, setinha ao lado do nome; chavinhas do Fluxo Mensal alinhadas',
    'Louvor: a IA tenta de novo sozinha quando o Google está ocupado e junta versos quebrados',
    'Janelas com cantos iguais no computador; saíram o ✓ do topo, "Enviar backup" e "Versões anteriores"',
    'Login: não pede mais senha quando o acesso vence com duas abas abertas'
  ]},
  { versao: 'v4.6', itens: [
    'Louvor: Importar e Organizar com IA (chave grátis do Google em Dados do App) — lê qualquer PDF ou foto e já monta partes, acordes e "Repete"',
    'Louvor: botão de tela cheia no Visualizar; letra sem fundo na prévia; Roteiro abre e fecha; filtro Atual em ordem de data',
    'Aparelho fica conectado: internet ruim não pede mais senha; novo "Sair de todos" em Dados do App',
    'Davi/Cris: cada aparelho guarda a sua escolha (não abre mais com os dados da Cris por engano)',
    'Login com olho para mostrar a senha'
  ]},
  { versao: 'v4.5', itens: [
    'Louvor: Roteiro — lista de louvores a criar; ao marcar, abre o Novo Louvor já com nome e cantor (ou abre o louvor se já existir)',
    'Louvor: cartões sem o ícone e sem "Sem data"',
    'Vendas no visual Editorial: comissão em letra serifada, metas sem caixas e botão Nova venda inteiro'
  ]},
  { versao: 'v4.4', itens: [
    'Novo visual Editorial: fundo cor de papel, tinta escura e verde-floresta, saldo em letra serifada grande, cards com borda fina em vez de sombra e abas mais limpas',
    'Fontes fixas Geist + Instrument Serif (a opção de trocar fonte saiu)'
  ]},
  { versao: 'v4.3', itens: [
    'Louvor: no filtro "Atual", cada louvor mostra a data marcada (ou "Sem data") e se está Em Produção ou Finalizado'
  ]},
  { versao: 'v4.2', itens: [
    'Funciona sem internet: o app fica guardado no aparelho e, sem conexão, mostra os dados da última vez para consulta',
    'Histórico de meses: botão "Histórico" no resumo, com entrou, saiu, sobra e gastos por categoria de cada mês',
    'Versões anteriores em Dados do App: restaurar os dados de uma hora atrás, de ontem, etc.',
    '"Sair deste aparelho" apaga a cópia dos dados que fica no aparelho',
    'Computador: Contas do mês e outras telas abrem ao lado da barra lateral',
    'App mais leve: código e estilos sem uso removidos'
  ]},
  { versao: 'v4.1', itens: [
    'Vendas: toque em "Clientes ativos" para ver cada cliente e editar ou excluir',
    'Vendas → Configurar: comissões num layout compacto, com os planos em forma de tabela'
  ]},
  { versao: 'v4.0', itens: [
    'Computador: barra de abas na lateral esquerda, unida ao cabeçalho (logo em cima de "Finanças")',
    'Menu com nomes e ícones novos: Finanças, Ponto, Vendas e Louvor',
    'Calendário novo e mais bonito em todos os campos de data',
    'Resumo: toque em "Vai entrar" e "Falta pagar" para ver cada valor separado',
    'Fluxo Mensal: linha "Gastos" com o total do mês; toque para ver cada conta',
    'Janelas de contas reorganizadas; a logo é o próprio botão (colocar, trocar ou remover)',
    'Vendas: meta conta só as vendas, setup soma no mês certo, cliente obrigatório e parcelas do empréstimo ao lado do saldo devedor',
    'Louvor: editor estilo Word sem barras de rolagem, Importar e Organizar ao lado do tom (Organizar pode ser desfeito) e créditos saem ao importar',
    'Louvor: slides em Arial, com o arquivo igual à prévia (mesmo tamanho e fundo)',
    'Abertura com a logo em 4 segundos'
  ]}
];

function renderChangelog(){
  const el = document.getElementById('changelogList');
  if(!el) return;
  const v = CHANGELOG[0];
  el.innerHTML = `
    <div style="padding:8px 10px;background:var(--card-2);border-radius:8px">
      <div style="font-weight:700;font-size:12px;color:var(--text);margin-bottom:3px">${String(v.versao).replace(/^v(\d+)\.(\d+)$/, 'Nº $1$2')}</div>
      ${v.itens.map(txt => `<div style="font-size:11.5px;color:var(--text-faint);line-height:1.4">• ${txt}</div>`).join('')}
    </div>
  `;
}

/* aba Ajustes (antes a janela "Dados do App"): atualiza o que muda ao abrir */
function abrirImportExportModal(){ switchAba('ajustes'); }
function renderAjustes(){
  renderChangelog();
  const btnSair = document.getElementById('btnSairApp');   // só aparece se este aparelho entrou com login
  if(btnSair && window.SiloSupabase) window.SiloSupabase.temSessao().then(s=>{
    document.getElementById('segConteudo').style.display = s ? '' : 'none';
    const cv = document.getElementById('ddContaVazio'); if(cv) cv.style.display = s ? 'none' : '';
    if(s) renderSeguranca();
  });
  if(typeof atualizarStatusFundo==='function') atualizarStatusFundo();

  const storage = calcularStorageUsage();
  
  const usedMB = (storage.usado / (1024*1024)).toFixed(2);
  
  const bar = document.getElementById('storageBar');
  
  bar.style.width = storage.percentual + '%';
  let gradient;
  if(storage.percentual <= 33) gradient = '#10b981';
  else if(storage.percentual <= 66) gradient = '#f59e0b';
  else gradient = '#ef4444';
  bar.style.background = gradient;
  
  document.getElementById('storagePercent').textContent = storage.percentual + '%';
  
  document.getElementById('storageUsed').textContent = usedMB + ' MB';
  atualizarStatusIA();
  atualizarStatusAvisos();
}

/* ===== NOTIFICAÇÕES (ponto e vendas) =====
   O serviço "avisos" do Supabase (pasta .claude/supabase-avisos) manda as notificações nos horários; aqui o aparelho
   só se inscreve. A inscrição fica em state.pushInscricoes (uma por aparelho). Só funciona no app publicado (no localhost
   o service worker fica desligado). */
const AVISOS_CHAVE_PUBLICA = 'BDTT66dSw6A5e4hdJwX7IQAs4B3sEMIUvhtNCL8qiC9J4E6D_IB8M_r-iB9uHEJJVqA9HambwXwLB18NRWx-MU4';
function avisosSuportado(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function avisosChaveBytes(){
  const b = atob(AVISOS_CHAVE_PUBLICA.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(b, c=>c.charCodeAt(0));
}
async function avisosInscricaoAtual(){
  try{ const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; }catch(e){ return null; }
}
async function atualizarStatusAvisos(){
  const st = document.getElementById('avisosStatus'), btn = document.getElementById('avisosBtn');
  if(!st || !btn) return;
  if(!avisosSuportado()){ st.textContent = 'Indisponível aqui'; btn.style.display = 'none'; return; }
  const sub = await avisosInscricaoAtual();
  const ligado = !!sub && Notification.permission === 'granted' && (state.pushInscricoes||[]).some(p=>p.endpoint === sub.endpoint);
  st.textContent = ligado ? 'Ligadas neste aparelho' : Notification.permission === 'denied' ? 'Bloqueadas no navegador' : 'Desligadas';
  st.classList.toggle('ligada', ligado);
  btn.style.display = '';
  btn.textContent = ligado ? 'Desligar neste aparelho' : 'Ativar notificações';
  btn.onclick = ligado ? desligarAvisos : ativarAvisos;
}
/* guarda a inscrição deste aparelho e tira a antiga dele (a que o celular trocou ou a de antes de reinstalar) */
function avisosNomeAparelho(){ return /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : 'Computador'; }
function avisosGuardarInscricao(sub){
  try{ localStorage.removeItem('siloe-avisos-desligado'); }catch(e){}
  const j = sub.toJSON(), aparelho = avisosNomeAparelho(), ua = navigator.userAgent;
  let anterior = ''; try{ anterior = localStorage.getItem('siloe-avisos-endpoint') || ''; }catch(e){}
  const lista = (state.pushInscricoes || []).filter(p=>
    p.endpoint !== j.endpoint && p.endpoint !== anterior &&
    !(p.aparelho === aparelho && (!p.ua || p.ua === ua)));   // mesma pessoa, mesmo aparelho: a velha sai
  lista.push({ id: 'p' + j.endpoint.slice(-20).replace(/[^\w]/g,''), endpoint: j.endpoint, keys: j.keys, aparelho, ua, criadoEm: Date.now() });
  state.pushInscricoes = lista;
  try{ localStorage.setItem('siloe-avisos-endpoint', j.endpoint); }catch(e){}
}
/* sempre um endereço novo: cancela o que o celular tinha e inscreve de novo */
async function avisosInscricaoNova(reg){
  try{ const velha = await reg.pushManager.getSubscription(); if(velha) await velha.unsubscribe(); }catch(e){}
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: avisosChaveBytes() });
  try{ localStorage.setItem('siloe-avisos-renovado', String(Date.now())); }catch(e){}
  return sub;
}
/* ao abrir: se as notificações estão permitidas, confere se a inscrição deste aparelho ainda vale e renova sozinho */
async function avisosRenovarSozinho(){
  try{
    if(!avisosSuportado() || Notification.permission !== 'granted') return;
    try{ if(localStorage.getItem('siloe-avisos-desligado') === '1') return; }catch(e){}
    let anterior = ''; try{ anterior = localStorage.getItem('siloe-avisos-endpoint') || ''; }catch(e){}
    const usava = anterior || (state.pushInscricoes || []).some(p=>p.aparelho === avisosNomeAparelho());
    if(!usava) return;   // nunca ativou neste aparelho
    const reg = await navigator.serviceWorker.getRegistration(); if(!reg) return;
    /* o celular pode guardar um endereço que o Google já descartou (o servidor recebe "410"):
       a cada 3 dias joga fora e pede um novo, para nunca ficar preso num endereço morto */
    let ultima = 0; try{ ultima = Number(localStorage.getItem('siloe-avisos-renovado')) || 0; }catch(e){}
    const renovar = Date.now() - ultima > 3 * 86400000;
    let sub = await reg.pushManager.getSubscription();
    if(!renovar && sub && (state.pushInscricoes || []).some(p=>p.endpoint === sub.endpoint)) return;   // já está certo
    sub = await avisosInscricaoNova(reg);
    avisosGuardarInscricao(sub);
    persist();
  }catch(e){}
}
async function ativarAvisos(){
  if(!avisosSuportado()){ showToast('Este navegador não recebe notificações'); return; }
  const reg = await navigator.serviceWorker.getRegistration();
  if(!reg){ showToast('Abra pelo app instalado (no endereço publicado) para ativar'); return; }
  const perm = await Notification.requestPermission();
  if(perm !== 'granted'){ showToast(perm === 'denied' ? 'Notificações bloqueadas — libere nas configurações do celular' : 'Permissão não concedida'); atualizarStatusAvisos(); return; }
  try{
    const sub = await avisosInscricaoNova(reg);
    avisosGuardarInscricao(sub);
    persist();
    reg.showNotification('Siloé', { body: 'Notificações ligadas: ponto e vendas.', icon: './icon-192.png', badge: './splash-cordeiro.png' });
  }catch(e){ showToast('Não consegui ativar: ' + ((e && e.message) || e)); }
  atualizarStatusAvisos();
}
async function desligarAvisos(){
  const sub = await avisosInscricaoAtual();
  if(sub){ state.pushInscricoes = (state.pushInscricoes || []).filter(p=>p.endpoint !== sub.endpoint); try{ await sub.unsubscribe(); }catch(e){} persist(); }
  try{ localStorage.removeItem('siloe-avisos-endpoint'); localStorage.setItem('siloe-avisos-desligado', '1'); }catch(e){}   // não renova sozinho
  showToast('Notificações desligadas neste aparelho');
  atualizarStatusAvisos();
}
/* tocou numa notificação: abre na aba dela (#ponto, #vendas) */
function abrirAbaDoAviso(aba){
  aba = aba || (location.hash || '').slice(1);
  if(['ponto','vendas','planner','louvor'].includes(aba)){
    switchAba(aba);
    if(location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
}
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e=>{ if(e.data && e.data.abrirAba) abrirAbaDoAviso(e.data.abrirAba); });

/* ===== Chave da IA (Google Gemini) para o Importar/Organizar do Louvor =====
   Fica nos dados protegidos pelo login (não vai no backup exportado). */
function atualizarStatusIA(){
  const tem = !!String(state.iaGoogleChave||'').trim();
  const st = document.getElementById('iaStatus'), inp = document.getElementById('iaChaveInput');
  if(st){ st.textContent = tem ? 'Ligada' : 'Desligada'; st.classList.toggle('ligada', tem); }
  if(inp) inp.placeholder = tem ? 'Chave salva ✓' : 'Cole a chave aqui';
  const rem = document.getElementById('iaRemover'); if(rem) rem.style.display = tem ? '' : 'none';
  if(typeof atualizarStatusDrive === 'function') atualizarStatusDrive();
  const ins = document.getElementById('iaInstrucoesInput');
  if(ins && document.activeElement !== ins) ins.value = iaInstrucoes();
}
/* instruções do Davi para a IA do Louvor (state.iaInstrucoes; vazio = as do padrão abaixo) */
const IA_INSTRUCOES_PADRAO = [
  'Nomes das partes: Intro, Primeira Parte, Segunda Parte, Terceira Parte, Pré-Refrão, Refrão, Ponte, Solo, Final.',
  'Parte cantada mais de uma vez seguida: escreva a letra uma vez e ponha as vezes (2x, 3x).',
  'Hino da Harpa Cristã: depois de cada parte vem o Refrão (Primeira Parte, Refrão, Segunda Parte, Repete - Refrão...).',
  'Jesus, Deus, Senhor, Cristo, Espírito Santo e os pronomes de Deus (Ele, Tu, Teu, Tua, Te, Ti, Contigo, Dele) sempre com maiúscula.',
  'Início de cada verso com maiúscula; no meio do verso só nomes próprios com maiúscula.',
  'Sem ponto final nem ponto no meio do verso.',
  'Verso curto, como se canta (até umas 40 letras); verso longo com duas frases vira duas linhas.',
  'Intro e Introdução ficam sempre, com os acordes.',
  'Nada de créditos, compositor, cantor, site ou rodapé no meio da letra.'
].join('\n');
function iaInstrucoes(){ return typeof state.iaInstrucoes === 'string' && state.iaInstrucoes.trim() ? state.iaInstrucoes : IA_INSTRUCOES_PADRAO; }
function salvarIaInstrucoes(v){
  v = String(v || '').trim();
  state.iaInstrucoes = v && v !== IA_INSTRUCOES_PADRAO ? v : '';
  persist();
  showToast('Instruções da IA salvas');
}
function iaInstrucoesPadrao(){
  state.iaInstrucoes = '';
  persist();
  const ins = document.getElementById('iaInstrucoesInput'); if(ins) ins.value = IA_INSTRUCOES_PADRAO;
  showToast('Instruções no padrão');
}
function salvarChaveIA(){
  const inp = document.getElementById('iaChaveInput');
  const v = (inp.value||'').trim();
  if(!v){ inp.focus(); return; }
  state.iaGoogleChave = v;
  inp.value = '';
  persist();
  atualizarStatusIA();
  showToast('Chave salva — o Importar agora usa a IA');
}
async function removerChaveIA(){
  if(!(await iosConfirm('Remover a chave? O Importar volta a usar a leitura simples.'))) return;
  state.iaGoogleChave = '';
  persist();
  atualizarStatusIA();
}

/* ================= IMPORTAR / EXPORTAR TODOS OS DADOS ================= */
function montarBackupApp(){
  const versaoEl = document.querySelector('.header-version');
  return {
    app: 'Siloe',
    versaoApp: versaoEl ? versaoEl.textContent.trim() : '',
    exportadoEm: new Date().toISOString(),
    mesAtual: mesAtualRef,
    mesPonto: mesPontoRef,
    state: Object.assign({}, state, { iaGoogleChave: undefined })   // a chave da IA não vai junto no backup
  };
}
function exportarDadosApp(){
  const backup = montarBackupApp();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `siloe-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup exportado');
}
function triggerImportarDados(){
  document.getElementById('importFileInput').click();
}
function onImportFileSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    let backup;
    try{
      backup = JSON.parse(e.target.result);
    }catch(err){
      showToast('Não foi possível ler esse arquivo.');
      event.target.value = '';
      return;
    }
    if(!backup || typeof backup !== 'object' || !backup.state){
      showToast('Esse arquivo não é um backup válido do Siloé.');
      event.target.value = '';
      return;
    }
    iosConfirm('Importar vai substituir TODOS os dados atuais do app por esse backup. Continuar?').then(ok=>{
      event.target.value = '';
      if(!ok) return;
      const novo = Object.assign(novoEstado(), backup.state);
      if(backup.mesAtual) novo.mesAtual = backup.mesAtual;
      if(state.iaGoogleChave) novo.iaGoogleChave = state.iaGoogleChave;   // o backup não traz a chave: mantém a atual
      state = novo;
      persistAgora().then(salvou=>{
        if(salvou) location.reload();
        else showToast('Erro ao importar: '+((window.SiloSupabase&&window.SiloSupabase.lastError)||'sem conexão com o Supabase'));
      });
    });
  };
  reader.readAsText(file);
}

/* ========== BUSCA GLOBAL ========== */
/* ---------- Nova categoria (Assinatura e Crédito à vista do cartão) ---------- */
function abrirNovaCategoriaExtra(alvo){
  document.getElementById('categoriaExtraAlvo').value = alvo;
  document.getElementById('categoriaExtraNome').value = '';
  document.getElementById('modalCategoriaExtra').classList.add('active');
}
function salvarCategoriaExtra(){
  const alvo = document.getElementById('categoriaExtraAlvo').value;
  const nome = document.getElementById('categoriaExtraNome').value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  const config = { customKey:'credoVistaCategoriasCustom', base:CREDOVISTA_CATEGORIAS };
  if(!state[config.customKey]) state[config.customKey] = [];
  const jaExiste = config.base.some(c=>c.toLowerCase()===nome.toLowerCase()) || state[config.customKey].some(c=>c.toLowerCase()===nome.toLowerCase());
  if(jaExiste){ showToast('Essa categoria já existe'); closeModal('modalCategoriaExtra'); return; }
  state[config.customKey].push(nome);
  persist();
  closeModal('modalCategoriaExtra');
  if(alvo==='assinatura'){
    window.assinaturaCategoriaSelecionada = nome;
    renderAssinaturaCategoriaChips();
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

  (state.louvores||[]).forEach(l=>{
    if((l.titulo||'').toLowerCase().includes(termo) || (l.artista||'').toLowerCase().includes(termo)){
      resultados.push({ label:l.titulo||'Sem título', meta:'Louvor · '+(l.artista||''), icon:'🎵', onclick:`irParaBuscaLouvor('${l.id}')` });
    }
  });

  if(resultados.length===0){
    /* não achou: se for um louvor, já procura no Cifra Club */
    const original = (document.getElementById('buscaGlobalInput')?.value || '').trim();
    el.innerHTML = `<div class="empty-state-sm">Nada encontrado</div>${original ? `
      <a class="busca-cifraclub" href="https://www.cifraclub.com.br/?q=${encodeURIComponent(original)}" target="_blank" rel="noopener">
        <span class="busca-cc-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
        <span class="busca-cc-txt"><b>É um louvor?</b><small>Pesquisar “${lvEsc(original)}” no Cifra Club</small></span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
      </a>` : ''}`;
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
  if(state.currentUser !== user) switchUser(user);
  switchAba('planner');
  setTimeout(()=>editGasto(cat, id), 200);
}
function irParaBuscaLouvor(id){
  closeModal('modalBuscaGlobal');
  switchAba('louvor');
  setTimeout(()=>abrirLouvorDetalhe(id), 200);
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


/* ================= BOTÃO VOLTAR DO CELULAR (toque duplo pra sair) ================= */
let voltarSairArmado = false;
let voltarSairTimer = null;
function fecharCamadaAbertaVoltar(){
  const conf = document.getElementById('iosConfirmOverlay');
  if(conf && conf.classList.contains('show')){ iosConfirmResolver(false); return true; }
  const modais = document.querySelectorAll('.modal-overlay.active');
  if(modais.length){
    const topo = modais[modais.length-1];
    closeModal(topo.id);
    return true;
  }
  const paginas = document.querySelectorAll('.fullpage.active');
  if(paginas.length){
    const pg = paginas[paginas.length-1];
    pg.classList.remove('active');
    document.body.style.overflow = '';
    return true;
  }
  return false;
}
function iniciarBotaoVoltar(){
  if(!window.history || !history.pushState) return;
  history.replaceState({siloe:'base'}, '');
  history.pushState({siloe:'guarda'}, '');
  window.addEventListener('popstate', ()=>{
    if(voltarSairArmado){
      voltarSairArmado = false;
      clearTimeout(voltarSairTimer);
      history.back();
      return;
    }
    history.pushState({siloe:'guarda'}, '');
    if(fecharCamadaAbertaVoltar()) return;
    voltarSairArmado = true;
    showToast('Toque de novo em voltar para sair');
    clearTimeout(voltarSairTimer);
    voltarSairTimer = setTimeout(()=>{ voltarSairArmado = false; }, 2000);
  });
}
iniciarBotaoVoltar();



/* ================= ALTURA REAL DO MENU INFERIOR ================= */
function ajustarAlturaMenuInferior(){
  const nav = document.querySelector('.bottom-nav');
  if(!nav) return;
  document.documentElement.style.setProperty('--navh', nav.offsetHeight+'px');
}
ajustarAlturaMenuInferior();
window.addEventListener('load', ajustarAlturaMenuInferior);
window.addEventListener('resize', ajustarAlturaMenuInferior);

/* ================= LOGO QUE É O PRÓPRIO BOTÃO =================
   Sem logo: tocar abre os arquivos. Com logo: aparece "Trocar imagem" e "Remover".
   Uso: <button class="logo-toque" data-input="idDoInputFile" data-remover="nomeDaFuncaoRemover" onclick="tocarLogo(this)"> */
function tocarLogo(btn){
  const input = document.getElementById(btn.dataset.input);
  const temLogo = !!btn.querySelector('img');
  fecharMenuLogo();
  if(!temLogo){ if(input) input.click(); return; }
  const menu = document.createElement('div');
  menu.className = 'logo-menu'; menu.id = 'logoMenu';
  menu.innerHTML = `<button type="button" data-acao="trocar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>Trocar imagem</button>
    <button type="button" data-acao="remover" class="perigo"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>Remover</button>`;
  menu.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    e.stopPropagation();
    if(b.dataset.acao==='trocar' && input) input.click();
    if(b.dataset.acao==='remover' && typeof window[btn.dataset.remover]==='function') window[btn.dataset.remover]();
    fecharMenuLogo();
  });
  const pai = btn.parentElement;
  if(getComputedStyle(pai).position === 'static') pai.style.position = 'relative';
  btn.insertAdjacentElement('afterend', menu);
  menu.style.left = btn.offsetLeft + 'px';
  menu.style.top = (btn.offsetTop + btn.offsetHeight + 8) + 'px';
  setTimeout(()=>document.addEventListener('click', fecharMenuLogo, { once:true }), 0);
}
function fecharMenuLogo(){ document.getElementById('logoMenu')?.remove(); }

/* ================= CALENDÁRIO PREMIUM (todos os campos de data) =================
   O <input type="date"> continua lá (escondido): o código lê e grava .value como sempre.
   No lugar dele aparece um botão com a data por extenso; tocando, abre o calendário do app
   (folha no celular, cartão logo abaixo do campo no computador). */
const CAL_SEMANA = ['D','S','T','Q','Q','S','S'];
const CAL_ICONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
const _valorInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
function calISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function calParse(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; }
function calTextoBotao(iso){
  const d = calParse(iso); if(!d) return '';
  return `${String(d.getDate()).padStart(2,'0')} de ${MES_NOMES[d.getMonth()].toLowerCase()}. de ${d.getFullYear()}`;
}
function melhorarCampoData(inp){
  if(inp.dataset.premium) return;
  inp.dataset.premium = '1';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'data-btn' + (inp.classList.contains('lv-data-agendamento') ? ' data-btn-compacto' : '');
  inp.classList.add('data-nativa');
  inp.after(btn);
  const sync = ()=>{
    const v = _valorInput.get.call(inp);
    btn.innerHTML = `<span class="${v?'':'data-vazia'}">${v ? calTextoBotao(v) : (btn.classList.contains('data-btn-compacto') ? 'Agendar' : 'Escolher data')}</span>${CAL_ICONE}`;
    btn.setAttribute('aria-label', v ? 'Data: '+calTextoBotao(v) : 'Escolher data');
    btn.disabled = inp.disabled;
  };
  /* quando o código grava input.value, o botão acompanha */
  Object.defineProperty(inp, 'value', { configurable:true, get(){ return _valorInput.get.call(this); }, set(v){ _valorInput.set.call(this, v); sync(); } });
  btn.addEventListener('click', e=>{ e.stopPropagation(); abrirCalendario(inp, btn); });
  sync();
}
function melhorarCamposData(raiz){ (raiz||document).querySelectorAll('input[type="date"]:not([data-premium])').forEach(melhorarCampoData); }

/* ========== LISTA CURTA VIRA BOTÕES (v12, janelas escolha C: "escolhas em botões") ==========
   <select> de uma janela com até 6 opções ganha uma fileira de botões; o select fica escondido e continua valendo
   (.value, onchange). Se o código trocar as opções ou o valor, os botões acompanham. */
const _valorSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
function melhorarSelect(sel){
  if(sel.dataset.chips) return;
  sel.dataset.chips = '1';
  const fila = document.createElement('div');
  fila.className = 'escolha-chips';
  sel.after(fila);
  const desenhar = ()=>{
    const ops = [...sel.options];
    const cabe = ops.length > 0 && ops.length <= 6;
    sel.classList.toggle('select-escondido', cabe);
    fila.hidden = !cabe;
    if(!cabe) return;
    const v = _valorSelect.get.call(sel);
    fila.innerHTML = ops.map(o=>`<button type="button" class="${o.value === v ? 'on' : ''}" data-v="${o.value.replace(/"/g, '&quot;')}">${o.textContent.replace(/</g, '&lt;')}</button>`).join('');
  };
  fila.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    _valorSelect.set.call(sel, b.dataset.v); desenhar();
    sel.dispatchEvent(new Event('change', { bubbles:true }));
  });
  Object.defineProperty(sel, 'value', { configurable:true, get(){ return _valorSelect.get.call(this); }, set(v){ _valorSelect.set.call(this, v); desenhar(); } });
  sel.addEventListener('change', desenhar);
  new MutationObserver(desenhar).observe(sel, { childList:true, subtree:true });
  desenhar();
}
document.querySelectorAll('.modal select').forEach(melhorarSelect);
melhorarCamposData();
new MutationObserver(()=>{ if(document.querySelector('input[type="date"]:not([data-premium])')) melhorarCamposData(); }).observe(document.body, { childList:true, subtree:true });

let calEstado = null;
function abrirCalendario(inp, btn){
  fecharCalendario();
  const atual = calParse(inp.value) || new Date();
  calEstado = { inp, btn, ano: atual.getFullYear(), mes: atual.getMonth() };
  const fundo = document.createElement('div');
  fundo.id = 'calFundo'; fundo.className = 'cal-fundo';
  fundo.addEventListener('click', fecharCalendario);
  const pop = document.createElement('div');
  pop.id = 'calPop'; pop.className = 'cal-pop';
  pop.addEventListener('click', e=>e.stopPropagation());
  document.body.append(fundo, pop);
  renderCalendario();
  /* computador: cartão logo abaixo (ou acima) do campo; celular: folha embaixo (CSS) */
  if(innerWidth >= 600){
    const r = btn.getBoundingClientRect(), h = pop.offsetHeight, w = pop.offsetWidth;
    const top = (r.bottom + 8 + h > innerHeight - 8) ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    pop.style.top = top + 'px';
    pop.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px';
  }
  requestAnimationFrame(()=>{ fundo.classList.add('aberto'); pop.classList.add('aberto'); });
  document.addEventListener('keydown', calTeclas);
}
function fecharCalendario(){
  document.getElementById('calPop')?.remove();
  document.getElementById('calFundo')?.remove();
  document.removeEventListener('keydown', calTeclas);
  calEstado = null;
}
function calTeclas(e){ if(e.key === 'Escape'){ e.preventDefault(); fecharCalendario(); } }
function calMudarMes(delta){
  if(!calEstado) return;
  const d = new Date(calEstado.ano, calEstado.mes + delta, 1);
  calEstado.ano = d.getFullYear(); calEstado.mes = d.getMonth();
  renderCalendario();
}
function renderCalendario(){
  const pop = document.getElementById('calPop'); if(!pop || !calEstado) return;
  const { inp, ano, mes } = calEstado;
  const sel = inp.value, hoje = calISO(new Date());
  const min = inp.min || '', max = inp.max || '';
  const primeiro = new Date(ano, mes, 1).getDay(), nDias = new Date(ano, mes+1, 0).getDate();
  let dias = '';
  for(let i=0; i<primeiro; i++) dias += '<span></span>';
  for(let d=1; d<=nDias; d++){
    const iso = calISO(new Date(ano, mes, d));
    const fora = (min && iso < min) || (max && iso > max);
    dias += `<button type="button" class="cal-dia${iso===sel?' sel':''}${iso===hoje?' hoje':''}" ${fora?'disabled':''} onclick="calEscolher('${iso}')">${d}</button>`;
  }
  pop.innerHTML = `
    <div class="cal-topo">
      <button type="button" class="cal-nav" aria-label="Mês anterior" onclick="calMudarMes(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="cal-titulo">${MES_NOMES_LONGOS[mes]} <span>${ano}</span></div>
      <button type="button" class="cal-nav" aria-label="Próximo mês" onclick="calMudarMes(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
    <div class="cal-semana">${CAL_SEMANA.map(s=>`<span>${s}</span>`).join('')}</div>
    <div class="cal-dias">${dias}</div>
    <div class="cal-rodape">
      <button type="button" class="cal-link" onclick="calEscolher('')">Limpar</button>
      <button type="button" class="cal-link forte" onclick="calEscolher('${hoje}')">Hoje</button>
    </div>`;
}
function calEscolher(iso){
  if(!calEstado) return;
  const inp = calEstado.inp;
  inp.value = iso;
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  inp.dispatchEvent(new Event('change', { bubbles:true }));
  fecharCalendario();
}

/* ================= FUNCIONAR SEM INTERNET =================
   Liga o sw.js: guarda o app e as bibliotecas no aparelho. Na prévia (localhost) fica desligado,
   para as mudanças em andamento sempre aparecerem na hora. */
if('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}

/* ================= EFEITOS (sutis; desligam com "reduzir movimento" do aparelho) =================
   1. cartões entram um após o outro ao trocar de aba / abrir o app
   2. números de dinheiro contam até o valor
   3. "feito": anel + ✓ no ponto do toque e vibração curta ao marcar conta paga, batida, ordem etc. */
const efeitosLigados = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function efeitoEntradaCartoes(raiz){
  if(!efeitosLigados || !raiz) return;
  const itens = [...raiz.querySelectorAll('.card, .section, .lv-card, .lv-roteiro')]
    .filter(el=>el.offsetParent !== null && !el.parentElement.closest('.card, .section'))
    .slice(0, 14);
  itens.forEach((el, i)=>{
    el.classList.remove('efeito-entra');
    void el.offsetWidth;
    el.style.setProperty('--i', i);
    el.classList.add('efeito-entra');
    setTimeout(()=>el.classList.remove('efeito-entra'), 800 + i*60);
  });
}
function efeitoContarNumeros(raiz){
  if(!efeitosLigados || !raiz) return;
  raiz.querySelectorAll('.resumo-stat-val, .prev-valor, .cb-rodape strong, .ponto-valor-grande, .cp-total-valor, .cp-resumo-val, .vd-meta-linha > b').forEach(el=>{
    if(el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;   // só texto puro (não mexe em quem tem ícone dentro)
    const alvoTxt = el.textContent, m = alvoTxt.match(/^(-?)R\$\s?([\d.]+,\d{2})$/);
    if(!m) return;
    const alvo = Number(m[2].replace(/\./g,'').replace(',','.')) * (m[1] ? -1 : 1);
    if(Math.abs(alvo) < 1) return;
    const ini = performance.now(), dur = 1400;   // devagar o bastante para ver contar
    let escrito = '';
    const passo = t=>{
      if(escrito && el.textContent !== escrito) return;   // a tela foi redesenhada: para
      const p = Math.min(1, (t - ini)/dur), e = 1 - Math.pow(1 - p, 3);
      escrito = p < 1 ? fmtMoneySigned(alvo * e) : alvoTxt;
      el.textContent = escrito;
      if(p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
/* saldo grande (é um campo): conta só na abertura do app, se não estiver sendo editado */
function efeitoContarSaldo(){
  const inp = document.getElementById('saldoAtualInput');
  if(!efeitosLigados || !inp || document.activeElement === inp) return;
  const alvoTxt = inp.value, alvo = parseMoney(alvoTxt);
  if(!(Math.abs(alvo) >= 1)) return;
  const ini = performance.now(), dur = 2200;   // o saldo conta mais devagar: é o número principal
  const passo = t=>{
    if(document.activeElement === inp){ inp.value = alvoTxt; return; }
    const p = Math.min(1, (t - ini)/dur), e = 1 - Math.pow(1 - p, 3);
    inp.value = p < 1 ? (alvo*e).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') : alvoTxt;
    if(p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
function efeitoAoTrocarAba(aba){
  const raiz = document.getElementById('aba-'+aba);
  efeitoEntradaCartoes(raiz);
  efeitoContarNumeros(raiz);
}
/* "feito": qualquer toque nos controles de marcar (conta paga, batida/dia do ponto, ordem, roteiro, salário, dízimo, fatura...) */
const EFEITO_FEITO = /togglePaid|contaTapEnd|toggleDiaConcluido|toggleCompraPago|toggleExtraRecebido|cpToggleSalario|cpToggleExtra|cpToggleDizimo|toggleFaturaMes/;
document.addEventListener('pointerup', ev=>{
  if(!efeitosLigados) return;
  const alvo = ev.target.closest('[onclick], [onpointerup]');
  if(!alvo || !EFEITO_FEITO.test((alvo.getAttribute('onclick')||'') + (alvo.getAttribute('onpointerup')||''))) return;
  const b = document.createElement('div');
  b.className = 'efeito-feito';
  b.style.left = ev.clientX + 'px'; b.style.top = ev.clientY + 'px';
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  document.body.appendChild(b);
  setTimeout(()=>b.remove(), 650);
  if(navigator.vibrate) navigator.vibrate(8);
}, true);


/* ========== SINO DE NOTIFICAÇÕES (dentro do app) ==========
   Os mesmos avisos das notificações do celular, calculados aqui com os dados do app:
   ponto (batida de hoje que já passou do horário e não foi marcada) e vendas (quanto falta para a meta).
   O que ainda não foi visto deixa o sino balançando; tocar num aviso leva até ele. */
const SINO_BATIDAS = [
  { campo:'entrada', nome:'entrada', padrao:'07:00' },
  { campo:'almocoSaida', nome:'saída do almoço', padrao:'12:00' },
  { campo:'almocoVolta', nome:'volta do almoço', padrao:'13:00' },
  { campo:'saida', nome:'saída', padrao:'17:00' }
];
function sinoVistos(){ try{ return JSON.parse(localStorage.getItem('siloe-avisos-vistos') || '[]'); }catch(e){ return []; } }
function sinoGuardarVistos(ids){ try{ localStorage.setItem('siloe-avisos-vistos', JSON.stringify(ids.slice(-60))); }catch(e){} }
function sinoAvisos(){
  const out = [];
  if(typeof state === 'undefined' || !state) return out;
  const agora = new Date(), dow = agora.getDay();
  const hojeTxt = agora.getFullYear() + '-' + String(agora.getMonth()+1).padStart(2,'0') + '-' + String(agora.getDate()).padStart(2,'0');
  /* PONTO: só olha (não cria o dia) */
  if(dow >= 1 && dow <= 5 && state.ponto && state.ponto.days){
    const mKey = hojeTxt.slice(0,7);
    const d = (state.ponto.days[mKey] || {})[String(agora.getDate())];
    const agoraMin = agora.getHours()*60 + agora.getMinutes();
    if(!(d && d.concluido)){
      SINO_BATIDAS.forEach(b=>{
        if(d && d[b.campo] === null) return;                       // dia sem esse horário
        if(d && d.confirmado && d.confirmado[b.campo]) return;     // já marcou
        let hora = (d && d[b.campo]) || b.padrao;
        if(!d && b.campo === 'saida' && dow === 5) hora = '16:00';
        const [h, m] = hora.split(':').map(Number);
        if(agoraMin >= h*60 + m + 5) out.push({ id:'ponto-'+hojeTxt+'-'+b.campo, tipo:'ponto', titulo:'Bater o ponto', corpo:`Falta bater a ${b.nome} (${hora}).`, quando: hora, ir:{ aba:'ponto', dia: agora.getDate() } });
      });
    }
  }
  /* VENDAS: quanto falta para a meta do mês (um aviso novo por dia) */
  try{
    const v = typeof calcularAvisosVendas === 'function' ? calcularAvisosVendas() : null;
    if(v && v.falta > 0.005){
      const planos = [v.nA ? `${v.nA} do ${v.nomeA}` : '', v.nB ? `${v.nB} do ${v.nomeB}` : ''].filter(Boolean).join(' ou ');
      out.push({ id:'vendas-'+v.mes+'-'+Math.round(v.falta*100), tipo:'vendas', titulo:'Vendas do mês', corpo:`Faltam ${fmtMoney(v.falta)} para a meta de ${v.mesNome}${planos ? ' — ' + planos : ''}.`, quando:'hoje', ir:{ aba:'vendas' } });
    }
  }catch(e){}
  /* FINANÇAS: faz dias que nada é lançado (Atualizar) */
  try{
    const ult = typeof atzUltimaAtualizacao === 'function' ? atzUltimaAtualizacao() : 0;
    const dias = ult ? Math.floor((Date.now() - ult) / 864e5) : 0;
    if(dias >= ATZ_DIAS_AVISO) out.push({ id:'financas-'+hojeTxt, tipo:'financas', titulo:'Assistente: atualizar as finanças', corpo:`Faz ${dias} dias que nada é lançado. Fale o que gastou desde então.`, quando:'hoje', ir:{ aba:'atualizar' } });
  }catch(e){}
  return out;
}
let sinoAtuais = [];
function atualizarSino(semLista){
  const btn = document.getElementById('sinoBtn'), conta = document.getElementById('sinoConta');
  if(!btn || !conta) return;
  sinoAtuais = sinoAvisos();
  const vistos = new Set(sinoVistos());
  const novos = sinoAtuais.filter(a=>!vistos.has(a.id)).length;
  conta.textContent = novos ? (novos > 9 ? '9+' : novos) : '';
  btn.classList.toggle('tem-novo', novos > 0);
  btn.classList.toggle('tem-aviso', sinoAtuais.length > 0);
  btn.title = novos ? `${novos} notificaç${novos>1?'ões novas':'ão nova'}` : 'Notificações';
  if(!semLista && document.getElementById('modalSino')?.classList.contains('active')) sinoRenderLista();
}
const SINO_ICONES = {
  ponto: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  vendas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  financas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H9l-5 4z"/></svg>'
};
function sinoRenderLista(){
  const vistos = new Set(sinoVistos());
  document.getElementById('sinoLista').innerHTML = sinoAtuais.length ? sinoAtuais.map((a, i)=>`
    <button type="button" class="sino-item ${a.tipo}${vistos.has(a.id)?'':' novo'}" style="animation-delay:${i*0.05}s" onclick="sinoIr(${i})">
      <span class="sino-ico">${SINO_ICONES[a.tipo] || ''}</span>
      <span class="sino-txt"><b>${a.titulo}</b><span>${a.corpo}</span></span>
      <span class="sino-quando">${a.quando}</span>
    </button>`).join('')
    : `<div class="sino-vazio"><div class="sino-vazio-ico">✓</div><b>Tudo em dia</b><span>Quando faltar bater o ponto ou vender para a meta, aparece aqui.</span></div>`;
}
function abrirSino(){
  sinoAtuais = sinoAvisos();
  sinoRenderLista();
  document.getElementById('modalSino').classList.add('active');
  /* só abrir não conta como lido: o aviso continua novo até tocar nele ou a situação mudar */
}
function sinoIr(i){
  const a = sinoAtuais[i]; if(!a) return;
  sinoGuardarVistos([...new Set([...sinoVistos(), a.id])]);   // tocou: este conta como lido
  atualizarSino(true);
  closeModal('modalSino');
  if(a.ir.aba === 'ponto'){
    if(state.pontoOffset){ state.pontoOffset = 0; }
    switchAba('ponto');
    if(typeof renderPonto === 'function') renderPonto();
    setTimeout(()=>sinoDestacar(document.getElementById('pontoDia-' + a.ir.dia)), 120);
  } else if(a.ir.aba === 'vendas'){
    switchAba('vendas');
    setTimeout(()=>sinoDestacar(document.querySelector('#vendasConteudo .vd-meta-linha') || document.getElementById('vendasConteudo')), 120);
  } else if(a.ir.aba === 'atualizar'){
    switchAba('planner');
    abrirAtualizar('conversa');
  }
}
function sinoDestacar(el){
  if(!el) return;
  el.scrollIntoView({ behavior:'smooth', block:'center' });
  el.classList.remove('sino-destaque'); void el.offsetWidth; el.classList.add('sino-destaque');
  setTimeout(()=>el.classList.remove('sino-destaque'), 2400);
}
/* a hora passa: confere de novo a cada minuto e quando o app volta para a tela */
setInterval(atualizarSino, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) atualizarSino(); });

/* ========== PIN DE ENTRADA ==========
   O Supabase só entra com e-mail + senha: o PIN (6 números) vira a senha da conta e o e-mail fica guardado
   no aparelho. Na tela de login o aparelho que já conhece o e-mail mostra só o teclado do PIN. */
const PIN_TAM = 6;
/* o app tem uma conta só: aparelho novo já entra pelo PIN com o e-mail da conta (trocado na aba Segurança, fica guardado no aparelho) */
const PIN_EMAIL_CONTA = atob('ZGF2aWpyMTIzLmJlcXVlckBnbWFpbC5jb20=');
function pinEmailDoAparelho(){
  try{
    const salvo = localStorage.getItem('siloe-pin-email'); if(salvo) return salvo;
    const s = JSON.parse(localStorage.getItem('siloe-auth') || 'null');   // sessão guardada (mesmo vencida) tem o e-mail
    if(s && s.user && s.user.email) return s.user.email;
  }catch(e){}
  return PIN_EMAIL_CONTA;
}
function pinGuardarEmail(email){ try{ if(email) localStorage.setItem('siloe-pin-email', email); else localStorage.removeItem('siloe-pin-email'); }catch(e){} }
/* depois de carregar: se o PIN já foi criado (em qualquer aparelho), este aparelho passa a entrar com ele */
/* o login abre no PIN, a menos que este aparelho já saiba que o PIN está desligado */
function pinLigadoNoAparelho(){ try{ return localStorage.getItem('siloe-pin-ligado') !== '0'; }catch(e){ return true; } }
async function pinLembrarAparelho(){
  try{ localStorage.setItem('siloe-pin-ligado', state && state.loginPin ? '1' : '0'); }catch(e){}
  if(!window.SiloSupabase) return;
  const email = await window.SiloSupabase.emailAtual();   // guarda sempre o e-mail atual (pode ter sido trocado em outro aparelho)
  if(email) pinGuardarEmail(email);
}
/* teclado numérico reutilizável: desenha em el, chama aoCompletar(pin) com 6 números */
function pinTeclado(tecladoId, pontosId, aoCompletar){
  const tec = document.getElementById(tecladoId), pts = document.getElementById(pontosId);
  let valor = '';
  const desenha = ()=>{ pts.innerHTML = Array.from({ length: PIN_TAM }, (_, i)=>`<i class="${i < valor.length ? 'cheio' : ''}"></i>`).join(''); };
  const apaga = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/></svg>';
  tec.innerHTML = ['1','2','3','4','5','6','7','8','9','','0','x'].map(t=>
    t === '' ? '<span></span>' : `<button type="button" class="pin-tecla${t==='x'?' apagar':''}" data-t="${t}" aria-label="${t==='x'?'Apagar':t}">${t==='x'?apaga:t}</button>`).join('');
  const toca = t=>{
    if(t === 'x'){ valor = valor.slice(0, -1); desenha(); return; }
    if(valor.length >= PIN_TAM) return;
    valor += t; desenha();
    if(navigator.vibrate) try{ navigator.vibrate(6); }catch(_){}
    if(valor.length === PIN_TAM){ const v = valor; setTimeout(()=>aoCompletar(v), 120); }
  };
  tec.onclick = e=>{ const b = e.target.closest('.pin-tecla'); if(b) toca(b.dataset.t); };
  desenha();
  return {
    limpar(){ valor = ''; desenha(); },
    tremer(){ pts.classList.remove('errou'); void pts.offsetWidth; pts.classList.add('errou'); if(navigator.vibrate) try{ navigator.vibrate([40,40,40]); }catch(_){} },
    tecla: toca,
    el: tec
  };
}
/* teclado físico (computador) no teclado que estiver aberto */
let pinTecladoAtivo = null;
document.addEventListener('keydown', e=>{
  if(!pinTecladoAtivo || !pinTecladoAtivo.el.offsetParent) return;   // teclado fechado: não captura
  if(e.target && e.target.matches && e.target.matches('input,textarea')) return;   // digitando o e-mail
  if(/^[0-9]$/.test(e.key)){ pinTecladoAtivo.tecla(e.key); e.preventDefault(); }
  else if(e.key === 'Backspace'){ pinTecladoAtivo.tecla('x'); e.preventDefault(); }
});

/* ---------- tela de login no modo PIN ---------- */
let pinLogin = null;
function loginModoPin(ligar){
  const tela = document.getElementById('loginTela'); if(!tela) return;
  const email = pinEmailDoAparelho();
  tela.classList.toggle('modo-pin', !!ligar);
  if(ligar){
    /* saudação com o nome de quem usa este aparelho (v12, escolha A) */
    const ola = document.getElementById('loginPinOla');
    if(ola){ const h = new Date().getHours(); let u = 'davi'; try{ u = localStorage.getItem(CHAVE_USUARIO) || 'davi'; }catch(e){}
      ola.textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + ', ' + (u === 'cris' ? 'Cris' : 'Davi'); }
    document.getElementById('loginPinErro').textContent = '';
    pinLogin = pinTeclado('loginPinTeclado', 'loginPinPontos', entrarComPin);
    pinTecladoAtivo = pinLogin;
  } else {
    pinTecladoAtivo = null;
    if(email && !document.getElementById('loginEmail').value) document.getElementById('loginEmail').value = email;
  }
}
async function entrarComPin(pin){
  const erro = document.getElementById('loginPinErro'), sub = document.getElementById('loginPinSub');
  const email = pinEmailDoAparelho();   // sem campo de e-mail: o PIN é a entrada principal
  sub.textContent = 'Entrando…'; erro.textContent = '';
  const r = await window.SiloSupabase.entrar(email, pin);
  sub.textContent = 'Digite seu PIN';
  if(!r.ok){
    erro.textContent = /incorretos/.test(r.erro) ? 'PIN errado' : r.erro;
    pinLogin.tremer(); pinLogin.limpar();
    return;
  }
  pinGuardarEmail(email);
  pinTecladoAtivo = null;
  aposEntrar();
}

/* ---------- criar/trocar o PIN (Dados do App) ---------- */
function atualizarStatusPin(){
  const st = document.getElementById('pinStatus'), btn = document.getElementById('pinBtn');
  if(!st || !btn) return;
  const ligado = !!(state && state.loginPin);
  st.textContent = ligado ? 'Ligado' : 'Desligado';
  st.classList.toggle('ligada', ligado);
  btn.textContent = ligado ? 'Trocar PIN' : 'Criar PIN';
}
let pinModal = null;
function abrirCriarPin(){
  let primeiro = '';
  const titulo = document.getElementById('pinModalTitulo'), sub = document.getElementById('pinModalSub'), erro = document.getElementById('pinModalErro');
  titulo.textContent = state.loginPin ? 'Trocar PIN' : 'Criar PIN';
  sub.textContent = 'Escolha 6 números'; erro.textContent = '';
  pinModal = pinTeclado('pinModalTeclado', 'pinModalPontos', async pin=>{
    if(!primeiro){
      if(/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)){ erro.textContent = 'Fácil demais de adivinhar — escolha outro'; pinModal.tremer(); pinModal.limpar(); return; }
      primeiro = pin; erro.textContent = ''; sub.textContent = 'Digite de novo para confirmar'; pinModal.limpar(); return;
    }
    if(pin !== primeiro){ primeiro = ''; erro.textContent = 'Os dois não bateram. Comece de novo.'; sub.textContent = 'Escolha 6 números'; pinModal.tremer(); pinModal.limpar(); return; }
    sub.textContent = 'Salvando…';
    const r = await window.SiloSupabase.trocarSenha(pin);
    if(!r.ok){ erro.textContent = r.erro; sub.textContent = 'Escolha 6 números'; primeiro = ''; pinModal.limpar(); return; }
    pinGuardarEmail(await window.SiloSupabase.emailAtual());
    state.loginPin = true;
    try{ localStorage.setItem('siloe-pin-ligado', '1'); }catch(e){}
    persist();
    pinTecladoAtivo = null;
    closeModal('modalPin');
    atualizarStatusPin();
    showToast('PIN criado. Da próxima vez que pedir para entrar, é só o PIN');
  });
  pinTecladoAtivo = pinModal;
  document.getElementById('modalPin').classList.add('active');
}

/* ========== SEGURANÇA (Dados do App → aba Segurança) ==========
   PIN, senha, e-mail e aparelhos conectados. O Supabase não lista as sessões para o app, então cada aparelho
   se registra em state.aparelhos [{id, nome, primeiro, ultimo, sair}] ao abrir; "Desconectar" marca sair:true
   e o aparelho sai sozinho na próxima vez que abrir. */
function aparelhoId(){
  try{
    let id = localStorage.getItem('siloe-aparelho-id');
    if(!id){ id = 'ap' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('siloe-aparelho-id', id); }
    return id;
  }catch(e){ return ''; }
}
function aparelhoNome(){
  const ua = navigator.userAgent || '';
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
  const app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  return so + (app ? ' · app' : nav ? ' · ' + nav : '');
}
function aparelhoEhCelular(nome){ return /iPhone|Android|iPad/.test(nome || ''); }
/* chamado depois de carregar: registra este aparelho ou sai, se outro aparelho mandou desconectar */
async function aparelhoRegistrar(){
  if(MODO_TESTE_LOCAL || !state || !remoteReady) return;
  const id = aparelhoId(); if(!id) return;
  if(!Array.isArray(state.aparelhos)) state.aparelhos = [];
  const agora = new Date().toISOString();
  let ap = state.aparelhos.find(a=>a.id === id);
  if(ap && ap.sair){
    state.aparelhos = state.aparelhos.filter(a=>a.id !== id);
    await persistAgora();
    await window.SiloSupabase.sair();
    apagarCopiaLocal();
    location.reload();
    return;
  }
  const nome = aparelhoNome();
  if(!ap){ ap = { id, nome, primeiro: agora, ultimo: agora }; state.aparelhos.push(ap); persist(); return; }
  if(ap.nome !== nome || Date.now() - new Date(ap.ultimo).getTime() > 3600e3){ ap.nome = nome; ap.ultimo = agora; persist(); }
}
function segQuando(iso){
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if(!(min >= 0) || min < 60) return 'agora há pouco';
  const h = Math.round(min / 60); if(h < 24) return `há ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`;
}
function renderSeguranca(){
  atualizarStatusPin();
  const em = document.getElementById('segEmailAtual');
  window.SiloSupabase.emailAtual().then(e=>{ if(em) em.textContent = e; });
  const lista = document.getElementById('segAparelhos'); if(!lista) return;
  const meu = aparelhoId();
  const aps = (state.aparelhos || []).slice().sort((a, b)=>(b.id === meu) - (a.id === meu) || String(b.ultimo).localeCompare(String(a.ultimo)));
  const celular = '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>';
  const pc = '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>';
  lista.innerHTML = aps.length ? aps.map(a=>{
    const este = a.id === meu;
    const info = este ? '<b class="seg-este">Este aparelho</b>' : a.sair ? 'Sai quando abrir de novo' : 'Usado ' + segQuando(a.ultimo);
    const botao = este ? '' : a.sair
      ? `<button type="button" class="ico-btn" onclick="segDesconectar('${a.id}', false)" title="Manter conectado" aria-label="Manter conectado">${ICO('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>')}</button>`
      : `<button type="button" class="ico-btn seg-sair" onclick="segDesconectar('${a.id}', true)" title="Desconectar" aria-label="Desconectar">${ICO('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>')}</button>`;
    return `<div class="seg-ap${a.sair ? ' saindo' : ''}"><span class="seg-ap-ico">${ICO(aparelhoEhCelular(a.nome) ? celular : pc, 20)}</span><div class="seg-ap-txt"><div class="seg-ap-nome">${escBanco(a.nome || 'Aparelho')}</div><div class="seg-ap-info">${info}</div></div>${botao}</div>`;
  }).join('') : '<div class="ia-desc">Nenhum aparelho registrado ainda.</div>';
}
async function segDesconectar(id, sair){
  const a = (state.aparelhos || []).find(x=>x.id === id); if(!a) return;
  if(sair && !(await iosConfirm(`Desconectar ${a.nome}? Ele sai sozinho na próxima vez que abrir o app.`))) return;
  if(sair) a.sair = true; else delete a.sair;
  persist();
  renderSeguranca();
}
async function segTrocarSenha(){
  const inp = document.getElementById('segSenhaInput'), nova = inp.value;
  if(nova.length < 6){ showToast('A senha precisa de pelo menos 6 caracteres'); return; }
  if(state.loginPin && !(await iosConfirm('Trocar a senha desliga o PIN (você entra com e-mail e senha até criar outro). Continuar?'))) return;
  const r = await window.SiloSupabase.trocarSenha(nova);
  if(!r.ok){ showToast(r.erro.replace('esse PIN', 'essa senha').replace('criar o PIN', 'trocar a senha')); return; }
  inp.value = '';
  state.loginPin = false;
  try{ localStorage.setItem('siloe-pin-ligado', '0'); }catch(e){}
  persist();
  atualizarStatusPin();
  showToast('Senha trocada');
}
async function segTrocarEmail(){
  const inp = document.getElementById('segEmailInput'), novo = inp.value.trim();
  if(!/^\S+@\S+\.\S+$/.test(novo)){ showToast('Digite um e-mail válido'); return; }
  if(!(await iosConfirm(`Trocar o e-mail da conta para ${novo}? Vai chegar um link nesse e-mail para confirmar.`))) return;
  const r = await window.SiloSupabase.trocarEmail(novo);
  if(!r.ok){ showToast(r.erro); return; }
  inp.value = '';
  showToast('Link enviado. Abra o e-mail para confirmar a troca');
}

/* ========== FUNDO COM IMAGEM (Dados do App) ==========
   state.fundoApp = { img: dataURL (reduzida), forca: 'suave' | 'medio' | 'forte' }.
   A imagem fica atrás de tudo, com um véu da cor do papel por cima para o texto continuar legível. */
/* quanto a imagem aparece (0 a 100); quem escolheu Suave/Médio/Forte antes continua igual */
const FUNDO_FORCA_ANTIGA = { suave: 8, medio: 22, forte: 41 };
function fundoVisivel(f){ return f && f.visivel != null ? Number(f.visivel) : (FUNDO_FORCA_ANTIGA[f && f.forca] ?? 22); }
function fundoVeu(v){ return Math.max(.6, Math.min(.97, .97 - v * .0037)); }   // véu da cor do papel por cima da foto (nunca deixa o texto ilegível)
function fundoForca(el, v){ el.style.setProperty('--veu', fundoVeu(v)); el.style.setProperty('--desfoque', Math.max(10, 30 - v * .2).toFixed(1) + 'px'); }
function aplicarFundoApp(){
  const f = null;   // v9.0: visual preto e branco, sem foto de fundo (state.fundoApp fica guardado, só não aparece)
  let el = document.getElementById('fundoApp');
  if(!f || !f.img){ document.documentElement.classList.remove('tem-fundo'); if(el) el.remove(); atualizarStatusFundo(); return; }
  if(!el){ el = document.createElement('div'); el.id = 'fundoApp'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
  el.style.backgroundImage = `url("${f.img}")`;
  fundoForca(el, fundoVisivel(f));
  document.documentElement.classList.add('tem-fundo');
  atualizarStatusFundo();
}
function atualizarStatusFundo(){
  const st = document.getElementById('fundoStatus'), rem = document.getElementById('fundoRemover'), forca = document.getElementById('fundoForca');
  if(!st) return;
  const f = state && state.fundoApp, tem = !!(f && f.img);
  st.textContent = tem ? 'Ligado' : 'Sem imagem';
  st.classList.toggle('ligada', tem);
  if(rem) rem.style.display = tem ? '' : 'none';
  if(forca){
    forca.style.display = tem ? '' : 'none';
    if(tem){ const v = Math.round(fundoVisivel(f)); document.getElementById('fundoForcaBarra').value = v; fundoPintarBarra(v); }
  }
}
function escolherFundoApp(ev){
  const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
  if(!file) return;
  const leitor = new FileReader();
  leitor.onload = async ()=>{
    const img = await comprimirImagemDataUrl(String(leitor.result), 1600, 0.72);
    state.fundoApp = { img, visivel: state.fundoApp ? fundoVisivel(state.fundoApp) : 22 };
    persist();
    aplicarFundoApp();
    showToast('Fundo aplicado');
  };
  leitor.readAsDataURL(file);
}
/* barra: enquanto arrasta só mostra; ao soltar, salva */
function setVisivelFundo(v, salvar){
  if(!state.fundoApp) return;
  v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  state.fundoApp.visivel = v; delete state.fundoApp.forca;
  const el = document.getElementById('fundoApp');
  if(el) fundoForca(el, v);
  fundoPintarBarra(v);
  if(salvar) persist();
}
function fundoPintarBarra(v){
  const barra = document.getElementById('fundoForcaBarra'), txt = document.getElementById('fundoForcaValor');
  if(barra){ barra.style.setProperty('--p', v + '%'); if(Number(barra.value) !== v) barra.value = v; }
  if(txt) txt.textContent = v + '%';
}
function removerFundoApp(){
  delete state.fundoApp;
  persist(); aplicarFundoApp();
  showToast('Fundo removido');
}

/* ========== JARVIS: tela do microfone enquanto ouve ==========
   Anel tipo "reator" girando, barras em volta que reagem à fala e o texto aparecendo embaixo.
   jarvisAbrir({ titulo, aoParar }) · jarvisTexto(t) · jarvisPensando(t) · jarvisFechar() */
let jarvisEstado = null;
function jarvisAbrir(op){
  op = op || {};
  jarvisFechar(true);
  const el = document.createElement('div');
  el.className = 'jarvis';
  el.innerHTML = `
    <div class="jv-fundo"></div>
    <div class="jv-centro">
      <canvas class="jv-canvas" width="560" height="560"></canvas>
      <svg class="jv-aneis" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="jv-a1" cx="100" cy="100" r="92"/>
        <circle class="jv-a2" cx="100" cy="100" r="80"/>
        <circle class="jv-a3" cx="100" cy="100" r="68"/>
        <circle class="jv-a4" cx="100" cy="100" r="56"/>
        <g class="jv-marcas">${Array.from({ length: 36 }, (_, i)=>`<line x1="100" y1="4" x2="100" y2="${i % 3 ? 9 : 13}" transform="rotate(${i*10} 100 100)"/>`).join('')}</g>
      </svg>
      <button type="button" class="jv-nucleo" aria-label="Parar de ouvir"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg></button>
    </div>
    <div class="jv-status"><span class="jv-ponto"></span><span class="jv-status-txt">OUVINDO</span></div>
    <div class="jv-titulo">${op.titulo || 'Pode falar'}</div>
    <div class="jv-texto"></div>
    <button type="button" class="jv-fechar">Toque no centro para terminar</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('aberto'));
  const est = { el, nivel: .15, alvo: .15, t: 0, raf: 0, aoParar: op.aoParar, pensando: false };
  jarvisEstado = est;
  const parar = ()=>{ if(est.aoParar) est.aoParar(); else jarvisFechar(); };
  el.querySelector('.jv-nucleo').onclick = parar;
  el.querySelector('.jv-fechar').onclick = parar;
  el.querySelector('.jv-fundo').onclick = parar;
  if(navigator.vibrate) try{ navigator.vibrate(12); }catch(_){}
  /* barras em volta do anel: sobem com a fala (cada texto novo dá um "pulso") */
  const cv = el.querySelector('.jv-canvas'), ctx = cv.getContext('2d');
  const N = 72, R = 168;
  const desenha = ()=>{
    est.t += 1;
    est.alvo = Math.max(.12, est.alvo * .965);
    est.nivel += (est.alvo - est.nivel) * .18;
    ctx.clearRect(0, 0, 560, 560);
    ctx.save(); ctx.translate(280, 280);
    for(let i = 0; i < N; i++){
      const ang = (i / N) * Math.PI * 2 + est.t * .004;
      const onda = Math.sin(i * .55 + est.t * .09) * .5 + Math.sin(i * 1.7 - est.t * .05) * .35 + .9;
      const tam = 8 + est.nivel * 62 * onda * (est.pensando ? .45 : 1);
      ctx.rotate(Math.PI * 2 / N);
      const g = ctx.createLinearGradient(0, -R, 0, -R - tam);
      g.addColorStop(0, 'rgba(120,230,255,.95)'); g.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-2, -R - tam, 4, tam);
    }
    ctx.restore();
    est.raf = requestAnimationFrame(desenha);
  };
  desenha();
  return est;
}
function jarvisTexto(t){
  const est = jarvisEstado; if(!est) return;
  const el = est.el.querySelector('.jv-texto');
  if(el.textContent !== t){ el.textContent = t; est.alvo = Math.min(1, est.alvo + .55); }
}
function jarvisPensando(t){
  const est = jarvisEstado; if(!est) return;
  est.pensando = true;
  est.el.classList.add('pensando');
  est.el.querySelector('.jv-status-txt').textContent = t || 'PROCESSANDO';
  est.el.querySelector('.jv-fechar').textContent = '';
}
function jarvisFechar(agora){
  const est = jarvisEstado; if(!est) return;
  jarvisEstado = null;
  cancelAnimationFrame(est.raf);
  if(agora){ est.el.remove(); return; }
  est.el.classList.remove('aberto');
  est.el.classList.add('saindo');
  setTimeout(()=>est.el.remove(), 380);
}

/* ========== MAIS ANIMAÇÕES ==========
   Onda ao tocar nos botões (de onde o dedo tocou) e a barra de baixo com o ícone "pulando" ao trocar de aba. */
const ONDA_ALVOS = '.btn, .resumo-btn, .dif-chip, .lv-card, .lm-parte, .sino-item, .lv-barra-btn, .section-add, .lvn-medley, .lvn-importar, .pin-tecla, .gm-linha, .ponto-semana-head';
document.addEventListener('pointerdown', e=>{
  if(!efeitosLigados) return;
  const alvo = e.target.closest(ONDA_ALVOS);
  if(!alvo || alvo.disabled) return;
  const r = alvo.getBoundingClientRect();
  const tam = Math.max(r.width, r.height) * 2.2;
  const onda = document.createElement('span');
  onda.className = 'efeito-onda';
  onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam/2}px;top:${e.clientY - r.top - tam/2}px`;
  if(getComputedStyle(alvo).position === 'static') alvo.classList.add('onda-pos');
  alvo.classList.add('onda-recorte');
  alvo.appendChild(onda);
  setTimeout(()=>{ onda.remove(); if(!alvo.querySelector('.efeito-onda')) alvo.classList.remove('onda-recorte', 'onda-pos'); }, 650);
}, { passive: true });
document.addEventListener('click', e=>{
  const nav = e.target.closest('.nav-item');
  if(!nav || !efeitosLigados) return;
  nav.classList.remove('nav-pulo'); void nav.offsetWidth; nav.classList.add('nav-pulo');
});

/* Dados do App em abas: Geral · Visual · Recursos · Conta */
let ddAbaAtual = 'geral';
function ddAba(nome){
  ddAbaAtual = nome;
  document.querySelectorAll('#ddAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.dd === nome));
  document.querySelectorAll('#aba-ajustes .dd-painel').forEach(p=>p.classList.toggle('active', p.dataset.dd === nome));
}

/* ========== VERSÍCULO (topo de Finanças) ==========
   Um versículo diferente a cada vez que o app abre (não repete o da última vez). */
const VERSICULOS = [
  ['O Senhor é o meu pastor; nada me faltará. Deitar-me faz em verdes pastos, guia-me mansamente a águas tranquilas. Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do Seu nome. Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque Tu estás comigo.', 'Salmos 23:1-4'],
  ['Não se aparte da tua boca o livro desta Lei; antes, medita nele dia e noite, para que tenhas cuidado de fazer conforme tudo quanto nele está escrito; porque, então, farás prosperar o teu caminho. Não to mandei Eu? Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.', 'Josué 1:8-9'],
  ['Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-O em todos os teus caminhos, e Ele endireitará as tuas veredas. Não sejas sábio aos teus próprios olhos; teme ao Senhor e aparta-te do mal.', 'Provérbios 3:5-7'],
  ['Não andeis ansiosos de coisa alguma; em tudo, porém, sejam conhecidas, diante de Deus, as vossas petições, pela oração e pela súplica, com ações de graças. E a paz de Deus, que excede todo o entendimento, guardará o vosso coração e a vossa mente em Cristo Jesus.', 'Filipenses 4:6-7'],
  ['Aprendi a viver contente em toda e qualquer situação. Tanto sei estar humilhado como também ser honrado; de tudo e em todas as circunstâncias já tenho experiência, tanto de fartura como de fome, assim de abundância como de escassez. Tudo posso naquele que me fortalece.', 'Filipenses 4:11-13'],
  ['Faz forte ao cansado e multiplica as forças ao que não tem nenhum vigor. Os jovens se cansam e se fatigam, e os moços de exaustos caem, mas os que esperam no Senhor renovam as suas forças, sobem com asas como águias, correm e não se cansam, caminham e não se fatigam.', 'Isaías 40:29-31'],
  ['Não temas, porque Eu sou contigo; não te assombres, porque Eu sou o teu Deus; Eu te fortaleço, e te ajudo, e te sustento com a minha destra fiel. Porque Eu, o Senhor, teu Deus, te tomo pela tua mão direita e te digo: Não temas, que Eu te ajudo.', 'Isaías 41:10, 13'],
  ['Não vos inquieteis, dizendo: Que comeremos? Que beberemos? Ou: Com que nos vestiremos? Vosso Pai celeste sabe que necessitais de todas elas. Buscai, pois, em primeiro lugar, o Seu reino e a Sua justiça, e todas estas coisas vos serão acrescentadas. Não vos inquieteis com o dia de amanhã; basta ao dia o seu próprio mal.', 'Mateus 6:31-34'],
  ['Vinde a mim, todos os que estais cansados e sobrecarregados, e Eu vos aliviarei. Tomai sobre vós o meu jugo e aprendei de mim, porque sou manso e humilde de coração; e achareis descanso para a vossa alma. Porque o meu jugo é suave, e o meu fardo é leve.', 'Mateus 11:28-30'],
  ['Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus, daqueles que são chamados segundo o Seu propósito. Que diremos, pois, à vista destas coisas? Se Deus é por nós, quem será contra nós? Aquele que não poupou o Seu próprio Filho, porventura não nos dará graciosamente com Ele todas as coisas?', 'Romanos 8:28, 31-32'],
  ['Em todas estas coisas somos mais que vencedores, por meio daquele que nos amou. Porque eu estou bem certo de que nem a morte, nem a vida, nem os anjos, nem as coisas do presente, nem do porvir, nem a altura, nem a profundidade, nem qualquer outra criatura poderá separar-nos do amor de Deus, que está em Cristo Jesus, nosso Senhor.', 'Romanos 8:37-39'],
  ['Rogo-vos, pois, irmãos, pelas misericórdias de Deus, que apresenteis o vosso corpo por sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis com este século, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus.', 'Romanos 12:1-2'],
  ['O que habita no esconderijo do Altíssimo e descansa à sombra do Onipotente diz ao Senhor: Meu refúgio e meu baluarte, Deus meu, em quem confio. Porque aos Seus anjos dará ordens a teu respeito, para que te guardem em todos os teus caminhos.', 'Salmos 91:1-2, 11'],
  ['Elevo os olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez o céu e a terra. Ele não permitirá que os teus pés vacilem; não dormitará aquele que te guarda. O Senhor guardará a tua saída e a tua entrada, desde agora e para sempre.', 'Salmos 121:1-3, 8'],
  ['Confia no Senhor e faze o bem; habita na terra e alimenta-te da verdade. Agrada-te do Senhor, e Ele satisfará os desejos do teu coração. Entrega o teu caminho ao Senhor, confia nele, e o mais Ele fará.', 'Salmos 37:3-5'],
  ['Deus é o nosso refúgio e fortaleza, socorro bem presente nas tribulações. Portanto, não temeremos ainda que a terra se transtorne e os montes se abalem no seio dos mares; ainda que as águas tumultuem e espumejem e na sua fúria os montes se estremeçam.', 'Salmos 46:1-3'],
  ['As misericórdias do Senhor são a causa de não sermos consumidos, porque as Suas misericórdias não têm fim; renovam-se cada manhã. Grande é a Tua fidelidade. A minha porção é o Senhor, diz a minha alma; portanto, esperarei nele. Bom é o Senhor para os que esperam por Ele, para a alma que O busca.', 'Lamentações 3:22-25'],
  ['Eu é que sei que pensamentos tenho a vosso respeito, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que desejais. Então, me invocareis, passareis a orar a mim, e Eu vos ouvirei. Buscar-me-eis e me achareis quando me buscardes de todo o vosso coração.', 'Jeremias 29:11-13'],
  ['Por isso, não desanimamos; pelo contrário, mesmo que o nosso homem exterior se corrompa, o nosso homem interior se renova de dia em dia. Porque a nossa leve e momentânea tribulação produz para nós eterno peso de glória, não atentando nós nas coisas que se veem, mas nas que se não veem; porque as que se veem são temporais, e as que se não veem são eternas.', '2 Coríntios 4:16-18'],
  ['A minha graça te basta, porque o poder se aperfeiçoa na fraqueza. De boa vontade, pois, mais me gloriarei nas fraquezas, para que sobre mim repouse o poder de Cristo. Pelo que sinto prazer nas fraquezas, nas necessidades, nas angústias, por amor de Cristo. Porque, quando sou fraco, então, é que sou forte.', '2 Coríntios 12:9-10'],
  ['Não vos enganeis: de Deus não se zomba; pois aquilo que o homem semear, isso também ceifará. E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não desfalecermos. Por isso, enquanto tivermos oportunidade, façamos o bem a todos.', 'Gálatas 6:7, 9-10'],
  ['Visto que temos a rodear-nos tão grande nuvem de testemunhas, desembaraçando-nos de todo peso e do pecado que tenazmente nos assedia, corramos, com perseverança, a carreira que nos está proposta, olhando firmemente para o Autor e Consumador da fé, Jesus.', 'Hebreus 12:1-2'],
  ['Toda disciplina, com efeito, no momento não parece ser motivo de alegria, mas de tristeza; ao depois, entretanto, produz fruto pacífico aos que têm sido por ela exercitados, fruto de justiça. Por isso, restabelecei as mãos descaídas e os joelhos trôpegos; e fazei caminhos retos para os pés.', 'Hebreus 12:11-13'],
  ['Não sabeis vós que os que correm no estádio, todos, na verdade, correm, mas um só leva o prêmio? Correi de tal maneira que o alcanceis. Todo atleta em tudo se domina; aqueles, para alcançar uma coroa corruptível; nós, porém, a incorruptível. Assim corro também eu, não sem meta; assim luto, não como desferindo golpes no ar.', '1 Coríntios 9:24-26'],
  ['Porque Deus não nos tem dado espírito de covardia, mas de poder, de amor e de moderação. Participa dos meus sofrimentos como bom soldado de Cristo Jesus. Nenhum soldado em serviço se envolve em negócios desta vida, porque o seu objetivo é satisfazer àquele que o arregimentou.', '2 Timóteo 1:7; 2:3-4'],
  ['Combati o bom combate, completei a carreira, guardei a fé. Já agora a coroa da justiça me está guardada, a qual o Senhor, reto juiz, me dará naquele Dia; e não somente a mim, mas também a todos quantos amam a Sua vinda.', '2 Timóteo 4:7-8'],
  ['Quanto ao mais, sede fortalecidos no Senhor e na força do Seu poder. Revesti-vos de toda a armadura de Deus, para poderdes ficar firmes contra as ciladas do diabo. Portanto, tomai toda a armadura de Deus, para que possais resistir no dia mau e, depois de terdes vencido tudo, permanecer inabaláveis.', 'Efésios 6:10-11, 13'],
  ['Tudo quanto fizerdes, fazei-o de todo o coração, como para o Senhor e não para homens, cientes de que recebereis do Senhor a recompensa da herança. A Cristo, o Senhor, é que estais servindo.', 'Colossenses 3:23-24'],
  ['Vai ter com a formiga, ó preguiçoso, considera os seus caminhos e sê sábio. Não tendo ela chefe, nem oficial, nem comandante, no estio prepara o seu pão, na sega ajunta o seu mantimento. Ó preguiçoso, até quando ficarás deitado? Um pouco para dormir, um pouco para cochilar, um pouco para cruzar os braços em repouso, assim sobrevirá a tua pobreza como um ladrão.', 'Provérbios 6:6-11'],
  ['Confia ao Senhor as tuas obras, e os teus desígnios serão estabelecidos. O Senhor fez todas as coisas para determinados fins. O coração do homem traça o seu caminho, mas o Senhor lhe dirige os passos.', 'Provérbios 16:3-4, 9'],
  ['Sobre tudo o que se deve guardar, guarda o coração, porque dele procedem as fontes da vida. Desvia de ti a falsidade da boca e afasta de ti a perversidade dos lábios. Os teus olhos olhem direito, e as tuas pálpebras, diretamente diante de ti. Pondera a vereda de teus pés, e todos os teus caminhos sejam retos.', 'Provérbios 4:23-26'],
  ['Trazei todos os dízimos à casa do Tesouro, para que haja mantimento na minha casa; e provai-me nisto, diz o Senhor dos Exércitos, se Eu não vos abrir as janelas do céu e não derramar sobre vós bênção sem medida.', 'Malaquias 3:10'],
  ['Honra ao Senhor com os teus bens e com as primícias de toda a tua renda; e se encherão fartamente os teus celeiros, e transbordarão de vinho os teus lagares. Filho meu, não rejeites a disciplina do Senhor, nem te enfades da Sua repreensão.', 'Provérbios 3:9-11'],
  ['Quem é fiel no pouco também é fiel no muito; e quem é injusto no pouco também é injusto no muito. Se, pois, não vos tornastes fiéis na aplicação das riquezas, quem vos confiará a verdadeira riqueza?', 'Lucas 16:10-11'],
  ['Deixo-vos a paz, a minha paz vos dou; não vo-la dou como a dá o mundo. Não se turbe o vosso coração, nem se atemorize. Estas coisas vos tenho dito para que tenhais paz em mim. No mundo, passais por aflições; mas tende bom ânimo; Eu venci o mundo.', 'João 14:27; 16:33'],
  ['Eu sou a videira, vós, os ramos. Quem permanece em mim, e Eu, nele, esse dá muito fruto; porque sem mim nada podeis fazer. Se permanecerdes em mim, e as minhas palavras permanecerem em vós, pedireis o que quiserdes, e vos será feito.', 'João 15:5, 7'],
  ['Meus irmãos, tende por motivo de toda alegria o passardes por várias provações, sabendo que a provação da vossa fé, uma vez confirmada, produz perseverança. Ora, a perseverança deve ter ação completa, para que sejais perfeitos e íntegros, em nada deficientes.', 'Tiago 1:2-4'],
  ['Humilhai-vos, portanto, sob a poderosa mão de Deus, para que Ele, em tempo oportuno, vos exalte, lançando sobre Ele toda a vossa ansiedade, porque Ele tem cuidado de vós. Sede sóbrios e vigilantes. O diabo, vosso adversário, anda em derredor, como leão que ruge procurando alguém para devorar.', '1 Pedro 5:6-8'],
  ['Bem-aventurado o homem que não anda no conselho dos ímpios, não se detém no caminho dos pecadores, nem se assenta na roda dos escarnecedores. Antes, o seu prazer está na lei do Senhor, e na Sua lei medita de dia e de noite. Ele é como árvore plantada junto a corrente de águas, que, no devido tempo, dá o seu fruto, e cuja folhagem não murcha.', 'Salmos 1:1-3'],
  ['O Senhor é a minha luz e a minha salvação; de quem terei medo? O Senhor é a fortaleza da minha vida; a quem temerei? Espera pelo Senhor, tem bom ânimo, e fortifique-se o teu coração; espera, pois, pelo Senhor.', 'Salmos 27:1, 14'],
  ['Não temas, porque Eu te remi; chamei-te pelo teu nome, tu és meu. Quando passares pelas águas, Eu serei contigo; quando, pelos rios, eles não te submergirão; quando passares pelo fogo, não te queimarás, nem a chama arderá em ti.', 'Isaías 43:1-2'],
  ['Sede fortes e corajosos, não temais, nem vos atemorizeis, porque o Senhor, vosso Deus, é quem vai convosco; não vos deixará, nem vos desamparará. O Senhor é quem vai adiante de ti; Ele será contigo, não te deixará, nem te desamparará; não temas, nem te atemorizes.', 'Deuteronômio 31:6, 8'],
  ['Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu: há tempo de nascer e tempo de morrer; tempo de plantar e tempo de arrancar o que se plantou; tempo de chorar e tempo de rir; tempo de prantear e tempo de saltar de alegria.', 'Eclesiastes 3:1-2, 4'],
  ['Ele te declarou, ó homem, o que é bom e que é o que o Senhor pede de ti: que pratiques a justiça, e ames a misericórdia, e andes humildemente com o teu Deus.', 'Miqueias 6:8'],
  ['O amor é paciente, é benigno; o amor não arde em ciúmes, não se ufana, não se ensoberbece, não se conduz inconvenientemente, não procura os seus interesses, não se exaspera, não se ressente do mal; não se alegra com a injustiça, mas regozija-se com a verdade; tudo sofre, tudo crê, tudo espera, tudo suporta.', '1 Coríntios 13:4-7'],
  ['Regozijai-vos sempre. Orai sem cessar. Em tudo, dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco. Julgai todas as coisas, retende o que é bom; abstende-vos de toda forma de mal.', '1 Tessalonicenses 5:16-18, 21-22'],
  ['Sonda-me, ó Deus, e conhece o meu coração; prova-me e conhece os meus pensamentos; vê se há em mim algum caminho mau e guia-me pelo caminho eterno.', 'Salmos 139:23-24'],
  ['Ainda que a figueira não floresça, nem haja fruto na vide; o produto da oliveira minta, e os campos não produzam mantimento; ainda que as ovelhas sejam arrebatadas do aprisco, e nos currais não haja gado, todavia, eu me alegro no Senhor, exulto no Deus da minha salvação. O Senhor Deus é a minha fortaleza.', 'Habacuque 3:17-19'],
  ['Irmãos, quanto a mim, não julgo havê-lo alcançado; mas uma coisa faço: esquecendo-me das coisas que para trás ficam e avançando para as que diante de mim estão, prossigo para o alvo, para o prêmio da soberana vocação de Deus em Cristo Jesus.', 'Filipenses 3:13-14'],
  ['Porque Deus amou o mundo de tal maneira que deu o Seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna. Porquanto Deus enviou o Seu Filho ao mundo, não para que julgasse o mundo, mas para que o mundo fosse salvo por Ele.', 'João 3:16-17']
];
const versiculoAtual = (()=>{
  let ultimo = -1; try{ ultimo = Number(localStorage.getItem('siloe-versiculo')); }catch(e){}
  let i = Math.floor(Math.random() * VERSICULOS.length);
  if(i === ultimo) i = (i + 1 + Math.floor(Math.random() * (VERSICULOS.length - 1))) % VERSICULOS.length;
  try{ localStorage.setItem('siloe-versiculo', String(i)); }catch(e){}
  return VERSICULOS[i];
})();
function renderVersiculo(){
  const el = document.getElementById('versiculoDia');
  if(!el || el.dataset.pronto) return;
  el.dataset.pronto = '1';
  el.innerHTML = `<p class="vs-texto">${versiculoAtual[0]}</p><span class="vs-ref">${versiculoAtual[1]}</span>`;
  el.onclick = ()=>el.classList.toggle('inteiro');
}

/* ---------- nome do ícone ao segurar o dedo (botões só com ícone) ----------
   Vale para todo botão com desenho e sem texto que tenha title/aria-label. Segurou → mostra o nome e não aperta. */
let icoSegurar = null;   // { el, timer, x, y, mostrou }
function icoNomeDe(el){
  const nome = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  if(!nome || !el.querySelector('svg')) return '';
  return el.textContent.replace(/\s+/g, '').length > 4 ? '' : nome;   // botão com texto já diz o que faz
}
function icoMostrarNome(el, nome){
  let b = document.getElementById('icoNome');
  if(!b){ b = document.createElement('div'); b.id = 'icoNome'; b.className = 'ico-nome'; document.body.appendChild(b); }
  b.textContent = nome;
  b.classList.remove('aberto');
  const r = el.getBoundingClientRect();
  b.style.left = '0px'; b.style.top = '0px';
  const w = b.offsetWidth, h = b.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width/2 - w/2));
  const y = r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10;
  b.style.left = x + 'px'; b.style.top = y + 'px';
  void b.offsetWidth; b.classList.add('aberto');
  clearTimeout(b._fechar); b._fechar = setTimeout(()=>b.classList.remove('aberto'), 1600);
}
document.addEventListener('touchstart', e=>{
  const el = e.target.closest && e.target.closest('button,[role="button"],a,.ico-btn');
  const nome = el ? icoNomeDe(el) : '';
  if(icoSegurar) clearTimeout(icoSegurar.timer);
  if(!nome){ icoSegurar = null; return; }
  const t = e.touches[0];
  icoSegurar = { el, x:t.clientX, y:t.clientY, mostrou:false };
  icoSegurar.timer = setTimeout(()=>{
    if(!icoSegurar) return;
    icoSegurar.mostrou = true;
    icoMostrarNome(el, nome);
    if(navigator.vibrate) navigator.vibrate(8);
  }, 450);
}, { passive:true });
document.addEventListener('touchmove', e=>{
  if(!icoSegurar || icoSegurar.mostrou) return;
  const t = e.touches[0];
  if(Math.abs(t.clientX - icoSegurar.x) > 10 || Math.abs(t.clientY - icoSegurar.y) > 10){ clearTimeout(icoSegurar.timer); icoSegurar = null; }
}, { passive:true });
document.addEventListener('touchend', e=>{
  if(!icoSegurar) return;
  clearTimeout(icoSegurar.timer);
  if(icoSegurar.mostrou){ e.preventDefault(); setTimeout(()=>{ icoSegurar = null; }, 400); }   // segurou para ver o nome: não aperta
  else icoSegurar = null;
}, { passive:false });
document.addEventListener('touchcancel', ()=>{ if(icoSegurar){ clearTimeout(icoSegurar.timer); if(!icoSegurar.mostrou) icoSegurar = null; } });
document.addEventListener('click', e=>{
  if(icoSegurar && icoSegurar.mostrou){ e.preventDefault(); e.stopPropagation(); icoSegurar = null; }
}, true);

/* ---------- Finanças "só o essencial" (celular) ----------
   Mostra só o resumo (saldo, vai entrar, falta pagar, próximos meses, Contas do mês); a seta embaixo abre o resto.
   Escolha guardada no aparelho (siloe-fin-tudo = '1' → mostra tudo). */
function finEssencial(){ try{ return localStorage.getItem('siloe-fin-tudo') !== '1'; }catch(e){ return true; } }
function finAplicarEssencial(){
  const aba = document.getElementById('aba-planner'), btn = document.getElementById('btnFinTudo');
  if(!aba) return;
  const so = finEssencial();
  aba.classList.toggle('essencial', so);
  if(btn){ const nome = so ? 'Mostrar tudo' : 'Só o essencial'; btn.title = nome; btn.setAttribute('aria-label', nome); btn.classList.toggle('aberto', !so); }
  if(typeof applyAllLayouts === 'function') setTimeout(applyAllLayouts, 30);
}
function finEssencialAlternar(){
  const mostrarTudo = finEssencial();
  try{ mostrarTudo ? localStorage.setItem('siloe-fin-tudo', '1') : localStorage.removeItem('siloe-fin-tudo'); }catch(e){}
  finAplicarEssencial();
  if(mostrarTudo){
    const prim = document.querySelector('#aba-planner .fin-extra');
    if(prim) setTimeout(()=>prim.scrollIntoView({ behavior:'smooth', block:'start' }), 60);
  }
}
finAplicarEssencial();
