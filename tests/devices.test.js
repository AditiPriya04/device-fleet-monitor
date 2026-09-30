const request = require('supertest');
const { buildApp } = require('./helpers');

describe('device registration and lookup', () => {
  let app;
  beforeEach(() => ({ app } = buildApp()));

  test('registers a device (starts OFFLINE with no heartbeat)', async () => {
    const res = await request(app).post('/devices').send({ id: 'd1', name: 'Device 1' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 'd1',
      name: 'Device 1',
      status: 'OFFLINE',
      last_heartbeat: null,
    });
  });

  test('rejects duplicate id with 409', async () => {
    await request(app).post('/devices').send({ id: 'd1', name: 'Device 1' });
    const res = await request(app).post('/devices').send({ id: 'd1', name: 'Again' });
    expect(res.status).toBe(409);
  });

  test('rejects invalid body with 400', async () => {
    const res = await request(app).post('/devices').send({ id: '', name: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/devices')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });

  test('GET /devices lists all devices', async () => {
    await request(app).post('/devices').send({ id: 'd1', name: 'A' });
    await request(app).post('/devices').send({ id: 'd2', name: 'B' });
    const res = await request(app).get('/devices');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('GET /devices/:id returns the device', async () => {
    await request(app).post('/devices').send({ id: 'd1', name: 'A' });
    const res = await request(app).get('/devices/d1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('d1');
  });

  test('GET /devices/:id returns 404 for unknown device', async () => {
    const res = await request(app).get('/devices/nope');
    expect(res.status).toBe(404);
  });
});
