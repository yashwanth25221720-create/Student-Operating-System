import { Clock, Check, X, AlertCircle, Timer } from "lucide-react";
import { useState, useEffect } from "react";
import { scheduleNotification, markTimerCompleted, parseDuration, formatDuration } from "../lib/notificationService";

interface TodoTimerModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function TodoTimerModal({ taskId, taskTitle, onClose, onComplete }: TodoTimerModalProps) {
  const [duration, setDuration] = useState("5m");
  const [scheduled, setScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchedule = async () => {
    const ms = parseDuration(duration);
    if (ms === 0) {
      setError("Invalid duration format. Use format like 5m, 1h, 30s");
      return;
    }

    try {
      const timer = {
        id: crypto.randomUUID(),
        taskId,
        taskTitle,
        scheduledTime: Date.now() + ms,
        duration: ms,
        completed: false,
        createdAt: Date.now()
      };

      await scheduleNotification(timer);
      setScheduled(true);
      setError(null);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule timer");
    }
  };

  const handleComplete = async () => {
    try {
      await markTimerCompleted(taskId);
      onComplete?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete task");
    }
  };

  const quickDurations = ["5m", "15m", "30m", "1h", "2h", "1d"];

  return (
    <div className="todo-timer-overlay">
      <div className="todo-timer-card">
        <div className="todo-timer-card-header">
          <div className="todo-timer-title-wrapper">
            <div className="todo-timer-icon">
              <Timer size={24} className="todo-timer-icon-svg" />
            </div>
            <h2 className="todo-timer-title">Set Timer</h2>
          </div>
          <button onClick={onClose} className="todo-timer-close-button" aria-label="Close timer modal">
            <X size={20} className="todo-timer-close-icon" />
          </button>
        </div>

        <div className="todo-timer-task-card">
          <p className="todo-timer-task-label">Task: {taskTitle}</p>
          {!scheduled && <p className="todo-timer-task-subtitle">Set a reminder for this task</p>}
        </div>

        {scheduled ? (
          <div className="todo-timer-success-card">
            <div className="todo-timer-success-icon">
              <Check size={64} className="todo-timer-success-svg" />
            </div>
            <p className="todo-timer-success-title">Timer Scheduled!</p>
            <p className="todo-timer-success-description">You'll be notified in {formatDuration(parseDuration(duration))}</p>
          </div>
        ) : (
          <>
            <div className="todo-timer-section">
              <label className="todo-timer-section-label">Quick Durations</label>
              <div className="todo-timer-duration-grid">
                {quickDurations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`todo-timer-duration-button ${duration === d ? "todo-timer-duration-button-active" : "todo-timer-duration-button-inactive"}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="todo-timer-section">
              <label className="todo-timer-section-label">Custom Duration</label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g., 5m, 1h, 30s"
                className="todo-timer-input"
              />
              <p className="todo-timer-input-helper">Format: number + unit (s=seconds, m=minutes, h=hours, d=days)</p>
            </div>

            {error && (
              <div className="todo-timer-error-card">
                <div className="todo-timer-error-icon">
                  <AlertCircle size={16} className="todo-timer-error-svg" />
                </div>
                <span>{error}</span>
              </div>
            )}

            <div className="todo-timer-actions">
              <button onClick={handleSchedule} className="todo-timer-button todo-timer-button-primary">
                Schedule Timer
              </button>
              <button onClick={handleComplete} className="todo-timer-button todo-timer-button-secondary">
                Complete Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
