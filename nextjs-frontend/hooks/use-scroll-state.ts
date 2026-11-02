'use client';

import { useSyncExternalStore } from 'react';

// One shared scroll state drives the promo banner and the header offset, so the two never disagree about where the top of the page is.
export interface ScrollState {
  scrollY: number;
  scrollDirection: 'up' | 'down' | 'none';
  isScrolled: boolean;
  bannerHidden: boolean;
}

const INITIAL_STATE: ScrollState = {
  scrollY: 0,
  scrollDirection: 'none',
  isScrolled: false,
  bannerHidden: false,
};

let scrollState: ScrollState = INITIAL_STATE;
let lastScrollY = 0;
let bannerCurrentlyHidden = false;
let hideIntent = 0;
let showIntent = 0;
let ticking = false;
let rafId = 0;
let listening = false;
const listeners = new Set<() => void>();

const HIDE_INTENT_PX = 28;
const SHOW_INTENT_PX = 20;

const emit = () => {
  for (const listener of listeners) listener();
};

const computeScrollState = () => {
  const currentScrollY = window.scrollY;
  const scrollDelta = currentScrollY - lastScrollY;
  const direction: ScrollState['scrollDirection'] =
    scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : 'none';

  if (currentScrollY < 16) {
    bannerCurrentlyHidden = false;
    hideIntent = 0;
    showIntent = 0;
  } else if (scrollDelta > 1 && currentScrollY > 72) {
    // Require a bit of sustained downward movement before hiding.
    hideIntent = Math.min(HIDE_INTENT_PX + 10, hideIntent + scrollDelta);
    showIntent = Math.max(0, showIntent - scrollDelta * 0.5);
    if (hideIntent >= HIDE_INTENT_PX) bannerCurrentlyHidden = true;
  } else if (scrollDelta < -1) {
    // Reveal faster on upward intent so the interaction feels responsive.
    const upDelta = Math.abs(scrollDelta);
    showIntent = Math.min(SHOW_INTENT_PX + 10, showIntent + upDelta);
    hideIntent = Math.max(0, hideIntent - upDelta * 0.5);
    if (showIntent >= SHOW_INTENT_PX) bannerCurrentlyHidden = false;
  } else {
    hideIntent = Math.max(0, hideIntent - 1.2);
    showIntent = Math.max(0, showIntent - 1.2);
  }

  const nextState: ScrollState = {
    scrollY: currentScrollY,
    scrollDirection: direction,
    isScrolled: currentScrollY > 20,
    bannerHidden: bannerCurrentlyHidden,
  };
  const changed =
    nextState.scrollDirection !== scrollState.scrollDirection ||
    nextState.isScrolled !== scrollState.isScrolled ||
    nextState.bannerHidden !== scrollState.bannerHidden;
  if (changed) {
    scrollState = nextState;
    emit();
  }
  lastScrollY = currentScrollY;
  ticking = false;
};

const handleScroll = () => {
  if (!ticking) {
    rafId = requestAnimationFrame(computeScrollState);
    ticking = true;
  }
};

const startListening = () => {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  lastScrollY = window.scrollY;
  bannerCurrentlyHidden = window.scrollY > 96;
  hideIntent = 0;
  showIntent = 0;
  computeScrollState();
  window.addEventListener('scroll', handleScroll, { passive: true });
};

const stopListening = () => {
  if (!listening || typeof window === 'undefined') return;
  listening = false;
  window.removeEventListener('scroll', handleScroll);
  if (ticking) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    ticking = false;
  }
  hideIntent = 0;
  showIntent = 0;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  startListening();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopListening();
  };
};

const getSnapshot = () => scrollState;
const getServerSnapshot = () => INITIAL_STATE;

export function useScrollState(): ScrollState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The banner tells the header when it is dismissed, so the header can move up without a shared component tree. */
export const BANNER_DISMISSED_EVENT = 'attma:banner-dismissed';
