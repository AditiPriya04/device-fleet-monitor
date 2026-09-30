const request = require('supertest');
const { buildApp } = require('./helpers');

describe('heartbeat handling', () => {
  let app;
  beforeEach(async () => {
    ({ app } = buildApp());
    await request(app).post('/devices').send({ id: 'd1', name: 'Device 1' });
  });

  test('updates last_heartbeat and marks device ONLINE', async () => {
    const res = await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:00Z', status: 'OK', cpu_usage: 42, signal_strength: -71 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ONLINE',
      reported_status: 'OK',
      cpu_usage: 42,
      signal_strength: -71,
      last_heartbeat: '2026-09-30T10:00:00.000Z',
    });
  });

  test('returns 404 for unknown device', async () => {
    const res = await request(app)
      .post('/devices/ghost/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:00Z', status: 'OK' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid timestamp', async () => {
    const res = await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: 'yesterday', status: 'OK' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for missing status', async () => {
    const res = await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:00Z' });
    expect(res.status).toBe(400);
  });

  test('ignores out-of-order heartbeats', async () => {
    await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:10Z', status: 'OK' });
    const res = await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:05Z', status: 'DEGRADED' });
    expect(res.status).toBe(200);
    expect(res.body.reported_status).toBe('OK');
    expect(res.body.device_timestamp).toBe('2026-09-30T10:00:10Z');
  });
});
