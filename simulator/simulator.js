#!/usr/bin/env node
// Simulates devices sending heartbeats to the fleet monitor.
//
// Usage:
//   node simulator/simulator.js
//   node simulator/simulator.js --stop device-03 --after 60
//   node simulator/simulator.js --url http://localhost:3000 --devices 8 --interval 5
//
// Options:
//   --url        API base URL            (default http://localhost:3000)
//   --devices    number of devices       (default 5)
//   --interval   seconds between beats   (default 5)
//   --stop       device id to stop       (e.g. device-03)
//   --after      seconds before stopping (default 30, used with --stop)

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const baseUrl = opt('url', 'http://localhost:3000');
const count = Number(opt('devices', 5));
const intervalMs = Number(opt('interval', 5)) * 1000;
const stopId = opt('stop', null);
const stopAfterMs = Number(opt('after', 30)) * 1000;

const ids = Array.from({ length: count }, (_, i) => `device-${String(i + 1).padStart(2, '0')}`);
const timers = new Map();

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

async function register(id) {
  const res = await post('/devices', { id, name: `Lab ${id}` });
  if (res.status === 201) console.log(`registered ${id}`);
  else if (res.status === 409) console.log(`${id} already registered`);
  else throw new Error(`register ${id} failed: ${res.status}`);
}

async function beat(id) {
  try {
    const res = await post(`/devices/${id}/heartbeat`, {
      timestamp: new Date().toISOString(),
      status: 'OK',
      cpu_usage: Math.round(20 + Math.random() * 60),
      signal_strength: -Math.round(50 + Math.random() * 40),
    });
    console.log(`${new Date().toISOString()} ${id} -> ${res.status}`);
  } catch (err) {
    console.error(`${id} heartbeat failed: ${err.message}`);
  }
}

async function main() {
  try {
    for (const id of ids) await register(id);
  } catch (err) {
    console.error(`Could not reach ${baseUrl}. Is the server running? (${err.message})`);
    process.exit(1);
  }

  for (const id of ids) {
    beat(id);
    timers.set(id, setInterval(() => beat(id), intervalMs));
  }

  if (stopId) {
    if (!ids.includes(stopId)) {
      console.error(`--stop ${stopId} is not one of: ${ids.join(', ')}`);
      process.exit(1);
    }
    setTimeout(() => {
      clearInterval(timers.get(stopId));
      console.log(`*** ${stopId} stopped; it should go OFFLINE ~30s from now ***`);
    }, stopAfterMs);
  }

  process.on('SIGINT', () => process.exit(0));
}

main();
