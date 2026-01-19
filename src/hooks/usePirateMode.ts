'use client';

import { useState, useEffect, useCallback } from 'react';

// The classic Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
const PIRATE_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

const STORAGE_KEY = 'wurgprat-pirate-mode';

export function usePirateMode() {
  const [isActive, setIsActive] = useState(false);
  const [inputSequence, setInputSequence] = useState<string[]>([]);

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') {
      setIsActive(true);
    }
  }, []);

  // Handle key presses
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const newSequence = [...inputSequence, event.code].slice(-PIRATE_CODE.length);
      setInputSequence(newSequence);

      // Check if the sequence matches
      if (newSequence.length === PIRATE_CODE.length) {
        const isMatch = newSequence.every((key, index) => key === PIRATE_CODE[index]);
        if (isMatch) {
          setIsActive(true);
          localStorage.setItem(STORAGE_KEY, 'true');
          setInputSequence([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputSequence]);

  const deactivate = useCallback(() => {
    setIsActive(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { isActive, deactivate };
}
