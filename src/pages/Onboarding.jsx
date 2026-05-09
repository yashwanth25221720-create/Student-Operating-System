import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Zap, ArrowRight, Brain, BookOpen, Code2, Briefcase,
  Clock, ChevronRight, Sparkles, Check,
  Moon, Sun, Coffee, Rocket, GraduationCap, Trophy, Star
} from 'lucide-react';
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";

// ─── Step definitions ─────────────────────────────────────────────────────────
const BASE_STEPS = ['intro', 'name', 'identity', 'goals', 'schedule', 'availability', 'style', 'ai_plan', 'launch'];
const EXAM_STEPS = ['exam_type', 'exam_stage'];

const IDENTITIES = [
  { id: 'engineering', icon: Code2, label: 'Engineering Student', desc: 'CS, ECE, Mech, Civil...' },
  { id: 'management', icon: Briefcase, label: 'MBA / Management', desc: 'Strategy, finance, ops...' },
  { id: 'science', icon: GraduationCap, label: 'Science / Research', desc: 'Physics, chem, bio...' },
  { id: 'competitive', icon: Trophy, label: 'Competitive Exams', desc: 'GATE, CAT, UPSC, GRE...' },
  { id: 'selflearner', icon: Star, label: 'Self-Learner', desc: 'Building skills my way' },
  { id: 'professional', icon: Rocket, label: 'Working Professional', desc: 'Upskilling while working' },
];

const GOALS = [
  { id: 'placements', icon: Briefcase, label: 'Campus Placements', color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30' },
  { id: 'exam_prep', icon: BookOpen, label: 'Exam Preparation', color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30' },
  { id: 'projects', icon: Code2, label: 'Build Projects', color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30' },
  { id: 'research', icon: Brain, label: 'Research / Thesis', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30' },
  { id: 'skills', icon: Rocket, label: 'Skill Development', color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30' },
  { id: 'certification', icon: Trophy, label: 'Certifications', color: 'from-orange-500/20 to-red-500/10 border-orange-500/30' },
];

const SCHEDULE_SLOTS = [
  { id: 'early_bird', icon: Sun, label: 'Early Bird', sub: '5am – 9am', color: 'text-amber-400' },
  { id: 'morning', icon: Coffee, label: 'Morning', sub: '9am – 12pm', color: 'text-orange-400' },
  { id: 'afternoon', icon: Clock, label: 'Afternoon', sub: '12pm – 5pm', color: 'text-chart-1' },
  { id: 'evening', icon: Moon, label: 'Evening', sub: '5pm – 10pm', color: 'text-chart-2' },
  { id: 'night_owl', icon: Moon, label: 'Night Owl', sub: '10pm – 2am', color: 'text-chart-3' },
];

const TIME_BUDGETS = [
  { id: '1h', label: '1 hr/day', sub: 'Tight schedule', icon: '⚡' },
  { id: '2h', label: '2 hrs/day', sub: 'Balanced pace', icon: '🔥' },
  { id: '4h', label: '4 hrs/day', sub: 'Serious grind', icon: '💪' },
  { id: '6h', label: '6+ hrs/day', sub: 'Full intensity', icon: '🚀' },
];

const COMMITMENTS = [
  { id: 'sleep', label: 'Sleep', placeholder: '8', required: true },
  { id: 'college', label: 'College / classes', placeholder: '6', required: true },
  { id: 'travel', label: 'Travel', placeholder: '1' },
  { id: 'tuition', label: 'Tuition / coaching', placeholder: '0' },
  { id: 'extracurricular', label: 'Extra curricular', placeholder: '1' },
  { id: 'play', label: 'Play / gym / hobbies', placeholder: '1' },
  { id: 'chores', label: 'Chores / family time', placeholder: '1' },
];

const STUDY_STYLES = [
  { id: 'visual', label: 'Visual Learner', desc: 'Diagrams, charts, videos', emoji: '👁️' },
  { id: 'reading', label: 'Reader / Writer', desc: 'Notes, summaries, essays', emoji: '📖' },
  { id: 'practice', label: 'Practice-First', desc: 'Problems, quizzes, coding', emoji: '🏋️' },
  { id: 'social', label: 'Discussion-Based', desc: 'Explain concepts out loud', emoji: '💬' },
];

const EXAM_TYPES = [
  { id: 'jee', label: 'JEE', desc: 'Engineering entrance' },
  { id: 'neet', label: 'NEET', desc: 'Medical entrance' },
  { id: 'gate', label: 'GATE', desc: 'Postgraduate engineering' },
  { id: 'cat', label: 'CAT', desc: 'MBA entrance' },
  { id: 'upsc', label: 'UPSC', desc: 'Civil services' },
  { id: 'gre', label: 'GRE', desc: 'Graduate admissions abroad' },
  { id: 'other', label: 'Other', desc: 'Any other competitive exam' },
];

const EXAM_STAGES = [
  { id: 'beginner', label: 'Beginner', desc: 'Getting started with basics' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Consistent prep is ongoing' },
  { id: 'advanced', label: 'Advanced', desc: 'Mock tests and final polishing' },
];

// ─── Particle background ───────────────────────────────────────────────────────
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          initial={{ x: `${Math.random() * 100}vw`, y: `${Math.random() * 100}vh`, opacity: 0 }}
          animate={{
            y: [`${Math.random() * 100}vh`, `${Math.random() * 100}vh`],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 4 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
        backgroundSize: '80px 80px'
      }} />
    </div>
  );
}

// ─── AI Guide Bubble ───────────────────────────────────────────────────────────
function AIGuide({ message, isTyping }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!message) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(message.slice(0, i));
      if (i >= message.length) { clearInterval(interval); setDone(true); }
    }, 18);
    return () => clearInterval(interval);
  }, [message]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 mb-8"
    >
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-chart-3 border-2 border-background" />
      </div>
      <div className="bg-card/60 backdrop-blur border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
        <p className="text-sm leading-relaxed text-foreground">
          {displayed}
          {!done && <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Progress dots ─────────────────────────────────────────────────────────────
function StepDots({ steps, current }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {steps.map((s, i) => (
        <div key={s} className={`rounded-full transition-all duration-300 ${
          i < current ? 'w-4 h-1.5 bg-primary' :
          i === current ? 'w-6 h-1.5 bg-primary' :
          'w-1.5 h-1.5 bg-muted'
        }`} />
      ))}
    </div>
  );
}

// ─── Main onboarding page ──────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState({
    name: '',
    identity: '',
    goals: [],
    schedule: [],
    commitments: {
      sleep: '8',
      college: '',
      travel: '',
      tuition: '',
      extracurricular: '',
      play: '',
      chores: '',
    },
    freeTimeHours: 16,
    studyTimeTarget: 9.6,
    style: '',
    examType: '',
    examStage: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('sos_onboarding_done') === 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const needsExamDetails = profile.goals.includes('exam_prep') || profile.identity === 'competitive';

  const STEPS = useMemo(() => {
    if (!needsExamDetails) return BASE_STEPS;
    const idx = BASE_STEPS.indexOf('schedule');
    return [...BASE_STEPS.slice(0, idx), ...EXAM_STEPS, ...BASE_STEPS.slice(idx)];
  }, [needsExamDetails]);

  const step = STEPS[stepIndex];
  const progressSteps = STEPS.slice(1, -1);
  const progressIndex = progressSteps.indexOf(step);

  const AI_MESSAGES = {
    intro: "Hey! I'm your SOS AI — your personal student co-pilot. I'll help you study smarter, build faster, and grow every day. Let's set you up in 60 seconds. Ready?",
    name: "First things first — what should I call you? 👋",
    identity: `Nice to meet you, ${profile.name || 'you'}! What best describes your situation right now?`,
    goals: `Perfect. What are you working towards? Pick all that apply — I'll tailor your entire OS around these. 🎯`,
    schedule: `When does your brain work best? I'll schedule your toughest tasks during your peak hours. ⚡`,
    exam_type: `Since you're on an exam-focused path, tell me the exact exam so I can personalize strategy and content. 🎯`,
    exam_stage: `Where are you currently in your preparation journey? I'll adjust intensity accordingly.`,
    time: `How many hours can you realistically commit each day? Honest answers = better planning. 💪`,
    availability: `Now let's map your real day. Add college, travel, tuition, play time, and any other fixed commitments. I'll calculate your free time from it.`,
    style: `Last one! How do you learn best? This shapes how I present content and suggest tools for you.`,
    ai_plan: `Analyzing your profile... building your personalized SOS experience. This will take just a moment! ✨`,
    launch: `Your OS is ready, ${profile.name || 'Explorer'}! Everything's been configured just for you. Let's go! 🚀`,
  };

  const next = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const updateProfile = (key, value) => setProfile(prev => ({ ...prev, [key]: value }));
  const updateCommitment = (key, value) => {
    const numericValue = value === '' ? '' : Math.max(0, Math.min(24, Number(value)));
    setProfile(prev => {
      const commitments = { ...prev.commitments, [key]: numericValue };
      const usedHours = Object.values(commitments).reduce((total, item) => total + (Number(item) || 0), 0);
      const freeTimeHours = Math.max(0, Math.round((24 - usedHours) * 10) / 10);
      return {
        ...prev,
        commitments,
        freeTimeHours,
        studyTimeTarget: Math.max(0, Math.min(freeTimeHours, Math.round(freeTimeHours * 0.6 * 10) / 10)),
      };
    });
  };
  const toggleArray = (key, value) => {
    setProfile(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value]
    }));
  };

  // When entering ai_plan step, generate the plan
  useEffect(() => {
    if (step === 'ai_plan' && !aiPlan) {
      generateAIPlan();
    }
  }, [step]);

  useEffect(() => {
    if (stepIndex > STEPS.length - 1) {
      setStepIndex(Math.max(0, STEPS.length - 1));
    }
  }, [STEPS.length, stepIndex]);

  const generateAIPlan = async () => {
    setIsGenerating(true);
    const launchStepIndex = STEPS.indexOf('launch');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a personalized student OS profile for:
Name: ${profile.name}
Identity: ${profile.identity}
Goals: ${profile.goals.join(', ')}
Peak study hours: ${profile.schedule.join(', ')}
Fixed commitments per day: ${Object.entries(profile.commitments).map(([key, value]) => `${key}: ${value || 0}h`).join(', ')}
Calculated free time: ${profile.freeTimeHours}h/day
Suggested study target: ${profile.studyTimeTarget}h/day
Learning style: ${profile.style}
Exam selected: ${profile.examType || 'not specified'}
Exam preparation stage: ${profile.examStage || 'not specified'}

Generate a welcome plan with:
1. A personalized greeting
2. Top 3 recommended focus areas for this week
3. A daily routine suggestion
4. 3 specific first actions they should take right now`,
        response_json_schema: {
          type: "object",
          properties: {
            greeting: { type: "string" },
            focus_areas: { type: "array", items: { type: "string" } },
            daily_routine: { type: "string" },
            first_actions: { type: "array", items: { type: "object", properties: { action: { type: "string" }, tool: { type: "string" }, why: { type: "string" } } } }
          }
        }
      });
      setAiPlan(result);
    } catch (error) {
      // Keep onboarding unblocked even if AI endpoint fails.
      setAiPlan({
        greeting: `Welcome ${profile.name || 'Explorer'}! Your SOS workspace is ready.`,
        focus_areas: [
          'Set your top 3 priorities for this week',
          'Start your first focus session',
          'Track daily progress and keep your streak alive',
        ],
        daily_routine: 'Plan your day first, then begin with one focused study sprint.',
        first_actions: [
          { action: 'Create today’s main goal', tool: 'Goals', why: 'A clear target improves focus.' },
          { action: 'Start a 25-minute focus timer', tool: 'Timer', why: 'Quick wins build momentum.' },
          { action: 'Add your next 3 tasks', tool: 'Tasks', why: 'Execution is easier with a simple queue.' },
        ],
      });
    } finally {
      setIsGenerating(false);
      // Always continue so users can launch dashboard.
      setTimeout(() => setStepIndex(launchStepIndex >= 0 ? launchStepIndex : STEPS.length - 1), 800);
    }
  };

  const handleLaunch = () => {
    // Save profile to localStorage
    localStorage.setItem('sos_onboarding_done', 'true');
    localStorage.setItem('sos_profile', JSON.stringify({ ...profile, aiPlan }));
    navigate('/');
  };

  const pageVariants = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      <ParticleField />

      {/* Glow orbs */}
      <div className="absolute top-[-20vh] left-[-10vw] w-[60vw] h-[60vh] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20vh] right-[-10vw] w-[50vw] h-[50vh] rounded-full bg-secondary/5 blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm tracking-tight">SOS</span>
          </div>
          {stepIndex > 0 && stepIndex < STEPS.length - 1 && (
            <span className="text-xs text-muted-foreground">Setup {stepIndex}/{STEPS.length - 2}</span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full">
          <AnimatePresence mode="wait">

            {/* ── INTRO ── */}
            {step === 'intro' && (
              <motion.div key="intro" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 relative"
                >
                  <Zap className="w-12 h-12 text-primary" />
                  <motion.div
                    className="absolute inset-0 rounded-3xl border border-primary/30"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl md:text-6xl font-bold tracking-tight mb-4"
                >
                  Student
                  <span className="text-primary"> Operating</span>
                  <br />System
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-muted-foreground mb-3 max-w-md mx-auto"
                >
                  An AI-first OS built for students who want to study smarter, build faster, and grow relentlessly.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex flex-wrap justify-center gap-2 mb-10 text-xs"
                >
                  {['🧠 AI-Powered', '⚡ Intent-Based', '🎯 Goal-Driven', '🚀 Adaptive'].map(tag => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">{tag}</span>
                  ))}
                </motion.div>

                <AIGuide message={AI_MESSAGES.intro} />

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
                  <Button size="lg" className="gap-2 px-8" onClick={next}>
                    Begin Setup <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ── NAME ── */}
            {step === 'name' && (
              <motion.div key="name" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.name} />
                <div className="space-y-4">
                  <Input
                    autoFocus
                    placeholder="Your name..."
                    value={profile.name}
                    onChange={e => updateProfile('name', e.target.value)}
                    className="text-2xl h-16 px-6 bg-card/50 border-border focus:border-primary text-center"
                    onKeyDown={e => e.key === 'Enter' && profile.name.trim() && next()}
                  />
                  <Button className="w-full" disabled={!profile.name.trim()} onClick={next}>
                    That's me <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── IDENTITY ── */}
            {step === 'identity' && (
              <motion.div key="identity" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.identity} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {IDENTITIES.map(id => (
                    <button
                      key={id.id}
                      onClick={() => { updateProfile('identity', id.id); setTimeout(next, 200); }}
                      className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        profile.identity === id.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card/40 hover:border-primary/30'
                      }`}
                    >
                      <id.icon className="w-5 h-5 mb-2 text-primary" />
                      <p className="text-sm font-medium">{id.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{id.desc}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── GOALS ── */}
            {step === 'goals' && (
              <motion.div key="goals" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.goals} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {GOALS.map(g => (
                    <button
                      key={g.id}
                      onClick={() => toggleArray('goals', g.id)}
                      className={`p-4 rounded-xl border bg-gradient-to-br text-left transition-all hover:scale-[1.02] relative ${g.color} ${
                        profile.goals.includes(g.id) ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      {profile.goals.includes(g.id) && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                      <g.icon className="w-5 h-5 mb-2" />
                      <p className="text-sm font-medium">{g.label}</p>
                    </button>
                  ))}
                </div>
                <Button className="w-full" disabled={profile.goals.length === 0} onClick={next}>
                  Continue ({profile.goals.length} selected) <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── EXAM TYPE (CONDITIONAL) ── */}
            {step === 'exam_type' && (
              <motion.div key="exam_type" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.exam_type} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {EXAM_TYPES.map(exam => (
                    <button
                      key={exam.id}
                      onClick={() => updateProfile('examType', exam.id)}
                      className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        profile.examType === exam.id
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border bg-card/40 hover:border-primary/30'
                      }`}
                    >
                      <p className="text-sm font-semibold">{exam.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{exam.desc}</p>
                    </button>
                  ))}
                </div>
                <Button className="w-full" disabled={!profile.examType} onClick={next}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── EXAM STAGE (CONDITIONAL) ── */}
            {step === 'exam_stage' && (
              <motion.div key="exam_stage" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.exam_stage} />
                <div className="space-y-2 mb-6">
                  {EXAM_STAGES.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => updateProfile('examStage', stage.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        profile.examStage === stage.id
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border bg-card/40 hover:border-primary/30'
                      }`}
                    >
                      <p className="text-sm font-semibold">{stage.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stage.desc}</p>
                    </button>
                  ))}
                </div>
                <Button className="w-full" disabled={!profile.examStage} onClick={next}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── SCHEDULE ── */}
            {step === 'schedule' && (
              <motion.div key="schedule" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.schedule} />
                <div className="space-y-2 mb-6">
                  {SCHEDULE_SLOTS.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => toggleArray('schedule', slot.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        profile.schedule.includes(slot.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card/40 hover:border-primary/20'
                      }`}
                    >
                      <slot.icon className={`w-5 h-5 shrink-0 ${slot.color}`} />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium">{slot.label}</p>
                        <p className="text-xs text-muted-foreground">{slot.sub}</p>
                      </div>
                      {profile.schedule.includes(slot.id) && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
                <Button className="w-full" disabled={profile.schedule.length === 0} onClick={next}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* ── TIME BUDGET ── */}
            {step === 'availability' && (
              <motion.div key="availability" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.availability} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {COMMITMENTS.map(item => (
                    <label key={item.id} className="p-3 rounded-xl border border-border bg-card/40">
                      <span className="text-xs text-muted-foreground">{item.label}{item.required ? ' *' : ''}</span>
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          inputMode="decimal"
                          value={profile.commitments[item.id]}
                          onChange={e => updateCommitment(item.id, e.target.value)}
                          placeholder={item.placeholder}
                          className="h-10"
                        />
                        <span className="text-xs text-muted-foreground">hrs/day</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 mb-6">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-3xl font-bold text-primary">{profile.freeTimeHours}</p>
                      <p className="text-xs text-muted-foreground">free hrs/day</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-chart-3">{profile.studyTimeTarget}</p>
                      <p className="text-xs text-muted-foreground">suggested study hrs</p>
                    </div>
                  </div>
                  {profile.freeTimeHours <= 0 && (
                    <p className="text-xs text-destructive text-center mt-3">
                      Your commitments exceed 24 hours. Reduce one field before continuing.
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={!profile.commitments.sleep || !profile.commitments.college || profile.freeTimeHours <= 0}
                  onClick={next}
                >
                  Continue with this schedule <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <div className="hidden">
                  {TIME_BUDGETS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { updateProfile('timebudget', t.id); setTimeout(next, 200); }}
                      className={`p-5 rounded-xl border text-center transition-all hover:scale-[1.02] ${
                        profile.timebudget === t.id
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border bg-card/40 hover:border-primary/30'
                      }`}
                    >
                      <div className="text-3xl mb-2">{t.icon}</div>
                      <p className="font-semibold text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.sub}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── STUDY STYLE ── */}
            {step === 'style' && (
              <motion.div key="style" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <StepDots steps={progressSteps} current={progressIndex} />
                <AIGuide message={AI_MESSAGES.style} />
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {STUDY_STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { updateProfile('style', s.id); setTimeout(next, 200); }}
                      className={`p-5 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        profile.style === s.id
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-border bg-card/40 hover:border-primary/30'
                      }`}
                    >
                      <div className="text-3xl mb-3">{s.emoji}</div>
                      <p className="font-semibold text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── AI PLAN GENERATION ── */}
            {step === 'ai_plan' && (
              <motion.div key="ai_plan" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full text-center">
                <AIGuide message={AI_MESSAGES.ai_plan} />
                <div className="flex flex-col items-center gap-6 py-8">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-2 border-primary/40"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                  <div className="space-y-2">
                    {['Analyzing your profile...', 'Configuring workspace...', 'Building your AI plan...', 'Almost ready...'].map((label, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.6 }}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.6 + 0.3 }}
                          className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center"
                        >
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </motion.div>
                        {label}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── LAUNCH ── */}
            {step === 'launch' && (
              <motion.div key="launch" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="w-full">
                <AIGuide message={AI_MESSAGES.launch} />

                {aiPlan && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mb-8"
                  >
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15">
                      <p className="text-sm text-foreground leading-relaxed">{aiPlan.greeting}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">Your Focus This Week</p>
                      <div className="space-y-1.5">
                        {aiPlan.focus_areas?.map((area, i) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{i + 1}</div>
                            <span className="text-sm">{area}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">Start Right Now</p>
                      <div className="space-y-2">
                        {aiPlan.first_actions?.map((action, i) => (
                          <div key={i} className="p-3 rounded-xl bg-card border border-border">
                            <div className="flex items-start gap-2">
                              <Rocket className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">{action.action}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{action.why}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                <Button
                  size="lg"
                  className="w-full gap-2 text-base py-6"
                  onClick={handleLaunch}
                >
                  <Rocket className="w-5 h-5" />
                  Launch My SOS
                </Button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
