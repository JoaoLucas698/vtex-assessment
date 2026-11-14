# Decisões de design

Registro das decisões do projeto, no formato definido no `CLAUDE.md` §7. As entradas D-001 a D-025 foram tomadas no planejamento, antes de qualquer implementação. Novas decisões usam a faixa reservada de cada etapa (ver `docs/plan.md`): Fundação D-030+, Matching D-040+, Banco D-050+, Sellers D-060+, Products D-070+, Importação D-080+, Frontend D-090+, Docker D-100+.

---

## D-001 — Significado do `Id` do arquivo de carga
**Contexto:** o arquivo traz um campo `Id` por item. A análise de `database/fixtures/carga.json` mostrou: 269 itens, 20 sellers, 14 `Id`s repetidos (13 entre sellers diferentes para produtos totalmente diferentes, ex.: `00112233-4455-4667-7889-900112233445` é "Curtain Rod" na GardenStore e "Bookshelf" na SportsHub; 1 no mesmo seller, `e5e5e5e5-...` na GardenStore para "Câmera Canon EOS R6" e "Camera Canon EOS R6"), 3 `Id`s fora do formato UUID, e o mesmo produto nunca chega com o mesmo `Id` em sellers diferentes.
**Opções consideradas:** A) `Id` como identificador global do produto (unique sozinho) — quebra a importação por causa dos 13 repetidos entre sellers; B) `Id` como chave primária do nosso banco — mistura identificador externo com interno e exige trocar os ids inteiros; C) `Id` como código do produto **na loja do seller**, guardado em `externalId` e único só por seller.
**Decisão:** C. O `Id` é o identificador do produto no escopo do seller, guardado como `SellerProduct.externalId`, com unicidade `(sellerId, externalId)`. Não é usado para achar duplicatas entre sellers.
**Consequências:** a deduplicação entre sellers depende só dos dados do produto (D-005). Um seller pode reenviar o mesmo `Id` e isso é tratado como reenvio (idempotência, D-007).

## D-002 — Criar a tabela `Seller`
**Contexto:** o banco fornecido guarda o seller como texto (`SellerProduct.SellerName`). O arquivo também só traz o nome.
**Opções consideradas:** A) manter o nome como texto no vínculo — simples, mas repete o nome em cada linha e não permite listar sellers de forma limpa; B) tabela `Seller` com `sellerName` único e FK inteira no vínculo.
**Decisão:** B.
**Consequências:** a migration cria `Seller` a partir dos nomes distintos da tabela original. Renomear um seller passa a ser uma atualização de uma linha.

## D-003 — Manter ids inteiros (uuid descartado)
**Contexto:** as tabelas fornecidas usam `INTEGER PRIMARY KEY AUTOINCREMENT`.
**Opções consideradas:** A) trocar para uuid — exige recriar as tabelas no SQLite (não altera tipo de coluna nem gera uuid nativamente), refazer FKs e conferir vínculos; ganho pequeno sem autenticação nem exposição pública; B) manter inteiros e não renumerar.
**Decisão:** B. Princípio: só alterar o banco fornecido onde for necessário. `Seller` segue o mesmo padrão.
**Consequências:** ids previsíveis na API. Em produção com exposição pública, ids opacos poderiam ser reconsiderados.

## D-004 — Separar produto oficial (`Product`) dos dados enviados por seller (`SellerProduct`)
**Contexto:** cada seller manda o mesmo produto com variações (espaços, acentos, categoria).
**Opções consideradas:** A) guardar só o produto, descartando o que cada seller mandou — perde rastreabilidade; B) `Product` com a versão oficial e `SellerProduct` com o vínculo e os dados exatamente como o seller enviou.
**Decisão:** B.
**Consequências:** a tela de detalhe mostra a consolidação: um produto oficial e as variações de cada seller.

## D-005 — Critério de "mesmo produto": `normalizedKey` = marca + nome normalizados
**Contexto:** variações observadas: espaços duplos, acento, aspas de polegada (`"`, `''`, sem aspas), maiúsculas, categoria diferente (`Photography` × `Photo`), tradução.
**Opções consideradas:** A) comparação exata — não une quase nada; B) chave normalizada de marca + nome, sem categoria; C) similaridade fuzzy — risco de unir produtos diferentes.
**Decisão:** B. Normalização, nesta ordem: remove acentos, minúsculas, remove `"` e `'`, junta espaços e faz trim. Chave `<marca>|<nome>`; marca nula/vazia vira `|<nome>`. Categoria fora da chave. Coluna `Product.normalizedKey` com `UNIQUE`.
**Consequências:** a garantia contra duplicata fica no banco, não só no código. Traduções não são unidas (D-016). Mudar a regra exige recalcular as chaves com nova migration.

## D-006 — Sem coluna `ean`
**Contexto:** EAN seria o identificador ideal entre lojas, mas o arquivo não traz.
**Opções consideradas:** A) criar `ean` nullable para o futuro; B) não criar.
**Decisão:** B. Coluna nunca preenchida não deve existir.
**Consequências:** se os sellers passarem a mandar EAN, entra uma migration e o EAN vira o primeiro passo do matching.

## D-007 — Reimportação idempotente
**Contexto:** o mesmo arquivo pode ser enviado de novo.
**Opções consideradas:** A) controle só no código; B) código + constraints `UNIQUE (productId, sellerId)` e `UNIQUE (sellerId, externalId)`.
**Decisão:** B.
**Consequências:** reimportar não muda contagens; o banco barra duplicatas mesmo com bug no código.

## D-008 — Seller criado automaticamente pelo `sellerName`
**Contexto:** o arquivo só traz o nome do seller; não há cadastro prévio.
**Opções consideradas:** A) exigir cadastro antes e rejeitar itens de seller desconhecido; B) encontrar pelo nome ou criar na primeira aparição.
**Decisão:** B. A comparação do nome é exata (sem normalização), por ser o identificador que o próprio seller usa.
**Consequências:** um erro de digitação no nome cria um seller novo. Em produção, o seller viria autenticado.

## D-009 — `Id` é texto livre, sem validação de formato
**Contexto:** 3 `Id`s não são UUID (`ddddeee-ffff-...`, `09835342345-...`, `uddd0000-...`).
**Opções consideradas:** A) validar UUID e rejeitar; B) aceitar qualquer texto não vazio.
**Decisão:** B. Cada seller define seu código.
**Consequências:** os 3 itens são importados normalmente.

## D-010 — `externalId` obrigatório na importação, opcional no banco
**Contexto:** vínculos criados pelo arquivo sempre têm `Id`; vínculos antigos podem não ter.
**Opções consideradas:** A) `NOT NULL` no banco — impede representar vínculos legados sem código; B) nullable no banco, obrigatório na validação da importação.
**Decisão:** B. No SQLite, vários `NULL` não violam o índice único.
**Consequências:** a regra "obrigatório" vive na validação do item (D-011).

## D-011 — Item inválido rejeitado individualmente
**Contexto:** um item ruim não deve impedir os outros.
**Opções consideradas:** A) abortar o arquivo inteiro; B) rejeitar só o item e reportar o motivo.
**Decisão:** B. Inválido = `Id`, `SellerName` ou `Name` ausentes ou vazios (após trim). `Brand` e `Category` podem ser `null`.
**Consequências:** o relatório lista cada item rejeitado com o motivo. No arquivo atual, 0 inválidos.

## D-012 — Mesmo produto enviado duas vezes pelo mesmo seller: vale o primeiro
**Contexto:** 11 casos no arquivo (ex.: "Basketball Spalding Official" e "Basketball Spalding  Official" na OfficeSupply, com `Id`s diferentes).
**Opções consideradas:** A) criar dois vínculos — viola `UNIQUE (productId, sellerId)`; B) sobrescrever com o último; C) manter o primeiro e reportar os demais.
**Decisão:** C. Reportado como "duplicado no mesmo seller".
**Consequências:** o segundo `externalId` não é guardado. Se o seller depois reenviar só esse segundo `Id`, ele cai de novo em "duplicado no mesmo seller".

## D-013 — Versão oficial do `Product` é a do primeiro seller
**Contexto:** quando vários sellers mandam o mesmo produto, alguém define o texto oficial.
**Opções consideradas:** A) sobrescrever a cada importação; B) primeiro seller que criou; C) curadoria manual.
**Decisão:** B. O `Product` nunca é sobrescrito por dados de seller.
**Consequências:** o oficial pode ficar com a grafia de quem chegou primeiro (ex.: espaço duplo). Curadoria manual seria a evolução.

## D-014 — Significado de `null` nos campos do seller
**Contexto:** `SellerProduct.brand`/`category` podem ser nulos.
**Opções consideradas:** A) `null` = "igual ao oficial"; B) `null` = "não veio no arquivo".
**Decisão:** B. O vínculo guarda sempre o que o seller enviou, mesmo igual ao oficial.
**Consequências:** sem ambiguidade na leitura; um pouco de redundância.

## D-015 — Registrar o critério de match (`matchedBy`)
**Contexto:** é preciso auditar por que cada vínculo existe.
**Opções consideradas:** A) não registrar; B) coluna obrigatória com valores `new`, `normalized_key`, `legacy`.
**Decisão:** B, com os valores numa constante/enum TypeScript.
**Consequências:** uma evolução (`similarity`, D-016) só adiciona um valor.

## D-016 — Traduções não são unidas (limitação conhecida)
**Contexto:** "Roteador WiFi 6 TP-Link" × "Router WiFi 6 TP-Link" e "Processador AMD Ryzen 9 7950X" × "Processor AMD Ryzen 9 7950X" são o mesmo produto.
**Opções consideradas:** A) dicionário de traduções; B) similaridade fuzzy; C) aceitar a limitação.
**Decisão:** C. É melhor criar um produto novo do que unir dois diferentes.
**Consequências:** esses pares viram produtos separados. Evolução: passo de similaridade restrito à mesma marca e aos mesmos códigos de modelo (tokens com dígitos, como `7950x`, `wifi 6`), com `matchedBy = "similarity"`. Não implementado.

## D-017 — Sem autenticação de sellers
**Contexto:** o enunciado não pede login.
**Opções consideradas:** A) autenticação; B) fora do escopo.
**Decisão:** B.
**Consequências:** qualquer cliente pode importar em nome de qualquer seller. Em produção, o seller viria do token.

## D-018 — Duplicatas do banco original tratadas na migration
**Contexto:** a constraint única em `normalizedKey` falharia se o banco original tivesse duplicatas. A inspeção mostrou **0 grupos de duplicata** nos 975 produtos.
**Opções consideradas:** A) assumir que não há e não tratar; B) tratar genericamente: canônico = menor `id`, redireciona vínculos, remove vínculo repetido de menor prioridade, remove produtos duplicados.
**Decisão:** B, mesmo sem efeito no banco atual.
**Consequências:** a migration funciona em qualquer cópia do banco; os números (hoje zero) vão para `docs/database.md`.

## D-019 — Backfill do `normalizedKey` em SQL + teste de consistência
**Contexto:** produtos existentes precisam da chave antes da constraint.
**Opções consideradas:** A) script TypeScript separado — a migration não fica autocontida; B) backfill em SQL na migration, replicando a normalização, com teste que recalcula em TypeScript e compara.
**Decisão:** B. Acentos trocados antes do `lower()` (que no SQLite só converte ASCII).
**Consequências:** a regra existe em dois lugares; o teste de consistência é obrigatório e mudanças na regra exigem migration nova.

## D-020 — Vínculos legados viram `SellerProduct` com `matchedBy = 'legacy'`, e `SellerProductId` vira `externalId`
**Contexto:** a tabela original `SellerProduct (Id, SellerName, ProductId, SellerProductId INTEGER NOT NULL)` tem uma coluna `SellerProductId` que parece ser o código do produto na loja do seller — o mesmo papel do `Id` do arquivo. O requisito original dizia `externalId = null` para legados. A tabela tem **0 linhas** hoje.
**Opções consideradas:** A) `externalId = null`, perdendo a coluna; B) `externalId = CAST(SellerProductId AS TEXT)`.
**Decisão:** B, aprovada pelo usuário no planejamento. Preserva o dado e permite que um reenvio do seller com esse código seja reconhecido como "já vinculado".
**Consequências:** sem efeito no banco atual. Como a tabela original não guarda nome/marca/categoria do seller, esses campos são copiados do `Product` no caso geral.

## D-021 — `brand` e `category` opcionais no `Product`
**Contexto:** o arquivo traz `Brand: null` (3 itens) e o banco original tem 119 marcas e 34 categorias nulas.
**Opções consideradas:** A) obrigatórios com valor padrão ("Unknown") — inventa dado; B) opcionais.
**Decisão:** B.
**Consequências:** a chave usa marca vazia (`|nome`).

## D-022 — `schema.prisma` escrito a partir da modelagem do contexto
**Contexto:** o requisito dizia que o `schema.prisma` final seria fornecido, mas ele não está no repositório.
**Opções consideradas:** A) esperar o arquivo; B) escrever exatamente a modelagem de `docs/context.md` §3.
**Decisão:** B, aprovada pelo usuário.
**Consequências:** nenhum campo além dos definidos em `docs/context.md` §3.

## D-023 — Localização dos arquivos fornecidos
**Contexto:** o banco e a carga vieram na raiz (`catalog.db`, `carga.txt`).
**Opções consideradas:** A) deixar na raiz; B) seguir a estrutura do `CLAUDE.md` §2.
**Decisão:** B. `database/catalog.db` (cópia byte a byte, conferida com 975 produtos) e `database/fixtures/carga.json` (conteúdo idêntico ao `carga.txt`).
**Consequências:** o banco original continua intacto; o desenvolvimento usa `database/catalog.dev.db` (ignorado no git).

## D-024 — Módulo `products` lê os sellers do produto pela própria relação
**Contexto:** o detalhe do produto precisa listar os sellers. O `CLAUDE.md` diz que um repository é o único lugar que acessa sua entidade.
**Opções consideradas:** A) `products` usa o `SellerProductRepository` do módulo `sellers` — cria dependência e impede desenvolver os dois em paralelo; B) `ProductRepository.findByIdWithSellers` lê o agregado do produto com `include` da relação.
**Decisão:** B. É uma leitura do agregado `Product`; nenhuma escrita em `SellerProduct` sai do módulo `sellers`.
**Consequências:** os módulos ficam independentes. A importação continua usando `SellerProductRepository` para gravar vínculos.

## D-025 — Normalização e matching no módulo `catalog-import`
**Contexto:** a regra precisa estar isolada num service único e ser usada pela importação e pelo teste de consistência da migration.
**Opções consideradas:** A) `shared/`; B) módulo `products`; C) `modules/catalog-import/services/` (`ProductNormalizerService`, `ProductMatchingService`), serviços puros.
**Decisão:** C. A importação é o único fluxo que aplica a regra.
**Consequências:** o teste de consistência importa o normalizer pelo alias `@modules/catalog-import/...`. Se outro módulo precisar da regra, o service é exportado pelo `CatalogImportModule`.

## D-030 — Versões das dependências do backend no Node 26
**Contexto:** o projeto roda em Node 26.13.1. O `nest new` mais recente gera o Nest 12 com Vitest e oxlint, mas o `CLAUDE.md` §1 manda Jest, `jest-mock-extended` e ESLint. O `@nestjs/swagger@12` exige `@nestjs/common@12` como peer, e o Prisma 7 muda a configuração do datasource (`prisma.config.ts`, sem `url` no schema).
**Opções consideradas:** A) Nest 12 + Vitest/oxlint do template — foge da stack do `CLAUDE.md`; B) Nest 11 (template com Jest + ESLint) com `@nestjs/swagger@11`; C) Prisma 7 — exige reescrever o padrão `url = env("DATABASE_URL")` descrito no `CLAUDE.md` §5.
**Decisão:** B, com Prisma 6 (`prisma` e `@prisma/client` 6.19.x). Instalação, `prisma generate`, engines, Jest/ts-jest e Nest build/start foram conferidos e funcionam em Node 26.13.1. `"engines": { "node": ">=26" }` nos `package.json`.
**Consequências:** migrar para Nest 12 e Prisma 7 é uma evolução futura e independente. Em produção convém fixar as versões com o lockfile.

## D-031 — Resolução dos path aliases no build e no runtime (backend)
**Contexto:** o `CLAUDE.md` §4 exige aliases `@modules/*`, `@shared/*`, `@test/*` em build, runtime e testes. O `main.ts` precisa importar o `AppModule` (que fica em `src/app.module.ts`, fora desses aliases).
**Opções consideradas:** A) `tsconfig-paths/register` no `node dist/main`; B) deixar o `nest build` reescrever os aliases no JS emitido; C) bundler.
**Decisão:** B. O `nest build` (tsc com o plugin de paths do Nest CLI) reescreve os aliases para caminhos relativos em `dist/`, então `node dist/main` roda sem hook. Conferido: `npm run build` seguido de `node dist/main` sobe e responde `/api/docs-json`. O `tsconfig-paths` continua instalado para scripts (ex.: `seed.ts`). Foi adicionado o alias extra `@/*` → `src/*`, usado apenas por `main.ts` e pelos e2e para importar `@/app.module`; ele consta em `tsconfig.json`, Jest e `jest-e2e.json`.
**Consequências:** nenhum passo extra no start. Se o build mudar para bundler, revisar a resolução.

## D-032 — Mapa único `code → HTTP` com registro por módulo
**Contexto:** o `CLAUDE.md` §3 exige o mapeamento de erro para HTTP num lugar só, mas cada módulo define seus próprios códigos.
**Opções consideradas:** A) objeto central com todos os códigos — acopla `shared` aos módulos; B) cada módulo registra seus códigos num registro central em `shared/errors`.
**Decisão:** B. `shared/errors/error-http-status.ts` guarda o `Map` (com `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` de base) e expõe `registerErrorStatuses({...})`; cada módulo o chama no topo do seu `schemas/<modulo>.errors.ts`. `unwrapResult` consulta o mapa; code sem registro vira 500.
**Consequências:** o mapeamento continua num único mecanismo e o `shared` não conhece os módulos. O registro acontece no import do arquivo de erros, que o usecase já importa.

## D-033 — Ferramentas do frontend: ESLint e TypeScript 5.9
**Contexto:** o template atual do Vite (react-ts) vem com oxlint e TypeScript 7. O `CLAUDE.md` §4 exige ESLint com `no-restricted-imports`, e o `typescript-eslint` ainda não suporta o TypeScript 7.
**Opções consideradas:** A) manter oxlint e TypeScript 7 — foge da regra de lint por ESLint e não há garantia de suporte do ecossistema; B) trocar para ESLint 9 + `typescript-eslint` com TypeScript 5.9.
**Decisão:** B. Vitest 5 com `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` e `vitest-mock-extended`. `@testing-library/user-event` foi instalado junto como apoio aos testes de interação das próximas telas (faz parte do ecossistema do Testing Library). Conferido em Node 26.13.1: lint, build e testes passam.
**Consequências:** migrar para o TypeScript 7 quando o `typescript-eslint` o suportar.
