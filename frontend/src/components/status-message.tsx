import type { ReactNode } from 'react';
import styles from '@components/status-message.module.css';

export type StatusKind = 'loading' | 'error' | 'empty';

interface StatusMessageProps {
  kind: StatusKind;
  children: ReactNode;
}

export function StatusMessage({ kind, children }: StatusMessageProps) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`${styles.message} ${styles[kind]}`}>
      {children}
    </p>
  );
}