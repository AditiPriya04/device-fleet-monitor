const config = require('./config');
const createApp = require('./app');
const MemoryRepository = require('./repositories/memoryRepository');
const { createDeviceService } = require('./services/deviceService');

const service = createDeviceService({
  repo: new MemoryRepository(),
  timeoutMs: config.timeoutSeconds * 1000,
});

const server = createApp(service).listen(config.port, () =>
  console.log(`Fleet monitor listening on :${config.port} (timeout ${config.timeoutSeconds}s)`)
);

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
