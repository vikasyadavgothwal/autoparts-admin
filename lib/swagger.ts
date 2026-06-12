import swaggerJsdoc from "swagger-jsdoc"

export const getSwaggerSpec = () => {
  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Auto Parts Pro API",
        version: "1.0.0",
      },
    },
    apis: ["./app/api/**/*.ts", "./actions/**/*.ts", "./types/**/*.ts"],
  }

  return swaggerJsdoc(options)
}

export const buildSwaggerUiHtml = (specUrl: string) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Auto Parts Pro API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
      }

      #swagger-ui {
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '${specUrl}',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.presets.standalone],
        });
      };
    </script>
  </body>
</html>
`
