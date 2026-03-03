import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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

function isHexColor(s) { return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s.trim()); }
function isLink(s) { return /^(https?:\/\/|ftp:\/\/|www\.)\S+/i.test(s.trim()); }

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
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: `${TYPE_COLORS[type] || '#aaa'}22`,
            color: TYPE_COLORS[type] || '#aaa',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            flexShrink: 0,
        }}>
            {TYPE_LABELS[type] || type}
        </span>
    );
}

function ColorSwatch({ hex }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: hex,
                border: '2px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
                boxShadow: `0 0 8px ${hex}66`,
            }} />
            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#fff', fontWeight: 600 }}>{hex}</span>
        </div>
    );
}

function ImagePreview({ src }) {
    return (
        <img
            src={src}
            alt="Clipboard image"
            style={{
                maxWidth: '100%',
                maxHeight: 80,
                borderRadius: 6,
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.08)',
            }}
        />
    );
}

function FilePreview({ content }) {
    const filenames = content.split('\n').map(f => f.trim()).filter(Boolean);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filenames.slice(0, 3).map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📄</span>
                    <span style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.85)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 240,
                    }}>{f.split(/[\\/]/).pop()}</span>
                </div>
            ))}
            {filenames.length > 3 && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>+{filenames.length - 3} more</span>
            )}
        </div>
    );
}

function LinkPreview({ url }) {
    let host = url;
    try { host = new URL(url.startsWith('www') ? `http://${url}` : url).hostname; } catch (_) { }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: '#06d6a0' }}>{host}</span>
            <span style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 260,
            }}>{url}</span>
        </div>
    );
}

function ItemRow({ item, onCopy, onDelete }) {
    const [copied, setCopied] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleCopy = () => {
        onCopy(item.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div
            onClick={handleCopy}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                background: copied ? 'rgba(74,193,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${copied ? 'rgba(74,193,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer',
                transition: 'background 0.15s, border 0.15s',
                position: 'relative',
            }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TypeBadge type={item.type} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flex: 1 }}>
                    {formatTime(item.timestamp)}
                </span>
                {copied && (
                    <span style={{ fontSize: 11, color: '#4ac1ff', fontWeight: 600 }}>Copied!</span>
                )}
                <button
                    onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                    title="Delete"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.25)',
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: '0 2px',
                        lineHeight: 1,
                        transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >✕</button>
            </div>

            {/* Content preview */}
            <div style={{ paddingLeft: 2 }}>
                {item.type === 'color' && <ColorSwatch hex={item.content.trim()} />}
                {item.type === 'image' && <ImagePreview src={item.preview} />}
                {item.type === 'file' && <FilePreview content={item.content} />}
                {item.type === 'link' && <LinkPreview url={item.content.trim()} />}
                {item.type === 'text' && (
                    <p style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.75)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
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

export default function ClipboardPanel({ isOpen, onClose, anchorRect }) {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const api = useMemo(() => window.electronAPI, []);

    // Load history on open
    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        api.invoke('clipboard:getHistory').then(list => {
            setItems(Array.isArray(list) ? list : []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [isOpen, api]);

    // Listen for live push updates
    useEffect(() => {
        if (!isOpen || !api.onClipboardUpdate) return;
        const unsub = api.onClipboardUpdate((newItem) => {
            setItems(prev => {
                // Dedup: remove same id if present, then prepend
                const filtered = prev.filter(i => i.id !== newItem.id && !(i.type === newItem.type && i.content === newItem.content));
                return [newItem, ...filtered];
            });
        });
        return unsub;
    }, [isOpen, api]);

    const handleCopy = useCallback(async (id) => {
        await api.invoke('clipboard:copyItem', { id });
    }, [api]);

    const handleDelete = useCallback(async (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
        await api.invoke('clipboard:deleteItem', { id });
    }, [api]);

    const handleClearAll = useCallback(async () => {
        setItems([]);
        await api.invoke('clipboard:clearAll');
    }, [api]);

    // Anti-gravity positioning — live query dock button each frame
    useLayoutEffect(() => {
        if (!isOpen) return;
        let rafId;

        const place = () => {
            const btn = document.querySelector('[data-dock-action="clipboard"]');
            if (!btn || !panelRef.current) return;

            const dockRect = btn.getBoundingClientRect();
            const pWidth = 380;
            const pHeight = panelRef.current.offsetHeight;
            const vWidth = window.innerWidth;
            const vHeight = window.innerHeight;
            const GAP = 16;
            const MARGIN = 12;

            let targetX = dockRect.left + dockRect.width / 2 - pWidth / 2;
            let targetY = dockRect.top - pHeight - GAP;

            if (targetY < MARGIN) targetY = dockRect.bottom + GAP;

            targetX = Math.max(MARGIN, Math.min(targetX, vWidth - pWidth - MARGIN));
            targetY = Math.max(MARGIN, Math.min(targetY, vHeight - pHeight - MARGIN));

            panelRef.current.style.left = `${Math.round(targetX)}px`;
            panelRef.current.style.top = `${Math.round(targetY)}px`;
            panelRef.current.style.transform = 'none';
        };

        const loop = () => { place(); rafId = requestAnimationFrame(loop); };
        rafId = requestAnimationFrame(() => requestAnimationFrame(loop));
        return () => cancelAnimationFrame(rafId);
    }, [isOpen]);

    if (!isOpen || !anchorRect) return null;

    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

    // Group by date
    const groups = [];
    const seen = new Map();
    for (const item of filtered) {
        const label = dateLabel(item.timestamp);
        if (!seen.has(label)) { seen.set(label, []); groups.push({ label, items: seen.get(label) }); }
        seen.get(label).push(item);
    }

    const panel = (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: -9999,
                top: -9999,
                width: 380,
                maxHeight: 360,
                borderRadius: 16,
                background: 'radial-gradient(circle at top left, #1e2330, #111418)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 14px 10px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                zIndex: 9500,
                pointerEvents: 'auto',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
        >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: '-0.01em' }}>
                    Clipboard History
                </span>

                {/* Filter */}
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        color: 'rgba(255,255,255,0.8)',
                        fontSize: 11,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        outline: 'none',
                    }}
                >
                    {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>

                {/* Clear all */}
                {items.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        title="Clear all history"
                        style={{
                            background: 'rgba(255,107,107,0.12)',
                            border: '1px solid rgba(255,107,107,0.2)',
                            borderRadius: 6,
                            color: '#ff8787',
                            fontSize: 11,
                            padding: '3px 8px',
                            cursor: 'pointer',
                        }}
                    >Clear All</button>
                )}

                {/* Close */}
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '0 2px',
                    }}
                    aria-label="Close"
                >✕</button>
            </div>

            {/* ── List ── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                paddingRight: 2,
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255,255,255,0.1) transparent',
            }}>
                {loading && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: 16 }}>
                        Loading…
                    </p>
                )}

                {!loading && filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0 }}>
                            {filter === 'all' ? 'Nothing copied yet.' : `No ${filter} items in history.`}
                        </p>
                    </div>
                )}

                {!loading && groups.map(({ label, items: groupItems }) => (
                    <div key={label}>
                        <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.25)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            padding: '6px 2px 3px',
                        }}>{label}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {groupItems.map(item => (
                                <ItemRow
                                    key={item.id}
                                    item={item}
                                    onCopy={handleCopy}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return ReactDOM.createPortal(panel, document.body);
}
