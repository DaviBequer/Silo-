/* Roda os testes do Siloé num Chrome sem tela (GitHub Actions, antes de publicar).
   Abre o app em ?teste (não grava nada), carrega testes/testes.js e chama rodarTestes().
   Sai com erro se algum teste falhar ou se a página der erro de JavaScript. */
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const URL = process.env.SILOE_URL || 'http://localhost:5500/?teste';
const navegador = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const pagina = await navegador.newPage();
const errosDaPagina = [];
pagina.on('pageerror', e=>errosDaPagina.push(String(e && e.message || e)));

/* foto das telas principais com dados de mentira (celular e computador), guardada a cada publicação para comparar */
async function fotografar(p){
  try{
    fs.mkdirSync('testes/fotos', { recursive: true });
    await p.addScriptTag({ url: '/testes/mock-visual.js?x=' + Date.now() });
    await p.evaluate(()=>mockVisual());
    const telas = [['financas', ()=>switchAba('planner')], ['trabalho', ()=>switchAba('trabalho')], ['louvor', ()=>switchAba('louvor')], ['ajustes', ()=>switchAba('ajustes')], ['assistente', ()=>{ switchAba('planner'); abrirAtualizar('conversa'); }]];
    for(const [w, h, tam] of [[375, 812, 'celular'], [1440, 900, 'computador']]){
      await p.setViewport({ width: w, height: h });
      for(const [nome, abrir] of telas){
        await p.evaluate(`(${abrir.toString()})(); document.querySelectorAll('.fullpage.active').forEach(x=>{ if(!'${nome}'.startsWith('assist')) x.classList.remove('active'); });`);
        await new Promise(r=>setTimeout(r, 900));
        await p.screenshot({ path: `testes/fotos/${tam}-${nome}.png` });
      }
      await p.evaluate(()=>fecharAtualizar());
    }
    console.log('Fotos das telas: testes/fotos (no artefato "fotos-das-telas")');
  }catch(e){ console.log('Não consegui tirar as fotos (não impede a publicação):', e && e.message || e); }
}

let saida = 1;
try{
  await pagina.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await pagina.waitForFunction(()=>typeof atzNormalizarItens === 'function' && typeof novoEstado === 'function', { timeout: 30000 });
  await new Promise(r=>setTimeout(r, 5000));   // abertura animada e carga inicial
  await pagina.addScriptTag({ url: '/testes/testes.js?x=' + Date.now() });
  const r = await pagina.evaluate(async ()=>{ const r = await rodarTestes(); return { ok: r.ok, total: r.total, falhas: r.falhas }; });
  console.log(`Testes: ${r.ok} de ${r.total} passaram`);
  r.falhas.forEach(f=>console.log(`  FALHOU: ${f.nome} ${f.detalhe || ''}`));
  errosDaPagina.forEach(e=>console.log(`  ERRO NA PÁGINA: ${e}`));
  saida = r.falhas.length || errosDaPagina.length ? 1 : 0;
  if(!saida) await fotografar(pagina);
}catch(e){
  console.log('Não consegui rodar os testes:', e && e.message || e);
  errosDaPagina.forEach(x=>console.log(`  ERRO NA PÁGINA: ${x}`));
}
await navegador.close();
process.exit(saida);
