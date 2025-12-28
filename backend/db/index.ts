import { Pool } from 'pg';

export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  ssl: false,
});

pool.on('connect', () => {
  console.log('connected to postgres');
});