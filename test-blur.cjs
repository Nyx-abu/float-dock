const { app, BrowserWindow, ipcMain } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 600, height: 600,
    transparent: true, frame: false,
    backgroundMaterial: 'acrylic',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  
  win.loadURL('data:text/html,<html><body style="background:transparent; margin:0; overflow:hidden;"><div id="box" style="width:200px; height:200px; background:rgba(255,0,0,0.5); margin:100px;">Drag me</div><script>const { ipcRenderer } = require("electron"); let x = 100; setInterval(() => { x += 5; if(x > 300) x = 100; document.getElementById("box").style.marginLeft = x + "px"; ipcRenderer.send("shape", [{x: x, y: 100, width: 200, height: 200}]); }, 100);</script></body></html>');
  
  ipcMain.on('shape', (e, rects) => {
    win.setShape(rects);
  });
  
  setTimeout(() => app.quit(), 3000);
});
