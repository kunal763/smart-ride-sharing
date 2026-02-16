import pool from '../config/database';
import { RideStatus } from '../types';

/**
 * Service to handle automatic ride completion and driver release
 */
export class RideCompletionService {
  /**
   * Complete rides that have passed their estimated duration
   * This should be run periodically (e.g., every minute via cron job)
   */
  async completeExpiredRides(): Promise<number> {
    const client = await pool.connect();
    let completedCount = 0;

    try {
      await client.query('BEGIN');

      // Find rides that should be completed
      // (created_at + estimated_duration has passed and status is IN_PROGRESS or CONFIRMED)
      const expiredRides = await client.query(`
        SELECT r.id, r.cab_id, r.estimated_duration, r.created_at
        FROM rides r
        WHERE r.status IN ($1, $2)
        AND r.created_at + (r.estimated_duration || ' minutes')::INTERVAL < NOW()
        FOR UPDATE
      `, [RideStatus.CONFIRMED, RideStatus.IN_PROGRESS]);

      for (const ride of expiredRides.rows) {
        // Get the final dropoff location from the ride route
        const rideDetails = await client.query(
          'SELECT route FROM rides WHERE id = $1',
          [ride.id]
        );
        
        const route = rideDetails.rows[0].route;
        let finalDropoffLat = null;
        let finalDropoffLng = null;
        
        // Extract final dropoff location from route waypoints
        if (route && route.waypoints && route.waypoints.length > 0) {
          const lastWaypoint = route.waypoints[route.waypoints.length - 1];
          if (lastWaypoint.type === 'dropoff' && lastWaypoint.location) {
            finalDropoffLat = lastWaypoint.location.latitude;
            finalDropoffLng = lastWaypoint.location.longitude;
          }
        }
        
        // Update ride status to COMPLETED
        await client.query(
          'UPDATE rides SET status = $1, version = version + 1 WHERE id = $2',
          [RideStatus.COMPLETED, ride.id]
        );

        // Free up the cab and update its location to final dropoff
        if (finalDropoffLat && finalDropoffLng) {
          await client.query(
            'UPDATE cabs SET is_available = true, current_lat = $1, current_lng = $2 WHERE id = $3',
            [finalDropoffLat, finalDropoffLng, ride.cab_id]
          );
        } else {
          // Fallback: just free up the cab without updating location
          await client.query(
            'UPDATE cabs SET is_available = true WHERE id = $1',
            [ride.cab_id]
          );
        }

        // Update associated requests to COMPLETED
        await client.query(`
          UPDATE ride_requests SET status = $1
          WHERE id IN (SELECT request_id FROM ride_passengers WHERE ride_id = $2)
        `, [RideStatus.COMPLETED, ride.id]);

        completedCount++;
      }

      await client.query('COMMIT');
      
      if (completedCount > 0) {
        console.log(`✓ Auto-completed ${completedCount} ride(s) and freed up driver(s)`);
      }

      return completedCount;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error completing expired rides:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Manually complete a ride
   */
  async completeRide(rideId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get ride details
      const rideCheck = await client.query(
        'SELECT status, cab_id FROM rides WHERE id = $1 FOR UPDATE',
        [rideId]
      );

      if (rideCheck.rows.length === 0) {
        throw new Error('Ride not found');
      }

      if (rideCheck.rows[0].status === RideStatus.COMPLETED) {
        throw new Error('Ride already completed');
      }

      if (rideCheck.rows[0].status === RideStatus.CANCELLED) {
        throw new Error('Cannot complete cancelled ride');
      }

      const cabId = rideCheck.rows[0].cab_id;

      // Get the final dropoff location from the ride route
      const rideDetails = await client.query(
        'SELECT route FROM rides WHERE id = $1',
        [rideId]
      );
      
      const route = rideDetails.rows[0].route;
      let finalDropoffLat = null;
      let finalDropoffLng = null;
      
      // Extract final dropoff location from route waypoints
      if (route && route.waypoints && route.waypoints.length > 0) {
        const lastWaypoint = route.waypoints[route.waypoints.length - 1];
        if (lastWaypoint.type === 'dropoff' && lastWaypoint.location) {
          finalDropoffLat = lastWaypoint.location.latitude;
          finalDropoffLng = lastWaypoint.location.longitude;
        }
      }

      // Update ride status
      await client.query(
        'UPDATE rides SET status = $1, version = version + 1 WHERE id = $2',
        [RideStatus.COMPLETED, rideId]
      );

      // Free up the cab and update its location to final dropoff
      if (finalDropoffLat && finalDropoffLng) {
        await client.query(
          'UPDATE cabs SET is_available = true, current_lat = $1, current_lng = $2 WHERE id = $3',
          [finalDropoffLat, finalDropoffLng, cabId]
        );
      } else {
        // Fallback: just free up the cab without updating location
        await client.query(
          'UPDATE cabs SET is_available = true WHERE id = $1',
          [cabId]
        );
      }

      // Update associated requests
      await client.query(`
        UPDATE ride_requests SET status = $1
        WHERE id IN (SELECT request_id FROM ride_passengers WHERE ride_id = $2)
      `, [RideStatus.COMPLETED, rideId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start a ride (change status from CONFIRMED to IN_PROGRESS)
   */
  async startRide(rideId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const rideCheck = await client.query(
        'SELECT status FROM rides WHERE id = $1 FOR UPDATE',
        [rideId]
      );

      if (rideCheck.rows.length === 0) {
        throw new Error('Ride not found');
      }

      if (rideCheck.rows[0].status !== RideStatus.CONFIRMED) {
        throw new Error('Can only start confirmed rides');
      }

      // Update ride status to IN_PROGRESS
      await client.query(
        'UPDATE rides SET status = $1, version = version + 1 WHERE id = $2',
        [RideStatus.IN_PROGRESS, rideId]
      );

      // Update associated requests
      await client.query(`
        UPDATE ride_requests SET status = $1
        WHERE id IN (SELECT request_id FROM ride_passengers WHERE ride_id = $2)
      `, [RideStatus.IN_PROGRESS, rideId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
