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

function abrirImportExportModal(){
  console.log('[STORAGE DEBUG] Abrindo modal');
  document.getElementById('modalImportExport').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderChangelog();
  
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

/* ========== MODAIS ================= */
function closeModal(modalId){
  const modal = document.getElementById(modalId);
  if(modal){
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ========== NAVEGAÇÃO ========== */
/* switchAba e switchUser vivem em core.js */
