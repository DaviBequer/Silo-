/* ================= RECEITAS ================= */
let receitaFotoUrlAtual = null;
let receitaFiltroAtivo = 'todas';
let receitaSearchQuery = '';
let receitaCategoriaSelecionada = null;
let receitaDificuldadeSelecionada = '';
let receitaCorSelecionada = '';
let receitaDetalheAtualId = null;
let receitaChecklistState = {};
const RECEITA_CORES = ['#2B3038','#E0342B','#DB8B18','#1C9D5B','#0EA5E9','#7B5FA6','#1A1A1A','#FFFFFF','#7A4A2B','#8A8F98'];

/* ---------- TELA PRINCIPAL ---------- */
function renderReceitas(){
  renderReceitaFilterChips();
  renderReceitaGrid();
}

function renderReceitaFilterChips(){
  const el = document.getElementById('receitaFilterChips');
  const cats = state.receitaCategorias || [];
  let html = '';
  html += chipReceitaFiltro('todas', 'Todas');
  html += chipReceitaFiltro('favoritos', 'Favoritos');
  html += chipReceitaFiltro('recentes', 'Recentes');
  cats.forEach(c=>{
    html += `<button class="filter-chip${receitaFiltroAtivo===c.id?' active':''}" onclick="selecionarReceitaFiltro('${c.id}')">${c.nome}<span class="filter-chip-del" onclick="event.stopPropagation();excluirReceitaCategoria('${c.id}')">×</span></button>`;
  });
  html += `<button class="filter-chip filter-chip-add" onclick="openReceitaCategoriaModal()">+ Categoria</button>`;
  el.innerHTML = html;
}
function chipReceitaFiltro(val, label){
  return `<button class="filter-chip${receitaFiltroAtivo===val?' active':''}" onclick="selecionarReceitaFiltro('${val}')">${label}</button>`;
}
function selecionarReceitaFiltro(val){
  receitaFiltroAtivo = val;
  renderReceitas();
}
function excluirReceitaCategoria(id){
  iosConfirm('Excluir esta categoria? As receitas dela ficarão sem categoria.').then(ok=>{
    if(!ok) return;
    state.receitaCategorias = (state.receitaCategorias||[]).filter(c=>c.id!==id);
    (state.receitas||[]).forEach(r=>{ if(r.categoriaId===id) r.categoriaId=null; });
    if(receitaFiltroAtivo===id) receitaFiltroAtivo='todas';
    persist();
    renderReceitas();
  });
}
function onReceitaSearchInput(val){
  receitaSearchQuery = val.trim().toLowerCase();
  document.getElementById('receitaSearchClear').style.display = receitaSearchQuery ? 'block' : 'none';
  renderReceitaGrid();
}
function limparReceitaSearch(){
  receitaSearchQuery = '';
  document.getElementById('receitaSearchInput').value = '';
  document.getElementById('receitaSearchClear').style.display = 'none';
  renderReceitaGrid();
}
function getReceitasFiltradas(){
  let list = state.receitas || [];
  if(receitaFiltroAtivo === 'favoritos'){
    list = list.filter(r=>r.favorito);
  } else if(receitaFiltroAtivo === 'recentes'){
    list = [...list].sort((a,b)=>(b.atualizadoEm||b.criadoEm||0)-(a.atualizadoEm||a.criadoEm||0)).slice(0,8);
  } else if(receitaFiltroAtivo !== 'todas'){
    list = list.filter(r=>r.categoriaId===receitaFiltroAtivo);
  }
  if(receitaSearchQuery){
    list = list.filter(r=>{
      const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
      const alvo = [r.nome, cat?cat.nome:'', ...(r.ingredientes||[]).map(i=>i.nome)].join(' ').toLowerCase();
      return alvo.includes(receitaSearchQuery);
    });
  }
  if(receitaFiltroAtivo !== 'recentes'){
    list = [...list].sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0));
  }
  return list;
}

function renderReceitaGrid(){
  const el = document.getElementById('receitaGrid');
  const list = getReceitasFiltradas();
  if(!list.length){
    const msg = receitaSearchQuery ? 'Nenhuma receita encontrada.' : (state.receitas||[]).length ? 'Nenhuma receita nesse filtro.' : null;
    if(msg){
      el.innerHTML = `<div class="receita-empty"><div class="receita-empty-icon">${ICON_RECEITA_EMPTY}</div><div class="receita-empty-title">${msg}</div></div>`;
    }else{
      el.innerHTML = `<div class="receita-empty"><div class="receita-empty-icon">${ICON_RECEITA_EMPTY}</div><div class="receita-empty-title">Seu livro de receitas está vazio</div><div class="receita-empty-sub">Guarde suas receitas favoritas com fotos, ingredientes e modo de preparo.</div><button class="btn" onclick="openReceitaModal()">Criar primeira receita</button></div>`;
    }
    return;
  }
  el.innerHTML = list.map(r=>receitaCardHtml(r)).join('');
}

function receitaCardHtml(r){
  const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
  const dataTxt = (r.atualizadoEm||r.criadoEm) ? new Date(r.atualizadoEm||r.criadoEm).toLocaleDateString('pt-BR') : '';
  const foto = r.fotoUrl
    ? `<img src="${r.fotoUrl}" class="receita-card-img" loading="lazy">`
    : `<div class="receita-card-img receita-card-img-placeholder" style="${r.cor?`background:${r.cor}22`:''}">${ICON_PRATO}</div>`;
  return `<div class="receita-card" onclick="abrirReceitaDetalhe('${r.id}')">
    <div class="receita-card-media">
      ${foto}
      <button class="receita-card-fav${r.favorito?' active':''}" onclick="event.stopPropagation();toggleFavoritoReceita('${r.id}')" aria-label="Favoritar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${r.favorito?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      ${cat?`<span class="receita-card-cat">${cat.nome}</span>`:''}
    </div>
    <div class="receita-card-body">
      <div class="receita-card-nome">${r.nome}</div>
      <div class="receita-card-meta">
        ${r.tempo?`<span>${ICON_CLOCK_SM}${r.tempo}</span>`:''}
        ${r.porcoes?`<span>${ICON_PORCOES_SM}${r.porcoes} porções</span>`:''}
      </div>
      ${dataTxt?`<div class="receita-card-data">Editado em ${dataTxt}</div>`:''}
    </div>
    <div class="receita-card-menu-wrap" onclick="event.stopPropagation()">
      <button class="receita-card-menu-btn" onclick="toggleReceitaCardMenu('${r.id}', event)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="19" r="1.1"/></svg></button>
      <div class="receita-card-menu" id="receitaCardMenu-${r.id}" style="display:none">
        <button onclick="openReceitaModal('${r.id}')">${ICON_EDIT} Editar</button>
        <button onclick="duplicarReceita('${r.id}')">${ICON_DUPLICATE_SM} Duplicar</button>
        <button onclick="excluirReceita('${r.id}')" style="color:var(--danger)">${ICON_TRASH} Excluir</button>
      </div>
    </div>
  </div>`;
}

function toggleReceitaCardMenu(id, event){
  event.stopPropagation();
  document.querySelectorAll('.receita-card-menu').forEach(m=>{ if(m.id !== 'receitaCardMenu-'+id) m.style.display='none'; });
  const menu = document.getElementById('receitaCardMenu-'+id);
  menu.style.display = menu.style.display==='block' ? 'none' : 'block';
}
document.addEventListener('click', ()=>{ document.querySelectorAll('.receita-card-menu').forEach(m=>m.style.display='none'); });

function toggleFavoritoReceita(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  r.favorito = !r.favorito;
  vibrar();
  persist();
  renderReceitaGrid();
  if(receitaDetalheAtualId === id) renderReceitaDetalheConteudo(r);
}
function vibrar(ms){
  if(navigator.vibrate){ try{ navigator.vibrate(ms||12); }catch(e){} }
}

function duplicarReceita(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  const copia = JSON.parse(JSON.stringify(r));
  copia.id = 'rc'+Date.now();
  copia.nome = r.nome + ' (cópia)';
  copia.favorito = false;
  copia.criadoEm = Date.now();
  copia.atualizadoEm = Date.now();
  state.receitas.push(copia);
  persist();
  renderReceitas();
  showToast('Receita duplicada');
}
function excluirReceita(id){
  iosConfirm('Excluir esta receita?').then(ok=>{
    if(!ok) return;
    state.receitas = (state.receitas||[]).filter(r=>r.id!==id);
    persist();
    renderReceitas();
    showToast('Receita removida');
  });
}

/* ---------- DETALHES (fullpage) ---------- */
function abrirReceitaDetalhe(id){
  const r = (state.receitas||[]).find(r=>r.id===id);
  if(!r) return;
  receitaDetalheAtualId = id;
  renderReceitaDetalheConteudo(r);
  document.getElementById('receitaDetalheHeaderTitle').textContent = r.nome;
  document.getElementById('pageReceitaDetalhe').classList.add('active');
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
}
function closeReceitaDetalhe(){
  document.getElementById('pageReceitaDetalhe').classList.remove('active');
  receitaDetalheAtualId = null;
}
function toggleReceitaDetalheMenu(){
  const el = document.getElementById('receitaDetalheMenuDropdown');
  el.style.display = el.style.display==='block' ? 'none' : 'block';
}
function renderReceitaDetalheConteudo(r){
  const cat = r.categoriaId ? (state.receitaCategorias||[]).find(c=>c.id===r.categoriaId) : null;
  const dificuldadeLbl = {facil:'Fácil',media:'Média',dificil:'Difícil'}[r.dificuldade] || '';
  const heroStyle = r.fotoUrl ? `background-image:url('${r.fotoUrl}')` : `background:${r.cor||'var(--primary)'}`;

  const ingredientesHtml = (r.ingredientes && r.ingredientes.length)
    ? r.ingredientes.map((ing,i)=>{
        const checked = !!receitaChecklistState[r.id+':'+i];
        const txt = [ing.quantidade, ing.unidade, ing.nome].filter(Boolean).join(' ');
        return `<div class="receita-check-item${checked?' checked':''}" onclick="toggleIngredienteCheck('${r.id}',${i})">
          <div class="receita-check-box">${checked?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          <span>${txt}</span>
        </div>`;
      }).join('')
    : '<div class="receita-detalhe-vazio">Nenhum ingrediente adicionado.</div>';

  const passosHtml = (r.passos && r.passos.filter(p=>p.trim()).length)
    ? r.passos.filter(p=>p.trim()).map((p,i)=>`<div class="receita-passo-item"><div class="receita-passo-num">${i+1}</div><div class="receita-passo-txt">${p}</div></div>`).join('')
    : '<div class="receita-detalhe-vazio">Nenhum passo adicionado.</div>';

  document.getElementById('receitaDetalheConteudo').innerHTML = `
    <div class="receita-hero" style="${heroStyle}">
      <div class="receita-hero-gradient"></div>
      <button class="receita-hero-fav${r.favorito?' active':''}" onclick="toggleFavoritoReceita('${r.id}')">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="${r.favorito?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <div class="receita-hero-info">
        ${cat?`<span class="receita-hero-cat">${cat.nome}</span>`:''}
        <div class="receita-hero-nome">${r.nome}</div>
        <div class="receita-hero-meta">
          ${r.tempo?`<span>${ICON_CLOCK_SM}${r.tempo}</span>`:''}
          ${r.porcoes?`<span>${ICON_PORCOES_SM}${r.porcoes} porções</span>`:''}
          ${dificuldadeLbl?`<span class="dif-badge dif-${r.dificuldade}">${dificuldadeLbl}</span>`:''}
        </div>
      </div>
    </div>
    <div class="receita-detalhe-body">
      <div class="receita-view-section-title">Ingredientes</div>
      <div class="receita-check-lista">${ingredientesHtml}</div>

      <div class="receita-view-section-title">Modo de Preparo</div>
      <div class="receita-passos-view">${passosHtml}</div>

      ${r.observacoes ? `<div class="receita-view-section-title">Observações</div><div class="receita-obs-view">${r.observacoes}</div>` : ''}
    </div>
  `;
}
function toggleIngredienteCheck(recId, idx){
  const key = recId+':'+idx;
  receitaChecklistState[key] = !receitaChecklistState[key];
  vibrar(8);
  const r = (state.receitas||[]).find(r=>r.id===recId);
  if(r) renderReceitaDetalheConteudo(r);
}
function compartilharReceitaAtual(){
  const r = (state.receitas||[]).find(r=>r.id===receitaDetalheAtualId);
  if(!r) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const ingTxt = (r.ingredientes||[]).map(i=>'• '+[i.quantidade,i.unidade,i.nome].filter(Boolean).join(' ')).join('\n');
  const passosTxt = (r.passos||[]).filter(p=>p.trim()).map((p,i)=>(i+1)+'. '+p).join('\n');
  const texto = `${r.nome}\n\nIngredientes:\n${ingTxt}\n\nModo de Preparo:\n${passosTxt}`;
  if(navigator.share){
    navigator.share({ title: r.nome, text: texto }).catch(()=>{});
  }else if(navigator.clipboard){
    navigator.clipboard.writeText(texto).then(()=>showToast('Receita copiada'));
  }else{
    showToast('Compartilhamento não suportado neste dispositivo');
  }
}
function editarReceitaAtual(){
  if(!receitaDetalheAtualId) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const id = receitaDetalheAtualId;
  closeReceitaDetalhe();
  openReceitaModal(id);
}
function excluirReceitaAtual(){
  if(!receitaDetalheAtualId) return;
  document.getElementById('receitaDetalheMenuDropdown').style.display = 'none';
  const idAlvo = receitaDetalheAtualId;
  iosConfirm('Excluir esta receita?').then(ok=>{
    if(!ok) return;
    state.receitas = (state.receitas||[]).filter(r=>r.id!==idAlvo);
    persist();
    closeReceitaDetalhe();
    renderReceitas();
    showToast('Receita removida');
  });
}

/* ---------- CATEGORIA (seletor customizado) ---------- */
function toggleReceitaCatPicker(){
  const panel = document.getElementById('receitaCatPickerPanel');
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if(!isOpen){
    renderReceitaCatPickerGrid();
    setTimeout(()=>{ panel.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50);
  }
}
function renderReceitaCatPickerGrid(){
  const grid = document.getElementById('receitaCatPickerGrid');
  const cats = state.receitaCategorias || [];
  let html = `<div class="cat-picker-opt${receitaCategoriaSelecionada===null?' selected':''}" onclick="selecionarReceitaCategoria(null)">Sem categoria</div>`;
  html += cats.map(c=>`<div class="cat-picker-opt${receitaCategoriaSelecionada===c.id?' selected':''}" onclick="selecionarReceitaCategoria('${c.id}')">${c.nome}</div>`).join('');
  grid.innerHTML = html;
}
function selecionarReceitaCategoria(id){
  receitaCategoriaSelecionada = id;
  const cat = id ? (state.receitaCategorias||[]).find(c=>c.id===id) : null;
  document.getElementById('receitaCatPickerBtn').textContent = cat ? cat.nome : 'Sem categoria';
  document.getElementById('receitaCategoriaSelect').value = id || '';
  document.getElementById('receitaCatPickerPanel').style.display = 'none';
}
function criarCategoriaInline(){
  const input = document.getElementById('receitaCatNovaInput');
  const nome = input.value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  if(!state.receitaCategorias) state.receitaCategorias = [];
  let cat = state.receitaCategorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase());
  if(!cat){
    cat = { id:'rcat'+Date.now(), nome };
    state.receitaCategorias.push(cat);
    persist();
  }
  input.value = '';
  selecionarReceitaCategoria(cat.id);
  renderReceitaCatPickerGrid();
}
function openReceitaCategoriaModal(){
  document.getElementById('receitaCategoriaNome').value = '';
  document.getElementById('modalReceitaCategoria').classList.add('active');
}
function salvarReceitaCategoria(){
  const nome = document.getElementById('receitaCategoriaNome').value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  if(!state.receitaCategorias) state.receitaCategorias = [];
  const existe = state.receitaCategorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase());
  if(existe){ showToast('Essa categoria já existe'); return; }
  state.receitaCategorias.push({ id:'rcat'+Date.now(), nome });
  persist();
  closeModal('modalReceitaCategoria');
  renderReceitas();
  showToast('Categoria criada');
}

/* ---------- FOTO (com compressão) ---------- */
function renderReceitaFotoPreview(){
  const el = document.getElementById('receitaFotoPreview');
  el.innerHTML = receitaFotoUrlAtual
    ? `<img src="${receitaFotoUrlAtual}">`
    : `<div class="receita-form-foto-placeholder">${ICON_PRATO}<span>Adicionar foto</span></div>`;
}
function onReceitaFotoSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  comprimirImagem(file, 900, 0.8).then(dataUrl=>{
    receitaFotoUrlAtual = dataUrl;
    renderReceitaFotoPreview();
  });
  event.target.value = '';
}
function removerReceitaFoto(){
  receitaFotoUrlAtual = null;
  renderReceitaFotoPreview();
}
function comprimirImagem(file, maxDim, qualidade){
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > maxDim || h > maxDim){
          if(w > h){ h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = ()=> resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Seletor de Unidade genérico (substitui <select> nativo) ---------- */
let unidadePickerTargetEl = null;
function abrirUnidadePicker(triggerEl){
  unidadePickerTargetEl = triggerEl;
  const atual = triggerEl.dataset.valor || '';
  let opts = UNIDADES_MEDIDA.slice();
  if(atual && !opts.includes(atual)) opts = [atual, ...opts];
  document.getElementById('unidadePickerLista').innerHTML = opts.map(u=>
    `<div class="unidade-picker-opt${atual===u?' selected':''}" onclick="selecionarUnidadePicker('${u}')">${u}${atual===u?ICON_CHECK:''}</div>`
  ).join('');
  document.getElementById('modalUnidadePicker').classList.add('active');
}
function selecionarUnidadePicker(u){
  if(unidadePickerTargetEl){
    unidadePickerTargetEl.dataset.valor = u;
    unidadePickerTargetEl.querySelector('.unidade-picker-valor').textContent = u;
  }
  unidadePickerTargetEl = null;
  closeModal('modalUnidadePicker');
}

/* ---------- INGREDIENTES (quantidade + unidade + nome) ---------- */
const UNIDADES_MEDIDA = ['g','ml','xícaras','unidades'];
function unidadeSelectHtml(className, valorAtual){
  const valor = valorAtual || '';
  return `<div class="unidade-picker ${className}" data-valor="${valor}" onclick="abrirUnidadePicker(this)">
    <span class="unidade-picker-valor">${valor || 'Unid.'}</span>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  </div>`;
}
function ingredienteRowHtml(ing, i){
  const q = (ing && ing.quantidade || '').toString().replace(/"/g,'&quot;');
  const u = (ing && ing.unidade || '').toString();
  const n = (ing && ing.nome || '').toString().replace(/"/g,'&quot;');
  return `<div class="receita-ing-row">
    <div class="receita-ing-num">${i+1}</div>
    <input type="text" class="receita-ing-qtd" placeholder="Qtd" value="${q}">
    ${unidadeSelectHtml('receita-ing-un', u)}
    <input type="text" class="receita-ing-nome" placeholder="Ingrediente" value="${n}">
    <button type="button" class="btn-icon-sm" onclick="removerIngredienteCampo(this)">${ICON_TRASH}</button>
  </div>`;
}
function renderIngredientesCampos(valores){
  const lista = document.getElementById('receitaIngredientesLista');
  const vals = (valores && valores.length) ? valores : [{},{},{}];
  lista.innerHTML = vals.map((v,i)=>ingredienteRowHtml(v,i)).join('');
}
function addIngredienteCampo(){
  const lista = document.getElementById('receitaIngredientesLista');
  const n = lista.children.length;
  const wrap = document.createElement('div');
  wrap.innerHTML = ingredienteRowHtml({}, n);
  const row = wrap.firstElementChild;
  lista.appendChild(row);
  row.querySelector('.receita-ing-qtd').focus();
}
function removerIngredienteCampo(btn){
  const row = btn.closest('.receita-ing-row');
  row.remove();
  document.querySelectorAll('#receitaIngredientesLista .receita-ing-num').forEach((el,i)=>{ el.textContent = i+1; });
}
function coletarIngredientes(){
  return Array.from(document.querySelectorAll('#receitaIngredientesLista .receita-ing-row')).map(row=>({
    quantidade: row.querySelector('.receita-ing-qtd').value.trim(),
    unidade: (row.querySelector('.receita-ing-un').dataset.valor||'').trim(),
    nome: row.querySelector('.receita-ing-nome').value.trim()
  })).filter(i=>i.nome || i.quantidade || i.unidade);
}

/* ---------- MODO DE PREPARO (passos) ---------- */
function passoRowHtml(txt, i){
  const v = (txt||'').replace(/"/g,'&quot;');
  return `<div class="receita-passo-row">
    <div class="receita-passo-num">${i+1}</div>
    <textarea class="receita-passo-input" rows="2" placeholder="Descreva o passo ${i+1}...">${txt||''}</textarea>
    <button type="button" class="btn-icon-sm" onclick="removerPassoCampo(this)">${ICON_TRASH}</button>
  </div>`;
}
function renderPassosCampos(valores){
  const lista = document.getElementById('receitaPassosLista');
  const vals = (valores && valores.length) ? valores : ['', ''];
  lista.innerHTML = vals.map((v,i)=>passoRowHtml(v,i)).join('');
}
function addPassoCampo(){
  const lista = document.getElementById('receitaPassosLista');
  const n = lista.children.length;
  const wrap = document.createElement('div');
  wrap.innerHTML = passoRowHtml('', n);
  const row = wrap.firstElementChild;
  lista.appendChild(row);
  row.querySelector('.receita-passo-input').focus();
}
function removerPassoCampo(btn){
  const row = btn.closest('.receita-passo-row');
  row.remove();
  document.querySelectorAll('#receitaPassosLista .receita-passo-num').forEach((el,i)=>{ el.textContent = i+1; });
}
function coletarPassos(){
  return Array.from(document.querySelectorAll('#receitaPassosLista .receita-passo-input'))
    .map(t=>t.value.trim());
}

/* ---------- ARRASTAR PRA REORDENAR (ingredientes e passos) ---------- */
function attachDragReorder(listId, rowSelector, handleSelector, numSelector){
  const list = document.getElementById(listId);
  if(!list || list.dataset.reorderAttached) return;
  list.dataset.reorderAttached = '1';
  let dragEl = null;

  list.addEventListener('pointerdown', (e)=>{
    const handle = e.target.closest(handleSelector);
    if(!handle) return;
    const row = handle.closest(rowSelector);
    if(!row) return;
    e.preventDefault();
    dragEl = row;
    row.classList.add('dragging-row');
    try{ handle.setPointerCapture(e.pointerId); }catch(err){}

    function onMove(ev){
      if(!dragEl) return;
      const rows = Array.from(list.querySelectorAll(rowSelector));
      const y = ev.clientY;
      let placed = false;
      for(const r of rows){
        if(r===dragEl) continue;
        const rect = r.getBoundingClientRect();
        const mid = rect.top + rect.height/2;
        if(y < mid){
          if(r.previousElementSibling !== dragEl) list.insertBefore(dragEl, r);
          placed = true;
          break;
        }
      }
      if(!placed && list.lastElementChild !== dragEl) list.appendChild(dragEl);
    }
    function onUp(){
      if(dragEl) dragEl.classList.remove('dragging-row');
      dragEl = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      list.querySelectorAll(rowSelector).forEach((row,i)=>{
        const numEl = row.querySelector(numSelector);
        if(numEl) numEl.textContent = i+1;
      });
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}
attachDragReorder('receitaIngredientesLista', '.receita-ing-row', '.receita-ing-num', '.receita-ing-num');
attachDragReorder('receitaPassosLista', '.receita-passo-row', '.receita-passo-num', '.receita-passo-num');

/* ---------- DIFICULDADE E COR ---------- */
function selecionarDificuldade(val){
  receitaDificuldadeSelecionada = receitaDificuldadeSelecionada===val ? '' : val;
  document.getElementById('receitaDificuldade').value = receitaDificuldadeSelecionada;
  document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>{
    el.classList.toggle('active', el.dataset.val === receitaDificuldadeSelecionada);
  });
}
function toggleReceitaFormFavorito(){
  const btn = document.getElementById('receitaFormFavBtn');
  const ativo = btn.classList.toggle('active');
  btn.querySelector('svg').setAttribute('fill', ativo ? 'currentColor' : 'none');
}

/* ---------- FORMULÁRIO (fullpage assistente) ---------- */
function openReceitaModal(id){
  document.getElementById('receitaId').value = id || '';
  document.getElementById('receitaFormTitulo').textContent = id ? 'Editar Receita' : 'Nova Receita';
  document.getElementById('receitaCatPickerPanel').style.display = 'none';
  document.getElementById('receitaCatNovaInput').value = '';
  const favBtn = document.getElementById('receitaFormFavBtn');

  if(id){
    const r = (state.receitas||[]).find(r=>r.id===id);
    if(r){
      document.getElementById('receitaNome').value = r.nome;
      document.getElementById('receitaTempo').value = r.tempo || '';
      document.getElementById('receitaPorcoes').value = r.porcoes || '';
      document.getElementById('receitaObservacoes').value = r.observacoes || '';
      receitaFotoUrlAtual = r.fotoUrl || null;
      selecionarReceitaCategoria(r.categoriaId || null);
      renderIngredientesCampos(r.ingredientes || []);
      renderPassosCampos(r.passos || []);
      receitaDificuldadeSelecionada = r.dificuldade || '';
      document.getElementById('receitaDificuldade').value = receitaDificuldadeSelecionada;
      document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>{
        el.classList.toggle('active', el.dataset.val === receitaDificuldadeSelecionada);
      });
      receitaCorSelecionada = r.cor || '';
      favBtn.classList.toggle('active', !!r.favorito);
      favBtn.querySelector('svg').setAttribute('fill', r.favorito ? 'currentColor' : 'none');
    }
  }else{
    document.getElementById('receitaNome').value = '';
    document.getElementById('receitaTempo').value = '';
    document.getElementById('receitaPorcoes').value = '';
    document.getElementById('receitaObservacoes').value = '';
    receitaFotoUrlAtual = null;
    selecionarReceitaCategoria(null);
    renderIngredientesCampos([]);
    renderPassosCampos([]);
    receitaDificuldadeSelecionada = '';
    document.getElementById('receitaDificuldade').value = '';
    document.querySelectorAll('#receitaDificuldadeChips .dif-chip').forEach(el=>el.classList.remove('active'));
    receitaCorSelecionada = '';
    favBtn.classList.remove('active');
    favBtn.querySelector('svg').setAttribute('fill', 'none');
  }
  renderReceitaFotoPreview();
  document.getElementById('pageReceitaForm').classList.add('active');
}
function closeReceitaForm(){
  document.getElementById('pageReceitaForm').classList.remove('active');
}
function salvarReceita(){
  const id = document.getElementById('receitaId').value;
  const nome = document.getElementById('receitaNome').value.trim();
  const categoriaId = document.getElementById('receitaCategoriaSelect').value || null;
  const tempo = document.getElementById('receitaTempo').value.trim();
  const porcoes = document.getElementById('receitaPorcoes').value.trim();
  const dificuldade = document.getElementById('receitaDificuldade').value || '';
  const cor = receitaCorSelecionada || '';
  const observacoes = document.getElementById('receitaObservacoes').value.trim();
  const fotoUrl = receitaFotoUrlAtual;
  const ingredientes = coletarIngredientes();
  const passos = coletarPassos();
  const favorito = document.getElementById('receitaFormFavBtn').classList.contains('active');
  if(!nome){ showToast('Digite o nome da receita'); return; }
  if(!state.receitas) state.receitas = [];
  if(id){
    const r = state.receitas.find(r=>r.id===id);
    if(r) Object.assign(r, { nome, categoriaId, tempo, porcoes, dificuldade, cor, observacoes, fotoUrl, ingredientes, passos, favorito, atualizadoEm: Date.now() });
  }else{
    state.receitas.push({ id:'rc'+Date.now(), nome, categoriaId, tempo, porcoes, dificuldade, cor, observacoes, fotoUrl, ingredientes, passos, favorito, criadoEm: Date.now(), atualizadoEm: Date.now() });
  }
  persist();
  closeReceitaForm();
  renderReceitas();
  showToast('Receita salva');
}
