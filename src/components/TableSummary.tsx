import type { CSSProperties } from 'react';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import { talliesOf, useAppStore } from '../store/useAppStore';
import { computeTotals, sumTotals } from '../lib/totals';
import type { Totals } from '../lib/totals';
import { formatMoney, defaultCurrencyFor } from '../lib/money';
import { personColourVar, personName } from '../lib/people';
import './TableSummary.scss';

/**
 * The whole table at a glance, where the drink list would be: what each one
 * has had and what that comes to, and the table's total. This is the bill
 * split — nothing is divided, everyone simply pays for their own. A tap on
 * someone goes to their drinks.
 */
export function TableSummary({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, locale } = useI18n();
  const beverages = useAppStore((s) => s.beverages);
  const people = useAppStore((s) => s.people);
  const table = useAppStore((s) => s.table);
  const tallies = useAppStore((s) => s.tallies);
  const storedCurrency = useAppStore((s) => s.currency);
  const currency = storedCurrency ?? defaultCurrencyFor(locale);

  const seated = table.flatMap((id) => people.find((p) => p.id === id) ?? []);
  const nameOf = (b: (typeof beverages)[number]) =>
    b.nameKey ? t(b.nameKey as MessageKey) : (b.name ?? '');

  // An incomplete sum is a floor, not the bill — as in the header.
  const money = (totals: Totals) =>
    !totals.anyPriced
      ? null
      : totals.complete
        ? formatMoney(totals.cents, currency, locale)
        : t('total.partial', { price: formatMoney(totals.cents, currency, locale) });

  const rows = seated.map((person) => {
    const own = talliesOf({ tallies }, person.id);
    return {
      person,
      totals: computeTotals(beverages, own),
      drinks: beverages
        .map((b) => ({ name: nameOf(b), count: own[b.id]?.times.length ?? 0 }))
        .filter((d) => d.count > 0),
    };
  });

  const all = sumTotals(rows.map((r) => r.totals));

  return (
    <section className="table-sum">
      <ul className="table-sum__list">
        {rows.map(({ person, totals, drinks }) => (
          <li key={person.id}>
            <button
              type="button"
              className="table-sum__row"
              style={{ '--person': personColourVar(person.colour) } as CSSProperties}
              onClick={() => onOpen(person.id)}
            >
              <span className="table-sum__who">
                <span className="table-sum__name">{personName(person, t)}</span>
                <span className="table-sum__drinks">
                  {drinks.length === 0 ? '—' : drinks.map((d) => `${d.count} ${d.name}`).join(' · ')}
                </span>
              </span>
              <span className="table-sum__figures">
                <span className="table-sum__count">{totals.drinks}</span>
                {money(totals) && <span className="table-sum__money">{money(totals)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="table-sum__total">
        <span className="table-sum__total-label">{t('total.label')}</span>
        <span className="table-sum__figures">
          <span className="table-sum__count">{all.drinks}</span>
          {money(all) && <span className="table-sum__money">{money(all)}</span>}
        </span>
      </div>
    </section>
  );
}
