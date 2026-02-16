import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file from project root
dotenv.config({ path: resolve(__dirname, '../../.env') });

async function seed() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'airport_pooling',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('Seeding database with sample data...');

    // Create sample users
    const users = [];
    for (let i = 1; i <= 20; i++) {
      const userId = uuidv4();
      await pool.query(
        'INSERT INTO users (id, name, email, phone) VALUES ($1, $2, $3, $4)',
        [userId, `User ${i}`, `user${i}@example.com`, `+1555000${i.toString().padStart(4, '0')}`]
      );
      users.push(userId);
    }

    // Create sample cabs
    const cabs = [];
    for (let i = 1; i <= 10; i++) {
      const cabId = uuidv4();
      await pool.query(
        'INSERT INTO cabs (id, license_plate, driver_name, driver_phone, current_lat, current_lng) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          cabId,
          `CAB${i.toString().padStart(4, '0')}`,
          `Driver ${i}`,
          `+1555100${i.toString().padStart(4, '0')}`,
          40.7128 + (Math.random() - 0.5) * 0.1, // Near NYC
          -74.0060 + (Math.random() - 0.5) * 0.1
        ]
      );
      cabs.push(cabId);
    }

    // Create sample ride requests
    const airports = [
      { lat: 40.6413, lng: -73.7781, name: 'JFK Airport' },
      { lat: 40.7769, lng: -73.8740, name: 'LaGuardia Airport' }
    ];

    const destinations = [
      { lat: 40.7580, lng: -73.9855, name: 'Times Square' },
      { lat: 40.7484, lng: -73.9857, name: 'Empire State Building' },
      { lat: 40.7061, lng: -74.0087, name: 'Financial District' },
      { lat: 40.7614, lng: -73.9776, name: 'Grand Central' }
    ];

    for (let i = 0; i < 15; i++) {
      const airport = airports[Math.floor(Math.random() * airports.length)];
      const dest = destinations[Math.floor(Math.random() * destinations.length)];
      const userId = users[Math.floor(Math.random() * users.length)];
      
      await pool.query(
        `INSERT INTO ride_requests 
        (user_id, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, passengers, luggage, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          airport.lat,
          airport.lng,
          airport.name,
          dest.lat,
          dest.lng,
          dest.name,
          Math.floor(Math.random() * 3) + 1,
          JSON.stringify([1, 2].slice(0, Math.floor(Math.random() * 2) + 1)),
          'PENDING'
        ]
      );
    }

    console.log('✓ Database seeded successfully');
    console.log(`  - ${users.length} users created`);
    console.log(`  - ${cabs.length} cabs created`);
    console.log('  - 15 ride requests created');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    await pool.end();
    process.exit(1);
  }
}

seed();
