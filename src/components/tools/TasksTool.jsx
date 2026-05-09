import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Plus, Circle, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from "@/api/base44Client.js";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { useSOS } from '@/lib/SOSContext.jsx';

const PRIORITY_COLORS = {
  low: 'text-chart-3',
  medium: 'text-chart-4',
  high: 'text-chart-5',
  urgent: 'text-destructive',
};

export default function TasksTool() {
  const [newTask, setNewTask] = useState('');
  const [filter, setFilter] = useState('all');
  const { addXp } = useSOS();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewTask('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      addXp(10);
    },
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    createMutation.mutate({ title: newTask.trim(), status: 'todo', priority: 'medium' });
  };

  const toggleTask = (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  const filtered = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'active') return t.status !== 'done';
    return t.status === 'done';
  });

  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-chart-5" />
          <h2 className="font-semibold">Tasks</h2>
          <span className="text-xs text-muted-foreground">{doneCount}/{tasks.length}</span>
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'done'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
                filter === f ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-4 border-b border-border flex gap-2">
        <Input
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          placeholder="Add a task..."
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!newTask.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </form>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border hover:border-primary/20 transition-colors group"
              >
                <button onClick={() => toggleTask(task)}>
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-chart-3" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </button>
                <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </span>
                {task.priority && (
                  <span className={`text-[10px] font-medium uppercase ${PRIORITY_COLORS[task.priority]}`}>
                    {task.priority}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
