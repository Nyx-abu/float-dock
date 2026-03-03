const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel, callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  invoke: (channel, data) => {
    const allowed = [
      'clipboard:copy',
      'clipboard:getHistory',
      'clipboard:deleteItem',
      'clipboard:clearAll',
      'clipboard:copyItem',
      'notify',
      'workspace:save',
      'workspace:list',
      'workspace:restore',
      'workspace:delete',
      'dock:applyLayout',
      'dock:setExpanded',
    ];
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
  onNotification: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('show-notification', handler);
    return () => ipcRenderer.removeListener('show-notification', handler);
  },
  onDockLayoutRestore: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('workspace:dockLayoutRestore', handler);
    return () => ipcRenderer.removeListener('workspace:dockLayoutRestore', handler);
  },
  onClipboardUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('clipboard:newItem', handler);
    return () => ipcRenderer.removeListener('clipboard:newItem', handler);
  },
  clipboard: {
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  },
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
});
