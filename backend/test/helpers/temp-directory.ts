import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Pasta única com todos os bancos temporários dos testes e2e. */
export const TEST_TEMP_ROOT = join(tmpdir(), 'vtex-catalog-e2e');

export function createTempDirectory(prefix: string): string {
  mkdirSync(TEST_TEMP_ROOT, { recursive: true });
  return mkdtempSync(join(TEST_TEMP_ROOT, prefix));
}

/**
 * Tenta apagar a pasta na hora. No Windows o driver libsql só solta o arquivo do banco
 * quando o processo termina, então um `EPERM` aqui é esperado: o `globalTeardown`
 * apaga o que sobrou depois que os workers do Jest saem (D-110).
 */
export function removeTempDirectory(directory: string): void {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 2 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
  }
}
