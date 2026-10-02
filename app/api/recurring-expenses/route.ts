import { requireSiteAccess } from "@/lib/site-password";
import { errorResponse, getMembers, getTeam, requireAdmin, requireMember, supabaseRequest } from "@/lib/supabase-admin";
import { needsConfirmation, nextMonthlyDate, todayInBangkok, type RecurringExpense } from "@/lib/recurring-schedule";

export async function GET(request: Request) {
  try {
    await requireSiteAccess(request);
    const member = await requireMember(request);
    const today = todayInBangkok();
    const filter = member.role === "admin" ? "" : `&assigned_member_id=eq.${member.id}&active=eq.true`;
    const items = await supabaseRequest<RecurringExpense[]>(`/rest/v1/recurring_expenses?team_id=eq.${member.team_id}${filter}&select=*&order=next_due.asc`);
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item.active || item.confirmed_due !== item.next_due || item.next_due >= today) continue;
      const nextDue = nextMonthlyDate(item.next_due, item.renewal_day);
      // A missed month always requires confirmation; do not silently skip renewals.
      const advanced = await supabaseRequest<RecurringExpense[]>(`/rest/v1/recurring_expenses?id=eq.${item.id}&team_id=eq.${member.team_id}&next_due=eq.${item.next_due}&confirmed_due=eq.${item.next_due}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ next_due: nextDue, confirmed_due: null }) });
      if (advanced[0]) items[index] = advanced[0];
    }
    return Response.json({ items, today }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireSiteAccess(request);
    const admin = await requireAdmin(request);
    const body = await request.json();
    const merchant = String(body.merchant ?? "").trim();
    const amount = Number(body.amount);
    const renewalDay = Number(body.renewal_day);
    const reminderDays = Number(body.reminder_days);
    const nextDue = String(body.next_due ?? "");
    const category = String(body.category ?? "").trim();
    const [members, team] = await Promise.all([getMembers(admin.team_id), getTeam(admin.team_id)]);
    if (!merchant || merchant.length > 160 || !Number.isFinite(amount) || amount <= 0 || amount > 999_999_999_999 || !Number.isInteger(renewalDay) || renewalDay < 1 || renewalDay > 31 || !Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 14 || !/^\d{4}-\d{2}-\d{2}$/.test(nextDue) || !Number.isFinite(Date.parse(nextDue)) || new Date(nextDue).toISOString().slice(0,10) !== nextDue || nextDue < todayInBangkok() || !category || category.length > 50) return Response.json({ message: "Check the subscription details and renewal date" }, { status: 400 });
    if (!members.some(m => m.id === body.assigned_member_id && m.role === "member" && m.status === "active")) return Response.json({ message: "Assign an active team member" }, { status: 400 });
    if (!(team.allowed_currencies ?? [team.currency]).includes(body.currency)) return Response.json({ message: "Choose an enabled currency" }, { status: 400 });
    const items = await supabaseRequest<RecurringExpense[]>("/rest/v1/recurring_expenses?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ team_id: admin.team_id, merchant, amount, currency: body.currency, category, renewal_day: renewalDay, reminder_days: reminderDays, next_due: nextDue, assigned_member_id: body.assigned_member_id }) });
    return Response.json({ item: items[0] }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireSiteAccess(request);
    const member = await requireMember(request);
    const body = await request.json();
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return Response.json({ message: "Choose a subscription" }, { status: 400 });
    const path = `/rest/v1/recurring_expenses?id=eq.${body.id}&team_id=eq.${member.team_id}`;
    if (member.role === "admin") {
      if (typeof body.active !== "boolean") return Response.json({ message: "Choose an active status" }, { status: 400 });
      const items = await supabaseRequest<RecurringExpense[]>(`${path}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ active: body.active, ...(body.active ? { confirmed_due: null } : {}) }) });
      if (!items[0]) return Response.json({ message: "Subscription not found" }, { status: 404 });
      return Response.json({ item: items[0] });
    }
    const items = await supabaseRequest<RecurringExpense[]>(`${path}&assigned_member_id=eq.${member.id}&select=*`);
    const item = items[0];
    if (!item || !needsConfirmation(item, todayInBangkok()) || body.due !== item.next_due || typeof body.active !== "boolean") return Response.json({ message: "This confirmation is no longer pending. Refresh and try again." }, { status: 409 });
    const updated = await supabaseRequest<RecurringExpense[]>(`${path}&assigned_member_id=eq.${member.id}&next_due=eq.${item.next_due}&active=eq.true&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ active: body.active, confirmed_due: item.next_due }) });
    if (!updated[0]) return Response.json({ message: "Subscription changed. Refresh and try again." }, { status: 409 });
    return Response.json({ item: updated[0] });
  } catch (error) { return errorResponse(error); }
}
