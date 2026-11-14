import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Roda no processo principal do Jest, depois que os workers (e seus handles) fecharam.
 * O `globalTeardown` não passa pelo `moduleNameMapper`, então o caminho é repetido aqui:
 * precisa ser igual a `TEST_TEMP_ROOT` de `@test/helpers/temp-directory`.
 */
export default function globalTeardown(): void {
  rmSync(join(tmpdir(), 'vtex-catalog-e2e'), {
    recursive: true,
    force: true,
    maxRetries: 5,
  });
}
