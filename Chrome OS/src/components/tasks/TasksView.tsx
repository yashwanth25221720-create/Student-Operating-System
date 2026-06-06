import { Plus, Clock } from "lucide-react";
import { useState } from "react";
import { useHalo } from "../../state/HaloStateContext";
import type { HaloTask, Priority } from "../../types/halo";
import { TodoTimerModal } from "../TodoTimerModal";

export function TasksView() {
  const { state, dispatch } = useHalo();
  const [title, setTitle] = useState("");
  const [timerTask, setTimerTask] = useState<HaloTask | null>(null);

  const addTask = () => {
    if (!title.trim()) return;
    const task: HaloTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      priority: "medium",
      category: "General",
      workspaceId: state.currentWorkspaceId
    };
    dispatch({ type: "upsertTask", task });
    setTitle("");
  };

  return (
    <section className="module-panel">
      <div className="module-header">
        <div>
          <h1>Tasks</h1>
          <p>Due dates, priorities, categories, and completion tracking.</p>
        </div>
      </div>
      <div className="task-composer">
        <input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Add a focused task" />
        <button onClick={addTask}><Plus size={17} /> Add</button>
      </div>
      <div className="task-table">
        {state.tasks.map((task) => (
          <article key={task.id}>
            <input type="checkbox" checked={task.completed} onChange={() => dispatch({ type: "toggleTask", taskId: task.id })} />
            <input value={task.title} onChange={(event) => dispatch({ type: "upsertTask", task: { ...task, title: event.target.value } })} />
            <input type="date" value={task.dueDate ?? ""} onChange={(event) => dispatch({ type: "upsertTask", task: { ...task, dueDate: event.target.value } })} />
            <select value={task.priority} onChange={(event) => dispatch({ type: "upsertTask", task: { ...task, priority: event.target.value as Priority } })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input value={task.category} onChange={(event) => dispatch({ type: "upsertTask", task: { ...task, category: event.target.value } })} />
            <button onClick={() => setTimerTask(task)} title="Set timer" className="task-timer-button">
              <Clock size={16} className="task-timer-icon" />
            </button>
          </article>
        ))}
      </div>

      {timerTask && (
        <TodoTimerModal
          taskId={timerTask.id}
          taskTitle={timerTask.title}
          onClose={() => setTimerTask(null)}
          onComplete={() => dispatch({ type: "toggleTask", taskId: timerTask.id })}
        />
      )}
    </section>
  );
}
