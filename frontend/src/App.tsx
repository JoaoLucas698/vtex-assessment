import { CatalogPage } from '@features/catalog/catalog-page';
import { ImportPage } from '@features/catalog-import/import-page';
import { ProductDetailPage } from '@features/product-detail/product-detail-page';
import { routeHref, useHashRoute } from '@/hooks/use-hash-route';

export default function App() {
  const route = useHashRoute();
  return (
    <div>
      <header>
        <strong>Catalog Consolidation</strong>
        <nav aria-label="Principal">
          <a href={routeHref.catalog()}>Catálogo</a>
          <a href={routeHref.import()}>Importar</a>
        </nav>
      </header>
      <main>
        {route.name === 'catalog' && <CatalogPage />}
        {route.name === 'import' && <ImportPage />}
        {route.name === 'product' && <ProductDetailPage key={route.id} id={route.id} />}
      </main>
    </div>
  );
}