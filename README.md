# Catalog Consolidation

Sistema de consolidação de catálogo para um marketplace. Além dos produtos próprios, o e-commerce passa a vender produtos de outras lojas (**sellers**). Cada seller envia seus itens com pequenas variações de nome, marca e categoria, e o mesmo produto costuma chegar de vários sellers.

O sistema importa o arquivo de carga (JSON), identifica o que é o mesmo produto por uma chave normalizada (marca + nome, sem acento, caixa ou espaços extras) e grava **um único produto oficial** no catálogo. Cada seller fica vinculado a esse produto, com os dados exatamente como enviou e o critério do vínculo (`matchedBy`). Duplicar produto não é aceito: a garantia fica também numa constraint `unique` no banco.

Stack: backend em NestJS + Prisma sobre SQLite, frontend em React + Vite. Regras de negócio, decisões e a arquitetura estão em `/docs`.

## Início rápido

**Com Docker** (só precisa do Docker; sobe backend e frontend com um comando):

```bash
docker compose up --build
```

Depois abra `http://localhost:8080`. Detalhes na seção [Rodar com Docker](#rodar-com-docker).

**Sem Docker** (Node 26 e npm): veja [Rodar sem Docker](#rodar-sem-docker). Em resumo, backend em `http://localhost:3000` e frontend (Vite) em `http://localhost:5173`.

## Pré-requisitos

- Para rodar com Docker: Docker com Compose v2 (testado com Docker 28 e Compose 2.39).
- Para rodar sem Docker: Node 26 (versão em `.nvmrc`: 26.13.1) e npm.

## Rodar sem Docker

### Backend

O `.env` é lido pelo `prisma.config.ts` (comandos `prisma migrate`) e pelo `main.ts` (API). O caminho de `DATABASE_URL` é relativo à pasta `backend/`, de onde os comandos rodam (D-110).

Bash (Linux, macOS, Git Bash):

```bash
cd backend
cp .env.example .env                                    # DATABASE_URL aponta para database/catalog.dev.db
cp ../database/catalog.db ../database/catalog.dev.db    # nunca altere o catalog.db original
npm install
npx prisma migrate resolve --applied 0_init             # só na primeira vez (ver D-055)
npx prisma migrate deploy
npm run start:dev                                       # http://localhost:3000
```

PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
Copy-Item ..\database\catalog.db ..\database\catalog.dev.db
npm install
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy
npm run start:dev
```

O `catalog.db` fornecido não tem a tabela `_prisma_migrations`, por isso o `migrate resolve --applied 0_init` marca a baseline antes do `migrate deploy`. Nas próximas execuções, rode só o `migrate deploy`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite encaminha /api para o backend em http://localhost:3000, então o backend precisa estar rodando.

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
| `GET` | `/api/sellers/:id/products` | Produtos de um seller, como ele enviou |

## Rodar com Docker

Pré-requisito: Docker com Compose v2 (Docker Desktop no Windows e macOS). Não precisa de Node instalado.

```bash
docker compose up --build
```

O primeiro build leva alguns minutos. O frontend só sobe depois que o backend passa no healthcheck.

| O quê | Endereço |
|---|---|
| Aplicação (frontend) | `http://localhost:8080` |
| API | `http://localhost:3000/api` |
| Swagger | `http://localhost:3000/api/docs` |

O frontend (nginx) também encaminha `/api` para o backend, então `http://localhost:8080/api/...` funciona.

**Importar a carga**

- Pelo app: abra `http://localhost:8080`, vá para a tela de importação e envie `database/fixtures/carga.json`.
- Pela linha de comando (bash, PowerShell e cmd; no PowerShell use `curl.exe`):

```bash
curl -F "file=@database/fixtures/carga.json" http://localhost:8080/api/catalog-import
```

Na primeira importação o relatório traz `read` 269, `created` 3, `linkedExisting` 254, `alreadyLinked` 1 e `duplicateSameSeller` 11. Reenviando o arquivo, `alreadyLinked` passa a 258.

**Comandos úteis**

```bash
docker compose up --build -d     # sobe em segundo plano
docker compose logs -f backend   # acompanha os logs
docker compose ps                # estado e healthcheck
docker compose down              # para os containers; o banco é mantido
docker compose down -v           # para e apaga o volume: o banco volta ao original
```

**Como o banco funciona no Docker.** O banco fornecido (`database/catalog.db`) vai dentro da imagem e nunca é alterado. Na primeira subida, o entrypoint copia o arquivo para o volume `catalog-data` (`/data/catalog.db`), marca a baseline `0_init` e aplica as migrations. As importações gravam nesse volume, que sobrevive a `down` e `up`. Para voltar ao banco original, use `docker compose down -v`. Mais detalhes em D-100.

**Portas ocupadas.** As portas do host podem ser trocadas por variável de ambiente (o padrão é 3000 e 8080):

```bash
BACKEND_PORT=3001 FRONTEND_PORT=8081 docker compose up --build
```

```powershell
$env:BACKEND_PORT="3001"; $env:FRONTEND_PORT="8081"; docker compose up --build
```

## Documentação

- [`docs/architecture.md`](docs/architecture.md): visão geral, camadas, módulos e fluxo da importação.
- [`docs/database.md`](docs/database.md): banco original, schema final e migrations.
- [`docs/decisions.md`](docs/decisions.md): decisões de design (D-001 em diante).
- [`docs/modules/`](docs/modules/): um arquivo por módulo do backend (`catalog-import`, `products`, `sellers`).
- [`docs/context.md`](docs/context.md): requisitos e regras de negócio.
