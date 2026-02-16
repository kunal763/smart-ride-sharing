export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export enum LuggageSize {
  SMALL = 1,
  MEDIUM = 2,
  LARGE = 3
}

export enum RideStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface RideRequest {
  id: string;
  userId: string;
  pickup: Location;
  dropoff: Location;
  requestedAt: Date;
  passengers: number;
  luggage: LuggageSize[];
  maxDetourMinutes: number;
  status: RideStatus;
  version: number;
}

export interface Ride {
  id: string;
  cabId: string;
  passengers: PassengerInfo[];
  route: Location[];
  totalDistance: number;
  estimatedDuration: number;
  basePrice: number;
  surgeFactor: number;
  status: RideStatus;
  createdAt: Date;
  version: number;
}

export interface PassengerInfo {
  requestId: string;
  userId: string;
  pickup: Location;
  dropoff: Location;
  passengers: number;
  luggage: LuggageSize[];
  pickupOrder: number;
  dropoffOrder: number;
  fare: number;
  detourMinutes: number;
}

export interface MatchResult {
  score: number;
  ride: Ride;
  savings: number;
  detourTime: number;
}

export interface PricingParams {
  baseDistance: number;
  actualDistance: number;
  passengers: number; // Number of passengers in THIS booking (1-4)
  surgeFactor: number;
  timeOfDay: number;
  totalPassengersInRide?: number; // Total passengers in the shared ride (for discount)
}
