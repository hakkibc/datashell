import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { Tab } from '../../store/useTabStore';
import { useTabStore } from '../../store/useTabStore';

interface Props {
  tab: Tab;
}

export function TerminalPane({ tab }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#264f78',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#6a9955',
        yellow: '#d7ba7d',
        blue: '#569cd6',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#6a9955',
        brightYellow: '#d7ba7d',
        brightBlue: '#569cd6',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#e5e5e5',
      },
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      fontSize: 14,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (tab.connectionId) {
          window.electronAPI?.ssh.resize(tab.connectionId, terminal.cols, terminal.rows);
        }
      } catch {
        // Ignore resize errors during cleanup
      }
    });
    resizeObserver.observe(containerRef.current);

    // Connect SSH
    const connect = async () => {
      if (connectedRef.current) return;
      connectedRef.current = true;

      try {
        const connectionId = await window.electronAPI.ssh.connect(tab.sessionId);
        useTabStore.getState().updateTab(tab.id, { connectionId, status: 'connected' });

        await window.electronAPI.ssh.openShell(connectionId, {
          cols: terminal.cols,
          rows: terminal.rows,
        });

        // Data from SSH → terminal
        const removeDataListener = window.electronAPI.ssh.onData(connectionId, (data) => {
          terminal.write(data);
        });

        // Terminal input → SSH
        const inputDisposable = terminal.onData((input) => {
          window.electronAPI.ssh.sendInput(connectionId, input);
        });

        // Disconnected event
        const removeDisconnectListener = window.electronAPI.ssh.onDisconnected(
          connectionId,
          (reason) => {
            useTabStore.getState().updateTab(tab.id, {
              status: 'disconnected',
              errorMessage: reason,
            });
          }
        );

        // Cleanup on unmount
        return () => {
          removeDataListener();
          removeDisconnectListener();
          inputDisposable.dispose();
        };
      } catch (err) {
        const error = err as Error;
        useTabStore.getState().updateTab(tab.id, {
          status: 'error',
          errorMessage: error.message,
        });
      }
    };

    let cleanupConnection: (() => void) | undefined;
    connect().then((cleanup) => {
      cleanupConnection = cleanup;
    });

    return () => {
      resizeObserver.disconnect();
      cleanupConnection?.();
      terminal.dispose();
      if (tab.connectionId) {
        window.electronAPI?.ssh.disconnect(tab.connectionId);
      }
    };
  }, [tab.sessionId, tab.id]); // Reconnect when status resets

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
