import { ServerBuilder } from "./ServerRunner"

const tokens = process.env.API_TOKEN ? [process.env.API_TOKEN] : [];

if (process.env.API_TOKENS) {
    const envTokens = process.env.API_TOKENS.split(',').map(t => t.trim()).filter(t => t);
    tokens.push(...envTokens);
}

const server = ServerBuilder.init()
  .port(process.env.REMOTE_SERVER_PORT ? parseInt(process.env.REMOTE_SERVER_PORT) : 8013)
  .webPanelHostname(process.env.WEB_PANEL_HOST || 'localhost')
  .webPanelPort(process.env.WEB_PANEL_PORT ? parseInt(process.env.WEB_PANEL_PORT) : 3034)
  .serverHostname(process.env.REMOTE_SERVER_HOST || 'localhost')
  .enableAuth(true)
  .authTokens(tokens)
  .build();

server.run();