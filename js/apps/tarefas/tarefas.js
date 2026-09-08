/**
 * TAREFAS APP - Gerenciador de tarefas
 */

const TarefasApp = {
  currentSubtab: 'tarefas',
  
  init() {
    this.render();
    console.log('✓ Tarefas inicializado');
  },
  
  switchSubtab(tab) {
    this.currentSubtab = tab;
    document.getElementById('subtabTarefas').style.display = tab === 'tarefas' ? 'block' : 'none';
    document.getElementById('subtabSemana').style.display = tab === 'semana' ? 'block' : 'none';
    
    document.querySelectorAll('.tarefas-subtabs .subtab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById((tab === 'tarefas' ? 'tarefas' : 'semana') + 'SubtabBtn').classList.add('active');
    
    this.render();
  },
  
  render() {
    if (this.currentSubtab === 'tarefas') this.renderTarefas();
    else this.renderSemana();
  },
  
  getTarefas() {
    return state.tarefas.tarefas || [];
  },
  
  renderTarefas() {
    const container = document.getElementById('tarefasLista');
    if (!container) return;
    
    const tarefas = this.getTarefas();
    if (tarefas.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Nenhuma tarefa</div>';
      return;
    }
    
    container.innerHTML = tarefas.map(t => `
      <div class="tarefa-item ${t.concluida ? 'feita' : ''}">
        <input type="checkbox" ${t.concluida ? 'checked' : ''} onchange="TarefasApp.toggleTarefa('${t.id}')">
        <div class="info">
          <div class="nome">${t.nome}</div>
          ${t.desc ? `<div class="desc">${t.desc}</div>` : ''}
        </div>
        <button class="tarefa-del" onclick="TarefasApp.deleteTarefa('${t.id}')">✕</button>
      </div>
    `).join('');
  },
  
  addTarefa() {
    const nome = document.getElementById('tarefaNome').value.trim();
    if (!nome) {
      Utils.showToast('Digite uma tarefa');
      return;
    }
    
    const tarefa = {
      id: Utils.uid('tarefa'),
      nome,
      desc: document.getElementById('tarefaDesc').value,
      categoria: document.getElementById('tarefaCategoria').value,
      concluida: false,
      dataCriacao: new Date().toISOString()
    };
    
    state.tarefas.tarefas.push(tarefa);
    Storage.save('tarefas', state.tarefas);
    document.getElementById('tarefaNome').value = '';
    document.getElementById('tarefaDesc').value = '';
    document.getElementById('tarefaCategoria').value = '';
    this.render();
    Utils.showToast('Tarefa adicionada');
  },
  
  toggleTarefa(id) {
    const t = this.getTarefas().find(x => x.id === id);
    if (t) {
      t.concluida = !t.concluida;
      Storage.save('tarefas', state.tarefas);
      this.render();
    }
  },
  
  deleteTarefa(id) {
    state.tarefas.tarefas = state.tarefas.tarefas.filter(x => x.id !== id);
    Storage.save('tarefas', state.tarefas);
    this.render();
  },
  
  renderSemana() {
    const container = document.getElementById('semanaDiasLista');
    if (!container) return;
    container.innerHTML = '<div class="empty-state-sm">Visualização de semana</div>';
  },
  
  navSemana(n) {
    this.render();
  }
};