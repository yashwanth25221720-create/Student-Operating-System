import React, { useState } from 'react';
import { Calendar, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSOS } from '@/lib/SOSContext';
import { addDays, startOfWeek } from 'date-fns';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

export default function PlannerTool() {
  const [plan, setPlan] = useState(null);
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { addXp } = useSOS();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const generatePlan = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a weekly study plan for: "${topic}". 
For each day (Monday-Sunday), suggest 2-3 study blocks with specific times, subjects, and duration.
Make it balanced with breaks and varied activities.`,
      response_json_schema: {
        type: "object",
        properties: {
          plan: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string" },
                blocks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      time: { type: "string" },
                      activity: { type: "string" },
                      duration: { type: "string" },
                      type: { type: "string", enum: ["study", "practice", "review", "break"] }
                    }
                  }
                }
              }
            }
          },
          tips: { type: "array", items: { type: "string" } }
        }
      }
    });
    setPlan(result);
    setIsGenerating(false);
    addXp(15);
  };

  const typeColors = {
    study: 'bg-chart-1/10 border-chart-1/30 text-chart-1',
    practice: 'bg-chart-2/10 border-chart-2/30 text-chart-2',
    review: 'bg-chart-4/10 border-chart-4/30 text-chart-4',
    break: 'bg-chart-3/10 border-chart-3/30 text-chart-3',
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-chart-4" />
          <h2 className="font-semibold">Smart Planner</h2>
        </div>
      </div>

      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="What are you preparing for? (e.g., Final exams, GATE CS)"
            className="flex-1"
          />
          <Button onClick={generatePlan} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {!plan ? (
          <div className="text-center py-12">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Enter a topic and let AI create your weekly plan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {plan.plan?.map((day, i) => (
              <div key={i} className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">{day.day}</h3>
                <div className="space-y-1.5">
                  {day.blocks?.map((block, j) => (
                    <div
                      key={j}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${typeColors[block.type] || 'bg-muted/20 border-border'}`}
                    >
                      <span className="text-xs font-mono whitespace-nowrap">{block.time}</span>
                      <span className="text-xs flex-1">{block.activity}</span>
                      <span className="text-[10px] opacity-70">{block.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {plan.tips?.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <h3 className="text-xs font-semibold text-primary mb-2">💡 Tips</h3>
                <ul className="space-y-1">
                  {plan.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}