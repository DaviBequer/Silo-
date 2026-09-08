/**
 * PANORAMA APP - Visão geral financeira
 */

const PanoramaApp = {
  windowStart: 0,
  
  init() {
    this.render();
    console.log('✓ Panorama inicializado');
  },
  
  render() {
    this.renderAccumTable();
    this.renderPontoSummary();
    this.renderUserSection();
    this.renderSummary();
    this.renderChecklist();
  },
  
  shiftWindow(n) {
    this.windowStart += n;
    this.render();
  },
  
  renderAccumTable() {
    const tbody = document.getElementById('acumTableBody');
    if (!tbody) return;
    
    const months = [];
    for (let i = 0; i < 3; i++) {
      months.push(Utils.addMonths(Utils.todayKey(), i - 1));
    }
    
    tbody.innerHTML = months.map(m => `
      <tr>
        <td class="row-label" style="text-align:left;padding-left:8px">${Utils.monthKey(new Date(m.split('-')[0], parseInt(m.split('-')[1]) - 1))}</td>
        <td>R$ 0,00</td>
        <td>R$ 0,00</td>
      </tr>
    `).join('');
  },
  
  renderPontoSummary() {
    document.getElementById('panoPontoHoras').textContent = '00:00';
    document.getElementById('panoPontoValor').textContent = Utils.fmtMoney(0);
  },
  
  renderUserSection() {
    const container = document.getElementById('panoUserSection');
    if (!container) return;
    
    container.innerHTML = `
      <div class="user-card-combined">
        <div class="ucc-col">
          <div class="u-name">Davi</div>
          <div class="u-row"><span class="lbl">Receitas:</span><span class="u-receita">R$ 0,00</span></div>
          <div class="u-row"><span class="lbl">Gastos:</span><span class="u-gastos">R$ 0,00</span></div>
          <div class="u-sobra positive"><span class="lbl">Sobra:</span><span>R$ 0,00</span></div>
        </div>
        <div class="ucc-divider"></div>
        <div class="ucc-col">
          <div class="u-name">Cris</div>
          <div class="u-row"><span class="lbl">Receitas:</span><span class="u-receita">R$ 0,00</span></div>
          <div class="u-row"><span class="lbl">Gastos:</span><span class="u-gastos">R$ 0,00</span></div>
          <div class="u-sobra positive"><span class="lbl">Sobra:</span><span>R$ 0,00</span></div>
        </div>
      </div>
    `;
  },
  
  renderSummary() {
    const container = document.getElementById('sumarioPanorama');
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Sem dados</div>';
  },
  
  renderChecklist() {
    const container = document.getElementById('contasChecklist');
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Sem contas pendentes</div>';
  },
  
  openSimulator() {
    Utils.showToast('Simulador - em breve');
  }
};