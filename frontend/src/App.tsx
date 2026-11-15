import { CatalogPage } from '@features/catalog/catalog-page';
import { ImportPage } from '@features/catalog-import/import-page';
import { ProductDetailPage } from '@features/product-detail/product-detail-page';
import styles from '@/app.module.css';
import { routeHref, useHashRoute } from '@/hooks/use-hash-route';

export default function App() {
  const route = useHashRoute();
  const inImport = route.name === 'import';
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href={routeHref.catalog()} className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              CC
            </span>
            <strong>Catalog Consolidation</strong>
          </a>
          <nav aria-label="Principal" className={styles.nav}>
            <a href={routeHref.catalog()} aria-current={inImport ? undefined : 'page'}>
              Catálogo
            </a>
            <a href={routeHref.import()} aria-current={inImport ? 'page' : undefined}>
              Importar
            </a>
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        {route.name === 'catalog' && <CatalogPage />}
        {route.name === 'import' && <ImportPage />}
        {route.name === 'product' && <ProductDetailPage key={route.id} id={route.id} />}
      </main>
    </>
  );
}
