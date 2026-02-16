#!/usr/bin/env node

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed10kUsers() {
  console.log('🚀 Seeding 10,000 users for load testing...\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📊 Progress:');
    const batchSize = 1000;
    const totalUsers = 10000;
    
    for (let batch = 0; batch < totalUsers / batchSize; batch++) {
      const values = [];
      const placeholders = [];
      
      for (let i = 0; i < batchSize; i++) {
        const userNum = batch * batchSize + i + 1;
        const id = uuidv4();
        const name = `LoadTest User ${userNum}`;
        const email = `loadtest${userNum}@example.com`;
        const phone = `+1555${String(userNum).padStart(7, '0')}`;
        
        const offset = i * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(id, name, email, phone);
      }
      
      const query = `
        INSERT INTO users (id, name, email, phone)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (email) DO NOTHING
      `;
      
      await client.query(query, values);
      
      const progress = ((batch + 1) * batchSize / totalUsers * 100).toFixed(0);
      process.stdout.write(`\r   ${(batch + 1) * batchSize} users created (${progress}%)`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n\n✅ Successfully created 10,000 users!');
    
    // Verify count
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log(`📈 Total users in database: ${result.rows[0].count}\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding users:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed10kUsers();
