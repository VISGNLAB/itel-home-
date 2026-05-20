import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Location } from "../App";
import { ITEL_HOME_STANDARDS, BRAND_LOGO_GUIDELINE, MATERIAL_LIBRARY } from "../constants/standards";
import { ITEL_HOME_LOGOS } from "../constants/logos";
import { STORE_STRATEGIES } from "../constants/storeStrategies";

function getApiKey(): string | undefined {
  // 1. Try to get from window.process.env (dynamic runtime injected by platform)
  try {
    const dynamicKey = (window as any).process?.env?.API_KEY;
    if (dynamicKey && dynamicKey !== "undefined" && dynamicKey !== "" && dynamicKey !== "null") return dynamicKey.trim();
  } catch (e) {}

  // 2. Try to get from window.serverApiKey (fetched from server-side env)
  try {
    const serverKey = (window as any).serverApiKey;
    if (serverKey && serverKey !== "undefined" && serverKey !== "" && serverKey !== "null") return serverKey.trim();
  } catch (e) {}

  // 3. Try to get from process.env (Vite's build-time or shimmed)
  try {
    const envKey = (typeof process !== 'undefined') ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : undefined;
    if (envKey && envKey !== "undefined" && envKey !== "" && envKey !== "null") return envKey.trim();
  } catch (e) {}

  return undefined;
}

function getAI() {
  const apiKey = getApiKey();
  
  // Create a shim for the newer SDK structure
  return {
    models: {
      generateContent: async (args: any) => {
        // Preference 1: Use server-side proxy (Most robust)
        try {
          const res = await fetch('/api/proxy-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
          });
          
          const contentType = res.headers.get('content-type');
          if (!res.ok) {
            let errorMessage = 'Server proxy failed';
            if (contentType && contentType.includes('application/json')) {
              try {
                const errData = await res.json();
                // Improved extraction for nested error objects
                const rawError = errData.error || errData;
                errorMessage = typeof rawError === 'string' 
                  ? rawError 
                  : (rawError.message || rawError.error || JSON.stringify(rawError));
              } catch (e) {
                console.error('Failed to parse error JSON', e);
              }
            } else {
              errorMessage = await res.text() || res.statusText;
            }
            throw new Error(errorMessage);
          }
          
          if (contentType && contentType.includes('application/json')) {
            return await res.json();
          } else {
            console.warn('Expected JSON response but got:', contentType);
            const text = await res.text();
            try {
              return JSON.parse(text);
            } catch (e) {
              throw new Error('Received malformed JSON from server');
            }
          }
        } catch (proxyError: any) {
          console.warn('Gemini Proxy failed, attempting client-side fallback:', proxyError);
          
          // Preference 2: Fallback to client-side if proxy fails and we have a key
          if (!apiKey || apiKey === "undefined" || apiKey === "") {
            throw new Error(proxyError.message || "API_KEY_MISSING");
          }
          
          const clientAI = new GoogleGenAI({ apiKey });
          return await clientAI.models.generateContent(args);
        }
      }
    }
  };
}

/**
 * Ensures an image is in base64 format and NOT an SVG (converts to JPEG).
 * If it's a URL, it fetches it via the server proxy.
 */
async function ensureBase64(imageInput: string | undefined): Promise<string | undefined> {
  if (!imageInput) return undefined;
  
  let base64 = imageInput;
  if (!imageInput.startsWith('data:')) {
    let success = false;
    
    // Tier 1: Try client-side direct fetch with CORS (uses client DNS and residential IP, highly robust against cloud range blockings)
    try {
      const directRes = await fetch(imageInput, { mode: 'cors' });
      if (directRes.ok) {
        const blob = await directRes.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        success = true;
        console.log('[ensureBase64] Fetched image successfully via direct client-side CORS');
      }
    } catch (directError) {
      console.warn('[ensureBase64] Direct CORS fetch failed, trying proxy:', directError);
    }
    
    // Tier 2: Try server-side proxy
    if (!success) {
      try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageInput)}`);
        if (res.ok) {
          const data = await res.json();
          base64 = data.data;
          success = true;
          console.log('[ensureBase64] Fetched image successfully via server proxy');
        } else {
          throw new Error(`Proxy status: ${res.status}`);
        }
      } catch (proxyError) {
        console.error('[ensureBase64] Proxy fetch failed:', proxyError);
      }
    }

    // Tier 3: Try canvas pixel copy using Image element + crossOrigin (works if CORS is configured on the host)
    if (!success) {
      try {
        base64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.9));
            } else {
              reject(new Error("No 2D context"));
            }
          };
          img.onerror = () => reject(new Error("Failed to load via HTMLImageElement"));
          img.src = imageInput;
        });
        success = true;
        console.log('[ensureBase64] Fetched image successfully via canvas extraction');
      } catch (canvasError) {
        console.error('[ensureBase64] Canvas fallback failed:', canvasError);
      }
    }
  }

  // Final Safety Check: AI models don't support image/svg+xml
  if (base64.startsWith('data:image/svg+xml')) {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 800; // Use default if zero
          canvas.height = img.height || 400;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(base64); // Fallback to original if canvas fails
          ctx.fillStyle = '#FFFFFF'; // White background
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
      });
    } catch (e) {
      console.error('SVG conversion failed in geminiService:', e);
      return base64;
    }
  }
  
  return base64;
}

export interface VerifiedExample {
  imageUrl: string;
  label?: string;
  renderAngle?: string;
  sampleType?: 'render' | 'photo';
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, delay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Extract error details from various possible structures
      const errorObj = error?.error || error;
      const status = errorObj?.status || error?.status;
      const code = errorObj?.code || error?.code;
      const message = (errorObj?.message || error?.message || "").toLowerCase();
      
      const isUnavailable = status === 'UNAVAILABLE' || code === 503;
      const isRateLimited = status === 'RESOURCE_EXHAUSTED' || code === 429;
      const isInternalError = status === 'INTERNAL' || code === 500;
      const isHighDemand = message.includes("high demand") || 
                           message.includes("experiencing high demand") ||
                           message.includes("spikes in demand");
      
      if (isUnavailable || isRateLimited || isHighDemand || isInternalError) {
        console.warn(`Retry attempt ${i + 1}/${maxRetries} due to ${status || code || 'High Demand'}. Detail: ${message}`);
        // Exponential backoff with some jitter
        const backoff = delay * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function analyzeStructure(imageBase64: string): Promise<{ 
  signageVertices: { x: number, y: number }[], 
  storefrontVertices: { x: number, y: number }[], 
  tiltAngle: string, 
  analysis: string,
  detectedStructure: string,
  vanishingPoints: string,
  lightSource: string
}> {
  return withRetry(async () => {
    const ai = getAI();
    const prompt = `
      ### SPATIAL ANCHOR AUDIT (CRITICAL)
      You are a Computer Vision engine for architectural renovation.
      Analyze the uploaded store environment photo and extract the precise 3D structural boundaries for the SIGNAGE/FASCIA area.

      TASKS:
      1. Identify the 4 vertices (Top-Left, Top-Right, Bottom-Right, Bottom-Left) of the SIGNAGE/FASCIA area (where the brand logo will be installed). Return as 'signageVertices'.
      2. Identify the 4 vertices (Top-Left, Top-Right, Bottom-Right, Bottom-Left) of the ENTIRE STOREFRONT/ENTRANCE area (the physical building below the sign). Return as 'storefrontVertices'.
      3. Coordinates must return values relative to the image size (0.00 to 1.00). Wait, if you output > 1.0, it will be considered invalid. Examples: 0.15, 0.85.
      4. Determine the horizontal tilt/skew angle (e.g., "5° Slanted Right").
      5. Describe the physical mounting surface (e.g., "Concrete Lintel").
      6. Identify 3D Vanishing Points (e.g., "Converging to right side of frame").
      7. Identify Main Light Source (Sun) direction (e.g., "Top-Right 45°").

      Return ONLY JSON:
      {
        "signageVertices": [{"x": number, "y": number}, {"x": number, "y": number}, {"x": number, "y": number}, {"x": number, "y": number}],
        "storefrontVertices": [{"x": number, "y": number}, {"x": number, "y": number}, {"x": number, "y": number}, {"x": number, "y": number}],
        "tiltAngle": "string",
        "detectedStructure": "string",
        "vanishingPoints": "string",
        "lightSource": "string",
        "analysis": "Briefly describe the perspective and depth of the store front in 15 words."
      }
    `;

    const matches = imageBase64.match(/^data:(.+);base64,(.*)$/);
    if (!matches || matches.length !== 3) throw new Error("Invalid image format for analysis");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: matches[1],
                data: matches[2],
              },
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("AI failed to analyze structure");
    let parsed = JSON.parse(content);
    
    // Provide fallbacks if missing
    if (!parsed.signageVertices) {
      if (parsed.vertices) parsed.signageVertices = parsed.vertices;
      else if (parsed.signageVertices) {} // Keep if existing
      else parsed.signageVertices = [{x:0.1, y:0.1}, {x:0.9, y:0.1}, {x:0.9, y:0.3}, {x:0.1, y:0.3}];
    }
    if (!parsed.storefrontVertices) {
      if (parsed.vertices) parsed.storefrontVertices = parsed.vertices;
      else if (parsed.storefrontVertices) {} // Keep if existing
      else parsed.storefrontVertices = [{x:0.1, y:0.3}, {x:0.9, y:0.3}, {x:0.9, y:0.8}, {x:0.1, y:0.8}];
    }

    const normalizeVertices = (vertices: any[]) => vertices.map((v: any) => ({
      x: typeof v.x === 'number' && !isNaN(v.x) ? (v.x > 1 ? v.x / 1000 : Math.max(0, Math.min(1, v.x))) : 0.5,
      y: typeof v.y === 'number' && !isNaN(v.y) ? (v.y > 1 ? v.y / 1000 : Math.max(0, Math.min(1, v.y))) : 0.5
    }));

    if (Array.isArray(parsed.signageVertices) && parsed.signageVertices.length >= 4) {
      parsed.signageVertices = normalizeVertices(parsed.signageVertices);
    }
    if (Array.isArray(parsed.storefrontVertices) && parsed.storefrontVertices.length >= 4) {
      parsed.storefrontVertices = normalizeVertices(parsed.storefrontVertices);
    }

    return parsed;
  });
}

export async function generateEnvironmentDescription(
  city: string,
  country: string,
  tier: string,
  imageBase64?: string
): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    let prompt = `Generate a brief (20-30 words) environment description for an "itel Home" store in ${city}, ${country}. 
    The store is a ${tier} level store.
    
    Rules:
    - For L1: Describe a modern urban commercial district, clean paved roads, high-end buildings, and modern vehicles.
    - For L3/L4: Describe a busy urban shopping street or modern mall zone, standard paved roads/floors, and active customer traffic.
    - For L5: Describe a vibrant local street scene in a village or community market, with unpaved roads and simple utility infrastructures.
    - Focus on the street context, architecture, and typical local elements.
    - Output ONLY the description text, no labels or extra words.`;

    const parts: any[] = [{ text: prompt }];

    if (imageBase64) {
      const matches = imageBase64.match(/^data:(.+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        parts.push({ text: "\n\n### PHOTO REFERENCE: This is an actual photo of the site. Analyze its specific architecture, road quality, and neighboring elements to ensure the description is highly accurate to this location." });
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }]
      });

      return response.text.trim();
    } catch (error) {
      console.warn("[Gemini] Description generation failed, using fallback:", error);
      // Fallback descriptions based on tier
      const fallbacks: Record<string, string> = {
        'L1': 'A premium flagship itel Home store located in a prestigious metropolitan business district, featuring wide glass frontage and modern urban surroundings.',
        'L3': 'A standard itel Home retail outlet in a busy commercial street with active pedestrian traffic and a modern shop facade.',
        'L4': 'A compact itel Home experience zone integrated into a vibrant shopping area with organized displays.',
        'L5': 'A localized itel Home community store serving a vibrant local market with functional and welcoming branding.'
      };
      return fallbacks[tier] || fallbacks['L3'];
    }
  });
}

export async function generateInpainting(
  baseImageBase64: string,
  maskImageBase64: string,
  prompt: string,
  config: {
    aspectRatio: string;
    imageSize: string;
    model?: string;
    tier?: string;
    weathering?: number;
    logoStyle?: 'white-bg' | 'red-bg' | 'none';
    verifiedExamples?: VerifiedExample[];
    customStandards?: {
      itel_home_standards: any;
      brand_logo_guideline: any;
      material_library: any;
    };
  }
): Promise<{ imageUrl: string; prompt: string }> {
  const finalBase = await ensureBase64(baseImageBase64);
  const finalMask = await ensureBase64(maskImageBase64);
  
  if (!finalBase || !finalMask) throw new Error("Missing image inputs for inpainting");

  const dynamicStandards = config.customStandards || {
    itel_home_standards: ITEL_HOME_STANDARDS,
    brand_logo_guideline: BRAND_LOGO_GUIDELINE,
    material_library: MATERIAL_LIBRARY
  };

  const tier = config.tier || 'L3';
  const logoStyle = config.logoStyle || 'red-bg';
  const weathering = config.weathering || 0;
  const verifiedExamples = config.verifiedExamples || [];
  const strategy = STORE_STRATEGIES[tier] || STORE_STRATEGIES['L3'];
  const tierStandard = dynamicStandards.itel_home_standards[tier] || ITEL_HOME_STANDARDS['L3'];

  // Helper to format dynamic props from library
  const formatLibrarySection = (section: any) => {
    return Object.entries(section)
      .filter(([key]) => key !== 'audit')
      .map(([key, val]) => `- ${key.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${val}`)
      .join('\n        ');
  };

  const propsList = formatLibrarySection(dynamicStandards.material_library.props);
  const lightingList = formatLibrarySection(dynamicStandards.material_library.lighting);
  const flooringList = formatLibrarySection(dynamicStandards.material_library.flooring);
  const ceilingList = dynamicStandards.material_library.ceiling ? formatLibrarySection(dynamicStandards.material_library.ceiling) : "- STANDARD: Flat white gypsum.";

  return withRetry(async () => {
    const ai = getAI();
    const model = config.model || "gemini-2.5-flash-image";

    const signageInstruction = logoStyle === 'none' 
      ? `### BRANDING RULE: NO LOGO. Do NOT render any itel Home logo or signage.`
      : `
      ### BRAND IDENTITY: itel Home (STRICT REPRODUCTION REQUIRED)
      - STOREFRONT (EXTERIOR): Must use RED "itel" characters inside a WHITE GLOWING speech bubble. The "Home" text should be WHITE.
      - BRAND WALL (INTERIOR BACKGROUND WALL): The backdrop wall itself MUST be PURE WHITE (and not red). On the white background, the itel logo is a RED speech bubble containing WHITE "itel" characters inside. The "Home" text is completely ABSENT on the interior brand wall.
      - LOGO STRUCTURE: A SPEECH BUBBLE (oval with a sharp tail pointing bottom-left) followed by the text "Home".
      - BUBBLE CONTENT: The word "itel" must be INSIDE the oval bubble.
      - OUTSIDE CONTENT: The word "Home" must be immediately to the right of the bubble.
      - COLORS: Vibrant Red (#FF0000) and Pure White.
      - LOGO STYLE: ${logoStyle === 'red-bg' ? 'Red "itel" text in glowing white bubble on Red Signage' : 'Red "itel" text in glowing white bubble on White background'}.
      `;

    const parts: any[] = [
      {
        text: `### COMMAND: LOCAL RE-RENDERING (INPAINTING)
        ### TASK: Modify the original image ONLY in the areas specified by the provided mask.
        ### USER PROMPT TO EXECUTE IN MASKED AREA: "${prompt}"
        
        ### itel Home GLOBAL STANDARDS (MANDATORY):
        - EXTERIOR vs INTERIOR LOGO VI: 
          Exterior Signage: Must have RED "itel" text inside a WHITE GLOWING speech bubble.
          Interior Brand Wall: Must have WHITE "itel" text inside a RED speech bubble.
        - EXTERIOR vs INTERIOR BRANDING: 
          Exterior Signage: Red background.
          Interior Brand Wall: MUST be PURE WHITE. The word "Home" is FORBIDDEN on the interior wall.
        - LIGHTING: 
        ${lightingList}
        - FINISHES: ${dynamicStandards.material_library.finishes.metal}, ${dynamicStandards.material_library.finishes.wood}, ${dynamicStandards.material_library.finishes.glass}.
        - FLOORING: 
        ${flooringList}
        - CEILING: 
        ${ceilingList}
        - PROPS & FURNITURE:
        ${propsList}
        - PRODUCT BOXES: Shelves must be filled with many vibrant red itel Home product boxes (packaging).
        
        ${signageInstruction}
        
        ### EXECUTION INSTRUCTIONS:
        1. Analyze "Original Image".
        2. Analyze "Mask Image": 
           - WHITE pixels = Target area for modification.
           - BLACK pixels = Guarded area. ABSOLUTELY DO NOT MODIFY.
3. Re-render the WHITE area based on the User Prompt and itel Home Global Standards.
        4. If the prompt mentions "Interior", ensure experience tables, cabinets, and brand walls match the verified samples.
        5. PERSPECTIVE: Maintain the exact 3D perspective of the original photo.
        6. BLENDING: Seamlessly blend the new content with the preserved background.
        
        ### VERIFIED STANDARD EXAMPLES (LEARN MATERIAL & FURNITURE STYLES FROM THESE):
        Analyze these images for official itel Home furniture (Experience Tables, Accessories Cabinets), Materials, and Lighting. Replicate this exact visual quality in the masked area.`,
      }
    ];

  // Add verified examples if available
  if (verifiedExamples.length > 0) {
    const processedExamples = await Promise.all(
      verifiedExamples.slice(0, 3).map(async (ex) => ({
        ...ex,
        imageUrl: await ensureBase64(ex.imageUrl)
      }))
    );

    processedExamples.forEach((example) => {
      const imgData = example.imageUrl;
      if (!imgData) return;
      const matches = imgData.match(/^data:(.+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
      }
    });
  }

    // Add the base image and mask
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: finalBase.split(',')[1] || finalBase,
      },
    });
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: finalMask.split(',')[1] || finalMask,
      },
    });

    const generateConfig: any = {
      imageConfig: {
        aspectRatio: config.aspectRatio.includes(':') ? config.aspectRatio : '1:1',
        imageSize: config.imageSize as any
      }
    };

    const response = await ai.models.generateContent({
      model: model as any,
      contents: [{ parts }],
      config: generateConfig
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          imageUrl: `data:image/png;base64,${part.inlineData.data}`,
          prompt: prompt
        };
      }
    }
    throw new Error("Failed to generate inpainting result");
  });
}

/**
 * Uses AI to evolve the brand standards based on natural language instructions.
 */
export async function evolveBrandStandards(
  instruction: string,
  currentStandards: {
    itel_home_standards: any;
    brand_logo_guideline: any;
    material_library: any;
  }
): Promise<any> {
  const ai = getAI();
  
  const prompt = `
    ### TASK: EVOLVE BRAND STANDARDS (itel Home)
    You are a Senior SI Architect for itel Home. You need to update the brand's machine-readable standards based on a user's instruction.
    
    ### CURRENT STANDARDS (JSON):
    ${JSON.stringify(currentStandards, null, 2)}
    
    ### USER INSTRUCTION:
    "${instruction}"
    
    ### RULES:
    1. Identify which parts of the standards need to change (itel_home_standards, brand_logo_guideline, or material_library).
    2. Maintain the exact same JSON structure.
    3. Be precise with wording. If the user mentions a specific material or color, reflect it accurately in all relevant sections.
    4. If the user asks for a change that contradicts current standards, follow the NEW instruction (the user is the boss).
    5. Return ONLY the updated JSON object containing all three main keys.
    6. Ensure the response is a valid JSON.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Use a fast, capable model for JSON manipulation
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json"
    }
  });

  const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("AI failed to evolve standards");
  
  try {
    return JSON.parse(content);
  } catch (e) {
    // If it's wrapped in markdown code blocks, try to extract
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw e;
  }
}

export async function analyzeMaterialReference(base64Image: string): Promise<string> {
  return withRetry(async () => {
    const ai = getAI();
    const model = "gemini-3-flash-preview";

    const prompt = `
      Analyze the uploaded reference image for architectural/interior materials and stylistic elements.
      Your task is to extract a highly descriptive summary of the:
      1. Primary materials (e.g., rusted steel, smooth concrete, distressed wood, acoustic panels, polished tile)
      2. Textures and finishes (e.g., matte, glossy, worn, pristine)
      3. Colors, tones, and lighting characteristics
      4. General vibe, layout style, and design motifs
      
      This description will be used as a style guide to render a new retail space (this could be used for either the exterior storefront facade or the interior shop fittings, so capture traits that apply to both).
      
      Return a concise, bulleted paragraph summarizing these material and stylistic characteristics. Ensure to focus heavily on the physical textures, colors, and structural materials.
    `;

    const requestImage = {
      inlineData: {
        data: base64Image.split(",")[1],
        mimeType: base64Image.split(";")[0].split(":")[1],
      },
    };

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }, requestImage] }],
      });

      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("AI failed to analyze material reference");
      
      return content.trim();
    } catch (error) {
      console.warn("[Gemini] Material analysis failed, using generic fallback:", error);
      return "itel Home standard material reference: Premium matte white finishes, brushed aluminum accents, and light oak wood textures. The style is minimalist and modern with organized retail displays and high-quality architectural lighting.";
    }
  });
}

export async function generateStoreRendering(
  tier: string,
  renderAngle: string,
  aspectRatio: string,
  imageSize: string,
  environmentDetails: string,
  environmentalContext?: string,
  referenceImageBase64?: string,
  environmentImageBase64?: string,
  logoImageBase64?: string,
  location?: Location,
  selectedCity?: string,
  storeArea: number = 10,
  verifiedExamples: VerifiedExample[] = [],
  internalSignageImageBase64?: string,
  interiorMaterialsImageBase64?: string,
  logoStyle: 'white-bg' | 'red-bg' | 'none' = 'red-bg',
  model: string = "gemini-2.5-flash-image",
  weather: string = 'sunny',
  timeOfDay: string = 'day',
  weathering: number = 0,
  environmentMaskBase64?: string,
  renderMode: 'full' | 'signage' = 'full',
  structuralAnalysis?: {
    signageVertices: { x: number, y: number }[],
    storefrontVertices: { x: number, y: number }[],
    tiltAngle: string,
    vanishingPoints: string,
    lightSource: string,
    analysis: string,
    detectedStructure: string
  } | null,
  customStandards?: {
    itel_home_standards: any;
    brand_logo_guideline: any;
    material_library: any;
  },
  isDemoMode: boolean = false,
  outpaintSide: 'center' | 'left' | 'right' = 'center',
  materialAnalysis?: string
): Promise<{ imageUrl: string; prompt: string }> {
  // Ensure all image inputs are base64 (fetch via proxy if they are URLs)
  const [
    finalRef,
    finalEnv,
    finalLogo,
    finalSignage,
    finalMaterials,
    finalEnvMask
  ] = await Promise.all([
    ensureBase64(referenceImageBase64),
    ensureBase64(environmentImageBase64),
    ensureBase64(logoImageBase64),
    ensureBase64(internalSignageImageBase64),
    ensureBase64(interiorMaterialsImageBase64),
    ensureBase64(environmentMaskBase64)
  ]);

  const ai = getAI();

  const dynamicStandards = customStandards || {
    itel_home_standards: ITEL_HOME_STANDARDS,
    brand_logo_guideline: BRAND_LOGO_GUIDELINE,
    material_library: MATERIAL_LIBRARY
  };
  
  const strategy = STORE_STRATEGIES[tier] || STORE_STRATEGIES['L3'];
  const tierStandard = dynamicStandards.itel_home_standards[tier] || ITEL_HOME_STANDARDS['L3'];
  const country = location?.country || "Nigeria";
  const city = selectedCity || "Lagos";

  // Helper to format dynamic props from library
  const formatLib = (section: any) => {
    return Object.entries(section)
      .filter(([key]) => key !== 'audit')
      .map(([key, val]) => `${key.replace(/([A-Z])/g, ' $1').toUpperCase()}: ${val}`)
      .join(' | ');
  };

  const propsLib = formatLib(dynamicStandards.material_library.props);
  const lightingLib = formatLib(dynamicStandards.material_library.lighting);
  const flooringLib = formatLib(dynamicStandards.material_library.flooring);
  const wallLib = formatLib(dynamicStandards.material_library.walls);
  const ceilingLib = dynamicStandards.material_library.ceiling ? formatLib(dynamicStandards.material_library.ceiling) : "Flat white gypsum";
  const finishLib = formatLib(dynamicStandards.material_library.finishes);

  const weatheringPrompt = weathering > 0 
    ? `### WEATHERING EFFECT (Intensity: ${weathering}%): Inject realistic atmospheric dust, red soil build-up on plinths, and subtle UV-fading/rain streaks on external surfaces to achieve localized authenticity.`
    : '';

  // Dynamic Spatial Depth / Vision Range prompts
  const spatialDepthPrompt = storeArea >= 60 
    ? "### COMPOSITION STYLE: Cinematic wide shot showing surrounding street context, neighboring buildings, and urban life. High field of view."
    : "### COMPOSITION STYLE: Close-up facade shot focusing on material textures, signage details, lighting fixtures, and the immediate storefront entrance.";

  const demoInstruction = isDemoMode 
    ? `
    ### 1. FACADE PROTOCOL (L3 STANDARD):
    - RED ACP BAND: Generate a horizontal RED Aluminum Composite Panel (Red ACP) decorative fascia across the top of the storefront only. 
    - COLOR CONTRAST: EXCEPT for the red signage band, ALL OTHER exterior wall surfaces (columns, side walls) MUST be painted PURE WHITE. This is a mandatory brand requirement to keep the facade bright and modern.
    - GLASS FRONTAGE: Use massive, seamless floor-to-ceiling transparent glass. Minimize vertical pillars to maximize "Interconnectedness" and visibility into the showroom.

    ### 2. LOGO EXECUTION:
    - 3D ACRYLIC: The "itel Home" logo must be rendered as a high-quality 3D Acrylic front-lit sign. It should have visible depth and a professional glow.
    - CENTERING: Logo must be precisely centered within the red band.

    ### 3. INTERIOR FIXTURES (STRICT OAK STANDARD):
    - OAK TEXTURE CABINETS & TABLES: All wall-mounted display units and central island tables MUST HAVE A MATTE LIGHT OAK WOOD-GRAIN TEXTURE (哑光浅色橡木纹理) with a non-reflective, matte finish. 
    - NO OTHER COLORS OR GLOSSES: Strictly NO red or white painted lacquer main bodies or glossy highlights for the cabinets and experience tables. This matte wood texture is non-negotiable for the warm "Home" atmosphere.
    - TOP LIGHTBOX: The very top of each oak cabinet must have an integrated, glowing category graphic/lightbox.
    - MERCHANDISE: Neat arrangement of "Physical Samples + Organized Packaging".

    ### 4. CENTRAL ISLAND:
    - MATTE OAK WOOD GRAIN EXPERIENCE DESKS: The center island tables and display pedestals must use MATTE LIGHT OAK WOOD GRAIN TEXTURE, with a completely matte look. No reflection or high gloss.
    - ECOSYSTEM COMBO: Showcase a smart logic combination: Smartphone + TWS Earbuds + Smartwatch on the same display area.

    ### AI DEMO MODE (SKIP ANCHOR) - PRIORITY DIRECTIVE:
    - You are in PRE-SET STANDARD MODE. You MUST prioritize the design elements from the VERIFIED LEARNING SAMPLES over the messy reality of the "Environment Image".
    - Replace the existing building facade fully with the official "itel Home" architecture: Red Top Band + White Walls + Glass Windows. 
    ` : '';

  const fixturePriorityDirectives = `
    ### PRIORITY DIRECTIVES (FIXTURES & DISPLAY):
    - INTERIOR SHELVING AND EXPERIENCE TABLES (体验墙柜及展台): Match the provided standard samples. Use STRICTLY "Matte Light Oak Wood Grain Texture" (哑光浅色橡木纹理) for all cabinets, display stands, and tables. NO other colors (such as grey, glossy red, or high-gloss white painted lacquer for the casework/bodies) are permitted. All finishes must be matte and non-reflective.
    - CABINET TOP: Must integrate a "Category Illuminated Lightbox" (品类发光灯箱画面) displaying brand graphics at the very top.
    - SHELF CONTENT: Achieve a "Physical Sample + Tidy Packaging" display (实物样机+整洁包装). Everything must look organized and modular.
    - CENTRAL ISLAND (中岛/体验桌): Must be crafted from MATTE LIGHT OAK WOOD-GRAIN TEXTURE (哑光浅色橡木质感) to align perfectly with standard sample specifications. No glossy surfaces.
    - ECOSYSTEM DISPLAY: The island must showcase a "Smart Ecosystem Combo" (手机、耳机、手表的智能生态组合陈列) to reinforce the "Home" brand concept.
  `;

  console.log(`[Rendering Engine] Initiating render: Tier=${tier}, Angle=${renderAngle}, LogoStyle=${logoStyle}, City=${city}`);
  if (logoImageBase64) console.log(`[Rendering Engine] Custom Logo detected (Size: ${Math.round(logoImageBase64.length / 1024)}KB)`);
  if (environmentImageBase64) console.log(`[Rendering Engine] Environment Image detected`);

  const logoInstruction = logoStyle === 'none' 
    ? `### BRANDING RULE: NO LOGO. Do NOT render any itel Home logo or signage.`
    : `
    ### SPATIAL & PERSPECTIVE AXIOMS (CRITICAL):
    ${renderMode === 'signage' 
      ? `- MODE: STICKER/INSET (仅招架). You MUST ONLY change pixels inside the MASK AREA. DO NOT touch the upper building walls, text, sky, or side columns. The original "BIG CHOICE COMMUNICATION" text above MUST remain visible and untouched.` 
      : `- MODE: TOTAL FACADE (全门店). Fully integrate the new itel Home storefront while preserving the main building's structural bones.`}
    - PERSPECTIVE: The new signage MUST be rendered as a FLAT, FRONTAL, architectural ELEVATION (正视图). Ignore the slanted side-perspective of the building in the photo; the new module must look like a perfectly rectangular panel facing the camera.
    - ALIGNMENT: Horizontal lines of the signage MUST be perfectly level (0 degrees rotation).
    
    ### BRAND IDENTITY: itel Home (STRICT REPRODUCTION REQUIRED)
    - STOREFRONT (EXTERIOR) VI: Must have RED "itel" text inside a WHITE GLOWING speech bubble, mounted on a solid RED fascia. "Home" is white.
    - INTERIOR BRAND WALL VI: The backdrop wall itself MUST be PURE WHITE. The logo mounted on it must be a RED speech bubble containing WHITE "itel" text. The word "Home" is forbidden on the interior brand wall. No red panels or background walls should be generated for the interior walls.
    - LOGO GEOMETRY: ${logoStyle === 'red-bg' ? ITEL_HOME_LOGOS.visualAnchors.darkMode : ITEL_HOME_LOGOS.visualAnchors.lightMode}
    - PROPORTIONS: The logo width-to-height ratio must be exactly ${ITEL_HOME_LOGOS.proportions.aspectRatio}.
    - BUBBLE TAIL: The triangular tail MUST be SUBTLE, extremely SMALL and SHORT. It acts as a tiny nib at the bottom-left. Avoid large spikes.
    - HOLLOW O (ZERO TOLERANCE): The letter "o" in "Home" MUST ALWAYS BE A HOLLOW RING. The signage background (RED or WHITE) MUST be visible through the hole in the "o". It is NOT a solid white disc.
    - TYPOGRAPHY SLANT: The word "Home" MUST have a 3-degree italic slant, perfectly matching the "itel" bubble.
    
    ### MATERIAL & LIGHTING:
    - SIGNAGE: Use the ACP Silver/Red combination from standard references. High-quality matte finish.
    - LIGHTING: 6000K cold-white spotlights underneath the signage, creating focused downward beams.
    - INTERIOR: If visible, cabinets must follow the silver-edge plus light-oak wood pattern.
    
    ### COLORS (MANDATORY):
    - BRAND RED: Vibrant Red (#FF0037).
    - BRAND WHITE: Pure White (#FFFFFF).
    - FONT STYLE: Clean, bold, modern sans-serif.
    - EXTERIOR LOGO STYLE: RED "itel" text inside a WHITE GLOWING speech bubble.
    - INTERIOR LOGO STYLE: WHITE "itel" text inside a RED speech bubble.
    - LOGO MAPPING: ${logoStyle === 'red-bg' ? 'RED "itel" text in glowing white bubble on RED SIGNAGE board' : 'RED "itel" text in glowing white bubble on WHITE background'}.
    
    ### SIGNAGE ARCHITECTURE (3D DEPTH & SPATIAL ANCHORING):
    - NO FLOATING (CRITICAL): The signage MUST be coplanar with the building's facade. Identify the "structural plane" of the original building and lock the signage to it.
    - EDGE DETECTION & SNAPPING: The signage's top and bottom edges must be perfectly parallel to the building's horizontal beams (Lintels). Detect structural lines in the background and snap the signage module to them.
    - VOLUMETRIC COMPENSATION: The signage must be rendered as a 3D physical box with a defined thickness (e.g., 100mm). 
    - SIDE RETURNS: The sides of the signage box (the "returns") must be visible and rendered with a darker, shaded value than the front face to clearly establish 3D geometry and depth.
    - MATERIAL: Use ${tier === 'L1' ? 'Premium Red Aluminum Composite Panels (ACP) with subtle satin sheen and 3D luminous characters.' : (tier === 'L4' || tier === 'L5') ? 'High-tensile red fabric banner stretched over a 3D structural metal frame with visible side thickness.' : 'Standard 3D signage modules.'}
    - CONTACT SHADOWS: Ensure deep, accurate contact shadows where the signage box meets the original pillars or slabs.
    
    ### ZERO TOLERANCE (CRITICAL):
    - NO SOLID "o". The letter "o" in "Home" MUST ALWAYS BE A HOLLOW RING. The background color of the signage board MUST be clearly visible through the center of the "o".
    - SIGNAGE-ONLY BOUNDARY: If in SIGNAGE ONLY mode, you are strictly forbidden from changing anything outside the signage area. Keep the original building text and neighboring details exactly as they appear in the original photo.
    - NO PERSPECTIVE TILT. The signage module must be rendered as a perfectly horizontal rectangular block, ignoring any slanted perspective of the original building that contradicts a front-facing elevation.
    - NO LARGE BUBBLE TAILS. The tail must be a tiny, subtle nib pointing bottom-left.
    - NO upright circular "o". Every character in "Home" MUST have the same 3-degree slant as "itel".
    - NO generic fonts. You MUST match the typography provided in the REFERENCE LOGO image.
  `;

  const systemInstruction = `
    ${demoInstruction}
    ${fixturePriorityDirectives}
    ${weatheringPrompt}
    You are the itel Home Retail Space Rendering Engine. 
    Your core duty is to act as a "Style Library Matching Engine". 
    
    ### WORKFLOW (MANDATORY):
    1. ANALYZE: Carefully read the provided "Standard Style Guide" for the selected Tier [${tier}].
    2. RETRIEVE: Pull all specified materials, color codes, and lighting ratios from the itel Home Global Style Library.
    3. MATCH: Render the scene by strictly conforming the original architecture to these retrieved standards. 

    Your specialty is creating "Official itel Home Global Store Standard" renderings.
    
    ### ARCHITECTURAL CONSISTENCY (CRITICAL):
    ${spatialDepthPrompt}
    - All rendering angles (Interior, Detail, Ceiling, etc.) MUST be consistent with the "Front Panorama" (Storefront).
    - If a Storefront/Environment image is provided, it is the ABSOLUTE SOURCE OF TRUTH. 
    - THE "SAME STORE" RULE: Every other angle is just a camera move within the SAME physical building shown in the Front Panorama. 
    
    ### SPATIAL PROJECTION & ANCHOR AXIOMS (PHYSICAL GROUNDING):
    - ANCHOR PRINCIPLE: Treat all color blocks or geometry in the provided Plan/Task image as absolute X, Y, Z axis coordinates. 
    - HEIGHT MODULES (STRICT H-MODULAR):
      - H=50mm: Minimum baseboard/recessed floor detail.
      - H=900mm: Standard height for EXPERIENCE TABLES, CASH COUNTERS, and display surfaces.
      - H=600mm: Vertical height for SIDE SIGNAGE and hanging props.
      - H=2400mm: Standard height for top edge of CABINETS and WALL BRANDING.
    - COORDINATE MAPPING: Map the layout of "Task Image" to a 3D volume. Maintain the exact floor-plan footprint provided. Do NOT move tables or walls from their X-Y positions in the plan.
    
    ### EXTERIOR vs INTERIOR BRANDING (MANDATORY DIVERGENCE):
    - STOREFRONT FASCIA (Exterior): Uses a RED background with the WHITE GLOWING bubble and RED "itel" text.
    - BRAND WALL (Interior): MUST be PURE WHITE. 
    - INTERIOR LOGO: Must be a RED speech bubble with WHITE "itel" text inside.
    - CRITICAL INTERIOR RULE: The word "Home" is FORBIDDEN on the interior brand wall. Use ONLY the itel speech bubble logo.
    - CRITICAL: Do NOT paint the interior brand wall red. It must remain a clean, minimalist white backdrop to ensure product visibility.
    
    ### MATERIAL SPECIFICATIONS (MANDATORY BENCHMARK):
    - LIGHTING: ${lightingLib}.
    - FINISHES: ${finishLib}.
    - FLOORING: ${flooringLib}.
    - CEILING: ${ceilingLib}.
    - WALLS: ${wallLib}.
    - FURNITURE & PROPS: ${propsLib}.
    
    ### SEMANTIC CONTROL MASK (PIXEL-PERFECT RIGIDITY):
    If a color-coded mask (Red/Blue/Black) is provided, it is the ABSOLUTE PIXEL BOUNDARY. 
    - [STRICT MASK LOCK]: You are strictly FORBIDDEN from modifying or re-rendering even a single pixel in the BLACK area. The BLACK area must remain 100% original.
    - [NO OVERSHOOT]: Your generated itel Home modules (Red signage, Blue glass) MUST be clipped and perfectly contained within the provided mask shapes. If the red pixels stop at a column, the signage MUST stop exactly at that same pixel coordinate.
    - [SURGICAL REPLACEMENT]: This is a "Replace-In-Place" operation. Remove the original building content ONLY within the Red and Blue regions and insert your new standard-compliant architectural components.
    - [DIMENSIONAL CONFORMTIY]: Do NOT attempt to "optimize" or "expand" the store's width or height beyond the mask. Follow the mask geometry as the final legal construction boundary.
    
    ### PHOTOREALISM & TEXTURE (CRITICAL):
    - Target: High-end architectural photography style.
    - Avoid: "Plastic" or "Computer-generated" flat finishes.
    - Lighting: Emulate real-world light bounce, lens flare, and subtle imperfections found in Real Photo samples.
    - Environment: Use the provided street context to ground the store realistically. 
    - Materials: Metal must have subtle brushed textures; glass must show realistic environment reflections.
    - Sample Learning: Use the "VERIFIED LEARNING SAMPLES" to learn both official design proportions (from Renders) and photographic quality (from Photos).
    
    ### TIER CONTEXT [${tier}]:
    ${tierStandard.promptInjection}
    
    ### MATERIAL CATALOG:
    - Lighting: ${dynamicStandards.material_library.lighting.spotlights} ${dynamicStandards.material_library.lighting.panels}
    - Walls: ${dynamicStandards.material_library.walls.brandWall} ${dynamicStandards.material_library.walls.generalWall}
    - Floors: ${dynamicStandards.material_library.flooring.tiles}
  `;

  let angleDescription = "";
  switch (renderAngle) {
    case 'front_panorama':
      angleDescription = "Front Panorama. Show the complete exterior facade, storefront sign, and the specific door type clearly. Maintain perfect frontal eye-level view, horizontal symmetry, and zero wide-angle distortion.";
      break;
    case 'storefront_perspective':
      angleDescription = "Storefront 45-degree Perspective. A dynamic architectural photograph of the storefront captured from a diagonal angle. This view should emphasize the three-dimensional depth of the facade, the thickness of the red ACP panels, and the textured feel of the building materials. Show how the building meets the street corner.";
      break;
    case 'side_signage':
      angleDescription = "Side Hanging Sign (Blade Sign). Focus on the vertical branding module that hangs perpendicular to the building's facade. Show the mounting bracket, the double-sided red signage, and itel Home logo clearly from a profile perspective.";
      break;
    case 'logo_detail':
      angleDescription = "Signage and Logo Detail. A macro close-up view of the storefront signage. Focus intensely on the 'itel Home' logo typography, the gloss/matte finish of the acrylic or metal surface, and the subtle LED halo lighting or internal illumination effects. The brand colors must be perfectly accurate.";
      break;
    case 'interior_perspective':
      angleDescription = `Interior Full Perspective. Step INSIDE the building shown in the Front View through the ${dynamicStandards.material_library.props.storefront}. 
      STRICTLY apply the MATERIAL SPECIFICATIONS:
      - BRAND WALL: ${dynamicStandards.material_library.props.brandWall} (Central focus). 
      - INTERIOR LOGO: Use ONLY the itel red bubble. The word "Home" is NOT allowed indoors.
      - TABLES & ISLANDS: ${dynamicStandards.material_library.props.experienceTable} and ${dynamicStandards.material_library.props.experienceIsland}.
      - CABINETS: ${dynamicStandards.material_library.props.accessoryCabinet}.
      Ensure a clean, organized, and high-end retail atmosphere with precise material rendering.`;
      break;
    case 'detail_closeup':
      angleDescription = "Detail Close-up. Focus tightly on specific architectural nodes like the storefront sign materials, craftsmanship, lighting, or the product texture on an Experience Table.";
      break;
    case 'indoor_zone':
      angleDescription = `Indoor Zone Special View. This is an open-plan indoor area. 
      - BRAND WALL: ${dynamicStandards.material_library.props.brandWall}.
      - FIXTURES: Include ${dynamicStandards.material_library.props.accessoryCabinet} and ${dynamicStandards.material_library.props.experienceIsland}.
      - LOGO: Use ONLY the itel red bubble logo; the word 'Home' is strictly forbidden indoors.`;
      break;
    case 'exposed_ceiling':
      angleDescription = "Exposed Ceiling Special View. Look upwards to clearly show the bare ceiling structure. NO suspended ceiling.";
      break;
    case 'floor_special':
      angleDescription = "Floor Special View. Look downwards to show the floor material unobstructed.";
      break;
  }

  const prompt = `
    ### MANDATORY VIEWPORT & COMPOSITION [CRITICAL]:
    - VIEW_ANGLE: ${renderAngle.toUpperCase()}
    - VIEW_DESCRIPTION: ${angleDescription}
    - PRIMARY_DIRECTIVE: You MUST strictly adhere to the requested view angle. If ${renderAngle === 'interior_perspective' || renderAngle === 'indoor_zone' ? 'Interior' : 'Side'} is requested, do NOT render a standard front exterior facade.
    - GEOMETRIC PRIORITIZATION: If the requested VIEW_ANGLE contradicts the geometry or perspective shown in the uploaded photo or mask, you MUST prioritize the requested VIEW_ANGLE. Perform a full conceptual re-imagining of the scene from the new perspective while maintaining the itel Home brand standards.

    ### CONFIGURATION MANIFEST (STRICT ADHERENCE):
    - TIER: [${tier}]
    - LOCATION: [${city}, ${country}]
    - STORE_AREA: [${storeArea}㎡]
    - LOGO_STYLE: [${logoStyle}]
    - ASPECT_RATIO: [${aspectRatio}]
    - RESOLUTION: [${imageSize}]
    - WEATHER: [${weather}]
    - TIME_OF_DAY: [${timeOfDay}]
    - OUTPAINTING_PREFERENCE: [${outpaintSide}]
    - USER_CUSTOM_PROMPTS: [${environmentDetails}]
    
    ### OUTPAINTING / EXPANSION LOGIC (BIAS) & SEAMLESS BLENDING:
    ${outpaintSide === 'left' ? '- BIAS LEFT: The uploaded environment photo should be anchored to the RIGHT of the 16:9 canvas. Expand the scene primarily to the LEFT (adding more street/context on the left).' : 
      outpaintSide === 'right' ? '- BIAS RIGHT: The uploaded environment photo should be anchored to the LEFT of the 16:9 canvas. Expand the scene primarily to the RIGHT (adding more street/context on the right).' : 
      '- BIAS CENTER: The uploaded environment photo should be anchored in the CENTER. Expand the environment equally on both sides to reach the 16:9 aspect ratio.'}
    - CRITICAL BLENDING MANDATE: Any newly generated extended areas (outpainting) MUST blend seamlessly with the original image. There should be ZERO visible seams, borders, or disjointed artifacts between the original photo and the expanded regions. 
    - CONTEXT CONTINUATION: Analyze the architecture, street elements, lighting, sky, and ground in the original photo and continue them naturally into the expanded zones.
    ${structuralAnalysis ? `
    ### SPATIAL ANCHOR DATA (GROUND TRUTH):
    - DETECTED_SIGNAGE_VERTICES (Where logo must go): ${JSON.stringify(structuralAnalysis.signageVertices)}
    - DETECTED_STOREFRONT_VERTICES (Where the building/entrance is): ${JSON.stringify(structuralAnalysis.storefrontVertices)}
    - TILT_ANGLE: ${structuralAnalysis.tiltAngle}
    - VANISHING_POINTS: ${structuralAnalysis.vanishingPoints}
    - LIGHT_SOURCE_DIRECTION: ${structuralAnalysis.lightSource}
    - STRUCTURE_TYPE: ${structuralAnalysis.detectedStructure}
    - SPATIAL_DIAGNOSIS: ${structuralAnalysis.analysis}
    ` : isDemoMode ? `
    ### AUTOMATIC SPATIAL DISCOVERY (DEMO MODE):
    - No explicit anchor data or mask provided. You MUST analyze the "Environment Image" and automatically identify the most logical facade or commercial building to transform into an "itel Home" outlet.
    - Perform a "FULL BRAND TAKEOVER": Replace the identified building's facade with the official itel Home standards (Red ACP, centered 3D front-lit logo, and glass frontage).
    - Ensure the perspective, scale, and lighting of your newly generated store perfectly match the street scene's ambient conditions.
    ` : ''}

    ### COMMAND: ANALYZE AND MATCH STYLE LIBRARY
    
    ### STEP 1: STYLE ANALYSIS
    - Study the TIER_CONTEXT [${tier}] and the [Standard Style Guide] prompt injection.
    - Identify the specific signage material (e.g., Red ACP vs. Flex Banner).
    - Identify the interior display logic (e.g., Island display vs. Wall-mounted).

    ### STEP 2: PROTOCOL: COMMANDER MODE (STRICT GEOMETRIC CONTROL)
    - PIXEL STAKING: Use the provided MASK and SPATIAL ANCHOR DATA as rigid physical anchors. The itel Home signage must map to the DETECTED_SIGNAGE_VERTICES, and the physical building/walls must map to DETECTED_STOREFRONT_VERTICES.
    - LOGO WIDTH RATIO: The main itel Home logo must maintain a width_ratio of 0.55 relative to the total width of the fascia plane it is hosted on.
    - MODULAR H-SCALE: The signage height (H) must be scaled to appear approximately 1/4 (25%) of the height of the main entrance door/opening.
    - MATERIAL MATCHING: Strictly use the materials specified in the style library (e.g., Matte Powder Coated Red ACP). It should have a soft, non-reflective finish with realistic micro-textures.
    - ENVIRONMENTAL FUSION: 
      * DUST: Apply a subtle layer of "Local Street Dust/Red Soil" to the lower surfaces of the signage and floor module to blend with the L4/L5 environment.
      * OCCLUSION: Correctly handle overlapping elements like power lines, tree branches, or columns. The itel Home module must sit BEHIND these existing foreground elements if they exist in the original context.
      * LIGHTING: The artificial 3D lighting of the store MUST match the LIGHT_SOURCE_DIRECTION vector.
    
    ${materialAnalysis ? `
    ### CUSTOM MATERIAL & STYLE OVERRIDE (CLIENT REQUIREMENT):
    ${materialAnalysis.includes('Standard itel Home Reference') 
      ? `### STANDARDIZED REFERENCE DETECTED: This reference is from the OFFICIAL itel Home SI Library. 
         - MANDATE: Use this as the "GOLD STANDARD" for material textures, lighting depth, and brand presence. 
         - PRIORITY: This reference takes precedence over generic brand descriptions. Replicate its visual fidelity exactly.`
      : `The user has supplied a specific material and stylistic reference. You MUST apply these material properties, textures, and vibes closely to the design.`}
    
    ${renderAngle === 'interior_perspective' || renderAngle === 'indoor_zone' 
      ? 'Specifically apply this to the INTERIOR walls, floors, display tables, and cabinets. IGNORE generic materials, and strictly use the referenced items:' 
      : 'Specifically apply this to the EXTERIOR STOREFRONT, ENTRANCE, and physical architecture:'}
    
    REFERENCE DATA: ${materialAnalysis}
    ` : ''}

    ### FINAL RE-RENDERING (GENERATE):
    Execute the rendering now by matching the analyzed style library to the physical environment.
    - CAMERA: Render with a 35mm lens perspective to avoid wide-angle distortion.
    
    ### EXECUTION KEYWORDS - COMPOSITION & CAMERA:
    - VIEW: ${angleDescription}
    - SYMMETRY: Perfect horizontal symmetry (水平对称).
    - GEOMETRY: No oblique angles (无斜角), no wide-angle distortion (无广角变形).
    - STYLE: Architectural completion acceptance photo (建筑竣工验收标准照).
    - CUSTOM_INSTRUCTIONS: ${environmentDetails || "None"}

    ### EXECUTION KEYWORDS - ENVIRONMENTAL INTEGRATION:
    - MODE: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'STRICT INTERIOR' : 'EXTERIOR RETAIL'}
    - SPATIAL_MAPPING (CRITICAL):
        - If a reference image is provided, treat it as a STRICT GEOMETRIC LAYOUT MAP (基础平面布置图).
        - PERFORM 1:1 SPATIAL PROJECTION: Map every 2D shape in the layout into its corresponding 3D position.
        - PRESERVE COORDINATES: Do NOT move the cash counter, display racks, or signage. Maintain the exact relative distances and orientation shown in the floor plan.
        - ARCHITECTURAL REPLACEMENT: For areas marked in the BLUE MASK, you have permission to DISREGARD the original architectural details (like ancient windows or stone walls) and replace them with a modern glass storefront and entrance.
        - WALL ALIGNMENT: Align the floor plan's walls to the 3D scene boundaries perfectly.
    - SCALE: Store size and scale MUST reflect the requested area of ${storeArea} square meters.
    - ATMOSPHERE: ${weather === 'sunny' ? 'Strong tropical sun, high contrast shadows' : weather === 'rainy' ? 'Wet ground, reflections, overcast sky, raindrops' : weather === 'cloudy' ? 'Soft diffused light, muted shadows' : 'Gloomy overcast sky, flat lighting'}.
    - LIGHTING: ${timeOfDay === 'day' ? 'Bright daylight' : timeOfDay === 'dusk' ? 'Golden hour, warm sunset glow, long shadows' : 'Night scene, artificial street lights, glowing signage, high contrast'}.
    - BUSTLE (烟火气): ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Focus on interior shoppers and store staff. No street vehicles.' : 'For L3, L4, and L5, maximize realistic street life. Include diverse street vendors (fruit stalls, small kiosks), varied local vehicles (Keke Napep, old motorcycles, local buses), and organic human activities.'}
    - DIVERSITY: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Varied display fixtures and lighting zones.' : 'Neighboring buildings MUST be varied in height, material, and age. Avoid repetitive or "staged" background architecture. Each rendering should feel like a unique, random slice of a real street.'}
    - WEATHERING: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Pristine, clean commercial interior surfaces. Zero dust.' : 'For L5, show visible water stains, dust accumulation, peeling paint, and wind erosion on the facade.'}
    - CONTEXT: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Modern retail interior with spotlights, product displays, and brand wall.' : (environmentalContext || "Standard African street context.")}
    - TIER_CONTEXT: For L1, the environment MUST be a modern, clean, high-end urban commercial district with paved roads and modern vehicles. ABSOLUTELY NO muddy roads or dirt for L1.

    ### EXECUTION KEYWORDS - BRAND IDENTITY & LOGO:
    ${logoStyle === 'none' ? '- LOGO: NONE. Do NOT render any itel Home logo or signage.' : `
    - LOGO_LOGIC: ${logoInstruction}
    - SIGNAGE_GEOMETRY (CRITICAL): ${renderAngle === 'side_signage' 
        ? "The branding module is a VERTICAL BLADE SIGN (侧招) mounted perpendicular to the wall. It must be double-sided, red, with itel Home logo clearly visible from the side perspective. Do NOT render a horizontal fascia band for this view." 
        : `The storefront sign MUST span the FULL WIDTH of the ${environmentMaskBase64 ? 'TARGET AREA defined by the spatial mask' : 'building facade'}, stretching from the far-left edge to the far-right edge of the ${environmentMaskBase64 ? 'target shop' : 'building'} without any gaps. It must be a continuous horizontal fascia band.`}
    - CENTERING: Logo perfectly centered on the ${renderAngle === 'side_signage' ? 'blade signage' : 'fascia'}.
    `}

    ### SEMANTIC CONTROL MASK (BIT-LEVEL PIXEL LOCK):
    ${environmentMaskBase64 ? `
    - ZERO-OVERSHOOT POLICY: Use the provided "Semantic Mask" as a mathematically rigid stencil.
    - RED AREA (RGB 255,0,0): This is the ONLY region where the itel Home SIGNAGE is allowed.
        * MANDATORY: Do not let the red signage box be even 1 pixel wider or taller than the red area.
    - BLUE AREA (RGB 0,0,255): This is the ONLY region where the itel Home INTERIOR/GLASS is allowed.
        * MANDATORY: The new storefront must be perfectly nested within this blue zone.
    - BLACK AREA (RGB 0,0,0): This is the original environment. Try to preserve it for structural integrity, but you MAY naturally blend light, shadows, and reflections into it. DO NOT literally render pure black pixels here in the final output.
    - OUTPAINTING & CANVAS EXPANSION (CRITICAL): If the target image aspect ratio (e.g., 16:9) is wider/taller than the original photo or mask, you MUST completely generate natural-looking surroundings (streets, buildings, sky, etc.) to seamlessly fill the newly expanded empty space. DO NOT LEAVE OUTPAINTED AREAS BLACK OR BLANK.` : '- NO MASK: Perform a standard professional renovation.'}

    ### EXECUTION KEYWORDS - TIER-SPECIFIC RULES:
    - TIER_NAME: ${strategy.name}
    - SIGNAGE_STRATEGY: ${strategy.signageStrategy}
    - INTERIOR_STRATEGY: ${strategy.interiorStrategy}
    - MATERIAL_SOURCING: ${strategy.materialSourcing}
    - L3 (标准店/Standard Store):
        - CONCEPT: A unified, professional retail presence on a busy commercial street.
        - SIGNAGE: Continuous RED ACP (Aluminum Composite Panel) fascia band stretching corner-to-corner.
        - LOGO: Large 3D Acrylic front-lit logo "itel Home" centered on the red fascia.
        - FRONTAGE: Clean glass storefront with a clear main entrance. If in a street, show a professional threshold.
        - INTERIOR: Premium Light Oak wood grain texturing cabinets/shelves visible through the window, pure white background walls, with standard white/glass display islands. No red walls.
    - L5 (挂牌店/Branded Store): 
        - CONCEPT: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Store-in-store or partner shop interior branding.' : (environmentMaskBase64 ? "Enhanced storefront transformation based on user mask." : "Mini-store integration (Partner Shop). This is an existing shop that has been branded with itel Home materials.")}
        - SIGNAGE: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Interior brand wall with itel bubble logo.' : (environmentMaskBase64 ? "Modern red fascia band matching the MASK." : "A large Flex Banner / Inkjet Signage (喷绘布) mounted or hung on the top of the existing storefront.")}
        - ENTRANCE: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Indoor display area.' : (environmentMaskBase64 ? "Full glass storefront as defined by BLUE MASK." : "A vertical itel Home glass display cabinet (柜台) standing prominently at the entrance.")}
        - INTERIOR: Inside the shelves, prominently display many red itel Home branded product boxes (packaging).
        - FACADE: ${['interior_perspective', 'indoor_zone'].includes(renderAngle) ? 'Interior retail space with itel Home modular fixtures.' : 'Original local architectural style of the partner shop, with the itel Home banner as the primary branding addition.'}
    
    ### TRANSFORMATION REASONING (VISUAL-GUIDED GEOMETRIC ALIGNMENT):
    1. [ARCHITECTURAL SCAN]: Scan the image for structural planes using the provided SPATIAL ANCHOR DATA.
    2. [COORDINATE MAPPING]: Anchor the itel Home unit's 4 corners to the vertices specified in the SPATIAL ANCHOR DATA or the mask region.
    3. [GEOMETRIC CONFORMITY]: Ensure the signage plane perfectly matches the TILT_ANGLE and depth of the identified mounting surface.
    4. [EDGE SNAPPING]: Snap the signage box upper edge to the detected horizontal lintel/beam.
    5. [3D BOX ASSEMBLY]: Construct the signage box with defined corner returns and physical thickness (100mm). 
    6. [LIGHTING MATCH]: Apply contact shadows and surface shadows matching the scene's ambient occlusion and primary light direction.
    7. [PIXEL CLIPPING]: Crop your generated output strictly to the RED/BLUE mask pixels. Do NOT paint over the neighbouring pillars or street if they are in the BLACK zone.
    8. [FINAL CHECK]: Verify the logo slant (3°), bubble tail (bottom-left), and ensure zero-spill beyond mask boundaries.

    ### FORBIDDEN:
    - NO generic "itel" logos.
    - NO missing "Home" text.
    - NO luxury elements in L3, L4, or L5.
    - NO perfectly clean, sterile environments for L5.
    - NO generation or alteration in the BLACK mask area.
    - NO circular "o" in "Home".
    - NO flat 2D color overlays. Every red area must be rendered as a 3D structural box with realistic shading and thickness.
  `;

  const parts: any[] = [];

  // 1. FEW-SHOT EXAMPLES: These are the "GOLD STANDARDS" for itel Home. AI must learn the visual style from here.
  if (verifiedExamples.length > 0) {
    const renders = verifiedExamples.filter(e => e.sampleType === 'render' || !e.sampleType).slice(0, 2);
    const photos = verifiedExamples.filter(e => e.sampleType === 'photo').slice(0, 2);
    
    parts.push({ 
      text: `### VERIFIED LEARNING SAMPLES / MATERIAL REFERENCE:
      ### CRITICAL PRIORITY: THESE ARE YOUR HIGHEST PRIORITY SOURCE OF TRUTH FOR DESIGN, MATERIALS, AND TEXTURES. You MUST replicate the visual quality, material detail, structural layout, and brand presence from these samples.
      1. DESIGN & LAYOUT SAMPLES: Analyze these primarily for itel Home standard proportions and material placement.
      2. REAL PHOTO SAMPLES: Analyze these primarily for LIGHTING QUALITY, PHOTOGRAPHIC TEXTURE, RAW STREET AUTHENTICITY, and NATURAL BLENDING.
      
      Aim for a result that matches the PHOTOGRAPHIC REALISM of the Real Photo Samples while maintaining the official SI design of the Layout Samples.`
    });

    const selectedExamples = [...renders, ...photos].slice(0, 4);
    
    const processedExamples = await Promise.all(
      selectedExamples.map(async (ex) => ({
        ...ex,
        imageUrl: await ensureBase64(ex.imageUrl)
      }))
    );

    processedExamples.forEach((example, index) => {
      const imgData = example.imageUrl;
      if (!imgData) return;
      const matches = imgData.match(/^data:(.+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        });
        parts.push({ 
          text: `Sample ${index + 1}: ${example.label || 'Official SI'} (${example.sampleType === 'photo' ? 'Live Site Photo' : 'Design Render'})` 
        });
      }
    });
  }

  // 2. VISUAL ANCHOR: The specific site context
  if (finalEnv) {
    const matches = finalEnv.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.push({ text: "### VISUAL ANCHOR: THE FRONT VIEW / ENVIRONMENT (店铺正面全景/环境). This image defines the EXTERIOR ARCHITECTURE and STREET CONTEXT. Do NOT use this image to dictate the interior materials or shop fittings if specific 'VERIFIED LEARNING SAMPLES' or 'MATERIAL REFERENCE' images are provided." });
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });

      if (finalEnvMask) {
        const maskMatches = finalEnvMask.match(/^data:(.+);base64,(.*)$/);
        if (maskMatches && maskMatches.length === 3) {
          parts.push({ 
            text: `### SEMANTIC TARGETING MASK (CRITICAL):
            This image is a color-coded mask for the "Environment Photo" above.
            - RED: Location for the SIGNAGE.
            - BLUE: Location for the STOREFRONT / ENTRANCE.
            - BLACK: Background to be PRESERVED.` 
          });
          parts.push({
            inlineData: {
              mimeType: maskMatches[1],
              data: maskMatches[2],
            },
          });
        }
      }
    }
  }

  // 3. LOGO REFERENCE BENCHMARK
  if (finalLogo) {
    const matches = finalLogo.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.push({ text: `### OFFICIAL LOGO BENCHMARK (DEFINITIVE STYLE): 
      The following image is the ONLY AUTHORIZED itel Home logo. 
      - EXACT TYPOGRAPHY: Observe the specific slant and spacing of the letters.
      - EXACT GEOMETRY: Observe the bubble's curve and tail position.
      - EXACT ALignment: The word "Home" is vertically centered with the bubble.
      You MUST reproduce this style exactly on all storefront signage and brand walls.` });
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  // 4. ADDITIONAL MATERIALS & SIGNAGE REFERENCES
  if (finalSignage) {
    const matches = finalSignage.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.push({ text: "### INTERIOR SIGNAGE REFERENCE: Replicate the branding style shown here inside the store." });
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  if (finalMaterials) {
    const matches = finalMaterials.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.push({ text: `### CRITICAL STANDARD BRAND DESIGN & MATERIAL REFERENCE (SI STANDARD TEMPLATE - HIGHEST PRIORITY): 
      This image represents the BRAND-APPROVED SI STANDARD. You MUST treat this image as the ABSOLUTE HIGHEST PRIORITY benchmark for architectural style, materials, colors, and layout. 
      - EXACT SI STANDARD: You MUST rigidly emulate the exact materials, color palette (such as high-gloss Red ACP cladding on headers, bright white column designs), shopfitting styles (counters, display desks, shelving), and premium 6000K cool lighting showcased.
      - OVERRIDE BEHAVIOR: Override any conflicting cues from the guest or environment image to preserve the pure, official standard of this reference sample.` });
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  // 5. LAYOUT REFERENCE
  if (finalRef) {
    const matches = finalRef.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.push({ text: "### REFERENCE LAYOUT (基础平面图): Use this image STRICTLY for spatial arrangement and object positions." });
      parts.push({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  // 6. FINAL PROMPT
  parts.push({ text: prompt });

  const config: any = {
    imageConfig: {
      aspectRatio: aspectRatio as any,
      imageSize: imageSize as any
    },
    systemInstruction
  };

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: model as any,
      contents: [{ parts }],
      config
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return {
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          prompt: prompt
        };
      }
    }
  } catch (err: any) {
    console.error("Store Generation API Error:", err);
    throw err;
  }

  throw new Error("未生成图片");
}

export interface RenderingAnalysis {
  tierAnalysis: string;
  designStrategy: string;
  budgetAssessment: string;
  materialSourcing: string;
  complianceCheck: string;
}

export async function analyzeRenderingStrategy(
  generatedImageBase64: string,
  tier: string,
  location?: Location,
  selectedCity?: string,
  language: 'zh' | 'en' = 'zh'
): Promise<RenderingAnalysis> {
  const ai = getAI();
  const strategy = STORE_STRATEGIES[tier] || STORE_STRATEGIES['L3'];
  const country = location?.country || "Nigeria";
  const city = selectedCity || location?.cities[0] || "Lagos";

  const prompt = `
    Analyze the provided itel Home store rendering/photo for the ${tier} tier in ${city}, ${country}. Use strict SI (Space Identity) criteria to find any compliance errors.
    
    ### REFERENCE STANDARDS FROM "itel Home 门店分级建店预案V1.0":
    - Tier Name: ${strategy.name}
    - Target: ${strategy.target}
    - Signage Strategy: ${strategy.signageStrategy}
    - Interior Strategy: ${strategy.interiorStrategy}
    - Material Sourcing: ${strategy.materialSourcing}
    - Key Principles: ${strategy.keyPrinciples.join(', ')}

    ### VI COMPLIANCE AUDIT AXIOMS (CRITICAL CHECKPOINT):
    1. **Logo Bubble & Shape (商标气泡几何造型)**:
       - The storefront/interior logo bubble MUST be a horizontal oval with a very subtle, tiny, sharp triangular tail at the bottom-left corner.
       - The aspect ratio must be approx 3.2:1. It should NOT be a regular circle, nor look distorted.
       - The letter "o" in "Home" MUST be a hollow ring, showing the background through its middle.
    2. **Interior Background Wall (内部背景墙)**:
       - The interior brand background wall MUST be PURE WHITE. It is STRICTLY FORBIDDEN to paint this background wall red.
       - On the pure white wall, the mounted logo should be a RED speech bubble containing WHITE "itel" text. The word "Home" is forbidden indoors.
       - If you see a fully red interior wall, report it as a standard violation.
    3. **Experience Tables & Cabinets (体验中岛与展架)**:
       - All display units, central islands, experience desks, and wall-mounted shelves/showcases MUST show the MATTE LIGHT OAK WOOD-GRAIN TEXTURE (哑光浅色橡木纹理).
       - White or red high-gloss lacquered finishes (红白高光烤漆) on cabinets/islands are STRICTLY FORBIDDEN. They must be matte wood-grain. If the image has glossy red/white counters, report it as a violation of the standard SI sample library guidelines.

    ### YOUR TASK:
    1. **Tier Analysis**: Confirm if the visual quality and scale match the ${tier} positioning.
    2. **Design Strategy**: Describe how the rendering implements or fails to implement the specific signage and interior strategies for this tier.
    3. **Material & Craftsmanship Assessment**: Evaluate the visual representation of materials and craftsmanship shown in the image, strictly checking if the display shelves/islands use Matte Light Oak wood grains rather than glossy red/white lacquer.
    4. **Material Sourcing**: Identify which parts appear to be domestic customized vs. local auxiliary.
    5. **Compliance Check**: Provide a rigorous, uncompromising compliance check based on the "VI COMPLIANCE AUDIT AXIOMS" above (itel Red, background color of interior brand wall, speech bubble tail shape, and matte wood-grain textures). If there is any mismatch (such as red background walls instead of white, or high-gloss red/white cabinets instead of matte wood-grain), call it out clearly.

    ### LANGUAGE REQUIREMENT:
    Return all analysis text in ${language === 'zh' ? 'Chinese' : 'English'}.

    Return the analysis in a professional, structured format.
  `;

  const matches = generatedImageBase64.match(/^data:(.+);base64,(.*)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image data");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: matches[1],
              data: matches[2],
            },
          },
          { text: prompt }
        ]
      }
    ],
    config: {
      thinkingConfig: { thinkingLevel: 'MINIMAL' as any },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tierAnalysis: { type: Type.STRING },
          designStrategy: { type: Type.STRING },
          budgetAssessment: { type: Type.STRING },
          materialSourcing: { type: Type.STRING },
          complianceCheck: { type: Type.STRING },
        },
        required: ["tierAnalysis", "designStrategy", "budgetAssessment", "materialSourcing", "complianceCheck"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse analysis JSON", e);
    // Fallback if JSON parsing fails
    return {
      tierAnalysis: "分析生成失败，请重试。",
      designStrategy: "分析生成失败，请重试。",
      budgetAssessment: "分析生成失败，请重试。",
      materialSourcing: "分析生成失败，请重试。",
      complianceCheck: "分析生成失败，请重试。"
    };
  }
}

const cleanJsonString = (str: string) => {
  return str.replace(/```json\s?|```/g, '').trim();
};

export async function importBOMData(input: string | { data: string; mimeType: string }) {
  const ai = getAI();
  
  const prompt = `You are a BOM (Bill of Materials) data extraction assistant. 
  Extract material information from the provided input (text or image).
  Merge identical items (same part number and name) by maintaining one entry.
  Return a JSON array of objects with these fields:
  - partNumber: string (料号)
  - name: string (物料名称)
  - unit: string (单位, e.g., sqm, pcs, bucket, day)
  - price: number (单价, in USD)
  - quantity: number (数量)
  - category: string (One of: Signage, Furniture, Lighting, Others)

  If a field is missing, try to infer it or leave it as an empty string/0.
  Ensure all prices are in USD. If the input uses another currency, convert it (assume 1 USD = 1500 NGN if NGN is used).
  Return ONLY the JSON array.`;

  const contents = typeof input === 'string' 
    ? [{ parts: [{ text: prompt }, { text: input }] }]
    : [{ parts: [{ text: prompt }, { inlineData: input }] }];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const cleaned = cleanJsonString(response.text);
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse AI response:', response.text);
    throw new Error('Failed to parse BOM data from AI response');
  }
}
