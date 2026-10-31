/* ========== CABEÇALHO: data de hoje, dias até o fim do mês e quanto falta pagar ========== */
/* Falta pagar = gastos do mês do Dashboard que ainda não foram pagos (some quando você paga)
   + a meta de sobra do mês definida em Vendas (o que você quer guardar também "precisa sair" do saldo) */
function headerFaltaPagar(){
  if(!remoteReady || !state || !state.users || typeof computePontoMes!=='function') return null;   // só depois que tudo carregou
  const u = (typeof userDash==='function') ? userDash() : 'davi';
  const m = mesFinanceiroAtual();
  const gastos = expensesForMonth(u, m);
  const meta = (u==='davi' && typeof vendasMeta==='function') ? (vendasMeta(m) || 0) : 0;
  return { m, gastos, meta, total: gastos + meta };
}
function headerFaltaDetalhe(){
  const f = headerFaltaPagar(); if(!f) return;
  showToast(f.meta ? `A juntar em ${monthLabel(f.m)}: ${fmtMoney(f.gastos)} de contas + ${fmtMoney(f.meta)} de meta` : `A pagar em ${monthLabel(f.m)}: ${fmtMoney(f.gastos)}`);
}
function renderHeaderHoje(){
  const el = document.getElementById('headerHoje');
  if(!el) return;
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const faltam = ultimo - hoje.getDate();
  const data = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' de '+MES_NOMES_LONGOS[hoje.getMonth()].toLowerCase();
  const dataCurta = DIA_SEMANA[hoje.getDay()]+', '+hoje.getDate()+' '+MES_NOMES[hoje.getMonth()].toLowerCase();
  /* "14 dias – R$ 9.266,28": dias até o fim do mês e o que falta pagar */
  const resto = faltam===0 ? 'último dia' : faltam+' dia'+(faltam>1?'s':'');
  const restoCurto = resto;
  const f = headerFaltaPagar();
  const falta = f ? `<button type="button" class="hh-falta${f.total>0.004?'':' ok'}" onclick="headerFaltaDetalhe()" title="Gastos que faltam pagar${f.meta?' + meta de sobra':''} em ${monthLabel(f.m)}">${f.total>0.004?`<b>${fmtMoney(f.total)}</b> <span class="hh-rotulo">${f.meta?'a juntar':'a pagar'}</span>`:'<b>✓ Tudo pago</b>'}</button>` : '';
  el.innerHTML = `<div class="hh-linha1"><span class="hh-longo">${data}</span><span class="hh-curto">${dataCurta}</span></div>
    <div class="hh-linha2"><span class="hh-longo">${resto}</span><span class="hh-curto">${restoCurto}</span>${falta?'<span class="hh-sep">–</span>'+falta:''}</div>`;
}
renderHeaderHoje();
setInterval(renderHeaderHoje, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) renderHeaderHoje(); });

/* ========== ENTER = PRÓXIMO CAMPO (janelas e subpáginas) ==========
   Enter num campo pula para o próximo campo visível da mesma janela; no último, fecha o teclado.
   Campos que já tratam o Enter por conta própria (onkeydown) ficam de fora. */
function camposNavegaveis(container){
  return [...container.querySelectorAll('input, select, textarea')].filter(el=>
    !el.disabled && !el.readOnly && el.type!=='file' && el.type!=='checkbox' && el.type!=='radio' && el.type!=='hidden' &&
    el.offsetParent !== null);
}
function containerDoCampo(el){ return el.closest('.modal, .fullpage, .aba'); }
document.addEventListener('focusin', e=>{
  const el = e.target;
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.hasAttribute('onkeydown')) return;
  const box = containerDoCampo(el);
  if(!box || !box.closest('.modal, .fullpage')) return;
  const lista = camposNavegaveis(box);
  el.setAttribute('enterkeyhint', lista.indexOf(el) < lista.length-1 ? 'next' : 'done');   // tecla "Próximo" no teclado do celular
});
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter' || e.isComposing || e.defaultPrevented) return;
  const el = e.target;
  if(!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.hasAttribute('onkeydown')) return;
  const box = containerDoCampo(el);
  if(!box || !box.closest('.modal, .fullpage')) return;
  const lista = camposNavegaveis(box);
  const i = lista.indexOf(el);
  if(i === -1) return;
  e.preventDefault();   // o "change" do campo dispara sozinho quando o foco sai dele
  const prox = lista[i+1];
  if(prox){ prox.focus(); if(prox.select && prox.type!=='date' && prox.type!=='number') try{ prox.select(); }catch(_){} }
  else el.blur();
});

/* ========== RENDERIZAÇÃO ========== */
function renderAll(){
  marcarAbasUsuario();   // botões Davi/Cris sempre iguais aos dados mostrados
  renderPanorama();
  renderPlanner();
  renderPonto();
  renderLouvor();
  if(typeof renderEmprestimos==='function') renderEmprestimos();
  if(typeof renderVendas==='function') renderVendas();
  if(typeof renderVersiculo==='function') renderVersiculo();
  if(typeof atualizarSino==='function') atualizarSino();
}

/* ========== STORAGE & BACKUP ========== */
function calcularStorageUsage(){
  // Tamanho dos dados guardados no Supabase (estado completo em JSON)
  let usado = 0;
  try{
    usado = new TextEncoder().encode(JSON.stringify(state)).length;
  }catch(e){
    console.error('[CALC-STORAGE] ERRO:', e);
  }
  const total = 5 * 1024 * 1024;
  const percentual = Math.min(100, Math.round((usado / total) * 100));
  return { usado, total, percentual };
}


function renderChangelog(){
  const el = document.getElementById('changelogList');
  if(!el) return;
  const v = CHANGELOG[0];
  el.innerHTML = `
    <div style="padding:8px 10px;background:var(--card-2);border-radius:8px">
      <div style="font-weight:600;font-size:12px;color:var(--text);margin-bottom:3px">${String(v.versao).replace(/^v(\d+)\.(\d+)$/, 'Nº $1$2')}</div>
      ${v.itens.map(txt => `<div style="font-size:11.5px;color:var(--text-faint);line-height:1.4">• ${txt}</div>`).join('')}
    </div>
  `;
}

/* aba Ajustes (antes a janela "Dados do App"): atualiza o que muda ao abrir */
function abrirImportExportModal(){ switchAba('ajustes'); }
function renderAjustes(){
  renderChangelog();
  const btnSair = document.getElementById('btnSairApp');   // só aparece se este aparelho entrou com login
  if(btnSair && window.SiloSupabase) window.SiloSupabase.temSessao().then(s=>{
    document.getElementById('segConteudo').style.display = s ? '' : 'none';
    const cv = document.getElementById('ddContaVazio'); if(cv) cv.style.display = s ? 'none' : '';
    if(s) renderSeguranca();
  });
  if(typeof atualizarStatusFundo==='function') atualizarStatusFundo();

  const storage = calcularStorageUsage();
  
  const usedMB = (storage.usado / (1024*1024)).toFixed(2);
  
  const bar = document.getElementById('storageBar');
  
  bar.style.width = storage.percentual + '%';
  let gradient;
  if(storage.percentual <= 33) gradient = '#10b981';
  else if(storage.percentual <= 66) gradient = '#f59e0b';
  else gradient = '#ef4444';
  bar.style.background = gradient;
  
  document.getElementById('storagePercent').textContent = storage.percentual + '%';
  
  document.getElementById('storageUsed').textContent = usedMB + ' MB';
  atualizarStatusIA();
  atualizarStatusAvisos();
}

/* ===== NOTIFICAÇÕES (ponto e vendas) =====
   O serviço "avisos" do Supabase (pasta .claude/supabase-avisos) manda as notificações nos horários; aqui o aparelho
   só se inscreve. A inscrição fica em state.pushInscricoes (uma por aparelho). Só funciona no app publicado (no localhost
   o service worker fica desligado). */
const AVISOS_CHAVE_PUBLICA = 'BDTT66dSw6A5e4hdJwX7IQAs4B3sEMIUvhtNCL8qiC9J4E6D_IB8M_r-iB9uHEJJVqA9HambwXwLB18NRWx-MU4';
function avisosSuportado(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function avisosChaveBytes(){
  const b = atob(AVISOS_CHAVE_PUBLICA.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(b, c=>c.charCodeAt(0));
}
async function avisosInscricaoAtual(){
  try{ const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; }catch(e){ return null; }
}
async function atualizarStatusAvisos(){
  const st = document.getElementById('avisosStatus'), btn = document.getElementById('avisosBtn');
  if(!st || !btn) return;
  if(!avisosSuportado()){ st.textContent = 'Indisponível aqui'; btn.style.display = 'none'; return; }
  const sub = await avisosInscricaoAtual();
  const ligado = !!sub && Notification.permission === 'granted' && (state.pushInscricoes||[]).some(p=>p.endpoint === sub.endpoint);
  st.textContent = ligado ? 'Ligadas neste aparelho' : Notification.permission === 'denied' ? 'Bloqueadas no navegador' : 'Desligadas';
  st.classList.toggle('ligada', ligado);
  btn.style.display = '';
  btn.textContent = ligado ? 'Desligar neste aparelho' : 'Ativar notificações';
  btn.onclick = ligado ? desligarAvisos : ativarAvisos;
}
/* guarda a inscrição deste aparelho e tira a antiga dele (a que o celular trocou ou a de antes de reinstalar) */
function avisosNomeAparelho(){ return /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : 'Computador'; }
function avisosGuardarInscricao(sub){
  try{ localStorage.removeItem('siloe-avisos-desligado'); }catch(e){}
  const j = sub.toJSON(), aparelho = avisosNomeAparelho(), ua = navigator.userAgent;
  let anterior = ''; try{ anterior = localStorage.getItem('siloe-avisos-endpoint') || ''; }catch(e){}
  const lista = (state.pushInscricoes || []).filter(p=>
    p.endpoint !== j.endpoint && p.endpoint !== anterior &&
    !(p.aparelho === aparelho && (!p.ua || p.ua === ua)));   // mesma pessoa, mesmo aparelho: a velha sai
  lista.push({ id: 'p' + j.endpoint.slice(-20).replace(/[^\w]/g,''), endpoint: j.endpoint, keys: j.keys, aparelho, ua, criadoEm: Date.now() });
  state.pushInscricoes = lista;
  try{ localStorage.setItem('siloe-avisos-endpoint', j.endpoint); }catch(e){}
}
/* sempre um endereço novo: cancela o que o celular tinha e inscreve de novo */
async function avisosInscricaoNova(reg){
  try{ const velha = await reg.pushManager.getSubscription(); if(velha) await velha.unsubscribe(); }catch(e){}
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: avisosChaveBytes() });
  try{ localStorage.setItem('siloe-avisos-renovado', String(Date.now())); }catch(e){}
  return sub;
}
/* ao abrir: se as notificações estão permitidas, confere se a inscrição deste aparelho ainda vale e renova sozinho */
async function avisosRenovarSozinho(){
  try{
    if(!avisosSuportado() || Notification.permission !== 'granted') return;
    try{ if(localStorage.getItem('siloe-avisos-desligado') === '1') return; }catch(e){}
    let anterior = ''; try{ anterior = localStorage.getItem('siloe-avisos-endpoint') || ''; }catch(e){}
    const usava = anterior || (state.pushInscricoes || []).some(p=>p.aparelho === avisosNomeAparelho());
    if(!usava) return;   // nunca ativou neste aparelho
    const reg = await navigator.serviceWorker.getRegistration(); if(!reg) return;
    /* o celular pode guardar um endereço que o Google já descartou (o servidor recebe "410"):
       a cada 3 dias joga fora e pede um novo, para nunca ficar preso num endereço morto */
    let ultima = 0; try{ ultima = Number(localStorage.getItem('siloe-avisos-renovado')) || 0; }catch(e){}
    const renovar = Date.now() - ultima > 3 * 86400000;
    let sub = await reg.pushManager.getSubscription();
    if(!renovar && sub && (state.pushInscricoes || []).some(p=>p.endpoint === sub.endpoint)) return;   // já está certo
    sub = await avisosInscricaoNova(reg);
    avisosGuardarInscricao(sub);
    persist();
  }catch(e){}
}
async function ativarAvisos(){
  if(!avisosSuportado()){ showToast('Este navegador não recebe notificações'); return; }
  const reg = await navigator.serviceWorker.getRegistration();
  if(!reg){ showToast('Abra pelo app instalado (no endereço publicado) para ativar'); return; }
  const perm = await Notification.requestPermission();
  if(perm !== 'granted'){ showToast(perm === 'denied' ? 'Notificações bloqueadas — libere nas configurações do celular' : 'Permissão não concedida'); atualizarStatusAvisos(); return; }
  try{
    const sub = await avisosInscricaoNova(reg);
    avisosGuardarInscricao(sub);
    persist();
    reg.showNotification('Siloé', { body: 'Notificações ligadas: ponto e vendas.', icon: './icon-192.png', badge: './splash-cordeiro.png' });
  }catch(e){ showToast('Não consegui ativar: ' + ((e && e.message) || e)); }
  atualizarStatusAvisos();
}
async function desligarAvisos(){
  const sub = await avisosInscricaoAtual();
  if(sub){ state.pushInscricoes = (state.pushInscricoes || []).filter(p=>p.endpoint !== sub.endpoint); try{ await sub.unsubscribe(); }catch(e){} persist(); }
  try{ localStorage.removeItem('siloe-avisos-endpoint'); localStorage.setItem('siloe-avisos-desligado', '1'); }catch(e){}   // não renova sozinho
  showToast('Notificações desligadas neste aparelho');
  atualizarStatusAvisos();
}
/* tocou numa notificação: abre na aba dela (#ponto, #vendas) */
function abrirAbaDoAviso(aba){
  aba = aba || (location.hash || '').slice(1);
  if(['ponto','vendas','planner','louvor'].includes(aba)){
    switchAba(aba);
    if(location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
}
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e=>{ if(e.data && e.data.abrirAba) abrirAbaDoAviso(e.data.abrirAba); });

/* ===== Chave da IA (Google Gemini) para o Importar/Organizar do Louvor =====
   Fica nos dados protegidos pelo login (não vai no backup exportado). */
function atualizarStatusIA(){
  const tem = !!String(state.iaGoogleChave||'').trim();
  const st = document.getElementById('iaStatus'), inp = document.getElementById('iaChaveInput');
  if(st){ st.textContent = tem ? 'Ligada' : 'Desligada'; st.classList.toggle('ligada', tem); }
  if(inp) inp.placeholder = tem ? 'Chave salva ✓' : 'Cole a chave aqui';
  const rem = document.getElementById('iaRemover'); if(rem) rem.style.display = tem ? '' : 'none';
  if(typeof atualizarStatusDrive === 'function') atualizarStatusDrive();
  if(typeof atzRenderApelidos === 'function') atzRenderApelidos();
  [['iaModeloInput', 'iaModelo'], ['iaModeloRapidoInput', 'iaModeloRapido']].forEach(([id, k])=>{ const el = document.getElementById(id); if(el && document.activeElement !== el) el.value = state[k] || ''; });
  const ins = document.getElementById('iaInstrucoesInput');
  if(ins && document.activeElement !== ins) ins.value = iaInstrucoes();
}
/* instruções do Davi para a IA do Louvor (state.iaInstrucoes; vazio = as do padrão abaixo) */
const IA_INSTRUCOES_PADRAO = [
  'Nomes das partes: Intro, Primeira Parte, Segunda Parte, Terceira Parte, Pré-Refrão, Refrão, Ponte, Solo, Final.',
  'Parte cantada mais de uma vez seguida: escreva a letra uma vez e ponha as vezes (2x, 3x).',
  'Hino da Harpa Cristã: depois de cada parte vem o Refrão (Primeira Parte, Refrão, Segunda Parte, Repete - Refrão...).',
  'Jesus, Deus, Senhor, Cristo, Espírito Santo e os pronomes de Deus (Ele, Tu, Teu, Tua, Te, Ti, Contigo, Dele) sempre com maiúscula.',
  'Início de cada verso com maiúscula; no meio do verso só nomes próprios com maiúscula.',
  'Sem ponto final nem ponto no meio do verso.',
  'Verso curto, como se canta (até umas 40 letras); verso longo com duas frases vira duas linhas.',
  'Intro e Introdução ficam sempre, com os acordes.',
  'Nada de créditos, compositor, cantor, site ou rodapé no meio da letra.'
].join('\n');
function iaInstrucoes(){ return typeof state.iaInstrucoes === 'string' && state.iaInstrucoes.trim() ? state.iaInstrucoes : IA_INSTRUCOES_PADRAO; }
function salvarIaInstrucoes(v){
  v = String(v || '').trim();
  state.iaInstrucoes = v && v !== IA_INSTRUCOES_PADRAO ? v : '';
  persist();
  showToast('Instruções da IA salvas');
}
function iaInstrucoesPadrao(){
  state.iaInstrucoes = '';
  persist();
  const ins = document.getElementById('iaInstrucoesInput'); if(ins) ins.value = IA_INSTRUCOES_PADRAO;
  showToast('Instruções no padrão');
}
function salvarChaveIA(){
  const inp = document.getElementById('iaChaveInput');
  const v = (inp.value||'').trim();
  if(!v){ inp.focus(); return; }
  state.iaGoogleChave = v;
  inp.value = '';
  persist();
  atualizarStatusIA();
  showToast('Chave salva — o Importar agora usa a IA');
}
async function removerChaveIA(){
  if(!(await iosConfirm('Remover a chave? O Importar volta a usar a leitura simples.'))) return;
  state.iaGoogleChave = '';
  persist();
  atualizarStatusIA();
}

/* ================= IMPORTAR / EXPORTAR TODOS OS DADOS ================= */
function montarBackupApp(){
  const versaoEl = document.querySelector('.header-version');
  return {
    app: 'Siloe',
    versaoApp: versaoEl ? versaoEl.textContent.trim() : '',
    exportadoEm: new Date().toISOString(),
    mesAtual: mesAtualRef,
    mesPonto: mesPontoRef,
    state: Object.assign({}, state, { iaGoogleChave: undefined })   // a chave da IA não vai junto no backup
  };
}
function exportarDadosApp(){
  const backup = montarBackupApp();
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
  state.ultimoBackup = Date.now(); persist();
  if(typeof atualizarSino === 'function') atualizarSino();
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
      const novo = Object.assign(novoEstado(), backup.state);
      if(backup.mesAtual) novo.mesAtual = backup.mesAtual;
      if(state.iaGoogleChave) novo.iaGoogleChave = state.iaGoogleChave;   // o backup não traz a chave: mantém a atual
      state = novo;
      persistAgora().then(salvou=>{
        if(salvou) location.reload();
        else showToast('Erro ao importar: '+((window.SiloSupabase&&window.SiloSupabase.lastError)||'sem conexão com o Supabase'));
      });
    });
  };
  reader.readAsText(file);
}

/* ========== BUSCA GLOBAL ========== */
/* ---------- Nova categoria (Assinatura e Crédito à vista do cartão) ---------- */
function abrirNovaCategoriaExtra(alvo){
  document.getElementById('categoriaExtraAlvo').value = alvo;
  document.getElementById('categoriaExtraNome').value = '';
  document.getElementById('modalCategoriaExtra').classList.add('active');
}
function salvarCategoriaExtra(){
  const alvo = document.getElementById('categoriaExtraAlvo').value;
  const nome = document.getElementById('categoriaExtraNome').value.trim();
  if(!nome){ showToast('Digite o nome da categoria'); return; }
  const config = { customKey:'credoVistaCategoriasCustom', base:CREDOVISTA_CATEGORIAS };
  if(!state[config.customKey]) state[config.customKey] = [];
  const jaExiste = config.base.some(c=>c.toLowerCase()===nome.toLowerCase()) || state[config.customKey].some(c=>c.toLowerCase()===nome.toLowerCase());
  if(jaExiste){ showToast('Essa categoria já existe'); closeModal('modalCategoriaExtra'); return; }
  state[config.customKey].push(nome);
  persist();
  closeModal('modalCategoriaExtra');
  if(alvo==='assinatura'){
    window.assinaturaCategoriaSelecionada = nome;
    renderAssinaturaCategoriaChips();
  } else {
    window.credoVistaCategoriaSelecionada = nome;
    renderCredoVistaCategoriaChips();
  }
  showToast('Categoria criada');
}
function abrirBuscaGlobal(){
  document.getElementById('buscaGlobalInput').value = '';
  document.getElementById('buscaGlobalResultados').innerHTML = '';
  document.getElementById('modalBuscaGlobal').classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(()=>{ const el = document.getElementById('buscaGlobalInput'); if(el) el.focus(); }, 150);
}
function onBuscaGlobalInput(v){
  const termo = v.trim().toLowerCase();
  const el = document.getElementById('buscaGlobalResultados');
  if(termo.length < 2){ el.innerHTML = ''; return; }
  const resultados = [];

  ['davi','cris'].forEach(u=>{
    ['moradia','fixo','assinatura','futuro'].forEach(cat=>{
      (state.users[u].expenses[cat]||[]).forEach(item=>{
        if(item.arquivado) return;
        if((item.desc||'').toLowerCase().includes(termo)){
          resultados.push({ label:item.desc, meta:'Conta · '+(u==='davi'?'Davi':'Cris')+' · '+fmtMoney(item.valor), icon:'💰', onclick:`irParaBuscaConta('${u}','${cat}','${item.id}')` });
        }
      });
    });
  });

  (state.louvores||[]).forEach(l=>{
    if((l.titulo||'').toLowerCase().includes(termo) || (l.artista||'').toLowerCase().includes(termo)){
      resultados.push({ label:l.titulo||'Sem título', meta:'Louvor · '+(l.artista||''), icon:'🎵', onclick:`irParaBuscaLouvor('${l.id}')` });
    }
  });

  if(resultados.length===0){
    /* não achou: se for um louvor, já procura no Cifra Club */
    const original = (document.getElementById('buscaGlobalInput')?.value || '').trim();
    el.innerHTML = `<div class="empty-state-sm">Nada encontrado</div>${original ? `
      <a class="busca-cifraclub" href="https://www.cifraclub.com.br/?q=${encodeURIComponent(original)}" target="_blank" rel="noopener">
        <span class="busca-cc-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
        <span class="busca-cc-txt"><b>É um louvor?</b><small>Pesquisar “${lvEsc(original)}” no Cifra Club</small></span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
      </a>` : ''}`;
    return;
  }
  el.innerHTML = resultados.slice(0,40).map(r=>
    `<div class="busca-resultado-item" onclick="${r.onclick}">
      <span class="busca-resultado-icon">${r.icon}</span>
      <div class="busca-resultado-info"><div class="busca-resultado-label">${r.label}</div><div class="busca-resultado-meta">${r.meta}</div></div>
    </div>`
  ).join('');
}
function irParaBuscaConta(user, cat, id){
  closeModal('modalBuscaGlobal');
  if(state.currentUser !== user) switchUser(user);
  switchAba('planner');
  setTimeout(()=>editGasto(cat, id), 200);
}
function irParaBuscaLouvor(id){
  closeModal('modalBuscaGlobal');
  switchAba('louvor');
  setTimeout(()=>abrirLouvorDetalhe(id), 200);
}

function closeModal(modalId){
  const modal = document.getElementById(modalId);
  if(modal){
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ========== NAVEGAÇÃO ========== */
/* switchAba e switchUser vivem em core.js */


/* ================= BOTÃO VOLTAR DO CELULAR (toque duplo pra sair) ================= */
let voltarSairArmado = false;
let voltarSairTimer = null;
function fecharCamadaAbertaVoltar(){
  const conf = document.getElementById('iosConfirmOverlay');
  if(conf && conf.classList.contains('show')){ iosConfirmResolver(false); return true; }
  const modais = document.querySelectorAll('.modal-overlay.active');
  if(modais.length){
    const topo = modais[modais.length-1];
    closeModal(topo.id);
    return true;
  }
  const paginas = document.querySelectorAll('.fullpage.active');
  if(paginas.length){
    const pg = paginas[paginas.length-1];
    pg.classList.remove('active');
    document.body.style.overflow = '';
    return true;
  }
  return false;
}
function iniciarBotaoVoltar(){
  if(!window.history || !history.pushState) return;
  history.replaceState({siloe:'base'}, '');
  history.pushState({siloe:'guarda'}, '');
  window.addEventListener('popstate', ()=>{
    if(voltarSairArmado){
      voltarSairArmado = false;
      clearTimeout(voltarSairTimer);
      history.back();
      return;
    }
    history.pushState({siloe:'guarda'}, '');
    if(fecharCamadaAbertaVoltar()) return;
    voltarSairArmado = true;
    showToast('Toque de novo em voltar para sair');
    clearTimeout(voltarSairTimer);
    voltarSairTimer = setTimeout(()=>{ voltarSairArmado = false; }, 2000);
  });
}
iniciarBotaoVoltar();



/* ================= ALTURA REAL DO MENU INFERIOR ================= */
function ajustarAlturaMenuInferior(){
  const nav = document.querySelector('.bottom-nav');
  if(!nav) return;
  document.documentElement.style.setProperty('--navh', nav.offsetHeight+'px');
}
ajustarAlturaMenuInferior();
window.addEventListener('load', ajustarAlturaMenuInferior);
window.addEventListener('resize', ajustarAlturaMenuInferior);

/* ================= LOGO QUE É O PRÓPRIO BOTÃO =================
   Sem logo: tocar abre os arquivos. Com logo: aparece "Trocar imagem" e "Remover".
   Uso: <button class="logo-toque" data-input="idDoInputFile" data-remover="nomeDaFuncaoRemover" onclick="tocarLogo(this)"> */
function tocarLogo(btn){
  const input = document.getElementById(btn.dataset.input);
  const temLogo = !!btn.querySelector('img');
  fecharMenuLogo();
  if(!temLogo){ if(input) input.click(); return; }
  const menu = document.createElement('div');
  menu.className = 'logo-menu'; menu.id = 'logoMenu';
  menu.innerHTML = `<button type="button" data-acao="trocar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>Trocar imagem</button>
    <button type="button" data-acao="remover" class="perigo"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>Remover</button>`;
  menu.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    e.stopPropagation();
    if(b.dataset.acao==='trocar' && input) input.click();
    if(b.dataset.acao==='remover' && typeof window[btn.dataset.remover]==='function') window[btn.dataset.remover]();
    fecharMenuLogo();
  });
  const pai = btn.parentElement;
  if(getComputedStyle(pai).position === 'static') pai.style.position = 'relative';
  btn.insertAdjacentElement('afterend', menu);
  menu.style.left = btn.offsetLeft + 'px';
  menu.style.top = (btn.offsetTop + btn.offsetHeight + 8) + 'px';
  setTimeout(()=>document.addEventListener('click', fecharMenuLogo, { once:true }), 0);
}
function fecharMenuLogo(){ document.getElementById('logoMenu')?.remove(); }

/* ================= CALENDÁRIO PREMIUM (todos os campos de data) =================
   O <input type="date"> continua lá (escondido): o código lê e grava .value como sempre.
   No lugar dele aparece um botão com a data por extenso; tocando, abre o calendário do app
   (folha no celular, cartão logo abaixo do campo no computador). */
const CAL_SEMANA = ['D','S','T','Q','Q','S','S'];
const CAL_ICONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
const _valorInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
function calISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function calParse(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; }
function calTextoBotao(iso){
  const d = calParse(iso); if(!d) return '';
  return `${String(d.getDate()).padStart(2,'0')} de ${MES_NOMES[d.getMonth()].toLowerCase()}. de ${d.getFullYear()}`;
}
function melhorarCampoData(inp){
  if(inp.dataset.premium) return;
  inp.dataset.premium = '1';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'data-btn' + (inp.classList.contains('lv-data-agendamento') ? ' data-btn-compacto' : '');
  inp.classList.add('data-nativa');
  inp.after(btn);
  const sync = ()=>{
    const v = _valorInput.get.call(inp);
    btn.innerHTML = `<span class="${v?'':'data-vazia'}">${v ? calTextoBotao(v) : (btn.classList.contains('data-btn-compacto') ? 'Agendar' : 'Escolher data')}</span>${CAL_ICONE}`;
    btn.setAttribute('aria-label', v ? 'Data: '+calTextoBotao(v) : 'Escolher data');
    btn.disabled = inp.disabled;
  };
  /* quando o código grava input.value, o botão acompanha */
  Object.defineProperty(inp, 'value', { configurable:true, get(){ return _valorInput.get.call(this); }, set(v){ _valorInput.set.call(this, v); sync(); } });
  btn.addEventListener('click', e=>{ e.stopPropagation(); abrirCalendario(inp, btn); });
  sync();
}
function melhorarCamposData(raiz){ (raiz||document).querySelectorAll('input[type="date"]:not([data-premium])').forEach(melhorarCampoData); }

/* ========== LISTA CURTA VIRA BOTÕES (v12, janelas escolha C: "escolhas em botões") ==========
   <select> de uma janela com até 6 opções ganha uma fileira de botões; o select fica escondido e continua valendo
   (.value, onchange). Se o código trocar as opções ou o valor, os botões acompanham. */
const _valorSelect = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
function melhorarSelect(sel){
  if(sel.dataset.chips) return;
  sel.dataset.chips = '1';
  const fila = document.createElement('div');
  fila.className = 'escolha-chips';
  sel.after(fila);
  const desenhar = ()=>{
    const ops = [...sel.options];
    const cabe = ops.length > 0 && ops.length <= 6;
    sel.classList.toggle('select-escondido', cabe);
    fila.hidden = !cabe;
    if(!cabe) return;
    const v = _valorSelect.get.call(sel);
    fila.innerHTML = ops.map(o=>`<button type="button" class="${o.value === v ? 'on' : ''}" data-v="${o.value.replace(/"/g, '&quot;')}">${o.textContent.replace(/</g, '&lt;')}</button>`).join('');
  };
  fila.addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    _valorSelect.set.call(sel, b.dataset.v); desenhar();
    sel.dispatchEvent(new Event('change', { bubbles:true }));
  });
  Object.defineProperty(sel, 'value', { configurable:true, get(){ return _valorSelect.get.call(this); }, set(v){ _valorSelect.set.call(this, v); desenhar(); } });
  sel.addEventListener('change', desenhar);
  new MutationObserver(desenhar).observe(sel, { childList:true, subtree:true });
  desenhar();
}
document.querySelectorAll('.modal select').forEach(melhorarSelect);
melhorarCamposData();
new MutationObserver(()=>{ if(document.querySelector('input[type="date"]:not([data-premium])')) melhorarCamposData(); }).observe(document.body, { childList:true, subtree:true });

let calEstado = null;
function abrirCalendario(inp, btn){
  fecharCalendario();
  const atual = calParse(inp.value) || new Date();
  calEstado = { inp, btn, ano: atual.getFullYear(), mes: atual.getMonth() };
  const fundo = document.createElement('div');
  fundo.id = 'calFundo'; fundo.className = 'cal-fundo';
  fundo.addEventListener('click', fecharCalendario);
  const pop = document.createElement('div');
  pop.id = 'calPop'; pop.className = 'cal-pop';
  pop.addEventListener('click', e=>e.stopPropagation());
  document.body.append(fundo, pop);
  renderCalendario();
  /* computador: cartão logo abaixo (ou acima) do campo; celular: folha embaixo (CSS) */
  if(innerWidth >= 600){
    const r = btn.getBoundingClientRect(), h = pop.offsetHeight, w = pop.offsetWidth;
    const top = (r.bottom + 8 + h > innerHeight - 8) ? Math.max(8, r.top - 8 - h) : r.bottom + 8;
    pop.style.top = top + 'px';
    pop.style.left = Math.min(Math.max(8, r.left), innerWidth - w - 8) + 'px';
  }
  requestAnimationFrame(()=>{ fundo.classList.add('aberto'); pop.classList.add('aberto'); });
  document.addEventListener('keydown', calTeclas);
}
function fecharCalendario(){
  document.getElementById('calPop')?.remove();
  document.getElementById('calFundo')?.remove();
  document.removeEventListener('keydown', calTeclas);
  calEstado = null;
}
function calTeclas(e){ if(e.key === 'Escape'){ e.preventDefault(); fecharCalendario(); } }
function calMudarMes(delta){
  if(!calEstado) return;
  const d = new Date(calEstado.ano, calEstado.mes + delta, 1);
  calEstado.ano = d.getFullYear(); calEstado.mes = d.getMonth();
  renderCalendario();
}
function renderCalendario(){
  const pop = document.getElementById('calPop'); if(!pop || !calEstado) return;
  const { inp, ano, mes } = calEstado;
  const sel = inp.value, hoje = calISO(new Date());
  const min = inp.min || '', max = inp.max || '';
  const primeiro = new Date(ano, mes, 1).getDay(), nDias = new Date(ano, mes+1, 0).getDate();
  let dias = '';
  for(let i=0; i<primeiro; i++) dias += '<span></span>';
  for(let d=1; d<=nDias; d++){
    const iso = calISO(new Date(ano, mes, d));
    const fora = (min && iso < min) || (max && iso > max);
    dias += `<button type="button" class="cal-dia${iso===sel?' sel':''}${iso===hoje?' hoje':''}" ${fora?'disabled':''} onclick="calEscolher('${iso}')">${d}</button>`;
  }
  pop.innerHTML = `
    <div class="cal-topo">
      <button type="button" class="cal-nav" aria-label="Mês anterior" onclick="calMudarMes(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="cal-titulo">${MES_NOMES_LONGOS[mes]} <span>${ano}</span></div>
      <button type="button" class="cal-nav" aria-label="Próximo mês" onclick="calMudarMes(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
    <div class="cal-semana">${CAL_SEMANA.map(s=>`<span>${s}</span>`).join('')}</div>
    <div class="cal-dias">${dias}</div>
    <div class="cal-rodape">
      <button type="button" class="cal-link" onclick="calEscolher('')">Limpar</button>
      <button type="button" class="cal-link forte" onclick="calEscolher('${hoje}')">Hoje</button>
    </div>`;
}
function calEscolher(iso){
  if(!calEstado) return;
  const inp = calEstado.inp;
  inp.value = iso;
  inp.dispatchEvent(new Event('input', { bubbles:true }));
  inp.dispatchEvent(new Event('change', { bubbles:true }));
  fecharCalendario();
}

/* ================= FUNCIONAR SEM INTERNET =================
   Liga o sw.js: guarda o app e as bibliotecas no aparelho. Na prévia (localhost) fica desligado,
   para as mudanças em andamento sempre aparecerem na hora. */
if('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
  window.addEventListener('load', ()=>{ navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}

/* ================= EFEITOS (sutis; desligam com "reduzir movimento" do aparelho) =================
   1. cartões entram um após o outro ao trocar de aba / abrir o app
   2. números de dinheiro contam até o valor
   3. "feito": anel + ✓ no ponto do toque e vibração curta ao marcar conta paga, batida, ordem etc. */
const efeitosLigados = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function efeitoEntradaCartoes(raiz){
  if(!efeitosLigados || !raiz) return;
  const itens = [...raiz.querySelectorAll('.card, .section, .lv-card, .lv-roteiro')]
    .filter(el=>el.offsetParent !== null && !el.parentElement.closest('.card, .section'))
    .slice(0, 14);
  itens.forEach((el, i)=>{
    el.classList.remove('efeito-entra');
    void el.offsetWidth;
    el.style.setProperty('--i', i);
    el.classList.add('efeito-entra');
    setTimeout(()=>el.classList.remove('efeito-entra'), 500 + i*35);
  });
}
function efeitoContarNumeros(raiz){
  if(!efeitosLigados || !raiz) return;
  raiz.querySelectorAll('.resumo-stat-val, .prev-valor, .cb-rodape strong, .ponto-valor-grande, .cp-total-valor, .cp-resumo-val, .vd-meta-linha > b').forEach(el=>{
    if(el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;   // só texto puro (não mexe em quem tem ícone dentro)
    const alvoTxt = el.textContent, m = alvoTxt.match(/^(-?)R\$\s?([\d.]+,\d{2})$/);
    if(!m) return;
    const alvo = Number(m[2].replace(/\./g,'').replace(',','.')) * (m[1] ? -1 : 1);
    if(Math.abs(alvo) < 1) return;
    const ini = performance.now(), dur = 800;   // v15.2: mais rápido (era 1,4 s)
    let escrito = '';
    const passo = t=>{
      if(escrito && el.textContent !== escrito) return;   // a tela foi redesenhada: para
      const p = Math.min(1, (t - ini)/dur), e = 1 - Math.pow(1 - p, 3);
      escrito = p < 1 ? fmtMoneySigned(alvo * e) : alvoTxt;
      el.textContent = escrito;
      if(p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
/* saldo grande (é um campo): conta só na abertura do app, se não estiver sendo editado */
function efeitoContarSaldo(){
  const inp = document.getElementById('saldoAtualInput');
  if(!efeitosLigados || !inp || document.activeElement === inp) return;
  const alvoTxt = inp.value, alvo = parseMoney(alvoTxt);
  if(!(Math.abs(alvo) >= 1)) return;
  const ini = performance.now(), dur = 1100;   // o saldo conta um pouco mais devagar (v15.2: era 2,2 s)
  const passo = t=>{
    if(document.activeElement === inp){ inp.value = alvoTxt; return; }
    const p = Math.min(1, (t - ini)/dur), e = 1 - Math.pow(1 - p, 3);
    inp.value = p < 1 ? (alvo*e).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.') : alvoTxt;
    if(p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
function efeitoAoTrocarAba(aba){
  const raiz = document.getElementById('aba-'+aba);
  efeitoEntradaCartoes(raiz);
  efeitoContarNumeros(raiz);
}
/* "feito": qualquer toque nos controles de marcar (conta paga, batida/dia do ponto, ordem, roteiro, salário, dízimo, fatura...) */
const EFEITO_FEITO = /togglePaid|contaTapEnd|toggleDiaConcluido|toggleCompraPago|toggleExtraRecebido|cpToggleSalario|cpToggleExtra|cpToggleDizimo|toggleFaturaMes/;
document.addEventListener('pointerup', ev=>{
  if(!efeitosLigados) return;
  const alvo = ev.target.closest('[onclick], [onpointerup]');
  if(!alvo || !EFEITO_FEITO.test((alvo.getAttribute('onclick')||'') + (alvo.getAttribute('onpointerup')||''))) return;
  const b = document.createElement('div');
  b.className = 'efeito-feito';
  b.style.left = ev.clientX + 'px'; b.style.top = ev.clientY + 'px';
  b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  document.body.appendChild(b);
  setTimeout(()=>b.remove(), 650);
  if(navigator.vibrate) navigator.vibrate(8);
}, true);


/* nome do modelo da IA escrito em Ajustes → Recursos (vazio = o padrão de ia.js) */
function salvarModeloIA(chave, v){
  v = String(v || '').trim().replace(/^models\//, '');
  if(v) state[chave] = v; else delete state[chave];
  persist();
  showToast(v ? 'Modelo salvo: ' + v : 'Modelo no padrão');
}
