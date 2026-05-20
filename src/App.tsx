import React, { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { BOMCalculator } from "./components/BOMCalculator";
import { KnowledgeBase } from "./components/KnowledgeBase";
import {
  Upload,
  Image as ImageIcon,
  Loader2,
  Download,
  AlertCircle,
  Store,
  X,
  LogIn,
  LogOut,
  User,
  ShieldCheck,
  Lock,
  ExternalLink,
  Check,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Brain,
  Maximize,
  Wind,
  Layers,
  Pipette,
  Camera,
  Zap,
  Grid,
  Box,
  Crosshair,
  HelpCircle,
  Sun,
  Cloud,
  CloudRain,
  Moon,
  Target,
  Monitor,
  MoveHorizontal,
  ChevronRight,
  ChevronLeft,
  AlignCenter,
  ArrowLeft,
  Wand2,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
  Palette,
  Eraser,
  Trash2,
} from "lucide-react";
import { Stage, Layer, Image as KImage, Rect, Line } from 'react-konva';
import useImage from 'use-image';
import {
  generateStoreRendering,
  analyzeRenderingStrategy,
  RenderingAnalysis,
  generateEnvironmentDescription,
  generateInpainting,
  analyzeStructure,
  analyzeMaterialReference,
} from "./services/geminiService";
import {
  auth,
  signInWithGoogle,
  logout,
  getUserProfile,
  createUserProfile,
  getDailyUsage,
  incrementDailyUsage,
  UserProfile,
  saveRenderToHistory,
  getUserHistory,
  getVerifiedExamples,
  verifyRender,
  RenderHistory,
  getSystemConfig,
  updateSystemConfig,
} from "./firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  History,
  CheckCircle,
  Star,
  Info,
  Languages,
  Brush,
  RefreshCw,
  Plus,
} from "lucide-react";
import { STORE_STRATEGIES } from "./constants/storeStrategies";
import { TRANSLATIONS, Language } from "./constants/translations";
import {
  ITEL_HOME_STANDARDS,
  BRAND_LOGO_GUIDELINE,
  MATERIAL_LIBRARY,
} from "./constants/standards";
import { compressImage, getBase64Size, createMaskFromVertices } from "./lib/imageUtils";
import { Toaster, toast } from "sonner";
import { InpaintEditor } from "./components/InpaintEditor";
import {
  ITEL_BUBBLE_SVG,
  ITEL_HOME_RED_ON_WHITE_SVG,
  ITEL_HOME_WHITE_ON_RED_SVG,
} from "./constants/logos";
import { ItelBubbleLogo, ItelHomeLogo } from "./components/Logo";
import { AnchorSelector } from "./components/AnchorSelector";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface Location {
  id: string;
  country: string;
  cities: string[];
  label: string;
}

export const LOCATIONS: Location[] = [
  {
    id: "nigeria",
    country: "Nigeria",
    cities: ["Lagos", "Abuja", "Enugu", "Warri", "Kano", "Ibadan"],
    label: "Nigeria",
  },
  {
    id: "kenya",
    country: "Kenya",
    cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"],
    label: "Kenya",
  },
  {
    id: "pakistan",
    country: "Pakistan",
    cities: ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi"],
    label: "Pakistan",
  },
  {
    id: "ghana",
    country: "Ghana",
    cities: ["Accra", "Kumasi", "Tamale", "Takoradi"],
    label: "Ghana",
  },
  {
    id: "ivory_coast",
    country: "Ivory Coast",
    cities: ["Abidjan", "Yamoussoukro", "Bouaké"],
    label: "Ivory Coast",
  },
  {
    id: "mali",
    country: "Mali",
    cities: ["Bamako", "Sikasso", "Mopti"],
    label: "Mali",
  },
  {
    id: "tanzania",
    country: "Tanzania",
    cities: ["Dar es Salaam", "Dodoma", "Mwanza", "Arusha"],
    label: "Tanzania",
  },
  {
    id: "angola",
    country: "Angola",
    cities: ["Luanda", "Huambo", "Lobito"],
    label: "Angola",
  },
  {
    id: "congo_brazzaville",
    country: "Congo (Brazzaville)",
    cities: ["Brazzaville", "Pointe-Noire"],
    label: "Congo (Brazzaville)",
  },
  {
    id: "congo_kinshasa",
    country: "Congo (Kinshasa)",
    cities: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi"],
    label: "Congo (Kinshasa)",
  },
  {
    id: "uganda",
    country: "Uganda",
    cities: ["Kampala", "Entebbe", "Jinja"],
    label: "Uganda",
  },
  {
    id: "cameroon",
    country: "Cameroon",
    cities: ["Douala", "Yaoundé", "Garoua"],
    label: "Cameroon",
  },
  {
    id: "burkina_faso",
    country: "Burkina Faso",
    cities: ["Ouagadougou", "Bobo-Dioulasso"],
    label: "Burkina Faso",
  },
  {
    id: "zimbabwe",
    country: "Zimbabwe",
    cities: ["Harare", "Bulawayo"],
    label: "Zimbabwe",
  },
  {
    id: "zambia",
    country: "Zambia",
    cities: ["Lusaka", "Kitwe", "Ndola"],
    label: "Zambia",
  },
  {
    id: "mozambique",
    country: "Mozambique",
    cities: ["Maputo", "Beira", "Nampula"],
    label: "Mozambique",
  },
  {
    id: "india",
    country: "India",
    cities: ["Delhi", "Mumbai", "Bangalore", "Kolkata"],
    label: "India",
  },
  {
    id: "uae",
    country: "UAE (Dubai)",
    cities: ["Dubai", "Abu Dhabi", "Sharjah"],
    label: "UAE (Dubai)",
  },
];

export default function App() {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [environmentImage, setEnvironmentImage] = useState<string | null>(null);
  const [environmentMask, setEnvironmentMask] = useState<string | null>(null);
  const [isSelectingEnvRegion, setIsSelectingEnvRegion] = useState(false);
  const [comparisonOffset, setComparisonOffset] = useState(50);
  const [isHoveringOutput, setIsHoveringOutput] = useState(false);
  const [internalSignageImage, setInternalSignageImage] = useState<
    string | null
  >(null);
  const [logoImage, setLogoImage] = useState<string | null>(() =>
    localStorage.getItem("itel_logo_image"),
  );
  const [logoStyle, setLogoStyle] = useState<"white-bg" | "red-bg" | "none">(
    () =>
      (localStorage.getItem("itel_logo_style") as
        | "white-bg"
        | "red-bg"
        | "none") || "red-bg",
  );
  const [interiorMaterialsImage, setInteriorMaterialsImage] = useState<
    string | null
  >(null);
  const [tier, setTier] = useState<string>(
    () => localStorage.getItem("itel_tier") || "L3",
  );
  const [renderAngle, setRenderAngle] = useState<string>(
    () => localStorage.getItem("itel_render_angle") || "front_panorama",
  );
  const [aspectRatio, setAspectRatio] = useState<string>(
    () => localStorage.getItem("itel_aspect_ratio") || "16:9",
  );
  const [imageSize, setImageSize] = useState<string>(
    () => localStorage.getItem("itel_image_size") || "1K",
  );
  const [location, setLocation] = useState<Location>(() => {
    const saved = localStorage.getItem("itel_location");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return LOCATIONS.find((l) => l.id === parsed.id) || LOCATIONS[0];
      } catch (e) {
        return LOCATIONS[0];
      }
    }
    return LOCATIONS[0];
  });
  const [selectedCity, setSelectedCity] = useState<string>(
    () => localStorage.getItem("itel_city") || LOCATIONS[0].cities[0],
  );
  const [storeArea, setStoreArea] = useState<number>(() => {
    const saved = localStorage.getItem("itel_store_area");
    return saved !== null ? Number(saved) : 10;
  });
  const [environmentDetails, setEnvironmentDetails] =
    useState<string>("道具物料样式参考记忆库");
  const [showEnvPresets, setShowEnvPresets] = useState(false);
  const [environmentMode, setEnvironmentMode] = useState<"clean" | "real">(
    () => (localStorage.getItem("itel_env_mode") as "clean" | "real") || "real",
  );
  const [selectedModel] = useState<string>("gemini-2.5-flash-image");
  const [outpaintSide, setOutpaintSide] = useState<"center" | "left" | "right">(
    "center",
  );
  const [lightingDirection, setLightingDirection] = useState<'left' | 'center' | 'right'>('center');
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem("itel_lang") as Language) || "zh",
  );
  const [weathering, setWeathering] = useState<number>(0);
  const [inpaintPrompt, setInpaintPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldAnalyze, setShouldAnalyze] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [renderingAnalysis, setRenderingAnalysis] =
    useState<RenderingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [history, setHistory] = useState<RenderHistory[]>([]);
  const [verifiedExamples, setVerifiedExamples] = useState<RenderHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentTab, setCurrentTab] = useState<"store" | "bom" | "brand_lab">(
    "store",
  );
  const [brandStandards, setBrandStandards] = useState<{
    itel_home_standards: any;
    brand_logo_guideline: any;
    material_library: any;
  } | null>(null);
  const [isGeneratingEnv, setIsGeneratingEnv] = useState(false);
  const [hasManuallyEditedEnv, setHasManuallyEditedEnv] = useState(false);
  const [r2Status, setR2Status] = useState<any>(null);

  useEffect(() => {
    fetch('/api/r2-status').then(r => r.json()).then(setR2Status).catch(console.error);
  }, []);
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const [showInpaintEditor, setShowInpaintEditor] = useState(false);
  const [isInpainting, setIsInpainting] = useState(false);
  const [isGeneratingHdId, setIsGeneratingHdId] = useState<string | null>(null);
  const [structuralAnalysis, setStructuralAnalysis] = useState<{
    signageVertices: { x: number; y: number }[];
    storefrontVertices: { x: number; y: number }[];
    tiltAngle: string;
    analysis: string;
    detectedStructure: string;
    vanishingPoints: string;
    lightSource: string;
  } | null>(null);
  const [isAnalyzingStructure, setIsAnalyzingStructure] = useState(false);
  const [materialReferenceImage, setMaterialReferenceImage] = useState<string | null>(null);
  const [materialAnalysis, setMaterialAnalysis] = useState<string | null>(null);
  const [isAnalyzingMaterial, setIsAnalyzingMaterial] = useState(false);
  const [isStructureConfirmed, setIsStructureConfirmed] = useState(false);
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3>(1);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isSelectingAnchors, setIsSelectingAnchors] = useState(false);
  const [renderMode, setRenderMode] = useState<'signage' | 'full'>('full');
  const [tempAnchors, setTempAnchors] = useState<{ x: number; y: number }[]>(
    [],
  );
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<'none' | 'brush' | 'eraser' | 'marquee' | 'wand'>('none');
  const [brushSize, setBrushSize] = useState(40);
  const [lines, setLines] = useState<any[]>([]);
  const [rects, setRects] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 675 });

  useEffect(() => {
    if (stageContainerRef.current) {
      const { clientWidth } = stageContainerRef.current;
      setStageSize({ width: clientWidth, height: clientWidth * (9 / 16) });
    }
    
    const handleResize = () => {
      if (stageContainerRef.current) {
        const { clientWidth } = stageContainerRef.current;
        setStageSize({ width: clientWidth, height: clientWidth * (9 / 16) });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [workflowStep]);

  const [environmentKImage] = useImage(environmentImage || '');

  const undoLastAction = () => {
    if (activeTool === 'brush') {
      setLines(prev => prev.slice(0, -1));
    } else if (activeTool === 'marquee') {
      setRects(prev => prev.slice(0, -1));
    }
  };

  const clearCanvas = () => {
    setLines([]);
    setRects([]);
  };

  const handleMouseDown = (e: any) => {
    if (activeTool === 'none') return;
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      setLines([...lines, { 
        tool: activeTool, 
        points: [pos.x / (canvasZoom * (stageSize.width / 1200)), pos.y / (canvasZoom * (stageSize.height / 675))], 
        size: brushSize 
      }]);
    } else if (activeTool === 'marquee') {
      setRects([...rects, { x: pos.x / canvasZoom, y: pos.y / canvasZoom, width: 0, height: 0 }]);
    } else if (activeTool === 'wand') {
      // Smart Wand: If we have structural analysis, auto-select the signage area
      if (structuralAnalysis?.signageVertices) {
        // Convert normalized vertices to pixel coordinates for our 1200x675 stage
        const linePoints = structuralAnalysis.signageVertices.reduce((acc: number[], v) => {
          acc.push(v.x * 1200, v.y * 675);
          return acc;
        }, []);
        // Close the loop
        linePoints.push(structuralAnalysis.signageVertices[0].x * 1200, structuralAnalysis.signageVertices[0].y * 675);
        
        setLines([...lines, { tool: 'brush', points: linePoints, size: 5 }]);
        toast.success(language === 'zh' ? "智能魔棒：已自动识别门头区域" : "Smart Wand: Signage area identified");
      } else {
        // Fallback or loading
        toast.info(language === 'zh' ? "正在识别结构，请稍后..." : "Identifying structure, please wait...");
      }
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || activeTool === 'none') return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      let lastLine = lines[lines.length - 1];
      if (lastLine) {
        lastLine.points = lastLine.points.concat([point.x / (canvasZoom * (stageSize.width / 1200)), point.y / (canvasZoom * (stageSize.height / 675))]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines(lines.concat());
      }
    } else if (activeTool === 'marquee') {
      let lastRect = rects[rects.length - 1];
      if (lastRect) {
        lastRect.width = (point.x / canvasZoom) - lastRect.x;
        lastRect.height = (point.y / canvasZoom) - lastRect.y;
        rects.splice(rects.length - 1, 1, lastRect);
        setRects(rects.concat());
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const processMaskAndProceed = () => {
    if (!stageRef.current) {
      setWorkflowStep(3);
      return;
    }

    // We only want to export the MASK layer
    const exportStage = stageRef.current;
    const layers = exportStage.getChildren();
    
    // Hide background layer (assuming it's the first child)
    if (layers[0]) layers[0].hide();
    
    // Set stage background to black for export
    const oldBg = exportStage.container().style.backgroundColor;
    exportStage.container().style.backgroundColor = 'black';
    
    // Make sure our drawings are white for the mask
    // (This is a simplified hack, better would be a dedicated mask layer)
    
    const dataURL = exportStage.toDataURL({ 
      pixelRatio: 2,
      mimeType: 'image/png'
    });
    
    // Restore
    if (layers[0]) layers[0].show();
    exportStage.container().style.backgroundColor = oldBg;
    
    setEnvironmentMask(dataURL);
    setWorkflowStep(3);
  };

  // Auto-generate environment description when location or tier changes
  useEffect(() => {
    if (!selectedCity || hasManuallyEditedEnv) return;

    const generateEnv = async () => {
      setIsGeneratingEnv(true);
      try {
        const desc = await generateEnvironmentDescription(
          selectedCity,
          location.label,
          tier,
          environmentImage || undefined,
        );
        const defaultPrompt =
          language === "zh"
            ? "道具物料样式参考记忆库"
            : "Prop material style reference memory library";
        setEnvironmentDetails(`${defaultPrompt}\n\n${desc}`);
      } catch (error) {
        console.error("Failed to generate environment description:", error);
        setEnvironmentDetails(
          language === "zh"
            ? "由于 AI 引擎繁忙，自动生成失败。您可以手动输入描述，或稍后切换方案重试。"
            : "Auto-generation failed due to high AI demand. You can enter details manually or try again later.",
        );
      } finally {
        setIsGeneratingEnv(false);
      }
    };

    const timer = setTimeout(generateEnv, 500); // Debounce
    return () => clearTimeout(timer);
  }, [selectedCity, location.label, tier, hasManuallyEditedEnv]);

  // Handle manual edit
  const handleEnvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEnvironmentDetails(e.target.value);
    setHasManuallyEditedEnv(true);
  };

  const handleInpaintSave = async (
    maskBase64: string,
    inpaintPrompt: string,
  ) => {
    if (!generatedImage) return;

    setShowInpaintEditor(false);
    setIsGenerating(true);
    setIsInpainting(true);
    setError(null);
    setShowHistory(false);

    try {
      const result = await generateInpainting(
        generatedImage,
        maskBase64,
        inpaintPrompt,
        {
          aspectRatio: aspectRatio,
          imageSize,
          model: selectedModel,
          tier: tier,
          logoStyle: logoStyle,
          verifiedExamples: (verifiedExamples as any[]).map(ex => ({
            imageUrl: ex.imageUrl,
            label: ex.label || 'itel Home Standard',
            renderAngle: ex.renderAngle,
            sampleType: ex.sampleType
          })),
          customStandards: brandStandards || undefined,
          weathering: weathering,
        },
      );

      setGeneratedImage(result.imageUrl);
      setGeneratedPrompt(result.prompt);

      // Save result to history
      if (user) {
        try {
          await saveRenderToHistory({
            userId: user.uid,
            imageUrl: result.imageUrl,
            prompt: result.prompt,
            tier: tier,
            location: location.country,
            city: selectedCity,
          });

          if (!isAdmin) {
            await incrementDailyUsage(user.uid);
            const newCount = await getDailyUsage(user.uid);
            setUsageCount(newCount);
          }
          await refreshHistory();
        } catch (historyErr) {
          console.error(
            "Failed to save inpainted image to history:",
            historyErr,
          );
        }
      } else if (isGuest) {
        try {
          const res = await fetch("/api/guest/increment", { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            setGuestUsage(data);
          }
        } catch (guestErr) {
          console.error(
            "Failed to increment guest usage for inpainting:",
            guestErr,
          );
        }
      }

      toast.success(
        language === "zh" ? "局部重绘成功！" : "Partial re-render successful!",
      );
    } catch (err: any) {
      console.error("Inpainting Error:", err);
      setError(
        language === "zh"
          ? `局部重绘失败: ${err.message}`
          : `Inpainting failed: ${err.message}`,
      );
      toast.error(language === "zh" ? "局部重绘失败" : "Inpainting failed");
    } finally {
      setIsGenerating(false);
      setIsInpainting(false);
    }
  };

  const [isGuest, setIsGuest] = useState(false);
  const [guestUsage, setGuestUsage] = useState({ count: 0, limit: 3 });
  const [isR2Configured, setIsR2Configured] = useState(false);
  const MAX_DAILY_LIMIT = 15;

  // Improved AI Studio platform API detection
  const getAiApi = () => {
    try {
      // Check current window, parent (if in iframe), top window, and opener
      const api =
        (window as any).aistudio ||
        (window.parent as any).aistudio ||
        (window.top as any).aistudio ||
        (window.opener as any)?.aistudio;
      if (api) return api;
    } catch (e) {
      // Cross-origin errors might occur when checking parent/top
    }
    return null;
  };

  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 10;

    const checkKey = async () => {
      const aiApi = getAiApi();
      if (aiApi?.hasSelectedApiKey) {
        try {
          const hasKey = await aiApi.hasSelectedApiKey();
          setHasApiKey(hasKey);
          if (hasKey) return true;
        } catch (e) {
          console.error("Error checking API key status:", e);
        }
      }
      return false;
    };

    // Initial check
    checkKey();

    // Poll a few times in case the API is injected asynchronously
    const interval = setInterval(async () => {
      checkCount++;
      const found = await checkKey();
      if (found || checkCount >= maxChecks) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTab]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          // If server has a key, we consider it activated
          if (data.hasGeminiKey) {
            setHasApiKey(true);
            if (data.apiKey) {
              (window as any).serverApiKey = data.apiKey;
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch config:", e);
      }
    };
    fetchConfig();

    const fetchR2Status = async () => {
      try {
        const res = await fetch("/api/r2-status");
        if (res.ok) {
          const data = await res.json();
          setIsR2Configured(data.configured);
        }
      } catch (e) {
        console.error("Failed to fetch R2 status:", e);
      }
    };
    fetchR2Status();

    const fetchStandards = async () => {
      try {
        const standards = await getSystemConfig("brand_standards");
        if (standards) {
          setBrandStandards(standards);
        } else {
          setBrandStandards({
            itel_home_standards: ITEL_HOME_STANDARDS,
            brand_logo_guideline: BRAND_LOGO_GUIDELINE,
            material_library: MATERIAL_LIBRARY,
          });
        }
      } catch (e) {
        console.error("Failed to fetch brand standards:", e);
      }
    };
    fetchStandards();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false); // Clear guest mode when logged in
        try {
          // Individual error handling for each fetch to prevent one failure from blocking others
          getDailyUsage(currentUser.uid).then(setUsageCount).catch(console.error);
          getUserHistory(currentUser.uid).then(setHistory).catch(console.error);
          getVerifiedExamples().then(setVerifiedExamples).catch(console.error);

          const profile = await createUserProfile(currentUser);
          setUserProfile(profile);
          console.log("User logged in:", currentUser.email);
        } catch (err: any) {
          console.error("Auth data catch error:", err);
        }
      } else {
        setUserProfile(null);
        setUsageCount(0);
        setHistory([]);
        setIsGuest(true); // Default to guest mode if not logged in
        // Still fetch verified examples for guests to ensure rendering quality
        getVerifiedExamples()
          .then(setVerifiedExamples)
          .catch((err) => {
            console.error("Guest examples fetch error:", err);
          });
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [language, currentTab]);

  useEffect(() => {
    localStorage.setItem("itel_tier", tier);
  }, [tier]);

  useEffect(() => {
    localStorage.setItem("itel_location", JSON.stringify(location));
  }, [location]);

  useEffect(() => {
    localStorage.setItem("itel_city", selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    localStorage.setItem("itel_lang", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("itel_logo_style", logoStyle);
  }, [logoStyle]);

  useEffect(() => {
    if (logoImage) {
      // Only persist if size is reasonable for localStorage (~1MB total limit)
      if (logoImage.length < 500000) {
        localStorage.setItem("itel_logo_image", logoImage);
      }
    } else {
      localStorage.removeItem("itel_logo_image");
    }
  }, [logoImage]);

  useEffect(() => {
    localStorage.setItem("itel_render_angle", renderAngle);
  }, [renderAngle]);

  useEffect(() => {
    localStorage.setItem("itel_aspect_ratio", aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    localStorage.setItem("itel_image_size", imageSize);
  }, [imageSize]);

  useEffect(() => {
    localStorage.setItem("itel_env_mode", environmentMode);
  }, [environmentMode]);

  useEffect(() => {
    localStorage.setItem("itel_store_area", storeArea.toString());
  }, [storeArea]);

  const isAdmin = userProfile?.role === "admin";
  const hasReachedLimit = isGuest
    ? guestUsage.count >= guestUsage.limit
    : !isAdmin && usageCount >= MAX_DAILY_LIMIT;

  // Fetch guest usage on mount or when entering guest mode
  useEffect(() => {
    if (isGuest) {
      fetch("/api/guest/usage")
        .then((res) => res.json())
        .then((data) => setGuestUsage(data))
        .catch((err) => console.error("Error fetching guest usage:", err));
    }
  }, [isGuest]);

  // Debug log for admin status
  useEffect(() => {
    if (userProfile) {
      console.log(
        "User Profile Loaded:",
        userProfile.email,
        "Role:",
        userProfile.role,
        "isAdmin:",
        isAdmin,
      );
    }
  }, [userProfile, isAdmin]);

  const refreshHistory = async () => {
    if (user) {
      const userHistory = await getUserHistory(user.uid);
      setHistory(userHistory);
    }
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      if (result) {
        setIsGuest(false);
        toast.success(
          language === "zh" ? "登录成功！" : "Signed in successfully!",
        );
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      let errorMessage = language === "zh" ? "登录失败" : "Login failed";

      if (err.code === "auth/popup-blocked") {
        errorMessage =
          language === "zh"
            ? "登录窗口被浏览器拦截，请允许弹出窗口。"
            : "Login popup was blocked by your browser. Please allow popups.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMessage =
          language === "zh"
            ? "当前域名未在 Firebase 控制台授权。请在 Firebase 控制台的 Authentication -> Settings -> Authorized domains 中添加当前域名。"
            : "This domain is not authorized in the Firebase Console. Please add it to Authorized Domains in Authentication -> Settings.";
      } else if (err.code === "auth/cancelled-popup-request") {
        errorMessage =
          language === "zh" ? "登录已取消。" : "Login was cancelled.";
      } else {
        // Show the specific error code and message to help debugging
        const detail =
          err.code ||
          err.message ||
          (language === "zh" ? "未知错误" : "Unknown error");
        errorMessage = `${errorMessage}: ${detail}`;
      }

      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  };

  const handleVerify = async (
    renderId: string,
    label: string,
    renderAngle?: string,
  ) => {
    if (!isAdmin && !isGuest) {
      toast.error(
        language === "zh"
          ? "权限不足，只有管理员或游客模式可以设置标准样本。"
          : "Insufficient permissions, only admins or guest mode can set standard samples.",
      );
      return;
    }
    const toastId = toast.loading(
      language === "zh"
        ? "正在将该渲染图设为标准样本..."
        : "Setting this render as standard sample...",
    );
    try {
      await verifyRender(renderId, label, renderAngle);
      await refreshHistory();
      // Refresh verified examples
      const examples = await getVerifiedExamples();
      setVerifiedExamples(examples);
      toast.success(language === "zh" ? "设置成功！" : "Set successfully!", {
        id: toastId,
        description:
          language === "zh"
            ? `已将该图标记为 "${label}" 并加入学习库。`
            : `"${label}" has been added to the AI library.`,
      });
    } catch (err) {
      console.error("Verify Error:", err);
      toast.error(
        language === "zh"
          ? "设置失败，请重试。"
          : "Failed to set, please try again.",
        {
          id: toastId,
        },
      );
    }
  };

  const handleUploadStandardSample = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!isAdmin && !isGuest) return;
    if (!user && !isGuest) return;

    const aiApi = getAiApi();
    if (aiApi?.hasSelectedApiKey) {
      const hasKey = await aiApi.hasSelectedApiKey();
      if (!hasKey) {
        if (aiApi.openSelectKey) {
          await aiApi.openSelectKey();
          setHasApiKey(true);
        }
        return;
      }
    }

    const files = Array.from(e.target.files || []).slice(0, 50);
    if (files.length === 0) return;

    setIsUploadingSample(true);
    const uploadId = toast.loading(
      language === "zh"
        ? `正在批量上传标准样本 (${files.length}张)...`
        : `Batch uploading standard samples (${files.length} images)...`,
      {
        description:
          language === "zh"
            ? "系统正在压缩并保存图片到学习库"
            : "Compressing and saving images to library",
      },
    );

    let successCount = 0;
    let failCount = 0;

    for (const [index, file] of (files as File[]).entries()) {
      try {
        const fileName = file.name.split('.')[0];
        // Parse metadata from filename if it follows the rule: [Tier]_[Angle]_[Desc]
        const parts = fileName.split('_');
        let autoTier = "Manual";
        let autoAngle = renderAngle;
        let autoLabel = fileName.replace(/_/g, ' ');

        if (parts.length >= 2) {
          if (['L1', 'L3', 'L4', 'L5'].includes(parts[0].toUpperCase())) {
            autoTier = parts[0].toUpperCase();
          }
        }

        // Determine if it's a photo or render based on keywords or user prompt (defaulting per batch for simplicity)
        const isPhoto = fileName.toLowerCase().includes('photo') || fileName.toLowerCase().includes('live');
        const sampleType: "render" | "photo" = isPhoto ? "photo" : "render";

        const reader = new FileReader();
        const uploadPromise = new Promise<void>((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              let result = reader.result;
              if (typeof result !== 'string') {
                reject(new Error("File result is not a string"));
                return;
              }
              let imageUrl: string = result;
              if (getBase64Size(imageUrl) > 800000) {
                imageUrl = await compressImage(imageUrl, 1200, 0.6);
              }

              const currentUserId = user?.uid || "guest";
              await saveRenderToHistory({
                userId: currentUserId,
                imageUrl,
                prompt: language === "zh" ? "批量上传的标准参考样本" : "Batch uploaded standard reference sample",
                tier: autoTier,
                location: "Global Standard",
                city: "Global",
                renderAngle: autoAngle,
                isVerified: true,
                label: autoLabel,
                sampleType: sampleType,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("File reading failed"));
          reader.readAsDataURL(file);
        });

        await uploadPromise;
        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to upload ${file.name}:`, errorMsg);
        failCount++;
      }
    }

    await refreshHistory();
    const examples = await getVerifiedExamples();
    setVerifiedExamples(examples);

    if (failCount === 0) {
      toast.success(
        language === "zh"
          ? `成功上传 ${successCount} 张标准样本！`
          : `Successfully uploaded ${successCount} standard samples!`,
        { id: uploadId }
      );
    } else {
      toast.info(
        language === "zh"
          ? `完成: ${successCount} 成功, ${failCount} 失败。`
          : `Completed: ${successCount} success, ${failCount} failed.`,
        { id: uploadId }
      );
    }

    setIsUploadingSample(false);
    e.target.value = "";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setReferenceImage(compressed);
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error(language === "zh" ? "图片上传失败" : "Image upload failed");
      }
    }
  };

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsAnalyzingMaterial(true);
        const compressed = await compressImage(file);
        
        // 1. Analyze for AI purposes
        const analysis = await analyzeMaterialReference(compressed);
        setMaterialAnalysis(analysis);
        
        // 2. Save to Database (and R2 via firebase.ts helper)
        // Mark as verified so it shows up in the "Standard Library"
        toast.promise(
          saveRenderToHistory({
            userId: user?.uid || 'guest',
            imageUrl: compressed,
            prompt: `Uploaded Material Reference: ${analysis.substring(0, 50)}...`,
            tier: tier || 'L3',
            location: location?.country || 'Global',
            isVerified: true,
            label: language === "zh" ? "用户上传材质" : "User Uploaded Material",
            sampleType: 'photo'
          }).then(async (renderId) => {
            // Get the actual URL (which might be R2 now)
            const history = await getUserHistory(user?.uid || 'guest', 1);
            if (history && history.length > 0) {
              setMaterialReferenceImage(history[0].imageUrl);
            } else {
              setMaterialReferenceImage(compressed);
            }
            // Refresh verified examples list
            const examples = await getVerifiedExamples();
            setVerifiedExamples(examples);
            return renderId;
          }),
          {
            loading: language === "zh" ? "正在同步到标准库..." : "Syncing to library...",
            success: language === "zh" ? "物料同步成功" : "Material synced to library",
            error: language === "zh" ? "同步失败" : "Sync failed"
          }
        );

      } catch (err) {
        console.error("Material upload error:", err);
        toast.error(language === "zh" ? "解析失败" : "Failed to analyze material");
        setMaterialReferenceImage(null);
        setMaterialAnalysis(null);
      } finally {
        setIsAnalyzingMaterial(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(
          language === "zh" ? "已复制到剪贴板" : "Copied to clipboard",
        );
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error(language === "zh" ? "复制失败" : "Failed to copy");
      });
  };

  const handleEnvImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setEnvironmentImage(compressed);
        setEnvironmentMask(null); // Clear mask when new image uploaded

        // New: Trigger Structural Echo analysis
        setIsAnalyzingStructure(true);
        setStructuralAnalysis(null);
        setIsStructureConfirmed(false);
        try {
          const analysis = await analyzeStructure(compressed);
          setStructuralAnalysis(analysis);
        } catch (err) {
          console.error("Structural Analysis failed:", err);
          toast.error(
            language === "zh"
              ? "环境结构自动解析失败，已启用手动锚点模式"
              : "Auto-analysis failed, manual anchor mode enabled.",
          );
          setStructuralAnalysis({
            signageVertices: [
              { x: 0.1, y: 0.2 },
              { x: 0.9, y: 0.2 },
              { x: 0.9, y: 0.4 },
              { x: 0.1, y: 0.4 },
            ],
            storefrontVertices: [
              { x: 0.1, y: 0.4 },
              { x: 0.9, y: 0.4 },
              { x: 0.9, y: 0.9 },
              { x: 0.1, y: 0.9 },
            ],
            tiltAngle: "0°",
            analysis: "Manual override required due to API error",
            detectedStructure: "Fallback",
            vanishingPoints: "Center",
            lightSource: "Ambient",
          });
        } finally {
          setIsAnalyzingStructure(false);
        }
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error(language === "zh" ? "图片上传失败" : "Image upload failed");
      }
    }
  };

  const handleInternalSignageImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setInternalSignageImage(compressed);
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error(language === "zh" ? "图片上传失败" : "Image upload failed");
      }
    }
  };

  const handleInteriorMaterialsImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setInteriorMaterialsImage(compressed);
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error(language === "zh" ? "图片上传失败" : "Image upload failed");
      }
    }
  };

  const handleLogoImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setLogoImage(compressed);
      } catch (err) {
        console.error("Image upload error:", err);
        toast.error(language === "zh" ? "图片上传失败" : "Image upload failed");
      }
    }
  };

  const removeEnvImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEnvironmentImage(null);
  };

  const removeInternalSignageImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalSignageImage(null);
  };

  const removeInteriorMaterialsImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInteriorMaterialsImage(null);
  };

  const removeLogoImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLogoImage(null);
  };

  const handleOpenKeySelect = async () => {
    // If we already have a key (e.g. from server-side env), just show success
    if (hasApiKey) {
      const aiApi = getAiApi();
      if (aiApi?.openSelectKey) {
        // If the platform API is available, allow re-selection
        try {
          toast.loading(
            language === "zh"
              ? "正在打开配置界面..."
              : "Opening configuration UI...",
            { id: "key-select" },
          );
          await aiApi.openSelectKey();
          setHasApiKey(true);
          toast.success(
            language === "zh" ? "配置界面已请求" : "Configuration UI requested",
            { id: "key-select" },
          );
        } catch (e) {
          console.error("Failed to open key selector", e);
        }
      } else {
        toast.success(
          language === "zh"
            ? "AI 引擎已通过环境变量激活。"
            : "AI Engine is already activated via environment variables.",
          { duration: 5000 },
        );
      }
      return;
    }

    // Try multiple places for the platform API (window, parent, top)
    const aiApi = getAiApi();

    if (aiApi?.openSelectKey) {
      try {
        toast.loading(
          language === "zh"
            ? "正在打开配置界面..."
            : "Opening configuration UI...",
          { id: "key-select" },
        );
        await aiApi.openSelectKey();

        // Guidelines: Assume success and proceed
        setHasApiKey(true);
        toast.success(
          language === "zh" ? "配置界面已请求" : "Configuration UI requested",
          { id: "key-select" },
        );

        // Re-check after a short delay to sync state
        setTimeout(async () => {
          if (aiApi.hasSelectedApiKey) {
            const hasKey = await aiApi.hasSelectedApiKey();
            setHasApiKey(hasKey);
          }
        }, 3000);
      } catch (e) {
        console.error("Failed to open key selector", e);
        toast.error(
          language === "zh"
            ? "无法打开配置界面"
            : "Failed to open configuration UI",
          { id: "key-select" },
        );
      }
    } else {
      console.warn("AI Studio platform API (openSelectKey) not found");

      // Check if we are in a shared/deployed URL
      const isShared = window.location.hostname.includes("-pre-");
      const isDirect = window.self === window.top; // Not in an iframe

      let errorMsg = "";
      if (language === "zh") {
        if (isShared) {
          errorMsg =
            "在“分享预览”模式下无法直接选择 Key。请在 AI Studio 编辑器中运行应用，或在设置中配置环境变量。";
        } else if (isDirect) {
          errorMsg =
            "检测到您直接在浏览器标签页打开。请返回 AI Studio 预览窗口操作，以确保平台 API 正常注入。";
        } else {
          errorMsg =
            "无法检测到 AI Studio 平台接口。请尝试刷新页面，或检查浏览器是否拦截了脚本。";
        }

        if (isAdmin) {
          errorMsg +=
            " (管理员提示：您也可以在 AI Studio Settings -> Environment Variables 中手动设置 API_KEY)";
        }
      } else {
        errorMsg = isShared
          ? "Key selection is not available in Shared Preview. Please use the AI Studio editor."
          : "Platform API not detected. Please refresh or use the AI Studio preview window.";
      }

      toast.error(errorMsg, { duration: 8000 });
    }
  };

  const [draggingAnchorIndex, setDraggingAnchorIndex] = useState<number | null>(
    null,
  );
  const [draggingAnchorType, setDraggingAnchorType] = useState<"signage" | "storefront" | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getPolygonArea = (vertices: { x: number; y: number }[]) => {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      let j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return Math.abs(area / 2);
  };

  const handleAnchorDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (
      draggingAnchorIndex === null ||
      draggingAnchorType === null ||
      !canvasRef.current ||
      !structuralAnalysis
    )
      return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const verticesKey = draggingAnchorType === "signage" ? "signageVertices" : "storefrontVertices";
    const currentVertices = structuralAnalysis[verticesKey];
    if (!currentVertices) return;

    const newVertices = [...currentVertices];
    newVertices[draggingAnchorIndex] = { x, y };

    if (isStructureConfirmed) {
      setIsStructureConfirmed(false);
    }

    setStructuralAnalysis({
      ...structuralAnalysis,
      [verticesKey]: newVertices as [
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
        { x: number; y: number },
      ],
    });
  };

  const handleGenerate = async () => {
    if (!user && !isGuest) {
      setError(
        language === "zh"
          ? "请先登录或以游客身份使用渲染功能。"
          : "Please sign in or use guest mode to use the rendering feature.",
      );
      return;
    }

    if (hasReachedLimit) {
      const limit = isGuest ? guestUsage.limit : MAX_DAILY_LIMIT;
      const message = language === "zh"
          ? (isGuest 
              ? `访客模式生成次数已达上限（${limit}次）。请登录帐号以继续使用。`
              : `您今天的生成次数已达上限（${limit}次）。如需更多权限，请联系总部设计提供协助。`)
          : (isGuest
              ? `Guest generation limit reached (${limit}). Please sign in to continue using the service.`
              : `You have reached your daily generation limit (${limit}). For more permissions, please contact HQ Design.`);
      setError(message);
      return;
    }

    // Check for API Key selection (Mandatory for high-quality models)
    const aiApi = getAiApi();
    if (aiApi?.hasSelectedApiKey) {
      const hasKey = await aiApi.hasSelectedApiKey();
      if (!hasKey) {
        if (aiApi.openSelectKey) {
          await aiApi.openSelectKey();
          setHasApiKey(true);
        }
        // We don't return here, we proceed assuming selection was successful as per guidelines
      }
    }

    setIsGenerating(true);
    setError(null);
    const toastId = toast.loading(
      language === "zh"
        ? "正在生成实景渲染图..."
        : "Generating store rendering...",
      {
        description:
          language === "zh"
            ? "AI 正在根据您的配置渲染环境细节"
            : "AI is rendering environment details based on your config",
      },
    );

    // Calculate environmental context based on tier and mode
    let environmentalContext = "";
    if (environmentMode === "clean") {
      environmentalContext =
        "The surrounding environment MUST be pure white or heavily blurred. Focus exclusively on the store architectural design. No street details, no pedestrians, no neighboring buildings.";
    } else {
      // Real Context mode
      if (tier === "L5") {
        environmentalContext = `The store is located in a rural market setting in ${selectedCity}, ${location.country}. The exterior environment MUST show red dusty roads, rusty corrugated roofs on neighboring buildings, and tangled overhead wires. Ensure the itel Home store looks like a bright, clean oasis amidst a rugged, unpaved street environment.`;
      } else if (tier === "L3" || tier === "L4") {
        environmentalContext = `The store is located in a typical urban street, local market, or modern mall area in ${selectedCity}, ${location.country}. The environment should show moderate street activity or shopping center context, local shops nearby, and standard urban infrastructure. The itel Home brand should stand out as a modern, well-maintained retail space.`;
      } else {
        // L1
        environmentalContext = `The store is located in a premium, high-traffic commercial district or a modern shopping mall area in ${selectedCity}, ${location.country}. The surrounding environment should be clean, well-paved, with modern buildings and high-end retail neighbors.`;
      }

      // Add Lens View / FOV context based on storeArea slider
      if (storeArea > 100) {
        environmentalContext +=
          " Cinematic wide shot showing surrounding street context, capturing the broader urban setting and neighborhood atmosphere.";
      } else if (storeArea < 30) {
        environmentalContext +=
          " Close-up facade shot focusing on material textures, small architectural details, and high-precision finishing.";
      } else {
        environmentalContext +=
          " Standard eye-level shot capturing a balanced view of the store and immediate storefront area.";
      }
    }

    try {
      // Convert selected logo style to JPEG data URL for AI engine (MIME compatibility)
      let finalLogoBase64 = logoImage || undefined;

      if (!finalLogoBase64 && logoStyle !== "none") {
        try {
          // If it's an interior view, use only the bubble logo as the reference
          const isInterior = [
            "interior_perspective",
            "indoor_zone",
            "detail_closeup",
          ].includes(renderAngle);

          const svgString = isInterior
            ? ITEL_BUBBLE_SVG
            : logoStyle === "white-bg"
              ? ITEL_HOME_RED_ON_WHITE_SVG
              : ITEL_HOME_WHITE_ON_RED_SVG;

          // Use compressImage to convert SVG to JPEG as AI models don't support image/svg+xml
          const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
          finalLogoBase64 = await compressImage(svgDataUrl, 800, 0.9);
        } catch (error) {
          console.error("Error converting SVG logo to JPEG:", error);
        }
      }

      let activeMaskBase64 = environmentMask || undefined;
      if (!activeMaskBase64 && environmentImage && structuralAnalysis && structuralAnalysis.signageVertices && structuralAnalysis.storefrontVertices) {
        try {
          activeMaskBase64 = await createMaskFromVertices(
            environmentImage,
            structuralAnalysis.signageVertices,
            renderMode === 'signage' ? null : structuralAnalysis.storefrontVertices
          );
        } catch (e) {
          console.error("Failed to generate semantic mask from vertices:", e);
        }
      }

      const { imageUrl, prompt } = await generateStoreRendering(
        tier,
        renderAngle,
        aspectRatio,
        imageSize,
        environmentDetails,
        undefined,
        referenceImage || undefined,
        environmentImage || undefined,
        finalLogoBase64,
        location,
        selectedCity,
        storeArea,
        (() => {
          let list = [...verifiedExamples];
          const selectedIdx = list.findIndex(ex => ex.imageUrl === materialReferenceImage);
          if (selectedIdx > -1) {
            const selectedItem = list[selectedIdx];
            const remaining = list.filter((_, idx) => idx !== selectedIdx).sort(() => Math.random() - 0.5);
            list = [selectedItem, ...remaining];
          } else {
            list = list.sort(() => Math.random() - 0.5);
          }
          return list.slice(0, 3).map((ex) => ({
            imageUrl: ex.imageUrl,
            label: ex.label || "",
            renderAngle: ex.renderAngle,
          }));
        })(),
        internalSignageImage || undefined,
        materialReferenceImage || undefined,
        logoStyle,
        selectedModel,
        "sunny",
        "day",
        weathering,
        activeMaskBase64,
        renderMode,
        structuralAnalysis,
        brandStandards || undefined,
        isDemoMode,
        outpaintSide,
        materialAnalysis || undefined
      );
      setGeneratedImage(imageUrl);
      setGeneratedPrompt(prompt);

      // Analyze the strategy ONLY if enabled (saves API costs)
      if (shouldAnalyze) {
        try {
          const analysis = await analyzeRenderingStrategy(
            imageUrl,
            tier,
            location,
            selectedCity,
            language,
          );
          setRenderingAnalysis(analysis);
        } catch (e) {
          console.error("Analysis failed", e);
        }
      } else {
        setRenderingAnalysis(null);
      }

      // Only save to history and update usage if logged in
      if (user) {
        try {
          // Save to history (with compression if needed)
          let historyImage = imageUrl;
          if (getBase64Size(historyImage) > 800000) {
            try {
              historyImage = await compressImage(historyImage, 1200, 0.6);
            } catch (e) {
              console.error("Compression failed", e);
            }
          }

          await saveRenderToHistory({
            userId: user.uid,
            imageUrl: historyImage,
            prompt: prompt,
            tier,
            location: location.label,
            city: selectedCity,
            renderAngle,
          });

          // Update usage
          if (!isAdmin) {
            await incrementDailyUsage(user.uid);
            const newCount = await getDailyUsage(user.uid);
            setUsageCount(newCount);
          }
          await refreshHistory();
        } catch (historyErr: any) {
          console.error(
            "Failed to save to history or update usage:",
            historyErr,
          );
          toast.error(
            language === "zh"
              ? "保存到历史记录失败。"
              : "Failed to save to history.",
          );
        }
      } else if (isGuest) {
        // Increment guest usage on server
        const res = await fetch("/api/guest/increment", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setGuestUsage(data);
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || "游客额度已用完。");
        }
      }

      toast.success(
        language === "zh" ? "渲染成功！" : "Rendered successfully!",
        {
          id: toastId,
          description:
            language === "zh"
              ? "实景渲染图已生成并保存到历史记录。"
              : "Store rendering has been generated and saved to history.",
        },
      );
    } catch (err: any) {
      console.error("Generation Error:", err);
      const rawError = err.message || "";
      let errorMsg =
        rawError ||
        (language === "zh"
          ? "生成图片失败，请重试。"
          : "Failed to generate image, please try again.");

      // Handle API Key Missing error specifically
      if (errorMsg === "API_KEY_MISSING") {
        const aiApi = getAiApi();
        const isShared = window.location.href.includes("ais-pre-") || !aiApi;

        if (isShared) {
          errorMsg =
            language === "zh"
              ? '未检测到 API Key。发布后的应用需要管理员在 AI Studio 设置中配置 "API_KEY" 环境变量。'
              : 'API Key not detected. For published apps, the administrator must configure the "API_KEY" environment variable in AI Studio Settings.';
        } else {
          errorMsg =
            language === "zh"
              ? "未检测到 API Key。请点击右上角“激活 AI 引擎”并选择一个 API Key。"
              : 'API Key not detected. Please click "Activate AI Engine" and select an API Key.';

          setHasApiKey(false);
          if (aiApi?.openSelectKey) {
            aiApi.openSelectKey().then(() => setHasApiKey(true));
          }
        }
      } else if (
        errorMsg.includes("Requested entity was not found") ||
        errorMsg.includes("not found")
      ) {
        // Guidelines: If the request fails with "Requested entity was not found.", reset the key selection state
        errorMsg =
          language === "zh"
            ? "所选的 API 项目或 Key 无效或已过期。请重新选择。"
            : "The selected API project or Key is invalid or expired. Please select again.";

        setHasApiKey(false);
        const aiApi = getAiApi();
        if (aiApi?.openSelectKey) {
          aiApi.openSelectKey().then(() => setHasApiKey(true));
        }
      } else if (
        errorMsg.includes("Forbidden") ||
        errorMsg.includes("403") ||
        errorMsg.includes("permission") ||
        errorMsg.includes("denied access") ||
        errorMsg.includes("billing")
      ) {
        errorMsg =
          language === "zh"
            ? `API 权限不足 (Forbidden)。这通常是因为所使用的 API Key 未能满足该模型的要求，或者您的 Google Cloud 项目访问被拒绝。\n\n请检查：\n1. 确保在“AI Studio 设置 (Settings) -> 环境变量”中配置了 'GEMINI_API_KEY'。\n2. 确保该 Key 对应的项目已在 Google Cloud 控制台关联了有效的结算账户 (Billing Account)。\n3. 确保该项目已启用 "Generative Language API"。\n4. 如果您使用的是免费层级，部分高级模型（如 Gemini 3 Pro Image）可能受限。建议点击右上角切换为您的个人付费 API Key。\n\n详情参考：https://ai.google.dev/gemini-api/docs/billing`
            : `API Permission Denied (Forbidden). This usually means the API key used doesn't meet the requirements for this model, or your project access has been denied.\n\nPlease check:\n1. Ensure 'GEMINI_API_KEY' is configured in "AI Studio Settings -> Environment Variables".\n2. Ensure the Google Cloud project for this key is linked to a valid billing account.\n3. Ensure "Generative Language API" is enabled in that project.\n4. If using the free tier, some advanced models may be restricted. We recommend clicking "Activate AI Engine" to use your own paid API key.\n\nSee: https://ai.google.dev/gemini-api/docs/billing`;

        const aiApi = getAiApi();
        if (aiApi?.openSelectKey) {
          aiApi.openSelectKey().then(() => setHasApiKey(true));
        }
      } else {
        errorMsg =
          language === "zh"
            ? `生成出错: ${rawError}`
            : `Generation error: ${rawError}`;
      }

      setError(errorMsg);
      toast.error(language === "zh" ? "生成失败" : "Generation failed", {
        id: toastId,
        description: errorMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateHD = async (item: RenderHistory) => {
    if (isGeneratingHdId || isGenerating) return;

    setIsGeneratingHdId(item.id || item.imageUrl);
    const toastId = toast.loading(
      language === "zh" ? "正在生成高清图片..." : "Generating HD image...",
    );

    try {
      const targetSize = isAdmin ? "4K" : "2K";

      const result = await generateStoreRendering(
        item.tier,
        item.renderAngle || "front_panorama",
        aspectRatio,
        targetSize,
        item.prompt,
        undefined,
        item.imageUrl,
        undefined,
        undefined,
        location,
        item.city,
        storeArea,
        [],
        undefined,
        undefined,
        "none",
        selectedModel,
        "sunny",
        "day",
        undefined,
        undefined,
        "full",
        undefined,
        brandStandards || undefined,
        false, // isDemoMode
        outpaintSide,
        materialAnalysis || undefined
      );

      if (user) {
        try {
          await saveRenderToHistory({
            userId: user.uid,
            imageUrl: result.imageUrl,
            prompt: `${item.prompt} (HD ${targetSize})`,
            tier: item.tier,
            location: item.location,
            city: item.city,
            renderAngle: item.renderAngle,
          });
          await refreshHistory();
        } catch (historyErr) {
          console.error("Failed to save HD to history:", historyErr);
        }
      }

      setGeneratedImage(result.imageUrl);
      setGeneratedPrompt(result.prompt);
      setShowHistory(false);

      toast.success(
        language === "zh"
          ? "高清图片生成成功！"
          : "HD image generated successfully!",
        { id: toastId },
      );
    } catch (err: any) {
      console.error("HD Generation Error:", err);
      toast.error(language === "zh" ? "高清生成失败" : "HD generation failed", {
        id: toastId,
      });
    } finally {
      setIsGeneratingHdId(null);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const a = document.createElement("a");
      a.href = generatedImage;
      a.download = `itel-home-${tier.toLowerCase()}-render.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleReset = () => {
    setEnvironmentImage(null);
    setEnvironmentMask(null);
    setGeneratedImage(null);
    setStructuralAnalysis(null);
    setWorkflowStep(1);
    setIsStructureConfirmed(false);
    setIsDemoMode(false);
    setRenderingAnalysis(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const t = TRANSLATIONS[language];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {language === "zh"
              ? "正在初始化 itel Home 系统..."
              : "Initializing itel Home system..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Toaster position="top-right" richColors />
      <Header
        selectedLocation={location}
        onLocationChange={setLocation}
        selectedCity={selectedCity}
        onCityChange={setSelectedCity}
        language={language}
        onLanguageChange={setLanguage}
        hasApiKey={hasApiKey}
        onOpenKeySelect={handleOpenKeySelect}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isAdmin={isAdmin}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showInpaintEditor && generatedImage && (
          <InpaintEditor
            imageUrl={generatedImage}
            onSave={handleInpaintSave}
            onCancel={() => setShowInpaintEditor(false)}
            language={language}
            saveText={t.startInpaint}
            cancelText={t.cancelInpaint}
          />
        )}
        {isSelectingEnvRegion && environmentImage && (
          <InpaintEditor
            imageUrl={environmentImage}
            title={t.markLocation}
            description={t.markLocationGuide}
            hidePrompt={true}
            isSemantic={true}
            saveText={t.confirmMarking}
            cancelText={t.cancel}
            onSave={(mask) => {
              setEnvironmentMask(mask);
              setIsSelectingEnvRegion(false);
              toast.success(
                language === "zh" ? "门店位置已标注" : "Store location marked",
              );
            }}
            onCancel={() => setIsSelectingEnvRegion(false)}
            language={language}
          />
        )}
        {currentTab === "store" && (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {language === "zh"
                  ? "生成本地化门店实景渲染图"
                  : "Generate Localized Store Rendering"}
              </h2>
              <p className="text-xs text-red-500/70 mt-2 font-medium">
                {language === "zh"
                  ? "* 温馨提示：AI 效果图仅供方案预览参考，不作为最终施工依据。如需 100% 还原落地，请联系品牌设计部提供精准的施工制作图纸。"
                  : "* Note: AI renderings are for preview only and not for construction. For 100% accurate implementation, please contact the Brand Design Dept for precise construction drawings."}
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Workflow Navigation */}
              <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 relative z-20">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                  {/* Step 01 */}
                  <div className={`flex-1 flex items-center gap-4 p-4 rounded-2xl transition-all ${workflowStep === 1 ? 'bg-red-50 border border-red-100' : 'bg-transparent opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${workflowStep === 1 ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-gray-200 text-gray-400'}`}>01</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-black uppercase tracking-widest ${workflowStep === 1 ? 'text-gray-900' : 'text-gray-400'}`}>{language === "zh" ? "空间锚定" : "Spatial Alignment"}</h4>
                        <div className={`w-2 h-2 rounded-full ${workflowStep === 1 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">{language === "zh" ? "拖拽网格，锁定店招位置" : "Drag grid to lock sign position"}</p>
                    </div>
                  </div>

                  <div className="hidden lg:block w-px h-12 bg-gray-100" />

                  {/* Step 02 */}
                  <div className={`flex-1 flex items-center gap-4 p-4 rounded-2xl transition-all ${workflowStep === 2 ? 'bg-amber-50 border border-amber-100' : 'bg-transparent opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${workflowStep === 2 ? 'bg-amber-600 text-white shadow-lg shadow-amber-200' : 'bg-gray-200 text-gray-400'}`}>02</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-black uppercase tracking-widest ${workflowStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>{language === "zh" ? "空间深化" : "Spatial Deepening"}</h4>
                        <div className={`w-2 h-2 rounded-full ${workflowStep === 2 ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'}`} />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">{language === "zh" ? "预览 16:9 扩图范围" : "Preview 16:9 expansion"}</p>
                    </div>
                  </div>

                  <div className="hidden lg:block w-px h-12 bg-gray-100" />

                  {/* Step 03 */}
                  <div className={`flex-1 flex items-center gap-4 p-4 rounded-2xl transition-all ${workflowStep === 3 ? 'bg-blue-50 border border-blue-100' : 'bg-transparent opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${workflowStep === 3 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-200 text-gray-400'}`}>03</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-black uppercase tracking-widest ${workflowStep === 3 ? 'text-gray-900' : 'text-gray-400'}`}>{language === "zh" ? "方案确认" : "Solution Confirmation"}</h4>
                        <div className={`w-2 h-2 rounded-full ${workflowStep === 3 ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                      </div>
                      <p className="text-[10px] text-gray-500 font-medium">{language === "zh" ? "选择方案，点击最终渲染" : "Select tier and render"}</p>
                    </div>
                  </div>

                  {/* 3. Account (Right) - Keep it small and integrated */}
                  <div className="shrink-0 flex items-center bg-gray-900 p-2 pr-3 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-600/10 pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10 justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg border border-white/10 overflow-hidden bg-gray-800 flex items-center justify-center">
                          {user?.photoURL ? (
                            <img src={user.photoURL} className="w-full h-full object-cover" />
                          ) : (
                            <User size={14} className="text-gray-500" />
                          )}
                        </div>
                        <div className="hidden lg:block">
                          <p className="text-[10px] font-black text-white uppercase tracking-wider truncate w-20">
                            {user?.displayName || (isGuest ? "Guest" : "Anonymous")}
                          </p>
                          <p className="text-[8px] font-medium text-gray-400">
                            {isAdmin ? "Admin" : isGuest ? "Trial" : "Verified"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={user ? logout : handleLogin}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-all ml-2"
                      >
                        {user ? <LogOut size={12} /> : <LogIn size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            {/* Design Stage */}
            <div className="space-y-6">
              {/* R2 Status Warning (Global Alert) */}
              {!isR2Configured && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <AlertCircle size={16} />
                    </div>
                    <p className="text-[10px] sm:text-xs text-amber-900 font-bold">
                      {language === "zh"
                        ? "Local DB 模式：由于 R2 未配置，渲染图将存储在本地，建议配置 R2 以获得最佳性能。"
                        : "Local DB Mode: R2 not configured. Performance might be limited."}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsR2Configured(true)}
                    className="p-1 hover:bg-amber-200 rounded-full transition-colors"
                  >
                    <X size={14} className="text-amber-400 font-bold" />
                  </button>
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Left Panel: Step Explanations (and Params) */}
                <div className={`w-full lg:w-80 shrink-0 flex flex-col gap-4 ${workflowStep === 2 ? 'hidden' : 'flex'}`}>
                  {workflowStep === 1 && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                          <Layers size={18} />
                        </div>
                        <h3 className="font-black text-gray-900 uppercase">
                          {language === "zh" ? "第一阶段：空间定轴" : "Phase 1: Spatial Alignment"}
                        </h3>
                      </div>
                      
                      <button
                        onClick={() => { setWorkflowStep(3); setIsStructureConfirmed(true); setIsDemoMode(true); }}
                        className="w-full mb-4 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-all"
                      >
                        {language === "zh" ? "跳过锚定，演示 AI 模型" : "Skip Localization, Demo AI Model"}
                      </button>
                      
                      <div className="space-y-4">
                        <div className="text-[11px] text-gray-600 space-y-2">
                          <p><strong>1. 上传环境图:</strong> 系统提取图像特征。</p>
                          <p><strong>2. 视觉解析:</strong> AI 快速扫描并覆盖一层几何骨架。</p>
                          <p><strong>3. 拖拽网格:</strong> 手动拖拽画布上的红色锚点，框选出门面的整体结构。</p>
                          <p className="text-amber-600 bg-amber-50 p-2 rounded-lg mt-2">点击“确认渲染位置”进入下一步（此操作不消耗渲染额度）。</p>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-100">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                            {language === "zh" ? "渲染模式" : "Render Mode"}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setRenderMode('full')}
                              className={`flex items-center justify-center py-2 px-3 rounded-xl border text-[10px] font-bold uppercase ${renderMode === 'full' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                            >
                              {language === "zh" ? "招牌 + 门店" : "Sign + Store"}
                            </button>
                            <button
                              onClick={() => setRenderMode('signage')}
                              className={`flex items-center justify-center py-2 px-3 rounded-xl border text-[10px] font-bold uppercase ${renderMode === 'signage' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                            >
                              {language === "zh" ? "仅招牌" : "Signage Only"}
                            </button>
                          </div>
                        </div>
                        
                        {!isStructureConfirmed && (
                          <div className="mt-6 border-t border-gray-100 pt-4">
                            <button
                              onClick={() => { setIsStructureConfirmed(true); setWorkflowStep(2); setIsDemoMode(false); }}
                              disabled={!environmentImage}
                              className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 ${!environmentImage ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200 animate-pulse'}`}
                            >
                              <Check size={14} />
                              {language === "zh" ? "确认渲染位置" : "Confirm Render Zone"}
                            </button>
                          </div>
                        )}
                        {isStructureConfirmed && (
                          <div className="mt-6 border-t border-gray-100 pt-4">
                            <div className="w-full py-3 bg-green-50 text-green-700 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-green-200">
                              <CheckCircle size={14} />
                              {language === "zh" ? "已锁定坐标" : "Coordinates Locked"}
                            </div>
                            <button onClick={() => setWorkflowStep(2)} className="w-full mt-2 py-2 text-xs font-black text-gray-500 hover:text-red-500 uppercase">
                               {language === "zh" ? "继续下一步" : "Continue"}
                            </button>
                          </div>
                        )}
                        
                        {/* Display minimal diagnosis if available */}
                        {structuralAnalysis && (
                           <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap size={12} className="text-amber-500" />
                                <p className="text-[9px] font-black text-gray-500 uppercase mt-0.5">
                                  {language === "zh" ? "空间协议诊断" : "Structural Diagnosis"}
                                </p>
                              </div>
                              <p className="text-[10px] text-gray-600 leading-relaxed italic font-medium">
                                "{structuralAnalysis.analysis}"
                              </p>
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                  {workflowStep === 2 && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                          <Maximize size={18} />
                        </div>
                        <h3 className="font-black text-gray-900 uppercase">
                          {language === "zh" ? "空间深化" : "Spatial Deepening"}
                        </h3>
                      </div>
                      <div className="space-y-4 text-[11px] text-gray-600">
                        <p>系统已进入<strong>深度设计模式</strong>。主画布已激活透视骨架映射。</p>
                        
                        <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
                           <div className="p-2 bg-white rounded-lg shadow-sm">
                             <Zap size={14} className="text-red-600" />
                           </div>
                           <p className="text-[10px] text-red-900 font-bold leading-tight">
                             {language === "zh" ? "建议：在画布上方的工具栏中选择“更改材质”来深入调整门店质感。" : "Suggest: Use 'Change Material' in toolbar to depth-adjust storefront."}
                           </p>
                        </div>

                        <div className="mt-6 border-t border-gray-100 pt-4">
                          <button
                            onClick={processMaskAndProceed}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-amber-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                          >
                            <Check size={14} />
                            {language === "zh" ? "完成深化，确认方案" : "Finish Deepening"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {workflowStep === 3 && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-6">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <Store size={18} />
                        </div>
                        <h3 className="font-black text-gray-900 uppercase">
                          {language === "zh" ? "第三阶段：方案确认" : "Phase 3: Solution Confirmation"}
                        </h3>
                      </div>
                      
                      <div className="text-[11px] text-gray-500 mb-2">
                         {language === "zh" ? "配置品牌SI标准和渲染视角进行最终的高精渲染" : "Configure SI standards and render angle."}
                      </div>

                      {/* Moving Tier config here */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <Store size={10} /> {t.tierLabel}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "L1", label: language === "zh" ? "旗舰店" : "Flagship" },
                            { id: "L3", label: language === "zh" ? "标准店" : "Standard" },
                            { id: "L4", label: language === "zh" ? "专区店" : "Special Zone" },
                            { id: "L5", label: language === "zh" ? "挂牌店" : "Signage-only" },
                          ].map((t_item) => (
                            <button
                              key={t_item.id}
                              onClick={() => setTier(t_item.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 border-2 border-transparent ${
                                tier === t_item.id
                                  ? "bg-red-600 text-white shadow-md shadow-red-100"
                                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                              }`}
                            >
                              {tier === t_item.id && <Check size={10} />}
                              {t_item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="w-full h-px bg-gray-100" />
                      
                      {/* Image Size Selection */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                          <Maximize size={10} /> {language === "zh" ? "渲染尺寸 (Tokens)" : "Image Size (Tokens)"}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "1K", label: "1K", icon: Zap },
                            { id: "2K", label: "2K", icon: Star },
                            { id: "4K", label: "4K", icon: Sparkles },
                          ].map((size) => (
                            <button
                              key={size.id}
                              onClick={() => setImageSize(size.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1 border-2 border-transparent ${
                                imageSize === size.id
                                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                              }`}
                            >
                              {imageSize === size.id ? <Check size={10} /> : <size.icon size={10} />}
                              {size.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-full h-px bg-gray-100" />

                      {/* Render Angle Selection inside Step 3 */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                          <Target size={10} /> {t.angleLabel}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "front_panorama", icon: Monitor },
                            { id: "storefront_perspective", icon: Box },
                            { id: "side_signage", icon: Square },
                            { id: "logo_detail", icon: Info },
                            { id: "interior_perspective", icon: Layers },
                            { id: "indoor_zone", icon: MapPin },
                          ].map((a) => (
                            <button
                              key={a.id}
                              onClick={() => setRenderAngle(a.id)}
                              className={`flex flex-col items-start gap-1 p-2 border rounded-xl transition-all text-left ${renderAngle === a.id ? "border-red-500 bg-red-50 ring-1 ring-red-500 shadow-sm" : "border-gray-100 hover:bg-gray-50"}`}
                            >
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${renderAngle === a.id ? "bg-red-500 text-white shadow-md shadow-red-200" : "bg-gray-100 text-gray-400"}`}
                              >
                                <a.icon size={12} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-black text-gray-900 uppercase block leading-tight truncate">
                                  {(t.angles as any)[a.id].label}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-full h-px bg-gray-100" />

                      {/* Material Reference Upload */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                          <Brush size={10} /> {language === "zh" ? "物料参考 (标准库或上传)" : "Material Reference (Library or Upload)"}
                        </label>
                        <p className="text-[10px] text-gray-500 mb-2 leading-tight">
                          {language === "zh" ? "选择标准样本或上传材质图，作为 AI 渲染的首选风格参考。" : "Select a standard sample or upload a reference to guide the AI output."}
                        </p>

                         {/* Standard Library Selection */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1">
                               <Grid size={10} className="text-red-500" />
                               {language === "zh" ? "标准样本库" : "Standard Library"}
                               {r2Status?.configured && (
                                 <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Cloudflare R2 Connected" />
                               )}
                             </span>
                             {verifiedExamples.length > 0 ? (
                               <div className="flex items-center gap-2">
                                 <button 
                                   onClick={async () => {
                                     toast.loading(language === "zh" ? "同步标准库..." : "Syncing library...");
                                     try {
                                       await fetch('/api/sync-standard-library');
                                       const examples = await getVerifiedExamples();
                                       setVerifiedExamples(examples);
                                       toast.dismiss();
                                       toast.success(language === "zh" ? "同步完成" : "Sync completed");
                                     } catch (e) {
                                       toast.error("Sync failed");
                                     }
                                   }}
                                   className="text-[8px] text-gray-400 hover:text-red-500 flex items-center gap-1"
                                 >
                                   <RefreshCw size={8} />
                                 </button>
                                 <span className="text-[8px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                                   {verifiedExamples.length} {language === "zh" ? "张样本" : "Samples"}
                                 </span>
                               </div>
                             ) : (
                               <button 
                                 onClick={async () => {
                                   toast.loading(language === "zh" ? "正在同步 R2 标准库..." : "Syncing R2 Standard Library...");
                                   try {
                                     await fetch('/api/sync-standard-library');
                                     const examples = await getVerifiedExamples();
                                     setVerifiedExamples(examples);
                                     toast.dismiss();
                                   } catch (e) {
                                     toast.error("Sync failed");
                                   }
                                 }}
                                 className="text-[8px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                               >
                                 <RefreshCw size={8} className="animate-spin-slow" />
                                 {language === "zh" ? "同步并刷新" : "Sync & Refresh"}
                               </button>
                             )}
                          </div>
                          
                          <div className="flex gap-2.5 overflow-x-auto pb-3 pt-1 no-scrollbar min-h-[72px]">
                            {verifiedExamples.length === 0 ? (
                              <div className="w-full h-16 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center bg-gray-50/30">
                                <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest text-center px-4">
                                  {language === "zh" ? "暂无标准样本\n请上传或在下方历史记录中选择设置" : "No standard samples yet.\nUpload or select from history below."}
                                </span>
                              </div>
                            ) : (
                              verifiedExamples.slice(0, 15).map((sample, idx) => (
                                <button
                                  key={sample.id || idx}
                                  onClick={() => {
                                    setMaterialReferenceImage(sample.imageUrl);
                                    setMaterialAnalysis(`Standard itel Home Reference: ${sample.prompt.substring(0, 100)}...`);
                                  }}
                                  className={`shrink-0 w-16 h-16 rounded-xl border-2 transition-all relative overflow-hidden group shadow-sm ${materialReferenceImage === sample.imageUrl ? 'border-red-500 ring-2 ring-red-100 scale-95' : 'border-white hover:border-red-200'}`}
                                >
                                  <img 
                                    src={sample.imageUrl} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                    alt="standard sample" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  {materialReferenceImage === sample.imageUrl && (
                                    <div className="absolute inset-0 bg-red-600/30 flex items-center justify-center backdrop-blur-[1px]">
                                      <div className="bg-white rounded-full p-1 shadow-lg">
                                        <Check size={14} className="text-red-600" strokeWidth={4} />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        {!materialReferenceImage ? (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleMaterialUpload}
                              className="hidden"
                              id="material-upload-new"
                              disabled={isAnalyzingMaterial}
                            />
                            <label
                              htmlFor="material-upload-new"
                              className={`flex items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors ${isAnalyzingMaterial ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isAnalyzingMaterial ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                                  <span className="text-xs font-bold text-gray-600">
                                    {language === "zh" ? "正在深入解析纹理..." : "Analyzing textures..."}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Plus className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                  <span className="text-[10px] font-medium text-gray-500">
                                    {language === "zh" ? "点击上传材质" : "Click to upload"}
                                  </span>
                                </div>
                              )}
                            </label>
                          </>
                        ) : (
                          <div className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                            <img src={materialReferenceImage} alt="Material ref" className="w-full h-24 object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => { setMaterialReferenceImage(null); setMaterialAnalysis(null); }}
                                className="p-2 bg-white/20 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            {materialAnalysis && (
                              <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-1.5 border-t border-gray-200 text-[8px] text-gray-700 font-medium truncate px-2">
                                <CheckCircle className="w-3 h-3 inline-block text-green-500 mr-1" /> {language === "zh" ? "解析成功" : "Analysis active"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                  
                  {/* Step 3 Execute Button */}
                  {workflowStep === 3 && (
                    <div className="mt-4">
                      <button
                        onClick={handleGenerate}
                        disabled={
                          isGenerating ||
                          hasReachedLimit ||
                          !environmentImage
                        }
                        className={`w-full py-4 rounded-3xl font-black uppercase tracking-[0.2em] text-white transition-all active:scale-[0.97] flex items-center justify-center gap-3 shadow-2xl h-14 relative overflow-hidden group ${
                          !environmentImage
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300"
                            : "bg-red-600 hover:bg-red-700 shadow-red-300 border-b-4 border-red-800"
                        } disabled:opacity-50`}
                      >
                        {isGenerating ? (
                          <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                          <>
                            <Zap
                              size={18}
                              fill="white"
                              className="group-hover:animate-bounce"
                            />
                            {language === "zh" ? "注入标准并渲染" : "Inject Standards & Render"}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-6 h-full">
                  {/* Interactive Main Stage: Environment Reference */}
                  <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group h-full transition-all duration-500 ${workflowStep === 3 ? 'hidden' : 'flex flex-col'}`}>
                {workflowStep === 2 && (
                  <div className="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-xl border border-gray-100 shadow-inner">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      <button 
                        onClick={() => setShowInpaintEditor(true)}
                        className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all hover:bg-white text-amber-700 hover:shadow-sm ${activeTool === 'none' ? 'bg-amber-50 shadow-inner' : ''}`}
                      >
                        <Maximize size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "构图" : "Composition"}</span>
                      </button>
                      <div className="w-px h-6 bg-gray-200 mx-1" />
                      <button 
                        onClick={() => setActiveTool(prev => prev === 'brush' ? 'none' : 'brush')}
                        className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all hover:bg-white text-blue-700 hover:shadow-sm ${activeTool === 'brush' ? 'bg-blue-50 shadow-inner' : ''}`}
                      >
                        <Palette size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "更改材质" : "Material"}</span>
                      </button>
                      <button 
                        onClick={() => setActiveTool(prev => prev === 'eraser' ? 'none' : 'eraser')}
                        className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all hover:bg-white text-gray-700 hover:shadow-sm ${activeTool === 'eraser' ? 'bg-gray-100 shadow-inner' : ''}`}
                      >
                        <Eraser size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "橡皮擦" : "Eraser"}</span>
                      </button>
                      <button 
                        onClick={() => setActiveTool(prev => prev === 'wand' ? 'none' : 'wand')}
                        className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all hover:bg-white text-purple-700 hover:shadow-sm ${activeTool === 'wand' ? 'bg-purple-50 shadow-inner' : ''}`}
                      >
                        <Wand2 size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "魔棒工具" : "Wand"}</span>
                      </button>
                      <button 
                        onClick={() => setActiveTool(prev => prev === 'marquee' ? 'none' : 'marquee')}
                        className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg transition-all hover:bg-white text-emerald-700 hover:shadow-sm ${activeTool === 'marquee' ? 'bg-emerald-50 shadow-inner' : ''}`}
                      >
                        <Square size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "框选工具" : "Marquee"}</span>
                      </button>
                      <div className="w-px h-6 bg-gray-200 mx-1" />
                      <button 
                        onClick={undoLastAction}
                        className="flex flex-col items-center justify-center px-4 py-1 hover:bg-white rounded-lg transition-all text-gray-500 hover:shadow-sm"
                      >
                        <Undo2 size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "撤销" : "Undo"}</span>
                      </button>
                      <button 
                        onClick={clearCanvas}
                        className="flex flex-col items-center justify-center px-4 py-1 hover:bg-white rounded-lg transition-all text-red-500 hover:shadow-sm"
                      >
                        <Trash2 size={16} />
                        <span className="text-[10px] font-black uppercase mt-0.5">{language === "zh" ? "清空" : "Clear"}</span>
                      </button>
                      
                      {activeTool === 'brush' && (
                        <>
                          <div className="w-px h-6 bg-gray-200 mx-1" />
                          <div className="flex items-center gap-2 px-3">
                             <input 
                               type="range" 
                               min="5" 
                               max="100" 
                               value={brushSize}
                               onChange={(e) => setBrushSize(parseInt(e.target.value))}
                               className="w-20 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
                             />
                             <span className="text-[9px] font-black w-6 text-gray-500">{brushSize}</span>
                          </div>
                        </>
                      )}

                      <div className="w-px h-6 bg-gray-200 mx-1" />
                      <div className="flex items-center gap-2 px-3 bg-white/50 rounded-lg py-1 border border-gray-200/50 ml-1">
                        <button 
                          onClick={() => setCanvasZoom(z => Math.max(0.2, z - 0.1))}
                          className="p-1 hover:bg-white rounded text-gray-500 transition-colors"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <span className="text-[10px] font-black w-10 text-center text-gray-700">{Math.round(canvasZoom * 100)}%</span>
                        <button 
                          onClick={() => setCanvasZoom(z => Math.min(3, z + 0.1))}
                          className="p-1 hover:bg-white rounded text-gray-500 transition-colors"
                        >
                          <ZoomIn size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-amber-500 uppercase leading-none">Perspective</span>
                        <span className="text-[10px] font-black text-gray-900 leading-none mt-1">LOCKED</span>
                      </div>
                      <button 
                        onClick={processMaskAndProceed}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                      >
                        <Check size={14} />
                        {language === "zh" ? "完成方案" : "Finish"}
                      </button>
                    </div>
                  </div>
                )}
                <div className={`flex items-center justify-between mb-5 ${workflowStep === 2 ? 'hidden' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-200">
                      <Monitor className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-gray-900 uppercase tracking-widest">
                        {language === "zh"
                          ? "设计核心 | 空间几何引擎"
                          : "Design Hub | Spatial Engine"}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-medium tracking-tight">
                        {language === "zh"
                          ? "在画布上圈定门店整体区域（含招牌与下方门面）的 4 个顶点构建 3D 透视"
                          : "Define 4 corners of the entire store (sign + entrance) to map 3D perspective"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {environmentImage && (
                      <>
                        <button
                          onClick={removeEnvImage}
                          className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:text-red-600 hover:bg-red-50 transition-all border border-transparent"
                          title={language === "zh" ? "删除底图" : "Remove Image"}
                        >
                          <X size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setWorkflowStep(1);
                            setIsStructureConfirmed(false);
                          }}
                          className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${workflowStep === 1 ? "bg-red-600 text-white shadow-lg shadow-red-200 hover:bg-red-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                          {workflowStep === 1
                            ? language === "zh"
                              ? "正在编辑坐标区域"
                              : "Editing Alignment"
                            : language === "zh"
                              ? "返回修改结构"
                              : "Edit Alignment"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div
                  ref={canvasRef}
                  onMouseMove={handleAnchorDrag}
                  onTouchMove={handleAnchorDrag}
                  onMouseUp={() => {setDraggingAnchorIndex(null); setDraggingAnchorType(null);}}
                  onTouchEnd={() => {setDraggingAnchorIndex(null); setDraggingAnchorType(null);}}
                  onMouseLeave={() => {setDraggingAnchorIndex(null); setDraggingAnchorType(null);}}
                  style={{ touchAction: draggingAnchorIndex !== null ? 'none' : 'auto' }}
                  className="relative aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:border-red-400 select-none cursor-crosshair"
                >
                  <div 
                    className="w-full h-full relative flex items-center justify-center transition-transform duration-300 ease-out"
                    style={{ transform: `scale(${canvasZoom})` }}
                  >
                    {!environmentImage && (
                      <div className="absolute inset-0 pointer-events-none opacity-10">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                              <rect width="60" height="60" fill="none" />
                              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="2" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" className="text-gray-900" style={{ transformOrigin: 'center', transform: 'perspective(400px) rotateX(60deg) scale(2.5) translateY(-50px)' }} />
                        </svg>
                      </div>
                    )}

                    {environmentImage ? (
                      <div className="w-full h-full relative" id="main-stage-container" ref={stageContainerRef}>
                        {workflowStep === 2 ? (
                          <Stage 
                            width={stageSize.width} 
                            height={stageSize.height} 
                            ref={stageRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            scaleX={stageSize.width / 1200}
                            scaleY={stageSize.height / 675}
                            className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl"
                          >
                            <Layer>
                              {environmentKImage && (
                                <KImage 
                                  image={environmentKImage} 
                                  width={1200} 
                                  height={675}
                                  opacity={isAnalyzingStructure ? 0.5 : 1}
                                />
                              )}
                            </Layer>
                            <Layer>
                              {lines.map((line, i) => (
                                <Line
                                  key={i}
                                  points={line.points}
                                  stroke={line.tool === 'eraser' ? '#000000' : '#ef4444'}
                                  strokeWidth={line.size}
                                  tension={0.5}
                                  lineCap="round"
                                  lineJoin="round"
                                  opacity={line.tool === 'eraser' ? 1 : 0.6}
                                  globalCompositeOperation={
                                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                                  }
                                />
                              ))}
                              {rects.map((rect, i) => (
                                <Rect
                                  key={i}
                                  x={rect.x}
                                  y={rect.y}
                                  width={rect.width}
                                  height={rect.height}
                                  fill="rgba(239, 68, 68, 0.4)"
                                  stroke="#ef4444"
                                  strokeWidth={2}
                                />
                              ))}
                            </Layer>
                          </Stage>
                        ) : (
                          <img
                            src={environmentImage}
                            alt="Main Stage"
                            className="w-full h-full object-cover transition-all duration-700 opacity-100 grayscale-0"
                            draggable={false}
                          />
                        )}
                        
                        {workflowStep === 2 && activeTool === 'wand' && (
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-50">
                            <div className="bg-purple-900/40 text-white px-4 py-2 rounded-full text-xs font-black animate-pulse">
                              {language === "zh" ? "魔棒分析中..." : "Wand Analyzing..."}
                            </div>
                          </div>
                        )}
                      
                      {isAnalyzingStructure && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm pointer-events-none">
                          <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4 shadow-xl rounded-full" />
                          <p className="text-sm font-black text-gray-900 tracking-widest uppercase drop-shadow-md">
                            {language === "zh" ? "系统提示：正在扫描建筑解剖结构..." : "System API: Scanning Architectural Anatomy..."}
                          </p>
                        </div>
                      )}

                      {/* Outpainting Frame Overlay (Step 2 and 3) */}
                      {workflowStep >= 2 && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden fade-in animate-in">
                          {/* Box shadow to dim the outside of the 16:9 crop area */}
                          <div
                            className={`absolute inset-0 border border-amber-500/80 transition-all duration-500 transform ${
                              outpaintSide === "left"
                                ? "translate-x-[15%]"
                                : outpaintSide === "right"
                                  ? "-translate-x-[15%]"
                                  : ""
                            }`}
                            style={{
                              aspectRatio: "16 / 9",
                              height: "100%",
                              left: "50%",
                              top: "50%",
                              transform: `translate(-50%, -50%) ${
                                outpaintSide === "left"
                                  ? "translateX(15%)"
                                  : outpaintSide === "right"
                                    ? "translateX(-15%)"
                                    : ""
                              }`,
                              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)"
                            }}
                          >
                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-600/90 text-white text-[8px] font-black uppercase tracking-widest rounded shadow-lg backdrop-blur">
                              16:9 Target Frame
                            </div>
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                              {[...Array(9)].map((_, i) => (
                                <div
                                  key={i}
                                  className="border border-white/50"
                                />
                              ))}
                            </div>
                          </div>

                          {/* Expansion Area Indicators */}
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 p-2 bg-amber-600/60 text-white rounded-full animate-pulse transition-all ${outpaintSide === "right" ? "right-4 opacity-100" : "right-4 opacity-0 scale-50"}`}
                          >
                            <ChevronRight size={24} />
                          </div>
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 p-2 bg-amber-600/60 text-white rounded-full animate-pulse transition-all ${outpaintSide === "left" ? "left-4 opacity-100" : "left-4 opacity-0 scale-50"}`}
                          >
                            <ChevronLeft size={24} />
                          </div>
                        </div>
                      )}

                      {/* Perspective Skeleton Layer (Step 1) */}
                      {workflowStep === 1 && structuralAnalysis && (
                        <>
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible fade-in animate-in" style={{ pointerEvents: "none" }}>
                            {/* Signage Polygon */}
                            {structuralAnalysis.signageVertices && (
                              <polygon
                                points={`${structuralAnalysis.signageVertices[0].x * 100},${structuralAnalysis.signageVertices[0].y * 100} ${structuralAnalysis.signageVertices[1].x * 100},${structuralAnalysis.signageVertices[1].y * 100} ${structuralAnalysis.signageVertices[2].x * 100},${structuralAnalysis.signageVertices[2].y * 100} ${structuralAnalysis.signageVertices[3].x * 100},${structuralAnalysis.signageVertices[3].y * 100}`}
                                fill="rgba(239, 68, 68, 0.4)"
                                stroke="#ef4444"
                                strokeWidth={isStructureConfirmed ? "1.5" : "3"}
                                strokeDasharray={isStructureConfirmed ? "none" : "8 4"}
                                vectorEffect="non-scaling-stroke"
                                className={isStructureConfirmed ? "transition-all duration-300" : "animate-pulse transition-all duration-300"}
                              />
                            )}
                            {/* Storefront Polygon - Only show if not signage-only mode */}
                            {structuralAnalysis.storefrontVertices && renderMode !== 'signage' && (
                              <polygon
                                points={`${structuralAnalysis.storefrontVertices[0].x * 100},${structuralAnalysis.storefrontVertices[0].y * 100} ${structuralAnalysis.storefrontVertices[1].x * 100},${structuralAnalysis.storefrontVertices[1].y * 100} ${structuralAnalysis.storefrontVertices[2].x * 100},${structuralAnalysis.storefrontVertices[2].y * 100} ${structuralAnalysis.storefrontVertices[3].x * 100},${structuralAnalysis.storefrontVertices[3].y * 100}`}
                                fill="rgba(59, 130, 246, 0.4)"
                                stroke="#3b82f6"
                                strokeWidth={isStructureConfirmed ? "1.5" : "3"}
                                strokeDasharray={isStructureConfirmed ? "none" : "8 4"}
                                vectorEffect="non-scaling-stroke"
                                className={isStructureConfirmed ? "transition-all duration-300" : "animate-pulse transition-all duration-300"}
                              />
                            )}
                          </svg>

                          <svg className="absolute inset-0 w-full h-full overflow-visible fade-in animate-in">
                            {/* Signage Anchors and Text */}
                            {structuralAnalysis.signageVertices && (
                              <>
                                {!isStructureConfirmed && (
                                  <g style={{ transform: `translate(${(structuralAnalysis.signageVertices[0].x + structuralAnalysis.signageVertices[1].x + structuralAnalysis.signageVertices[2].x + structuralAnalysis.signageVertices[3].x) / 4 * 100}%, ${(structuralAnalysis.signageVertices[0].y + structuralAnalysis.signageVertices[1].y + structuralAnalysis.signageVertices[2].y + structuralAnalysis.signageVertices[3].y) / 4 * 100}%)` }}>
                                    <rect x="-100" y="-12" width="200" height="24" fill="rgba(255,255,255,0.8)" rx="4" />
                                    <text textAnchor="middle" alignmentBaseline="middle" fill="#ef4444" fontWeight="900" fontSize="10" dominantBaseline="central">
                                      {language === "zh" ? "招牌锚定区域" : "SIGNAGE ANCHOR ZONE"}
                                    </text>
                                  </g>
                                )}
                                {structuralAnalysis.signageVertices.map((v, i) => (
                                  <g
                                    key={`signage-${i}`}
                                    style={{ pointerEvents: "auto", cursor: "grab" }}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingAnchorIndex(i); setDraggingAnchorType("signage"); }}
                                    onTouchStart={(e) => { e.stopPropagation(); setDraggingAnchorIndex(i); setDraggingAnchorType("signage"); }}
                                  >
                                    <circle cx={`${v.x * 100}%`} cy={`${v.y * 100}%`} r={draggingAnchorIndex === i && draggingAnchorType === "signage" ? "12" : "8"} fill="white" stroke="#ef4444" strokeWidth="3" className="transition-all shadow-xl" />
                                  </g>
                                ))}
                              </>
                            )}

                            {/* Storefront Anchors and Text - Only show if not signage-only mode */}
                            {structuralAnalysis.storefrontVertices && renderMode !== 'signage' && (
                              <>
                                {!isStructureConfirmed && (
                                  <g style={{ transform: `translate(${(structuralAnalysis.storefrontVertices[0].x + structuralAnalysis.storefrontVertices[1].x + structuralAnalysis.storefrontVertices[2].x + structuralAnalysis.storefrontVertices[3].x) / 4 * 100}%, ${(structuralAnalysis.storefrontVertices[0].y + structuralAnalysis.storefrontVertices[1].y + structuralAnalysis.storefrontVertices[2].y + structuralAnalysis.storefrontVertices[3].y) / 4 * 100}%)` }}>
                                    <rect x="-100" y="-12" width="200" height="24" fill="rgba(255,255,255,0.8)" rx="4" />
                                    <text textAnchor="middle" alignmentBaseline="middle" fill="#3b82f6" fontWeight="900" fontSize="10" dominantBaseline="central">
                                      {language === "zh" ? "门店门面区域" : "STOREFRONT ZONE"}
                                    </text>
                                  </g>
                                )}
                                {structuralAnalysis.storefrontVertices.map((v, i) => (
                                  <g
                                    key={`storefront-${i}`}
                                    style={{ pointerEvents: "auto", cursor: "grab" }}
                                    onMouseDown={(e) => { e.stopPropagation(); setDraggingAnchorIndex(i); setDraggingAnchorType("storefront"); }}
                                    onTouchStart={(e) => { e.stopPropagation(); setDraggingAnchorIndex(i); setDraggingAnchorType("storefront"); }}
                                  >
                                    <circle cx={`${v.x * 100}%`} cy={`${v.y * 100}%`} r={draggingAnchorIndex === i && draggingAnchorType === "storefront" ? "12" : "8"} fill="white" stroke="#3b82f6" strokeWidth="3" className="transition-all shadow-xl" />
                                  </g>
                                ))}
                              </>
                            )}
                          </svg>
                        </>
                      )}

                      {/* Canvas Hotspots */}
                      {workflowStep === 3 && isStructureConfirmed && !isGenerating && (
                        <div className="absolute inset-0 pointer-events-none fade-in animate-in">
                          {[
                            {
                              id: "interior_perspective",
                              x: "50%",
                              y: "50%",
                              label: "Inside",
                            },
                            {
                              id: "detail_closeup",
                              x: "30%",
                              y: "70%",
                              label: "Detail",
                            },
                          ].map((spot) => (
                            <button
                              key={spot.id}
                              onClick={() => setRenderAngle(spot.id)}
                              className={`absolute pointer-events-auto p-2 rounded-full border-2 transition-all transform -translate-x-1/2 -translate-y-1/2 group/spot ${renderAngle === spot.id ? "bg-red-600 border-white scale-110 shadow-lg" : "bg-white/50 border-white/80 hover:bg-white"}`}
                              style={{ left: spot.x, top: spot.y }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-inherit" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Remove image button was here, moved to header to avoid obstructing canvas */}

                      
                    </div>
                  ) : (
                    <div className="text-center p-10 relative z-10 pointer-events-none mt-10">
                      <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-6 border border-gray-100 shadow-xl relative animate-bounce">
                        <ImageIcon className="h-10 w-10 text-gray-300 relative z-10" />
                        <div className="absolute inset-0 bg-red-50 rounded-full scale-150 -z-10 blur-xl opacity-50" />
                      </div>
                      <h4 className="text-sm font-black text-gray-900 mb-2 uppercase tracking-widest">
                        {language === "zh"
                          ? "1. 先上传原店实景底图"
                          : "1. Upload Original Store Image"}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-medium mb-6 uppercase tracking-widest">
                        Workflow Logic step 1
                      </p>
                      <button className="px-8 py-3 bg-red-600 pointer-events-auto hover:bg-red-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-red-200 cursor-pointer">
                        Select Ground Truth
                      </button>
                    </div>
                  )}
                </div>

                  {!environmentImage && (
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      accept="image/*"
                      onChange={handleEnvImageUpload}
                    />
                  )}

                  {/* Physical Parameters Feedback Status Bar */}
                  <div className="absolute top-4 left-4 text-[9px] font-mono font-medium text-gray-500 bg-white/70 px-3 py-1 rounded-md pointer-events-none backdrop-blur-sm z-30 shadow-sm border border-white/50 flex gap-2">
                    {environmentImage ? (
                       <><span>Viewport: <strong className="text-gray-800">16:9</strong></span>
                       <span className="text-gray-300">|</span>
                       <span>Scale: <strong className="text-gray-800">1:1.5</strong></span>
                       <span className="text-gray-300">|</span>
                       <span>Perspective: <strong className="text-red-600">{isStructureConfirmed ? "Calibrated (14.2°)" : "AWAITING"}</strong></span></>
                    ) : (
                       <><span>Viewport: <strong className="text-gray-800">16:9</strong></span>
                       <span className="text-gray-300">|</span>
                       <span>Engine Status: <strong className="animate-pulse text-amber-600">IDLE</strong></span></>
                    )}
                  </div>
                </div>


              </div>

            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden transition-all duration-500 flex flex-col ${workflowStep !== 3 ? 'hidden' : 'h-full'}`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <button
                    onClick={() => setWorkflowStep(2)}
                    className="mr-3 inline-flex items-center p-1.5 border border-gray-200 shadow-sm text-gray-500 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    title={language === "zh" ? "返回草图区" : "Back to Sketch"}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <h3 className="text-base font-semibold text-gray-900">
                    {t.renderResult}
                  </h3>
                  {isAdmin && (
                    <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <ShieldCheck size={10} className="mr-1" /> {t.adminMode}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {isDemoMode && (
                    <button
                      onClick={async () => {
                        setInteriorMaterialsImage(null); // Assuming null clears or resets to standard
                        await handleGenerate();
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-xs font-bold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      {language === "zh" ? "一键渲染" : "Quick Render"}
                    </button>
                  )}
                  {(isAdmin || isGuest) && showHistory && (
                    <div className="flex flex-col items-end gap-1">
                      <label className="inline-flex items-center px-3 py-1.5 border border-amber-200 shadow-sm text-xs font-bold rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors relative group">
                        <Upload className="-ml-0.5 mr-1.5 h-3.5 w-3.5" />
                        {isUploadingSample ? t.generating : (language === "zh" ? "批量上传标准样本" : "Batch Upload Samples")}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleUploadStandardSample}
                          disabled={isUploadingSample}
                        />
                        <div className="absolute bottom-full mb-2 right-0 w-64 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {language === "zh" ? (
                            <>
                              <p className="font-bold border-b border-gray-700 pb-1 mb-1">批量上传命名规则：</p>
                              <p className="text-gray-300">格式：等级_角度_描述.jpg</p>
                              <p className="text-gray-300 mt-1">例如：L3_Front_Street.jpg</p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold border-b border-gray-700 pb-1 mb-1">Batch Upload Naming Rule:</p>
                              <p className="text-gray-300">Format: Tier_Angle_Desc.jpg</p>
                              <p className="text-gray-300 mt-1">e.g., L3_Front_Street.jpg</p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  )}
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`inline-flex items-center px-3 py-1.5 border shadow-sm text-xs font-medium rounded-lg transition-colors ${showHistory ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    <History className="-ml-0.5 mr-1.5 h-3.5 w-3.5" />
                    {t.history}
                  </button>
                  {generatedImage && !showHistory && (
                    <>
                      <button
                        onClick={() => setShowInpaintEditor(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-xs font-bold rounded-lg text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <Brush className="-ml-0.5 mr-1.5 h-3.5 w-3.5" />
                        {t.partialRerender}
                      </button>
                      <button
                        onClick={() => copyToClipboard(generatedPrompt)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-200 shadow-sm text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <Copy className="-ml-0.5 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                        {language === "zh" ? "复制提示词" : "Copy Prompt"}
                      </button>
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-200 shadow-sm text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <Download className="-ml-0.5 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                        {t.download}
                      </button>
                      <button
                        onClick={handleReset}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-200 shadow-sm text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <RefreshCw className="-ml-0.5 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                        {language === "zh" ? "重新开始" : "Start Over"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {generatedImage && !showHistory && !showInpaintEditor && (
                <div className="flex gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <button
                    onClick={() => {
                      setInpaintPrompt(
                        language === "zh"
                          ? "修正透视，确保门头水平垂直对齐"
                          : "Correct perspective, ensure signage is vertically and horizontally aligned",
                      );
                      setShowInpaintEditor(true);
                      toast.info(
                        language === "zh"
                          ? "请涂抹门头区域以进行对齐修正"
                          : "Please brush the signage area for alignment correction",
                      );
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-red-50 text-red-700 rounded-lg border border-red-100 text-[10px] font-bold hover:bg-red-100 transition-all"
                  >
                    <Layers size={14} />
                    {t.verticalAlign}
                  </button>
                  <button
                    onClick={() => {
                      setInpaintPrompt(
                        language === "zh"
                          ? "深化材质质感，增强金属拉丝与高光反射"
                          : "Deepen material texture, enhance metal brushing and specular highlights",
                      );
                      setShowInpaintEditor(true);
                      toast.info(
                        language === "zh"
                          ? "请涂抹想要深化的材质区域"
                          : "Please brush the material area to deepen",
                      );
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-[10px] font-bold hover:bg-blue-100 transition-all"
                  >
                    <Maximize size={14} />
                    {t.materialDeepen}
                  </button>
                  <button
                    onClick={() => {
                      setInpaintPrompt(
                        language === "zh"
                          ? "加深遮蔽阴影，增强立体效果"
                          : "Deepen ambient occlusion and contact shadows for better 3D depth",
                      );
                      setShowInpaintEditor(true);
                      toast.info(
                        language === "zh"
                          ? "请涂抹门头与墙面交接处"
                          : "Please brush the signage-to-wall contact area",
                      );
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 text-[10px] font-bold hover:bg-emerald-100 transition-all"
                  >
                    <Pipette size={14} />
                    {t.shadowHardening}
                  </button>
                </div>
              )}

              {showHistory ? (
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                      <History size={48} className="mb-4 opacity-20" />
                      <p>
                        {language === "zh"
                          ? "暂无渲染历史"
                          : "No rendering history"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 group"
                        >
                          <div className="aspect-video relative">
                            <img
                              src={item.imageUrl}
                              alt="History"
                              className="w-full h-full object-cover"
                            />
                            {item.imageUrl.includes("r2.dev") ||
                            item.imageUrl.includes("cloudflare") ||
                            !item.imageUrl.startsWith("data:") ? (
                              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-lg flex items-center gap-1">
                                <ShieldCheck size={10} />
                                Cloudflare R2
                              </div>
                            ) : (
                              <div className="absolute top-2 left-2 bg-gray-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-lg flex items-center gap-1">
                                Local DB
                              </div>
                            )}
                            {item.isVerified && (
                              <div
                                className="absolute top-2 right-2 bg-amber-500 text-white p-1 rounded-full shadow-lg"
                                title="标准参考样本"
                              >
                                <Star size={14} fill="currentColor" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const a = document.createElement("a");
                                  a.href = item.imageUrl;
                                  a.download = `itel-history-${item.id}.png`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }}
                                className="p-2 bg-white rounded-full text-gray-700 hover:text-red-500 transition-colors"
                                title={t.download}
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleGenerateHD(item);
                                }}
                                className={`p-2 bg-white rounded-full text-gray-700 hover:text-red-500 transition-colors ${isGeneratingHdId === (item.id || item.imageUrl) ? "animate-pulse text-red-500" : ""}`}
                                title={t.generateHd}
                                disabled={!!isGeneratingHdId}
                              >
                                {isGeneratingHdId ===
                                (item.id || item.imageUrl) ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Sparkles size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700 mr-2">
                                  {item.tier}
                                </span>
                                {item.city && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 mr-2">
                                    {item.city}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {item.createdAt?.toDate
                                    ? item.createdAt.toDate().toLocaleString()
                                    : language === "zh"
                                      ? "刚刚"
                                      : "Just now"}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">
                              {item.prompt ||
                                (language === "zh"
                                  ? "无描述细节"
                                  : "No details")}
                            </p>

                            {(isAdmin || isGuest) && !item.isVerified && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try {
                                    const promptText =
                                      language === "zh"
                                        ? "请输入该样本的标注（例如：标准 L3 门头）"
                                        : "Enter label for this sample (e.g., Standard L3 Facade)";
                                    const defaultLabel =
                                      language === "zh"
                                        ? `标准 ${item.tier} 门店`
                                        : `Standard ${item.tier} Store`;
                                    const label = window.prompt(
                                      promptText,
                                      defaultLabel,
                                    );
                                    if (label !== null) {
                                      handleVerify(
                                        item.id!,
                                        label || defaultLabel,
                                        item.renderAngle,
                                      );
                                    }
                                  } catch (e) {
                                    console.error("Prompt error:", e);
                                    handleVerify(
                                      item.id!,
                                      language === "zh"
                                        ? `标准 ${item.tier} 门店`
                                        : `Standard ${item.tier} Store`,
                                      item.renderAngle,
                                    );
                                  }
                                }}
                                className="w-full py-2 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-50 transition-colors flex items-center justify-center"
                              >
                                <CheckCircle size={14} className="mr-2" />
                                {language === "zh"
                                  ? "设为标准样本 (Few-shot)"
                                  : "Set as Standard (Few-shot)"}
                              </button>
                            )}

                            {item.isVerified && (
                              <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                                <p className="text-[10px] font-bold text-amber-800 flex items-center">
                                  <Star
                                    size={10}
                                    className="mr-1"
                                    fill="currentColor"
                                  />
                                  {language === "zh" ? "已标注" : "Labeled"}:{" "}
                                  {item.label}
                                </p>
                                {item.renderAngle && (
                                  <p className="text-[9px] text-amber-600 mt-1 ml-4">
                                    {language === "zh"
                                      ? "空间/视角"
                                      : "Space/Angle"}
                                    :{" "}
                                    {TRANSLATIONS[language].angles[
                                      item.renderAngle as keyof typeof TRANSLATIONS.zh.angles
                                    ]?.label || item.renderAngle}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 rounded-2xl relative overflow-hidden group min-h-[500px] border border-gray-200">
                    {error && (
                      <div className="absolute top-4 left-4 right-4 z-20 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start justify-between shadow-xl">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-red-800 font-medium">
                              {error}
                            </p>
                            {isGuest && error?.includes(language === 'zh' ? '访客' : 'Guest') && (
                              <button
                                onClick={handleLogin}
                                className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-md active:scale-95"
                              >
                                <LogIn size={14} />
                                {language === "zh" ? "登录以获得更多次数" : "Login for more usage"}
                              </button>
                            )}
                          </div>
                        </div>
                        <X
                          size={20}
                          className="text-red-300 cursor-pointer"
                          onClick={() => setError(null)}
                        />
                      </div>
                    )}

                    {isGenerating ? (
                      <div className="text-center z-10">
                        <div className="relative mb-8">
                          <div className="h-24 w-24 rounded-full border-4 border-red-500/10 border-t-red-600 animate-spin mx-auto shadow-inner"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Brain className="h-8 w-8 text-red-600 animate-pulse" />
                          </div>
                        </div>
                        <h4 className="text-xl font-black text-gray-900 uppercase tracking-[0.25em] mb-2">
                          {language === "zh" ? "加载设计协议" : "Loading Proto"}
                        </h4>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {language === "zh"
                            ? "正在调用空间几何引擎计算反射与光影..."
                            : "Calculating reflection and lighting..."}
                        </p>
                      </div>
                    ) : generatedImage ? (
                      <div
                        className="w-full h-full relative cursor-col-resize overflow-hidden"
                        onMouseMove={(e) => {
                          if (isHoveringOutput) {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const x =
                              ((e.clientX - rect.left) / rect.width) * 100;
                            setComparisonOffset(x);
                          }
                        }}
                        onMouseEnter={() => setIsHoveringOutput(true)}
                        onMouseLeave={() => setIsHoveringOutput(false)}
                      >
                        {/* Rendered Image (Base) */}
                        <img
                          src={generatedImage}
                          alt="Rendered"
                          className="w-full h-full object-contain"
                        />

                        {/* Original Environment (Overlay with clip-path) */}
                        <div
                          className="absolute inset-0 pointer-events-none transition-all duration-75 ease-out"
                          style={{
                            clipPath: `inset(0 ${100 - comparisonOffset}% 0 0)`,
                          }}
                        >
                          {environmentImage && (
                            <img
                              src={environmentImage}
                              className="absolute inset-0 w-full h-full object-contain grayscale brightness-50"
                              alt="Original"
                            />
                          )}
                          <div className="absolute top-1/2 left-4 -translate-y-1/2 rotate-90 origin-left">
                            <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.5em] whitespace-nowrap">
                              Source Material
                            </span>
                          </div>
                        </div>

                        {/* Draggable Slider Handle */}
                        <div
                          className="absolute inset-y-0 pointer-events-none transition-all duration-75 ease-out"
                          style={{ left: `${comparisonOffset}%` }}
                        >
                          <div className="absolute inset-y-0 w-px bg-white/80 shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full shadow-2xl flex items-center justify-center text-red-600 border border-white">
                            <div className="flex gap-0.5">
                              <div className="w-0.5 h-3 bg-red-400 rounded-full"></div>
                              <div className="w-0.5 h-3 bg-red-400 rounded-full"></div>
                            </div>
                          </div>
                        </div>

                        <div className="absolute bottom-6 left-6 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-gray-100 flex items-center gap-4 shadow-2xl animate-in slide-in-from-left-4 duration-500">
                          <div className="flex -space-x-2 mr-2">
                            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white shadow-lg relative z-10">
                              <CheckCircle size={24} />
                            </div>
                            {materialReferenceImage && (
                              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg relative z-0 pl-2 pr-1">
                                <Brush size={18} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                              {materialReferenceImage ? "Material & Geometry OK" : "Geometric Alignment OK"}
                            </p>
                            <p className="text-[9px] text-gray-500 font-medium">
                              Rendered using {tier} spatial axioms {materialReferenceImage && '& custom materials'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity p-20">
                        <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center mx-auto mb-6 border border-gray-100 shadow-xl">
                          <Zap size={32} className="text-gray-200" />
                        </div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.4em]">
                          {language === "zh"
                            ? "空间引擎待命"
                            : "Engine Standby"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Strategy Analysis Section */}
                  {generatedImage && !isGenerating && renderingAnalysis && (
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 mt-6">
                      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <Store className="text-red-600 h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-gray-900">
                              {t.strategyTitle}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {t.strategySubtitle}
                            </p>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
                          {tier} {t.tierLabel}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <CheckCircle
                                size={14}
                                className="text-green-500"
                              />{" "}
                              {t.tierAnalysis}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {renderingAnalysis.tierAnalysis}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <CheckCircle
                                size={14}
                                className="text-green-500"
                              />{" "}
                              {t.designStrategy}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {renderingAnalysis.designStrategy}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <CheckCircle
                                size={14}
                                className="text-green-500"
                              />{" "}
                              {t.budgetAssessment}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {renderingAnalysis.budgetAssessment}
                            </p>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <h5 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <CheckCircle
                                size={14}
                                className="text-green-500"
                              />{" "}
                              {t.complianceCheck}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {renderingAnalysis.complianceCheck}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <Info className="text-amber-500 h-4 w-4 mt-0.5" />
                          <div className="text-xs text-amber-800 leading-relaxed">
                            <strong>{t.sourcingAdvice}：</strong>{" "}
                            {(language === "zh"
                              ? STORE_STRATEGIES[tier]?.materialSourcing
                              : STORE_STRATEGIES[tier]?.en.materialSourcing) ||
                              (language === "zh"
                                ? "请参考标准手册"
                                : "Refer to standard manual")}
                            。
                            <br />
                            <strong>{t.corePrinciples}：</strong>{" "}
                            {(language === "zh"
                              ? STORE_STRATEGIES[tier]?.keyPrinciples.join(
                                  " · ",
                                )
                              : STORE_STRATEGIES[tier]?.en.keyPrinciples.join(
                                  " · ",
                                )) ||
                              (language === "zh"
                                ? "层级匹配 · 成本可控"
                                : "Tier Matching · Cost Control")}
                            。
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
)}

        {currentTab === "bom" && (
          <BOMCalculator language={language} userProfile={userProfile} />
        )}

        {currentTab === "brand_lab" && (
          <KnowledgeBase
            language={language}
            brandStandards={brandStandards}
            onUpdateStandards={setBrandStandards}
            verifiedExamples={verifiedExamples}
          />
        )}
      </main>

      {isSelectingAnchors && environmentImage && (
        <AnchorSelector
          image={environmentImage}
          language={language}
          onCancel={() => setIsSelectingAnchors(false)}
          onConfirm={(pts) => {
            setStructuralAnalysis((prev) => ({
              signageVertices: pts,
              storefrontVertices: prev?.storefrontVertices || pts.map(p => ({ ...p, y: p.y + 0.4 })),
              tiltAngle: prev?.tiltAngle || "User Calibrated",
              detectedStructure: prev?.detectedStructure || "Custom",
              vanishingPoints: prev?.vanishingPoints || "User Defined",
              lightSource: prev?.lightSource || "Ambient Match",
              analysis:
                language === "zh"
                  ? "用户手动校准的精确坐标"
                  : "User-calibrated precise coordinates",
            }));
            setIsSelectingAnchors(false);
            setIsStructureConfirmed(true);
            toast.success(
              language === "zh"
                ? "手动校准坐标已应用并锁定"
                : "Manual coordinates applied and locked",
            );
          }}
        />
      )}
    </div>
  );
}
