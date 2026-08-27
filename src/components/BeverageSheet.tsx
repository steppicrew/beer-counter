import { useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { BeverageIcon } from './BeverageIcon';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { formatMoney, parseMoney, defaultCurrencyFor } from '../lib/money';
import { ICON_KEYS } from '../lib/types';
import type { Beverage, IconKey } from '../lib/types';
import type { MessageKey } from '../i18n';

interface Props {
  /** Absent = create mode. */
  existing?: Beverage;
  onSave: (data: {
    name: string;
    icon: IconKey;
    scope: Beverage['scope'];
    priceCents?: number | undefined;
  }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function BeverageSheet({ existing, onSave, onDelete, onClose }: Props) {
  const { t, locale } = useI18n();
  const isEdit = existing !== undefined;

  const initialName = existing
    ? (existing.nameKey ? t(existing.nameKey as MessageKey) : (existing.name ?? ''))
    : '';

  const storedCurrency = useAppStore((s) => s.currency);
  const currency = storedCurrency ?? defaultCurrencyFor(locale);

  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<IconKey>(existing?.icon ?? 'beer-large');
  const [scope, setScope] = useState<Beverage['scope']>(existing?.scope ?? 'session');
  // Seed the field with the plain number so it is editable, not the formatted
  // string with a currency symbol in it.
  const [price, setPrice] = useState(() =>
    existing?.priceCents === undefined
      ? ''
      : formatMoney(existing.priceCents, currency, locale).replace(/[^\d.,]/g, '').trim(),
  );

  const trimmed = name.trim();
  const priceCents = price.trim() === '' ? undefined : parseMoney(price, currency, locale);
  const priceInvalid = price.trim() !== '' && priceCents === null;

  const submit = () => {
    if (!trimmed || priceInvalid) return;
    onSave({ name: trimmed, icon, scope, priceCents: priceCents ?? undefined });
    onClose();
  };

  return (
    <Sheet title={isEdit ? t('edit.title') : t('add.title')} onClose={onClose}>
      <label className="field">
        <span className="field__label">{t('add.name')}</span>
        <input
          className="field__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('add.namePlaceholder')}
          autoFocus={!isEdit}
          maxLength={40}
        />
      </label>

      <label className="field">
        <span className="field__label">{t('price.optional')}</span>
        <input
          className={clsx('field__input', priceInvalid && 'field__input--invalid')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder={formatMoney(0, currency, locale)}
          maxLength={12}
        />
        <span className="field__hint">{t('price.hint')}</span>
      </label>

      <div className="field">
        <span className="field__label">{t('add.icon')}</span>
        <div className="icon-picker">
          {ICON_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={clsx('icon-picker__option', key === icon && 'icon-picker__option--selected')}
              onClick={() => setIcon(key)}
              aria-pressed={key === icon}
              aria-label={key}
            >
              <BeverageIcon icon={key} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field__label">{t('add.scope')}</span>
        <div className="segmented">
          <button
            type="button"
            className={clsx('segmented__option', scope === 'session' && 'segmented__option--selected')}
            onClick={() => setScope('session')}
            aria-pressed={scope === 'session'}
          >
            {t('add.scopeSession')}
          </button>
          <button
            type="button"
            className={clsx('segmented__option', scope === 'default' && 'segmented__option--selected')}
            onClick={() => setScope('default')}
            aria-pressed={scope === 'default'}
          >
            {t('add.scopeDefault')}
          </button>
        </div>
        <span className="field__hint">{t('add.scopeHint')}</span>
      </div>

      {/* Ordered by how often each is pressed: save first, delete last. The
          destructive action sits furthest from the resting thumb rather than
          where a confirm button is expected. */}
      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={submit}
          disabled={!trimmed || priceInvalid}
        >
          {t('action.save')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <span className="sheet-actions__spacer" />
        {isEdit && onDelete && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (confirm(t('edit.deleteConfirm'))) {
                onDelete();
                onClose();
              }
            }}
          >
            {t('action.delete')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
