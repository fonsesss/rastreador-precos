import { extrairPrecoPix, extrairJsonLd } from './utils.js';

export async function rasparPichau(page) {
  await page.waitForSelector('h1', { timeout: 15000 });

  const nome = await page.$eval('h1', (el) => el.textContent.trim());

  const blocoProduto = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const container = h1?.closest('main') || document.body;
    const texto = container.innerText || '';
    const inicio = h1 ? texto.indexOf(h1.innerText.trim()) : 0;
    return inicio >= 0 ? texto.slice(inicio, inicio + 1500) : texto.slice(0, 1500);
  });

  let preco = extrairPrecoPix(blocoProduto);

  if (!preco) {
    const dadosLd = await extrairJsonLd(page);
    if (dadosLd) preco = dadosLd.preco;
  }

  if (!preco) {
    throw new Error('Preço não encontrado na Pichau (produto pode estar indisponível).');
  }

  return { nome, preco, loja: 'Pichau' };
}