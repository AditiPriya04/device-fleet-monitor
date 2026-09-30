class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * @param {object} opts
 * @param {object} opts.repo       repository with findById / findAll / save
 * @param {() => number} [opts.now] clock returning epoch ms (injectable for tests)
 * @param {number} [opts.timeoutMs] heartbeat timeout in ms
 */
function createDeviceService({ repo, now = () => Date.now(), timeoutMs = 30000 }) {
  // ONLINE/OFFLINE is computed at read time from the server's receive time.
  // A heartbeat exactly `timeoutMs` old is still ONLINE; older is OFFLINE.
  const toView = (d) => {
    const online = d.lastReceivedAt !== null && now() - d.lastReceivedAt <= timeoutMs;
    return {
      id: d.id,
      name: d.name,
      status: online ? 'ONLINE' : 'OFFLINE',
      last_heartbeat: d.lastReceivedAt === null ? null : new Date(d.lastReceivedAt).toISOString(),
      device_timestamp: d.deviceTimestamp,
      reported_status: d.reportedStatus,
      cpu_usage: d.cpuUsage,
      signal_strength: d.signalStrength,
    };
  };

  const getOrThrow = (id) => {
    const d = repo.findById(id);
    if (!d) throw new AppError(404, `Device ${id} not found`);
    return d;
  };

  return {
    register({ id, name }) {
      if (repo.findById(id)) throw new AppError(409, `Device ${id} already exists`);
      return toView(
        repo.save({
          id,
          name,
          lastReceivedAt: null,
          deviceTimestamp: null,
          reportedStatus: null,
          cpuUsage: null,
          signalStrength: null,
        })
      );
    },

    heartbeat(id, { timestamp, status, cpu_usage, signal_strength }) {
      const d = getOrThrow(id);
      // Ignore out-of-order packets so old data can't overwrite newer data.
      if (d.deviceTimestamp && new Date(timestamp) < new Date(d.deviceTimestamp)) {
        return toView(d);
      }
      d.lastReceivedAt = now();
      d.deviceTimestamp = timestamp;
      d.reportedStatus = status;
      d.cpuUsage = cpu_usage ?? null;
      d.signalStrength = signal_strength ?? null;
      return toView(repo.save(d));
    },

    get(id) {
      return toView(getOrThrow(id));
    },

    list(status) {
      const all = repo.findAll().map(toView);
      return status ? all.filter((d) => d.status === status) : all;
    },

    summary() {
      const all = repo.findAll().map(toView);
      const online = all.filter((d) => d.status === 'ONLINE').length;
      return { total: all.length, online, offline: all.length - online };
    },
  };
}

module.exports = { createDeviceService, AppError };
