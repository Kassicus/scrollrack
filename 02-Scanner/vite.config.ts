import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { WebSocketServer } from 'ws'

// Simple plugin to forward browser console logs to terminal
function terminalLogger(): Plugin {
  let wss: WebSocketServer | null = null

  return {
    name: 'terminal-logger',
    configureServer(server) {
      wss = new WebSocketServer({ noServer: true })

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url === '/__terminal_log') {
          wss?.handleUpgrade(request, socket, head, (ws) => {
            ws.on('message', (data) => {
              try {
                const { level, args } = JSON.parse(data.toString())
                const prefix = level === 'error' ? '\x1b[31m[ERROR]\x1b[0m' :
                               level === 'warn' ? '\x1b[33m[WARN]\x1b[0m' :
                               '\x1b[36m[LOG]\x1b[0m'
                console.log(prefix, ...args)
              } catch {}
            })
          })
        }
      })
    },
    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { type: 'module' },
        children: `
          (function() {
            const ws = new WebSocket('ws://' + location.host + '/__terminal_log');
            const send = (level, args) => {
              if (ws.readyState === 1) {
                ws.send(JSON.stringify({ level, args: args.map(a =>
                  typeof a === 'object' ? JSON.stringify(a) : String(a)
                )}));
              }
            };
            const orig = { log: console.log, warn: console.warn, error: console.error };
            console.log = (...args) => { orig.log(...args); send('log', args); };
            console.warn = (...args) => { orig.warn(...args); send('warn', args); };
            console.error = (...args) => { orig.error(...args); send('error', args); };
          })();
        `,
        injectTo: 'head-prepend'
      }]
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), terminalLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
