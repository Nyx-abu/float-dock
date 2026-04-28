import { useLayoutEffect } from 'react';

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
  resize: 'both',
  minWidth: 300,
  minHeight: 300,
};

export const HEADER_STYLE = {
  display: 'flex', alignItems: 'center', gap: 8,
  flexShrink: 0, WebkitAppRegion: 'no-drag',
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

export function usePanelPosition(isOpen, panelRef, dockAction, panelWidth = PANEL_WIDTH) {
  useLayoutEffect(() => {
    if (!isOpen) return;
    let rafId;
    const place = () => {
      const btn = document.querySelector(`[data-dock-action="${dockAction}"]`);
      if (!btn || !panelRef.current) return;
      const r = btn.getBoundingClientRect();
      const pW = panelRef.current.offsetWidth;
      const pH = panelRef.current.offsetHeight;
      const vW = window.innerWidth, vH = window.innerHeight;
      const GAP = 16, M = 12;
      let tx = r.left + r.width / 2 - pW / 2;
      let ty = r.top - pH - GAP;
      if (ty < M) ty = r.bottom + GAP;
      tx = Math.max(M, Math.min(tx, vW - pW - M));
      ty = Math.max(M, Math.min(ty, vH - pH - M));
      panelRef.current.style.left = `${Math.round(tx)}px`;
      panelRef.current.style.top = `${Math.round(ty)}px`;
      panelRef.current.style.transform = 'none';
    };
    const loop = () => { place(); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(() => requestAnimationFrame(loop));
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, dockAction, panelWidth]);
}
