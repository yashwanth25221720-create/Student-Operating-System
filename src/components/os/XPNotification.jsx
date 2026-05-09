import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, TrendingUp } from 'lucide-react';
import { useSOS } from '@/lib/SOSContext.jsx';

export default function XPNotification() {
  const { xp, level } = useSOS();
  const prevXpRef = useRef(xp);
  const prevLevelRef = useRef(level);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const gained = xp - prevXpRef.current;
    const levelUp = level > prevLevelRef.current;

    if (gained > 0) {
      const id = Date.now();
      setNotifications(prev => [...prev, { id, xp: gained, levelUp, newLevel: level }]);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2500);
    }

    prevXpRef.current = xp;
    prevLevelRef.current = level;
  }, [xp, level]);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 40, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.8 }}
            transition={{ type: 'spring', damping: 18 }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg ${
              n.levelUp
                ? 'bg-primary text-primary-foreground border-primary/50'
                : 'bg-card border-border'
            }`}
          >
            {n.levelUp ? (
              <>
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-bold">Level Up! → Lv.{n.newLevel}</span>
              </>
            ) : (
              <>
                <Star className="w-3.5 h-3.5 text-warning" />
                <span className="text-sm font-semibold text-foreground">+{n.xp} XP</span>
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
