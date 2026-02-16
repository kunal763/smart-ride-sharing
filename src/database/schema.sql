-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ride requests table
CREATE TABLE IF NOT EXISTS ride_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    pickup_lat DECIMAL(10, 8) NOT NULL,
    pickup_lng DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT,
    dropoff_lat DECIMAL(10, 8) NOT NULL,
    dropoff_lng DECIMAL(11, 8) NOT NULL,
    dropoff_address TEXT,
    passengers INTEGER NOT NULL CHECK (passengers > 0 AND passengers <= 4),
    luggage JSONB NOT NULL DEFAULT '[]',
    max_detour_minutes INTEGER NOT NULL DEFAULT 15,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Cabs table
CREATE TABLE IF NOT EXISTS cabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    driver_name VARCHAR(255) NOT NULL,
    driver_phone VARCHAR(20) NOT NULL,
    max_passengers INTEGER NOT NULL DEFAULT 4,
    max_luggage_capacity INTEGER NOT NULL DEFAULT 6,
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rides table
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cab_id UUID NOT NULL REFERENCES cabs(id),
    route JSONB NOT NULL,
    total_distance DECIMAL(10, 2) NOT NULL,
    estimated_duration INTEGER NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    surge_factor DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_ride_status CHECK (status IN ('PENDING', 'MATCHED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- Ride passengers junction table
CREATE TABLE IF NOT EXISTS ride_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES ride_requests(id),
    pickup_order INTEGER NOT NULL,
    dropoff_order INTEGER NOT NULL,
    fare DECIMAL(10, 2) NOT NULL,
    detour_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ride_id, request_id)
);

-- Pricing history for analytics
CREATE TABLE IF NOT EXISTS pricing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id),
    base_fare DECIMAL(10, 2) NOT NULL,
    distance_fare DECIMAL(10, 2) NOT NULL,
    surge_multiplier DECIMAL(5, 2) NOT NULL,
    final_fare DECIMAL(10, 2) NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- B-tree indexes on foreign keys
CREATE INDEX idx_ride_requests_user_id ON ride_requests(user_id);
CREATE INDEX idx_ride_requests_status ON ride_requests(status) WHERE status IN ('PENDING', 'MATCHED');
CREATE INDEX idx_rides_cab_id ON rides(cab_id);
CREATE INDEX idx_ride_passengers_ride_id ON ride_passengers(ride_id);
CREATE INDEX idx_ride_passengers_request_id ON ride_passengers(request_id);

-- Composite indexes for common queries
CREATE INDEX idx_ride_requests_status_time ON ride_requests(status, requested_at DESC);
CREATE INDEX idx_rides_status_created ON rides(status, created_at DESC);

-- GiST indexes for geospatial queries
CREATE INDEX idx_ride_requests_pickup_location ON ride_requests USING GIST (
    ST_MakePoint(pickup_lng, pickup_lat)
);
CREATE INDEX idx_ride_requests_dropoff_location ON ride_requests USING GIST (
    ST_MakePoint(dropoff_lng, dropoff_lat)
);
CREATE INDEX idx_cabs_location ON cabs USING GIST (
    ST_MakePoint(current_lng, current_lat)
) WHERE is_available = true;

-- Partial index for active requests (only PENDING status)
CREATE INDEX idx_active_requests ON ride_requests(requested_at DESC) 
WHERE status = 'PENDING';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_requests_updated_at BEFORE UPDATE ON ride_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cabs_updated_at BEFORE UPDATE ON cabs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
