// Converte strings como "R$ 3.499,90" ou "3.499,90" para número float (3499.90)
export function converterPrecoBRL(texto) {
  if (!texto) return null;
  const limpo = String(texto)
    .replace(/[^\d,]/g, '')
    .replace(',', '.');

  const valor = parseFloat(limpo);
  return Number.isNaN(valor) ? null : valor;
}

// Extrai o preço promocional à vista / PIX em qualquer loja (Amazon, KaBuM, Pichau, Terabyte)
export function extrairPrecoPix(texto) {
  if (!texto) return null;

  // 1. Procura padrões explícitos: "à vista R$ X", "no PIX R$ X" ou "R$ X à vista / no PIX"
  const matchAntes = texto.match(/(?:à\s*vista|no\s*pix|via\s*pix|boleto)\s*:?\s*R\$\s*([\d.]+,\d{2})/i);
  if (matchAntes) return converterPrecoBRL(matchAntes[1]);

  const matchDepois = texto.match(/R\$\s*([\d.]+,\d{2})\s*(?:à\s*vista|no\s*pix|via\s*pix|no\s*boleto|\(\d+%\s*de\s*desconto)/i);
  if (matchDepois) return converterPrecoBRL(matchDepois[1]);

  // 2. Fallback: coleta valores R$ isolados, ignorando "de R$" (riscado), "Nx de R$" (parcela) e "R$ X de desconto"
  const regexTodos =
    /(?:(\d+\s*x\s*de|de|economize)\s*)?R\$\s*([\d.]+,\d{2})(?!\s*(?:de\s+desconto|de\s+cashback|off))/gi;
  const candidatos = [];
  let match;

  while ((match = regexTodos.exec(texto)) !== null) {
    const prefixo = (match[1] || '').trim();
    if (!prefixo) {
      const valor = converterPrecoBRL(match[2]);
      if (valor) candidatos.push(valor);
    }
  }

  // O valor à vista / PIX é sempre o menor entre os preços válidos do anúncio
  if (candidatos.length > 0) {
    return Math.min(...candidatos);
  }

  return null;
}

// Tenta extrair nome e preço do bloco padrão Schema.org (JSON-LD)
export async function extrairJsonLd(page) {
  const scripts = await page.$$eval('script[type="application/ld+json"]', (els) =>
    els.map((el) => el.textContent)
  );

  for (const conteudo of scripts) {
    try {
      const json = JSON.parse(conteudo);
      const lista = Array.isArray(json) ? json : [json];

      for (const item of lista) {
        if (item['@type'] === 'Product' && item.offers) {
          const oferta = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          const preco = Number(oferta.price || oferta.lowPrice);
          if (preco > 0) {
            return { nome: item.name, preco };
          }
        }
      }
    } catch {
      // Ignora blocos JSON que não sejam de produto
    }
  }

  return null;
}