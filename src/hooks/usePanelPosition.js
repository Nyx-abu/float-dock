import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const PANEL_WIDTH = 420;

export const PANEL_BASE_STYLE = {
  position: 'fixed',
  left: -9999, top: -9999,
  width: PANEL_WIDTH,
  height: 480,
  maxHeight: '80vh',
  borderRadius: 16,
  background: 'radial-gradient(circle at top left, #1e2330, #111418)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
  padding: '14px 14px 12px',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  zIndex: 9500,
  pointerEvents: 'auto',
  WebkitAppRegion: 'no-drag',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

export const HEADER_STYLE = {
  display: 'flex', alignItems: 'center', gap: 8,
  flexShrink: 0, WebkitAppRegion: 'no-drag',
  cursor: 'grab',
  userSelect: 'none',
};

export const TITLE_STYLE = {
  fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: '-0.01em',
};

export const CLOSE_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 5, padding: '4px', flexShrink: 0,
  color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1,
  transition: 'color 0.15s', WebkitAppRegion: 'no-drag',
};

export const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 12,
  outline: 'none', width: '100%', boxSizing: 'border-box',
  WebkitAppRegion: 'no-drag',
};

export const SCROLL_AREA = {
  flex: 1, overflowY: 'auto', minHeight: 0,
  display: 'flex', flexDirection: 'column', gap: 4,
  scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
  WebkitAppRegion: 'no-drag',
};

/**
 * Centers the panel on first open, then leaves position alone so
 * drag + resize work freely.
 */
export function usePanelPosition(isOpen, panelRef, dockAction, panelWidth = PANEL_WIDTH) {
  // Track whether we've already positioned this panel
  const hasPositioned = useRef(false);

  // Reset when panel closes so it re-centers next time it opens
  useEffect(() => {
    if (!isOpen) hasPositioned.current = false;
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current || hasPositioned.current) return;

    requestAnimationFrame(() => {
      if (!panelRef.current) return;

      const pW = panelRef.current.offsetWidth || panelWidth;
      const pH = panelRef.current.offsetHeight || 480;
      const vW = window.innerWidth, vH = window.innerHeight;

      // Center the panel
      const tx = (vW / 2) - (pW / 2);
      const ty = (vH / 2) - (pH / 2) - 30;

      panelRef.current.style.left = `${Math.round(tx)}px`;
      panelRef.current.style.top = `${Math.round(Math.max(12, ty))}px`;

      // Add the animation class
      panelRef.current.classList.add('macos-pop');

      hasPositioned.current = true;
    });
  }, [isOpen, panelWidth]);
}

/**
 * Makes a panel draggable by its header area.
 * Listens for mousedown on elements with [data-drag-handle] inside the panel.
 */
export function useDraggable(panelRef) {
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e) => {
    // Only start drag from the header (data-drag-handle) or its child text nodes
    // But NOT from buttons inside the header
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    // Don't drag if clicking a button or input inside the header
    if (e.target.closest('button, input, select, textarea, a')) return;

    e.preventDefault();
    dragging.current = true;

    const el = panelRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    // Set grabbing cursor on the handle
    handle.style.cursor = 'grabbing';

    const onMouseMove = (ev) => {
      if (!dragging.current || !panelRef.current) return;
      ev.preventDefault();

      let newX = ev.clientX - offset.current.x;
      let newY = ev.clientY - offset.current.y;

      // Clamp to viewport so the panel can't be dragged entirely offscreen
      const vW = window.innerWidth;
      const vH = window.innerHeight;
      const pW = panelRef.current.offsetWidth;
      const pH = panelRef.current.offsetHeight;

      // Keep at least 60px visible on each axis
      const minVisible = 60;
      newX = Math.max(-pW + minVisible, Math.min(newX, vW - minVisible));
      newY = Math.max(0, Math.min(newY, vH - minVisible));

      panelRef.current.style.left = `${Math.round(newX)}px`;
      panelRef.current.style.top = `${Math.round(newY)}px`;
    };

    const onMouseUp = () => {
      dragging.current = false;
      handle.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelRef]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, [panelRef, onMouseDown]);
}
