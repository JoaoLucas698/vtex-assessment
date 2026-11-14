import { useEffect, useState } from 'react';

export type Route =
  | { name: 'catalog' }
  | { name: 'import' }
  | { name: 'product'; id: number };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/import') return { name: 'import' };
  const product = /^\/products\/(\d+)$/.exec(path);
  if (product) return { name: 'product', id: Number(product[1]) };
  return { name: 'catalog' };
}

export const routeHref = {
  catalog: () => '#/catalog',
  import: () => '#/import',
  product: (id: number) => `#/products/${id}`,
};

export function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}