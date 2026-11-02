import { useCallback, useEffect, useState } from 'react';

interface TypeOptions {
  /**
   * The prompts to cycle through in the typing effect
   */
  prompts: string[];

  /**
   * The speed of the typing effect in milliseconds
   * @default 50
   */
  typeSpeed?: number;

  /**
   * The speed of erasing effect in milliseconds
   * @default 30
   */
  eraseSpeed?: number;

  /**
   * The time to pause after typing completes in milliseconds
   * @default 2000
   */
  pauseDuration?: number;

  /**
   * Function to process the prompt text (e.g., for truncation)
   */
  processText?: (text: string) => string;
}

/**
 * Custom hook for creating typing and erasing text effects
 * commonly used in hero banners and landing pages
 */
export function useTypingEffect({
  prompts,
  typeSpeed = 50,
  eraseSpeed = 30,
  pauseDuration = 2000,
  processText = (text) => text,
}: TypeOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // Get the current prompt to display
  const getCurrentPrompt = useCallback(() => {
    if (!prompts.length) return '';
    const safeIndex = Math.min(currentIndex, prompts.length - 1);
    const originalPrompt = prompts[safeIndex];
    return processText(originalPrompt);
  }, [currentIndex, prompts, processText]);

  // One interval per phase drives every character, so timing stays steady instead of depending on render cycles.
  useEffect(() => {
    if (!prompts.length) return;

    const displayPrompt = getCurrentPrompt();

    if (isTyping) {
      if (currentText.length < displayPrompt.length) {
        const timer = setInterval(() => {
          setCurrentText((text) => displayPrompt.substring(0, text.length + 1));
        }, typeSpeed);
        return () => clearInterval(timer);
      }
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, pauseDuration);
      return () => clearTimeout(timer);
    }

    if (currentText.length > 0) {
      const timer = setInterval(() => {
        // The last erased character moves to the next prompt in the same tick, so a phase never waits on a second render.
        if (currentText.length <= 1) {
          clearInterval(timer);
          setCurrentText('');
          setIsTyping(true);
          setCurrentIndex((prevIndex) => (prevIndex + 1) % prompts.length);
          return;
        }
        setCurrentText((text) => text.substring(0, text.length - 1));
      }, eraseSpeed);
      return () => clearInterval(timer);
    }

    setIsTyping(true);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % prompts.length);
  }, [
    currentText,
    currentIndex,
    isTyping,
    prompts,
    typeSpeed,
    eraseSpeed,
    pauseDuration,
    getCurrentPrompt,
  ]);

  return {
    text: currentText,
    isTyping,
    currentPromptIndex: currentIndex,
  };
}
