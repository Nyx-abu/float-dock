import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { HEADER_STYLE, TITLE_STYLE, CLOSE_BTN, SCROLL_AREA } from '../hooks/usePanelPosition';
import ResizablePanel from './ResizablePanel';

const POSITIONS = [
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'top-center', label: 'Top Center' },
];

const ACCENT_PRESETS = [
  { value: '#6e7dff', label: 'Indigo' },
  { value: '#4ac1ff', label: 'Cyan' },
  { value: '#06d6a0', label: 'Emerald' },
  { value: '#ff6b6b', label: 'Coral' },
  { value: '#ffd166', label: 'Amber' },
  { value: '#ff9ff3', label: 'Pink' },
  { value: '#a29bfe', label: 'Lavender' },
  { value: '#fd79a8', label: 'Rose' },
  { value: '#00cec9', label: 'Teal' },
  { value: '#e17055', label: 'Terracotta' },
];

const DEFAULTS = {
  dockPosition: 'bottom-center',
  alwaysOnTop: true,
  launchOnStartup: false,
  clipboardMaxItems: 200,
  clipboardPollingMs: 500,
  dockOpacity: 90,
  dockScale: 100,
  accentColor: '#6e7dff',
  theme: 'dark',
};

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, description, accentColor = '#6e7dff' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
        WebkitAppRegion: 'no-drag',
        opacity: hovered ? 1 : 0.9,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em' }}>{label}</div>
        {description && <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 3, lineHeight: 1.4 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value
          ? `linear-gradient(135deg, ${accentColor}99, ${accentColor}66)`
          : 'var(--surface-hover)',
        position: 'relative',
        transition: 'background 0.3s ease, box-shadow 0.3s ease',
        flexShrink: 0,
        WebkitAppRegion: 'no-drag',
        boxShadow: value ? `0 0 12px ${accentColor}35` : 'none',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: value ? '#fff' : 'var(--text-muted)',
          transition: 'left 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.5), background 0.2s',
          boxShadow: value ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
        }} />
      </button>
    </div>
  );
}

// ─── Premium Slider ───────────────────────────────────────────────────────────

function Slider({ value, onChange, min = 0, max = 100, step = 1, label, suffix = '', description, accentColor = '#6e7dff' }) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);
  const pct = ((value - min) / (max - min)) * 100;

  const updateValue = useCallback((e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const snapped = Math.round((raw * (max - min) + min) / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }, [min, max, step, onChange]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateValue(e);
  }, [updateValue]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    updateValue(e);
  }, [dragging, updateValue]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      style={{ padding: '10px 0', WebkitAppRegion: 'no-drag' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', flex: 1, letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: accentColor,
          background: `${accentColor}15`,
          padding: '2px 8px', borderRadius: 6,
          fontFamily: "'Inter', monospace",
          minWidth: 38, textAlign: 'center',
          transition: 'all 0.2s',
        }}>{value}{suffix}</span>
      </div>
      {description && <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 8, lineHeight: 1.4 }}>{description}</div>}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative', height: 28, cursor: 'pointer',
          display: 'flex', alignItems: 'center',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Track background */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
          height: 6, borderRadius: 3,
          background: 'var(--surface)',
          overflow: 'hidden',
        }}>
          {/* Filled portion */}
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${accentColor}90, ${accentColor})`,
            transition: dragging ? 'none' : 'width 0.15s ease',
            boxShadow: `0 0 12px ${accentColor}40`,
          }} />
        </div>
        {/* Thumb */}
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff',
          border: `2px solid ${accentColor}`,
          boxShadow: dragging
            ? `0 0 0 6px ${accentColor}25, 0 2px 8px rgba(0,0,0,0.3)`
            : hovered
              ? `0 0 0 4px ${accentColor}15, 0 2px 6px rgba(0,0,0,0.2)`
              : '0 2px 6px rgba(0,0,0,0.2)',
          transition: dragging ? 'box-shadow 0.15s' : 'left 0.15s ease, box-shadow 0.15s',
          transform: dragging ? 'scale(1.15)' : 'scale(1)',
          cursor: 'grab',
        }} />
      </div>
    </div>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: '0.1em', padding: '10px 0 6px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
        {title}
      </div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--surface-border)',
        borderRadius: 12, padding: '4px 14px',
        transition: 'border-color 0.2s',
      }}>{children}</div>
    </div>
  );
}

// ─── Accent Color Picker ──────────────────────────────────────────────────────

function AccentColorPicker({ value, onChange }) {
  const [custom, setCustom] = useState(false);
  return (
    <div style={{ padding: '10px 0', WebkitAppRegion: 'no-drag' }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.01em' }}>Accent Color</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {ACCENT_PRESETS.map(c => (
          <button
            key={c.value}
            onClick={() => { onChange(c.value); setCustom(false); }}
            title={c.label}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: c.value, padding: 0, flexShrink: 0,
              outline: value === c.value ? `2px solid ${c.value}` : '2px solid transparent',
              outlineOffset: 2,
              transition: 'all 0.2s ease',
              transform: value === c.value ? 'scale(1.1)' : 'scale(1)',
              boxShadow: value === c.value ? `0 0 14px ${c.value}55` : 'none',
              WebkitAppRegion: 'no-drag',
            }}
          />
        ))}
        {/* Custom color input */}
        <div style={{ position: 'relative', width: 26, height: 26 }}>
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setCustom(true); }}
            title="Custom color"
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none',
              cursor: 'pointer', padding: 0,
              outline: custom ? `2px solid ${value}` : '2px solid transparent',
              outlineOffset: 2,
              WebkitAppRegion: 'no-drag',
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Theme Switcher ───────────────────────────────────────────────────────────

function ThemeSwitcher({ value, onChange, accentColor }) {
  const themes = [
    { id: 'dark', label: 'Dark', icon: '🌙' },
    { id: 'light', label: 'Light', icon: '☀️' },
  ];
  return (
    <div style={{ padding: '10px 0', WebkitAppRegion: 'no-drag' }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.01em' }}>Theme</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {themes.map(t => {
          const isActive = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: isActive ? `${accentColor}18` : 'var(--surface)',
                border: `1.5px solid ${isActive ? `${accentColor}50` : 'var(--surface-border)'}`,
                color: isActive ? accentColor : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s ease',
                WebkitAppRegion: 'no-drag',
                fontFamily: 'inherit',
                boxShadow: isActive ? `0 0 16px ${accentColor}15` : 'none',
              }}
            >
              <span style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────

export default function SettingsPanel({ isOpen, onClose, anchorRect }) {
  const [settings, setSettings] = useState({ ...DEFAULTS });
  const [saved, setSaved] = useState(false);
  const panelRef = useRef(null);
  const api = useMemo(() => window.electronAPI, []);

  useEffect(() => {
    if (!isOpen) return;
    api?.invoke?.('settings:get')?.then(s => { if (s) setSettings(prev => ({ ...DEFAULTS, ...prev, ...s })); })?.catch(() => {});
  }, [isOpen, api]);

  // Apply CSS variables immediately for instant visual feedback (no IPC needed)
  const applyVisuals = useCallback((s) => {
    const root = document.documentElement;
    const accent = s.accentColor || '#6e7dff';
    const c = accent.replace('#', '');
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--accent-light', `rgb(${Math.min(255, r + 50)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 30)})`);
    root.style.setProperty('--dock-opacity', (s.dockOpacity ?? 90) / 100);
    root.style.setProperty('--dock-scale', (s.dockScale ?? 100) / 100);
    root.style.setProperty('--panel-opacity', (s.dockOpacity ?? 90) / 100);

    if (s.theme === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
  }, []);

  const saveTimer = useRef(null);

  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      // Instant visual feedback via CSS variables (no lag!)
      applyVisuals(next);
      // Debounce the actual disk save to avoid jitter
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        api?.invoke?.('settings:set', { settings: next })?.catch(() => {});
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      }, 300);
      return next;
    });
  }, [api, applyVisuals]);

  const resetDefaults = useCallback(() => {
    setSettings({ ...DEFAULTS });
    applyVisuals({ ...DEFAULTS });
    api?.invoke?.('settings:set', { settings: { ...DEFAULTS } })?.catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, [api, applyVisuals]);

  if (!isOpen || !anchorRect) return null;

  const accent = settings.accentColor || '#6e7dff';

  const selStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--surface-border)',
    borderRadius: 8,
    color: 'var(--text-dim)',
    fontSize: 11.5,
    padding: '6px 10px',
    cursor: 'pointer',
    outline: 'none',
    WebkitAppRegion: 'no-drag',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const panel = (
    <ResizablePanel
      isOpen={isOpen}
      dockAction="settings"
      defaultWidth={380}
      defaultHeight={560}
      minWidth={320}
      minHeight={400}
    >
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>⚙️ Settings</span>

        {/* Saved indicator */}
        <span style={{
          fontSize: 10.5, fontWeight: 600,
          color: accent,
          opacity: saved ? 1 : 0,
          transform: saved ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.2s, transform 0.2s',
          pointerEvents: 'none',
        }}>✓ Applied</span>

        <button onClick={onClose} style={CLOSE_BTN}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,59,48,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,59,48,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; }}>✕</button>
      </div>

      <div style={SCROLL_AREA}>
        <Section title="Appearance" icon="🎨">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', WebkitAppRegion: 'no-drag' }}>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>Dock Position</span>
            <select value={settings.dockPosition} onChange={e => update('dockPosition', e.target.value)} style={selStyle}>
              {POSITIONS.map(p => <option key={p.value} value={p.value} style={{ background: 'var(--panel-bg)', color: 'var(--text)' }}>{p.label}</option>)}
            </select>
          </div>
          <Toggle label="Always on Top" value={settings.alwaysOnTop} onChange={v => update('alwaysOnTop', v)} accentColor={accent} />

          <Slider
            label="Dock Opacity" value={settings.dockOpacity} onChange={v => update('dockOpacity', v)}
            min={60} max={100} step={5} suffix="%" accentColor={accent}
            description="Translucent to opaque (dock and panels)"
          />
          <Slider
            label="Dock Scale" value={settings.dockScale} onChange={v => update('dockScale', v)}
            min={70} max={130} step={5} suffix="%" accentColor={accent}
            description="Scale of the dock bar and icons"
          />
        </Section>

        <Section title="Theme" icon="✨">
          <ThemeSwitcher value={settings.theme} onChange={v => update('theme', v)} accentColor={accent} />
          <AccentColorPicker value={accent} onChange={v => update('accentColor', v)} />
        </Section>

        <Section title="System" icon="💻">
          <Toggle label="Launch on Startup" description="Start Float Dock when Windows boots"
            value={settings.launchOnStartup} onChange={v => update('launchOnStartup', v)} accentColor={accent} />
        </Section>

        <Section title="Clipboard" icon="📋">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', WebkitAppRegion: 'no-drag' }}>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>Max History Items</span>
            <select value={settings.clipboardMaxItems} onChange={e => update('clipboardMaxItems', Number(e.target.value))} style={selStyle}>
              {[50, 100, 200, 500].map(n => <option key={n} value={n} style={{ background: 'var(--panel-bg)', color: 'var(--text)' }}>{n}</option>)}
            </select>
          </div>
          <Slider
            label="Polling Rate" value={settings.clipboardPollingMs} onChange={v => update('clipboardPollingMs', v)}
            min={200} max={2000} step={100} suffix="ms" accentColor={accent}
            description="How often to check clipboard for changes (lower = faster)"
          />
        </Section>

        <Section title="Keyboard Shortcuts" icon="⌨️">
          <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['Ctrl', 'Shift', 'D'].map((key, i) => (
                <span key={i}>
                  <span style={{
                    padding: '4px 8px', borderRadius: 6,
                    background: `${accent}12`,
                    border: `1px solid ${accent}25`,
                    fontFamily: "'Inter', monospace", fontSize: 11, fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.02em',
                  }}>{key}</span>
                  {i < 2 && <span style={{ color: 'var(--text-faint)', margin: '0 2px', fontSize: 10 }}>+</span>}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Toggle dock</span>
          </div>
        </Section>

        <Section title="About" icon="ℹ️">
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: 'var(--text)' }}>Float Dock v1.0.0</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              A floating productivity dock for Windows.
            </div>
          </div>
        </Section>

        {/* Reset to Defaults */}
        <div style={{ padding: '6px 0 12px', WebkitAppRegion: 'no-drag' }}>
          <button onClick={resetDefaults} style={{
            width: '100%', padding: '10px 0', borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,107,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,107,107,0.2)'; e.currentTarget.style.color = '#ff8787'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >Reset All to Defaults</button>
        </div>
      </div>
    </ResizablePanel>
  );

  return ReactDOM.createPortal(panel, document.body);
}
