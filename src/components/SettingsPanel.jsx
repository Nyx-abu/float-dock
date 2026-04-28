import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { usePanelPosition, PANEL_BASE_STYLE, HEADER_STYLE, TITLE_STYLE, CLOSE_BTN, SCROLL_AREA } from '../hooks/usePanelPosition';

const POSITIONS = [
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-center', label: 'Top Center' },
];

function Toggle({ value, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', WebkitAppRegion: 'no-drag' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: value ? 'rgba(110,125,255,0.5)' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, WebkitAppRegion: 'no-drag',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: value ? '#9aa5ff' : 'rgba(255,255,255,0.5)',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
        textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 0 4px',
      }}>{title}</div>
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '4px 12px',
      }}>{children}</div>
    </div>
  );
}

export default function SettingsPanel({ isOpen, onClose, anchorRect }) {
  const [settings, setSettings] = useState({
    dockPosition: 'bottom-center',
    alwaysOnTop: true,
    launchOnStartup: false,
    clipboardMaxItems: 200,
    clipboardPollingMs: 500,
    theme: 'dark',
  });
  const panelRef = useRef(null);
  const api = useMemo(() => window.electronAPI, []);

  usePanelPosition(isOpen, panelRef, 'settings');

  useEffect(() => {
    if (!isOpen) return;
    api.invoke('settings:get').then(s => { if (s) setSettings(prev => ({ ...prev, ...s })); }).catch(() => {});
  }, [isOpen, api]);

  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      api.invoke('settings:set', { settings: next }).catch(() => {});
      return next;
    });
  }, [api]);

  if (!isOpen || !anchorRect) return null;

  const selStyle = {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: 'rgba(255,255,255,0.85)', fontSize: 12, padding: '5px 8px',
    cursor: 'pointer', outline: 'none', WebkitAppRegion: 'no-drag',
  };

  const panel = (
    <div ref={panelRef} style={PANEL_BASE_STYLE}>
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>⚙️ Settings</span>
        <button onClick={onClose} style={CLOSE_BTN}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>✕</button>
      </div>

      <div style={SCROLL_AREA}>
        <Section title="Appearance">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', WebkitAppRegion: 'no-drag' }}>
            <span style={{ flex: 1, fontSize: 13, color: '#fff' }}>Dock Position</span>
            <select value={settings.dockPosition} onChange={e => update('dockPosition', e.target.value)} style={selStyle}>
              {POSITIONS.map(p => <option key={p.value} value={p.value} style={{ background: '#1e2330' }}>{p.label}</option>)}
            </select>
          </div>
          <Toggle label="Always on Top" value={settings.alwaysOnTop} onChange={v => update('alwaysOnTop', v)} />
        </Section>

        <Section title="System">
          <Toggle label="Launch on Startup" description="Start Float Dock when Windows boots"
            value={settings.launchOnStartup} onChange={v => update('launchOnStartup', v)} />
        </Section>

        <Section title="Clipboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', WebkitAppRegion: 'no-drag' }}>
            <span style={{ flex: 1, fontSize: 13, color: '#fff' }}>Max History Items</span>
            <select value={settings.clipboardMaxItems} onChange={e => update('clipboardMaxItems', Number(e.target.value))} style={selStyle}>
              {[50, 100, 200, 500].map(n => <option key={n} value={n} style={{ background: '#1e2330' }}>{n}</option>)}
            </select>
          </div>
        </Section>

        <Section title="Keyboard Shortcut">
          <div style={{ padding: '8px 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{
              padding: '4px 8px', borderRadius: 4,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
            }}>Ctrl + Shift + D</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Toggle dock visibility</span>
          </div>
        </Section>

        <Section title="About">
          <div style={{ padding: '8px 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>Float Dock v1.0.0</div>
            <div>A floating productivity dock for Windows.</div>
          </div>
        </Section>
      </div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
}
