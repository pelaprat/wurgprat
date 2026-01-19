'use client';

import { useEffect, useState } from 'react';
import { usePirateMode } from '@/hooks/usePirateMode';

const PIRATE_EMOJIS = ['🏴‍☠️', '🦜', '⚓', '🗡️', '💰', '🏝️', '🦑', '🧭', '⛵', '💀'];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

function generateEmojis(count: number): FloatingEmoji[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: PIRATE_EMOJIS[Math.floor(Math.random() * PIRATE_EMOJIS.length)],
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 24 + Math.random() * 32,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 2,
  }));
}

export function PirateOverlay() {
  const { isActive, deactivate } = usePirateMode();
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (isActive) {
      setEmojis(generateEmojis(20));
      setShowMessage(true);
      const timer = setTimeout(() => setShowMessage(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setEmojis([]);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Floating emojis */}
      {emojis.map((emoji) => (
        <div
          key={emoji.id}
          className="absolute animate-float"
          style={{
            left: `${emoji.x}%`,
            top: `${emoji.y}%`,
            fontSize: `${emoji.size}px`,
            animationDuration: `${emoji.duration}s`,
            animationDelay: `${emoji.delay}s`,
          }}
        >
          {emoji.emoji}
        </div>
      ))}

      {/* Activation message */}
      {showMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-900/90 text-amber-100 px-8 py-4 rounded-lg shadow-2xl border-2 border-amber-600 animate-bounceIn">
          <p className="text-2xl font-bold text-center">Arrr! Ye found the treasure!</p>
          <p className="text-sm text-center mt-1 text-amber-300">Pirate mode activated</p>
        </div>
      )}

      {/* Dismiss button */}
      <button
        onClick={deactivate}
        className="absolute bottom-4 right-4 pointer-events-auto bg-amber-900/80 hover:bg-amber-800 text-amber-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-amber-600"
      >
        Dismiss Pirates
      </button>
    </div>
  );
}
