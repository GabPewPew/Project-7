import { createRouteHandler } from "uploadthing/server";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    uploadthingId: process.env.UPLOADTHING_APP_ID,
    uploadthingSecret: process.env.UPLOADTHING_TOKEN,
    isDev: process.env.NODE_ENV === "development"
  }
});