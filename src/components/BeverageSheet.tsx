import { useState } from 'react';
import clsx from 'clsx';
import { Sheet } from './Sheet';
import { BeverageIcon } from './BeverageIcon';
import { useI18n } from '../i18n';
import { ICON_KEYS } from '../lib/types';
import type { Beverage, IconKey } from '../lib/types';
import type { MessageKey } from '../i18n';

interface Props {
  /** Absent = create mode. */
  existing?: Beverage;
  onSave: (data: { name: string; icon: IconKey; scope: Beverage['scope'] }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function BeverageSheet({ existing, onSave, onDelete, onClose }: Props) {
  const { t } = useI18n();
  const isEdit = existing !== undefined;

  const initialName = existing
    ? (existing.nameKey ? t(existing.nameKey as MessageKey) : (existing.name ?? ''))
    : '';

  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<IconKey>(existing?.icon ?? 'beer-large');
  const [scope, setScope] = useState<Beverage['scope']>(existing?.scope ?? 'session');

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    onSave({ name: trimmed, icon, scope });
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

      <div className="sheet-actions">
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
        <span className="sheet-actions__spacer" />
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {t('action.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={submit} disabled={!trimmed}>
          {t('action.save')}
        </button>
      </div>
    </Sheet>
  );
}
