import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Timer, Brain, Briefcase, Code2,
  CheckSquare, Calendar, Target, Settings, Layers, CalendarDays, Sparkles
} from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip.jsx";

const DOCK_ITEMS = [
  { id: 'notes', icon: FileText, label: 'Notes', color: 'text-chart-1' },
  { id: 'flashcards', icon: Layers, label: 'Flashcards', color: 'text-chart-2' },
  { id: 'timer', icon: Timer, label: 'Focus Timer', color: 'text-chart-3' },
  { id: 'ai_chat', icon: Brain, label: 'AI Chat', color: 'text-chart-4' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks', color: 'text-chart-5' },
  { id: 'goals', icon: Target, label: 'Goals', color: 'text-chart-1' },
  { id: 'resume_builder', icon: Briefcase, label: 'Resume', color: 'text-chart-2' },
  { id: 'code_playground', icon: Code2, label: 'Code', color: 'text-chart-3' },
  { id: 'planner', icon: Calendar, label: 'Planner', color: 'text-chart-4' },
  { id: 'smart_calendar', icon: CalendarDays, label: 'Smart Calendar', color: 'text-chart-5' },
  { id: 'study_ai', icon: Sparkles, label: 'Study AI', color: 'text-primary' },
  { id: 'settings', icon: Settings, label: 'Settings', color: 'text-muted-foreground' },
];

export default function Dock() {
  const { activeTool, setActiveTool, modeConfig } = useSOS();

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 ${modeConfig.glass ? 'glass-strong' : 'bg-card border border-border'} rounded-2xl px-3 py-2 flex items-center gap-1`}>
        {DOCK_ITEMS.map((item) => {
          const isActive = activeTool === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTool(isActive ? null : item.id)}
                  className="relative group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary/15 scale-110' 
                      : 'hover:bg-muted/50 hover:scale-105'
                  }`}>
                    <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-primary' : item.color} transition-colors`} />
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="dock-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
