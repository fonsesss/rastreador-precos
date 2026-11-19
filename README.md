# Radar de Hardware + Alertas no Discord

Aplicação web full-stack para pesquisa simultânea e monitoramento automatizado de preços de hardware (GPUs e CPUs) na **Amazon BR**, **KaBuM!**, **Pichau** e **TerabyteShop**, priorizando valores promocionais à vista/PIX e disparando alertas formatados (Embeds) via Webhook do Discord.

## Funcionalidades

- **Busca Multi-Lojas Paralela:** Pesquisa o mesmo componente simultaneamente nas lojas selecionadas usando Playwright com bloqueio de recursos pesados (`image`, `font`, `media`) para maior velocidade.
- **Extração de Preço à Vista / PIX:** Identifica ofertas à vista e ignora preços riscados ou parcelas, utilizando o Padrão *Adapter* (`scrapers/`) com fallback para dados estruturados (`JSON-LD`).
- **Alertas Ricos no Discord:** Envia cartões formatados com miniatura do produto, loja, preço encontrado, valor-alvo e cálculo automático de economia.
- **Gerenciamento Completo:** Cadastro direto pelos resultados da busca ou via link manual, edição de preço-alvo (`PUT`), verificação sob demanda e agendador automático em segundo plano.

## Tecnologias Utilizadas

- **Backend:** Node.js, Express, Playwright (Chromium), `mysql2`, `dotenv`
- **Banco de Dados:** MySQL
- **Frontend:** HTML5, CSS3 e JavaScript (Fetch API)

## Como Executar Localmente

### 1. Criar o Banco de Dados (MySQL)
Execute o script abaixo no phpMyAdmin ou no seu cliente MySQL:

```sql
CREATE DATABASE IF NOT EXISTS rastreador_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE rastreador_db;

CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  loja VARCHAR(50) NOT NULL,
  url_produto TEXT NOT NULL,
  imagem_url TEXT NULL,
  preco_atual DECIMAL(10, 2) NOT NULL,
  preco_alvo DECIMAL(10, 2) NOT NULL,
  notificado BOOLEAN DEFAULT FALSE,
  ultima_verificacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Instalar Dependências e o Chromium do Playwright

```bash
npm install
npx playwright install chromium
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=rastreador_db
DISCORD_WEBHOOK_URL=COLE_AQUI_SUA_URL_DO_WEBHOOK
```

### 4. Iniciar o Servidor

```bash
node --watch server.js
```

Acesse `http://localhost:3001` no navegador.