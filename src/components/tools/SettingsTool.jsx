import React from 'react';
import { Settings, Monitor, Moon, Zap, BookOpen, Eye, LogOut, Palette, Sparkles, Box, Check } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import { base44 } from "@/api/base44Client.js";
import { Button } from "@/components/ui/button.jsx";

const MODES = [
  { id: 'lite', label: 'Lite', desc: 'Minimal, fast', icon: Zap },
  { id: 'balanced', label: 'Balanced', desc: 'Moderate effects', icon: Monitor },
  { id: 'pro', label: 'Pro', desc: 'Full experience', icon: Moon },
  { id: 'reading', label: 'Reading', desc: 'Warm, easy on eyes', icon: BookOpen },
  { id: 'ultra_reading', label: 'Ultra Reading', desc: 'Grayscale focus', icon: Eye },
];

export default function SettingsTool() {
  const {
    uiMode, setUiMode, xp, level, streak,
    colorTheme, setColorTheme,
    activeEffect, setActiveEffect,
    bg3d, setBg3d,
    COLOR_THEMES, UI_EFFECTS, BG_3D,
  } = useSOS();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h2 className="font-semibold">Settings & Themes</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-7 pb-24">

        {/* ── COLOR THEMES ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Color Themes</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(COLOR_THEMES).map(([id, theme]) => {
              const isActive = colorTheme === id;
              // Show a mini preview swatch from the vars
              const primaryH = theme.vars['--primary'].split(' ')[0];
              const secondaryH = theme.vars['--secondary'].split(' ')[0];
              return (
                <button
                  key={id}
                  onClick={() => setColorTheme(id)}
                  className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] relative ${
                    isActive ? 'border-primary bg-primary/8 ring-1 ring-primary/40' : 'border-border hover:border-primary/30 bg-muted/10'
                  }`}
                >
                  {isActive && <Check className="absolute top-2 right-2 w-3 h-3 text-primary" />}
                  {/* Mini color preview */}
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: `hsl(${theme.vars['--primary']})` }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: `hsl(${theme.vars['--secondary']})` }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: `hsl(${theme.vars['--background']})` }}
                    />
                  </div>
                  <p className="text-xs font-medium leading-none">{theme.emoji} {theme.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 3D BACKGROUND ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Box className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">3D Background</h3>
          </div>
          <div className="space-y-1.5">
            {Object.entries(BG_3D).map(([id, cfg]) => (
              <button
                key={id}
                onClick={() => setBg3d(id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                  bg3d === id ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/20 hover:bg-muted/20'
                }`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">{cfg.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cfg.desc}</p>
                </div>
                {bg3d === id && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
          {bg3d !== 'none' && (
            <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
              ⚠️ 3D effects use GPU. Disable if performance is slow.
            </p>
          )}
        </section>

        {/* ── UI EFFECTS ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">UI Effects</h3>
          </div>
          <div className="space-y-1.5">
            {Object.entries(UI_EFFECTS).map(([id, cfg]) => (
              <button
                key={id}
                onClick={() => setActiveEffect(id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                  activeEffect === id ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/20 hover:bg-muted/20'
                }`}
              >
                <div className="text-left">
                  <p className="text-sm font-medium">{cfg.label}</p>
                  <p className="text-[11px] text-muted-foreground">{cfg.desc}</p>
                </div>
                {activeEffect === id && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
        </section>

        {/* ── UI MODE ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Performance Mode</h3>
          </div>
          <div className="space-y-1.5">
            {MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setUiMode(mode.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  uiMode === mode.id
                    ? 'border-primary bg-primary/8'
                    : 'border-border hover:border-primary/20 hover:bg-muted/20'
                }`}
              >
                <mode.icon className={`w-4 h-4 ${uiMode === mode.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="text-xs text-muted-foreground">{mode.desc}</p>
                </div>
                {uiMode === mode.id && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </section>

        {/* ── STATS ── */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Your Stats</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-primary">{xp}</p>
              <p className="text-[10px] text-muted-foreground">Total XP</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-chart-4">{level}</p>
              <p className="text-[10px] text-muted-foreground">Level</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-chart-5">{streak}</p>
              <p className="text-[10px] text-muted-foreground">Streak</p>
            </div>
          </div>
        </section>

        {/* ── ACCOUNT ── */}
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Account</h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                localStorage.removeItem('sos_onboarding_done');
                localStorage.removeItem('sos_profile');
                window.location.href = '/onboarding';
              }}
            >
              <Zap className="w-4 h-4 mr-2" /> Redo Onboarding
            </Button>
            <Button variant="outline" className="w-full" onClick={() => base44.auth.logout()}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
