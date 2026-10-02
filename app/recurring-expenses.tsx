"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { needsConfirmation, type RecurringExpense } from "@/lib/recurring-schedule";

type Member = { id: string; name: string; role: string; status: string };

export function RecurringExpenses({ admin, configured, members, currencies, categories }: { admin: boolean; configured: boolean; members: Member[]; currencies: string[]; categories: string[] }) {
  const [items, setItems] = useState<RecurringExpense[]>([]);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pending = !admin ? items.find(item => needsConfirmation(item, today)) : undefined;
  const pendingId = pending?.id;
  const pendingDue = pending?.next_due;

  const load = useCallback(async () => {
    if (!configured || busy.current) return;
    const requestRevision = revision.current;
    try {
      const response = await fetch("/api/recurring-expenses", { cache: "no-store" });
      const payload = await response.json();
      if (busy.current || revision.current !== requestRevision) return;
      if (!response.ok) throw new Error(payload.message ?? "Could not load recurring expenses");
      setItems(payload.items); setToday(payload.today); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load subscriptions"); }
  }, [configured]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 15000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [load]);

  useEffect(() => {
    if (!pendingId) return;
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [pendingId, pendingDue]);

  async function mutate(body: object, method: string) {
    if (busy.current) return false;
    revision.current += 1;
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/recurring-expenses", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Could not save subscription");
      setItems(current => method === "POST" ? [...current, payload.item] : current.map(item => item.id === payload.item.id ? payload.item : item));
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save subscription"); return false; }
    finally { busy.current = false; setSaving(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (await mutate(data, "POST")) { form.reset(); setOpen(false); }
  }

  const money = (item: RecurringExpense) => new Intl.NumberFormat("en", { style: "currency", currency: item.currency }).format(Number(item.amount));
  if (!admin) return pending ? <dialog ref={dialog} className="delete-expense-modal subscription-confirm" aria-labelledby="subscription-title" aria-describedby="subscription-description" aria-busy={saving} onCancel={event => event.preventDefault()}>
    <div className="delete-expense-header"><span className="subscription-icon"><RefreshCw size={24} aria-hidden="true" /></span><span className="subscription-badge">Renewal check</span></div>
    <h2 id="subscription-title">Still using this subscription?</h2>
    <p id="subscription-description">Please confirm whether this subscription is still active before its next renewal.</p>
    <div className="delete-expense-summary"><div><strong>{pending.merchant}</strong><span>Renews {pending.next_due} · {pending.category}</span></div><strong>{money(pending)}</strong></div>
    {error && <p role="alert" className="delete-expense-error">{error}</p>}
    <p>Your response is required. This reminder stays open until your confirmation is saved.</p>
    <div className="modal-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => void mutate({ id: pending.id, due: pending.next_due, active: false }, "PATCH")}>No longer active</button><button type="button" className="primary-button dark" disabled={saving} onClick={() => void mutate({ id: pending.id, due: pending.next_due, active: true }, "PATCH")}>{saving ? "Saving…" : "Still active"}</button></div>
  </dialog> : null;

  return <section className="recurring-panel">
    <div className="section-head"><div><p className="eyebrow">Subscriptions</p><h2>Recurring expenses</h2><p>Assign monthly renewals and check that they’re still active.</p></div><button type="button" className="secondary-button" disabled={!configured} onClick={() => setOpen(!open)}>{open ? "Cancel" : "Add recurring expense"}</button></div>
    {!configured && <p className="muted">Connect the team database to save recurring expenses.</p>}
    {error && <p role="alert" className="delete-expense-error">{error}</p>}
    {open && <form className="recurring-form" onSubmit={create}>
      <label>Subscription name<input name="merchant" required maxLength={160} placeholder="e.g. Adobe Creative Cloud" /></label>
      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label>
      <label>Currency<select name="currency">{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Category<select name="category">{categories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Assigned member<select name="assigned_member_id" required defaultValue=""><option value="" disabled>Choose a member</option>{members.filter(m => m.role === "member" && m.status === "active").map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Monthly renewal day<input name="renewal_day" type="number" min="1" max="31" required defaultValue="1" /></label>
      <label>First renewal date<input name="next_due" type="date" min={today} required /></label>
      <label>Confirm before renewal<select name="reminder_days" defaultValue="3"><option value="1">1 day before</option><option value="3">3 days before</option><option value="7">7 days before</option></select></label>
      <p className="muted">For days 29–31, shorter months renew on their final day. Members must confirm each renewal. Payments are recorded separately after they are made.</p>
      <button className="primary-button dark" disabled={saving}>{saving ? "Saving…" : "Save recurring expense"}</button>
    </form>}
    {!items.length && configured && !error && <p className="muted">No recurring expenses yet.</p>}
    <div className="recurring-list">{items.map(item => <div className="recurring-item" key={item.id}><CalendarDays size={20} aria-hidden="true" /><div><strong>{item.merchant}</strong><p>{members.find(m => m.id === item.assigned_member_id)?.name} · Day {item.renewal_day} each month · {money(item)}</p><small>{!item.active ? "Inactive" : item.confirmed_due === item.next_due ? `Confirmed active for ${item.next_due}` : `Awaiting member confirmation · ${item.next_due}`}</small></div><button type="button" className="secondary-button" disabled={saving} onClick={() => void mutate({ id: item.id, active: !item.active }, "PATCH")}>{item.active ? "Pause" : "Resume"}</button></div>)}</div>
  </section>;
}
