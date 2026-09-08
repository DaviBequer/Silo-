# 🏗️ Arquitetura Modular do Silo

## Problema Original
- App monolítico com **~4.500 linhas** em um único arquivo `app.js`
- Qualquer edição pequena requer reescrever todo o arquivo
- Consumo gigantesco de tokens das IAs
- Difícil para múltiplos devs trabalharem em paralelo

## ✅ Solução: Arquitetura Ultra-Modular

Cada **app é completamente independente** com:
- 1 arquivo HTML (template)
- 1 arquivo JS (lógica isolada)
- 1 arquivo CSS (estilos específicos)

### Estrutura
```
js/
├── core.js                    # Núcleo compartilhado (state, storage, utils)
└── apps/
    ├── receitas/
    │   ├── receitas.html      # Template
    │   ├── receitas.js        # Lógica (~500 linhas)
    │   └── receitas.css       # Estilos
    ├── louvor/
    ├── mercado/
    ├── ponto/
    ├── planner/
    ├── panorama/
    └── tarefas/
```

---

## 🚀 Como Editar um App (Exemplo: RECEITAS)

### 1️⃣ Entenda a estrutura
```javascript
const ReceitasApp = {
  // DADOS
  getRecipes()        // Lê de state.receitas.receitas
  findRecipe(id)      // Busca uma receita
  
  // RENDERIZAÇÃO
  render()            // Atualiza a UI
  renderGrid()        // Lista de receitas
  renderCard(recipe)  // Um card de receita
  
  // NEGÓCIO
  saveRecipe()        // Salva nova/edita
  deleteRecipe()      // Deleta
  toggleFav()         // Favorita/desfavorita
  
  // FORMA E MODAIS
  openForm(id)        // Abre formulário
  closeForm()         // Fecha formulário
  openDetail(id)      // Abre detalhe
}
```

### 2️⃣ Para adicionar um campo novo

**Exemplo: Adicionar "Tempo de Cozimento" extra**

1. **Editar template** (`receitas.html`):
```html
<!-- Adicionar em receita-form-section -->
<div class="field">
  <label>Tempo de Cozimento (min)</label>
  <input type="number" id="receitaTempoFogo" placeholder="Minutos">
</div>
```

2. **Editar lógica** (`receitas.js`):
```javascript
// No openForm():
document.getElementById('receitaTempoFogo').value = recipe.tempoFogo || '';

// No saveRecipe():
const recipe = {
  // ... outros campos
  tempoFogo: parseInt(document.getElementById('receitaTempoFogo').value) || 0,
};

// No renderCard() ou renderDetail():
${recipe.tempoFogo ? `<span>🔥 ${recipe.tempoFogo}min</span>` : ''}
```

3. **Pronto!** Não mexeu em mais nada.

---

## 🔗 Núcleo Compartilhado (core.js)

Todos os apps usam:

### State Global
```javascript
state.receitas.receitas   // Array de receitas
state.receitas.categorias // Array de categorias
state.planner.davi        // Dados do Davi
```

### Storage (Persistência)
```javascript
Storage.save('receitas', state.receitas)    // Salva no localStorage
Storage.load('receitas', {})                 // Carrega do localStorage
```

### Utilitários
```javascript
Utils.fmtMoney(100)           // → "R$ 100,00"
Utils.uid('receita')          // → "receita_abc123_xyz789"
Utils.showToast('Salvo!')      // Notificação
Utils.openModal('modalId')     // Abre modal
Utils.closeModal('modalId')    // Fecha modal
```

---

## 📊 Economia de Tokens

| Cenário | Antes | Depois |
|---------|-------|--------|
| Editar um campo | 4.500 linhas reescritas | Só 50 linhas tocadas |
| Adicionar feature | Context cheio | Cabe tranquilamente |
| Debugar bug | Procurar em 4.5k linhas | Procurar em 500 linhas |
| Multiple devs | Conflitos massivos | Arquivos isolados |

---

## 🎯 Próximos Apps para Modularizar

- [ ] Louvor
- [ ] Mercado
- [ ] Ponto
- [ ] Planner
- [ ] Panorama
- [ ] Tarefas

**Cada um segue o mesmo padrão!**

---

## 💡 Dicas

1. **Não misture apps**: Mude só o seu app
2. **Use o core**: `state`, `Storage`, `Utils` estão globais
3. **IDs únicos**: Use `Utils.uid()` para IDs
4. **Persistência**: Sempre chame `Storage.save()` depois de mudar dados
5. **Renderizar**: Sempre chame `this.render()` depois de mudar dados

---

## 🚨 Checklist ao Editar

- [ ] Edita só os arquivos do seu app
- [ ] Usa state global para ler dados
- [ ] Usa Storage.save() para persistir
- [ ] Chama render() para atualizar UI
- [ ] Testa no navegador
- [ ] Commit com mensagem clara
