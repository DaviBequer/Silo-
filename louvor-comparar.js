/* ================= LOUVOR — COMPARAR COM O ORIGINAL =================
   Depois de importar, a música guarda de onde veio (l.origem):
   - Drive / arquivo: { tipo:'drive'|'arquivo', id?, nome, link? } — o PDF fica guardado NESTE aparelho (IndexedDB);
     noutro aparelho, o do Drive é baixado de novo.
   - Cifra Club: { tipo:'cifraclub', url, texto, letras:{ url, titulo, estrofes } | null } — vai junto nos dados.
   A tela mostra o original e o que ficou no app; as linhas em amarelo (l.revisar) aparecem marcadas dos dois lados. */

/* ---------- original guardado no aparelho ---------- */
function lvOriginalBanco(){
  return new Promise((ok, erro)=>{
    const r = indexedDB.open('siloe-originais', 1);
    r.onupgradeneeded = ()=>r.result.createObjectStore('arquivos');
    r.onsuccess = ()=>ok(r.result);
    r.onerror = ()=>erro(r.error);
  });
}
async function lvOriginalGuardar(id, blob){
  try{
    const db = await lvOriginalBanco();
    db.transaction('arquivos', 'readwrite').objectStore('arquivos').put({ blob, nome: blob.name || '', tipo: blob.type || '' }, id);
  }catch(e){}   // sem IndexedDB (aba anônima): só não dá para comparar com o PDF depois
}
async function lvOriginalLer(id){
  try{
    const db = await lvOriginalBanco();
    return await new Promise(ok=>{
      const q = db.transaction('arquivos').objectStore('arquivos').get(id);
      q.onsuccess = ()=>ok(q.result || null);
      q.onerror = ()=>ok(null);
    });
  }catch(e){ return null; }
}

/* ---------- botão na música ---------- */
function lvAtualizarBtnComparar(l){
  const b = document.getElementById('lvBtnComparar');
  if(b) b.style.display = l && l.origem ? '' : 'none';
}

/* ---------- tela ---------- */
let lvcmpAba = 'original';
function lvCompararAba(a){
  lvcmpAba = a;
  document.getElementById('lvcmpGrade').dataset.aba = a;
  document.querySelectorAll('#lvcmpAbas .dash-tab').forEach(b=>b.classList.toggle('active', b.dataset.aba === a));
}
function lvCompararFechar(){ document.getElementById('pageLvComparar').classList.remove('active'); }
const lvcmpNorm = t=>String(t||'').split(/\s+/).map(lviNormPalavra).filter(Boolean).join(' ');
async function lvCompararAbrir(){
  const l = getLouvorAtual(); if(!l) return;
  if(!l.origem){ showToast('Essa música não guardou o original (foi feita antes ou à mão)'); return; }
  document.getElementById('lvcmpTitulo').textContent = l.titulo || 'Comparar';
  lvCompararAba(l.revisar && l.revisar.length ? 'app' : 'original');
  document.getElementById('pageLvComparar').classList.add('active');
  lvCompararRenderApp(l);
  await lvCompararRenderOriginal(l);
}
/* o que ficou no app: o texto com as linhas para conferir em amarelo */
function lvCompararRenderApp(l){
  const el = document.getElementById('lvcmpApp');
  if(!(l.conteudo || '').trim()){ el.innerHTML = `<div class="lvcmp-tit"><b>No app</b><small>${l.origem && l.origem.tipo === 'drive' ? 'só o arquivo do Drive (o texto não foi tirado)' : 'sem letra ainda'}</small></div>`; return; }
  const olhar = new Set((l.revisar || []).map(t=>t.trim()));
  const linhas = (l.conteudo || '').split('\n').map(x=>{
    const t = x.trim();
    const cls = /^\[.+\]$/.test(t) ? 'rot' : isChordLine(t) ? 'ac' : olhar.has(t) ? 'olhar' : /^-{1,3}$/.test(t) ? 'marca' : '';
    return `<div class="lvcmp-l ${cls}">${lvEsc(x) || '&nbsp;'}</div>`;
  }).join('');
  const n = olhar.size;
  el.innerHTML = `<div class="lvcmp-tit"><b>No app</b>${n ? `<small>${n} linha${n > 1 ? 's' : ''} em amarelo para conferir</small><button type="button" class="lvi-rel-ok" onclick="lvJaConferi();lvCompararRenderApp(getLouvorAtual())">Já conferi</button>` : '<small>tudo conferido</small>'}</div>
    <div class="lvcmp-texto">${linhas}</div>`;
}
/* música só com o PDF do Drive → lê o PDF e monta no padrão do app (como importar); daí em diante abre primeiro o app */
async function lvConverterDoDrive(){
  const l = getLouvorAtual(); if(!l || !l.origem) return;
  /* o pedido de acesso ao Drive sai ainda dentro do toque (sem await antes) */
  const acesso = l.origem.id && typeof drivePedirToken === 'function' && typeof driveTokenCliente !== 'undefined' && driveTokenCliente ? drivePedirToken().catch(()=>null) : Promise.resolve(null);
  const btn = document.querySelector('.lvcmp-converter-btn'); if(btn){ btn.disabled = true; btn.classList.add('girando'); }
  let guardado = await lvOriginalLer(l.id), blob = guardado && guardado.blob;
  if(!blob && l.origem.id && await acesso){
    try{ const res = await fetch(`https://www.googleapis.com/drive/v3/files/${l.origem.id}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } }); if(res.ok) blob = await res.blob(); }catch(e){}
  }
  if(!blob){ if(btn){ btn.disabled = false; btn.classList.remove('girando'); } showToast('Não consegui baixar o PDF do Drive: confira o acesso ao Google e tente de novo'); return; }
  const file = blob instanceof File ? blob : new File([blob], l.origem.nome || 'original.pdf', { type:'application/pdf' });
  lvCompararFechar();
  const origem = Object.assign({}, l.origem); delete origem.soArquivo;
  await lvImportarNoAtual({ target:{ files:[file], value:'' }, semConfirmar: true, origem });
  const lv = getLouvorAtual(); if(lv && lv.origem) delete lv.origem.soArquivo;
  persist();
}
/* o original */
async function lvCompararRenderOriginal(l){
  const el = document.getElementById('lvcmpOriginal');
  const o = l.origem;
  const olhar = new Set((l.revisar || []).map(lvcmpNorm));
  if(o.tipo === 'cifraclub'){
    const cifra = (o.texto || '').split('\n').map(x=>`<div class="lvcmp-l${isChordLine(x.trim()) ? ' ac' : /^\[.+\]$/.test(x.trim()) ? ' rot' : ''}">${lvEsc(x) || '&nbsp;'}</div>`).join('');
    const marcado = v=>{ const n = lvcmpNorm(v); return [...olhar].some(o=>o && n.includes(o)); };   // no Letras o verso pode vir junto com outro
    const letras = o.letras ? o.letras.estrofes.map(est=>`<div class="lvcmp-estrofe">${est.map(v=>`<div class="lvcmp-l${marcado(v) ? ' olhar' : ''}">${lvEsc(v)}</div>`).join('')}</div>`).join('') : '';
    el.innerHTML = `${o.letras ? `<div class="lvcmp-tit"><b>Letras</b><a href="${lvEsc(o.letras.url)}" target="_blank" rel="noopener">abrir no site</a></div><div class="lvcmp-texto lvcmp-letras">${letras}</div>` : ''}
      <div class="lvcmp-tit"><b>Cifra Club</b><a href="${lvEsc(o.url)}" target="_blank" rel="noopener">abrir no site</a></div><div class="lvcmp-texto">${cifra}</div>`;
    return;
  }
  /* PDF ou foto: deste aparelho; o do Drive pode ser baixado de novo */
  const link = o.link ? `<a href="${lvEsc(o.link)}" target="_blank" rel="noopener">abrir no Drive</a>` : '';
  /* veio do Drive só com o arquivo: o ícone ⇄ passa para o padrão do app (o PDF continua aqui para comparar) */
  const converter = o.soArquivo ? `<button type="button" class="ico-btn lvcmp-converter-btn" onclick="lvConverterDoDrive()" title="Passar para o padrão do app" aria-label="Passar para o padrão do app"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg></button>` : '';
  if(o.tipo === 'drive' && typeof drivePreparar === 'function') drivePreparar();   // o acesso ao Drive pode precisar ser pedido direto do toque
  el.innerHTML = `<div class="lvcmp-tit"><b>${lvEsc(o.nome || 'Arquivo')}</b>${link}${converter}</div><div id="lvcmpPdf" class="lvcmp-pdf"><div class="voz-carregando">Abrindo o original…</div></div>`;
  const guardado = await lvOriginalLer(l.id), blob = guardado && guardado.blob;
  const caixa = document.getElementById('lvcmpPdf');
  if(blob){ await lvcmpDesenhar(caixa, blob); return; }
  /* do Drive e não guardado aqui: o app lê o PDF com o acesso do Drive só para mostrar (não guarda cópia).
     A prévia do Google dentro do app não serve: pede o login do Google no navegador e o Brave bloqueia. */
  if(o.tipo === 'drive' && o.id){
    if(typeof driveToken !== 'undefined' && driveToken && Date.now() < driveTokenVence){ await lvcmpVerDoDrive(); return; }
    caixa.innerHTML = `<button type="button" class="btn btn-outline lvcmp-ver-drive" onclick="lvcmpVerDoDrive()">${typeof LOGO_DRIVE !== 'undefined' ? LOGO_DRIVE : ''}Ver o PDF do Drive</button>`;
    return;
  }
  caixa.innerHTML = '<div class="gm-vazio">O arquivo original não está neste aparelho.</div>';
}
/* lê o PDF do Drive (pede o acesso se precisar, ainda dentro do toque) e mostra; não guarda no aparelho */
async function lvcmpVerDoDrive(){
  const l = getLouvorAtual(), caixa = document.getElementById('lvcmpPdf');
  if(!l || !l.origem || !l.origem.id || !caixa) return;
  const acesso = typeof driveTokenCliente !== 'undefined' && driveTokenCliente ? drivePedirToken() : Promise.reject(new Error(typeof driveClienteId === 'function' && driveClienteId() ? 'o Drive ainda está carregando: toque de novo' : 'o Drive não está ligado (Ajustes → Recursos)'));
  caixa.innerHTML = '<div class="voz-carregando">Abrindo o PDF do Drive…</div>';
  try{
    await acesso;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(l.origem.id)}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } });
    if(!res.ok) throw new Error('Drive ' + res.status);
    await lvcmpDesenhar(caixa, await res.blob());
  }catch(e){
    caixa.innerHTML = `<div class="gm-vazio">Não consegui abrir o PDF do Drive (${lvEsc((e && e.message) || 'erro')}).</div><button type="button" class="btn btn-outline lvcmp-ver-drive" onclick="lvcmpVerDoDrive()">Tentar de novo</button>`;
  }
}
/* desenha o original (foto ou PDF, página por página) */
async function lvcmpDesenhar(caixa, blob){
  if(/^image\//.test(blob.type || '')){
    caixa.innerHTML = `<img class="lvcmp-img" src="${URL.createObjectURL(blob)}" alt="">`;
    return;
  }
  try{
    await lviPdfPronto();
    const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
    caixa.innerHTML = '';
    const larg = Math.max(280, caixa.clientWidth || 340);
    for(let p = 1; p <= pdf.numPages; p++){
      const pag = await pdf.getPage(p);
      const v1 = pag.getViewport({ scale: 1 });
      const esc = larg / v1.width, dpr = Math.min(2, window.devicePixelRatio || 1);
      const v = pag.getViewport({ scale: esc * dpr });
      const cv = document.createElement('canvas');
      cv.width = v.width; cv.height = v.height;
      cv.style.width = '100%';
      caixa.appendChild(cv);
      await pag.render({ canvasContext: cv.getContext('2d'), viewport: v }).promise;
    }
  }catch(e){ caixa.innerHTML = `<div class="gm-vazio">Não consegui mostrar o PDF (${lvEsc((e && e.message) || 'erro')}).</div>`; }
}
