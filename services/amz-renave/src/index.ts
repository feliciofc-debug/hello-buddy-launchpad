import { loadConfig } from "./config.js";
import { createRenaveServer } from "./server.js";

const config = loadConfig();
const server = createRenaveServer(config);

server.listen(config.port, config.host);
