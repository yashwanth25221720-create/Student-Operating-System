import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Plus, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSOS } from '@/lib/SOSContext';

const CATEGORY_COLORS = {
  study: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  career: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  dev: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  ai: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  productivity: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
};

export default function GoalsTool() {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('study');
  const [isGenerating, setIsGenerating] = useState(false);
  const { addXp } = useSOS();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date', 20),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Goal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowCreate(false);
      setTitle('');
      addXp(20);
    },
  });

  const generateSteps = async () => {
    if (!title.trim()) return;
    setIsGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Break down this student goal into 5-7 actionable steps: "${title}" (Category: ${category}). Each step should be specific and achievable.`,
      response_json_schema: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                tool: { type: "string" }
              }
            }
          }
        }
      }
    });
    createMutation.mutate({
      title, category, status: 'active', progress: 0, xp_reward: 100,
      steps: result.steps.map(s => ({ ...s, completed: false })),
    });
    setIsGenerating(false);
  };

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Goal.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const toggleStep = (goal, stepIndex) => {
    const newSteps = [...(goal.steps || [])];
    newSteps[stepIndex] = { ...newSteps[stepIndex], completed: !newSteps[stepIndex].completed };
    const completed = newSteps.filter(s => s.completed).length;
    const progress = Math.round((completed / newSteps.length) * 100);
    updateGoalMutation.mutate({
      id: goal.id,
      data: { steps: newSteps, progress, status: progress === 100 ? 'completed' : 'active' }
    });
    if (!newSteps[stepIndex].completed === true) addXp(10);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-chart-1" />
          <h2 className="font-semibold">Goals</h2>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {showCreate && (
        <div className="p-4 border-b border-border space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Your goal..." />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="study">📚 Study</SelectItem>
              <SelectItem value="career">💼 Career</SelectItem>
              <SelectItem value="dev">💻 Dev</SelectItem>
              <SelectItem value="ai">🤖 AI</SelectItem>
              <SelectItem value="productivity">⚡ Productivity</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateSteps} disabled={!title.trim() || isGenerating} className="w-full">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Create Goal with AI Steps
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No goals yet. Set one and let AI break it down!</p>
          </div>
        ) : (
          goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onToggleStep={toggleStep} />
          ))
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal, onToggleStep }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[goal.category]}`}>
              {goal.category}
            </span>
            {goal.status === 'completed' && <span className="text-[10px] text-chart-3">✓ Done</span>}
          </div>
          <h3 className="font-medium text-sm mt-1">{goal.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{goal.progress || 0}%</span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && goal.steps?.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {goal.steps.map((step, i) => (
            <button
              key={i}
              onClick={() => onToggleStep(goal, i)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors text-left"
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                step.completed ? 'bg-chart-3 border-chart-3' : 'border-muted-foreground'
              }`}>
                {step.completed && <span className="text-[8px] text-white">✓</span>}
              </div>
              <span className={`text-xs ${step.completed ? 'line-through text-muted-foreground' : ''}`}>
                {step.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLORS_MAP = {
  study: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  career: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
  dev: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  ai: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  productivity: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
};