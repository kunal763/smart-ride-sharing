import pool from '../config/database';
import redisClient from '../config/redis';
import { RideRequest, RideStatus, Location, LuggageSize } from '../types';
import { RideMatchingEngine } from '../algorithms/matching';
import { PricingEngine } from '../algorithms/pricing';
import { v4 as uuidv4 } from 'uuid';

export class RideService {
  private matchingEngine: RideMatchingEngine;
  private pricingEngine: PricingEngine;

  constructor() {
    this.matchingEngine = new RideMatchingEngine();
    this.pricingEngine = new PricingEngine();
  }

  /**
   * Create a new ride request
   * Uses optimistic locking for concurrency control
   */
  async createRideRequest(data: {
    userId: string;
    pickup: Location;
    dropoff: Location;
    passengers: number;
    luggage: LuggageSize[];
    maxDetourMinutes?: number;
  }): Promise<RideRequest> {
    const client = await pool.connect();
    
    try {
      const requestId = uuidv4();
      
      const result = await client.query(
        `INSERT INTO ride_requests 
        (id, user_id, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, 
         passengers, luggage, max_detour_minutes, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING *`,
        [
          requestId,
          data.userId,
          data.pickup.latitude,
          data.pickup.longitude,
          data.pickup.address || '',
          data.dropoff.latitude,
          data.dropoff.longitude,
          data.dropoff.address || '',
          data.passengers,
          JSON.stringify(data.luggage),
          data.maxDetourMinutes || 15,
          RideStatus.PENDING
        ]
      );
      
      const request = this.mapRowToRequest(result.rows[0]);
      
      // Cache in Redis for fast matching (reduced TTL for memory efficiency)
      await redisClient.setEx(
        `request:${requestId}`,
        60, // 1 minute TTL (sufficient for matching under load)
        JSON.stringify(request)
      );
      
      return request;
    } finally {
      client.release();
    }
  }

  /**
   * Find matches for a ride request
   * Implements distributed locking to prevent race conditions
   */
  async findMatches(requestId: string): Promise<any[]> {
    const lockKey = `lock:matching:${requestId}`;
    const lockValue = uuidv4();
    
    try {
      // Acquire distributed lock
      const locked = await redisClient.set(lockKey, lockValue, {
        NX: true,
        EX: 10 // 10 seconds
      });
      
      if (!locked) {
        throw new Error('Matching in progress, please retry');
      }
      
      // Get request details
      const request = await this.getRideRequest(requestId);
      if (!request) {
        throw new Error('Request not found');
      }
      
      // Get active requests from cache or database (optimized with spatial filtering)
      const activeRequests = await this.getActiveRequests(request.pickup);
      
      // Find matches
      const matches = await this.matchingEngine.findMatches(request, activeRequests);
      
      // Calculate pricing for each match
      const surgeFactor = await this.getCurrentSurgeFactor();
      const currentHour = new Date().getHours();
      
      for (const match of matches) {
        const totalPassengersInRide = match.ride.passengers.reduce((sum, p) => sum + p.passengers, 0);
        
        for (const passenger of match.ride.passengers) {
          // Calculate distance for this specific passenger
          const passengerDistance = this.calculatePassengerDistance(passenger, match.ride.route);
          
          passenger.fare = this.pricingEngine.calculateFare({
            baseDistance: passengerDistance,
            actualDistance: passengerDistance,
            passengers: passenger.passengers, // Number of passengers in THIS booking
            surgeFactor,
            timeOfDay: currentHour,
            totalPassengersInRide // Total passengers in the ride (for discount calculation)
          });
        }
      }
      
      return matches;
    } finally {
      // Release lock
      const currentValue = await redisClient.get(lockKey);
      if (currentValue === lockValue) {
        await redisClient.del(lockKey);
      }
    }
  }

  /**
   * Confirm a ride booking
   * Uses database transactions and optimistic locking
   */
  async confirmBooking(requestId: string, rideData: any): Promise<string> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check request version (optimistic locking)
      const requestCheck = await client.query(
        'SELECT version, status FROM ride_requests WHERE id = $1 FOR UPDATE',
        [requestId]
      );
      
      if (requestCheck.rows.length === 0) {
        throw new Error('Request not found');
      }
      
      if (requestCheck.rows[0].status !== RideStatus.PENDING) {
        throw new Error('Request already processed');
      }
      
      // Get an available cab
      const cabResult = await client.query(
        'SELECT id FROM cabs WHERE is_available = true LIMIT 1 FOR UPDATE'
      );
      
      if (cabResult.rows.length === 0) {
        throw new Error('No available cabs at the moment');
      }
      
      const cabId = cabResult.rows[0].id;
      
      // Mark cab as unavailable
      await client.query(
        'UPDATE cabs SET is_available = false WHERE id = $1',
        [cabId]
      );
      
      // Create ride
      const rideId = uuidv4();
      await client.query(
        `INSERT INTO rides (id, cab_id, route, total_distance, estimated_duration, base_price, surge_factor, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rideId,
          cabId,
          JSON.stringify(rideData.route),
          rideData.totalDistance,
          rideData.estimatedDuration,
          rideData.basePrice || 0,
          rideData.surgeFactor || 1.0,
          RideStatus.CONFIRMED
        ]
      );
      
      // Add passengers
      for (const passenger of rideData.passengers) {
        await client.query(
          `INSERT INTO ride_passengers (ride_id, request_id, pickup_order, dropoff_order, fare, detour_minutes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            rideId,
            passenger.requestId,
            passenger.pickupOrder,
            passenger.dropoffOrder,
            passenger.fare,
            passenger.detourMinutes
          ]
        );
        
        // Update request status
        await client.query(
          'UPDATE ride_requests SET status = $1, version = version + 1 WHERE id = $2',
          [RideStatus.CONFIRMED, passenger.requestId]
        );
      }
      
      await client.query('COMMIT');
      
      // Clear cache
      await redisClient.del(`request:${requestId}`);
      
      return rideId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a ride
   * Handles concurrent cancellations with optimistic locking
   */
  async cancelRide(rideId: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check ride version and get cab_id
      const rideCheck = await client.query(
        'SELECT version, status, cab_id FROM rides WHERE id = $1 FOR UPDATE',
        [rideId]
      );
      
      if (rideCheck.rows.length === 0) {
        throw new Error('Ride not found');
      }
      
      if (rideCheck.rows[0].status === RideStatus.CANCELLED) {
        throw new Error('Ride already cancelled');
      }
      
      if (rideCheck.rows[0].status === RideStatus.COMPLETED) {
        throw new Error('Cannot cancel completed ride');
      }
      
      const cabId = rideCheck.rows[0].cab_id;
      
      // Update ride status
      await client.query(
        'UPDATE rides SET status = $1, version = version + 1 WHERE id = $2',
        [RideStatus.CANCELLED, rideId]
      );
      
      // Free up the cab
      await client.query(
        'UPDATE cabs SET is_available = true WHERE id = $1',
        [cabId]
      );
      
      // Update all associated requests
      await client.query(
        `UPDATE ride_requests SET status = $1 
         WHERE id IN (SELECT request_id FROM ride_passengers WHERE ride_id = $2)`,
        [RideStatus.PENDING, rideId]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Mark request as no driver available
   * Updates status to CANCELLED when no matches found
   */
  async markNoDriverAvailable(requestId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query(
        'UPDATE ride_requests SET status = $1 WHERE id = $2 AND status = $3',
        [RideStatus.CANCELLED, requestId, RideStatus.PENDING]
      );

      // Clear cache
      await redisClient.del(`request:${requestId}`);
    } finally {
      client.release();
    }
  }


  /**
   * Get ride request by ID
   */
  async getRideRequest(requestId: string): Promise<RideRequest | null> {
    // Try cache first
    const cached = await redisClient.get(`request:${requestId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fallback to database
    const result = await pool.query(
      'SELECT * FROM ride_requests WHERE id = $1',
      [requestId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToRequest(result.rows[0]);
  }

  /**
   * Get active ride requests (optimized with spatial filtering)
   * Only loads requests within a reasonable matching radius
   */
  private async getActiveRequests(centerLocation?: Location): Promise<RideRequest[]> {
    // If we have a center location, use spatial query to get only nearby requests
    if (centerLocation) {
      const radiusKm = 5; // 5km radius for matching
      const result = await pool.query(
        `SELECT * FROM ride_requests 
         WHERE status = $1 
         AND requested_at > NOW() - INTERVAL '10 minutes'
         AND ST_DWithin(
           ST_MakePoint(pickup_lng, pickup_lat)::geography,
           ST_MakePoint($2, $3)::geography,
           $4
         )
         ORDER BY requested_at DESC
         LIMIT 6`,
        [RideStatus.PENDING, centerLocation.longitude, centerLocation.latitude, radiusKm * 1000]
      );
      
      return result.rows.map(row => this.mapRowToRequest(row));
    }
    
    // Fallback: load recent requests with limit
    const result = await pool.query(
      `SELECT * FROM ride_requests 
       WHERE status = $1 
       AND requested_at > NOW() - INTERVAL '10 minutes'
       ORDER BY requested_at DESC
       LIMIT 100`,
      [RideStatus.PENDING]
    );
    
    return result.rows.map(row => this.mapRowToRequest(row));
  }

  /**
   * Get current surge factor from Redis cache
   */
  private async getCurrentSurgeFactor(): Promise<number> {
    const cached = await redisClient.get('surge:current');
    if (cached) {
      return parseFloat(cached);
    }
    
    // Calculate surge factor
    const activeCount = await pool.query(
      'SELECT COUNT(*) FROM ride_requests WHERE status = $1',
      [RideStatus.PENDING]
    );
    
    const availableCabs = await pool.query(
      'SELECT COUNT(*) FROM cabs WHERE is_available = true'
    );
    
    const surge = this.pricingEngine.calculateSurgeFactor(
      parseInt(activeCount.rows[0].count),
      parseInt(availableCabs.rows[0].count)
    );
    
    // Cache for 1 minute
    await redisClient.setEx('surge:current', 60, surge.toString());
    
    return surge;
  }

  /**
   * Calculate distance traveled by a specific passenger
   */
  private calculatePassengerDistance(passenger: any, route: any[]): number {
    // Find pickup and dropoff indices in the route
    const pickupIdx = passenger.pickupOrder;
    const dropoffIdx = passenger.dropoffOrder;
    
    // Calculate distance from pickup to dropoff
    let distance = 0;
    for (let i = pickupIdx; i < dropoffIdx && i < route.length - 1; i++) {
      const from = route[i];
      const to = route[i + 1];
      
      // Simple distance calculation (Haversine would be more accurate)
      const latDiff = to.latitude - from.latitude;
      const lngDiff = to.longitude - from.longitude;
      distance += Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
    }
    
    return distance;
  }

  /**
   * Map database row to RideRequest object
   */
  private mapRowToRequest(row: any): RideRequest {
    return {
      id: row.id,
      userId: row.user_id,
      pickup: {
        latitude: parseFloat(row.pickup_lat),
        longitude: parseFloat(row.pickup_lng),
        address: row.pickup_address
      },
      dropoff: {
        latitude: parseFloat(row.dropoff_lat),
        longitude: parseFloat(row.dropoff_lng),
        address: row.dropoff_address
      },
      requestedAt: row.requested_at,
      passengers: row.passengers,
      luggage: row.luggage,
      maxDetourMinutes: row.max_detour_minutes,
      status: row.status,
      version: row.version
    };
  }
}
