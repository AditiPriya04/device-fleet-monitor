const express = require('express');
const { registerSchema, heartbeatSchema } = require('../validation');
const { AppError } = require('../services/deviceService');

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      400,
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
  }
  return result.data;
}

module.exports = function devicesRouter(service) {
  const router = express.Router();

  router.post('/devices', (req, res) =>
    res.status(201).json(service.register(parse(registerSchema, req.body)))
  );

  router.post('/devices/:id/heartbeat', (req, res) =>
    res.json(service.heartbeat(req.params.id, parse(heartbeatSchema, req.body)))
  );

  router.get('/devices', (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['ONLINE', 'OFFLINE'].includes(status)) {
      throw new AppError(400, 'status must be ONLINE or OFFLINE');
    }
    res.json(service.list(status));
  });

  router.get('/devices/:id', (req, res) => res.json(service.get(req.params.id)));
  router.get('/summary', (req, res) => res.json(service.summary()));

  return router;
};
