/**
 * RECEITAS APP - Lógica isolada
 * Edite APENAS este arquivo para modificar o app de receitas
 */

const ReceitasApp = {
  currentRecipeId: null,
  currentFoto: null,
  filtroAtivo: null,
  buscaAtiva: '',
  
  // ========== INICIALIZAÇÃO ==========
  init() {
    this.loadCategories();
    this.render();
    this.setupEventListeners();
    console.log('✓ Receitas App inicializado');
  },
  
  setupEventListeners() {
    const searchInput = document.getElementById('receitaSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.clearSearch();
      });
    }
  },
  
  // ========== DADOS ==========
  getRecipes() {
    return state.receitas.receitas || [];
  },
  
  getCategories() {
    return state.receitas.categorias || [];
  },
  
  findRecipe(id) {
    return this.getRecipes().find(r => r.id === id);
  },
  
  getRecipesByCategory(categoria) {
    return this.getRecipes().filter(r => r.categoria === categoria);
  },
  
  getFavoritedRecipes() {
    return this.getRecipes().filter(r => r.favorito);
  },
  
  getRecipesByDifficulty(dificuldade) {
    return this.getRecipes().filter(r => r.dificuldade === dificuldade);
  },
  
  // ========== CATEGORIAS ==========
  loadCategories() {
    this.renderCategoryChips();
  },
  
  renderCategoryChips() {
    const container = document.getElementById('receitaFilterChips');
    if (!container) return;
    
    const cats = this.getCategories();
    const html = cats.map(cat => {
      const count = this.getRecipesByCategory(cat).length;
      return `<button class="filter-chip ${this.filtroAtivo === cat ? 'active' : ''}" onclick="ReceitasApp.filterByCategory('${cat}')">${cat} (${count})</button>`;
    }).join('');
    
    container.innerHTML = html + 
      `<button class="filter-chip filter-chip-add" onclick="ReceitasApp.openCategoryModal()">+ Nova</button>`;
  },
  
  openCategoryModal() {
    Utils.openModal('modalReceitaCategoria');
    document.getElementById('receitaCategoriaNome').focus();
  },
  
  saveCategory() {
    const nome = document.getElementById('receitaCategoriaNome').value.trim();
    if (!nome) {
      Utils.showToast('Digite um nome', 'warning');
      return;
    }
    
    if (state.receitas.categorias.includes(nome)) {
      Utils.showToast('Categoria já existe', 'warning');
      return;
    }
    
    state.receitas.categorias.push(nome);
    state.receitas.categorias.sort();
    Storage.save('receitas', state.receitas);
    this.loadCategories();
    Utils.showToast('Categoria criada', 'success');
    
    document.getElementById('receitaCategoriaNome').value = '';
    this.closeModal('modalReceitaCategoria');
  },
  
  createCategoryInline() {
    const nome = document.getElementById('receitaCatNovaInput').value.trim();
    if (!nome) return;
    
    if (!state.receitas.categorias.includes(nome)) {
      state.receitas.categorias.push(nome);
      state.receitas.categorias.sort();
      Storage.save('receitas', state.receitas);
    }
    
    this.selectCategory(nome);
    this.renderCategoryOptions();
    document.getElementById('receitaCatNovaInput').value = '';
  },
  
  deleteCategory(cat) {
    if (!confirm(`Deletar categoria "${cat}"? Receitas não serão deletadas.`)) return;
    
    state.receitas.categorias = state.receitas.categorias.filter(c => c !== cat);
    state.receitas.receitas.forEach(r => {
      if (r.categoria === cat) r.categoria = null;
    });
    
    Storage.save('receitas', state.receitas);
    this.loadCategories();
    this.render();
    Utils.showToast('Categoria deletada', 'success');
  },
  
  // ========== RENDERIZAÇÃO ==========
  render() {
    this.renderGrid();
  },
  
  renderGrid() {
    const container = document.getElementById('receitaGrid');
    if (!container) return;
    
    let recipes = this.getRecipes();
    
    // Aplicar filtro de categoria
    if (this.filtroAtivo) {
      recipes = recipes.filter(r => r.categoria === this.filtroAtivo);
    }
    
    if (recipes.length === 0) {
      container.innerHTML = `
        <div class="receita-empty">
          <div class="receita-empty-icon">🍳</div>
          <div class="receita-empty-title">Nenhuma receita${this.filtroAtivo ? ' nesta categoria' : ''}</div>
          <div class="receita-empty-sub">Crie sua primeira receita clicando no botão +</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = recipes.map(recipe => this.renderCard(recipe)).join('');
  },
  
  renderCard(recipe) {
    const estrelas = this.renderDificuldadeEstrelas(recipe.dificuldade);
    
    return `
      <div class="receita-card" onclick="ReceitasApp.openDetail('${recipe.id}')">
        <div class="receita-card-media">
          ${recipe.foto ? `<img class="receita-card-img" src="${recipe.foto}" alt="${recipe.nome}">` : `<div class="receita-card-img-placeholder">🍽️</div>`}
          <button class="receita-card-fav ${recipe.favorito ? 'active' : ''}" onclick="event.stopPropagation(); ReceitasApp.toggleFav('${recipe.id}')" title="${recipe.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">♥</button>
          ${recipe.categoria ? `<div class="receita-card-cat">${recipe.categoria}</div>` : ''}
          ${recipe.dificuldade ? `<div class="receita-card-dif">${estrelas}</div>` : ''}
        </div>
        <div class="receita-card-body">
          <div class="receita-card-nome">${recipe.nome}</div>
          <div class="receita-card-meta">
            ${recipe.tempo ? `<span>⏱ ${recipe.tempo}</span>` : ''}
            ${recipe.porcoes ? `<span>🍽 ${recipe.porcoes}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },
  
  renderDificuldadeEstrelas(dificuldade) {
    const map = { facil: '⭐', media: '⭐⭐', dificil: '⭐⭐⭐' };
    return map[dificuldade] || '';
  },
  
  // ========== BUSCA E FILTRO ==========
  onSearch(value) {
    this.buscaAtiva = value;
    const searchBtn = document.getElementById('receitaSearchClear');
    if (searchBtn) searchBtn.style.display = value ? 'block' : 'none';
    
    this.filterRecipes();
  },
  
  clearSearch() {
    this.buscaAtiva = '';
    document.getElementById('receitaSearchInput').value = '';
    document.getElementById('receitaSearchClear').style.display = 'none';
    this.render();
  },
  
  filterByCategory(cat) {
    this.filtroAtivo = this.filtroAtivo === cat ? null : cat;
    this.renderCategoryChips();
    this.render();
  },
  
  filterRecipes() {
    const searchTerm = this.buscaAtiva.toLowerCase();
    let filtered = this.getRecipes();
    
    // Filtrar por categoria
    if (this.filtroAtivo) {
      filtered = filtered.filter(r => r.categoria === this.filtroAtivo);
    }
    
    // Filtrar por busca
    filtered = filtered.filter(r => 
      r.nome.toLowerCase().includes(searchTerm) ||
      r.observacoes?.toLowerCase().includes(searchTerm) ||
      (r.ingredientes || []).some(ing => ing.nome.toLowerCase().includes(searchTerm))
    );
    
    const container = document.getElementById('receitaGrid');
    if (!container) return;
    
    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state-sm">Nenhum resultado encontrado</div>';
      return;
    }
    
    container.innerHTML = filtered.map(recipe => this.renderCard(recipe)).join('');
  },
  
  // ========== FORMULÁRIO ==========
  openForm(recipeId = null) {
    this.currentRecipeId = recipeId;
    this.currentFoto = null;
    
    const form = document.getElementById('receitaForm');
    const titleEl = document.getElementById('receitaFormTitulo');
    
    if (recipeId) {
      const recipe = this.findRecipe(recipeId);
      if (recipe) {
        titleEl.textContent = 'Editar Receita';
        document.getElementById('receitaNome').value = recipe.nome || '';
        document.getElementById('receitaTempo').value = recipe.tempo || '';
        document.getElementById('receitaPorcoes').value = recipe.porcoes || '';
        document.getElementById('receitaObservacoes').value = recipe.observacoes || '';
        document.getElementById('receitaDificuldade').value = recipe.dificuldade || '';
        document.getElementById('receitaCor').value = recipe.cor || '';
        this.currentFoto = recipe.foto || null;
        
        this.renderIngredients(recipe.ingredientes || []);
        this.renderSteps(recipe.passos || []);
      }
    } else {
      titleEl.textContent = 'Nova Receita';
      form.reset();
      this.renderIngredients([]);
      this.renderSteps([]);
    }
    
    this.renderCategoryOptions();
    this.renderFotoPreview();
    document.getElementById('pageReceitaForm').classList.add('active');
  },
  
  closeForm() {
    document.getElementById('pageReceitaForm').classList.remove('active');
  },
  
  saveRecipe() {
    const nome = document.getElementById('receitaNome').value.trim();
    if (!nome) {
      Utils.showToast('Digite um nome', 'warning');
      return;
    }
    
    const ingredientes = this.getFormIngredients();
    if (ingredientes.length === 0) {
      Utils.showToast('Adicione pelo menos um ingrediente', 'warning');
      return;
    }
    
    const oldRecipe = this.currentRecipeId ? this.findRecipe(this.currentRecipeId) : null;
    
    const recipe = {
      id: this.currentRecipeId || Utils.uid('receita'),
      nome,
      tempo: document.getElementById('receitaTempo').value || '',
      porcoes: parseInt(document.getElementById('receitaPorcoes').value) || 0,
      dificuldade: document.getElementById('receitaDificuldade').value,
      categoria: document.getElementById('receitaCategoriaSelect').value || null,
      cor: document.getElementById('receitaCor').value,
      foto: this.currentFoto,
      ingredientes: ingredientes,
      passos: this.getFormSteps(),
      observacoes: document.getElementById('receitaObservacoes').value,
      favorito: oldRecipe?.favorito || false,
      dataCriacao: oldRecipe?.dataCriacao || new Date().toISOString(),
      dataModificacao: new Date().toISOString()
    };
    
    const idx = state.receitas.receitas.findIndex(r => r.id === this.currentRecipeId);
    if (idx >= 0) {
      state.receitas.receitas[idx] = recipe;
      Utils.showToast('Receita atualizada', 'success');
    } else {
      state.receitas.receitas.push(recipe);
      Utils.showToast('Receita criada', 'success');
    }
    
    Storage.save('receitas', state.receitas);
    EventBus.emit('receita:salva', recipe);
    this.closeForm();
    this.render();
  },
  
  // ========== FOTO ==========
  onFotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      Utils.showToast('Imagem muito grande (máx 2MB)', 'warning');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentFoto = e.target.result;
      this.renderFotoPreview();
    };
    reader.readAsDataURL(file);
  },
  
  removeFoto() {
    this.currentFoto = null;
    this.renderFotoPreview();
  },
  
  renderFotoPreview() {
    const container = document.getElementById('receitaFotoPreview');
    if (!container) return;
    
    if (this.currentFoto) {
      container.innerHTML = `<img src="${this.currentFoto}" style="width:100%;height:100%;object-fit:cover;border-radius:12px" alt="Preview">`;
    } else {
      container.innerHTML = `<div class="receita-form-foto-placeholder"><span>📸</span><span>Adicione uma foto</span></div>`;
    }
  },
  
  // ========== INGREDIENTES ==========
  renderIngredients(ingredients = []) {
    const container = document.getElementById('receitaIngredientesLista');
    if (!container) return;
    
    if (ingredients.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = ingredients.map((ing, idx) => `
      <div class="receita-ing-row">
        <div class="receita-ing-num">${idx + 1}</div>
        <input type="text" value="${ing.quantidade || ''}" placeholder="Qtd" class="ing-qtd" data-idx="${idx}">
        <input type="text" value="${ing.unidade || ''}" placeholder="Un" class="ing-unit" data-idx="${idx}">
        <input type="text" value="${ing.nome || ''}" placeholder="Ingrediente" class="ing-nome" data-idx="${idx}" required>
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removeIngredient(${idx})" title="Remover">✕</button>
      </div>
    `).join('');
  },
  
  addIngredient() {
    const container = document.getElementById('receitaIngredientesLista');
    const idx = container.querySelectorAll('.receita-ing-row').length;
    
    const newRow = `
      <div class="receita-ing-row">
        <div class="receita-ing-num">${idx + 1}</div>
        <input type="text" placeholder="Qtd" class="ing-qtd" data-idx="${idx}">
        <input type="text" placeholder="Un" class="ing-unit" data-idx="${idx}">
        <input type="text" placeholder="Ingrediente" class="ing-nome" data-idx="${idx}" required>
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removeIngredient(${idx})" title="Remover">✕</button>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newRow);
    container.querySelector(`.ing-nome[data-idx="${idx}"]`).focus();
  },
  
  removeIngredient(idx) {
    const rows = document.querySelectorAll('.receita-ing-row');
    if (rows.length > 1) {
      rows[idx]?.remove();
    } else {
      Utils.showToast('Precisa ter pelo menos 1 ingrediente', 'warning');
    }
  },
  
  getFormIngredients() {
    return Array.from(document.querySelectorAll('.receita-ing-row')).map(row => ({
      quantidade: row.querySelector('.ing-qtd').value || '1',
      unidade: row.querySelector('.ing-unit').value || 'un',
      nome: row.querySelector('.ing-nome').value
    })).filter(ing => ing.nome.trim());
  },
  
  // ========== MODO DE PREPARO ==========
  renderSteps(steps = []) {
    const container = document.getElementById('receitaPassosLista');
    if (!container) return;
    
    if (steps.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = steps.map((passo, idx) => `
      <div class="receita-passo-row">
        <div class="receita-passo-num">${idx + 1}</div>
        <textarea class="receita-passo-input" data-idx="${idx}" placeholder="Descreva este passo...">${passo}</textarea>
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removePasso(${idx})" title="Remover">✕</button>
      </div>
    `).join('');
  },
  
  addPasso() {
    const container = document.getElementById('receitaPassosLista');
    const idx = container.querySelectorAll('.receita-passo-row').length;
    
    const newRow = `
      <div class="receita-passo-row">
        <div class="receita-passo-num">${idx + 1}</div>
        <textarea class="receita-passo-input" data-idx="${idx}" placeholder="Descreva este passo..." required></textarea>
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removePasso(${idx})" title="Remover">✕</button>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newRow);
    container.querySelector(`.receita-passo-input[data-idx="${idx}"]`).focus();
  },
  
  removePasso(idx) {
    document.querySelectorAll('.receita-passo-row')[idx]?.remove();
  },
  
  getFormSteps() {
    return Array.from(document.querySelectorAll('.receita-passo-input'))
      .map(el => el.value.trim())
      .filter(v => v);
  },
  
  // ========== CATEGORIAS NO FORM ==========
  toggleCatPicker() {
    const panel = document.getElementById('receitaCatPickerPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  },
  
  renderCategoryOptions() {
    const grid = document.getElementById('receitaCatPickerGrid');
    if (!grid) return;
    
    const cats = this.getCategories();
    grid.innerHTML = cats.map(cat => `
      <button type="button" class="cat-picker-opt" onclick="ReceitasApp.selectCategory('${cat}')">${cat}</button>
    `).join('');
  },
  
  selectCategory(cat) {
    document.getElementById('receitaCategoriaSelect').value = cat;
    document.getElementById('receitaCatPickerBtn').textContent = cat;
    this.toggleCatPicker();
  },
  
  // ========== DIFICULDADE ==========
  setDificuldade(level) {
    document.getElementById('receitaDificuldade').value = level;
    document.querySelectorAll('.dif-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.val === level);
    });
  },
  
  // ========== FAVORITO ==========
  toggleFav(recipeId = null) {
    const id = recipeId || this.currentRecipeId;
    if (!id) return;
    
    const recipe = this.findRecipe(id);
    if (recipe) {
      recipe.favorito = !recipe.favorito;
      Storage.save('receitas', state.receitas);
      this.render();
      Utils.showToast(recipe.favorito ? 'Adicionado aos favoritos ♥' : 'Removido dos favoritos', 'success');
      EventBus.emit('receita:favorito', recipe);
    }
  },
  
  // ========== DETALHE ==========
  openDetail(recipeId) {
    this.currentRecipeId = recipeId;
    const recipe = this.findRecipe(recipeId);
    if (!recipe) return;
    
    const content = document.getElementById('receitaDetalheConteudo');
    if (!content) return;
    
    const estrelas = this.renderDificuldadeEstrelas(recipe.dificuldade);
    
    content.innerHTML = `
      <div class="receita-hero" ${recipe.foto ? `style="background-image:url(${recipe.foto})"` : ''}>
        <div class="receita-hero-gradient"></div>
        <button class="receita-hero-fav ${recipe.favorito ? 'active' : ''}" onclick="ReceitasApp.toggleFav()" title="Favoritar">♥</button>
        <div class="receita-hero-info">
          ${recipe.categoria ? `<div class="receita-hero-cat">${recipe.categoria}</div>` : ''}
          <div class="receita-hero-nome">${recipe.nome}</div>
          <div class="receita-hero-meta">
            ${recipe.dificuldade ? `<span class="dif-badge">${estrelas} ${recipe.dificuldade}</span>` : ''}
            ${recipe.tempo ? `<span>⏱ ${recipe.tempo}</span>` : ''}
            ${recipe.porcoes ? `<span>🍽 ${recipe.porcoes} porções</span>` : ''}
          </div>
        </div>
      </div>
      
      <div class="receita-detalhe-body">
        ${recipe.ingredientes && recipe.ingredientes.length > 0 ? `
          <div class="receita-view-section-title">Ingredientes</div>
          <div class="receita-check-lista">
            ${recipe.ingredientes.map(ing => `
              <div class="receita-check-item">
                <div class="receita-check-box"><input type="checkbox"></div>
                <span><strong>${ing.quantidade}</strong> ${ing.unidade} ${ing.nome}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${recipe.passos && recipe.passos.length > 0 ? `
          <div class="receita-view-section-title" style="margin-top:24px">Modo de Preparo</div>
          <div class="receita-passos-view">
            ${recipe.passos.map((passo, idx) => `
              <div class="receita-passo-item">
                <div class="receita-passo-num">${idx + 1}</div>
                <div class="receita-passo-txt">${passo}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${recipe.observacoes ? `
          <div class="receita-obs-view" style="margin-top:24px;padding:12px;background:var(--card-2);border-radius:8px">📝 <strong>Observações:</strong> ${recipe.observacoes}</div>
        ` : ''}
        
        <div style="font-size:11px;color:var(--text-faint);margin-top:24px">Criado em ${Utils.formatDate(new Date(recipe.dataCriacao))}</div>
      </div>
    `;
    
    document.getElementById('pageReceitaDetalhe').classList.add('active');
  },
  
  closeDetalhe() {
    document.getElementById('pageReceitaDetalhe').classList.remove('active');
  },
  
  editRecipe() {
    this.closeDetalhe();
    this.openForm(this.currentRecipeId);
  },
  
  deleteRecipe() {
    const recipe = this.findRecipe(this.currentRecipeId);
    if (!confirm(`Tem certeza que deseja deletar "${recipe.nome}"?`)) return;
    
    state.receitas.receitas = state.receitas.receitas.filter(r => r.id !== this.currentRecipeId);
    Storage.save('receitas', state.receitas);
    this.closeDetalhe();
    this.render();
    Utils.showToast('Receita deletada', 'success');
    EventBus.emit('receita:deletada', recipe);
  },
  
  shareRecipe() {
    const recipe = this.findRecipe(this.currentRecipeId);
    if (!recipe) return;
    
    const text = `${recipe.nome}\n\n📋 Ingredientes:\n${recipe.ingredientes?.map(i => `• ${i.quantidade} ${i.unidade} ${i.nome}`).join('\n')}\n\n👨‍🍳 Modo de preparo:\n${recipe.passos?.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    
    Utils.shareData(recipe.nome, text);
  },
  
  exportRecipeAsJSON() {
    const recipe = this.findRecipe(this.currentRecipeId);
    if (!recipe) return;
    
    const json = JSON.stringify(recipe, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receita-${Utils.slugify(recipe.nome)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    Utils.showToast('Receita exportada', 'success');
  },
  
  toggleMenu() {
    const menu = document.getElementById('receitaDetalheMenuDropdown');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },
  
  // ========== MODAIS ==========
  closeModal(id) {
    Utils.closeModal(id);
  }
};
