#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testCabLocationUpdate() {
  console.log('🧪 Testing Cab Location Update After Ride Completion\n');

  try {
    // 1. Get a user
    console.log('1️⃣  Getting a user...');
    const usersRes = await makeRequest('GET', '/api/users?limit=1');
    if (!usersRes.data.success || usersRes.data.data.length === 0) {
      throw new Error('No users found');
    }
    const userId = usersRes.data.data[0].id;
    console.log(`   ✓ User ID: ${userId}\n`);

    // 2. Get an available cab
    console.log('2️⃣  Getting an available cab...');
    const cabsRes = await makeRequest('GET', '/api/cabs?available=true&limit=1');
    if (!cabsRes.data.success || cabsRes.data.data.length === 0) {
      throw new Error('No available cabs found');
    }
    const cab = cabsRes.data.data[0];
    console.log(`   ✓ Cab ID: ${cab.id}`);
    console.log(`   ✓ Initial Location: (${cab.currentLat}, ${cab.currentLng})\n`);

    // 3. Create a ride request
    console.log('3️⃣  Creating ride request...');
    const pickupLocation = { latitude: 40.6413, longitude: -73.7781, address: 'JFK Airport' };
    const dropoffLocation = { latitude: 40.7580, longitude: -73.9855, address: 'Times Square' };
    
    const requestRes = await makeRequest('POST', '/api/rides/request', {
      userId: userId,
      pickup: pickupLocation,
      dropoff: dropoffLocation,
      passengers: 2,
      luggage: [2, 1],
      maxDetourMinutes: 15
    });
    
    if (!requestRes.data.success) {
      throw new Error('Failed to create ride request: ' + requestRes.data.error);
    }
    const requestId = requestRes.data.data.id;
    console.log(`   ✓ Request ID: ${requestId}\n`);

    // 4. Find matches
    console.log('4️⃣  Finding matches...');
    const matchesRes = await makeRequest('GET', `/api/rides/matches/${requestId}`);
    if (!matchesRes.data.success || matchesRes.data.data.length === 0) {
      throw new Error('No matches found');
    }
    console.log(`   ✓ Found ${matchesRes.data.data.length} match(es)\n`);

    // 5. Confirm booking (use first match)
    console.log('5️⃣  Confirming booking...');
    const match = matchesRes.data.data[0];
    const confirmRes = await makeRequest('POST', '/api/rides/confirm', {
      requestId: requestId,
      matchId: match.id,
      cabId: cab.id
    });
    
    if (!confirmRes.data.success) {
      throw new Error('Failed to confirm booking: ' + confirmRes.data.error);
    }
    const rideId = confirmRes.data.data.rideId;
    console.log(`   ✓ Ride ID: ${rideId}`);
    console.log(`   ✓ Route has ${confirmRes.data.data.route.waypoints.length} waypoints\n`);

    // 6. Check cab is now unavailable
    console.log('6️⃣  Checking cab status...');
    const cabCheckRes = await makeRequest('GET', `/api/cabs/${cab.id}`);
    console.log(`   ✓ Cab available: ${cabCheckRes.data.data.isAvailable} (should be false)\n`);

    // 7. Complete the ride manually
    console.log('7️⃣  Completing ride...');
    const completeRes = await makeRequest('POST', `/api/rides/${rideId}/complete`);
    
    if (!completeRes.data.success) {
      throw new Error('Failed to complete ride: ' + completeRes.data.error);
    }
    console.log(`   ✓ Ride completed\n`);

    // 8. Check cab location was updated
    console.log('8️⃣  Checking cab location after completion...');
    const cabAfterRes = await makeRequest('GET', `/api/cabs/${cab.id}`);
    const cabAfter = cabAfterRes.data.data;
    
    console.log(`   Initial Location: (${cab.currentLat}, ${cab.currentLng})`);
    console.log(`   Final Location:   (${cabAfter.currentLat}, ${cabAfter.currentLng})`);
    console.log(`   Expected:         (${dropoffLocation.latitude}, ${dropoffLocation.longitude})`);
    console.log(`   Cab available:    ${cabAfter.isAvailable} (should be true)\n`);

    // 9. Verify location matches dropoff
    const latMatch = Math.abs(cabAfter.currentLat - dropoffLocation.latitude) < 0.0001;
    const lngMatch = Math.abs(cabAfter.currentLng - dropoffLocation.longitude) < 0.0001;
    
    if (latMatch && lngMatch && cabAfter.isAvailable) {
      console.log('✅ SUCCESS: Cab location updated to final dropoff location!');
      console.log('✅ SUCCESS: Cab is now available for new rides!');
    } else {
      console.log('❌ FAILED: Cab location not updated correctly');
      if (!latMatch) console.log('   - Latitude mismatch');
      if (!lngMatch) console.log('   - Longitude mismatch');
      if (!cabAfter.isAvailable) console.log('   - Cab still marked as unavailable');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testCabLocationUpdate();
