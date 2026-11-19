import 'dotenv/config';
import db from './db.js';
import { buscarDadosProduto } from './scrapers/index.js';

function formatarBRL(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export async function enviarAlertaDiscord(produto, precoNovo) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('COLE_AQUI')) {
    console.warn('Webhook do Discord não configurado no arquivo .env');
    return false;
  }

  const precoAtualNum = Number(precoNovo);
  const precoAlvoNum = Number(produto.preco_alvo);
  const economia = precoAlvoNum - precoAtualNum;

  const campos = [
    {
      name: '💰 Preço Atual',
      value: `**${formatarBRL(precoAtualNum)}**`,
      inline: true
    },
    {
      name: '🎯 Seu Preço-Alvo',
      value: formatarBRL(precoAlvoNum),
      inline: true
    },
    {
      name: '🏪 Loja',
      value: `**${produto.loja}**`,
      inline: true
    }
  ];

  if (economia > 0) {
    campos.push({
      name: '📉 Diferença',
      value: `**${formatarBRL(economia)}** abaixo do seu alvo!`,
      inline: false
    });
  }

  const embed = {
    author: {
      name: 'RADAR DE HARDWARE • ALERTA DE PREÇO'
    },
    title: produto.nome,
    url: produto.url_produto,
    description: `O item atingiu o valor desejado!\n👉 **[Abrir oferta direto na ${produto.loja}](${produto.url_produto})**`,
    color: 0x04d361,
    fields: campos,
    footer: {
      text: 'Monitoramento automático • Playwright + MySQL'
    },
    timestamp: new Date().toISOString()
  };

  if (produto.imagem_url) {
    embed.thumbnail = { url: produto.imagem_url };
  }

  const payload = {
    username: 'Radar de Hardware',
    embeds: [embed]
  };

  const resposta = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return resposta.ok;
}

export async function verificarTodosProdutos() {
  const [produtos] = await db.query('SELECT * FROM produtos');

  for (const produto of produtos) {
    try {
      const dados = await buscarDadosProduto(produto.url_produto);
      const atingiuAlvo = dados.preco <= Number(produto.preco_alvo);
      const imagemAtualizada = dados.imagem || produto.imagem_url;

      let jaNotificado = Boolean(produto.notificado);

      if (atingiuAlvo && !jaNotificado) {
        const enviou = await enviarAlertaDiscord(
          { ...produto, imagem_url: imagemAtualizada },
          dados.preco
        );
        if (enviou) {
          jaNotificado = true;
          console.log(`[ALERTA ENVIADO] ${produto.nome} (${produto.loja}) por R$ ${dados.preco}`);
        }
      } else if (!atingiuAlvo) {
        jaNotificado = false;
      }

      await db.execute(
        `UPDATE produtos 
         SET preco_atual = ?, imagem_url = ?, notificado = ?, ultima_verificacao = NOW() 
         WHERE id = ?`,
        [dados.preco, imagemAtualizada, jaNotificado ? 1 : 0, produto.id]
      );
    } catch (erro) {
      console.error(`Erro ao verificar ${produto.nome}:`, erro.message);
    }
  }
}

export function iniciarAgendador(intervaloMs = 15 * 60 * 1000) {
  setInterval(() => {
    console.log('Executando varredura automática de hardware...');
    verificarTodosProdutos();
  }, intervaloMs);
}