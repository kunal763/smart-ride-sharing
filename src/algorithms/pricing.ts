import { PricingParams } from '../types';

/**
 * Dynamic Pricing Engine
 * Time Complexity: O(1)
 * 
 * Formula:
 * Base Fare = $5
 * Distance Rate = $2.5/km
 * Surge Multiplier = 1.0 - 3.0 (based on demand)
 * Time Multiplier = 1.0 - 1.5 (peak hours)
 * Pooling Discount = 20% - 40% (based on group size)
 * 
 * Final Fare = (Base + Distance × Rate) × Surge × Time × (1 - Discount)
 */
export class PricingEngine {
  private readonly BASE_FARE = 5.0;
  private readonly RATE_PER_KM = 2.5;
  private readonly MIN_FARE = 8.0;

  /**
   * Calculate fare for a passenger in a ride
   * @param params.baseDistance - Direct distance for this passenger
   * @param params.actualDistance - Actual distance traveled in the route
   * @param params.passengers - Number of passengers THIS booking has (1-4)
   * @param params.surgeFactor - Current surge multiplier
   * @param params.timeOfDay - Hour of day (0-23)
   * @param params.totalPassengersInRide - Total passengers in the shared ride (for discount)
   */
  calculateFare(params: PricingParams & { totalPassengersInRide?: number }): number {
    const { baseDistance, actualDistance, passengers, surgeFactor, timeOfDay, totalPassengersInRide } = params;
    
    // Base calculation PER PASSENGER
    const baseFarePerPassenger = this.BASE_FARE;
    const distanceFarePerPassenger = actualDistance * this.RATE_PER_KM;
    
    // Time-based multiplier (peak hours: 7-9 AM, 5-7 PM)
    const timeMultiplier = this.getTimeMultiplier(timeOfDay);
    
    // Pooling discount based on total passengers in the ride
    const poolingDiscount = this.getPoolingDiscount(totalPassengersInRide || passengers);
    
    // Calculate fare for ONE passenger
    let farePerPassenger = (baseFarePerPassenger + distanceFarePerPassenger) * surgeFactor * timeMultiplier;
    farePerPassenger = farePerPassenger * (1 - poolingDiscount);
    
    // Multiply by number of passengers in THIS booking
    let totalFare = farePerPassenger * passengers;
    
    // Apply minimum fare (per booking, not per passenger)
    return Math.max(this.MIN_FARE, Math.round(totalFare * 100) / 100);
  }

  /**
   * Calculate surge factor based on demand
   * Uses exponential function: surge = 1 + (demand / capacity)^2
   */
  calculateSurgeFactor(activeRequests: number, availableCabs: number): number {
    if (availableCabs === 0) return 3.0; // Max surge
    
    const demandRatio = activeRequests / availableCabs;
    const surge = 1 + Math.pow(Math.min(demandRatio, 2), 2);
    
    return Math.min(3.0, Math.max(1.0, surge));
  }

  /**
   * Time-based multiplier
   * Peak hours: 1.5x
   * Normal hours: 1.0x
   */
  private getTimeMultiplier(hour: number): number {
    // Peak morning: 7-9 AM
    if (hour >= 7 && hour < 9) return 1.5;
    
    // Peak evening: 5-7 PM
    if (hour >= 17 && hour < 19) return 1.5;
    
    // Late night: 11 PM - 5 AM
    if (hour >= 23 || hour < 5) return 1.3;
    
    return 1.0;
  }

  /**
   * Pooling discount based on group size
   * 2 passengers: 20% discount
   * 3 passengers: 30% discount
   * 4 passengers: 40% discount
   */
  private getPoolingDiscount(passengers: number): number {
    switch (passengers) {
      case 1: return 0;
      case 2: return 0.20;
      case 3: return 0.30;
      case 4: return 0.40;
      default: return 0.40;
    }
  }

  /**
   * Calculate fare split for shared ride
   * Each passenger pays proportional to their distance
   */
  splitFare(totalFare: number, distances: number[]): number[] {
    const totalDistance = distances.reduce((a, b) => a + b, 0);
    
    return distances.map(d => {
      const proportion = d / totalDistance;
      return Math.round(totalFare * proportion * 100) / 100;
    });
  }

  /**
   * Estimate savings from pooling
   */
  calculateSavings(soloFare: number, pooledFare: number): number {
    return Math.round((soloFare - pooledFare) * 100) / 100;
  }
}
