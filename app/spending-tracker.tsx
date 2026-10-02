"use client";

import Image from "next/image";
import { RecurringExpenses } from "./recurring-expenses";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { getQueuedExpenses, loadLatestWorkspaceSnapshot, queueExpense, removeQueuedExpense, saveWorkspaceSnapshot, type QueuedExpenseRecord } from "@/lib/offline-expenses";
import {
  ArrowRight,
  Banknote,
  Bookmark,
  Building2,
  Camera,
  Car,
  Check,
  ChevronDown,
  CircleEllipsis,
  CloudUpload,
  Code2,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  FileUp,
  Flag,
  Globe2,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings,
  Smartphone,
  Trash2,
  Utensils,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Tab = "home" | "activity" | "admin" | "settings";
type Role = "admin" | "member";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "wallet";

type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "inactive";
  avatarColor: string;
  hasPassword: boolean;
};

type Expense = {
  id: string;
  clientId?: string | null;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  paymentMethod: PaymentMethod;
  spentAt: string;
  spenderId: string;
  proofUrl?: string | null;
  proofType?: string | null;
  notes?: string;
  status?: "logged" | "issue";
  pendingSync?: boolean;
};

type TeamSettings = {
  teamName: string;
  currency: string;
  currencies: string[];
  categories: string[];
  savedPlaces: string[];
  requireProof: boolean;
  requiredAppVersion: string;
};

type BootstrapPayload = {
  configured: boolean;
  currentMember?: Member;
  members?: Member[];
  expenses?: Expense[];
  settings?: TeamSettings;
  message?: string;
};

type ProofViewerValue = { expense: Expense; url: string; contentType: string };

const DEMO_MEMBERS: Member[] = [
  { id: "m-rog", name: "Admin", email: "admin@peptikingmedia.com", role: "admin", status: "active", avatarColor: "#f3bf73", hasPassword: true },
  { id: "m-maya", name: "Maya Chen", email: "maya@northstar.team", role: "member", status: "active", avatarColor: "#a9d9c7", hasPassword: true },
  { id: "m-niko", name: "Niko Rahman", email: "niko@northstar.team", role: "member", status: "active", avatarColor: "#f5a98c", hasPassword: true },
  { id: "m-lena", name: "Lena Park", email: "lena@northstar.team", role: "member", status: "active", avatarColor: "#c5b8e8", hasPassword: true },
];

const DEMO_EXPENSES: Expense[] = [
  { id: "e-1", merchant: "CloudNine Software", amount: 3790, currency: "EUR", category: "Software", paymentMethod: "card", spentAt: "2026-08-03", spenderId: "m-rog", proofUrl: "proof" },
  { id: "e-2", merchant: "Team lunch · Savoey", amount: 3000, currency: "EUR", category: "Meals", paymentMethod: "wallet", spentAt: "2026-08-02", spenderId: "m-maya", proofUrl: "proof" },
  { id: "e-3", merchant: "Client welcome gifts", amount: 2885, currency: "EUR", category: "Other", paymentMethod: "bank_transfer", spentAt: "2026-08-02", spenderId: "m-niko", proofUrl: "proof" },
  { id: "e-4", merchant: "AIS Business", amount: 2140, currency: "EUR", category: "Utilities", paymentMethod: "card", spentAt: "2026-08-01", spenderId: "m-rog", proofUrl: "proof" },
  { id: "e-5", merchant: "Grab for Business", amount: 1240, currency: "EUR", category: "Transport", paymentMethod: "wallet", spentAt: "2026-08-01", spenderId: "m-maya", proofUrl: "proof" },
  { id: "e-6", merchant: "B2S stationery", amount: 865, currency: "EUR", category: "Supplies", paymentMethod: "cash", spentAt: "2026-07-31", spenderId: "m-niko", proofUrl: "proof" },
  { id: "e-7", merchant: "Common Ground café", amount: 480, currency: "EUR", category: "Meals", paymentMethod: "cash", spentAt: "2026-07-30", spenderId: "m-rog", proofUrl: "proof" },
  { id: "e-8", merchant: "Workshop snacks", amount: 420, currency: "EUR", category: "Meals", paymentMethod: "cash", spentAt: "2026-07-29", spenderId: "m-maya", proofUrl: "proof" },
];

const DEFAULT_SETTINGS: TeamSettings = {
  teamName: "Northstar Studio",
  currency: "EUR",
  currencies: ["EUR"],
  categories: ["Meals", "Transport", "Software", "Supplies", "Utilities", "Travel", "Other"],
  savedPlaces: [],
  requireProof: true,
  requiredAppVersion: "1.0.0",
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
const EUR_TO_VND = 30_000;
type VndUnit = "K" | "M";

function amountFromInput(amount: string, currency: string, vndUnit: VndUnit) {
  const numericAmount = Number(amount);
  if (currency !== "VND") return numericAmount;
  return numericAmount * (vndUnit === "M" ? 1_000_000 : 1_000);
}

function editableVndAmount(amount: number) {
  const vndUnit: VndUnit = amount >= 1_000_000 ? "M" : "K";
  return { amount: String(amount / (vndUnit === "M" ? 1_000_000 : 1_000)), vndUnit };
}

function isNewerVersion(requiredVersion: string, currentVersion: string) {
  const required = requiredVersion.split(".").map(Number);
  const current = currentVersion.split(".").map(Number);
  for (let index = 0; index < Math.max(required.length, current.length); index += 1) {
    const difference = (required[index] ?? 0) - (current[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

const CATEGORIES = ["Meals", "Transport", "Software", "Supplies", "Utilities", "Travel", "Other"];
const CURRENCY_OPTIONS = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "VND", label: "Vietnamese đồng (VND)" },
];
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Meals: Utensils,
  Transport: Car,
  Software: Code2,
  Supplies: Package,
  Utilities: Zap,
  Travel: Plane,
  Other: CircleEllipsis,
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Online",
  wallet: "Phone app",
};

const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Globe2,
  wallet: Smartphone,
};

function initials(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

function avatarStyle(color: string): CSSProperties {
  return { "--avatar": color } as CSSProperties;
}

function formatMoney(amount: number, currency: string, compact = false) {
  if (currency === "VND") {
    const absolute = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";
    const compactNumber = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
    if (absolute >= 1_000_000) return `${sign}₫${compactNumber(absolute / 1_000_000)}M`;
    if (absolute >= 1_000) return `${sign}₫${compactNumber(absolute / 1_000)}K`;
    return `${sign}₫${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(absolute)}`;
  }
  const locale = currency === "VND" ? "vi-VN" : "en-IE";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function toEuros(amount: number, currency: string) {
  return currency === "VND" ? amount / EUR_TO_VND : amount;
}

function getCurrencyTotals(expenses: Expense[]) {
  const eur = expenses.filter((expense) => expense.currency === "EUR").reduce((sum, expense) => sum + expense.amount, 0);
  const vnd = expenses.filter((expense) => expense.currency === "VND").reduce((sum, expense) => sum + expense.amount, 0);
  return { eur, vnd, totalEur: eur + vnd / EUR_TO_VND, totalVnd: vnd + eur * EUR_TO_VND };
}

type DropdownOption = {
  value: string;
  label: string;
};

function Dropdown({ id, value, options, onChange }: {
  id: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const modalTitle = id.includes("category") ? "Choose category" : id.includes("currency") ? "Choose currency" : "Choose an option";

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => selectedOptionRef.current?.focus(), 0);
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, selectedIndex]);

  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + options.length) % options.length);
    } else if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={`select-control ${open ? "open" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? `${id}-option-${options[activeIndex].value}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="select-value">{options[selectedIndex]?.label}</span>
        <ChevronDown className="select-chevron" size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="select-modal-backdrop" onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}>
          <section className="select-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-modal-title`}>
            <div className="select-modal-header">
              <div>
                <span className="select-modal-eyebrow">Select an option</span>
                <h2 id={`${id}-modal-title`}>{modalTitle}</h2>
              </div>
              <button type="button" className="select-modal-close" aria-label="Close options" onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}><X size={20} strokeWidth={1.9} /></button>
            </div>
            <div className="select-modal-list" id={`${id}-listbox`} role="listbox" aria-label={modalTitle}>
              {options.map((option, index) => (
                <button
                  ref={option.value === value ? selectedOptionRef : undefined}
                  key={option.value}
                  id={`${id}-option-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`select-modal-option ${index === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value && <span className="select-check" aria-hidden="true"><Check size={15} strokeWidth={2.4} /></span>}
                </button>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function normalizedCategory(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function categoriesWithValue(categories: string[], value: string) {
  const available = categories.length ? categories : CATEGORIES;
  return available.some((category) => category.toLocaleLowerCase() === value.toLocaleLowerCase()) ? available : [...available, value];
}

function addUniqueCategory(categories: string[], value: string) {
  const category = normalizedCategory(value);
  if (!category || categories.some((current) => current.toLocaleLowerCase() === category.toLocaleLowerCase())) return categories;
  return [...categories, category];
}

function addUniquePlace(places: string[], value: string) {
  const place = value.trim().replace(/\s+/g, " ");
  if (!place || places.some((current) => current.toLocaleLowerCase() === place.toLocaleLowerCase())) return places;
  return [...places, place];
}

function CategoryPicker({ id, value, categories, onChange }: {
  id: string;
  value: string;
  categories: string[];
  onChange: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const available = categoriesWithValue(categories, value);

  const chooseNewCategory = () => {
    const category = normalizedCategory(newCategory);
    if (!category) return setError("Enter a category name.");
    if (category.length > 50) return setError("Use 50 characters or fewer.");
    const existing = available.find((candidate) => candidate.toLocaleLowerCase() === category.toLocaleLowerCase());
    onChange(existing ?? category);
    setNewCategory("");
    setError(null);
    setAdding(false);
  };

  return (
    <div className="category-picker">
      <Dropdown id={id} value={value} options={available.map((category) => ({ value: category, label: category }))} onChange={onChange} />
      {!adding ? (
        <button type="button" className="add-category-button" onClick={() => setAdding(true)}><Plus size={15} strokeWidth={2} aria-hidden="true" />Add a new category</button>
      ) : (
        <div className="new-category-panel">
          <div className="new-category-row">
            <input
              autoFocus
              value={newCategory}
              maxLength={50}
              placeholder="e.g. Marketing"
              aria-label="New category name"
              onChange={(event) => { setNewCategory(event.target.value); setError(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  chooseNewCategory();
                } else if (event.key === "Escape") {
                  setAdding(false);
                  setError(null);
                }
              }}
            />
            <button type="button" className="new-category-confirm" onClick={chooseNewCategory}><Check size={16} strokeWidth={2.2} aria-hidden="true" />Add</button>
            <button type="button" className="new-category-cancel" aria-label="Cancel adding category" onClick={() => { setAdding(false); setNewCategory(""); setError(null); }}><X size={17} strokeWidth={2} aria-hidden="true" /></button>
          </div>
          {error && <span className="new-category-error" role="alert">{error}</span>}
        </div>
      )}
    </div>
  );
}

function SavedPlaceField({ value, places, savePlace, onChange, onSavePlaceChange }: {
  value: string;
  places: string[];
  savePlace: boolean;
  onChange: (value: string) => void;
  onSavePlaceChange: (value: boolean) => void;
}) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const alreadySaved = Boolean(normalized) && places.some((place) => place.toLocaleLowerCase() === normalized.toLocaleLowerCase());

  return (
    <div className="field saved-place-field">
      <label htmlFor="merchant">Merchant or place</label>
      <div className="merchant-input-wrap"><MapPin size={17} strokeWidth={1.9} aria-hidden="true" /><input id="merchant" value={value} maxLength={160} onChange={(event) => { onChange(event.target.value); onSavePlaceChange(false); }} placeholder="e.g. Taxi to client" /></div>
      {places.length > 0 && (
        <div className="saved-place-strip" aria-label="Saved places">
          {places.map((place) => <button key={place} type="button" className={place.toLocaleLowerCase() === normalized.toLocaleLowerCase() ? "active" : ""} onClick={() => { onChange(place); onSavePlaceChange(false); }}><MapPin size={13} strokeWidth={2} aria-hidden="true" />{place}</button>)}
        </div>
      )}
      <button type="button" className={`save-place-button ${savePlace || alreadySaved ? "active" : ""}`} disabled={!normalized || alreadySaved} aria-pressed={savePlace || alreadySaved} onClick={() => onSavePlaceChange(!savePlace)}>
        <Bookmark size={15} strokeWidth={2} fill={savePlace || alreadySaved ? "currentColor" : "none"} aria-hidden="true" />
        {alreadySaved ? "Saved place" : savePlace ? "Will save for next time" : "Save this place for next time"}
      </button>
    </div>
  );
}

function displayDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parsed);
}

function todayValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function queuedExpenseToExpense(record: QueuedExpenseRecord): Expense {
  return {
    id: record.id,
    merchant: record.draft.merchant,
    amount: record.draft.amount,
    currency: record.draft.currency,
    category: record.draft.category,
    paymentMethod: record.draft.paymentMethod,
    spentAt: record.draft.spentAt,
    spenderId: record.draft.spenderId,
    notes: record.draft.notes,
    proofUrl: record.draft.proofBlob ? URL.createObjectURL(record.draft.proofBlob) : null,
    proofType: record.draft.proofType,
    pendingSync: true,
  };
}

async function readApiPayload<T>(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(response.status === 413 ? "Proof file is too large for this connection" : "The server could not complete the request");
  }
}

async function pushQueuedExpense(record: QueuedExpenseRecord) {
  const body = new FormData();
  const draft = record.draft;
  body.set("merchant", draft.merchant);
  body.set("amount", String(draft.amount));
  body.set("currency", draft.currency);
  body.set("category", draft.category);
  body.set("paymentMethod", draft.paymentMethod);
  body.set("spentAt", draft.spentAt);
  body.set("spenderId", draft.spenderId);
  body.set("notes", draft.notes);
  body.set("savePlace", String(draft.savePlace));
  body.set("clientId", record.id);

  if (draft.proofBlob && draft.proofName && draft.proofType) {
    if (!record.uploadedProofPath) {
      const uploadUrlResponse = await fetch("/api/proofs/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: draft.proofName, type: draft.proofType, size: draft.proofBlob.size, spentAt: draft.spentAt }),
      });
      const uploadDetails = await readApiPayload<{ uploadUrl?: string; token?: string; path?: string; message?: string }>(uploadUrlResponse);
      if (!uploadUrlResponse.ok || !uploadDetails.uploadUrl || !uploadDetails.token || !uploadDetails.path) throw new Error(uploadDetails.message ?? "Could not prepare proof upload");
      const signedUploadUrl = new URL(uploadDetails.uploadUrl);
      signedUploadUrl.searchParams.set("token", uploadDetails.token);
      const proofBody = new FormData();
      proofBody.set("file", draft.proofBlob, draft.proofName);
      proofBody.set("cacheControl", "3600");
      const uploaded = await fetch(signedUploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: proofBody });
      if (!uploaded.ok) throw new Error("Proof upload failed. Please try again.");
      record.uploadedProofPath = uploadDetails.path;
      await queueExpense(record);
    }
    body.set("proofPath", record.uploadedProofPath);
    body.set("proofName", draft.proofName);
    body.set("proofType", draft.proofType);
  }

  const response = await fetch("/api/expenses", { method: "POST", body });
  const payload = await readApiPayload<{ expense?: Expense; message?: string }>(response);
  if (!response.ok || !payload.expense) throw new Error(payload.message ?? "Could not save expense");
  return payload.expense;
}

export function SpendingTracker() {
  const [tab, setTab] = useState<Tab>("home");
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS);
  const [expenses, setExpenses] = useState<Expense[]>(DEMO_EXPENSES);
  const [settings, setSettings] = useState<TeamSettings>(DEFAULT_SETTINGS);
  const [currentMember, setCurrentMember] = useState<Member>(DEMO_MEMBERS[0]);
  const [configured, setConfigured] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [proofViewer, setProofViewer] = useState<ProofViewerValue | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteInFlightRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const workspaceSyncingRef = useRef(false);
  const pendingExpenseSavesRef = useRef(0);
  const offlineSyncingRef = useRef(false);

  const syncQueuedExpenses = useCallback(async (announce = false) => {
    if (!configured || typeof navigator === "undefined" || !navigator.onLine || offlineSyncingRef.current) return;
    offlineSyncingRef.current = true;
    pendingExpenseSavesRef.current += 1;
    let synced = 0;
    let lastError: string | null = null;
    try {
      const queued = await getQueuedExpenses(currentMember.email);
      setOfflineCount(queued.length);
      for (const record of queued) {
        if (!navigator.onLine) break;
        try {
          const savedExpense = await pushQueuedExpense(record);
          await removeQueuedExpense(record.id);
          setExpenses((current) => [savedExpense, ...current.filter((expense) => expense.id !== record.id && expense.id !== savedExpense.id)]);
          synced += 1;
        } catch (error) {
          // Keep the item and its proof in IndexedDB for the next automatic retry.
          lastError = error instanceof Error ? error.message : "The connection was interrupted";
        }
      }
      const remaining = await getQueuedExpenses(currentMember.email);
      setOfflineCount(remaining.length);
      if (synced > 0) setToast(`${synced} offline expense${synced === 1 ? "" : "s"} synced.`);
      else if (announce && remaining.length > 0) setToast(`Could not sync yet: ${lastError ?? "the connection is unavailable"}. Your expenses are safe offline.`);
      else if (announce) setToast("Everything is up to date.");
    } finally {
      pendingExpenseSavesRef.current = Math.max(0, pendingExpenseSavesRef.current - 1);
      offlineSyncingRef.current = false;
    }
  }, [configured, currentMember.email]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      let payload: BootstrapPayload | null = null;
      let loadedOffline = false;
      try {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        const responsePayload = (await response.json()) as BootstrapPayload;
        if (!response.ok) {
          const error = new Error(responsePayload.message ?? "Could not load team data") as Error & { status?: number };
          error.status = response.status;
          throw error;
        }
        payload = responsePayload;
        if (payload.currentMember) void saveWorkspaceSnapshot(payload.currentMember.email, payload);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status !== 401 && status !== 403) payload = await loadLatestWorkspaceSnapshot<BootstrapPayload>().catch(() => null);
        if (!payload) {
          if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Open Peptiking once while online before using it offline on this device.");
          throw error;
        }
        loadedOffline = true;
      }

      if (!active || !payload.configured) return;
      const member = payload.currentMember;
      const queued = member ? await getQueuedExpenses(member.email).catch(() => []) : [];
      const serverExpenses = payload.expenses ?? [];
      const serverClientIds = new Set(serverExpenses.map((expense) => expense.clientId).filter(Boolean));
      const unsynced = queued.filter((record) => !serverClientIds.has(record.id));
      const mergedSettings = payload.settings ? { ...payload.settings } : null;
      if (mergedSettings) {
        for (const record of unsynced) {
          mergedSettings.categories = addUniqueCategory(mergedSettings.categories, record.draft.category);
          if (record.draft.savePlace) mergedSettings.savedPlaces = addUniquePlace(mergedSettings.savedPlaces, record.draft.merchant);
        }
      }
      if (!active) return;
      setConfigured(true);
      setOfflineCount(unsynced.length);
      if (payload.members?.length) setMembers(payload.members);
      setExpenses([...unsynced.map(queuedExpenseToExpense), ...serverExpenses]);
      if (mergedSettings) setSettings(mergedSettings);
      if (member) setCurrentMember(member);
      if (loadedOffline) setToast("Offline mode: new expenses will sync when you reconnect.");
    };

    void initialize().catch((error: Error) => {
      if (active) setLoadError(error.message);
    }).finally(() => {
      if (active) setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then(async (registration) => {
        await navigator.serviceWorker.ready;
        const urls = performance.getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(window.location.origin) && url.includes("/_next/static/"));
        registration.active?.postMessage({ type: "CACHE_URLS", urls });
      }).catch(() => undefined);
    }
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && configured) void syncQueuedExpenses();
  }, [configured, isOnline, syncQueuedExpenses]);

  useEffect(() => {
    if (!configured) return;
    let active = true;

    const syncWorkspace = async () => {
      if (!active || document.visibilityState !== "visible" || workspaceSyncingRef.current || pendingExpenseSavesRef.current > 0) return;
      workspaceSyncingRef.current = true;
      try {
        const response = await fetch(`/api/bootstrap?sync=${Date.now()}`, { cache: "no-store" });
        const payload = (await response.json()) as BootstrapPayload;
        if (!response.ok || !payload.configured || !active) return;
        if (payload.members?.length) setMembers(payload.members);
        if (payload.expenses) setExpenses((current) => [...current.filter((expense) => expense.pendingSync), ...payload.expenses!]);
        if (payload.settings) setSettings((current) => ({
          ...payload.settings!,
          categories: current.categories.reduce((categories, category) => addUniqueCategory(categories, category), payload.settings!.categories),
          savedPlaces: current.savedPlaces.reduce((places, place) => addUniquePlace(places, place), payload.settings!.savedPlaces),
        }));
        if (payload.currentMember) setCurrentMember(payload.currentMember);
        if (payload.currentMember) void saveWorkspaceSnapshot(payload.currentMember.email, payload);
      } catch {
        // Keep the last successful workspace state during a temporary network interruption.
      } finally {
        workspaceSyncingRef.current = false;
      }
    };

    const handleFocus = () => { void syncWorkspace(); void syncQueuedExpenses(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") { void syncWorkspace(); void syncQueuedExpenses(); }
    };
    const interval = window.setInterval(() => { void syncWorkspace(); void syncQueuedExpenses(); }, 15_000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [configured, syncQueuedExpenses]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currencyTotals = useMemo(() => getCurrencyTotals(expenses), [expenses]);
  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory = categoryFilter === "All" || expense.category === categoryFilter;
      const member = members.find((candidate) => candidate.id === expense.spenderId);
      const matchesSearch = !term || `${expense.merchant} ${expense.category} ${member?.name ?? ""}`.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, expenses, members, search]);
  const isAdmin = currentMember.role === "admin";
  const updateAvailable = configured && isNewerVersion(settings.requiredAppVersion, APP_VERSION);

  const showToast = (message: string) => setToast(message);
  const navigate = (nextTab: Tab) => {
    if (nextTab === "admin" && !isAdmin) return;
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const getUpdate = () => {
    const updateUrl = new URL(window.location.href);
    updateUrl.searchParams.set("get-update", Date.now().toString());
    window.location.assign(updateUrl.toString());
  };

  const addExpense = async (form: ExpenseFormValue) => {
    const normalizedAmount = amountFromInput(form.amount, form.currency, form.vndUnit);
    if (!configured) {
      const preview = form.proof ? URL.createObjectURL(form.proof) : "proof";
      const nextExpense: Expense = {
        id: `demo-${Date.now()}`,
        merchant: form.merchant,
        amount: normalizedAmount,
        currency: form.currency,
        category: form.category,
        paymentMethod: form.paymentMethod,
        spentAt: form.spentAt,
        spenderId: form.spenderId,
        notes: form.notes,
        proofUrl: preview,
        proofType: form.proof?.type ?? null,
      };
      setExpenses((current) => [nextExpense, ...current]);
      setSettings((current) => ({ ...current, categories: addUniqueCategory(current.categories, form.category) }));
      if (form.savePlace) setSettings((current) => ({ ...current, savedPlaces: addUniquePlace(current.savedPlaces, form.merchant) }));
      setAddOpen(false);
      showToast("Expense added to this demo. Connect Supabase to save it for the team.");
      return;
    }

    const offlineId = `offline-${crypto.randomUUID()}`;
    const queuedRecord: QueuedExpenseRecord = {
      id: offlineId,
      ownerEmail: currentMember.email.toLocaleLowerCase(),
      createdAt: Date.now(),
      draft: {
        merchant: form.merchant.trim(),
        amount: normalizedAmount,
        currency: form.currency,
        category: form.category,
        paymentMethod: form.paymentMethod,
        spentAt: form.spentAt,
        spenderId: form.spenderId,
        notes: form.notes,
        savePlace: form.savePlace,
        proofBlob: form.proof,
        proofName: form.proof?.name ?? null,
        proofType: form.proof?.type ?? null,
      },
    };
    await queueExpense(queuedRecord);
    setExpenses((current) => [queuedExpenseToExpense(queuedRecord), ...current]);
    setOfflineCount((current) => current + 1);
    setSettings((current) => ({ ...current, categories: addUniqueCategory(current.categories, form.category) }));
    if (form.savePlace) setSettings((current) => ({ ...current, savedPlaces: addUniquePlace(current.savedPlaces, form.merchant) }));
    setAddOpen(false);
    showToast(navigator.onLine ? "Expense saved. Syncing now…" : "Expense saved offline. It will sync automatically.");
    if (navigator.onLine) void syncQueuedExpenses();
  };

  const editExpense = async (expense: Expense, form: EditExpenseFormValue) => {
    const normalizedAmount = amountFromInput(form.amount, form.currency, form.vndUnit);
    if (!configured) {
      const preview = form.proof?.type.startsWith("image/") ? URL.createObjectURL(form.proof) : expense.proofUrl;
      setExpenses((current) => current.map((candidate) => candidate.id === expense.id ? { ...candidate, amount: normalizedAmount, currency: form.currency, category: form.category, proofUrl: preview, proofType: form.proof?.type ?? candidate.proofType } : candidate));
      setSettings((current) => ({ ...current, categories: addUniqueCategory(current.categories, form.category) }));
      setEditingExpense(null);
      showToast("Expense updated in this demo.");
      return;
    }

    if (expense.pendingSync) {
      const queued = await getQueuedExpenses(currentMember.email);
      const record = queued.find((candidate) => candidate.id === expense.id);
      if (!record) throw new Error("This offline expense is no longer waiting to sync");
      record.draft.amount = normalizedAmount;
      record.draft.currency = form.currency;
      record.draft.category = form.category;
      if (form.proof) {
        record.draft.proofBlob = form.proof;
        record.draft.proofName = form.proof.name;
        record.draft.proofType = form.proof.type;
        record.uploadedProofPath = undefined;
      }
      await queueExpense(record);
      const updatedExpense = queuedExpenseToExpense(record);
      setExpenses((current) => current.map((candidate) => candidate.id === expense.id ? updatedExpense : candidate));
      setSettings((current) => ({ ...current, categories: addUniqueCategory(current.categories, form.category) }));
      setEditingExpense(null);
      showToast(navigator.onLine ? "Offline expense updated. Syncing now…" : "Offline expense updated safely.");
      if (navigator.onLine) void syncQueuedExpenses();
      return;
    }

    pendingExpenseSavesRef.current += 1;
    try {
      let proofPath: string | undefined;
      let proofName: string | undefined;
      let proofType: string | undefined;
      if (form.proof) {
        const uploadUrlResponse = await fetch("/api/proofs/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: form.proof.name, type: form.proof.type, size: form.proof.size, spentAt: expense.spentAt }),
        });
        const uploadRaw = await uploadUrlResponse.text();
        const uploadDetails = JSON.parse(uploadRaw) as { uploadUrl?: string; token?: string; path?: string; message?: string };
        if (!uploadUrlResponse.ok || !uploadDetails.uploadUrl || !uploadDetails.token || !uploadDetails.path) throw new Error(uploadDetails.message ?? "Could not prepare proof upload");
        const signedUploadUrl = new URL(uploadDetails.uploadUrl);
        signedUploadUrl.searchParams.set("token", uploadDetails.token);
        const proofBody = new FormData();
        proofBody.set("file", form.proof, form.proof.name);
        proofBody.set("cacheControl", "3600");
        const uploaded = await fetch(signedUploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: proofBody });
        if (!uploaded.ok) throw new Error("Proof upload failed. Please try again.");
        proofPath = uploadDetails.path;
        proofName = form.proof.name;
        proofType = form.proof.type;
      }

      const response = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "edit", expenseId: expense.id, amount: normalizedAmount, currency: form.currency, category: form.category, proofPath, proofName, proofType }),
      });
      const raw = await response.text();
      let payload: { expense?: Expense; message?: string };
      try {
        payload = JSON.parse(raw) as { expense?: Expense; message?: string };
      } catch {
        throw new Error("The server could not update this expense");
      }
      if (!response.ok || !payload.expense) throw new Error(payload.message ?? "Could not update expense");
      setExpenses((current) => current.map((candidate) => candidate.id === expense.id ? payload.expense! : candidate));
      setSettings((current) => ({ ...current, categories: addUniqueCategory(current.categories, payload.expense!.category) }));
      setEditingExpense(null);
      showToast("Expense updated.");
    } finally {
      pendingExpenseSavesRef.current = Math.max(0, pendingExpenseSavesRef.current - 1);
    }
  };

  const reportExpense = async (expenseId: string) => {
    try {
      if (!configured) {
        setExpenses((current) => current.map((expense) => expense.id === expenseId ? { ...expense, status: "issue" } : expense));
        showToast("Expense marked for admin review.");
        return;
      }
      const response = await fetch("/api/expenses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "report", expenseId }) });
      const payload = (await response.json()) as { expense?: Expense; message?: string };
      if (!response.ok || !payload.expense) throw new Error(payload.message ?? "Could not report this expense");
      setExpenses((current) => current.map((expense) => expense.id === expenseId ? payload.expense! : expense));
      showToast("Expense marked for admin review.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not report this expense");
    }
  };

  const deleteExpense = (expenseId: string) => {
    const expense = expenses.find((item) => item.id === expenseId);
    if (!expense || deleteInFlightRef.current) return;
    setDeleteError(null);
    setExpenseToDelete(expense);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete || deleteInFlightRef.current) return;
    const expenseId = expenseToDelete.id;
    deleteInFlightRef.current = true;
    setDeletingExpense(true);
    setDeleteError(null);
    try {
      if (!configured) {
        setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
        showToast("Expense deleted.");
        setExpenseToDelete(null);
        return;
      }
      const response = await fetch(`/api/expenses?expenseId=${encodeURIComponent(expenseId)}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Could not delete this expense");
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
      showToast("Expense deleted.");
      setExpenseToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete this expense");
    } finally {
      deleteInFlightRef.current = false;
      setDeletingExpense(false);
    }
  };

  const viewProof = async (expense: Expense) => {
    if (expense.proofUrl?.startsWith("blob:") || expense.proofUrl?.startsWith("http")) {
      setProofViewer({ expense, url: expense.proofUrl, contentType: expense.proofType ?? "image/*" });
      return;
    }
    if (!configured) {
      if (expense.proofUrl?.startsWith("blob:")) setProofViewer({ expense, url: expense.proofUrl, contentType: expense.proofType ?? "image/*" });
      else showToast("Connect Supabase to open stored receipt proofs.");
      return;
    }
    try {
      const response = await fetch(`/api/proofs/${encodeURIComponent(expense.id)}`);
      const payload = (await response.json()) as { url?: string; contentType?: string; message?: string };
      if (!response.ok || !payload.url) throw new Error(payload.message ?? "Could not open proof");
      const updatedExpense = { ...expense, proofUrl: payload.url, proofType: payload.contentType ?? "image/*" };
      setExpenses((current) => current.map((item) => item.id === expense.id ? updatedExpense : item));
      setProofViewer({ expense: updatedExpense, url: payload.url, contentType: updatedExpense.proofType ?? "image/*" });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not open proof");
    }
  };

  if (!ready) {
    return <main className="app-loading" aria-live="polite"><Image className="brand-symbol" src="/icon.png" alt="" width={40} height={40} priority /><span>Opening your workspace…</span></main>;
  }

  if (loadError) {
    return <main className="app-loading" role="alert"><Image className="brand-symbol" src="/icon.png" alt="" width={40} height={40} priority /><strong>Could not open your workspace</strong><span>{loadError}</span><a className="secondary-button" href="/api/site-logout">Return to sign in</a></main>;
  }

  return (
    <div className="app-shell">
      <Sidebar
        tab={tab}
        teamName={settings.teamName}
        member={currentMember}
        onNavigate={navigate}
      />

      <main className="main-canvas">
        <MobileTopbar member={currentMember} />
        {!configured && (
          <div className="demo-banner">
            <span>Demo data</span>
            <span>·</span>
            <button onClick={() => navigate("admin")}><Database size={14} aria-hidden="true" />Connect Supabase</button>
          </div>
        )}
        {configured && (!isOnline || offlineCount > 0) && (
          <div className={`offline-banner ${isOnline ? "syncing" : ""}`} role="status">
            <div>{isOnline ? <CloudUpload size={18} strokeWidth={1.9} aria-hidden="true" /> : <WifiOff size={18} strokeWidth={1.9} aria-hidden="true" />}<span><strong>{isOnline ? "Syncing saved expenses" : "You’re offline"}</strong><small>{offlineCount > 0 ? `${offlineCount} expense${offlineCount === 1 ? " is" : "s are"} safely stored on this device.` : "You can keep adding expenses."}</small></span></div>
            <button type="button" disabled={!isOnline} onClick={() => void syncQueuedExpenses(true)}>{isOnline ? "Sync now" : "Auto-sync on"}</button>
          </div>
        )}
        {updateAvailable && <div className="update-banner" role="status"><div><RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" /><span><strong>Update available</strong><small>Version {settings.requiredAppVersion} is ready.</small></span></div><button type="button" onClick={getUpdate}>Get update</button></div>}

        {tab === "home" && (
          <HomeDashboard
            expenses={expenses}
            members={members}
            settings={settings}
            currentMember={currentMember}
            currencyTotals={currencyTotals}
            onAdd={() => setAddOpen(true)}
            onViewAll={() => navigate("activity")}
            onReportExpense={reportExpense}
            onDeleteExpense={deleteExpense}
            onEditExpense={setEditingExpense}
            onViewProof={viewProof}
          />
        )}

        {tab === "activity" && (
          <ActivityView
            expenses={filteredExpenses}
            members={members}
            settings={settings}
            search={search}
            categoryFilter={categoryFilter}
            onSearch={setSearch}
            onFilter={setCategoryFilter}
            onAdd={() => setAddOpen(true)}
            currentMember={currentMember}
            onReportExpense={reportExpense}
            onDeleteExpense={deleteExpense}
            onEditExpense={setEditingExpense}
            onViewProof={viewProof}
          />
        )}

        {tab === "admin" && isAdmin && (
          <AdminView
            configured={configured}
            members={members}
            settings={settings}
            currentMember={currentMember}
            onMembersChange={setMembers}
            onSettingsChange={setSettings}
            onToast={showToast}
          />
        )}

        {tab === "settings" && !isAdmin && (
          <MemberSettings member={currentMember} teamName={settings.teamName} onRefresh={getUpdate} />
        )}
      </main>

      <BottomNav tab={tab} isAdmin={isAdmin} onNavigate={navigate} onAdd={() => setAddOpen(true)} onRefresh={getUpdate} />

      {!isAdmin && configured && <RecurringExpenses admin={false} configured={configured} members={members} currencies={settings.currencies} categories={settings.categories} />}

      {addOpen && !isAdmin && (
        <ExpenseModal
          members={members.filter((member) => (
            member.status === "active"
            && member.role === "member"
            && (isAdmin || member.id === currentMember.id)
          ))}
          settings={settings}
          onClose={() => setAddOpen(false)}
          onSubmit={addExpense}
        />
      )}

      {editingExpense && !isAdmin && (
        <EditExpenseModal expense={editingExpense} settings={settings} onClose={() => setEditingExpense(null)} onSubmit={editExpense} />
      )}

      {proofViewer && <ProofViewer proof={proofViewer} onClose={() => setProofViewer(null)} />}

      {expenseToDelete && <DeleteExpenseModal expense={expenseToDelete} deleting={deletingExpense} error={deleteError} onConfirm={confirmDeleteExpense} onClose={() => { if (!deleteInFlightRef.current) setExpenseToDelete(null); }} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function DeleteExpenseModal({ expense, deleting, error, onConfirm, onClose }: {
  expense: Expense;
  deleting: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    cancelRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialogRef} className="delete-expense-modal" aria-labelledby="delete-expense-title" aria-describedby="delete-expense-description" aria-busy={deleting} onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
    <div className="delete-expense-header"><span className="delete-expense-icon"><Trash2 size={24} strokeWidth={1.7} aria-hidden="true" /></span><button type="button" className="close-button" disabled={deleting} onClick={onClose} aria-label="Close delete confirmation"><X size={19} aria-hidden="true" /></button></div>
    <h2 id="delete-expense-title">Delete this expense?</h2>
    <p id="delete-expense-description">The expense and any attached receipt will be permanently removed from your team’s records.</p>
    <div className="delete-expense-summary"><div><span className="delete-expense-label">Expense</span><strong>{expense.merchant}</strong><span>{displayDate(expense.spentAt)} · {expense.category}</span></div><strong className="delete-expense-amount">{formatMoney(expense.amount, expense.currency)}</strong></div>
    <p className="delete-expense-warning">This action cannot be undone.</p>
    {error && <p className="delete-expense-error" role="alert">{error}</p>}
    <div className="modal-actions"><button ref={cancelRef} type="button" className="secondary-button" disabled={deleting} onClick={onClose}>Cancel</button><button type="button" className="delete-expense-confirm" disabled={deleting} onClick={() => void onConfirm()}>{!deleting && <Trash2 size={16} aria-hidden="true" />}{deleting ? "Deleting…" : "Delete expense"}</button></div>
  </dialog>;
}

function Sidebar({ tab, teamName, member, onNavigate }: {
  tab: Tab;
  teamName: string;
  member: Member;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand"><Image className="brand-symbol" src="/icon.png" alt="" width={40} height={40} priority /><span>Peptiking</span></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <NavButton desktop label="Overview" icon={LayoutDashboard} active={tab === "home"} onClick={() => onNavigate("home")} />
        <NavButton desktop label="Expenses" icon={ReceiptText} active={tab === "activity"} onClick={() => onNavigate("activity")} />
        {member.role === "admin" && <NavButton desktop label="Admin" icon={Settings} active={tab === "admin"} onClick={() => onNavigate("admin")} />}
        {member.role === "member" && <NavButton desktop label="Settings" icon={Settings} active={tab === "settings"} onClick={() => onNavigate("settings")} />}
      </nav>
      <div className="sidebar-account">
        <div className="avatar sidebar-account-avatar" style={avatarStyle(member.avatarColor)} aria-label={`${member.name} avatar`}>{initials(member.name)}</div>
        <div><strong>{member.name}</strong><span>{member.role === "admin" ? "Administrator" : "Team member"} · {teamName}</span><a className="sign-out-link" href="/api/site-logout"><LogOut size={13} strokeWidth={1.9} />Sign out</a></div>
      </div>
    </aside>
  );
}

function MobileTopbar({ member }: { member: Member }) {
  return (
    <header className="mobile-topbar">
      <div className="brand"><Image className="brand-symbol" src="/icon.png" alt="" width={40} height={40} priority /><span>Peptiking</span></div>
      <div className="mobile-account"><div><strong>{member.name}</strong><span>{member.role === "admin" ? "Admin" : "Member"}</span></div><span className="avatar" style={avatarStyle(member.avatarColor)}>{initials(member.name)}</span><a className="sign-out-link" href="/api/site-logout" aria-label="Sign out"><LogOut size={16} strokeWidth={1.9} /><span>Sign out</span></a></div>
    </header>
  );
}

function NavButton({ label, icon: Icon, active, desktop, onClick }: { label: string; icon: LucideIcon; active: boolean; desktop?: boolean; onClick: () => void }) {
  if (desktop) {
    return <button className={`sidebar-button ${active ? "active" : ""}`} onClick={onClick}><Icon aria-hidden="true" /><span>{label}</span></button>;
  }
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}><Icon aria-hidden="true" /><span>{label}</span></button>;
}

function BottomNav({ tab, isAdmin, onNavigate, onAdd, onRefresh }: { tab: Tab; isAdmin: boolean; onNavigate: (tab: Tab) => void; onAdd: () => void; onRefresh: () => void }) {
  if (!isAdmin) {
    return (
      <nav className="bottom-nav member-nav" aria-label="Mobile navigation">
        <NavButton label="Home" icon={LayoutDashboard} active={tab === "home"} onClick={() => onNavigate("home")} />
        <NavButton label="Refresh" icon={RefreshCw} active={false} onClick={onRefresh} />
        <button className="nav-add" onClick={onAdd} aria-label="Add expense"><Plus aria-hidden="true" /></button>
        <NavButton label="Expenses" icon={ReceiptText} active={tab === "activity"} onClick={() => onNavigate("activity")} />
        <NavButton label="Settings" icon={Settings} active={tab === "settings"} onClick={() => onNavigate("settings")} />
      </nav>
    );
  }
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <NavButton label="Home" icon={LayoutDashboard} active={tab === "home"} onClick={() => onNavigate("home")} />
      <NavButton label="Expenses" icon={ReceiptText} active={tab === "activity"} onClick={() => onNavigate("activity")} />
      <NavButton label="Admin" icon={Settings} active={tab === "admin"} onClick={() => onNavigate("admin")} />
      <NavButton label="Refresh" icon={RefreshCw} active={false} onClick={onRefresh} />
    </nav>
  );
}

function MemberSettings({ member, teamName, onRefresh }: { member: Member; teamName: string; onRefresh: () => void }) {
  return (
    <section className="member-settings-view" aria-labelledby="member-settings-title">
      <div className="intro-row">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 id="member-settings-title" className="page-heading">Settings</h1>
          <p className="intro-copy">Account and workspace controls for this device.</p>
        </div>
      </div>

      <div className="card member-settings-card">
        <div className="member-settings-profile">
          <span className="avatar" style={avatarStyle(member.avatarColor)}>{initials(member.name)}</span>
          <div className="member-settings-identity"><strong>{member.name}</strong><span>Peptiking team member</span></div>
          <span className="member-role-pill">Member</span>
        </div>
        <div className="member-settings-list">
          <div className="member-settings-row"><span className="member-settings-icon"><Mail size={18} strokeWidth={1.8} aria-hidden="true" /></span><div><span>Email</span><strong>{member.email}</strong></div></div>
          <div className="member-settings-row"><span className="member-settings-icon"><Building2 size={18} strokeWidth={1.8} aria-hidden="true" /></span><div><span>Workspace</span><strong>{teamName}</strong></div></div>
          <div className="member-settings-row"><span className="member-settings-icon"><KeyRound size={18} strokeWidth={1.8} aria-hidden="true" /></span><div><span>Access</span><strong>Team member</strong></div></div>
        </div>
        <div className="member-settings-actions">
          <button type="button" className="member-settings-action" onClick={onRefresh}><span className="member-settings-icon"><RefreshCw size={18} strokeWidth={1.9} aria-hidden="true" /></span><span><strong>Refresh workspace</strong><small>Get the latest team data</small></span></button>
          <a className="member-settings-action member-sign-out" href="/api/site-logout"><span className="member-settings-icon"><LogOut size={18} strokeWidth={1.9} aria-hidden="true" /></span><span><strong>Sign out</strong><small>End this session</small></span></a>
        </div>
      </div>
    </section>
  );
}

function HomeDashboard({ expenses, members, settings, currentMember, currencyTotals, onAdd, onViewAll, onReportExpense, onDeleteExpense, onEditExpense, onViewProof }: {
  expenses: Expense[];
  members: Member[];
  settings: TeamSettings;
  currentMember: Member;
  currencyTotals: ReturnType<typeof getCurrencyTotals>;
  onAdd: () => void;
  onViewAll: () => void;
  onReportExpense: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expense: Expense) => void;
  onViewProof: (expense: Expense) => void;
}) {
  const activeMembers = members.filter((member) => member.status === "active" && member.role === "member").length;
  const eurExpenses = expenses.filter((expense) => expense.currency === "EUR");
  const vndExpenses = expenses.filter((expense) => expense.currency === "VND");
  const expensesWithProof = expenses.filter((expense) => expense.proofUrl).length;
  const categories = settings.categories.map((category) => ({
    category,
    amount: expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + toEuros(expense.amount, expense.currency), 0),
  })).filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 4);

  return (
    <>
      <div className="intro-row">
        <div>
          <p className="eyebrow">August overview</p>
          <h1 className="page-heading">Welcome, {currentMember.name.split(" ")[0]}.</h1>
          <p className="intro-copy">Your team has logged {expenses.length} expenses this month · €1 = ₫30K.</p>
        </div>
        {currentMember.role === "member" && <button className="primary-button desktop-add" onClick={onAdd}><Plus size={17} aria-hidden="true" />Add expense</button>}
      </div>

      <section className="summary-grid" aria-label="Monthly spending summary">
        <article className="hero-card">
          <p className="hero-label">Combined team spend</p>
          <h2 className="hero-amount">{formatMoney(currencyTotals.totalEur, "EUR")}</h2>
          <p className="hero-converted-total">{formatMoney(currencyTotals.totalVnd, "VND")} total</p>
          <div className="hero-meta"><span className="hero-meta-dot" /><span>{expenses.length} expense{expenses.length === 1 ? "" : "s"} tracked</span></div>
          <div className="hero-insight"><strong>{activeMembers}</strong><span>active member{activeMembers === 1 ? "" : "s"}</span></div>
        </article>
        <div className="mini-grid">
          <article className="stat-card">
            <span className="stat-icon"><Banknote size={17} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="stat-label">Expenses in EUR</span>
            <strong className="stat-value">{formatMoney(currencyTotals.eur, "EUR")}</strong>
            <span className="stat-note">{eurExpenses.length} expense{eurExpenses.length === 1 ? "" : "s"}</span>
          </article>
          <article className="stat-card orange">
            <span className="stat-icon"><Smartphone size={17} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className="stat-label">Expenses in VND</span>
            <strong className="stat-value">{formatMoney(currencyTotals.vnd, "VND")}</strong>
            <span className="stat-note">{vndExpenses.length} expense{vndExpenses.length === 1 ? "" : "s"}</span>
          </article>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <div className="section-head"><div><h2>Spending by category</h2><p>Current month · converted to EUR</p></div><strong>{formatMoney(currencyTotals.totalEur, "EUR", true)}</strong></div>
          <div className="category-list">
            {categories.map((item) => {
              const CategoryIcon = CATEGORY_ICONS[item.category] ?? CircleEllipsis;
              return (
              <div className="category-row" key={item.category}>
                <span className="category-dot"><CategoryIcon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
                <div className="category-copy"><strong>{item.category}</strong></div>
                <span className="category-amount">{formatMoney(item.amount, "EUR")}</span>
              </div>
              );
            })}
            {!categories.length && <div className="category-empty">Categories will appear after the first expense.</div>}
          </div>
          <div className="category-footnote"><span className="proof-dot" />{expensesWithProof} expense{expensesWithProof === 1 ? "" : "s"} with proof</div>
        </article>

        <article className="expense-panel">
          <div className="section-head"><div><h2>Recent expenses</h2><p>Latest team activity</p></div><button className="text-button icon-text-button" onClick={onViewAll}>View all<ArrowRight size={15} aria-hidden="true" /></button></div>
          <ExpenseList expenses={expenses.slice(0, 5)} members={members} settings={settings} currentMember={currentMember} onReportExpense={onReportExpense} onDeleteExpense={onDeleteExpense} onEditExpense={onEditExpense} onViewProof={onViewProof} />
        </article>
      </section>
    </>
  );
}

function ActivityView({ expenses, members, settings, search, categoryFilter, onSearch, onFilter, onAdd, currentMember, onReportExpense, onDeleteExpense, onEditExpense, onViewProof }: {
  expenses: Expense[];
  members: Member[];
  settings: TeamSettings;
  search: string;
  categoryFilter: string;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onAdd: () => void;
  currentMember: Member;
  onReportExpense: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  onEditExpense: (expense: Expense) => void;
  onViewProof: (expense: Expense) => void;
}) {
  const totals = getCurrencyTotals(expenses);
  return (
    <>
      <div className="tab-header">
        <div><p className="eyebrow">Team ledger</p><h1>Expenses</h1><p className="intro-copy">Every payment, person, and proof in one place.</p></div>
        {currentMember.role === "member" && <button className="primary-button desktop-add" onClick={onAdd}><Plus size={17} aria-hidden="true" />Add expense</button>}
      </div>
      <div className="search-box"><Search size={17} strokeWidth={1.9} aria-hidden="true" /><input aria-label="Search expenses" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search merchant, category or person" /></div>
      <div className="filter-row" aria-label="Expense categories">
        {["All", ...settings.categories].map((category) => <button key={category} className={`filter-chip ${categoryFilter === category ? "active" : ""}`} onClick={() => onFilter(category)}>{category}</button>)}
      </div>
      <section className="expense-panel">
        <div className="section-head"><div><h2>{categoryFilter === "All" ? "All spending" : categoryFilter}</h2><p>{expenses.length} expense{expenses.length === 1 ? "" : "s"} · €1 = ₫30K</p></div><div className="ledger-grand-total"><span>Combined total</span><strong>{formatMoney(totals.totalEur, "EUR")}</strong><small>{formatMoney(totals.totalVnd, "VND")}</small></div></div>
        <div className="ledger-currency-breakdown" aria-label="Spending totals by currency">
          <span><small>EUR expenses</small><strong>{formatMoney(totals.eur, "EUR")}</strong></span>
          <span><small>VND expenses</small><strong>{formatMoney(totals.vnd, "VND")}</strong></span>
        </div>
        <ExpenseList expenses={expenses} members={members} settings={settings} currentMember={currentMember} onReportExpense={onReportExpense} onDeleteExpense={onDeleteExpense} onEditExpense={onEditExpense} onViewProof={onViewProof} />
      </section>
    </>
  );
}

function ExpenseList({ expenses, members, settings, currentMember, onReportExpense, onDeleteExpense, onEditExpense, onViewProof }: { expenses: Expense[]; members: Member[]; settings: TeamSettings; currentMember: Member; onReportExpense: (expenseId: string) => void; onDeleteExpense: (expenseId: string) => void; onEditExpense: (expense: Expense) => void; onViewProof: (expense: Expense) => void }) {
  if (!expenses.length) return <div className="empty-state">No expenses match this view.</div>;
  return (
    <div className="expense-list">
      {expenses.map((expense) => {
        const member = members.find((candidate) => candidate.id === expense.spenderId);
        const CategoryIcon = CATEGORY_ICONS[expense.category] ?? CircleEllipsis;
        const PaymentIcon = PAYMENT_ICONS[expense.paymentMethod];
        return (
          <div className="expense-row" key={expense.id}>
            <span className="expense-icon"><CategoryIcon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
            <div className="expense-main">
              <p className="expense-title">{expense.merchant}</p>
              <p className="expense-subtitle"><span>{member?.name ?? "Team member"}</span><span>·</span><span>{displayDate(expense.spentAt)}</span>{expense.proofUrl && <><span>·</span><span className="proof-dot" title="Proof attached" /></>}</p>
            </div>
            <div className="expense-meta">
              <div className="expense-number"><strong>{formatMoney(expense.amount, expense.currency)}</strong><span className="expense-conversion">≈ {expense.currency === "VND" ? formatMoney(expense.amount / EUR_TO_VND, "EUR") : formatMoney(expense.amount * EUR_TO_VND, "VND")}</span><span className="payment-label"><PaymentIcon size={12} strokeWidth={1.9} aria-hidden="true" />{PAYMENT_LABELS[expense.paymentMethod]}</span></div>
              <div className="expense-actions">
                {expense.pendingSync && <span className="sync-badge"><CloudUpload size={12} strokeWidth={2} aria-hidden="true" />Waiting to sync</span>}
                {expense.status === "issue" && <span className="issue-badge"><Flag size={12} aria-hidden="true" />Issue</span>}
                {expense.proofUrl && <button type="button" className="expense-action proof-action" onClick={() => onViewProof(expense)}><Eye size={15} aria-hidden="true" /><span>View proof</span></button>}
                {currentMember.role === "member" && expense.spenderId === currentMember.id && !expense.id.startsWith("pending-") && <button type="button" className="expense-action edit" onClick={() => onEditExpense(expense)} aria-label={`Edit ${expense.merchant}`}><Pencil size={15} aria-hidden="true" /><span>Edit</span></button>}
                {currentMember.role === "admin" ? <button type="button" className="expense-action danger" onClick={() => onDeleteExpense(expense.id)} aria-label={`Delete ${expense.merchant}`} title="Delete expense"><Trash2 size={15} aria-hidden="true" /></button> : expense.spenderId === currentMember.id && expense.status !== "issue" && !expense.pendingSync ? <button type="button" className="expense-action report" onClick={() => onReportExpense(expense.id)} aria-label={`Report an issue with ${expense.merchant}`} title="Report an issue"><Flag size={15} aria-hidden="true" /><span>Report issue</span></button> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ExpenseFormValue = {
  merchant: string;
  amount: string;
  currency: string;
  vndUnit: VndUnit;
  category: string;
  paymentMethod: PaymentMethod;
  spentAt: string;
  spenderId: string;
  notes: string;
  proof: File | null;
  savePlace: boolean;
};

type EditExpenseFormValue = {
  amount: string;
  currency: string;
  vndUnit: VndUnit;
  category: string;
  proof: File | null;
};

function ProofViewer({ proof, onClose }: { proof: ProofViewerValue; onClose: () => void }) {
  const isPdf = proof.contentType.includes("pdf");
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="proof-viewer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="proof-viewer" role="dialog" aria-modal="true" aria-label={`Proof for ${proof.expense.merchant}`}>
        <div className="proof-viewer-head"><div><p className="eyebrow">Proof of spending</p><h2>{proof.expense.merchant}</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Close proof"><X size={19} strokeWidth={1.9} aria-hidden="true" /></button></div>
        <div className="proof-viewer-media">{isPdf ? <iframe src={proof.url} title={`Proof for ${proof.expense.merchant}`} /> : <img src={proof.url} alt={`Proof of spending for ${proof.expense.merchant}`} />}</div>
        <a className="secondary-button full" href={proof.url} target="_blank" rel="noreferrer"><Globe2 size={16} aria-hidden="true" />Open in new tab</a>
      </section>
    </div>,
    document.body,
  );
}

function VndUnitToggle({ value, onChange }: { value: VndUnit; onChange: (value: VndUnit) => void }) {
  return (
    <div className="vnd-unit-toggle" role="group" aria-label="Vietnamese dong amount unit">
      {(["K", "M"] as VndUnit[]).map((unit) => <button key={unit} type="button" className={value === unit ? "active" : ""} aria-pressed={value === unit} title={unit === "K" ? "Thousands" : "Millions"} onClick={() => onChange(unit)}>{unit}</button>)}
    </div>
  );
}

function EditExpenseModal({ expense, settings, onClose, onSubmit }: { expense: Expense; settings: TeamSettings; onClose: () => void; onSubmit: (expense: Expense, value: EditExpenseFormValue) => Promise<void> }) {
  const editableAmount = expense.currency === "VND" ? editableVndAmount(expense.amount) : { amount: String(expense.amount), vndUnit: "K" as VndUnit };
  const [value, setValue] = useState<EditExpenseFormValue>({ amount: editableAmount.amount, currency: expense.currency, vndUnit: editableAmount.vndUnit, category: expense.category, proof: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const selectProof = (file: File | null) => {
    setValue((current) => ({ ...current, proof: file }));
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(file?.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!value.amount || Number(value.amount) <= 0) return setError("Enter an amount greater than zero.");
    if (settings.requireProof && !expense.proofUrl && !value.proof) return setError("Attach proof of spending.");
    setSaving(true);
    try {
      await onSubmit(expense, value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update expense");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="expense-modal edit-expense-modal" onSubmit={submit} aria-label={`Edit ${expense.merchant}`} role="dialog" aria-modal="true">
        <div className="modal-head"><div><p className="eyebrow">Your expense</p><h2>Edit expense</h2><span className="edit-expense-merchant">{expense.merchant} · {displayDate(expense.spentAt)}</span></div><button type="button" className="close-button" onClick={onClose} aria-label="Close"><X size={19} strokeWidth={1.9} aria-hidden="true" /></button></div>

        <div className="amount-field">
          {settings.currencies.length > 1 ? <div className="amount-currency-control"><Dropdown id="edit-currency" value={value.currency} options={CURRENCY_OPTIONS.filter((option) => settings.currencies.includes(option.value)).map((option) => ({ value: option.value, label: option.value }))} onChange={(currency) => setValue({ ...value, currency })} /></div> : <span>{value.currency}</span>}
          {value.currency === "VND" && <VndUnitToggle value={value.vndUnit} onChange={(vndUnit) => setValue({ ...value, vndUnit })} />}
          <input autoFocus inputMode="decimal" placeholder="0" aria-label="Amount" value={value.amount} onChange={(event) => setValue({ ...value, amount: event.target.value })} />
        </div>
        {value.currency === "VND" && <p className="amount-unit-hint">{value.vndUnit === "K" ? "K = thousand" : "M = million"}{value.amount && Number(value.amount) > 0 ? ` · ₫${amountFromInput(value.amount, value.currency, value.vndUnit).toLocaleString("en-US")}` : ""}</p>}

        <div className="field-grid edit-expense-fields">
          <div className="field"><label htmlFor="edit-category">Category</label><CategoryPicker id="edit-category" value={value.category} categories={settings.categories} onChange={(category) => setValue({ ...value, category })} /></div>
          <div className="field"><span className="field-label">Proof of spending</span><label className="proof-drop">{preview ? <img className="proof-preview" src={preview} alt="Replacement proof preview" /> : <div><FileUp className="proof-upload-icon" size={24} strokeWidth={1.7} aria-hidden="true" /><strong>{value.proof?.name ?? (expense.proofUrl ? "Current proof attached" : "Add proof")}</strong><span>{expense.proofUrl ? "Choose a photo, screenshot, or PDF to replace it" : "Choose a photo, screenshot, or PDF"}</span></div>}<input type="file" accept="image/*,.pdf" onChange={(event) => selectProof(event.target.files?.[0] ?? null)} />{value.proof && <span className="proof-change">Change</span>}</label></div>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button dark" disabled={saving}>{!saving && <Save size={16} aria-hidden="true" />}{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </div>,
    document.body,
  );
}

function ExpenseModal({ members, settings, onClose, onSubmit }: {
  members: Member[];
  settings: TeamSettings;
  onClose: () => void;
  onSubmit: (value: ExpenseFormValue) => Promise<void>;
}) {
  const [value, setValue] = useState<ExpenseFormValue>({
    merchant: "",
    amount: "",
    currency: settings.currencies[0] ?? settings.currency,
    vndUnit: "K",
    category: settings.categories[0] ?? CATEGORIES[0],
    paymentMethod: "cash",
    spentAt: todayValue(),
    spenderId: members.length === 1 ? members[0].id : "",
    notes: "",
    proof: null,
    savePlace: false,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const selectProof = (file: File | null) => {
    setValue((current) => ({ ...current, proof: file }));
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(file?.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!value.amount || Number(value.amount) <= 0) return setError("Enter an amount greater than zero.");
    if (!value.merchant.trim()) return setError("Add the merchant or reason for spending.");
    if (!value.spenderId) return setError("Choose who spent this amount.");
    if (settings.requireProof && !value.proof) return setError("Attach a receipt photo or screenshot as proof.");
    if (value.proof && value.proof.size > 10 * 1024 * 1024) return setError("Proof must be smaller than 10 MB.");
    setSaving(true);
    try {
      await onSubmit(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save expense");
      setSaving(false);
    }
  };

  const proofPrompt = value.paymentMethod === "cash" ? "Take a receipt photo" : "Add payment screenshot";
  const ProofIcon = value.paymentMethod === "cash" ? Camera : FileUp;

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="expense-modal" onSubmit={submit} aria-label="Add expense" role="dialog" aria-modal="true">
        <div className="modal-head"><div><p className="eyebrow">New spending</p><h2>Add an expense</h2></div><button type="button" className="close-button" onClick={onClose} aria-label="Close"><X size={19} strokeWidth={1.9} aria-hidden="true" /></button></div>
        <div className="amount-field">
          {settings.currencies.length > 1 ? <div className="amount-currency-control"><Dropdown id="currency" value={value.currency} options={CURRENCY_OPTIONS.filter((option) => settings.currencies.includes(option.value)).map((option) => ({ value: option.value, label: option.value }))} onChange={(currency) => setValue({ ...value, currency })} /></div> : <span>{value.currency}</span>}
          {value.currency === "VND" && <VndUnitToggle value={value.vndUnit} onChange={(vndUnit) => setValue({ ...value, vndUnit })} />}
          <input autoFocus inputMode="decimal" placeholder="0" aria-label="Amount" value={value.amount} onChange={(event) => setValue({ ...value, amount: event.target.value })} />
        </div>
        {value.currency === "VND" && <p className="amount-unit-hint">{value.vndUnit === "K" ? "K = thousand" : "M = million"}{value.amount && Number(value.amount) > 0 ? ` · ₫${amountFromInput(value.amount, value.currency, value.vndUnit).toLocaleString("en-US")}` : ""}</p>}

        <div className="field-grid">
          <div className="field"><span className="field-label">How was it paid?</span><div className="segmented">{(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((method) => { const PaymentIcon = PAYMENT_ICONS[method]; return <button key={method} type="button" className={`segment-button ${value.paymentMethod === method ? "active" : ""}`} onClick={() => setValue({ ...value, paymentMethod: method })}><PaymentIcon size={16} strokeWidth={1.9} aria-hidden="true" />{PAYMENT_LABELS[method]}</button>; })}</div></div>
          <div className="field"><span className="field-label">Who spent it?</span><div className="member-picker">{members.map((member) => <button key={member.id} type="button" className={`member-pill ${value.spenderId === member.id ? "active" : ""}`} onClick={() => setValue({ ...value, spenderId: member.id })}><span className="avatar small" style={avatarStyle(member.avatarColor)}>{initials(member.name)}</span><span>{member.name.split(" ")[0]}</span></button>)}</div></div>
          <div className="field-grid two">
            <SavedPlaceField value={value.merchant} places={settings.savedPlaces} savePlace={value.savePlace} onChange={(merchant) => setValue((current) => ({ ...current, merchant }))} onSavePlaceChange={(savePlace) => setValue((current) => ({ ...current, savePlace }))} />
            <div className="field"><label htmlFor="category">Category</label><CategoryPicker id="category" value={value.category} categories={settings.categories} onChange={(category) => setValue({ ...value, category })} /></div>
            <div className="field"><label htmlFor="spentAt">Date</label><input id="spentAt" type="date" value={value.spentAt} onChange={(event) => setValue({ ...value, spentAt: event.target.value })} /></div>
            <div className="field"><label htmlFor="notes">Note <span className="muted">(optional)</span></label><input id="notes" value={value.notes} onChange={(event) => setValue({ ...value, notes: event.target.value })} placeholder="What was this for?" /></div>
          </div>
          <div className="field"><span className="field-label">Proof of spending {settings.requireProof ? "· Required" : "· Optional"}</span><label className="proof-drop">{preview ? <img className="proof-preview" src={preview} alt="Selected receipt preview" /> : <div><ProofIcon className="proof-upload-icon" size={24} strokeWidth={1.7} aria-hidden="true" /><strong>{value.proof?.name ?? proofPrompt}</strong><span>{value.paymentMethod === "cash" ? "Take a photo or choose one from your device" : "Choose a screenshot or image from your device"}</span></div>}<input type="file" accept="image/*,.pdf" onChange={(event) => selectProof(event.target.files?.[0] ?? null)} />{value.proof && <span className="proof-change">Change</span>}</label></div>
        </div>

        {error && <p role="alert" style={{ color: "#b64b2c", fontSize: 12, fontWeight: 750, margin: "12px 0 0" }}>{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button dark" disabled={saving}>{!saving && <Save size={16} aria-hidden="true" />}{saving ? "Saving…" : "Save expense"}</button></div>
      </form>
    </div>,
    document.body,
  );
}

function AdminPasswordInput({ id, value, visible, onChange, onToggle, placeholder }: {
  id: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="password-control">
      <input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" maxLength={128} placeholder={placeholder} />
      <button type="button" className="password-toggle" onClick={onToggle} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
        {visible ? <EyeOff size={19} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={19} strokeWidth={1.8} aria-hidden="true" />}
      </button>
    </div>
  );
}

function AdminView({ configured, members, settings, currentMember, onMembersChange, onSettingsChange, onToast }: {
  configured: boolean;
  members: Member[];
  settings: TeamSettings;
  currentMember: Member;
  onMembersChange: (members: Member[]) => void;
  onSettingsChange: (settings: TeamSettings) => void;
  onToast: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [memberPassword, setMemberPassword] = useState("");
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [passwordMemberId, setPasswordMemberId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const passwordMembers = members.filter((member) => member.role === "member" && member.status === "active");
  const selectedPasswordMemberId = passwordMemberId || passwordMembers[0]?.id || "";

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.includes("@")) return onToast("Add a member name and valid email.");
    if (role === "member" && (memberPassword.length < 8 || memberPassword.length > 128)) return onToast("Set a member password with 8 to 128 characters.");
    setAdding(true);
    const draft: Member = { id: `member-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), role, status: "active", avatarColor: ["#a9d9c7", "#f5a98c", "#c5b8e8", "#f3bf73"][members.length % 4], hasPassword: role === "member" };
    try {
      let created = draft;
      if (configured) {
        const response = await fetch("/api/admin/members", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft.name, email: draft.email, role: draft.role, password: memberPassword }) });
        const payload = (await response.json()) as { member?: Member; message?: string };
        if (!response.ok || !payload.member) throw new Error(payload.message ?? "Could not add member");
        created = payload.member;
      }
      onMembersChange([...members, created]);
      setName(""); setEmail(""); setRole("member"); setMemberPassword(""); setShowMemberPassword(false);
      onToast(configured ? "Member added with an individual password." : "Member added to the demo team.");
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not add member");
    } finally {
      setAdding(false);
    }
  };

  const setAccessPassword = async () => {
    if (!selectedPasswordMemberId) return onToast("Choose a member.");
    if (resetPassword.length < 8 || resetPassword.length > 128) return onToast("Set a member password with 8 to 128 characters.");
    setResettingPassword(true);
    try {
      let updated = members.find((member) => member.id === selectedPasswordMemberId);
      if (configured) {
        const response = await fetch("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: selectedPasswordMemberId, password: resetPassword }) });
        const payload = (await response.json()) as { member?: Member; message?: string };
        if (!response.ok || !payload.member) throw new Error(payload.message ?? "Could not set member password");
        updated = payload.member;
      } else if (updated) {
        updated = { ...updated, hasPassword: true };
      }
      if (updated) onMembersChange(members.map((member) => member.id === updated!.id ? updated! : member));
      setResetPassword("");
      setShowResetPassword(false);
      onToast(configured ? "Member password updated." : "Demo member password updated.");
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not set member password");
    } finally {
      setResettingPassword(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      if (configured) {
        const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
        const payload = (await response.json()) as { message?: string };
        if (!response.ok) throw new Error(payload.message ?? "Could not save settings");
      }
      onToast(configured ? "Workspace settings saved." : "Demo settings updated.");
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  if (currentMember.role !== "admin") {
    return <section className="admin-card"><h1>Admin access only</h1><p className="muted">Ask a team admin to manage members and platform settings.</p></section>;
  }

  return (
    <>
      <div className="tab-header"><div><p className="eyebrow">Workspace control</p><h1>Admin</h1><p className="intro-copy">Manage who can spend and how your team records it.</p></div></div>
      <RecurringExpenses admin configured={configured} members={members} currencies={settings.currencies} categories={settings.categories} />
      <div className="admin-layout">
        <section className="admin-card">
          <div className="section-head"><div><h2>Team members</h2><p>{members.filter((member) => member.status === "active").length} active profiles</p></div></div>
          <div className="shared-access-note"><KeyRound size={18} strokeWidth={1.8} aria-hidden="true" /><div><strong>Separate member passwords</strong><span>Admins use the private environment password. Every member signs in with the password you assign here.</span></div></div>
          <div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><span className="avatar large" style={avatarStyle(member.avatarColor)}>{initials(member.name)}</span><div className="member-copy"><strong>{member.name}</strong><span>{member.email} · {member.status} · {member.role === "admin" ? "admin password" : member.hasPassword ? "password set" : "password required"}</span></div><span className={`role-badge ${member.role}`}>{member.role}</span></div>)}</div>
          <p className="divider-label">Member passwords</p>
          {passwordMembers.length ? (
            <div className="credential-panel">
              <div className="field"><label htmlFor="password-member">Team member</label><Dropdown id="password-member" value={selectedPasswordMemberId} options={passwordMembers.map((member) => ({ value: member.id, label: `${member.name} — ${member.hasPassword ? "password set" : "password required"}` }))} onChange={setPasswordMemberId} /></div>
              <div className="field"><label htmlFor="reset-member-password">New password</label><AdminPasswordInput id="reset-member-password" value={resetPassword} visible={showResetPassword} onChange={setResetPassword} onToggle={() => setShowResetPassword((current) => !current)} placeholder="8 or more characters" /><span className="field-hint">This replaces the member&apos;s previous password.</span></div>
              <button type="button" className="secondary-button full" onClick={setAccessPassword} disabled={resettingPassword}>{!resettingPassword && <KeyRound size={16} aria-hidden="true" />}{resettingPassword ? "Updating…" : "Set member password"}</button>
            </div>
          ) : <p className="muted credential-empty">Add a member before setting a password.</p>}
          <p className="divider-label">Add a member</p>
          <form className="settings-form" onSubmit={addMember}>
            <div className="field-grid two"><div className="field"><label htmlFor="member-name">Full name</label><input id="member-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Team member" /></div><div className="field"><label htmlFor="member-email">Login email</label><input id="member-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></div></div>
            <div className="field"><label htmlFor="member-role">Role</label><Dropdown id="member-role" value={role} options={[{ value: "member", label: "Member — add and view spending" }, { value: "admin", label: "Admin — manage the workspace" }]} onChange={(nextRole) => setRole(nextRole as Role)} /></div>
            {role === "member" ? <div className="field"><label htmlFor="new-member-password">Member password</label><AdminPasswordInput id="new-member-password" value={memberPassword} visible={showMemberPassword} onChange={setMemberPassword} onToggle={() => setShowMemberPassword((current) => !current)} placeholder="8 or more characters" /><span className="field-hint">Share this password privately with the member.</span></div> : <p className="field-hint">Additional admins use the private environment password.</p>}
            <button className="secondary-button full" disabled={adding}>{!adding && <Plus size={16} aria-hidden="true" />}{adding ? "Adding…" : "Add team member"}</button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-head"><div><h2>Workspace settings</h2><p>Team-wide preferences</p></div></div>
          {!configured && <div className="setup-box"><h3>Connect Supabase to go live</h3><p>The interface is running with demo data. Your private proof bucket and team tables are already prepared in the project.</p><ol className="setup-steps"><li><span className="step-number">1</span>Run the included schema in Supabase</li><li><span className="step-number">2</span>Add the project URL and service key</li><li><span className="step-number">3</span>Refresh — your first admin is created</li></ol></div>}
          <div className="settings-form" style={{ marginTop: 18 }}>
            <div className="field"><label htmlFor="team-name">Team name</label><input id="team-name" value={settings.teamName} onChange={(event) => onSettingsChange({ ...settings, teamName: event.target.value })} /></div>
            <div className="field"><label htmlFor="required-app-version">Latest app version</label><input id="required-app-version" inputMode="decimal" value={settings.requiredAppVersion} onChange={(event) => onSettingsChange({ ...settings, requiredAppVersion: event.target.value })} placeholder="1.0.1" /><span className="field-hint">Set this to the Median release version. Older app builds will show a Get update button.</span></div>
            <div className="field"><span className="field-label">Available currencies</span><div className="currency-selector">{CURRENCY_OPTIONS.map((option) => { const enabled = settings.currencies.includes(option.value); return <button key={option.value} type="button" className={`currency-option ${enabled ? "active" : ""}`} onClick={() => { const currencies = enabled ? settings.currencies.filter((currency) => currency !== option.value) : [...settings.currencies, option.value]; if (currencies.length) onSettingsChange({ ...settings, currency: currencies[0], currencies }); }} aria-pressed={enabled}>{enabled && <Check size={15} aria-hidden="true" />}{option.label}</button>; })}</div><span className="field-hint">Choose every currency team members can use when recording spending.</span></div>
            <div className="toggle-row"><div className="toggle-copy"><strong>Require proof of spending</strong><span>Receipt photo or payment screenshot</span></div><div className="toggle-action"><span>{settings.requireProof ? "Required" : "Optional"}</span><button type="button" className={`toggle ${settings.requireProof ? "on" : ""}`} onClick={() => onSettingsChange({ ...settings, requireProof: !settings.requireProof })} aria-label="Toggle required proof" aria-pressed={settings.requireProof} /></div></div>
            <button className="primary-button dark full" onClick={saveSettings} disabled={saving}>{!saving && <Save size={16} aria-hidden="true" />}{saving ? "Saving…" : "Save settings"}</button>
          </div>
        </section>
      </div>
    </>
  );
}
