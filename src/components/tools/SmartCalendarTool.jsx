import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckSquare, BookOpen, Target, Zap } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths, parseISO } from 'date-fns';

const CATEGORY_COLORS = {
  study:       { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   dot: 'bg-cyan-400' },
  career:      { bg: 'bg-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-400' },
  dev:         { bg: 'bg-emerald-500/20',text: 'text-emerald-400',dot: 'bg-emerald-400' },
  ai:          { bg: 'bg-amber-500/20',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  productivity:{ bg: 'bg-rose-500/20',   text: 'text-rose-400',   dot: 'bg-rose-400' },
};

const TYPE_ICON = { task: CheckSquare, session: Clock, goal: Target, note: BookOpen };

export default function SmartCalendarTool() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks-cal'],
    queryFn: () => base44.entities.Task.list('-due_date', 100),
    initialData: [],
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions-cal'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 50),
    initialData: [],
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals-cal'],
    queryFn: () => base44.entities.Goal.filter({ status: 'active' }, '-target_date', 20),
    initialData: [],
  });

  // Build a map of date → events
  const eventMap = useMemo(() => {
    const map = {};
    const add = (dateStr, item) => {
      if (!dateStr) return;
      const key = dateStr.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    };

    tasks.forEach(t => add(t.due_date, { ...t, _type: 'task' }));
    sessions.forEach(s => add((s.created_date || '').slice(0, 10), { ...s, _type: 'session' }));
    goals.forEach(g => add(g.target_date, { ...g, _type: 'goal' }));

    return map;
  }, [tasks, sessions, goals]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Pad start
  const startPad = startOfMonth(currentMonth).getDay();
  const selectedKey = format(selectedDay, 'yyyy-MM-dd');
  const selectedEvents = eventMap[selectedKey] || [];

  const getEventsForDay = (day) => eventMap[format(day, 'yyyy-MM-dd')] || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Calendar className="w-5 h-5 text-chart-4" />
        <h2 className="font-semibold">Smart Calendar</h2>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-2 min-w-[110px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Calendar grid */}
        <div className="p-3">
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map(day => {
              const events = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDay);
              const isCurrentDay = isToday(day);
              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDay(day)}
                  className={`relative aspect-square flex flex-col items-center justify-start pt-1 rounded-lg text-xs transition-all hover:bg-muted/50 ${
                    isSelected ? 'bg-primary/15 ring-1 ring-primary' :
                    isCurrentDay ? 'bg-primary/8' : ''
                  }`}
                >
                  <span className={`font-medium leading-none ${
                    isCurrentDay ? 'text-primary' :
                    !isSameMonth(day, currentMonth) ? 'text-muted-foreground/40' : ''
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {events.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center px-0.5">
                      {events.slice(0, 3).map((e, i) => {
                        const cat = CATEGORY_COLORS[e.category] || CATEGORY_COLORS.study;
                        return <div key={i} className={`w-1 h-1 rounded-full ${cat.dot}`} />;
                      })}
                      {events.length > 3 && <div className="w-1 h-1 rounded-full bg-muted-foreground" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="px-3 pb-2 flex flex-wrap gap-2">
          {Object.entries(CATEGORY_COLORS).map(([cat, c]) => (
            <div key={cat} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              {cat}
            </div>
          ))}
        </div>

        {/* Selected day events */}
        <div className="px-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {isToday(selectedDay) ? "Today" : format(selectedDay, 'EEE, MMM d')}
            </h3>
            <span className="text-[10px] text-muted-foreground">{selectedEvents.length} items</span>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nothing scheduled</p>
              <p className="text-[11px] mt-1">Add tasks or study sessions with a due date to see them here</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map((event, i) => {
                const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.study;
                const Icon = TYPE_ICON[event._type] || Zap;
                const label = event._type === 'session'
                  ? `${event.subject} — ${event.duration_minutes}min session`
                  : event._type === 'goal'
                  ? `🎯 Goal deadline: ${event.title}`
                  : event.title;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${cat.bg} border-transparent`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${cat.text}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{label}</p>
                      {event.priority && (
                        <p className={`text-[10px] ${cat.text} capitalize`}>{event.priority} priority · {event._type}</p>
                      )}
                      {event.duration_minutes && event._type === 'session' && (
                        <p className={`text-[10px] ${cat.text}`}>{event.type} · {event.xp_earned || 0} XP earned</p>
                      )}
                    </div>
                    {event.status === 'done' && (
                      <span className="text-[10px] text-success font-medium shrink-0">✓ Done</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming workload summary */}
        <UpcomingWorkload tasks={tasks} />
      </div>
    </div>
  );
}

function UpcomingWorkload({ tasks }) {
  const upcoming = useMemo(() => {
    const today = new Date();
    const in7 = new Date(); in7.setDate(today.getDate() + 7);
    return tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const d = parseISO(t.due_date);
      return d >= today && d <= in7;
    }).sort((a, b) => parseISO(a.due_date) - parseISO(b.due_date));
  }, [tasks]);

  if (upcoming.length === 0) return null;

  return (
    <div className="px-3 pb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Next 7 Days ({upcoming.length} tasks)
      </h3>
      <div className="space-y-1">
        {upcoming.map((t, i) => {
          const daysLeft = Math.ceil((parseISO(t.due_date) - new Date()) / 86400000);
          const urgency = daysLeft <= 1 ? 'text-destructive' : daysLeft <= 3 ? 'text-warning' : 'text-muted-foreground';
          return (
            <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${daysLeft <= 1 ? 'bg-destructive' : daysLeft <= 3 ? 'bg-warning' : 'bg-muted-foreground'}`} />
              <span className="text-xs flex-1 truncate">{t.title}</span>
              <span className={`text-[10px] font-mono shrink-0 ${urgency}`}>
                {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}