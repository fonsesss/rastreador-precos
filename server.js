import 'dotenv/config';
import express from 'express';
import db from './db.js';
import { buscarDadosProduto } from './scrapers/index.js';
import { pesquisarHardware } from './scrapers/busca.js';
import {
  enviarAlertaDiscord,
  verificarTodosProdutos,
  iniciarAgendador
} from './monitor.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));

// 1. GET: Lista todos os produtos monitorados
app.get('/api/produtos', async (req, res) => {
  try {
    const [linhas] = await db.query(`
      SELECT 
        id,
        nome,
        loja,
        url_produto AS urlProduto,
        preco_atual AS precoAtual,
        preco_alvo AS precoAlvo,
        notificado,
        DATE_FORMAT(ultima_verificacao, '%d/%m %H:%i') AS ultimaVerificacao
      FROM produtos
      ORDER BY id DESC
    `);

    const produtos = linhas.map((p) => ({
      ...p,
      precoAtual: Number(p.precoAtual),
      precoAlvo: Number(p.precoAlvo),
      notificado: Boolean(p.notificado)
    }));

    res.json(produtos);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao listar produtos.' });
  }
});

// 2. POST: Pesquisa um componente nas lojas selecionadas
app.post('/api/pesquisar', async (req, res) => {
  const { termo, lojas, precoMinimo } = req.body;

  try {
    const resultados = await pesquisarHardware({ termo, lojas, precoMinimo });
    res.json(resultados);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

// 3. POST: Cadastra um produto (via resultado da busca OU via link manual)
app.post('/api/produtos', async (req, res) => {
  const { urlProduto, precoAlvo, nome, loja, precoAtual, imagem } = req.body;

  if (!urlProduto || !precoAlvo) {
    return res.status(400).json({ erro: 'Informe o link do produto e o preço-alvo.' });
  }

  try {
    new URL(urlProduto);
  } catch {
    return res.status(400).json({ erro: 'URL inválida.' });
  }

  try {
    // Se já veio da busca automática, reaproveita os dados sem precisar raspar de novo
    const dados =
      nome && loja && precoAtual
        ? { nome, loja, preco: Number(precoAtual), imagem: imagem || null }
        : await buscarDadosProduto(urlProduto);

    const alvoNum = Number(precoAlvo);
    const atingiuAlvo = dados.preco <= alvoNum;

    const [resultado] = await db.execute(
      `INSERT INTO produtos (nome, loja, url_produto, imagem_url, preco_atual, preco_alvo, notificado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dados.nome, dados.loja, urlProduto, dados.imagem, dados.preco, alvoNum, atingiuAlvo ? 1 : 0]
    );

    if (atingiuAlvo) {
      await enviarAlertaDiscord(
        {
          nome: dados.nome,
          loja: dados.loja,
          url_produto: urlProduto,
          imagem_url: dados.imagem,
          preco_alvo: alvoNum
        },
        dados.preco
      );
    }

    res.status(201).json({ id: resultado.insertId });
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

// 4. PUT: Atualiza o preço-alvo de um produto já cadastrado
app.put('/api/produtos/:id', async (req, res) => {
  const { id } = req.params;
  const { precoAlvo } = req.body;

  if (!precoAlvo || Number(precoAlvo) <= 0) {
    return res.status(400).json({ erro: 'Informe um preço-alvo válido.' });
  }

  try {
    const [linhas] = await db.query('SELECT * FROM produtos WHERE id = ?', [id]);
    if (linhas.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const produto = linhas[0];
    const novoAlvo = Number(precoAlvo);
    const atingiuAlvo = Number(produto.preco_atual) <= novoAlvo;

    await db.execute(
      'UPDATE produtos SET preco_alvo = ?, notificado = ? WHERE id = ?',
      [novoAlvo, atingiuAlvo ? 1 : 0, id]
    );

    if (atingiuAlvo && !produto.notificado) {
      await enviarAlertaDiscord(
        { ...produto, preco_alvo: novoAlvo },
        produto.preco_atual
      );
    }

    res.json({ atualizado: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar o preço-alvo.' });
  }
});

// 5. POST: Força verificação imediata de todos os preços
app.post('/api/verificar', async (req, res) => {
  await verificarTodosProdutos();
  res.json({ verificado: true });
});

// 6. DELETE: Remove um produto do monitoramento
app.delete('/api/produtos/:id', async (req, res) => {
  await db.execute('DELETE FROM produtos WHERE id = ?', [req.params.id]);
  res.json({ removido: true });
});

app.listen(PORT, () => {
  console.log(`Radar de Hardware rodando em http://localhost:${PORT}`);
  iniciarAgendador();
});