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

function exportarDadosApp(){
  const versaoEl = document.querySelector('.header-version');
  const backup = {
    app: 'Siloe',
    versaoApp: versaoEl ? versaoEl.textContent.trim() : '',
    exportadoEm: new Date().toISOString(),
    mesAtual: mesAtualRef,
    logo: localStorage.getItem('siloe-logo') || null,
    state: state
  };
  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Siloe-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal('modalImportExport');
}

function triggerImportarDados(){
  document.getElementById('importFileInput').click();
}

function onImportFileSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const backup = JSON.parse(e.target.result);
      if(!backup || !backup.state){
        showToast('Arquivo inválido');
        return;
      }
      const msg = `Importar ${backup.versaoApp}? Dados atuais serão sobrescritos.`;
      if(iosConfirm(msg)){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.state));
        if(backup.mesAtual) localStorage.setItem(MES_ATUAL_KEY, backup.mesAtual);
        if(backup.logo) localStorage.setItem('siloe-logo', backup.logo);
        mesAtualRef = backup.mesAtual || mesAtualRef;
        carregar();
        renderAll();
        showToast('Importado com sucesso!');
        closeModal('modalImportExport');
      }
    }catch(err){
      console.error('Erro ao importar:', err);
      showToast('Erro ao importar arquivo');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function abrirModalAtualizacoes(){
  document.getElementById('modalAtualizacoes').classList.add('active');
  document.body.style.overflow = 'hidden';
}

/* ========== MODAIS ========== */
function closeModal(modalId){
  const modal = document.getElementById(modalId);
  if(modal){
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function showToast(msg){
  const existing = document.getElementById('toast');
  if(existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 20px;border-radius:6px;font-size:14px;z-index:10000;animation:slideUp 0.3s';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function iosConfirm(msg){
  return confirm(msg);
}

function iosConfirmResolver(msg){
  return new Promise(resolve => {
    if(confirm(msg)) resolve(true);
    else resolve(false);
  });
}

/* ========== NAVEGAÇÃO ========== */
function switchAba(aba){
  const abas = ['pano', 'plan', 'ponto', 'receitas', 'louvor', 'mercado'];
  abas.forEach(a => {
    const el = document.getElementById(`aba-${a}`);
    if(el) el.style.display = a === aba ? 'block' : 'none';
  });
  const buttons = document.querySelectorAll('.bottom-nav button');
  buttons.forEach(btn => btn.style.opacity = btn.dataset.aba === aba ? '1' : '0.6');
  if(aba === 'pano') renderPanorama();
  else if(aba === 'plan') renderPlanner();
  else if(aba === 'ponto') renderPonto();
  else if(aba === 'receitas') renderReceitas();
  else if(aba === 'louvor') renderLouvor();
  else if(aba === 'mercado') renderMercado();
}

function switchUser(user){
  state.currentUser = user;
  persist();
  renderAll();
}
