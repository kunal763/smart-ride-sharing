import { RideRequest, Ride, MatchResult, PassengerInfo, LuggageSize } from '../types';
import { calculateDistance, calculateRouteDistance, estimateTravelTime } from './distance';
import { optimizeRoute } from './routing';

/**
 * Match passengers into shared rides
 * Time Complexity: O(n log n) where n = number of active requests
 * Space Complexity: O(n)
 * 
 * Algorithm:
 * 1. Sort requests by pickup location (spatial clustering)
 * 2. For each request, find compatible nearby requests
 * 3. Check constraints (seats, luggage, detour)
 * 4. Calculate optimal route and score
 * 5. Return best matches
 */
export class RideMatchingEngine {
  private readonly MAX_PASSENGERS = parseInt(process.env.MAX_PASSENGERS_PER_CAB || '4');
  private readonly MAX_LUGGAGE = parseInt(process.env.MAX_LUGGAGE_CAPACITY || '6');
  private readonly MAX_DETOUR_PCT = parseInt(process.env.MAX_DETOUR_PERCENTAGE || '20');
  private readonly SEARCH_RADIUS_KM = 5; // Search within 5km radius

  /**
   * Find compatible ride matches for a request
   */
  async findMatches(request: RideRequest, activeRequests: RideRequest[]): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    
    // Filter nearby requests within search radius
    const nearbyRequests = this.filterNearbyRequests(request, activeRequests);
    
    // ALWAYS offer a solo ride option first
    const soloRoute = optimizeRoute([request]);
    const soloRide = this.createRide([request], soloRoute);
    matches.push({
      score: 50, // Base score for solo ride
      ride: soloRide,
      savings: 0, // No savings for solo ride
      detourTime: 0 // No detour for solo ride
    });
    
    // Try to match with existing groups for pooling options
    const groups = this.createRequestGroups(nearbyRequests);
    
    for (const group of groups) {
      // Check if request can be added to this group
      if (!this.canAddToGroup(request, group)) {
        continue;
      }
      
      const combinedGroup = [...group, request];
      
      // Check constraints
      if (!this.checkConstraints(combinedGroup)) {
        continue;
      }
      
      // Calculate optimal route
      const route = optimizeRoute(combinedGroup);
      
      // Validate detour tolerance for all passengers
      const detours = this.calculateDetours(combinedGroup, route);
      if (!this.validateDetours(combinedGroup, detours)) {
        continue;
      }
      
      // Calculate match score
      const score = this.calculateMatchScore(combinedGroup, route, detours);
      
      // Create ride object
      const ride = this.createRide(combinedGroup, route);
      
      matches.push({
        score,
        ride,
        savings: this.calculateSavings(combinedGroup, route),
        detourTime: Math.max(...detours)
      });
    }
    
    // Sort by score (higher is better)
    matches.sort((a, b) => b.score - a.score);
    
    return matches.slice(0, 5); // Return top 5 matches
  }

  /**
   * Filter requests within search radius
   * Time Complexity: O(n)
   */
  private filterNearbyRequests(request: RideRequest, requests: RideRequest[]): RideRequest[] {
    return requests.filter(r => {
      if (r.id === request.id) return false;
      const distance = calculateDistance(request.pickup, r.pickup);
      return distance <= this.SEARCH_RADIUS_KM;
    });
  }

  /**
   * Create groups of compatible requests
   * Time Complexity: O(n²) but limited by MAX_PASSENGERS
   */
  private createRequestGroups(requests: RideRequest[]): RideRequest[][] {
    const groups: RideRequest[][] = [];
    
    // Single requests
    for (const req of requests) {
      groups.push([req]);
    }
    
    // Pairs
    for (let i = 0; i < requests.length; i++) {
      for (let j = i + 1; j < requests.length; j++) {
        if (this.checkConstraints([requests[i], requests[j]])) {
          groups.push([requests[i], requests[j]]);
        }
      }
    }
    
    // Triples (if space allows)
    for (let i = 0; i < requests.length; i++) {
      for (let j = i + 1; j < requests.length; j++) {
        for (let k = j + 1; k < requests.length; k++) {
          const group = [requests[i], requests[j], requests[k]];
          if (this.checkConstraints(group)) {
            groups.push(group);
          }
        }
      }
    }
    
    return groups;
  }

  /**
   * Check if request can be added to existing group
   */
  private canAddToGroup(request: RideRequest, group: RideRequest[]): boolean {
    const totalPassengers = group.reduce((sum, r) => sum + r.passengers, 0) + request.passengers;
    return totalPassengers <= this.MAX_PASSENGERS;
  }

  /**
   * Check seat and luggage constraints
   * Time Complexity: O(k) where k = group size
   */
  private checkConstraints(group: RideRequest[]): boolean {
    const totalPassengers = group.reduce((sum, r) => sum + r.passengers, 0);
    const totalLuggage = group.reduce((sum, r) => 
      sum + r.luggage.reduce((lsum, l) => lsum + l, 0), 0
    );
    
    return totalPassengers <= this.MAX_PASSENGERS && 
           totalLuggage <= this.MAX_LUGGAGE;
  }

  /**
   * Calculate detour time for each passenger
   * Time Complexity: O(k) where k = group size
   */
  private calculateDetours(group: RideRequest[], route: any): number[] {
    return group.map(request => {
      const directDistance = calculateDistance(request.pickup, request.dropoff);
      const directTime = estimateTravelTime(directDistance);
      
      // Find actual travel time in shared route
      const pickupIdx = route.waypoints.findIndex((w: any) => 
        w.type === 'pickup' && w.requestId === request.id
      );
      const dropoffIdx = route.waypoints.findIndex((w: any) => 
        w.type === 'dropoff' && w.requestId === request.id
      );
      
      let actualDistance = 0;
      for (let i = pickupIdx; i < dropoffIdx; i++) {
        actualDistance += calculateDistance(
          route.waypoints[i].location,
          route.waypoints[i + 1].location
        );
      }
      
      const actualTime = estimateTravelTime(actualDistance);
      return actualTime - directTime;
    });
  }

  /**
   * Validate all passengers meet detour tolerance
   */
  private validateDetours(group: RideRequest[], detours: number[]): boolean {
    return group.every((request, idx) => {
      const directTime = estimateTravelTime(
        calculateDistance(request.pickup, request.dropoff)
      );
      const maxDetour = (directTime * this.MAX_DETOUR_PCT) / 100;
      return detours[idx] <= Math.max(maxDetour, request.maxDetourMinutes);
    });
  }

  /**
   * Calculate match score (0-100)
   * Higher score = better match
   * Factors: route efficiency, detour minimization, passenger count
   */
  private calculateMatchScore(group: RideRequest[], route: any, detours: number[]): number {
    const groupSize = group.length;
    const avgDetour = detours.reduce((a, b) => a + b, 0) / detours.length;
    
    // Calculate route efficiency
    const directDistances = group.reduce((sum, r) => 
      sum + calculateDistance(r.pickup, r.dropoff), 0
    );
    const efficiency = directDistances / route.totalDistance;
    
    // Weighted scoring
    const sizeScore = (groupSize / this.MAX_PASSENGERS) * 40;
    const efficiencyScore = efficiency * 40;
    const detourScore = Math.max(0, 20 - avgDetour);
    
    return Math.min(100, sizeScore + efficiencyScore + detourScore);
  }

  /**
   * Calculate cost savings from pooling
   */
  private calculateSavings(group: RideRequest[], route: any): number {
    const individualCosts = group.reduce((sum, r) => {
      const distance = calculateDistance(r.pickup, r.dropoff);
      return sum + (distance * 2.5); // $2.5 per km base rate
    }, 0);
    
    const sharedCost = route.totalDistance * 2.5;
    return individualCosts - sharedCost;
  }

  /**
   * Create ride object from matched group
   */
  private createRide(group: RideRequest[], route: any): any {
    return {
      passengers: group.map((r, idx) => ({
        requestId: r.id,
        userId: r.userId,
        pickup: r.pickup,
        dropoff: r.dropoff,
        passengers: r.passengers,
        luggage: r.luggage,
        pickupOrder: route.waypoints.findIndex((w: any) => 
          w.type === 'pickup' && w.requestId === r.id
        ),
        dropoffOrder: route.waypoints.findIndex((w: any) => 
          w.type === 'dropoff' && w.requestId === r.id
        ),
        fare: 0, // Calculated by pricing engine
        detourMinutes: 0
      })),
      route: route.waypoints.map((w: any) => w.location),
      totalDistance: route.totalDistance,
      estimatedDuration: route.estimatedDuration
    };
  }
}
