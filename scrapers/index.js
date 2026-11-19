import { chromium } from 'playwright';
import { rasparAmazon } from './amazon.js';
import { rasparKabum } from './kabum.js';
import { rasparPichau } from './pichau.js';
import { rasparTerabyte } from './terabyte.js';

function identificarExtrator(url) {
  const { hostname } = new URL(url);

  if (hostname.includes('amazon.com.br')) return rasparAmazon;
  if (hostname.includes('kabum.com.br')) return rasparKabum;
  if (hostname.includes('pichau.com.br')) return rasparPichau;
  if (hostname.includes('terabyteshop.com.br')) return rasparTerabyte;

  throw new Error('Loja não suportada. Use links da Amazon BR, KaBuM!, Pichau ou TerabyteShop.');
}

export async function buscarDadosProduto(url) {
  const extrator = identificarExtrator(url);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'pt-BR'
    });

    const page = await context.newPage();

    await page.route('**/*', (route) => {
      const tipo = route.request().resourceType();
      if (['image', 'font', 'media'].includes(tipo)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const resultado = await extrator(page);

    let imagem = await page
      .$eval('meta[property="og:image"]', (el) => el.content)
      .catch(() => null);

    if (!imagem) {
      imagem = await page
        .$eval('#landingImage, #img-produto', (el) => el.src)
        .catch(() => null);
    }

    return { ...resultado, imagem };
  } finally {
    await browser.close();
  }
}