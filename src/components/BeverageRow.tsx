import clsx from 'clsx';
import { BeverageIcon } from './BeverageIcon';
import { UiIcon } from './UiIcon';
import { useElapsed, formatElapsed } from '../lib/useRelativeTime';
import { useI18n } from '../i18n';
import type { Beverage, Tally } from '../lib/types';
import type { MessageKey } from '../i18n';
import './BeverageRow.scss';

interface Props {
  beverage: Beverage;
  tally: Tally;
  onIncrement: () => void;
  onDecrement: () => void;
  onEdit: () => void;
}

export function BeverageRow({ beverage, tally, onIncrement, onDecrement, onEdit }: Props) {
  const { t } = useI18n();
  const elapsed = useElapsed(tally.lastAt);
  const label = beverage.nameKey ? t(beverage.nameKey as MessageKey) : (beverage.name ?? '');

  // Under a minute since the last tap is the window where an accidental
  // double-count is likely — flag it so the row draws attention to itself.
  const isFresh = elapsed !== null && elapsed < 60_000;

  return (
    <li className={clsx('row', tally.count > 0 && 'row--active')}>
      {/* The whole tile is the add button: counting is the one thing you do
          over and over, often one-handed and not entirely sober. */}
      <button
        type="button"
        className="row__add"
        onClick={onIncrement}
        aria-label={`${t('action.add')} — ${label}`}
      >
        <BeverageIcon icon={beverage.icon} className="row__icon" />
        <span className="row__text">
          <span className="row__name">{label}</span>
          <span className={clsx('row__time', isFresh && 'row__time--fresh')}>
            {formatElapsed(elapsed, t)}
          </span>
        </span>
        <span className="row__count" aria-live="polite">
          {tally.count}
        </span>
      </button>

      <span className="row__controls">
        <button
          type="button"
          className="row__minus"
          onClick={onDecrement}
          disabled={tally.count === 0}
          aria-label={`${t('action.remove')} — ${label}`}
        >
          −
        </button>
        <button
          type="button"
          className="row__edit"
          onClick={onEdit}
          aria-label={`${t('action.edit')} — ${label}`}
        >
          <UiIcon name="edit" />
        </button>
      </span>
    </li>
  );
}
