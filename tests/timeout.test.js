const request = require('supertest');
const { buildApp } = require('./helpers');

describe('30 second ONLINE/OFFLINE rule', () => {
  let app, clock;
  beforeEach(async () => {
    ({ app, clock } = buildApp());
    await request(app).post('/devices').send({ id: 'd1', name: 'Device 1' });
    await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:00:00Z', status: 'OK' });
  });

  const statusAfter = async (ms) => {
    clock.time += ms;
    return (await request(app).get('/devices/d1')).body.status;
  };

  test('ONLINE at 29s', async () => expect(await statusAfter(29000)).toBe('ONLINE'));
  test('ONLINE at exactly 30s', async () => expect(await statusAfter(30000)).toBe('ONLINE'));
  test('OFFLINE at 30.001s', async () => expect(await statusAfter(30001)).toBe('OFFLINE'));

  test('a new heartbeat brings an OFFLINE device back ONLINE', async () => {
    expect(await statusAfter(60000)).toBe('OFFLINE');
    await request(app)
      .post('/devices/d1/heartbeat')
      .send({ timestamp: '2026-09-30T10:01:00Z', status: 'OK' });
    expect((await request(app).get('/devices/d1')).body.status).toBe('ONLINE');
  });
});

describe('summary and status filter', () => {
  test('counts online and offline devices and filters by status', async () => {
    const { app, clock } = buildApp();
    for (const id of ['a', 'b', 'c']) {
      await request(app).post('/devices').send({ id, name: id });
    }
    await request(app).post('/devices/a/heartbeat').send({ timestamp: '2026-09-30T10:00:00Z', status: 'OK' });
    clock.time += 20000;
    await request(app).post('/devices/b/heartbeat').send({ timestamp: '2026-09-30T10:00:20Z', status: 'OK' });
    clock.time += 20000; // a is 40s old (OFFLINE), b is 20s old (ONLINE), c never sent one

    const summary = await request(app).get('/summary');
    expect(summary.body).toEqual({ total: 3, online: 1, offline: 2 });

    const online = await request(app).get('/devices?status=ONLINE');
    expect(online.body.map((d) => d.id)).toEqual(['b']);

    const offline = await request(app).get('/devices?status=OFFLINE');
    expect(offline.body.map((d) => d.id).sort()).toEqual(['a', 'c']);
  });

  test('rejects an invalid status filter with 400', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/devices?status=BROKEN');
    expect(res.status).toBe(400);
  });
});
