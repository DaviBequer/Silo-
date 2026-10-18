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
  el.innerHTML = `<div class="lvcmp-tit"><b>${lvEsc(o.nome || 'Arquivo')}</b>${link}</div><div id="lvcmpPdf" class="lvcmp-pdf"><div class="voz-carregando">Abrindo o original…</div></div>`;
  let guardado = await lvOriginalLer(l.id), blob = guardado && guardado.blob;
  if(!blob && o.tipo === 'drive' && o.id && typeof driveToken !== 'undefined' && driveToken){
    try{
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${o.id}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } });
      if(res.ok){ blob = await res.blob(); lvOriginalGuardar(l.id, new File([blob], o.nome || 'original.pdf', { type: blob.type || 'application/pdf' })); }
    }catch(e){}
  }
  const caixa = document.getElementById('lvcmpPdf');
  if(!blob){
    caixa.innerHTML = `<div class="gm-vazio">O arquivo original não está neste aparelho.${o.tipo === 'drive' ? ' Toque em "abrir no Drive" ou importe de novo pelo Drive.' : ''}</div>`;
    return;
  }
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
