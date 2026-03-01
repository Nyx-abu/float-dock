import { useState } from 'react';
import DockMenu from './components/DockMenu';
import './styles/App.css';

export default function App() {
  const [activePanel, setActivePanel] = useState(null);

  const handleAction = (action) => {
    if (action === 'snaps-restore') {
      // Handle snapshot restore
      console.log('Restoring workspace from snapshot...');
      // The actual restore logic is in DockMenu component
    } else {
      console.log('Action:', action);
      setActivePanel(action);
    }
  };

  return (
    <div className="dock-container">
      <DockMenu onAction={handleAction} activePanel={activePanel} />
    </div>
  );
}
