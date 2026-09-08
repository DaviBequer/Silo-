# 📚 Guia de Edição dos Apps do Silo

## 🚀 Visão Geral

O Silo foi refatorado para **arquitetura modular**. Cada app é independente e isolado.

### Estrutura
```
js/
├── core.js                  # ⚙️ Núcleo (estado, storage, utils)
├── app.js                   # 🎯 Inicializador
└── apps/
    ├── panorama/           # 📊 Visão geral
    ├── planner/            # 📋 Planejamento
    ├── ponto/              # ⏱️ Horas PJ
    ├── receitas/           # 🍳 Receitas
    ├── louvor/             # 🎵 Louvores
    ├── mercado/            # 🛒 Compras
    └── tarefas/            # ✅ Tarefas
```

Cada app tem:
- `app.html` → Template/UI
- `app.js` → Lógica isolada (~300-500 linhas)

---

## 📝 Como Editar um App

### Exemplo: Editar o App RECEITAS

#### 1️⃣ Entender o Arquivo

**`js/apps/receitas/receitas.js`** (~600 linhas total):

```javascript
const ReceitasApp = {
  // ===== MÉTODOS PÚBLICOS =====
  init()              // Inicializa o app
  render()            // Atualiza a UI
  
  // ===== DADOS =====
  getRecipes()        // Lê de state.receitas.receitas
  findRecipe(id)      // Busca uma receita
  
  // ===== OPERAÇÕES =====
  openForm()          // Abre formulário
  saveRecipe()        // Salva receita
  deleteRecipe()      // Deleta receita
  openDetail()        // Mostra detalhe
  
  // ... outros métodos
};
```

#### 2️⃣ Adicionar um Campo

**Exemplo: Adicionar "Tempo de Forno" em receitas**

**Passo 1: Editar `receitas.html`**

Procure por `receita-form-section` e adicione:
```html
<div class="field">
  <label>Tempo no Forno (minutos)</label>
  <input type="number" id="receitaTempoForno" min="0" placeholder="Ex: 30">
</div>
```

**Passo 2: Editar `receitas.js`**

No método `openForm()`:
```javascript
document.getElementById('receitaTempoForno').value = recipe.tempoForno || '';
```

No método `saveRecipe()`:
```javascript
const recipe = {
  // ... outros campos
  tempoForno: parseInt(document.getElementById('receitaTempoForno').value) || 0,
};
```

No método `renderCard()` ou `openDetail()`:
```javascript
${recipe.tempoForno ? `<span>🔥 ${recipe.tempoForno}min no forno</span>` : ''}
```

**Pronto!** O novo campo está funcionando.

---

## 🔧 Núcleo Compartilhado (core.js)

Todos os apps usam:

### 📊 State Global
```javascript
state.receitas          // { receitas: [], categorias: [] }
state.louvor           // { louvores: [], categorias: [] }
state.planner.davi     // Dados do Davi
state.planner.cris     // Dados da Cris
state.ponto            // Horas e valores
state.mercado          // { lista: [], estoque: [] }
state.tarefas          // { tarefas: [] }
```

### 💾 Storage
```javascript
// Salvar dados de um app
Storage.save('receitas', state.receitas);

// Carregar
const data = Storage.load('receitas', { receitas: [], categorias: [] });

// Salvar tudo antes de sair
Storage.saveAll();
```

### 🛠️ Utilitários
```javascript
// Formatação
Utils.fmtMoney(100)                    // "R$ 100,00"
Utils.fmtMoneySigned(-50)              // "-R$ 50,00"

// Data
Utils.monthKey(new Date())             // "2026-09"
Utils.addMonths('2026-09', 1)          // "2026-10"

// ID único
Utils.uid('receita')                   // "receita_abc123_xyz"

// UI
Utils.showToast('Salvo!')              // Notificação
Utils.openModal('meuModal')            // Abre modal
Utils.closeModal('meuModal')           // Fecha modal

// Input
Utils.maskMoneyInput(element)          // Formata entrada monetária
Utils.unmaskMoney('1.000,50')          // → 1000.50
```

### 📢 Eventos (opcional)
```javascript
EventBus.on('evento', (data) => { /* ... */ });
EventBus.emit('evento', dados);
EventBus.off('evento', callback);
```

---

## 📱 Apps Disponíveis

### 📊 Panorama (`panorama.js`)
Visão geral financeira. Mostra:
- Acumulado de meses
- Resumo do Ponto PJ
- Status financeiro por usuário
- Link para simulador

### 📋 Planner (`planner.js`)
Planejamento mensal:
- Saldo atual
- Renda mensal
- Gastos por categoria (Moradia, Assinaturas, Fixos, Futuros)
- Rastreamento de cartões

### ⏱️ Ponto PJ (`ponto.js`)
Controle de horas:
- Total de horas do mês
- Valor a receber
- Valor da hora configurável
- Comparação com padrão

### 🍳 Receitas (`receitas.js`) ⭐ **Exemplo**
Biblioteca de receitas:
- Criar/editar/deletar receitas
- Foto, ingredientes, modo de preparo
- Dificuldade, tempo, porções
- Categorias personalizadas
- Favoritas
- Busca e filtros

### 🎵 Louvor (`louvor.js`)
Biblioteca de louvores:
- Título, artista, tom
- Letra completa
- Busca
- Visualizar em tela cheia

### 🛒 Mercado (`mercado.js`)
Lista de compras + Estoque:
- **Lista**: Itens a comprar (com checkbox)
- **Estoque**: Inventário
- **Dashboard**: Gastos e análises

### ✅ Tarefas (`tarefas.js`)
Gerenciador de tarefas:
- Tarefas com descrição
- Categorias
- Visualização por semana
- Marcar como concluída

---

## 🎯 Fluxo Típico de Edição

1. **Identifique qual app editar**
   - "Vou editar Receitas" → Veja `js/apps/receitas/`

2. **Entenda a estrutura**
   - Template HTML em `receitas.html`
   - Lógica em `receitas.js`

3. **Faça a mudança**
   - Adicione/modifique HTML
   - Atualize JS

4. **Teste localmente**
   - Abra `index.html` no navegador
   - Teste a funcionalidade

5. **Commit e push**
   - Mensagem clara: "feat: adicionar tempo de forno em receitas"

---

## 💡 Boas Práticas

### ✅ Faça:
- Edite **APENAS** o app que quer modificar
- Use `state` para ler dados
- Use `Storage.save()` após mudar dados
- Chame `this.render()` para atualizar UI
- Use `Utils` para funções comuns
- Mantenha IDs únicos com `Utils.uid()`

### ❌ Evite:
- Mexer em `core.js` sem necessidade
- Códigos repetidos (use utilitários)
- Modificar múltiplos apps na mesma edição
- Esquecer de chamar `render()` após mudanças
- Não salvar com `Storage.save()`

---

## 🚨 Quando Mexer em `core.js`

Só quando:
- Adicionar novo tipo de dado global
- Adicionar nova função utilitária compartilhada
- Mudar lógica de armazenamento

**Exemplo**: Adicionar função de formatação de data
```javascript
// Em core.js, na seção Utils:
fmtDate(d) {
  return d.toLocaleDateString('pt-BR');
}

// Em qualquer app:
Utils.fmtDate(new Date())  // "08/09/2026"
```

---

## 🐛 Debugging

### Ver estado em tempo real
```javascript
console.log(state.receitas);
console.log(localStorage);
```

### Limpar dados de um app
```javascript
localStorage.removeItem('silo_receitas');
location.reload();
```

### Testador rápido
```javascript
// No console do navegador:
ReceitasApp.init();
state.receitas
Storage.save('receitas', state.receitas)
```

---

## 📊 Economia de Tokens

| Ação | Antes | Depois |
|------|-------|--------|
| Editar um campo | 4.500 linhas reescritas | Só 50 linhas tocadas |
| Adicionar feature | Context lotado | Cabe confortavelmente |
| Debugar bug | Procurar em 4.5k | Procurar em 500 |
| Colaboração | Conflitos massivos | Arquivos isolados |

---

## 🤔 FAQ

**P: Como adicionar um novo app?**
A: Crie uma pasta em `js/apps/novo/` com `novo.html` e `novo.js`, adicione em APPS no `app.js`.

**P: Como compartilhar dados entre apps?**
A: Use `state` global em `core.js`. Ex: `state.compartilhado`.

**P: Como adicionar estilos?**
A: Adicione em `style.css` com prefixo do app. Ex: `.receita-card { ... }`.

**P: Como testar offline?**
A: Service Worker (`sw.js`) já está configurado. Teste em DevTools > Application > Service Workers.

**P: Qual é o limite de tamanho do localStorage?**
A: ~5-10MB. Silo usa ~1-2MB com dados normais.

---

## 📞 Suporte

Para dúvidas sobre a arquitetura, veja:
- `README-MODULAR.md` - Visão geral
- `core.js` - Funções disponíveis
- `js/apps/receitas/` - Exemplo completo

---

**Boa sorte! 🚀**
