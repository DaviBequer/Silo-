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
      console.log(`✓ Dados salvos: ${key}`);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('Erro: localStorage cheio');
      } else {
        console.error('Erro ao salvar:', e);
      }
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
    console.log(`✓ Dados limpos: ${key}`);
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
  },
  
  // Obter tamanho total do localStorage
  getSize() {
    let total = 0;
    for (let key in localStorage) {
      if (key.startsWith('silo_')) {
        total += localStorage[key].length;
      }
    }
    return (total / 1024).toFixed(2); // KB
  }
};

// ========== UTILITÁRIOS ==========
const Utils = {
  // ===== DATA =====
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
  
  formatDate(d) {
    return d.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });
  },
  
  formatTime(d) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },
  
  // ===== FORMATAÇÃO =====
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
  
  fmtPercent(value, total) {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
  },
  
  fmtHoras(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  },
  
  // ===== UID E VALIDAÇÃO =====
  uid(prefix = 'id') { 
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); 
  },
  
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  
  slugify(str) {
    return str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  },
  
  // ===== BUSCA E FILTRO =====
  searchInArray(arr, query, fields) {
    const q = query.toLowerCase();
    return arr.filter(item => 
      fields.some(field => 
        String(item[field]).toLowerCase().includes(q)
      )
    );
  },
  
  sortArray(arr, field, order = 'asc') {
    return [...arr].sort((a, b) => {
      if (order === 'asc') {
        return a[field] > b[field] ? 1 : -1;
      }
      return a[field] < b[field] ? 1 : -1;
    });
  },
  
  groupBy(arr, field) {
    return arr.reduce((groups, item) => {
      const key = item[field];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  },
  
  // ===== TOAST =====
  showToast(msg, type = 'info', duration = 2000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast show toast-${type}`;
    setTimeout(() => el.classList.remove('show'), duration);
  },
  
  // ===== MODAL =====
  openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      el.setAttribute('aria-hidden', 'false');
    }
  },
  
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.setAttribute('aria-hidden', 'true');
    }
  },
  
  toggleModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('active');
    }
  },
  
  // ===== CÓPIA E COMPARTILHAMENTO =====
  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      Utils.showToast('Copiado para clipboard', 'success');
    } else {
      console.warn('Clipboard API não disponível');
    }
  },
  
  shareData(title, text, url) {
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
    } else {
      Utils.showToast('Compartilhamento não disponível', 'warning');
    }
  },
  
  // ===== VERIFICAÇÃO DE ELEMENTOS =====
  elementExists(id) {
    return document.getElementById(id) !== null;
  },
  
  getValueSafe(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
  },
  
  setValueSafe(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
};

// ========== EVENTOS GLOBAIS ==========
const EventBus = {
  listeners: {},
  
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback); // Retorna função para unsubscribe
  },
  
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  },
  
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Erro ao executar listener de ${event}:`, e);
        }
      });
    }
  },
  
  clear(event) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
};

// ========== INICIALIZAÇÃO ==========
function initCore() {
  // Carregar dados salvos
  Storage.loadAll();
  
  // Configurar listeners globais
  window.addEventListener('beforeunload', () => Storage.saveAll());
  window.addEventListener('online', () => Utils.showToast('Conectado', 'success'));
  window.addEventListener('offline', () => Utils.showToast('Desconectado', 'warning'));
  
  console.log('✓ Core inicializado');
  console.log(`📊 Storage: ${Storage.getSize()} KB`);
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCore);
} else {
  initCore();
}
