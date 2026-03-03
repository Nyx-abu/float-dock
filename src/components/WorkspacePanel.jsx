import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import SaveWorkspaceModal from './SaveWorkspaceModal';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WorkspacePanel({ isOpen, onClose, anchorRect }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const panelRef = useRef(null);

  const api = useMemo(() => window.electronAPI, []);

  async function refreshList() {
    try {
      setError(null);
      const list = await api.invoke('workspace:list');
      setWorkspaces(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setError('Failed to load workspaces');
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function handleSave(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      setError(null);
      await api.invoke('workspace:save', { name: trimmed });
      await refreshList();
      setSaveModalOpen(false);
    } catch (e) {
      console.error(e);
      setError('Failed to save workspace');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(name) {
    setLoading(true);
    try {
      setError(null);
      await api.invoke('workspace:restore', { name });
    } catch (e) {
      console.error(e);
      setError('Failed to restore workspace');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(name) {
    setLoading(true);
    try {
      setError(null);
      await api.invoke('workspace:delete', { name });
      await refreshList();
    } catch (e) {
      console.error(e);
      setError('Failed to delete workspace');
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    if (!isOpen) return;

    let rafId;

    const place = () => {
      const btn = document.querySelector('[data-dock-action="folder"]');
      if (!btn || !panelRef.current) return;

      const dockRect = btn.getBoundingClientRect();
      const pWidth = 360;
      const pHeight = panelRef.current.offsetHeight;
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      const GAP = 16;
      const MARGIN = 12;

      // Default: above the dock button, horizontally centered on it
      let targetX = dockRect.left + dockRect.width / 2 - pWidth / 2;
      let targetY = dockRect.top - pHeight - GAP;

      // Flip below if not enough room above
      if (targetY < MARGIN) {
        targetY = dockRect.bottom + GAP;
      }

      // Clamp within viewport
      targetX = Math.max(MARGIN, Math.min(targetX, vWidth - pWidth - MARGIN));
      targetY = Math.max(MARGIN, Math.min(targetY, vHeight - pHeight - MARGIN));

      panelRef.current.style.left = `${Math.round(targetX)}px`;
      panelRef.current.style.top = `${Math.round(targetY)}px`;
      panelRef.current.style.transform = 'none';
    };

    const loop = () => {
      place();
      rafId = requestAnimationFrame(loop);
    };

    // Double-rAF: first frame lets React commit the DOM,
    // second frame runs after the BrowserWindow has resized (dock:setExpanded)
    rafId = requestAnimationFrame(() => requestAnimationFrame(loop));

    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  if (!isOpen || !anchorRect) return null;

  const panelWidth = 360;

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        width: panelWidth,
        maxHeight: 360,
        borderRadius: 16,
        background: 'radial-gradient(circle at top left, #202733, #12141a)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'none',
        padding: 16,
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 9500,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Workspaces</div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: 18,
          }}
          aria-label="Close workspace panel"
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            flex: 1,
          }}
        >
          Save your current layout as a named workspace snapshot.
        </div>
        <button
          onClick={() => setSaveModalOpen(true)}
          disabled={loading}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            background: loading
              ? 'rgba(255,255,255,0.15)'
              : 'linear-gradient(135deg, #4ac1ff, #6e7dff)',
            color: 'white',
            fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          Save Current
        </button>
      </div>

      {error && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</div>}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.25)',
          padding: 6,
        }}
      >
        {workspaces.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              padding: 16,
            }}
          >
            No workspaces yet. Save your current workspace to get started.
          </div>
        ) : (
          workspaces.map((ws) => (
            <div
              key={ws.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: 6,
                marginBottom: 4,
                background: 'rgba(255,255,255,0.03)',
                gap: 8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {ws.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {formatDate(ws.createdAt)}
                </div>
              </div>
              <button
                onClick={() => handleRestore(ws.name)}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4ac1ff, #6e7dff)',
                  color: 'white',
                  fontSize: 11,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                Restore
              </button>
              <button
                onClick={() => handleDelete(ws.name)}
                disabled={loading}
                style={{
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'rgba(255, 107, 107, 0.2)',
                  color: '#ff8787',
                  fontSize: 11,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {ReactDOM.createPortal(panel, document.body)}
      <SaveWorkspaceModal
        isOpen={saveModalOpen}
        onSave={handleSave}
        onClose={() => setSaveModalOpen(false)}
      />
    </>
  );
}

