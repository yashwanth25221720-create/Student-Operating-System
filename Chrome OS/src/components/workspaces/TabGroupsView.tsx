import { Download, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { restoreTabGroup } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";

export function TabGroupsView() {
  const { state, captureCurrentTabs, importTabGroups } = useHalo();
  const [name, setName] = useState("Current Session");
  const [status, setStatus] = useState("");

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h1>Saved Tab Groups</h1>
          <p>Save current tabs as workspace-ready groups and restore them later.</p>
        </div>
        <div className="save-tabs">
          <input value={name} onChange={(event) => setName(event.target.value)} />
          <button onClick={() => void captureCurrentTabs(name)}><Save size={17} /> Save Tabs</button>
          <button
            onClick={() => {
              setStatus("Importing Chrome tab groups...");
              importTabGroups()
                .then((count) => setStatus(count ? `Imported ${count} Chrome tab groups.` : "No Chrome tab groups with restorable tabs were found."))
                .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Tab group import failed."));
            }}
          >
            <Download size={17} /> Import Groups
          </button>
        </div>
      </div>
      {status && <p className="status-message">{status}</p>}
      <div className="tab-group-grid">
        {state.tabGroups.map((group) => (
          <article key={group.id}>
            <h2>{group.name}</h2>
            <p>{group.tabs.length} tabs saved {new Date(group.createdAt).toLocaleDateString()}</p>
            <div className="tab-preview-list">
              {group.tabs.slice(0, 5).map((tab) => <span key={tab.url}>{tab.title}</span>)}
            </div>
            <button onClick={() => void restoreTabGroup(group)}><RotateCcw size={17} /> Restore</button>
          </article>
        ))}
        {state.tabGroups.length === 0 && <p className="empty-copy">Saved tab groups will appear here after capture.</p>}
      </div>
    </section>
  );
}
