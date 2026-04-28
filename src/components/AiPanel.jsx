import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { HEADER_STYLE, TITLE_STYLE, CLOSE_BTN } from '../hooks/usePanelPosition';
import ResizablePanel from './ResizablePanel';
import '../styles/panels.css';

const QUICK_ACTIONS = [
  { label: '📋 Summarize', prefix: 'Summarize the following text concisely:\n\n' },
  { label: '🌐 Translate', prefix: 'Translate the following to English:\n\n' },
  { label: '🐛 Fix code', prefix: 'Fix the following code and explain the issue:\n\n' },
  { label: '📖 Explain', prefix: 'Explain the following in simple terms:\n\n' },
];

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#6e7dff',
          animation: `aiDot${i} 1.4s infinite ease-in-out`,
        }} />
      ))}
    </div>
  );
}

export default function AiPanel({ isOpen, onClose, anchorRect }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const api = useMemo(() => window.electronAPI, []);



  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await api.invoke('ai:chat', { prompt: msg });
      setMessages(prev => [...prev, { role: 'ai', text: res?.text || 'No response received.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${err.message || 'Failed to get response'}`, error: true }]);
    }
    setLoading(false);
  }, [input, loading, api]);

  const handleQuickAction = useCallback(async (action) => {
    // Try to read clipboard
    let clipContent = '';
    try {
      clipContent = await navigator.clipboard.readText();
    } catch (_) {}
    sendMessage(action.prefix + (clipContent || '[paste your content here]'));
  }, [sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!isOpen || !anchorRect) return null;

  const panel = (
    <ResizablePanel
      isOpen={isOpen}
      dockAction="sparkle"
      defaultWidth={420}
      defaultHeight={480}
      minWidth={300}
      minHeight={300}
    >
      {/* Header */}
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>✨ AI Assistant</span>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '4px 8px',
            cursor: 'pointer', WebkitAppRegion: 'no-drag',
          }}>Clear</button>
        )}
        <button onClick={onClose} style={CLOSE_BTN}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>✕</button>
      </div>

      {/* Quick Actions (shown when no messages) */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
          {QUICK_ACTIONS.map(a => (
            <button key={a.label} onClick={() => handleQuickAction(a)} style={{
              background: 'rgba(110,125,255,0.08)', border: '1px solid rgba(110,125,255,0.15)',
              borderRadius: 20, color: '#9aa5ff', fontSize: 11, padding: '5px 10px',
              cursor: 'pointer', whiteSpace: 'nowrap', WebkitAppRegion: 'no-drag',
            }}>{a.label}</button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
      }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Ask me anything or use a quick action above.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', padding: '8px 12px', borderRadius: 12,
            background: msg.role === 'user'
              ? 'linear-gradient(135deg, rgba(110,125,255,0.25), rgba(110,125,255,0.15))'
              : msg.error ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${msg.role === 'user' ? 'rgba(110,125,255,0.2)' : msg.error ? 'rgba(255,107,107,0.2)' : 'rgba(255,255,255,0.08)'}`,
            fontSize: 12, lineHeight: 1.6, color: msg.error ? '#ff8787' : 'rgba(255,255,255,0.85)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{msg.text}</div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
          }}><TypingIndicator /></div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Ask anything…" disabled={loading}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 12, outline: 'none',
            WebkitAppRegion: 'no-drag',
          }} />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
          padding: '0 14px', borderRadius: 8,
          background: input.trim() && !loading ? 'rgba(110,125,255,0.2)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${input.trim() && !loading ? 'rgba(110,125,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
          color: input.trim() && !loading ? '#9aa5ff' : 'rgba(255,255,255,0.2)',
          fontSize: 14, cursor: input.trim() && !loading ? 'pointer' : 'default', WebkitAppRegion: 'no-drag',
        }}>→</button>
      </div>
    </ResizablePanel>
  );

  return ReactDOM.createPortal(panel, document.body);
}
