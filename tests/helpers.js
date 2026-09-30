const createApp = require('../src/app');
const MemoryRepository = require('../src/repositories/memoryRepository');
const { createDeviceService } = require('../src/services/deviceService');

// Builds an app with a controllable clock so tests never wait in real time.
function buildApp(startIso = '2026-09-30T10:00:00Z') {
  const clock = { time: Date.parse(startIso) };
  const service = createDeviceService({
    repo: new MemoryRepository(),
    now: () => clock.time,
    timeoutMs: 30000,
  });
  return { app: createApp(service), clock };
}

module.exports = { buildApp };
