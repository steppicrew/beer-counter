import { Sheet } from './Sheet';
import { EarlierRow } from './EarlierRow';
import { RoundRow } from './RoundRow';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import type { Beverage } from '../lib/types';

/**
 * A long-press on a drink: ways to count it other than the single tap. At a
 * table the round comes first — the tray arrives far more often than a
 * forgotten tap gets corrected. Editing the drink itself is the pencil's.
 */
export function OrderSheet({ beverage, onClose }: { beverage: Beverage; onClose: () => void }) {
  const { t } = useI18n();
  const atTable = useAppStore((s) => s.table.length > 1);
  const name = beverage.nameKey ? t(beverage.nameKey as MessageKey) : (beverage.name ?? '');

  return (
    <Sheet title={name} onClose={onClose}>
      {atTable && <RoundRow beverageId={beverage.id} onPoured={onClose} />}
      <EarlierRow beverageId={beverage.id} onCounted={onClose} plain={atTable} />

      <div className="sheet-actions">
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('action.cancel')}
        </button>
      </div>
    </Sheet>
  );
}
