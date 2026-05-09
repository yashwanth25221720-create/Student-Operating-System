import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, BookOpen, Briefcase, Code2, Brain, Zap } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import { base44 } from "@/api/base44Client.js";

const SUGGESTIONS = [
  { text: 'Prepare for GATE CS exam', icon: BookOpen, category: 'study' },
  { text: 'Build my resume for software internship', icon: Briefcase, category: 'career' },
  { text: 'Create a React portfolio project', icon: Code2, category: 'dev' },
  { text: 'Explain neural networks simply', icon: Brain, category: 'ai' },
  { text: 'Plan my study schedule for this week', icon: Zap, category: 'productivity' },
];

export default function CommandBar() {
  const { commandBarOpen, setCommandBarOpen, setActiveWorkspace, setActiveTool, modeConfig, addRecentAction } = useSOS();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (commandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandBarOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandBarOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setCommandBarOpen(false);
        setAiResponse(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandBarOpen]);

  const processIntent = async (text) => {
    setIsProcessing(true);
    setAiResponse(null);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are the AI brain of "SOS – Student Operating System". A student typed this intent: "${text}"

Analyze their intent and respond with a structured plan. Be concise, actionable, and encouraging.

Determine:
1. The category (study/career/dev/ai/productivity)
2. A short action plan (3-5 bullet steps)
3. Which tools to recommend from: notes, flashcards, timer, summarizer, resume_builder, job_tracker, code_playground, ai_chat, task_manager, planner
4. A motivational one-liner`,
      response_json_schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["study", "career", "dev", "ai", "productivity"] },
          summary: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          recommended_tools: { type: "array", items: { type: "string" } },
          motivation: { type: "string" }
        }
      }
    });
    setAiResponse(response);
    setActiveWorkspace(response.category);
    addRecentAction({ type: 'intent', text, category: response.category, timestamp: new Date().toISOString() });
    setIsProcessing(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    processIntent(query.trim());
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion.text);
    processIntent(suggestion.text);
  };

  const handleToolClick = (tool) => {
    setActiveTool(tool);
    setCommandBarOpen(false);
    setAiResponse(null);
    setQuery('');
  };

  if (!commandBarOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
        onClick={() => { setCommandBarOpen(false); setAiResponse(null); setQuery(''); }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-2xl mx-4 rounded-2xl border border-border overflow-hidden ${modeConfig.glass ? 'glass-strong' : 'bg-card'} ${modeConfig.glow ? 'glow-primary' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4 border-b border-border">
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="What do you want to achieve today?"
              className="flex-1 bg-transparent text-foreground text-lg placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">⌘K</kbd>
            </div>
          </form>

          {/* AI Response */}
          {aiResponse && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 border-b border-border"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-foreground">{aiResponse.summary}</p>
                  <div className="space-y-1.5">
                    {aiResponse.steps?.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">{i+1}</span>
                        <span className="text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                  {aiResponse.recommended_tools?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {aiResponse.recommended_tools.map(tool => (
                        <button
                          key={tool}
                          onClick={() => handleToolClick(tool)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          {tool.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-primary/70 italic pt-1">{aiResponse.motivation}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Suggestions */}
          {!aiResponse && !isProcessing && (
            <div className="p-3">
              <p className="text-xs text-muted-foreground px-2 pb-2 uppercase tracking-wider">Try saying...</p>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <s.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm text-foreground">{s.text}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
