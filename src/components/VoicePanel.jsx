import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { HEADER_STYLE, TITLE_STYLE, CLOSE_BTN, INPUT_STYLE } from '../hooks/usePanelPosition';
import ResizablePanel from './ResizablePanel';
import '../styles/panels.css';

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
];

export default function VoicePanel({ isOpen, onClose, anchorRect }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const panelRef = useRef(null);
  const scrollRef = useRef(null);
  const api = useMemo(() => window.electronAPI, []);



  // Stop recording when panel closes
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      setIsRecording(false);
    }
  }, [isOpen]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (_) {}
      setIsRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Speech recognition not supported'); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) setTranscript(prev => prev + (prev ? ' ' : '') + final);
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted')
        setError(`Error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => { setIsRecording(false); setInterimText(''); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setError(null);
  }, [isRecording, language]);

  const handleCopy = useCallback(() => {
    if (!transcript) return;
    if (api?.clipboard?.copy) api.clipboard.copy(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [transcript, api]);

  const handleClear = useCallback(() => {
    setTranscript(''); setInterimText(''); setError(null);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, interimText]);

  if (!isOpen || !anchorRect) return null;

  const panel = (
    <ResizablePanel
      isOpen={isOpen}
      dockAction="mic"
      defaultWidth={360}
      defaultHeight={480}
      minWidth={300}
      minHeight={300}
    >
      {/* Header */}
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>🎤 Voice to Text</span>
        <select value={language} onChange={e => setLanguage(e.target.value)}
          style={{ ...INPUT_STYLE, width: 'auto', fontSize: 11, padding: '4px 8px', borderRadius: 6 }}>
          {LANGUAGES.map(l => <option key={l.code} value={l.code} style={{ background: '#1e2330' }}>{l.label}</option>)}
        </select>
        <button onClick={onClose} style={CLOSE_BTN}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>✕</button>
      </div>

      {/* Record Button */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
        <button onClick={toggleRecording} style={{
          width: 72, height: 72, borderRadius: '50%',
          background: isRecording
            ? 'radial-gradient(circle, #ff4444 60%, #cc0000 100%)'
            : 'radial-gradient(circle, #6e7dff 60%, #4a5adf 100%)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isRecording
            ? '0 0 0 8px rgba(255,68,68,0.15), 0 0 30px rgba(255,68,68,0.3)'
            : '0 0 0 4px rgba(110,125,255,0.15)',
          transition: 'all 0.3s ease',
          animation: isRecording ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
          WebkitAppRegion: 'no-drag',
        }}>
          {isRecording ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
        {isRecording ? (
          <span style={{ color: '#ff6666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4444', animation: 'voiceDot 1s ease-in-out infinite' }} />
            Listening...
          </span>
        ) : 'Click to start recording'}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ff8787',
        }}>{error}</div>
      )}

      {/* Transcript */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        background: 'rgba(0,0,0,0.2)', borderRadius: 10,
        padding: 12, fontSize: 13, lineHeight: 1.6,
        color: 'rgba(255,255,255,0.85)',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
      }}>
        {transcript && <span>{transcript}</span>}
        {interimText && <span style={{ color: 'rgba(110,125,255,0.6)' }}> {interimText}</span>}
        {!transcript && !interimText && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            Your transcript will appear here...
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={handleCopy} disabled={!transcript} style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          background: copied ? 'rgba(74,193,255,0.15)' : 'rgba(110,125,255,0.15)',
          border: `1px solid ${copied ? 'rgba(74,193,255,0.3)' : 'rgba(110,125,255,0.25)'}`,
          color: copied ? '#4ac1ff' : transcript ? '#9aa5ff' : 'rgba(255,255,255,0.2)',
          fontSize: 12, fontWeight: 600, cursor: transcript ? 'pointer' : 'default',
          transition: 'all 0.2s', WebkitAppRegion: 'no-drag',
        }}>{copied ? '✓ Copied!' : 'Copy to Clipboard'}</button>
        <button onClick={handleClear} disabled={!transcript && !interimText} style={{
          padding: '8px 16px', borderRadius: 8,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: (transcript || interimText) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
          fontSize: 12, fontWeight: 600,
          cursor: (transcript || interimText) ? 'pointer' : 'default',
          WebkitAppRegion: 'no-drag',
        }}>Clear</button>
      </div>
    </ResizablePanel>
  );

  return ReactDOM.createPortal(panel, document.body);
}
