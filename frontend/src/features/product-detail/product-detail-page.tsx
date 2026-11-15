import { useCallback } from 'react';
import { catalogApi } from '@api/catalog-api';
import { ApiError } from '@api/api-error';
import type { ProductSeller } from '@api/types';
import { Badge } from '@components/badge';
import { errorText } from '@components/error-text';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import { routeHref } from '@/hooks/use-hash-route';
import { useRequest } from '@/hooks/use-request';

const NOT_FOUND_CODE = 'PRODUCT_NOT_FOUND';

/** Célula que destaca quando o texto do seller difere do oficial. */
function SellerText({ seller, official }: { seller: string | null; official: string | null }) {
  const differs = (seller ?? '') !== (official ?? '');
  return (
    <td className={differs ? tableStyles.diff : undefined}>
      {seller ?? '—'}
      {differs && <Badge tone="warning">difere do oficial</Badge>}
    </td>
  );
}

function SellersTable({
  sellers,
  official,
}: {
  sellers: ProductSeller[];
  official: { name: string; brand: string | null; category: string | null };
}) {
  return (
    <table className={tableStyles.table}>
      <thead>
        <tr>
          <th>Seller</th>
          <th>Nome enviado</th>
          <th>Marca enviada</th>
          <th>Categoria enviada</th>
          <th>externalId</th>
          <th>matchedBy</th>
        </tr>
      </thead>
      <tbody>
        {sellers.map((s) => (
          <tr key={`${s.sellerId}-${s.externalId ?? ''}-${s.name}`}>
            <td>{s.sellerName}</td>
            <SellerText seller={s.name} official={official.name} />
            <SellerText seller={s.brand} official={official.brand} />
            <SellerText seller={s.category} official={official.category} />
            <td>{s.externalId ?? '—'}</td>
            <td>{s.matchedBy}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProductDetailPage({ id }: { id: number }) {
  const load = useCallback(() => catalogApi.getProduct(id), [id]);
  const state = useRequest(load);

  return (
    <div>
      <p>
        <a href={routeHref.catalog()}>← Voltar ao catálogo</a>
      </p>
      {state.status === 'loading' && <StatusMessage kind="loading">Carregando produto...</StatusMessage>}
      {state.status === 'error' && (
        <StatusMessage kind="error">
          {state.error instanceof ApiError && state.error.code === NOT_FOUND_CODE
            ? 'Produto não encontrado.'
            : errorText(state.error)}
        </StatusMessage>
      )}
      {state.status === 'success' && (
        <>
          <h1>{state.data.name}</h1>
          <dl>
            <dt>Marca oficial</dt>
            <dd>{state.data.brand ?? '—'}</dd>
            <dt>Categoria oficial</dt>
            <dd>{state.data.category ?? '—'}</dd>
          </dl>
          <h2>Sellers ({state.data.sellers.length})</h2>
          {state.data.sellers.length === 0 ? (
            <StatusMessage kind="empty">Nenhum seller oferece este produto.</StatusMessage>
          ) : (
            <SellersTable sellers={state.data.sellers} official={state.data} />
          )}
        </>
      )}
    </div>
  );
}