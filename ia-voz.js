/* ========== IA-VOZ — assistente por voz inteligente (botão flutuante em todas as abas) ==========
   Ouve com pausa longa (3s de silêncio), manda para a função "ia-voz" no Supabase (Gemini) e executa as ações. */

const IAV_SILENCIO_MS = 3000;
let iavRec = null, iavTexto = '', iavAtual = '', iavTimer = null, iavFecha = null, iavAtivo = false, iavRefs = {};

function iavCriarUI(){
  if(document.getElementById('iavBtn')) return;
  const b = document.createElement('button');
  b.id = 'iavBtn'; b.type = 'button'; b.setAttribute('aria-label','Assistente de voz');
  b.innerHTML = VOZ_MIC_SVG.replace(/width="16" height="16"/,'width="24" height="24"');
  b.onclick = iavAlternar;
  const p = document.createElement('div');
  p.id = 'iavPainel';
  const mini = (id, svg, tit, fn, nivel)=>{
    const x = document.createElement('button');
    x.id = id; x.type = 'button'; x.className = 'iav-mini'; x.title = tit; x.setAttribute('aria-label', tit);
    x.style.bottom = 'calc('+(84+nivel*58)+'px + env(safe-area-inset-bottom,0px))';
    x.innerHTML = svg; x.onclick = fn; return x;
  };
  const SVG_ANALISE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.7 1.8L21.5 19.5l-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/></svg>';
  const SVG_CAMERA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'iavFoto'; inp.style.display = 'none';
  inp.onchange = iavBoleto;
  document.body.appendChild(p); document.body.appendChild(b);
  document.body.appendChild(mini('iavBtnAnalise', SVG_ANALISE, 'Analisar minhas finanças', ()=>iavAnalise('mes'), 1));
  document.body.appendChild(mini('iavBtnFoto', SVG_CAMERA, 'Ler boleto por foto', ()=>inp.click(), 2));
  document.body.appendChild(inp);
  const st = document.createElement('style');
  st.textContent = `
  #iavBtn{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));width:54px;height:54px;border-radius:50%;border:none;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.35);z-index:300;cursor:pointer}
  #iavBtn.ouvindo{background:var(--danger);animation:micPulse 1s ease-in-out infinite}
  #iavBtn.pensando{opacity:.6;pointer-events:none}
  .iav-mini{position:fixed;right:23px;width:40px;height:40px;border-radius:50%;border:1px solid var(--line,#ddd);background:var(--card,#fff);color:var(--gold,#b8963e);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:300;cursor:pointer}
  .iav-botoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  .iav-botoes button{flex:1;min-width:110px;padding:9px 10px;border-radius:12px;border:1px solid var(--line,#ddd);background:var(--card,#fff);color:var(--text,#111);font-weight:700;font-size:13px;font-family:inherit;cursor:pointer}
  .iav-botoes button.prim{background:var(--primary);color:#fff;border-color:var(--primary)}
  #iavPainel{position:fixed;left:12px;right:82px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:300;display:none;background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);border-radius:20px;padding:12px 14px 14px;box-shadow:0 10px 30px rgba(0,0,0,.18);max-height:50vh;overflow:auto;font-size:14px;line-height:1.4}
  #iavPainel.show{display:block;animation:iavSobe .22s ease-out}
  @keyframes iavSobe{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  .iav-topo{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint,#999);margin-bottom:10px}
  .iav-ponto{width:8px;height:8px;border-radius:50%;background:var(--gold,#b8963e)}
  .iav-ponto.on{animation:micPulse 1s ease-in-out infinite}
  .iav-x{margin-left:auto;background:none;border:none;color:var(--text-faint,#999);font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
  .iav-eu{margin-left:auto;max-width:92%;width:fit-content;background:var(--primary);color:#fff;border-radius:16px 16px 4px 16px;padding:9px 12px;font-size:15px;word-break:break-word}
  .iav-ia{margin-top:10px;background:var(--card-2,#f4f1ea);border-radius:16px 16px 16px 4px;padding:10px 12px}
  .iav-pens{font-style:italic;color:var(--text-faint,#8a8478);font-size:13px;margin-bottom:6px}
  .iav-chip{display:flex;gap:8px;align-items:flex-start;padding:6px 0;font-weight:600;font-size:13.5px;animation:iavSobe .25s ease-out both}
  .iav-chip i{font-style:normal;color:#fff;background:var(--success,#2e8b57);width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px}
  .iav-fala{margin-top:6px;white-space:pre-line}
  .iav-pontos{display:inline-flex;gap:4px;vertical-align:middle;margin-left:4px}
  .iav-pontos span{width:6px;height:6px;border-radius:50%;background:var(--gold,#b8963e);animation:iavPula 1s infinite ease-in-out}
  .iav-pontos span:nth-child(2){animation-delay:.15s}.iav-pontos span:nth-child(3){animation-delay:.3s}
  @keyframes iavPula{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1.1)}}`;
  document.head.appendChild(st);
}
function iavEsc(t){ return String(t||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
/* fase: 'ouvindo' | 'pensando' | 'pronto' */
function iavPainel(o){
  const el = document.getElementById('iavPainel');
  clearTimeout(iavFecha);
  if(!o){ el.classList.remove('show'); return; }
  const rotulo = o.fase==='ouvindo' ? 'Ouvindo' : o.fase==='pensando' ? 'Pensando' : 'Siloé IA';
  let h = `<div class="iav-topo"><span class="iav-ponto${o.fase!=='pronto'?' on':''}"></span>${rotulo}<button class="iav-x" onclick="iavPainel(null)" aria-label="Fechar">&times;</button></div>`;
  if(o.texto) h += `<div class="iav-eu">${iavEsc(o.texto)}</div>`;
  else if(o.fase==='ouvindo') h += `<div class="iav-pens">Pode falar… toque no microfone para enviar</div>`;
  if(o.fase==='pensando') h += `<div class="iav-ia"><div class="iav-pens">Entendendo o que você pediu<span class="iav-pontos"><span></span><span></span><span></span></span></div></div>`;
  if(o.fase==='pronto'){
    h += `<div class="iav-ia">`;
    if(o.pensamento) h += `<div class="iav-pens">${iavEsc(o.pensamento)}</div>`;
    (o.feitos||[]).forEach((f,i)=>{ h += `<div class="iav-chip" style="animation-delay:${i*0.12}s"><i>✓</i><span>${iavEsc(f)}</span></div>`; });
    if(o.fala) h += `<div class="iav-fala">${iavEsc(o.fala)}</div>`;
    h += `</div>`;
    if(o.botoes && o.botoes.length){
      iavBotoesFn = o.botoes.map(b=>b.fn);
      h += `<div class="iav-botoes">`+o.botoes.map((b,i)=>`<button class="${b.prim?'prim':''}" onclick="iavBotao(${i})">${iavEsc(b.txt)}</button>`).join('')+`</div>`;
    }
  }
  el.innerHTML = h; el.classList.add('show');
  if(o.fase==='pronto' && !o.fixo && !(o.botoes&&o.botoes.length)) iavFecha = setTimeout(()=>iavPainel(null), 9000);
}

let iavBotoesFn = [];
function iavBotao(i){ const f = iavBotoesFn[i]; iavPainel(null); if(f) f(); }
function iavJunta(a,b){ return [a,b].filter(Boolean).join(' ').trim(); }

function iavAlternar(){
  if(iavAtivo){ iavEnviar(); return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voz não disponível neste navegador'); return; }
  if(!(window.SUPABASE_URL)){ showToast('Supabase não configurado'); return; }
  iavTexto = ''; iavAtual = ''; iavAtivo = true;
  document.getElementById('iavBtn').classList.add('ouvindo');
  iavPainel({fase:'ouvindo'});
  iavTimer = setTimeout(()=>{ if(iavAtivo && !iavJunta(iavTexto,iavAtual)){ iavParar(); iavPainel(null); } }, 15000); // ninguém falou
  iavIniciarRec(SR);
}
/* Escuta em "rodadas" curtas (sem continuous): evita o bug do Android que repete as palavras */
function iavIniciarRec(SR){
  const rec = new SR();
  iavRec = rec;
  rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = (ev)=>{
    let t = '';
    for(let i=0;i<ev.results.length;i++) t += ev.results[i][0].transcript;
    iavAtual = t.trim();
    iavPainel({fase:'ouvindo', texto:iavJunta(iavTexto, iavAtual)});
    clearTimeout(iavTimer);
    iavTimer = setTimeout(iavEnviar, IAV_SILENCIO_MS);
  };
  rec.onerror = (e)=>{
    if(e.error==='no-speech' || e.error==='aborted') return;
    showToast('Não consegui ouvir. Verifique o microfone'); iavParar(); iavPainel(null);
  };
  rec.onend = ()=>{
    if(!iavAtivo) return;
    if(iavAtual){ iavTexto = iavJunta(iavTexto, iavAtual); iavAtual = ''; }
    try{ iavIniciarRec(SR); }catch(e){ iavParar(); }
  };
  try{ rec.start(); }catch(e){ iavParar(); }
}
function iavParar(){
  iavAtivo = false; clearTimeout(iavTimer);
  const r = iavRec; iavRec = null;
  if(r){ r.onend = null; r.onresult = null; try{ r.stop(); }catch(e){} }
  document.getElementById('iavBtn').classList.remove('ouvindo');
}

/* ---------- contexto enviado à IA (só o necessário) ---------- */
function iavContexto(){
  iavRefs = {};
  const mKey = state.focusMonth;
  const mAnt = addMonths(mKey,-1);
  const contas = [];
  let n = 0;
  [mAnt, mKey].forEach(m=>{
    getContasDoMes(m).forEach(it=>{
      const pk = m+'_'+it.user+'_'+it.cat+'_'+it.id;
      if(m===mAnt && state.paid[pk]) return; // do mês anterior só as que ficaram abertas
      n++; const ref = 'c'+n;
      iavRefs[ref] = { pk, user:it.user, cat:it.cat, id:it.id, mKey:m };
      contas.push({ ref, nome:it.desc, valor:it.valor, dia:it.dia, mes:m, pago:!!state.paid[pk], categoria:it.cat });
    });
  });
  return {
    usuario: state.currentUser,
    saldoAtual: state.users[state.currentUser].saldoAtual||0,
    mesFoco: mKey, hoje: todayKey(),
    contas,
    resumo: iavResumo()
  };
}

/* ---------- resumo financeiro calculado pelo app (a IA só interpreta) ---------- */
function iavTent(fn, padrao){ try{ const v = fn(); return v===undefined ? padrao : v; }catch(e){ return padrao; } }
function iavR2(v){ return Math.round((Number(v)||0)*100)/100; }
function iavResumo(){
  const m0 = state.focusMonth;
  const cats = ['moradia','fixo','assinatura','futuro'];
  const meses = [0,1,2].map(i=>addMonths(m0,i)).map(m=>{
    const d = iavTent(()=>dadosDoMes(m), {renda:0,gastoTotal:0,sobra:0});
    const fx = iavTent(()=>calcularFluxoCaixa(m), null);
    const brutos = iavTent(()=>gastosBrutosMes('davi', m), 0);
    const contrib = iavTent(()=>contribCrisForMonth(m), 0);
    return {
      mes: m,
      renda: iavR2(d.renda), gastosAPagar: iavR2(d.gastoTotal), sobraPrevista: iavR2(d.sobra),
      gastosTotaisDoMes: iavR2(brutos),
      porCategoria: Object.fromEntries(cats.map(c=>[c, iavR2(iavTent(()=>categoryTotalForMonth(c,m),0))])),
      menorSaldoNoMes: fx && fx.minPonto ? { dia: fx.minPonto.dia, saldo: iavR2(fx.minPonto.saldo) } : null,
      precisaGanharBrutoParaSairDoPJ: iavR2(Math.max(brutos-contrib,0)/(1-DIZIMO_PERCENT)),
      parcelasDeComprasNoCartao: iavR2((state.comprasTracker||[]).reduce((t,c)=>t+compraTrackerValorNoMes(c,m),0))
    };
  });
  const ant = iavTent(()=>dadosDoMes(addMonths(m0,-1)), null);
  const ant3 = iavTent(()=>dadosDoMes(addMonths(m0,-3)), null);
  const abertas = iavTent(()=>getContasDoMes(m0).filter(it=>!state.paid[m0+'_'+it.user+'_'+it.cat+'_'+it.id]), []);
  const vilao = iavTent(()=>calcularVilaoOrcamento(m0), null);
  return {
    hoje: new Date().toISOString().slice(0,10), diaDeHoje: new Date().getDate(),
    saldoAtual: iavR2(state.users.davi.saldoAtual), diaQueRecebe: state.diaRecebimentoRenda||5,
    meses,
    mesAnterior: ant ? { renda:iavR2(ant.renda), gastos:iavR2(ant.gastoTotal), sobra:iavR2(ant.sobra) } : null,
    ha3Meses: ant3 ? { renda:iavR2(ant3.renda), gastos:iavR2(ant3.gastoTotal), sobra:iavR2(ant3.sobra) } : null,
    contasEmAberto: { quantidade: abertas.length, total: iavR2(abertas.reduce((t,i)=>t+(Number(i.valor)||0),0)),
      proximas: abertas.slice(0,6).map(i=>({ nome:i.desc, valor:iavR2(i.valor), dia:i.dia })) },
    cartoesTotalEmAberto: iavR2(iavTent(()=>totalCartoesNoMesAtual(),0)),
    categoriaQueMaisSubiu: vilao ? { categoria:vilao.cat, antes:iavR2(vilao.anterior), agora:iavR2(vilao.atual), subiuPct:Math.round(vilao.diffPct) } : null
  };
}

async function iavEnviar(){
  clearTimeout(iavTimer);
  const texto = iavJunta(iavTexto, iavAtual);
  iavParar();
  iavTexto = ''; iavAtual = '';
  if(!texto){ iavPainel(null); return; }
  const btn = document.getElementById('iavBtn');
  btn.classList.add('pensando'); iavPainel({fase:'pensando', texto});
  try{
    const j = await iavChamar({ texto, contexto: iavContexto() });
    const feitos = [];
    for(const a of (j.acoes||[])){ const m = await iavExecutar(a); if(m) feitos.push(m); }
    iavPainel({fase:'pronto', texto, pensamento:j.pensamento, feitos, fala:j.fala, fixo:(j.fala||'').length>160});
  }catch(e){
    console.error(e);
    iavPainel({fase:'pronto', texto, fala:'Não consegui falar com a IA. Verifique a função no Supabase.'});
  }
  btn.classList.remove('pensando');
}

/* ---------- executar ações (lista fechada) ---------- */
function iavNum(v){ const n = Number(v); return isFinite(n) ? n : null; }
async function iavExecutar(a){
  const u = state.currentUser;
  switch(a && a.acao){
    case 'atualizar_saldo': {
      const v = iavNum(a.valor); if(v===null) return null;
      state.users[u].saldoAtual = v;
      renderPlanner(); renderPanorama(); persist();
      return 'Saldo atual: '+fmtMoney(v);
    }
    case 'marcar_pago': {
      let c = 0;
      (a.refs||[]).forEach(ref=>{
        const r = iavRefs[ref]; if(!r) return;
        state.paid[r.pk] = !!a.pago;
        if(a.pago && state.pagamentosParciais) delete state.pagamentosParciais[r.pk];
        c++;
      });
      if(!c) return null;
      persist(); renderPanorama(); renderPlanner();
      return c+(c===1?' conta':' contas')+(a.pago?' marcada(s) como paga(s)':' desmarcada(s)');
    }
    case 'adicionar_gasto': {
      const cat = ['fixo','assinatura','moradia'].includes(a.categoria) ? a.categoria : 'fixo';
      const v = iavNum(a.valor); const desc = String(a.desc||'').trim();
      if(!desc || v===null) return null;
      state.users[u].expenses[cat].push({ id:'g'+Date.now()+Math.floor(Math.random()*1000), desc, descricao:'', valor:v, dia:Math.min(31,Math.max(1,parseInt(a.dia)||1)), mesInicio:null, tipo:'fixa', essencial:true });
      renderPlanner(); renderPanorama(); persist();
      return 'Adicionado: '+desc+' '+fmtMoney(v);
    }
    case 'alterar_valor': {
      const r = iavRefs[a.ref]; const v = iavNum(a.valor);
      if(!r || v===null || r.cat==='futuro') return null;
      const item = getGastoItemRef(r.user, r.cat, r.id); if(!item) return null;
      if(Number(item.valor)>0 && Number(item.valor)!==v) item.historico = (item.historico||[]).concat([{ mKey:mesFinanceiroAtual(), valor:item.valor }]).slice(-6);
      item.valor = v;
      renderPlanner(); renderPanorama(); persist();
      return item.desc+' agora é '+fmtMoney(v);
    }
    case 'excluir': {
      const r = iavRefs[a.ref]; if(!r || r.user!==u) return null;
      const item = getGastoItemRef(r.user, r.cat, r.id); if(!item) return null;
      const ok = await iosConfirm('Excluir "'+item.desc+'"?');
      if(!ok) return null;
      deleteGasto(r.cat, r.id);
      return 'Excluído: '+item.desc;
    }
    case 'abrir_resumo': abrirResumoGeral(); return 'Resumo aberto';
  }
  return null;
}

async function iavChamar(corpo){
  const r = await fetch(window.SUPABASE_URL+'/functions/v1/smart-handler', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'apikey':window.SUPABASE_ANON_KEY, 'Authorization':'Bearer '+window.SUPABASE_ANON_KEY },
    body: JSON.stringify(corpo)
  });
  return r.json();
}

/* ---------- análise financeira (botão ✨ e resumo ao concluir o mês) ---------- */
async function iavAnalise(tipo){
  const pergunta = tipo==='fechamento' ? 'Resumo do fechamento do mês' : 'Como estou financeiramente?';
  iavPainel({fase:'pensando', texto:pergunta});
  try{
    const j = await iavChamar({ modo:'analise', tipo, resumo: iavResumo() });
    iavPainel({fase:'pronto', texto:pergunta, pensamento:j.pensamento, fala:j.fala, fixo:true});
  }catch(e){
    console.error(e);
    iavPainel({fase:'pronto', texto:pergunta, fala:'Não consegui falar com a IA agora. Tente de novo.', fixo:true});
  }
}

/* ---------- foto de boleto/conta → lança no Planner (com confirmação) ---------- */
function iavLerArquivo(file){
  return new Promise((ok,err)=>{ const r = new FileReader(); r.onload = ()=>ok(r.result); r.onerror = err; r.readAsDataURL(file); });
}
async function iavBoleto(ev){
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!file) return;
  iavPainel({fase:'pensando', texto:'📷 Foto do boleto enviada'});
  try{
    let url = await iavLerArquivo(file);
    url = await comprimirImagemDataUrl(url, 1400, 0.8);
    const j = await iavChamar({ modo:'boleto', imagem:url.split(',')[1], mime:(url.match(/^data:([^;]+)/)||[])[1]||'image/jpeg' });
    const valor = iavNum(j.valor);
    if(!j.desc || valor===null || valor<=0){
      iavPainel({fase:'pronto', texto:'📷 Foto do boleto', pensamento:j.pensamento, fala:j.fala||'Não consegui ler o valor. Tente uma foto mais de perto e com boa luz.', fixo:true});
      return;
    }
    const cat = ['moradia','fixo','assinatura'].includes(j.categoria) ? j.categoria : 'fixo';
    const venc = /^\d{4}-\d{2}-\d{2}$/.test(j.vencimento||'') ? j.vencimento : null;
    const dia = venc ? parseInt(venc.slice(8,10),10) : 1;
    const mes = venc ? venc.slice(0,7) : state.focusMonth;
    const txt = j.desc+' — '+fmtMoney(valor)+(venc?' (vence '+venc.slice(8,10)+'/'+venc.slice(5,7)+')':'');
    iavPainel({ fase:'pronto', texto:'📷 Foto do boleto', pensamento:j.pensamento, fala:'Lançar '+txt+'?', fixo:true,
      botoes:[
        { txt:'Só neste mês', prim:true, fn:()=>iavLancar({desc:j.desc, valor, dia, mes, unica:true, cat}) },
        { txt:'Fixa todo mês', fn:()=>iavLancar({desc:j.desc, valor, dia, mes, unica:false, cat}) },
        { txt:'Cancelar', fn:()=>{} }
      ] });
  }catch(e){
    console.error(e);
    iavPainel({fase:'pronto', texto:'📷 Foto do boleto', fala:'Não consegui ler a foto agora. Tente de novo.', fixo:true});
  }
}
function iavLancar(o){
  const u = state.currentUser;
  const id = 'g'+Date.now()+Math.floor(Math.random()*1000);
  if(o.unica){
    state.users[u].expenses.futuro.push({ id, desc:o.desc, descricao:'', recorrente:false, mesInicio:o.mes, parcelas:1, replicar:true, valor:o.valor, valores:{}, dia:o.dia });
  } else {
    state.users[u].expenses[o.cat].push({ id, desc:o.desc, descricao:'', valor:o.valor, dia:o.dia, mesInicio:null, tipo:'fixa', essencial:true });
  }
  renderPlanner(); renderPanorama(); persist();
  iavPainel({fase:'pronto', pensamento:'Conta lançada.', feitos:['Lançado: '+o.desc+' '+fmtMoney(o.valor)+(o.unica?' (só em '+monthLabel(o.mes)+')':' (todo mês)')]});
}

/* ---------- alerta de aperto: avisa 1x por dia se o saldo vai faltar (conta feita pelo app, sem IA) ---------- */
function iavAlertaAperto(){
  try{
    const hoje = new Date().toISOString().slice(0,10);
    if(localStorage.getItem('iav-alerta')===hoje) return;
    const m0 = state.focusMonth;
    const achados = [m0, addMonths(m0,1)].map(m=>({ m, fx:calcularFluxoCaixa(m) })).filter(x=>x.fx.minPonto && x.fx.minPonto.saldo < 0);
    if(!achados.length) return;
    localStorage.setItem('iav-alerta', hoje);
    const a = achados[0], p = a.fx.minPonto;
    iavPainel({ fase:'pronto', fixo:true, pensamento:'Olhei o fluxo de caixa de '+monthLabel(a.m)+'.',
      fala:'⚠️ Dia '+p.dia+' o saldo previsto fica em '+fmtMoneySigned(p.saldo)+' (faltam '+fmtMoney(Math.abs(p.saldo))+').\nO dia de recebimento configurado é '+a.fx.diaRecebimento+'. Veja se dá para reorganizar vencimentos.' });
  }catch(e){}
}
function iavEsperarEstado(){
  let n = 0;
  const t = setInterval(()=>{
    n++;
    if(typeof remoteReady!=='undefined' && remoteReady){ clearInterval(t); setTimeout(iavAlertaAperto, 1500); }
    else if(n>30) clearInterval(t);
  }, 1000);
}

window.addEventListener('load', ()=>{ iavCriarUI(); iavEsperarEstado(); });
