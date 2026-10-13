/* ========== LOUVOR — extras: importar PDF/foto, blocos automáticos, edição na folha, PDF por impressão e slides com acordes ==========
   Tudo grava no mesmo formato de texto do louvor.js ([Seção], linha de acordes em cima da letra),
   então as cifras antigas continuam funcionando. As bibliotecas pesadas (leitor de PDF e OCR) só
   são baixadas quando você importa um arquivo. */

const LVI_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const LVI_PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const LVI_TESSERACT = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
/* acorde no texto importado (aceita sus/add/maj, números e extensões entre parênteses) */
const LVI_CHORD_RE = /^([A-G](?:##|bb|#|b)?)((?:maj|min|dim|aug|sus|add|m|M)?\d*(?:\([^)]*\))?)(?:\/([A-G](?:##|bb|#|b)?))?$/;

function lviCarregarScript(url, pronto){
  if(pronto()) return Promise.resolve();
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = url;
    s.onload = ()=> resolve();
    s.onerror = ()=> reject(new Error('não consegui baixar o leitor (verifique a internet)'));
    document.head.appendChild(s);
  });
}
let lviWorkerPronto = false;
function lviPdfPronto(){
  return lviCarregarScript(LVI_PDFJS, ()=>typeof pdfjsLib!=='undefined').then(()=>{
    if(lviWorkerPronto) return;
    /* worker como Blob: funciona igual no app instalado e no navegador */
    return fetch(LVI_PDFJS_WORKER).then(r=>r.text()).then(src=>{
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([src], { type:'text/javascript' }));
      lviWorkerPronto = true;
    });
  });
}

/* ---------- página em duas colunas (ex.: PDF do Cifra Club) ----------
   Procura um "corredor" vertical vazio no meio da página. Achando, devolve [cabeçalho, coluna esquerda, coluna direita]
   para ler a esquerda inteira antes da direita. O cabeçalho (acima de onde a coluna da direita começa) pode ocupar a largura toda.
   y maior = mais para cima (vale para o PDF e para o OCR). */
function lviSepararColunas(items){
  if(items.length < 12) return [items];
  const xMin = Math.min(...items.map(i=>i.x)), xMax = Math.max(...items.map(i=>i.x+i.w)), W = xMax - xMin;
  let melhor = null;
  for(let f=0.3; f<=0.7; f+=0.01){
    const T = xMin + W*f;
    const dir = items.filter(i=>i.x >= T);
    if(dir.length < items.length*0.15) continue;
    const topoDir = Math.max(...dir.map(i=>i.y));
    const corpo = items.filter(i=>i.y <= topoDir + 2);
    if(corpo.some(i=>i.x < T && i.x+i.w > T)) continue;          // alguma palavra atravessa: não é corredor
    const esq = corpo.filter(i=>i.x < T);
    if(esq.length < corpo.length*0.15) continue;
    const folga = Math.min(...dir.map(i=>i.x)) - Math.max(...esq.map(i=>i.x+i.w));
    if(!melhor || folga > melhor.folga) melhor = { T, topoDir, folga };
  }
  if(!melhor || melhor.folga < 12) return [items];                 // espaço entre palavras não conta como corredor
  const cab = items.filter(i=>i.y > melhor.topoDir + 2);
  const corpo = items.filter(i=>i.y <= melhor.topoDir + 2);
  return [cab, corpo.filter(i=>i.x < melhor.T), corpo.filter(i=>i.x >= melhor.T)];
}
/* agrupa palavras na mesma altura em linhas (tol = quanto a altura pode variar) */
function lviAgruparLinhas(items, tol, page){
  items.sort((a,b)=>(b.y-a.y) || (a.x-b.x));
  const clusters = [];
  items.forEach(it=>{
    const last = clusters[clusters.length-1];
    if(last && Math.abs(last.y-it.y) <= tol) last.items.push(it);
    else clusters.push({ y:it.y, items:[it], page });
  });
  clusters.forEach(c=>{ c.items.sort((a,b)=>a.x-b.x); c.f = Math.max(...c.items.map(i=>i.f||0)); });
  return clusters;
}

/* ---------- leitura do PDF com texto ---------- */
function lviClustersDoPdf(file){
  return lviPdfPronto().then(()=>file.arrayBuffer()).then(buf=>pdfjsLib.getDocument({ data: buf }).promise).then(async pdf=>{
    let out = [];
    for(let p=1; p<=pdf.numPages; p++){
      const tc = await (await pdf.getPage(p)).getTextContent();
      const items = tc.items.filter(i=>i.str.trim()!=='').map(i=>({ s:i.str, x:i.transform[4], y:i.transform[5], w:i.width, f:Math.hypot(i.transform[0], i.transform[1]) }));
      lviSepararColunas(items).forEach(grupo=>{ out = out.concat(lviAgruparLinhas(grupo, 3, p)); });
    }
    return out;
  });
}

/* ---------- OCR (foto ou PDF escaneado) ---------- */
function lviEhImagem(f){ return /^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name||''); }
function lviCanvasDoArquivo(file){
  if(lviEhImagem(file)){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const esc = Math.min(3, Math.max(1, 2200/img.naturalWidth));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth*esc); cv.height = Math.round(img.naturalHeight*esc);
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); resolve([cv]);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('não consegui abrir essa imagem (use PNG, JPG ou WEBP)')); };
      img.src = url;
    });
  }
  return lviPdfPronto().then(()=>file.arrayBuffer()).then(buf=>pdfjsLib.getDocument({ data: buf }).promise).then(async pdf=>{
    const out = [];
    for(let p=1; p<=pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale:3 });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      out.push(cv);
    }
    return out;
  });
}
function lviPalavrasOcr(data){
  if(data.words && data.words.length) return data.words;
  const out = [];
  (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>out.push(w)))));
  return out;
}
async function lviClustersDoOcr(file, status){
  const canvases = await lviCanvasDoArquivo(file);
  status('Baixando o leitor de imagem (na primeira vez demora um pouco)...');
  await lviCarregarScript(LVI_TESSERACT, ()=>typeof Tesseract!=='undefined');
  const worker = await Tesseract.createWorker('por', 1, { logger: m=>{ if(m.status==='recognizing text') status('Lendo a imagem... '+Math.round(m.progress*100)+'%'); } });
  let out = [];
  const paraItens = data=>lviPalavrasOcr(data).filter(w=>w.text && w.text.trim()).map(w=>({ s:w.text.trim(), x:w.bbox.x0, y:-(w.bbox.y0+w.bbox.y1)/2, w:w.bbox.x1-w.bbox.x0, y0:w.bbox.y0, y1:w.bbox.y1, f:w.bbox.y1-w.bbox.y0 }));
  for(let idx=0; idx<canvases.length; idx++){
    const cv = canvases[idx];
    const res = await worker.recognize(cv);
    const items = paraItens(res.data);
    const hs = items.map(i=>i.y1-i.y0).sort((a,b)=>a-b);
    const tol = Math.max(8, (hs.length ? hs[Math.floor(hs.length/2)] : 28)*0.5);
    const clusters = [];
    lviSepararColunas(items).forEach(grupo=>clusters.push(...lviAgruparLinhas(grupo, tol, idx+1)));
    /* segunda leitura só nas linhas que parecem de acordes, aceitando apenas caracteres de acorde */
    /* só linhas curtas em que a primeira leitura já achou acordes em pelo menos metade das palavras
       (evita transformar letra com palavras curtas, como "Com todo o meu ser", em acordes) */
    const linhasAcorde = clusters.filter(c=>{
      if(!lviLinhaCurta(c)) return false;
      const toks = [];
      c.items.forEach(it=>it.s.trim().split(/\s+/).forEach(t=>{ t = lviLimpa(t); if(t) toks.push(t); }));
      return toks.filter(t=>lviCorrigeAcorde(t)!==null).length / toks.length >= 0.5;
    });
    if(linhasAcorde.length){
      status('Conferindo os acordes...');
      await worker.setParameters({ tessedit_char_whitelist:'ABCDEFGabdgijmnsuM#/()0123456789', tessedit_pageseg_mode:'11' });
      for(const c of linhasAcorde){
        const top = Math.min(...c.items.map(i=>i.y0)), bot = Math.max(...c.items.map(i=>i.y1)), h = bot-top;
        const t = Math.max(0, Math.floor(top-h*0.4)), b = Math.min(cv.height, Math.ceil(bot+h*0.4));
        const r2 = await worker.recognize(cv, { rectangle:{ left:0, top:t, width:cv.width, height:b-t } });
        const ws = paraItens(r2.data);
        if(ws.length && ws.every(i=>lviCorrigeAcorde(i.s)!==null)){ ws.sort((a,b)=>a.x-b.x); c.items = ws; }
      }
      await worker.setParameters({ tessedit_char_whitelist:'', tessedit_pageseg_mode:'3' });
    }
    out = out.concat(clusters);
  }
  await worker.terminate();
  return out;
}

/* ---------- de linhas lidas para letra + acordes ---------- */
function lviLetra(items){
  let text = '', xs = [], prevEnd = null;
  items.forEach(it=>{
    const cw = it.w / Math.max(it.s.length, 1);
    if(prevEnd!==null && text && text.slice(-1)!==' ' && it.s[0]!==' ' && it.x-prevEnd > cw*0.4){ text += ' '; xs.push(prevEnd); }
    for(let k=0;k<it.s.length;k++){ text += it.s[k]; xs.push(it.x + cw*k); }
    prevEnd = it.x + it.w;
  });
  let a = 0, b = text.length-1;
  while(a<=b && text[a]===' ') a++;
  while(b>=a && text[b]===' ') b--;
  return { text:text.slice(a,b+1), xs:xs.slice(a,b+1), end:prevEnd };
}
function lviLimpa(t){ return t.replace(/^[|,.;:'"`]+|[|,.;:'"`]+$/g, ''); }
/* confusões comuns do OCR em acordes ("6" no lugar de "G", "(" no lugar de "C"...) */
const LVI_FIX = { '6':'G', '8':'B', '(':'C', '[':'C', '{':'C', '€':'C', '©':'C', '0':'D' };
function lviCorrigeAcorde(raw){
  const t = lviLimpa(raw);
  if(!t) return null;
  if(LVI_CHORD_RE.test(t)) return t;
  const f = LVI_FIX[t.charAt(0)];
  if(f && LVI_CHORD_RE.test(f+t.slice(1))) return f+t.slice(1);
  const up = t.charAt(0).toUpperCase()+t.slice(1);
  return LVI_CHORD_RE.test(up) ? up : null;
}
function lviPalavraDeSecao(items){
  if(items.length > 4) return null;
  for(const it of items){
    const w = it.s.replace(/[^A-Za-zÀ-ÿ]/g, '');
    if(/refr[ãaâ]o/i.test(w)) return 'Refrão';
    const m = /^(coro|ponte|intro|solo|final)$/i.exec(w);
    if(m) return m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase();
  }
  return null;
}
function lviLinhaCurta(c){
  const toks = [];
  c.items.forEach(it=>it.s.trim().split(/\s+/).forEach(t=>{ t = lviLimpa(t); if(t) toks.push(t); }));
  if(!toks.length || toks.length > 10) return false;
  return toks.every(t=>t.length<=4 && !/^[-–—─_=~]+$/.test(t));
}
const LVI_ROTULOS = /^(intro|introdu[cç][aã]o|refr[aã]o|pr[eé][-\s]?refr[aã]o|coro|ponte|solo|final|interl[uú]dio|instrumental|tag|(primeira|segunda|terceira|quarta|quinta|sexta|s[eé]tima|oitava|nona|d[eé]cima)\s+parte|parte\s*\d+|estrofe\s*\d*|verso\s*\d*|repete\b.*)$/i;
/* linhas que não são da música: créditos, ficha técnica, site, número de página...
   ("Composição de: Fulano", "Letra: ...", "Gravadora: ...", "cifraclub.com.br", "Página 1 de 2") */
const LVI_INFO_CAMPO = /^(afina[cç][aã]o|composi[cç][aã]o(\s+de)?|compositor(a|es)?|autor(a|es)?|letra(\s+e\s+m[uú]sica)?|m[uú]sica(\s+e\s+letra)?|vers[aã]o(\s+de)?|int[eé]rprete|cantor(a)?|ministra[cç][aã]o|gravadora|selo|[aá]lbum|cd|produ[cç][aã]o|produtor|arranjo|arranjador|capotraste|capo|tom|bpm|andamento|ritmo|cifra(\s+por)?|cifrad[ao]\s+por|enviad[ao]\s+por|colabora[cç][aã]o|revis[aã]o|revisad[ao]\s+por|transcri[cç][aã]o|editora|direitos|copyright|ano)\s*:/i;
function lviEhInfoNaoLetra(texto){
  const t = String(texto||'').trim();
  if(!t) return false;
  if(LVI_INFO_CAMPO.test(t)) return true;
  if(/^composi[cç][aã]o\s+de\s+\S/i.test(t)) return true;                       // "Composição de Fulano" sem dois-pontos
  if(/^(©|\(c\)|todos os direitos)/i.test(t)) return true;
  if(/(https?:\/\/|www\.|\.com(\.br)?\b|cifraclub|cifras\.com|letras\.mus|ultimate-guitar)/i.test(t)) return true;
  if(/^p[aá]g(ina)?\.?\s*\d+(\s*(de|\/)\s*\d+)?$/i.test(t) || /^\d+\s*\/\s*\d+$/.test(t)) return true;
  return false;
}
function lviRotuloDe(text){
  const t = (text||'').replace(/^[\s\-–—─_=\[\](){}:.]+|[\s\-–—─_=\[\](){}:.]+$/g, '');
  return t && LVI_ROTULOS.test(t) ? t : null;
}
function lviLinhasDosClusters(clusters, tolerante){
  const gaps = [];
  for(let i=1;i<clusters.length;i++) if(clusters[i].page===clusters[i-1].page) gaps.push(clusters[i-1].y-clusters[i].y);
  gaps.sort((a,b)=>a-b);
  const mediana = gaps.length ? gaps[Math.floor(gaps.length/2)] : 30;
  /* tamanho de letra do corpo: no PDF com texto, as linhas bem maiores no topo são título e artista */
  const fs = clusters.map(c=>c.f||0).filter(Boolean).sort((a,b)=>a-b);
  const fCorpo = fs.length ? fs[Math.floor(fs.length/2)] : 0;
  const pre = []; let prev = null, nGrandes = 0, corpoComecou = false;
  clusters.forEach(c=>{
    const toks = [];
    c.items.forEach(it=>it.s.trim().split(/\s+/).forEach(t=>{ t = tolerante ? lviLimpa(t) : t; if(t) toks.push(t); }));
    if(!toks.length) return;
    const textoLinha = c.items.map(it=>it.s).join(' ').replace(/\s+/g,' ').trim();
    /* cabeçalho do Cifra Club e parecidos */
    const mTom = /^tom\s*:\s*([A-G](?:#|b)?)\s*(m(?![a-z]))?/i.exec(textoLinha);
    if(mTom){ pre.push({ type:'tom', raiz:mTom[1].charAt(0).toUpperCase()+mTom[1].slice(1), menor:!!mTom[2] }); return; }
    if(lviEhInfoNaoLetra(textoLinha)) return;
    if(!tolerante && !corpoComecou && fCorpo && c.f >= fCorpo*1.3 && nGrandes < 2){
      pre.push({ type: nGrandes===0 ? 'title' : 'artist', text:textoLinha }); nGrandes++; return;
    }
    corpoComecou = true;
    /* "Intro( A , E , Bm )" ou "Solo: G D": nome do bloco + acordes na mesma linha */
    const limpos = toks.map(t=>t.replace(/[(),:\[\]]/g,'')).filter(Boolean);
    if(limpos.length >= 2 && lviRotuloDe(limpos[0]) && limpos.slice(1).every(t=>lviCorrigeAcorde(t)!==null)){
      pre.push({ type:'label', text: lviRotuloDe(limpos[0]) });
      pre.push({ type:'chords', chords: limpos.slice(1).map(t=>({ name:lviCorrigeAcorde(t) })) });   // linha só de acordes, não gruda na letra de baixo
      prev = c;
      return;
    }
    const nAc = toks.filter(t=>tolerante ? lviCorrigeAcorde(t)!==null : LVI_CHORD_RE.test(t)).length;
    const curtos = toks.every(t=>t.length<=4);
    const ehAcordes = tolerante ? (nAc>=1 && toks.length<=10 && (nAc/toks.length>=0.7 || (curtos && toks.length-nAc<=1))) : nAc===toks.length;
    if(prev && prev.page===c.page && (prev.y-c.y) > mediana*1.6) pre.push({ type:'blank' });
    prev = c;
    const junto = c.items.map(it=>it.s).join('');
    const tracos = (junto.match(/[-–—─]/g)||[]).length;
    if(ehAcordes){
      const acordes = [];
      c.items.forEach(it=>{ const re = /\S+/g; let m; while((m = re.exec(it.s))){ const nm = tolerante ? lviCorrigeAcorde(m[0]) : m[0]; if(nm && LVI_CHORD_RE.test(nm)) acordes.push({ name:nm, x: it.x + it.w*m.index/it.s.length }); } });
      pre.push({ type:'chordrow', chords:acordes });
    } else if(tolerante && lviPalavraDeSecao(c.items)){
      pre.push({ type:'label', text: lviPalavraDeSecao(c.items) });
    } else if(lviRotuloDe(c.items.map(it=>it.s).join(' '))){
      pre.push({ type:'label', text: lviRotuloDe(c.items.map(it=>it.s).join(' ')) });
    } else if(tracos>=3 && /^[-–—─_=\s\p{L}]*$/u.test(junto)){
      const rot = tolerante ? '' : junto.replace(/[-–—─_=]/g,'').trim();
      pre.push(rot ? { type:'label', text:rot } : { type:'rule' });
    } else {
      pre.push({ type:'lyric', info: lviLetra(c.items) });
    }
  });
  const out = []; let tituloFeito = pre.some(r=>r.type==='title');
  for(let j=0;j<pre.length;j++){
    const r = pre[j];
    if(r.type==='chordrow'){
      const nx = pre[j+1];
      if(nx && nx.type==='lyric'){
        const info = nx.info;
        out.push({ type:'lyric', text:info.text, chords: r.chords.map(ch=>{
          let idx;
          if(ch.x >= info.end) idx = info.text.length;
          else { let best = 0, d = Infinity; info.xs.forEach((x,k)=>{ const dd = Math.abs(x-ch.x); if(dd<d){ d = dd; best = k; } }); idx = best; }
          return { name:ch.name, idx };
        }) });
        j++;
      } else out.push({ type:'chords', chords:r.chords });
    } else if(r.type==='lyric'){
      if(!tituloFeito){ out.push({ type:'title', text:r.info.text }); tituloFeito = true; }
      else out.push({ type:'lyric', text:r.info.text, chords:[] });
    } else out.push(r);
  }
  return lviJuntarLinhasQuebradas(out);
}
/* coluna estreita (Cifra Club) quebra o verso no meio: "Preciso fazer muito mais do que" / "tenho feito".
   Junta quando a linha de cima chega perto da largura da coluna, não termina em . ! ? e a de baixo começa com minúscula.
   Os acordes da linha de baixo vão junto, na posição certa. */
function lviJuntarLinhasQuebradas(rows){
  const letras = rows.filter(r=>r.type==='lyric').map(r=>r.text.length).sort((a,b)=>a-b);
  if(letras.length < 4) return rows;
  const largura = letras[Math.floor(letras.length*0.9)];
  const out = [];
  rows.forEach(r=>{
    const a = out[out.length-1];
    if(a && a.type==='lyric' && r.type==='lyric' && a.text.length >= largura*0.75 && !/[.!?]["”)]?$/.test(a.text) && /^[a-zà-ÿ]/.test(r.text)){
      const desloc = a.text.length + 1;
      a.text = a.text + ' ' + r.text;
      a.chords = (a.chords||[]).concat((r.chords||[]).map(c=>({ name:c.name, idx:c.idx + desloc })));
      return;
    }
    out.push(r);
  });
  return out;
}

/* ---------- blocos: nomeia, detecta repetição ("Repete - Refrão") ---------- */
const LVI_ORD = ['Primeira parte','Segunda parte','Terceira parte','Quarta parte','Quinta parte','Sexta parte','Sétima parte','Oitava parte','Nona parte','Décima parte'];
function lviAssinatura(s){
  return JSON.stringify(s.lines.map(l=> l.type==='marca' ? ['m', l.text] : l.type==='chords' ? ['c', l.chords.map(c=>c.name)] : ['l', (l.text||'').replace(/\s+$/,''), (l.chords||[]).map(c=>[c.name, c.idx])]));
}
function lviMontaBlocos(rows){
  let titulo = '', cur = null, n = 0;
  const secoes = [];
  const abre = nome=>{ cur = { name:nome, lines:[] }; secoes.push(cur); };
  let artistaCab = '', tomCab = null;
  rows.forEach(r=>{
    if(r.type==='title'){ titulo = r.text; return; }
    if(r.type==='artist'){ artistaCab = r.text; return; }
    if(r.type==='tom'){ tomCab = r; return; }
    if(r.type==='label'){ abre(r.text); if(/^repete/i.test(r.text)) cur = null; return; }
    if(r.type==='blank' || r.type==='rule'){ if(cur && cur.lines.length) cur = null; return; }
    if(r.type==='marca'){
      /* "---" fecha o bloco e a próxima parte vai para a outra coluna; "-" no meio do bloco fica onde está */
      if(r.text==='---'){ const alvo = cur || secoes[secoes.length-1]; if(alvo) alvo.colunaDepois = true; cur = null; return; }
      if(cur && cur.lines.length) cur.lines.push(r);
      return;
    }
    /* bloco instrumental (Intro, Solo...) só com acordes: a letra que vem depois começa um bloco novo */
    if(r.type==='lyric' && cur && /^(intro|introdu|solo|instrumental|interl)/i.test(cur.name||'') && cur.lines.every(l=>l.type==='chords')) cur = null;
    if(!cur) abre('');
    cur.lines.push(r);
  });
  const vistos = [];
  secoes.forEach(s=>{
    if(!s.lines.length) return;
    const k = lviAssinatura(s);
    const igual = vistos.find(v=>v.k===k);
    if(igual){ s.repeatOf = igual.s; if(s.name && !igual.s.name) igual.s.name = s.name; return; }
    vistos.push({ k, s });
  });
  secoes.forEach((s,i)=>{
    if(s.name || s.repeatOf) return;
    const temLetra = s.lines.some(l=>l.type==='lyric');
    if(!temLetra){ s.name = i===0 ? 'Intro' : 'Instrumental'; return; }
    s.name = n < LVI_ORD.length ? LVI_ORD[n] : 'Parte '+(n+1);
    n++;
  });
  /* "Artista - Música - Tom" no topo da cifra */
  const t = titulo.replace(/\s*-\s*[A-G6][#b]?m?\s*$/, '').trim();
  let artista = '', nome = t;
  const partes = t.split(/\s+-\s+/);
  if(partes.length===2 && !/^\d/.test(partes[0])){ artista = partes[0]; nome = partes[1]; }
  const km = /[-–]\s*([A-G][#b]?)(m?)\s*$/.exec(titulo);
  /* cabeçalho com título e artista separados (Cifra Club) vale mais que adivinhar pelo "Artista - Música" */
  if(artistaCab){ nome = titulo.trim(); artista = artistaCab; }
  const tom = tomCab ? tomCab.raiz : (km ? km[1] : null);
  const menor = tomCab ? tomCab.menor : !!(km && km[2]);
  return { titulo:nome, artista, secoes, tom, menor, temCabecalho: !!artistaCab };
}
/* nome do arquivo "Cantor - Música - Tom" */
function lviNomeDoArquivo(nome){
  if(!nome) return null;
  let base = nome.replace(/\.[^.]+$/,'').replace(/\s*\(\d+\)\s*$/,'').replace(/_/g,' ').trim();
  /* PDF baixado do Cifra Club: "Música - Artista - Cifra Club" */
  const cifraClub = /\s*[-–]\s*cifra\s*club\s*$/i.test(base);
  base = base.replace(/\s*[-–]\s*cifra\s*club\s*$/i, '');
  const partes = base.split(/\s+[-–]\s+/).map(p=>p.trim()).filter(Boolean);
  if(cifraClub && partes.length===2) return { titulo:partes[0], artista:partes[1], tom:null, menor:false };
  let tom = null, menor = false;
  const km = /^([A-G][#b]?)(m?)$/.exec(partes[partes.length-1]||'');
  if(km && partes.length>=2){ tom = km[1]; menor = !!km[2]; partes.pop(); }
  if(partes.length===2) return { artista:partes[0], titulo:partes[1], tom, menor };
  if(tom) return { artista:'', titulo:partes.join(' - '), tom, menor };
  return null;
}
/* linha de acordes em texto, cada acorde na coluna da sílaba (sem encostar no anterior) */
function lviLinhaDeAcordes(chords){
  let s = '';
  chords.slice().sort((a,b)=>a.idx-b.idx).forEach(c=>{
    const pos = Math.max(c.idx, s.length ? s.length+1 : 0);
    while(s.length < pos) s += ' ';
    s += c.name;
  });
  return s;
}
/* blocos → texto do Siloé ([Seção] + acordes em cima da letra).
   Entre um bloco e outro entra "--" (linha divisória no PDF), ou "---" se ali era para pular para a próxima coluna */
function lviBlocosParaTexto(secoes){
  const linhas = [];
  /* bloco que ficou vazio (só tinha créditos, por exemplo) sai; "[Repete - ...]" escrito à mão fica */
  secoes = secoes.filter(s=>s.repeatOf || s.lines.length || /^repete/i.test(s.name||''));
  secoes.forEach((s,i)=>{
    if(i > 0) linhas.push(secoes[i-1].colunaDepois ? '---' : '--');
    if(s.repeatOf){ linhas.push('['+(s.label || ('Repete - '+s.repeatOf.name))+']'); return; }
    linhas.push('['+(s.name||'Parte')+']');
    s.lines.forEach(r=>{
      if(r.type==='marca'){ linhas.push(r.text); return; }
      if(r.type==='chords'){ linhas.push(r.chords.map(c=>c.name).join('   ')); return; }
      if(r.chords && r.chords.length) linhas.push(lviLinhaDeAcordes(r.chords));
      linhas.push(r.text && r.text.trim() ? r.text : ' ');
    });
  });
  return linhas.join('\n');
}
/* tom importado → formato do Siloé (tom menor guarda o relativo maior + marca de menor), com o nome literal do arquivo:
   Gb continua Gb, Ebm vira Gb menor, D#m vira F# menor. Só D#, G# e A# maiores (tons teóricos) viram Eb, Ab e Bb */
function lviTomSiloe(raiz, menor){
  if(!raiz) return { tomOriginal:'', tomModoMenor:false };
  if(menor) return { tomOriginal: lvRelativoMaior(raiz), tomModoMenor:true };
  return { tomOriginal: ({ 'D#':'Eb', 'G#':'Ab', 'A#':'Bb' })[raiz] || raiz, tomModoMenor:false };
}

/* ---------- importar: arquivo → { titulo, artista, tom, conteudo } ---------- */
async function lviImportar(file, status){
  let rows = [];
  if(!lviEhImagem(file)){
    status('Lendo o PDF...');
    const cl = await lviClustersDoPdf(file);
    rows = lviLinhasDosClusters(cl, false);
  }
  let usouOcr = false;
  if(!rows.filter(r=>r.type==='lyric' || r.type==='chords').length){
    usouOcr = true;
    const cl = await lviClustersDoOcr(file, status);
    rows = lviLinhasDosClusters(cl, true);
  }
  if(!rows.length) throw new Error('não encontrei texto nesse arquivo');
  const doc = lviMontaBlocos(rows);
  const fi = lviNomeDoArquivo(file.name);
  const raiz = (fi && fi.tom) || doc.tom;
  const menor = fi && fi.tom ? fi.menor : doc.menor;
  /* título/artista: o cabeçalho do PDF (quando tem) é mais confiável que o nome do arquivo */
  return {
    titulo: (doc.temCabecalho && doc.titulo) || (fi && fi.titulo) || doc.titulo || '',
    artista: (doc.temCabecalho && doc.artista) || (fi && fi.artista) || doc.artista || '',
    tom: lviTomSiloe(raiz, menor),
    conteudo: lviBlocosParaTexto(doc.secoes),
    blocos: doc.secoes.length,
    usouOcr
  };
}
function lviStatus(id, texto, erro){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = texto || '';
  el.classList.toggle('erro', !!erro);
}

/* no cadastro de um louvor novo */
async function lvImportarNoNovo(ev){
  const file = ev.target.files[0]; ev.target.value = '';
  if(!file) return;
  try{
    const r = await lviImportar(file, t=>lviStatus('lvNovoImportStatus', t));
    if(r.titulo) document.getElementById('lvNovoTitulo').value = r.titulo;
    if(r.artista) document.getElementById('lvNovoArtista').value = r.artista;
    if(r.tom.tomOriginal){ window.lvNovoTomOriginal = r.tom.tomOriginal; window.lvNovoTomModoMenor = r.tom.tomModoMenor; atualizarLvNovoTomBox(); }
    window.lvNovoConteudo = r.conteudo;
    lviStatus('lvNovoImportStatus', `✓ Cifra importada (${r.blocos} bloco${r.blocos===1?'':'s'})${r.usouOcr?' por leitura de imagem — confira os acordes depois':''}. Toque em "Criar e Abrir".`);
  }catch(e){
    lviStatus('lvNovoImportStatus', 'Não consegui ler: '+(e && e.message ? e.message : e)+'. Você pode colar a cifra como texto depois.', true);
  }
}
/* dentro de um louvor já existente (substitui o texto) */
async function lvImportarNoAtual(ev){
  const file = ev.target.files[0]; ev.target.value = '';
  const l = getLouvorAtual(); if(!file || !l) return;
  if((l.conteudo||'').trim() && !(await iosConfirm('Substituir a cifra atual pelo conteúdo do arquivo?'))) return;
  try{
    const r = await lviImportar(file, t=>lviStatus('lvEdicaoImportStatus', t));
    l.conteudo = r.conteudo;
    delete l.conteudoAntesOrganizar; delete l.conteudoOrganizado;   // texto novo: o desfazer anterior não vale mais
    if(!(l.titulo||'').trim() && r.titulo) l.titulo = r.titulo;
    if(!(l.artista||'').trim() && r.artista) l.artista = r.artista;
    if(r.tom.tomOriginal){ l.tomOriginal = r.tom.tomOriginal; l.tomModoMenor = r.tom.tomModoMenor; l.transpose = 0; }
    persist();
    abrirLouvorDetalhe(l.id);
    lviStatus('lvEdicaoImportStatus', `✓ Importado (${r.blocos} bloco${r.blocos===1?'':'s'})${r.usouOcr?' — lido da imagem, confira os acordes':''}.`);
  }catch(e){
    lviStatus('lvEdicaoImportStatus', 'Não consegui ler: '+(e && e.message ? e.message : e), true);
  }
}

/* ---------- organizar blocos no texto que já existe ---------- */
function lviTextoParaLinhas(conteudo){
  const { items } = lvParseContent(conteudo);
  const rows = [];
  items.forEach(it=>{
    if(it.type==='section'){ rows.push({ type:'label', text:it.label }); return; }
    if(it.type==='blank'){ rows.push({ type:'blank' }); return; }
    if(it.type==='divider'){ rows.push({ type:'rule' }); return; }
    /* "---" (próxima coluna) e "-" (próximo slide) que você colocou continuam no lugar */
    if(it.type==='colbreak'){ rows.push({ type:'marca', text:'---' }); return; }
    if(it.type==='slidebreak'){ rows.push({ type:'marca', text:'-' }); return; }
    if(it.type==='pair'){
      if(!(it.chordLine||'').trim() && lviEhInfoNaoLetra(it.lyricLine)) return;   // créditos/site: não é da música
      const acordes = lvAcordesDaLinha(it.chordLine);
      if(!(it.lyricLine||'').trim()) rows.push({ type:'chords', chords: acordes.map(c=>({ name:c.name })) });
      else rows.push({ type:'lyric', text: it.lyricLine.replace(/\s+$/,''), chords: acordes.map(c=>({ name:c.name, idx: Math.min(c.idx, it.lyricLine.length) })) });
    }
  });
  return rows;
}
/* Organizar é liga/desliga: guarda o texto de antes; tocando de novo, desfaz e volta a ele */
function lvOrganizado(l){ return typeof l.conteudoAntesOrganizar === 'string'; }
function lvAtualizarBtnOrganizar(){
  const l = getLouvorAtual(), btn = document.getElementById('lvBtnOrganizar');
  if(!l || !btn) return;
  const on = lvOrganizado(l);
  btn.classList.toggle('ativo', on);
  btn.title = on ? 'Organizado — toque para desfazer' : 'Organizar blocos';
  btn.setAttribute('aria-pressed', on);
}
async function lvOrganizarBlocos(){
  const l = getLouvorAtual(); if(!l) return;
  if(lvOrganizado(l)){
    const mexeuDepois = l.conteudo !== l.conteudoOrganizado;
    const ok = await iosConfirm('Desfazer a organização? A cifra volta a ser como era antes de organizar.' + (mexeuDepois ? ' As mudanças que você fez depois de organizar também saem.' : ''));
    if(!ok) return;
    l.conteudo = l.conteudoAntesOrganizar;
    delete l.conteudoAntesOrganizar; delete l.conteudoOrganizado;
    persist();
    document.getElementById('lvConteudo').value = l.conteudo;
    lvAtualizarEditor(); lvAtualizarBtnOrganizar();
    showToast('Organização desfeita');
    return;
  }
  if(!(l.conteudo||'').trim()){ showToast('Cole ou importe a cifra primeiro'); return; }
  const ok = await iosConfirm('Organizar em blocos? Os trechos sem nome ganham nome (Intro, Primeira parte...), os blocos iguais viram "Repete", entre os blocos entra a linha divisória (--) e créditos (composição, site...) saem. Os "-" e "---" ficam. Dá para desfazer tocando de novo.');
  if(!ok) return;
  const antes = l.conteudo;
  const doc = lviMontaBlocos(lviTextoParaLinhas(l.conteudo));
  l.conteudo = lviBlocosParaTexto(doc.secoes);
  l.conteudoAntesOrganizar = antes; l.conteudoOrganizado = l.conteudo;
  persist();
  document.getElementById('lvConteudo').value = l.conteudo;
  lvAtualizarEditor(); lvAtualizarBtnOrganizar();
  const reps = doc.secoes.filter(s=>s.repeatOf).length;
  showToast(`${doc.secoes.length} blocos${reps?` · ${reps} repetido${reps>1?'s':''} virou "Repete"`:''}`);
}

/* ---------- edição direto na folha (aba Visualizar) ----------
   O botão "Editar na folha" saiu (a aba Edição já faz isso); o modo fica sempre desligado. */
window.lvEditandoFolha = false;
function lvAplicarEdicaoFolha(){
  const el = document.getElementById('lvPdfPreview'); if(!el) return;
  const on = !!window.lvEditandoFolha;
  el.classList.toggle('editando', on);
  el.querySelectorAll('.lv-c, .lv-t:not(.pad), .lv-sheet-title, .lv-sheet-artist, .lv-sheet-section').forEach(x=>{
    if(on){ x.contentEditable = 'true'; x.spellcheck = false; } else x.removeAttribute('contenteditable');
  });
  const btn = document.getElementById('lvBtnEditarFolha');
  if(btn){ btn.classList.toggle('ativo', on); btn.textContent = on ? 'Travar edição' : 'Editar na folha'; }
  if(!el._lvEventos){
    el._lvEventos = true;
    el.addEventListener('focusout', lvSincronizarFolha);
    el.addEventListener('keydown', e=>{ if(window.lvEditandoFolha && e.key==='Enter'){ e.preventDefault(); e.target.blur(); } });
    el.addEventListener('paste', e=>{
      if(!e.target.isContentEditable) return;
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData||window.clipboardData).getData('text').replace(/\s*\n\s*/g,' '));
    });
  }
}
/* o que foi digitado na folha volta para o texto da cifra (e continua valendo ao trocar de tom) */
function lvSincronizarFolha(e){
  if(!window.lvEditandoFolha) return;
  const l = getLouvorAtual(); if(!l) return;
  const alvo = e.target;
  let linhas = (l.conteudo||'').split('\n');
  let reorganizou = false;
  if(alvo.dataset && alvo.dataset.campo){
    const v = alvo.textContent.trim();
    if(alvo.dataset.campo==='titulo'){ l.titulo = v; document.getElementById('lvTitulo').value = v; document.getElementById('louvorDetalheHeaderTitle').textContent = v || 'Sem título'; }
    else { l.artista = v; document.getElementById('lvArtista').value = v; }
    persist(); renderLouvorLista();
    return;
  }
  if(alvo.classList.contains('lv-sheet-section')){
    const si = Number(alvo.dataset.si);
    const antigo = ((linhas[si]||'').match(/^\s*\[(.+)\]\s*$/)||[])[1];
    const novo = alvo.textContent.trim();
    if(!novo || !antigo){ renderLouvorPdfPreview(); return; }
    linhas[si] = '['+novo+']';
    /* "[Repete - Antigo]" acompanha o novo nome */
    linhas = linhas.map(x=>{ const m = /^\s*\[\s*repete\s*[-–:]?\s*(.+)\]\s*$/i.exec(x); return (m && m[1].trim().toLowerCase()===antigo.trim().toLowerCase()) ? '[Repete - '+novo+']' : x; });
  } else {
    const linha = alvo.closest && alvo.closest('.lv-linha');
    if(!linha) return;
    const delta = l.transpose || 0;
    let texto = '';
    const acordes = [];
    linha.querySelectorAll('.lv-seg').forEach(sg=>{
      const c = sg.querySelector('.lv-c').textContent.trim();
      const tEl = sg.querySelector('.lv-t');
      const t = tEl.classList.contains('pad') ? '' : tEl.textContent.replace(/ /g,' ').replace(/\n/g,'');
      if(c) c.split(/\s+/).forEach((nome, k)=>acordes.push({ name: delta ? lvTransposeChord(nome, -delta) : nome, idx: texto.length + (k?1:0) }));
      texto += t;
    });
    const ci = linha.dataset.ci === '' ? null : Number(linha.dataset.ci);
    const li = linha.dataset.li === '' ? null : Number(linha.dataset.li);
    const linhaAcordes = li===null ? acordes.map(a=>a.name).join('   ') : lviLinhaDeAcordes(acordes);
    if(li!==null) linhas[li] = texto.trim() ? texto : ' ';
    if(ci!==null){
      if(acordes.length) linhas[ci] = linhaAcordes;
      else { linhas.splice(ci, 1); reorganizou = true; }
    } else if(acordes.length && li!==null){
      linhas.splice(li, 0, linhaAcordes); reorganizou = true;
    }
  }
  l.conteudo = linhas.join('\n');
  persist();
  const ta = document.getElementById('lvConteudo'); if(ta){ ta.value = l.conteudo; lvAtualizarEditor(); }
  /* se mudou a quantidade de linhas, redesenha (os números das linhas mudam) */
  if(reorganizou || alvo.classList.contains('lv-sheet-section')) setTimeout(renderLouvorPdfPreview, 0);
}

/* ---------- PDF pela impressão (fiel à folha, A4, sem cabeçalho do navegador) ---------- */
function imprimirLouvorPdf(){
  const l = getLouvorAtual(); if(!l) return;
  const editava = window.lvEditandoFolha;
  window.lvEditandoFolha = false;
  renderLouvorPdfPreview();
  const src = document.getElementById('lvPdfPreview');
  let area = document.getElementById('lvPrintArea');
  if(!area){ area = document.createElement('div'); area.id = 'lvPrintArea'; document.body.appendChild(area); }
  const copia = src.cloneNode(true);
  copia.removeAttribute('id');
  copia.style.zoom = 1;
  area.innerHTML = ''; area.appendChild(copia);
  let pg = document.getElementById('lvPrintPagina');
  if(!pg){ pg = document.createElement('style'); pg.id = 'lvPrintPagina'; document.head.appendChild(pg); }
  pg.textContent = `@page{size:A4 ${l.pdfOrientacao==='paisagem'?'landscape':'portrait'};margin:0}`;
  const tituloAntes = document.title;
  /* o navegador usa o título da página como nome sugerido do PDF: "Artista - Música - Tom" */
  document.title = [l.artista, l.titulo||'Sem título', lvTomAtual(l)].filter(Boolean).join(' - ').replace(/[\/\\:*?"<>|]/g,'').trim();
  document.body.classList.add('lv-imprimindo');
  const fim = ()=>{
    document.body.classList.remove('lv-imprimindo');
    document.title = tituloAntes;
    area.innerHTML = '';
    window.removeEventListener('afterprint', fim);
    if(editava){ window.lvEditandoFolha = true; renderLouvorPdfPreview(); }
  };
  window.addEventListener('afterprint', fim);
  setTimeout(()=>window.print(), 50);
}
