import { lazy, Suspense } from 'react';

interface Props {
  className?: string;
}

/**
 * Stands behind the counter, shaking a cocktail and looking about.
 *
 * Loaded on demand: the sixteen sprite frames are the largest single thing in
 * the app, and they are not needed to count a drink. On the web the first
 * empty bar fetches them a moment after the page; installed, the service
 * worker has them precached and there is nothing to wait for. Nothing is
 * drawn in the meantime — a placeholder that is then replaced by him would
 * read as him arriving, and he was always there.
 */
export function Barkeeper({ className }: Props) {
  return (
    <Suspense fallback={null}>
      <BarmanFigure {...(className === undefined ? {} : { className })} />
    </Suspense>
  );
}

const BarmanFigure = lazy(() => import('./BarmanFigure'));
