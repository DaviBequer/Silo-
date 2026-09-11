/* ================= MERCADO: Lista de Compras + Estoque de Casa ================= */
const MERCADO_CATEGORIAS = ['Alimentos','Limpeza','Higiene','Bebidas','Outros'];

let mercadoEstoqueFiltroAtivo = 'Todas';
let estoqueItemAtualId = null;

function uid(prefix){ return prefix+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

function renderMercado(){
  renderPreListaView();
  renderListaComprasView();
  renderMercadoEstoqueFilterChips();
  renderEstoqueView();
}
let mercadoListaModoAtivo = 'pre';
function switchMercadoListaModo(modo){
  mercadoListaModoAtivo = modo;
  document.getElementById('btnMlPre').classList.toggle('active', modo==='pre');
  document.getElementById('btnMlAtiva').classList.toggle('active', modo==='ativa');
  document.getElementById('mercadoPreListaView').style.display = modo==='pre' ? 'block' : 'none';
  document.getElementById('mercadoListaAtivaView').style.display = modo==='ativa' ? 'block' : 'none';
  if(modo==='pre') renderPreListaView();
  if(modo==='ativa') renderListaComprasView();
}
function switchMercadoSubtab(tab){
  document.getElementById('subtabBtnMercadoLista').classList.toggle('active', tab==='lista');
  document.getElementById('subtabBtnMercadoEstoque').classList.toggle('active', tab==='estoque');
  document.getElementById('subtabBtnMercadoDashboard').classList.toggle('active', tab==='dashboard');
  document.getElementById('mercadoSubtabLista').style.display = tab==='lista' ? 'block' : 'none';
  document.getElementById('mercadoSubtabEstoque').style.display = tab==='estoque' ? 'block' : 'none';
  document.getElementById('mercadoSubtabDashboard').style.display = tab==='dashboard' ? 'block' : 'none';
  if(tab==='lista'){ renderPreListaView(); renderListaComprasView(); }
  if(tab==='estoque') renderEstoqueView();
  if(tab==='dashboard') renderMercadoDashboard();
}

/* ---------- Pré-listagem (planejamento: só quantidade + nome) ---------- */
function renderPreListaView(){
  const el = document.getElementById('mercadoPreLista');
  if(!el) return;
  const itens = (state.preListaCompras||[]).slice().sort((a,b)=>b.criadoEm-a.criadoEm);
  if(itens.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Pré-listagem vazia</div><div class="desc">Anote o que vai precisar comprar</div></div>`;
    return;
  }
  el.innerHTML = itens.map(it=>`<div class="mercado-item" style="cursor:default">
    <div class="mercado-item-info">
      <div class="mercado-item-nome">${it.nome}</div>
      <div class="mercado-item-meta">Planejado</div>
    </div>
    <div class="mercado-item-qtd">${it.quantidade}${it.unidade||''}</div>
    <button type="button" class="mkt-item-mover" onclick="moverItemPreLista('${it.id}')">Mover pra lista</button>
    <button class="mercado-item-del" onclick="excluirItemPreLista('${it.id}')">✕</button>
  </div>`).join('');
}
function adicionarItemPreLista(){
  const nomeInput = document.getElementById('mpNome');
  const nome = nomeInput.value.trim();
  if(!nome) return;
  const qtd = parseFloat(document.getElementById('mpQuantidade').value) || 1;
  state.preListaCompras.push({ id: uid('mp'), nome, quantidade:qtd, unidade:'unidades', criadoEm: Date.now() });
  document.getElementById('mpQuantidade').value = '';
  nomeInput.value = '';
  document.getElementById('mpQuantidade').focus();
  persist();
  renderPreListaView();
}
function excluirItemPreLista(id){
  state.preListaCompras = state.preListaCompras.filter(it=>it.id!==id);
  persist();
  renderPreListaView();
}
function moverItemPreLista(id){
  const it = state.preListaCompras.find(x=>x.id===id);
  if(!it) return;
  state.listaCompras.push({ id: uid('mc'), nome: it.nome, quantidade: it.quantidade, unidade: it.unidade||'unidades', valor:0, pego:false, criadoEm: Date.now() });
  state.preListaCompras = state.preListaCompras.filter(x=>x.id!==id);
  persist();
  renderPreListaView();
  renderListaComprasView();
  switchMercadoListaModo('ativa');
}

/* ---------- Lista de Compras ativa (quantidade + nome + valor, com totais) ---------- */
const ICON_CART_SMALL = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
function encontrarEstoquePorNome(nome){
  const alvo = (nome||'').trim().toLowerCase();
  return state.estoque.find(e=>e.nome.trim().toLowerCase()===alvo);
}
function renderListaComprasView(){
  const el = document.getElementById('mercadoListaCompras');
  if(!el) return;
  const autoItens = state.estoque.filter(e=> e.quantidadeAtual < e.quantidadeMinima);
  const manualItens = state.listaCompras.slice().sort((a,b)=>b.criadoEm-a.criadoEm);

  let totalItens = 0, totalValor = 0;
  manualItens.forEach(it=>{ totalItens++; totalValor += (it.valor||0) * (it.quantidade||0); });
  document.getElementById('mlHeaderItens').textContent = totalItens;
  document.getElementById('mlHeaderTotal').textContent = totalValor.toFixed(2).replace('.',',');
  document.getElementById('btnFinalizarListaAtiva').style.display = manualItens.length>0 ? 'block' : 'none';

  if(autoItens.length===0 && manualItens.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Lista vazia</div><div class="desc">Adicione um item ou espere o estoque acabar</div></div>`;
    return;
  }

  let html = '';
  autoItens.forEach(e=>{
    html += `<div class="mercado-item" onclick="abrirFinalizarCompra('${e.id}')">
      <div class="mercado-check pending">${ICON_CART_SMALL}</div>
      <div class="mercado-item-info">
        <div class="mercado-item-nome">${e.nome}<span class="mercado-badge-auto">Pendente</span></div>
        <div class="mercado-item-meta">${e.categoria} · tem ${e.quantidadeAtual}${e.unidade}, mínimo ${e.quantidadeMinima}${e.unidade}</div>
      </div>
      <div class="mercado-item-qtd">+${e.quantidadeReposicao||e.quantidadeMinima}${e.unidade}</div>
    </div>`;
  });
  manualItens.forEach(it=>{
    const subtotal = (it.valor||0) * (it.quantidade||0);
    html += `<div class="mercado-item ${it.pego?'carrinho':''}"
      onpointerdown="mlItemTapStart(event,'${it.id}')" onpointerup="mlItemTapEnd(event,'${it.id}')" onpointercancel="mlItemTapCancel()" onpointerleave="mlItemTapCancel()">
      <div class="mercado-check${it.pego?' checked':''}">${it.pego?ICON_CHECK:''}</div>
      <div class="mercado-item-info">
        <div class="mercado-item-nome">${it.nome}</div>
        <div class="mercado-item-meta">${it.quantidade}${it.unidade} · R$ ${(it.valor||0).toFixed(2).replace('.',',')} un. · subtotal R$ ${subtotal.toFixed(2).replace('.',',')}</div>
      </div>
      <button class="mercado-item-del" onclick="event.stopPropagation();excluirItemManual('${it.id}')">✕</button>
    </div>`;
  });
  el.innerHTML = html;
}
function adicionarItemListaAtiva(){
  const nomeInput = document.getElementById('mlNome');
  const nome = nomeInput.value.trim();
  if(!nome) return;
  const qtd = parseFloat(document.getElementById('mlQuantidade').value) || 1;
  const valor = parseMoney(document.getElementById('mlValor').value);
  state.listaCompras.push({ id: uid('mc'), nome, quantidade:qtd, unidade:'unidades', valor, pego:false, criadoEm: Date.now() });
  document.getElementById('mlQuantidade').value = '';
  nomeInput.value = '';
  document.getElementById('mlValor').value = '';
  document.getElementById('mlQuantidade').focus();
  persist();
  renderListaComprasView();
}
function excluirItemManual(id){
  state.listaCompras = state.listaCompras.filter(it=>it.id!==id);
  persist();
  renderListaComprasView();
}
let mlItemTapTimer = null;
let mlItemTapLongFired = false;
function mlItemTapStart(ev, id){
  if(ev.pointerType==='mouse' && ev.button!==0) return;
  mlItemTapLongFired = false;
  mlItemTapTimer = setTimeout(()=>{
    mlItemTapLongFired = true;
    if(navigator.vibrate) navigator.vibrate(12);
    abrirEditarItemLista(id);
  }, 500);
}
function mlItemTapEnd(ev, id){
  clearTimeout(mlItemTapTimer);
  if(!mlItemTapLongFired) toggleItemListaPego(id);
}
function mlItemTapCancel(){
  clearTimeout(mlItemTapTimer);
}
let editandoItemListaId = null;
function abrirEditarItemLista(id){
  const it = state.listaCompras.find(x=>x.id===id);
  if(!it) return;
  editandoItemListaId = id;
  document.getElementById('mlEditNome').value = it.nome;
  document.getElementById('mlEditQuantidade').value = it.quantidade;
  document.getElementById('mlEditValor').value = (it.valor||0).toFixed(2).replace('.',',');
  document.getElementById('modalEditarItemLista').classList.add('active');
}
function salvarEdicaoItemLista(){
  const it = state.listaCompras.find(x=>x.id===editandoItemListaId);
  if(!it) return;
  const nome = document.getElementById('mlEditNome').value.trim();
  if(!nome) return;
  it.nome = nome;
  it.quantidade = parseFloat(document.getElementById('mlEditQuantidade').value) || 1;
  it.valor = parseMoney(document.getElementById('mlEditValor').value);
  persist();
  closeModal('modalEditarItemLista');
  editandoItemListaId = null;
  renderListaComprasView();
}
function toggleItemListaPego(id){
  const it = state.listaCompras.find(x=>x.id===id);
  if(!it) return;
  it.pego = !it.pego;
  persist();
  renderListaComprasView();
  if(navigator.vibrate) navigator.vibrate(10);
}
function calcularGastoMercadoMes(ano, mes){
  let total = 0;
  state.estoque.forEach(e=>{
    (e.historicoCompras||[]).forEach(h=>{
      if(!h.valorUnitario) return;
      const d = new Date(h.data);
      if(d.getFullYear()===ano && d.getMonth()===mes) total += h.valorUnitario * h.quantidadeComprada;
    });
  });
  return total;
}
let loteCategorias = {};
function finalizarListaAtiva(){
  const itens = state.listaCompras.slice();
  if(itens.length===0) return;
  loteCategorias = {};
  const novos = itens.filter(it=>!encontrarEstoquePorNome(it.nome));
  novos.forEach(it=>{ loteCategorias[it.id] = 'Alimentos'; });
  renderLoteCategorizacao();
  document.getElementById('loteDataCompra').value = new Date().toISOString().slice(0,10);
  document.getElementById('modalFinalizarLote').classList.add('active');
}
function renderLoteCategorizacao(){
  const wrap = document.getElementById('loteCategoriasWrap');
  const novos = state.listaCompras.filter(it=>!encontrarEstoquePorNome(it.nome));
  if(novos.length===0){
    wrap.innerHTML = '<p class="empty-hint">Todos os itens já existem no estoque — nenhuma categoria nova pra escolher.</p>';
    return;
  }
  wrap.innerHTML = `<div class="lv-hint">Esses itens são novos — escolha a categoria de cada um:</div>` + novos.map(it=>`
    <div class="field full">
      <label>${it.nome}</label>
      <div class="dificuldade-chips">
        ${MERCADO_CATEGORIAS.map(c=>`<button type="button" class="dif-chip${loteCategorias[it.id]===c?' active':''}" onclick="selecionarLoteCategoria('${it.id}','${c}')">${c}</button>`).join('')}
      </div>
    </div>
  `).join('');
}
function selecionarLoteCategoria(itemId, cat){
  loteCategorias[itemId] = cat;
  renderLoteCategorizacao();
}
function confirmarFinalizarLote(){
  const itens = state.listaCompras.slice();
  if(itens.length===0){ closeModal('modalFinalizarLote'); return; }
  const dataStr = document.getElementById('loteDataCompra').value;
  const agora = dataStr ? new Date(dataStr+'T12:00:00').getTime() : Date.now();
  let totalGasto = 0;
  itens.forEach(it=>{
    totalGasto += (it.valor||0) * (it.quantidade||0);
    let e = encontrarEstoquePorNome(it.nome);
    if(!e){
      const categoria = loteCategorias[it.id] || 'Outros';
      e = { id: uid('est'), nome: it.nome, categoria, quantidadeAtual:0, unidade: it.unidade||'unidades', quantidadeMinima:0, quantidadeReposicao: it.quantidade||1, precos:[], historicoCompras:[], criadoEm: agora };
      state.estoque.push(e);
    }
    if(!e.precos) e.precos = [];
    if(!e.historicoCompras) e.historicoCompras = [];
    if(it.valor>0) e.precos.push({ valor: it.valor, data: agora });
    let diasDesdeUltima = null;
    if(e.historicoCompras.length>0){
      diasDesdeUltima = Math.round((agora - e.historicoCompras[e.historicoCompras.length-1].data)/86400000);
    }
    e.historicoCompras.push({ data: agora, quantidadeComprada: it.quantidade, valorUnitario: it.valor>0?it.valor:null, saldoAntesCorrigido: e.quantidadeAtual, zerou: e.quantidadeAtual<=0, diasDesdeUltima });
    e.quantidadeAtual = Math.round((e.quantidadeAtual + (it.quantidade||0))*100)/100;
  });
  const totalItens = itens.length;
  state.listaCompras = [];
  persist();
  closeModal('modalFinalizarLote');
  renderListaComprasView();
  renderEstoqueView();
  mostrarResumoCompra(totalItens, totalGasto);
}
function mostrarResumoCompra(totalItens, totalGasto){
  const agora = new Date();
  const gastoMesAtual = calcularGastoMercadoMes(agora.getFullYear(), agora.getMonth());
  const mesAnt = new Date(agora.getFullYear(), agora.getMonth()-1, 1);
  const gastoMesAnterior = calcularGastoMercadoMes(mesAnt.getFullYear(), mesAnt.getMonth());
  let linha = 'Ainda não há gasto registrado no mês anterior pra comparar.';
  if(gastoMesAnterior>0){
    const diff = gastoMesAtual - gastoMesAnterior;
    if(Math.abs(diff)<0.01) linha = 'Gasto igual ao mês passado até agora.';
    else if(diff>0) linha = `▲ Você está gastando R$ ${diff.toFixed(2).replace('.',',')} a mais que no mês passado (até agora).`;
    else linha = `▼ Você está economizando R$ ${Math.abs(diff).toFixed(2).replace('.',',')} em relação ao mês passado (até agora).`;
  }
  document.getElementById('resumoCompraValor').textContent = 'R$ '+totalGasto.toFixed(2).replace('.',',');
  document.getElementById('resumoCompraItens').textContent = `${totalItens} ite${totalItens===1?'m':'ns'} registrado${totalItens===1?'':'s'}`;
  document.getElementById('resumoCompraComparacao').textContent = linha;
  document.getElementById('modalResumoCompra').classList.add('active');
}

/* ---------- Finalizar Compra (dá entrada no estoque + registra e compara preço) ---------- */
let fcEstoqueId = null;
let fcManualItemId = null;
function abrirFinalizarCompra(estoqueId, manualItemId){
  const e = state.estoque.find(x=>x.id===estoqueId);
  if(!e) return;
  fcEstoqueId = estoqueId;
  fcManualItemId = manualItemId || null;
  document.getElementById('fcItemNome').textContent = e.nome;
  document.getElementById('fcSaldoAtual').value = e.quantidadeAtual;
  document.getElementById('fcQuantidade').value = e.quantidadeReposicao || e.quantidadeMinima || 1;
  document.getElementById('fcUnidade').textContent = e.unidade;
  document.getElementById('fcValor').value = '';
  document.getElementById('fcDataCompra').value = new Date().toISOString().slice(0,10);
  document.getElementById('fcComparacao').style.display = 'none';
  document.getElementById('modalFinalizarCompra').classList.add('active');
}
function zerarSaldoFinalizar(){
  document.getElementById('fcSaldoAtual').value = 0;
}
function atualizarComparacaoPreco(){
  const e = state.estoque.find(x=>x.id===fcEstoqueId);
  const el = document.getElementById('fcComparacao');
  if(!e || !e.precos || e.precos.length===0){ el.style.display='none'; return; }
  const novoValor = parseFloat(document.getElementById('fcValor').value);
  if(isNaN(novoValor)){ el.style.display='none'; return; }
  const anterior = e.precos[e.precos.length-1].valor;
  const diff = novoValor - anterior;
  const pct = anterior>0 ? (diff/anterior*100) : 0;
  let linha;
  if(Math.abs(diff) < 0.005){
    linha = `Igual ao preço anterior (R$ ${anterior.toFixed(2).replace('.',',')})`;
  }else if(diff > 0){
    linha = `▲ Subiu R$ ${diff.toFixed(2).replace('.',',')} (${pct.toFixed(0)}%) — antes R$ ${anterior.toFixed(2).replace('.',',')}`;
  }else{
    linha = `▼ Desceu R$ ${Math.abs(diff).toFixed(2).replace('.',',')} (${Math.abs(pct).toFixed(0)}%) — antes R$ ${anterior.toFixed(2).replace('.',',')}`;
  }
  el.textContent = linha;
  el.style.display = 'block';
}
function confirmarFinalizarCompra(){
  const e = state.estoque.find(x=>x.id===fcEstoqueId);
  if(!e) return;
  const saldoAtualCorrigido = Math.max(0, parseFloat(document.getElementById('fcSaldoAtual').value) || 0);
  const qtd = parseFloat(document.getElementById('fcQuantidade').value) || 0;
  const valor = parseFloat(document.getElementById('fcValor').value);
  const dataStr = document.getElementById('fcDataCompra').value;
  const agora = dataStr ? new Date(dataStr+'T12:00:00').getTime() : Date.now();
  if(!e.precos) e.precos = [];
  if(!isNaN(valor) && valor>0) e.precos.push({ valor, data: agora });

  if(!e.historicoCompras) e.historicoCompras = [];
  let diasDesdeUltima = null;
  if(e.historicoCompras.length>0){
    const ultima = e.historicoCompras[e.historicoCompras.length-1];
    diasDesdeUltima = Math.round((agora - ultima.data)/86400000);
  }
  e.historicoCompras.push({
    data: agora,
    quantidadeComprada: qtd,
    valorUnitario: (!isNaN(valor) && valor>0) ? valor : null,
    saldoAntesCorrigido: saldoAtualCorrigido,
    zerou: saldoAtualCorrigido<=0,
    diasDesdeUltima
  });

  e.quantidadeAtual = Math.round((saldoAtualCorrigido + qtd)*100)/100;
  if(fcManualItemId) state.listaCompras = state.listaCompras.filter(it=>it.id!==fcManualItemId);
  persist();
  closeModal('modalFinalizarCompra');
  fcEstoqueId = null; fcManualItemId = null;
  renderListaComprasView();
  renderEstoqueView();
}

/* ---------- Estoque de Casa ---------- */
function renderMercadoEstoqueFilterChips(){
  const chips = ['Todas', ...MERCADO_CATEGORIAS];
  document.getElementById('mercadoEstoqueFilterChips').innerHTML = chips.map(c=>
    `<button class="filter-chip${mercadoEstoqueFiltroAtivo===c?' active':''}" onclick="setMercadoEstoqueFiltro('${c}')">${c}</button>`
  ).join('');
}
function setMercadoEstoqueFiltro(c){
  mercadoEstoqueFiltroAtivo = c;
  renderMercadoEstoqueFilterChips();
  renderEstoqueView();
}
function renderEstoqueView(){
  const el = document.getElementById('mercadoEstoqueLista');
  let items = state.estoque.slice();
  if(mercadoEstoqueFiltroAtivo !== 'Todas') items = items.filter(e=>e.categoria===mercadoEstoqueFiltroAtivo);
  items.sort((a,b)=> a.nome.localeCompare(b.nome));
  if(items.length===0){
    el.innerHTML = `<div class="empty-state"><div class="title">Nenhum item no estoque</div><div class="desc">Toque no + para adicionar</div></div>`;
    return;
  }
  el.innerHTML = items.map(e=>{
    const abaixo = e.quantidadeAtual < e.quantidadeMinima;
    const ultimoPreco = (e.precos && e.precos.length) ? e.precos[e.precos.length-1].valor : null;
    return `<div class="mercado-item ${abaixo?'repor':''}">
      <div class="mercado-item-info" onclick="abrirEstoqueForm('${e.id}')">
        <div class="mercado-item-nome">${e.nome}${abaixo?'<span class="mercado-badge-auto">Repor</span>':''}</div>
        <div class="mercado-item-meta">${e.categoria} · mínimo ${e.quantidadeMinima}${e.unidade}${ultimoPreco!==null?` · R$ ${ultimoPreco.toFixed(2).replace('.',',')}/${e.unidade}`:''}</div>
      </div>
      <div class="mercado-item-stepper">
        <button onclick="ajustarEstoqueQtdRapido('${e.id}', -1)">−</button>
        <span>${e.quantidadeAtual}${e.unidade}</span>
        <button onclick="ajustarEstoqueQtdRapido('${e.id}', 1)">+</button>
      </div>
    </div>`;
  }).join('');
}
function ajustarEstoqueQtdRapido(id, delta){
  const e = state.estoque.find(x=>x.id===id);
  if(!e) return;
  e.quantidadeAtual = Math.max(0, Math.round((e.quantidadeAtual + delta)*100)/100);
  persist();
  renderEstoqueView();
  renderListaComprasView();
}
function abrirEstoqueForm(id){
  estoqueItemAtualId = id;
  const e = id ? state.estoque.find(x=>x.id===id) : null;
  document.getElementById('modalEstoqueItemTitulo').textContent = e ? 'Editar item' : 'Novo item';
  document.getElementById('estItemNome').value = e ? e.nome : '';
  document.getElementById('estItemQtdAtual').value = e ? e.quantidadeAtual : '';
  document.getElementById('estItemQtdMinima').value = e ? e.quantidadeMinima : '';
  document.getElementById('estItemQtdReposicao').value = e ? (e.quantidadeReposicao||'') : '';
  document.getElementById('btnExcluirEstoqueItem').style.display = e ? 'block' : 'none';
  document.getElementById('btnVerHistoricoItem').style.display = (e && e.historicoCompras && e.historicoCompras.length>0) ? 'block' : 'none';
  const temPreco = e && e.precos && e.precos.length>0;
  document.getElementById('estItemPrecoInicialWrap').style.display = temPreco ? 'none' : 'block';
  document.getElementById('estItemPrecoInicial').value = '';
  document.getElementById('estItemPrecoAtualWrap').style.display = temPreco ? 'block' : 'none';
  if(temPreco){
    const ultimo = e.precos[e.precos.length-1];
    const dataStr = new Date(ultimo.data).toLocaleDateString('pt-BR');
    document.getElementById('estItemPrecoAtualValor').textContent = `R$ ${ultimo.valor.toFixed(2).replace('.',',')} em ${dataStr}`;
  }
  window.estFormCategoriaSelecionada = e ? e.categoria : 'Alimentos';
  window.estFormUnidadeSelecionada = e ? e.unidade : 'un';
  renderEstFormCategoriaChips();
  renderEstFormUnidadeChips();
  document.getElementById('modalEstoqueItem').classList.add('active');
}
function renderEstFormCategoriaChips(){
  document.getElementById('estItemCategoriaChips').innerHTML = MERCADO_CATEGORIAS.map(c=>
    `<button type="button" class="dif-chip${window.estFormCategoriaSelecionada===c?' active':''}" onclick="selecionarEstFormCategoria('${c}')">${c}</button>`
  ).join('');
}
function selecionarEstFormCategoria(c){
  window.estFormCategoriaSelecionada = c;
  renderEstFormCategoriaChips();
}
function renderEstFormUnidadeChips(){
  document.getElementById('estItemUnidadeChips').innerHTML = UNIDADES_MEDIDA.map(u=>
    `<button type="button" class="dif-chip${window.estFormUnidadeSelecionada===u?' active':''}" onclick="selecionarEstFormUnidade('${u}')">${u}</button>`
  ).join('');
}
function selecionarEstFormUnidade(u){
  window.estFormUnidadeSelecionada = u;
  renderEstFormUnidadeChips();
}
function salvarEstoqueItem(){
  const nome = document.getElementById('estItemNome').value.trim();
  if(!nome){ document.getElementById('estItemNome').focus(); return; }
  const qtdAtual = parseFloat(document.getElementById('estItemQtdAtual').value) || 0;
  const unidade = window.estFormUnidadeSelecionada || 'un';
  const qtdMinima = parseFloat(document.getElementById('estItemQtdMinima').value) || 0;
  const qtdReposicao = parseFloat(document.getElementById('estItemQtdReposicao').value) || qtdMinima;
  const precoInicial = parseFloat(document.getElementById('estItemPrecoInicial').value);
  if(estoqueItemAtualId){
    const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
    e.nome = nome; e.categoria = window.estFormCategoriaSelecionada; e.quantidadeAtual = qtdAtual;
    e.unidade = unidade; e.quantidadeMinima = qtdMinima; e.quantidadeReposicao = qtdReposicao;
    if(!e.precos) e.precos = [];
    if((!e.precos || e.precos.length===0) && !isNaN(precoInicial) && precoInicial>0){
      e.precos.push({ valor: precoInicial, data: Date.now() });
    }
  }else{
    const precos = (!isNaN(precoInicial) && precoInicial>0) ? [{ valor: precoInicial, data: Date.now() }] : [];
    state.estoque.push({ id: uid('est'), nome, categoria: window.estFormCategoriaSelecionada, quantidadeAtual: qtdAtual, unidade, quantidadeMinima: qtdMinima, quantidadeReposicao: qtdReposicao, precos, historicoCompras:[], criadoEm: Date.now() });
  }
  persist();
  closeModal('modalEstoqueItem');
  renderEstoqueView();
  renderListaComprasView();
}
function excluirEstoqueItemAtual(){
  if(!estoqueItemAtualId) return;
  const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
  iosConfirm(`Excluir "${e?.nome||'este item'}"?`).then(ok=>{
    if(!ok) return;
    state.estoque = state.estoque.filter(x=>x.id!==estoqueItemAtualId);
    persist();
    closeModal('modalEstoqueItem');
    renderEstoqueView();
    renderListaComprasView();
  });
}

/* ---------- Histórico de compras (por item) ---------- */
function abrirHistoricoItem(){
  const e = state.estoque.find(x=>x.id===estoqueItemAtualId);
  if(!e) return;
  document.getElementById('histItemTitulo').textContent = `Histórico — ${e.nome}`;
  const hist = (e.historicoCompras||[]).slice().reverse();
  document.getElementById('histItemLista').innerHTML = hist.map(h=>{
    const dataStr = new Date(h.data).toLocaleDateString('pt-BR');
    const diasStr = h.diasDesdeUltima!==null ? `${h.diasDesdeUltima} dia${h.diasDesdeUltima===1?'':'s'} desde a compra anterior${h.zerou?' · zerou antes de repor':''}` : 'Primeira compra registrada';
    const valorStr = h.valorUnitario!==null ? `R$ ${h.valorUnitario.toFixed(2).replace('.',',')}` : '—';
    return `<div class="mkt-hist-item">
      <div>
        <div class="mkt-hist-data">${dataStr} · +${h.quantidadeComprada}${e.unidade}</div>
        <div class="mkt-hist-dias">${diasStr}</div>
      </div>
      <div class="mkt-hist-valor">${valorStr}</div>
    </div>`;
  }).join('') || '<p class="empty-hint">Sem compras registradas ainda.</p>';
  document.getElementById('modalHistoricoItem').classList.add('active');
}

/* ---------- Dashboard ---------- */
function renderMercadoDashboard(){
  const agora = new Date();
  const mesAtual = agora.getMonth(), anoAtual = agora.getFullYear();

  let gastoMes = 0;
  const gastoPorCategoria = {};
  state.estoque.forEach(e=>{
    (e.historicoCompras||[]).forEach(h=>{
      const d = new Date(h.data);
      if(d.getMonth()===mesAtual && d.getFullYear()===anoAtual && h.valorUnitario){
        const total = h.valorUnitario * h.quantidadeComprada;
        gastoMes += total;
        gastoPorCategoria[e.categoria] = (gastoPorCategoria[e.categoria]||0) + total;
      }
    });
  });
  document.getElementById('mktGastoMes').textContent = 'R$ '+gastoMes.toFixed(2).replace('.',',');

  const itensFalta = state.estoque.filter(e=>e.quantidadeAtual < e.quantidadeMinima).length;
  document.getElementById('mktItensFalta').textContent = itensFalta;

  const ranking = state.estoque
    .map(e=>{
      const dias = (e.historicoCompras||[]).map(h=>h.diasDesdeUltima).filter(d=>d!==null && d>0);
      if(dias.length===0) return null;
      const media = dias.reduce((a,b)=>a+b,0)/dias.length;
      return { nome:e.nome, media };
    })
    .filter(Boolean)
    .sort((a,b)=>a.media-b.media)
    .slice(0,5);
  const rankEl = document.getElementById('mktRankingGiro');
  rankEl.innerHTML = ranking.length ? ranking.map(r=>
    `<div class="mkt-rank-item"><span class="mkt-rank-nome">${r.nome}</span><span class="mkt-rank-valor">${r.media.toFixed(0)} dias</span></div>`
  ).join('') : '<p class="empty-hint">Ainda sem dados suficientes — finalize compras mais de uma vez pra ver o giro.</p>';

  const catEl = document.getElementById('mktGastoCategoria');
  const categoriasComGasto = Object.entries(gastoPorCategoria).sort((a,b)=>b[1]-a[1]);
  const maiorGasto = categoriasComGasto.length ? categoriasComGasto[0][1] : 0;
  catEl.innerHTML = categoriasComGasto.length ? categoriasComGasto.map(([cat,valor])=>{
    const pct = maiorGasto>0 ? (valor/maiorGasto*100) : 0;
    return `<div class="mkt-cat-bar-row">
      <div class="mkt-cat-bar-head"><span>${cat}</span><span>R$ ${valor.toFixed(2).replace('.',',')}</span></div>
      <div class="mkt-cat-bar-track"><div class="mkt-cat-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') : '<p class="empty-hint">Nenhuma compra finalizada este mês ainda.</p>';
}

setInterval(()=>{
  const abaPonto = document.getElementById('aba-ponto');
  if(abaPonto && abaPonto.classList.contains('active')) renderPonto();
}, 60000);

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.error('Erro ao registrar service worker', e));
  });
}

/* ================= IMPORTAR / EXPORTAR TODOS OS DADOS ================= */
function abrirImportExportModal(){
  document.getElementById('modalImportExport').classList.add('active');
}
function exportarDadosApp(){
  const versaoEl = document.querySelector('.header-version');
  const backup = {
    app: 'Siloe',
    versaoApp: versaoEl ? versaoEl.textContent.trim() : '',
    exportadoEm: new Date().toISOString(),
    mesAtual: mesAtualRef,
    logo: localStorage.getItem('siloe-logo') || null,
    state: state
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dataStr = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `siloe-backup-${dataStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeModal('modalImportExport');
  showToast('Backup exportado');
}
function triggerImportarDados(){
  document.getElementById('importFileInput').click();
}
function onImportFileSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    let backup;
    try{
      backup = JSON.parse(e.target.result);
    }catch(err){
      showToast('Não foi possível ler esse arquivo.');
      event.target.value = '';
      return;
    }
    if(!backup || typeof backup !== 'object' || !backup.state){
      showToast('Esse arquivo não é um backup válido do Siloé.');
      event.target.value = '';
      return;
    }
    iosConfirm('Importar vai substituir TODOS os dados atuais do app por esse backup. Continuar?').then(ok=>{
      event.target.value = '';
      if(!ok) return;
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.state));
        if(backup.mesAtual) localStorage.setItem(MES_ATUAL_KEY, backup.mesAtual);
        if(backup.logo) localStorage.setItem('siloe-logo', backup.logo);
        location.reload();
      }catch(err){
        showToast('Erro ao importar os dados.');
      }
    });
  };
  reader.readAsText(file);
}

/* ================= INIT (deve rodar por último, depois de todos os módulos) ================= */
carregar();
aplicarLogoSalva();
