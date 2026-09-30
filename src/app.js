const express = require('express');
const devicesRouter = require('./routes/devices');

function createApp(service) {
  const app = express();
  app.use(express.json());
  app.use(devicesRouter(service));

  // Malformed JSON, validation and domain errors all end up here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    const status = err.statusCode || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
  });
  return app;
}

module.exports = createApp;
