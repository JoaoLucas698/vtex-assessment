import { execFileSync } from 'node:child_process';
import {
  createTempDirectory,
  removeTempDirectory,
} from '@test/helpers/temp-directory';
import { join, resolve } from 'node:path';

const BACKEND_ROOT = resolve(__dirname, '..', '..');
const PRISMA_CLI = join(
  BACKEND_ROOT,
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

/**
 * Banco SQLite novo, num arquivo temporário, criado só com `prisma migrate deploy`
 * (catálogo vazio). Usado para conferir os números de `docs/context.md` §8 sem
 * influência dos 975 produtos do banco fornecido.
 */
export class EmptyDatabase {
  private constructor(
    private readonly directory: string,
    readonly path: string,
  ) {}

  static create(): EmptyDatabase {
    const directory = createTempDirectory('catalog-import-empty-');
    const database = new EmptyDatabase(
      directory,
      join(directory, 'catalog.empty.db'),
    );
    execFileSync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: database.url },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return database;
  }

  get url(): string {
    return `file:${this.path.replaceAll('\\', '/')}`;
  }

  cleanup(): void {
    removeTempDirectory(this.directory);
  }
}
