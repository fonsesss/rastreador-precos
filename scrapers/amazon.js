import { converterPrecoBRL, extrairPrecoPix } from './utils.js';

export async function rasparAmazon(page) {
  await page.waitForSelector('#productTitle', { timeout: 15000 });

  const nome = await page.$eval('#productTitle', (el) => el.textContent.trim());

  // Lê o bloco principal de preço da Amazon BR (evitando preços riscados .a-text-price)
  const dadosPreco = await page.evaluate(() => {
    const box =
      document.querySelector('#corePriceDisplay_desktop_feature_div') ||
      document.querySelector('#corePrice_feature_div') ||
      document.querySelector('#apex_desktop');

    const precoPrincipalEl = box?.querySelector('.a-price:not(.a-text-price) .a-offscreen');

    return {
      textoBox: box ? box.innerText : '',
      textoPrincipal: precoPrincipalEl ? precoPrincipalEl.textContent.trim() : null
    };
  });

  // Prioriza o texto explícito "à vista no Pix" se a Amazon exibir em linha separada
  let preco = extrairPrecoPix(dadosPreco.textoBox);
  if (!preco) {
    preco = converterPrecoBRL(dadosPreco.textoPrincipal);
  }

  if (!preco) {
    throw new Error('Produto sem preço disponível na Amazon BR (pode estar esgotado).');
  }

  return { nome, preco, loja: 'Amazon BR' };
}