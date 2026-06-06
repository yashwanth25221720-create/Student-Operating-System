import { Activity, Download, EyeOff, Plus, Shield, ShieldCheck, Trash2, Upload, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useHalo } from "../../state/HaloStateContext";

const hasRuntime = () => typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);

export function AdBlockerView() {
  const { state, dispatch } = useHalo();
  const [customRule, setCustomRule] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");
  const settings = state.settings.adBlocker;
  const bandwidthMb = useMemo(() => (settings.stats.bandwidthSavedBytes / 1024 / 1024).toFixed(2), [settings.stats.bandwidthSavedBytes]);

  useEffect(() => {
    syncSettings(settings).catch(() => undefined);
  }, [settings]);

  const addRule = () => {
    if (!customRule.trim()) return;
    dispatch({ type: "addAdBlockerCustomRule", rule: customRule });
    setCustomRule("");
  };

  const addDomain = () => {
    if (!domain.trim()) return;
    dispatch({ type: "toggleAdBlockerWhitelist", domain });
    setDomain("");
  };

  return (
    <section className="module-panel adblocker-panel">
      <div className="module-header">
        <div>
          <h1>Halo Ad Blocker</h1>
          <p>MV3 network filtering, YouTube cleanup, anti-popup defense, tracker blocking, and cosmetic filtering.</p>
        </div>
        <button
          onClick={() => {
            dispatch({ type: "updateAdBlockerSettings", patch: { enabled: !settings.enabled } });
            setStatus(settings.enabled ? "Ad blocker disabled." : "Ad blocker enabled.");
          }}
        >
          {settings.enabled ? <ShieldCheck size={17} /> : <Shield size={17} />}
          {settings.enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {status && <p className="status-message">{status}</p>}

      {/* Mode Cards Selector */}
      <div className="adblocker-modes-selector" style={{ opacity: settings.enabled ? 1 : 0.5 }}>
        <button
          className={`mode-card ${settings.enabled && settings.blockingMode === "basic" ? "active" : ""}`}
          onClick={() => {
            dispatch({ type: "updateAdBlockerSettings", patch: { enabled: true, blockingMode: "basic" } });
            setStatus("Switched to Basic Mode.");
          }}
        >
          <div className="mode-card-header">
            <Shield size={20} className="mode-icon basic" />
            <h3>Basic Mode</h3>
          </div>
          <span className="mode-badge">Lightweight</span>
          <p>Blocks standard ad networks and YouTube video ads. Keeps browser resources extremely light.</p>
        </button>

        <button
          className={`mode-card ${settings.enabled && settings.blockingMode === "balanced" ? "active" : ""}`}
          onClick={() => {
            dispatch({ type: "updateAdBlockerSettings", patch: { enabled: true, blockingMode: "balanced" } });
            setStatus("Switched to Balanced Mode.");
          }}
        >
          <div className="mode-card-header">
            <ShieldCheck size={20} className="mode-icon balanced" />
            <h3>Balanced Mode</h3>
          </div>
          <span className="mode-badge">uBlock Style</span>
          <p>Blocks trackers, pixels, popups, and standard ad scripts. Perfect for daily, clean browsing.</p>
        </button>

        <button
          className={`mode-card ${settings.enabled && settings.blockingMode === "max" ? "active" : ""}`}
          onClick={() => {
            dispatch({ type: "updateAdBlockerSettings", patch: { enabled: true, blockingMode: "max" } });
            setStatus("Switched to Max Mode.");
          }}
        >
          <div className="mode-card-header">
            <Sparkles size={20} className="mode-icon max" />
            <h3>Max Mode</h3>
          </div>
          <span className="mode-badge">AdGuard Style</span>
          <p>Heavy-duty blocks including cookie consent popups, overlay widgets, elements, and anti-adblock alerts.</p>
        </button>

        {settings.blockingMode === "custom" && (
          <div className="mode-card active custom">
            <div className="mode-card-header">
              <Activity size={20} className="mode-icon custom" />
              <h3>Custom Mode</h3>
            </div>
            <span className="mode-badge">Personalized</span>
            <p>Your custom combination of blocker modules. Scaling is dynamically calculated.</p>
          </div>
        )}
      </div>

      <div className="adblocker-stats">
        <article><strong>{settings.stats.adsBlocked}</strong><span>Ads blocked</span></article>
        <article><strong>{settings.stats.trackersBlocked}</strong><span>Trackers blocked</span></article>
        <article><strong>{settings.stats.popupsBlocked}</strong><span>Popups blocked</span></article>
        <article><strong>{settings.stats.overlaysRemoved}</strong><span>Overlays removed</span></article>
        <article><strong>{bandwidthMb} MB</strong><span>Bandwidth saved</span></article>
      </div>

      <div className="adblocker-grid">
        <article>
          <h2>Protection Modules</h2>
          <Toggle label="YouTube ads" checked={settings.blockYouTubeAds} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { blockYouTubeAds: value } })} />
          <Toggle label="Trackers and pixels" checked={settings.blockTrackers} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { blockTrackers: value } })} />
          <Toggle label="Popups and redirects" checked={settings.blockPopups} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { blockPopups: value } })} />
          <Toggle label="Floating overlays" checked={settings.blockOverlays} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { blockOverlays: value } })} />
          <Toggle label="Cookie banners" checked={settings.blockCookieBanners} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { blockCookieBanners: value } })} />
          <Toggle label="Anti-anti-adblock" checked={settings.antiAntiAdblock} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { antiAntiAdblock: value } })} />
          <Toggle label="Element picker" checked={settings.elementPicker} onChange={(value) => dispatch({ type: "updateAdBlockerSettings", patch: { elementPicker: value } })} />
        </article>

        <article>
          <h2>Whitelist</h2>
          <div className="adblocker-input-row">
            <input value={domain} onChange={(event) => setDomain(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addDomain()} placeholder="example.com" />
            <button onClick={addDomain}><Plus size={16} /></button>
          </div>
          <div className="rule-list">
            {settings.whitelistedDomains.map((item) => (
              <button key={item} onClick={() => dispatch({ type: "toggleAdBlockerWhitelist", domain: item })}>
                <EyeOff size={15} /> {item}
              </button>
            ))}
          </div>
        </article>

        <article>
          <h2>Custom Rules</h2>
          <div className="adblocker-input-row">
            <input value={customRule} onChange={(event) => setCustomRule(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addRule()} placeholder="||ads.example.com^ or /sponsored/" />
            <button onClick={addRule}><Plus size={16} /></button>
          </div>
          <div className="rule-list">
            {settings.customRules.map((rule) => (
              <button key={rule} onClick={() => dispatch({ type: "removeAdBlockerCustomRule", rule })}>
                <Trash2 size={15} /> {rule}
              </button>
            ))}
          </div>
        </article>

        <article>
          <h2>Rule Engine</h2>
          <button onClick={() => syncSettings(settings).then(() => setStatus("Ad blocker rules synced to MV3 engine."))}>
            <Activity size={16} /> Sync Rules
          </button>
          <button onClick={() => exportSettings(settings)}>
            <Download size={16} /> Export Settings
          </button>
          <label className="adblocker-file-button">
            <Upload size={16} /> Import Filter List
            <input type="file" accept=".txt,.json" onChange={(event) => importFilterList(event.target.files?.[0], (rules) => rules.forEach((rule) => dispatch({ type: "addAdBlockerCustomRule", rule })))} />
          </label>
          <p className="empty-copy">Network blocking uses Chrome Manifest V3 declarative rules. Content scripts handle cosmetic filtering, YouTube fallbacks, popup defense, and heuristic overlay removal.</p>
        </article>
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

async function syncSettings(settings: unknown) {
  if (!hasRuntime()) return;
  await chrome.runtime.sendMessage({ type: "HALO_ADBLOCKER_SYNC_SETTINGS", settings });
}

function exportSettings(settings: unknown) {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "halo-adblocker-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importFilterList(file: File | undefined, onRules: (rules: string[]) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result ?? "");
    const rules = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("!") && !line.startsWith("#"));
    onRules(rules);
  };
  reader.readAsText(file);
}
