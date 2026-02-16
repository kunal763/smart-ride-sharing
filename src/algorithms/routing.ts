import { RideRequest, Location } from '../types';
import { calculateDistance, calculateRouteDistance, estimateTravelTime } from './distance';

interface Waypoint {
  type: 'pickup' | 'dropoff';
  location: Location;
  requestId: string;
  passengers: number;
}

interface RouteResult {
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedDuration: number;
}

/**
 * Optimize route for multiple pickups and dropoffs
 * Time Complexity: O(k! × m) where k = passengers, m = waypoints
 * For k <= 4, uses dynamic programming
 * For k > 4, uses greedy heuristic
 * Space Complexity: O(2^k × k)
 */
export function optimizeRoute(requests: RideRequest[]): RouteResult {
  if (requests.length === 1) {
    return createSimpleRoute(requests[0]);
  }
  
  if (requests.length <= 4) {
    return optimizeRouteDynamic(requests);
  }
  
  return optimizeRouteGreedy(requests);
}

/**
 * Simple route for single passenger
 */
function createSimpleRoute(request: RideRequest): RouteResult {
  const waypoints: Waypoint[] = [
    {
      type: 'pickup',
      location: request.pickup,
      requestId: request.id,
      passengers: request.passengers
    },
    {
      type: 'dropoff',
      location: request.dropoff,
      requestId: request.id,
      passengers: request.passengers
    }
  ];
  
  const distance = calculateDistance(request.pickup, request.dropoff);
  
  return {
    waypoints,
    totalDistance: distance,
    estimatedDuration: estimateTravelTime(distance)
  };
}

/**
 * Dynamic programming approach for small groups
 * Ensures optimal solution
 */
function optimizeRouteDynamic(requests: RideRequest[]): RouteResult {
  const waypoints: Waypoint[] = [];
  
  // Create all waypoints
  for (const req of requests) {
    waypoints.push({
      type: 'pickup',
      location: req.pickup,
      requestId: req.id,
      passengers: req.passengers
    });
    waypoints.push({
      type: 'dropoff',
      location: req.dropoff,
      requestId: req.id,
      passengers: req.passengers
    });
  }
  
  // Try all valid permutations and find shortest
  let bestRoute: Waypoint[] | null = null;
  let bestDistance = Infinity;
  
  const validRoutes = generateValidRoutes(waypoints, requests);
  
  for (const route of validRoutes) {
    const distance = calculateRouteDistance(route.map(w => w.location));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = route;
    }
  }
  
  return {
    waypoints: bestRoute!,
    totalDistance: bestDistance,
    estimatedDuration: estimateTravelTime(bestDistance)
  };
}

/**
 * Generate all valid route permutations
 * Valid = pickup before dropoff for each passenger
 */
function generateValidRoutes(waypoints: Waypoint[], requests: RideRequest[]): Waypoint[][] {
  const routes: Waypoint[][] = [];
  
  function isValidRoute(route: Waypoint[]): boolean {
    const picked = new Set<string>();
    
    for (const wp of route) {
      if (wp.type === 'pickup') {
        picked.add(wp.requestId);
      } else {
        if (!picked.has(wp.requestId)) {
          return false;
        }
      }
    }
    return true;
  }
  
  function permute(arr: Waypoint[], start: number = 0) {
    if (start === arr.length - 1) {
      if (isValidRoute(arr)) {
        routes.push([...arr]);
      }
      return;
    }
    
    for (let i = start; i < arr.length; i++) {
      [arr[start], arr[i]] = [arr[i], arr[start]];
      permute(arr, start + 1);
      [arr[start], arr[i]] = [arr[i], arr[start]];
    }
  }
  
  permute([...waypoints]);
  return routes;
}

/**
 * Greedy heuristic for larger groups
 * Nearest neighbor approach
 * Time Complexity: O(k²)
 */
function optimizeRouteGreedy(requests: RideRequest[]): RouteResult {
  const waypoints: Waypoint[] = [];
  const remaining = new Set<string>();
  
  // Initialize waypoints
  for (const req of requests) {
    waypoints.push({
      type: 'pickup',
      location: req.pickup,
      requestId: req.id,
      passengers: req.passengers
    });
    remaining.add(req.id);
  }
  
  const route: Waypoint[] = [];
  const pickedUp = new Set<string>();
  let currentLocation: Location = waypoints[0].location;
  
  // Greedy selection: always pick nearest valid waypoint
  while (waypoints.length > 0 || pickedUp.size > 0) {
    let nearestIdx = -1;
    let nearestDist = Infinity;
    let isPickup = false;
    
    // Find nearest pickup
    for (let i = 0; i < waypoints.length; i++) {
      const dist = calculateDistance(currentLocation, waypoints[i].location);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
        isPickup = true;
      }
    }
    
    // Find nearest dropoff (only for picked up passengers)
    for (const req of requests) {
      if (pickedUp.has(req.id)) {
        const dist = calculateDistance(currentLocation, req.dropoff);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = -1;
          isPickup = false;
        }
      }
    }
    
    if (isPickup && nearestIdx >= 0) {
      const wp = waypoints[nearestIdx];
      route.push(wp);
      pickedUp.add(wp.requestId);
      currentLocation = wp.location;
      waypoints.splice(nearestIdx, 1);
    } else {
      // Add dropoff
      const req = requests.find(r => pickedUp.has(r.id))!;
      route.push({
        type: 'dropoff',
        location: req.dropoff,
        requestId: req.id,
        passengers: req.passengers
      });
      pickedUp.delete(req.id);
      currentLocation = req.dropoff;
    }
  }
  
  const totalDistance = calculateRouteDistance(route.map(w => w.location));
  
  return {
    waypoints: route,
    totalDistance,
    estimatedDuration: estimateTravelTime(totalDistance)
  };
}
