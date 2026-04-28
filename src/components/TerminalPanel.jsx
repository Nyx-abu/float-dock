import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { usePanelPosition, PANEL_BASE_STYLE, HEADER_STYLE, TITLE_STYLE, CLOSE_BTN } from '../hooks/usePanelPosition';
import '../styles/panels.css';

export default function TerminalPanel({ isOpen, onClose, anchorRect }) {
  const [lines, setLines] = useState([{ type: 'system', text: 'PowerShell — Float Dock Terminal' }]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const api = useMemo(() => window.electronAPI, []);

  usePanelPosition(isOpen, panelRef, 'terminal');

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const execute = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || running) return;
    setInput('');
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setLines(prev => [...prev, { type: 'cmd', text: `PS > ${cmd}` }]);

    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
      setLines([{ type: 'system', text: 'Terminal cleared.' }]);
      return;
    }

    setRunning(true);
    try {
      const res = await api.invoke('terminal:exec', { command: cmd });
      if (res?.stdout) setLines(prev => [...prev, { type: 'out', text: res.stdout }]);
      if (res?.stderr) setLines(prev => [...prev, { type: 'err', text: res.stderr }]);
      if (!res?.stdout && !res?.stderr) setLines(prev => [...prev, { type: 'out', text: '(no output)' }]);
    } catch (err) {
      setLines(prev => [...prev, { type: 'err', text: `Error: ${err.message || 'Command failed'}` }]);
    }
    setRunning(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, running, api]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); execute(); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const next = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(next); setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(history[histIdx - 1]); }
      else { setHistIdx(-1); setInput(''); }
    }
  };

  if (!isOpen || !anchorRect) return null;

  const colorMap = { system: '#4ac1ff', cmd: '#9aa5ff', out: 'rgba(255,255,255,0.75)', err: '#ff8787' };

  const panel = (
    <div ref={panelRef} style={{ ...PANEL_BASE_STYLE, background: 'radial-gradient(circle at top left, #151820, #0d0f14)' }}>
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>🖥️ Terminal</span>
        <button onClick={() => setLines([{ type: 'system', text: 'Terminal cleared.' }])}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '4px 8px',
            cursor: 'pointer', WebkitAppRegion: 'no-drag',
          }}>Clear</button>
        <button onClick={onClose} style={CLOSE_BTN}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>✕</button>
      </div>

      {/* Output Area */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10,
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", fontSize: 12, lineHeight: 1.6,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
        WebkitAppRegion: 'no-drag',
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ color: colorMap[line.type] || '#fff', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {line.text}
          </div>
        ))}
        {running && (
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>
            Running<span style={{ animation: 'termCursor 1s infinite' }}>▋</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'Cascadia Code', monospace", fontSize: 12, color: '#6e7dff', fontWeight: 700, flexShrink: 0,
        }}>PS &gt;</span>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          disabled={running} placeholder="Enter command..."
          style={{
            flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, padding: '8px 10px', color: '#fff',
            fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: 12, outline: 'none',
            WebkitAppRegion: 'no-drag',
          }} />
      </div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
}
