import { useState, useEffect, useCallback } from 'react';

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
   * The speed of the erasing effect in milliseconds
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

  // Handle the typing effect animation
  useEffect(() => {
    if (!prompts.length) return;

    const displayPrompt = getCurrentPrompt();
    let timer: NodeJS.Timeout;

    if (isTyping) {
      // Typing phase
      if (currentText.length < displayPrompt.length) {
        timer = setTimeout(() => {
          setCurrentText(displayPrompt.substring(0, currentText.length + 1));
        }, typeSpeed);
      } else {
        // Complete - pause before erasing
        timer = setTimeout(() => {
          setIsTyping(false);
        }, pauseDuration);
      }
    } else {
      // Erasing phase
      if (currentText.length > 0) {
        timer = setTimeout(() => {
          setCurrentText(currentText.substring(0, currentText.length - 1));
        }, eraseSpeed);
      } else {
        // Move to next prompt
        setIsTyping(true);
        setCurrentIndex((prevIndex) => (prevIndex + 1) % prompts.length);
      }
    }

    return () => clearTimeout(timer);
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
