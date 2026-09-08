/**
 * RECEITAS APP - Lógica isolada
 * Edite APENAS este arquivo para modificar o app de receitas
 */

const ReceitasApp = {
  currentRecipeId: null,
  currentFoto: null,
  
  // ========== INICIALIZAÇÃO ==========
  init() {
    this.loadCategories();
    this.render();
    console.log('✓ Receitas App inicializado');
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
  
  // ========== CATEGORIAS ==========
  loadCategories() {
    this.renderCategoryChips();
  },
  
  renderCategoryChips() {
    const container = document.getElementById('receitaFilterChips');
    if (!container) return;
    
    const cats = this.getCategories();
    container.innerHTML = cats.map(cat => 
      `<button class="filter-chip" onclick="ReceitasApp.filterByCategory('${cat}')">${cat}</button>`
    ).join('') + 
    `<button class="filter-chip filter-chip-add" onclick="ReceitasApp.openCategoryModal()">+ Nova</button>`;
  },
  
  openCategoryModal() {
    Utils.openModal('modalReceitaCategoria');
  },
  
  saveCategory() {
    const nome = document.getElementById('receitaCategoriaNome').value.trim();
    if (!nome) {
      Utils.showToast('Digite um nome');
      return;
    }
    
    if (!state.receitas.categorias.includes(nome)) {
      state.receitas.categorias.push(nome);
      Storage.save('receitas', state.receitas);
      this.loadCategories();
      Utils.showToast('Categoria criada');
    }
    
    document.getElementById('receitaCategoriaNome').value = '';
    this.closeModal('modalReceitaCategoria');
  },
  
  createCategoryInline() {
    const nome = document.getElementById('receitaCatNovaInput').value.trim();
    if (!nome) return;
    
    if (!state.receitas.categorias.includes(nome)) {
      state.receitas.categorias.push(nome);
      Storage.save('receitas', state.receitas);
    }
    
    this.selectCategory(nome);
    this.renderCategoryOptions();
    document.getElementById('receitaCatNovaInput').value = '';
  },
  
  // ========== RENDERIZAÇÃO ==========
  render() {
    this.renderGrid();
  },
  
  renderGrid() {
    const container = document.getElementById('receitaGrid');
    if (!container) return;
    
    const recipes = this.getRecipes();
    
    if (recipes.length === 0) {
      container.innerHTML = `
        <div class="receita-empty">
          <div class="receita-empty-icon">🍳</div>
          <div class="receita-empty-title">Nenhuma receita ainda</div>
          <div class="receita-empty-sub">Crie sua primeira receita clicando no botão +</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = recipes.map(recipe => this.renderCard(recipe)).join('');
  },
  
  renderCard(recipe) {
    return `
      <div class="receita-card" onclick="ReceitasApp.openDetail('${recipe.id}')">
        <div class="receita-card-media">
          ${recipe.foto ? `<img class="receita-card-img" src="${recipe.foto}" alt="${recipe.nome}">` : `<div class="receita-card-img-placeholder">🍽️</div>`}
          <button class="receita-card-fav ${recipe.favorito ? 'active' : ''}" onclick="event.stopPropagation(); ReceitasApp.toggleFav('${recipe.id}')">♥</button>
          ${recipe.categoria ? `<div class="receita-card-cat">${recipe.categoria}</div>` : ''}
        </div>
        <div class="receita-card-body">
          <div class="receita-card-nome">${recipe.nome}</div>
          <div class="receita-card-meta">
            ${recipe.tempo ? `<span>⏱ ${recipe.tempo}</span>` : ''}
            ${recipe.porcoes ? `<span>🍽 ${recipe.porcoes} porções</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },
  
  // ========== BUSCA E FILTRO ==========
  onSearch(value) {
    const searchBtn = document.getElementById('receitaSearchClear');
    if (searchBtn) searchBtn.style.display = value ? 'block' : 'none';
    
    this.filterRecipes();
  },
  
  clearSearch() {
    document.getElementById('receitaSearchInput').value = '';
    document.getElementById('receitaSearchClear').style.display = 'none';
    this.render();
  },
  
  filterByCategory(cat) {
    this.render();
  },
  
  filterRecipes() {
    const searchTerm = document.getElementById('receitaSearchInput').value.toLowerCase();
    const filtered = this.getRecipes().filter(r => 
      r.nome.toLowerCase().includes(searchTerm) ||
      (r.ingredientes || []).some(ing => ing.nome.toLowerCase().includes(searchTerm))
    );
    
    const container = document.getElementById('receitaGrid');
    if (!container) return;
    container.innerHTML = filtered.map(recipe => this.renderCard(recipe)).join('');
  },
  
  // ========== FORMULÁRIO ==========
  openForm(recipeId = null) {
    this.currentRecipeId = recipeId;
    this.currentFoto = null;
    
    const form = document.getElementById('receitaForm');
    if (recipeId) {
      const recipe = this.findRecipe(recipeId);
      if (recipe) {
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
      Utils.showToast('Digite um nome');
      return;
    }
    
    const oldRecipe = this.currentRecipeId ? this.findRecipe(this.currentRecipeId) : null;
    
    const recipe = {
      id: this.currentRecipeId || Utils.uid('receita'),
      nome,
      tempo: document.getElementById('receitaTempo').value,
      porcoes: parseInt(document.getElementById('receitaPorcoes').value) || 0,
      dificuldade: document.getElementById('receitaDificuldade').value,
      categoria: document.getElementById('receitaCategoriaSelect').value || null,
      cor: document.getElementById('receitaCor').value,
      foto: this.currentFoto,
      ingredientes: this.getFormIngredients(),
      passos: this.getFormSteps(),
      observacoes: document.getElementById('receitaObservacoes').value,
      favorito: oldRecipe?.favorito || false,
      dataCriacao: oldRecipe?.dataCriacao || new Date().toISOString()
    };
    
    const idx = state.receitas.receitas.findIndex(r => r.id === this.currentRecipeId);
    if (idx >= 0) {
      state.receitas.receitas[idx] = recipe;
    } else {
      state.receitas.receitas.push(recipe);
    }
    
    Storage.save('receitas', state.receitas);
    this.closeForm();
    this.render();
    Utils.showToast(this.currentRecipeId ? 'Receita atualizada' : 'Receita criada');
  },
  
  // ========== FOTO ==========
  onFotoSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
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
      container.innerHTML = `<img src="${this.currentFoto}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">`;
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
        <input type="text" value="${ing.unidade || ''}" placeholder="Unidade" class="ing-unit" data-idx="${idx}">
        <input type="text" value="${ing.nome || ''}" placeholder="Ingrediente" class="ing-nome" data-idx="${idx}">
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removeIngredient(${idx})">✕</button>
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
        <input type="text" placeholder="Unidade" class="ing-unit" data-idx="${idx}">
        <input type="text" placeholder="Ingrediente" class="ing-nome" data-idx="${idx}">
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removeIngredient(${idx})">✕</button>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newRow);
  },
  
  removeIngredient(idx) {
    document.querySelectorAll('.receita-ing-row')[idx]?.remove();
  },
  
  getFormIngredients() {
    return Array.from(document.querySelectorAll('.receita-ing-row')).map(row => ({
      quantidade: row.querySelector('.ing-qtd').value,
      unidade: row.querySelector('.ing-unit').value,
      nome: row.querySelector('.ing-nome').value
    }));
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
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removePasso(${idx})">✕</button>
      </div>
    `).join('');
  },
  
  addPasso() {
    const container = document.getElementById('receitaPassosLista');
    const idx = container.querySelectorAll('.receita-passo-row').length;
    
    const newRow = `
      <div class="receita-passo-row">
        <div class="receita-passo-num">${idx + 1}</div>
        <textarea class="receita-passo-input" data-idx="${idx}" placeholder="Descreva este passo..."></textarea>
        <button type="button" class="btn-icon-sm" onclick="ReceitasApp.removePasso(${idx})">✕</button>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newRow);
  },
  
  removePasso(idx) {
    document.querySelectorAll('.receita-passo-row')[idx]?.remove();
  },
  
  getFormSteps() {
    return Array.from(document.querySelectorAll('.receita-passo-input'))
      .map(el => el.value)
      .filter(v => v.trim());
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
      Utils.showToast(recipe.favorito ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    }
  },
  
  // ========== DETALHE ==========
  openDetail(recipeId) {
    this.currentRecipeId = recipeId;
    const recipe = this.findRecipe(recipeId);
    if (!recipe) return;
    
    const content = document.getElementById('receitaDetalheConteudo');
    if (!content) return;
    
    content.innerHTML = `
      <div class="receita-hero" ${recipe.foto ? `style="background-image:url(${recipe.foto})"` : ''}>
        <div class="receita-hero-gradient"></div>
        <button class="receita-hero-fav ${recipe.favorito ? 'active' : ''}" onclick="ReceitasApp.toggleFav()">♥</button>
        <div class="receita-hero-info">
          ${recipe.categoria ? `<div class="receita-hero-cat">${recipe.categoria}</div>` : ''}
          <div class="receita-hero-nome">${recipe.nome}</div>
          <div class="receita-hero-meta">
            ${recipe.dificuldade ? `<span class="dif-badge">Dificuldade: ${recipe.dificuldade}</span>` : ''}
            ${recipe.tempo ? `<span>⏱ ${recipe.tempo}</span>` : ''}
            ${recipe.porcoes ? `<span>🍽 ${recipe.porcoes}</span>` : ''}
          </div>
        </div>
      </div>
      
      <div class="receita-detalhe-body">
        ${recipe.ingredientes && recipe.ingredientes.length > 0 ? `
          <div class="receita-view-section-title">Ingredientes</div>
          <div class="receita-check-lista">
            ${recipe.ingredientes.map(ing => `
              <div class="receita-check-item">
                <div class="receita-check-box"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                <span>${ing.quantidade} ${ing.unidade} ${ing.nome}</span>
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
          <div class="receita-obs-view" style="margin-top:24px">${recipe.observacoes}</div>
        ` : ''}
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
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return;
    
    state.receitas.receitas = state.receitas.receitas.filter(r => r.id !== this.currentRecipeId);
    Storage.save('receitas', state.receitas);
    this.closeDetalhe();
    this.render();
    Utils.showToast('Receita excluída');
  },
  
  shareRecipe() {
    const recipe = this.findRecipe(this.currentRecipeId);
    if (!recipe) return;
    
    const text = `${recipe.nome}\n\nIngredientes:\n${recipe.ingredientes?.map(i => `- ${i.quantidade} ${i.unidade} ${i.nome}`).join('\n') || 'N/A'}\n\nModo de preparo:\n${recipe.passos?.map((p, i) => `${i+1}. ${p}`).join('\n') || 'N/A'}`;
    
    if (navigator.share) {
      navigator.share({ title: recipe.nome, text });
    } else {
      Utils.showToast('Copiar: ' + text);
    }
  },
  
  toggleMenu() {
    const menu = document.getElementById('receitaDetalheMenuDropdown');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },
  
  // ========== MODAIS ==========
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  }
};
