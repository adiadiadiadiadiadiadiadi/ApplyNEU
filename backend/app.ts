/* eslint no-console: "off" */
import 'dotenv/config';
import express, { application } from 'express';
import * as http from 'http';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import userController from './controller/user.controller.ts';
import resumeController from './controller/resume.controller.ts';
import jobController from './controller/job.controller.ts';
import taskController from './controller/task.controller.ts';
import applicationController from './controller/application.controller.ts';
import errorHandler from './controller/middleware/handlers/errorHandler.ts';

const PORT = 8080;

const app = express();
const server = http.createServer(app);

function startServer() {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

app.use(cors());
app.use(express.json());

app.use('/users', userController());
app.use('/resumes', resumeController());
app.use('/jobs', jobController());
app.use('/tasks', taskController());
app.use('/applications', applicationController());

app.use(errorHandler);

// Only auto-start when not under test to allow Jest/supertest to import the app without
// binding to a port or requiring a running Postgres instance.
if (process.env.NODE_ENV !== 'test') {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const swaggerDocument = JSON.parse(readFileSync(join(__dirname, 'swagger_output.json'), 'utf8'));
    app.use('/api-docs', ...swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    console.log(`Swagger UI at http://localhost:${PORT}/api-docs`);
  } catch {
    console.warn('swagger_output.json not found — run npm run swagger:gen to generate it');
  }
  startServer();
}

export { app, server, startServer };
