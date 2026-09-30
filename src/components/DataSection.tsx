import { useState } from 'react';
import { ConfirmSheet } from './ConfirmSheet';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { applyImport, checkImport, pickImport, saveExport } from '../lib/dataFile';

type Status = 'exported' | 'invalid' | 'newer' | 'failed';

const MESSAGES: Record<Status, MessageKey> = {
  exported: 'data.exported',
  invalid: 'data.invalid',
  newer: 'data.newer',
  failed: 'data.failed',
};

/** Settings section: all data to a file and back, for moving phones. */
export function DataSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const exportData = async () => {
    setStatus(null);
    try {
      if (await saveExport()) setStatus('exported');
    } catch {
      setStatus('failed');
    }
  };

  const importData = async () => {
    setStatus(null);
    try {
      const text = await pickImport();
      if (text === null) return;
      const check = checkImport(text);
      if (check.ok) setPending(check.stored);
      else setStatus(check.reason);
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="field">
      <span className="field__label">{t('data.title')}</span>
      <span className="field__hint">{t('data.hint')}</span>
      <div className="data-actions">
        <button type="button" className="btn btn--ghost" onClick={() => void exportData()}>
          {t('data.export')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void importData()}>
          {t('data.import')}
        </button>
      </div>
      {status && (
        <span className="field__hint" role="status">
          {t(MESSAGES[status])}
        </span>
      )}

      {pending !== null && (
        <ConfirmSheet
          title={t('data.importTitle')}
          body={t('data.importBody')}
          confirmLabel={t('data.importConfirm')}
          onConfirm={() => applyImport(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
