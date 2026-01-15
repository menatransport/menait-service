import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
