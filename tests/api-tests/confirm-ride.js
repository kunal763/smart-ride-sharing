const BASE_URL = 'http://localhost:3000';

async function confirmRide() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node confirm-ride.js <requestId> [matchIndex]');
    console.log('');
    console.log('Example:');
    console.log('  node confirm-ride.js 1ad4a234-8144-4ab9-bfec-4614cf27291a');
    console.log('  node confirm-ride.js 1ad4a234-8144-4ab9-bfec-4614cf27291a 0');
    console.log('');
    console.log('matchIndex: Which match to confirm (default: 0 = first/best match)');
    process.exit(1);
  }

  const requestId = args[0];
  const matchIndex = parseInt(args[1] || '0');

  console.log('🎫 Confirming Ride Booking');
  console.log('=========================\n');
  console.log(`Request ID: ${requestId}`);
  console.log(`Match Index: ${matchIndex}\n`);

  try {
    // Step 1: Get matches
    console.log('1. Fetching available matches...');
    const matchResponse = await fetch(`${BASE_URL}/api/rides/matches/${requestId}`);
    const matchData = await matchResponse.json();

    if (!matchData.success) {
      console.log(`❌ Error: ${matchData.error}`);
      process.exit(1);
    }

    if (matchData.data.length === 0) {
      console.log('❌ No matches available for this request');
      process.exit(1);
    }

    console.log(`✓ Found ${matchData.data.length} match(es)\n`);

    // Step 2: Select the match
    if (matchIndex >= matchData.data.length) {
      console.log(`❌ Match index ${matchIndex} not found (only ${matchData.data.length} matches available)`);
      process.exit(1);
    }

    const selectedMatch = matchData.data[matchIndex];
    console.log(`2. Selected Match #${matchIndex}:`);
    console.log(`   - Score: ${selectedMatch.score.toFixed(1)}/100`);
    console.log(`   - Savings: $${selectedMatch.savings.toFixed(2)}`);
    console.log(`   - Detour: ${selectedMatch.detourTime} minutes`);
    console.log(`   - Passengers: ${selectedMatch.ride.passengers.length}`);
    console.log(`   - Total Distance: ${selectedMatch.ride.totalDistance.toFixed(1)} km`);
    console.log(`   - Estimated Duration: ${selectedMatch.ride.estimatedDuration} minutes\n`);

    // Display passenger details
    console.log('   Passenger Details:');
    selectedMatch.ride.passengers.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.passengers} passenger(s), Fare: $${p.fare.toFixed(2)}, Detour: ${p.detourMinutes} min`);
    });
    console.log('');

    // Step 3: Confirm the booking
    console.log('3. Confirming booking...');
    
    const bookingData = {
      requestId: requestId,
      rideData: selectedMatch.ride
    };

    const bookResponse = await fetch(`${BASE_URL}/api/rides/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    });

    const bookData = await bookResponse.json();

    if (bookData.success) {
      console.log(JSON.stringify(bookingData))
      console.log('✅ Booking confirmed successfully!\n');
      console.log(`Ride ID: ${bookData.data.rideId}`);
      console.log('');
      console.log('📋 Booking Summary:');
      console.log(`   - Request ID: ${requestId}`);
      console.log(`   - Ride ID: ${bookData.data.rideId}`);
      console.log(`   - Passengers: ${selectedMatch.ride.passengers.length}`);
      console.log(`   - Total Distance: ${selectedMatch.ride.totalDistance.toFixed(1)} km`);
      console.log(`   - Estimated Duration: ${selectedMatch.ride.estimatedDuration} minutes`);
      console.log('');
      console.log('💡 Next steps:');
      console.log(`   - Check status: curl ${BASE_URL}/api/rides/${requestId}/status`);
      console.log(`   - Cancel ride: curl -X DELETE ${BASE_URL}/api/rides/${bookData.data.rideId}`);
    } else {
      console.log(`❌ Booking failed: ${bookData.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

confirmRide().catch(console.error);
