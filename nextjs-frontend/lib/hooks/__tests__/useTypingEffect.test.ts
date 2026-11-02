import { renderHook, act } from '@testing-library/react';
import { useTypingEffect } from '../useTypingEffect';

describe('useTypingEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with empty text', () => {
    const { result } = renderHook(() =>
      useTypingEffect({ prompts: ['Hello', 'World'] }),
    );

    expect(result.current.text).toBe('');
    expect(result.current.isTyping).toBe(true);
    expect(result.current.currentPromptIndex).toBe(0);
  });

  it('should type out the first prompt', () => {
    const { result } = renderHook(() =>
      useTypingEffect({ prompts: ['Hello', 'World'], typeSpeed: 10 }),
    );

    // Type the first character
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.text).toBe('H');

    // Type the rest of the characters
    act(() => {
      jest.advanceTimersByTime(40); // 4 more characters * 10ms
    });
    expect(result.current.text).toBe('Hello');
  });

  it('should pause after typing completes', () => {
    const pauseDuration = 500;
    const { result } = renderHook(() =>
      useTypingEffect({
        prompts: ['Hello'],
        typeSpeed: 10,
        pauseDuration,
      }),
    );

    // Type full word
    act(() => {
      jest.advanceTimersByTime(50); // 5 characters * 10ms
    });
    expect(result.current.text).toBe('Hello');
    expect(result.current.isTyping).toBe(true);

    // Should still be the same after almost finishing pause
    act(() => {
      jest.advanceTimersByTime(pauseDuration - 10);
    });
    expect(result.current.isTyping).toBe(true);

    // Should switch to erasing after pause completes
    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(result.current.isTyping).toBe(false);
  });

  it('should erase text and move to next prompt', () => {
    const { result } = renderHook(() =>
      useTypingEffect({
        prompts: ['Hello', 'World'],
        typeSpeed: 10,
        eraseSpeed: 5,
        pauseDuration: 100,
      }),
    );

    // Type full first word
    act(() => {
      jest.advanceTimersByTime(50); // 5 characters * 10ms
    });
    expect(result.current.text).toBe('Hello');

    // Complete pause
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.isTyping).toBe(false);

    // Erase all characters
    act(() => {
      jest.advanceTimersByTime(25); // 5 characters * 5ms
    });
    expect(result.current.text).toBe('');

    // Should move to next prompt and start typing again
    expect(result.current.isTyping).toBe(true);
    expect(result.current.currentPromptIndex).toBe(1);
  });

  it('should cycle back to the first prompt after finishing the last one', () => {
    const { result } = renderHook(() =>
      useTypingEffect({
        prompts: ['A', 'B'],
        typeSpeed: 10,
        eraseSpeed: 5,
        pauseDuration: 20,
      }),
    );

    // Complete first prompt cycle. Each phase advances in its own act, because the next timer only exists after a render.
    act(() => {
      jest.advanceTimersByTime(10);
    });
    act(() => {
      jest.advanceTimersByTime(20);
    });
    act(() => {
      jest.advanceTimersByTime(5);
    });

    expect(result.current.currentPromptIndex).toBe(1);

    // Complete second prompt cycle
    act(() => {
      jest.advanceTimersByTime(10);
    });
    act(() => {
      jest.advanceTimersByTime(20);
    });
    act(() => {
      jest.advanceTimersByTime(5);
    });

    // Should cycle back to the first prompt
    expect(result.current.currentPromptIndex).toBe(0);
  });

  it('should apply the processText function to prompts', () => {
    const processText = jest.fn((text) => text.toUpperCase());

    renderHook(() =>
      useTypingEffect({
        prompts: ['hello'],
        typeSpeed: 10,
        processText,
      }),
    );

    // Should have called processText with the first prompt
    expect(processText).toHaveBeenCalledWith('hello');
  });
});
