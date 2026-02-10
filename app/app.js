require('dotenv').config();
const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// --- Registry & Default Metrics ---
const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  // Optional: prefix if you want (e.g. nodejs_)
  // prefix: 'nodejs_',
  gcDurationBuckets: client.collectDefaultMetrics.DEFAULT_GC_DURATION_BUCKETS // explicit is clearer
});

// --- Custom Metrics (RED + Saturation + Business) ---

// 1. Request counter (Rate)
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

// 2. Latency histogram (Duration)
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// 3. Errors counter (for RED Errors)
const httpRequestErrorsTotal = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total HTTP errors (4xx + 5xx)',
  labelNames: ['path', 'status'],
  registers: [register]
});

// 4. Active requests gauge (Saturation)
const activeRequests = new client.Gauge({
  name: 'active_requests',
  help: 'Number of currently active requests',
  registers: [register]
});

// 5. Business task counter
const tasksCompletedTotal = new client.Counter({
  name: 'tasks_completed_total',
  help: 'Total successful business tasks completed',
  labelNames: ['task_type'],
  registers: [register]
});

// --- Middleware: track requests properly ---
app.use((req, res, next) => {
  activeRequests.inc();

  const endTimer = httpRequestDurationSeconds.startTimer();
  const route = req.path;

  res.on('finish', () => {
    const status = res.statusCode.toString();
    activeRequests.dec();

    // Skip /metrics itself to avoid noise
    if (route !== '/metrics') {
      httpRequestsTotal.inc({ method: req.method, path: route, status });

      endTimer({ method: req.method, path: route, status });

      if (status.startsWith('4') || status.startsWith('5')) {
        httpRequestErrorsTotal.inc({ path: route, status });
      }
    }
  });

  next();
});

// --- Endpoints ---

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
  res.status(200).send('Ready');
});

app.get('/hello', (req, res) => {
  tasksCompletedTotal.inc({ task_type: 'greeting' });
  res.json({ message: "Hello, observability world!" });
});

app.get('/add-cpu', (req, res) => {
  const iterations = parseInt(req.query.iterations) || 50_000_000;
  tasksCompletedTotal.inc({ task_type: 'cpu_intensive' });

  let total = 0;
  for (let i = 0; i < iterations; i++) {
    total += Math.sqrt(i);
  }

  res.json({ result: "Calculated!", total, iterations });
});

app.get('/add-latency', (req, res) => {
  const delayMs = parseInt(req.query.delay) || Math.floor(Math.random() * 2000) + 500;
  tasksCompletedTotal.inc({ task_type: 'slow_process' });

  setTimeout(() => {
    res.json({
      message: `Intentionally delayed`,
      delay_ms: delayMs
    });
  }, delayMs);
});

app.get('/fail', (req, res) => {
  const status = parseInt(req.query.status) || 500;
  const msg = req.query.msg || 'Demo failure';

  tasksCompletedTotal.inc({ task_type: 'failure_trigger' }); // optional

  res.status(status).json({ error: msg });
});

// --- Metrics ---
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- Server ---
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 API running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => process.exit(0));