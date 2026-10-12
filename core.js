/* ================= ESTADO ================= */
// Mês atual fica em state.mesAtual (Supabase). Aqui é só o ponto de partida até o estado carregar.
let mesAtualRef = monthKey(new Date());
let mesFinanceiroAtrasoRef = 0;
let mesPontoRef = monthKey(new Date()); // mês do Ponto PJ (independente do Dashboard/Planner)
const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES_LONGOS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIA_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function novoEstado(){
  return {
    currentUser:'davi',
    panoOffset:0,
    pontoOffset:0,
    focusMonth:mesFinanceiroAtual(),
    users:{
      davi:{ income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } },
      cris:{ income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } }
    },
    paid:{},
    contasArquivadas:{},
    pagamentosParciais:{},
    historicoMeses:{},
    reserva:0,
    salarioRecebido:{},
    dizimoPago:{},
    faturasCartao:{},
    pontoFechado:{},
    cartoesTracker:[],
    comprasTracker:[],
    metas:[],
    tarefas:[],
    tarefaCategorias:[],
    louvores:[],
    semanaOffset:0,
    semanaAgenda:{},
    ponto:{ valorHora:0, padraoHoras:8, days:{} },
    configFonte:'system',
    layoutPrefs:{}
  };
}
const FONTES_APP = {
  system:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
  inter:"'Inter',sans-serif",
  poppins:"'Poppins',sans-serif",
  nunito:"'Nunito',sans-serif"
};
function aplicarFonteApp(){
  const fonte = FONTES_APP[state.configFonte] || FONTES_APP.system;
  document.documentElement.style.setProperty('--font-body', fonte);
  document.querySelectorAll('.fonte-chip').forEach(el=>el.classList.remove('active'));
  const ativo = document.getElementById('fonteChip'+(state.configFonte||'system').charAt(0).toUpperCase()+(state.configFonte||'system').slice(1));
  ativo?.classList.add('active');
}
function setAppFonte(nome){
  state.configFonte = nome;
  persist();
  aplicarFonteApp();
}
function toggleFontePopup(){
  document.getElementById('fontePopup')?.classList.toggle('show');
}
let state = novoEstado();

/* ================= PERSISTÊNCIA (Supabase + cópia de segurança neste aparelho) ================= */
let remoteReady = false;   // só vira true depois de ler a nuvem com sucesso; antes disso nada é gravado
let persistTimer = null;
let carregarTentativas = 0;
let salvarPendente = false;      // há alteração que ainda não chegou ao banco
let salvandoPromise = null;
let tratandoConflito = false;
const LOCAL_COPIA_KEY = 'siloe-copia-local-v1';
const LOCAL_META_KEY = 'siloe-copia-local-meta-v1';

/* --- cópia local: se o banco falhar, a alteração não se perde ao atualizar a página --- */
function espelharLocal(){
  try{
    localStorage.setItem(LOCAL_COPIA_KEY, JSON.stringify(state));
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ t: Date.now(), dirty: true }));
  }catch(e){ /* sem espaço ou bloqueado: segue sem cópia local */ }
}
function marcarLocalSincronizado(){
  try{ localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ t: Date.now(), dirty: false })); }catch(e){}
}
function lerCopiaLocalPendente(){
  try{
    const meta = JSON.parse(localStorage.getItem(LOCAL_META_KEY) || 'null');
    if(!meta || !meta.dirty) return null;
    const st = JSON.parse(localStorage.getItem(LOCAL_COPIA_KEY) || 'null');
    if(!st || typeof st !== 'object' || !st.users) return null;
    return { t: meta.t, state: st };
  }catch(e){ return null; }
}

/* --- aviso de status do salvamento (bolinha no cabeçalho + faixa vermelha quando falha) --- */
function garantirSyncUI(){
  if(document.getElementById('syncDot')) return;
  const ver = document.querySelector('.header-version');
  if(ver){
    const dot = document.createElement('span');
    dot.id = 'syncDot';
    dot.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:6px;vertical-align:middle;background:#9aa0a6;opacity:.0;transition:opacity .2s,background .2s';
    ver.insertAdjacentElement('afterend', dot);
  }
  const b = document.createElement('div');
  b.id = 'syncBanner';
  b.style.cssText = 'display:none;position:fixed;left:8px;right:8px;top:calc(var(--header-h,64px) + 6px);z-index:900;background:#b3261e;color:#fff;border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.35;box-shadow:0 6px 18px rgba(0,0,0,.3)';
  b.innerHTML = '<div id="syncBannerMsg"></div><div style="display:flex;gap:8px;margin-top:8px"><button type="button" id="syncBannerBtn" style="flex:1;border:none;border-radius:8px;padding:7px 10px;font-weight:700;font-family:inherit;background:#fff;color:#b3261e;cursor:pointer">Tentar de novo</button></div>';
  document.body.appendChild(b);
}
function atualizarStatusSalvo(estado, detalhe){
  garantirSyncUI();
  const dot = document.getElementById('syncDot');
  const banner = document.getElementById('syncBanner');
  const msg = document.getElementById('syncBannerMsg');
  const btn = document.getElementById('syncBannerBtn');
  if(dot){
    const cores = { salvo:'#1c9d5b', salvando:'#db8b18', erro:'#e0342b', offline:'#e0342b' };
    dot.style.background = cores[estado] || '#9aa0a6';
    dot.style.opacity = estado==='salvo' ? '.55' : '1';
    dot.title = { salvo:'Tudo salvo no banco', salvando:'Salvando...', erro:'Não salvou', offline:'Sem conexão com o banco' }[estado] || '';
  }
  if(!banner) return;
  if(estado==='erro' || estado==='offline'){
    let kb = 0; try{ kb = Math.round(JSON.stringify(state).length/1024); }catch(e){}
    const motivo = detalhe || (window.SiloSupabase && window.SiloSupabase.lastError) || 'sem conexão';
    msg.textContent = estado==='offline'
      ? 'Sem conexão com o banco ('+motivo+'). Nada do que você digitar será salvo até conectar.'
      : 'Não salvou no banco ('+kb+' KB): '+motivo+'. Suas alterações estão guardadas neste aparelho e vão ser enviadas assim que der.';
    btn.onclick = ()=>{ banner.style.display='none'; estado==='offline' ? carregar() : persistAgora(); };
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

function persist(){
  if(!remoteReady){ atualizarStatusSalvo('offline'); return; }   // evita sobrescrever a nuvem com estado vazio
  salvarPendente = true;
  espelharLocal();
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistAgora, 500);
  atualizarStatusSalvo('salvando');
}
function tempoUltimaEdicaoLocal(){
  try{ const meta = JSON.parse(localStorage.getItem(LOCAL_META_KEY) || 'null'); return (meta && meta.t) || Date.now(); }
  catch(e){ return Date.now(); }
}
/* outro aparelho salvou no meio do caminho: vence a edição mais recente, sem perguntar */
async function tratarConflitoSalvar(){
  if(tratandoConflito) return false;
  tratandoConflito = true;
  try{
    const r = await window.SiloSupabase.checarAtualizacao();
    if(!r.ok) return false;
    const tBanco = r.updatedAt ? Date.parse(r.updatedAt) : 0;
    if(tempoUltimaEdicaoLocal() >= tBanco){
      await window.SiloSupabase.adotarVersaoDoBanco();
      return true;   // edição daqui é mais nova: tenta salvar de novo por cima
    }
    marcarLocalSincronizado();
    location.reload();   // banco é mais novo: recarrega com ele
    return false;
  } finally { tratandoConflito = false; }
}
async function tentarSalvarNoBanco(){
  let ok = false;
  for(let t=0; t<3 && !ok; t++){
    ok = await window.SiloSupabase.saveState(state);
    if(!ok && window.SiloSupabase.conflito){
      const retentar = await tratarConflitoSalvar();
      if(!retentar) return false;
      t--;   // não conta como tentativa
      continue;
    }
    if(!ok && t<2) await new Promise(r=>setTimeout(r, 1500*(t+1)));
  }
  return ok;
}
async function persistAgora(){
  clearTimeout(persistTimer);
  persistTimer = null;
  if(!remoteReady || !window.SiloSupabase) return false;
  if(salvandoPromise){ salvarPendente = true; return salvandoPromise; }
  salvandoPromise = (async ()=>{
    let ok = false;
    do{
      salvarPendente = false;
      atualizarStatusSalvo('salvando');
      ok = await tentarSalvarNoBanco();
      if(!ok){ salvarPendente = true; break; }
    } while(salvarPendente);
    if(ok){ marcarLocalSincronizado(); atualizarStatusSalvo('salvo'); }
    else { atualizarStatusSalvo('erro'); }
    return ok;
  })();
  const r = await salvandoPromise;
  salvandoPromise = null;
  return r;
}
/* tenta de novo sozinho: ao voltar a internet e a cada 30 s enquanto houver algo pendente */
window.addEventListener('online', ()=>{ if(salvarPendente) persistAgora(); });
setInterval(()=>{ if(salvarPendente && remoteReady && !salvandoPromise && !persistTimer) persistAgora(); }, 30000);
document.addEventListener('visibilitychange', async ()=>{
  if(document.hidden){ if(persistTimer || salvarPendente) persistAgora(); return; }
  /* voltou pro app: se outro aparelho salvou algo novo e aqui não há nada pendente, recarrega */
  if(remoteReady && !salvarPendente && !persistTimer && !salvandoPromise && window.SiloSupabase){
    const r = await window.SiloSupabase.checarAtualizacao();
    if(r.ok && r.mudou && !salvarPendente && !persistTimer && !salvandoPromise) location.reload();
  }
});
window.addEventListener('pagehide', ()=>{ if(persistTimer || salvarPendente) persistAgora(); });

async function carregar(){
  let legado = { state:null, mesAtual:null, logo:null };
  let precisaSalvar = false;
  try{
    let saved = null;
    if(!window.SiloSupabase || !window.SiloSupabase.enabled) throw new Error('Supabase não configurado');
    const r = await window.SiloSupabase.loadState();
    if(!r.ok) throw r.error;
    saved = r.data;
    legado = window.SiloSupabase.lerLegado();

    /* alterações feitas neste aparelho que não chegaram ao banco (ex.: falha de conexão/gravação) */
    const pend = lerCopiaLocalPendente();
    if(pend){
      let igual = false;
      try{ igual = JSON.stringify(pend.state) === JSON.stringify(saved); }catch(e){}
      if(igual){ marcarLocalSincronizado(); }
      else {
        /* vence a edição mais recente: a deste aparelho ou a que está no banco */
        const tBanco = r.updatedAt ? Date.parse(r.updatedAt) : 0;
        if(pend.t > tBanco){ saved = pend.state; precisaSalvar = true; }
        else { marcarLocalSincronizado(); }
      }
    }

    if(!saved && legado.state){ saved = legado.state; precisaSalvar = true; }   // primeira vez: sobe o que estava no aparelho

    if(saved){
      state = Object.assign(novoEstado(), saved);
      // garante estrutura de usuários/categorias mesmo se dados antigos incompletos
      ['davi','cris'].forEach(u=>{
        if(!state.users[u]) state.users[u] = { income:{}, incomeExtra:{}, extras:[], saldoAtual:0, cartoes:[], expenses:{ moradia:[], assinatura:[], fixo:[], futuro:[] } };
        if(!state.users[u].incomeExtra) state.users[u].incomeExtra = {};
        if(!state.users[u].extras){
          // migração: valores antigos de incomeExtra (um por mês) viram entradas individuais
          state.users[u].extras = Object.keys(state.users[u].incomeExtra).filter(mKey=>state.users[u].incomeExtra[mKey]>0).map(mKey=>({
            id:'ex'+mKey+Math.random().toString(36).slice(2,6),
            desc:'Extra',
            valor:state.users[u].incomeExtra[mKey],
            mesInicio:mKey,
            mesFim:mKey
          }));
        }
        if(state.users[u].saldoAtual === undefined) state.users[u].saldoAtual = 0;
        if(state.users[u].usarSaldoComoBase === undefined) state.users[u].usarSaldoComoBase = false;
        if(!state.users[u].cartoes) state.users[u].cartoes = [];
        if(!state.users[u].expenses) state.users[u].expenses = { moradia:[], assinatura:[], fixo:[], futuro:[] };
        ['moradia','assinatura','fixo','futuro'].forEach(c=>{ if(!state.users[u].expenses[c]) state.users[u].expenses[c]=[]; });
      });
      if(!state.ponto) state.ponto = { valorHora:0, padraoHoras:8, days:{} };
      if(!state.ponto.days) state.ponto.days = {};
      if(state.ponto.nomeUsuario === undefined) state.ponto.nomeUsuario = '';
      if(!state.cartoesTracker) state.cartoesTracker = [];
      if(!state.comprasTracker) state.comprasTracker = [];
      if(!state.metas) state.metas = [];
      if(!state.pagamentosParciais) state.pagamentosParciais = {};
      if(!state.contasArquivadas) state.contasArquivadas = {};
      if(state.reserva === undefined) state.reserva = 0;
      if(!state.salarioRecebido) state.salarioRecebido = {};
      if(!state.dizimoPago) state.dizimoPago = {};
      if(!state.faturasCartao) state.faturasCartao = {};
      if(!state.pontoFechado) state.pontoFechado = {};
      if(!state.credoVistaCategoriasCustom) state.credoVistaCategoriasCustom = [];
      if(!state.louvores) state.louvores = [];
      if(state.semanaOffset === undefined) state.semanaOffset = 0;
      if(!state.semanaAgenda) state.semanaAgenda = {};
      if(!state.tarefas) state.tarefas = [];
      if(!state.tarefaCategorias) state.tarefaCategorias = [];
      (state.tarefas||[]).forEach(t=>{ if(t.tempoGasto===undefined) t.tempoGasto=0; if(t.timerStart===undefined) t.timerStart=null; });
      // migração: garantir campos novos
      (state.cartoesTracker||[]).forEach(c=>{ if(!c.credoVista) c.credoVista=[]; if(!c.assinaturas) c.assinaturas=[]; });
      (state.comprasTracker||[]).forEach(cp=>{ if(cp.pago === undefined) cp.pago=false; });
      delete state.config;
      if(!state.configFonte) state.configFonte = 'system';
      if(!state.layoutPrefs) state.layoutPrefs = {};
      mesFinanceiroAtrasoRef = state.mesFinanceiroAtraso ? 1 : 0;
      if(state.mesAtual){
        mesAtualRef = state.mesAtual;
      } else {
        mesAtualRef = legado.mesAtual || mesAtualRef;
        state.mesAtual = mesAtualRef;
        precisaSalvar = true;
      }
      if(state.mesPonto === undefined){
        // migração: Ponto PJ passa a ter mês próprio; Dashboard/Planner guardam o mês que mostram
        state.mesPonto = mesAtualRef;
        mesAtualRef = addMonths(mesAtualRef, state.mesFinanceiroAtraso ? 0 : 1);
        state.mesAtual = mesAtualRef;
        state.mesFinanceiroAtraso = 0;
        precisaSalvar = true;
      }
      mesPontoRef = state.mesPonto;
      if(!state.layoutV3){ state.layoutPrefs = {}; state.layoutV3 = true; precisaSalvar = true; }   // v3.0: telas reorganizadas, zera posições salvas
      /* migração: o antigo botão "Calcular só pelo saldo em conta" vira "recebi" do salário e dos extras do mês */
      ['davi','cris'].forEach(u=>{
        if(!state.users[u].usarSaldoComoBase) return;
        const mAtual = mesAtualRef;
        state.salarioRecebido[u+'_'+mAtual] = true;
        (state.users[u].extras||[]).forEach(e=>{
          if(mAtual >= e.mesInicio && mAtual <= (e.mesFim||e.mesInicio)){ if(!e.recebidos) e.recebidos = {}; e.recebidos[mAtual] = true; }
        });
        state.users[u].usarSaldoComoBase = false;
        precisaSalvar = true;
      });
      mesFinanceiroAtrasoRef = 0;
      if(legado.logo && !state.logoApp){ state.logoApp = legado.logo; precisaSalvar = true; }
    } else {
      mesPontoRef = mesAtualRef;
      mesAtualRef = addMonths(mesAtualRef, 1);
      state = novoEstado();
      state.mesAtual = mesAtualRef;
      state.mesPonto = mesPontoRef;
      precisaSalvar = true;
    }
    remoteReady = true;
    atualizarStatusSalvo('salvo');
  }catch(e){
    console.error('[LOAD] Erro ao carregar estado:', e);
    state = novoEstado();
    remoteReady = false;   // não grava nada até conseguir ler a nuvem
    atualizarStatusSalvo('offline', (window.SiloSupabase&&window.SiloSupabase.lastError)||(e&&e.message)||'erro desconhecido');
    if(carregarTentativas++ < 5) setTimeout(carregar, 8000);
  }
  limparDadosAntigos();
  aplicarFonteApp();
  if(typeof aplicarLogoSalva==='function') aplicarLogoSalva();
  renderAll();
  if(typeof applyAllLayouts==='function') applyAllLayouts();
  if(typeof updateLayoutBtnVisibility==='function') updateLayoutBtnVisibility('planner');
  await finalizarMigracaoLegado(precisaSalvar, legado);
  compactarImagensDoEstado();
}
// Migração única do localStorage -> Supabase (pode ser apagada quando todos os aparelhos já tiverem migrado)
async function finalizarMigracaoLegado(precisaSalvar, legado){
  if(!remoteReady || !window.SiloSupabase) return;
  if(precisaSalvar){
    const ok = await persistAgora();
    if(!ok) return;   // mantém os dados locais até conseguir salvar na nuvem
    window.SiloSupabase.limparLegado();
    return;
  }
  if(legado && legado.state){
    // A nuvem já tinha dados e este aparelho também tem dados antigos: pergunta antes de apagar
    const ok = await iosConfirm('Este aparelho ainda guarda dados antigos. Os dados da nuvem foram mantidos. Apagar os antigos deste aparelho?');
    if(ok) window.SiloSupabase.limparLegado();
  } else {
    window.SiloSupabase.limparLegado();
  }
}

/* ================= LIMPEZA AUTOMÁTICA (mantém só mês atual + mês passado) ================= */
function limparDadosAntigos(){
  // Planner/Panorama operam 1 mês à frente: "mês passado" financeiro = mês real atual
  const limitePlanner = todayKey();
  // Ponto PJ é sempre em tempo real: "mês passado" real = mês real atual -1
  const limitePonto = addMonths(mesPontoRef, -1);

  ['davi','cris'].forEach(u=>{
    const us = state.users[u];
    Object.keys(us.income||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete us.income[mKey]; });
    Object.keys(us.incomeExtra||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete us.incomeExtra[mKey]; });
    us.extras = (us.extras||[]).filter(e=> (e.mesFim||e.mesInicio) >= limitePlanner);
    (us.cartoes||[]).forEach(c=>{
      Object.keys(c.gastos||{}).forEach(mKey=>{ if(mKey < limitePlanner) delete c.gastos[mKey]; });
    });
    us.expenses.futuro = (us.expenses.futuro||[]).filter(item=>{
      if(item.recorrente) return true; // recorrente nunca expira sozinho
      const isLegado = item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined;
      if(isLegado) return item.mes >= limitePlanner;
      const parcelas = item.parcelas || 1;
      const fim = addMonths(item.mesInicio || limitePlanner, parcelas-1);
      return fim >= limitePlanner;
    });
  });
  Object.keys(state.ponto.days||{}).forEach(mKey=>{ if(mKey < limitePonto) delete state.ponto.days[mKey]; });
  ['salarioRecebido','dizimoPago'].forEach(campo=>{
    Object.keys(state[campo]||{}).forEach(k=>{ const mKey = k.split('_')[1]; if(mKey && mKey < limitePlanner) delete state[campo][k]; });
  });
  Object.keys(state.paid||{}).forEach(pk=>{
    const mKey = pk.split('_')[0];
    if(mKey < limitePlanner) delete state.paid[pk];
  });
}

/* ================= HELPERS DE DATA ================= */
function monthKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function keyToDate(key){ const [y,m]=key.split('-').map(Number); return new Date(y, m-1, 1); }
function addMonths(key, n){ const d=keyToDate(key); d.setMonth(d.getMonth()+n); return monthKey(d); }
function monthLabel(key){ const d=keyToDate(key); return MES_NOMES[d.getMonth()]+' '+d.getFullYear(); }
function monthLabelLong(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+' de '+d.getFullYear(); }
function monthLabelExtensoCurto(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+'/'+String(d.getFullYear()).slice(-2); }
function monthLabelExtenso(key){ const d=keyToDate(key); return MES_NOMES_LONGOS[d.getMonth()]+'/'+d.getFullYear(); }
function daysInMonth(key){ const d=keyToDate(key); return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function todayKey(){ return addMonths(mesAtualRef, -1); } // mês real de referência (1 antes do mês do Dashboard/Planner)
function mesFinanceiroAtual(){ return mesAtualRef; } // mês atual do Dashboard/Planner
function pontoBaseKey(){ return mesPontoRef; } // mês atual do Ponto PJ
function definirMesPonto(valor){
  mesPontoRef = valor;
  state.mesPonto = valor;
  state.pontoOffset = 0;
  persist();
  renderAll();
}
function fmtMoney(v){ return (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtMoneySigned(v){ return v>=0 ? fmtMoney(v) : '-'+fmtMoney(Math.abs(v)); }
/* ================= IMAGENS (logos reduzidas antes de ir para a nuvem) ================= */
function comprimirImagemDataUrl(dataUrl, lado, qualidade){
  lado = lado || 160; qualidade = qualidade || 0.85;
  return new Promise(resolve=>{
    try{
      const img = new Image();
      img.onload = ()=>{
        try{
          const esc = Math.min(1, lado/Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width*esc)), h = Math.max(1, Math.round(img.height*esc));
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const png = /^data:image\/(png|svg|webp|gif)/.test(dataUrl);
          const out = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', qualidade);
          resolve(out.length < dataUrl.length ? out : dataUrl);
        }catch(e){ resolve(dataUrl); }
      };
      img.onerror = ()=> resolve(dataUrl);
      img.src = dataUrl;
    }catch(e){ resolve(dataUrl); }
  });
}
/* ===== COR DA LOGO: cor principal da imagem, para pintar o cartão/empréstimo =====
   Devolve { fundo, texto } já calculado, ou null enquanto calcula (aí chama aoTerminar uma vez). */
const corLogoCache = {};
function corDaLogo(url, aoTerminar){
  if(!url) return null;
  if(corLogoCache[url] !== undefined) return corLogoCache[url] === 'pendente' ? null : corLogoCache[url];
  corLogoCache[url] = 'pendente';
  const img = new Image();
  img.onload = ()=>{
    let cor = null;
    try{
      const N = 48, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, N, N);
      const px = ctx.getImageData(0, 0, N, N).data;
      const baldes = {};
      for(let i=0; i<px.length; i+=4){
        const r=px[i], g=px[i+1], b=px[i+2], a=px[i+3];
        if(a < 200) continue;
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        if(mn > 225) continue;                       // quase branco: fundo da logo
        const peso = 1 + (mx-mn)/32;                 // cores vivas pesam mais que cinzas
        const k = (r>>5)+'-'+(g>>5)+'-'+(b>>5);
        const bk = baldes[k] || (baldes[k] = { p:0, r:0, g:0, b:0 });
        bk.p += peso; bk.r += r*peso; bk.g += g*peso; bk.b += b*peso;
      }
      const melhor = Object.values(baldes).sort((a,b)=>b.p-a.p)[0];
      if(melhor){
        const r = Math.round(melhor.r/melhor.p), g = Math.round(melhor.g/melhor.p), b = Math.round(melhor.b/melhor.p);
        const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
        cor = { fundo:`rgb(${r},${g},${b})`, texto: lum > 0.62 ? '#0F172A' : '#FFFFFF', claro: lum > 0.62 };
      }
    }catch(e){ cor = null; }
    corLogoCache[url] = cor;
    if(cor && typeof aoTerminar==='function') aoTerminar();
  };
  img.onerror = ()=>{ corLogoCache[url] = null; };
  img.src = url;
  return null;
}
/* estilo inline da "face" colorida (cartão/empréstimo) */
function estiloFaceCor(cor){
  return cor ? ` style="--face-bg:${cor.fundo};--face-tx:${cor.texto}"` : '';
}
// Uma vez só: reduz logos grandes que já estão salvas (fotos de receitas já são comprimidas e ficam como estão)
async function compactarImagensDoEstado(){
  if(!remoteReady || state.imagensCompactadasV1) return;
  const lista = [];
  const varrer = (o)=>{
    if(!o || typeof o!=='object') return;
    Object.keys(o).forEach(k=>{
      const v = o[k];
      if(typeof v==='string' && v.startsWith('data:image/') && v.length>40000) lista.push([o,k]);
      else if(v && typeof v==='object') varrer(v);
    });
  };
  Object.keys(state).forEach(k=>{
    if(k==='receitas') return;
    const v = state[k];
    if(typeof v==='string' && v.startsWith('data:image/') && v.length>40000) lista.push([state,k]);
    else if(v && typeof v==='object') varrer(v);
  });
  let alteradas = 0;
  for(const [o,k] of lista){
    const antes = o[k];
    const depois = await comprimirImagemDataUrl(antes, k==='logoApp' ? 256 : 160);
    if(depois.length < antes.length){ o[k] = depois; alteradas++; }
  }
  state.imagensCompactadasV1 = true;
  await persistAgora();
  if(alteradas>0){
    if(typeof aplicarLogoSalva==='function') aplicarLogoSalva();
    renderAll();
    if(typeof showToast==='function') showToast('Imagens otimizadas ('+alteradas+')');
  }
}

/* Banner geométrico (Ponto PJ, Dashboard, Busca): tipo 'positivo'|'negativo', ícone, título, subtítulo (HTML) e progresso 0..1 opcional */
const GEO_ICONES = {
  ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta:'<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>',
  alvo:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12v.01"/>',
  carrinho:'<path d="M3 4h2.5l2 11h10l2-8H7"/><circle cx="9.5" cy="19" r="1.2"/><circle cx="16.5" cy="19" r="1.2"/>',
  moeda:'<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5"/><path d="M12 6.5V8m0 8v1.5"/>',
  relogio:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};
function bannerGeo(tipo, icone, titulo, sub, prog){
  const ico = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GEO_ICONES[icone]||GEO_ICONES.ok}</svg>`;
  const pct = (prog===null || prog===undefined || isNaN(prog)) ? null : Math.max(0, Math.min(1, Number(prog)));
  return `<div class="pj-banner ${tipo==='negativo'?'negativo':''}">
    <div class="pj-banner-ico">${ico}</div>
    <div class="pj-banner-body">
      <div class="pj-banner-title">${titulo}</div>
      ${sub?`<div class="pj-banner-sub">${sub}</div>`:''}
      ${pct!==null?`<div class="pj-banner-prog"><i style="width:${Math.round(pct*100)}%"></i></div>`:''}
    </div>
  </div>`;
}
function fmtMoneyCompactSigned(v){
  const n = Number(v)||0, abs = Math.abs(n), sinal = n<0 ? '-' : '';
  if(abs>=1000000) return sinal+(abs/1000000).toFixed(1).replace('.',',')+'M';
  if(abs>=1000) return sinal+(abs/1000).toFixed(1).replace('.',',').replace(',0','')+'k';
  return sinal+Math.round(abs);
}
function parseMoney(str){
  if(!str) return 0;
  const cleaned = String(str).replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g,'');
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}
function maskMoneyInput(el){
  let digits = el.value.replace(/\D/g,'');
  if(digits===''){ el.value=''; return; }
  digits = digits.replace(/^0+(?=\d)/,'');
  while(digits.length<3) digits = '0'+digits;
  let cents = digits.slice(-2);
  let intPart = digits.slice(0,-2).replace(/^0+(?=\d)/,'');
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  el.value = intPart+','+cents;
}
function handleMoneyKeydown(event){
  if(event.key !== 'Enter') return;
  event.preventDefault();
  event.target.blur();
  const td = event.target.closest('td');
  const nextTd = td && td.nextElementSibling;
  const nextInput = nextTd ? nextTd.querySelector('input') : null;
  if(nextInput){ nextInput.focus(); nextInput.select(); }
}

const PADRAO_SEGQUI_HORAS = 9;
const PADRAO_SEX_HORAS = 8;

/* ================= LOGO PERSONALIZADA (escolhida pelo usuário no dispositivo) ================= */
function aplicarLogoSalva(){
  try{
    const saved = state.logoApp;
    if(saved){
      const img = document.getElementById('headerLogoImg');
      img.src = saved;
      img.style.display = '';
      document.getElementById('headerLogoFallback').style.display = 'none';
    }
  }catch(e){ /* sem logo salva ainda */ }
}

/* ================= ÍCONES SVG (sem emoji) ================= */
const ICON_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const ICON_PRATO = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>';
const ICON_CLOCK_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
const ICON_PORCOES_SM = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const ICON_DUPLICATE_SM = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
const ICON_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const ICON_CHART = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>';
const ICON_ALERT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const ICON_WALLET = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>';
const ICON_TREND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';

/* ================= NAVEGAÇÃO DE ABAS ================= */
function switchAba(aba){
  document.querySelectorAll('.aba').forEach(el=>el.classList.remove('active'));
  document.getElementById('aba-'+aba).classList.add('active');
  document.getElementById('pageLouvorDetalhe')?.classList.remove('active');
  document.getElementById('pageLouvorForm')?.classList.remove('active');
  document.body.style.overflow = '';
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.aba===aba));
  window.scrollTo(0,0);
  if(aba==='ponto') renderPonto();
  if(aba==='planner'){ renderPlanner(); renderPanorama(); }
  if(aba==='louvor') renderLouvor();
  if(aba==='vendas' && typeof renderVendas==='function') renderVendas();
  if(typeof atualizarLvNavBar==='function') atualizarLvNavBar();
  if(typeof updateLayoutBtnVisibility==='function') updateLayoutBtnVisibility(aba);
}
function switchUser(user){
  state.currentUser = user;
  document.getElementById('tabDavi').classList.toggle('active', user==='davi');
  document.getElementById('tabCris').classList.toggle('active', user==='cris');
  persist();
  renderAll();
}

/* ================= CÁLCULOS FINANCEIROS ================= */
const DIZIMO_PERCENT = 0.10;

function rendaBaseForMonth(user, mKey){
  if(user === 'davi'){
    const mesAnterior = addMonths(mKey, -1);
    return computePontoMes(mesAnterior).valorReceber;
  }
  return state.users[user].income[mKey] || 0;
}
function extraNoPeriodo(e, mKey){
  const fim = e.mesFim || e.mesInicio;
  return mKey >= e.mesInicio && mKey <= fim;
}
function extraRecebidoNoMes(e, mKey){ return !!(e.recebidos && e.recebidos[mKey]); }
/* Extras do mês que ainda NÃO foram marcados como recebidos (só esses somam na renda; os recebidos já estão no saldo em conta) */
function extraTotalForMonth(user, mKey){
  return (state.users[user].extras||[]).reduce((sum,e)=>{
    if(extraNoPeriodo(e, mKey) && !extraRecebidoNoMes(e, mKey)) return sum + (Number(e.valor)||0);
    return sum;
  }, 0);
}
function extrasRecebidosNoMes(user, mKey){
  return (state.users[user].extras||[]).filter(e=> extraNoPeriodo(e, mKey) && extraRecebidoNoMes(e, mKey));
}
function setExtraRecebido(user, id, mKey, recebido){
  const e = (state.users[user].extras||[]).find(x=>x.id===id);
  if(!e || !mKey) return false;
  if(!e.recebidos) e.recebidos = {};
  if(recebido) e.recebidos[mKey] = true; else delete e.recebidos[mKey];
  return true;
}
function toggleExtraRecebido(id){
  if(!rendaExtraUser) return;
  const e = (state.users[rendaExtraUser].extras||[]).find(x=>x.id===id);
  if(!e) return;
  setExtraRecebido(rendaExtraUser, id, rendaExtraMes, !extraRecebidoNoMes(e, rendaExtraMes));
  persist();
  renderRendaExtraLista();
  renderRendaTable();
  renderPanorama();
}
/* "Recebi": salário já está dentro do saldo em conta, então para de somar */
function salarioRecebidoNoMes(user, mKey){ return !!(state.salarioRecebido && state.salarioRecebido[user+'_'+mKey]); }
function setSalarioRecebido(user, mKey, recebido){
  if(!state.salarioRecebido) state.salarioRecebido = {};
  if(recebido) state.salarioRecebido[user+'_'+mKey] = true; else delete state.salarioRecebido[user+'_'+mKey];
}
function dizimoPagoNoMes(user, mKey){ return !!(state.dizimoPago && state.dizimoPago[user+'_'+mKey]); }
function setDizimoPago(user, mKey, pago){
  if(!state.dizimoPago) state.dizimoPago = {};
  if(pago) state.dizimoPago[user+'_'+mKey] = true; else delete state.dizimoPago[user+'_'+mKey];
}
function incomeForMonth(user, mKey){
  const isAtual = mKey === mesFinanceiroAtual();
  const saldo = isAtual ? (state.users[user].saldoAtual || 0) : 0;
  const base = salarioRecebidoNoMes(user, mKey) ? 0 : rendaBaseForMonth(user, mKey);
  const extra = extraTotalForMonth(user, mKey);
  return base + extra + saldo;
}
/* Categorias fixas de um chip-picker + categorias que o usuário criou (guardadas em state[customKey]) */
function getCategoriasComCustom(base, customKey){
  return base.concat(state[customKey]||[]);
}
/* valor do dízimo do mês, mesmo se já foi pago (para mostrar na lista) */
function dizimoValorCheio(user, mKey){
  if(user !== 'davi') return 0;
  return rendaBaseForMonth(user, mKey) * DIZIMO_PERCENT;
}
function dizimoForMonth(user, mKey){
  if(user !== 'davi') return 0;
  if(dizimoPagoNoMes(user, mKey)) return 0;   // já pago: não desconta mais
  const base = rendaBaseForMonth(user, mKey);
  return base * DIZIMO_PERCENT;
}

/* ================= RENDA EXTRA (múltiplas entradas, por período) ================= */
let rendaExtraUser = null;
let rendaExtraMes = null; // mês da coluna tocada no Planner: é nele que o botão "Recebido" vale
function abrirRendaExtraModal(user, mKey){
  rendaExtraUser = user;
  rendaExtraMes = mKey;
  document.getElementById('rendaExtraModalUsuario').textContent = user==='davi'?'Davi':'Cris';
  document.getElementById('extraAjudaDaviField').style.display = user==='cris' ? 'block' : 'none';
  resetarFormExtraItem();
  createMonthPicker('extraMesInicioPicker','extraMesInicio', mKey);
  createMonthPicker('extraMesFimPicker','extraMesFim', mKey);
  renderRendaExtraLista();
  document.getElementById('modalRendaExtra').classList.add('active');
}
function resetarFormExtraItem(){
  document.getElementById('extraItemId').value = '';
  document.getElementById('extraItemDesc').value = '';
  document.getElementById('extraItemValor').value = '';
  document.getElementById('extraItemAjudaDavi').checked = false;
  document.getElementById('extraFormTitulo').textContent = 'Novo Extra';
}
function renderRendaExtraLista(){
  const lista = (state.users[rendaExtraUser].extras||[]).slice().sort((a,b)=> b.mesInicio.localeCompare(a.mesInicio));
  const el = document.getElementById('rendaExtraLista');
  if(lista.length===0){
    el.innerHTML = `<div class="empty-state-sm">Nenhum extra cadastrado ainda</div>`;
    return;
  }
  el.innerHTML = lista.map(e=>{
    const fim = e.mesFim || e.mesInicio;
    const periodo = e.mesInicio===fim ? monthLabelExtensoCurto(e.mesInicio) : `${monthLabelExtensoCurto(e.mesInicio)} – ${monthLabelExtensoCurto(fim)}`;
    const noMes = rendaExtraMes && extraNoPeriodo(e, rendaExtraMes);
    const rec = noMes && extraRecebidoNoMes(e, rendaExtraMes);
    const btnRec = noMes ? `<button class="btn-recebido ${rec?'on':''}" onclick="toggleExtraRecebido('${e.id}')">${rec?ICON_CHECK+' Recebido em '+monthLabel(rendaExtraMes):'Marcar recebido em '+monthLabel(rendaExtraMes)}</button>` : '';
    return `<div class="renda-extra-item ${rec?'recebido':''}">
      <div class="rei-info">
        <div class="rei-desc">${e.desc}</div>
        <div class="rei-periodo">${periodo}</div>
        ${btnRec}
      </div>
      <div class="rei-valor">${fmtMoney(e.valor)}</div>
      <div class="rei-actions">
        <button class="btn-icon-sm" onclick="editarExtraItem('${e.id}')">${ICON_EDIT}</button>
        <button class="btn-icon-sm" onclick="excluirExtraItem('${e.id}')">${ICON_TRASH}</button>
      </div>
    </div>`;
  }).join('');
}
function editarExtraItem(id){
  const item = (state.users[rendaExtraUser].extras||[]).find(e=>e.id===id);
  if(!item) return;
  document.getElementById('extraItemId').value = item.id;
  document.getElementById('extraItemDesc').value = item.desc;
  document.getElementById('extraItemValor').value = Number(item.valor).toFixed(2).replace('.',',');
  document.getElementById('extraItemDia').value = item.dia || '';
  document.getElementById('extraItemAjudaDavi').checked = !!item.ajudaDavi;
  selectPickerMonth('extraMesInicioPicker', item.mesInicio);
  selectPickerMonth('extraMesFimPicker', item.mesFim||item.mesInicio);
  document.getElementById('extraFormTitulo').textContent = 'Editar Extra';
}
function salvarExtraItem(){
  const id = document.getElementById('extraItemId').value;
  const desc = document.getElementById('extraItemDesc').value.trim();
  const valor = parseMoney(document.getElementById('extraItemValor').value);
  const dia = parseInt(document.getElementById('extraItemDia').value) || null;
  const ajudaDavi = rendaExtraUser==='cris' && document.getElementById('extraItemAjudaDavi').checked;
  const mesInicio = document.getElementById('extraMesInicio').value;
  const mesFim = document.getElementById('extraMesFim').value;
  if(!desc){ showToast('Digite uma descrição'); return; }
  if(!valor){ showToast('Digite um valor'); return; }
  if(!mesInicio || !mesFim){ showToast('Selecione o período'); return; }
  if(mesFim < mesInicio){ showToast('Mês final não pode ser antes do inicial'); return; }
  if(!state.users[rendaExtraUser].extras) state.users[rendaExtraUser].extras = [];
  if(id){
    const item = state.users[rendaExtraUser].extras.find(e=>e.id===id);
    if(item){ item.desc=desc; item.valor=valor; item.mesInicio=mesInicio; item.mesFim=mesFim; item.dia=dia; item.ajudaDavi=ajudaDavi; }
  } else {
    state.users[rendaExtraUser].extras.push({ id:'ex'+Date.now(), desc, valor, mesInicio, mesFim, dia, ajudaDavi });
  }
  persist();
  resetarFormExtraItem();
  renderRendaExtraLista();
  renderRendaTable();
  renderPanorama();
  showToast('Extra salvo');
}
function excluirExtraItem(id){
  state.users[rendaExtraUser].extras = (state.users[rendaExtraUser].extras||[]).filter(e=>e.id!==id);
  persist();
  renderRendaExtraLista();
  renderRendaTable();
  renderPanorama();
}
function closeRendaExtraModal(){
  document.getElementById('modalRendaExtra').classList.remove('active');
  rendaExtraUser = null;
  rendaExtraMes = null;
}
function futuroValorNoMes(item, mKey){
  // compatibilidade com formato antigo (mês único)
  if(item.mes !== undefined && item.recorrente === undefined && item.parcelas === undefined){
    return item.mes === mKey ? (Number(item.valor)||0) : 0;
  }
  if(item.recorrente){
    return mKey >= item.mesInicio ? (Number(item.valor)||0) : 0;
  }
  const parcelas = item.parcelas || 1;
  const meses = [];
  for(let i=0;i<parcelas;i++) meses.push(addMonths(item.mesInicio, i));
  const idx = meses.indexOf(mKey);
  if(idx === -1) return 0;
  if(item.replicar === false){
    return Number((item.valores||{})[meses[idx]]) || 0;
  }
  return Number(item.valor) || 0;
}
/* Conta com pagamento parcial: só o que falta pagar entra na previsão */
function restanteConta(paidKey, valor){
  const pago = (state.pagamentosParciais||{})[paidKey] || 0;
  return Math.max(valor - pago, 0);
}
function expensesForMonth(user, mKey){
  const ex = state.users[user].expenses;
  let total = 0;
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.mesInicio && mKey < item.mesInicio) return; // ainda não começou a contar
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id;
      if(state.paid[paidKey]) return; // já pago neste mês, não conta mais
      total += restanteConta(paidKey, Number(item.valor)||0);
    });
  });
  ex.futuro.forEach(item=>{
    const v = futuroValorNoMes(item, mKey);
    if(v<=0) return;
    const paidKey = mKey+'_'+user+'_futuro_'+item.id;
    if(state.paid[paidKey]) return;
    total += restanteConta(paidKey, v);
  });
  total += dizimoForMonth(user, mKey);
  total += extrasGeralNoMes(user, mKey).total;
  return total;
}
/* ===== Cartão e Empréstimo dentro do Geral (sobra real) =====
   Interruptor geral por tipo + exceções por mês. Só no Dashboard do Davi (cartões e empréstimos são dele). */
function geralCfg(){
  if(!state.incluirGeral) state.incluirGeral = { cartao:true, emprestimo:true, meses:{} };
  if(!state.incluirGeral.meses) state.incluirGeral.meses = {};
  return state.incluirGeral;
}
function incluiNoGeral(tipo, mKey){
  const cfg = geralCfg();
  const m = cfg.meses[mKey];
  return (m && typeof m[tipo]==='boolean') ? m[tipo] : cfg[tipo] !== false;
}
function cartaoValorGeralNoMes(mKey){
  if(typeof faturaRestanteNoMes!=='function') return 0;
  return (state.cartoesTracker||[]).reduce((s,c)=>s+faturaRestanteNoMes(c, mKey), 0);
}
function emprestimoValorGeralNoMes(mKey){
  if(typeof empPendentes!=='function') return 0;
  return (state.emprestimos||[]).reduce((s,emp)=>s+empPendentes(emp).filter(k=>monthKey(empVencimento(emp,k))===mKey).length*(Number(emp.valorParcela)||0), 0);
}
function extrasGeralNoMes(user, mKey){
  if(user!=='davi' || !state.users) return { cartao:0, emprestimo:0, total:0 };
  const cartao = incluiNoGeral('cartao', mKey) ? cartaoValorGeralNoMes(mKey) : 0;
  const emprestimo = incluiNoGeral('emprestimo', mKey) ? emprestimoValorGeralNoMes(mKey) : 0;
  return { cartao, emprestimo, total: cartao + emprestimo };
}
/* liga/desliga só um mês */
function toggleGeralMes(tipo, mKey){
  const cfg = geralCfg();
  const novo = !incluiNoGeral(tipo, mKey);
  if(!cfg.meses[mKey]) cfg.meses[mKey] = {};
  if(novo === (cfg[tipo] !== false)) delete cfg.meses[mKey][tipo]; else cfg.meses[mKey][tipo] = novo;
  if(!Object.keys(cfg.meses[mKey]).length) delete cfg.meses[mKey];
  persist(); renderPlanner(); renderPanorama();
}
/* liga/desliga em todos os meses (zera as exceções daquele tipo) */
function toggleGeralTudo(tipo){
  const cfg = geralCfg();
  cfg[tipo] = cfg[tipo] === false;
  Object.keys(cfg.meses).forEach(m=>{ delete cfg.meses[m][tipo]; if(!Object.keys(cfg.meses[m]).length) delete cfg.meses[m]; });
  persist(); renderPlanner(); renderPanorama();
  showToast((tipo==='cartao'?'Cartão':'Empréstimo')+(cfg[tipo]?' entra':' sai')+' do Geral em todos os meses');
}
function saldoForMonth(user, mKey){ return incomeForMonth(user,mKey) - expensesForMonth(user,mKey); }
function saldoHouseholdForMonth(mKey){ return saldoForMonth('davi',mKey); } // Dashboard: só Davi

function getPanoWindowMonths(){
  if(state.panoOffset < -1) state.panoOffset = -1;   // pode olhar 1 mês para trás e quantos quiser para a frente
  const base = addMonths(mesFinanceiroAtual(), state.panoOffset);
  const arr = [];
  for(let i=0;i<6;i++) arr.push(addMonths(base,i));
  return arr;
}

/* Contribuição da Cris pro Davi: soma dos extras dela marcados "vai ajudar o Davi" */
function contribCrisForMonth(mKey){
  return (state.users.cris.extras||[]).reduce((sum,e)=>{
    if(!e.ajudaDavi) return sum;
    const fim = e.mesFim || e.mesInicio;
    if(mKey >= e.mesInicio && mKey <= fim) return sum + (Number(e.valor)||0);
    return sum;
  }, 0);
}
