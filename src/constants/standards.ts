export interface TierStandard {
  tier: string;
  description: string;
  costBenchmark: string;
  materials: string[];
  visualRequirements: string[];
  lighting: string;
  flooring: string;
  ceiling: string;
  promptInjection: string;
}

export const ITEL_HOME_STANDARDS: Record<string, TierStandard> = {
  'L1': {
    tier: 'L1',
    description: '旗舰体验店 (Flagship Store): High-end Flagship in major cities. Scene-based display experience focus, large store area (> 100㎡). Premium materials and digital integration.',
    costBenchmark: 'High budget, scene-based premium materials.',
    materials: [
      'Aluminium Composite Panel (ACP) storefront',
      'Acrylic 3D luminous characters',
      'Customized premium scenario display modules',
      'Large-scale digital display walls'
    ],
    visualRequirements: [
      'Scene-based lifestyle display',
      'Spacious and luxurious feel (> 100㎡)',
      'Advanced digital operation visibility'
    ],
    lighting: 'Scene-specific accent lighting, smart LED strips, premium spotlights.',
    flooring: 'Large-format high-gloss tiles or custom seamless flooring.',
    ceiling: 'Custom multi-level suspended ceiling with specialized cove lighting.',
    promptInjection: "FLAGSHIP STORE (>100sqm): The store is a massive, high-end flagship located in a premium shopping district. The interior is designed around 'Life Scenarios' (Home, Office, Travel) with curated furniture sets and lifestyle props. MATERIALS: Use high-gloss large-format porcelain tiles (#F5F5F5), premium metal finishes (matte white or silver), and specialized itel Gradient Glass for experience tables. LIGHTING: Cinematic lighting with hidden LED halo strips behind wall-mounted branding and 6000K high-lumen track spotlights. Atmosphere is spacious, minimalist, and international flagship level."
  },
  'L3': {
    tier: 'L3',
    description: '标准店 (Standard Store): Standardized retail version for secondary centers. Brand shelves, islands, glowing logos, and red ACP signage.',
    costBenchmark: 'Standard competitive budget.',
    materials: [
      'Red Aluminium Composite Panel (ACP) signage',
      '3D Acrylic glowing logo (luminous characters)',
      'Brand-standardized shelves and display islands',
      'Modular display props'
    ],
    visualRequirements: [
      'Efficient 40-60sqm retail layout',
      'Professional and organized brand image',
      'Red ACP storefront is prominent'
    ],
    lighting: 'Standardized LED track spotlights and panel lights.',
    flooring: 'Standard 600x600 matte grey or white porcelain tiles.',
    ceiling: 'Simple flat gypsum ceiling or basic grid ceiling.',
    promptInjection: "STANDARD STORE (40-60sqm): The store is a professional retail outlet with an efficient modular layout. MATERIALS: Use red Aluminium Composite Panel (ACP) for the exterior signage with a 3D glowing itel Home logo. Interior features brand-specific display shelves and central islands. Standard matte grey porcelain tiles (600x600mm), white powder-coated steel display racks. LIGHTING: Bright, even illumination using a mix of 600x600mm LED panel lights and track spotlights. The atmosphere is professional, organized, and clean."
  },
  'L4': {
    tier: 'L4',
    description: '专区店 (Special Zone Store): Dedicated brand zones in Malls or KA (Key Accounts) stores.',
    costBenchmark: 'Small footprint, high brand density.',
    materials: [
      'Mall/KA zone display modules',
      'Backlit brand walls',
      'Standardized itel Red branding'
    ],
    visualRequirements: [
      'Compact Mall/KA zone layout',
      'High brand visibility within a larger retail space',
      'High-quality white brand wall with a red itel bubble logo'
    ],
    lighting: 'KA-specific accent spotlights.',
    flooring: 'Mall-standard flooring or dedicated brand carpets.',
    ceiling: 'Open structure or Mall-standard ceiling.',
    promptInjection: "SPECIAL ZONE STORE (Mall/KA): The store is a dedicated brand section within a larger Mall or KA (Key Account) shop. MATERIALS: itel backlit Brand Wall with white background and red bubble logo, standardized modular counters, Mall-grade flooring. LIGHTING: Focused accent spotlights on itel products. The atmosphere is that of a premium 'Shop-in-Shop' (SIS) with high brand density and visibility among other brands."
  },
  'L5': {
    tier: 'L5',
    description: '挂牌店 (Signage Store): Basic branding version. Vinyl/Flex banner logo and owner-supplied shelves.',
    costBenchmark: 'Minimal budget, owner-managed inventory.',
    materials: [
      'Vinyl/Flex banner signage (Inkjet)',
      'Owner-supplied local shelves',
      'Basic itel branding elements'
    ],
    visualRequirements: [
      'Basic logo visibility',
      'Local shop feel with brand signage',
      'Functional and approachable'
    ],
    lighting: 'Existing local fluorescent or basic LED tubes.',
    flooring: 'Existing local flooring.',
    ceiling: 'Existing structure.',
    promptInjection: "SIGNAGE STORE (Minimal): The store is a local shop rebranded with itel signage. MATERIALS: Large red Vinyl or Flex Banner signage with 'itel Home' inkjet printing on the facade. Interior uses the owner's existing local shelves and furniture. The lighting is basic local fluorescent tubes. The environment is an authentic local street setting, focusing on the brand signage as the primary identifier."
  }
};

export const BRAND_LOGO_GUIDELINE = {
  totalWidth: "3360mm",
  totalHeight: "900mm",
  itelPart: {
    width: "1415mm",
    height: "440mm",
    style: "White speech bubble containing solid Red \"itel\" text (the red matches the storefront background).",
    color: "Red text on White bubble"
  },
  homePart: {
    width: "1800mm",
    height: "360mm",
    style: "Solid White \"Home\" text with a HOLLOW 'o' (The center of the 'o' must be transparent/show background).",
    color: "Solid White"
  },
  context: "The signage has a vibrant Red background (Pantone 192C). The logo features a White bubble on the left with Red text inside, and solid White text for \"Home\" on the right. This creates a high-contrast, professional look."
};

export const MATERIAL_LIBRARY = {
  lighting: {
    spotlights: "6000K cool white high-lumen track spotlights, cylindrical housings.",
    ledStrips: "Hidden 4000K LED strips for halo effect.",
    panels: "Recessed 600x600mm LED flat panels."
  },
  finishes: {
    metal: "Brushed silver aluminum trim. Matte white powder-coated steel.",
    wood: "Light oak melamine grain.",
    glass: "Edge-polished tempered glass.",
    acrylic: "85% high-gloss white acrylic for logos."
  },
  flooring: {
    tiles: "600x600mm matte light-grey porcelain.",
    concrete: "Polished industrial-grey concrete."
  },
  walls: {
    brandWall: "Pure off-white or light grey matte backdrop with 3D backlit itel Home Logo.",
    generalWall: "Smooth off-white latex finish."
  },
  ceiling: {
    mainCeiling: "Minimalist flat white gypsum board ceiling with integrated track lighting slots.",
    accent: "Recessed red linear LED details in flagship stores."
  },
  signage: {
    fascia: "Single continuous horizontal band spanning the exterior.",
    logo: "Speech bubble with 45-degree tail + 'Home' text."
  },
  props: {
    experienceTable: "All-in-one EXPERIENCE TABLE with a premium MATTE LIGHT OAK WOOD-GRAIN TEXTURE (哑光浅色橡木纹理). The tabletop and body are in matte light oak wood color, with white metal support frames. Strictly no high-gloss or red lacquered finishes. The tabletop features an orderly COMBINATION DISPLAY of a smartphone, headphones, and a watch ecosystem prototypes.",
    experienceIsland: "Central modular display island (哑光浅色橡木中岛展台) with a premium MATTE LIGHT OAK WOOD-GRAIN TEXTURE, clean geometric lines, and a matte finish. Strictly no high-gloss red or white painted lacquer.",
    accessoryCabinet: "Wall-mounted modular showcases and shelving (哑光橡木色调标准展柜) crafted strictly with MATTE LIGHT OAK WOOD-GRAIN TEXTURE (哑光橡木纹理). The TOP of the cabinet features a clearly illuminated CATEGORY LIGHTBOX (品类发光灯箱画面) displaying brand graphics. The shelf levels show a TIDY DISPLAY of itel product packaging (整洁有序的包装陈列) and functional product samples below.",
    brandWall: "Central white minimalist background wall with a large 3D backlit itel red bubble logo.",
    storefront: "Fully transparent floor-to-ceiling glass storefront (全通透玻璃门头) providing a clear view from the street into the organized interior retail space."
  }
};
