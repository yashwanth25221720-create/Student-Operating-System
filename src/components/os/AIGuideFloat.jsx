import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, X, Send, Minimize2, Maximize2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSOS } from '@/lib/SOSContext';
import ReactMarkdown from 'react-markdown';

const CONTEXTUAL_PROMPTS = {
  study: [
    "Generate a study plan for today",
    "Quiz me on my last topic",
    "Summarize a concept I'm stuck on",
    "Find gaps in my knowledge",
  ],
  career: [
    "Review my resume bullet points",
    "Prep me for a behavioral interview",
    "What skills should I add?",
    "Find internships matching my profile",
  ],
  dev: [
    "Debug my code logic",
    "Suggest a project idea",
    "Explain this algorithm simply",
    "Code review checklist",
  ],
  ai: [
    "What's new in AI this week?",
    "Explain transformer architecture",
    "Suggest an AI project to build",
    "Help me fine-tune a prompt",
  ],
  productivity: [
    "Plan my day optimally",
    "Help me beat procrastination",
    "Set up a Pomodoro session",
    "Review my goals progress",
  ],
};

export default function AIGuideFloat() {
  const { activeWorkspace, modeConfig, profile } = useSOS();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [pulseHint, setPulseHint] = useState(true);
  const messagesEndRef = useRef(null);

  // Build greeting from saved profile
  useEffect(() => {
    const saved = localStorage.getItem('sos_profile');
    const p = saved ? JSON.parse(saved) : null;
    const name = p?.name || 'Explorer';
    const firstGoal = p?.goals?.[0] || 'your studies';

    const greeting = `Hey ${name}! 👋 I'm your SOS Guide — always here in the corner.\n\nI see you're focused on **${activeWorkspace}** today. Based on your profile, I suggest we tackle **${firstGoal.replace('_', ' ')}** next. Want me to build a quick plan?`;
    setMessages([{ role: 'assistant', content: greeting }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Stop pulsing after 6s
  useEffect(() => {
    const t = setTimeout(() => setPulseHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);

    const saved = localStorage.getItem('sos_profile');
    const p = saved ? JSON.parse(saved) : {};
    const ctx = messages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are SOS Guide — a concise, motivating AI coach embedded in a student OS. 
Student profile: ${JSON.stringify({ name: p.name, goals: p.goals, style: p.style, timebudget: p.timebudget })}
Active workspace: ${activeWorkspace}
Recent conversation: ${ctx}

Student: ${msg}

Reply helpfully, concisely (max 3 paragraphs). Use markdown. Be specific and actionable.`,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    setIsLoading(false);
  };

  const prompts = CONTEXTUAL_PROMPTS[activeWorkspace] || CONTEXTUAL_PROMPTS.study;

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Brain className="w-5 h-5 text-primary-foreground" />
            {pulseHint && (
              <motion.span
                className="absolute inset-0 rounded-2xl border-2 border-primary"
                animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            {pulseHint && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute right-14 bg-card border border-border rounded-xl px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
              >
                Your AI Guide is ready ✨
              </motion.div>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            className={`fixed bottom-24 right-4 z-50 w-[340px] rounded-2xl border border-border shadow-2xl overflow-hidden ${
              modeConfig.glass ? 'glass-strong' : 'bg-card'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-chart-3 border-2 border-card" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">SOS Guide</p>
                <p className="text-[10px] text-muted-foreground">Always here for you</p>
              </div>
              <button onClick={() => setIsMinimized(!isMinimized)} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                >
                  {/* Messages */}
                  <div className="h-[280px] overflow-y-auto p-4 space-y-3">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted/50 border border-border rounded-bl-sm'
                        }`}>
                          {msg.role === 'user' ? (
                            <p>{msg.content}</p>
                          ) : (
                            <ReactMarkdown className="prose prose-sm prose-invert max-w-none text-xs [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              {msg.content}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted/50 border border-border rounded-2xl px-3 py-2">
                          <div className="flex gap-1">
                            {[0, 150, 300].map(d => (
                              <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick prompts */}
                  <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                    {prompts.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="shrink-0 text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors whitespace-nowrap"
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="p-3 border-t border-border flex gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder="Ask your guide..."
                      className="flex-1 text-xs bg-muted/30 border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading}
                      className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 hover:bg-primary/80 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5 text-primary-foreground" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}