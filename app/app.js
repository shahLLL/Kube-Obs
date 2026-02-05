require('dotenv').config();
const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// --- CUSTOM METRICS ---

// 1. Latency Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5] 
});

// 2. Business Logic Counter
const taskCounter = new client.Counter({
  name: 'app_tasks_completed_total',
  help: 'Total number of successful business tasks completed',
  labelNames: ['task_type']
});

register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(taskCounter);

// Middleware for timing
app.use((req, res, next) => {
  const end = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    if (req.path !== '/metrics') { // Don't time the metrics endpoint itself
        end({ method: req.method, route: req.path, status_code: res.statusCode });
    }
  });
  next();
});

// --- API ENDPOINTS ---

app.get('/hello', (req, res) => {
  taskCounter.inc({ task_type: 'greeting' });
  res.json({ message: "Hello, observability world!" });
});

app.get('/addCpuUsage', (req, res) => {
  taskCounter.inc({ task_type: 'cpu_intensive' });
  let total = 0;
  for (let i = 0; i < 50_000_000; i++) { total += Math.sqrt(i); }
  res.json({ result: "Calculated!", total });
});

app.get('/addLatency', async (req, res) => {
  const delay = Math.floor(Math.random() * 2000) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
  taskCounter.inc({ task_type: 'slow_process' });

  res.json({ 
    message: `This request was intentionally slowed down.`,
    delay_ms: delay 
  });
});

// --- KUBERNETES HEALTH CHECKS ---

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ready', (req, res) => {
  res.status(200).send('Ready'); 
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// --- APP RUN ---

const HOST = '0.0.0.0'; 
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 API running at http://${HOST}:${PORT}`);
});

// --- GRACEFUL SHUTDOWN ---

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});