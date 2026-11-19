// The money (spec 011, requirement 16): before anything that can spend money with a provider (a provider's agent or a
// model through an API), the user confirms twice, the second time with the amount and the providers at stake. The
// settings (`nuclear.spending.*`): `confirm` (on by default) stops the questions when off; `forceConfirm` (off by
// default) brings them back whatever `confirm` says, and so does `"forceConfirm": true` in a project's
// `.nuclear/builder.json`, which wins. One module: the Builder and the onboarding ask through it.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { l10n } from './i18n';
import { CONFIG_FILE } from '../../tools/nuclear-builder/src/support';

export interface SpendingSettings {
  /** The most one run may spend with every provider together, USD (0: no limit). */
  budgetUsd: number;
  confirm: boolean;
  forceConfirm: boolean;
}

export function spendingSettings(): SpendingSettings {
  const c = vscode.workspace.getConfiguration('nuclear.spending');
  return { budgetUsd: c.get('budgetUsd', 5), confirm: c.get('confirm', true), forceConfirm: c.get('forceConfirm', false) };
}

/** Whether a project forces the questions (`"forceConfirm": true` in its `.nuclear/builder.json`). */
export function projectForcesConfirm(root: string | undefined): boolean {
  if (!root) return false;
  try {
    return (JSON.parse(fs.readFileSync(path.join(root, CONFIG_FILE), 'utf8')) as { forceConfirm?: unknown }).forceConfirm === true;
  } catch {
    return false;
  }
}

/** Whether to ask: forced (by the user or the project) always asks; else what `confirm` says. */
export function mustConfirm(s: Pick<SpendingSettings, 'confirm' | 'forceConfirm'>, projectForces: boolean): boolean {
  return s.forceConfirm || projectForces || s.confirm;
}

/** An amount as the questions say it. */
export function amountText(usd: number): string {
  return usd > 0 ? `${usd.toFixed(2)} USD` : l10n.t('no limit');
}

export interface Spend {
  /** What spends, as a sentence's subject: "The run "Loans of books"". */
  what: string;
  /** Who is paid: "Claude Code (haiku)". */
  providers: string[];
  /** The most it may spend, USD (0: no limit). */
  amountUsd: number;
  /** The project, whose `.nuclear/builder.json` may force the questions. */
  root?: string;
}

/** The two questions, when they must be asked: true when the user said yes twice (or is not asked). */
export async function confirmSpending(spend: Spend): Promise<boolean> {
  if (!mustConfirm(spendingSettings(), projectForcesConfirm(spend.root))) return true;
  const providers = spend.providers.join(', ');
  const go = l10n.t('Go on');
  const first = await vscode.window.showWarningMessage(
    l10n.t('{0} can spend money with {1}. Go on?', spend.what, providers),
    { modal: true, detail: l10n.t('You are asked twice before money is spent (Settings and integrations → Spending).') },
    go,
  );
  if (first !== go) return false;
  const amount = amountText(spend.amountUsd);
  const spendIt = l10n.t('Spend up to {0}', amount);
  const second = await vscode.window.showWarningMessage(
    l10n.t('Spend up to {0} with {1}?', amount, providers),
    { modal: true, detail: spend.amountUsd > 0 ? l10n.t('The run stops before a call that would pass this budget.') : l10n.t('The budget is 0: there is no limit to what it may spend.') },
    spendIt,
  );
  return second === spendIt;
}
