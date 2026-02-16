const { Pool } = require('pg');
const dotenv = require('dotenv');
const { resolve } = require('path');

dotenv.config({ path: resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:3000';

async function testPricing() {
  console.log('💰 Testing Per-Passenger Pricing');
  console.log('=================================\n');

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'airport_pooling',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // Get users
    const usersResult = await pool.query('SELECT id, name FROM users LIMIT 2');
    if (usersResult.rows.length < 2) {
      console.log('❌ Need at least 2 users. Run: npm run seed');
      process.exit(1);
    }

    const users = usersResult.rows;

    // Test 1: Solo ride with 1 passenger
    console.log('Test 1: Solo Ride with 1 Passenger');
    console.log('-----------------------------------');
    const req1 = await fetch(`${BASE_URL}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: users[0].id,
        pickup: { latitude: 40.6413, longitude: -73.7781, address: 'JFK Airport' },
        dropoff: { latitude: 40.7580, longitude: -73.9855, address: 'Times Square' },
        passengers: 1,
        luggage: [1]
      })
    });
    const data1 = await req1.json();
    
    if (data1.success) {
      console.log(`✓ Request created: ${data1.data.id}`);
      
      // Get matches
      await new Promise(resolve => setTimeout(resolve, 500));
      const matchRes1 = await fetch(`${BASE_URL}/api/rides/matches/${data1.data.id}`);
      const matches1 = await matchRes1.json();
      
      if (matches1.success && matches1.data.length > 0) {
        const soloRide = matches1.data[0];
        console.log(`✓ Solo ride option available`);
        console.log(`  - Passengers: ${soloRide.ride.passengers[0].passengers}`);
        console.log(`  - Fare: $${soloRide.ride.passengers[0].fare.toFixed(2)}`);
        console.log(`  - Savings: $${soloRide.savings.toFixed(2)}`);
        console.log(`  - Score: ${soloRide.score}`);
      }
    }

    console.log('');

    // Test 2: Solo ride with 2 passengers
    console.log('Test 2: Solo Ride with 2 Passengers');
    console.log('------------------------------------');
    const req2 = await fetch(`${BASE_URL}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: users[1].id,
        pickup: { latitude: 40.6413, longitude: -73.7781, address: 'JFK Airport' },
        dropoff: { latitude: 40.7580, longitude: -73.9855, address: 'Times Square' },
        passengers: 2,
        luggage: [1, 2]
      })
    });
    const data2 = await req2.json();
    
    if (data2.success) {
      console.log(`✓ Request created: ${data2.data.id}`);
      
      // Get matches
      await new Promise(resolve => setTimeout(resolve, 500));
      const matchRes2 = await fetch(`${BASE_URL}/api/rides/matches/${data2.data.id}`);
      const matches2 = await matchRes2.json();
      
      if (matches2.success && matches2.data.length > 0) {
        console.log(`✓ Found ${matches2.data.length} option(s)`);
        
        matches2.data.forEach((match, idx) => {
          console.log(`\nOption ${idx + 1}:`);
          console.log(`  - Type: ${match.ride.passengers.length === 1 ? 'Solo' : 'Pooled'}`);
          console.log(`  - Score: ${match.score}`);
          console.log(`  - Savings: $${match.savings.toFixed(2)}`);
          console.log(`  - Detour: ${match.detourTime} min`);
          console.log(`  - Passenger Details:`);
          match.ride.passengers.forEach((p, pidx) => {
            console.log(`    ${pidx + 1}. ${p.passengers} passenger(s), Fare: $${p.fare.toFixed(2)}`);
          });
        });
      }
    }

    console.log('\n=================================');
    console.log('✅ Pricing test completed!\n');
    
    console.log('📊 Expected Behavior:');
    console.log('  - Solo ride always available (even with no matches)');
    console.log('  - 2 passengers should pay ~2× what 1 passenger pays');
    console.log('  - Pooled rides show savings compared to solo');
    console.log('  - Higher passenger count = higher fare');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  await pool.end();
}

testPricing().catch(console.error);
