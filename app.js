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
  showToast(`${monthLabel(f.m)}: gastos a pagar ${fmtMoney(f.gastos)}${f.meta?` + meta de sobra ${fmtMoney(f.meta)}`:''}`);
}
function renderHeaderHoje(){
  const el = document.getElementById('headerHoje');
  if(!el) return;
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const faltam = ultimo - hoje.getDate();
  const data = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' de '+MES_NOMES_LONGOS[hoje.getMonth()].toLowerCase();
  const dataCurta = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' '+MES_NOMES[hoje.getMonth()].toLowerCase();
  const resto = faltam===0 ? 'último dia do mês' : (faltam===1 ? 'falta 1 dia p/ o fim do mês' : 'faltam '+faltam+' dias p/ o fim do mês');
  const restoCurto = faltam===0 ? 'último dia' : 'faltam '+faltam+' dia'+(faltam>1?'s':'');
  const f = headerFaltaPagar();
  const falta = f ? `<button type="button" class="hh-falta${f.total>0.004?'':' ok'}" onclick="headerFaltaDetalhe()" title="Gastos que faltam pagar${f.meta?' + meta de sobra':''} em ${monthLabel(f.m)}">${f.total>0.004?`<span class="hh-longo">Falta pagar</span><span class="hh-curto">A pagar</span> <b>${fmtMoney(f.total)}</b>`:'<b>✓ Tudo pago</b>'}</button>` : '';
  el.innerHTML = `<div class="hh-linha1"><span class="hh-longo">${data}</span><span class="hh-curto">${dataCurta}</span></div>
    <div class="hh-linha2"><span class="hh-longo">${resto}</span><span class="hh-curto">${restoCurto}</span>${falta?'<span class="hh-sep">·</span>'+falta:''}</div>`;
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
  ]},
  { versao: 'v3.9', itens: [
    'Saldo por banco: anote quanto tem em cada banco e a soma vai para o Saldo em conta (digitar direto continua valendo)',
    'Todos os campos de número abrem o teclado numérico no celular; a hora extra do Ponto aceita só números (130 vira 1:30)',
    'Louvor: Edição, Visualizar e Slides com barra no topo e configurações num cartão compacto; PDF virou ícone no canto',
    'Louvor: slides só com a letra e saiu o botão "Editar na folha"'
  ]},
  { versao: 'v3.8', itens: [
    'Abertura com a logo mais longa e bem mais suave',
    'Louvor: cada tom com seus próprios nomes (F# e Gb são diferentes), na cifra e no campo harmônico',
    'Louvor: tocar e segurar uma nota escolhe o relativo menor (segurar D escolhe Bm)',
    'Louvor: Organizar coloca a linha divisória (--) entre os blocos e mantém os "-" (próximo slide) e "---" (próxima coluna)',
    'Louvor: importa PDF do Cifra Club em duas colunas, com título, artista e tom do cabeçalho e versos inteiros',
    'Ponto PJ: PDF com novo layout (total de horas no topo, semanas separadas, rodapé) e sem o botão de copiar',
    'Ponto PJ: janela de Exportar redesenhada, com resumo de dias e horas'
  ]},
  { versao: 'v3.7', itens: [
    'Abertura com a logo animada enquanto os dados carregam (não mostra mais R$ 0,00)',
    'Login com e-mail e senha (uma vez por aparelho) para proteger os dados, e "Sair deste aparelho" em Dados do App',
    'Celular e computador salvando juntos: as alterações dos dois são juntadas em vez de uma apagar a outra',
    'Voltaram a funcionar o botão voltar do celular, o Enter para ir ao próximo campo e a atualização do "falta pagar"',
    'A setinha de recolher Moradia, Assinaturas e Fixos voltou a funcionar',
    'App mais leve: logos e ícones menores, dados antigos sem uso removidos e slides do Louvor baixados só quando usados'
  ]},
  { versao: 'v3.6', itens: [
    'Ponto PJ: o PDF tem o botão "Copiar para planilha" — copia os horários com tabulação, e colando numa célula cada dia vai para uma linha e cada horário para sua coluna'
  ]},
  { versao: 'v3.5', itens: [
    'No computador as abas usam a largura toda; Ponto PJ e Vendas com o resumo à esquerda e o resto à direita',
    'Ponto PJ: Valor da hora e Fechar mês num rodapé compacto',
    'Cabeçalho no celular com textos mais curtos para o "A pagar" não cortar'
  ]},
  { versao: 'v3.4', itens: [
    'Nova aba Vendas: comissão de setup (no mês da venda) e de recorrência (a partir do mês seguinte, enquanto o cliente estiver ativo), com configuração de % e de dois modelos de venda',
    'Metas de sobra mês a mês: sobra do Fluxo (empréstimo dentro, cartão fora) + comissões = projetada, quanto falta e quantas vendas de cada modelo ainda faltam',
    'Quando a projeção passa da meta, sugere amortizar o excedente no empréstimo',
    'Empréstimo: novo modo "Amortizar por valor", que calcula quantas parcelas do fim o valor quita',
    'Louvor: importar cifra de PDF ou foto (leitura de imagem), com título, artista e tom pelo nome do arquivo',
    'Louvor: "Organizar blocos" nomeia as partes e troca blocos iguais por "Repete - ..."',
    'Louvor: folha nova (acordes em cima da sílaba, colunas automáticas, fonte normal ou monoespaçada), edição direto na folha e PDF fiel pela impressão',
    'Louvor: slides com acordes (fundo branco, para os músicos); "Repete" mostra a letra inteira nos slides',
    'Ponto PJ: PDF com os horários em texto (Entrada;Almoço;Volta;Saída) para colar na planilha; saíram os botões de copiar'
  ]},
  { versao: 'v3.3', itens: [
    'Cartão e Empréstimo entram no Geral para mostrar a sobra real, com liga/desliga em todos os meses ou só em um',
    'Contas do mês redesenhada: resumo com barra, bolinha de pago em todas as linhas e blocos de Cartão e Empréstimo',
    'Cartão: botões "+ Parcelada" e "Ajuste da fatura" (diferença para o valor do banco vira lançamento); fatura no dia do vencimento mostra "vence hoje · sem juros"',
    'Cartão e Empréstimo com a cor da logo no topo do card',
    'Cada bloco de contas mostra o total do mês e, se já pagou algo, pago / falta com barra',
    'Ponto PJ: mês centralizado, PDF minimalista sem valores, período Personalizado com os dias trancados, botões de copiar dia/semana e link "Copiar para planilha" no PDF',
    'Todas as janelas no mesmo padrão (folha no celular, cartão no computador, interruptores no lugar das caixinhas) e Enter pula para o próximo campo',
    'Correções: marcar/desmarcar em Contas do mês atualiza o Dashboard; fatura considerada paga mostra o valor pago'
  ]},
  { versao: 'v3.2', itens: [
    'Visual novo, premium e minimalista: paleta neutra com azul, fonte Inter, cards sem borda e sem caixa dentro de caixa',
    'Dashboard reorganizado: Resumo do mês no topo (saldo, vai entrar, falta pagar, sobra prevista e Contas do mês), contas em seguida, Fluxo mensal e Projeção do saldo embaixo',
    'Nova aba Empréstimo: parcelas, amortização antecipando as últimas parcelas, desconto obtido e simulador com a conta detalhada',
    'Cartão: opção "Considerar fatura paga" com o valor total que você pagou',
    'Contas do mês: Finalizar conclui o mês e já passa para o próximo',
    'Ponto PJ reorganizado; saiu o gráfico de tendência semanal',
    'Cabeçalho mostra a data de hoje e quantos dias faltam para o fim do mês',
    'Saíram o botão de editar layout e a escolha manual de mês; conflito entre aparelhos agora fica com a edição mais recente, sem perguntar'
  ]},
  { versao: 'v3.1', itens: [
    'Cartão: cada cartão mostra a fatura em destaque com o status (Aberta, Fechada aguardando pagamento, Vencida gerando juros, Paga ou Paga em parte), pelos dias de fechamento e vencimento',
    'Cartão: botão Pagar abre uma janela com o valor pago; pagamento menor que a fatura fica parcial (laranja) e o que foi pago deixa de contar no acumulado',
    'Cartão: compra nova já vem na fatura aberta (no dia do fechamento ela já vai para o mês seguinte); Crédito à Vista agora pede o mês da fatura',
    'Faixa de faturas do cartão marca as pagas (verde), parciais (laranja) e vencidas (vermelho)',
    'Ponto PJ: botão Fechar mês (confere os dias úteis trancados, deixa trancar ou editar os que faltam, fecha e avança o mês); mês fechado ganha marca verde e pode ser reaberto; saiu a escolha de mês das configurações',
    'Dashboard e Contas a pagar: dá para olhar o mês anterior e navegar pelos meses seguintes só para ver; o Concluir mês do topo agora avança só o mês das contas'
  ]},
  { versao: 'v3.0', itens: [
    'Dashboard novo: o antigo Planner agora se chama Dashboard, com as abas Geral e Cartão; o Dashboard antigo, a IA e os temas saíram',
    'Geral: o Acumulado de vários meses ficou no topo (no lugar do resumo); sem cartão no Fluxo Mensal',
    'Cartão: tem o próprio Acumulado (sobra do Geral − fatura dos cartões)',
    'Contas a pagar: botão discreto no Saldo Atual abre a lista do mês com "recebi" do salário e de cada extra, "paguei" do dízimo e as contas; o que está marcado deixa de contar',
    'Banco de dados: avisa na tela quando não salva, guarda uma cópia neste aparelho, e não deixa um aparelho apagar o que o outro salvou sem perguntar'
  ]},
  { versao: 'v2.82', itens: [
    'Removidas as abas Receitas e Mercado (menu, buscas e IA); backup e importar dados continuam no app',
    'Botão da IA menor e discreto (meio apagado até tocar)'
  ]},
  { versao: 'v2.81', itens: [
    'Mês atual: Dashboard e Planner andam juntos (seletor na versão); o Ponto PJ tem o mês dele, só nas configurações do Ponto',
    'Dashboard > Contas: removido o Fluxo de caixa; Contas a pagar agora vem antes de Parcelas terminando'
  ]},
  { versao: 'v2.80', itens: [
    'IA no Planner: adiciona compra no cartão (à vista, parcelada, assinatura) e renda extra por voz, sempre mostrando uma janelinha para você conferir e salvar',
    'Cartões: resumo mês a mês com sobra, fatura e quanto resta (só ali, a sobra do Dashboard segue sem o cartão)',
    'Temas Luxury Dark e Premium funcionando (Configurações > Tema) e limpeza de código antigo'
  ] },
  { versao: 'v2.79', itens: [
    'Extra do Planner: marque como recebido em cada mês (toque na linha Extra) e ele para de somar, sem duplicar com o saldo em conta; a IA também marca por voz',
    'Configurações: opção de segurar Dashboard/Planner no mês anterior sem mexer no Ponto PJ'
  ] },
  { versao: 'v2.78', itens: [
    'Removidos os microfones antigos (ditado por aba); só o microfone da IA fica, nas abas Dashboard, Planner, Ponto e Mercado. A IA agora também registra o ponto por voz, mostra dias úteis sem cadeado e mexe nas listas do Mercado'
  ] },
  { versao: 'v2.77', itens: [
    'IA: análise financeira (botão ✨ e no Concluir mês), leitura de boleto por foto (botão câmera), alerta diário quando o saldo vai faltar e perguntas/simulações por voz'
  ] },
  { versao: 'v2.76', itens: [
    'Assistente de voz: corrigida a repetição de palavras ao falar no celular; novo painel de conversa com o que você disse, o raciocínio da IA e as ações feitas'
  ] },
  { versao: 'v2.75', itens: [
    'Assistente de voz com IA: botão de microfone flutuante em todas as abas; fale naturalmente (pausa de 3s) para atualizar saldo, marcar contas como pagas, adicionar, alterar valor, excluir e abrir o Resumo'
  ] },
  { versao: 'v2.74', itens: [
    'Logos são reduzidas ao enviar e as já salvas são otimizadas uma vez; salvar na nuvem tenta de novo se falhar'
  ]},
  { versao: 'v2.73', itens: [
    'Corrigido: funções de cálculo e formatação que estavam faltando deixavam o Dashboard vazio e travavam a importação',
    'Avisos de conexão com a nuvem agora mostram o motivo do erro'
  ]},
  { versao: 'v2.71', itens: [
    'Dados salvos só na nuvem (Supabase), sem localStorage; os dados antigos do aparelho são migrados na primeira abertura'
  ]},
  { versao: 'v2.67', itens: [
    'Microfone em mais abas: Planner (gastos), Cartões (compra/assinatura), Ponto PJ (horários) e Louvor (novo louvor) — preenche o formulário e você confere antes de salvar',
    'Modais: o botão Salvar não fica mais escondido pelo teclado'
  ]},
  { versao: 'v2.66', itens: [
    'Mercado: lista "No mercado" sem seleção, ✕ de excluir à direita, botão Finalizar compra no fim da lista; cada item adicionado já soma no gasto do mês e no Dashboard'
  ]},
  { versao: 'v2.65', itens: [
    'Mercado: mesmo espaçamento lateral em Lista, Casa e Gastos no computador; campos maiores com a fonte do app; meta de gasto com barra sempre visível na Lista',
    'Mercado: itens sem preço em "No mercado" com borda vermelha; ditado reconhece preço por unidade (por kg fica em branco); Casa só mostra barra e selo quando há mínimo definido'
  ]},
  { versao: 'v2.64', itens: [
    'Desktop: removidas as barras de rolagem dentro dos cards (altura agora acompanha o conteúdo) e espaçamento igual entre todos os cards, sem buracos, no Dashboard e no Planner',
    'Fluxo de caixa: destaque do ponto mais apertado redesenhado; Parcelas terminando agora agrupadas por mês'
  ]},
  { versao: 'v2.63', itens: [
    'Mercado: barra inferior encostada no menu (altura medida automaticamente), "1 item" no singular e títulos de grupo alinhados'
  ]},
  { versao: 'v2.62', itens: [
    'Mercado: ditar itens por voz (microfone) e botão "Repetir última compra" na Planejando',
    'Dados do App: botão para enviar o backup pelo compartilhamento do celular (Drive, WhatsApp...)'
  ]},
  { versao: 'v2.61', itens: [
    'Mercado: barra fixa embaixo (Lista, Casa, Gastos) e lista no mercado agrupada por categoria',
    'Dia de recebimento e aviso de vencimento agora abrem uma janela do app em vez da caixa do navegador'
  ]},
  { versao: 'v2.60', itens: [
    'Mercado: meta de gasto mensal (definida em Gastos) com barra no topo da Lista e aviso de preço mais barato/caro na Casa',
    'Limpeza: removidos códigos sem uso e logs de depuração'
  ]},
  { versao: 'v2.59', itens: [
    'Mercado: Estoque virou "Casa" com barra de nível (vermelho/amarelo/verde), estimativa de dias restantes e filtro "Acabando"; Dashboard virou "Gastos"'
  ]},
  { versao: 'v2.58', itens: [
    'Botão voltar do celular: agora fecha a tela/janela aberta primeiro e, na tela principal, pede para tocar de novo para sair',
    'Mercado: resumo no topo (gasto do mês e itens acabando), abas Planejando/No mercado e barra do carrinho fixa embaixo'
  ]},
  { versao: 'v2.57', itens: [
    'Novo: em Dados do App dá pra definir manualmente qual é o "mês atual" do app (afeta Planner, Ponto PJ, Dashboard e fatura dos cartões)'
  ]},
  { versao: 'v2.56', itens: [
    'Mercado todo compacto: abas viraram texto sublinhado, itens perderam a caixa/sombra e viraram linhas finas, quantidade virou selo dourado pequeno, "mover pra lista" virou ícone — cabe muito mais item na tela em Lista, Estoque e Dashboard'
  ]},
  { versao: 'v2.55', itens: [
    'Corrigido: nome do item sumia nos cards do Mercado quando não cabia ao lado da quantidade e dos botões (ficava com largura zero) — agora o nome sempre ocupa a linha toda e os botões vão pra linha de baixo'
  ]},
  { versao: 'v2.54', itens: [
    'Mercado: lista de compras, estoque e dashboard ganharam layout próprio de computador (grade de cards, dashboard em 2 colunas) em vez do formato de celular esticado'
  ]},
  { versao: 'v2.53', itens: [
    'Novo: tela "Comando" (clica na logo) — ordens do dia, sequência de dias em disciplina, juramento e registro de autossabotagem'
  ]},
  { versao: 'v2.52', itens: [
    'Dashboard: Acumulado virou uma linha do tempo com o valor de cada mês (em vez da tabela); os dois donuts viraram um número de Sobra em destaque + barra única "Para onde foi", com % e valor de cada categoria',
    'Planner: campo de Saldo Atual maior, com sublinhado dourado; mês atual do Fluxo Mensal destacado em dourado'
  ]},
  { versao: 'v2.51', itens: [
    'Novo visual: tema claro e leve, preto e dourado — dourado marca o que está selecionado/ativo (menu, chips, versão)',
    'Cards com mais respiro (mais espaço interno e entre eles) e cantos mais suaves',
    'Corrigido: modal "Dados do App" ficava colado embaixo em telas médias; agora centraliza mais cedo'
  ]},
  { versao: 'v2.50', itens: [
    'Cartão: assinaturas (cobrança recorrente automática todo mês, com opção de cancelar)',
    'Cartão: dashboard de gastos do mês por categoria e por nome'
  ]},
  { versao: 'v2.49', itens: [
    'Crédito à vista: mês escolhido é o mês da compra, entra na fatura do mês seguinte',
    'Planner no computador: layout tipo Pinterest de verdade, sem espaço sobrando'
  ]},
  { versao: 'v2.48', itens: [
    'Layout: padrão agora é 3 colunas, drag & drop melhorado, scrollbar oculta com seta visual',
    'Planner: botão pra ver compras arquivadas no topo do cartão, ícones mais escuros'
  ]},
  { versao: 'v2.47', itens: [
    'Novo: botão de editar layout no header (Dashboard e Planner) — no computador dá pra arrastar, redimensionar e travar os cards; no celular dá pra reordenar',
    'Logo do Siloé e ícones do header centralizados no computador',
    'Ponto PJ: dias agrupados por semana, com opção de recolher cada semana pra ocupar menos espaço',
    'Modal de adicionar/editar gasto mais largo no computador, com mais campos lado a lado'
  ]},
  { versao: 'v2.46', itens: [
    'Cartões de Crédito: nova fatura mês a mês (rolagem lateral), começando no mês atual — clica num mês pra ver só o que cai nele, clica de novo pra voltar a ver tudo'
  ]},
  { versao: 'v2.45', itens: [
    'Novo: botão "Fonte" em Dados do App, com Inter, Poppins, Nunito e a padrão do celular pra escolher a fonte do app inteiro',
    'Títulos do app (cabeçalhos, cards, telas cheias) agora usam uma fonte própria, mais chamativa'
  ]},
  { versao: 'v2.44', itens: [
    'Corrigido: sair do Louvor pelo menu inferior sem fechar a tela do Louvor antes travava a tela aberta por cima',
    'Louvor: configurações de Visualizar e Slides mais compactas, em grade'
  ]},
  { versao: 'v2.43', itens: [
    'Louvor: editar título/artista já atualiza na hora o card na lista lateral',
    'Louvor: título e artista do slide de capa agora centralizados (preview e PowerPoint exportado), igual aos slides de letra'
  ]},
  { versao: 'v2.42', itens: [
    'Cartões de Crédito: botões "+ Parcelada" e "+ À vista" lado a lado'
  ]},
  { versao: 'v2.41', itens: [
    'Cartões de Crédito: some da tela quando o usuário selecionado é a Cris',
    'Cartões de Crédito: compras parceladas ordenadas por quem termina primeiro; ao quitar a última parcela, a compra vai para "Ver quitadas" em vez de continuar na lista',
    'Cartões de Crédito: mostra também a data de vencimento, junto com a de fechamento'
  ]},
  { versao: 'v2.40', itens: [
    'Moradia/Fixos/Assinaturas/Contas Futuras: ícones de ação em linha em cima do valor, ocupando menos espaço',
    'Fluxo Mensal: seta pra expandir de 6 para 12 meses',
    'Fluxo Mensal: tecla de avançar (Enter) mais confiável no teclado numérico do celular'
  ]},
  { versao: 'v2.39', itens: [
    'Dados do App: mostra só a atualização mais recente (não a lista toda)',
    'Removidos os backups automáticos (guardavam várias cópias inteiras dos dados e ocupavam espaço) — use o Exportar de vez em quando',
    'Louvor: removida a dica de formatação embaixo do texto na Edição',
    'Louvor: a folha de edição agora tem proporção de folha A4'
  ]},
  { versao: 'v2.38', itens: [
    'Planner: linhas de Moradia/Assinaturas/Fixos/Contas Futuras sem os botões de duplicar e arquivar; os que ficaram (pagar, editar, excluir) em uma coluna só, mais visíveis',
    'Louvor: removida a barra "Biblioteca/Estúdio" que travava a navegação — pra sair, use a setinha no cabeçalho'
  ]},
  { versao: 'v2.37', itens: [
    'Removido o leitor de QR do cupom fiscal (experimental, não estava funcionando)'
  ]},
  { versao: 'v2.36', itens: [
    'Modais agora abrem centralizados no computador (continuam subindo de baixo no celular), e o fundo não rola mais atrás de nenhum modal',
    'Botões pequenos (adicionar, editar, duplicar, excluir, abrir/fechar seção) com área de toque maior, sem mudar o visual',
    'Campos de formulário não dão mais zoom sozinhos ao tocar no iPhone',
    'Moradia, Assinaturas, Fixos e Contas Futuras agora aparecem em caixa, igual ao resto do Dashboard',
    'Emojis de alerta (vilão, aviso, meta batida, confirmação) trocados por ícones no estilo do app'
  ]},
  { versao: 'v2.35', itens: [
    'Simulador de Orçamento: botão "Usar total dos cartões em aberto" preenche a meta com o valor total do cartão, pra simular um empréstimo que quita tudo e parcela em N vezes',
    'PDF do Resumo: nova tabela com os próximos 6 meses, mostrando quanto de cartão e quanto de contas fixas/futuras em cada mês'
  ]},
  { versao: 'v2.34', itens: [
    'Planner no computador agora organiza os cartões e seções em colunas, igual ao Dashboard, em vez de empilhar tudo'
  ]},
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
  const v = CHANGELOG[0];
  el.innerHTML = `
    <div style="padding:8px 10px;background:var(--card-2);border-radius:8px">
      <div style="font-weight:700;font-size:12px;color:var(--text);margin-bottom:3px">${v.versao}</div>
      ${v.itens.map(txt => `<div style="font-size:11.5px;color:var(--text-faint);line-height:1.4">• ${txt}</div>`).join('')}
    </div>
  `;
}

function abrirImportExportModal(){
  document.getElementById('modalImportExport').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderChangelog();
  const btnSair = document.getElementById('btnSairApp');   // só aparece se este aparelho entrou com login
  if(btnSair && window.SiloSupabase) window.SiloSupabase.temSessao().then(s=>{
    btnSair.style.display = s ? '' : 'none';
    const pc = document.getElementById('pinConfig'); if(pc) pc.style.display = s ? '' : 'none';
    if(typeof atualizarStatusPin==='function') atualizarStatusPin();
  });

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
  closeModal('modalImportExport');
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
    if(topo.id==='modalNumeroSimples') cancelarNumeroModal();
    else closeModal(topo.id);
    return true;
  }
  const paginas = document.querySelectorAll('.fullpage.active');
  if(paginas.length){
    const pg = paginas[paginas.length-1];
    if(pg.id==='pageComando' && typeof fecharComando==='function') fecharComando();
    else pg.classList.remove('active');
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


/* ================= MODAL DE NÚMERO (substitui prompt nativo) ================= */
let numeroModalResolve = null;
function pedirNumeroModal(titulo, dica, atual){
  document.getElementById('numeroSimplesTitulo').textContent = titulo;
  document.getElementById('numeroSimplesDica').textContent = dica;
  const inp = document.getElementById('numeroSimplesInput');
  inp.value = atual ?? '';
  document.getElementById('modalNumeroSimples').classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>{ inp.focus(); inp.select(); }, 60);
  return new Promise(resolve=>{ numeroModalResolve = resolve; });
}
function confirmarNumeroModal(){
  const v = document.getElementById('numeroSimplesInput').value;
  closeModal('modalNumeroSimples');
  if(numeroModalResolve) numeroModalResolve(v);
  numeroModalResolve = null;
}
function cancelarNumeroModal(){
  closeModal('modalNumeroSimples');
  if(numeroModalResolve) numeroModalResolve(null);
  numeroModalResolve = null;
}


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
  const itens = [...raiz.querySelectorAll('.card, .section, .lv-card, .cmd-card, .lv-roteiro, .cmd-topo')]
    .filter(el=>el.offsetParent !== null && !el.parentElement.closest('.card, .section, .cmd-card'))
    .slice(0, 14);
  itens.forEach((el, i)=>{
    el.classList.remove('efeito-entra');
    void el.offsetWidth;
    el.style.setProperty('--i', i);
    el.classList.add('efeito-entra');
    setTimeout(()=>el.classList.remove('efeito-entra'), 700 + i*45);
  });
}
function efeitoContarNumeros(raiz){
  if(!efeitosLigados || !raiz) return;
  raiz.querySelectorAll('.resumo-stat-val, .ponto-valor-grande, .cp-total-valor').forEach(el=>{
    if(el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;   // só texto puro (não mexe em quem tem ícone dentro)
    const alvoTxt = el.textContent, m = alvoTxt.match(/^(-?)R\$\s?([\d.]+,\d{2})$/);
    if(!m) return;
    const alvo = Number(m[2].replace(/\./g,'').replace(',','.')) * (m[1] ? -1 : 1);
    if(Math.abs(alvo) < 1) return;
    const ini = performance.now(), dur = 650;
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
  const ini = performance.now(), dur = 900;
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
const EFEITO_FEITO = /togglePaid|contaTapEnd|toggleDiaConcluido|toggleOrdemComando|marcarLvRoteiro|toggleCompraPago|toggleExtraRecebido|cpToggleSalario|cpToggleExtra|cpToggleDizimo|toggleFaturaMes/;
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
      out.push({ id:'vendas-'+hojeTxt, tipo:'vendas', titulo:'Vendas do mês', corpo:`Faltam ${fmtMoney(v.falta)} para a meta de ${v.mesNome}${planos ? ' — ' + planos : ''}.`, quando:'hoje', ir:{ aba:'vendas' } });
    }
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
  vendas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>'
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
  /* abriu: tudo que está na lista conta como visto (o sino para de balançar) */
  sinoGuardarVistos([...new Set([...sinoVistos(), ...sinoAtuais.map(a=>a.id)])]);
  atualizarSino(true);   // a lista aberta continua mostrando o que era novo
}
function sinoIr(i){
  const a = sinoAtuais[i]; if(!a) return;
  closeModal('modalSino');
  if(a.ir.aba === 'ponto'){
    if(state.pontoOffset){ state.pontoOffset = 0; }
    switchAba('ponto');
    if(typeof renderPonto === 'function') renderPonto();
    setTimeout(()=>sinoDestacar(document.getElementById('pontoDia-' + a.ir.dia)), 120);
  } else if(a.ir.aba === 'vendas'){
    switchAba('vendas');
    setTimeout(()=>sinoDestacar(document.querySelector('#vendasConteudo .vd-meta-linha') || document.getElementById('vendasConteudo')), 120);
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
function pinEmailDoAparelho(){ try{ return localStorage.getItem('siloe-pin-email') || ''; }catch(e){ return ''; } }
function pinGuardarEmail(email){ try{ if(email) localStorage.setItem('siloe-pin-email', email); else localStorage.removeItem('siloe-pin-email'); }catch(e){} }
/* depois de carregar: se o PIN já foi criado (em qualquer aparelho), este aparelho passa a entrar com ele */
async function pinLembrarAparelho(){
  if(!state || !state.loginPin || pinEmailDoAparelho() || !window.SiloSupabase) return;
  const email = await window.SiloSupabase.emailAtual();
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
  if(/^[0-9]$/.test(e.key)){ pinTecladoAtivo.tecla(e.key); e.preventDefault(); }
  else if(e.key === 'Backspace'){ pinTecladoAtivo.tecla('x'); e.preventDefault(); }
});

/* ---------- tela de login no modo PIN ---------- */
let pinLogin = null;
function loginModoPin(ligar){
  const tela = document.getElementById('loginTela'); if(!tela) return;
  const email = pinEmailDoAparelho();
  if(ligar && !email) ligar = false;
  tela.classList.toggle('modo-pin', !!ligar);
  const usar = document.getElementById('loginUsarPin'); if(usar) usar.style.display = email && !ligar ? '' : 'none';
  if(ligar){
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
  sub.textContent = 'Entrando…'; erro.textContent = '';
  const r = await window.SiloSupabase.entrar(pinEmailDoAparelho(), pin);
  sub.textContent = 'Digite seu PIN';
  if(!r.ok){
    erro.textContent = /incorretos/.test(r.erro) ? 'PIN errado' : r.erro;
    pinLogin.tremer(); pinLogin.limpar();
    return;
  }
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
    persist();
    pinTecladoAtivo = null;
    closeModal('modalPin');
    atualizarStatusPin();
    showToast('PIN criado. Da próxima vez que pedir para entrar, é só o PIN');
  });
  pinTecladoAtivo = pinModal;
  document.getElementById('modalPin').classList.add('active');
}
