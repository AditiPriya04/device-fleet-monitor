const { z } = require('zod');

const registerSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
});

const heartbeatSchema = z.object({
  timestamp: z.string().datetime(),
  status: z.string().trim().min(1),
  cpu_usage: z.number().optional(),
  signal_strength: z.number().optional(),
});

module.exports = { registerSchema, heartbeatSchema };
