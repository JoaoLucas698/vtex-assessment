# Catalog Consolidation

Sistema de consolidação de catálogo para um marketplace. Além dos produtos próprios, o e-commerce passa a vender produtos de outras lojas (**sellers**). Cada seller envia seus itens com pequenas variações de nome, marca e categoria, e o mesmo produto costuma chegar de vários sellers.

O sistema importa o arquivo de carga (JSON), identifica o que é o mesmo produto por uma chave normalizada (marca + nome, sem acento, caixa ou espaços extras) e grava **um único produto oficial** no catálogo. Cada seller fica vinculado a esse produto, com os dados exatamente como enviou e o critério do vínculo (`matchedBy`). Duplicar produto não é aceito: a garantia fica também numa constraint `unique` no banco.

Stack: backend em NestJS + Prisma sobre SQLite, frontend em React + Vite. Regras de negócio, decisões e a arquitetura estão em `/docs`.

## Pré-requisitos

- Node 26 (versão em `.nvmrc`: 26.13.1)
- npm

## Rodar sem Docker

### Backend

```bash
cd backend
npm install

cp .env.example .env                              # DATABASE_URL aponta para database/catalog.dev.db

cp ../database/catalog.db ../database/catalog.dev.db   # nunca altere o catalog.db original

npx prisma migrate resolve --applied 0_init       # só na primeira vez (ver D-055)
npx prisma migrate deploy

npm run start:dev                                 # http://localhost:3000
```

O `catalog.db` fornecido não tem a tabela `_prisma_migrations`, por isso o `migrate resolve --applied 0_init` marca a baseline antes do `migrate deploy`. Nas próximas execuções, rode só o `migrate deploy`.

O `.env` é lido pelo `prisma.config.ts` (comandos `prisma`) e pelo `main.ts` (API). O caminho de `DATABASE_URL` é relativo à pasta `backend/`, de onde os comandos rodam (D-035). `CORS_ORIGINS` lista as origens liberadas no CORS, separadas por vírgula; sem ela o CORS fica desligado (D-036).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite no terminal.

### Testes e lint

Backend (dentro de `backend/`):

```bash
npm test               # unitários (Jest)
npm run test:e2e       # e2e: copia o banco para um arquivo temporário e aplica as migrations
npm run lint:check     # ESLint
```

Frontend (dentro de `frontend/`):

```bash
npm test               # Vitest
npm run lint           # ESLint
npm run build          # type-check e build de produção
```

## Swagger

Com o backend rodando:

- UI: `http://localhost:3000/api/docs`
- JSON OpenAPI: `http://localhost:3000/api/docs-json`

## Exemplo: importar a carga

Na raiz do repositório, com o backend no ar:

```bash
curl -F "file=@database/fixtures/carga.json" http://localhost:3000/api/catalog-import
```

Resultado esperado com o banco fornecido (975 produtos, nenhum vínculo):

| Resultado | Valor |
|---|---|
| Itens lidos | 269 |
| Inválidos | 0 |
| Produtos criados (`created`) | 3 |
| Vinculados a produto existente (`linkedExisting`) | 254 |
| Já vinculados (reenvio do mesmo `Id`) | 1 |
| Duplicados no mesmo seller | 11 |
| Produtos após a importação | 978 |
| Vínculos produto ↔ seller | 257 |
| Sellers | 20 |

Com catálogo vazio, o mesmo arquivo cria 201 produtos e 257 vínculos (cenário do e2e). Reimportar o arquivo não muda nenhuma contagem: o segundo relatório traz 258 `alreadyLinked` e 11 `duplicateSameSeller`.

## Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/catalog-import` | Importa o arquivo JSON (`multipart/form-data`, campo `file`, até 5 MB) |
| `GET` | `/api/products` | Lista produtos com busca (`q`) e paginação |
| `GET` | `/api/products/:id` | Detalhe do produto com os sellers que o oferecem |
| `GET` | `/api/sellers` | Lista sellers com a quantidade de produtos |
| `GET` | `/api/sellers/:id/products` | Produtos de um seller, com os dados que ele enviou |

As listas aceitam `page` (padrão 1) e `pageSize` (padrão 20, máximo 100) (D-060). Nos dados do seller, `brand` e `category` que ele não informou vêm do produto oficial (D-014). Erros voltam como `{ statusCode, code, message }`.

## Rodar com Docker

Ver seção adicionada na etapa de Docker.

## Documentação

- [`docs/architecture.md`](docs/architecture.md): visão geral, camadas, módulos e fluxo da importação.
- [`docs/database.md`](docs/database.md): banco original, schema final e migrations.
- [`docs/decisions.md`](docs/decisions.md): decisões de design (D-001 em diante).
- [`docs/modules/`](docs/modules/): um arquivo por módulo do backend (`catalog-import`, `products`, `sellers`).
- [`docs/context.md`](docs/context.md): requisitos e regras de negócio.
