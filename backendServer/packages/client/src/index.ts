/**
 * @comeback/client
 * Remote agent library — terminal handler utilities for use with comeback-server.
 *
 * The executable client script (src/client.ts) connects to a RemoteServer
 * over WebSocket and handles commands. Use it via the bin entry.
 *
 * This module exports terminal-handler utilities for programmatic embedding.
 */
export {
  createTerminalSession,
  sendTerminalInput,
  resizeTerminalSession,
  closeTerminalSession,
  closeAllSessions,
  getActiveSessions,
  getSessionInfo,
} from "./terminal-handler.ts";
