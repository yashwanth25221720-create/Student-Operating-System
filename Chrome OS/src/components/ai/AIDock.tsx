import { Edit3, ExternalLink, Plus, SendHorizonal } from "lucide-react";
import { useMemo, useState } from "react";
import type React from "react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";
import type { AiProvider } from "../../types/halo";

export function AIDock({ expanded = false }: { expanded?: boolean }) {
  const { state, dispatch } = useHalo();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const selected = useMemo(
    () => state.providers.find((provider) => provider.id === state.settings.defaultAiProviderId) ?? state.providers[0],
    [state.providers, state.settings.defaultAiProviderId]
  );

  const launch = () => {
    if (!query.trim()) return;
    void openUrl(selected.urlTemplate.replace("{query}", encodeURIComponent(query.trim())));
    setQuery("");
  };

  return (
    <aside className={`ai-dock ${expanded ? "expanded" : ""}`}>
      <div className="ai-provider-strip">
        {state.providers.map((provider) => (
          <button
            key={provider.id}
            className={provider.id === selected.id ? "selected" : ""}
            style={{ "--provider": provider.color } as React.CSSProperties}
            title={provider.name}
            onClick={() => dispatch({ type: "setDefaultProvider", providerId: provider.id })}
          >
            {provider.name.slice(0, 2)}
          </button>
        ))}
      </div>
      <div className="ai-query-box">
        <span>{selected.name}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && launch()} placeholder="Ask selected AI" />
        <button onClick={launch} title="Open AI provider">
          <SendHorizonal size={18} />
        </button>
      </div>
      {expanded && (
        <div className="ai-editor-panel">
          <button
            onClick={() =>
              setEditing({ id: crypto.randomUUID(), name: "Custom AI", urlTemplate: "https://example.com/search?q={query}", color: "#facc15", isCustom: true })
            }
          >
            <Plus size={16} /> Add Provider
          </button>
          <div className="provider-list">
            {state.providers.map((provider) => (
              <article key={provider.id}>
                <span style={{ background: provider.color }} />
                <div>
                  <strong>{provider.name}</strong>
                  <small>{provider.urlTemplate}</small>
                </div>
                <button onClick={() => setEditing(provider)} title="Edit provider">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => void openUrl(provider.urlTemplate.replace("{query}", "Halo OS"))} title="Test provider">
                  <ExternalLink size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <ProviderDialog
          provider={editing}
          onClose={() => setEditing(null)}
          onSave={(provider) => {
            dispatch({ type: "upsertProvider", provider });
            dispatch({ type: "setDefaultProvider", providerId: provider.id });
            setEditing(null);
          }}
        />
      )}
    </aside>
  );
}

function ProviderDialog({ provider, onClose, onSave }: { provider: AiProvider; onClose: () => void; onSave: (provider: AiProvider) => void }) {
  const [draft, setDraft] = useState(provider);

  return (
    <div className="modal-backdrop">
      <form
        className="modal-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h3>Edit AI Provider</h3>
        <label>
          Name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          URL Template
          <input value={draft.urlTemplate} onChange={(event) => setDraft({ ...draft, urlTemplate: event.target.value })} />
        </label>
        <label>
          Accent
          <input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
