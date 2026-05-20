/**
 * Compresses an image (base64 string or File object) to ensure it fits within Firestore's 1MB limit.
 * @param input The original base64 image string or File object.
 * @param maxWidth Maximum width for the compressed image.
 * @param quality JPEG quality (0 to 1).
 * @returns A promise that resolves to the compressed base64 string.
 */
export async function compressImage(input: string | File, maxWidth = 1200, quality = 0.6): Promise<string> {
  let base64: string;
  
  if (input instanceof File) {
    base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  } else {
    base64 = input;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Fill white background (for transparent PNGs converted to JPEG)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with specified quality
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };

    img.onerror = (err) => {
      reject(err);
    };
  });
}

/**
 * Checks the approximate size of a base64 string in bytes.
 */
export function getBase64Size(base64: string): number {
  const stringLength = base64.length - (base64.indexOf(',') + 1);
  const sizeInBytes = (stringLength * 3) / 4;
  return sizeInBytes;
}

export const createMaskFromVertices = async (
  imageBase64: string,
  signageVertices: { x: number; y: number }[] | null,
  storefrontVertices: { x: number; y: number }[] | null
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Failed to get 2d context"));

      // Complete Fill Black (Background mask area)
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Storefront (White area to modify)
      if (storefrontVertices) {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(storefrontVertices[0].x * canvas.width, storefrontVertices[0].y * canvas.height);
        ctx.lineTo(storefrontVertices[1].x * canvas.width, storefrontVertices[1].y * canvas.height);
        ctx.lineTo(storefrontVertices[2].x * canvas.width, storefrontVertices[2].y * canvas.height);
        ctx.lineTo(storefrontVertices[3].x * canvas.width, storefrontVertices[3].y * canvas.height);
        ctx.closePath();
        ctx.fill();
      }

      // Signage (White area to modify)
      if (signageVertices) {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(signageVertices[0].x * canvas.width, signageVertices[0].y * canvas.height);
        ctx.lineTo(signageVertices[1].x * canvas.width, signageVertices[1].y * canvas.height);
        ctx.lineTo(signageVertices[2].x * canvas.width, signageVertices[2].y * canvas.height);
        ctx.lineTo(signageVertices[3].x * canvas.width, signageVertices[3].y * canvas.height);
        ctx.closePath();
        ctx.fill();
      }

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = imageBase64;
  });
};
