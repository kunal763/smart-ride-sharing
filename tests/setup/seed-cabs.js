#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'airport_pooling',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// NYC area locations for cab positioning
const locations = [
  { lat: 40.6413, lng: -73.7781, name: 'JFK Airport' },
  { lat: 40.7769, lng: -73.8740, name: 'LaGuardia Airport' },
  { lat: 40.7580, lng: -73.9855, name: 'Times Square' },
  { lat: 40.7829, lng: -73.9654, name: 'Central Park' },
  { lat: 40.7614, lng: -73.9776, name: 'Rockefeller Center' },
  { lat: 40.7484, lng: -73.9857, name: 'Empire State Building' },
  { lat: 40.7061, lng: -74.0087, name: 'Brooklyn Bridge' },
  { lat: 40.7589, lng: -73.9851, name: 'Grand Central' },
  { lat: 40.7505, lng: -73.9934, name: 'Penn Station' },
  { lat: 40.7527, lng: -73.9772, name: 'Bryant Park' }
];

const driverNames = [
  'John Smith', 'Maria Garcia', 'James Johnson', 'Patricia Brown',
  'Robert Jones', 'Jennifer Davis', 'Michael Miller', 'Linda Wilson',
  'William Moore', 'Elizabeth Taylor', 'David Anderson', 'Barbara Thomas',
  'Richard Jackson', 'Susan White', 'Joseph Harris', 'Jessica Martin',
  'Thomas Thompson', 'Sarah Garcia', 'Charles Martinez', 'Karen Robinson'
];

async function seedCabs(count = 100) {
  const client = await pool.connect();
  
  try {
    console.log(`🚕 Seeding ${count} cabs...\n`);
    
    await client.query('BEGIN');
    
    let created = 0;
    let skipped = 0;
    
    for (let i = 0; i < count; i++) {
      const licensePlate = `NYC${String(i + 1).padStart(4, '0')}`;
      const driverName = driverNames[i % driverNames.length];
      const driverPhone = `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      const location = locations[Math.floor(Math.random() * locations.length)];
      
      try {
        await client.query(`
          INSERT INTO cabs (license_plate, driver_name, driver_phone, max_passengers, max_luggage_capacity, current_lat, current_lng, is_available)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (license_plate) DO NOTHING
        `, [
          licensePlate,
          driverName,
          driverPhone,
          4, // max passengers
          6, // max luggage
          location.lat,
          location.lng,
          true // available
        ]);
        
        created++;
        
        if ((i + 1) % 10 === 0) {
          process.stdout.write(`\r   Created ${created} cabs...`);
        }
      } catch (err) {
        if (err.code === '23505') { // Unique violation
          skipped++;
        } else {
          throw err;
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\r   Created ${created} cabs ✓`);
    if (skipped > 0) {
      console.log(`   Skipped ${skipped} existing cabs`);
    }
    
    // Get statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_available = true) as available,
        COUNT(*) FILTER (WHERE is_available = false) as busy
      FROM cabs
    `);
    
    console.log('\n📊 Cab Statistics:');
    console.log(`   Total cabs:      ${stats.rows[0].total}`);
    console.log(`   Available:       ${stats.rows[0].available}`);
    console.log(`   Busy:            ${stats.rows[0].busy}`);
    
    console.log('\n✅ Cab seeding completed!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error seeding cabs:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get count from command line or default to 100
const count = parseInt(process.argv[2]) || 100;

seedCabs(count).catch(err => {
  console.error(err);
  process.exit(1);
});
