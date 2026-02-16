import { Location } from '../types';

/**
 * Calculate Haversine distance between two points
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) * Math.cos(toRad(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total route distance
 * Time Complexity: O(n) where n = number of waypoints
 * Space Complexity: O(1)
 */
export function calculateRouteDistance(route: Location[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += calculateDistance(route[i], route[i + 1]);
  }
  return total;
}

/**
 * Estimate travel time in minutes
 * Assumes average speed of 40 km/h in city traffic
 */
export function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmh = 40;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}
