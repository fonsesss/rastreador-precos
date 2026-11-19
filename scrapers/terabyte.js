import { converterPrecoBRL, extrairPrecoPix, extrairJsonLd } from './utils.js';

export async function rasparTerabyte(page) {
  await page.waitForSelector('h1', { timeout: 15000 });

  const nome = await page.$eval('h1', (el) => el.textContent.trim());

  // 1. Seletor padrão do preço à vista (Boleto/PIX) da TerabyteShop
  const textoVista = await page
    .$eval('#valVista, .val-prod', (el) => el.textContent.trim())
    .catch(() => null);

  let preco = converterPrecoBRL(textoVista);

  // 2. Fallback: analisa o bloco principal do produto buscando "à vista" ou "PIX"
  if (!preco) {
    const blocoProduto = await page.evaluate(() => {
      const box = document.querySelector('#body-produto') || document.body;
      return (box.innerText || '').slice(0, 1800);
    });
    preco = extrairPrecoPix(blocoProduto);
  }

  // 3. Último fallback: JSON-LD
  if (!preco) {
    const dadosLd = await extrairJsonLd(page);
    if (dadosLd) preco = dadosLd.preco;
  }

  if (!preco) {
    throw new Error('Preço não encontrado na TerabyteShop (produto pode estar esgotado).');
  }

  return { nome, preco, loja: 'TerabyteShop' };
}