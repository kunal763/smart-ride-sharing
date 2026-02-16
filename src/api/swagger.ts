import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Airport Ride Pooling API',
      version: '1.0.0',
      description: 'Smart ride pooling system for airport transportation',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    tags: [
      {
        name: 'Rides',
        description: 'Ride management endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Cabs',
        description: 'Cab management endpoints'
      }
    ]
  },
  apis: ['./src/api/routes.ts', './src/api/userRoutes.ts', './src/api/cabRoutes.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
