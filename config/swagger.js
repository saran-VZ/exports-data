const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Export Service API",
      version: "1.0.0",
      description: "API documentation for Export Job System",
    },
    servers: [
      {
        url: "http://localhost:5000",
      },
    ],

    components: {
      schemas: {

        CreateExportRequest: {
          type: "object",
          required: ["user_name", "email", "collections"],
          properties: {
            user_name: {
              type: "string",
              example: "Saran"
            },
            email: {
              type: "string",
              example: "saran@email.com"
            },
            collections: {
              type: "array",
              items: {
                type: "string"
              },
              example: ["data"]
            },
            filters: {
              type: "object",
              example: {
                Model_Name: "EWM-H5-DIN60L"
              }
            },
            fileFormat: {
              type: "string",
              example: "xlsx"
            }
          }
        },

        ViewExportResponse: {
                type: "object",
                properties:{
                  success:{
                    type: "boolean",
                    example: true
                  },
                  exportId:{
                    type: "string",
                    example: "687891234"
                  },
                  status:{
                    type: "string",
                    enum: ["queued","processing","completed","failed","expired"],
                    example: "completed"},
                  progress:{
                    type: "integer",
                    description: "Percentage completion of export" ,
                    example: 100 },
                  started_at:{
                    type: "string",
                    format: "date-time",
                    example: "2024-08-01T12:00:00Z" },
                  scheduled_for:{
                    type: "string",
                    format: "date-time",
                    nullable: true,
                    example: null }
                  }
             }

      }
    }
  },

  apis: [], 
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;