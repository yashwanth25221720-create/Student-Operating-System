import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const UI_MODES = {
  lite: { label: 'Lite', animations: false, glass: false, glow: false },
  balanced: { label: 'Balanced', animations: true, glass: false, glow: false },
  pro: { label: 'Pro', animations: true, glass: true, glow: true },
  reading: { label: 'Reading', animations: false, glass: false, glow: false },
  ultra_reading: { label: 'Ultra Reading', animations: false, glass: false, glow: false },
};

// Color themes — each sets CSS variables on :root
export const COLOR_THEMES = {
  cyber: {
    label: 'Cyber (Default)',
    emoji: '💙',
    vars: {
      '--primary': '187 92% 48%',
      '--secondary': '263 70% 58%',
      '--background': '222 47% 6%',
      '--card': '222 47% 9%',
      '--muted': '222 30% 14%',
    },
  },
  aurora: {
    label: 'Aurora',
    emoji: '🌌',
    vars: {
      '--primary': '160 84% 50%',
      '--secondary': '280 70% 60%',
      '--background': '220 40% 5%',
      '--card': '220 40% 8%',
      '--muted': '220 25% 13%',
    },
  },
  crimson: {
    label: 'Crimson',
    emoji: '🔴',
    vars: {
      '--primary': '0 90% 60%',
      '--secondary': '340 80% 55%',
      '--background': '220 30% 5%',
      '--card': '220 30% 8%',
      '--muted': '220 20% 12%',
    },
  },
  gold: {
    label: 'Gold Rush',
    emoji: '🌟',
    vars: {
      '--primary': '42 95% 55%',
      '--secondary': '25 85% 55%',
      '--background': '222 40% 5%',
      '--card': '222 40% 8%',
      '--muted': '222 25% 13%',
    },
  },
  matrix: {
    label: 'Matrix',
    emoji: '💚',
    vars: {
      '--primary': '120 100% 45%',
      '--secondary': '150 80% 40%',
      '--background': '120 20% 4%',
      '--card': '120 20% 7%',
      '--muted': '120 15% 12%',
    },
  },
  ocean: {
    label: 'Deep Ocean',
    emoji: '🌊',
    vars: {
      '--primary': '200 100% 60%',
      '--secondary': '230 80% 65%',
      '--background': '215 50% 5%',
      '--card': '215 50% 8%',
      '--muted': '215 30% 13%',
    },
  },
  sakura: {
    label: 'Sakura',
    emoji: '🌸',
    vars: {
      '--primary': '330 85% 68%',
      '--secondary': '300 60% 65%',
      '--background': '320 25% 6%',
      '--card': '320 25% 9%',
      '--muted': '320 15% 14%',
    },
  },
  solar: {
    label: 'Solar Flare',
    emoji: '☀️',
    vars: {
      '--primary': '30 100% 58%',
      '--secondary': '50 95% 55%',
      '--background': '220 35% 5%',
      '--card': '220 35% 8%',
      '--muted': '220 20% 13%',
    },
  },
};

export const UI_EFFECTS = {
  none: { label: 'None', desc: 'Clean, no effects' },
  aurora: { label: 'Aurora Glow', desc: 'Soft animated orbs' },
  scanlines: { label: 'CRT Scanlines', desc: 'Retro monitor feel' },
  neon_cursor: { label: 'Neon Cursor', desc: 'Glowing cursor trail' },
  orbs: { label: 'Floating Orbs', desc: 'Ambient depth spheres' },
};

export const BG_3D = {
  none: { label: 'None', desc: 'Solid background' },
  particles: { label: 'Particle Field', desc: 'Floating 3D particles' },
  dna: { label: 'DNA Helix', desc: 'Rotating DNA strand' },
  grid: { label: 'Neon Grid', desc: 'Cyberpunk wireframe' },
  nebula: { label: 'Nebula Cloud', desc: 'Space particle cloud' },
};

const WORKSPACES = ['study', 'career', 'dev', 'ai', 'productivity'];

/**
 * @typedef {keyof typeof COLOR_THEMES} ThemeKey
 * @typedef {keyof typeof UI_MODES} UIModeKey
 * @typedef {keyof typeof UI_EFFECTS} UIEffectKey
 * @typedef {keyof typeof BG_3D} BG3DKey
 * @typedef {typeof WORKSPACES[number]} WorkspaceKey
 * @typedef {{
 *   uiMode: UIModeKey;
 *   setUiMode: React.Dispatch<React.SetStateAction<UIModeKey>>;
 *   modeConfig: {
 *     animations: boolean;
 *     glass: boolean;
 *     glow: boolean;
 *   };
 *   modeClass: string;
 *   colorTheme: ThemeKey;
 *   setColorTheme: React.Dispatch<React.SetStateAction<ThemeKey>>;
 *   activeEffect: UIEffectKey;
 *   setActiveEffect: React.Dispatch<React.SetStateAction<UIEffectKey>>;
 *   bg3d: BG3DKey;
 *   setBg3d: React.Dispatch<React.SetStateAction<BG3DKey>>;
 *   activeWorkspace: WorkspaceKey;
 *   setActiveWorkspace: React.Dispatch<React.SetStateAction<WorkspaceKey>>;
 *   commandBarOpen: boolean;
 *   setCommandBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
 *   activeTool: any;
 *   setActiveTool: React.Dispatch<React.SetStateAction<any>>;
 *   xp: number;
 *   level: number;
 *   streak: number;
 *   addXp: (amount: number) => void;
 *   recentActions: any[];
 *   addRecentAction: (action: any) => void;
 *   UI_MODES: typeof UI_MODES;
 *   WORKSPACES: readonly string[];
 *   COLOR_THEMES: typeof COLOR_THEMES;
 *   UI_EFFECTS: typeof UI_EFFECTS;
 *   BG_3D: typeof BG_3D;
 *   profile: any;
 * }} SOSContextType
 */
const SOSContext = createContext(/** @type {SOSContextType | null} */ (null));

/**
 * @param {{ children: React.ReactNode }} props
 */
export function SOSProvider({ children }) {
  const [uiMode, setUiMode] = useState(/** @type {keyof typeof UI_MODES} */ ('pro'));
  const [colorTheme, setColorTheme] = useState(
    /** @type {keyof typeof COLOR_THEMES} */ (localStorage.getItem('sos_theme') || 'cyber')
  );
  const [activeEffect, setActiveEffect] = useState(
    /** @type {keyof typeof UI_EFFECTS} */ (localStorage.getItem('sos_effect') || 'aurora')
  );
  const [bg3d, setBg3d] = useState(
    /** @type {keyof typeof BG_3D} */ (localStorage.getItem('sos_bg3d') || 'none')
  );
  const [activeWorkspace, setActiveWorkspace] = useState(
    /** @type {typeof WORKSPACES[number]} */ ('study')
  );
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [xp, setXp] = useState(() => parseInt(localStorage.getItem('sos_xp') || '1250'));
  const [level, setLevel] = useState(() => parseInt(localStorage.getItem('sos_level') || '5'));
  const [streak, setStreak] = useState(7);
  const [recentActions, setRecentActions] = useState(/** @type {any[]} */ ([]));

  // Load saved profile from onboarding
  const savedProfile = (() => {
    try { return JSON.parse(localStorage.getItem('sos_profile') || '{}'); } catch { return {}; }
  })();
  const [profile] = useState(savedProfile);

  // Apply color theme CSS vars
  useEffect(() => {
    const theme = COLOR_THEMES[colorTheme] || COLOR_THEMES.cyber;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('sos_theme', colorTheme);
  }, [colorTheme]);

  useEffect(() => { localStorage.setItem('sos_effect', activeEffect); }, [activeEffect]);
  useEffect(() => { localStorage.setItem('sos_bg3d', bg3d); }, [bg3d]);

  const addXp = useCallback(/** @type {(amount: number) => void} */ ((amount) => {
    setXp(prev => {
      const newXp = prev + amount;
      const newLevel = Math.floor(newXp / 500) + 1;
      setLevel(newLevel);
      localStorage.setItem('sos_xp', String(newXp));
      localStorage.setItem('sos_level', String(newLevel));
      return newXp;
    });
  }), []);

  const addRecentAction = useCallback(/** @type {(action: any) => void} */ ((action) => {
    setRecentActions(prev => [action, ...prev].slice(0, 10));
  }), []);

  const modeConfig = UI_MODES[uiMode];
  const modeClass = uiMode === 'reading' ? 'reading-mode' :
                    uiMode === 'ultra_reading' ? 'ultra-reading-mode' :
                    uiMode === 'lite' ? 'lite-mode' : '';

  return (
    <SOSContext.Provider value={{
      uiMode, setUiMode, modeConfig, modeClass,
      colorTheme, setColorTheme,
      activeEffect, setActiveEffect,
      bg3d, setBg3d,
      activeWorkspace, setActiveWorkspace,
      commandBarOpen, setCommandBarOpen,
      activeTool, setActiveTool,
      xp, level, streak, addXp,
      recentActions, addRecentAction,
      UI_MODES, WORKSPACES,
      COLOR_THEMES, UI_EFFECTS, BG_3D,
      profile,
    }}>
      {children}
    </SOSContext.Provider>
  );
}

export function useSOS() {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error('useSOS must be used within SOSProvider');
  return ctx;
}
