import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], desc: 'Open Command Bar' },
  { keys: ['⌘', '/'], desc: 'Toggle Shortcuts Panel' },
  { keys: ['Esc'], desc: 'Close panel / modal' },
  { keys: ['⌘', '1'], desc: 'Study workspace' },
  { keys: ['⌘', '2'], desc: 'Career workspace' },
  { keys: ['⌘', '3'], desc: 'Dev workspace' },
  { keys: ['⌘', '4'], desc: 'AI Lab workspace' },
  { keys: ['⌘', '5'], desc: 'Productivity workspace' },
  { keys: ['Space'], desc: 'Start/Stop timer' },
  { keys: ['Enter'], desc: 'Flip flashcard' },
];

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setOpen(p => !p);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[4.5rem] left-4 z-30 w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:border-primary/30 transition-colors opacity-60 hover:opacity-100"
        title="Keyboard shortcuts (⌘/)"
      >
        <Keyboard className="w-4 h-4 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">Keyboard Shortcuts</h2>
                </div>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {SHORTCUTS.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <kbd key={j} className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-muted border border-border min-w-[1.5rem] text-center">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">Press ⌘/ to toggle</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
