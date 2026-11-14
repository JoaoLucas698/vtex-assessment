# Plano — Catalog Consolidation

> Este arquivo vira `docs/plan.md` no commit de bootstrap. O agente principal só planeja, coordena e revisa; toda implementação é feita por subagentes.

## Contexto

E-commerce vira marketplace: sellers enviam produtos via JSON, o catálogo não pode duplicar produto e precisa registrar quais sellers vendem cada um. Regras de código no `CLAUDE.md`; regras de negócio em `docs/context.md` (seções citadas como "ctx §N").

## Inspeção feita (só leitura)

**Banco `catalog.db`** (hoje na raiz do repo):
- `Product (Id INTEGER PK AUTOINCREMENT, Name TEXT NOT NULL, Brand TEXT, Category TEXT)` — 975 linhas, `sqlite_sequence` = 975.
- `SellerProduct (Id INTEGER PK AUTOINCREMENT, SellerName TEXT NOT NULL, ProductId INTEGER NOT NULL FK→Product, SellerProductId INTEGER NOT NULL)` — **0 linhas**.
- 119 produtos com `Brand` nulo, 34 com `Category` nulo, nenhum `Brand` vazio, nenhum caractere não-ASCII, nenhum espaço especial.
- **0 grupos de duplicata** por `normalizedKey` (975 chaves distintas). A etapa de deduplicação da migration é implementada, mas não altera nada neste banco.
- Tabela de vínculo não tem dados do seller (nome/marca/categoria) → no caso geral seriam copiados do `Product`; hoje não há linhas.

**Arquivo `carga.txt`** (JSON, na raiz) — números conferem 100% com ctx §2:
269 itens · 20 sellers · 3 `Id` não-UUID · 14 `Id` repetidos · 3 `Brand: null` · 0 `Category: null` · único caractere não-ASCII: `â`.

**Simulação da regra da ctx §4** (script descartável no scratchpad):
| | Catálogo vazio | Banco real |
|---|---|---|
| new | 201 | 3 |
| normalized_key | 56 | 254 |
| já vinculados | 1 | 1 |
| duplicados no mesmo seller | 11 | 11 |
| vínculos | 257 | 257 |
| produtos com >1 seller | 54 | 54 |
| produtos no fim | 201 | 978 |

**Ambiente:** Node **26.13.1** / npm 11.20.0 (trocado pelo usuário durante o planejamento; a análise acima rodou em Node 22, mas é só leitura e o resultado não depende da versão), `sqlite3` em `F:\sqlite\sqlite3.exe`, `gh` autenticado, remote `origin` no GitHub, `main` sem commits. Skill `caveman:caveman` disponível.

## Decisões confirmadas com o usuário nesta etapa
- `schema.prisma` não foi fornecido → a Onda 3 escreve exatamente o modelo da ctx §3 (D-022).
- Coluna legada `SellerProduct.SellerProductId` → copiada como `CAST(... AS TEXT)` para `externalId` (diverge da ctx §3, que dizia `null`; preserva dado; sem efeito hoje, 0 linhas) (D-020).
- Bootstrap: agente principal faz o primeiro commit em `main` e dá push (única vez).
- Ondas encadeadas: se a dependência não foi mergeada, a branch nasce da branch da dependência e o PR diz isso.

## Ajustes à divisão sugerida (justificados)
1. **Fundação cria os módulos vazios** (`products`, `sellers`, `catalog-import`) já registrados no `app.module.ts`. Assim as ondas 4 e 5 só mexem na pasta do próprio módulo e podem rodar em paralelo sem conflito.
2. **`products` lê os sellers do produto pela própria relação** (`ProductRepository.findByIdWithSellers`, com `include` de `sellerProducts.seller`), sem depender do módulo `sellers`. Isso permite paralelizar Sellers e Products. Registrado como D-024.
3. **Normalização e matching ficam em `modules/catalog-import/services/`** (`product-normalizer.service.ts`, `product-matching.service.ts`), serviços puros. A Onda 2 cria só esses arquivos e testes; a Onda 5 completa o módulo. O teste de consistência da migration importa o normalizer via alias. D-025.
4. **`docs/decisions.md` inicial (D-001…D-025) é escrito no bootstrap**, pois são decisões de planejamento já tomadas; isso cumpre "registrar antes de implementar" e evita conflito entre ondas. Novas decisões dos subagentes usam faixas reservadas: Onda 1 D-030+, Onda 2 D-040+, Onda 3 D-050+, Sellers D-060+, Products D-070+, Importação D-080+, Frontend D-090+, Docker D-100+.

## Passo 0 — Bootstrap (agente principal)
- Mover `catalog.db` → `database/catalog.db` (sem alterar conteúdo); copiar `carga.txt` → `database/fixtures/carga.json` e remover `carga.txt`.
- `.gitignore`: manter `.claude`, `.serena`; adicionar `node_modules`, `dist`, `.env`, `*.dev.db`, `coverage`.
- Escrever `docs/context.md` (requisitos fornecidos), `docs/plan.md` (este arquivo) e `docs/decisions.md` (D-001…D-025 no formato do `CLAUDE.md` §7).
- Commit `chore: bootstrap do repositório` + push de `main`.

- Criar `.nvmrc` com `26.13.1` na raiz.

Lista de decisões iniciais: D-001 significado do `Id` (com números) · D-002 tabela `Seller` · D-003 ids inteiros (uuid descartado) · D-004 `Product` × `SellerProduct` · D-005 `normalizedKey` marca+nome sem categoria · D-006 sem `ean` · D-007 reimportação idempotente (uniques) · D-008 seller criado pelo nome · D-009 `Id` texto livre · D-010 `externalId` obrigatório na importação/opcional no banco · D-011 item inválido rejeitado individualmente · D-012 duplicado no mesmo seller: vale o primeiro · D-013 versão oficial = primeiro seller · D-014 significado de `null` · D-015 `matchedBy` · D-016 traduções (limitação, evolução `similarity`) · D-017 sem autenticação · D-018 dedup do banco original na migration · D-019 backfill em SQL + teste de consistência · D-020 vínculos legados → `legacy`, `SellerProductId`→`externalId` · D-021 `brand`/`category` opcionais · D-022 `schema.prisma` escrito a partir da ctx §3 · D-023 localização dos arquivos (`database/`, `carga.json`) · D-024 products lê sellers pela relação · D-025 local do normalizer/matching.

## Subagentes

Todos: `isolation: "worktree"`, briefing fechado começando com **"Ative o skill `caveman` (`/caveman`) antes de tudo. Caveman só na comunicação; código, comentários, docs, commits e PR em português normal."** Cada briefing lista: objetivo, branch e base, arquivos/seções a ler, critério de pronto (CLAUDE.md §11 + itens da ctx §10 que se aplicam), formato do PR (ctx §9.4), proibição de push em `main` e de merge, push da branch + `gh pr create --base main`.

| Onda | Subagente | Branch (base) | Escopo | Lê | Modelo | Effort | Justificativa | Tam. |
|---|---|---|---|---|---|---|---|---|
| 1 | Fundação | `chore/foundation` (main) | Nest + Vite/React TS; aliases em tsconfig/Jest/jest-e2e/Vite; ESLint `no-restricted-imports` (`./*`,`../*`), `no-restricted-properties` (`$queryRawUnsafe`,`$executeRawUnsafe`), `no-restricted-syntax` (`Prisma.raw`); Jest + `jest-mock-extended`, Vitest + Testing Library + `vitest-mock-extended`; `shared/result`, `shared/errors` (`AppError`, mapa code→HTTP, `unwrapResult`, filtro global), `shared/prisma` (`PrismaModule` global, `PrismaService`, `TransactionManager` com rollback por `Result.error` + teste); Swagger em `/api/docs`; módulos vazios registrados; `.env.example`; `nest build && node dist/main` resolvendo aliases; **Node 26**: `"engines": { "node": ">=26" }` nos dois `package.json`, conferir que Nest, Prisma (CLI + engines), Jest/ts-jest, Vite e Vitest instalam e rodam em Node 26 (se alguma lib não suportar, registrar em D-030 e usar a versão mais nova que suporte) | CLAUDE.md §1–4, §5 (segurança), §6, §9, §10 | sonnet | medium | Scaffold seguindo padrão definido | G |
| 2 | Normalização e matching | `feat/matching` (foundation) | `ProductNormalizerService` (`normalize`, `buildKey(brand,name)` → `marca|nome`) e `ProductMatchingService` puro (decide `already_linked` / `normalized_key` / `new` / `duplicate_same_seller` a partir de dados recebidos); testes com todos os casos da ctx §8 (espaços, acento, `"`/`''`/sem aspas, maiúsculas, marca null, `Vacuum Cleaner Upright` × `Cordless`, `Levi's`) | CLAUDE.md §3, §9; ctx §4, §8 | opus | high | Regra central com muitos casos de borda | M |
| 3 | Banco | `feat/database` (matching) | Copiar banco para `catalog.dev.db`; `prisma db pull`; schema com `@map`/`@@map`; baseline `0_init` + `migrate resolve`; migration manual (`--create-only`) seguindo ctx §3 passos 1–7 (+ D-020), SQL de acentos antes de `lower()` cobrindo Latin-1 maiúsculo/minúsculo; índices; `schema.prisma` final = ctx §3; teste de consistência SQL×TS em todos os produtos, teste de contagens e `legacy`; `docs/database.md` com antes/depois | CLAUDE.md §5, §9; ctx §3, §4 (normalização); arquivos de `src/modules/catalog-import/services/product-normalizer*` | sonnet | high | Risco de corromper dados, backfill | G |
| 4 | Sellers | `feat/sellers` (database) | `SellerRepository` (`findByName`, `create`, `list`), `SellerProductRepository` (`findBySellerAndExternalId`, `findBySellerAndProduct`, `create`, `updateSellerData`, `listBySeller`) exportados pelo módulo; usecases `ListSellers`, `ListSellerProducts`; controller + Swagger + testes + `docs/modules/sellers.md` | CLAUDE.md §3, §5, §6, §7, §9; ctx §3, §5 | sonnet | medium | Módulo CRUD padrão | M |
| 4 | Products | `feat/products` (database) | `ProductRepository` (`findByNormalizedKey`, `create`, `search` paginado por nome/marca, `findByIdWithSellers`) exportado; usecases `ListProducts`, `GetProductDetail` (com sellers, dados enviados e `matchedBy`); controller + Swagger + testes + `docs/modules/products.md` | idem | sonnet | medium | Módulo CRUD padrão | M |
| 5 | Importação | `feat/catalog-import` (sellers + products) | Parser JSON (Result), validação por item, `ImportCatalogUseCase` com transação, upload multipart (`FileInterceptor`, já no `@nestjs/platform-express`), relatório com totais e itens; testes unitários da ctx §8; e2e: catálogo vazio (números exatos) e banco real (invariantes + reimportação estável, SQL injection gravado exato); `docs/modules/catalog-import.md` | CLAUDE.md §3, §5, §6, §9; ctx §2, §4, §5, §8, §10 | opus | high | Lógica central + integração e2e | G |
| 6 | Frontend | `feat/frontend` (catalog-import) | `src/api/` tipado; telas Importação (upload + relatório), Catálogo (busca + paginação), Detalhe (oficial + sellers com `matchedBy`); loading/erro/vazio; testes Vitest | CLAUDE.md §8, §9; ctx §7; DTOs de resposta | sonnet | medium | Telas seguindo padrão | M |
| 6 | Docs finais | `docs/final` (catalog-import) | `README.md`, `docs/architecture.md` (Mermaid), revisão de formato do `decisions.md` | CLAUDE.md §7; docs existentes | haiku | low | Mecânico a partir de material pronto | P |
| 7 | Revisão | — (só leitura) | Revisa todos os PRs contra CLAUDE.md, ctx e ctx §10; comenta com `gh pr review --comment`; não altera código | tudo | opus | medium | Revisor independente, novo | M |

| 8 | Docker | `chore/docker` (frontend + docs/final) | `backend/Dockerfile` multi-stage (`node:26-slim`, por causa do OpenSSL do Prisma): build, `prisma generate`, entrypoint que copia `database/catalog.db` para um volume na 1ª subida (nunca altera o original), roda `prisma migrate deploy` e inicia `node dist/main`; `frontend/Dockerfile` multi-stage (build Vite → `nginx:alpine` servindo estáticos e fazendo proxy de `/api` para o backend); `docker-compose.yml` na raiz com os 2 serviços, volume do banco, healthcheck do backend e portas `3000`/`8080`; `.dockerignore`; subir tudo com **`docker compose up --build`**; atualizar `README.md` com seção "Rodar com Docker" e "Rodar sem Docker" (instalar, `.env`, migrate, backend, frontend, testes, lint, Swagger, URLs, como resetar o banco); decisão D-100 (Docker fora da lista do `CLAUDE.md` §1, imagens escolhidas) | CLAUDE.md §1, §5, §7; `README.md`, `package.json`s, `vite.config.ts`, `.env.example` | sonnet | medium | Infra simples seguindo padrão; sem lógica de domínio | M |

Ondas 4 e 6 rodam em paralelo (pastas disjuntas). A Onda 8 vem por último, a pedido do usuário; depois dela, o revisor da Onda 7 é retomado (`SendMessage`, mesmo contexto) para revisar só o PR do Docker, mantendo a revisão independente. Ambiente local tem Docker 28.3.2 e Compose v2.39.1.

Retentativa: mesma config; só após 2ª falha sobe modelo/effort e registra aqui. Sem `fable`, `xhigh` ou `max`.

## Ciclo do agente principal
1. Bootstrap (Passo 0).
2. Para cada onda: lançar subagente(s) → conferir PR aberto, CI local (lint/build/test) relatado e escopo respeitado → se falha, retentar conforme regra → relatar ao usuário em uma linha.
3. Após a Onda 8 e a revisão dela: PR `docs/plan-report` atualizando a tabela abaixo (previsto × realizado).

## Previsto × realizado
Tokens = valor `subagent_tokens` informado pela ferramenta ao fim de cada execução (inclui o contexto acumulado). "Retomadas" são execuções extras do mesmo subagente para ajustes pedidos pelo agente principal ou pela revisão. Elas não são falhas, então não contam como retentativa.

| Onda | Subagente | PR | Previsto | Realizado | Retentativas | Retomadas | Tokens por execução |
|---|---|---|---|---|---|---|---|
| 1 | Fundação | #1 | sonnet · medium | sonnet · medium | 0 | 2 (encoding do eslint; 413, lockfiles e timeout da transação) | 114.871 · 116.421 · 125.408 |
| 2 | Normalização e matching | #2 | opus · high | opus · high | 0 | 0 | 102.096 |
| 3 | Banco | #3 | sonnet · high | sonnet · high | 0 | 0 (rebase em `feat/matching` feito na mesma execução) | 186.475 |
| 4 | Sellers | #4 | sonnet · medium | sonnet · medium | 0 | 1 (bloqueante da revisão: exemplos 400 do Swagger) | 106.173 · 95.515 |
| 4 | Products | #5 | sonnet · medium | sonnet · medium | 0 | 1 (bloqueantes da revisão: Swagger 400, mock do normalizer, D-070) | 91.473 · 92.857 |
| 5 | Importação | #6 | opus · high | opus · high | 0 | 2 (merge das correções da Fundação; bloqueante da revisão: mocks no spec do usecase) | 223.768 · 207.578 · 260.544 |
| 6 | Frontend | #8 | sonnet · medium | sonnet · medium | 0 | 0 | 99.175 |
| 6 | Docs finais | #7 | haiku · low | haiku · low | 0 | 0 | 118.199 |
| 7 | Revisão | — | opus · medium | opus · medium | 0 | 1 (revisão do PR #9) | 272.524 · 246.919 |
| 8 | Docker | #9 | sonnet · medium | sonnet · medium | 0 | 0 | 93.924 |

Nenhum subagente falhou, então nenhum modelo ou effort precisou subir. Não foram usados `fable`, `xhigh` nem `max`.

### Desvios em relação ao plano
- **Ondas 2 e 3 em paralelo** (pedido do usuário durante a execução). O contrato do `ProductNormalizerService` foi fixado nos dois briefings. A Onda 3 escreveu o teste de consistência contra o contrato e fez rebase em `feat/matching` assim que ela foi publicada. Resultado: 6 rodadas de subagentes em vez de 7.
- **Ondas 7 e 8 em paralelo.** A revisão só lê; o Docker escreve numa branch nova. O revisor foi retomado depois para revisar o PR #9.
- **Correções transversais** achadas pela Importação (código 413, lockfiles fora de sincronia, timeout de 5 s da transação interativa) foram devolvidas à Fundação, que é a dona de `shared/`, e depois incorporadas em `feat/catalog-import` e `chore/docker`.
- **PRs #7 e #8** nasceram de `feat/catalog-import` antes dessas correções. O PR #9 junta tudo, e todos apontam para `main`.
- **Incidente:** o subagente de docs rodou `git checkout -b` no checkout principal por engano e voltou para `main` em seguida. Conferido: `main` intacta, igual a `origin/main`, sem push.

### Resultado da revisão independente
| PR | Bloqueante | Importante | Sugestão | Situação |
|---|---|---|---|---|
| #1 | 0 | 0 | 2 | — |
| #2 | 0 | 0 | 0 | — |
| #3 | 0 | 0 | 1 | já coberto por D-052 |
| #4 | 1 | 0 | 3 | bloqueante corrigido (008dc0f) |
| #5 | 2 | 1 | 1 | corrigidos (310223a) |
| #6 | 1 | 0 | 2 | bloqueante corrigido (e0ae74d) |
| #7 | 0 | 1 | 3 | importante resolvido pelo #9 |
| #8 | 0 | 0 | 2 | — |
| #9 | 0 | 0 | 4 | — |

### Ordem sugerida de merge
#1 → #2 → #3 → #4 e #5 → #6 → #7 e #8 → #9 → este PR. Cada PR foi aberto contra `main`. Depois que o anterior entra, o GitHub mostra só o diff próprio. Conflitos esperados só em `docs/decisions.md` (manter as duas entradas, em ordem numérica).

## Verificação final
Tudo rodado em Node 26.13.1 (`node -v` antes).
- `cd backend && npm run lint && npm run build && npm test && npm run test:e2e`
- `cd frontend && npm run lint && npm run build && npx vitest run`
- e2e catálogo vazio: 269/0/201/56/1/11, 257 vínculos, 54 multi-seller.
- e2e banco real: nenhum `normalizedKey` nem vínculo repetido; reimportar não muda contagens; brand `TestBrand'; SELECT 1; --` gravado exato.
- `prisma migrate deploy` em cópia de `database/catalog.db` sem erro + teste de consistência passando.
- `docker compose up --build` na raiz sobe backend + frontend; `http://localhost:8080` abre o app e `http://localhost:3000/api/docs` o Swagger; `docker compose down -v` reseta o banco.
- Swagger em `http://localhost:3000/api/docs`; fluxo manual no frontend (upload → catálogo → detalhe com vários sellers).
