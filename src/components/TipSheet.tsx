import { Barkeeper } from './Barkeeper';
import { Sheet } from './Sheet';
import { TipSection } from './TipSection';
import { useI18n } from '../i18n';

/**
 * What the tip jar opens: the tip on its own, rather than settings scrolled
 * down to it — someone who tapped the jar came to tip, not to change the
 * currency. Settings still carries the same section for those who look there.
 *
 * No Close button: there is nothing to save or cancel, and the back button,
 * Esc or a tap outside all close it.
 */
export function TipSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  return (
    <Sheet title={t('tip.title')} onClose={onClose}>
      {/* Gone as soon as a tip is chosen: Play's own payment sheet or the
          browser tab takes over, and the thanks come from the barman as the
          coin drops into the jar. */}
      <TipSection
        titled={false}
        onChosen={onClose}
        figure={<Barkeeper className="tip-intro__figure" />}
      />
    </Sheet>
  );
}
