declare module "swagger-jsdoc" {
  interface SwaggerOptions {
    definition: { [key: string]: unknown }
    apis: string[]
  }

  function swaggerJsdoc(options: SwaggerOptions): unknown

  export = swaggerJsdoc
}
