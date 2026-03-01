const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, data) => callback(data));
  },
  invoke: (channel, data) => {
    // whitelist channels
    if (channel === 'clipboard:copy' || channel === 'notify') {
      return ipcRenderer.invoke(channel, data);
    }
  },
  onNotification: (callback) => {
    ipcRenderer.on('show-notification', (event, data) => callback(data));
  },
  clipboard: {
    copy: (text) => ipcRenderer.invoke('clipboard:copy', text),
  },
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
});
