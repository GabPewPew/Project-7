import { createUploadthing, type FileRouter } from "uploadthing/server";
import { validateFileType, validateFileSize } from "../../lib/uploadHandler";
 
const f = createUploadthing();

// Simple auth until we implement real auth
const auth = () => ({ id: "user" });
 
export const ourFileRouter = {
  mediaPost: f({
    pdf: { maxFileSize: "50MB", maxFileCount: 3 },
    audio: { maxFileSize: "50MB", maxFileCount: 3 },
    video: { maxFileSize: "50MB", maxFileCount: 3 },
    text: { maxFileSize: "50MB", maxFileCount: 3 }
  })
    .middleware(async ({ files, req }) => {
      const user = auth();
      if (!user) throw new Error("Unauthorized");

      // Validate all files
      files.forEach(file => {
        if (!validateFileType(file)) {
          throw new Error(`Invalid file type: ${file.name}`);
        }
        if (!validateFileSize(file)) {
          throw new Error(`File too large: ${file.name}`);
        }
      });

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.url);
      
      return {
        uploadedBy: metadata.userId,
        url: file.url,
        name: file.name,
        size: file.size,
        key: file.key,
        type: file.type
      };
    })
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;