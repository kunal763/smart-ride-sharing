# Smart Airport Ride Pooling Backend System

A high-performance ride pooling system that optimizes passenger grouping, routes, and pricing for airport transportation.

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with PostGIS extension
- **Cache**: Redis for distributed locks and caching
- **Language**: TypeScript
- **API Documentation**: Swagger/OpenAPI
- **Concurrency Control**: Semaphore-based limiting

## System Features

- Real-time passenger matching with spatial optimization
- Route optimization with detour tolerance
- Dynamic pricing based on demand, distance, and surge
- Luggage and seat constraint handling
- High-performance concurrent request processing (568 flows/sec)
- Sub-300ms latency for matching operations
- Support for 10,000+ concurrent users
- Automatic ride completion with cron service

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x with PostGIS extension
- **Redis** >= 6.x
- **npm** or **yarn**

## Setup Instructions

### 1. Install PostgreSQL and PostGIS

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install PostGIS extension
sudo apt install postgresql-14-postgis-3

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check PostgreSQL is running
sudo systemctl status postgresql
```

#### macOS (using Homebrew)
```bash
# Install PostgreSQL
brew install postgresql@14

# Install PostGIS
brew install postgis

# Start PostgreSQL service
brew services start postgresql@14
```

#### Verify Installation
```bash
# Check PostgreSQL version
psql --version

# Should output: psql (PostgreSQL) 14.x
```

### 2. Configure PostgreSQL

#### Check and Increase Max Connections

PostgreSQL's default max_connections is often 100, which may not be sufficient for high-load scenarios.

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Check current max_connections
SHOW max_connections;

# Check current active connections
SELECT count(*) FROM pg_stat_activity;

# Exit
\q
```

**Recommended: Increase max_connections to 200+**

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/14/main/postgresql.conf

# Find and update these lines:
max_connections = 200                # Increased from 100
shared_buffers = 256MB               # Recommended: 25% of RAM
effective_cache_size = 1GB           # Recommended: 50% of RAM

# Save and exit (Ctrl+X, Y, Enter)

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Verify Changes
```bash
sudo -u postgres psql -c "SHOW max_connections;"
# Should output: 200
```

### 3. Setup Database and PostGIS

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE airport_pooling;

# Connect to the database
\c airport_pooling

# Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

# Verify PostGIS installation
SELECT PostGIS_version();

# Exit
\q
```

**Alternative: Using command line**
```bash
# Create database
sudo -u postgres createdb airport_pooling

# Enable PostGIS
sudo -u postgres psql -d airport_pooling -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify
sudo -u postgres psql -d airport_pooling -c "SELECT PostGIS_version();"
```

### 4. Install Redis

#### Ubuntu/Debian
```bash
# Install Redis
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

#### macOS (using Homebrew)
```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify
redis-cli ping
# Should return: PONG
```

### 5. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 6. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` and set your credentials:

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=airport_pooling
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
DB_POOL_SIZE=150

# Redis (Required)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
PORT=3000
MAX_PASSENGERS_PER_CAB=4
MAX_LUGGAGE_CAPACITY=6
MAX_DETOUR_PERCENTAGE=20
```

**Important Notes:**
- Set `DB_PASSWORD` to your PostgreSQL password
- `DB_POOL_SIZE=150` means max 150 connections from this app (optimized for 10k+ concurrent users)
- Ensure PostgreSQL `max_connections` >= `DB_POOL_SIZE` + buffer for other connections
- Recommended: PostgreSQL `max_connections=200` (150 for app + 50 buffer)

### 7. Run Database Migrations

```bash
# Run migrations to create tables and indexes
npm run migrate
```

### 8. Seed Sample Data

```bash
# Load 10,000 sample users
npm run seed:10k

# Load 1,000 sample cabs
npm run seed:cabs
```

### 9. Start the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start at `http://localhost:3000`

### 10. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}

# Check database connection
npm run test:api

# Check Swagger documentation
# Open browser: http://localhost:3000/api-docs
```

**System Status Check:**
```bash
# PostgreSQL
sudo systemctl status postgresql

# Redis
redis-cli ping

# Database connections
sudo -u postgres psql -d airport_pooling -c "SELECT count(*) FROM pg_stat_activity WHERE datname='airport_pooling';"

# Application
curl http://localhost:3000/health
```

## API Documentation

Access interactive Swagger UI at: **http://localhost:3000/api-docs**

### Core API Endpoints

#### 1. Create Ride Request
```http
POST /api/rides/request
Content-Type: application/json

{
  "userId": "uuid",
  "pickup": {
    "latitude": 28.5562,
    "longitude": 77.1000,
    "address": "Terminal 3"
  },
  "dropoff": {
    "latitude": 28.4595,
    "longitude": 77.0266,
    "address": "Gurgaon"
  },
  "passengers": 2,
  "luggage": [1, 2],
  "maxDetourMinutes": 15
}
```

#### 2. Get Available Matches
```http
GET /api/rides/matches/:requestId
```

Returns available ride options (pooled or solo).

#### 3. Confirm Booking
```http
POST /api/rides/book
Content-Type: application/json

{
  "requestId": "uuid",
  "rideData": {
    "cabId": "uuid",
    "route": {...},
    "fare": {...}
  }
}
```

#### 4. Get Ride Status
```http
GET /api/rides/:requestId/status
```

#### 5. Cancel Ride
```http
DELETE /api/rides/:rideId
```

#### 6. Start Ride (Testing)
```http
POST /api/rides/:rideId/start
```

#### 7. Complete Ride (Testing)
```http
POST /api/rides/:rideId/complete
```

## Testing

### Quick API Test

```bash
# Test basic API flow
npm run test:api
```

### Load Testing

```bash
# Setup test environment (checks prerequisites, seeds data)
npm run setup-test

# Full flow load test (10,000 users)
npm run load-test:full

# Basic load test
npm run load-test
```

**Expected Results:**
- Throughput: 568+ flows/sec
- Duration: ~18 seconds
- Success Rate: 97%+
- Latency P99: <350ms

### Other Test Scripts

```bash
# Test matching algorithm
npm run test:matching

# Test pricing calculation
npm run test:pricing

# Test user and cab APIs
npm run test:user-cab

# Test cab location updates
npm run test:cab-location

# Confirm a ride booking
npm run confirm
```

### Utility Scripts

```bash
# Clear database connection pools and cache
npm run clear-pools

# Seed 10,000 test users
npm run seed:10k

# Seed 1,000 test cabs
npm run seed:cabs
```

## System Architecture

### High-Level Components

1. **API Layer**: Express.js REST endpoints with validation
2. **Matching Service**: Spatial-optimized passenger grouping
3. **Route Optimizer**: Dynamic programming for optimal routes
4. **Pricing Engine**: Multi-factor dynamic fare calculation
5. **Booking Service**: Transaction-safe reservations
6. **Cache Layer**: Redis for distributed locks and surge pricing cache
7. **Cron Service**: Automatic ride completion
8. **Database**: PostgreSQL with PostGIS for geospatial queries

### Design Patterns Used

- **Strategy Pattern**: Multiple matching strategies
- **Factory Pattern**: Creating ride instances
- **Singleton Pattern**: Database connection pooling
- **Semaphore Pattern**: Concurrency control

## Algorithm Complexity

### Matching Algorithm
- **Time Complexity**: O(k log k) where k = nearby requests (max 6)
- **Space Complexity**: O(k)
- **Optimization**: PostGIS spatial queries (ST_DWithin) load only nearby requests within 5km radius
- **Rationale**: With max 4 passengers per cab, loading 6 nearby requests is sufficient for optimal matching

### Route Optimization
- **Time Complexity**: O(p! × p) where p = passengers (max 4)
- **Approach**: Dynamic programming for all permutations
- **Constraint**: Maximum 4 passengers per cab

### Pricing Calculation
- **Time Complexity**: O(1)
- **Factors**: Base fare + distance + passenger count + surge multiplier

## Performance Benchmarks

Tested with 10,000 concurrent users:

- **Throughput**: 568 flows/sec (5.6x requirement)
- **Duration**: 17.59 seconds (5.7x faster than 100s requirement)
- **Success Rate**: 97.71%
- **Latency P95**: 249ms
- **Latency P99**: 345ms

## Concurrency Handling

- **Semaphore**: Max 100 concurrent matching operations
- **Spatial Optimization**: Load only 6 nearby requests per operation (highly efficient)
- **Connection Pooling**: Max 150 database connections (optimized for 10k+ concurrent users)
- **Distributed Locks**: Redis-based locks for critical sections
- **Optimistic Locking**: Version numbers prevent race conditions
- **Row-Level Locking**: FOR UPDATE on critical operations
- **Surge Pricing Cache**: Redis cache with 1-minute TTL

## Database Schema

### Key Tables

- `users`: User accounts
- `cabs`: Available cabs with current location
- `ride_requests`: Ride requests with status tracking
- `rides`: Confirmed rides with route and pricing
- `ride_passengers`: Many-to-many relationship

### Indexing Strategy

- **Spatial Index**: GIST index on cab locations for fast proximity queries
- **B-tree Indexes**: On foreign keys, timestamps, and status fields
- **Partial Indexes**: On active rides only
- **Composite Indexes**: For common query patterns

## Assumptions

1. **Geographic Scope**: Airport has defined pickup/dropoff zones
2. **Capacity Constraints**:
   - Maximum 4 passengers per cab
   - Maximum 6 luggage units per cab
   - Luggage sizes: Small (1), Medium (2), Large (3)
3. **Matching Parameters**:
   - Search radius: 5km for nearby requests
   - Max nearby requests loaded: 6 (optimized for 4-passenger cab capacity)
   - Maximum detour: 20% of direct route (default 15 minutes)
   - Matching window: Real-time with spatial optimization
4. **Pricing**:
   - Base fare: ₹50
   - Per km rate: ₹12
   - Fare scales linearly with passenger count
   - Surge pricing during high demand
5. **Ride Lifecycle**:
   - Status flow: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
   - Auto-completion after estimated duration
   - Cron job runs every 1 minute
6. **Driver Availability**:
   - Drivers marked unavailable when assigned
   - Automatically freed after ride completion
   - Location updated to final dropoff point

## Project Structure

```
src/
├── api/
│   ├── routes.ts          # Main ride endpoints
│   ├── userRoutes.ts      # User CRUD
│   ├── cabRoutes.ts       # Cab CRUD
│   └── swagger.ts         # API documentation
├── services/
│   ├── RideService.ts     # Core ride logic
│   ├── RideCompletionService.ts  # Ride completion
│   └── CronService.ts     # Scheduled tasks
├── algorithms/
│   ├── matching.ts        # Passenger matching
│   ├── routing.ts         # Route optimization
│   └── pricing.ts         # Dynamic pricing
├── database/
│   ├── schema.sql         # Database schema
│   ├── migrate.ts         # Migration script
│   └── seed.ts            # Seed data
├── config/
│   ├── database.ts        # DB connection pool
│   └── redis.ts           # Redis client config
├── utils/
│   └── Semaphore.ts       # Concurrency control
└── index.ts               # Application entry point

tests/
├── api-tests/             # API integration tests
├── load-tests/            # Load testing scripts
└── setup/                 # Setup and seed scripts

documentation/             # Project documentation
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Check if database exists
psql -U postgres -l | grep airport_pooling

# Test connection
psql -U postgres -d airport_pooling -c "SELECT 1;"
```

**Common Errors:**
- `FATAL: password authentication failed` → Check `DB_PASSWORD` in `.env`
- `FATAL: database "airport_pooling" does not exist` → Run database creation steps
- `could not connect to server` → PostgreSQL service not running

### Check Database Connections

```bash
# Check current connections
sudo -u postgres psql -d airport_pooling -c "
SELECT count(*) as active_connections, 
       (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max_connections
FROM pg_stat_activity 
WHERE datname = 'airport_pooling';"

# View all active connections
sudo -u postgres psql -d airport_pooling -c "
SELECT pid, usename, application_name, client_addr, state, query_start 
FROM pg_stat_activity 
WHERE datname = 'airport_pooling';"

# Kill idle connections (if needed)
sudo -u postgres psql -d airport_pooling -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'airport_pooling' 
  AND state = 'idle' 
  AND state_change < NOW() - INTERVAL '5 minutes';"
```

**Connection Pool Guidelines:**
- App pool size (`DB_POOL_SIZE`): 150 connections (optimized for high load)
- PostgreSQL `max_connections`: Should be at least 200
- Formula: `max_connections` >= (number of apps × `DB_POOL_SIZE`) + 50 (buffer)
- For single app: 200 max_connections = 150 (app pool) + 50 (buffer for admin/monitoring)
- Monitor connections during load tests to ensure no exhaustion

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server

# Or as a service
sudo service redis-server start

# Check Redis connection
redis-cli
> ping
> exit
```

### PostGIS Extension Issues

```bash
# Check if PostGIS is installed
sudo -u postgres psql -d airport_pooling -c "SELECT PostGIS_version();"

# If not installed, install PostGIS package
# Ubuntu/Debian
sudo apt-get install postgresql-14-postgis-3

# macOS
brew install postgis

# Enable PostGIS in database
sudo -u postgres psql -d airport_pooling -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify spatial functions work
sudo -u postgres psql -d airport_pooling -c "
SELECT ST_Distance(
  ST_MakePoint(-73.9855, 40.7580)::geography,
  ST_MakePoint(-73.7781, 40.6413)::geography
) / 1000 as distance_km;"
# Should return distance in kilometers
```

### Memory Issues

The application is configured with increased heap size:
```bash
node --max-old-space-size=4096
```

If you still encounter memory issues, check:
- Semaphore limit (currently 100 concurrent operations)
- Database connection pool (currently 20 connections)

### No Matches Found

If `/api/rides/matches/:requestId` returns empty array:
- No nearby requests within 5km radius
- No available cabs in the area
- Capacity constraints violated
- Run `npm run test:matching` to create multiple nearby requests

## License

MIT

---

For detailed technical documentation, see [DELIVERABLES.md](DELIVERABLES.md)
