import { Router } from 'express';
import { RideService } from '../services/RideService';
import { RideCompletionService } from '../services/RideCompletionService';
import { Semaphore } from '../utils/Semaphore';
import { z } from 'zod';

const router = Router();
const rideService = new RideService();
const completionService = new RideCompletionService();

// Semaphore to limit concurrent matching operations
// With spatial optimization, each operation uses ~200KB instead of 20MB
// 100 concurrent × 200KB = 20MB total (safe)
const matchingSemaphore = new Semaphore(100);

// Validation schemas
const createRequestSchema = z.object({
  userId: z.string().uuid(),
  pickup: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional()
  }),
  dropoff: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional()
  }),
  passengers: z.number().int().min(1).max(4),
  luggage: z.array(z.number().int().min(1).max(3)),
  maxDetourMinutes: z.number().int().min(0).max(30).optional()
});

/**
 * @swagger
 * /api/rides/request:
 *   post:
 *     summary: Create a new ride request
 *     tags: [Rides]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - pickup
 *               - dropoff
 *               - passengers
 *               - luggage
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               pickup:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   address:
 *                     type: string
 *               dropoff:
 *                 type: object
 *                 properties:
 *                   latitude:
 *                     type: number
 *                   longitude:
 *                     type: number
 *                   address:
 *                     type: string
 *               passengers:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *               luggage:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 3
 *     responses:
 *       201:
 *         description: Ride request created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/request', async (req, res) => {
  try {
    const data = createRequestSchema.parse(req.body);
    const request = await rideService.createRideRequest(data);
    
    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error: any) {
    // Log validation errors for debugging
    console.error('Ride request error:', {
      error: error.message,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/rides/matches/{requestId}:
 *   get:
 *     summary: Get available matches for a ride request (synchronous processing)
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of available matches
 *       404:
 *         description: Request not found
 */
router.get('/matches/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Process matches with semaphore (max 100 concurrent)
    const matches = await matchingSemaphore.execute(async () => {
      return await rideService.findMatches(requestId);
    });
    
    // If no matches, mark as no driver available
    if (!matches || matches.length === 0) {
      await rideService.markNoDriverAvailable(requestId);
    }
    
    res.json({
      success: true,
      data: matches
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/rides/book:
 *   post:
 *     summary: Confirm a ride booking
 *     tags: [Rides]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestId
 *               - rideData
 *             properties:
 *               requestId:
 *                 type: string
 *                 format: uuid
 *               rideData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Booking confirmed
 *       400:
 *         description: Booking failed
 */
router.post('/book', async (req, res) => {
  try {
    const { requestId, rideData } = req.body;
    const rideId = await rideService.confirmBooking(requestId, rideData);
    
    res.json({
      success: true,
      data: { rideId }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/rides/{rideId}:
 *   delete:
 *     summary: Cancel a ride
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ride cancelled successfully
 *       400:
 *         description: Cancellation failed
 */
router.delete('/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    await rideService.cancelRide(rideId);
    
    res.json({
      success: true,
      message: 'Ride cancelled successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/rides/{requestId}/status:
 *   get:
 *     summary: Get requestId status
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: requestId status retrieved
 *       404:
 *         description: requestId not found
 */
router.get('/:requestId/status', async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await rideService.getRideRequest(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found'
      });
    }
    
    res.json({
      success: true,
      data: request
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

/**
 * @swagger
 * /api/rides/{rideId}/complete:
 *   post:
 *     summary: Manually complete a ride
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ride completed successfully
 *       400:
 *         description: Cannot complete ride
 */
router.post('/:rideId/complete', async (req, res) => {
  try {
    const { rideId } = req.params;
    await completionService.completeRide(rideId);
    
    res.json({
      success: true,
      message: 'Ride completed successfully. Driver is now available.'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/rides/{rideId}/start:
 *   post:
 *     summary: Start a ride (change status to IN_PROGRESS)
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ride started successfully
 *       400:
 *         description: Cannot start ride
 */
router.post('/:rideId/start', async (req, res) => {
  try {
    const { rideId } = req.params;
    await completionService.startRide(rideId);
    
    res.json({
      success: true,
      message: 'Ride started successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


