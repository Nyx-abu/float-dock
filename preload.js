const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel, callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on(channel, handler);
    // return unsubscribe
    return () => ipcRenderer.removeListener(channel, handler);
  },
  invoke: (channel, data) => {
    // whitelist channels
    if (
      channel === 'clipboard:copy' ||
      channel === 'notify' ||
      channel === 'workspace:save' ||
      channel === 'workspace:list' ||
      channel === 'workspace:restore' ||
      channel === 'workspace:delete' ||
      channel === 'dock:applyLayout' ||
      channel === 'dock:setExpanded'
    ) {
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
  clipboard: {
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  },
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
});
