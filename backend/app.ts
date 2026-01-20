/* eslint no-console: "off" */
import 'dotenv/config';
import express from 'express';
import * as http from 'http';
import cors from 'cors';

import userController from './controller/user.controller.ts';
import resumeController from './controller/resume.controller.ts';
import jobController from './controller/job.controller.ts';
import taskController from './controller/task.controller.ts';

const PORT = 8080;

const app = express();
const server = http.createServer(app);

function startServer() {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

process.on('SIGINT', async () => {
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

startServer();

export { app, server, startServer };
