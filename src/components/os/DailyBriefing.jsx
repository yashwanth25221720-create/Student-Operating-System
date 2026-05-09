import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, CheckCircle2, Sparkles } from 'lucide-react';
import { base44 } from "@/api/base44Client.js";
import { useSOS } from '@/lib/SOSContext.jsx';

export default function DailyBriefing() {
  const { profile, streak } = useSOS();
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cacheKey = `sos_briefing_${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setBriefing(JSON.parse(cached));
      setLoading(false);
      return;
    }

    base44.integrations.Core.InvokeLLM({
      prompt: `Generate a short daily briefing for a student named ${profile?.name || 'Explorer'} with goals: ${profile?.goals?.join(', ') || 'general study'}. Today's date: ${new Date().toDateString()}. Streak: ${streak} days.
      
Keep it motivating, practical, and short. Max 3 focus items.`,
      response_json_schema: {
        type: 'object',
        properties: {
          greeting: { type: 'string' },
          focus_items: { type: 'array', items: { type: 'string' } },
          tip: { type: 'string' },
        },
      },
    }).then(result => {
      setBriefing(result);
      localStorage.setItem(cacheKey, JSON.stringify(result));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="mb-8 p-4 rounded-2xl border border-border bg-card/40 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-4 rounded-2xl border border-primary/20 bg-primary/5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sun className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold">Daily Briefing</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
      </div>

      {briefing.greeting && (
        <p className="text-sm text-muted-foreground mb-3">{briefing.greeting}</p>
      )}

      {briefing.focus_items?.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {briefing.focus_items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {briefing.tip && (
        <div className="flex items-start gap-2 pt-2 border-t border-border/50">
          <Sparkles className="w-3.5 h-3.5 text-chart-4 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground italic">{briefing.tip}</p>
        </div>
      )}
    </motion.div>
  );
}
