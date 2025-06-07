import { renderHook, act } from '@testing-library/react';
import { useViewport } from '../useViewport';

describe('useViewport', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalAddEventListener = window.addEventListener;
  const originalRemoveEventListener = window.removeEventListener;

  beforeEach(() => {
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    });

    // Mock addEventListener and removeEventListener
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  afterEach(() => {
    // Restore original properties
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  it('should initialize with current window dimensions', () => {
    const { result } = renderHook(() => useViewport());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('should add resize event listener when watching viewport', () => {
    renderHook(() => useViewport({ watchViewport: true }));

    expect(window.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });

  it('should not add resize event listener when not watching viewport', () => {
    renderHook(() => useViewport({ watchViewport: false }));

    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('should remove event listener on unmount', () => {
    const { unmount } = renderHook(() => useViewport());
    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });

  it('should update dimensions when resize event triggers', () => {
    // Need to mock the implementation to capture the resize handler
    let resizeHandler: (() => void) | null = null;
    window.addEventListener = jest.fn((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler as () => void;
      }
    });

    const { result } = renderHook(() => useViewport());

    // Simulate resize event
    act(() => {
      // Change window dimensions
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      // Call the resize handler
      if (resizeHandler) resizeHandler();
    });

    // Values should be updated
    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);
  });
});
