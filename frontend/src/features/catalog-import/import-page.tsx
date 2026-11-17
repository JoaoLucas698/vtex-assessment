import { useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { catalogApi } from '@api/catalog-api';
import { ImportOutcome } from '@api/types';
import type { ImportCatalogResponse, ImportItem, NormalizationType, NormalizationTypeCode } from '@api/types';
import { Badge } from '@components/badge';
import type { BadgeTone } from '@components/badge';
import { errorText } from '@components/error-text';
import { PageHeader } from '@components/page-header';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import { FileTemplate } from '@features/catalog-import/file-template';
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

interface TotalCard {
  label: string;
  value: number;
  tone: BadgeTone;
}

function totalCards(report: ImportCatalogResponse): TotalCard[] {
  const t = report.totals;
  const card = (outcome: ImportOutcome, value: number): TotalCard => ({
    label: OUTCOME_LABEL[outcome],
    value,
    tone: OUTCOME_TONE[outcome],
  });
  return [
    { label: 'Lidos', value: t.read, tone: 'neutral' },
    card(ImportOutcome.CREATED, t.created),
    card(ImportOutcome.LINKED_EXISTING, t.linkedExisting),
    card(ImportOutcome.ALREADY_LINKED, t.alreadyLinked),
    card(ImportOutcome.DUPLICATE_SAME_SELLER, t.duplicateSameSeller),
    card(ImportOutcome.INVALID, t.invalid),
  ];
}

function OrDash({ value }: { value: string | null }) {
  return value ?? <span className={tableStyles.muted}>—</span>;
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function ItemRow({ item }: { item: ImportItem }) {
  return (
    <tr>
      <td className={`${tableStyles.num} ${tableStyles.muted}`}>{item.index}</td>
      <td>
        <Badge tone={OUTCOME_TONE[item.outcome]}>{item.outcome}</Badge>
      </td>
      <td className={tableStyles.strong}>
        <OrDash value={item.sellerName} />
      </td>
      <td>
        {item.productId !== null ? (
          <a href={routeHref.product(item.productId)}>{item.name ?? `Produto ${item.productId}`}</a>
        ) : (
          <OrDash value={item.name} />
        )}
      </td>
      <td className={tableStyles.mono}>
        <OrDash value={item.externalId} />
      </td>
      <td className={tableStyles.mono}>
        <OrDash value={item.matchedBy} />
      </td>
      <td className={styles.reason}>{item.reason ?? ''}</td>
    </tr>
  );
}

function Report({ report }: { report: ImportCatalogResponse }) {
  const [filter, setFilter] = useState<Filter>(ALL);
  const items = filter === ALL ? report.items : report.items.filter((i) => i.outcome === filter);

  return (
    <section aria-label="Relatório da importação" className={styles.section}>
      <h2>Relatório</h2>
      <p className={styles.ruleUsed}>
        Regra de normalização usada: <strong>{report.normalizationType}</strong>
      </p>
      <ul className={styles.cards}>
        {totalCards(report).map((card) => (
          <li key={card.label} className={`${styles.card} ${styles[card.tone]}`} data-testid={`total-${card.label}`}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.toolbar}>
        <label className={styles.filter}>
          Filtrar por resultado
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value={ALL}>Todos</option>
            {Object.values(ImportOutcome).map((outcome) => (
              <option key={outcome} value={outcome}>
                {OUTCOME_LABEL[outcome]}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.count}>
          {items.length} de {report.items.length} itens
        </p>
      </div>

      {items.length === 0 ? (
        <StatusMessage kind="empty">Nenhum item para este filtro.</StatusMessage>
      ) : (
        <div className={tableStyles.wrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th className={tableStyles.num}>#</th>
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
        </div>
      )}
    </section>
  );
}

const DEFAULT_NORMALIZATION: NormalizationTypeCode = 'NAME_BRAND';

type TypesState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; items: NormalizationType[] };

function defaultCode(items: NormalizationType[]): NormalizationTypeCode | null {
  const preferred = items.find((i) => i.code === DEFAULT_NORMALIZATION);
  return (preferred ?? items[0])?.code ?? null;
}

interface NormalizationFieldProps {
  types: TypesState;
  value: NormalizationTypeCode | null;
  onChange: (code: NormalizationTypeCode) => void;
}

function NormalizationField({ types, value, onChange }: NormalizationFieldProps) {
  if (types.status === 'loading') return <StatusMessage kind="loading">Carregando regras de normalização...</StatusMessage>;
  if (types.status === 'error') return <StatusMessage kind="error">{errorText(types.error)}</StatusMessage>;
  if (types.items.length === 0) return <StatusMessage kind="empty">Nenhuma regra de normalização disponível.</StatusMessage>;

  return (
    <div className={styles.rule}>
      <label className={styles.ruleLabel}>
        Regra de normalização
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value as NormalizationTypeCode)}>
          {types.items.map((type) => (
            <option key={type.code} value={type.code}>
              {type.description}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.ruleHelp}>
        A regra define apenas a chave dos produtos novos. Produtos que já existem mantêm a própria regra.
      </p>
    </div>
  );
}

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [types, setTypes] = useState<TypesState>({ status: 'loading' });
  const [chosen, setChosen] = useState<NormalizationTypeCode | null>(null);

  useEffect(() => {
    let active = true;
    catalogApi.listNormalizationTypes().then(
      (response) => active && setTypes({ status: 'ready', items: response.items }),
      (error: unknown) => active && setTypes({ status: 'error', error }),
    );
    return () => {
      active = false;
    };
  }, []);

  const normalizationType = chosen ?? (types.status === 'ready' ? defaultCode(types.items) : null);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setState({ status: 'loading' });
    catalogApi.importCatalog(file, normalizationType ?? undefined).then(
      (report) => setState({ status: 'success', report }),
      (error: unknown) => setState({ status: 'error', error }),
    );
  };

  return (
    <div>
      <PageHeader
        title="Importar catálogo"
        subtitle="Envie o arquivo JSON de carga dos sellers (até 5 MB). Reenviar o mesmo arquivo não duplica nada."
      />
      <FileTemplate />
      <NormalizationField types={types} value={normalizationType} onChange={setChosen} />
      <form onSubmit={onSubmit} className={styles.upload}>
        <label
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".json,application/json" onChange={onFileChange} className={styles.fileInput} />
          <span className={styles.dropIcon}>
            <UploadIcon />
          </span>
          <span className={styles.dropText}>
            <span className={styles.dropTitle}>Arquivo JSON</span>
            <span className={styles.dropHint}>
              {file ? (
                <span className={styles.fileName}>{file.name}</span>
              ) : (
                'Clique para escolher ou arraste o arquivo aqui'
              )}
            </span>
          </span>
        </label>
        <button type="submit" className={styles.submit} disabled={!file || state.status === 'loading'}>
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
