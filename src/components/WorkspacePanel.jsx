import { useEffect, useMemo, useState } from 'react';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WorkspacePanel({ isOpen, onClose }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  async function handleSave() {
    const name = nameInput.trim();
    if (!name) return;
    setLoading(true);
    try {
      setError(null);
      await api.invoke('workspace:save', { name });
      setNameInput('');
      await refreshList();
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

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 360,
          maxHeight: 520,
          borderRadius: 16,
          background: 'radial-gradient(circle at top left, #202733, #12141a)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.6)',
          padding: 16,
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
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
          <input
            type="text"
            placeholder="Workspace name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(0,0,0,0.35)',
              color: 'white',
              fontSize: 13,
            }}
          />
          <button
            onClick={handleSave}
            disabled={loading || !nameInput.trim()}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: loading || !nameInput.trim()
                ? 'rgba(255,255,255,0.15)'
                : 'linear-gradient(135deg, #4ac1ff, #6e7dff)',
              color: 'white',
              fontSize: 13,
              cursor: loading || !nameInput.trim() ? 'default' : 'pointer',
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
    </div>
  );
}

