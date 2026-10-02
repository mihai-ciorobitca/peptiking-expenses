export type RecurringExpense = {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  assigned_member_id: string;
  renewal_day: number;
  next_due: string;
  reminder_days: number;
  active: boolean;
  confirmed_due: string | null;
};

export function todayInBangkok(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function nextMonthlyDate(date: string, day: number) {
  const [year, month] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  next.setUTCDate(Math.min(day, new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()));
  return next.toISOString().slice(0, 10);
}

export function needsConfirmation(item: RecurringExpense, today: string) {
  if (!item.active || item.confirmed_due === item.next_due) return false;
  const reminder = new Date(`${item.next_due}T00:00:00Z`);
  reminder.setUTCDate(reminder.getUTCDate() - item.reminder_days);
  return today >= reminder.toISOString().slice(0, 10);
}
