import type { ReactNode } from 'react';
import styles from '@components/badge.module.css';

export type BadgeTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}