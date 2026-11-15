import { useCallback } from 'react';
import { catalogApi } from '@api/catalog-api';
import { ApiError } from '@api/api-error';
import type { MatchedBy, ProductSeller } from '@api/types';
import { Badge } from '@components/badge';
import type { BadgeTone } from '@components/badge';
import { errorText } from '@components/error-text';
import { StatusMessage } from '@components/status-message';
import tableStyles from '@components/table.module.css';
import styles from '@features/product-detail/product-detail-page.module.css';
import { routeHref } from '@/hooks/use-hash-route';
import { useRequest } from '@/hooks/use-request';

const NOT_FOUND_CODE = 'PRODUCT_NOT_FOUND';

const MATCHED_BY_TONE: Record<MatchedBy, BadgeTone> = {
  new: 'success',
  normalized_key: 'info',
  legacy: 'neutral',
};

/** Célula que destaca quando o texto do seller difere do oficial. */
function SellerText({ seller, official }: { seller: string | null; official: string | null }) {
  const differs = (seller ?? '') !== (official ?? '');
  return (
    <td className={differs ? tableStyles.diff : undefined}>
      <div className={styles.cell}>
        <span>{seller ?? <span className={tableStyles.muted}>—</span>}</span>
        {differs && <Badge tone="warning">difere do oficial</Badge>}
      </div>
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
    <div className={tableStyles.wrap}>
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
              <td className={tableStyles.strong}>{s.sellerName}</td>
              <SellerText seller={s.name} official={official.name} />
              <SellerText seller={s.brand} official={official.brand} />
              <SellerText seller={s.category} official={official.category} />
              <td className={tableStyles.mono}>{s.externalId ?? <span className={tableStyles.muted}>—</span>}</td>
              <td>
                <Badge tone={MATCHED_BY_TONE[s.matchedBy]}>{s.matchedBy}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductDetailPage({ id }: { id: number }) {
  const load = useCallback(() => catalogApi.getProduct(id), [id]);
  const state = useRequest(load);

  return (
    <div>
      <a href={routeHref.catalog()} className={styles.back}>
        ← Voltar ao catálogo
      </a>

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
          <section className={styles.hero}>
            <p className={styles.eyebrow}>Produto oficial #{state.data.id}</p>
            <h1>{state.data.name}</h1>
            <dl className={styles.facts}>
              <div>
                <dt>Marca oficial</dt>
                <dd>{state.data.brand ?? '—'}</dd>
              </div>
              <div>
                <dt>Categoria oficial</dt>
                <dd>{state.data.category ?? '—'}</dd>
              </div>
              <div>
                <dt>Sellers que oferecem</dt>
                <dd>{state.data.sellers.length}</dd>
              </div>
            </dl>
          </section>

          <div className={styles.sectionHeader}>
            <h2>Sellers ({state.data.sellers.length})</h2>
            {state.data.sellers.length > 0 && (
              <p className={styles.legend}>Destaque: texto do seller diferente do oficial</p>
            )}
          </div>
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
