# [CLAUDE.md](http://CLAUDE.md)

Regras de código e de arquitetura deste projeto. O contexto do problema e as regras de negócio são passados separadamente. Leia tudo antes de escrever código.

---

## 1. Stack

| Camada    | Tecnologia                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------- |
| Banco     | SQLite                                                                                              |
| Backend   | NestJS + TypeScript                                                                                 |
| ORM       | Prisma (`prisma` + `@prisma/client`), provider `sqlite`                                             |
| Validação | `class-validator` + `class-transformer`                                                             |
| API docs  | `@nestjs/swagger` (Swagger UI em `/api/docs`)                                                       |
| Frontend  | React + TypeScript + Vite                                                                           |
| Testes    | Jest + `jest-mock-extended` (backend), Vitest + Testing Library + `vitest-mock-extended` (frontend) |

Não adicione bibliotecas fora desta lista sem justificar em `docs/decisions.md`.

---

## 2. Estrutura do repositório

```
/
├── CLAUDE.md
├── README.md                 # como rodar, visão geral, links para /docs
├── database/
│   ├── catalog.db            # banco original (NUNCA editar à mão)
│   └── fixtures/             # arquivos de exemplo usados em testes e no README
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # fonte única do modelo de dados
│   │   ├── migrations/       # migrations geradas pelo Prisma Migrate
│   │   └── seed.ts           # (opcional) dados extras de desenvolvimento
│   └── src/
│       ├── main.ts           # bootstrap + Swagger
│       ├── app.module.ts
│       ├── shared/
│       │   ├── prisma/       # PrismaModule (global) + PrismaService + TransactionManager
│       │   ├── result/       # tipo Result (Success / Error) + helpers
│       │   ├── errors/       # tipo base dos erros de negócio, mapeamento erro → HTTP, exception filter global
│       │   └── ...           # utilitários, config
│       └── modules/
│           ├── products/
│           ├── sellers/
│           └── catalog-import/
├── frontend/
│   └── src/
│       ├── api/              # cliente HTTP (tipos alinhados com os DTOs)
│       ├── features/         # uma pasta por funcionalidade
│       └── components/       # componentes reutilizáveis
└── docs/
    ├── architecture.md
    ├── database.md
    ├── decisions.md
    └── modules/
        └── <modulo>.md       # um arquivo por módulo do backend

```

---

## 3. Arquitetura modular do backend

Cada módulo de `backend/src/modules/<modulo>/` segue **exatamente** esta estrutura:

```
<modulo>/
├── <modulo>.module.ts
├── <modulo>.controller.ts
├── usecases/
│   └── <acao>.usecase.ts
├── services/
│   └── <nome>.service.ts
├── repositories/
│   └── <entidade>.repository.ts
├── consts/
│   ├── <modulo>.consts.ts              # valores fixos do módulo (limites, nomes de campo), tipados
│   └── <modulo>.swagger-examples.ts    # exemplos do Swagger, tipados com `satisfies` pelo contrato real
├── schemas/
│   ├── <entidade>.types.ts         # tipos de domínio do módulo (derivados dos tipos gerados pelo Prisma)
│   ├── <modulo>.errors.ts          # erros de negócio do módulo (usados no Result)
│   └── dto/
│       ├── <acao>.request.dto.ts
│       └── <acao>.response.dto.ts
└── __tests__/

```

### Responsabilidade de cada camada

| Camada         | Faz                                                                                                                                                                                         | Não faz                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Controller** | Recebe HTTP, valida o DTO, chama **um** usecase, converte o `Result` em resposta HTTP (sucesso → response DTO; erro → status HTTP). Decorators do Swagger.                                  | Regra de negócio, acesso a repository.                                                |
| **UseCase**    | Executa **uma** ação de negócio. O `execute()` só encadeia métodos privados; a regra fica nos métodos privados, que retornam `Result`. Controla a transação. Chama services e repositories. | Detalhe de HTTP, SQL direto, regra dentro do `execute()`, `throw` para erro esperado. |
| **Service**    | Lógica de domínio reutilizável e, de preferência, **pura** (ex.: normalização, parsing, regras de comparação).                                                                              | Acesso ao banco, conhecer request/response HTTP.                                      |
| **Repository** | **Único** lugar que usa o `PrismaService` para sua entidade. Consultas nomeadas pelo propósito (ex.: `findByEan`, `linkToSeller`). Aceita um client de transação opcional (`tx`).           | Regra de negócio.                                                                     |
| **Schema**     | Tipos de domínio do módulo e DTOs (contratos da API, com `class-validator` + `@ApiProperty`). O modelo das tabelas fica só no `prisma/schema.prisma`.                                       | Lógica.                                                                               |
| **Consts**     | Valores fixos do módulo usados em mais de um arquivo (limites, nomes de campo) e exemplos do Swagger dos controllers, sempre tipados (`as const`, `satisfies <TipoDeSaída>` ou `satisfies ErrorResponseBody`). | Lógica, objetos montados dentro de controller ou de decorator.                        |

### Regras de dependência

- `Controller → UseCase → (Service | Repository)`. Nunca o caminho inverso.
- Um usecase pode chamar repositories e services de outros módulos, desde que importados pelo `Module` deles (exportando o provider). Nunca importe o arquivo direto de outro módulo sem passar pelo `Module`.
- Services de domínio não recebem repository injetado. Recebem dados e devolvem dados, o que facilita o teste.
- Objetos do Prisma nunca saem na resposta da API. Sempre mapeie para um response DTO.
- Só repositories (e o `TransactionManager`) importam o `PrismaService`. Usecases, services e controllers nunca chamam `prisma.*` direto.

### Padrão Result (Success / Error)

Erros **esperados** (validação, registro não encontrado, conflito, regra de negócio violada) nunca são lançados com `throw`. Eles são **retornados** como um `Result`.

Tipo único em `shared/result/result.ts`:

```ts
export type ResultSuccess<T> = { readonly isSuccess: true; readonly isFailure: false; readonly value: T };
export type ResultError<E> = { readonly isSuccess: false; readonly isFailure: true; readonly error: E };
export type Result<T, E = AppError> = ResultSuccess<T> | ResultError<E>;

export const Result = {
  success: <T>(value: T): ResultSuccess<T> => ({ isSuccess: true, isFailure: false, value }),
  error: <E>(error: E): ResultError<E> => ({ isSuccess: false, isFailure: true, error }),
};

```

- Não crie uma classe chamada `Error`: ela esconde o `Error` nativo do JavaScript. Use `ResultError` e `Result.error()`.
- Erros de negócio são objetos tipados, com `code` (constante do módulo) e `message`, definidos em `schemas/<modulo>.errors.ts` a partir do tipo base `AppError` de `shared/errors`.
- `throw` fica reservado para erros **inesperados** (bug, banco fora do ar). Eles são tratados pelo exception filter global e viram 500.
- Services que podem falhar de forma esperada (ex.: parser de arquivo) também retornam `Result`. Services que não falham retornam o valor direto.
- Repositories retornam o dado ou `null`. Quem transforma `null` em `Result.error(...)` é o método privado do usecase. Se um repository precisar tratar uma violação de constraint (`P2002` do Prisma) como erro esperado, ele também retorna `Result`.

### Padrão UseCase: `execute()` sem regra

O `execute()` é só o **roteiro** do caso de uso: chama métodos privados em sequência e devolve o primeiro erro que aparecer. Toda regra fica nos métodos privados.

Regras:

- O `execute()` **não contém regra de negócio**: nada de validação, cálculo, loop, condição de domínio, chamada direta a repository ou service. O único `if` permitido é o de propagar erro: `if (x.isFailure) return x;`. Use sempre `isFailure` nessa checagem, nunca `!x.isSuccess`.
- Cada passo é um **método privado** do próprio usecase, com uma única responsabilidade e nome de ação (`validateInput`, `findSeller`, `persistItems`, `buildReport`).
- **Todo método privado retorna** `Result` (ou `Promise<Result>`). Nenhum método privado lança exceção para erro esperado.
- O `execute()` retorna `Promise<Result<Output, AppError>>`.
- Se o usecase usa transação, o `execute()` abre a transação e passa o `tx` para os métodos privados. A regra continua nos métodos privados.
- Se um método privado crescer demais ou for útil em outro usecase, a lógica pura vai para um service. O método privado continua existindo e passa a chamar o service.

Exemplo:

```ts
@Injectable()
export class CreateSellerUseCase {
  constructor(private readonly sellerRepository: SellerRepository) {}

  async execute(input: CreateSellerInput): Promise<Result<SellerOutput>> {
    const validated = this.validateInput(input);
    if (validated.isFailure) return validated;

    const available = await this.ensureNameIsAvailable(validated.value.sellerName);
    if (available.isFailure) return available;

    return this.createSeller(validated.value);
  }

  private validateInput(input: CreateSellerInput): Result<CreateSellerInput> {
    const sellerName = input.sellerName.trim();
    if (!sellerName) return Result.error(SellerErrors.invalidName());
    return Result.success({ ...input, sellerName });
  }

  private async ensureNameIsAvailable(sellerName: string): Promise<Result<void>> {
    const existing = await this.sellerRepository.findByName(sellerName);
    if (existing) return Result.error(SellerErrors.nameAlreadyExists(sellerName));
    return Result.success(undefined);
  }

  private async createSeller(input: CreateSellerInput): Promise<Result<SellerOutput>> {
    const seller = await this.sellerRepository.create(input);
    return Result.success({ id: seller.id, sellerName: seller.sellerName });
  }
}

```

### Do `Result` para o HTTP

- O controller chama o usecase e converte o resultado com um helper único de `shared/errors` (ex.: `unwrapResult(result)`): no sucesso devolve o valor mapeado para o response DTO; no erro lança a `HttpException` correspondente ao `code`.
- O mapeamento `code → status HTTP` fica **num lugar só** (`shared/errors`), não espalhado pelos controllers.
- Todo `code` de erro que um endpoint pode devolver aparece no Swagger (`@ApiResponse` com o status e um exemplo).

### Transações

- Operações que gravam em mais de uma tabela rodam em **uma transação**.
- Como só repositories usam o `PrismaService`, o usecase **não** chama `prisma.$transaction` direto. Ele injeta o `TransactionManager` de `shared/prisma`:

```ts
@Injectable()
export class TransactionManager {
  constructor(private readonly prisma: PrismaService) {}

  async run<T, E>(
    work: (tx: Prisma.TransactionClient) => Promise<Result<T, E>>,
  ): Promise<Result<T, E>> {
    // Executa work dentro de prisma.$transaction.
    // Se work retornar Result.error, lança um erro interno para forçar o rollback
    // e devolve o mesmo Result.error para quem chamou.
  }
}

```

- Quem abre a transação é o `execute()` **do usecase**, com `this.transactionManager.run(async (tx) => ...)`. Ele passa o `tx` para os métodos privados, que o repassam para os repositories.
- O rollback de um `Result.error` acontece **dentro** do `TransactionManager`. O `throw` interno usado para isso nunca sai dele, e o usecase continua sem `throw` para erro esperado.

### Convenções

- Arquivos em `kebab-case`, classes em `PascalCase`, sufixo obrigatório pela camada (`ImportCatalogUseCase`, `ProductNormalizerService`, `ProductRepository`, `ImportCatalogResponseDto`).
- Um usecase por arquivo, com um único método público: `execute(input): Promise<Result<Output>>`. Todos os outros métodos são `private`.
- Erros de negócio são retornados como `Result.error(...)` com erros tipados do módulo. Nunca com `throw`.
- Valores fixos de domínio (status, tipos, critérios) ficam numa constante/enum do TypeScript, nunca como string solta no código.
- Constantes e exemplos ficam em `consts/` do módulo, nunca declarados no controller ou em outro arquivo de camada:
  - `consts/<modulo>.consts.ts`: valores fixos usados em mais de um arquivo (ex.: limite de upload, nome do campo multipart, nomes de campo do arquivo de entrada).
  - `consts/<modulo>.swagger-examples.ts`: todo `example`/`examples` de `@ApiResponse`. Exemplo de sucesso usa `satisfies <Output do usecase>`; exemplo de erro usa `satisfies ErrorResponseBody` (de `@shared/errors/error-response.types`), com `statusCode` vindo de `HttpStatus` e `code` vindo do enum de erro. Assim o exemplo quebra o build se o contrato mudar.
  - Enums de domínio e de códigos de erro continuam em `schemas/` (`<entidade>.types.ts` e `<modulo>.errors.ts`). Constantes privadas de um único arquivo (ex.: regex de um service, `select` de um repository) podem ficar no próprio arquivo.
  - O `example` de cada campo no `@ApiProperty` dos DTOs continua no DTO.
- TypeScript em `strict`. Proibido `any` sem comentário justificando.

---

## 4. Imports com Path Alias

Todo import de arquivo do próprio projeto é feito por **path alias**, no backend e no frontend. **Proibido** usar caminho relativo (`./` ou `../`), inclusive para arquivos da mesma pasta.

```ts
// ✅ certo
import { Result } from '@shared/result/result';
import { SellerRepository } from '@modules/sellers/repositories/seller.repository';

// ❌ errado
import { Result } from '../../shared/result/result';
import { SellerRepository } from './repositories/seller.repository';

```

Pacotes externos (`@nestjs/common`, `@prisma/client`, `react`) continuam sendo importados normalmente.

### Aliases do backend

| Alias        | Aponta para     |
| ------------ | --------------- |
| `@modules/*` | `src/modules/*` |
| `@shared/*`  | `src/shared/*`  |
| `@test/*`    | `test/*`        |

### Aliases do frontend

| Alias           | Aponta para                                        |
| --------------- | -------------------------------------------------- |
| `@api/*`        | `src/api/*`                                        |
| `@features/*`   | `src/features/*`                                   |
| `@components/*` | `src/components/*`                                 |
| `@/*`           | `src/*` (para o que não se encaixa nos anteriores) |

### Configuração obrigatória

Os aliases precisam funcionar em **todos** os lugares onde o código roda. Configure tudo no começo do projeto, antes do primeiro módulo:

- **Backend:**
  - `tsconfig.json`: `baseUrl` + `paths`.
  - Build e runtime: confira que `nest build` seguido de `node dist/main` resolve os aliases. Se não resolver, use o `tsconfig-paths`, que já vem no projeto inicial do Nest.
  - Jest (unitário e e2e): `moduleNameMapper` com os mesmos aliases, tanto no `package.json` quanto no `test/jest-e2e.json`.
  - Prisma `seed.ts`, se existir: rodar com `tsconfig-paths` registrado.
- **Frontend:**
  - `tsconfig.json` / `tsconfig.app.json`: `baseUrl` + `paths`.
  - `vite.config.ts`: `resolve.alias` com os mesmos caminhos. O Vitest usa a mesma configuração.
- Os aliases do `tsconfig` e dos outros arquivos de configuração precisam ser **idênticos**. Ao criar um alias novo, atualize todos os lugares no mesmo commit.

### Garantia por lint

Adicione no ESLint do backend e do frontend a regra `no-restricted-imports` bloqueando os padrões `./*` e `../*`, com uma mensagem pedindo para usar o path alias. Import relativo deve quebrar o lint.

---

## 5. Banco de dados e Prisma

- O `schema.prisma` é fornecido pelo usuário. **Não invente nem altere o modelo de dados** sem que isso tenha sido pedido ou registrado em `docs/decisions.md`.
- **Nunca** edite `database/catalog.db` manualmente. Trabalhe sempre em uma **cópia** (ex.: `database/catalog.dev.db`) e mantenha o original intacto para comparação.
- `DATABASE_URL` no `.env` do backend aponta para a cópia (ex.: `file:../../database/catalog.dev.db`). Inclua um `.env.example`.
- **Partindo do banco existente (introspecção + baseline):**
  1. `npx prisma db pull` para gerar o `schema.prisma` a partir das tabelas reais.
  2. Ajustar o schema gerado: nomes de models em `PascalCase` e campos em `camelCase`, usando `@map` / `@@map` para manter os nomes reais das tabelas e colunas. Conferir as relações. Se o `db pull` marcar alguma tabela com `@@ignore` por falta de chave única, resolver isso numa migration e registrar a decisão.
  3. Criar a migration inicial de baseline (`prisma migrate diff --from-empty --to-schema-datamodel ... --script` em `migrations/0_init/migration.sql`) e marcá-la como aplicada com `prisma migrate resolve --applied 0_init`.
- Toda alteração de schema depois disso é feita no `schema.prisma` e gerada com `npx prisma migrate dev --name <descricao>`. **Proibido** usar `prisma db push` fora de experimentos descartáveis.
- Depois de mudar o schema, rode `npx prisma generate` e confira o SQL gerado na migration antes de aplicar.
- Mudanças que o Prisma não gera corretamente sozinho (ex.: migração de dados) são feitas com `prisma migrate dev --create-only` e o SQL editado à mão, sempre com verificação de contagem antes e depois.
- Crie índices nas colunas usadas em buscas frequentes.
- **Limitações do SQLite no Prisma:** `mode: 'insensitive'` não funciona e `createMany({ skipDuplicates })` não é suportado. Para comparar textos sem diferenciar maiúsculas e acentos, grave uma coluna já normalizada e compare nela. Para evitar duplicatas, use `upsert` ou verifique antes de inserir, sempre com uma constraint `unique` no banco como garantia final.

### Segurança: SQL injection

A proteção contra SQL injection vem de **queries parametrizadas**, nunca de validar, filtrar ou "limpar" o texto de entrada. Validação de formato não é proteção: um campo de texto livre aceita qualquer coisa, inclusive `'; DROP TABLE ...`.

- As operações normais do Prisma Client (`create`, `findUnique`, `findMany`, `upsert`, `update`...) já são parametrizadas. Use sempre elas.
- **Proibido:** `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw()` com qualquer valor vindo de fora e SQL montado por concatenação ou interpolação de strings.
- Se uma query manual for realmente necessária, use `$queryRaw` / `$executeRaw` com **template literal** (`prisma.$queryRaSELECT ... WHERE x = ${valor}`), que o Prisma parametriza. Registre o motivo em `docs/decisions.md`.
- **Não remova nem escape caracteres** dos dados para "proteger" o banco. Aspas, ponto e vírgula e hífens são dados legítimos (ex.: `Levi's`) e são gravados exatamente como chegaram. Transformações no texto só existem para regras de negócio (ex.: colunas normalizadas para comparação), nunca por segurança.
- Validação com `class-validator` (tipo, obrigatoriedade, tamanho máximo) é uma camada extra contra dados absurdos, não a proteção contra injection.
- **Garantia por lint:** adicione no ESLint do backend a regra `no-restricted-properties` bloqueando `$queryRawUnsafe` e `$executeRawUnsafe`, e `no-restricted-syntax` bloqueando `Prisma.raw`, com uma mensagem apontando esta seção.
- Todo fluxo que grava texto vindo de fora tem um teste com um valor malicioso (ex.: `"x'; SELECT 1; --"`) verificando que ele foi gravado com o texto exato e que o banco continua íntegro.

---

## 6. Swagger

- Configurado em `main.ts` com `DocumentBuilder`: título, descrição e versão. UI em `/api/docs`, JSON em `/api/docs-json`.
- **Todo** endpoint precisa ter: `@ApiTags('<modulo>')`, `@ApiOperation({ summary })`, `@ApiResponse` para sucesso e para os erros possíveis.
- **Todo** DTO precisa ter `@ApiProperty` / `@ApiPropertyOptional` com `description` e `example`.
- Upload de arquivo: `@ApiConsumes('multipart/form-data')` + `@ApiBody` descrevendo o campo `file`.
- Swagger é parte da entrega. Endpoint sem documentação Swagger está incompleto.

---

## 7. Documentação em `/docs`

### Por módulo: `docs/modules/<modulo>.md`

Todo módulo novo ou alterado **precisa** ter seu arquivo atualizado no mesmo trabalho. Modelo:

```md
# Módulo: <nome>

## Responsabilidade
O que o módulo faz e o que não faz.

## Endpoints
| Método | Rota | Descrição | Request | Response |

## Fluxo
Passo a passo do(s) usecase(s), de preferência com um diagrama Mermaid.

## Regras de negócio
Lista das regras aplicadas.

## Componentes
UseCases, Services, Repositories e Schemas, com uma linha sobre cada um.

## Decisões relacionadas
Links para as entradas D-00X em decisions.md.

## Testes
O que está coberto.

```

### Decisões: `docs/decisions.md`

Toda decisão de design (escolha entre alternativas, alteração no banco, biblioteca nova, interpretação de um requisito) vira uma entrada neste formato:

```md
## D-00X — <título>
**Contexto:** o que motivou a decisão.
**Opções consideradas:** A, B, C (prós e contras).
**Decisão:** o que foi escolhido.
**Consequências:** o que essa escolha implica e o que ficaria diferente em produção.

```

Nunca tome uma decisão desse tipo em silêncio. Se algo não estiver definido, **pare, registre e siga com a opção mais conservadora**.

### Documentos gerais

- `docs/architecture.md`: visão geral, diagrama das camadas e dos módulos, fluxo principal de ponta a ponta.
- `docs/database.md`: schema original, schema final, diferenças e migrations aplicadas.
- `README.md`: como instalar, rodar backend e frontend, rodar testes, abrir o Swagger e exemplos de uso.

---

## 8. Frontend (React)

- Chamadas HTTP só em `src/api/`. Componentes não chamam `fetch` direto.
- Tipos do frontend espelham os response DTOs do backend.
- Uma pasta por funcionalidade em `src/features/`, com seus componentes, hooks e estilos. Componentes usados em mais de uma funcionalidade vão para `src/components/`.
- Estado de carregamento, erro e vazio em todas as telas.
- Dados vindos da API são sempre renderizados como texto pelo JSX, que já escapa o conteúdo. **Proibido** `dangerouslySetInnerHTML` com qualquer dado vindo do backend.
- Sem bibliotecas de UI pesadas sem justificativa. CSS simples ou CSS Modules basta.

---

## 9. Testes

- **Services de domínio:** testes unitários cobrindo os casos de borda.
- **Usecases:** testes unitários de cada caminho (sucesso, cada tipo de falha, idempotência quando se aplica), com as dependências mockadas.
- **Mocks sempre com** `mockDeep` **e** `DeepMockProxy` do `jest-mock-extended` (no frontend, do `vitest-mock-extended`, que tem a mesma API). Proibido mock manual com objeto literal, `jest.fn()` solto para dependências inteiras ou `as any`.
  - Cada dependência é declarada como `DeepMockProxy<Tipo>` e criada com `mockDeep<Tipo>()` no `beforeEach`, para que os mocks não vazem de um teste para outro.
  - O usecase é instanciado direto com `new`, recebendo os mocks no construtor. Use `Test.createTestingModule` só quando o teste depender da injeção de dependência do Nest.
  - Nos testes de usecase, mocke os **repositories**, os **services** e o `TransactionManager`, nunca o Prisma.
  - Para o `TransactionManager`, faça o mock executar o callback: `transactionManager.run.mockImplementation((work) => work(tx))`, com `tx` sendo um `mockDeep<Prisma.TransactionClient>()`.
  - Testes unitários de repository, quando existirem, usam `mockDeep<PrismaService>()`.
- Exemplo:

```ts
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('CreateSellerUseCase', () => {
  let sut: CreateSellerUseCase;
  let sellerRepository: DeepMockProxy<SellerRepository>;

  beforeEach(() => {
    sellerRepository = mockDeep<SellerRepository>();
    sut = new CreateSellerUseCase(sellerRepository);
  });

  it('retorna erro quando o nome do seller já existe', async () => {
    sellerRepository.findByName.mockResolvedValue({ id: 1, sellerName: 'Loja A' } as Seller);

    const result = await sut.execute({ sellerName: 'Loja A' });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) expect(result.error.code).toBe(SellerErrorCode.NAME_ALREADY_EXISTS);
    expect(sellerRepository.create).not.toHaveBeenCalled();
  });
});

```

- Os testes verificam o `Result`: `isSuccess` / `isFailure`, o `value` no sucesso e o `error.code` em cada falha. Não use `expect(...).toThrow()` para erros esperados.
- Os testes chamam só o `execute()`. Métodos privados são testados por meio dele, nunca acessados diretamente.
- **e2e:** ao menos um teste por endpoint principal, usando um banco SQLite temporário (copiar o banco original para um arquivo temporário, apontar `DATABASE_URL` para ele e rodar `prisma migrate deploy` antes dos testes).
- Arquivos de exemplo usados nos testes ficam em `database/fixtures/`.

---

## 10. Fluxo de trabalho do agente

1. Ler este arquivo e o contexto fornecido pelo usuário. 1.1. Criar os projetos (backend e frontend) já com os path aliases, o `moduleNameMapper` do Jest, o `resolve.alias` do Vite e a regra de lint configurados (seção 4).
2. Inspecionar o banco, rodar o `prisma db pull`, criar a baseline e escrever `docs/database.md`.
3. Registrar em `docs/decisions.md` as decisões necessárias **antes** de implementar a lógica que depende delas.
4. Implementar o backend módulo a módulo: `schema.prisma` + migration (se precisar) → schemas/DTOs → repository → service → usecase → controller → Swagger → testes → `docs/modules/<modulo>.md`.
5. Implementar o frontend.
6. Atualizar `README.md` e `docs/architecture.md`.
7. Conferir a definição de pronto.

Commits pequenos, com mensagens no formato `tipo(modulo): descrição` (ex.: `feat(catalog-import): add file parser`).

---

## 11. Definição de pronto

Uma tarefa só está concluída quando:

- [ ] Segue a estrutura `usecase / service / repository / schema` do módulo e as regras de dependência.
- [ ] O `execute()` de cada usecase só encadeia métodos privados, e todos eles retornam `Result`.
- [ ] Nenhum erro esperado é lançado com `throw` fora do usecase.
- [ ] Todos os imports internos usam path alias (nenhum `./` ou `../`).
- [ ] Nenhuma query usa `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw()` ou SQL concatenado, e os fluxos que gravam texto de fora têm teste com valor malicioso.
- [ ] Endpoints e DTOs documentados no Swagger, com exemplos.
- [ ] `docs/modules/<modulo>.md` criado ou atualizado.
- [ ] Decisões novas registradas em `docs/decisions.md`.
- [ ] Alterações de banco feitas via `prisma migrate dev`, com a migration commitada e descrita em `docs/database.md`.
- [ ] Testes escritos e passando.
- [ ] Lint e build sem erros.