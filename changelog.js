/* ========== CHANGELOG ========== */
/* Cada edição feita: adicionar um item novo no topo da versão atual (ou uma versão nova no topo do array). Textos curtos e gerais. */
const CHANGELOG = [
  { versao: 'v15.4', itens: [
    'Botão voltar do celular: fecha a janela ou tela aberta; senão volta para Finanças; em Finanças só sai com dois voltar seguidos (sem aviso)',
    'Assistente: os itens de cada resposta ficam separados por banco e por cartão, com o total de cada um'
  ] },
  { versao: 'v15.3', itens: [
    'Assistente no celular: ao editar um item, a placa e a barra de digitar saem do caminho e o editor fica acima do teclado',
    'Assistente: "Lista" mostra todos os itens juntos e "Confirmar todos" confirma de uma vez',
    'Assistente: tocar na sua fala põe o texto na caixa para corrigir o que foi entendido',
    'Passo a passo: quando a fala atualiza o banco ou cartão da pergunta, vai sozinho para o próximo',
    'Finanças sem as abas Geral/Cartão/Empréstimo: os atalhos abrem Cartões e Empréstimo, com o voltar no alto',
    'Cartão no computador: as faturas dos meses ficam ao lado do cartão',
    'Sobra depois da fatura: colunas por mês com o valor de cada um',
    'Extrato no computador em 3 colunas; "Simular compra" ficou só no atalho'
  ] },
  { versao: 'v15.2', itens: [
    'App mais rápido para abrir: os arquivos de cada versão abrem direto do celular, sem esperar a internet',
    'As logos e imagens ficam guardadas no aparelho (antes eram baixadas de novo a cada abertura)',
    'Abertura mais curta (1,6 a 3 s; um toque pula) e saída mais rápida',
    'Trocar de aba e abrir telas mais ágil: animações e números contando mais curtos'
  ] },
  { versao: 'v15.1', itens: [
    'Extrato: botão Editar no alto — com ele ligado, tocar numa compra abre a janela para mudar nome, valor, categoria e data, ou apagar (com Desfazer)'
  ] },
  { versao: 'v15.0', itens: [
    'Extrato: cada compra com o ícone do que foi (carrinho, cápsula, prato, patinha…) e o selo de como pagou (Cartão ou Pix/débito) com o banco',
    'Ícones novos de categoria: Pet e Contas/taxas (água, luz, multa, boleto)'
  ] },
  { versao: 'v14.9', itens: [
    '"Esqueci a senha" e "Esqueci o PIN" na tela de entrar: o Supabase manda um link para o e-mail',
    'Abrir o link do e-mail entra no app e pede a senha nova (com 6 números ela também vira o PIN)'
  ] },
  { versao: 'v14.8', itens: [
    'Extrato novo (atalho ao lado do Assistente): cada compra pela data da compra, com abas Tudo, Cartão e Pix e débito',
    'Tocar no nome de uma conta (ex.: Mercado) mostra o limite, quanto já foi, quanto falta ou quanto passou, e cada compra que caiu nela',
    'Assistente: compra com o nome e o valor de uma conta (ex.: Spotify no cartão) marca a conta como paga; compra numa conta-limite mostra como ela fica',
    'Fluxo mensal: o mês atual numa pílula grafite, sem a coluna pintada',
    'Histórico de meses: o mês atual não encosta mais na borda do celular'
  ] },
  { versao: 'v14.7', itens: [
    'O visual da abertura no app inteiro: letras finas, títulos leves e blocos mais transparentes sobre o mármore',
    'Empréstimo no computador: o cartão em pé fica à esquerda e as informações ao lado',
    'PDF do Ponto PJ nas cores do app: placa grafite com o total de horas e, no mês inteiro, o valor total',
    'Exportar Ponto: o mês mostra o valor total junto das horas; botão "Selecionar todos" com mais espaço'
  ] },
  { versao: 'v14.6', itens: [
    'Comparar no computador: o lado do Cifra Club e o do app rolam cada um sozinho',
    'Tocar numa frase (ou no nome da parte) de um lado rola o outro, suave, até a mesma frase ficar ao lado; refrão repetido vai para a mesma vez'
  ] },
  { versao: 'v14.5', itens: [
    'Capotraste: a cifra do Cifra Club com capo vem com a casa certa (tom F# com forma de E = capo na 2ª casa) e os acordes como se toca',
    'Botão CAPO ao lado do tom, com o braço do violão para escolher a casa: os acordes mudam na hora e o som continua no mesmo tom; folha e PDF mostram "Capo 2ª · forma de E"',
    'Letra nova no app inteiro: Urbanist, redonda e fina (a cifra continua na mesma letra)',
    'Cartão de crédito na cor do banco, com o chip separado das informações; sem o efeito de inclinar e de luz ao passar o mouse',
    'Empréstimo em cartão de vidro em pé, sem chip, do tamanho de um cartão também no computador',
    'Bancos no saldo de Finanças no mesmo modelo do cartão, com R$ e o valor centralizado'
  ] },
  { versao: 'v14.4', itens: [
    'Ícone novo: grafite que esquenta para o dourado, com o cordeiro claro',
    'Abertura nova: cordeiro e nome maiores no alto e um versículo curto do dia aparecendo palavra por palavra (toque na tela para pular)',
    'Entrar com a digital (ou o rosto) do celular: liga em Ajustes → Segurança ou na pergunta depois de entrar com o PIN; pode pedir a digital toda vez que abrir o app. O PIN continua valendo',
    'Tela do PIN: a tecla de apagar virou uma seta'
  ] },
  { versao: 'v14.3', itens: [
    'Dados: o app não apaga mais contas pagas, dias do ponto e renda de meses antigos ao abrir',
    'Dados: alteração que não chegou ao banco agora é juntada com o que o outro aparelho mudou (antes uma substituía a outra)',
    'Concluir mês (era Finalizar) sempre pergunta antes e tem Desfazer por 6 segundos',
    'Segurança: o e-mail da conta saiu do código público; aparelho novo entra uma vez com e-mail e senha e depois usa o PIN'
  ] },
  { versao: 'v14.2', itens: [
    'Mais efeitos: pílula da barra de baixo que escorrega, telas chegando com profundidade, janelas com fundo desfocado, topo de vidro ao rolar, puxar a tela para atualizar, nome da abertura se desenhando, PIN que enche, versículo palavra por palavra',
    'Cartões dos bancos em leque, curva do saldo se desenhando, calendários virando, deslizar item do Assistente para tirar, aviso de Desfazer com o tempo, anel das horas de hoje no Ponto, números das Vendas girando, capas das músicas vivas, folha da cifra abrindo, tom girando, linha do tempo do Culto e menu do + saindo em arco'
  ] },
  { versao: 'v14.1', itens: [
    'Efeitos: placas com degradê que se move, borda dourada girando no Assistente e no Gravar, brilho passando nos números, aurora na abertura e no PIN, líquido enchendo nos anéis e nas metas, onda dourada ao tocar, onda enquanto a IA pensa, anéis no microfone, sino pulsando, alerta respirando na conta que vence hoje, batida ao confirmar, esqueleto brilhante ao carregar, itens entrando em cascata, cartões que inclinam',
    'Confete ao gravar no Assistente, bater a meta de vendas, completar uma meta de economia e fechar o mês do ponto; faíscas na música pronta'
  ] },
  { versao: 'v14.0', itens: [
    'Cifra Club falhou: o app diz o que houve e oferece outro caminho (abrir no site, puxar o PDF do Drive ou escrever à mão)',
    'IA: se o Google tirar ou trocar o nome de um modelo, o app tenta outro sozinho e avisa; o nome pode ser trocado em Ajustes → Recursos → Modelos da IA',
    'Código arrumado por assunto (sino e PIN, Falar, IA, Cifra Club e a lista de novidades em arquivos próprios), sem mudar nada no uso',
    'A cada publicação o GitHub também tira fotos das telas principais (celular e computador) para comparar'
  ] },
  { versao: 'v13.9', itens: [
    'Proteção contra perda: se uma gravação for apagar muita coisa de uma vez (ex.: todas as músicas), o app pergunta antes; se você disser que não, nada é gravado e ele volta para os dados da nuvem',
    'Backup da semana: o sino lembra a cada 7 dias de baixar uma cópia dos dados no aparelho',
    'Abre mais rápido: o gerador de PDF só carrega quando você for gerar um PDF',
    'Mais testes antes de publicar: faturas do cartão, proteção contra perda e todas as abas e telas abrindo sem erro (91 no total)'
  ] },
  { versao: 'v13.8', itens: [
    'Faxina: saíram 84 regras de visual que nada mais usava (telas e botões que já tinham sido removidos)',
    'Testes novos do Assistente (fatura pela data, gasto repetido, nome sem categoria, um só cartão) e os testes agora rodam sozinhos no GitHub a cada publicação'
  ] },
  { versao: 'v13.7', itens: [
    'Assistente: cada compra tem o dia ("no dia 25 comprei…" vale para as seguintes até você falar outro dia), e dá para trocar o dia ao editar',
    'A compra cai na fatura certa pelo fechamento do cartão: no dia do fechamento ou depois, vai para a fatura do mês seguinte; o item avisa quando vai para outra fatura',
    'Sem o texto grande de exemplo na conversa',
    'Cartões: chip com desenho de chip de verdade; ao pôr a logo de um banco, a cor do cartão vira a cor da logo'
  ] },
  { versao: 'v13.6', itens: [
    'Assistente: toque no nome de um item para editar (nome, valor, categoria, parcelas, cartão ou banco)',
    'A categoria não vai mais no nome: "mercado Top" vira Top, com a categoria Mercado',
    'Falou a fatura (ou o saldo): aparece sempre a conferência com tudo o que já está nela (à vista, parcelas, assinaturas e o desta conversa) e quanto falta para chegar no valor do banco'
  ] },
  { versao: 'v13.5', itens: [
    'Assistente: a faixa do alto mostra o total grande, quanto foi para cada categoria (valor e %) e os itens bem pequenos; no computador largo ela fica numa coluna à direita',
    'Itens com ícone da categoria (carrinho, remédio, garfo…) e um selinho de cartão ou Pix; a IA responde só "Anotado."',
    'Mais rápido: usa o modelo leve do Google (2 a 3 s) e, se falhar, o de antes; a gravação para com 1,5 s de silêncio',
    'Nova aba "Passo a passo": pergunta banco por banco, cartão por cartão e as contas pagas'
  ] },
  { versao: 'v13.4', itens: [
    'Assistente: avisa quando um gasto parece repetido (mesmo valor já lançado no mesmo cartão ou banco, ou falado duas vezes na conversa) e pergunta de novo antes de gravar'
  ] },
  { versao: 'v13.3', itens: [
    'Assistente novo: a conversa é a tela principal, com o microfone grande; quanto falta, o saldo antes e depois de cada banco e as contas em aberto ficam em "Detalhes" (escondido até você ligar)',
    'Cada item tem um círculo para confirmar; "Gravar" grava só os confirmados',
    'Voz: o app grava o áudio e a IA ouve direto (sem o ditado do navegador), entendendo melhor valores e nomes de banco',
    'Com um só cartão (ou um só banco) a IA usa esse sem perguntar',
    'Categorias: a IA usa o que você já lançou; toque na categoria para trocar ou diga "Top é mercado" e ela aprende (lista em Ajustes → Recursos)'
  ] },
  { versao: 'v13.2', itens: [
    'Colar do WhatsApp: o medley volta a virar uma música só também quando vem como "Medley:" com as músicas uma por linha, com "+" sem espaço ou separado por "/"'
  ]},
  { versao: 'v13.1', itens: [
    'Slides: ao lado do slide aparece toda a letra do app, com as linhas do slide aberto marcadas e o número do slide de cada linha; tocar numa linha abre o slide dela',
    'Música só com o PDF do Drive (ou que voltou a ser do Drive): abre a tela normal, com o campo harmônico e o tom, mostrando o PDF'
  ]},
  { versao: 'v13.0', itens: [
    'Colar do WhatsApp: todas as músicas do roteiro já ficam agendadas na data escolhida',
    'Louvor: mudar a data, o status, o tom ou o tipo de uma música atualiza na hora a lista, a placa do culto e o Culto aberto'
  ]},
  { versao: 'v12.9', itens: [
    'Louvor, filtro Atual: mostra tudo com data de hoje para frente (agendada ou no roteiro do Culto), pronta ou não, e o que está em produção; o que é de ontem para trás não aparece',
    'Placa do culto atualiza na hora ao marcar Pronto (N prontas) e a música pronta ganha o número com a borda verde'
  ]},
  { versao: 'v12.8', itens: [
    'Comparar: o Cifra Club vem primeiro e o Letras embaixo; o botão de passar para o padrão do app ficou branco na faixa escura',
    'Sino de notificações em preto (estava sumindo)'
  ]},
  { versao: 'v12.7', itens: [
    'Louvor: botão + só com o ícone, girando suave; no computador as opções aparecem só de passar o mouse'
  ]},
  { versao: 'v12.6', itens: [
    'Fluxo mensal: os 12 meses sempre à vista com a primeira coluna presa, o mês atual em grafite e a linha nova Acumulado',
    'Louvor: menu do + vira uma fileira de pílulas em cima do botão; as ações da música ficam numa pílula grafite embaixo, com o botão de voltar a ser só o PDF do Drive'
  ]},
  { versao: 'v12.5', itens: [
    'Comparar: os acordes do lado No app dá para editar ali mesmo, olhando o original (a letra não muda)',
    'Comparar: botão Ficar só com o PDF do Drive (o texto do app sai, com Desfazer)'
  ]},
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
