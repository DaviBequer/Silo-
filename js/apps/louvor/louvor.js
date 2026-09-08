/**
 * LOUVOR APP - Biblioteca de louvores
 */

const LouvorApp = {
  currentLouvoreId: null,
  
  init() {
    this.render();
    console.log('✓ Louvor inicializado');
  },
  
  getLouvores() {
    return state.louvor.louvores || [];
  },
  
  getCategories() {
    return state.louvor.categorias || [];
  },
  
  findLouvore(id) {
    return this.getLouvores().find(l => l.id === id);
  },
  
  render() {
    this.renderLista();
  },
  
  renderLista() {
    const container = document.getElementById('louvorLista');
    if (!container) return;
    
    const louvores = this.getLouvores();
    if (louvores.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Nenhum louvor ainda</div>';
      return;
    }
    
    container.innerHTML = louvores.map(l => `
      <div class="lv-card" onclick="LouvorApp.openDetalhe('${l.id}')">
        <div class="lv-card-icon">🎵</div>
        <div class="lv-card-info">
          <div class="lv-card-titulo">${l.titulo}</div>
          <div class="lv-card-meta">${l.artista || 'Desconhecido'}</div>
        </div>
        ${l.tom ? `<div class="lv-card-tom">${l.tom}</div>` : ''}
      </div>
    `).join('');
  },
  
  onSearch(value) {
    const btn = document.getElementById('louvorSearchClear');
    if (btn) btn.style.display = value ? 'block' : 'none';
    
    const searchTerm = value.toLowerCase();
    const filtered = this.getLouvores().filter(l =>
      l.titulo.toLowerCase().includes(searchTerm) ||
      l.artista.toLowerCase().includes(searchTerm)
    );
    
    const container = document.getElementById('louvorLista');
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Nenhum resultado</div>';
      return;
    }
    
    container.innerHTML = filtered.map(l => `
      <div class="lv-card" onclick="LouvorApp.openDetalhe('${l.id}')">
        <div class="lv-card-icon">🎵</div>
        <div class="lv-card-info">
          <div class="lv-card-titulo">${l.titulo}</div>
          <div class="lv-card-meta">${l.artista || 'Desconhecido'}</div>
        </div>
        ${l.tom ? `<div class="lv-card-tom">${l.tom}</div>` : ''}
      </div>
    `).join('');
  },
  
  clearSearch() {
    document.getElementById('louvorSearchInput').value = '';
    document.getElementById('louvorSearchClear').style.display = 'none';
    this.render();
  },
  
  openForm(id = null) {
    this.currentLouvoreId = id;
    const form = document.getElementById('louvorForm');
    
    if (id) {
      const l = this.findLouvore(id);
      if (l) {
        document.getElementById('lvTitulo').value = l.titulo || '';
        document.getElementById('lvArtista').value = l.artista || '';
        document.getElementById('lvTom').value = l.tom || '';
        document.getElementById('lvConteudo').value = l.conteudo || '';
      }
    } else {
      form.reset();
    }
    
    document.getElementById('pageLouvorForm').classList.add('active');
  },
  
  closeForm() {
    document.getElementById('pageLouvorForm').classList.remove('active');
  },
  
  saveLouvore() {
    const titulo = document.getElementById('lvTitulo').value.trim();
    if (!titulo) {
      Utils.showToast('Digite um título');
      return;
    }
    
    const louvore = {
      id: this.currentLouvoreId || Utils.uid('louvor'),
      titulo,
      artista: document.getElementById('lvArtista').value,
      tom: document.getElementById('lvTom').value,
      conteudo: document.getElementById('lvConteudo').value,
      categoria: document.getElementById('lvCategoriaSelect').value || null,
      dataCriacao: this.currentLouvoreId ? this.findLouvore(this.currentLouvoreId)?.dataCriacao : new Date().toISOString()
    };
    
    const idx = state.louvor.louvores.findIndex(l => l.id === this.currentLouvoreId);
    if (idx >= 0) {
      state.louvor.louvores[idx] = louvore;
    } else {
      state.louvor.louvores.push(louvore);
    }
    
    Storage.save('louvor', state.louvor);
    this.closeForm();
    this.render();
    Utils.showToast('Louvor salvo');
  },
  
  openDetalhe(id) {
    this.currentLouvoreId = id;
    const louvore = this.findLouvore(id);
    if (!louvore) return;
    
    const content = document.getElementById('louvorDetalheConteudo');
    content.innerHTML = `
      <div style="padding:24px">
        <div style="font-size:24px;font-weight:800;margin-bottom:8px">${louvore.titulo}</div>
        <div style="font-size:14px;color:var(--text-faint);margin-bottom:16px">${louvore.artista}</div>
        ${louvore.tom ? `<div style="background:var(--primary-tint);padding:8px 12px;border-radius:8px;display:inline-block;font-weight:700;margin-bottom:16px">Tom: ${louvore.tom}</div>` : ''}
        <pre style="white-space:pre-wrap;font-family:monospace;background:var(--card-2);padding:16px;border-radius:8px;overflow-x:auto">${louvore.conteudo}</pre>
        <button class="btn btn-block" onclick="LouvorApp.editLouvore()" style="margin-top:16px">Editar</button>
      </div>
    `;
    
    document.getElementById('louvorDetalheTitle').textContent = louvore.titulo;
    document.getElementById('pageLouvorDetalhe').classList.add('active');
  },
  
  closeDetalhe() {
    document.getElementById('pageLouvorDetalhe').classList.remove('active');
  },
  
  editLouvore() {
    this.closeDetalhe();
    this.openForm(this.currentLouvoreId);
  },
  
  deleteLouvore() {
    if (!confirm('Tem certeza?')) return;
    state.louvor.louvores = state.louvor.louvores.filter(l => l.id !== this.currentLouvoreId);
    Storage.save('louvor', state.louvor);
    this.closeDetalhe();
    this.render();
    Utils.showToast('Louvor excluído');
  }
};