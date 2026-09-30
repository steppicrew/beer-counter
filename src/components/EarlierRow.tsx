import { useState } from 'react';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/useAppStore';

const MINUTE = 60_000;

/** Offsets for the fixed buttons, in minutes. */
const OFFSETS = [15, 30, 60];

/**
 * Where a forgotten drink most likely belongs: halfway between the previous
 * one of the same kind and now — the tap was missed somewhere in that gap.
 * Without an earlier one of this drink, halfway from the last drink of any
 * kind; with nothing counted at all, half an hour ago.
 */
export function forgottenAt(own: number[], all: number[], now: number): number {
  const previous = own.at(-1) ?? Math.max(-Infinity, ...all);
  const at = Number.isFinite(previous) && previous < now ? (previous + now) / 2 : now - 30 * MINUTE;
  return Math.round(at / MINUTE) * MINUTE;
}

// Read at the tap, not at render: each button counts relative to the moment
// it is pressed, so a sheet left open a while still lands where it should.
const agoFromNow = (minutes: number) => Date.now() - minutes * MINUTE;
const forgottenFromNow = (own: number[], all: number[]) => forgottenAt(own, all, Date.now());

/** "Count one earlier" in the drink's edit sheet: one tap counts and closes. */
export function EarlierRow({ beverageId, onCounted }: { beverageId: string; onCounted: () => void }) {
  const { t, locale } = useI18n();
  const tallies = useAppStore((s) => s.tallies);
  const incrementAt = useAppStore((s) => s.incrementAt);

  // The time the sheet opened, for the label only.
  const [openedAt] = useState(() => Date.now());
  const own = tallies[beverageId]?.times ?? [];
  const all = Object.values(tallies).flatMap((tally) => tally.times);
  const forgot = forgottenAt(own, all, openedAt);

  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  const ago = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'short' });
  const hourAgo = new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'short' });

  const count = (at: number) => {
    incrementAt(beverageId, at);
    onCounted();
  };
  const countForgotten = () => count(forgottenFromNow(own, all));
  const countAgo = (minutes: number) => count(agoFromNow(minutes));

  return (
    <div className="field">
      <span className="field__label">{t('earlier.title')}</span>
      <div className="earlier">
        <button type="button" className="btn btn--primary earlier__forgot" onClick={countForgotten}>
          {t('earlier.forgot')}
          <span className="earlier__time">{time.format(forgot)}</span>
        </button>
        {OFFSETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className="btn btn--ghost earlier__offset"
            onClick={() => countAgo(minutes)}
          >
            {minutes < 60 ? ago.format(-minutes) : hourAgo.format(-minutes / 60)}
          </button>
        ))}
      </div>
      <span className="field__hint">{t('earlier.hint')}</span>
    </div>
  );
}
