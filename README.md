# Device Fleet Monitor

A small REST service that tracks a fleet of simulated devices. Each device sends
periodic heartbeats; the service exposes each device's current status
(`ONLINE` / `OFFLINE`) and a fleet summary.

## Design

```
Simulator -> HTTP -> Express routes -> DeviceService -> Repository (in-memory)
```

- **routes/devices.js** – thin HTTP layer: validates input (zod), calls the service.
- **services/deviceService.js** – all business rules (duplicates, 404s, status calculation).
- **repositories/memoryRepository.js** – the only code that touches storage. Swapping in
  a database means writing another class with `findById`, `findAll`, `save`.
- **app.js vs server.js** – `app.js` builds the Express app without listening, so tests
  import it directly. `server.js` reads config and starts listening.

**Timeout rule.** Status is never stored. It is computed on every read as
`now - lastReceivedAt <= 30s` -> `ONLINE`, otherwise `OFFLINE`. There is no background
job, so status is always correct at the moment of the request. The service takes an
injectable `now()` clock, so tests cover the 30-second rule without waiting.

**Boundary.** A heartbeat exactly 30.000s old is `ONLINE`; 30.001s is `OFFLINE`
(tested).

## Prerequisites

- Node.js 18 or newer (uses built-in `fetch` in the simulator)
- npm

## Setup

```bash
npm install
```

## Run the application

```bash
npm start
```

Listens on `http://localhost:3000`. Configuration via environment variables
(see `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `TIMEOUT_SECONDS` | 30 | Heartbeat timeout |

## Run the simulator

With the server running, in a second terminal:

```bash
npm run simulate
```

This registers 5 devices (`device-01` ... `device-05`) and sends a heartbeat from each
every 5 seconds. To see a device go OFFLINE, stop one after 60 seconds:

```bash
node simulator/simulator.js --stop device-03 --after 60
```

About 30 seconds after it stops, `device-03` becomes `OFFLINE`:

```bash
curl localhost:3000/devices/device-03
curl localhost:3000/summary
```

Options: `--url`, `--devices`, `--interval` (seconds), `--stop`, `--after` (seconds).

## Run the tests

```bash
npm test
```

Tests use an in-memory repository and a fake clock, so no database is needed and
nothing waits in real time. They cover registration, heartbeat handling, device
status, the 30-second boundary (29s / 30s / 30.001s), the summary, the status filter,
validation errors, 404 and 409 cases.

## API

| Method | Path | Success | Errors |
|---|---|---|---|
| POST | `/devices` | 201 device | 400 invalid body, 409 duplicate id |
| POST | `/devices/:id/heartbeat` | 200 device | 400 invalid body, 404 unknown device |
| GET | `/devices` (optional `?status=ONLINE\|OFFLINE`) | 200 array | 400 invalid status |
| GET | `/devices/:id` | 200 device | 404 unknown device |
| GET | `/summary` | 200 `{total, online, offline}` | |

Errors are returned as `{ "error": "message" }`.

### Example requests

```bash
# Register
curl -X POST localhost:3000/devices -H "Content-Type: application/json" \
  -d '{"id":"device-01","name":"Lab Device 01"}'

# Heartbeat (cpu_usage and signal_strength are optional)
curl -X POST localhost:3000/devices/device-01/heartbeat -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-09-30T10:30:00Z","status":"OK","cpu_usage":42,"signal_strength":-71}'

# List, filter, details, summary
curl localhost:3000/devices
curl "localhost:3000/devices?status=ONLINE"
curl localhost:3000/devices/device-01
curl localhost:3000/summary
```

Example device response:

```json
{
  "id": "device-01",
  "name": "Lab Device 01",
  "status": "ONLINE",
  "last_heartbeat": "2026-09-30T10:30:00.512Z",
  "device_timestamp": "2026-09-30T10:30:00Z",
  "reported_status": "OK",
  "cpu_usage": 42,
  "signal_strength": -71
}
```

## Assumptions

- The **server's receive time** decides ONLINE/OFFLINE, not the device's `timestamp`,
  because device clocks can be wrong. The device timestamp is stored as `device_timestamp`.
- `last_heartbeat` in responses is the server receive time.
- A newly registered device with no heartbeat is `OFFLINE` with `last_heartbeat: null`.
- The device-reported `status` (e.g. `OK`) is kept separately as `reported_status`;
  `status` is always the computed `ONLINE`/`OFFLINE`.
- A heartbeat whose device timestamp is older than the stored one is ignored, so a late
  packet cannot overwrite newer data.
- Device ids are unique; registering the same id again returns 409.

## Known limitations

- Data is in memory only and is lost when the server restarts.
- Single process only; no authentication.
- No pagination on `GET /devices`.
- No way to unregister a device.

## What I would improve with one more day

- Persistent storage (MongoDB or SQLite) behind the existing repository interface.
- `DELETE /devices/:id`, pagination, and API docs (OpenAPI).
- Dockerfile and docker-compose.
- Structured logging and a simple dashboard that polls `/summary`.
- Authentication for heartbeats (per-device tokens).

## AI Usage

- **Tools used:** Claude and ChatGPT.
- **What I used them for:** ChatGPT for an initial project structure and stack suggestions; Claude for reviewing that plan, drafting the service, routes, validation, tests and simulator, and for the README structure.
- **One suggestion I changed or rejected:** ChatGPT suggested a MongoDB-first design with separate controller and model layers (and leaned towards TypeScript). I dropped the controller and model layers, used plain JavaScript, and built an in-memory repository first, because the brief doesn't require a database and I had limited time. The repository layer keeps it easy to add MongoDB later.
- **One thing I verified myself:** I ran `npm test` in a fresh GitHub Codespace on the pushed repo, then started the server and the simulator, stopped one device, and confirmed it turned OFFLINE after about 30 seconds.
