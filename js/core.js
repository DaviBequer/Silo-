/**
 * SILO - Core Module
 * Gerenciamento de estado global, utilitários e storage
 * Compartilhado entre todos os apps
 */

// ========== ESTADO GLOBAL ==========
const state = {
  usuarios: {
    davi: { nome: 'Davi', cor: '#2B3038' },
    cris: { nome: 'Cris', cor: '#7B5FA6' }
  },
  usuarioAtual: 'davi',
  mesAtualRef: (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })(),
  
  // Dados de cada app (serão populados ao carregar)
  panorama: {},
  planner: { davi: {}, cris: {} },
  ponto: {},
  receitas: { receitas: [], categorias: [] },
  louvor: { louvores: [], categorias: [] },
  mercado: { lista: [], estoque: [] },
  tarefas: { tarefas: [] }
};

// ========== ARMAZENAMENTO ==========
const Storage = {
  save(key, data) {
    try {
      localStorage.setItem(`silo_${key}`, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar:', e);
    }
  },
  
  load(key, defaultValue = {}) {
    try {
      const data = localStorage.getItem(`silo_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error('Erro ao carregar:', e);
      return defaultValue;
    }
  },
  
  clear(key) {
    localStorage.removeItem(`silo_${key}`);
  },
  
  loadAll() {
    state.planner = Storage.load('planner', state.planner);
    state.ponto = Storage.load('ponto', state.ponto);
    state.receitas = Storage.load('receitas', state.receitas);
    state.louvor = Storage.load('louvor', state.louvor);
    state.mercado = Storage.load('mercado', state.mercado);
    state.tarefas = Storage.load('tarefas', state.tarefas);
  },
  
  saveAll() {
    Storage.save('planner', state.planner);
    Storage.save('ponto', state.ponto);
    Storage.save('receitas', state.receitas);
    Storage.save('louvor', state.louvor);
    Storage.save('mercado', state.mercado);
    Storage.save('tarefas', state.tarefas);
  }
};

// ========== UTILITÁRIOS ==========
const Utils = {
  // Data
  monthKey(d) { 
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); 
  },
  
  keyToDate(key) { 
    const [y, m] = key.split('-').map(Number); 
    return new Date(y, m - 1, 1); 
  },
  
  addMonths(key, n) { 
    const d = Utils.keyToDate(key); 
    d.setMonth(d.getMonth() + n); 
    return Utils.monthKey(d); 
  },
  
  todayKey() { 
    return state.mesAtualRef; 
  },
  
  daysInMonth(key) { 
    const d = Utils.keyToDate(key); 
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); 
  },
  
  // Formatação
  fmtMoney(v) { 
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
  },
  
  fmtMoneySigned(v) { 
    return v >= 0 ? Utils.fmtMoney(v) : '-' + Utils.fmtMoney(Math.abs(v)); 
  },
  
  maskMoneyInput(el) {
    let value = el.value.replace(/\D/g, '');
    value = (value / 100).toFixed(2).replace('.', ',');
    el.value = value;
  },
  
  unmaskMoney(str) {
    return parseFloat((str || '0').replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  },
  
  // UID
  uid(prefix = 'id') { 
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); 
  },
  
  // Toast
  showToast(msg, duration = 2000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  },
  
  // Modal
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },
  
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }
};

// ========== EVENTOS GLOBAIS ==========
const EventBus = {
  listeners: {},
  
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  },
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
};

// ========== INICIALIZAÇÃO ==========
function initCore() {
  // Carregar dados salvos
  Storage.loadAll();
  
  // Configurar listeners globais
  window.addEventListener('beforeunload', () => Storage.saveAll());
  
  console.log('✓ Core inicializado');
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCore);
} else {
  initCore();
}
