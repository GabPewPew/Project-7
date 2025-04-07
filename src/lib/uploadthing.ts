import { generateComponents } from "@uploadthing/react";

export const { UploadButton, UploadDropzone, Uploader } = generateComponents({
  url: "https://uploadthing.com",
  apiKey: import.meta.env.VITE_UPLOADTHING_TOKEN
});