/**
 * MERCADO APP - Lista de compras e estoque
 */

const MercadoApp = {
  currentSubtab: 'lista',
  
  init() {
    this.render();
    console.log('✓ Mercado inicializado');
  },
  
  switchSubtab(tab) {
    this.currentSubtab = tab;
    document.querySelectorAll('.mercado-subtab').forEach(t => t.style.display = 'none');
    document.getElementById('mercadoSubtab' + (tab === 'lista' ? 'Lista' : tab === 'estoque' ? 'Estoque' : 'Dashboard')).style.display = 'block';
    
    document.querySelectorAll('.mercado-subtabs .subtab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('subtabBtn' + (tab === 'lista' ? 'MercadoLista' : tab === 'estoque' ? 'MercadoEstoque' : 'MercadoDashboard')).classList.add('active');
    
    this.render();
  },
  
  render() {
    if (this.currentSubtab === 'lista') this.renderLista();
    else if (this.currentSubtab === 'estoque') this.renderEstoque();
    else this.renderDashboard();
  },
  
  renderLista() {
    const container = document.getElementById('mercadoLista');
    if (!container) return;
    
    const items = state.mercado.lista || [];
    if (items.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Lista vazia</div>';
      return;
    }
    
    container.innerHTML = items.map(item => `
      <div class="mercado-item">
        <div class="mercado-check" onclick="MercadoApp.toggleItem('${item.id}')">
          ${item.comprado ? '✓' : ''}
        </div>
        <div class="mercado-item-info">
          <div class="mercado-item-nome" style="${item.comprado ? 'text-decoration:line-through;opacity:.5' : ''}">${item.nome}</div>
        </div>
        <button class="mercado-item-del" onclick="MercadoApp.deleteItem('${item.id}')">✕</button>
      </div>
    `).join('');
  },
  
  addItem() {
    const nome = document.getElementById('mpNome').value.trim();
    if (!nome) {
      Utils.showToast('Digite um item');
      return;
    }
    
    const item = {
      id: Utils.uid('item'),
      nome,
      comprado: false,
      dataCriacao: new Date().toISOString()
    };
    
    state.mercado.lista.push(item);
    Storage.save('mercado', state.mercado);
    document.getElementById('mpNome').value = '';
    this.render();
    Utils.showToast('Item adicionado');
  },
  
  toggleItem(id) {
    const item = state.mercado.lista.find(i => i.id === id);
    if (item) {
      item.comprado = !item.comprado;
      Storage.save('mercado', state.mercado);
      this.render();
    }
  },
  
  deleteItem(id) {
    state.mercado.lista = state.mercado.lista.filter(i => i.id !== id);
    Storage.save('mercado', state.mercado);
    this.render();
  },
  
  renderEstoque() {
    const container = document.getElementById('mercadoEstoqueLista');
    if (!container) return;
    
    const estoque = state.mercado.estoque || [];
    if (estoque.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Estoque vazio</div>';
      return;
    }
    
    container.innerHTML = estoque.map(item => `
      <div class="check-item-compact">
        <div class="info">
          <div class="desc">${item.nome}</div>
          <div class="meta">${item.quantidade || 0} ${item.unidade}</div>
        </div>
        <button class="btn-icon-sm" onclick="MercadoApp.deleteEstoque('${item.id}')">✕</button>
      </div>
    `).join('');
  },
  
  openEstoqueForm() {
    Utils.showToast('Formulário de estoque - em breve');
  },
  
  deleteEstoque(id) {
    state.mercado.estoque = state.mercado.estoque.filter(i => i.id !== id);
    Storage.save('mercado', state.mercado);
    this.renderEstoque();
  },
  
  renderDashboard() {
    document.getElementById('mktGastoMes').textContent = Utils.fmtMoney(0);
    document.getElementById('mktItensFalta').textContent = '0';
  }
};