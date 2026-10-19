/* ================= FATURA FECHADA EM PDF: confere com o que está lançado no app =================
   No cartão (ícone de documento): escolhe o PDF da fatura → a IA lê vencimento, total e cada lançamento →
   o app casa cada linha com o que já está lançado naquele mês (parcelas, à vista e assinaturas, pelo valor) e mostra:
   ✓ conferidos · o que falta no app (marcados para adicionar) · o que está no app e não veio na fatura · a diferença.
   "Adicionar" cria as compras que faltam (parcela "3/10" vira compra parcelada; o resto, à vista com categoria)
   e, se ainda sobrar diferença, um "Ajuste de fatura". Precisa da chave da IA (Dados do App). */
const FPDF_ESQUEMA = {
  type:'object',
  properties:{
    vencimento:{ type:'string', description:'Data de vencimento AAAA-MM-DD (ou vazio)' },
    total:{ type:'number', description:'Total da fatura em reais' },
    itens:{ type:'array', items:{ type:'object', properties:{
      data:{ type:'string', description:'DD/MM da compra' },
      descricao:{ type:'string', description:'Estabelecimento/descrição curta, como está na fatura' },
      valor:{ type:'number', description:'Valor em reais desta fatura (positivo; estornos/créditos negativos)' },
      parcela:{ type:'string', description:'"3/10" se for parcelada, senão vazio' }
    }, required:['data','descricao','valor','parcela'] } }
  },
  required:['vencimento','total','itens']
};
let fpdf = null;

function fpdfEscolher(cartaoId){
  if(typeof lviChaveIA !== 'function' || !lviChaveIA()){ showToast('Precisa da chave da IA (Dados do App → Recursos)'); return; }
  const inp = document.getElementById('fpdfArquivo');
  inp.dataset.cartao = cartaoId; inp.value = '';
  inp.click();
}
async function fpdfArquivoEscolhido(ev){
  const file = ev.target.files[0], cartaoId = ev.target.dataset.cartao; ev.target.value = '';
  const cartao = (state.cartoesTracker||[]).find(c=>c.id === cartaoId);
  if(!file || !cartao) return;
  fpdf = { cartaoId, itens: [], total: 0, mKey: faturaAbertaMes(cartao) };
  document.getElementById('fpdfTitulo').textContent = 'Fatura · ' + cartao.nome;
  document.getElementById('fpdfConteudo').innerHTML = `<div class="voz-carregando" id="fpdfStatus">Lendo a fatura com IA…</div>`;
  document.getElementById('fpdfAcoes').style.display = 'none';
  document.getElementById('modalFaturaPdf').classList.add('active');
  try{
    const b64 = await lviArquivoBase64(file);
    const j = await lviPerguntarIA([
      { type:'document', data: b64, mime_type:'application/pdf' },
      { type:'text', text: 'Esta é a fatura fechada de um cartão de crédito brasileiro. Extraia o vencimento, o total a pagar e TODOS os lançamentos desta fatura (compras, parcelas, assinaturas, tarifas, juros, estornos). Não inclua pagamentos da fatura anterior nem limites. Valores em reais.' }
    ], t=>{ const s = document.getElementById('fpdfStatus'); if(s) s.textContent = t; }, FPDF_ESQUEMA);
    fpdf.total = Math.round((Number(j.total)||0)*100)/100;
    fpdf.itens = (j.itens||[]).filter(i=>Number(i.valor)).map((i, n)=>({ n, data: i.data || '', descricao: String(i.descricao||'').trim() || 'Lançamento', valor: Math.round(Number(i.valor)*100)/100, parcela: String(i.parcela||'').trim() }));
    /* mês da fatura pelo vencimento (fatura M vence no mês M, ou no seguinte se o vencimento é antes do fechamento) */
    if(/^\d{4}-\d{2}-\d{2}$/.test(j.vencimento||'')){
      let m = j.vencimento.slice(0, 7);
      if((parseInt(cartao.vencimento)||0) <= (parseInt(cartao.fechamento)||0)) m = addMonths(m, -1);
      fpdf.mKey = m;
    }
    fpdfConferir();
  }catch(e){
    document.getElementById('fpdfConteudo').innerHTML = `<div class="drive-linha erro">Não consegui ler a fatura: ${lvEsc(String(e && e.message || e))}</div>`;
  }
}
/* o que o app tem lançado na fatura do mês: parcelas, à vista e assinaturas, cada um com o valor do mês */
function fpdfItensDoApp(cartao, mKey){
  const out = [];
  (state.comprasTracker||[]).filter(cp=>cp.cartaoId === cartao.id).forEach(cp=>{ const v = compraTrackerValorNoMes(cp, mKey); if(v > 0.004) out.push({ tipo:'parcela', nome: cp.nome, valor: v }); });
  (cartao.credoVista||[]).filter(cv=>cv.mKey === mKey).forEach(cv=>out.push({ tipo: cv.ajuste ? 'ajuste' : 'vista', nome: cv.descricao, valor: Number(cv.valor)||0 }));
  (cartao.assinaturas||[]).forEach(a=>{ const v = assinaturaValorNoMes(a, mKey); if(v > 0.004) out.push({ tipo:'assinatura', nome: a.nome, valor: v }); });
  return out.map(x=>({ ...x, valor: Math.round(x.valor*100)/100 }));
}
function fpdfConferir(){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id === fpdf.cartaoId);
  const app = fpdfItensDoApp(cartao, fpdf.mKey).filter(x=>x.tipo !== 'ajuste');
  const usados = new Set();
  fpdf.itens.forEach(it=>{
    const k = app.findIndex((a, i)=>!usados.has(i) && Math.abs(a.valor - it.valor) < 0.015);
    if(k >= 0){ usados.add(k); it.casou = app[k].nome; it.add = false; }
    else { it.casou = ''; it.add = it.valor > 0; it.categoria = it.categoria || (typeof vozAdivinharCategoria === 'function' ? vozAdivinharCategoria(it.descricao) : 'Outros'); }
  });
  fpdf.soApp = app.filter((a, i)=>!usados.has(i));
  fpdfRender();
}
function fpdfMudarMes(d){ fpdf.mKey = addMonths(fpdf.mKey, d); fpdfConferir(); }
function fpdfRender(){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id === fpdf.cartaoId);
  const noApp = Math.round(faturaCartaoNoMes(cartao, fpdf.mKey)*100)/100;
  const dif = Math.round((fpdf.total - noApp)*100)/100;
  const faltam = fpdf.itens.filter(i=>!i.casou), ok = fpdf.itens.filter(i=>i.casou);
  const linha = (i, comCheck)=>`
    <div class="fpdf-item${i.casou ? ' ok' : ''}">
      ${comCheck ? `<input type="checkbox" ${i.add ? 'checked' : ''} onchange="fpdf.itens[${i.n}].add=this.checked;fpdfRenderTotal()" aria-label="Adicionar">` : `<span class="fpdf-ok">✓</span>`}
      <div class="fpdf-info"><b>${lvEsc(i.descricao)}</b><small>${lvEsc(i.data)}${i.parcela ? ' · parcela ' + lvEsc(i.parcela) : ''}${i.casou ? ' · ' + lvEsc(i.casou) : ''}</small></div>
      <span class="fpdf-valor${i.valor < 0 ? ' pos' : ''}">${fmtMoney(i.valor)}</span>
    </div>`;
  document.getElementById('fpdfConteudo').innerHTML = `
    <div class="pano-nav fpdf-mes"><button class="pano-nav-btn" onclick="fpdfMudarMes(-1)"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.4 6 14 4.6 6.6 12l7.4 7.4 1.4-1.4-6-6z"/></svg></button><div class="pano-nav-label">Fatura de ${monthLabelLong(fpdf.mKey)}</div><button class="pano-nav-btn" onclick="fpdfMudarMes(1)"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.6 18 10 19.4l7.4-7.4L10 4.6 8.6 6l6 6z"/></svg></button></div>
    <div class="fpdf-resumo">
      <div><span>Fatura do banco</span><b>${fmtMoney(fpdf.total)}</b></div>
      <div><span>Lançado no app</span><b>${fmtMoney(noApp)}</b></div>
      <div class="${Math.abs(dif) < 0.01 ? 'igual' : 'dif'}"><span>Diferença</span><b>${Math.abs(dif) < 0.01 ? 'bateu ✓' : fmtMoneySigned(dif)}</b></div>
    </div>
    ${faltam.length ? `<div class="lm-sec-titulo"><span>Faltam no app</span><small>marcados entram ao confirmar</small></div><div class="fpdf-lista">${faltam.map(i=>linha(i, true)).join('')}</div>` : ''}
    ${fpdf.soApp.length ? `<div class="lm-sec-titulo"><span>No app, mas não na fatura</span><small>confira se é de outro mês</small></div><div class="fpdf-lista">${fpdf.soApp.map(a=>`<div class="fpdf-item"><span class="fpdf-ok aviso">!</span><div class="fpdf-info"><b>${lvEsc(a.nome)}</b><small>${a.tipo === 'parcela' ? 'parcela' : a.tipo === 'assinatura' ? 'assinatura' : 'à vista'}</small></div><span class="fpdf-valor">${fmtMoney(a.valor)}</span></div>`).join('')}</div>` : ''}
    ${ok.length ? `<div class="lm-sec-titulo"><span>Conferidos</span><small>${ok.length} ${ok.length === 1 ? 'lançamento' : 'lançamentos'}</small></div><div class="fpdf-lista">${ok.map(i=>linha(i, false)).join('')}</div>` : ''}`;
  document.getElementById('fpdfAcoes').style.display = '';
  fpdfRenderTotal();
}
function fpdfRenderTotal(){
  const n = fpdf.itens.filter(i=>!i.casou && i.add).length;
  document.getElementById('fpdfConfirmar').textContent = n ? `Adicionar ${n} e acertar` : 'Acertar a diferença';
}
function fpdfConfirmar(){
  const cartao = (state.cartoesTracker||[]).find(c=>c.id === fpdf.cartaoId); if(!cartao) return;
  const mKey = fpdf.mKey, agora = Date.now();
  if(!cartao.credoVista) cartao.credoVista = [];
  if(!state.comprasTracker) state.comprasTracker = [];
  let n = 0;
  fpdf.itens.filter(i=>!i.casou && i.add).forEach((i, k)=>{
    const p = /^(\d+)\s*\/\s*(\d+)$/.exec(i.parcela);
    if(p && +p[2] > 1){
      /* parcela k/n: compra parcelada que começou k-1 meses antes */
      state.comprasTracker.push({ id:'cp'+agora+'_'+k, nome: i.descricao, descricao:'', logoUrl:null, cartaoId: cartao.id, valorTotal: Math.round(i.valor * +p[2] * 100)/100, parcelas: +p[2], mesInicio: addMonths(mKey, -(+p[1] - 1)) });
    } else {
      cartao.credoVista.push({ id:'cv'+agora+'_'+k, descricao: i.descricao, valor: i.valor, categoria: i.categoria || 'Outros', mKey, criadoEm: agora });
    }
    n++;
  });
  /* o que ainda não bate vira "Ajuste de fatura" (some o ajuste antigo do mês, para não somar dois) */
  cartao.credoVista = cartao.credoVista.filter(cv=>!(cv.ajuste && cv.mKey === mKey));
  const dif = Math.round((fpdf.total - faturaCartaoNoMes(cartao, mKey))*100)/100;
  if(Math.abs(dif) >= 0.01) cartao.credoVista.push({ id:'cv'+agora+'_aj', descricao:'Ajuste de fatura (PDF)', valor: dif, categoria:'Ajuste', mKey, ajuste:true, criadoEm: agora });
  persist();
  closeModal('modalFaturaPdf');
  renderCartaoTrackerList(); renderPanorama();
  showToast(`Fatura de ${monthLabel(mKey)} conferida${n ? ` · ${n} adicionado${n > 1 ? 's' : ''}` : ''}${Math.abs(dif) >= 0.01 ? ` · ajuste ${fmtMoneySigned(dif)}` : ' · bateu ✓'}`);
}
