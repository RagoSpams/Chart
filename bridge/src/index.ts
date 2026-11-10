import { createApp } from './app.js';
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
if (!process.env.CHART_BRIDGE_API_KEY || process.env.CHART_BRIDGE_API_KEY.length < 32) throw new Error('Set CHART_BRIDGE_API_KEY to a random value of at least 32 characters');
createApp().listen(port, host, () => console.log(`bridge service listening on ${host}:${port}`));
