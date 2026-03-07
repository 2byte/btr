import { ServerBuilder } from "./ServerRunner"

const tokens = process.env.API_TOKEN ? [process.env.API_TOKEN] : [];

if (process.env.API_TOKENS) {
    const envTokens = process.env.API_TOKENS.split(',').map(t => t.trim()).filter(t => t);
    tokens.push(...envTokens);
}

const server = ServerBuilder.init()
  .port(8013)
  .webPanelPort(3034)
  .build();

server.run();