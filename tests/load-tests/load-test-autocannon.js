#!/usr/bin/env node

const autocannon = require('autocannon');
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Get valid user IDs from database
async function getValidUserIds() {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}/api/users?limit=10`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success && data.data.length > 0) {
            resolve(data.data.map(u => u.id));
          } else {
            reject(new Error('No users found. Run: npm run seed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Test configurations
const tests = {
  // Test 1: 100 RPS for 30 seconds
  rps100: {
    name: '100 RPS Test',
    url: `${BASE_URL}/api/rides/request`,
    connections: 100,
    duration: 30,
    pipelining: 1,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  // Test 2: 10,000 concurrent connections
  concurrent10k: {
    name: '10,000 Concurrent Users',
    url: `${BASE_URL}/api/rides/request`,
    connections: 10000,
    duration: 10,
    pipelining: 1,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  // Test 3: Latency test (< 300ms requirement)
  latency: {
    name: 'Latency Test (Target: < 300ms)',
    url: `${BASE_URL}/api/rides/request`,
    connections: 50,
    duration: 20,
    pipelining: 1,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  // Test 4: Health check baseline
  health: {
    name: 'Health Check Baseline',
    url: `${BASE_URL}/health`,
    connections: 100,
    duration: 10,
    pipelining: 1
  }
};

// Generate random ride request
function generateRideRequest(userIds) {
  const userId = userIds[Math.floor(Math.random() * userIds.length)];
  
  // Random locations around NYC area
  const pickupLat = 40.6 + Math.random() * 0.3;
  const pickupLng = -74.0 + Math.random() * 0.3;
  const dropoffLat = 40.6 + Math.random() * 0.3;
  const dropoffLng = -74.0 + Math.random() * 0.3;
  
  return JSON.stringify({
    userId,
    pickup: {
      latitude: pickupLat,
      longitude: pickupLng,
      address: 'Test Pickup'
    },
    dropoff: {
      latitude: dropoffLat,
      longitude: dropoffLng,
      address: 'Test Dropoff'
    },
    passengers: Math.floor(Math.random() * 3) + 1,
    luggage: [1, 2]
  });
}

// Run a single test
async function runTest(testConfig, userIds) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${testConfig.name}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const config = {
    ...testConfig
  };
  
  // For POST requests, generate unique body for each request
  if (testConfig.method === 'POST') {
    config.setupClient = (client) => {
      client.on('response', () => {
        // Generate new body for next request
        client.setBody(generateRideRequest(userIds));
      });
      // Set initial body
      client.setBody(generateRideRequest(userIds));
    };
  }
  
  return new Promise((resolve, reject) => {
    const instance = autocannon(config, (err, result) => {
      if (err) {
        reject(err);
      } else {
        printResults(result, testConfig.name);
        resolve(result);
      }
    });
    
    autocannon.track(instance, { renderProgressBar: true });
  });
}

// Print formatted results
function printResults(result, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${testName}`);
  console.log(`${'='.repeat(60)}\n`);
  
  console.log('📊 Throughput:');
  console.log(`   Requests:        ${result.requests.total}`);
  console.log(`   Requests/sec:    ${result.requests.average.toFixed(2)}`);
  console.log(`   Bytes/sec:       ${(result.throughput.average / 1024).toFixed(2)} KB`);
  
  console.log('\n⏱️  Latency:');
  console.log(`   Average:         ${result.latency.mean.toFixed(2)} ms`);
  console.log(`   Median (p50):    ${result.latency.p50.toFixed(2)} ms`);
  console.log(`   p97.5:           ${result.latency.p97_5.toFixed(2)} ms`);
  console.log(`   p99:             ${result.latency.p99.toFixed(2)} ms`);
  console.log(`   Max:             ${result.latency.max.toFixed(2)} ms`);
  
  console.log('\n✅ Success Rate:');
  const successRate = ((result['2xx'] / result.requests.total) * 100).toFixed(2);
  console.log(`   2xx responses:   ${result['2xx']} (${successRate}%)`);
  console.log(`   4xx responses:   ${result['4xx']}`);
  console.log(`   5xx responses:   ${result['5xx']}`);
  console.log(`   Errors:          ${result.errors}`);
  console.log(`   Timeouts:        ${result.timeouts}`);
  
  // Check requirements
  console.log('\n🎯 Requirements Check:');
  const rpsPass = result.requests.average >= 100;
  const latencyPass = result.latency.p99 < 300;
  const successPass = successRate >= 95;
  
  console.log(`   ✓ 100 RPS:       ${rpsPass ? '✅ PASS' : '❌ FAIL'} (${result.requests.average.toFixed(2)} RPS)`);
  console.log(`   ✓ < 300ms p99:   ${latencyPass ? '✅ PASS' : '❌ FAIL'} (${result.latency.p99.toFixed(2)} ms)`);
  console.log(`   ✓ 95% success:   ${successPass ? '✅ PASS' : '❌ FAIL'} (${successRate}%)`);
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  return {
    pass: rpsPass && latencyPass && successPass,
    rps: result.requests.average,
    latency: result.latency.p99,
    successRate: parseFloat(successRate)
  };
}

// Main execution
async function main() {
  console.log('🚀 Airport Ride Pooling - Load Testing with Autocannon\n');
  
  try {
    // Get valid user IDs
    console.log('📋 Fetching valid user IDs...');
    const userIds = await getValidUserIds();
    console.log(`✓ Found ${userIds.length} users\n`);
    
    // Check if server is running
    console.log('🔍 Checking server health...');
    await new Promise((resolve, reject) => {
      const req = http.request(`${BASE_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('✓ Server is healthy\n');
          resolve();
        } else {
          reject(new Error('Server health check failed'));
        }
      });
      req.on('error', () => reject(new Error('Server not running. Start with: npm run dev')));
      req.end();
    });
    
    // Run tests based on command line argument
    const testType = process.argv[2] || 'all';
    const results = [];
    
    if (testType === 'all') {
      console.log('Running all tests...\n');
      results.push({ name: 'Health', ...(await runTest(tests.health, userIds)) });
      await new Promise(resolve => setTimeout(resolve, 2000));
      results.push({ name: 'Latency', ...(await runTest(tests.latency, userIds)) });
      await new Promise(resolve => setTimeout(resolve, 2000));
      results.push({ name: '100 RPS', ...(await runTest(tests.rps100, userIds)) });
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('⚠️  Warning: 10k concurrent test may take time and resources...');
      results.push({ name: '10k Concurrent', ...(await runTest(tests.concurrent10k, userIds)) });
      
      // Print summary
      console.log('\n' + '='.repeat(60));
      console.log('FINAL SUMMARY');
      console.log('='.repeat(60) + '\n');
      
      results.forEach(r => {
        const status = r.pass ? '✅ PASS' : '❌ FAIL';
        console.log(`${r.name.padEnd(20)} ${status}`);
        if (r.rps && r.latency && r.successRate !== undefined) {
          console.log(`  RPS: ${r.rps.toFixed(2)}, Latency: ${r.latency.toFixed(2)}ms, Success: ${r.successRate.toFixed(2)}%`);
        }
      });
      
      const allPass = results.every(r => r.pass);
      console.log('\n' + '='.repeat(60));
      console.log(`Overall: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
      console.log('='.repeat(60) + '\n');
      
    } else if (tests[testType]) {
      await runTest(tests[testType], userIds);
    } else {
      console.log('❌ Unknown test type. Available: all, rps100, concurrent10k, latency, health');
      process.exit(1);
    }
    
    console.log('\n✅ All tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
