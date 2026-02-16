#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testUserAPIs() {
  console.log('\n=== Testing User APIs ===\n');
  
  // 1. Create User
  console.log('1. Creating user...');
  const createUserRes = await makeRequest('POST', '/api/users', {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    phone: '+15551234567'
  });
  console.log(`Status: ${createUserRes.status}`);
  console.log('Response:', JSON.stringify(createUserRes.data, null, 2));
  
  if (!createUserRes.data.success) {
    console.log('❌ Failed to create user');
    return;
  }
  
  const userId = createUserRes.data.data.id;
  console.log(`✓ User created with ID: ${userId}\n`);
  
  // 2. Get User by ID
  console.log('2. Getting user by ID...');
  const getUserRes = await makeRequest('GET', `/api/users/${userId}`);
  console.log(`Status: ${getUserRes.status}`);
  console.log('Response:', JSON.stringify(getUserRes.data, null, 2));
  console.log('✓ User retrieved\n');
  
  // 3. Update User
  console.log('3. Updating user...');
  const updateUserRes = await makeRequest('PUT', `/api/users/${userId}`, {
    name: 'Updated Test User',
    phone: '+15559999999'
  });
  console.log(`Status: ${updateUserRes.status}`);
  console.log('Response:', JSON.stringify(updateUserRes.data, null, 2));
  console.log('✓ User updated\n');
  
  // 4. List Users
  console.log('4. Listing users...');
  const listUsersRes = await makeRequest('GET', '/api/users?limit=5');
  console.log(`Status: ${listUsersRes.status}`);
  console.log(`Total users: ${listUsersRes.data.total}`);
  console.log(`Returned: ${listUsersRes.data.data.length} users`);
  console.log('✓ Users listed\n');
  
  // 5. Delete User
  console.log('5. Deleting user...');
  const deleteUserRes = await makeRequest('DELETE', `/api/users/${userId}`);
  console.log(`Status: ${deleteUserRes.status}`);
  console.log('Response:', JSON.stringify(deleteUserRes.data, null, 2));
  console.log('✓ User deleted\n');
}

async function testCabAPIs() {
  console.log('\n=== Testing Cab APIs ===\n');
  
  // 1. Create Cab
  console.log('1. Creating cab...');
  const createCabRes = await makeRequest('POST', '/api/cabs', {
    licensePlate: `TEST${Date.now()}`,
    driverName: 'Test Driver',
    driverPhone: '+15551234567',
    maxPassengers: 4,
    maxLuggageCapacity: 6,
    currentLat: 40.7128,
    currentLng: -74.0060
  });
  console.log(`Status: ${createCabRes.status}`);
  console.log('Response:', JSON.stringify(createCabRes.data, null, 2));
  
  if (!createCabRes.data.success) {
    console.log('❌ Failed to create cab');
    return;
  }
  
  const cabId = createCabRes.data.data.id;
  console.log(`✓ Cab created with ID: ${cabId}\n`);
  
  // 2. Get Cab by ID
  console.log('2. Getting cab by ID...');
  const getCabRes = await makeRequest('GET', `/api/cabs/${cabId}`);
  console.log(`Status: ${getCabRes.status}`);
  console.log('Response:', JSON.stringify(getCabRes.data, null, 2));
  console.log('✓ Cab retrieved\n');
  
  // 3. Update Cab Location
  console.log('3. Updating cab location...');
  const updateLocationRes = await makeRequest('PUT', `/api/cabs/${cabId}/location`, {
    latitude: 40.7580,
    longitude: -73.9855
  });
  console.log(`Status: ${updateLocationRes.status}`);
  console.log('Response:', JSON.stringify(updateLocationRes.data, null, 2));
  console.log('✓ Location updated\n');
  
  // 4. Update Cab
  console.log('4. Updating cab...');
  const updateCabRes = await makeRequest('PUT', `/api/cabs/${cabId}`, {
    driverName: 'Updated Driver',
    isAvailable: false
  });
  console.log(`Status: ${updateCabRes.status}`);
  console.log('Response:', JSON.stringify(updateCabRes.data, null, 2));
  console.log('✓ Cab updated\n');
  
  // 5. List Available Cabs
  console.log('5. Listing available cabs...');
  const listAvailableRes = await makeRequest('GET', '/api/cabs?available=true&limit=5');
  console.log(`Status: ${listAvailableRes.status}`);
  console.log(`Total available: ${listAvailableRes.data.total}`);
  console.log(`Returned: ${listAvailableRes.data.data.length} cabs`);
  console.log('✓ Available cabs listed\n');
  
  // 6. List All Cabs
  console.log('6. Listing all cabs...');
  const listAllRes = await makeRequest('GET', '/api/cabs?limit=5');
  console.log(`Status: ${listAllRes.status}`);
  console.log(`Total cabs: ${listAllRes.data.total}`);
  console.log(`Returned: ${listAllRes.data.data.length} cabs`);
  console.log('✓ All cabs listed\n');
  
  // 7. Delete Cab
  console.log('7. Deleting cab...');
  const deleteCabRes = await makeRequest('DELETE', `/api/cabs/${cabId}`);
  console.log(`Status: ${deleteCabRes.status}`);
  console.log('Response:', JSON.stringify(deleteCabRes.data, null, 2));
  console.log('✓ Cab deleted\n');
}

async function main() {
  try {
    console.log('Testing User and Cab Management APIs');
    console.log('=====================================');
    
    await testUserAPIs();
    await testCabAPIs();
    
    console.log('\n✅ All tests completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
