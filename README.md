# WebhookLab

Receba e inspecione webhooks em tempo real em um ambiente próprio. O MVP cria endpoints privados sem cadastro, registra as últimas 100 requisições e elimina eventos antigos automaticamente.

## Recursos da v0.2.0

- Endpoint exclusivo com token criptograficamente aleatório.
- Métodos `GET`, `POST`, `PUT`, `PATCH`, `DELETE` e `OPTIONS`.
- Atualização em tempo real com Server-Sent Events e Redis Pub/Sub.
- Visualização de body, query parameters, headers e metadados.
- Formatação automática de JSON.
- Headers sensíveis mascarados antes da persistência.
- IP armazenado apenas como indicação de rede `/24` ou `/64`.
- Limite de payload, rate limiting e expiração automática.
- Exclusão individual ou completa dos eventos.
- Interface responsiva.
- Health check da aplicação, PostgreSQL e Redis.

> **Importante:** no MVP, o token presente na URL concede acesso ao endpoint e ao painel. Trate o link como uma senha e não o compartilhe.

## Arquitetura

```text
Navegador → Next.js :3000 → FastAPI :8000 → PostgreSQL
                                  └──→ Redis (rate limit + tempo real)
```

Somente o frontend precisa ser publicado pelo proxy do Coolify. As rotas `/api/*` e `/hook/*` são encaminhadas internamente para a API.

## Desenvolvimento local

Requisitos: Docker Engine com Docker Compose v2.

```bash
cp .env.example .env
```

Gere dois segredos fortes:

```bash
openssl rand -base64 36
openssl rand -hex 32
```

Use o primeiro como `POSTGRES_PASSWORD` e ajuste a mesma senha dentro de `DATABASE_URL`. Use o segundo como `TOKEN_SECRET`.

Depois execute:

```bash
docker compose up --build
```

Acesse [http://localhost:3000](http://localhost:3000). A documentação da API fica em [http://localhost:3000/api/docs](http://localhost:3000/api/docs).

## Teste rápido

Crie um endpoint pela interface e copie sua URL:

```bash
curl -X POST 'http://localhost:3000/hook/SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer segredo-que-sera-mascarado' \
  -d '{"origem":"teste","status":"ok"}'
```

## API de gerenciamento de endpoints

- `POST /api/inboxes`: cria um endpoint. Envie `{"name":"Meu endpoint"}`; o nome é opcional para manter compatibilidade com clientes anteriores.
- `GET /api/inboxes/{token}`: consulta o endpoint e seus eventos.
- `PATCH /api/inboxes/{token}`: altera o nome sem modificar o token. Envie `{"name":"Novo nome"}`.
- `DELETE /api/inboxes/{token}`: exclui permanentemente o endpoint e todos os eventos associados. URLs excluídas retornam `404`.

A interface permite pesquisar eventos, combinar pesquisa e filtro por método, acompanhar a contagem filtrada e excluir endpoints com confirmação textual.

## Roadmap

- [x] v0.2.0 — nomes personalizados, gerenciamento de endpoints e filtros.
- [ ] v0.3.0 — melhorias de observabilidade e operação.
- [ ] v0.4.0 — recursos avançados de eventos (exportação e replay).

## Implantação no Coolify

### 1. Repositório e branches

Crie um repositório GitHub chamado `webhooklab` e envie este conteúdo. Use:

- `develop`: homologação;
- `main`: produção;
- tags `v0.1.0`, `v0.1.1` etc. para versões publicadas.

### 2. Recurso no Coolify

1. Crie um novo recurso **Docker Compose** a partir do repositório GitHub.
2. Selecione o arquivo `/docker-compose.yml`.
3. Para homologação, escolha a branch `develop`.
4. Publique apenas a porta `3000` do serviço `frontend`.
5. Não exponha PostgreSQL, Redis ou a porta `8000` diretamente na internet.

### 3. Variáveis de ambiente

Cadastre como variáveis de produção:

```dotenv
POSTGRES_DB=webhooklab
POSTGRES_USER=webhooklab
POSTGRES_PASSWORD=SEGREDO_FORTE
DATABASE_URL=postgresql+asyncpg://webhooklab:SEGREDO_FORTE@postgres:5432/webhooklab
REDIS_URL=redis://redis:6379/0
TOKEN_SECRET=SEGREDO_ALEATORIO_COM_64_CARACTERES
PUBLIC_BASE_URL=https://webhook.franklem.uk
BACKEND_INTERNAL_URL=http://api:8000
EVENT_RETENTION_HOURS=168
MAX_BODY_BYTES=262144
RATE_LIMIT_PER_MINUTE=120
BACKUP_PATH=/caminho/persistente/para/backups/webhooklab
```

Se a senha do PostgreSQL contiver caracteres especiais de URL, aplique URL encoding no valor usado em `DATABASE_URL`.

### 4. Domínio e health check

- Domínio sugerido: `https://webhook.franklem.uk`.
- Health check: `/api/health`.
- Código esperado: `200`.
- Resposta esperada: `{"status":"ok","version":"0.2.0"}`.

Cadastre essa URL no Uptime Kuma e envie alertas pelo Telegram já configurado no laboratório.

### 5. Deploy controlado

1. Push para `develop`.
2. Validar CI no GitHub.
3. Implantar em homologação.
4. Criar endpoint e enviar payload de teste.
5. Confirmar persistência após reiniciar a aplicação.
6. Fazer merge em `main`.
7. Criar a tag `v0.1.0`.
8. Implantar produção e verificar o health check.

## Backup e restauração

O backup lógico cria um SQL comprimido e o valida com `gzip -t`:

```bash
docker compose --profile tools run --rm backup
```

Os arquivos são salvos em `./backups` e a rotina local remove backups com mais de 14 dias. Em produção, monte esse diretório no volume persistente já destinado aos backups da Contabo e execute diariamente pelo agendador do servidor.

Restauração controlada:

```bash
./ops/restore.sh backups/webhooklab-AAAA-MM-DD_HH-MM-SS.sql.gz
```

Antes de restaurar produção, pare a entrada de novos webhooks e teste o arquivo em um banco de homologação.

## Testes e qualidade

```bash
docker compose run --rm api pytest
docker compose run --rm api ruff check .
docker compose build
```

O GitHub Actions executa lint, testes, build do frontend e validação do Compose em pushes e pull requests das branches `develop` e `main`.

## Segurança e limitações do MVP

- O token nunca é salvo em texto puro no banco; somente um HMAC-SHA256 é persistido.
- `Authorization`, cookies e chaves comuns são substituídos antes de salvar o evento.
- O body pode conter dados confidenciais enviados pelo sistema testado. Use somente payloads de desenvolvimento.
- A versão atual não possui contas, equipes, replay nem garantia de entrega.
- A indicação de IP é reduzida, mas ainda deve ser tratada como dado operacional.
- Para produção pública, mantenha HTTPS obrigatório no proxy do Coolify.

## Roadmap

- `v0.2`: nomeação e exclusão do endpoint, filtros e pesquisa.
- `v0.3`: autenticação, múltiplos projetos e API Keys.
- `v0.4`: respostas simuladas configuráveis.
- `v0.5`: replay seguro com allowlist e proteção rigorosa contra SSRF.

## Licença

MIT © 2026 Franklin Martins.
