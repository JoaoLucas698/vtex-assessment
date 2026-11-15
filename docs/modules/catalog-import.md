# Módulo: catalog-import

## Responsabilidade

Recebe o arquivo JSON de carga (`database/fixtures/carga.json` é o exemplo real), valida cada item e consolida os itens válidos no catálogo **sem duplicar produtos**: cria o seller na primeira aparição, liga o item a um produto existente quando a chave normalizada bate, cria o produto quando não bate, e devolve um relatório com o resultado de cada item.

A regra de identificação de duplicatas fica isolada em dois services puros:

- `ProductNormalizerService`: gera o `normalizedKey` (`<marca>|<nome>`) usado para reconhecer o mesmo produto entre sellers;
- `ProductMatchingService`: aplica a ordem de verificação de cada item válido e devolve uma decisão (criar produto, ligar a produto existente, já vinculado, duplicado no mesmo seller).

O que o módulo **não** faz:

- não acessa `Product`, `Seller` nem `SellerProduct` direto: usa os repositories exportados por `ProductsModule` e `SellersModule`;
- não "limpa" os dados do seller: o texto é gravado exatamente como veio (D-082); a normalização serve só para a chave;
- não valida o formato do `Id` (D-009) nem o tipo MIME do arquivo (D-083);
- não sobrescreve o `Product` oficial com dados de seller (D-013);
- não une traduções (D-016).

## Endpoints

| Método | Rota | Descrição | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/catalog-import` | Importa o arquivo e consolida no catálogo, numa única transação. | `multipart/form-data` com o campo `file` (JSON, até 5 MB) | `200` `ImportCatalogResponseDto`; `400` `FILE_REQUIRED` / `INVALID_FILE` / `EMPTY_FILE`; `413` arquivo acima de 5 MB |

Exemplo:

```bash
curl -F "file=@database/fixtures/carga.json" http://localhost:3000/api/catalog-import
```

### Formato do relatório (`ImportCatalogResponseDto`, D-085)

```json
{
  "totals": {
    "read": 269,
    "invalid": 0,
    "created": 201,
    "linkedExisting": 56,
    "alreadyLinked": 1,
    "duplicateSameSeller": 11
  },
  "items": [
    {
      "index": 0,
      "externalId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "sellerName": "MegaStore",
      "name": "Smartphone Galaxy S23",
      "outcome": "created",
      "productId": 1,
      "matchedBy": "new",
      "reason": null
    }
  ]
}
```

| Campo | Tipo | Significado |
|---|---|---|
| `totals.read` | number | Itens do array (válidos ou não). `read = invalid + created + linkedExisting + alreadyLinked + duplicateSameSeller`. |
| `totals.invalid` | number | Itens rejeitados na validação. |
| `totals.created` | number | Itens que criaram produto (`matchedBy = new`). |
| `totals.linkedExisting` | number | Itens ligados a produto existente (`matchedBy = normalized_key`). |
| `totals.alreadyLinked` | number | Reenvios do mesmo `Id` pelo mesmo seller (dados do seller atualizados). |
| `totals.duplicateSameSeller` | number | Mesmo produto, mesmo seller, outro `Id`: nada gravado. |
| `items[].index` | number | Posição do item no array (começa em 0). Itens na ordem do arquivo. |
| `items[].externalId` / `sellerName` / `name` | string \| null | Texto recebido; `null` quando ausente ou não-texto. |
| `items[].outcome` | `created` \| `linked_existing` \| `already_linked` \| `duplicate_same_seller` \| `invalid` | Resultado do item. |
| `items[].productId` | number \| null | Produto ligado ao item; em duplicado, o produto que já tem o vínculo; `null` em inválido. |
| `items[].matchedBy` | `new` \| `normalized_key` \| `legacy` \| null | Critério do vínculo; em `already_linked`, o do vínculo existente; `null` em inválido e duplicado. |
| `items[].reason` | string \| null | Motivo legível, só em `invalid` e `duplicate_same_seller`. |

### Erros

| Status | `code` | Quando |
|---|---|---|
| 400 | `FILE_REQUIRED` | Nenhum arquivo no campo `file`. |
| 400 | `INVALID_FILE` | Conteúdo não é JSON (inclusive vazio) ou não é array. `details` traz a mensagem do parser. |
| 400 | `EMPTY_FILE` | Array sem itens (D-081). |
| 413 | (filtro global) | Arquivo acima de 5 MB, recusado pelo multer (D-083). |

Os códigos `FILE_REQUIRED`, `INVALID_FILE` e `EMPTY_FILE` são registrados com `registerErrorStatuses` em `schemas/catalog-import.errors.ts` (D-032).

## Fluxo

```mermaid
flowchart TD
    U[POST /api/catalog-import<br/>multipart, campo file] --> C[CatalogImportController]
    C --> E[ImportCatalogUseCase.execute]
    E --> F{arquivo presente?}
    F -- não --> X1[FILE_REQUIRED 400]
    F -- sim --> P[CatalogFileParserService.parse]
    P --> J{JSON válido e array<br/>com itens?}
    J -- não --> X2[INVALID_FILE / EMPTY_FILE 400]
    J -- sim --> S[itens separados:<br/>válidos e inválidos com motivo]
    S --> T[[transactionManager.run tx]]
    T --> L[para cada item válido, em ordem]
    L --> SE[seller pelo nome<br/>cache ou findByName ou create]
    SE --> M[lookup: findBySellerAndExternalId<br/>senão buildKey + findByNormalizedKey<br/>e findBySellerAndProduct]
    M --> D[ProductMatchingService.decide]
    D --> A{decisão}
    A -- ALREADY_LINKED --> A1[updateSellerData]
    A -- LINK_EXISTING --> A2[cria SellerProduct<br/>normalized_key]
    A -- CREATE_PRODUCT --> A3[cria Product + SellerProduct<br/>new]
    A -- DUPLICATE_SAME_SELLER --> A4[nada gravado]
    A1 & A2 & A3 & A4 --> L
    L -- fim --> R[ImportReportService.build<br/>inválidos + processados, ordem do arquivo]
    R --> OK[200 relatório]
```

Passo a passo do `execute()` (só encadeia métodos privados, cada um devolvendo `Result`):

1. `ensureFileIsPresent`: sem arquivo → `FILE_REQUIRED`.
2. `parseFile`: chama o parser. JSON inválido ou não-array → `INVALID_FILE`; array vazio → `EMPTY_FILE`. Cada item vira válido ou inválido (com motivo).
3. `transactionManager.run((tx) => processValidItems(...))`: processa os válidos **em ordem e um a um**, na mesma transação (D-080). Para cada item, `processItem` encadeia:
   - `resolveSeller`: cache por nome (D-084), senão `findByName`, senão `create` (D-008);
   - `lookupMatchInput`: vínculo por `(sellerId, externalId)`; se não houver, `buildKey` + `findByNormalizedKey` e, se houver produto, `findBySellerAndProduct` (D-040);
   - `decide`: `ProductMatchingService.decide`;
   - `applyDecision`: grava conforme a decisão (`updateExistingLink`, `linkToExistingProduct`, `createProductAndLink`, `reportDuplicate`).
4. `buildReport`: junta inválidos e processados na ordem do arquivo e calcula os totais.

A deduplicação dentro do arquivo vem do passo 3: o produto criado pelo item 3 já é encontrado pela chave quando o item 50 é processado, porque os dois rodam na mesma transação, em sequência.

Decisão do matching para um item válido:

```mermaid
flowchart TD
    A[Item válido + seller] --> B{Existe SellerProduct com<br/>o mesmo sellerId + externalId?}
    B -- sim --> C[ALREADY_LINKED<br/>atualiza dados do seller<br/>relatório: already_linked]
    B -- não --> D[buildKey brand, name]
    D --> E{Existe Product com<br/>o mesmo normalizedKey?}
    E -- não --> F[CREATE_PRODUCT<br/>cria Product + SellerProduct<br/>matchedBy = new<br/>relatório: created]
    E -- sim --> G{O seller já está ligado<br/>a esse Product?}
    G -- sim --> H[DUPLICATE_SAME_SELLER<br/>não grava nada, vale o primeiro externalId<br/>relatório: duplicate_same_seller]
    G -- não --> I[LINK_EXISTING<br/>cria SellerProduct<br/>matchedBy = normalized_key<br/>relatório: linked_existing]
```

## Regras de negócio

### Validação do arquivo e dos itens (D-009, D-011, D-081, D-082)

- O arquivo precisa ser um array JSON com pelo menos um item. Um BOM do UTF-8 no início é ignorado.
- Item **inválido** (rejeitado e reportado, sem derrubar a importação):
  - `Id`, `SellerName` ou `Name` ausentes, `null`, não-texto ou vazios após trim;
  - `Brand` ou `Category` presentes com tipo diferente de texto ou `null`;
  - item que não é objeto JSON.
- O motivo lista todos os problemas do item, ex.: `Id ausente. Name vazio.`
- `Brand` e `Category` ausentes ou `null` são gravados como `null` (D-014).
- O formato do `Id` não é validado: `ddddeee-ffff-...` é aceito.
- O trim é usado só para validar. O valor gravado é o original (`Levi's` continua `Levi's`; `TestBrand'; SELECT 1; --` é gravado com o texto exato). A proteção contra SQL injection vem das queries parametrizadas do Prisma, não da validação.

### Seller (D-008, D-084)

- Encontrado pelo `sellerName` exato ou criado na primeira aparição. Cache por nome durante a importação.

### Normalização (D-005)

`ProductNormalizerService.normalize(text)` aplica, nesta ordem:

1. remove acentos: `text.normalize('NFD')` e remoção das marcas combinantes (`\p{M}`), ex.: `Câmera` → `Camera`;
2. converte para minúsculas;
3. remove todas as aspas simples e duplas, incluindo o `''` usado como polegada (`12.9"`, `12.9''` e `12.9` ficam iguais);
4. troca qualquer sequência de whitespace (`\s+`: espaço, tab, quebra de linha) por um espaço e faz `trim()`.

`null`, `undefined` e texto vazio viram `''`.

`ProductNormalizerService.buildKey(brand, name)` devolve `<marca normalizada>|<nome normalizado>`:

- marca `null`, `undefined` ou vazia gera `|<nome normalizado>` (ex.: `|cable organizer kit`);
- o separador `|` impede que uma marca vazia colida com uma marca preenchida (`|organizer kit` ≠ `organizer|kit`);
- **a categoria não entra na chave**, porque varia entre sellers para o mesmo produto (`Photography` × `Photo`).

A mesma regra é replicada em SQL no backfill da migration (D-019). Por isso ela não pode ganhar passos novos sem mudar o SQL e recalcular as chaves no mesmo PR.

### Ordem de verificação (D-012, D-015, D-040)

| Ordem | Condição | Decisão | Gravação | `matchedBy` | Resultado |
|---|---|---|---|---|---|
| 0 | já existe vínculo com o mesmo `(sellerId, externalId)` | `ALREADY_LINKED` | atualiza `name`, `brand`, `category` do vínculo | (mantém o do vínculo) | `already_linked` |
| 1a | existe `Product` com o mesmo `normalizedKey` e o seller já está ligado a ele | `DUPLICATE_SAME_SELLER` | nada | — | `duplicate_same_seller` |
| 1b | existe `Product` com o mesmo `normalizedKey` e o seller não está ligado a ele | `LINK_EXISTING` | cria `SellerProduct` | `normalized_key` | `linked_existing` |
| 2 | nenhum `Product` com a chave | `CREATE_PRODUCT` | cria `Product` (dados do seller) + `SellerProduct` | `new` | `created` |

- O passo 0 tem prioridade: o matching nem roda.
- A decisão é **por seller**: o mesmo `Id` em sellers diferentes não conflita.
- Duplicado no mesmo seller: vale o primeiro `externalId` recebido; o segundo não é guardado (D-012). Um vínculo legado sem `externalId` também conta como vínculo existente.
- O vínculo sempre guarda o que o seller enviou (D-014); o `Product` criado leva os dados do primeiro seller e nunca é sobrescrito (D-013).

### Transação e idempotência (D-007, D-080)

- Todos os itens válidos rodam numa transação só. Erro inesperado desfaz o arquivo inteiro (500).
- Reimportar o mesmo arquivo não muda nenhuma contagem: os itens já gravados caem em `already_linked` e os duplicados continuam `duplicate_same_seller`. As constraints `UNIQUE (productId, sellerId)`, `UNIQUE (sellerId, externalId)` e `UNIQUE (normalizedKey)` são a garantia final.

### Limitação conhecida: traduções (D-016)

`"Roteador WiFi 6 TP-Link"` × `"Router WiFi 6 TP-Link"` e `"Processador AMD Ryzen 9 7950X"` × `"Processor AMD Ryzen 9 7950X"` geram chaves diferentes e viram produtos separados. É melhor criar um produto novo do que unir dois produtos diferentes. Evolução possível: passo de similaridade restrito à mesma marca e aos mesmos códigos de modelo, com `matchedBy = "similarity"`. Não implementado.

## Componentes

| Componente | Arquivo | Papel |
|---|---|---|
| `CatalogImportModule` | `catalog-import.module.ts` | Importa `SellersModule` e `ProductsModule`; registra controller, services e usecase. |
| `CatalogImportController` | `catalog-import.controller.ts` | `POST /api/catalog-import` com `FileInterceptor` (campo `file`, 5 MB). Chama o usecase e converte o `Result` com `unwrapResult`. Swagger completo. |
| `ImportCatalogUseCase` | `usecases/import-catalog.usecase.ts` | Roteiro da importação: arquivo → parse → transação com os itens válidos em ordem → relatório. |
| `CatalogFileParserService` | `services/catalog-file-parser.service.ts` | `JSON.parse`, exige array não vazio, valida cada item e separa válidos/inválidos com motivo. Devolve `Result`. |
| `ProductNormalizerService` | `services/product-normalizer.service.ts` | Normaliza texto e monta o `normalizedKey`. Puro. |
| `ProductMatchingService` | `services/product-matching.service.ts` | Decide o destino de um item a partir dos dados buscados (`decide`) e converte em resultado do relatório (`toOutcome`). Puro. |
| `ImportReportService` | `services/import-report.service.ts` | Monta as linhas do relatório e os totais, na ordem do arquivo. Puro. |
| `SellerRepository`, `SellerProductRepository` | módulo `sellers` | Busca/criação de seller e de vínculo, atualização dos dados do seller. Sempre com o `tx`. |
| `ProductRepository` | módulo `products` | Busca por `normalizedKey` e criação do produto. Sempre com o `tx`. |
| Tipos de domínio | `schemas/catalog-import.types.ts` | Enums `MatchedBy`, `ImportItemOutcome`, `MatchDecisionType`; `MatchInput`, `MatchDecision`; itens do arquivo, relatório. |
| Constantes | `consts/catalog-import.consts.ts` | Limite de 5 MB do upload, nome do campo multipart (`file`) e nomes dos campos de cada item (`CatalogItemField`) (D-038). |
| Exemplos do Swagger | `consts/catalog-import.swagger-examples.ts` | Relatório da resposta 200 (`satisfies ImportCatalogOutput`) e exemplos de 400 e 413 (`satisfies ErrorResponseBody`) (D-038). |
| Erros | `schemas/catalog-import.errors.ts` | `FILE_REQUIRED`, `INVALID_FILE`, `EMPTY_FILE` (400), registrados no mapa de status. |
| DTOs | `schemas/dto/import-catalog.request.dto.ts`, `import-catalog.response.dto.ts` | Campo `file` para o Swagger; relatório (`totals`, `items`). |

## Decisões relacionadas

- [D-038](../decisions.md#d-038--pasta-consts-por-módulo-para-constantes-e-exemplos-do-swagger) — constantes e exemplos do Swagger em `consts/`.
- [D-005](../decisions.md#d-005--critério-de-mesmo-produto-normalizedkey--marca--nome-normalizados) — critério de "mesmo produto".
- [D-007](../decisions.md#d-007--reimportação-idempotente) — reimportação idempotente.
- [D-008](../decisions.md#d-008--seller-criado-automaticamente-pelo-sellername) — seller criado pelo nome.
- [D-009](../decisions.md#d-009--id-é-texto-livre-sem-validação-de-formato) — `Id` texto livre.
- [D-011](../decisions.md#d-011--item-inválido-rejeitado-individualmente) — item inválido rejeitado individualmente.
- [D-012](../decisions.md#d-012--mesmo-produto-enviado-duas-vezes-pelo-mesmo-seller-vale-o-primeiro) — duplicado no mesmo seller.
- [D-013](../decisions.md#d-013--versão-oficial-do-product-é-a-do-primeiro-seller) — versão oficial do produto.
- [D-014](../decisions.md#d-014--significado-de-null-nos-campos-do-seller) — `null` nos campos do seller.
- [D-015](../decisions.md#d-015--registrar-o-critério-de-match-matchedby) — `matchedBy`.
- [D-016](../decisions.md#d-016--traduções-não-são-unidas-limitação-conhecida) — traduções.
- [D-019](../decisions.md#d-019--backfill-do-normalizedkey-em-sql--teste-de-consistência) — regra replicada em SQL.
- [D-025](../decisions.md#d-025--normalização-e-matching-no-módulo-catalog-import) — localização dos services.
- [D-032](../decisions.md#d-032--mapa-único-code--http-com-registro-por-módulo) — registro dos códigos de erro.
- [D-040](../decisions.md#d-040--formato-da-decisão-do-matching) — formato da decisão do matching.
- [D-080](../decisions.md#d-080--uma-transação-para-o-arquivo-inteiro-itens-em-ordem) — uma transação para o arquivo inteiro.
- [D-081](../decisions.md#d-081--arquivo-inválido-arquivo-vazio-e-bom) — arquivo inválido, vazio e BOM.
- [D-082](../decisions.md#d-082--trim-só-na-validação-texto-gravado-exatamente-como-veio) — trim só na validação.
- [D-083](../decisions.md#d-083--upload-multipart-com-limite-de-5-mb) — upload com limite de 5 MB.
- [D-084](../decisions.md#d-084--cache-de-sellers-por-nome-durante-a-importação) — cache de sellers.
- [D-085](../decisions.md#d-085--formato-do-relatório-da-importação) — formato do relatório.

## Testes

Unitários, em `backend/src/modules/catalog-import/__tests__/`:

- `product-normalizer.service.spec.ts`: `null`/`undefined`/vazio, espaços duplos, tabs e quebras de linha, acentos (inclusive texto já decomposto), maiúsculas, aspas de polegada, idempotência, marca `null`/vazia → `|nome`, categoria fora da chave, `Levi's` → `levis` só na chave, chave determinística para `TestBrand'; SELECT 1; --`, pares que **não** são o mesmo produto.
- `product-matching.service.spec.ts`: cada ramo da decisão, prioridade do `ALREADY_LINKED`, duplicado no mesmo seller (inclusive vínculo legado sem `externalId`), mesmo `Id` em sellers diferentes, conversão `toOutcome`.
- `carga-matching-simulation.spec.ts`: simulação em memória da importação do `carga.json` com catálogo vazio.
- `catalog-file-parser.service.spec.ts`: JSON quebrado, vazio, só espaços, não-array (objeto, número, texto, `null`), array vazio, BOM, cada motivo de item inválido, textos preservados (espaços, `Levi's`), campos extras ignorados, `Id` fora do UUID e SQL injection aceitos.
- `import-report.service.spec.ts`: ordem por `index`, totais por resultado, linha de item inválido.
- `import-catalog.usecase.spec.ts` (repositories, os 4 services e `TransactionManager` com `mockDeep`; o comportamento real dos services fica nos specs deles e no e2e): `FILE_REQUIRED` sem chamar o parser; erros do parser (`INVALID_FILE`, `EMPTY_FILE`) devolvidos sem abrir transação; o que o usecase passa a `buildKey`, `decide`, `toOutcome` e ao relatório; produto novo (`new`) dentro da transação; produto existente por chave (`normalized_key`); reenvio do mesmo `externalId` (atualiza dados, não roda matching); mesmo `Id` em sellers diferentes (dois vínculos); mesmo produto duas vezes no mesmo seller (vale o primeiro); dedupe dentro do arquivo entre sellers; `Id` fora do UUID; item sem `Id`/`SellerName`/`Name` e com tipo errado (motivo); vários motivos no mesmo item; `Brand: null`; SQL injection gravado com o texto exato; `Levi's` e espaços preservados; seller criado automaticamente e reaproveitado pelo cache; seller existente reutilizado.

e2e, em `backend/test/catalog-import/catalog-import.e2e-spec.ts` (upload real com supertest de `database/fixtures/carga.json`):

- **Catálogo vazio** (banco novo criado só com `prisma migrate deploy`): 269 lidos, 0 inválidos, 201 criados, 56 `normalized_key`, 1 já vinculado, 11 duplicados; 201 produtos, 257 vínculos, 20 sellers, 54 produtos com mais de 1 seller; nada repetido.
- **Banco fornecido** (cópia migrada de `database/catalog.db`): parte de 975 produtos e 0 vínculos; 3 criados, 254 `normalized_key`, 1 já vinculado, 11 duplicados; 978 produtos, 257 vínculos, 20 sellers, 54 produtos com mais de 1 seller; nenhum `normalizedKey`, `(productId, sellerId)` ou `(sellerId, externalId)` repetido; brand `TestBrand'; SELECT 1; --` gravado com o texto exato (MegaStore) e `PRAGMA integrity_check = ok`; `Levi's` gravado sem alteração; reimportar não muda nenhuma contagem e o 2º relatório tem 258 `already_linked` e 11 `duplicate_same_seller`.
- **Arquivo rejeitado**: JSON quebrado → 400 `INVALID_FILE` sem gravar nada; JSON objeto → 400 `INVALID_FILE`; `[]` → 400 `EMPTY_FILE`; sem arquivo → 400 `FILE_REQUIRED`; acima de 5 MB → 413; itens inválidos rejeitados individualmente com motivo e válidos importados.
