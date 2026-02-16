const { Pool } = require('pg');
const dotenv = require('dotenv');
const { resolve } = require('path');

dotenv.config({ path: resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Airport Ride Pooling API');
  console.log('====================================\n');

  // Step 1: Check server
  console.log('1. Checking if server is running...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log('   ✓ Server is running\n');
    } else {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.log('   ❌ Server is not running. Start it with: npm run dev');
    process.exit(1);
  }

  // Step 2: Get a valid user ID
  console.log('2. Getting a valid user ID from database...');
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'airport_pooling',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  let userId;
  try {
    const result = await pool.query('SELECT id FROM users LIMIT 1');
    if (result.rows.length === 0) {
      console.log('   ❌ No users found. Run: npm run seed');
      await pool.end();
      process.exit(1);
    }
    userId = result.rows[0].id;
    console.log(`   ✓ Using user ID: ${userId}\n`);
  } catch (error) {
    console.log('   ❌ Database error:', error.message);
    await pool.end();
    process.exit(1);
  }

  // Step 3: Create ride request
  console.log('3. Creating a ride request (JFK to Times Square)...');
  const requestData = {
    userId: userId,
    pickup: {
      latitude: 40.6413,
      longitude: -73.7781,
      address: 'JFK Airport Terminal 4'
    },
    dropoff: {
      latitude: 40.7580,
      longitude: -73.9855,
      address: 'Times Square, Manhattan'
    },
    passengers: 2,
    luggage: [1, 2],
    maxDetourMinutes: 15
  };

  try {
    const response = await fetch(`${BASE_URL}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.data.id) {
      const requestId = data.data.id;
      console.log(`\n   ✓ Ride request created: ${requestId}\n`);

      // Step 4: Find matches
      console.log('4. Finding matches for the request...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const matchResponse = await fetch(`${BASE_URL}/api/rides/matches/${requestId}`);
      const matches = await matchResponse.json();
      console.log(JSON.stringify(matches, null, 2));

      // Step 5: Get status
      console.log('\n5. Getting ride status...');
      const statusResponse = await fetch(`${BASE_URL}/api/rides/${requestId}/status`);
      const status = await statusResponse.json();
      console.log(JSON.stringify(status, null, 2));

      console.log('\n====================================');
      console.log('✅ API test completed!\n');
      console.log('📚 For more tests, import postman_collection.json into Postman');
      console.log(`📖 API Documentation: ${BASE_URL}/api-docs`);
    } else {
      console.log('\n   ❌ Failed to create ride request');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }

  await pool.end();
}

testAPI().catch(console.error);
