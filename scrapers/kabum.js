import { converterPrecoBRL, extrairPrecoPix, extrairJsonLd } from './utils.js';

export async function rasparKabum(page) {
  await page.waitForSelector('h1', { timeout: 15000 });

  const nome = await page.$eval('h1', (el) => el.textContent.trim());

  // 1. Tenta o seletor direto do preço com desconto no PIX da KaBuM!
  const textoPix = await page
    .$eval('h4.finalPrice, [class*="finalPrice"]', (el) => el.textContent.trim())
    .catch(() => null);

  let preco = converterPrecoBRL(textoPix);

  // 2. Fallback: lê o bloco principal da página buscando "à vista no PIX"
  if (!preco) {
    const blocoProduto = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const container = h1?.closest('main') || document.body;
      const texto = container.innerText || '';
      const inicio = h1 ? texto.indexOf(h1.innerText.trim()) : 0;
      return inicio >= 0 ? texto.slice(inicio, inicio + 1500) : texto.slice(0, 1500);
    });
    preco = extrairPrecoPix(blocoProduto);
  }

  // 3. Último fallback: JSON-LD
  if (!preco) {
    const dadosLd = await extrairJsonLd(page);
    if (dadosLd) preco = dadosLd.preco;
  }

  if (!preco) {
    throw new Error('Preço não encontrado na KaBuM! (verifique se o item está em estoque).');
  }

  return { nome, preco, loja: 'KaBuM!' };
}