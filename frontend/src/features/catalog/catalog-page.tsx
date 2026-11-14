import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { catalogApi } from '@api/catalog-api';
import { errorText } from '@components/error-text';
import { Pagination } from '@components/pagination';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import { routeHref } from '@/hooks/use-hash-route';
import { useRequest } from '@/hooks/use-request';

const PAGE_SIZE = 20;

export function CatalogPage() {
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
      <h1>Catálogo</h1>
      <form onSubmit={onSearch} role="search">
        <label>
          Buscar por marca ou nome{' '}
          <input type="search" value={input} onChange={(e) => setInput(e.target.value)} />
        </label>{' '}
        <button type="submit">Buscar</button>
      </form>
      {state.status === 'loading' && <StatusMessage kind="loading">Carregando produtos...</StatusMessage>}
      {state.status === 'error' && <StatusMessage kind="error">{errorText(state.error)}</StatusMessage>}
      {state.status === 'success' && state.data.items.length === 0 && (
        <StatusMessage kind="empty">Nenhum produto encontrado.</StatusMessage>
      )}
      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <p>{state.data.total} produto(s)</p>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Marca</th>
                <th>Categoria</th>
                <th>Sellers</th>
              </tr>
            </thead>
            <tbody>
              {state.data.items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <a href={routeHref.product(product.id)}>{product.name}</a>
                  </td>
                  <td>{product.brand ?? '—'}</td>
                  <td>{product.category ?? '—'}</td>
                  <td>{product.sellersCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
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