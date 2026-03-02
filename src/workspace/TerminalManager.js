import os from 'os';
import { spawn } from 'child_process';

/**
 * NOTE:
 * The original plan used node-pty, but that requires native builds.
 * This implementation restores terminals as *reconstruction instructions*
 * by launching a new terminal window with cwd + optional startup command.
 *
 * @typedef {import('./SnapshotManager').TerminalSnapshot} TerminalSnapshot
 */

export class TerminalManager {
  /**
   * @param {TerminalSnapshot[]} snapshots
   */
  restoreTerminals(snapshots) {
    for (const snap of snapshots) {
      this.launchTerminal(snap);
    }
  }

  /**
   * @param {TerminalSnapshot} snap
   */
  launchTerminal(snap) {
    const platform = os.platform();
    if (platform !== 'win32') {
      console.warn('[TerminalManager] Non-Windows terminal restore stubbed');
      return;
    }

    const cwd = snap.cwd || process.cwd();
    const shell = (snap.shell || 'powershell.exe').toLowerCase();
    const startup = snap.startupCommand ? String(snap.startupCommand) : '';

    // Use `cmd /c start` to open a new windowed terminal.
    // PowerShell: -NoExit keeps it open.
    const isPwsh = shell.includes('powershell');
    const command = isPwsh
      ? `cd "${cwd}"; ${startup}`.trim()
      : startup;

    const args = isPwsh
      ? ['/c', 'start', '""', 'powershell.exe', '-NoExit', '-Command', command]
      : ['/c', 'start', '""', 'cmd.exe', '/k', `cd /d "${cwd}" && ${command}`];

    try {
      const child = spawn('cmd.exe', args, { detached: true, stdio: 'ignore' });
      child.unref();
    } catch (err) {
      console.warn('[TerminalManager] Failed to launch terminal', err);
    }
  }
}

