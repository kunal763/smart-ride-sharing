import { PricingEngine } from '../pricing';

describe('PricingEngine', () => {
  let engine: PricingEngine;

  beforeEach(() => {
    engine = new PricingEngine();
  });

  describe('calculateFare', () => {
    it('should calculate base fare correctly', () => {
      const fare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      expect(fare).toBeGreaterThan(0);
      expect(fare).toBeGreaterThanOrEqual(8.0); // Minimum fare
    });

    it('should apply surge pricing', () => {
      const normalFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      const surgeFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 2.0,
        timeOfDay: 12
      });

      expect(surgeFare).toBeGreaterThan(normalFare);
      expect(surgeFare).toBeCloseTo(normalFare * 2, 0);
    });

    it('should apply pooling discount', () => {
      const soloFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      const pooledFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 4,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      expect(pooledFare).toBeLessThan(soloFare);
    });

    it('should apply peak hour multiplier', () => {
      const normalFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      const peakFare = engine.calculateFare({
        baseDistance: 10,
        actualDistance: 10,
        passengers: 1,
        surgeFactor: 1.0,
        timeOfDay: 8 // Peak morning hour
      });

      expect(peakFare).toBeGreaterThan(normalFare);
    });

    it('should enforce minimum fare', () => {
      const fare = engine.calculateFare({
        baseDistance: 0.1,
        actualDistance: 0.1,
        passengers: 4,
        surgeFactor: 1.0,
        timeOfDay: 12
      });

      expect(fare).toBeGreaterThanOrEqual(8.0);
    });
  });

  describe('calculateSurgeFactor', () => {
    it('should return 1.0 when supply meets demand', () => {
      const surge = engine.calculateSurgeFactor(100, 100);
      expect(surge).toBe(1.0);
    });

    it('should increase with high demand', () => {
      const surge = engine.calculateSurgeFactor(200, 100);
      expect(surge).toBeGreaterThan(1.0);
    });

    it('should cap at 3.0', () => {
      const surge = engine.calculateSurgeFactor(1000, 10);
      expect(surge).toBeLessThanOrEqual(3.0);
    });

    it('should handle zero cabs', () => {
      const surge = engine.calculateSurgeFactor(100, 0);
      expect(surge).toBe(3.0);
    });
  });

  describe('splitFare', () => {
    it('should split fare proportionally', () => {
      const fares = engine.splitFare(100, [10, 20, 30]);
      
      expect(fares).toHaveLength(3);
      expect(fares[0]).toBeCloseTo(16.67, 1);
      expect(fares[1]).toBeCloseTo(33.33, 1);
      expect(fares[2]).toBeCloseTo(50.00, 1);
    });

    it('should handle equal distances', () => {
      const fares = engine.splitFare(100, [10, 10, 10]);
      
      expect(fares).toHaveLength(3);
      fares.forEach(fare => {
        expect(fare).toBeCloseTo(33.33, 1);
      });
    });
  });
});
