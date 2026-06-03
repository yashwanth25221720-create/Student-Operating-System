import { Plus } from "lucide-react";
import { useState } from "react";
import { useHalo } from "../../state/HaloStateContext";
import type { Workspace } from "../../types/halo";

export function WorkspacesView() {
  const { state, dispatch } = useHalo();
  const [name, setName] = useState("");

  const addWorkspace = () => {
    if (!name.trim()) return;
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: name.trim(),
      accent: state.settings.accentColor,
      bookmarkIds: [],
      noteIds: [],
      taskIds: [],
      tabGroupIds: []
    };
    dispatch({ type: "upsertWorkspace", workspace });
    dispatch({ type: "switchWorkspace", workspaceId: workspace.id });
    setName("");
  };

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h1>Workspaces</h1>
          <p>Instant context switching for study, coding, AI, gaming, and custom setups.</p>
        </div>
      </div>
      <div className="task-composer">
        <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addWorkspace()} placeholder="Create workspace" />
        <button onClick={addWorkspace}><Plus size={17} /> Create</button>
      </div>
      <div className="workspace-grid">
        {state.workspaces.map((workspace) => (
          <article className={workspace.id === state.currentWorkspaceId ? "active" : ""} key={workspace.id}>
            <span style={{ background: workspace.accent }} />
            <h2>{workspace.name}</h2>
            <p>{state.notes.filter((note) => note.workspaceId === workspace.id).length} notes</p>
            <p>{state.tasks.filter((task) => task.workspaceId === workspace.id).length} tasks</p>
            <button onClick={() => dispatch({ type: "switchWorkspace", workspaceId: workspace.id })}>Switch</button>
          </article>
        ))}
      </div>
    </section>
  );
}
