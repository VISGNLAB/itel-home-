import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

export async function generateStoreRendering(
  tier: string,
  renderAngle: string,
  aspectRatio: string,
  environmentDetails: string,
  referenceImageBase64?: string,
  environmentImageBase64?: string,
  logoImageBase64?: string
): Promise<string> {
  const ai = getAI();
  
  let tierDescription = "";
  let doorType = "";
  if (tier === "T1-T2") {
    tierDescription = "Location: T1-T2 Core Cities in Nigeria (e.g., Lagos, Abuja, Kano, Ibadan, Port Harcourt). High foot traffic, high consumption, brand benchmark area. Store Type: Flagship/Brand Image Store. Decoration Standard: Brand's highest specifications, full standardized SI (Store Identity). Complete configuration of image walls, premium lighting, customer flow, and experience zones. Materials are durable with a premium brand texture. Core display areas are highly refined, while non-core areas have simplified craftsmanship to control over-design. The surrounding environment is a national commercial/political/transportation hub, upscale and modern.";
    doorType = "Premium clear glass doors with sleek metal frames.";
  } else if (tier === "T3-T4") {
    tierDescription = "Location: T3-T4 Regional Cities in Nigeria (e.g., Enugu, Warri, Onitsha, Calabar, Uyo). Medium foot traffic, stable consumption. Store Type: Standard Store. Decoration Standard: Unified basic SI. Retains core brand recognition elements but with simplified experience zones, styling, and craftsmanship. Uses standardized, reusable display props (representing local manufacturing). The surrounding environment is a typical state capital or regional center commercial street, bustling and practical.";
    doorType = "Standard glass doors or clean roller shutters.";
  } else if (tier === "T5") {
    tierDescription = "Location: T5 and below Lower-tier Markets in Nigeria (e.g., counties, rural towns, remote market towns). Low foot traffic, price-sensitive. Store Type: Rural Simplified Store. Decoration Standard: Minimalist SI. Only retains basic brand logos. No complex architectural shapes. Basic, cost-effective treatments for walls, floors, and ceilings. Display props are extremely lightweight, basic, and locally sourced. The surrounding environment is a dense, dusty local market or rural street with yellow tricycles (Keke Napep) and local vendors, reflecting extreme cost reduction.";
    doorType = "Basic iron gates or rugged roller shutters.";
  }

  let angleDescription = "";
  switch (renderAngle) {
    case 'front_panorama':
      angleDescription = "CAMERA ANGLE: Front Panorama. Show the complete exterior facade, storefront sign, and the specific door type clearly. The overall brand image must be easily recognizable from the street.";
      break;
    case 'interior_perspective':
      angleDescription = "CAMERA ANGLE: Interior Full Perspective. Show the entire interior space, customer flow, product displays, and props comprehensively with no blind spots.";
      break;
    case 'detail_closeup':
      angleDescription = "CAMERA ANGLE: Detail Close-up. Focus tightly on specific architectural nodes like the storefront sign materials, craftsmanship, lighting fixtures, or material joints. High clarity on textures.";
      break;
    case 'exposed_ceiling':
      angleDescription = "CAMERA ANGLE: Exposed Ceiling Special View. Look upwards to clearly show the bare ceiling structure. NO suspended ceiling, NO sealing boards, NO complex shapes. Only basic pendant lights hanging from the raw structure.";
      break;
    case 'floor_special':
      angleDescription = "CAMERA ANGLE: Floor Special View. Look downwards to show the floor material unobstructed. Clearly distinguish whether it is laid with tiles (for higher tiers) or bare concrete (for lower tiers).";
      break;
  }

  const prompt = `A highly realistic, photorealistic architectural rendering of an 'itel Home' electronics store placed in a real-world Nigerian environment. 
  ${tierDescription}
  Door Type Requirement: ${doorType}
  ${angleDescription}
  ${environmentDetails ? `Specific environment details: ${environmentDetails}.` : ''}
  
  CRITICAL BRAND & INTERIOR DETAILS TO MAINTAIN:
  - Storefront: The storefront MUST have a prominent sign. ${logoImageBase64 ? "Use the provided logo image as a strict reference for the sign's design, colors, and typography." : "The sign should be red with the 'itel Home' logo in white text."}
  - Products Sold: Smartphones, Smart TVs, TWS earbuds, smartwatches, power banks, blenders, kettles, and stand fans.
  - Wall Cabinets (Left/Right): Light wood finish with white shelves. Top section features illuminated lightboxes with category names (e.g., TWS, Smart Watch, Home Appliances). Products are neatly hung on pegboards in uniform red and white packaging. Closed wooden storage cabinets at the bottom.
  - Experience Tables (Center): Sleek, modern, white island tables with rounded edges, some featuring red gradient accents. Phones and small gadgets are displayed on security stands.
  - General Interior: Clean white walls, grey tiled floor (or concrete for T5), bright recessed ceiling lights (unless exposed ceiling is requested). A prominent red speech-bubble 'itel' logo on the back wall behind a white checkout counter. Large promotional posters inside.
  
  MANDATORY REQUIREMENT: All renderings MUST strictly follow the Nigerian T1-T2 / T3-T4 / T5 city tier decoration rules. From flagship stores to rural simplified stores, the corresponding configurations, materials, and cost-reduction plans must be visually evident. Ensure the perspective is complete, details are highly clear, and the image is suitable for professional project review and business analysis.`;

  const parts: any[] = [{ text: prompt }];

  if (logoImageBase64) {
    const logoMatches = logoImageBase64.match(/^data:(.+);base64,(.*)$/);
    if (logoMatches && logoMatches.length === 3) {
      parts.push({ text: "\n\nCRITICAL: Use the following image as a strict visual reference for the store's logo and signage design:" });
      parts.push({
        inlineData: {
          mimeType: logoMatches[1],
          data: logoMatches[2],
        },
      });
    }
  }

  if (environmentImageBase64) {
    const envMatches = environmentImageBase64.match(/^data:(.+);base64,(.*)$/);
    if (envMatches && envMatches.length === 3) {
      parts.push({ text: "\n\nCRITICAL: Use the following image as a strict visual reference for the surrounding environment, street style, lighting, and atmosphere:" });
      parts.push({
        inlineData: {
          mimeType: envMatches[1],
          data: envMatches[2],
        },
      });
    }
  }

  if (referenceImageBase64) {
    // Extract mime type and base64 data
    const matches = referenceImageBase64.match(/^data:(.+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      parts.unshift({
        inlineData: {
          mimeType: matches[1],
          data: matches[2],
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("未生成图片");
}
