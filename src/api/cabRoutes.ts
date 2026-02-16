import { Router } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Validation schema
const createCabSchema = z.object({
  licensePlate: z.string().min(1).max(20),
  driverName: z.string().min(1).max(255),
  driverPhone: z.string().min(10).max(20),
  maxPassengers: z.number().int().min(1).max(10).optional().default(4),
  maxLuggageCapacity: z.number().int().min(1).max(20).optional().default(6),
  currentLat: z.number().min(-90).max(90).optional(),
  currentLng: z.number().min(-180).max(180).optional()
});

const updateCabSchema = z.object({
  licensePlate: z.string().min(1).max(20).optional(),
  driverName: z.string().min(1).max(255).optional(),
  driverPhone: z.string().min(10).max(20).optional(),
  maxPassengers: z.number().int().min(1).max(10).optional(),
  maxLuggageCapacity: z.number().int().min(1).max(20).optional(),
  currentLat: z.number().min(-90).max(90).optional(),
  currentLng: z.number().min(-180).max(180).optional(),
  isAvailable: z.boolean().optional()
});

/**
 * @swagger
 * /api/cabs:
 *   post:
 *     summary: Create a new cab
 *     tags: [Cabs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licensePlate
 *               - driverName
 *               - driverPhone
 *             properties:
 *               licensePlate:
 *                 type: string
 *                 example: CAB1234
 *               driverName:
 *                 type: string
 *                 example: John Driver
 *               driverPhone:
 *                 type: string
 *                 example: +15551234567
 *               maxPassengers:
 *                 type: integer
 *                 default: 4
 *               maxLuggageCapacity:
 *                 type: integer
 *                 default: 6
 *               currentLat:
 *                 type: number
 *                 example: 40.7128
 *               currentLng:
 *                 type: number
 *                 example: -74.0060
 *     responses:
 *       201:
 *         description: Cab created successfully
 *       400:
 *         description: Invalid input or license plate already exists
 */
router.post('/', async (req, res) => {
  try {
    const data = createCabSchema.parse(req.body);
    
    const cabId = uuidv4();
    const result = await pool.query(
      `INSERT INTO cabs (id, license_plate, driver_name, driver_phone, max_passengers, max_luggage_capacity, current_lat, current_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        cabId,
        data.licensePlate,
        data.driverName,
        data.driverPhone,
        data.maxPassengers,
        data.maxLuggageCapacity,
        data.currentLat || null,
        data.currentLng || null
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({
        success: false,
        error: 'License plate already exists'
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * @swagger
 * /api/cabs:
 *   get:
 *     summary: Get all cabs
 *     tags: [Cabs]
 *     parameters:
 *       - in: query
 *         name: available
 *         schema:
 *           type: boolean
 *         description: Filter by availability
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of cabs
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const available = req.query.available;
    
    let query = 'SELECT * FROM cabs';
    let countQuery = 'SELECT COUNT(*) FROM cabs';
    const params: any[] = [];
    
    if (available !== undefined) {
      const isAvailable = available === 'true';
      query += ' WHERE is_available = $1';
      countQuery += ' WHERE is_available = $1';
      params.push(isAvailable);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, available !== undefined ? [available === 'true'] : []);
    
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
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
 * /api/cabs/{cabId}:
 *   get:
 *     summary: Get cab by ID
 *     tags: [Cabs]
 *     parameters:
 *       - in: path
 *         name: cabId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cab details
 *       404:
 *         description: Cab not found
 */
router.get('/:cabId', async (req, res) => {
  try {
    const { cabId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM cabs WHERE id = $1',
      [cabId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cab not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
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
 * /api/cabs/{cabId}:
 *   put:
 *     summary: Update cab
 *     tags: [Cabs]
 *     parameters:
 *       - in: path
 *         name: cabId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               licensePlate:
 *                 type: string
 *               driverName:
 *                 type: string
 *               driverPhone:
 *                 type: string
 *               maxPassengers:
 *                 type: integer
 *               maxLuggageCapacity:
 *                 type: integer
 *               currentLat:
 *                 type: number
 *               currentLng:
 *                 type: number
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Cab updated successfully
 *       404:
 *         description: Cab not found
 */
router.put('/:cabId', async (req, res) => {
  try {
    const { cabId } = req.params;
    const data = updateCabSchema.parse(req.body);
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (data.licensePlate) {
      updates.push(`license_plate = $${paramCount++}`);
      values.push(data.licensePlate);
    }
    if (data.driverName) {
      updates.push(`driver_name = $${paramCount++}`);
      values.push(data.driverName);
    }
    if (data.driverPhone) {
      updates.push(`driver_phone = $${paramCount++}`);
      values.push(data.driverPhone);
    }
    if (data.maxPassengers !== undefined) {
      updates.push(`max_passengers = $${paramCount++}`);
      values.push(data.maxPassengers);
    }
    if (data.maxLuggageCapacity !== undefined) {
      updates.push(`max_luggage_capacity = $${paramCount++}`);
      values.push(data.maxLuggageCapacity);
    }
    if (data.currentLat !== undefined) {
      updates.push(`current_lat = $${paramCount++}`);
      values.push(data.currentLat);
    }
    if (data.currentLng !== undefined) {
      updates.push(`current_lng = $${paramCount++}`);
      values.push(data.currentLng);
    }
    if (data.isAvailable !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(data.isAvailable);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    values.push(cabId);
    const result = await pool.query(
      `UPDATE cabs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cab not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
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
 * /api/cabs/{cabId}:
 *   delete:
 *     summary: Delete cab
 *     tags: [Cabs]
 *     parameters:
 *       - in: path
 *         name: cabId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cab deleted successfully
 *       404:
 *         description: Cab not found
 */
router.delete('/:cabId', async (req, res) => {
  try {
    const { cabId } = req.params;
    
    const result = await pool.query(
      'DELETE FROM cabs WHERE id = $1 RETURNING id',
      [cabId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cab not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Cab deleted successfully'
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
 * /api/cabs/{cabId}/location:
 *   put:
 *     summary: Update cab location
 *     tags: [Cabs]
 *     parameters:
 *       - in: path
 *         name: cabId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated successfully
 */
router.put('/:cabId/location', async (req, res) => {
  try {
    const { cabId } = req.params;
    const { latitude, longitude } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    const result = await pool.query(
      'UPDATE cabs SET current_lat = $1, current_lng = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [latitude, longitude, cabId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cab not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
