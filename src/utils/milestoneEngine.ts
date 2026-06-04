import { StorageService } from '../services/storage';
import type { Debt } from '../types';

export type MilestoneType =
  | 'first_debt_paid'
  | 'debt_almost_gone'
  | 'debt_5k'
  | 'debt_10k'
  | 'debt_25k'
  | 'debt_50k'
  | 'dti_under_43'
  | 'dti_under_36'
  | 'consistent_payments'
  | 'surplus_increased'
  | 'expenses_exceed_income'
  | 'home_ready'
  | 'ninety_days_active'
  | 'six_months_active'
  | 'first_reconciliation'
  | 'first_import';

export interface DetectedMilestone {
  type: MilestoneType;
  triggeredAt: string;
  data: Record<string, unknown>;
  seen: boolean;
  benTaskCreated: boolean;
}

export interface NovoChatMessage {
  id: string;
  type: 'novo' | 'ben';
  message: string;
  triggeredBy: MilestoneType;
  triggeredAt: string;
  seen: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
}

const STORAGE_KEY = 'novo_detected_milestones';
const MESSAGES_KEY = 'novo_proactive_messages';
const BEN_TASKS_KEY = 'novo_ben_tasks';

export interface BenTask {
  id: string;
  createdAt: string;
  userName: string;
  milestoneType: MilestoneType;
  summary: string;
  details: string;
  completed: boolean;
}

function getStoredMilestones(): DetectedMilestone[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveMilestones(milestones: DetectedMilestone[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
}

function getProactiveMessages(): NovoChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
  } catch { return []; }
}

function saveProactiveMessages(messages: NovoChatMessage[]): void {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

function getBenTasks(): BenTask[] {
  try {
    return JSON.parse(localStorage.getItem(BEN_TASKS_KEY) || '[]');
  } catch { return []; }
}

function saveBenTasks(tasks: BenTask[]): void {
  localStorage.setItem(BEN_TASKS_KEY, JSON.stringify(tasks));
}

function hasTriggered(type: MilestoneType): boolean {
  return getStoredMilestones().some(m => m.type === type);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function getUserFirstName(): string {
  try {
    const firstName = localStorage.getItem('userFirstName');
    if (firstName && firstName.trim()) return firstName.trim();

    const userName = localStorage.getItem('userName');
    if (!userName || !userName.trim()) return 'there';

    const accountType = localStorage.getItem('userAccountType') || 'solo';

    if (accountType === 'family') {
      return `the ${userName.trim()} family`;
    }

    if (accountType === 'couple') {
      return userName.trim();
    }

    return userName.trim().split(' ')[0];
  } catch { return 'there'; }
}

function buildUserSummary(debts: Debt[]): string {
  const totalStarting = debts.reduce((s, d) => s + (d.startingBalance || 0), 0);
  const totalCurrent = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalPaid = totalStarting - totalCurrent;
  const profile = StorageService.getFinancialProfile();
  const homeEquity = StorageService.getHomeEquity();
  const dti = profile
    ? Math.round((debts.reduce((s, d) => s + d.minimumPayment, 0) / (profile.monthlyGrossIncome || 1)) * 100)
    : null;

  return [
    `Total debt paid down: ${formatCurrency(totalPaid)}`,
    `Current total debt: ${formatCurrency(totalCurrent)}`,
    dti ? `Current DTI: ${dti}%` : null,
    homeEquity?.ownsHome ? 'Homeowner' : 'Renter — working toward first home',
    homeEquity?.hasHELOC ? `Has HELOC: ${formatCurrency(homeEquity.helocBalance || 0)} balance` : null,
    `Active debts: ${debts.filter(d => !d.isPaidOff).length}`,
    `Debts paid off: ${debts.filter(d => d.isPaidOff).length}`,
  ].filter(Boolean).join(' | ');
}

function triggerMilestone(
  type: MilestoneType,
  data: Record<string, unknown>,
  novoMessage: string,
  benMessage: string | null,
  ctaLabel?: string,
  ctaUrl?: string,
  isUrgent: boolean = false
): void {
  if (hasTriggered(type) && !isUrgent) return;

  const now = new Date().toISOString();

  const milestones = getStoredMilestones();
  milestones.push({ type, triggeredAt: now, data, seen: false, benTaskCreated: !!benMessage });
  saveMilestones(milestones);

  const messages = getProactiveMessages();
  messages.unshift({
    id: `msg_${Date.now()}`,
    type: benMessage ? 'ben' : 'novo',
    message: benMessage || novoMessage,
    triggeredBy: type,
    triggeredAt: now,
    seen: false,
    ctaLabel,
    ctaUrl,
  });
  saveProactiveMessages(messages);

  if (benMessage) {
    const debts = StorageService.getDebts();
    const tasks = getBenTasks();
    tasks.unshift({
      id: `task_${Date.now()}`,
      createdAt: now,
      userName: getUserFirstName(),
      milestoneType: type,
      summary: benMessage.substring(0, 120) + '...',
      details: buildUserSummary(debts),
      completed: false,
    });
    saveBenTasks(tasks);
  }
}

export function runMilestoneDetection(): void {
  const onboardingComplete = localStorage.getItem('novo_onboarding_complete');
  if (!onboardingComplete) return;

  const debts = StorageService.getDebts();
  const profile = StorageService.getFinancialProfile();
  const homeEquity = StorageService.getHomeEquity();
  const isHomeowner = homeEquity?.ownsHome || false;
  const name = getUserFirstName();

  if (!profile || debts.length === 0) return;

  const totalStarting = debts.reduce((s, d) => s + (d.startingBalance || d.currentBalance), 0);
  const totalCurrent = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalPaid = totalStarting - totalCurrent;
  const paidOffDebts = debts.filter(d => d.isPaidOff);
  const activeDebts = debts.filter(d => !d.isPaidOff && d.currentBalance > 0);
  const monthlyDebtPayments = activeDebts.reduce((s, d) => s + d.minimumPayment, 0);
  const dti = profile.monthlyGrossIncome > 0
    ? Math.round((monthlyDebtPayments / profile.monthlyGrossIncome) * 100)
    : 0;

  if (paidOffDebts.length >= 1 && !hasTriggered('first_debt_paid')) {
    const debt = paidOffDebts[0];
    triggerMilestone(
      'first_debt_paid',
      { debtName: debt.accountName },
      `🎉 You just paid off your ${debt.accountName}. One down. That's the hardest one — breaking the pattern. Every dollar you were putting toward that now accelerates everything else.`,
      `Hey ${name} — NOVO flagged that you paid off your ${debt.accountName}. I just wanted to say — that's real. A lot of people talk about it. You actually did it. Keep the momentum going.`,
      null,
      null
    );
  }

  const almostGoneDebt = activeDebts.find(d => d.currentBalance < 500 && d.currentBalance > 0 && (d.startingBalance || 0) > 500);
  if (almostGoneDebt && !hasTriggered('debt_almost_gone')) {
    triggerMilestone(
      'debt_almost_gone',
      { debtName: almostGoneDebt.accountName, balance: almostGoneDebt.currentBalance },
      `🏁 Your ${almostGoneDebt.accountName} is down to ${formatCurrency(almostGoneDebt.currentBalance)}. You're basically there. One more push and that one is gone for good.`,
      `${name} — your ${almostGoneDebt.accountName} is almost gone. ${formatCurrency(almostGoneDebt.currentBalance)} left. NOVO caught this and I had to send a quick note — finish it off. You're right there.`,
      null,
      null
    );
  }

  if (totalPaid >= 5000 && !hasTriggered('debt_5k')) {
    triggerMilestone(
      'debt_5k',
      { totalPaid },
      `💪 ${formatCurrency(totalPaid)} paid down. Most people never get this far. You did — and the math only gets better from here as each payoff frees up more cash.`,
      `Hey ${name} — NOVO just flagged ${formatCurrency(totalPaid)} paid down. Early progress matters more than people realize — it means the system is working. Nice work.`,
      null,
      null
    );
  }

  if (totalPaid >= 10000 && !hasTriggered('debt_10k')) {
    triggerMilestone(
      'debt_10k',
      { totalPaid },
      `💪 ${formatCurrency(totalPaid)} eliminated. That's not a rounding error — that's real money back in your life. The discipline you've shown here compounds.`,
      isHomeowner
        ? `${name} — ${formatCurrency(totalPaid)} knocked out. NOVO flagged this and I wanted you to hear it from me — that kind of progress has a real impact on your financial picture. You should feel good about this.`
        : `${name} — ${formatCurrency(totalPaid)} eliminated. NOVO flagged this. That's the kind of progress that changes trajectories. Keep going.`,
      null,
      null
    );
  }

  if (totalPaid >= 25000 && !hasTriggered('debt_25k')) {
    triggerMilestone(
      'debt_25k',
      { totalPaid },
      `🚀 ${formatCurrency(totalPaid)} paid down. You're not the same person who started this. That's a quarter of the way to a serious financial transformation.`,
      `${name} — ${formatCurrency(totalPaid)} eliminated. I have to be straight with you — NOVO flagged this and it caught my attention. That's genuinely impressive discipline. Whatever you're doing, keep doing it.`,
      null,
      null
    );
  }

  if (totalPaid >= 50000 && !hasTriggered('debt_50k')) {
    triggerMilestone(
      'debt_50k',
      { totalPaid },
      `🏆 ${formatCurrency(totalPaid)} paid off. That is extraordinary. Most people never get here. You did.`,
      `${name} — ${formatCurrency(totalPaid)} eliminated. NOVO flagged this and I had to reach out personally. That is life-changing work. I don't say that lightly.`,
      null,
      null
    );
  }

  if (!isHomeowner && dti > 0 && dti < 43 && dti >= 36 && !hasTriggered('dti_under_43')) {
    triggerMilestone(
      'dti_under_43',
      { dti },
      `📊 Your debt-to-income ratio just dropped to ${dti}%. That's meaningful progress — your monthly obligations are becoming a smaller piece of your income picture.`,
      `${name} — NOVO flagged your DTI hit ${dti}%. That's a real milestone for your financial health. Things are moving in the right direction.`,
      null,
      null
    );
  }

  if (!isHomeowner && dti > 0 && dti < 36 && !hasTriggered('dti_under_36')) {
    triggerMilestone(
      'dti_under_36',
      { dti },
      `🏠 DTI at ${dti}% — that's strong. Your income to debt ratio is in excellent shape. That hard work is showing up in your numbers.`,
      `${name} — your DTI is at ${dti}%. NOVO flagged this. That's an exceptional number and it reflects real consistent effort on your part.`,
      null,
      null
    );
  }

  if (!hasTriggered('ninety_days_active')) {
    const createdDates = debts.map(d => new Date(d.createdAt).getTime()).filter(Boolean);
    if (createdDates.length > 0) {
      const earliestDebt = Math.min(...createdDates);
      const daysActive = Math.round((Date.now() - earliestDebt) / (1000 * 60 * 60 * 24));
      if (daysActive >= 90) {
        triggerMilestone(
          'ninety_days_active',
          { daysActive },
          `📅 90 days in. Most people quit before now. You haven't. That consistency is the whole game — everything else is just math.`,
          `${name} — 90 days. NOVO flagged it. I know that might not sound like a big deal but staying consistent for 3 months is where most people fall off. You didn't. That matters.`,
          null,
          null
        );
      }
    }
  }

  if (!hasTriggered('six_months_active')) {
    const createdDates = debts.map(d => new Date(d.createdAt).getTime()).filter(Boolean);
    if (createdDates.length > 0) {
      const earliestDebt = Math.min(...createdDates);
      const monthsActive = Math.round((Date.now() - earliestDebt) / (1000 * 60 * 60 * 24 * 30));
      if (monthsActive >= 6) {
        triggerMilestone(
          'six_months_active',
          { monthsActive },
          `🎯 Six months working your plan. That's not luck — that's a habit. The people who make it to 6 months almost always make it to debt free.`,
          `${name} — six months. NOVO flagged it. I like to check in around this point — not to sell you anything, just to make sure you're on the best path. How's it going?`,
          null,
          null
        );
      }
    }
  }

  const checkingAccounts = StorageService.getCheckingAccounts();
  const hasReconciled = checkingAccounts.some(a => a.lastReconciledAt);
  if (hasReconciled && !hasTriggered('first_reconciliation')) {
    triggerMilestone(
      'first_reconciliation',
      {},
      `✅ You just reconciled your account — that's a habit most people skip. Knowing your exact numbers is what separates people who make progress from people who wonder where their money went.`,
      null,
      null,
      null
    );
  }

  const totalExpenses = profile.monthlyEssentialExpenses + profile.monthlyDiscretionaryExpenses;
  if (totalExpenses > profile.monthlyNetIncome && !hasTriggered('expenses_exceed_income')) {
    triggerMilestone(
      'expenses_exceed_income',
      { totalExpenses, income: profile.monthlyNetIncome },
      `⚠️ Your expenses are running above your income right now. That needs attention — check the Spending Analysis in your Tracker and look at Smarter Payments for quick wins.`,
      `${name} — NOVO flagged something I want to make sure you're aware of. Your expenses are above your income right now. That's not a crisis but it needs attention soon. I'm here if you want to think through it.`,
      null,
      null,
      true
    );
  }
}

export function clearMilestoneHistory(): void {
  localStorage.removeItem('novo_detected_milestones');
  localStorage.removeItem('novo_proactive_messages');
  localStorage.removeItem('novo_ben_tasks');
}

export { getProactiveMessages, saveProactiveMessages, getBenTasks, saveBenTasks };
