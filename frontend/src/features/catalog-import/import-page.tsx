import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { catalogApi } from '@api/catalog-api';
import { ImportOutcome } from '@api/types';
import type { ImportCatalogResponse, ImportItem } from '@api/types';
import { Badge } from '@components/badge';
import type { BadgeTone } from '@components/badge';
import { errorText } from '@components/error-text';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import styles from '@features/catalog-import/import-page.module.css';
import { routeHref } from '@/hooks/use-hash-route';

const OUTCOME_LABEL: Record<ImportOutcome, string> = {
  [ImportOutcome.CREATED]: 'Criados',
  [ImportOutcome.LINKED_EXISTING]: 'Ligados a existente',
  [ImportOutcome.ALREADY_LINKED]: 'Já ligados',
  [ImportOutcome.DUPLICATE_SAME_SELLER]: 'Duplicados do mesmo seller',
  [ImportOutcome.INVALID]: 'Inválidos',
};

const OUTCOME_TONE: Record<ImportOutcome, BadgeTone> = {
  [ImportOutcome.CREATED]: 'success',
  [ImportOutcome.LINKED_EXISTING]: 'info',
  [ImportOutcome.ALREADY_LINKED]: 'neutral',
  [ImportOutcome.DUPLICATE_SAME_SELLER]: 'warning',
  [ImportOutcome.INVALID]: 'danger',
};

const ALL = 'all';
type Filter = ImportOutcome | typeof ALL;

type UploadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; report: ImportCatalogResponse };

function totalCards(report: ImportCatalogResponse): { label: string; value: number }[] {
  const t = report.totals;
  return [
    { label: 'Lidos', value: t.read },
    { label: OUTCOME_LABEL[ImportOutcome.CREATED], value: t.created },
    { label: OUTCOME_LABEL[ImportOutcome.LINKED_EXISTING], value: t.linkedExisting },
    { label: OUTCOME_LABEL[ImportOutcome.ALREADY_LINKED], value: t.alreadyLinked },
    { label: OUTCOME_LABEL[ImportOutcome.DUPLICATE_SAME_SELLER], value: t.duplicateSameSeller },
    { label: OUTCOME_LABEL[ImportOutcome.INVALID], value: t.invalid },
  ];
}

function ItemRow({ item }: { item: ImportItem }) {
  return (
    <tr>
      <td>{item.index}</td>
      <td>
        <Badge tone={OUTCOME_TONE[item.outcome]}>{item.outcome}</Badge>
      </td>
      <td>{item.sellerName ?? '—'}</td>
      <td>
        {item.productId !== null ? (
          <a href={routeHref.product(item.productId)}>{item.name ?? `Produto ${item.productId}`}</a>
        ) : (
          (item.name ?? '—')
        )}
      </td>
      <td>{item.externalId ?? '—'}</td>
      <td>{item.matchedBy ?? '—'}</td>
      <td>{item.reason ?? ''}</td>
    </tr>
  );
}

function Report({ report }: { report: ImportCatalogResponse }) {
  const [filter, setFilter] = useState<Filter>(ALL);
  const items = filter === ALL ? report.items : report.items.filter((i) => i.outcome === filter);

  return (
    <section aria-label="Relatório da importação">
      <h2>Relatório</h2>
      <ul className={styles.cards}>
        {totalCards(report).map((card) => (
          <li key={card.label} className={styles.card} data-testid={`total-${card.label}`}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </li>
        ))}
      </ul>
      <label>
        Filtrar por resultado{' '}
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value={ALL}>Todos</option>
          {Object.values(ImportOutcome).map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome}
            </option>
          ))}
        </select>
      </label>
      {items.length === 0 ? (
        <StatusMessage kind="empty">Nenhum item para este filtro.</StatusMessage>
      ) : (
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Resultado</th>
              <th>Seller</th>
              <th>Nome</th>
              <th>externalId</th>
              <th>matchedBy</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.index} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setState({ status: 'loading' });
    catalogApi.importCatalog(file).then(
      (report) => setState({ status: 'success', report }),
      (error: unknown) => setState({ status: 'error', error }),
    );
  };

  return (
    <div>
      <h1>Importar catálogo</h1>
      <form onSubmit={onSubmit}>
        <label>
          Arquivo JSON{' '}
          <input type="file" accept=".json,application/json" onChange={onFileChange} />
        </label>{' '}
        <button type="submit" disabled={!file || state.status === 'loading'}>
          Enviar
        </button>
      </form>
      {state.status === 'idle' && <StatusMessage kind="empty">Nenhum arquivo enviado ainda.</StatusMessage>}
      {state.status === 'loading' && <StatusMessage kind="loading">Importando...</StatusMessage>}
      {state.status === 'error' && <StatusMessage kind="error">{errorText(state.error)}</StatusMessage>}
      {state.status === 'success' && <Report report={state.report} />}
    </div>
  );
}