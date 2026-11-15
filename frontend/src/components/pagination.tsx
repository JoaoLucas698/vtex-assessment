import styles from '@components/pagination.module.css';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className={styles.pagination} aria-label="Paginação">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Anterior
      </button>
      <span>
        Página {page} de {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Próxima
      </button>
    </nav>
  );
}