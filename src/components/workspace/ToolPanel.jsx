import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import NotesTool from '@/components/tools/NotesTool.jsx';
import FlashcardsTool from '@/components/tools/FlashcardsTool.jsx';
import TimerTool from '@/components/tools/TimerTool.jsx';
import AIChatTool from '@/components/tools/AIChatTool.jsx';
import TasksTool from '@/components/tools/TasksTool.jsx';
import GoalsTool from '@/components/tools/GoalsTool.jsx';
import ResumeBuilderTool from '@/components/tools/ResumeBuilderTool.jsx';
import CodePlaygroundTool from '@/components/tools/CodePlaygroundTool.jsx';
import PlannerTool from '@/components/tools/PlannerTool.jsx';
import SettingsTool from '@/components/tools/SettingsTool.jsx';
import SmartCalendarTool from '@/components/tools/SmartCalendarTool.jsx';
import StudyAIChatTool from '@/components/tools/StudyAIChatTool.jsx';

const TOOLS = {
  notes: NotesTool,
  flashcards: FlashcardsTool,
  timer: TimerTool,
  ai_chat: AIChatTool,
  tasks: TasksTool,
  goals: GoalsTool,
  resume_builder: ResumeBuilderTool,
  code_playground: CodePlaygroundTool,
  planner: PlannerTool,
  settings: SettingsTool,
  smart_calendar: SmartCalendarTool,
  study_ai: StudyAIChatTool,
};

export default function ToolPanel() {
  const { activeTool, setActiveTool, modeConfig } = useSOS();
  const ToolComponent = activeTool ? TOOLS[activeTool] : null;

  return (
    <AnimatePresence>
      {activeTool && ToolComponent && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`fixed right-0 top-14 bottom-0 w-full sm:w-[420px] z-30 border-l border-border ${
            modeConfig.glass ? 'glass-strong' : 'bg-card'
          }`}
        >
          <button
            onClick={() => setActiveTool(null)}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <ToolComponent />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
