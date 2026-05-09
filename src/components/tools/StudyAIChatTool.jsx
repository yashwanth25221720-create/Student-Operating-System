import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Loader2, Trash2, BookOpen, Target, TrendingUp, Lightbulb } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import { useSOS } from '@/lib/SOSContext';

const QUICK_PROMPTS = [
  { icon: BookOpen,   label: 'Summarize my notes',     prompt: 'Summarize all my recent notes and highlight key topics I should review.' },
  { icon: TrendingUp, label: 'Study plan',              prompt: 'Based on my notes and goals, create a personalized study plan for this week.' },
  { icon: Target,     label: 'Quiz me',                 prompt: 'Generate 5 quiz questions based on my recent notes to test my understanding.' },
  { icon: Lightbulb,  label: 'Knowledge gaps',         prompt: 'Analyze my notes and identify topics where I might have gaps in understanding.' },
];

export default function StudyAIChatTool() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your **Study AI** — I have access to your notes, goals, and progress. Ask me to summarize your notes, build a study plan, quiz you, or find knowledge gaps. What do you need?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { addXp } = useSOS();

  const { data: notes = [] } = useQuery({
    queryKey: ['notes-ai'],
    queryFn: () => base44.entities.Note.list('-updated_date', 20),
    initialData: [],
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals-ai'],
    queryFn: () => base44.entities.Goal.filter({ status: 'active' }, '-created_date', 10),
    initialData: [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions-ai'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 10),
    initialData: [],
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-ai'],
    queryFn: () => base44.entities.Task.filter({ status: 'todo' }, '-created_date', 15),
    initialData: [],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const notesCtx = notes.slice(0, 8).map(n =>
      `Note: "${n.title}" (${n.subject || 'no subject'}) — ${(n.content || '').slice(0, 300)}`
    ).join('\n');

    const goalsCtx = goals.map(g =>
      `Goal: "${g.title}" [${g.category}] — ${g.progress || 0}% complete`
    ).join('\n');

    const sessionsCtx = sessions.slice(0, 5).map(s =>
      `Session: ${s.subject}, ${s.duration_minutes}min (${s.type})`
    ).join('\n');

    const tasksCtx = tasks.slice(0, 8).map(t =>
      `Task: "${t.title}" [${t.priority}] — ${t.status}`
    ).join('\n');

    return { notesCtx, goalsCtx, sessionsCtx, tasksCtx };
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);

    const { notesCtx, goalsCtx, sessionsCtx, tasksCtx } = buildContext();
    const histCtx = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a smart Study AI assistant embedded in a student OS. You have access to the student's actual data below.

=== STUDENT'S NOTES ===
${notesCtx || 'No notes yet.'}

=== ACTIVE GOALS ===
${goalsCtx || 'No active goals.'}

=== RECENT STUDY SESSIONS ===
${sessionsCtx || 'No sessions yet.'}

=== PENDING TASKS ===
${tasksCtx || 'No tasks.'}

=== CONVERSATION HISTORY ===
${histCtx}

=== STUDENT QUESTION ===
${msg}

Respond in a helpful, concise, structured way. Use markdown. Be specific and reference their actual notes/goals when relevant. If building a study plan, structure it by day. If quizzing, number the questions clearly.`,
    });

    setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    setIsLoading(false);
    addXp(5);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold text-sm">Study AI Chat</h2>
            <p className="text-[10px] text-muted-foreground">Knows your notes, goals & progress</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Context indicators */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
            <BookOpen className="w-3 h-3" />
            <span>{notes.length} notes</span>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setMessages([messages[0]])}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="p-3 border-b border-border flex gap-1.5 overflow-x-auto scrollbar-none">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => sendMessage(p.prompt)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full bg-primary/8 text-primary hover:bg-primary/15 border border-primary/20 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <p.icon className="w-3 h-3" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-2">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted/50 border border-border rounded-bl-sm'
              }`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_ul]:text-sm [&_ol]:text-sm">
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 shrink-0">
              <Brain className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,150,300].map(d => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
        className="p-4 border-t border-border"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your notes, request a study plan..."
            className="flex-1 bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}