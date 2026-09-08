/**
 * PLANNER APP - Planejamento mensal
 */

const PlannerApp = {
  usuarioAtual: 'davi',
  
  init() {
    this.render();
    console.log('✓ Planner inicializado');
  },
  
  switchUser(user) {
    this.usuarioAtual = user;
    document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab' + (user === 'davi' ? 'Davi' : 'Cris')).classList.add('active');
    this.render();
  },
  
  render() {
    this.renderSaldo();
    this.renderRenda();
    this.renderGastosCategoria('moradia', 'grid-moradia');
    this.renderGastosCategoria('assinatura', 'grid-assinatura');
    this.renderGastosCategoria('fixo', 'grid-fixo');
    this.renderGastosCategoria('futuro', 'grid-futuro');
    this.renderCartoes();
  },
  
  renderSaldo() {
    document.getElementById('saldoAtualInput').value = '0,00';
  },
  
  onSaldoChange(value) {
    Utils.showToast('Saldo atualizado');
  },
  
  renderRenda() {
    const container = document.getElementById('rendaTableBody');
    if (!container) return;
    container.innerHTML = '<tr><td class="row-label">Sem dados</td></tr>';
  },
  
  renderGastosCategoria(cat, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Sem gastos</div>';
  },
  
  openGastoModal(categoria) {
    Utils.showToast('Modal de gasto - ' + categoria);
  },
  
  renderCartoes() {
    const container = document.getElementById('cartaoTrackerList');
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Sem cartões</div>';
  }
};