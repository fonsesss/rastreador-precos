import { chromium } from 'playwright';
import { converterPrecoBRL, extrairPrecoPix } from './utils.js';

// 1. Busca na Amazon BR priorizando o preço PIX / à vista
async function buscarNaAmazon(page, termo) {
  const urlBusca = `https://www.amazon.com.br/s?k=${encodeURIComponent(termo)}`;
  await page.goto(urlBusca, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 }).catch(() => null);

  const itens = await page.$$eval('[data-component-type="s-search-result"]', (cards) => {
    return cards.slice(0, 6).map((card) => {
      const tituloEl = card.querySelector('h2 span');
      const linkEl = card.querySelector('h2 a') || card.querySelector('a.a-link-normal[href*="/dp/"]');
      const precoEl = card.querySelector('.a-price:not(.a-text-price) .a-offscreen');
      const imgEl = card.querySelector('img.s-image');

      return {
        nome: tituloEl ? tituloEl.textContent.trim() : null,
        href: linkEl ? linkEl.getAttribute('href') : null,
        precoTexto: precoEl ? precoEl.textContent.trim() : null,
        textoCard: card.innerText || '',
        imagem: imgEl ? imgEl.getAttribute('src') : null
      };
    });
  });

  return itens
    .map((item) => {
      const preco = extrairPrecoPix(item.textoCard) || converterPrecoBRL(item.precoTexto);
      if (!item.nome || !item.href || !preco) return null;

      const matchAsin = item.href.match(/\/dp\/([A-Z0-9]{10})/);
      const urlProduto = matchAsin
        ? `https://www.amazon.com.br/dp/${matchAsin[1]}`
        : `https://www.amazon.com.br${item.href.split('?')[0]}`;

      return {
        loja: 'Amazon BR',
        nome: item.nome,
        preco,
        urlProduto,
        imagem: item.imagem
      };
    })
    .filter(Boolean);
}

// 2. Busca na KaBuM! priorizando o preço à vista no PIX
async function buscarNaKabum(page, termo) {
  const urlBusca = `https://www.kabum.com.br/busca/${encodeURIComponent(termo)}`;
  await page.goto(urlBusca, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('article.productCard, a[href*="/produto/"]', { timeout: 10000 }).catch(() => null);

  const itens = await page.$$eval('article.productCard, main a[href*="/produto/"]', (cards) => {
    return cards.slice(0, 8).map((card) => {
      const linkEl = card.tagName === 'A' ? card : card.querySelector('a[href*="/produto/"]');
      const tituloEl = card.querySelector('span.nameCard, h3, h2');
      const precoEl = card.querySelector('span.priceCard, [class*="priceCard"]');
      const imgEl = card.querySelector('img');

      return {
        nome: tituloEl ? tituloEl.textContent.trim() : null,
        href: linkEl ? linkEl.getAttribute('href') : null,
        precoTexto: precoEl ? precoEl.textContent.trim() : null,
        textoCard: card.innerText || '',
        imagem: imgEl ? imgEl.getAttribute('src') : null
      };
    });
  });

  const vistos = new Set();
  return itens
    .map((item) => {
      const preco = converterPrecoBRL(item.precoTexto) || extrairPrecoPix(item.textoCard);
      if (!item.nome || !item.href || !preco) return null;

      const urlProduto = item.href.startsWith('http')
        ? item.href.split('?')[0]
        : `https://www.kabum.com.br${item.href.split('?')[0]}`;

      if (vistos.has(urlProduto)) return null;
      vistos.add(urlProduto);

      return {
        loja: 'KaBuM!',
        nome: item.nome,
        preco,
        urlProduto,
        imagem: item.imagem
      };
    })
    .filter(Boolean);
}

// 3. Busca na Pichau priorizando o preço à vista / PIX
async function buscarNaPichau(page, termo) {
  const urlBusca = `https://www.pichau.com.br/search?q=${encodeURIComponent(termo)}`;
  await page.goto(urlBusca, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('main a img', { timeout: 10000 }).catch(() => null);

  const itens = await page.$$eval('main a', (links) => {
    return links
      .filter(
        (a) =>
          a.querySelector('img') &&
          (a.querySelector('h2') || a.querySelector('h3')) &&
          a.textContent.includes('R$')
      )
      .slice(0, 6)
      .map((a) => {
        const tituloEl = a.querySelector('h2, h3');
        const imgEl = a.querySelector('img');

        return {
          nome: tituloEl ? tituloEl.textContent.trim() : null,
          href: a.getAttribute('href'),
          textoCard: a.innerText || a.textContent,
          imagem: imgEl ? imgEl.getAttribute('src') : null
        };
      });
  });

  return itens
    .map((item) => {
      const preco = extrairPrecoPix(item.textoCard);
      if (!item.nome || !item.href || !preco) return null;

      const urlProduto = item.href.startsWith('http')
        ? item.href.split('?')[0]
        : `https://www.pichau.com.br${item.href.split('?')[0]}`;

      return {
        loja: 'Pichau',
        nome: item.nome,
        preco,
        urlProduto,
        imagem: item.imagem
      };
    })
    .filter(Boolean);
}

// 4. Busca na TerabyteShop priorizando o preço à vista / PIX
async function buscarNaTerabyte(page, termo) {
  const urlBusca = `https://www.terabyteshop.com.br/busca?str=${encodeURIComponent(termo)}`;
  await page.goto(urlBusca, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForSelector('.pbox, .commerce_columns_item_inner', { timeout: 10000 }).catch(() => null);

  const itens = await page.$$eval('.pbox, .commerce_columns_item_inner', (cards) => {
    return cards.slice(0, 6).map((card) => {
      const linkEl = card.querySelector('a.prod-name, a[href*="/produto/"]');
      const precoEl = card.querySelector('.prod-new-price span, .prod-new-price');
      const imgEl = card.querySelector('img');

      return {
        nome: linkEl ? (linkEl.getAttribute('title') || linkEl.textContent).trim() : null,
        href: linkEl ? linkEl.getAttribute('href') : null,
        precoTexto: precoEl ? precoEl.textContent.trim() : null,
        textoCard: card.innerText || '',
        imagem: imgEl ? imgEl.getAttribute('src') || imgEl.getAttribute('data-src') : null
      };
    });
  });

  return itens
    .map((item) => {
      const preco = converterPrecoBRL(item.precoTexto) || extrairPrecoPix(item.textoCard);
      if (!item.nome || !item.href || !preco) return null;

      const urlProduto = item.href.startsWith('http')
        ? item.href.split('?')[0]
        : `https://www.terabyteshop.com.br${item.href.split('?')[0]}`;

      return {
        loja: 'TerabyteShop',
        nome: item.nome,
        preco,
        urlProduto,
        imagem: item.imagem
      };
    })
    .filter(Boolean);
}

const mapaBuscadores = {
  amazon: buscarNaAmazon,
  kabum: buscarNaKabum,
  pichau: buscarNaPichau,
  terabyte: buscarNaTerabyte
};

export async function pesquisarHardware({ termo, lojas, precoMinimo = 0 }) {
  const lojasValidas = (lojas || []).filter((l) => mapaBuscadores[l]);
  if (!termo || lojasValidas.length === 0) {
    throw new Error('Informe o termo de busca e selecione ao menos uma loja.');
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'pt-BR'
    });

    const promessas = lojasValidas.map(async (chaveLoja) => {
      const page = await context.newPage();

      await page.route('**/*', (route) => {
        const tipo = route.request().resourceType();
        if (['image', 'font', 'media'].includes(tipo)) {
          return route.abort();
        }
        return route.continue();
      });

      try {
        return await mapaBuscadores[chaveLoja](page, termo);
      } catch (erro) {
        console.error(`Falha na busca (${chaveLoja}):`, erro.message);
        return [];
      } finally {
        await page.close();
      }
    });

    const resultadosPorLoja = await Promise.all(promessas);
    const min = Number(precoMinimo) || 0;

    return resultadosPorLoja
      .flat()
      .filter((item) => item.preco >= min)
      .sort((a, b) => a.preco - b.preco);
  } finally {
    await browser.close();
  }
}