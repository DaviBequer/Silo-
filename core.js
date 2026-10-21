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
    salarioRecebido:{},
    dizimoPago:{},
    faturasCartao:{},
    pontoFechado:{},
    cartoesTracker:[],
    comprasTracker:[],
    metas:[],
    louvores:[],
    ponto:{ valorHora:0, padraoHoras:8, days:{} },
  };
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

/* aba de teste (?teste): não grava no banco NEM na cópia local (que é compartilhada com a aba de verdade) */
const MODO_TESTE_LOCAL = /[?&]teste\b/.test(location.search);
/* --- cópia local: se o banco falhar, a alteração não se perde ao atualizar a página --- */
function espelharLocal(){
  if(MODO_TESTE_LOCAL) return;
  try{
    localStorage.setItem(LOCAL_COPIA_KEY, JSON.stringify(state));
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ t: Date.now(), dirty: true }));
  }catch(e){ /* sem espaço ou bloqueado: segue sem cópia local */ }
}
function marcarLocalSincronizado(){
  if(MODO_TESTE_LOCAL) return;
  try{ localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ t: Date.now(), dirty: false })); }catch(e){}
}
/* cópia em dia dos dados no aparelho: é o que aparece (só leitura) quando não há internet */
function guardarCopiaLocal(){
  if(MODO_TESTE_LOCAL) return;
  try{
    localStorage.setItem(LOCAL_COPIA_KEY, JSON.stringify(state));
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ t: Date.now(), dirty: false }));
  }catch(e){}
}
function lerCopiaLocalQualquer(){
  try{
    const st = JSON.parse(localStorage.getItem(LOCAL_COPIA_KEY) || 'null');
    return (st && typeof st === 'object' && st.users) ? st : null;
  }catch(e){ return null; }
}
function apagarCopiaLocal(){
  if(MODO_TESTE_LOCAL) return;
  try{ localStorage.removeItem(LOCAL_COPIA_KEY); localStorage.removeItem(LOCAL_META_KEY); }catch(e){}
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
  /* resumo que o serviço de notificações lê (só se alguém ativou as notificações) */
  if((state.pushInscricoes||[]).length && typeof calcularAvisosVendas==='function'){
    try{ state.avisos = { vendas: calcularAvisosVendas(), t: Date.now() }; }catch(e){}
  }
  if(typeof atualizarSino==='function') atualizarSino();   // marcou o ponto, vendeu...: o sino acompanha
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
/* ===== MESCLA ENTRE APARELHOS =====
   baseSincronizada = o último estado que este aparelho sabe que está igual ao banco (JSON).
   Se outro aparelho salvou no meio do caminho, junta as duas edições campo a campo:
   o que só um lado mudou fica; se os dois mudaram o mesmo campo, vence a edição daqui (a mais recente).
   Listas de itens com id (contas, cartões, empréstimos...) são mescladas item a item. */
let baseSincronizada = null;
const AUSENTE = undefined;
function mesmoValor(a, b){ return a === b || JSON.stringify(a) === JSON.stringify(b); }
function ehObjeto(v){ return v && typeof v === 'object' && !Array.isArray(v); }
function listaComIds(v){ return Array.isArray(v) && v.length > 0 && v.every(i => ehObjeto(i) && i.id != null); }
function mesclarValor(base, local, remoto){
  if(mesmoValor(local, base)) return remoto;
  if(mesmoValor(remoto, base) || mesmoValor(local, remoto)) return local;
  if(ehObjeto(local) && ehObjeto(remoto)){
    const b = ehObjeto(base) ? base : {};
    const out = {};
    new Set([...Object.keys(remoto), ...Object.keys(local)]).forEach(k=>{
      const v = mesclarValor(b[k], local[k], remoto[k]);
      if(v !== AUSENTE) out[k] = v;
    });
    return out;
  }
  const vazioOuIds = v => (Array.isArray(v) && v.length === 0) || listaComIds(v);
  if(vazioOuIds(local) && vazioOuIds(remoto) && (base === AUSENTE || vazioOuIds(base))){
    const mapa = l => { const m = new Map(); (l||[]).forEach(i => m.set(String(i.id), i)); return m; };
    const mb = mapa(base), ml = mapa(local), mr = mapa(remoto);
    const ordem = [...mr.keys(), ...[...ml.keys()].filter(id => !mr.has(id))];
    const out = [];
    ordem.forEach(id=>{
      const v = mesclarValor(mb.get(id), ml.get(id), mr.get(id));
      if(v !== AUSENTE) out.push(v);
    });
    return out;
  }
  return local;   // os dois mudaram o mesmo campo: fica a edição deste aparelho
}
/* outro aparelho salvou no meio do caminho: busca a versão do banco e mescla com a daqui */
async function tratarConflitoSalvar(){
  if(tratandoConflito) return false;
  tratandoConflito = true;
  try{
    if(!baseSincronizada){
      /* sem base para comparar: vence a edição mais recente (comportamento antigo) */
      const r = await window.SiloSupabase.checarAtualizacao();
      if(!r.ok) return false;
      const tBanco = r.updatedAt ? Date.parse(r.updatedAt) : 0;
      if(tempoUltimaEdicaoLocal() >= tBanco){ await window.SiloSupabase.adotarVersaoDoBanco(); return true; }
      marcarLocalSincronizado();
      location.reload();
      return false;
    }
    const r = await window.SiloSupabase.loadState();   // também passa a usar o updated_at do banco como referência
    if(!r.ok || !r.data) return false;
    const base = JSON.parse(baseSincronizada);
    state = mesclarValor(base, state, r.data);
    baseSincronizada = JSON.stringify(r.data);
    espelharLocal();
    if(typeof renderAll === 'function') renderAll();
    if(typeof showToast === 'function') showToast('Alterações do outro aparelho foram juntadas');
    return true;
  } finally { tratandoConflito = false; }
}
async function tentarSalvarNoBanco(){
  let ok = false, mesclas = 0;
  for(let t=0; t<3 && !ok; t++){
    const enviado = JSON.stringify(state);
    ok = await window.SiloSupabase.saveState(enviado);
    if(ok){ baseSincronizada = enviado; break; }
    if(window.SiloSupabase.conflito){
      if(++mesclas > 5) return false;
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
    if(ok){ guardarCopiaLocal(); atualizarStatusSalvo('salvo'); }
    else { atualizarStatusSalvo('erro'); }
    return ok;
  })();
  const r = await salvandoPromise;
  salvandoPromise = null;
  return r;
}
/* tenta de novo sozinho: ao voltar a internet e a cada 30 s enquanto houver algo pendente */
window.addEventListener('online', ()=>{ if(!remoteReady){ carregarTentativas = 0; carregar(); } else if(salvarPendente) persistAgora(); });
setInterval(()=>{ if(salvarPendente && remoteReady && !salvandoPromise && !persistTimer) persistAgora(); }, 30000);
/* abriu sem internet (mostrando a cópia local): quando a conexão voltar ou o app voltar à tela, tenta carregar de novo */
function tentarNuvemDeNovo(){
  if(remoteReady || document.hidden) return;
  if(document.getElementById('loginTela')?.classList.contains('show')) return;
  carregarTentativas = 0;
  carregar();
}
document.addEventListener('visibilitychange', async ()=>{
  if(document.hidden){ if(persistTimer || salvarPendente) persistAgora(); return; }
  if(!remoteReady){ tentarNuvemDeNovo(); return; }
  /* voltou pro app: se outro aparelho salvou algo novo e aqui não há nada pendente, recarrega */
  if(remoteReady && !salvarPendente && !persistTimer && !salvandoPromise && window.SiloSupabase){
    const r = await window.SiloSupabase.checarAtualizacao();
    if(r.ok && r.mudou && !salvarPendente && !persistTimer && !salvandoPromise) location.reload();
  }
});
window.addEventListener('pagehide', ()=>{ if(persistTimer || salvarPendente) persistAgora(); });

/* uma carga por vez (as novas tentativas podem vir do relógio, da volta da internet ou da volta ao app) */
let carregandoAgora = false;
async function carregar(){
  if(carregandoAgora) return;
  carregandoAgora = true;
  try{ await carregarDaNuvem(); }
  finally{ carregandoAgora = false; }
}
async function carregarDaNuvem(){
  let precisaSalvar = false;
  try{
    let saved = null;
    if(!window.SiloSupabase || !window.SiloSupabase.enabled) throw new Error('Supabase não configurado');
    /* aparelho já conectado: rede ruim não derruba o login (cai na cópia local e tenta de novo) */
    const sessao = await window.SiloSupabase.garantirSessao();
    if(sessao === 'sem-sessao'){ mostrarLogin(); return; }
    if(sessao === 'sem-rede') throw new Error('sem conexão para confirmar o login');
    window.SiloSupabase.pedirArmazenamentoPermanente();
    const r = await window.SiloSupabase.loadState();
    if(!r.ok) throw r.error;
    saved = r.data;
    baseSincronizada = r.data ? JSON.stringify(r.data) : null;
    /* banco protegido e este aparelho ainda não entrou: o registro fica invisível. Pede login em vez de começar do zero */
    if(!saved && !(await window.SiloSupabase.temSessao())){ mostrarLogin(); return; }

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
      /* metas de economia (reserva, viagem...): a antiga "Reserva" vira a primeira meta */
      if(!state.metasEconomia){
        state.metasEconomia = [];
        if((state.reserva||0) > 0 || (state.reservaMeta||0) > 0) state.metasEconomia.push({ id:'reserva', nome:'Reserva', guardado: Number(state.reserva)||0, alvo: Number(state.reservaMeta)||0, porMes: Number(state.reservaAporte)||0 });
        precisaSalvar = true;
      }
      ['reserva','reservaMeta','reservaAporte'].forEach(k=>{ if(k in state){ delete state[k]; precisaSalvar = true; } });
      if(!state.salarioRecebido) state.salarioRecebido = {};
      if(!state.dizimoPago) state.dizimoPago = {};
      if(!state.faturasCartao) state.faturasCartao = {};
      if(!state.pontoFechado) state.pontoFechado = {};
      if(!state.credoVistaCategoriasCustom) state.credoVistaCategoriasCustom = [];
      if(!state.louvores) state.louvores = [];
      /* partes repetidas no padrão "[Refrão | 2x]" (o "Repete" logo depois da mesma parte vira vezes dela) */
      if(typeof lvNormalizarVezes === 'function') state.louvores.forEach(l=>{
        if(typeof l.conteudo !== 'string') return;
        const n = lvNormalizarVezes(l.conteudo);
        if(n !== l.conteudo){ l.conteudo = n; precisaSalvar = true; }
      });
      // migração: garantir campos novos
      (state.cartoesTracker||[]).forEach(c=>{ if(!c.credoVista) c.credoVista=[]; if(!c.assinaturas) c.assinaturas=[]; });
      (state.comprasTracker||[]).forEach(cp=>{ if(cp.pago === undefined) cp.pago=false; });
      delete state.config;
      /* restos de recursos que saíram do app (receitas, mercado, estoque...): só ocupavam espaço no banco */
      ['receitas','receitaCategorias','estoque','listaCompras','preListaCompras','mercadoMeta','mercadoCategoriasCustom','louvorRoteiro','configTema','metaPJ','tarefas','tarefaCategorias','semanaAgenda','semanaOffset','layoutPrefs','layoutV3'].forEach(k=>{
        if(k in state){ delete state[k]; precisaSalvar = true; }
      });
      mesFinanceiroAtrasoRef = state.mesFinanceiroAtraso ? 1 : 0;
      if(state.mesAtual){
        mesAtualRef = state.mesAtual;
      } else {
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
    if(!precisaSalvar) guardarCopiaLocal();   // com algo pendente, a cópia é atualizada depois de gravar
  }catch(e){
    console.error('[LOAD] Erro ao carregar estado:', e);
    remoteReady = false;   // não grava nada até conseguir ler a nuvem
    /* sem internet: mostra os dados da última vez (só leitura) em vez da tela vazia */
    const copia = lerCopiaLocalQualquer();
    if(copia){
      state = Object.assign(novoEstado(), copia);
      if(state.mesAtual) mesAtualRef = state.mesAtual;
      if(state.mesPonto) mesPontoRef = state.mesPonto;
      atualizarStatusSalvo('offline', 'sem internet — mostrando os dados da última vez, só para consulta');
    } else {
      state = novoEstado();
      atualizarStatusSalvo('offline', (window.SiloSupabase&&window.SiloSupabase.lastError)||(e&&e.message)||'erro desconhecido');
    }
    if(carregarTentativas++ < 5) setTimeout(carregar, 8000);
  }
  state.currentUser = usuarioDoAparelho();   // o banco pode ter "cris" salvo por outro aparelho
  limparDadosAntigos();
  if(typeof aplicarLogoSalva==='function') aplicarLogoSalva();
  if(typeof aplicarFundoApp==='function') aplicarFundoApp();
  renderAll();
  fecharSplash();
  if(typeof abrirAbaDoAviso==='function') abrirAbaDoAviso();
  if(typeof lviAbrirCompartilhado==='function') lviAbrirCompartilhado();
  if(typeof avisosRenovarSozinho==='function' && !MODO_TESTE_LOCAL) avisosRenovarSozinho();
  if(typeof pinLembrarAparelho==='function') pinLembrarAparelho();
  if(typeof aparelhoRegistrar==='function') aparelhoRegistrar();
  if(typeof applyAllLayouts==='function') applyAllLayouts();
  if(precisaSalvar && remoteReady) await persistAgora();   // ajustes da carga (itens antigos limpos etc.)
  compactarImagensDoEstado();
}
/* ===== ABERTURA (logo animada) ===== */
/* fica pelo menos o tempo da animação de entrada, para não "piscar" quando os dados chegam rápido */
const SPLASH_MINIMO_MS = 2600;   // + 1,4 s da saída suave = abertura de 4 s
function fecharSplash(imediato){
  const el = document.getElementById('splash');
  const sair = ()=>{
    document.body.classList.remove('carregando');
    document.getElementById('metaCorTema')?.setAttribute('content', '#f5f1ea');   // barra de status creme, igual ao cabeçalho claro
    if(!el) return;
    el.classList.add('saindo');
    setTimeout(()=>el.classList.add('oculta'), 1450);
    /* enquanto a abertura some: cartões entram e os números contam */
    setTimeout(()=>{
      const aba = document.querySelector('.aba.active');
      if(aba && typeof efeitoEntradaCartoes==='function'){ efeitoEntradaCartoes(aba); efeitoContarNumeros(aba); efeitoContarSaldo(); }
    }, 250);
  };
  const falta = SPLASH_MINIMO_MS - performance.now();
  if(imediato || falta <= 0) sair(); else setTimeout(sair, falta);
}
function mostrarSplash(){
  document.body.classList.add('carregando');
  document.getElementById('metaCorTema')?.setAttribute('content', '#000000');
  const el = document.getElementById('splash');
  if(el) el.classList.remove('saindo', 'oculta');
}
/* ===== LOGIN (só aparece quando o banco exige) ===== */
function mostrarLogin(){
  fecharSplash(true);
  document.getElementById('loginTela')?.classList.add('show');
  /* o PIN é a entrada principal (só não abre nele se este aparelho já sabe que o PIN foi desligado) */
  if(typeof loginModoPin==='function' && pinLigadoNoAparelho()){ loginModoPin(true); return; }
  if(typeof loginModoPin==='function') loginModoPin(false);
  setTimeout(()=>document.getElementById('loginEmail')?.focus(), 100);
}
/* olho da senha: mostra/esconde (sem argumento alterna; false volta a esconder) */
const OLHO_ABERTO = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
const OLHO_FECHADO = '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.16 3.19"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>';
function alternarVerSenha(mostrar){
  const inp = document.getElementById('loginSenha'), btn = document.getElementById('loginOlho');
  if(!inp || !btn) return;
  const ver = mostrar === undefined ? inp.type === 'password' : !!mostrar;
  inp.type = ver ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = ver ? OLHO_FECHADO : OLHO_ABERTO;
  btn.setAttribute('aria-label', ver ? 'Esconder senha' : 'Mostrar senha');
  btn.title = ver ? 'Esconder senha' : 'Mostrar senha';
  if(mostrar === undefined) inp.focus();
}
async function entrarNoApp(){
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;
  const btn = document.getElementById('loginBtn');
  const erro = document.getElementById('loginErro');
  if(!email || !senha) return;
  btn.disabled = true; btn.textContent = 'Entrando…'; erro.textContent = '';
  const r = await window.SiloSupabase.entrar(email, senha);
  btn.disabled = false; btn.textContent = 'Entrar';
  if(!r.ok){ erro.textContent = r.erro; return; }
  if(typeof pinGuardarEmail==='function') pinGuardarEmail(email);   // o PIN deste aparelho passa a saber o e-mail
  document.getElementById('loginSenha').value = '';
  alternarVerSenha(false);
  aposEntrar();
}
function aposEntrar(){
  document.getElementById('loginTela').classList.remove('show');
  mostrarSplash();
  carregarTentativas = 0;
  carregar();
}
async function sairDoApp(){
  if(salvarPendente || persistTimer){
    const ok = await persistAgora();
    if(!ok && !(await iosConfirm('Há alterações que ainda não chegaram ao banco (sem conexão?). Sair mesmo assim? Elas serão perdidas.'))) return;
  }
  await window.SiloSupabase.sair();
  apagarCopiaLocal();   // a cópia dos dados que fica no aparelho sai junto
  location.reload();
}
/* celular perdido/trocado: desconecta todos os aparelhos (este também) */
async function sairDeTodosAparelhos(){
  if(!(await iosConfirm('Desconectar TODOS os aparelhos? Cada um (inclusive este) vai pedir e-mail e senha de novo.'))) return;
  if(salvarPendente || persistTimer) await persistAgora();
  const ok = await window.SiloSupabase.sairDeTodos();
  if(!ok){ showToast('Sem conexão — tente de novo'); return; }
  apagarCopiaLocal();
  location.reload();
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
/* logos aparecem com no máximo 56px: 112px cobre telas retina. Sem transparência vira JPEG (bem menor que PNG) */
function imagemTemTransparencia(cv){
  try{
    const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for(let i=3; i<px.length; i+=4){ if(px[i] < 250) return true; }
    return false;
  }catch(e){ return true; }
}
function comprimirImagemDataUrl(dataUrl, lado, qualidade){
  lado = lado || 112; qualidade = qualidade || 0.85;
  return new Promise(resolve=>{
    try{
      const img = new Image();
      img.onload = ()=>{
        try{
          const esc = Math.min(1, lado/Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width*esc)), h = Math.max(1, Math.round(img.height*esc));
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const out = imagemTemTransparencia(cv) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', qualidade);
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
// Uma vez só: reduz as logos que já estão salvas para o tamanho em que aparecem na tela
async function compactarImagensDoEstado(){
  if(!remoteReady || state.imagensCompactadasV2) return;
  const lista = [];
  const varrer = (o)=>{
    if(!o || typeof o!=='object') return;
    Object.keys(o).forEach(k=>{
      const v = o[k];
      if(typeof v==='string' && v.startsWith('data:image/') && v.length>12000 && k !== 'img') lista.push([o,k]);   // 'img' = foto de fundo: já vem no tamanho certo
      else if(v && typeof v==='object') varrer(v);
    });
  };
  varrer(state);
  let alteradas = 0;
  for(const [o,k] of lista){
    const antes = o[k];
    const depois = await comprimirImagemDataUrl(antes, k==='logoApp' ? 192 : 112);
    if(depois.length < antes.length){ o[k] = depois; alteradas++; }
  }
  delete state.imagensCompactadasV1;
  state.imagensCompactadasV2 = true;
  await persistAgora();
  if(alteradas>0){
    if(typeof aplicarLogoSalva==='function') aplicarLogoSalva();
    if(typeof aplicarFundoApp==='function') aplicarFundoApp();
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
const ICON_BAN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_UNLOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
const ICON_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
const ICON_CHART = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>';
const ICON_WALLET = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>';
/* logos de marca (cores próprias) e ícones dos botões só-ícone */
const LOGO_DRIVE = '<svg class="logo-marca" width="18" height="16" viewBox="0 0 87.3 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>';
const LOGO_WHATS = '<svg class="logo-marca" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/><path fill="#fff" d="M16.5 14.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';
const ICO = (d, t = 18)=>`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO_D = {
  historico:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  banco:'<path d="M3 21h18"/><path d="M5 21V10"/><path d="M19 21V10"/><path d="M9 21v-7"/><path d="M15 21v-7"/><path d="m12 3 9 5H3z"/>',
  meta:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  simular:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 15h.01"/><path d="M12 15h.01"/><path d="M16 15v3"/><path d="M8 18h4"/>',
  config:'<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  copiar:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  vista:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  parcelada:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 15h2"/><path d="M14 15h2"/>',
  assinatura:'<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  ajuste:'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  olho:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  arquivo:'<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  grafico:'<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  parte:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 12h9"/>',
  mais:'<path d="M12 5v14"/><path d="M5 12h14"/>',
  menos:'<path d="M5 12h14"/>',
  abrir:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  baixar:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  lixo:'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  abaixo:'<polyline points="6 9 12 15 18 9"/>',
  acima:'<polyline points="18 15 12 9 6 15"/>',
  camadas:'<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'
};
const ICON_TREND ='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';

/* ================= NAVEGAÇÃO DE ABAS ================= */
function switchAba(aba){
  document.querySelectorAll('.aba').forEach(el=>el.classList.remove('active'));
  document.getElementById('aba-'+aba).classList.add('active');
  document.getElementById('pageLouvorDetalhe')?.classList.remove('active');
  document.getElementById('pageLouvorForm')?.classList.remove('active');
  document.getElementById('pageLouvorMedley')?.classList.remove('active');
  document.getElementById('pageCulto')?.classList.remove('active');
  document.body.style.overflow = '';
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.aba===aba));
  window.scrollTo(0,0);
  if(aba==='ponto') renderPonto();
  if(aba==='planner'){ renderPlanner(); renderPanorama(); }
  if(aba==='louvor') renderLouvor();
  if(aba==='vendas' && typeof renderVendas==='function') renderVendas();
  if(aba==='comando' && typeof renderComando==='function'){ garantirEstadoComando(); renderComando(); }
  if(aba==='ajustes' && typeof renderAjustes==='function') renderAjustes();
  if(typeof efeitoAoTrocarAba==='function') efeitoAoTrocarAba(aba);
}
/* Davi/Cris é escolha de cada aparelho (fica no aparelho, não no banco): escolher Cris num celular não muda os outros */
const CHAVE_USUARIO = 'siloe-usuario';
function usuarioDoAparelho(){
  try{ const u = localStorage.getItem(CHAVE_USUARIO); return u === 'cris' ? 'cris' : 'davi'; }catch(e){ return 'davi'; }
}
function marcarAbasUsuario(){
  const u = state.currentUser === 'cris' ? 'cris' : 'davi';
  document.getElementById('tabDavi')?.classList.toggle('active', u==='davi');
  document.getElementById('tabCris')?.classList.toggle('active', u==='cris');
}
function switchUser(user){
  state.currentUser = user;
  try{ localStorage.setItem(CHAVE_USUARIO, user); }catch(e){}
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
  comDesfazer('Extra excluído', ()=>{
    state.users[rendaExtraUser].extras = (state.users[rendaExtraUser].extras||[]).filter(e=>e.id!==id);
    persist();
    renderRendaExtraLista();
    renderRendaTable();
    renderPanorama();
  }, ()=>{ if(typeof renderRendaExtraLista==='function') renderRendaExtraLista(); });
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
  return Math.max(valor - pago - contaUsadaNoCartao(paidKey), 0);
}
/* Conta-reserva: uma conta com o mesmo nome de uma categoria do cartão (ex.: "Mercado") já foi gasta em parte
   no cartão (compras à vista dessa categoria na fatura do mês) — essa parte sai da conta para não contar duas vezes
   (ela já está na fatura). paidKey = mês_usuário_categoria_id */
function semAcentoCore(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function contaUsadaNoCartao(paidKey){
  const p = String(paidKey).split('_');
  const mKey = p[0], user = p[1], cat = p[2], id = p.slice(3).join('_');
  if(!state.users || !state.users[user]) return 0;
  const item = ((state.users[user].expenses||{})[cat]||[]).find(i=>String(i.id) === id);
  if(!item || !item.desc) return 0;
  const nome = semAcentoCore(item.desc);
  let usado = 0;
  if(user === 'davi') (state.cartoesTracker||[]).forEach(c=>(c.credoVista||[]).forEach(cv=>{
    if(cv.mKey === mKey && !cv.ajuste && semAcentoCore(cv.categoria) === nome) usado += Number(cv.valor)||0;
  }));
  /* compras faladas no Pix/débito (state.lancamentos) da mesma categoria também contam */
  (state.lancamentos||[]).forEach(la=>{
    if(la.mKey === mKey && (la.usuario || 'davi') === user && semAcentoCore(la.categoria) === nome) usado += Number(la.valor)||0;
  });
  return Math.round(usado*100)/100;
}
/* cada gasto (Moradia, Assinaturas, Fixos, Contas futuras) que vale no mês, com quanto falta pagar.
   Mesma regra de expensesForMonth: é a lista que soma na linha "Gastos" do Fluxo Mensal */
function gastosDoMes(user, mKey){
  const ex = state.users[user].expenses, out = [];
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.arquivado) return;
      if(item.mesInicio && mKey < item.mesInicio) return;
      const paidKey = mKey+'_'+user+'_'+cat+'_'+item.id, valor = Number(item.valor)||0;
      const pago = !!state.paid[paidKey];
      out.push({ cat, desc:item.desc||'Conta', logoUrl:item.logoUrl, dia:item.dia, valor, pago, restante: pago ? 0 : restanteConta(paidKey, valor) });
    });
  });
  ex.futuro.forEach(item=>{
    const valor = futuroValorNoMes(item, mKey);
    if(valor<=0) return;
    const paidKey = mKey+'_'+user+'_futuro_'+item.id;
    const pago = !!state.paid[paidKey];
    out.push({ cat:'futuro', desc:item.desc||'Conta', logoUrl:item.logoUrl, dia:item.dia, valor, pago, restante: pago ? 0 : restanteConta(paidKey, valor) });
  });
  return out;
}
function gastosRestantesNoMes(user, mKey){ return gastosDoMes(user, mKey).reduce((s,g)=>s+g.restante, 0); }
function expensesForMonth(user, mKey){
  const ex = state.users[user].expenses;
  let total = 0;
  ['moradia','assinatura','fixo'].forEach(cat=>{
    ex[cat].forEach(item=>{
      if(item.arquivado) return;
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

function getPanoWindowMonths(){
  if(state.panoOffset < -1) state.panoOffset = -1;   // pode olhar 1 mês para trás e quantos quiser para a frente
  const base = addMonths(mesFinanceiroAtual(), state.panoOffset);
  const arr = [];
  for(let i=0;i<6;i++) arr.push(addMonths(base,i));
  return arr;
}

