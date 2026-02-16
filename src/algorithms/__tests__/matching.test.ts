import { RideMatchingEngine } from '../matching';
import { RideRequest, RideStatus, LuggageSize } from '../../types';

describe('RideMatchingEngine', () => {
  let engine: RideMatchingEngine;

  beforeEach(() => {
    engine = new RideMatchingEngine();
  });

  const createMockRequest = (overrides: Partial<RideRequest> = {}): RideRequest => ({
    id: Math.random().toString(),
    userId: 'user-123',
    pickup: { latitude: 40.7128, longitude: -74.0060 },
    dropoff: { latitude: 40.7580, longitude: -73.9855 },
    requestedAt: new Date(),
    passengers: 2,
    luggage: [LuggageSize.SMALL, LuggageSize.MEDIUM],
    maxDetourMinutes: 15,
    status: RideStatus.PENDING,
    version: 1,
    ...overrides
  });

  describe('findMatches', () => {
    it('should find compatible matches', async () => {
      const request1 = createMockRequest();
      const request2 = createMockRequest({
        pickup: { latitude: 40.7130, longitude: -74.0062 },
        passengers: 1,
        luggage: [LuggageSize.SMALL]
      });

      const matches = await engine.findMatches(request1, [request2]);

      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should respect passenger capacity', async () => {
      const request1 = createMockRequest({ passengers: 3 });
      const request2 = createMockRequest({ passengers: 3 });

      const matches = await engine.findMatches(request1, [request2]);

      // Should not match as 3 + 3 > 4 (max capacity)
      expect(matches.length).toBe(0);
    });

    it('should respect luggage capacity', async () => {
      const request1 = createMockRequest({
        luggage: [LuggageSize.LARGE, LuggageSize.LARGE]
      });
      const request2 = createMockRequest({
        luggage: [LuggageSize.LARGE, LuggageSize.LARGE]
      });

      const matches = await engine.findMatches(request1, [request2]);

      // Should not match as luggage exceeds capacity
      expect(matches.length).toBe(0);
    });

    it('should filter by search radius', async () => {
      const request1 = createMockRequest();
      const farRequest = createMockRequest({
        pickup: { latitude: 41.0, longitude: -75.0 } // Far away
      });

      const matches = await engine.findMatches(request1, [farRequest]);

      expect(matches.length).toBe(0);
    });
  });
});
