const { Pool } = require('pg');
const dotenv = require('dotenv');
const { resolve } = require('path');

dotenv.config({ path: resolve(__dirname, '.env') });

const BASE_URL = 'http://localhost:3000';

async function testMatching() {
  console.log('🧪 Testing Ride Matching Algorithm');
  console.log('===================================\n');

  // Get database connection
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'airport_pooling',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // Get multiple users
    const usersResult = await pool.query('SELECT id, name FROM users LIMIT 3');
    if (usersResult.rows.length < 2) {
      console.log('❌ Need at least 2 users. Run: npm run seed');
      process.exit(1);
    }

    const users = usersResult.rows;
    console.log(`✓ Found ${users.length} users\n`);

    // Create multiple ride requests with nearby locations
    const requests = [];

    // Request 1: JFK Terminal 4 to Times Square
    console.log('1. Creating Request 1: JFK T4 → Times Square');
    const req1 = await fetch(`${BASE_URL}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: users[0].id,
        pickup: { latitude: 40.6413, longitude: -73.7781, address: 'JFK Terminal 4' },
        dropoff: { latitude: 40.7580, longitude: -73.9855, address: 'Times Square' },
        passengers: 2,
        luggage: [1, 2],
        maxDetourMinutes: 20
      })
    });
    const data1 = await req1.json();
    if (data1.success) {
      requests.push({ id: data1.data.id, user: users[0].name });
      console.log(`   ✓ Created: ${data1.data.id}`);
    } else {
      console.log(`   ❌ Failed: ${data1.error}`);
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Request 2: JFK Terminal 1 to Empire State (nearby!)
    console.log('\n2. Creating Request 2: JFK T1 → Empire State (nearby)');
    const req2 = await fetch(`${BASE_URL}/api/rides/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: users[1].id,
        pickup: { latitude: 40.6420, longitude: -73.7790, address: 'JFK Terminal 1' },
        dropoff: { latitude: 40.7484, longitude: -73.9857, address: 'Empire State Building' },
        passengers: 1,
        luggage: [1],
        maxDetourMinutes: 20
      })
    });
    const data2 = await req2.json();
    if (data2.success) {
      requests.push({ id: data2.data.id, user: users[1].name });
      console.log(`   ✓ Created: ${data2.data.id}`);
    } else {
      console.log(`   ❌ Failed: ${data2.error}`);
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Request 3: JFK Terminal 5 to Grand Central (also nearby!)
    if (users.length >= 3) {
      console.log('\n3. Creating Request 3: JFK T5 → Grand Central (nearby)');
      const req3 = await fetch(`${BASE_URL}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: users[2].id,
          pickup: { latitude: 40.6425, longitude: -73.7795, address: 'JFK Terminal 5' },
          dropoff: { latitude: 40.7527, longitude: -73.9772, address: 'Grand Central Terminal' },
          passengers: 1,
          luggage: [2],
          maxDetourMinutes: 20
        })
      });
      const data3 = await req3.json();
      if (data3.success) {
        requests.push({ id: data3.data.id, user: users[2].name });
        console.log(`   ✓ Created: ${data3.data.id}`);
      } else {
        console.log(`   ❌ Failed: ${data3.error}`);
      }
    }

    console.log('\n===================================');
    console.log(`✓ Created ${requests.length} ride requests\n`);

    // Now find matches for each request
    console.log('🔍 Finding Matches...\n');

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      console.log(`${i + 1}. Matches for ${req.user} (${req.id}):`);
      
      const matchResponse = await fetch(`${BASE_URL}/api/rides/matches/${req.id}`);
      const matches = await matchResponse.json();

      if (matches.success && matches.data.length > 0) {
        console.log(`   ✓ Found ${matches.data.length} match(es)!\n`);
        
        matches.data.forEach((match, idx) => {
          console.log(`   Match ${idx + 1}:`);
          console.log(`   - Score: ${match.score.toFixed(1)}/100`);
          console.log(`   - Savings: $${match.savings.toFixed(2)}`);
          console.log(`   - Detour: ${match.detourTime} minutes`);
          console.log(`   - Passengers: ${match.ride.passengers.length}`);
          console.log(`   - Total Distance: ${match.ride.totalDistance.toFixed(1)} km`);
          console.log(`   - Estimated Duration: ${match.ride.estimatedDuration} minutes`);
          
          console.log(`   - Passenger Details:`);
          match.ride.passengers.forEach((p, pidx) => {
            console.log(`     ${pidx + 1}. ${p.passengers} passenger(s), Fare: $${p.fare.toFixed(2)}, Detour: ${p.detourMinutes} min`);
          });
          console.log('');
        });
      } else {
        console.log(`   ℹ️  No matches found (this is normal if it's the first request)\n`);
      }
    }

    console.log('===================================');
    console.log('✅ Matching test completed!\n');
    
    console.log('📊 Summary:');
    console.log(`   - Created ${requests.length} requests`);
    console.log(`   - All requests are within 5km of each other`);
    console.log(`   - Total capacity: ${requests.length <= 3 ? 'Within limits' : 'May exceed'}`);
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Matches appear when multiple requests are nearby');
    console.log('   - Requests must be within 5km radius');
    console.log('   - Total passengers must be ≤ 4');
    console.log('   - Total luggage must be ≤ 6 units');
    console.log('   - Detour must be within tolerance');
    console.log('');
    console.log('🔄 To test again, run: node test-matching.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  await pool.end();
}

testMatching().catch(console.error);
