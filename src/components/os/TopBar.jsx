import React, { useEffect, useState } from 'react';
import { Search, Flame, Star, Zap, Settings, ChevronDown, LogOut, RotateCcw } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';
import { base44 } from "@/api/base44Client.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";

const WORKSPACE_LABELS = {
  study: '📚 Study',
  career: '💼 Career',
  dev: '💻 Dev',
  ai: '🤖 AI Lab',
  productivity: '⚡ Productivity',
};

export default function TopBar() {
  const { setCommandBarOpen, xp, level, streak, activeWorkspace, setActiveWorkspace, WORKSPACES, modeConfig, profile, setActiveTool } = useSOS();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <header className={`h-14 border-b border-border flex items-center justify-between px-4 ${modeConfig.glass ? 'glass' : 'bg-card/50'}`}>
      {/* Left: Logo + Workspace */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight">SOS</span>
        </div>
        
        <div className="h-6 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>{WORKSPACE_LABELS[activeWorkspace]}</span>
            <ChevronDown className="w-3 h-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {WORKSPACES.map(ws => (
              <DropdownMenuItem key={ws} onClick={() => setActiveWorkspace(ws)}>
                {WORKSPACE_LABELS[ws]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: Command Trigger */}
      <button
        onClick={() => setCommandBarOpen(true)}
        className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-muted/50 border border-border hover:border-primary/30 hover:bg-muted transition-all text-sm text-muted-foreground w-80 max-w-[40vw]"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Ask SOS anything...</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border">⌘K</kbd>
      </button>

      {/* Right: Stats + User */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Flame className="w-3.5 h-3.5 text-chart-5" />
            <span className="font-medium">{streak}d</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Star className="w-3.5 h-3.5 text-warning" />
            <span className="font-medium">{xp} XP</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            Lv.{level}
          </div>
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                {user?.full_name?.[0]?.toUpperCase() || profile?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate">
                {user?.full_name || profile?.name || 'Student'}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold truncate">{user?.full_name || profile?.name || 'Student'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
            <DropdownMenuItem onClick={() => setActiveTool('settings')}>
              <Settings className="w-4 h-4 mr-2" /> Settings & Themes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              localStorage.removeItem('sos_onboarding_done');
              localStorage.removeItem('sos_profile');
              window.location.href = '/onboarding';
            }}>
              <RotateCcw className="w-4 h-4 mr-2" /> Redo Onboarding
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => base44.auth.logout()}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
