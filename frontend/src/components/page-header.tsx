import type { ReactNode } from 'react';
import styles from '@components/page-header.module.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}

/** Título da tela, com subtítulo e área opcional à direita. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
