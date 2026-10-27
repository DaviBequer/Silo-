/* Siloé — sino de notificações, PIN de entrada, segurança, fundo, Jarvis, animações e versículo (saíram do app.js em 27/10/2026, sem mudança) */
/* ========== SINO DE NOTIFICAÇÕES (dentro do app) ==========
   Os mesmos avisos das notificações do celular, calculados aqui com os dados do app:
   ponto (batida de hoje que já passou do horário e não foi marcada) e vendas (quanto falta para a meta).
   O que ainda não foi visto deixa o sino balançando; tocar num aviso leva até ele. */
const SINO_BATIDAS = [
  { campo:'entrada', nome:'entrada', padrao:'07:00' },
  { campo:'almocoSaida', nome:'saída do almoço', padrao:'12:00' },
  { campo:'almocoVolta', nome:'volta do almoço', padrao:'13:00' },
  { campo:'saida', nome:'saída', padrao:'17:00' }
];
function sinoVistos(){ try{ return JSON.parse(localStorage.getItem('siloe-avisos-vistos') || '[]'); }catch(e){ return []; } }
function sinoGuardarVistos(ids){ try{ localStorage.setItem('siloe-avisos-vistos', JSON.stringify(ids.slice(-60))); }catch(e){} }
function sinoAvisos(){
  const out = [];
  if(typeof state === 'undefined' || !state) return out;
  const agora = new Date(), dow = agora.getDay();
  const hojeTxt = agora.getFullYear() + '-' + String(agora.getMonth()+1).padStart(2,'0') + '-' + String(agora.getDate()).padStart(2,'0');
  /* PONTO: só olha (não cria o dia) */
  if(dow >= 1 && dow <= 5 && state.ponto && state.ponto.days){
    const mKey = hojeTxt.slice(0,7);
    const d = (state.ponto.days[mKey] || {})[String(agora.getDate())];
    const agoraMin = agora.getHours()*60 + agora.getMinutes();
    if(!(d && d.concluido)){
      SINO_BATIDAS.forEach(b=>{
        if(d && d[b.campo] === null) return;                       // dia sem esse horário
        if(d && d.confirmado && d.confirmado[b.campo]) return;     // já marcou
        let hora = (d && d[b.campo]) || b.padrao;
        if(!d && b.campo === 'saida' && dow === 5) hora = '16:00';
        const [h, m] = hora.split(':').map(Number);
        if(agoraMin >= h*60 + m + 5) out.push({ id:'ponto-'+hojeTxt+'-'+b.campo, tipo:'ponto', titulo:'Bater o ponto', corpo:`Falta bater a ${b.nome} (${hora}).`, quando: hora, ir:{ aba:'ponto', dia: agora.getDate() } });
      });
    }
  }
  /* VENDAS: quanto falta para a meta do mês (um aviso novo por dia) */
  try{
    const v = typeof calcularAvisosVendas === 'function' ? calcularAvisosVendas() : null;
    if(v && v.falta > 0.005){
      const planos = [v.nA ? `${v.nA} do ${v.nomeA}` : '', v.nB ? `${v.nB} do ${v.nomeB}` : ''].filter(Boolean).join(' ou ');
      out.push({ id:'vendas-'+v.mes+'-'+Math.round(v.falta*100), tipo:'vendas', titulo:'Vendas do mês', corpo:`Faltam ${fmtMoney(v.falta)} para a meta de ${v.mesNome}${planos ? ' — ' + planos : ''}.`, quando:'hoje', ir:{ aba:'vendas' } });
    }
  }catch(e){}
  /* FINANÇAS: faz dias que nada é lançado (Atualizar) */
  try{
    const ult = typeof atzUltimaAtualizacao === 'function' ? atzUltimaAtualizacao() : 0;
    const dias = ult ? Math.floor((Date.now() - ult) / 864e5) : 0;
    if(dias >= ATZ_DIAS_AVISO) out.push({ id:'financas-'+hojeTxt, tipo:'financas', titulo:'Assistente: atualizar as finanças', corpo:`Faz ${dias} dias que nada é lançado. Fale o que gastou desde então.`, quando:'hoje', ir:{ aba:'atualizar' } });
  }catch(e){}
  /* BACKUP: uma cópia dos dados no aparelho a cada 7 dias (fora do Supabase) */
  if(remoteReady){
    const diasB = state.ultimoBackup ? Math.floor((Date.now() - state.ultimoBackup) / 864e5) : null;
    if(diasB === null || diasB >= BACKUP_DIAS) out.push({ id:'backup-'+hojeTxt, tipo:'backup', titulo:'Backup da semana', corpo: diasB === null ? 'Toque para baixar uma cópia dos seus dados neste aparelho.' : `Faz ${diasB} dias do último backup. Toque para baixar uma cópia dos seus dados neste aparelho.`, quando:'hoje', ir:{ aba:'backup' } });
  }
  return out;
}
const BACKUP_DIAS = 7;
let sinoAtuais = [];
function atualizarSino(semLista){
  const btn = document.getElementById('sinoBtn'), conta = document.getElementById('sinoConta');
  if(!btn || !conta) return;
  sinoAtuais = sinoAvisos();
  const vistos = new Set(sinoVistos());
  const novos = sinoAtuais.filter(a=>!vistos.has(a.id)).length;
  conta.textContent = novos ? (novos > 9 ? '9+' : novos) : '';
  btn.classList.toggle('tem-novo', novos > 0);
  btn.classList.toggle('tem-aviso', sinoAtuais.length > 0);
  btn.title = novos ? `${novos} notificaç${novos>1?'ões novas':'ão nova'}` : 'Notificações';
  if(!semLista && document.getElementById('modalSino')?.classList.contains('active')) sinoRenderLista();
}
const SINO_ICONES = {
  ponto: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  vendas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  financas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H9l-5 4z"/></svg>'
  ,backup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>'
};
function sinoRenderLista(){
  const vistos = new Set(sinoVistos());
  document.getElementById('sinoLista').innerHTML = sinoAtuais.length ? sinoAtuais.map((a, i)=>`
    <button type="button" class="sino-item ${a.tipo}${vistos.has(a.id)?'':' novo'}" style="animation-delay:${i*0.05}s" onclick="sinoIr(${i})">
      <span class="sino-ico">${SINO_ICONES[a.tipo] || ''}</span>
      <span class="sino-txt"><b>${a.titulo}</b><span>${a.corpo}</span></span>
      <span class="sino-quando">${a.quando}</span>
    </button>`).join('')
    : `<div class="sino-vazio"><div class="sino-vazio-ico">✓</div><b>Tudo em dia</b><span>Quando faltar bater o ponto ou vender para a meta, aparece aqui.</span></div>`;
}
function abrirSino(){
  sinoAtuais = sinoAvisos();
  sinoRenderLista();
  document.getElementById('modalSino').classList.add('active');
  /* só abrir não conta como lido: o aviso continua novo até tocar nele ou a situação mudar */
}
function sinoIr(i){
  const a = sinoAtuais[i]; if(!a) return;
  sinoGuardarVistos([...new Set([...sinoVistos(), a.id])]);   // tocou: este conta como lido
  atualizarSino(true);
  closeModal('modalSino');
  if(a.ir.aba === 'ponto'){
    if(state.pontoOffset){ state.pontoOffset = 0; }
    switchAba('ponto');
    if(typeof renderPonto === 'function') renderPonto();
    setTimeout(()=>sinoDestacar(document.getElementById('pontoDia-' + a.ir.dia)), 120);
  } else if(a.ir.aba === 'vendas'){
    switchAba('vendas');
    setTimeout(()=>sinoDestacar(document.querySelector('#vendasConteudo .vd-meta-linha') || document.getElementById('vendasConteudo')), 120);
  } else if(a.ir.aba === 'backup'){
    exportarDadosApp();
  } else if(a.ir.aba === 'atualizar'){
    switchAba('planner');
    abrirAtualizar('conversa');
  }
}
function sinoDestacar(el){
  if(!el) return;
  el.scrollIntoView({ behavior:'smooth', block:'center' });
  el.classList.remove('sino-destaque'); void el.offsetWidth; el.classList.add('sino-destaque');
  setTimeout(()=>el.classList.remove('sino-destaque'), 2400);
}
/* a hora passa: confere de novo a cada minuto e quando o app volta para a tela */
setInterval(atualizarSino, 60000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) atualizarSino(); });

/* ========== PIN DE ENTRADA ==========
   O Supabase só entra com e-mail + senha: o PIN (6 números) vira a senha da conta e o e-mail fica guardado
   no aparelho. Na tela de login o aparelho que já conhece o e-mail mostra só o teclado do PIN. */
const PIN_TAM = 6;
/* o app tem uma conta só: aparelho novo já entra pelo PIN com o e-mail da conta (trocado na aba Segurança, fica guardado no aparelho) */
const PIN_EMAIL_CONTA = atob('ZGF2aWpyMTIzLmJlcXVlckBnbWFpbC5jb20=');
function pinEmailDoAparelho(){
  try{
    const salvo = localStorage.getItem('siloe-pin-email'); if(salvo) return salvo;
    const s = JSON.parse(localStorage.getItem('siloe-auth') || 'null');   // sessão guardada (mesmo vencida) tem o e-mail
    if(s && s.user && s.user.email) return s.user.email;
  }catch(e){}
  return PIN_EMAIL_CONTA;
}
function pinGuardarEmail(email){ try{ if(email) localStorage.setItem('siloe-pin-email', email); else localStorage.removeItem('siloe-pin-email'); }catch(e){} }
/* depois de carregar: se o PIN já foi criado (em qualquer aparelho), este aparelho passa a entrar com ele */
/* o login abre no PIN, a menos que este aparelho já saiba que o PIN está desligado */
function pinLigadoNoAparelho(){ try{ return localStorage.getItem('siloe-pin-ligado') !== '0'; }catch(e){ return true; } }
async function pinLembrarAparelho(){
  try{ localStorage.setItem('siloe-pin-ligado', state && state.loginPin ? '1' : '0'); }catch(e){}
  if(!window.SiloSupabase) return;
  const email = await window.SiloSupabase.emailAtual();   // guarda sempre o e-mail atual (pode ter sido trocado em outro aparelho)
  if(email) pinGuardarEmail(email);
}
/* teclado numérico reutilizável: desenha em el, chama aoCompletar(pin) com 6 números */
function pinTeclado(tecladoId, pontosId, aoCompletar){
  const tec = document.getElementById(tecladoId), pts = document.getElementById(pontosId);
  let valor = '';
  const desenha = ()=>{ pts.innerHTML = Array.from({ length: PIN_TAM }, (_, i)=>`<i class="${i < valor.length ? 'cheio' : ''}"></i>`).join(''); };
  const apaga = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/></svg>';
  tec.innerHTML = ['1','2','3','4','5','6','7','8','9','','0','x'].map(t=>
    t === '' ? '<span></span>' : `<button type="button" class="pin-tecla${t==='x'?' apagar':''}" data-t="${t}" aria-label="${t==='x'?'Apagar':t}">${t==='x'?apaga:t}</button>`).join('');
  const toca = t=>{
    if(t === 'x'){ valor = valor.slice(0, -1); desenha(); return; }
    if(valor.length >= PIN_TAM) return;
    valor += t; desenha();
    if(navigator.vibrate) try{ navigator.vibrate(6); }catch(_){}
    if(valor.length === PIN_TAM){ const v = valor; setTimeout(()=>aoCompletar(v), 120); }
  };
  tec.onclick = e=>{ const b = e.target.closest('.pin-tecla'); if(b) toca(b.dataset.t); };
  desenha();
  return {
    limpar(){ valor = ''; desenha(); },
    tremer(){ pts.classList.remove('errou'); void pts.offsetWidth; pts.classList.add('errou'); if(navigator.vibrate) try{ navigator.vibrate([40,40,40]); }catch(_){} },
    tecla: toca,
    el: tec
  };
}
/* teclado físico (computador) no teclado que estiver aberto */
let pinTecladoAtivo = null;
document.addEventListener('keydown', e=>{
  if(!pinTecladoAtivo || !pinTecladoAtivo.el.offsetParent) return;   // teclado fechado: não captura
  if(e.target && e.target.matches && e.target.matches('input,textarea')) return;   // digitando o e-mail
  if(/^[0-9]$/.test(e.key)){ pinTecladoAtivo.tecla(e.key); e.preventDefault(); }
  else if(e.key === 'Backspace'){ pinTecladoAtivo.tecla('x'); e.preventDefault(); }
});

/* ---------- tela de login no modo PIN ---------- */
let pinLogin = null;
function loginModoPin(ligar){
  const tela = document.getElementById('loginTela'); if(!tela) return;
  const email = pinEmailDoAparelho();
  tela.classList.toggle('modo-pin', !!ligar);
  if(ligar){
    /* saudação com o nome de quem usa este aparelho (v12, escolha A) */
    const ola = document.getElementById('loginPinOla');
    if(ola){ const h = new Date().getHours(); let u = 'davi'; try{ u = localStorage.getItem(CHAVE_USUARIO) || 'davi'; }catch(e){}
      ola.textContent = (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + ', ' + (u === 'cris' ? 'Cris' : 'Davi'); }
    document.getElementById('loginPinErro').textContent = '';
    pinLogin = pinTeclado('loginPinTeclado', 'loginPinPontos', entrarComPin);
    pinTecladoAtivo = pinLogin;
  } else {
    pinTecladoAtivo = null;
    if(email && !document.getElementById('loginEmail').value) document.getElementById('loginEmail').value = email;
  }
}
async function entrarComPin(pin){
  const erro = document.getElementById('loginPinErro'), sub = document.getElementById('loginPinSub');
  const email = pinEmailDoAparelho();   // sem campo de e-mail: o PIN é a entrada principal
  sub.textContent = 'Entrando…'; erro.textContent = '';
  const r = await window.SiloSupabase.entrar(email, pin);
  sub.textContent = 'Digite seu PIN';
  if(!r.ok){
    erro.textContent = /incorretos/.test(r.erro) ? 'PIN errado' : r.erro;
    pinLogin.tremer(); pinLogin.limpar();
    return;
  }
  pinGuardarEmail(email);
  pinTecladoAtivo = null;
  aposEntrar();
}

/* ---------- criar/trocar o PIN (Dados do App) ---------- */
function atualizarStatusPin(){
  const st = document.getElementById('pinStatus'), btn = document.getElementById('pinBtn');
  if(!st || !btn) return;
  const ligado = !!(state && state.loginPin);
  st.textContent = ligado ? 'Ligado' : 'Desligado';
  st.classList.toggle('ligada', ligado);
  btn.textContent = ligado ? 'Trocar PIN' : 'Criar PIN';
}
let pinModal = null;
function abrirCriarPin(){
  let primeiro = '';
  const titulo = document.getElementById('pinModalTitulo'), sub = document.getElementById('pinModalSub'), erro = document.getElementById('pinModalErro');
  titulo.textContent = state.loginPin ? 'Trocar PIN' : 'Criar PIN';
  sub.textContent = 'Escolha 6 números'; erro.textContent = '';
  pinModal = pinTeclado('pinModalTeclado', 'pinModalPontos', async pin=>{
    if(!primeiro){
      if(/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)){ erro.textContent = 'Fácil demais de adivinhar — escolha outro'; pinModal.tremer(); pinModal.limpar(); return; }
      primeiro = pin; erro.textContent = ''; sub.textContent = 'Digite de novo para confirmar'; pinModal.limpar(); return;
    }
    if(pin !== primeiro){ primeiro = ''; erro.textContent = 'Os dois não bateram. Comece de novo.'; sub.textContent = 'Escolha 6 números'; pinModal.tremer(); pinModal.limpar(); return; }
    sub.textContent = 'Salvando…';
    const r = await window.SiloSupabase.trocarSenha(pin);
    if(!r.ok){ erro.textContent = r.erro; sub.textContent = 'Escolha 6 números'; primeiro = ''; pinModal.limpar(); return; }
    pinGuardarEmail(await window.SiloSupabase.emailAtual());
    state.loginPin = true;
    try{ localStorage.setItem('siloe-pin-ligado', '1'); }catch(e){}
    persist();
    pinTecladoAtivo = null;
    closeModal('modalPin');
    atualizarStatusPin();
    showToast('PIN criado. Da próxima vez que pedir para entrar, é só o PIN');
  });
  pinTecladoAtivo = pinModal;
  document.getElementById('modalPin').classList.add('active');
}

/* ========== SEGURANÇA (Dados do App → aba Segurança) ==========
   PIN, senha, e-mail e aparelhos conectados. O Supabase não lista as sessões para o app, então cada aparelho
   se registra em state.aparelhos [{id, nome, primeiro, ultimo, sair}] ao abrir; "Desconectar" marca sair:true
   e o aparelho sai sozinho na próxima vez que abrir. */
function aparelhoId(){
  try{
    let id = localStorage.getItem('siloe-aparelho-id');
    if(!id){ id = 'ap' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('siloe-aparelho-id', id); }
    return id;
  }catch(e){ return ''; }
}
function aparelhoNome(){
  const ua = navigator.userAgent || '';
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : '';
  const app = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  return so + (app ? ' · app' : nav ? ' · ' + nav : '');
}
function aparelhoEhCelular(nome){ return /iPhone|Android|iPad/.test(nome || ''); }
/* chamado depois de carregar: registra este aparelho ou sai, se outro aparelho mandou desconectar */
async function aparelhoRegistrar(){
  if(MODO_TESTE_LOCAL || !state || !remoteReady) return;
  const id = aparelhoId(); if(!id) return;
  if(!Array.isArray(state.aparelhos)) state.aparelhos = [];
  const agora = new Date().toISOString();
  let ap = state.aparelhos.find(a=>a.id === id);
  if(ap && ap.sair){
    state.aparelhos = state.aparelhos.filter(a=>a.id !== id);
    await persistAgora();
    await window.SiloSupabase.sair();
    apagarCopiaLocal();
    location.reload();
    return;
  }
  const nome = aparelhoNome();
  if(!ap){ ap = { id, nome, primeiro: agora, ultimo: agora }; state.aparelhos.push(ap); persist(); return; }
  if(ap.nome !== nome || Date.now() - new Date(ap.ultimo).getTime() > 3600e3){ ap.nome = nome; ap.ultimo = agora; persist(); }
}
function segQuando(iso){
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if(!(min >= 0) || min < 60) return 'agora há pouco';
  const h = Math.round(min / 60); if(h < 24) return `há ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`;
}
function renderSeguranca(){
  atualizarStatusPin();
  const em = document.getElementById('segEmailAtual');
  window.SiloSupabase.emailAtual().then(e=>{ if(em) em.textContent = e; });
  const lista = document.getElementById('segAparelhos'); if(!lista) return;
  const meu = aparelhoId();
  const aps = (state.aparelhos || []).slice().sort((a, b)=>(b.id === meu) - (a.id === meu) || String(b.ultimo).localeCompare(String(a.ultimo)));
  const celular = '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>';
  const pc = '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>';
  lista.innerHTML = aps.length ? aps.map(a=>{
    const este = a.id === meu;
    const info = este ? '<b class="seg-este">Este aparelho</b>' : a.sair ? 'Sai quando abrir de novo' : 'Usado ' + segQuando(a.ultimo);
    const botao = este ? '' : a.sair
      ? `<button type="button" class="ico-btn" onclick="segDesconectar('${a.id}', false)" title="Manter conectado" aria-label="Manter conectado">${ICO('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>')}</button>`
      : `<button type="button" class="ico-btn seg-sair" onclick="segDesconectar('${a.id}', true)" title="Desconectar" aria-label="Desconectar">${ICO('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>')}</button>`;
    return `<div class="seg-ap${a.sair ? ' saindo' : ''}"><span class="seg-ap-ico">${ICO(aparelhoEhCelular(a.nome) ? celular : pc, 20)}</span><div class="seg-ap-txt"><div class="seg-ap-nome">${escBanco(a.nome || 'Aparelho')}</div><div class="seg-ap-info">${info}</div></div>${botao}</div>`;
  }).join('') : '<div class="ia-desc">Nenhum aparelho registrado ainda.</div>';
}
async function segDesconectar(id, sair){
  const a = (state.aparelhos || []).find(x=>x.id === id); if(!a) return;
  if(sair && !(await iosConfirm(`Desconectar ${a.nome}? Ele sai sozinho na próxima vez que abrir o app.`))) return;
  if(sair) a.sair = true; else delete a.sair;
  persist();
  renderSeguranca();
}
async function segTrocarSenha(){
  const inp = document.getElementById('segSenhaInput'), nova = inp.value;
  if(nova.length < 6){ showToast('A senha precisa de pelo menos 6 caracteres'); return; }
  if(state.loginPin && !(await iosConfirm('Trocar a senha desliga o PIN (você entra com e-mail e senha até criar outro). Continuar?'))) return;
  const r = await window.SiloSupabase.trocarSenha(nova);
  if(!r.ok){ showToast(r.erro.replace('esse PIN', 'essa senha').replace('criar o PIN', 'trocar a senha')); return; }
  inp.value = '';
  state.loginPin = false;
  try{ localStorage.setItem('siloe-pin-ligado', '0'); }catch(e){}
  persist();
  atualizarStatusPin();
  showToast('Senha trocada');
}
async function segTrocarEmail(){
  const inp = document.getElementById('segEmailInput'), novo = inp.value.trim();
  if(!/^\S+@\S+\.\S+$/.test(novo)){ showToast('Digite um e-mail válido'); return; }
  if(!(await iosConfirm(`Trocar o e-mail da conta para ${novo}? Vai chegar um link nesse e-mail para confirmar.`))) return;
  const r = await window.SiloSupabase.trocarEmail(novo);
  if(!r.ok){ showToast(r.erro); return; }
  inp.value = '';
  showToast('Link enviado. Abra o e-mail para confirmar a troca');
}

/* ========== FUNDO COM IMAGEM (Dados do App) ==========
   state.fundoApp = { img: dataURL (reduzida), forca: 'suave' | 'medio' | 'forte' }.
   A imagem fica atrás de tudo, com um véu da cor do papel por cima para o texto continuar legível. */
/* quanto a imagem aparece (0 a 100); quem escolheu Suave/Médio/Forte antes continua igual */
const FUNDO_FORCA_ANTIGA = { suave: 8, medio: 22, forte: 41 };
function fundoVisivel(f){ return f && f.visivel != null ? Number(f.visivel) : (FUNDO_FORCA_ANTIGA[f && f.forca] ?? 22); }
function fundoVeu(v){ return Math.max(.6, Math.min(.97, .97 - v * .0037)); }   // véu da cor do papel por cima da foto (nunca deixa o texto ilegível)
function fundoForca(el, v){ el.style.setProperty('--veu', fundoVeu(v)); el.style.setProperty('--desfoque', Math.max(10, 30 - v * .2).toFixed(1) + 'px'); }
function aplicarFundoApp(){
  const f = null;   // v9.0: visual preto e branco, sem foto de fundo (state.fundoApp fica guardado, só não aparece)
  let el = document.getElementById('fundoApp');
  if(!f || !f.img){ document.documentElement.classList.remove('tem-fundo'); if(el) el.remove(); atualizarStatusFundo(); return; }
  if(!el){ el = document.createElement('div'); el.id = 'fundoApp'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
  el.style.backgroundImage = `url("${f.img}")`;
  fundoForca(el, fundoVisivel(f));
  document.documentElement.classList.add('tem-fundo');
  atualizarStatusFundo();
}
function atualizarStatusFundo(){
  const st = document.getElementById('fundoStatus'), rem = document.getElementById('fundoRemover'), forca = document.getElementById('fundoForca');
  if(!st) return;
  const f = state && state.fundoApp, tem = !!(f && f.img);
  st.textContent = tem ? 'Ligado' : 'Sem imagem';
  st.classList.toggle('ligada', tem);
  if(rem) rem.style.display = tem ? '' : 'none';
  if(forca){
    forca.style.display = tem ? '' : 'none';
    if(tem){ const v = Math.round(fundoVisivel(f)); document.getElementById('fundoForcaBarra').value = v; fundoPintarBarra(v); }
  }
}
function escolherFundoApp(ev){
  const file = ev.target.files && ev.target.files[0]; ev.target.value = '';
  if(!file) return;
  const leitor = new FileReader();
  leitor.onload = async ()=>{
    const img = await comprimirImagemDataUrl(String(leitor.result), 1600, 0.72);
    state.fundoApp = { img, visivel: state.fundoApp ? fundoVisivel(state.fundoApp) : 22 };
    persist();
    aplicarFundoApp();
    showToast('Fundo aplicado');
  };
  leitor.readAsDataURL(file);
}
/* barra: enquanto arrasta só mostra; ao soltar, salva */
function setVisivelFundo(v, salvar){
  if(!state.fundoApp) return;
  v = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  state.fundoApp.visivel = v; delete state.fundoApp.forca;
  const el = document.getElementById('fundoApp');
  if(el) fundoForca(el, v);
  fundoPintarBarra(v);
  if(salvar) persist();
}
function fundoPintarBarra(v){
  const barra = document.getElementById('fundoForcaBarra'), txt = document.getElementById('fundoForcaValor');
  if(barra){ barra.style.setProperty('--p', v + '%'); if(Number(barra.value) !== v) barra.value = v; }
  if(txt) txt.textContent = v + '%';
}
function removerFundoApp(){
  delete state.fundoApp;
  persist(); aplicarFundoApp();
  showToast('Fundo removido');
}

/* ========== JARVIS: tela do microfone enquanto ouve ==========
   Anel tipo "reator" girando, barras em volta que reagem à fala e o texto aparecendo embaixo.
   jarvisAbrir({ titulo, aoParar }) · jarvisTexto(t) · jarvisPensando(t) · jarvisFechar() */
let jarvisEstado = null;
function jarvisAbrir(op){
  op = op || {};
  jarvisFechar(true);
  const el = document.createElement('div');
  el.className = 'jarvis';
  el.innerHTML = `
    <div class="jv-fundo"></div>
    <div class="jv-centro">
      <canvas class="jv-canvas" width="560" height="560"></canvas>
      <svg class="jv-aneis" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="jv-a1" cx="100" cy="100" r="92"/>
        <circle class="jv-a2" cx="100" cy="100" r="80"/>
        <circle class="jv-a3" cx="100" cy="100" r="68"/>
        <circle class="jv-a4" cx="100" cy="100" r="56"/>
        <g class="jv-marcas">${Array.from({ length: 36 }, (_, i)=>`<line x1="100" y1="4" x2="100" y2="${i % 3 ? 9 : 13}" transform="rotate(${i*10} 100 100)"/>`).join('')}</g>
      </svg>
      <button type="button" class="jv-nucleo" aria-label="Parar de ouvir"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg></button>
    </div>
    <div class="jv-status"><span class="jv-ponto"></span><span class="jv-status-txt">OUVINDO</span></div>
    <div class="jv-titulo">${op.titulo || 'Pode falar'}</div>
    <div class="jv-texto"></div>
    <button type="button" class="jv-fechar">Toque no centro para terminar</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('aberto'));
  const est = { el, nivel: .15, alvo: .15, t: 0, raf: 0, aoParar: op.aoParar, pensando: false };
  jarvisEstado = est;
  const parar = ()=>{ if(est.aoParar) est.aoParar(); else jarvisFechar(); };
  el.querySelector('.jv-nucleo').onclick = parar;
  el.querySelector('.jv-fechar').onclick = parar;
  el.querySelector('.jv-fundo').onclick = parar;
  if(navigator.vibrate) try{ navigator.vibrate(12); }catch(_){}
  /* barras em volta do anel: sobem com a fala (cada texto novo dá um "pulso") */
  const cv = el.querySelector('.jv-canvas'), ctx = cv.getContext('2d');
  const N = 72, R = 168;
  const desenha = ()=>{
    est.t += 1;
    est.alvo = Math.max(.12, est.alvo * .965);
    est.nivel += (est.alvo - est.nivel) * .18;
    ctx.clearRect(0, 0, 560, 560);
    ctx.save(); ctx.translate(280, 280);
    for(let i = 0; i < N; i++){
      const ang = (i / N) * Math.PI * 2 + est.t * .004;
      const onda = Math.sin(i * .55 + est.t * .09) * .5 + Math.sin(i * 1.7 - est.t * .05) * .35 + .9;
      const tam = 8 + est.nivel * 62 * onda * (est.pensando ? .45 : 1);
      ctx.rotate(Math.PI * 2 / N);
      const g = ctx.createLinearGradient(0, -R, 0, -R - tam);
      g.addColorStop(0, 'rgba(120,230,255,.95)'); g.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-2, -R - tam, 4, tam);
    }
    ctx.restore();
    est.raf = requestAnimationFrame(desenha);
  };
  desenha();
  return est;
}
function jarvisTexto(t){
  const est = jarvisEstado; if(!est) return;
  const el = est.el.querySelector('.jv-texto');
  if(el.textContent !== t){ el.textContent = t; est.alvo = Math.min(1, est.alvo + .55); }
}
function jarvisPensando(t){
  const est = jarvisEstado; if(!est) return;
  est.pensando = true;
  est.el.classList.add('pensando');
  est.el.querySelector('.jv-status-txt').textContent = t || 'PROCESSANDO';
  est.el.querySelector('.jv-fechar').textContent = '';
}
function jarvisFechar(agora){
  const est = jarvisEstado; if(!est) return;
  jarvisEstado = null;
  cancelAnimationFrame(est.raf);
  if(agora){ est.el.remove(); return; }
  est.el.classList.remove('aberto');
  est.el.classList.add('saindo');
  setTimeout(()=>est.el.remove(), 380);
}

/* ========== MAIS ANIMAÇÕES ==========
   Onda ao tocar nos botões (de onde o dedo tocou) e a barra de baixo com o ícone "pulando" ao trocar de aba. */
const ONDA_ALVOS = '.btn, .resumo-btn, .dif-chip, .lv-card, .lm-parte, .sino-item, .lv-barra-btn, .section-add, .lvn-medley, .lvn-importar, .pin-tecla, .gm-linha, .ponto-semana-head';
document.addEventListener('pointerdown', e=>{
  if(!efeitosLigados) return;
  const alvo = e.target.closest(ONDA_ALVOS);
  if(!alvo || alvo.disabled) return;
  const r = alvo.getBoundingClientRect();
  const tam = Math.max(r.width, r.height) * 2.2;
  const onda = document.createElement('span');
  onda.className = 'efeito-onda';
  onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam/2}px;top:${e.clientY - r.top - tam/2}px`;
  if(getComputedStyle(alvo).position === 'static') alvo.classList.add('onda-pos');
  alvo.classList.add('onda-recorte');
  alvo.appendChild(onda);
  setTimeout(()=>{ onda.remove(); if(!alvo.querySelector('.efeito-onda')) alvo.classList.remove('onda-recorte', 'onda-pos'); }, 650);
}, { passive: true });
document.addEventListener('click', e=>{
  const nav = e.target.closest('.nav-item');
  if(!nav || !efeitosLigados) return;
  nav.classList.remove('nav-pulo'); void nav.offsetWidth; nav.classList.add('nav-pulo');
});

/* Dados do App em abas: Geral · Visual · Recursos · Conta */
let ddAbaAtual = 'geral';
function ddAba(nome){
  ddAbaAtual = nome;
  document.querySelectorAll('#ddAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.dd === nome));
  document.querySelectorAll('#aba-ajustes .dd-painel').forEach(p=>p.classList.toggle('active', p.dataset.dd === nome));
}

/* ========== VERSÍCULO (topo de Finanças) ==========
   Um versículo diferente a cada vez que o app abre (não repete o da última vez). */
const VERSICULOS = [
  ['O Senhor é o meu pastor; nada me faltará. Deitar-me faz em verdes pastos, guia-me mansamente a águas tranquilas. Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do Seu nome. Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque Tu estás comigo.', 'Salmos 23:1-4'],
  ['Não se aparte da tua boca o livro desta Lei; antes, medita nele dia e noite, para que tenhas cuidado de fazer conforme tudo quanto nele está escrito; porque, então, farás prosperar o teu caminho. Não to mandei Eu? Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.', 'Josué 1:8-9'],
  ['Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-O em todos os teus caminhos, e Ele endireitará as tuas veredas. Não sejas sábio aos teus próprios olhos; teme ao Senhor e aparta-te do mal.', 'Provérbios 3:5-7'],
  ['Não andeis ansiosos de coisa alguma; em tudo, porém, sejam conhecidas, diante de Deus, as vossas petições, pela oração e pela súplica, com ações de graças. E a paz de Deus, que excede todo o entendimento, guardará o vosso coração e a vossa mente em Cristo Jesus.', 'Filipenses 4:6-7'],
  ['Aprendi a viver contente em toda e qualquer situação. Tanto sei estar humilhado como também ser honrado; de tudo e em todas as circunstâncias já tenho experiência, tanto de fartura como de fome, assim de abundância como de escassez. Tudo posso naquele que me fortalece.', 'Filipenses 4:11-13'],
  ['Faz forte ao cansado e multiplica as forças ao que não tem nenhum vigor. Os jovens se cansam e se fatigam, e os moços de exaustos caem, mas os que esperam no Senhor renovam as suas forças, sobem com asas como águias, correm e não se cansam, caminham e não se fatigam.', 'Isaías 40:29-31'],
  ['Não temas, porque Eu sou contigo; não te assombres, porque Eu sou o teu Deus; Eu te fortaleço, e te ajudo, e te sustento com a minha destra fiel. Porque Eu, o Senhor, teu Deus, te tomo pela tua mão direita e te digo: Não temas, que Eu te ajudo.', 'Isaías 41:10, 13'],
  ['Não vos inquieteis, dizendo: Que comeremos? Que beberemos? Ou: Com que nos vestiremos? Vosso Pai celeste sabe que necessitais de todas elas. Buscai, pois, em primeiro lugar, o Seu reino e a Sua justiça, e todas estas coisas vos serão acrescentadas. Não vos inquieteis com o dia de amanhã; basta ao dia o seu próprio mal.', 'Mateus 6:31-34'],
  ['Vinde a mim, todos os que estais cansados e sobrecarregados, e Eu vos aliviarei. Tomai sobre vós o meu jugo e aprendei de mim, porque sou manso e humilde de coração; e achareis descanso para a vossa alma. Porque o meu jugo é suave, e o meu fardo é leve.', 'Mateus 11:28-30'],
  ['Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus, daqueles que são chamados segundo o Seu propósito. Que diremos, pois, à vista destas coisas? Se Deus é por nós, quem será contra nós? Aquele que não poupou o Seu próprio Filho, porventura não nos dará graciosamente com Ele todas as coisas?', 'Romanos 8:28, 31-32'],
  ['Em todas estas coisas somos mais que vencedores, por meio daquele que nos amou. Porque eu estou bem certo de que nem a morte, nem a vida, nem os anjos, nem as coisas do presente, nem do porvir, nem a altura, nem a profundidade, nem qualquer outra criatura poderá separar-nos do amor de Deus, que está em Cristo Jesus, nosso Senhor.', 'Romanos 8:37-39'],
  ['Rogo-vos, pois, irmãos, pelas misericórdias de Deus, que apresenteis o vosso corpo por sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis com este século, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus.', 'Romanos 12:1-2'],
  ['O que habita no esconderijo do Altíssimo e descansa à sombra do Onipotente diz ao Senhor: Meu refúgio e meu baluarte, Deus meu, em quem confio. Porque aos Seus anjos dará ordens a teu respeito, para que te guardem em todos os teus caminhos.', 'Salmos 91:1-2, 11'],
  ['Elevo os olhos para os montes: de onde me virá o socorro? O meu socorro vem do Senhor, que fez o céu e a terra. Ele não permitirá que os teus pés vacilem; não dormitará aquele que te guarda. O Senhor guardará a tua saída e a tua entrada, desde agora e para sempre.', 'Salmos 121:1-3, 8'],
  ['Confia no Senhor e faze o bem; habita na terra e alimenta-te da verdade. Agrada-te do Senhor, e Ele satisfará os desejos do teu coração. Entrega o teu caminho ao Senhor, confia nele, e o mais Ele fará.', 'Salmos 37:3-5'],
  ['Deus é o nosso refúgio e fortaleza, socorro bem presente nas tribulações. Portanto, não temeremos ainda que a terra se transtorne e os montes se abalem no seio dos mares; ainda que as águas tumultuem e espumejem e na sua fúria os montes se estremeçam.', 'Salmos 46:1-3'],
  ['As misericórdias do Senhor são a causa de não sermos consumidos, porque as Suas misericórdias não têm fim; renovam-se cada manhã. Grande é a Tua fidelidade. A minha porção é o Senhor, diz a minha alma; portanto, esperarei nele. Bom é o Senhor para os que esperam por Ele, para a alma que O busca.', 'Lamentações 3:22-25'],
  ['Eu é que sei que pensamentos tenho a vosso respeito, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que desejais. Então, me invocareis, passareis a orar a mim, e Eu vos ouvirei. Buscar-me-eis e me achareis quando me buscardes de todo o vosso coração.', 'Jeremias 29:11-13'],
  ['Por isso, não desanimamos; pelo contrário, mesmo que o nosso homem exterior se corrompa, o nosso homem interior se renova de dia em dia. Porque a nossa leve e momentânea tribulação produz para nós eterno peso de glória, não atentando nós nas coisas que se veem, mas nas que se não veem; porque as que se veem são temporais, e as que se não veem são eternas.', '2 Coríntios 4:16-18'],
  ['A minha graça te basta, porque o poder se aperfeiçoa na fraqueza. De boa vontade, pois, mais me gloriarei nas fraquezas, para que sobre mim repouse o poder de Cristo. Pelo que sinto prazer nas fraquezas, nas necessidades, nas angústias, por amor de Cristo. Porque, quando sou fraco, então, é que sou forte.', '2 Coríntios 12:9-10'],
  ['Não vos enganeis: de Deus não se zomba; pois aquilo que o homem semear, isso também ceifará. E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não desfalecermos. Por isso, enquanto tivermos oportunidade, façamos o bem a todos.', 'Gálatas 6:7, 9-10'],
  ['Visto que temos a rodear-nos tão grande nuvem de testemunhas, desembaraçando-nos de todo peso e do pecado que tenazmente nos assedia, corramos, com perseverança, a carreira que nos está proposta, olhando firmemente para o Autor e Consumador da fé, Jesus.', 'Hebreus 12:1-2'],
  ['Toda disciplina, com efeito, no momento não parece ser motivo de alegria, mas de tristeza; ao depois, entretanto, produz fruto pacífico aos que têm sido por ela exercitados, fruto de justiça. Por isso, restabelecei as mãos descaídas e os joelhos trôpegos; e fazei caminhos retos para os pés.', 'Hebreus 12:11-13'],
  ['Não sabeis vós que os que correm no estádio, todos, na verdade, correm, mas um só leva o prêmio? Correi de tal maneira que o alcanceis. Todo atleta em tudo se domina; aqueles, para alcançar uma coroa corruptível; nós, porém, a incorruptível. Assim corro também eu, não sem meta; assim luto, não como desferindo golpes no ar.', '1 Coríntios 9:24-26'],
  ['Porque Deus não nos tem dado espírito de covardia, mas de poder, de amor e de moderação. Participa dos meus sofrimentos como bom soldado de Cristo Jesus. Nenhum soldado em serviço se envolve em negócios desta vida, porque o seu objetivo é satisfazer àquele que o arregimentou.', '2 Timóteo 1:7; 2:3-4'],
  ['Combati o bom combate, completei a carreira, guardei a fé. Já agora a coroa da justiça me está guardada, a qual o Senhor, reto juiz, me dará naquele Dia; e não somente a mim, mas também a todos quantos amam a Sua vinda.', '2 Timóteo 4:7-8'],
  ['Quanto ao mais, sede fortalecidos no Senhor e na força do Seu poder. Revesti-vos de toda a armadura de Deus, para poderdes ficar firmes contra as ciladas do diabo. Portanto, tomai toda a armadura de Deus, para que possais resistir no dia mau e, depois de terdes vencido tudo, permanecer inabaláveis.', 'Efésios 6:10-11, 13'],
  ['Tudo quanto fizerdes, fazei-o de todo o coração, como para o Senhor e não para homens, cientes de que recebereis do Senhor a recompensa da herança. A Cristo, o Senhor, é que estais servindo.', 'Colossenses 3:23-24'],
  ['Vai ter com a formiga, ó preguiçoso, considera os seus caminhos e sê sábio. Não tendo ela chefe, nem oficial, nem comandante, no estio prepara o seu pão, na sega ajunta o seu mantimento. Ó preguiçoso, até quando ficarás deitado? Um pouco para dormir, um pouco para cochilar, um pouco para cruzar os braços em repouso, assim sobrevirá a tua pobreza como um ladrão.', 'Provérbios 6:6-11'],
  ['Confia ao Senhor as tuas obras, e os teus desígnios serão estabelecidos. O Senhor fez todas as coisas para determinados fins. O coração do homem traça o seu caminho, mas o Senhor lhe dirige os passos.', 'Provérbios 16:3-4, 9'],
  ['Sobre tudo o que se deve guardar, guarda o coração, porque dele procedem as fontes da vida. Desvia de ti a falsidade da boca e afasta de ti a perversidade dos lábios. Os teus olhos olhem direito, e as tuas pálpebras, diretamente diante de ti. Pondera a vereda de teus pés, e todos os teus caminhos sejam retos.', 'Provérbios 4:23-26'],
  ['Trazei todos os dízimos à casa do Tesouro, para que haja mantimento na minha casa; e provai-me nisto, diz o Senhor dos Exércitos, se Eu não vos abrir as janelas do céu e não derramar sobre vós bênção sem medida.', 'Malaquias 3:10'],
  ['Honra ao Senhor com os teus bens e com as primícias de toda a tua renda; e se encherão fartamente os teus celeiros, e transbordarão de vinho os teus lagares. Filho meu, não rejeites a disciplina do Senhor, nem te enfades da Sua repreensão.', 'Provérbios 3:9-11'],
  ['Quem é fiel no pouco também é fiel no muito; e quem é injusto no pouco também é injusto no muito. Se, pois, não vos tornastes fiéis na aplicação das riquezas, quem vos confiará a verdadeira riqueza?', 'Lucas 16:10-11'],
  ['Deixo-vos a paz, a minha paz vos dou; não vo-la dou como a dá o mundo. Não se turbe o vosso coração, nem se atemorize. Estas coisas vos tenho dito para que tenhais paz em mim. No mundo, passais por aflições; mas tende bom ânimo; Eu venci o mundo.', 'João 14:27; 16:33'],
  ['Eu sou a videira, vós, os ramos. Quem permanece em mim, e Eu, nele, esse dá muito fruto; porque sem mim nada podeis fazer. Se permanecerdes em mim, e as minhas palavras permanecerem em vós, pedireis o que quiserdes, e vos será feito.', 'João 15:5, 7'],
  ['Meus irmãos, tende por motivo de toda alegria o passardes por várias provações, sabendo que a provação da vossa fé, uma vez confirmada, produz perseverança. Ora, a perseverança deve ter ação completa, para que sejais perfeitos e íntegros, em nada deficientes.', 'Tiago 1:2-4'],
  ['Humilhai-vos, portanto, sob a poderosa mão de Deus, para que Ele, em tempo oportuno, vos exalte, lançando sobre Ele toda a vossa ansiedade, porque Ele tem cuidado de vós. Sede sóbrios e vigilantes. O diabo, vosso adversário, anda em derredor, como leão que ruge procurando alguém para devorar.', '1 Pedro 5:6-8'],
  ['Bem-aventurado o homem que não anda no conselho dos ímpios, não se detém no caminho dos pecadores, nem se assenta na roda dos escarnecedores. Antes, o seu prazer está na lei do Senhor, e na Sua lei medita de dia e de noite. Ele é como árvore plantada junto a corrente de águas, que, no devido tempo, dá o seu fruto, e cuja folhagem não murcha.', 'Salmos 1:1-3'],
  ['O Senhor é a minha luz e a minha salvação; de quem terei medo? O Senhor é a fortaleza da minha vida; a quem temerei? Espera pelo Senhor, tem bom ânimo, e fortifique-se o teu coração; espera, pois, pelo Senhor.', 'Salmos 27:1, 14'],
  ['Não temas, porque Eu te remi; chamei-te pelo teu nome, tu és meu. Quando passares pelas águas, Eu serei contigo; quando, pelos rios, eles não te submergirão; quando passares pelo fogo, não te queimarás, nem a chama arderá em ti.', 'Isaías 43:1-2'],
  ['Sede fortes e corajosos, não temais, nem vos atemorizeis, porque o Senhor, vosso Deus, é quem vai convosco; não vos deixará, nem vos desamparará. O Senhor é quem vai adiante de ti; Ele será contigo, não te deixará, nem te desamparará; não temas, nem te atemorizes.', 'Deuteronômio 31:6, 8'],
  ['Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu: há tempo de nascer e tempo de morrer; tempo de plantar e tempo de arrancar o que se plantou; tempo de chorar e tempo de rir; tempo de prantear e tempo de saltar de alegria.', 'Eclesiastes 3:1-2, 4'],
  ['Ele te declarou, ó homem, o que é bom e que é o que o Senhor pede de ti: que pratiques a justiça, e ames a misericórdia, e andes humildemente com o teu Deus.', 'Miqueias 6:8'],
  ['O amor é paciente, é benigno; o amor não arde em ciúmes, não se ufana, não se ensoberbece, não se conduz inconvenientemente, não procura os seus interesses, não se exaspera, não se ressente do mal; não se alegra com a injustiça, mas regozija-se com a verdade; tudo sofre, tudo crê, tudo espera, tudo suporta.', '1 Coríntios 13:4-7'],
  ['Regozijai-vos sempre. Orai sem cessar. Em tudo, dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco. Julgai todas as coisas, retende o que é bom; abstende-vos de toda forma de mal.', '1 Tessalonicenses 5:16-18, 21-22'],
  ['Sonda-me, ó Deus, e conhece o meu coração; prova-me e conhece os meus pensamentos; vê se há em mim algum caminho mau e guia-me pelo caminho eterno.', 'Salmos 139:23-24'],
  ['Ainda que a figueira não floresça, nem haja fruto na vide; o produto da oliveira minta, e os campos não produzam mantimento; ainda que as ovelhas sejam arrebatadas do aprisco, e nos currais não haja gado, todavia, eu me alegro no Senhor, exulto no Deus da minha salvação. O Senhor Deus é a minha fortaleza.', 'Habacuque 3:17-19'],
  ['Irmãos, quanto a mim, não julgo havê-lo alcançado; mas uma coisa faço: esquecendo-me das coisas que para trás ficam e avançando para as que diante de mim estão, prossigo para o alvo, para o prêmio da soberana vocação de Deus em Cristo Jesus.', 'Filipenses 3:13-14'],
  ['Porque Deus amou o mundo de tal maneira que deu o Seu Filho unigênito, para que todo o que nele crê não pereça, mas tenha a vida eterna. Porquanto Deus enviou o Seu Filho ao mundo, não para que julgasse o mundo, mas para que o mundo fosse salvo por Ele.', 'João 3:16-17']
];
const versiculoAtual = (()=>{
  let ultimo = -1; try{ ultimo = Number(localStorage.getItem('siloe-versiculo')); }catch(e){}
  let i = Math.floor(Math.random() * VERSICULOS.length);
  if(i === ultimo) i = (i + 1 + Math.floor(Math.random() * (VERSICULOS.length - 1))) % VERSICULOS.length;
  try{ localStorage.setItem('siloe-versiculo', String(i)); }catch(e){}
  return VERSICULOS[i];
})();
function renderVersiculo(){
  const el = document.getElementById('versiculoDia');
  if(!el || el.dataset.pronto) return;
  el.dataset.pronto = '1';
  el.innerHTML = `<p class="vs-texto">${String(versiculoAtual[0]).split(" ").map((w, i)=>`<span class="vs-p" style="--i:${i}">${w}</span>`).join(" ")}</p><span class="vs-ref">${versiculoAtual[1]}</span>`;
  el.onclick = ()=>el.classList.toggle('inteiro');
}

/* ---------- nome do ícone ao segurar o dedo (botões só com ícone) ----------
   Vale para todo botão com desenho e sem texto que tenha title/aria-label. Segurou → mostra o nome e não aperta. */
let icoSegurar = null;   // { el, timer, x, y, mostrou }
function icoNomeDe(el){
  const nome = el.getAttribute('aria-label') || el.getAttribute('title') || '';
  if(!nome || !el.querySelector('svg')) return '';
  return el.textContent.replace(/\s+/g, '').length > 4 ? '' : nome;   // botão com texto já diz o que faz
}
function icoMostrarNome(el, nome){
  let b = document.getElementById('icoNome');
  if(!b){ b = document.createElement('div'); b.id = 'icoNome'; b.className = 'ico-nome'; document.body.appendChild(b); }
  b.textContent = nome;
  b.classList.remove('aberto');
  const r = el.getBoundingClientRect();
  b.style.left = '0px'; b.style.top = '0px';
  const w = b.offsetWidth, h = b.offsetHeight;
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width/2 - w/2));
  const y = r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10;
  b.style.left = x + 'px'; b.style.top = y + 'px';
  void b.offsetWidth; b.classList.add('aberto');
  clearTimeout(b._fechar); b._fechar = setTimeout(()=>b.classList.remove('aberto'), 1600);
}
document.addEventListener('touchstart', e=>{
  const el = e.target.closest && e.target.closest('button,[role="button"],a,.ico-btn');
  const nome = el ? icoNomeDe(el) : '';
  if(icoSegurar) clearTimeout(icoSegurar.timer);
  if(!nome){ icoSegurar = null; return; }
  const t = e.touches[0];
  icoSegurar = { el, x:t.clientX, y:t.clientY, mostrou:false };
  icoSegurar.timer = setTimeout(()=>{
    if(!icoSegurar) return;
    icoSegurar.mostrou = true;
    icoMostrarNome(el, nome);
    if(navigator.vibrate) navigator.vibrate(8);
  }, 450);
}, { passive:true });
document.addEventListener('touchmove', e=>{
  if(!icoSegurar || icoSegurar.mostrou) return;
  const t = e.touches[0];
  if(Math.abs(t.clientX - icoSegurar.x) > 10 || Math.abs(t.clientY - icoSegurar.y) > 10){ clearTimeout(icoSegurar.timer); icoSegurar = null; }
}, { passive:true });
document.addEventListener('touchend', e=>{
  if(!icoSegurar) return;
  clearTimeout(icoSegurar.timer);
  if(icoSegurar.mostrou){ e.preventDefault(); setTimeout(()=>{ icoSegurar = null; }, 400); }   // segurou para ver o nome: não aperta
  else icoSegurar = null;
}, { passive:false });
document.addEventListener('touchcancel', ()=>{ if(icoSegurar){ clearTimeout(icoSegurar.timer); if(!icoSegurar.mostrou) icoSegurar = null; } });
document.addEventListener('click', e=>{
  if(icoSegurar && icoSegurar.mostrou){ e.preventDefault(); e.stopPropagation(); icoSegurar = null; }
}, true);

/* ---------- Finanças "só o essencial" (celular) ----------
   Mostra só o resumo (saldo, vai entrar, falta pagar, próximos meses, Contas do mês); a seta embaixo abre o resto.
   Escolha guardada no aparelho (siloe-fin-tudo = '1' → mostra tudo). */
function finEssencial(){ try{ return localStorage.getItem('siloe-fin-tudo') !== '1'; }catch(e){ return true; } }
function finAplicarEssencial(){
  const aba = document.getElementById('aba-planner'), btn = document.getElementById('btnFinTudo');
  if(!aba) return;
  const so = finEssencial();
  aba.classList.toggle('essencial', so);
  if(btn){ const nome = so ? 'Mostrar tudo' : 'Só o essencial'; btn.title = nome; btn.setAttribute('aria-label', nome); btn.classList.toggle('aberto', !so); }
  if(typeof applyAllLayouts === 'function') setTimeout(applyAllLayouts, 30);
}
function finEssencialAlternar(){
  const mostrarTudo = finEssencial();
  try{ mostrarTudo ? localStorage.setItem('siloe-fin-tudo', '1') : localStorage.removeItem('siloe-fin-tudo'); }catch(e){}
  finAplicarEssencial();
  if(mostrarTudo){
    const prim = document.querySelector('#aba-planner .fin-extra');
    if(prim) setTimeout(()=>prim.scrollIntoView({ behavior:'smooth', block:'start' }), 60);
  }
}
finAplicarEssencial();
