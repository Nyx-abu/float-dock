# Float Dock - React + Vite + Electron

A modern, macOS-style floating AI dock with React, Vite, and Electron. Features a beautiful glassmorphic design with integrated Gemini AI.

## 📁 Project Structure

```
float-dock/
├── src/
│   ├── components/
│   │   ├── ResponseArea.jsx      # Message display with scrolling
│   │   └── InputArea.jsx         # Textarea input + send button
│   ├── styles/
│   │   ├── index.css             # Global styles
│   │   ├── App.css               # Main layout
│   │   ├── ResponseArea.css      # Message styling
│   │   └── InputArea.css         # Input styling
│   ├── App.jsx                   # Main React component
│   └── main.jsx                  # React entry point
├── index.html                    # Vite HTML template
├── vite.config.js                # Vite configuration
├── electron-main.js              # Electron main process
├── preload.js                    # Secure IPC bridge
├── package.json                  # Dependencies & scripts
├── .env                          # API keys
└── dist/                         # Build output (created by build)
```

## ✨ Features

- **React UI** - Modern component-based interface
- **Vite** - Lightning-fast HMR for development
- **Electron** - Cross-platform desktop app
- **Gemini AI** - Integrated AI responses
- **Glassmorphic Design** - Modern blur + transparency effects
- **Auto-scaling Textarea** - Dynamic input field
- **Scrollable Messages** - Full message history
- **macOS Dock Style** - Minimalist floating window
- **Dark Mode** - Easy on the eyes

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set API Key

Create `.env` file:

```
VITE_GEMINI_API_KEY=your_api_key_here
```

Get your free key at: https://makersuite.google.com/app/apikey

### 3. Development Mode

**Terminal 1 - Start Vite dev server:**
```bash
npm run dev:vite
```

**Terminal 2 - Start Electron:**
```bash
npm run dev:electron
```

Or use combined script:
```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## 📋 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev:vite` | Start Vite dev server (port 5173) |
| `npm run dev:electron` | Launch Electron with dev tools |
| `npm run dev` | Run both (requires concurrently) |
| `npm run build` | Build optimized production bundle |
| `npm start` | Run production build |

## 🎨 Design System

### Colors

- **Background**: `rgba(20, 25, 40, 0.92)` - Deep slate
- **Accent**: Blue/Purple gradients
- **Text**: Light slate shades

### Layout

- **Window**: 500x650px (macOS dock style)
- **Header**: 36px with title + close button
- **Messages**: Scrollable main area
- **Input**: Auto-resizing textarea + send button

## 🔧 Configuration

### Window Properties

Edit `electron-main.js`:

```javascript
width: 500,           // Window width
height: 650,          // Window height
alwaysOnTop: true,    // Always on top
resizable: false,     // Disable resize
frame: false,         // Frameless
transparent: true,    // See-through
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Shift + D` | Toggle visibility |
| `Enter` | Send message |
| `Shift + Enter` | New line |

## 🔐 Security

- ✅ Context isolation enabled
- ✅ Preload bridge for IPC
- ✅ Sandbox mode active
- ✅ No remote code execution
- ✅ Clipboard auto-validation

## 📦 Architecture

```
┌─ Electron Main Process
│  ├─ Window Management
│  ├─ IPC Handlers
│  └─ Clipboard Access
│
├─ Preload Bridge
│  └─ Safe API Exposure
│
└─ React Renderer
   ├─ Components
   ├─ State Management
   └─ Gemini Integration
```

## 🤖 Gemini Integration

The app uses the free `gemini-3-flash-preview` model. Message handling in `App.jsx`:

```jsx
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: message,
});
```

## 🐛 Troubleshooting

**Issue: White screen on startup**
```bash
npm run build
npm start
```

**Issue: Dev server not loading**
- Ensure `npm run dev:vite` is running first
- Check port 5173 is not blocked
- Clear browser cache

**Issue: Preload errors**
- Verify preload.js uses CommonJS (require)
- Check contextIsolation is true in electron-main.js

**Issue: API not responding**
- Verify API key in `.env`
- Check internet connection
- Review browser console for errors

## 📝 Development Tips

1. **Hot Reload**: Changes to React components auto-refresh
2. **Dev Tools**: Accessible via DevTools button in header
3. **Console Logs**: Check both terminal and DevTools
4. **Build Size**: Production build ~2MB (gzipped)

## 🔄 Extending the App

### Add New Component

1. Create `src/components/MyComponent.jsx`
2. Import in `App.jsx`
3. Add styling in `src/styles/MyComponent.css`

### Add IPC Handler

1. Add handler in `electron-main.js`:
   ```javascript
   ipcMain.handle('my-channel', async (event, data) => {
     return result;
   });
   ```

2. Expose in `preload.js`:
   ```javascript
   myMethod: (data) => ipcRenderer.invoke('my-channel', data)
   ```

3. Use in React:
   ```javascript
   await window.electronAPI.myMethod(data);
   ```

## 📄 License

MIT

---

**Ready to go!** Start with `npm run dev:vite` in one terminal and `npm run dev:electron` in another. 🚀
