/* ================= DIGITAL (v14.4): entrar com a digital ou o rosto do aparelho =================
   Usa o leitor do próprio celular (WebAuthn, "passkey" do aparelho). O banco (Supabase) não conhece a digital:
   ao ligar, o app guarda o PIN neste aparelho cifrado com uma chave que só sai do leitor depois da digital
   (extensão PRF). Celular sem PRF: o PIN fica guardado no aparelho e a digital só libera o uso dele.
   - Tela do PIN: com a digital ligada, ela é pedida sozinha (principal); o teclado do PIN continua embaixo.
   - "Pedir a digital toda vez que abrir o app" (Ajustes → Segurança): mesmo com o login guardado, o app só abre
     depois da digital (ou do PIN). Ligado por padrão quando a digital é ligada.
   Tudo fica só neste aparelho (localStorage siloe-digital); "Sair deste aparelho" apaga junto. */
const DIG_KEY = 'siloe-digital', DIG_TRAVA_KEY = 'siloe-digital-trava';
const digB64 = b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const digDeB64 = s=>Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c=>c.charCodeAt(0));
const digAleatorio = n=>crypto.getRandomValues(new Uint8Array(n));
function digLer(){ try{ return JSON.parse(localStorage.getItem(DIG_KEY) || 'null'); }catch(e){ return null; } }
function digLigada(){ const d = digLer(); return !!(d && d.id); }
function digTravaLigada(){ try{ return digLigada() && localStorage.getItem(DIG_TRAVA_KEY) !== '0'; }catch(e){ return false; } }
async function digTemLeitor(){
  try{ return !!(window.PublicKeyCredential && isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }catch(e){ return false; }
}
async function digChave(prf){ return crypto.subtle.importKey('raw', prf, 'AES-GCM', false, ['encrypt', 'decrypt']); }
/* pede a digital; devolve o resultado do PRF (ou null se o celular não tiver) */
async function digPedir(d){
  const cred = await navigator.credentials.get({ publicKey: {
    challenge: digAleatorio(32), rpId: location.hostname, userVerification: 'required', timeout: 60000,
    allowCredentials: [{ type: 'public-key', id: digDeB64(d.id), transports: ['internal'] }],
    extensions: d.salt ? { prf: { eval: { first: digDeB64(d.salt) } } } : {}
  } });
  const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
  return ext.prf && ext.prf.results && ext.prf.results.first ? ext.prf.results.first : null;
}
/* liga a digital neste aparelho guardando o PIN (que a pessoa acabou de digitar certo) */
async function digAtivar(pin){
  const salt = digAleatorio(32);
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: digAleatorio(32), rp: { name: 'Siloé', id: location.hostname },
    user: { id: digAleatorio(16), name: 'siloe', displayName: 'Siloé' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    timeout: 60000, extensions: { prf: { eval: { first: salt } } }
  } });
  const d = { id: digB64(cred.rawId), criadaEm: Date.now() };
  const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
  let prf = ext.prf && ext.prf.results && ext.prf.results.first;
  if(!prf && ext.prf && ext.prf.enabled){ d.salt = digB64(salt); try{ prf = await digPedir(d); }catch(e){ prf = null; } }
  if(prf){
    const iv = digAleatorio(12), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await digChave(prf), new TextEncoder().encode(pin));
    Object.assign(d, { salt: digB64(salt), iv: digB64(iv), ct: digB64(ct) });
  } else { delete d.salt; d.pin = pin; }   // sem PRF: o PIN fica neste aparelho, liberado só pela digital
  localStorage.setItem(DIG_KEY, JSON.stringify(d));
  try{ localStorage.setItem(DIG_TRAVA_KEY, '1'); }catch(e){}
  return true;
}
/* digital → PIN guardado (ou null se cancelou/falhou) */
async function digObterPin(){
  const d = digLer(); if(!d) return null;
  try{
    const prf = await digPedir(d);
    if(d.ct){
      if(!prf) return null;
      const txt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: digDeB64(d.iv) }, await digChave(prf), digDeB64(d.ct));
      return new TextDecoder().decode(txt);
    }
    return d.pin || null;
  }catch(e){ return null; }
}
function digDesligar(){ try{ localStorage.removeItem(DIG_KEY); localStorage.removeItem(DIG_TRAVA_KEY); }catch(e){} }

/* ---------- tela do PIN: digital primeiro ---------- */
let digTravaAberta = false, digAposTrava = null;
async function digEntrarClique(){
  const erro = document.getElementById('loginPinErro');
  const pin = await digObterPin();
  if(!pin){ if(erro) erro.textContent = 'Digital não reconhecida: use o PIN'; return; }
  if(digTravaAberta){ digDestravar(); return; }   // login guardado: só abrir o app
  entrarComPin(pin);
}
function digMostrarBotao(){
  const b = document.getElementById('loginDigital'); if(!b) return;
  b.hidden = !digLigada();
}
/* quando a tela do PIN aparece (login exigido), a digital é pedida sozinha */
efDepois('loginModoPin', ()=>{
  digMostrarBotao();
  if(digLigada() && document.getElementById('loginTela')?.classList.contains('modo-pin') && !digTravaAberta) setTimeout(digEntrarClique, 350);
});
/* PIN certo num aparelho com leitor e sem digital ligada: oferece ligar */
efDepois('aposEntrar', async ()=>{
  if(digTravaAberta) return;
  const pin = window.digUltimoPin; window.digUltimoPin = null;
  if(!pin || digLigada() || !(await digTemLeitor())) return;
  try{ if(localStorage.getItem('siloe-digital-perguntou')) return; localStorage.setItem('siloe-digital-perguntou', '1'); }catch(e){}
  setTimeout(async ()=>{ if(await iosConfirm('Usar a digital para entrar da próxima vez?')){ try{ await digAtivar(pin); showToast('Digital ligada neste aparelho'); }catch(e){ showToast('Não consegui ligar a digital'); } } }, 1500);
});
/* guarda o PIN digitado só até a pergunta acima (fica na memória, não é gravado) */
efDepois('entrarComPin', Object.assign(()=>{}, { antes: pin=>{ window.digUltimoPin = pin; } }));

/* ---------- trava ao abrir: com o login guardado, o app só abre depois da digital (ou do PIN) ---------- */
function digDestravar(){
  digTravaAberta = false;
  document.getElementById('loginTela')?.classList.remove('show', 'modo-pin');
  if(typeof mostrarSplash === 'function') mostrarSplash();   // enquanto carrega, a abertura volta (o versículo já está escrito)
  const f = digAposTrava; digAposTrava = null;
  if(f) f();
}
(function(){
  if(!digTravaLigada() || MODO_TESTE_LOCAL) return;
  const orig = window.carregar;
  let primeira = true;
  window.carregar = function(...a){
    if(!primeira || !digTravaLigada()) return orig.apply(this, a);
    primeira = false;
    digTravaAberta = true;
    /* mostra a tela do PIN com a digital por cima da abertura; destravou → carrega normalmente */
    digAposTrava = ()=>orig.apply(this, a);
    const tela = document.getElementById('loginTela');
    setTimeout(()=>{
      if(!digTravaAberta) return;
      fecharSplash(true);
      tela.classList.add('show');
      loginModoPin(true);
      /* PIN digitado na trava: confere no banco (entrarComPin) e o aposEntrar carrega; aqui só fecha a trava */
      digTravaAberta = true;
      digEntrarClique();
    }, Math.min(1800, typeof window.splashMinimo === 'number' ? window.splashMinimo : 1800));
  };
})();
/* PIN certo durante a trava: aposEntrar já carrega; a trava só precisa sair do caminho */
efDepois('aposEntrar', Object.assign(()=>{}, { antes: ()=>{ if(digTravaAberta){ digTravaAberta = false; digAposTrava = null; } } }));

/* ---------- Ajustes → Segurança ---------- */
async function digRenderAjustes(){
  const box = document.getElementById('digConfig'); if(!box) return;
  const tem = await digTemLeitor();
  box.style.display = tem || digLigada() ? '' : 'none';
  const lig = digLigada();
  document.getElementById('digStatus').textContent = lig ? 'Ligada' : 'Desligada';
  document.getElementById('digStatus').classList.toggle('ligada', lig);
  document.getElementById('digBtn').textContent = lig ? 'Desligar a digital' : 'Ligar a digital';
  document.getElementById('digTravaLinha').style.display = lig ? '' : 'none';
  document.getElementById('digTrava').checked = digTravaLigada();
}
async function digBotaoAjustes(){
  if(digLigada()){ digDesligar(); showToast('Digital desligada neste aparelho'); digRenderAjustes(); return; }
  /* para ligar precisa do PIN uma vez (é ele que a digital vai liberar depois) */
  const pin = await digPedirPinUmaVez(); if(!pin) return;
  try{ await digAtivar(pin); showToast('Digital ligada neste aparelho'); }catch(e){ showToast('Não consegui ligar a digital'); }
  digRenderAjustes();
}
function digTravaMudou(v){ try{ localStorage.setItem(DIG_TRAVA_KEY, v ? '1' : '0'); }catch(e){} }
/* janela com o teclado do PIN; confere o PIN no banco antes de guardar */
function digPedirPinUmaVez(){
  return new Promise(ok=>{
    const ov = document.createElement('div');
    ov.className = 'modal-overlay active';
    ov.innerHTML = `<div class="modal"><div class="modal-header"><div class="modal-title">Digite seu PIN</div></div>
      <div class="ia-desc" style="text-align:center;margin:12px 0">Uma vez, para a digital poder entrar no lugar dele.</div>
      <div class="pin-pontos" id="digPinPontos"></div><div class="login-erro" id="digPinErro"></div><div class="pin-teclado" id="digPinTeclado"></div>
      <button type="button" class="login-troca" id="digPinCancelar">Cancelar</button></div>`;
    document.body.appendChild(ov);
    const fim = v=>{ ov.remove(); pinTecladoAtivo = null; ok(v); };
    ov.querySelector('#digPinCancelar').onclick = ()=>fim(null);
    const tec = pinTeclado('digPinTeclado', 'digPinPontos', async pin=>{
      const r = await window.SiloSupabase.entrar(pinEmailDoAparelho(), pin);
      if(r.ok) fim(pin); else { document.getElementById('digPinErro').textContent = 'PIN errado'; tec.tremer(); tec.limpar(); }
    });
    pinTecladoAtivo = tec;
  });
}
efDepois('renderSeguranca', ()=>digRenderAjustes());
/* sair deste aparelho: a digital sai junto */
efDepois('sairDoApp', Object.assign(()=>{}, { antes: ()=>digDesligar() }));
