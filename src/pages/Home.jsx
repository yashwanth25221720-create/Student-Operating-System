import React, { Suspense, lazy } from 'react';
import TopBar from '@/components/os/TopBar';
import Dock from '@/components/os/Dock';
import CommandBar from '@/components/os/CommandBar';
import ToolPanel from '@/components/workspace/ToolPanel';
import WelcomeHub from '@/components/workspace/WelcomeHub';
import AIGuideFloat from '@/components/os/AIGuideFloat.jsx';
import KeyboardShortcuts from '@/components/os/KeyboardShortcuts';
import XPNotification from '@/components/os/XPNotification';
import { AuroraEffect, ScanlineEffect, NeonCursor, FloatingOrbs } from '@/components/effects/UIEffect';
import { useSOS } from '@/lib/SOSContext';

const ThreeBackground = lazy(() => import('@/components/effects/ThreeBackground'));

export default function Home() {
  const { activeTool, modeClass, activeEffect, bg3d } = useSOS();

  return (
    <div className={`h-screen flex flex-col overflow-hidden relative ${modeClass}`}>
      {/* 3D background */}
      {bg3d !== 'none' && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Suspense fallback={null}>
            <ThreeBackground effect={bg3d} />
          </Suspense>
        </div>
      )}

      {/* UI effects */}
      {activeEffect === 'aurora' && <AuroraEffect />}
      {activeEffect === 'scanlines' && <ScanlineEffect />}
      {activeEffect === 'neon_cursor' && <NeonCursor />}
      {activeEffect === 'orbs' && <FloatingOrbs />}

      <TopBar />
      <main className={`relative z-10 flex-1 overflow-y-auto transition-all duration-300 ${activeTool ? 'mr-0 sm:mr-[420px]' : ''}`}>
        <WelcomeHub />
      </main>
      <ToolPanel />
      <Dock />
      <CommandBar />
      <AIGuideFloat />
      <KeyboardShortcuts />
      <XPNotification />
    </div>
  );
}
