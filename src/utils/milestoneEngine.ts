import { StorageService } from '../services/storage';
import type { Debt } from '../types';

export type MilestoneType =
  | 'first_debt_paid'
  | 'debt_10k'
  | 'debt_25k'
  | 'debt_50k'
  | 'dti_under_43'
  | 'dti_under_36'
  | 'consistent_payments'
  | 'surplus_increased'
  | 'expenses_exceed_income'
  | 'home_ready'
  | 'six_months_active'
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
    const userName = localStorage.getItem('userName');
    if (userName && userName.trim()) {
      return userName.trim().split(' ')[0];
    }
    return 'there';
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
  const debts = StorageService.getDebts();
  const profile = StorageService.getFinancialProfile();
  const homeEquity = StorageService.getHomeEquity();
  const isHomeowner = homeEquity?.ownsHome || false;
  const name = getUserFirstName();

  if (!profile || debts.length === 0) return;

  const totalStarting = debts.reduce((s, d) => s + (d.startingBalance || 0), 0);
  const totalCurrent = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalPaid = totalStarting - totalCurrent;
  const paidOffDebts = debts.filter(d => d.isPaidOff);
  const monthlyDebtPayments = debts.filter(d => !d.isPaidOff).reduce((s, d) => s + d.minimumPayment, 0);
  const dti = profile.monthlyGrossIncome > 0
    ? Math.round((monthlyDebtPayments / profile.monthlyGrossIncome) * 100)
    : 0;

  if (paidOffDebts.length >= 1 && !hasTriggered('first_debt_paid')) {
    const debt = paidOffDebts[0];
    triggerMilestone(
      'first_debt_paid',
      { debtName: debt.accountName },
      `🎉 You paid off your ${debt.accountName}! That's your first one down. The momentum from here is real — every extra dollar now rolls into your next debt.`,
      `Hey ${name} — NOVO just flagged that you paid off your ${debt.accountName}. That's a big deal and I wanted you to know I noticed. Keep going — the snowball is starting to roll.`,
      'Schedule a quick call',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (totalPaid >= 10000 && !hasTriggered('debt_10k')) {
    triggerMilestone(
      'debt_10k',
      { totalPaid },
      `💪 You've paid down ${formatCurrency(totalPaid)} in total debt. That's not a small number — that's discipline showing up consistently.`,
      isHomeowner
        ? `Hey ${name} — NOVO flagged that you've knocked out ${formatCurrency(totalPaid)} in debt. As a homeowner that kind of progress has a real impact on your financial picture. I'd love to do a quick 15-minute check-in when you're ready.`
        : `Hey ${name} — NOVO flagged that you've eliminated ${formatCurrency(totalPaid)} in debt. At this pace, homeownership is becoming a real conversation. I'd love to chat about what your timeline could look like.`,
      'Book a 15-min call with Ben',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (totalPaid >= 25000 && !hasTriggered('debt_25k')) {
    triggerMilestone(
      'debt_25k',
      { totalPaid },
      `🚀 ${formatCurrency(totalPaid)} paid down. You're not the same person who started this. That's a quarter of the way to a serious financial transformation.`,
      `${name} — I have to be straight with you. ${formatCurrency(totalPaid)} eliminated is genuinely impressive. NOVO flagged this and I wanted to reach out personally. This is the kind of progress that opens doors. Let's talk.`,
      'Book a call with Ben',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (totalPaid >= 50000 && !hasTriggered('debt_50k')) {
    triggerMilestone(
      'debt_50k',
      { totalPaid },
      `🏆 ${formatCurrency(totalPaid)} paid off. That is extraordinary. Most people never get here. You did.`,
      `${name} — ${formatCurrency(totalPaid)} eliminated. I don't say this lightly — that is life-changing. NOVO caught this and I had to reach out myself. Whatever is next for you financially, I want to be part of that conversation.`,
      'Book a call with Ben',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (!isHomeowner && dti > 0 && dti < 43 && dti >= 36 && !hasTriggered('dti_under_43')) {
    triggerMilestone(
      'dti_under_43',
      { dti },
      `📊 Your debt-to-income ratio just dropped to ${dti}%. That's inside conventional mortgage qualifying range. You're closer to a home than you might think.`,
      `${name} — NOVO just flagged something I get excited about. Your DTI hit ${dti}% — that's inside qualifying range for a conventional mortgage. When you're ready to have that conversation, I'm here.`,
      'Book a mortgage check-in',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (!isHomeowner && dti > 0 && dti < 36 && !hasTriggered('dti_under_36')) {
    triggerMilestone(
      'dti_under_36',
      { dti },
      `🏠 DTI at ${dti}% — that's prime qualifying territory. Most lenders love to see this number. Your hard work is translating directly into buying power.`,
      `${name} — your DTI is at ${dti}%. That's exceptional. NOVO flagged this and honestly I want to make sure you know what this means for your options. Let's talk soon.`,
      'Book a mortgage check-in',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
    );
  }

  if (isHomeowner && !hasTriggered('six_months_active')) {
    const createdDates = debts.map(d => new Date(d.createdAt).getTime()).filter(Boolean);
    if (createdDates.length > 0) {
      const earliestDebt = Math.min(...createdDates);
      const monthsActive = Math.round((Date.now() - earliestDebt) / (1000 * 60 * 60 * 24 * 30));
      if (monthsActive >= 6) {
        triggerMilestone(
          'six_months_active',
          { monthsActive },
          `📅 You've been working your plan for ${monthsActive} months. That kind of consistency is rare — and it's exactly what builds lasting financial health.`,
          `Hey ${name} — you've been at this for ${monthsActive} months now and NOVO shows real progress. I like to do a quick financial health check-in around this point — no agenda, just making sure you're on the best path. Grab a time if you're up for it.`,
          'Schedule a check-in with Ben',
          'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc'
        );
      }
    }
  }

  const totalExpenses = profile.monthlyEssentialExpenses + profile.monthlyDiscretionaryExpenses;
  if (totalExpenses > profile.monthlyNetIncome && !hasTriggered('expenses_exceed_income')) {
    triggerMilestone(
      'expenses_exceed_income',
      { totalExpenses, income: profile.monthlyNetIncome },
      `⚠️ Your expenses are running above your income right now. That's worth addressing before it works against your progress. Check the Spending Analysis in your Tracker for specifics.`,
      `${name} — NOVO flagged something I want to make sure you're aware of. Your expenses are above your income right now. That's not a crisis but it does need attention. I'm here if you want to talk through it.`,
      'Book a call with Ben',
      'https://api.leadconnectorhq.com/widget/booking/Ms28gTzPwpR5BbzeU0Dc',
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
