"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const DISMISS_EVENT = "peptiking-install-dismissed";
function subscribeDismissal(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  return () => window.removeEventListener(DISMISS_EVENT, callback);
}
function dismissalSnapshot() {
  try { return sessionStorage.getItem(DISMISS_EVENT) === "1"; } catch { return false; }
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeDisplayMode(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function standaloneSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

const subscribePlatform = () => () => {};
const serverSnapshot = () => false;
const iosSnapshot = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const ios = useSyncExternalStore(subscribePlatform, iosSnapshot, serverSnapshot);
  const standalone = useSyncExternalStore(subscribeDisplayMode, standaloneSnapshot, serverSnapshot);
  const [instructions, setInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sessionDismissed = useSyncExternalStore(subscribeDismissal, dismissalSnapshot, serverSnapshot);

  function dismiss() {
    setDismissed(true);
    setInstructions(false);
    try { sessionStorage.setItem(DISMISS_EVENT, "1"); } catch { /* Dismiss still works when storage is unavailable. */ }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setInstructions(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) { setInstructions((value) => !value); return; }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } finally {
      setPrompt(null);
    }
  }

  if (dismissed || sessionDismissed || installed || standalone || (!prompt && !ios && !instructions)) return null;
  return (
    <aside className="install-app" aria-label="Install Peptiking">
      {instructions && <div className="install-app-help" id="install-app-help" role="status">
        <strong>Add Peptiking to your phone</strong>
        <p>{ios ? "Open this page in Safari. Tap Share, then Add to Home Screen, then Add." : "Open the browser menu and choose Install app or Add to Home screen."}</p>
        <button type="button" onClick={() => setInstructions(false)}>Close</button>
      </div>}
      <div className="install-app-controls">
        <button className="install-app-button" type="button" onClick={() => void install().catch(() => setInstructions(true))} aria-expanded={ios ? instructions : undefined} aria-controls={ios ? "install-app-help" : undefined}>Install app</button>
        <button className="install-app-dismiss" type="button" onClick={dismiss} aria-label="Dismiss install app suggestion"><X size={16} aria-hidden="true" /></button>
      </div>
    </aside>
  );
}
