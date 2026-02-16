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

### 1. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 2. Setup PostgreSQL Database

```bash
# Create database
createdb airport_pooling

# If you get permission errors, try:
sudo -u postgres createdb airport_pooling

# Enable PostGIS extension (connect to database first)
psql airport_pooling
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

### 3. Configure Environment Variables

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

# Redis 
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
PORT=3000
```

### 4. Run Database Migrations

```bash
# Run migrations to create tables and indexes
npm run migrate
```

### 5. Seed Sample Data

```bash
# Load 10,000 sample users
npm run seed:10k

# Load 1,000 sample cabs
npm run seed:cabs
```

### 6. Start Redis

```bash
# Start Redis server (in a separate terminal)
redis-server

# Or if installed as a service
sudo service redis-server start

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 7. Start the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start at `http://localhost:3000`

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
- **Time Complexity**: O(k log k) where k = nearby requests (max 100)
- **Space Complexity**: O(k)
- **Optimization**: PostGIS spatial queries (ST_DWithin) load only nearby requests within 5km radius

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
- **Latency P95**: 302ms
- **Latency P99**: 353ms
- **Driver Utilization**: 88.3%

## Concurrency Handling

- **Semaphore**: Max 100 concurrent matching operations
- **Spatial Optimization**: Load only nearby requests (200KB vs 20MB per operation)
- **Connection Pooling**: Max 20 database connections
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
│   └── database.ts        # DB connection pool
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
sudo service postgresql status

# Start PostgreSQL
sudo service postgresql start

# Check if database exists
psql -l | grep airport_pooling
```

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

### PostGIS Extension Missing

```bash
# Install PostGIS (Ubuntu/Debian)
sudo apt-get install postgresql-14-postgis-3

# Enable in database
psql airport_pooling -c "CREATE EXTENSION IF NOT EXISTS postgis;"
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
