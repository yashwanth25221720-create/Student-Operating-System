import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Coffee, Brain } from 'lucide-react';
import { Button } from "@/components/ui/button.jsx";
import { base44 } from "@/api/base44Client.js";
import { useSOS } from '@/lib/SOSContext.jsx';

const PRESETS = [
  { label: '25 min', minutes: 25, type: 'focus', icon: Brain },
  { label: '50 min', minutes: 50, type: 'deep_focus', icon: Brain },
  { label: '5 min', minutes: 5, type: 'break', icon: Coffee },
  { label: '15 min', minutes: 15, type: 'break', icon: Coffee },
];

export default function TimerTool() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionType, setSessionType] = useState('focus');
  const [sessions, setSessions] = useState(0);
  const { addXp, modeConfig } = useSOS();
  const intervalRef = useRef(/** @type {number | null} */ (null));

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds(s => s - 1), 1000);
    } else if (seconds === 0 && isRunning) {
      setIsRunning(false);
      if (sessionType !== 'break') {
        setSessions(s => s + 1);
        addXp(20);
        base44.entities.StudySession.create({
          subject: 'Focus Session',
          duration_minutes: totalSeconds / 60,
          type: sessionType === 'deep_focus' ? 'deep_focus' : 'pomodoro',
          xp_earned: 20,
        });
      }
    }
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, seconds, sessionType, totalSeconds, addXp]);

  const setPreset = /** @param {typeof PRESETS[number]} preset */ (preset) => {
    setIsRunning(false);
    setSeconds(preset.minutes * 60);
    setTotalSeconds(preset.minutes * 60);
    setSessionType(preset.type);
  };

  const progress = totalSeconds > 0 ? ((totalSeconds - seconds) / totalSeconds) * 100 : 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 mb-8">
        <Timer className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">Focus Timer</h2>
      </div>

      {/* Timer Circle */}
      <div className="relative w-56 h-56 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="100" cy="100" r="90" fill="none"
            stroke={sessionType === 'break' ? 'hsl(var(--chart-3))' : 'hsl(var(--primary))'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold font-mono tabular-nums">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            {sessionType === 'break' ? 'Break' : 'Focus'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="outline" size="icon" onClick={() => setPreset(PRESETS[0])}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          size="lg"
          className={`w-14 h-14 rounded-full ${isRunning ? 'bg-destructive hover:bg-destructive/80' : ''}`}
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>
        <div className="w-10" />
      </div>

      {/* Presets */}
      <div className="flex gap-2 mb-6">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPreset(p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              totalSeconds === p.minutes * 60 && sessionType === p.type
                ? 'bg-primary/15 text-primary'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            <p.icon className="w-3 h-3" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Session Count */}
      <div className="text-center">
        <span className="text-xs text-muted-foreground">Sessions today: </span>
        <span className="text-xs font-bold text-primary">{sessions}</span>
      </div>
    </div>
  );
}
