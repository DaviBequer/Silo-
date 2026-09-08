/**
 * SILO - Inicializador Principal
 * Carrega e inicializa todos os apps de forma modular
 */

// ========== CONFIGURAÇÃO DE APPS ==========
const APPS = [
  { id: 'panorama', name: 'Panorama', icon: '📊', script: 'js/apps/panorama/panorama.js', template: 'js/apps/panorama/panorama.html' },
  { id: 'planner', name: 'Planner', icon: '📋', script: 'js/apps/planner/planner.js', template: 'js/apps/planner/planner.html' },
  { id: 'ponto', name: 'Ponto', icon: '⏱️', script: 'js/apps/ponto/ponto.js', template: 'js/apps/ponto/ponto.html' },
  { id: 'receitas', name: 'Receitas', icon: '🍳', script: 'js/apps/receitas/receitas.js', template: 'js/apps/receitas/receitas.html' },
  { id: 'louvor', name: 'Louvor', icon: '🎵', script: 'js/apps/louvor/louvor.js', template: 'js/apps/louvor/louvor.html' },
  { id: 'mercado', name: 'Mercado', icon: '🛒', script: 'js/apps/mercado/mercado.js', template: 'js/apps/mercado/mercado.html' },
  { id: 'tarefas', name: 'Tarefas', icon: '✅', script: 'js/apps/tarefas/tarefas.js', template: 'js/apps/tarefas/tarefas.html' }
];

let currentApp = null;

// ========== INICIALIZAÇÃO ==========
async function initApp() {
  console.log('🚀 Iniciando Silo...');
  
  // Renderizar nav
  renderNav();
  
  // Carregar primeiro app
  await switchApp('panorama');
  
  console.log('✅ Silo inicializado com sucesso');
}

// ========== NAVEGAÇÃO ==========
function renderNav() {
  const nav = document.querySelector('nav.bottom-nav');
  if (!nav) return;
  
  nav.innerHTML = APPS.map(app => `
    <button class="nav-btn" id="navBtn${app.id}" onclick="switchApp('${app.id}')" title="${app.name}">
      <div class="nav-icon">${app.icon}</div>
      <div class="nav-label">${app.name}</div>
    </button>
  `).join('');
}

async function switchApp(appId) {
  const app = APPS.find(a => a.id === appId);
  if (!app) {
    console.error('App não encontrado:', appId);
    return;
  }
  
  console.log(`📱 Carregando app: ${app.name}`);
  
  // Atualizar nav
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const navBtn = document.getElementById(`navBtn${appId}`);
  if (navBtn) navBtn.classList.add('active');
  
  // Container principal
  const appContainer = document.getElementById('app-content');
  
  // Carregar template
  try {
    const response = await fetch(app.template);
    const html = await response.text();
    appContainer.innerHTML = html;
  } catch (e) {
    console.error('Erro ao carregar template:', e);
    appContainer.innerHTML = `<div class="error">Erro ao carregar ${app.name}</div>`;
    return;
  }
  
  // Carregar script
  try {
    // Remover script anterior se existir
    const oldScript = document.getElementById(`script-${appId}`);
    if (oldScript) oldScript.remove();
    
    // Carregar novo script
    const script = document.createElement('script');
    script.id = `script-${appId}`;
    script.src = app.script;
    script.onload = () => {
      // Inicializar app
      const appObj = window[capitalizeFirst(appId) + 'App'];
      if (appObj && appObj.init) {
        appObj.init();
        currentApp = appId;
      }
    };
    script.onerror = () => {
      console.error('Erro ao carregar script:', app.script);
      appContainer.innerHTML = `<div class="error">Erro ao carregar ${app.name}</div>`;
    };
    document.body.appendChild(script);
  } catch (e) {
    console.error('Erro ao carregar app:', e);
    appContainer.innerHTML = `<div class="error">Erro ao carregar ${app.name}</div>`;
  }
}

// ========== UTILITÁRIOS ==========
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ========== AUTO-INICIALIZAÇÃO ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ========== SALVAR AO SAIR ==========
window.addEventListener('beforeunload', () => {
  Storage.saveAll();
});
