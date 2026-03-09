import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
}

function dateLabel(iso) {
    try {
        const d = new Date(iso);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (itemDay.getTime() === today.getTime()) return 'Today';
        if (itemDay.getTime() === yesterday.getTime()) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
}

const TYPE_LABELS = { text: 'Text', image: 'Image', file: 'File', link: 'Link', color: 'Color' };
const TYPE_COLORS = {
    text: '#6e7dff',
    image: '#4ac1ff',
    file: '#ffd166',
    link: '#06d6a0',
    color: '#ff6b6b',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }) {
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
            background: `${TYPE_COLORS[type] || '#aaa'}20`,
            color: TYPE_COLORS[type] || '#aaa',
            letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0,
        }}>
            {TYPE_LABELS[type] || type}
        </span>
    );
}

function ColorSwatch({ hex }) {
    const safe = hex.trim();
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 26, height: 26, borderRadius: '50%', background: safe, flexShrink: 0,
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: `0 0 10px ${safe}55`,
            }} />
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#fff', fontWeight: 700 }}>{safe}</span>
        </div>
    );
}

function ImagePreview({ src }) {
    return (
        <img src={src} alt="Clipboard img"
            style={{
                maxWidth: '100%', maxHeight: 72, borderRadius: 6, objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.08)'
            }} />
    );
}

function FilePreview({ content }) {
    const files = content.split('\n').map(f => f.trim()).filter(Boolean);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {files.slice(0, 3).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13 }}>📄</span>
                    <span style={{
                        fontSize: 12, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240
                    }}>
                        {f.split(/[\\/]/).pop()}
                    </span>
                </div>
            ))}
            {files.length > 3 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>+{files.length - 3} more</span>}
        </div>
    );
}

function LinkPreview({ url }) {
    let host = url;
    try { host = new URL(url.startsWith('www') ? `http://${url}` : url).hostname; } catch (_) { }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#06d6a0', fontWeight: 600 }}>{host}</span>
            <span style={{
                fontSize: 12, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280
            }}>{url}</span>
        </div>
    );
}

function CopyIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

const btnBase = {
    background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', borderRadius: 5,
    padding: '4px', flexShrink: 0, transition: 'background 0.15s, color 0.15s',
    WebkitAppRegion: 'no-drag',
};

function ItemRow({ item, onCopy, onDelete }) {
    const [copied, setCopied] = useState(false);
    const [hovered, setHovered] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        onCopy(item.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                padding: '8px 10px', borderRadius: 8,
                background: copied
                    ? 'rgba(74,193,255,0.1)'
                    : hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${copied ? 'rgba(74,193,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                transition: 'background 0.15s, border 0.15s',
                WebkitAppRegion: 'no-drag',
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TypeBadge type={item.type} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flex: 1 }}>
                    {formatTime(item.timestamp)}
                </span>

                {copied && (
                    <span style={{ fontSize: 11, color: '#4ac1ff', fontWeight: 700, marginRight: 4 }}>
                        Copied!
                    </span>
                )}

                {/* Copy icon button */}
                <button
                    onClick={handleCopy}
                    title="Copy again"
                    style={{
                        ...btnBase,
                        color: copied ? '#4ac1ff' : 'rgba(255,255,255,0.4)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#4ac1ff'}
                    onMouseLeave={e => e.currentTarget.style.color = copied ? '#4ac1ff' : 'rgba(255,255,255,0.4)'}
                >
                    <CopyIcon />
                </button>

                {/* Delete button */}
                <button
                    onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                    title="Delete"
                    style={{ ...btnBase, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.background = 'rgba(255,107,107,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'none'; }}
                >✕</button>
            </div>

            {/* Content preview */}
            <div style={{ paddingLeft: 2, cursor: 'default' }}>
                {item.type === 'color' && <ColorSwatch hex={item.content} />}
                {item.type === 'image' && <ImagePreview src={item.preview} />}
                {item.type === 'file' && <FilePreview content={item.content} />}
                {item.type === 'link' && <LinkPreview url={item.content.trim()} />}
                {item.type === 'text' && (
                    <p style={{
                        margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.72)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>{item.content}</p>
                )}
            </div>
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const FILTERS = [
    { value: 'all', label: 'All Types' },
    { value: 'text', label: 'Text Only' },
    { value: 'image', label: 'Images Only' },
    { value: 'file', label: 'Files Only' },
    { value: 'link', label: 'Links Only' },
    { value: 'color', label: 'Colors Only' },
];

const PANEL_WIDTH = 420;

export default function ClipboardPanel({ isOpen, onClose, anchorRect }) {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const api = useMemo(() => window.electronAPI, []);

    // Load on open
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        api.invoke('clipboard:getHistory')
            .then(list => { setItems(Array.isArray(list) ? list : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [isOpen, api]);

    // Live push: main process sends either a new item or an existing item (bubbled dedup)
    useEffect(() => {
        if (!isOpen || !api.onClipboardUpdate) return;
        return api.onClipboardUpdate(newItem => {
            setItems(prev => {
                // Remove any existing item with the same id OR same content (bubble dedup)
                const rest = prev.filter(i =>
                    i.id !== newItem.id &&
                    !(i.type === newItem.type && i.content === newItem.content)
                );
                return [newItem, ...rest];
            });
        });
    }, [isOpen, api]);

    const handleCopy = useCallback(id => api.invoke('clipboard:copyItem', { id }), [api]);
    const handleDelete = useCallback(id => {
        setItems(prev => prev.filter(i => i.id !== id));
        api.invoke('clipboard:deleteItem', { id });
    }, [api]);
    const handleClear = useCallback(() => {
        setItems([]);
        api.invoke('clipboard:clearAll');
    }, [api]);

    // Anti-gravity positioning
    useLayoutEffect(() => {
        if (!isOpen) return;
        let rafId;
        const place = () => {
            const btn = document.querySelector('[data-dock-action="clipboard"]');
            if (!btn || !panelRef.current) return;
            const dockRect = btn.getBoundingClientRect();
            const pHeight = panelRef.current.offsetHeight;
            const vWidth = window.innerWidth;
            const vHeight = window.innerHeight;
            const GAP = 16, MARGIN = 12;

            let tx = dockRect.left + dockRect.width / 2 - PANEL_WIDTH / 2;
            let ty = dockRect.top - pHeight - GAP;
            if (ty < MARGIN) ty = dockRect.bottom + GAP;
            tx = Math.max(MARGIN, Math.min(tx, vWidth - PANEL_WIDTH - MARGIN));
            ty = Math.max(MARGIN, Math.min(ty, vHeight - pHeight - MARGIN));

            panelRef.current.style.left = `${Math.round(tx)}px`;
            panelRef.current.style.top = `${Math.round(ty)}px`;
            panelRef.current.style.transform = 'none';
        };
        const loop = () => { place(); rafId = requestAnimationFrame(loop); };
        rafId = requestAnimationFrame(() => requestAnimationFrame(loop));
        return () => cancelAnimationFrame(rafId);
    }, [isOpen]);

    if (!isOpen || !anchorRect) return null;

    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

    // Group by date label
    const groups = [];
    const seen = new Map();
    for (const item of filtered) {
        const lbl = dateLabel(item.timestamp);
        if (!seen.has(lbl)) { seen.set(lbl, []); groups.push({ lbl, items: seen.get(lbl) }); }
        seen.get(lbl).push(item);
    }

    const panel = (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: -9999, top: -9999,
                width: PANEL_WIDTH,
                // Fixed height so the inner scroll container has a solid reference
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
                // ⬇ Critical: disable Electron drag so all interactions work
                WebkitAppRegion: 'no-drag',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
                <span style={{ fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: '-0.01em' }}>
                    Clipboard History
                </span>

                {/* Filter select */}
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6, color: 'rgba(255,255,255,0.85)',
                        fontSize: 11, padding: '4px 8px', cursor: 'pointer',
                        outline: 'none', WebkitAppRegion: 'no-drag',
                        appearance: 'auto',
                    }}
                >
                    {FILTERS.map(f => <option key={f.value} value={f.value} style={{ background: '#1e2330' }}>{f.label}</option>)}
                </select>

                {/* Clear all */}
                {items.length > 0 && (
                    <button onClick={handleClear} style={{
                        background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.18)',
                        borderRadius: 6, color: '#ff8787', fontSize: 11, padding: '4px 9px',
                        cursor: 'pointer', WebkitAppRegion: 'no-drag',
                    }}>
                        Clear All
                    </button>
                )}

                {/* Close */}
                <button onClick={onClose} aria-label="Close" style={{
                    ...btnBase, color: 'rgba(255,255,255,0.4)', fontSize: 16, lineHeight: 1,
                }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                >✕</button>
            </div>

            {/* ── Scrollable list ── */}
            <div style={{
                flex: 1,
                overflowY: 'scroll',   // force scrollbar track
                minHeight: 0,          // allows flex child to shrink below content size
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                paddingRight: 4,
                WebkitAppRegion: 'no-drag',
                // Custom scrollbar
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.15) transparent',
            }}>
                {loading && (
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', padding: 24, margin: 0 }}>
                        Loading…
                    </p>
                )}

                {!loading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 }}>
                            {filter === 'all' ? 'Nothing copied yet.' : `No ${filter} items in history.`}
                        </p>
                    </div>
                )}

                {!loading && groups.map(({ lbl, items: grpItems }) => (
                    <div key={lbl}>
                        <div style={{
                            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '8px 2px 4px',
                        }}>{lbl}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {grpItems.map(item => (
                                <ItemRow key={item.id} item={item} onCopy={handleCopy} onDelete={handleDelete} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return ReactDOM.createPortal(panel, document.body);
}
