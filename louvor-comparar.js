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
  /* "voltar a ser só o PDF do Drive": música que veio do Drive e já teve o texto tirado (pedido do Davi) */
  const sd = document.getElementById('lvBtnSoDrive');
  if(sd) sd.style.display = l && l.origem && l.origem.tipo === 'drive' && l.origem.id && !l.origem.apagadoNoDrive && (l.conteudo || '').trim() ? '' : 'none';
  setTimeout(lvAcoesBarraAtualizar, 0);
  /* logo do Cifra Club: abre a música no Cifra Club JÁ NO TOM da música (medley: uma por música; do Drive: acha pelo nome) */
  const el = document.getElementById('lvLinksCifra'); if(!el) return;
  const alvos = l ? lvCcAlvos(l).slice(0, 4) : [];
  /* medley (pedido do Davi, 15/11): cada música ganha o seu grupinho [Cifra Club + Spotify] com o número, separado por uma
     divisória; os grupos alternam cor original e cinza para não confundir. O Spotify geral some. */
  const medley = alvos.length > 1, spGeral = document.querySelector('#lvAcoesBarra > .lv-spotify-btn');
  if(spGeral) spGeral.style.display = medley ? 'none' : '';
  const num = i=>medley ? `<span class="lv-cc-num">${i + 1}</span>` : '';
  el.innerHTML = alvos.map((x, i)=>(i ? '<span class="lv-acoes-div" aria-hidden="true"></span>' : '') + `<span class="lv-medley-grupo${i % 2 ? ' cinza' : ''}">`
    + `<button type="button" class="lv-icone-btn lv-link-cifra" onclick="lvAbrirCifraClub(${i})" title="Abrir no Cifra Club${medley ? ': ' + lvEsc(x.titulo || '') : ''}${x.tom ? ' (tom ' + lvEsc(x.tom) + ')' : ''}" aria-label="Abrir no Cifra Club ${lvEsc(x.titulo || '')}"><img src="logo-cifraclub.png" alt="" width="20" height="20">${num(i)}</button>`
    + (medley ? `<button type="button" class="lv-icone-btn lv-sp-musica" onclick="lvSpotify(false,${i})" title="Spotify: ${lvEsc(x.titulo || '')}" aria-label="Tocar no Spotify ${lvEsc(x.titulo || '')}">${LV_SP_SVG}${num(i)}</button>` : '')
    + '</span>').join('');
}
const LV_SP_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#1DB954"/><path d="M6.5 9.3c3.7-1.1 7.9-.8 11 1M7.2 12.4c3-.9 6.4-.6 9 .9M7.8 15.3c2.4-.6 4.9-.4 7 .8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
/* pedido do Davi (15/11): o Cifra Club abre direto no tom pelo endereço: ?keyShape=N = N semitons acima do tom do site
   (conferido: Deus Tremendo está em A no site e ?keyShape=3 abre em C) */
function lvCcComTom(url, tomSite, tomApp){
  const raiz = t=>lvPc(String(t || '').trim().replace(/m$/, ''));
  const a = raiz(tomSite), b = raiz(tomApp), u = String(url).replace(/[?#].*$/, '');
  if(a < 0 || b < 0) return u;
  const n = ((b - a) % 12 + 12) % 12;
  return n ? u + '?keyShape=' + n : u;
}
/* o que cada botão do Cifra Club abre: { titulo, artista, tom (o da música no app), url, tomSite, guardar(url, tomSite) } */
function lvCcAlvos(l){
  const ccUrl = u=>/^https:\/\/(www\.|m\.)?cifraclub\.com\.br\//.test(u || '');
  const tomTxt = (t, menor)=>t ? (menor ? lvRelativoMenor(t) + 'm' : t) : '';
  /* medley montado no app: cada música aponta para a música dela */
  if(l.medley && (l.medley.musicas || []).length){
    return l.medley.musicas.map(m=>{
      const s = (state.louvores || []).find(x=>x.id === m.id) || {}, o = s.origem && s.origem.tipo === 'cifraclub' && ccUrl(s.origem.url) ? s.origem : null;
      return { titulo: s.titulo || '', artista: s.artista || '', tom: tomTxt(m.tom, m.menor) || lvTomAtual(s), url: (o && o.url) || s.ccUrl || '', tomSite: (o && o.tomSite) || s.ccTomSite || '',
        guardar: (u, t)=>{ if(o) o.tomSite = t; else { s.ccUrl = u; s.ccTomSite = t; } persist(); },
        sp: s.spotify || '', guardarSp: id=>{ s.spotify = id; persist(); } };
    });
  }
  /* medley do colar do WhatsApp: "[♪ Nome — Tom X]" no texto marca cada música */
  const marcas = [...String(l.conteudo || '').matchAll(/^\[♪\s*(.+?)(?:\s+—\s+Tom\s+(\S+))?\]\s*$/gm)];
  if(marcas.length){
    return marcas.map(mk=>{
      const lk = (l.cifraLinks || []).find(x=>cuNorm(x.titulo) === cuNorm(mk[1]));
      return { titulo: mk[1], artista: '', tom: mk[2] || '', url: lk && ccUrl(lk.url) ? lk.url : '', tomSite: lk ? lk.tomSite || '' : '',
        guardar: (u, t)=>{ if(lk){ lk.url = u; lk.tomSite = t; } else l.cifraLinks = [...(l.cifraLinks || []), { titulo: mk[1], url: u, tomSite: t }]; persist(); },
        sp: ((l.spotifyLinks || []).find(x=>cuNorm(x.titulo) === cuNorm(mk[1])) || {}).id || '',
        guardarSp: id=>{ l.spotifyLinks = [...(l.spotifyLinks || []).filter(x=>cuNorm(x.titulo) !== cuNorm(mk[1])), { titulo: mk[1], id }]; persist(); } };
    });
  }
  const o = l.origem && l.origem.tipo === 'cifraclub' && ccUrl(l.origem.url) ? l.origem : null;
  if(!o && !(l.titulo || '').trim()) return [];
  return [{ titulo: l.titulo || '', artista: l.artista || '', tom: lvTomAtual(l), url: (o && o.url) || l.ccUrl || '', tomSite: (o && o.tomSite) || l.ccTomSite || '',
    guardar: (u, t)=>{ if(o) o.tomSite = t; else { l.ccUrl = u; l.ccTomSite = t; } persist(); } }];
}
/* abre a aba já no toque (o navegador não bloqueia) e manda para o endereço certo quando souber o tom do site */
async function lvAbrirCifraClub(i){
  const l = getLouvorAtual(); if(!l) return;
  const x = lvCcAlvos(l)[i]; if(!x) return;
  const pronto = x.url && x.tomSite;
  const w = pronto ? null : window.open('about:blank', '_blank');
  try{
    let url = x.url, tomSite = x.tomSite;
    if(!url){   // música do Drive (ou sem link): acha no Cifra Club pelo nome
      showToast('Procurando no Cifra Club…');
      const harpa = /harpa/i.test(x.artista) && (/(\d{1,3})/.exec(x.artista) || [])[1];
      const lista = (await ccChamar({ busca: harpa ? 'harpa cristã ' + harpa : (x.titulo + ' ' + (/^medley$/i.test(x.artista) ? '' : x.artista)).trim() })).musicas || [];
      const m = harpa ? lista.find(m=>/harpa-crista/i.test(m.url) && new RegExp('(^|\\D)0*' + harpa + '(\\D|$)').test(m.titulo + ' ' + m.artista + ' ' + m.url))
        : lista.find(m=>cuNorm(m.titulo) === cuNorm(x.titulo) && (!x.artista || cuNorm(m.artista) === cuNorm(x.artista))) || lista.find(m=>cuNorm(m.titulo) === cuNorm(x.titulo)) || lista[0];
      if(!m){ if(w) w.close(); showToast('Não achei essa música no Cifra Club'); return; }
      url = m.url;
    }
    if(!tomSite && x.tom){ const c = await ccChamar({ url }); tomSite = (c && c.tom) || ''; }
    if(url !== x.url || tomSite !== x.tomSite) x.guardar(url, tomSite);
    const final = lvCcComTom(url, tomSite, x.tom);
    if(w) w.location.href = final; else window.open(final, '_blank', 'noopener');
  }catch(e){ if(w) w.close(); showToast('Cifra Club: ' + ((e && e.message) || e)); }
}

/* a pílula de ações da música some quando nenhum botão dela está à mostra */
function lvAcoesBarraAtualizar(){
  const barra = document.getElementById('lvAcoesBarra'); if(!barra) return;
  const algum = [...barra.children].some(el=>el.style.display !== 'none' && (el.tagName !== 'SPAN' || el.children.length));
  barra.hidden = !algum;
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
  /* linhas de acorde dá para editar aqui mesmo, olhando o original ao lado (a letra e as partes não) */
  const linhas = (l.conteudo || '').split('\n').map((x, i)=>{
    const t = x.trim();
    const tipo = lvTipoLinha(t), cls = tipo === 'parte' ? 'rot' : tipo === 'acorde' ? 'ac' : olhar.has(t) ? 'olhar' : tipo === 'marca' ? 'marca' : '';
    if(cls === 'ac') return `<div class="lvcmp-l ac lvcmp-edita" contenteditable="plaintext-only" spellcheck="false" autocapitalize="off" data-i="${i}" oninput="lvcmpAcordeMudou(this)" onblur="lvcmpAcordeSalvar()">${lvEsc(x)}</div>`;
    return `<div class="lvcmp-l ${cls}">${lvEsc(x) || '&nbsp;'}</div>`;
  }).join('');
  const n = olhar.size;
  const soDrive = l.origem && l.origem.tipo === 'drive' && l.origem.id && !l.origem.apagadoNoDrive
    ? `<button type="button" class="lvi-rel-ok lvcmp-so-drive" onclick="lvFicarSoComDrive()" title="Apaga o texto do app e a música fica só com o PDF do Drive">Ficar só com o PDF do Drive</button>` : '';
  el.innerHTML = `<div class="lvcmp-tit"><b>No app</b>${n ? `<small>${n} linha${n > 1 ? 's' : ''} em amarelo para conferir</small><button type="button" class="lvi-rel-ok" onclick="lvJaConferi();lvCompararRenderApp(getLouvorAtual())">Já conferi</button>` : '<small>tudo conferido</small>'}${soDrive}</div>
    <div class="lvcmp-dica">Toque numa linha de acordes (dourada) para acertar a posição; a letra não muda.</div>
    <div class="lvcmp-texto">${linhas}</div>`;
}
/* acorde editado no Comparar: troca só aquela linha do texto (pelo número da linha) e grava logo depois de parar de digitar */
let lvcmpSalvarT = 0;
function lvcmpAcordeMudou(el){
  const l = getLouvorAtual(); if(!l) return;
  const linhas = (l.conteudo || '').split('\n'), i = Number(el.dataset.i);
  if(!(i >= 0 && i < linhas.length)) return;
  linhas[i] = el.textContent.replace(/ /g, ' ').replace(/[\r\n]+/g, '');
  const antes = l.conteudo;
  l.conteudo = linhas.join('\n');
  lvRevisarConferido(l, antes, l.conteudo);
  delete l.conteudoAntesOrganizar; delete l.conteudoOrganizado;   // mexeu à mão: o desfazer do Organizar não vale mais
  clearTimeout(lvcmpSalvarT); lvcmpSalvarT = setTimeout(lvcmpAcordeSalvar, 700);
}
function lvcmpAcordeSalvar(){
  clearTimeout(lvcmpSalvarT);
  const l = getLouvorAtual(); if(!l) return;
  persist();
  const ta = document.getElementById('lvConteudo');
  if(ta && ta.value !== l.conteudo){ ta.value = l.conteudo; lvAtualizarEditor(); if(typeof renderLouvorPdfPreview === 'function') renderLouvorPdfPreview(); }
}
/* desiste do texto que o app tirou e fica só com o PDF do Drive (como quando a música veio só com o arquivo); dá para desfazer */
async function lvFicarSoComDrive(){
  const l = getLouvorAtual(); if(!l || !l.origem || l.origem.tipo !== 'drive') return;
  if(!(await iosConfirm('Ficar só com o PDF do Drive? O texto que o app montou sai (dá para desfazer logo depois).'))) return;
  const id = l.id;
  comDesfazer('A música ficou só com o PDF do Drive', ()=>{
    const x = state.louvores.find(m=>m.id === id); if(!x) return;
    x.conteudo = ''; x.origem.soArquivo = true;
    delete x.revisar; delete x.conteudoAntesOrganizar; delete x.conteudoOrganizado;
    persist();
  }, ()=>{ if(louvorAtualId === id){ abrirLouvorDetalhe(id); } });
  lvCompararFechar();   // volta para a tela da música, que agora mostra o PDF
  abrirLouvorDetalhe(id);
}
/* música só com o PDF do Drive → lê o PDF e monta no padrão do app (como importar); daí em diante abre primeiro o app.
   tomNovo {nota, modoMenor}: veio da troca de tom (o PDF não tem texto para transpor) → lê o PDF como está e muda só a nota.
   Música marcada como Pronto: importa fiel (o arquivo já está certo) e nada fica para conferir. */
async function lvConverterDoDrive(tomNovo){
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
  const pronta = l.status === 'finalizada';
  if(tomNovo) showToast('Lendo o PDF para mudar a nota…');
  await lvImportarNoAtual({ target:{ files:[file], value:'' }, semConfirmar: true, origem, fiel: pronta || !!tomNovo });
  const lv = getLouvorAtual(); if(lv && lv.origem) delete lv.origem.soArquivo;
  if(lv && tomNovo && (lv.conteudo || '').trim()){
    lvAplicarTom(lv, tomNovo.nota, tomNovo.modoMenor, true);
    if(pronta) delete lv.revisar;
    persist();
    atualizarLvTomBox(); renderLouvorPdfPreview();
    lvEscreverNoEditor();
    showToast('Só a nota mudou: agora em ' + (tomNovo.modoMenor ? lvRelativoMenor(tomNovo.nota) + 'm' : tomNovo.nota));
    if(typeof driveTomMudou === 'function') driveTomMudou(lv);
  }
  persist();
}
/* o original */
async function lvCompararRenderOriginal(l){
  const el = document.getElementById('lvcmpOriginal');
  const o = l.origem;
  const olhar = new Set((l.revisar || []).map(lvcmpNorm));
  if(o.tipo === 'cifraclub'){
    const cifra = (o.texto || '').split('\n').map(x=>`<div class="lvcmp-l${({ acorde: ' ac', parte: ' rot' })[lvTipoLinha(x)] || ''}">${lvEsc(x) || '&nbsp;'}</div>`).join('');
    const marcado = v=>{ const n = lvcmpNorm(v); return [...olhar].some(o=>o && n.includes(o)); };   // no Letras o verso pode vir junto com outro
    const letras = o.letras ? o.letras.estrofes.map(est=>`<div class="lvcmp-estrofe">${est.map(v=>`<div class="lvcmp-l${marcado(v) ? ' olhar' : ''}">${lvEsc(v)}</div>`).join('')}</div>`).join('') : '';
    /* Cifra Club primeiro e o Letras embaixo (pedido do Davi) */
    el.innerHTML = `<div class="lvcmp-tit"><b>Cifra Club</b><a href="${lvEsc(o.url)}" target="_blank" rel="noopener">abrir no site</a></div><div class="lvcmp-texto">${cifra}</div>
      ${o.letras ? `<div class="lvcmp-tit"><b>Letras</b><a href="${lvEsc(o.letras.url)}" target="_blank" rel="noopener">abrir no site</a></div><div class="lvcmp-texto lvcmp-letras">${letras}</div>` : ''}`;
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
  if(o.tipo === 'drive' && o.id && o.apagadoNoDrive){ caixa.innerHTML = '<div class="gm-vazio">O PDF antigo foi apagado do Drive quando a música, já como Pronto, foi enviada: agora vale a versão do app.</div>'; return; }
  if(o.tipo === 'drive' && o.id){
    if(typeof driveToken !== 'undefined' && driveToken && Date.now() < driveTokenVence){ await lvcmpVerDoDrive(); return; }
    caixa.innerHTML = `<button type="button" class="btn btn-outline lvcmp-ver-drive" onclick="lvcmpVerDoDrive()">${typeof LOGO_DRIVE !== 'undefined' ? LOGO_DRIVE : ''}Ver o PDF do Drive</button>`;
    return;
  }
  caixa.innerHTML = '<div class="gm-vazio">O arquivo original não está neste aparelho.</div>';
}
/* lê o PDF do Drive (pede o acesso se precisar, ainda dentro do toque) e mostra; não guarda no aparelho */
async function lvcmpVerDoDrive(idCaixa){   // idCaixa: onde desenhar (padrão: o Comparar; 'lvSoPdfCaixa' = tela da música)
  const l = getLouvorAtual(), caixa = document.getElementById(idCaixa || 'lvcmpPdf');
  if(!l || !l.origem || !l.origem.id || !caixa) return;
  const acesso = typeof driveTokenCliente !== 'undefined' && driveTokenCliente ? drivePedirToken() : Promise.reject(new Error(typeof driveClienteId === 'function' && driveClienteId() ? 'o Drive ainda está carregando: toque de novo' : 'o Drive não está ligado (Ajustes → Recursos)'));
  caixa.innerHTML = '<div class="voz-carregando">Abrindo o PDF do Drive…</div>';
  try{
    await acesso;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(l.origem.id)}?alt=media`, { headers:{ Authorization:'Bearer ' + driveToken } });
    if(!res.ok) throw new Error('Drive ' + res.status);
    await lvcmpDesenhar(caixa, await res.blob());
  }catch(e){
    caixa.innerHTML = `<div class="gm-vazio">Não consegui abrir o PDF do Drive (${lvEsc((e && e.message) || 'erro')}).</div><button type="button" class="btn btn-outline lvcmp-ver-drive" onclick="lvcmpVerDoDrive('${idCaixa || 'lvcmpPdf'}')">Tentar de novo</button>`;
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
    const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false }).promise;
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
/* música só com o PDF do Drive (veio assim, ou voltou a ser do Drive): a tela da música abre normal (campo harmônico, tom, status)
   e mostra o PDF no lugar do texto; o ⇄ passa para o padrão do app (pedido do Davi) */
async function lvSoPdfRender(l){
  const pag = document.getElementById('pageLouvorDetalhe'), box = document.getElementById('lvSoPdf');
  const so = !!(l && typeof driveSoArquivo === 'function' && driveSoArquivo(l));
  if(pag) pag.classList.toggle('so-pdf', so);
  if(!box) return;
  if(!so){ box.innerHTML = ''; return; }
  const o = l.origem, id = l.id;
  box.innerHTML = `<div class="lvcmp-tit lv-so-pdf-tit"><b>${lvEsc(o.nome || 'PDF do Drive')}</b>${o.link ? `<a href="${lvEsc(o.link)}" target="_blank" rel="noopener">abrir no Drive</a>` : ''}<button type="button" class="ico-btn lvcmp-converter-btn" onclick="lvConverterDoDrive()" title="Passar para o padrão do app" aria-label="Passar para o padrão do app"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg></button></div>
    <div id="lvSoPdfCaixa" class="lvcmp-pdf"><div class="voz-carregando">Abrindo o PDF…</div></div>`;
  if(typeof drivePreparar === 'function') drivePreparar();
  const caixa = document.getElementById('lvSoPdfCaixa');
  const g = await lvOriginalLer(id);
  if(louvorAtualId !== id) return;
  if(g && g.blob){ await lvcmpDesenhar(caixa, g.blob); return; }
  if(o.apagadoNoDrive){ caixa.innerHTML = '<div class="gm-vazio">Este PDF foi apagado do Drive.</div>'; return; }
  if(typeof driveToken !== 'undefined' && driveToken && Date.now() < driveTokenVence){ await lvcmpVerDoDrive('lvSoPdfCaixa'); return; }
  caixa.innerHTML = `<button type="button" class="btn btn-outline lvcmp-ver-drive" onclick="lvcmpVerDoDrive('lvSoPdfCaixa')">${typeof LOGO_DRIVE !== 'undefined' ? LOGO_DRIVE : ''}Ver o PDF do Drive</button>`;
}

/* ---------- alinhar os dois lados (v14.5, computador): tocar numa frase de um lado rola o outro até a mesma frase ficar ao lado ----------
   Cada coluna rola sozinha; linhas de acorde não contam (a do app é editável). Frase repetida (refrão): vale a mesma vez (1ª, 2ª…) */
function lvcmpPalavras(el){
  const t = el.textContent.trim();
  const tipo = lvTipoLinha(t);
  if(tipo !== 'parte' && tipo !== 'letra') return null;
  const rot = lvRotuloDaLinha(t);
  return { rot: !!rot, p: lvcmpNorm(rot ? lvVezesDoRotulo(rot).nome : t).split(' ').filter(Boolean) };
}
function lvcmpParecido(a, b){
  if(!a || !b || a.rot !== b.rot || !a.p.length || !b.p.length) return 0;
  const sb = new Set(b.p);
  const comum = a.p.filter(w=>sb.has(w)).length;
  return comum / Math.max(a.p.length, b.p.length);
}
function lvcmpAlinhar(ev){
  if(!matchMedia('(min-width:1024px)').matches) return;
  const linha = ev.target.closest('.lvcmp-l');
  if(!linha || linha.classList.contains('lvcmp-edita') || linha.isContentEditable) return;
  const colA = linha.closest('.lvcmp-col'); if(!colA) return;
  const colB = colA.classList.contains('lvcmp-app') ? document.querySelector('#lvcmpGrade .lvcmp-orig') : document.querySelector('#lvcmpGrade .lvcmp-app');
  const alvo = lvcmpPalavras(linha); if(!alvo || !colB) return;
  /* qual vez é essa frase deste lado (refrão que aparece 3x → a 2ª vez procura a 2ª vez do outro lado) */
  const iguaisA = [...colA.querySelectorAll('.lvcmp-l')].filter(x=>lvcmpParecido(lvcmpPalavras(x), alvo) >= .8);
  const vez = Math.max(0, iguaisA.indexOf(linha));
  /* o lado original procura SEMPRE na cifra (Cifra Club); o Letras só se a frase não estiver na cifra.
     Na cifra a parte pode ter outro nome que no app: se não achar com o mesmo nome, compara só as palavras */
  const linhasB = [...colB.querySelectorAll('.lvcmp-l')];
  const daCifra = linhasB.filter(x=>!x.closest('.lvcmp-letras'));
  const pontuar = (lista, semRot)=>lista.map(x=>{ const p = lvcmpPalavras(x); return { x, s: lvcmpParecido(semRot && p ? { ...p, rot: alvo.rot } : p, alvo) }; }).filter(c=>c.s >= .5);
  let cands = pontuar(daCifra);
  if(!cands.length) cands = pontuar(daCifra, true);
  if(!cands.length) cands = pontuar(linhasB.filter(x=>x.closest('.lvcmp-letras')));
  if(!cands.length){ showToast('Não achei essa frase do outro lado'); return; }
  const melhor = Math.max(...cands.map(c=>c.s));
  const bons = cands.filter(c=>c.s >= melhor - .05);
  const achado = (bons[Math.min(vez, bons.length - 1)] || bons[0]).x;
  /* rola o outro lado até a frase achada ficar na mesma altura da que foi tocada */
  const dy = achado.getBoundingClientRect().top - linha.getBoundingClientRect().top;
  lvcmpRolar(colB, colB.scrollTop + dy);
  [linha, achado].forEach(x=>{ x.classList.remove('ef-achou'); void x.offsetWidth; x.classList.add('ef-achou'); });
}
/* rolagem suave própria (0,6 s, desacelerando); se o navegador pausar a animação, chega no lugar certo do mesmo jeito */
function lvcmpRolar(col, destino){
  destino = Math.max(0, Math.min(destino, col.scrollHeight - col.clientHeight));
  const ini = col.scrollTop, dist = destino - ini, t0 = performance.now(), dur = 600;
  const id = (col.lvcmpRolaId || 0) + 1; col.lvcmpRolaId = id;
  if(!dist) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){ col.scrollTop = destino; return; }
  const passo = agora=>{
    if(col.lvcmpRolaId !== id) return;
    const k = Math.min(1, (agora - t0) / dur);
    col.scrollTop = ini + dist * (1 - Math.pow(1 - k, 3));
    if(k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
  setTimeout(()=>{ if(col.lvcmpRolaId === id) col.scrollTop = destino; }, dur + 150);
}
document.addEventListener('click', ev=>{ if(ev.target.closest && ev.target.closest('#lvcmpGrade')) lvcmpAlinhar(ev); });


/* ---------- Spotify (v16.1): botão na música e no Comparar ----------
   Toque: o app acha a faixa pelo nome e cantor (função "cifra" do Supabase, com SPOTIFY_ID/SPOTIFY_SECRET) e abre o
   tocador do Spotify DENTRO do app (tocar, pausar, ir para qualquer tempo; o login do Spotify é feito no próprio tocador).
   A faixa fica em l.spotify. O tocador pode ser minimizado (bolinha verde) e continua tocando; "trocar" mostra outras faixas.
   Sem a função configurada: lê um link copiado do Spotify ou abre a busca no app do Spotify instalado. */
function lvSpotifyId(txt){ const m = String(txt || '').match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/) || String(txt || '').match(/spotify:track:([A-Za-z0-9]{22})/); return m ? m[1] : ''; }
let lvSpotifyFaixas = [], lvSpotifyAlvo = null;   // null = a música; número = a música N do medley
/* o que o Spotify toca: a música inteira, ou (medley) a música N, cada uma com a faixa guardada no lugar dela */
function lvSpotifyQual(l, i){
  if(i == null) return { id: l.spotify || '', q: [l.titulo, l.artista].filter(Boolean).join(' '), guardar: id=>{ l.spotify = id; persist(); } };
  const x = lvCcAlvos(l)[i] || {};
  return { id: x.sp || '', q: [x.titulo, /^medley$/i.test(x.artista || '') ? '' : x.artista].filter(Boolean).join(' '), guardar: x.guardarSp || (()=>{}) };
}
async function lvSpotify(trocar, i){
  const l = getLouvorAtual(); if(!l) return;
  lvSpotifyAlvo = i == null ? null : i;
  const a = lvSpotifyQual(l, lvSpotifyAlvo);
  if(a.id && !trocar){ lvSpotifyTocador(a.id); return; }
  try{
    const r = await ccChamar({ spotify: a.q });
    lvSpotifyFaixas = (r && r.faixas) || [];
    if(!lvSpotifyFaixas.length){ showToast('Não achei essa música no Spotify'); return; }
    if(trocar){ lvSpotifyEscolher(a); return; }
    a.guardar(lvSpotifyFaixas[0].id); lvSpotifyTocador(lvSpotifyFaixas[0].id); return;
  }catch(e){ var erro = (e && e.message) || 'erro'; }
  /* plano B: link do Spotify copiado (o app do Spotify não é aberto: o Davi quer tocar dentro do Siloé) */
  let texto = ''; try{ texto = await navigator.clipboard.readText(); }catch(e){}
  const id = lvSpotifyId(texto);
  if(id && id !== a.id){ a.guardar(id); lvSpotifyTocador(id); return; }
  showToast('Spotify: ' + erro);
}
function lvSpotifyCaixa(){
  let box = document.getElementById('lvSpotifyBox');
  if(!box){ box = document.createElement('div'); box.id = 'lvSpotifyBox'; box.className = 'lv-spotify-box'; document.body.appendChild(box); }
  return box;
}
function lvSpotifyTocador(id){
  let box = document.getElementById('lvSpotifyBox');
  if(box && box.dataset.id === id){ box.classList.toggle('mini'); return; }   // tocar de novo minimiza/abre
  box = lvSpotifyCaixa(); box.classList.remove('mini');
  box.dataset.id = id; box.dataset.musica = louvorAtualId || '';
  box.innerHTML = `<button type="button" class="lv-spotify-bolha" aria-label="Abrir o Spotify" title="Abrir o Spotify" onclick="document.getElementById('lvSpotifyBox').classList.remove('mini')">${LV_SP_SVG}</button>
    <div class="lv-spotify-acoes"><button type="button" onclick="lvSpotify(true,lvSpotifyAlvo)">outras versões</button><button type="button" aria-label="Minimizar" title="Minimizar" onclick="document.getElementById('lvSpotifyBox').classList.add('mini')">–</button><button type="button" aria-label="Fechar o Spotify" title="Fechar" onclick="document.getElementById('lvSpotifyBox').remove()">×</button></div>
    <div class="lv-spotify-lista"></div>
    <iframe src="https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=generator&theme=0" width="100%" height="152" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="Spotify"></iframe>`;
}
function lvSpotifyEscolher(a){
  if(!document.getElementById('lvSpotifyBox')){ if(!a.id) a.guardar(lvSpotifyFaixas[0].id); lvSpotifyTocador(a.id || lvSpotifyFaixas[0].id); }
  const box = document.getElementById('lvSpotifyBox'); box.classList.remove('mini');
  box.querySelector('.lv-spotify-lista').innerHTML = lvSpotifyFaixas.map((f, i)=>`<button type="button" onclick="lvSpotifyUsar(${i})">${f.capa ? `<img src="${lvEsc(f.capa)}" alt="" width="32" height="32">` : ''}<span><b>${lvEsc(f.nome)}</b><small>${lvEsc(f.artista)}${f.album && f.album !== f.nome ? ' · ' + lvEsc(f.album) : ''}${f.ano ? ' · ' + f.ano : ''}</small></span></button>`).join('');
}
function lvSpotifyUsar(i){
  const l = getLouvorAtual(), f = lvSpotifyFaixas[i]; if(!l || !f) return;
  lvSpotifyQual(l, lvSpotifyAlvo).guardar(f.id);
  document.getElementById('lvSpotifyBox').remove(); lvSpotifyTocador(f.id);
}
/* trocou de música ou saiu do Louvor: o tocador de outra música fecha */
document.addEventListener('click', ()=>setTimeout(()=>{
  const box = document.getElementById('lvSpotifyBox'); if(!box) return;
  const l = typeof getLouvorAtual === 'function' ? getLouvorAtual() : null;
  const noLouvor = document.querySelector('#aba-louvor.active, #pageLvComparar.active');
  if(!l || !noLouvor || (box.dataset.musica && box.dataset.musica !== l.id)) box.remove();
}, 50), true);
