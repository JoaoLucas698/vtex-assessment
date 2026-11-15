import { useCallback, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { catalogApi } from '@api/catalog-api';
import { errorText } from '@components/error-text';
import { PageHeader } from '@components/page-header';
import { Pagination } from '@components/pagination';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import styles from '@features/catalog/catalog-page.module.css';
import { routeHref } from '@/hooks/use-hash-route';
import { useRequest } from '@/hooks/use-request';

const PAGE_SIZE = 20;

function OrDash({ value }: { value: string | null }) {
  return value ?? <span className={tableStyles.muted}>—</span>;
}

export function CatalogPage() {
  const searchId = useId();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(
    () => catalogApi.listProducts({ q: query, page, pageSize: PAGE_SIZE }),
    [query, page],
  );
  const state = useRequest(load);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim());
  };

  return (
    <div>
      <PageHeader title="Catálogo" subtitle="Produtos oficiais, consolidados a partir dos arquivos dos sellers." />

      <div className={styles.toolbar}>
        <form onSubmit={onSearch} role="search" className={styles.search}>
          <div className={styles.field}>
            <label htmlFor={searchId} className={styles.label}>
              Buscar por marca ou nome
            </label>
            <input
              id={searchId}
              type="search"
              placeholder="Ex.: samsung galaxy"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <button type="submit">Buscar</button>
        </form>
        {state.status === 'success' && state.data.items.length > 0 && (
          <p className={styles.count}>{state.data.total} produto(s)</p>
        )}
      </div>

      {state.status === 'loading' && <StatusMessage kind="loading">Carregando produtos...</StatusMessage>}
      {state.status === 'error' && <StatusMessage kind="error">{errorText(state.error)}</StatusMessage>}
      {state.status === 'success' && state.data.items.length === 0 && (
        <StatusMessage kind="empty">Nenhum produto encontrado.</StatusMessage>
      )}

      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <div className={tableStyles.wrap}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Categoria</th>
                  <th className={tableStyles.num}>Sellers</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <a href={routeHref.product(product.id)} className={styles.productLink}>
                        {product.name}
                      </a>
                    </td>
                    <td>
                      <OrDash value={product.brand} />
                    </td>
                    <td>
                      <OrDash value={product.category} />
                    </td>
                    <td className={tableStyles.num}>
                      <span className={styles.sellers}>{product.sellersCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={state.data.page}
            pageSize={state.data.pageSize}
            total={state.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
