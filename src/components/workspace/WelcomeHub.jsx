import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Briefcase, Code2, Brain, Zap, ArrowRight, Flame, Star, Target } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client.js";
import { TiltCard } from '@/components/effects/UIEffect.jsx';
import DailyBriefing from '@/components/os/DailyBriefing.jsx';

const QUICK_ACTIONS = [
  { icon: BookOpen, label: 'Study', desc: 'Notes, flashcards, revision', workspace: 'study', tool: 'notes', gradient: 'from-cyan-500/10 to-blue-500/10 border-cyan-500/20' },
  { icon: Briefcase, label: 'Career', desc: 'Resume, internships, prep', workspace: 'career', tool: 'resume_builder', gradient: 'from-violet-500/10 to-purple-500/10 border-violet-500/20' },
  { icon: Code2, label: 'Dev', desc: 'Code, debug, deploy', workspace: 'dev', tool: 'code_playground', gradient: 'from-emerald-500/10 to-green-500/10 border-emerald-500/20' },
  { icon: Brain, label: 'AI Lab', desc: 'Chat, generate, explore', workspace: 'ai', tool: 'ai_chat', gradient: 'from-amber-500/10 to-orange-500/10 border-amber-500/20' },
];

export default function WelcomeHub() {
  const { setCommandBarOpen, setActiveWorkspace, setActiveTool, xp, level, streak, modeConfig, profile } = useSOS();
  const firstName = profile?.name?.split(' ')?.[0] || null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.filter({ status: 'active' }, '-created_date', 5),
    initialData: [],
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-pending'],
    queryFn: () => base44.entities.Task.filter({ status: 'todo' }, '-created_date', 5),
    initialData: [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['study-sessions-recent'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 100),
    initialData: [],
  });

  const todayKey = new Date().toDateString();
  const todaysSessions = sessions.filter((session) => {
    const sessionDate = session.created_date || session.created_at;
    if (!sessionDate) return false;
    return new Date(sessionDate).toDateString() === todayKey;
  });

  const todayStudyMinutes = todaysSessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);
  const todayStudyHours = (todayStudyMinutes / 60).toFixed(1);
  const todaySessionsCount = todaysSessions.length;
  const dailyStudyTarget = Number(profile?.studyTimeTarget || 0);
  const dailyTargetProgress = dailyStudyTarget > 0
    ? Math.min(100, Math.round(((todayStudyMinutes / 60) / dailyStudyTarget) * 100))
    : 0;
  const rankTitle = level >= 15 ? 'Legend' : level >= 10 ? 'Elite' : level >= 5 ? 'Grinder' : 'Rookie';
  const xpIntoCurrentLevel = xp % 500;
  const levelProgress = Math.round((xpIntoCurrentLevel / 500) * 100);

  const handleAction = (action) => {
    setActiveWorkspace(action.workspace);
    setActiveTool(action.tool);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: modeConfig.animations ? 0.08 : 0 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-4xl mx-auto px-4 py-8 md:py-16"
    >
      {/* Hero */}
      <motion.div variants={itemVariants} className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary mb-4">
          <Sparkles className="w-3 h-3" />
          <span>Your AI-powered student OS</span>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{greeting}{firstName ? `, ${firstName}` : ''} 👋</p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
          What will you
          <span className={`text-primary ${modeConfig.glow ? 'glow-text-primary' : ''}`}> achieve </span>
          today?
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
          Express your intent. SOS interprets, plans, and executes.
        </p>
      </motion.div>

      {/* Command Trigger */}
      <motion.div variants={itemVariants} className="mb-12">
        <button
          onClick={() => setCommandBarOpen(true)}
          className={`w-full max-w-xl mx-auto flex items-center gap-3 px-5 py-4 rounded-2xl border border-border hover:border-primary/30 transition-all ${
            modeConfig.glass ? 'glass' : 'bg-card'
          } ${modeConfig.glow ? 'hover:glow-primary' : ''}`}
        >
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-muted-foreground text-left flex-1">Type your goal, question, or task...</span>
          <kbd className="text-[10px] font-mono px-2 py-1 rounded-md bg-muted border border-border">⌘K</kbd>
        </button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <div className={`p-3 rounded-xl text-center ${modeConfig.glass ? 'glass' : 'bg-card border border-border'}`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star className="w-3.5 h-3.5 text-warning" />
          </div>
          <p className="text-lg font-bold">{xp}</p>
          <p className="text-[10px] text-muted-foreground">XP</p>
        </div>
        <div className={`p-3 rounded-xl text-center ${modeConfig.glass ? 'glass' : 'bg-card border border-border'}`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-lg font-bold">Lv.{level}</p>
          <p className="text-[10px] text-muted-foreground">{rankTitle}</p>
        </div>
        <div className={`p-3 rounded-xl text-center ${modeConfig.glass ? 'glass' : 'bg-card border border-border'}`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-3.5 h-3.5 text-chart-5" />
          </div>
          <p className="text-lg font-bold">{streak}d</p>
          <p className="text-[10px] text-muted-foreground">Streak</p>
        </div>
        <div className={`p-3 rounded-xl text-center ${modeConfig.glass ? 'glass' : 'bg-card border border-border'}`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-bold">{todayStudyHours}h</p>
          <p className="text-[10px] text-muted-foreground">Study Today</p>
        </div>
        <div className={`p-3 rounded-xl text-center ${modeConfig.glass ? 'glass' : 'bg-card border border-border'}`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-bold">{todaySessionsCount}</p>
          <p className="text-[10px] text-muted-foreground">Sessions</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className={`mb-8 p-4 rounded-2xl ${modeConfig.glass ? 'glass border border-border' : 'bg-card border border-border'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Progress</p>
          <p className="text-xs text-muted-foreground">{xpIntoCurrentLevel}/500 XP to next level</p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${levelProgress}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Daily study target</span>
          <span className="font-semibold text-foreground">{dailyTargetProgress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${dailyTargetProgress}%` }} />
        </div>
      </motion.div>

      {profile?.examType && (
        <motion.div variants={itemVariants} className="mb-8 p-4 rounded-2xl border border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Exam Command Center</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Focus mode active for <span className="text-foreground font-medium uppercase">{profile.examType}</span>
            {profile.examStage ? ` (${profile.examStage})` : ''}. Keep your daily streak alive and complete your target hours.
          </p>
        </motion.div>
      )}

      {/* Daily Briefing */}
      <motion.div variants={itemVariants}>
        <DailyBriefing />
      </motion.div>

      {/* Workspace Cards */}
      <motion.div variants={itemVariants}>
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-4">Workspaces</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {QUICK_ACTIONS.map((action) => (
            <TiltCard
              key={action.label}
              intensity={12}
              className={`group p-4 rounded-xl border bg-gradient-to-br ${action.gradient} text-left cursor-pointer`}
            >
              <button
                onClick={() => handleAction(action)}
                className="w-full h-full text-left"
              >
                <action.icon className="w-5 h-5 mb-3 text-foreground" />
                <h3 className="text-sm font-semibold mb-0.5">{action.label}</h3>
                <p className="text-[10px] text-muted-foreground">{action.desc}</p>
              </button>
            </TiltCard>
          ))}
        </div>
      </motion.div>

      {/* Active Goals */}
      {goals.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Active Goals</h2>
            <button onClick={() => setActiveTool('goals')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 mb-10">
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <Target className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{goal.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${goal.progress || 0}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{goal.progress || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pending Tasks */}
      {tasks.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Pending Tasks</h2>
            <button onClick={() => setActiveTool('tasks')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border">
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" />
                <span className="text-sm">{task.title}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
