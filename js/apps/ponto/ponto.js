/**
 * PONTO PJ APP - Controle de horas e PJ
 */

const PontoApp = {
  mesOffset: 0,
  
  init() {
    this.render();
    console.log('✓ Ponto inicializado');
  },
  
  render() {
    this.renderSummary();
    this.renderDias();
  },
  
  renderSummary() {
    document.getElementById('pontoTotalHoras').textContent = '00:00';
    document.getElementById('pontoValorReceber').textContent = Utils.fmtMoney(0);
    document.getElementById('pontoPadrao').textContent = '00:00';
    document.getElementById('pontoDiferenca').textContent = '00:00';
    document.getElementById('pontoImpacto').textContent = Utils.fmtMoney(0);
    document.getElementById('pontoMesLabel').textContent = Utils.monthKey(new Date());
  },
  
  renderDias() {
    const container = document.getElementById('pontoDiasLista');
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Sem dados</div>';
  },
  
  navMes(n) {
    this.mesOffset += n;
    this.render();
  },
  
  onValorHoraChange(value) {
    Utils.showToast('Valor/hora atualizado');
  },
  
  openSettings() {
    Utils.showToast('Configurações - em breve');
  },
  
  exportPDF() {
    Utils.showToast('Exportar - em breve');
  }
};