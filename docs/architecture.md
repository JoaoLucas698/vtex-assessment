# Arquitetura

## Visão geral

O backend é uma API NestJS organizada em módulos (`backend/src/modules/`), com camadas fixas dentro de cada módulo: **Controller → UseCase → Service ou Repository**. O acesso ao banco fica só nos repositories (e no `TransactionManager`), que usam o `PrismaService` sobre um SQLite. Os erros esperados não são lançados: voltam como um `Result`, que o controller converte em resposta HTTP.

Os módulos são `catalog-import` (importação do arquivo de carga), `products` (catálogo e detalhe com sellers) e `sellers` (sellers e seus produtos). O `shared/` tem o que todos usam: `Result`, mapa de erros para HTTP, `TransactionManager` e `PrismaService`.

O frontend (React + Vite) só chama a API a partir de `src/api/`. Regras e decisões estão em `docs/context.md` e `docs/decisions.md`.

## Camadas

```mermaid
flowchart TD
    HTTP[Requisição HTTP] --> C[Controller<br/>valida DTO, chama 1 usecase,<br/>unwrapResult]
    C --> U[UseCase<br/>execute só encadeia métodos privados]
    U --> S[Service<br/>lógica pura, sem banco]
    U --> R[Repository<br/>único uso do PrismaService<br/>da sua entidade]
    U --> T[TransactionManager<br/>abre a transação]
    T --> R
    R --> P[(PrismaService<br/>SQLite)]
```

| Camada | Faz | Não faz |
|---|---|---|
| Controller | Recebe HTTP, valida DTO, converte o `Result` em resposta | Regra de negócio, acesso a repository |
| UseCase | Executa uma ação; regra nos métodos privados, que devolvem `Result` | SQL direto, `throw` para erro esperado |
| Service | Lógica de domínio pura (normalização, matching, relatório) | Banco, conhecer HTTP |
| Repository | Consultas nomeadas pelo propósito, aceita `tx` opcional | Regra de negócio |

## Módulos e dependências

```mermaid
flowchart LR
    CI[catalog-import] -->|importa SellersModule| SE[sellers]
    CI -->|importa ProductsModule| PR[products]
    PR -.->|ProductNormalizerService registrado<br/>também em products, D-070| CI
    SE --- SH[shared]
    PR --- SH
    CI --- SH
```

- `catalog-import` importa `sellers` (para `SellerRepository` e `SellerProductRepository`) e `products` (para `ProductRepository`). Pelo `Module` de cada um, nunca pelo arquivo.
- `products` lê os sellers de um produto pela própria relação (`findByIdWithSellers`, D-024), então não depende de `sellers`.
- `ProductNormalizerService` é o service puro da regra de chave (D-025). `products` também o registra no próprio módulo para a busca (D-070).
- `shared/` não conhece módulo nenhum: guarda o mapa `code → HTTP` (cada módulo registra os seus, D-032).

## Fluxo de ponta a ponta: importação

```mermaid
sequenceDiagram
    actor Cliente
    participant Ctrl as CatalogImportController
    participant UC as ImportCatalogUseCase
    participant Parser as CatalogFileParserService
    participant TM as TransactionManager
    participant Rep as Repositories (sellers, products)
    participant Match as ProductMatchingService
    participant Rel as ImportReportService

    Cliente->>Ctrl: POST /api/catalog-import (multipart, campo file)
    Ctrl->>UC: execute(arquivo)
    UC->>Parser: parse(arquivo)
    Parser-->>UC: itens válidos e inválidos (com motivo)
    UC->>TM: run(tx => processa os itens válidos em ordem)
    loop cada item válido
        UC->>Rep: seller por nome (cache, findByName ou create)
        UC->>Rep: vínculo por sellerId + externalId
        UC->>Rep: produto por normalizedKey
        UC->>Rep: vínculo do seller com o produto
        UC->>Match: decide(dados buscados)
        Match-->>UC: ALREADY_LINKED, LINK_EXISTING, CREATE_PRODUCT ou DUPLICATE_SAME_SELLER
        UC->>Rep: grava conforme a decisão (com tx)
    end
    TM-->>UC: commit (ou rollback se houver erro inesperado)
    UC->>Rel: build(inválidos + processados, ordem do arquivo)
    Rel-->>UC: totais e linhas
    UC-->>Ctrl: Result.success(relatório)
    Ctrl-->>Cliente: 200 ImportCatalogResponseDto
```

Pontos do fluxo:

- Item inválido (`Id`, `SellerName` ou `Name` vazios, tipo errado) não entra na transação: é só reportado com o motivo (D-011, D-082).
- A deduplicação dentro do arquivo vem da ordem: o item 50 encontra o produto criado pelo item 3, porque os dois rodam na mesma transação (D-080).
- Erro esperado de arquivo (JSON inválido, array vazio, arquivo ausente) responde 400 antes de abrir a transação (D-081).
- Detalhes das regras de matching estão em `docs/modules/catalog-import.md` e em `docs/decisions.md` (D-005, D-012, D-040).

## Padrão Result

Tipo único em `backend/src/shared/result/result.ts`: `ResultSuccess<T>` ou `ResultError<E>`, com `isSuccess`/`isFailure`, `value` ou `error`. Erro de negócio é um objeto tipado com `code` e `message`, definido em `schemas/<modulo>.errors.ts`.

- Usecase: `execute()` devolve `Promise<Result<Output, AppError>>` e só encadeia métodos privados. Cada método privado devolve `Result`. A única condicional do `execute()` é `if (x.isFailure) return x;`.
- Controller: `unwrapResult(result)` (em `shared/errors/`) devolve o valor mapeado para o response DTO no sucesso. No erro, lança a `HttpException` do `code`, consultando o mapa `code → HTTP` (D-032). Código sem registro vira 500.
- `throw` fica para erro inesperado (bug, banco fora do ar). O `all-exceptions.filter.ts` global trata esses casos.

## Transação

Operações que gravam em mais de uma tabela rodam numa transação só. O usecase não chama `prisma.$transaction`: ele injeta o `TransactionManager` de `shared/prisma/`, que executa o trabalho dentro da transação e faz rollback quando o trabalho devolve `Result.error`.

Na importação, a transação cobre o arquivo inteiro (D-080). Um erro inesperado desfaz tudo e responde 500, então nenhuma importação parcial fica gravada. Reimportar o mesmo arquivo não altera contagens (D-007): as constraints `unique` do banco são a garantia final.

## Referências

- Banco e migrations: [`database.md`](database.md)
- Módulos: [`modules/catalog-import.md`](modules/catalog-import.md), [`modules/products.md`](modules/products.md), [`modules/sellers.md`](modules/sellers.md)
- Decisões: [`decisions.md`](decisions.md)
