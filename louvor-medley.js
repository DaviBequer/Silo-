/* ================= LOUVOR: MEDLEY + IMPORTAÇÃO COM PASSOS =================
   Medley = um louvor comum com "medley": { musicas:[{ id, tom, menor }], seq:[{ id, parte }] }.
   O texto (conteudo) é montado a partir das músicas originais: corrigiu a original, o medley acompanha
   (a não ser que o texto do medley tenha sido mexido à mão: medleyEditado). */

/* ---------- partes de uma música ([Refrão], [Primeira Parte]...) ---------- */
function lmPartes(src){
  const partes = []; let atual = null;
  (src && src.conteudo || '').split('\n').forEach(raw=>{
    const t = raw.trim();
    const m = t.match(/^\[(.+)\]$/);
    if(m){ atual = { nome: m[1].trim(), linhas: [] }; partes.push(atual); return; }
    if(/^-{1,3}$/.test(t)) return;   // marcadores de slide/linha/coluna: o medley põe os dele
    if(!atual){ if(!t) return; atual = { nome: 'Início', linhas: [] }; partes.push(atual); }
    atual.linhas.push(raw.replace(/\s+$/,''));
  });
  partes.forEach(p=>{
    while(p.linhas.length && !p.linhas[0].trim()) p.linhas.shift();
    while(p.linhas.length && !p.linhas[p.linhas.length-1].trim()) p.linhas.pop();
  });
  const vistos = new Set();
  const out = partes.filter(p=>{   // "[Repete - ...]" não tem letra: fica de fora; nome repetido: vale o primeiro
    if(!p.linhas.length) return false;
    const k = p.nome.toLowerCase();
    if(vistos.has(k)) return false;
    vistos.add(k); return true;
  });
  if(out.length === 1 && partes.length === 1 && out[0].nome === 'Início') out[0].nome = 'Música inteira';
  return out;
}
function lmTomTexto(cfg){ return cfg && cfg.tom ? (cfg.menor ? lvRelativoMenor(cfg.tom) + 'm' : cfg.tom) : ''; }
function lmLouvor(id){ return state.louvores.find(l=>l.id===id); }

/* ---------- monta o texto do medley ----------
   Cada música começa com [♪ Nome — Tom G]. A mesma parte seguida vira "Refrão 2x";
   a parte que volta mais tarde na mesma música vira [Repete - Refrão] (nos slides a letra aparece de novo). */
function lmGerarTexto(md){
  const linhas = [];
  const seq = (md.seq || []).filter(s=>lmLouvor(s.id));
  let i = 0, musicaAtual = null, ditas = null;
  while(i < seq.length){
    const s = seq[i];
    let n = 1;
    while(i+n < seq.length && seq[i+n].id === s.id && seq[i+n].parte === s.parte) n++;
    i += n;
    const src = lmLouvor(s.id);
    const parte = lmPartes(src).find(p=>p.nome === s.parte);
    if(!parte) continue;   // a parte saiu da música original
    const cfg = (md.musicas || []).find(m=>m.id === s.id) || {};
    if(s.id !== musicaAtual){
      if(linhas.length) linhas.push('--');
      const tomTxt = lmTomTexto(cfg);
      linhas.push(`[♪ ${(src.titulo||'Sem título').replace(/[\[\]]/g,'')}${tomTxt ? ' — Tom ' + tomTxt : ''}]`);
      musicaAtual = s.id; ditas = new Set();
    } else linhas.push('--');
    const vezes = n > 1 ? ' ' + n + 'x' : '';
    if(ditas.has(parte.nome)){ linhas.push(`[Repete - ${parte.nome}${vezes}]`); continue; }
    ditas.add(parte.nome);
    linhas.push(`[${parte.nome}${vezes}]`);
    let texto = parte.linhas.join('\n');
    const pcDe = lvPc(src.tomOriginal), pcPara = lvPc(cfg.tom);
    if(pcDe !== -1 && pcPara !== -1){
      const delta = ((pcPara - pcDe) % 12 + 12) % 12;
      texto = lvTransposeConteudoTexto(texto, delta, cfg.tom, src.tomOriginal);
    }
    linhas.push(...texto.split('\n'));
  }
  return linhas.join('\n');
}

/* ---------- abrir a música: medley se atualiza com as originais; marcas amarelas da importação ---------- */
function lvAoAbrirDetalhe(l){
  const ehMedley = !!l.medley;
  const btnM = document.getElementById('lvBtnMedley');
  if(btnM) btnM.style.display = ehMedley ? '' : 'none';
  document.querySelectorAll('.lv-so-musica').forEach(el=>{ el.style.display = ehMedley ? 'none' : ''; });
  if(ehMedley && !l.medleyEditado){
    const novo = lmGerarTexto(l.medley);
    if(novo !== l.conteudo){ l.conteudo = novo; persist(); }
  }
  lvMostrarRevisar(l);
}
/* linhas que a conferência não confirmou ficam amarelas no editor até tocar em "Já conferi" */
function lvMostrarRevisar(l){
  const el = document.getElementById('lvEdicaoImportStatus'); if(!el) return;
  if(Array.isArray(l.revisar) && l.revisar.length){
    const textos = new Set((l.conteudo||'').split('\n').map(x=>x.trim()));
    l.revisar = l.revisar.filter(t=>textos.has(t));   // linha corrigida (texto mudou): sai da lista
    if(!l.revisar.length) delete l.revisar;
  }
  el.classList.remove('erro');
  if(!l.revisar){ el.innerHTML = ''; return; }
  const n = l.revisar.length;
  el.innerHTML = `<div class="lvi-revisar"><span>⚠ ${n} linha${n>1?'s':''} em amarelo para conferir os acordes</span><button type="button" onclick="lvJaConferi()">Já conferi</button></div>`;
}
function lvJaConferi(){
  const l = getLouvorAtual(); if(!l) return;
  delete l.revisar;
  persist();
  lvMostrarRevisar(l);
  lvAtualizarEditor();
}
function lvLinhasRevisar(){
  const l = typeof getLouvorAtual==='function' ? getLouvorAtual() : null;
  return new Set(l && Array.isArray(l.revisar) ? l.revisar : []);
}

/* ---------- tela de montar o medley ---------- */
let lmEdit = null;
function abrirMedley(id){
  const l = id ? lmLouvor(id) : null;
  lmEdit = l && l.medley
    ? { id: l.id, nome: l.titulo || '', musicas: l.medley.musicas.map(m=>({ ...m })), seq: l.medley.seq.map(s=>({ ...s })), mexeu: false }
    : { id: null, nome: '', musicas: [], seq: [], mexeu: false };
  document.getElementById('lmNome').value = lmEdit.nome;
  document.getElementById('lmTitulo').textContent = lmEdit.id ? 'Editar medley' : 'Novo medley';
  lmRender();
  document.getElementById('pageLouvorMedley').classList.add('active');
  document.getElementById('lmConteudo').scrollTop = 0;
}
async function fecharMedley(){
  if(lmEdit && lmEdit.mexeu && !(await iosConfirm('Sair sem salvar o medley?'))) return;
  document.getElementById('pageLouvorMedley').classList.remove('active');
  lmEdit = null;
}
function lmCor(id){ const i = lmEdit.musicas.findIndex(m=>m.id===id); return 'lm-cor' + ((i < 0 ? 0 : i) % 5); }
function lmRender(){
  if(!lmEdit) return;
  const nums = {};
  lmEdit.seq.forEach((s, i)=>{ const k = s.id + '|' + s.parte; (nums[k] = nums[k] || []).push(i+1); });
  const icoX = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>';
  document.getElementById('lmMusicas').innerHTML = lmEdit.musicas.map((m, mi)=>{
    const src = lmLouvor(m.id);
    if(!src) return '';
    const partes = lmPartes(src);
    const semPartes = partes.length === 1 && partes[0].nome === 'Música inteira';
    return `<div class="lm-musica ${lmCor(m.id)}">
      <div class="lm-musica-topo">
        <span class="lm-musica-num">${mi+1}</span>
        <div class="lm-musica-nome"><b>${lvEsc(src.titulo||'Sem título')}</b><small>${lvEsc(src.artista||'')}</small></div>
        <button type="button" class="lm-tom" onclick="lmAbrirTom(${mi})" ${src.tomOriginal?'':'disabled'} title="Tom desta música no medley"><span>TOM</span><b>${lmTomTexto(m) || '—'}</b></button>
        <button type="button" class="lm-x" onclick="lmTirarMusica(${mi})" aria-label="Tirar a música">${icoX}</button>
      </div>
      <div class="lm-partes">${partes.map((p, pi)=>{
        const usados = nums[m.id + '|' + p.nome] || [];
        return `<button type="button" class="lm-parte${usados.length?' usada':''}" onclick="lmAddParte(${mi},${pi})">${lvEsc(p.nome)}${usados.map(n=>`<i>${n}</i>`).join('')}</button>`;
      }).join('')}</div>
      ${!partes.length ? '<div class="lm-dica">Essa música ainda está sem letra.</div>'
        : semPartes ? `<div class="lm-dica">Sem partes separadas. <a onclick="lmOrganizarOriginal('${m.id}')">Abrir e organizar</a> para escolher Refrão, Estrofes…</div>` : ''}
    </div>`;
  }).join('') || '<div class="lm-vazio">Comece adicionando as músicas do medley.</div>';

  document.getElementById('lmSeq').innerHTML = lmEdit.seq.length ? lmEdit.seq.map((s, i)=>{
    const src = lmLouvor(s.id);
    return `<div class="lm-seq-item ${lmCor(s.id)}" data-i="${i}">
      <span class="lm-num">${i+1}</span>
      <span class="lm-seq-txt"><b>${lvEsc(s.parte)}</b><small>${lvEsc(src ? src.titulo || 'Sem título' : 'música apagada')}</small></span>
      <button type="button" class="lm-mini" onclick="lmMover(${i},-1)" ${i===0?'disabled':''} aria-label="Subir"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
      <button type="button" class="lm-mini" onclick="lmMover(${i},1)" ${i===lmEdit.seq.length-1?'disabled':''} aria-label="Descer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
      <button type="button" class="lm-mini" onclick="lmTirarSeq(${i})" aria-label="Tirar">${icoX}</button>
    </div>`;
  }).join('') : '<div class="lm-vazio">Toque nas partes acima na ordem em que vão cantar. Pode repetir a mesma parte.</div>';
  document.getElementById('lmSeqConta').textContent = lmEdit.seq.length ? lmEdit.seq.length + (lmEdit.seq.length === 1 ? ' parte' : ' partes') : '';

  const texto = lmGerarTexto(lmEdit);
  document.getElementById('lmPrevia').innerHTML = texto ? texto.split('\n').map(linha=>{
    const t = linha.trim(), esc = lvEsc(linha) || ' ';
    if(/^\[♪/.test(t)) return `<span class="lm-pv-musica">${lvEsc(t.slice(1,-1).replace(/^♪\s*/,''))}</span>`;
    if(/^\[.+\]$/.test(t)) return `<span class="rl-bloco">${esc}</span>`;
    if(t === '--') return '<span class="lm-pv-linha"></span>';
    if(t && isChordLine(t)) return `<span class="rl-acorde">${esc}</span>`;
    return esc;
  }).join('\n') : '<span class="lm-pv-vazio">A prévia aparece aqui enquanto você monta.</span>';
  document.getElementById('lmSalvarBtn').textContent = lmEdit.id ? 'Salvar medley' : 'Criar medley';
}
function lmAddParte(mi, pi){
  const m = lmEdit.musicas[mi]; const p = lmPartes(lmLouvor(m.id))[pi]; if(!p) return;
  lmEdit.seq.push({ id: m.id, parte: p.nome });
  lmEdit.mexeu = true;
  if(navigator.vibrate) try{ navigator.vibrate(8); }catch(_){}
  lmRender();
  const novo = document.querySelector('#lmSeq .lm-seq-item:last-child');
  if(novo) novo.classList.add('lm-chegou');
}
function lmMover(i, d){
  const j = i + d; if(j < 0 || j >= lmEdit.seq.length) return;
  [lmEdit.seq[i], lmEdit.seq[j]] = [lmEdit.seq[j], lmEdit.seq[i]];
  lmEdit.mexeu = true; lmRender();
}
function lmTirarSeq(i){ lmEdit.seq.splice(i, 1); lmEdit.mexeu = true; lmRender(); }
async function lmTirarMusica(mi){
  const m = lmEdit.musicas[mi];
  const usadas = lmEdit.seq.filter(s=>s.id===m.id).length;
  if(usadas && !(await iosConfirm(`Tirar a música do medley? As ${usadas} parte${usadas>1?'s':''} dela na sequência também saem.`))) return;
  lmEdit.musicas.splice(mi, 1);
  lmEdit.seq = lmEdit.seq.filter(s=>s.id!==m.id);
  lmEdit.mexeu = true; lmRender();
}
async function lmOrganizarOriginal(id){
  if(lmEdit.mexeu && !(await iosConfirm('Abrir a música para organizar? O medley que você está montando não é salvo.'))) return;
  document.getElementById('pageLouvorMedley').classList.remove('active');
  lmEdit = null;
  closeLouvorForm();
  abrirLouvorDetalhe(id);
}

/* tom de cada música no medley: usa o mesmo seletor do Louvor (modo "medley") */
let lmTomIdx = -1;
function lmAbrirTom(mi){ lmTomIdx = mi; abrirLvTomPicker('medley'); }
function lmTomDoPicker(){ const m = lmEdit && lmEdit.musicas[lmTomIdx]; return { tom: m ? m.tom : '', menor: !!(m && m.menor) }; }
function lmTomEscolhido(nota, menor){
  const m = lmEdit && lmEdit.musicas[lmTomIdx]; if(!m) return;
  m.tom = nota; m.menor = menor; lmEdit.mexeu = true;
  closeModal('modalLvTom');
  lmRender();
}

/* escolher música para o medley */
function lmAbrirEscolher(){
  document.getElementById('lmBusca').value = '';
  lmRenderEscolher('');
  document.getElementById('modalLmEscolher').classList.add('active');
}
function lmRenderEscolher(termo){
  termo = String(termo||'').trim().toLowerCase();
  const ja = new Set(lmEdit.musicas.map(m=>m.id));
  const lista = state.louvores
    .filter(l=>!l.medley && !ja.has(l.id) && (l.conteudo||'').trim())
    .filter(l=>!termo || (l.titulo||'').toLowerCase().includes(termo) || (l.artista||'').toLowerCase().includes(termo))
    .sort((a,b)=>(a.titulo||'').localeCompare(b.titulo||''));
  document.getElementById('lmEscolherLista').innerHTML = lista.map(l=>{
    ensureLouvorConfig(l);
    const tom = lvTomAtual(l);
    return `<button type="button" class="lm-esc-item" onclick="lmEscolher('${l.id}')"><span><b>${lvEsc(l.titulo||'Sem título')}</b><small>${lvEsc(l.artista||'')}${l.artista?' · ':''}${lmPartes(l).length} partes</small></span>${tom?`<em>${tom}</em>`:''}</button>`;
  }).join('') || '<div class="lm-vazio">Nenhuma música encontrada.</div>';
}
function lmEscolher(id){
  const src = lmLouvor(id); if(!src) return;
  ensureLouvorConfig(src);
  lmEdit.musicas.push({ id, tom: lvTomMaiorAtual(src) || '', menor: !!src.tomModoMenor });
  lmEdit.mexeu = true;
  closeModal('modalLmEscolher');
  lmRender();
  const ultima = document.querySelector('#lmMusicas .lm-musica:last-child');
  if(ultima){ ultima.classList.add('lm-chegou'); ultima.scrollIntoView({ block:'nearest', behavior:'smooth' }); }
}

async function lmSalvar(){
  if(!lmEdit) return;
  lmEdit.nome = document.getElementById('lmNome').value.trim();
  if(!lmEdit.seq.length){ showToast('Toque nas partes para montar a sequência'); return; }
  const usadas = lmEdit.musicas.filter(m=>lmEdit.seq.some(s=>s.id===m.id));
  const medley = { musicas: lmEdit.musicas.map(m=>({ id:m.id, tom:m.tom||'', menor:!!m.menor })), seq: lmEdit.seq.map(s=>({ id:s.id, parte:s.parte })) };
  const titulo = lmEdit.nome || 'Medley';
  const artista = usadas.map(m=>(lmLouvor(m.id)||{}).titulo || '').filter(Boolean).join(' · ');
  const primeira = usadas[0] || {};
  let l = lmEdit.id ? lmLouvor(lmEdit.id) : null;
  if(l && l.medleyEditado && !(await iosConfirm('Você mexeu no texto deste medley à mão. Salvar monta o texto de novo e essas mudanças saem. Continuar?'))) return;
  if(!l){
    l = {
      id: 'lv_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      categoria: (lmLouvor(primeira.id)||{}).categoria || 'Louvor',
      tom: '', transpose: 0, dataAgendamento: '', status: 'producao', colunas: 'auto', criadoEm: Date.now()
    };
    state.louvores.push(l);
  }
  Object.assign(l, { titulo, artista, medley, tomOriginal: primeira.tom || '', tomModoMenor: !!primeira.menor, transpose: 0 });
  delete l.medleyEditado;
  l.conteudo = lmGerarTexto(medley);
  persist();
  document.getElementById('pageLouvorMedley').classList.remove('active');
  lmEdit = null;
  closeLouvorForm();
  renderLouvor();
  abrirLouvorDetalhe(l.id);
  showToast('Medley pronto');
}

/* ================= importação com passos e conferência ================= */
/* status(texto, passo): com "passo" abre uma etapa nova (a anterior ganha ✓); sem, escreve embaixo da etapa atual */
function lviProgresso(id){
  const el = document.getElementById(id);
  const passos = [];
  const desenha = ()=>{
    if(!el) return;
    el.classList.remove('erro');
    el.innerHTML = `<div class="lvi-passos">${passos.map(p=>`<div class="lvi-passo ${p.estado}"><span class="lvi-passo-ico"></span><span class="lvi-passo-txt"><b>${lvEsc(p.titulo)}</b>${p.sub?`<small>${lvEsc(p.sub)}</small>`:''}</span></div>`).join('')}</div>`;
  };
  const ativo = ()=>passos.find(p=>p.estado==='ativo');
  const fn = (texto, passo)=>{
    if(passo){
      passos.forEach(p=>{ if(p.estado==='ativo') p.estado = 'ok'; });
      passos.push({ titulo: texto, estado: 'ativo', sub: '' });
    } else {
      const a = ativo();
      if(a) a.sub = texto; else passos.push({ titulo: texto, estado: 'ativo', sub: '' });
    }
    desenha();
  };
  fn.aviso = texto=>{ const a = ativo(); if(a){ a.estado = 'aviso'; a.sub = texto; } else passos.push({ titulo: texto, estado: 'aviso', sub: '' }); desenha(); };
  fn.fim = relatorio=>{
    passos.forEach(p=>{ if(p.estado==='ativo') p.estado = 'ok'; });
    desenha();
    if(el && relatorio) el.insertAdjacentHTML('beforeend', relatorio);
  };
  fn.erro = msg=>{
    passos.forEach(p=>{ if(p.estado==='ativo') p.estado = 'falhou'; });
    desenha();
    if(el) el.insertAdjacentHTML('beforeend', `<div class="lvi-erro">${lvEsc(msg)}</div>`);
  };
  return fn;
}
/* resumo do que foi conferido de verdade (sem prometer o que o app não consegue checar) */
function lviRelatorioHtml(r, final){
  const c = r.conferencia || {};
  const ok = t=>`<div class="lvi-rel-item ok"><span>✓</span>${t}</div>`;
  const av = t=>`<div class="lvi-rel-item aviso"><span>!</span>${t}</div>`;
  const it = [];
  const perdidas = (c.faltando || []).length, olhar = (c.olhar || []).length;
  if(c.linhas) it.push(ok(`${c.linhas} linhas da letra${c.comPdf && r.usouIA && !perdidas ? ', nenhuma ficou de fora' : ''}`));
  if(r.blocos) it.push(ok(`${r.blocos} parte${r.blocos>1?'s':''} separada${r.blocos>1?'s':''} (estrofes, refrão…)`));
  if(c.acordes){
    if(r.usouIA && c.comPdf){ if(c.conferidos) it.push(ok(`${c.conferidos} acordes conferidos com o PDF, cada um em cima da sílaba certa`)); }
    else if(c.comPdf) it.push(ok(`${c.acordes} acordes na posição exata em que estavam no PDF`));
    else it.push(av(`${c.acordes} acordes lidos de uma foto: dê uma olhada nas posições`));
  }
  if(perdidas) it.push(av(`${perdidas} linha${perdidas>1?'s':''} do PDF não entr${perdidas>1?'aram':'ou'}: ${(c.faltando||[]).slice(0,3).map(t=>'“'+lvEsc(t)+'”').join(', ')}${perdidas>3?'…':''}`));
  if(olhar) it.push(av(`${olhar} linha${olhar>1?'s':''} com acordes que não deu para conferir — ficam em amarelo no editor`));
  if(r.avisoIA) it.push(av(`IA indisponível (${lvEsc(r.avisoIA)}): usei a leitura simples`));
  const tudoCerto = !perdidas && !olhar && !r.avisoIA && c.comPdf !== false;
  return `<div class="lvi-rel${tudoCerto?' certo':''}">
    <div class="lvi-rel-topo"><span class="lvi-rel-selo">${tudoCerto?'✓':'!'}</span><b>${tudoCerto?'Conferido':'Pronto — veja os avisos'}</b></div>
    ${it.join('')}
    ${final ? `<div class="lvi-rel-final">${final}</div>` : ''}
  </div>`;
}
/* contagem para a leitura simples (sem IA) */
function lviConferenciaSimples(conteudo, usouOcr){
  const rows = lviTextoParaLinhas(conteudo);
  const acordes = rows.reduce((n, r)=>n + (r.chords || []).length, 0);
  return { linhas: rows.filter(r=>r.type==='lyric' && r.text.trim()).length, acordes, comPdf: !usouOcr, conferidos: 0, olhar: [], faltando: [] };
}
/* conferência da IA: acordes que bateram com o PDF, linhas que não deu para conferir e letra que ficou de fora */
function lviConferenciaIA(secoes, simples){
  const todas = secoes.flatMap(s=>s.lines || []);
  const letra = todas.filter(r=>r.type==='lyric' && r.text.trim());
  const c = { linhas: letra.length, acordes: todas.reduce((n, r)=>n + (r.chords || []).length, 0), comPdf: !!(simples && simples.length), conferidos: 0, olhar: [], faltando: [] };
  if(!c.comPdf) return c;
  letra.forEach(r=>{
    if(!r.chords || !r.chords.length) return;
    if(r.conferido) c.conferidos += r.chords.length;
    else if(lviSoLetras(r.text).length >= 4) c.olhar.push(r.text.trim());
  });
  const tudo = lviSoLetras(letra.map(r=>r.text).join(''));
  simples.forEach(s=>{ const k = lviSoLetras(s.text); if(k.length >= 8 && !tudo.includes(k) && !lviEhInfoNaoLetra(s.text)) c.faltando.push(s.text.trim()); });
  return c;
}
