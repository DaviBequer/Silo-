/* Roda os testes do Siloé num Chrome sem tela (GitHub Actions, antes de publicar).
   Abre o app em ?teste (não grava nada), carrega testes/testes.js e chama rodarTestes().
   Sai com erro se algum teste falhar ou se a página der erro de JavaScript. */
import puppeteer from 'puppeteer';

const URL = process.env.SILOE_URL || 'http://localhost:5500/?teste';
const navegador = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const pagina = await navegador.newPage();
const errosDaPagina = [];
pagina.on('pageerror', e=>errosDaPagina.push(String(e && e.message || e)));

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
}catch(e){
  console.log('Não consegui rodar os testes:', e && e.message || e);
  errosDaPagina.forEach(x=>console.log(`  ERRO NA PÁGINA: ${x}`));
}
await navegador.close();
process.exit(saida);
