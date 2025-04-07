import { createUploadthing, type FileRouter } from "uploadthing/client";
 
const f = createUploadthing();
 
const auth = () => ({ id: "user" }); // Replace with actual auth
 
// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  mediaUploader: f({
    pdf: { maxFileSize: "100MB" },
    audio: { maxFileSize: "100MB" },
    video: { maxFileSize: "100MB" },
    text: { maxFileSize: "100MB" }
  })
    .middleware(async () => {
      const user = auth();
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.url);
      
      return { uploadedBy: metadata.userId, url: file.url };
    })
} satisfies FileRouter;
 
export type OurFileRouter = typeof ourFileRouter;