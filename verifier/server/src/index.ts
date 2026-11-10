import { createApp } from './app.js';
import * as backend from './midnight.js';
const port = Number(process.env.PORT || 4200);
const host = process.env.HOST || '127.0.0.1';
createApp(backend).listen(port, host, () => console.log(`verifier-server listening on ${host}:${port}`));
