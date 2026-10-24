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
const LVI_INFO_CAMPO = /^(afina[cç][aã]o|composi[cç][aã]o(\s+de)?|compositor(a|es)?|autor(a|es)?|letra(\s+e\s+m[uú]sica)?|m[uú]sica(\s+e\s+letra)?|vers[aã]o(\s+de)?|int[eé]rprete|cantor(a)?|ministra[cç][aã]o|gravadora|selo|[aá]lbum|cd|produ[cç][aã]o|produtor|arranjo|arranjador|capotraste|capo|tom|bpm|andamento|ritmo|cifra(\s+por)?|cifrad[ao]\s+por|enviad[ao]\s+por|colabora[cç][aã]o|revis[aã]o|revisad[ao]\s+por|transcri[cç][aã]o|editora|direitos|copyright|ano|participa[cç][aã]o(\s+especial)?|part\.|feat\.?|minist[eé]rio|banda|grupo|vocal|vozes|voz|back\s*vocal|bateria|baixo|guitarra|teclado|viol[aã]o|reg[eê]ncia|dire[cç][aã]o|grava[cç][aã]o|gravad[ao]\s+por|original|autoria|fonte|site|contato|instagram|youtube)\s*:/i;
/* sem dois-pontos: "Composta por Fulano", "feat. Fulano", "Part. especial ...", "Versão de ...", "(Ao vivo)" */
const LVI_INFO_POR = /^((compost|escrit|gravad|interpretad|cifrad|enviad|arranjad|produzid|revisad|transcrit|adaptad|traduzid)[ao]s?\s+(por|de)\s+\S|(feat|ft|part)\.\s*\S|feat\s+\S|participa[cç][aã]o(\s+especial)?\s+(de\s+)?\S|vers[aã]o\s+(de|original)\b|\(?\s*ao\s+vivo\s*\)?$|\(?\s*(playback|ac[uú]stico)\s*\)?$)/i;
/* avisos e botões do site que vêm junto (Cifra Club e parecidos), e @ / e-mail */
const LVI_INFO_SITE = /^(essa informa[cç][aã]o est[aá] errada|nos avise|simplificar cifra|auto\s*rolagem|exibir (cifra|acordes|tablatura)|ver v[ií]deo|videoaula|v[ií]deo\s*aula|cifra\s*:\s*principal|baixar cifra|imprimir cifra|meus acordes|instagram|youtube|spotify|facebook|tiktok|whatsapp|contato|e-?mail\s*:|@[\w.]{3,}$|[\w.+-]+@[\w-]+\.[\w.]+$)/i;
function lviEhInfoNaoLetra(texto){
  const t = String(texto||'').trim();
  if(!t) return false;
  if(LVI_INFO_CAMPO.test(t)) return true;
  if(/^composi[cç][aã]o\s+de\s+\S/i.test(t)) return true;                       // "Composição de Fulano" sem dois-pontos
  if(LVI_INFO_POR.test(t) || LVI_INFO_SITE.test(t)) return true;
  if(/^(©|\(c\)|todos os direitos)/i.test(t)) return true;
  if(/(https?:\/\/|www\.|\.com(\.br)?\b|cifraclub|cifras\.com|letras\.mus|ultimate-guitar)/i.test(t)) return true;
  if(/^p[aá]g(ina)?\.?\s*\d+(\s*(de|\/)\s*\d+)?$/i.test(t) || /^\d+\s*\/\s*\d+$/.test(t)) return true;
  return false;
}
function lviRotuloDe(text){
  const { nome, vezes } = lvVezesDoRotulo(lviDesespacar(String(text||'')).replace(/[\s:.]+$/, ''));   // "Refrão (2x)" = Refrão, 2 vezes
  const t = nome.replace(/^[\s\-–—─_=\[\](){}:.]+|[\s\-–—─_=\[\](){}:.]+$/g, '');
  /* nome conhecido (também com letras espaçadas que viraram "PRIMEIRAPARTE"): sai no padrão, "Primeira Parte" */
  const junto = lviNormPalavra(t);
  const achar = k=>LVI_ROTULOS_NOMES.find(n=>lviNormPalavra(n) === k);
  if(junto && achar(junto)) return lvRotuloComVezes(achar(junto), vezes);
  const rep = /^repete(.+)$/.exec(junto);
  if(rep){
    const alvo = achar(rep[1]) || LVI_ROTULOS_NOMES.find(n=>rep[1].startsWith(lviNormPalavra(n)));   // "REPETE-REFRÃO" + "FINAL" grudados
    if(alvo) return lvRotuloComVezes('Repete - ' + alvo, vezes);
  }
  return t && LVI_ROTULOS.test(t) ? lvRotuloComVezes(t, vezes) : null;
}
const LVI_ROTULOS_NOMES = ['Intro','Introdução','Refrão','Pré-Refrão','Coro','Ponte','Solo','Final','Interlúdio','Instrumental',
  'Primeira Parte','Segunda Parte','Terceira Parte','Quarta Parte','Quinta Parte','Sexta Parte','Sétima Parte','Oitava Parte','Nona Parte','Décima Parte'];
/* PDF com letras espaçadas (os rótulos do próprio Siloé): "I N T R O" → "INTRO", "R E F R Ã O | 2 x" → "REFRÃO | 2x".
   Só quando quase tudo é letra solta — letra de música normal não muda */
function lviDesespacar(t){
  const partes = String(t||'').split('|');
  return partes.map(p=>{
    const tok = p.trim().split(/\s+/).filter(Boolean);
    if(tok.length < 3 || tok.filter(x=>x.length === 1).length < tok.length * 0.7 || tok.some(x=>x.length > 2)) return p.trim();
    return tok.join('');
  }).join(' | ');
}
/* linha só com "2x", "(3x)", "x2": vale para a parte de cima */
function lviVezesSozinho(texto){
  const m = /^[(\[]?\s*(?:(\d+)\s*[xX×]|[xX×]\s*(\d+))\s*[)\]]?$/.exec(String(texto||'').trim());
  return m ? Math.max(1, Number(m[1]||m[2])||1) : 0;
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
    if(lviVezesSozinho(textoLinha) > 1){ pre.push({ type:'vezes', n: lviVezesSozinho(textoLinha) }); return; }
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
const LVI_ORD = ['Primeira Parte','Segunda Parte','Terceira Parte','Quarta Parte','Quinta Parte','Sexta Parte','Sétima Parte','Oitava Parte','Nona Parte','Décima Parte'];
function lviAssinatura(s){
  return JSON.stringify(s.lines.map(l=> l.type==='marca' ? ['m', l.text] : l.type==='chords' ? ['c', l.chords.map(c=>c.name)] : ['l', (l.text||'').replace(/\s+$/,''), (l.chords||[]).map(c=>[c.name, c.idx])]));
}
/* parte cantada de novo logo em seguida vira "| 2x" na mesma parte:
   letra escrita 2 vezes dentro do bloco, o mesmo bloco duas vezes, ou "[Repete - X]" logo depois de X */
function lviJuntarSeguidas(secoes){
  const ass = ls=>lviAssinatura({ lines: ls });
  secoes.forEach(s=>{
    const ls = s.lines || [];
    for(const k of [3, 2]){
      if(ls.length < 2*k || ls.length % k) continue;
      const tam = ls.length / k, pedaco = ls.slice(0, tam);
      if(!pedaco.some(l=>l.type==='lyric' && (l.text||'').trim())) continue;
      const a = ass(pedaco);
      let igual = true;
      for(let x = 1; x < k && igual; x++) igual = ass(ls.slice(x*tam, (x+1)*tam)) === a;
      if(igual){ s.lines = pedaco; s.vezes = Math.max(s.vezes||1, k); break; }   // "2x" escrito vale mais que contar
    }
  });
  for(let i = secoes.length - 1; i > 0; i--){
    const s = secoes[i], p = secoes[i-1];
    if(!p.lines || !p.lines.length || p.repeatOf || /^repete/i.test(p.name||'')) continue;
    const rep = /^repete\b\s*[-–:]?\s*(.*)$/i.exec(s.name||'');
    const alvo = s.repeatOf ? s.repeatOf.name : rep ? rep[1].trim() : null;
    const mesmo = (s.lines && s.lines.length && !s.repeatOf) ? ass(s.lines) === ass(p.lines)
      : !!(alvo && p.name && alvo.toLowerCase() === p.name.toLowerCase());
    if(!mesmo) continue;
    p.vezes = (p.vezes||1) + (s.vezes||1);
    if(!p.name && s.name && !rep) p.name = s.name;
    if(s.colunaDepois) p.colunaDepois = true;
    secoes.splice(i, 1);
  }
  return secoes;
}
function lviMontaBlocos(rows){
  let titulo = '', cur = null, n = 0;
  const secoes = [];
  const abre = nome=>{ cur = { name:nome, lines:[] }; secoes.push(cur); };
  let artistaCab = '', tomCab = null;
  const rotulada = rows.filter(r=>r.type==='label' && !/^(intro|introdu|solo|instrumental|interl|final|repete)/i.test(r.text)).length >= 2;
  rows.forEach(r=>{
    if(r.type==='title'){ titulo = r.text; return; }
    if(r.type==='artist'){ artistaCab = r.text; return; }
    if(r.type==='tom'){ tomCab = r; return; }
    if(r.type==='label'){
      const { nome, vezes } = lvVezesDoRotulo(r.text);
      abre(nome); cur.vezes = vezes;
      if(/^repete/i.test(nome)) cur = null;
      return;
    }
    if(r.type==='vezes'){ const alvo = cur || secoes[secoes.length-1]; if(alvo) alvo.vezes = r.n; return; }
    /* cifra com as partes nomeadas (Cifra Club): linha em branco dentro da parte não abre parte nova — vira "-" (próximo slide) */
    if(r.type==='blank' && rotulada && cur && cur.lines.some(l=>l.type==='lyric') && cur.name && !/^(intro|introdu|solo|instrumental|interl|final|repete)/i.test(cur.name)){ cur.pausa = true; return; }
    if(r.type==='blank' || r.type==='rule'){ if(cur && cur.lines.length) cur = null; return; }
    if(r.type==='marca'){
      /* "---" fecha o bloco e a próxima parte vai para a outra coluna; "-" no meio do bloco fica onde está */
      if(r.text==='---'){ const alvo = cur || secoes[secoes.length-1]; if(alvo) alvo.colunaDepois = true; cur = null; return; }
      if(cur && cur.lines.length){ cur.pausa = false; cur.lines.push(r); }
      return;
    }
    /* bloco instrumental (Intro, Solo...) só com acordes: a letra que vem depois começa um bloco novo */
    if(r.type==='lyric' && cur && /^(intro|introdu|solo|instrumental|interl)/i.test(cur.name||'') && cur.lines.every(l=>l.type==='chords')) cur = null;
    if(cur && cur.pausa && r.type !== 'lyric'){ cur.pausa = false; cur = null; }   // depois da linha em branco vieram só acordes: é outro bloco (solo)
    if(!cur) abre('');
    if(cur.pausa){ cur.lines.push({ type:'marca', text:'-' }); cur.pausa = false; }
    cur.lines.push(r);
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
  /* nome do cantor (ou "Cantor - Música") repetido no meio do texto não é letra */
  const norm = s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const fora = new Set(artista ? [norm(artista), norm(artista + ' ' + nome), norm(nome + ' ' + artista)] : []);
  fora.delete('');
  secoes.forEach(s=>{ if(fora.size) s.lines = s.lines.filter(l=>!(l.type==='lyric' && !(l.chords||[]).length && fora.has(norm(l.text)))); });
  for(let i = secoes.length - 1; i >= 0; i--) if(!secoes[i].lines.length && !secoes[i].name) secoes.splice(i, 1);
  if(!lviModoFiel) lviJuntarSeguidas(secoes);   // modo fiel (arquivo do Drive já certo): nada de juntar/repetir
  const vistos = [];
  secoes.forEach(s=>{
    if(!s.lines.length || lviModoFiel) return;
    const k = lviAssinatura(s);
    const igual = vistos.find(v=>v.k===k);
    if(igual){ s.repeatOf = igual.s; if(s.name && !igual.s.name) igual.s.name = s.name; return; }
    /* quase a mesma letra (uma palavra ou outra muda): é a mesma parte, mas fica com a letra dela */
    const parecida = !s.name && vistos.find(v=>lviLetraParecida(v.s, s));
    if(parecida){ s.mesmaDe = parecida.s; return; }
    vistos.push({ k, s });
  });
  /* a parte sem nome que volta igual (vira "Repete") é o Refrão; as outras são Primeira Parte, Segunda Parte… */
  const voltam = new Set(secoes.filter(s=>s.repeatOf || s.mesmaDe).map(s=>s.repeatOf || s.mesmaDe));
  let temRefrao = secoes.some(s=>/^(refr|coro)/i.test(s.name||''));
  secoes.forEach((s,i)=>{
    if(s.name || s.repeatOf || s.mesmaDe) return;
    const temLetra = s.lines.some(l=>l.type==='lyric');
    if(!temLetra){ s.name = i===0 ? 'Intro' : 'Instrumental'; return; }
    /* mesma letra de uma parte já nomeada (só os acordes mudam um pouco): mesmo nome */
    const letra = x=>x.lines.filter(l=>l.type==='lyric').map(l=>lviNormPalavra(l.text)).join('|');
    const igual = secoes.find(o=>o !== s && o.name && !o.repeatOf && letra(o) === letra(s));
    if(igual){ s.name = igual.name; return; }
    if(voltam.has(s) && !temRefrao){ s.name = 'Refrão'; temRefrao = true; return; }
    const usados = new Set(secoes.map(o=>(o.name||'').toLowerCase()));
    while(n < LVI_ORD.length && usados.has(LVI_ORD[n].toLowerCase())) n++;
    s.name = n < LVI_ORD.length ? LVI_ORD[n] : 'Parte '+(n+1);
    n++;
  });
  secoes.forEach(s=>{ if(s.mesmaDe){ s.name = s.mesmaDe.name; delete s.mesmaDe; } });
  return { titulo:nome, artista, secoes, tom, menor, temCabecalho: !!artistaCab };
}
/* duas partes com quase a mesma letra (80% das palavras na mesma ordem) */
function lviLetraParecida(a, b){
  const pal = s=>s.lines.filter(l=>l.type==='lyric').flatMap(l=>String(l.text||'').split(/\s+/).map(lviNormPalavra)).filter(Boolean);
  const x = pal(a), y = pal(b);
  if(x.length < 4 || y.length < 4) return false;
  return 2 * lviLcsPares(x, y).length / (x.length + y.length) >= .8;
}
/* IA dá o nome de cada parte (Intro, Primeira Parte, Pré-Refrão, Refrão, Ponte…) e diz quais são a mesma parte cantada de novo.
   Sem chave ou com erro: ficam os nomes da leitura simples. */
const LVI_PARTES_ESQUEMA = { type:'object', properties:{ partes:{ type:'array', items:{ type:'object', properties:{
  i:{ type:'integer', description:'número do bloco' },
  nome:{ type:'string', description:'Intro, Primeira Parte, Segunda Parte, Terceira Parte, Pré-Refrão, Refrão, Ponte, Instrumental, Solo ou Final' },
  mesmaDe:{ type:'integer', description:'número de um bloco ANTERIOR com a mesma letra (pequenas diferenças valem), ou -1' }
}, required:['i','nome','mesmaDe'] } } }, required:['partes'] };
async function lviNomearPartesIA(secoes, titulo, artista, passo){
  if(!lviChaveIA()) return false;
  const blocos = secoes.filter(s=>!s.repeatOf && s.lines.length);
  if(blocos.length < 2) return false;
  const txt = blocos.map((s, i)=>`#${i}\n` + (s.lines.filter(l=>l.type==='lyric').map(l=>l.text).join('\n') || '(só acordes)')).join('\n\n');
  try{
    const j = await lviPerguntarIA([{ type:'text', text:
      `Música de louvor: "${titulo}"${artista ? ' de ' + artista : ''}. Abaixo estão os blocos da letra, na ordem em que são cantados.\n` +
      `Dê o nome de cada bloco pela função na música: Intro, Primeira Parte, Segunda Parte, Terceira Parte (estrofes com letras diferentes), ` +
      `Pré-Refrão (o trecho que prepara o refrão), Refrão (o que volta várias vezes, o centro da música), Ponte (trecho diferente, geralmente perto do fim), Instrumental, Solo ou Final.\n` +
      `Uma música costuma ter só 3 a 5 partes que se repetem: o bloco que repete a letra de um anterior (mesmo com pequenas diferenças) tem o MESMO nome e mesmaDe = número do anterior. ` +
      `Use o que você sabe dessa música (por exemplo pelo site Letras) para acertar. Não invente partes.\n\n` + txt }],
      t=>passo && passo(t), LVI_PARTES_ESQUEMA);
    const r = (j && j.partes) || [];
    if(r.length !== blocos.length) return false;
    r.slice().sort((a, b)=>a.i - b.i).forEach(p=>{
      const s = blocos[p.i]; if(!s) return;
      const ant = p.mesmaDe >= 0 && p.mesmaDe < p.i ? blocos[p.mesmaDe] : null;
      s.name = ant ? ant.name : String(p.nome || s.name || '').trim() || s.name;
    });
    return true;
  }catch(e){ return false; }
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
    if(s.repeatOf){ linhas.push('['+lvRotuloComVezes('Repete - '+s.repeatOf.name, s.vezes||1)+']'); return; }
    linhas.push('['+lvRotuloComVezes(s.name||'Parte', s.vezes||1)+']');
    s.lines.forEach(r=>{
      if(r.type==='marca'){ linhas.push(r.text); return; }
      if(r.type==='chords'){ linhas.push(r.chords.map(c=>c.name).join('   ')); return; }
      if(!(r.text||'').trim()){ if(r.chords && r.chords.length) linhas.push(lviLinhaDeAcordes(r.chords)); linhas.push(' '); return; }
      (lviModoFiel ? [r] : lviCorrigirLinha(r)).forEach(c=>{   // maiúsculas, pontos, espaços e verso grande demais
        if((c.chords||[]).length) linhas.push(lviLinhaDeAcordes(c.chords));
        linhas.push(c.text);
      });
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

/* ---------- Importar/Organizar com IA (Google Gemini, plano grátis) ----------
   Com a chave salva em Dados do App, o PDF/foto (ou o texto) vai para a IA, que devolve título, artista, tom e as
   partes com os acordes no formato "[D]Lou[Bm]vai". O app monta no formato do Siloé ([Parte], acordes em cima, --).
   Sem chave, sem internet ou se a IA falhar: volta para a leitura simples de antes. Trocar de modelo: LVI_IA_MODELO. */
const LVI_IA_MODELO = 'gemini-3.8-flash';
const LVI_IA_MODELOS_RESERVA = ['gemini-3.6-flash'];   // grátis também: usado quando o principal está "com muita procura"
const LVI_IA_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
/* modo fiel: arquivo do Drive que já está no formato certo → importa como está (sem corrigir, juntar nem repetir) */
let lviModoFiel = false;
const LVI_IA_FIEL = '\n\nMODO FIEL (vale mais que tudo acima): este arquivo já está do jeito certo, feito pelo próprio usuário. Copie exatamente: os mesmos nomes de partes (com 2x, Repete e o que mais estiver escrito), a mesma ordem, as mesmas quebras de linha, os mesmos acordes no mesmo lugar e o texto como está. Não junte nem separe versos, não crie nem tire Repete, não renomeie partes, não corrija maiúsculas nem pontuação. Só ignore cabeçalho, créditos e rodapé.';
/* regras da IA + as instruções do Davi (Dados do App) + o modo fiel quando for o caso */
function lviRegrasIA(){
  const dele = typeof iaInstrucoes === 'function' ? iaInstrucoes() : '';
  return LVI_IA_REGRAS + (dele ? '\n\nINSTRUÇÕES DO USUÁRIO (valem mais que as regras acima):\n' + dele : '') + (lviModoFiel ? LVI_IA_FIEL : '');
}
function lviChaveIA(){ return String((typeof state!=='undefined' && state && state.iaGoogleChave) || '').trim(); }
const LVI_IA_REGRAS = `Você organiza cifras de louvor (músicas cristãs em português) para um app de igreja.
Leia a cifra recebida e devolva o JSON pedido, seguindo estas regras:

LETRA
- Copie a letra exatamente como está: não invente, não complete, não troque palavras, não traduza.
- Corrija só erros de leitura óbvios: acorde grudado no meio da palavra (ex.: "particiCpar" é a palavra "participar" com o acorde C), letras ou espaços trocados por causa de colunas.
- Um verso = uma linha. Muitos PDFs quebram o verso no meio, logo antes de um acorde. Junte de volta numa linha só, com o acorde no lugar:
  PDF:  "A Preciso fazer muito mais do que" / "E tenho feito"
  Certo: "[A]Preciso fazer muito mais do que [E]tenho feito"
  PDF:  "Bm D Preciso falar desta paz que" / "A trago em meu peito"
  Certo: "[Bm]Preciso [D]falar desta paz que [A]trago em meu peito"
  Uma linha só fica curta quando o verso é curto de verdade (rima, pausa da melodia).

ACORDES (formato ChordPro)
- Cada linha vai com o acorde entre colchetes logo antes da sílaba onde ele é tocado. Ex.: "[D]Louvai a Je[Bm]sus, amoroso".
- Linha só de acordes (intro, solo, passagem, final): só os acordes entre colchetes separados por espaço. Ex.: "[A] [A7] [D] [E]".
- Mantenha os acordes como estão escritos (C#m7, E/G#, A4, Bb...). Não transponha.

PARTES
- Nomes em português, só a primeira letra maiúscula em cada palavra: Intro, Primeira Parte, Segunda Parte, Terceira Parte, Quarta Parte..., Pré-Refrão, Refrão, Ponte, Solo, Final.
- Se o arquivo já nomeia as partes, use esses nomes (ajustando para o padrão acima).
- Se não nomeia: a estrofe que volta igual várias vezes é o Refrão; as estrofes diferentes são Primeira Parte, Segunda Parte, e assim por diante, na ordem.
- Parte cantada mais de uma vez SEGUIDA (o arquivo marca "2x", "(3x)", "x2", ou a mesma letra aparece duas vezes em seguida): escreva a letra uma vez só e ponha o número em "vezes" (2 para 2x). Não crie repetição para isso.
- Quando uma parte volta igual (mesma letra) mais tarde, depois de outra parte: não escreva a letra de novo; crie uma parte com "repete" = nome da parte repetida, "linhas" vazio e "vezes" = quantas vezes ela é cantada nessa volta.
- O nome da parte não leva o "2x": isso vai só em "vezes".

O QUE IGNORAR
- Tudo o que não é letra nem acorde, esteja no topo, no meio ou no fim: cabeçalho (título, artista, "Tom: X"), créditos, compositor, cantor, intérprete, ministério, participação (feat.), versão, gravadora, álbum, arranjo, "composto por", "enviado por", "cifrado por", nome do site, links, @ de redes sociais, número de página, data/hora de impressão, afinação, capotraste, tablatura, "Cifra Club", avisos do site, rodapés.
- Na dúvida se uma linha é letra cantada ou informação sobre a música, só mantenha se ela for cantada.

MANTER SEMPRE
- Intro / Introdução com os acordes dela (é parte da música). Se o arquivo escreve "Introdução", o nome da parte é "Introdução"; se escreve "Intro", é "Intro".

DADOS DA MÚSICA
- titulo: só o nome da música.
- artista: cantor, banda ou ministério. Hino da Harpa Cristã: "Harpa Cristã - <número do hino>" e categoria "Harpa Cristã".
- categoria: "Corinhos" quando são corinhos (vários cânticos curtos juntos ou o arquivo diz Corinhos); senão "Louvor".
- tom: o tom indicado no arquivo (ex.: D, Bb, F#m). Se não houver, deduza pelo primeiro e último acorde.

Se receber uma cifra já em texto com linhas contendo só "-" ou "---", mantenha essas linhas no mesmo lugar dentro das linhas da parte.`;
const LVI_IA_ESQUEMA = {
  type:'object',
  properties:{
    titulo:{ type:'string', description:'Nome da música, sem artista e sem tom' },
    artista:{ type:'string', description:'Cantor, banda ou ministério. Hino da Harpa Cristã: "Harpa Cristã - <número>". Vazio se não houver.' },
    categoria:{ type:'string', enum:['Louvor','Harpa Cristã','Corinhos'] },
    tom:{ type:'string', description:'Tom como escrito no arquivo, ex.: D, Bb, F#m. Vazio se não souber.' },
    secoes:{ type:'array', items:{ type:'object', properties:{
      nome:{ type:'string', description:'Nome da parte, ex.: Primeira Parte, Refrão' },
      repete:{ type:'string', description:'Nome da parte anterior que esta parte só repete. Vazio quando a parte tem letra própria.' },
      vezes:{ type:'integer', description:'Quantas vezes a parte é cantada seguida (2 para 2x). 1 quando é uma vez só.' },
      linhas:{ type:'array', items:{ type:'string' }, description:'Linhas da parte em ChordPro. Vazio quando "repete" está preenchido.' }
    }, required:['nome','repete','vezes','linhas'] } }
  },
  required:['titulo','artista','categoria','tom','secoes']
};
function lviArquivoBase64(file){
  return new Promise((ok, erro)=>{
    const fr = new FileReader();
    fr.onload = ()=> ok(String(fr.result).split(',')[1] || '');
    fr.onerror = ()=> erro(new Error('não consegui ler o arquivo'));
    fr.readAsDataURL(file);
  });
}
function lviTipoImagem(f){
  if(f.type) return f.type;
  const ext = String(f.name||'').split('.').pop().toLowerCase();
  return ({ jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heic:'image/heic', heif:'image/heif' })[ext] || 'image/jpeg';
}
/* texto gerado, nos formatos de resposta que o Google usa */
function lviTextoDaRespostaIA(c){
  if(!c) return '';
  if(typeof c.output_text === 'string') return c.output_text;
  for(const p of (c.steps || c.outputs || [])){
    if(p && Array.isArray(p.content)){ const t = p.content.filter(x=>x && x.type==='text').map(x=>x.text||'').join(''); if(t) return t; }
    if(p && p.type==='text' && p.text) return p.text;
  }
  const cand = c.candidates && c.candidates[0];
  if(cand && cand.content && cand.content.parts) return cand.content.parts.map(x=>x.text||'').join('');
  return '';
}
/* Google "com muita procura" (comum no plano grátis): tenta de novo e depois com o modelo reserva */
/* Google ocupado: insiste por cerca de 1 minuto, alternando o modelo principal e o reserva,
   com a contagem na tela. Só desiste antes se o erro não for passageiro (chave errada etc.). */
const LVI_IA_ESPERAS = [0, 3, 5, 8, 10, 12, 15];   // segundos antes de cada tentativa (~53 s no total)
async function lviPerguntarIA(partes, status, esquema){
  const modelos = [LVI_IA_MODELO, ...LVI_IA_MODELOS_RESERVA];
  let limite = false;
  for(let i = 0; i < LVI_IA_ESPERAS.length; i++){
    for(let s = LVI_IA_ESPERAS[i]; s > 0; s--){
      if(status) status(`Google ocupado — tentando de novo em ${s} s (tentativa ${i+1} de ${LVI_IA_ESPERAS.length})`);
      await new Promise(r=>setTimeout(r, 1000));
    }
    if(i > 0 && status) status(`Tentando de novo (tentativa ${i+1} de ${LVI_IA_ESPERAS.length})…`);
    const modelo = modelos[i % modelos.length];
    if(status && status.modelo) status.modelo(modelo);
    if(status && status.log) status.log(`Perguntando ao ${lviNomeModelo(modelo)}${i ? ' (tentativa ' + (i+1) + ')' : ''}`);
    const t0 = Date.now();
    try{
      const resp = await lviPerguntarIAUmaVez(partes, modelo, esquema);
      if(status && status.log) status.log(`${lviNomeModelo(modelo)} respondeu em ${((Date.now()-t0)/1000).toFixed(1).replace('.',',')} s`, 'ok');
      return resp;
    }
    catch(e){
      if(status && status.log) status.log(`${lviNomeModelo(modelo)}: ${e.limite ? 'limite do plano atingido' : e.passageiro ? 'ocupado agora' : (e.message || 'erro')}`, 'aviso');
      const reserva = modelo !== LVI_IA_MODELO;
      if(!e.passageiro && !reserva) throw e;   // chave errada, resposta estranha...: não adianta insistir
      if(!reserva) limite = limite || !!e.limite;
    }
  }
  throw new Error(limite ? 'limite grátis do Google atingido, tente daqui a pouco' : 'o Google está com muita procura agora, tente daqui a pouco');
}
async function lviPerguntarIAUmaVez(partes, modelo, esquema){
  const chave = lviChaveIA();
  if(!chave) throw new Error('sem chave');
  const ctrl = new AbortController(), t = setTimeout(()=>ctrl.abort(), 120000);
  let res, corpo;
  try{
    res = await fetch(LVI_IA_URL, {
      method:'POST', signal: ctrl.signal,
      headers:{ 'Content-Type':'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ model: modelo, input: partes, response_format:{ type:'text', mime_type:'application/json', schema: esquema || LVI_IA_ESQUEMA } })
    });
    corpo = await res.json().catch(()=>null);
  }catch(e){ throw new Error(e && e.name==='AbortError' ? 'a IA demorou demais' : 'sem conexão com a IA'); }
  finally{ clearTimeout(t); }
  const erro = (Array.isArray(corpo) ? corpo[0] : corpo || {}).error || (corpo && corpo.status==='failed' && (corpo.errors||[])[0]);
  if(!res.ok || erro){
    const msg = String((erro && erro.message) || res.status);
    if(/api.?key/i.test(msg)) throw new Error('a chave do Google não foi aceita (confira em Dados do App)');
    const e = new Error('a IA respondeu com erro: ' + msg.slice(0,90));
    /* 429 = limite do plano grátis (por minuto passa sozinho); 5xx/"high demand" = Google ocupado */
    e.limite = res.status === 429 || /quota|exhaust|rate.?limit/i.test(msg);
    e.passageiro = e.limite || res.status >= 500 || /demand|overload|unavailable|try again|temporar/i.test(msg);
    throw e;
  }
  const texto = lviTextoDaRespostaIA(corpo);
  if(!texto) throw new Error('a IA não devolveu nada');
  try{ return JSON.parse(texto); }catch(e){ throw new Error('a resposta da IA veio incompleta'); }
}
/* "[D]Louvai a Je[Bm]sus" → { type:'lyric', text, chords:[{name, idx}] } (idx = coluna da sílaba) */
function lviLinhaChordPro(s){
  s = String(s||'').replace(/\s+$/,'');
  if(/^-{1,3}$/.test(s.trim())) return { type:'marca', text: s.trim() };   // "-" e "---" do usuário
  let texto = '', ult = 0, m;
  const chords = [], re = /\[([^\]]+)\]/g;
  while((m = re.exec(s))){ texto += s.slice(ult, m.index); chords.push({ name: m[1].trim(), idx: texto.length }); ult = re.lastIndex; }
  texto += s.slice(ult);
  if(!texto.trim()) return chords.length ? { type:'chords', chords: chords.map(c=>({ name:c.name })) } : { type:'lyric', text:'', chords:[] };
  return { type:'lyric', text: texto, chords };
}
/* A IA acerta as partes, mas chuta a posição dos acordes. Num PDF com texto, a leitura simples sabe a posição exata
   (pela coordenada de cada acorde em cima da letra). Para cada verso da IA, procura o mesmo verso (ou ele quebrado
   em duas linhas) na leitura simples e, se os acordes forem os mesmos, usa as posições de lá. */
const lviEhLetra = ch => /[a-z0-9à-ü]/.test(ch.toLowerCase());
function lviSoLetras(s){ return Array.from(String(s||'')).filter(lviEhLetra).join('').toLowerCase(); }
function lviLetrasAntes(texto, p){ let n = 0; for(let i = 0; i < Math.min(p, texto.length); i++) if(lviEhLetra(texto[i])) n++; return n; }
function lviPosDaLetra(texto, k){ let n = 0; for(let i = 0; i < texto.length; i++){ if(lviEhLetra(texto[i])){ if(n === k) return i; n++; } } return -1; }
function lviMesmoAcorde(a, b){ return String(a).replace(/\s/g,'').toLowerCase() === String(b).replace(/\s/g,'').toLowerCase(); }
function lviCorrigirAcordesPeloPdf(linhas, simples){
  if(!simples || !simples.length) return 0;
  let corrigidas = 0, inicio = 0;
  linhas.forEach(r=>{
    if(r.type !== 'lyric' || !r.chords || !r.chords.length) return;
    const alvo = lviSoLetras(r.text);
    if(alvo.length < 4) return;
    for(let k = 0; k < simples.length; k++){
      const i = (inicio + k) % simples.length;
      const grupo = [simples[i]];
      if(lviSoLetras(simples[i].text) !== alvo){
        if(i + 1 < simples.length && lviSoLetras(simples[i].text + simples[i+1].text) === alvo) grupo.push(simples[i+1]);
        else continue;
      }
      /* posição de cada acorde do PDF = mesma letra no verso da IA */
      let base = 0; const novos = [];
      grupo.forEach(s=>{
        const fim = s.text.replace(/\s+$/,'').length;
        (s.chords || []).forEach(c=>{
          let pos;
          if(c.idx >= fim){ pos = r.text.replace(/\s+$/,'').length + (c.idx - fim); if(grupo.length > 1 && s === grupo[0]) pos = lviPosDaLetra(r.text, base + lviLetrasAntes(s.text, fim)); }
          else { const p = lviPosDaLetra(r.text, base + lviLetrasAntes(s.text, c.idx)); pos = p < 0 ? r.text.length : p; }
          novos.push({ name: c.name, idx: Math.max(0, pos) });
        });
        base += lviLetrasAntes(s.text, s.text.length);
      });
      if(novos.length === r.chords.length && novos.every((c, x)=>lviMesmoAcorde(c.name, r.chords[x].name))){
        r.chords = novos.map((c, x)=>({ name: r.chords[x].name, idx: c.idx }));
        r.conferido = true;
        corrigidas++; inicio = i + grupo.length;
      }
      break;
    }
  });
  return corrigidas;
}
/* JSON da IA → mesmo formato de resultado do lviImportar */
function lviMontarDaIA(j, fi, simples){
  let secoes = (j && j.secoes || []).map(s=>{
    const rep = String(s.repete||'').trim();
    const v = Math.max(1, Number(s.vezes)||1);
    if(rep){ const r = lvVezesDoRotulo(rep); return { repeatOf:{ name: r.nome }, vezes: Math.max(v, r.vezes), lines:[] }; }
    const lines = (s.linhas||[]).filter(x=>String(x).trim() !== '--' && !(!/\[/.test(x) && lviEhInfoNaoLetra(x))).map(lviLinhaChordPro);   // crédito que a IA deixou passar
    lviCorrigirAcordesPeloPdf(lines, simples);
    while(lines.length && lines[lines.length-1].type==='lyric' && !lines[lines.length-1].text.trim()) lines.pop();   // linhas vazias no fim da parte
    const nm = lvVezesDoRotulo(String(s.nome||'Parte'));
    return { name: nm.nome || 'Parte', vezes: Math.max(v, nm.vezes), lines };
  });
  if(!lviModoFiel) lviJuntarSeguidas(secoes);
  secoes = secoes.filter(s=>s.repeatOf || s.lines.some(r=>r.type!=='lyric' || r.text.trim()));
  if(!secoes.some(s=>!s.repeatOf)) throw new Error('a IA não encontrou a letra');
  const km = /^([A-G][#b]?)(m?)/.exec(String(j.tom||'').trim());
  const raiz = (fi && fi.tom) || (km && km[1]) || null;
  const menor = fi && fi.tom ? fi.menor : !!(km && km[2]);
  const cat = ['Louvor','Harpa Cristã','Corinhos'].includes(j.categoria) ? j.categoria : '';
  const titulo = String(j.titulo||'').trim() || (fi && fi.titulo) || '';
  const artista = String(j.artista||'').trim() || (fi && fi.artista) || '';
  const conferencia = typeof lviConferenciaIA==='function' ? lviConferenciaIA(secoes, simples) : null;
  if(conferencia){   // título/artista do cabeçalho do PDF não são letra que "ficou de fora"
    const cab = [titulo, artista].map(lviSoLetras).filter(Boolean);
    conferencia.faltando = conferencia.faltando.filter(t=>{ const k = lviSoLetras(t); return !cab.some(c=>k.includes(c) || c.includes(k)); });
  }
  return {
    titulo,
    artista,
    categoria: cat,
    tom: lviTomSiloe(raiz, menor),
    conteudo: lviBlocosParaTexto(cat === 'Harpa Cristã' || lviEhHarpa(artista) ? lviPadraoHarpa(secoes) : secoes),
    blocos: secoes.length,
    usouIA: true,
    conferencia
  };
}
async function lviImportarComIA(file, status){
  status('Abrindo o arquivo', 'ler');
  const b64 = await lviArquivoBase64(file);
  status('Lendo letra e acordes com IA', 'ia');
  status('leva alguns segundos…');
  /* em paralelo: a leitura simples do PDF, só para pegar a posição exata dos acordes */
  const simplesP = lviEhImagem(file) ? Promise.resolve(null) : lviImportarSimples(file, ()=>{}).catch(()=>null);
  if(status.log && !lviEhImagem(file)) status.log('Lendo o PDF direto também, para pegar a posição exata de cada acorde');
  const arquivo = lviEhImagem(file)
    ? { type:'image', data: b64, mime_type: lviTipoImagem(file) }
    : { type:'document', data: b64, mime_type: 'application/pdf' };
  const j = await lviPerguntarIA([ arquivo, { type:'text', text: lviRegrasIA() + '\n\nNome do arquivo: ' + (file.name||'') } ], status);
  status('Separando as partes (estrofes, refrão…)', 'partes');
  const simples = await simplesP;
  const linhasPdf = simples ? lviTextoParaLinhas(simples.conteudo).filter(r=>r.type==='lyric') : null;
  if(status.log && linhasPdf) status.log(`Leitura direta do PDF: ${linhasPdf.length} linhas de letra`);
  status(linhasPdf ? 'Conferindo cada acorde com o PDF' : 'Conferindo a letra', 'conferir');
  return lviMontarDaIA(j, lviNomeDoArquivo(file.name||''), linhasPdf);
}

/* ---------- importar: arquivo → { titulo, artista, tom, conteudo } ---------- */
async function lviImportar(file, status){
  /* com a chave da IA: tenta primeiro pela IA; se falhar, segue para a leitura simples (e avisa o motivo) */
  let avisoIA = '';
  if(lviChaveIA()){
    if(status.log) status.log('IA ligada: a cifra vai ser lida pelo Google Gemini');
    try{ return await lviImportarComIA(file, status); }
    catch(e){ avisoIA = (e && e.message) || 'erro'; (status.aviso || status)('IA indisponível (' + avisoIA + ') — usando a leitura simples'); }
  }
  if(status.modelo) status.modelo(null);
  const r = await lviImportarSimples(file, status);
  r.avisoIA = avisoIA;
  return r;
}
async function lviImportarSimples(file, status){
  let rows = [];
  if(!lviEhImagem(file)){
    status('Lendo o PDF', 'ler');
    const cl = await lviClustersDoPdf(file);
    rows = lviLinhasDosClusters(cl, false);
  }
  let usouOcr = false;
  if(!rows.filter(r=>r.type==='lyric' || r.type==='chords').length){
    usouOcr = true;
    status('Lendo a imagem', 'ocr');
    const cl = await lviClustersDoOcr(file, status);
    rows = lviLinhasDosClusters(cl, true);
  }
  if(!rows.length) throw new Error('não encontrei texto nesse arquivo');
  status('Separando as partes (estrofes, refrão…)', 'partes');
  const doc = lviMontaBlocos(rows);
  const fi = lviNomeDoArquivo(file.name);
  const raiz = (fi && fi.tom) || doc.tom;
  const menor = fi && fi.tom ? fi.menor : doc.menor;
  /* título/artista: o cabeçalho do PDF (quando tem) é mais confiável que o nome do arquivo */
  status('Conferindo a letra e os acordes', 'conferir');
  const harpaArq = lviEhHarpa([doc.artista, doc.titulo, fi && fi.artista, file.name].join(' '));
  if(harpaArq) lviPadraoHarpa(doc.secoes);
  const conteudo = lviBlocosParaTexto(doc.secoes);
  return {
    titulo: (doc.temCabecalho && doc.titulo) || (fi && fi.titulo) || doc.titulo || '',
    artista: (doc.temCabecalho && doc.artista) || (fi && fi.artista) || doc.artista || '',
    tom: lviTomSiloe(raiz, menor),
    conteudo,
    blocos: doc.secoes.length,
    usouOcr,
    ...(harpaArq ? { categoria:'Harpa Cristã' } : {}),
    conferencia: typeof lviConferenciaSimples==='function' ? lviConferenciaSimples(conteudo, usouOcr) : null
  };
}

/* no cadastro de um louvor novo */
async function lvImportarNoNovo(ev){
  const file = ev.target.files[0]; ev.target.value = '';
  if(!file) return;
  window.lviUltimo = { file, onde: 'novo' };
  const prog = lviProgresso('lvNovoImportStatus');
  prog.arquivo(file);
  document.getElementById('pageLouvorForm')?.classList.add('importando');
  try{
    const r = await lviImportar(file, prog);
    if(r.titulo) document.getElementById('lvNovoTitulo').value = r.titulo;
    if(r.artista) document.getElementById('lvNovoArtista').value = r.artista;
    if(r.tom.tomOriginal){ window.lvNovoTomOriginal = r.tom.tomOriginal; window.lvNovoTomModoMenor = r.tom.tomModoMenor; atualizarLvNovoTomBox(); }
    if(r.categoria){ window.lvNovoCategoriaSelecionada = r.categoria; renderLvNovoCategoriaChips(); }
    window.lvNovoConteudo = lvQuebrarSlides(r.conteudo);
    window.lvNovoRevisar = lviCorrigirTextos((r.conferencia && r.conferencia.olhar) || []);
    lviLogResultado(prog, r);
    prog.fim(lviRelatorioHtml(r, 'Confira os dados abaixo e toque em <b>Criar e abrir</b>.'));
    const form = document.querySelector('#pageLouvorForm .lvn-form');
    if(form){ form.classList.remove('preenchido'); void form.offsetWidth; form.classList.add('preenchido'); }
    const dica = document.getElementById('lvnFormDica'); if(dica) dica.textContent = '✓ preenchido pela importação — confira';
  }catch(e){
    prog.erro('Não consegui ler: '+(e && e.message ? e.message : e)+'. Você pode colar a cifra como texto depois.');
  }
  document.getElementById('pageLouvorForm')?.classList.remove('importando');
}
/* dentro de um louvor já existente (substitui o texto) */
async function lvImportarNoAtual(ev){
  const file = ev.target.files[0]; ev.target.value = '';
  const l = getLouvorAtual(); if(!file || !l) return;
  if(!ev.semConfirmar && (l.conteudo||'').trim() && !(await iosConfirm('Substituir a cifra atual pelo conteúdo do arquivo?'))) return;
  window.lviUltimo = { file, onde: 'atual' };
  const prog = lviProgresso('lvEdicaoImportStatus');
  prog.arquivo(file);
  lviModoFiel = !!ev.fiel;   // do Drive: o arquivo já está certo, importa como está
  if(lviModoFiel && prog.log) prog.log('Modo fiel: arquivo do Drive, importado do jeito que está (sem reorganizar)');
  try{
    const r = await lviImportar(file, prog);
    l.conteudo = lvQuebrarSlides(r.conteudo);
    delete l.conteudoAntesOrganizar; delete l.conteudoOrganizado;   // texto novo: o desfazer anterior não vale mais
    if(!(l.titulo||'').trim() && r.titulo) l.titulo = r.titulo;
    if(!(l.artista||'').trim() && r.artista) l.artista = r.artista;
    if(r.tom.tomOriginal){ l.tomOriginal = r.tom.tomOriginal; l.tomModoMenor = r.tom.tomModoMenor; l.transpose = 0; }
    if(ev.novo && r.categoria) l.categoria = r.categoria;
    const olhar = lviModoFiel ? ((r.conferencia && r.conferencia.olhar) || []) : lviCorrigirTextos((r.conferencia && r.conferencia.olhar) || []);
    if(olhar.length) l.revisar = olhar; else delete l.revisar;
    /* o original fica guardado para comparar (o arquivo no aparelho; de onde veio, nos dados) */
    l.origem = Object.assign({ tipo: 'arquivo', nome: file.name }, ev.origem || {}, { quando: Date.now() });
    lvOriginalGuardar(l.id, file);
    persist();
    abrirLouvorDetalhe(l.id);
    lviLogResultado(prog, r);
    prog.fim(lviRelatorioHtml(r, '<button type="button" class="lvi-rel-ok" onclick="lvCompararAbrir()">Comparar com o original</button><button type="button" class="lvi-rel-ok" onclick="lviFecharRelatorio()">Ok</button>'));
  }catch(e){
    prog.erro('Não consegui ler: '+(e && e.message ? e.message : e)+(ev.novo ? '. A música ficou criada: cole a cifra ou importe de novo.' : ''));
  }finally{ lviModoFiel = false; }
}
function lviFecharRelatorio(){ const l = getLouvorAtual(); const el = document.getElementById('lvEdicaoImportStatus'); if(el) el.innerHTML = ''; if(l) lvMostrarRevisar(l); }

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
      if(!(it.chordLine||'').trim() && lviVezesSozinho(it.lyricLine) > 1){ rows.push({ type:'vezes', n: lviVezesSozinho(it.lyricLine) }); return; }
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
  const comIA = !!lviChaveIA();
  const ok = await iosConfirm(comIA
    ? 'Organizar com IA? Ela dá nome às partes (Primeira Parte, Refrão...), junta os acordes à sílaba certa, troca o que se repete por "Repete" e tira créditos e rodapés. A letra não muda. Dá para desfazer tocando de novo.'
    : 'Organizar em blocos? Os trechos sem nome ganham nome (Intro, Primeira parte...), os blocos iguais viram "Repete", entre os blocos entra a linha divisória (--) e créditos (composição, site...) saem. Os "-" e "---" ficam. Dá para desfazer tocando de novo.');
  if(!ok) return;
  const antes = l.conteudo;
  let novo = null, blocos = 0, reps = 0, aviso = '';
  if(comIA){
    const btn = document.getElementById('lvBtnOrganizar'); btn?.classList.add('carregando');
    showToast('Organizando com IA…');
    try{
      const j = await lviPerguntarIA([{ type:'text', text: lviRegrasIA() + '\n\nA cifra abaixo já está em texto (acordes na linha de cima da letra; partes entre colchetes). Organize:\n\n' + antes }]);
      const r = lviMontarDaIA(j, null);
      novo = r.conteudo; blocos = r.blocos; reps = (novo.match(/^\[Repete/gm) || []).length;
    }catch(e){ aviso = (e && e.message) || 'erro'; }
    btn?.classList.remove('carregando');
    if(getLouvorAtual() !== l || l.conteudo !== antes) return;   // saiu da música ou mexeu no texto enquanto a IA trabalhava
  }
  if(novo === null){
    const doc = lviMontaBlocos(lviTextoParaLinhas(antes));
    novo = lviBlocosParaTexto(doc.secoes);
    blocos = doc.secoes.length; reps = doc.secoes.filter(s=>s.repeatOf).length;
  }
  l.conteudo = lvQuebrarSlides(novo);
  l.conteudoAntesOrganizar = antes; l.conteudoOrganizado = l.conteudo;
  persist();
  document.getElementById('lvConteudo').value = l.conteudo;
  lvAtualizarEditor(); lvAtualizarBtnOrganizar();
  showToast(aviso
    ? `IA indisponível (${aviso}) — organizado pelo modo simples`
    : `${comIA?'Organizado com IA · ':''}${blocos} blocos${reps?` · ${reps} "Repete"`:''}`);
}

/* ---------- edição direto na folha (aba Visualizar) ----------
   Edição e Visualizar viraram a aba Música: a folha fica editável (toque numa palavra, acorde, nome de parte, título). */
window.lvEditandoFolha = true;   // a folha da aba Música é editável (desliga na tela cheia e na impressão)
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
    const nomeAntigo = lvVezesDoRotulo(antigo).nome.toLowerCase(), nomeNovo = lvVezesDoRotulo(novo).nome;
    linhas = linhas.map(x=>{ const m = /^\s*\[\s*repete\s*[-–:]?\s*(.+)\]\s*$/i.exec(x); if(!m) return x; const r = lvVezesDoRotulo(m[1]); return r.nome.toLowerCase()===nomeAntigo ? '['+lvRotuloComVezes('Repete - '+nomeNovo, r.vezes)+']' : x; });
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

/* ---------- Cifra Club dentro do app: cola o link ou busca pelo nome → a cifra entra sozinha ----------
   Quem lê o Cifra Club é a função "cifra" do Supabase (o site não deixa o navegador ler direto).
   O texto vem com [Partes] e acordes em cima da letra: passa pelo Organizar simples + "-" dos slides. */
let ccResultados = [];
function ccAbrir(termo){
  if(typeof lvFabMenu === 'function') lvFabMenu(false);
  const inp = document.getElementById('ccBusca');
  inp.value = String(termo || '').trim();
  document.getElementById('ccLista').innerHTML = '';
  document.getElementById('modalCifraClub').classList.add('active');
  if(inp.value) ccBuscar(); else setTimeout(()=>inp.focus(), 80);
}
async function ccChamar(corpo){
  const sb = window.SiloSupabase && window.SiloSupabase.client;
  if(!sb) throw new Error('sem conexão');
  const { data, error } = await sb.functions.invoke('cifra', { body: corpo });
  if(error){
    const st = error.context && error.context.status;
    if(st === 404 || /Failed to send/i.test(error.message || '')) throw new Error('Não consegui falar com a função "cifra" do Supabase — ela já foi criada? (ou está sem internet)');
    let msg = error.message; try{ const j = await error.context.json(); if(j && j.erro) msg = j.erro; }catch(e){}
    throw new Error(msg);
  }
  if(data && data.erro) throw new Error(data.erro);
  return data;
}
/* busca sozinha enquanto digita (espera parar de digitar); o ✓/Enter do teclado busca na hora e fecha o teclado */
let ccDigitando = 0, ccBuscaN = 0;
function ccBuscarAoDigitar(){
  clearTimeout(ccDigitando);
  const t = document.getElementById('ccBusca').value.trim();
  if(t.length < 3 || /^https?:\/\//i.test(t)) return;
  ccDigitando = setTimeout(ccBuscar, 650);
}
async function ccBuscar(){
  clearTimeout(ccDigitando);
  const termo = document.getElementById('ccBusca').value.trim(), el = document.getElementById('ccLista');
  if(!termo) return;
  if(/^https?:\/\//i.test(termo)){ ccImportar(termo); return; }
  const n = ++ccBuscaN;   // só a última busca aparece (as respostas podem chegar fora de ordem)
  el.innerHTML = '<div class="voz-carregando">Buscando no Cifra Club…</div>';
  try{
    const lista = (await ccChamar({ busca: termo })).musicas || [];
    if(n !== ccBuscaN) return;
    ccResultados = lista;
    el.innerHTML = ccResultados.length ? ccResultados.map((m, i)=>`
      <button type="button" class="cu-escolher-item" onclick="ccImportar(ccResultados[${i}].url)">
        <span class="cu-escolher-nome">${lvEsc(m.titulo)}<small>${lvEsc(m.artista)}</small></span>
        <span class="cu-escolher-tom">${ICO(ICO_D.baixar, 18)}</span>
      </button>`).join('') : '<div class="gm-vazio">Nada encontrado no Cifra Club.</div>';
  }catch(e){ if(n === ccBuscaN) el.innerHTML = `<div class="drive-linha erro">${lvEsc(e.message)}</div>`; }
}
/* Cifra Club → cria a música direto (sem a tela Nova música) e abre ela.
   Se a música estiver no Letras, a letra de lá é a base (ordem das partes, frases, partes que faltam)
   e os acordes do Cifra Club são encaixados palavra por palavra. */
async function ccImportar(url){
  const el = document.getElementById('ccLista');
  /* cada passo aparece na tela (Cifra Club, Letras, junção) e o resumo fica na música depois */
  const passos = [];
  const passo = (txt, tipo)=>{ passos.push({ txt, tipo: tipo || '' }); el.innerHTML = passos.map(p=>`<div class="drive-linha ${p.tipo}">${lvEsc(p.txt)}</div>`).join(''); };
  try{
    const r = await ccMontar(url, passo, ()=>passos.pop());
    closeModal('modalCifraClub');
    const l = lvCriarDireto(r.dados);
    ccGuardarOrigem(l, r, url);
    lvAtualizarBtnComparar(l);
    const st = document.getElementById('lvEdicaoImportStatus');
    if(st){
      st.classList.remove('erro');
      st.innerHTML = `<div class="cc-passos">${passos.map(p=>`<div class="drive-linha ${p.tipo}">${lvEsc(p.txt)}</div>`).join('')}
        <div class="cc-passos-acoes"><button type="button" class="lvi-rel-ok" onclick="lvCompararAbrir()">Comparar com o original</button><button type="button" class="lvi-rel-ok" onclick="lviFecharRelatorio()">Ok</button></div></div>`;
    }
    showToast(r.comLetras ? '✓ Criada · letra do Letras + acordes do Cifra Club' : '✓ Criada pelo Cifra Club');
  }catch(e){ passo(e.message, 'erro'); }
}
/* o original (texto do Cifra Club e a letra do Letras) fica guardado para comparar */
function ccGuardarOrigem(l, r, url){
  const textos = new Set((l.conteudo || '').split('\n').map(x=>x.trim()));
  l.revisar = lviCorrigirTextos(r.revisar).filter(t=>textos.has(t));
  if(!l.revisar.length) delete l.revisar;
  l.origem = { tipo:'cifraclub', url, texto: r.c.texto, letras: r.lt.achou ? { url: r.lt.url, titulo: r.lt.titulo, estrofes: r.lt.estrofes } : null, quando: Date.now() };
  persist();
}
/* lê a cifra (Cifra Club + Letras) e devolve os dados da música, sem criar nada.
   passo(texto, tipo) mostra o andamento; tirar() apaga a última linha de "carregando" */
async function ccMontar(url, passo, tirar){
  passo = passo || (()=>{}); tirar = tirar || (()=>{});
  passo('Lendo a cifra no Cifra Club…');
  {
    const c = await ccChamar({ url });
    if(!c || !(c.texto||'').trim()) throw new Error('a página não tem cifra');
    /* hino da Harpa: o Cifra Club põe o número no lugar do cantor → "Harpa Cristã - 525" */
    if(/harpa-crista/i.test(url) && !/harpa/i.test(c.artista || '')){
      const num = (/(\d+)/.exec(c.artista || '') || /\/(\d+)-/.exec(url) || [])[1];
      c.artista = 'Harpa Cristã' + (num ? ' - ' + num : '');
    }
    tirar(); passo(`✓ Cifra Club: "${c.titulo}" · ${c.artista}${c.tom ? ' · tom ' + c.tom : ''}`, 'ok');
    /* "[Intro] F#m  E5" → "[Intro]" + linha de acordes; tablaturas (E|---3---|) e "Parte 1 de 4" saem */
    let texto = c.texto.split('\n').flatMap(l=>{
      if(/^\s*[eEBGDAb]\|[-\d|hpbrvx\/\~().\s]*$/.test(l) || /^\s*Parte \d+ de \d+\s*$/i.test(l)) return [];
      const m = /^\s*(\[[^\]]+\])\s+(\S.*)$/.exec(l);
      return m ? [m[1], m[2]] : [l];
    }).join('\n').replace(/\n{3,}/g, '\n\n');
    passo('Buscando a letra no Letras…');
    let revisar = [], comLetras = false;
    const lt = await lviLetrasDe(c.titulo, c.artista);
    tirar();
    if(lt.achou){
      passo(`✓ Letras: "${lt.titulo}" · ${lt.artista} · ${lt.estrofes.length} estrofes`, 'ok');
      const j = lviJuntarComLetras(texto, lt.estrofes);
      /* a cifra é obrigatória: se a letra do Letras perdeu os acordes, fica só o Cifra Club */
      const acordes = t=>t.split('\n').filter(x=>x.trim() && isChordLine(x.trim())).length;
      if(j && acordes(j.texto) < acordes(texto) * .6){ passo('A letra do Letras perdia os acordes: fiquei com a cifra do Cifra Club', 'erro'); }
      else if(j){
        texto = j.texto; revisar = j.revisar; comLetras = true;
        const versos = lt.estrofes.reduce((s, e)=>s + e.length, 0);
        passo(`✓ Letra do Letras com os acordes do Cifra Club · ${versos - j.revisar.length} de ${versos} versos batidos${j.revisar.length ? ' · ' + j.revisar.length + ' para conferir (amarelo)' : ''}`, 'ok');
      } else passo('A letra do Letras é diferente da cifra (outra versão): fiquei só com o Cifra Club', 'erro');
    } else passo('Letras: ' + lt.motivo + ' — fiquei só com o Cifra Club', 'erro');
    const doc = lviMontaBlocos(lviTextoParaLinhas(texto));
    const harpa = lviEhHarpa(c.artista + ' ' + c.titulo);
    if(harpa){ lviPadraoHarpa(doc.secoes); passo('✓ Hino da Harpa: Refrão depois de cada parte', 'ok'); }
    else if(lviChaveIA()){
      passo('A IA está dando nome às partes (Primeira Parte, Pré-Refrão, Refrão, Ponte…)');
      const ok = await lviNomearPartesIA(doc.secoes, c.titulo, c.artista, ()=>{});
      tirar();
      passo(ok ? '✓ Partes nomeadas pela IA' : 'A IA não respondeu: ficaram os nomes da leitura simples', ok ? 'ok' : 'erro');
    }
    const conteudo = lvQuebrarSlides(lviBlocosParaTexto(doc.secoes));
    passo(`✓ ${doc.secoes.filter(s=>!s.repeatOf).length} partes · texto arrumado (maiúsculas, pontos, versos)`, 'ok');
    const m = /^([A-G](?:#|b)?)(m?)$/.exec(c.tom || '');
    const tom = m ? lviTomSiloe(m[1], !!m[2]) : null;
    return { c, lt, revisar, comLetras, dados: {
      titulo: c.titulo || '', artista: c.artista || '', categoria: harpa ? 'Harpa Cristã' : 'Louvor',
      tomOriginal: tom ? tom.tomOriginal : '', tomModoMenor: tom ? tom.tomModoMenor : false,
      conteudo
    } };
  }
}
/* cria a música já com os dados e abre a tela dela (Cifra Club e Drive); abrir:false = só cria (roteiro colado do WhatsApp) */
function lvCriarDireto(d, abrir){
  const novo = {
    id: 'lv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    titulo: d.titulo || '', artista: d.artista || '', categoria: d.categoria || 'Louvor',
    tom: '', tomOriginal: d.tomOriginal || '', tomModoMenor: !!d.tomModoMenor, transpose: 0,
    dataAgendamento: '', status: 'producao', colunas: 'auto', conteudo: d.conteudo || '', criadoEm: Date.now()
  };
  state.louvores.push(novo);
  persist();
  renderLouvor();
  if(abrir !== false) abrirLouvorDetalhe(novo.id);
  return novo;
}

/* ---------- Letras: busca pela função "cifra" do Supabase ---------- */
/* → { achou:true, titulo, artista, url, estrofes } ou { achou:false, motivo } (o motivo aparece nos passos da importação) */
async function lviLetrasDe(titulo, artista){
  if(!(titulo||'').trim()) return { achou:false, motivo:'música sem título' };
  /* a busca do Letras não acha nada com "-" no texto: limpa; se não achar com o cantor, tenta só pelo título */
  const limpa = s=>String(s||'').replace(/[-–—|()]/g, ' ').replace(/\s+/g, ' ').trim();
  for(const art of [limpa(artista), '']){
    try{
      const r = await Promise.race([ ccChamar({ letras:{ titulo: limpa(titulo), artista: art } }), new Promise(ok=>setTimeout(()=>ok('demorou'), 15000)) ]);
      if(r === 'demorou') return { achou:false, motivo:'o Letras demorou demais para responder' };
      if(r && r.achou && Array.isArray(r.estrofes) && r.estrofes.length) return r;
    }catch(e){ return { achou:false, motivo:'não consegui acessar (' + ((e && e.message) || 'erro') + ')' }; }
    if(!art) break;
  }
  return { achou:false, motivo:'essa música não está no Letras' };
}
const lviNormPalavra = w=>String(w||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
/* maior sequência de palavras em comum (na ordem) entre a linha do Letras e um trecho da cifra → pares [i, k] */
function lviLcsPares(a, b){
  const n = a.length, m = b.length, t = Array.from({ length:n+1 }, ()=>new Array(m+1).fill(0));
  for(let i = n-1; i >= 0; i--) for(let k = m-1; k >= 0; k--) t[i][k] = a[i] && a[i] === b[k] ? t[i+1][k+1] + 1 : Math.max(t[i+1][k], t[i][k+1]);
  const pares = []; let i = 0, k = 0;
  while(i < n && k < m){
    if(a[i] && a[i] === b[k]){ pares.push([i, k]); i++; k++; }
    else if(t[i+1][k] >= t[i][k+1]) i++; else k++;
  }
  return pares;
}
/* texto da cifra (formato do Siloé) + estrofes do Letras → { texto, revisar } ou null se não for a mesma música */
function lviJuntarComLetras(textoCifra, estrofes){
  const rows = lviTextoParaLinhas(textoCifra);
  const W = [], soAcordes = [];   // W: palavras da cifra com os acordes; soAcordes: linhas só de acordes (intro, solo, final)
  let rotulo = '', linhaN = 0;
  const ehSolo = t=>/^(intro|introdu|solo|instrumental|interl|final|ponte|passagem)/i.test(t || '');
  rows.forEach(r=>{
    if(r.type === 'label'){ rotulo = lvVezesDoRotulo(r.text).nome; return; }
    if(r.type === 'chords'){
      if(!r.chords.length) return;
      const rot = ehSolo(rotulo) ? rotulo : '', ant = soAcordes[soAcordes.length - 1];
      if(ant && ant.pos === W.length && ant.rotulo === rot) ant.linhas.push(r.chords);   // solo de várias linhas = um bloco só
      else soAcordes.push({ pos: W.length, rotulo: rot, linhas: [r.chords] });
      return;
    }
    if(r.type !== 'lyric' || !(r.text||'').trim()) return;
    const pal = []; const re = /\S+/g; let m;
    while((m = re.exec(r.text))) pal.push({ n: lviNormPalavra(m[0]), ini: m.index, fim: m.index + m[0].length, chords: [], rotulo, linha: linhaN });
    if(!pal.length) return;
    linhaN++;
    (r.chords||[]).forEach(c=>{
      const w = pal.find(p=>c.idx >= p.ini && c.idx < p.fim) || pal.find(p=>p.ini >= c.idx) || pal[pal.length-1];
      w.chords.push({ name: c.name, off: Math.max(0, c.idx - w.ini) });
    });
    pal.forEach(p=>W.push(p));
  });
  if(!W.length) return null;
  const Wn = W.map(w=>w.n);
  let ptr = 0, total = 0, achadas = 0;
  const revisar = [], fimDaEstrofe = [], refraoVotos = [];   // estrofe que na cifra estava em [Refrão]/[Coro]
  const saida = estrofes.map((est, e)=>est.map(linha=>{
    const pal = []; const re = /\S+/g; let m;
    while((m = re.exec(linha))) pal.push({ n: lviNormPalavra(m[0]), ini: m.index, fim: m.index + m[0].length });
    const ln = pal.map(p=>p.n);
    total += ln.length;
    /* onde essa linha está na cifra: testa os começos possíveis e fica com o que mais bate (prefere seguir em frente) */
    let melhor = null;
    for(let j = 0; j < Wn.length; j++){
      if(Wn[j] !== ln[0] && Wn[j] !== ln[1]) continue;
      const pares = lviLcsPares(ln, Wn.slice(j, j < ptr ? Math.min(j + ln.length * 2 + 2, ptr) : j + ln.length * 2 + 2));   // voltando (refrão repetido): não invade o que vem depois
      const nota = pares.length - (j < ptr ? 0.5 : 0) - Math.abs(j - ptr) / 100000;
      if(!melhor || nota > melhor.nota) melhor = { j, pares, nota };
    }
    const chords = [];
    if(melhor && melhor.pares.length >= Math.max(1, ln.length * 0.5)){
      achadas += melhor.pares.length;
      let ult = -1;
      const naPalavra = (i, c)=>chords.push({ name: c.name, idx: pal[i].ini + Math.min(c.off, Math.max(0, pal[i].fim - pal[i].ini - 1)) });
      melhor.pares.forEach(([i, k])=>{
        const w = W[melhor.j + k]; ult = melhor.j + k; w.usada = true;
        refraoVotos[e] = (refraoVotos[e] || 0) + (/^(refr|coro)/i.test(w.rotulo || '') ? 1 : -1);
        w.chords.forEach(c=>naPalavra(i, c));
      });
      /* acorde numa palavra da cifra que não bateu (escrita diferente: "pra"/"para", "Tô"/"Estou"): vai para a palavra
         do Letras que está no mesmo lugar entre as que bateram — nenhum acorde se perde */
      const P = melhor.pares, k0 = Math.max(0, P[0][1] - P[0][0]), k9 = P[P.length-1][1] + (ln.length - 1 - P[P.length-1][0]);
      for(let k = k0; k <= k9 && melhor.j + k < W.length; k++){
        const w = W[melhor.j + k];
        if(w.usada || !w.chords.length || melhor.j + k < ptr) continue;
        const ant = [...P].reverse().find(p=>p[1] < k), dep = P.find(p=>p[1] > k);
        let i = ant && dep ? ant[0] + Math.round((k - ant[1]) * (dep[0] - ant[0]) / (dep[1] - ant[1])) : ant ? ant[0] + (k - ant[1]) : dep[0] - (dep[1] - k);
        i = Math.max(0, Math.min(pal.length - 1, i));
        w.usada = true; ult = Math.max(ult, melhor.j + k);
        w.chords.forEach(c=>naPalavra(i, c));
      }
      ptr = ult + 1;
      fimDaEstrofe[e] = Math.max(fimDaEstrofe[e] ?? -1, ult);
      /* o verso fica escrito como no Letras (uma linha só), mesmo que no Cifra Club esteja quebrado em duas */
      chords.sort((a, b)=>a.idx - b.idx);
      if(melhor.pares.length < ln.length * 0.8) revisar.push(linha.trim());
      return [{ text: linha.trim(), chords: chords.map(c=>({ name: c.name, idx: Math.max(0, c.idx - (linha.length - linha.trimStart().length)) })) }];
    }
    revisar.push(linha.trim());
    return [{ text: linha, chords }];
  }).flat());
  if(!total || achadas / total < 0.55) return null;   // letra diferente demais: não é a mesma música (ou é outra versão)
  /* monta o texto: intro → estrofes (com solo/instrumental onde estavam na cifra) → final */
  const linhaTxt = r=>(r.chords.length ? [lviLinhaDeAcordes(r.chords)] : []).concat([r.text]);
  const acordesTxt = s=>s.linhas.map(ch=>ch.map(c=>c.name).join('   ')).join('\n');
  const out = [];
  let ultimoRot = null;
  soAcordes.filter(s=>s.pos === 0).forEach(s=>{
    if(s.rotulo !== ultimoRot) out.push('[' + (s.rotulo || 'Intro') + ']');
    ultimoRot = s.rotulo; out.push(acordesTxt(s));
  });
  if(out.length) out.push('--');
  const meio = soAcordes.filter(s=>s.pos > 0 && s.pos < W.length), usados = new Set();
  saida.forEach((est, e)=>{
    if(refraoVotos[e] > 0) out.push('[Refrão]');
    est.forEach(r=>out.push(...linhaTxt(r)));
    out.push('--');   // estrofe do Letras = uma parte (a linha divisória fecha a parte; linha em branco não fecharia numa cifra com nomes)
    const ate = fimDaEstrofe[e] ?? -1;
    meio.forEach((s, x)=>{
      if(usados.has(x) || ate < 0 || s.pos > ate + 1) return;
      usados.add(x); out.push('[' + (s.rotulo || 'Instrumental') + ']', acordesTxt(s), '--');
    });
  });
  soAcordes.filter(s=>s.pos >= W.length && s.pos > 0).forEach(s=>out.push('[' + (s.rotulo || 'Final') + ']', acordesTxt(s), ''));
  return { texto: out.join('\n').replace(/^\n+|\s+$/g, ''), revisar };   // sem trim no começo: a 1ª linha de acordes começa com espaços
}

/* ---------- Harpa Cristã: Parte → Refrão → Parte → Repete - Refrão → … ---------- */
function lviEhHarpa(texto){ return /harpa/i.test(String(texto||'')); }
function lviPadraoHarpa(secoes){
  if(lviModoFiel) return secoes;
  const ehRefrao = s=>/^(refr|coro)/i.test(s.name||'');
  const refrao = secoes.find(s=>!s.repeatOf && ehRefrao(s) && s.lines.some(l=>l.type==='lyric'));
  if(!refrao) return secoes;
  const ehParte = s=>!s.repeatOf && !ehRefrao(s) && s.lines.some(l=>l.type==='lyric') && !/^(intro|introdu|final|solo|instrumental)/i.test(s.name||'');
  for(let i = secoes.indexOf(refrao) + 1; i < secoes.length; i++){
    if(!ehParte(secoes[i])) continue;
    const prox = secoes[i+1];
    if(prox && (ehRefrao(prox) || (prox.repeatOf && ehRefrao(prox.repeatOf)))) continue;
    secoes.splice(i + 1, 0, { repeatOf: refrao, lines: [], vezes: 1 });
    i++;
  }
  return secoes;
}

/* ---------- correção do texto da letra (toda importação e o Organizar) ----------
   Nomes e pronomes de Deus com maiúscula (pedido do Davi: Ele, Tu, Teu, Te… sempre); começo do verso com maiúscula
   e o resto sem maiúscula solta; sem ponto no meio/fim do verso; sem espaço sobrando; verso grande demais vira dois. */
const LVI_DEUS = { jesus:'Jesus', deus:'Deus', senhor:'Senhor', cristo:'Cristo', jeova:'Jeová', 'jeová':'Jeová', emanuel:'Emanuel', messias:'Messias', 'altíssimo':'Altíssimo', altissimo:'Altíssimo',
  ele:'Ele', tu:'Tu', teu:'Teu', teus:'Teus', tua:'Tua', tuas:'Tuas', te:'Te', ti:'Ti', contigo:'Contigo', dele:'Dele', nele:'Nele' };
/* nomes próprios e títulos que podem ou não vir com maiúscula: ficam como vieram */
const LVI_MANTER = new Set(('israel sião siao jerusalém jerusalem belém belem calvário calvario gólgota golgota jordão jordao canaã canaa egito galileia nazaré nazare betel sinai horebe moriá jericó jerico babilônia ' +
  'maria josé jose davi abraão abraao isaque jacó jaco moisés moises elias eliseu paulo pedro joão joao saulo daniel josué josue gideão gideao sansão sansao salomão salomao ezequiel isaías isaias jó rute ester noé noe adão adao eva lázaro lazaro golias faraó farao ' +
  'rei reis pai filho cordeiro salvador santo santíssimo criador redentor consolador verbo leão leao rocha noivo amado mestre pastor aleluia hosana amém amem glória gloria majestade soberano onipotente juiz seu sua seus suas lhe céu ceu').split(' '));
const LVI_VERSO_MAX = 48;
function lviCorrigirLinha(r){
  let text = String(r.text || ''), chords = (r.chords || []).map(c=>({ name:c.name, idx:c.idx }));
  const tira = k=>{ text = text.slice(0, k) + text.slice(k + 1); chords.forEach(c=>{ if(c.idx > k) c.idx--; }); };
  /* "Ven_cendo", "alelu____ia" (sílaba esticada do Cifra Club) */
  for(let k = text.length - 1; k >= 0; k--) if(text[k] === '_') tira(k);
  /* espaços: no começo, no fim e repetidos */
  while(text.startsWith(' ')) tira(0);
  while(text.endsWith(' ')) tira(text.length - 1);
  for(let k = text.length - 1; k > 0; k--) if(text[k] === ' ' && text[k-1] === ' ') tira(k);
  /* ponto solto (não reticências) no meio ou no fim do verso */
  for(let k = text.length - 1; k >= 0; k--){
    if(text[k] !== '.' || text[k-1] === '.' || text[k+1] === '.') continue;
    if(k === text.length - 1 || text[k+1] === ' ') tira(k);
  }
  while(text.endsWith(' ')) tira(text.length - 1);
  /* maiúsculas (troca letra por letra: o tamanho não muda e os acordes ficam no lugar) */
  const soLetras = text.replace(/[^\p{L}]/gu, '');
  const tudoMaiusculo = soLetras.length > 3 && soLetras === soLetras.toUpperCase();
  const cap = s=>s.charAt(0).toUpperCase() + s.slice(1);
  let primeira = true, posPonto = false;
  text = text.replace(/\p{L}[\p{L}'’-]*|[!?]/gu, w=>{
    if(w === '!' || w === '?'){ posPonto = true; return w; }
    const low = w.toLowerCase();
    const inicio = primeira || posPonto; primeira = false; posPonto = false;
    if(LVI_DEUS[low]) return LVI_DEUS[low];
    if(LVI_MANTER.has(low)) return tudoMaiusculo ? cap(low) : (inicio ? cap(w) : w);
    return inicio ? cap(low) : low;
  });
  text = text.replace(/(espírito)(\s+Santo)/gi, 'Espírito$2');
  const linha = { type:'lyric', text, chords };
  /* verso grande demais: quebra perto do meio (de preferência numa vírgula) */
  if(text.length <= LVI_VERSO_MAX) return [linha];
  const meio = text.length / 2;
  let corte = -1, dist = 1e9;
  for(let k = 1; k < text.length - 1; k++){
    if(text[k] !== ' ') continue;
    const longe = Math.abs(k - meio);
    const d = longe - (/[,;:!?]/.test(text[k-1]) && longe <= text.length * 0.2 ? 15 : 0);   // vírgula perto do meio é o melhor corte
    if(d < dist){ dist = d; corte = k; }
  }
  if(corte < 12 || text.length - corte < 12) return [linha];
  const a = { type:'lyric', text: text.slice(0, corte), chords: chords.filter(c=>c.idx < corte) };
  const resto = text.slice(corte + 1);
  const b = lviCorrigirLinha({ text: cap(resto), chords: chords.filter(c=>c.idx >= corte).map(c=>({ name:c.name, idx: Math.max(0, c.idx - corte - 1) })) });
  return [a, ...b];
}
/* textos de linhas já corrigidos (para a lista "conferir" continuar batendo com o texto final) */
function lviCorrigirTextos(lista){ return (lista||[]).flatMap(t=>lviCorrigirLinha({ text:t, chords:[] }).map(r=>r.text.trim())); }
