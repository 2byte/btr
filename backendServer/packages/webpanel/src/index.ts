/**
 * @comeback/webpanel
 *
 * Web panel + backend server library for managing remote agents.
 *
 * @example
 * ```typescript
 * import { ServerBuilder } from "@comeback/webpanel";
 *
 * await ServerBuilder.init()
 *   .port(8080)
 *   .webPanelPort(3000)
 *   .enableAuth()
 *   .authTokens(["my-secret-token"])
 *   .build()
 *   .start();
 * ```
 */

// Core server
export { RemoteServer } from "./RemoteServer.ts";
export type {
  ClientData,
  MessageType,
  IncomingMessage,
  OutgoingMessage,
  ExtendedWebSocket,
  RemoteServerOptions,
} from "./RemoteServer.ts";

// Authentication
export { AuthManager } from "./AuthManager.ts";
export type { AuthConfig, TokenMetadata } from "./AuthManager.ts";

// Client communicator
export { ClientCommunicator } from "./ClientCommunicator.ts";
export type {
  CommandOptions,
  CommandResult,
  ClientCommunicatorEvents,
} from "./ClientCommunicator.ts";

// Terminal session manager
export { TerminalSessionManager } from "./TerminalSessionManager.ts";
export type {
  TerminalSessionOptions,
  TerminalSession,
  TerminalSessionEvents,
} from "./TerminalSessionManager.ts";

// Web panel
export { WebPanel } from "./WebPanel.ts";
export type { WebPanelOptions } from "./WebPanel.ts";

// Server builder
export { ServerBuilder, ServerRunner } from "./ServerRunner.ts";
export type { ServerConfig } from "./ServerRunner.ts";

// Generic HTTP server
export { Server } from "./Server.ts";
export type { RouteHandler } from "./Server.ts";
