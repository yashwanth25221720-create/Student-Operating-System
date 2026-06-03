import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useHalo } from "../../state/HaloStateContext";
import type { HaloNote } from "../../types/halo";
import { renderMarkdown } from "../../utils/markdown";

export function NotesView() {
  const { state, dispatch } = useHalo();
  const [selectedId, setSelectedId] = useState(state.notes[0]?.id);
  const selected = useMemo(() => state.notes.find((note) => note.id === selectedId) ?? state.notes[0], [selectedId, state.notes]);

  const updateNote = (patch: Partial<HaloNote>) => {
    if (!selected) return;
    dispatch({ type: "upsertNote", note: { ...selected, ...patch, updatedAt: new Date().toISOString() } });
  };

  const createNote = () => {
    const note: HaloNote = {
      id: crypto.randomUUID(),
      title: "Untitled Note",
      body: "",
      mode: "quick",
      updatedAt: new Date().toISOString(),
      workspaceId: state.currentWorkspaceId
    };
    dispatch({ type: "upsertNote", note });
    setSelectedId(note.id);
  };

  return (
    <section className="split-module">
      <aside className="module-list">
        <button onClick={createNote}><Plus size={16} /> New Note</button>
        {state.notes.map((note) => (
          <button key={note.id} className={selected?.id === note.id ? "active" : ""} onClick={() => setSelectedId(note.id)}>
            <strong>{note.title}</strong>
            <span>{note.domain ?? note.mode}</span>
          </button>
        ))}
      </aside>
      {selected && (
        <article className="editor-panel">
          <div className="editor-toolbar">
            <input value={selected.title} onChange={(event) => updateNote({ title: event.target.value })} />
            <select value={selected.mode} onChange={(event) => updateNote({ mode: event.target.value as HaloNote["mode"] })}>
              <option value="quick">Quick</option>
              <option value="rich">Markdown</option>
              <option value="website">Website</option>
            </select>
            {selected.mode === "website" && <input value={selected.domain ?? ""} onChange={(event) => updateNote({ domain: event.target.value })} placeholder="github.com" />}
            <button onClick={() => dispatch({ type: "deleteNote", noteId: selected.id })}><Trash2 size={16} /></button>
          </div>
          <textarea value={selected.body} onChange={(event) => updateNote({ body: event.target.value })} placeholder="Start typing. Halo auto-saves." />
          {selected.mode === "rich" && <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.body) }} />}
        </article>
      )}
    </section>
  );
}
