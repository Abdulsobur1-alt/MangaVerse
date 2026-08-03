'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms */
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'span';
}

/**
 * Wraps content and fades/slides it in the first time it enters the viewport.
 * Uses the `.reveal` / `.is-visible` classes from globals.css.
 *
 * The `reveal` class is applied client-side only (in the effect) so SSR and
 * no-JS users always see the content — progressive enhancement.
 */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <Tag ref={ref as never} className={`${mounted ? 'reveal ' : ''}${className}`} style={style}>
      {children}
    </Tag>
  );
}
