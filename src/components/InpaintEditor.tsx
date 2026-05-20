import React, { useRef, useEffect, useState } from 'react';
import { Pencil, Eraser, Trash2, CheckCircle, X, Info, Square } from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';

interface InpaintEditorProps {
  imageUrl: string;
  onSave: (maskBase64: string, prompt: string) => void;
  onCancel: () => void;
  language: Language;
  title?: string;
  description?: string;
  hidePrompt?: boolean;
  saveText?: string;
  cancelText?: string;
  isSemantic?: boolean;
}

export const InpaintEditor: React.FC<InpaintEditorProps> = ({
  imageUrl,
  onSave,
  onCancel,
  language,
  title,
  description,
  hidePrompt,
  saveText,
  cancelText,
  isSemantic
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); // For real-time drawing feedback
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [mode, setMode] = useState<'draw' | 'erase' | 'rect'>('rect');
  const [semanticLayer, setSemanticLayer] = useState<'signage' | 'storefront'>('storefront');
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas) return;

    const ctx = canvas.getContext('2d');
    const bgCtx = bgCanvas.getContext('2d');
    if (!ctx || !bgCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      // Set canvas sizes to match image aspect ratio but fit in container
      const maxWidth = 1000;
      const maxHeight = 700;
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = width * ratio;
      height = height * ratio;

      const canvases = [canvasRef.current, bgCanvasRef.current, previewCanvasRef.current];
      canvases.forEach(c => {
        if (c) {
          c.width = width;
          c.height = height;
        }
      });

      if (bgCtx) bgCtx.drawImage(img, 0, 0, width, height);
      
      // Initialize drawing canvas as transparent black
      if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, width, height);
      }
    };
  }, [imageUrl]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDrawing(true);
    if (mode !== 'rect') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    if (mode === 'rect' && startPos && currentPos) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over';
          if (isSemantic) {
            ctx.fillStyle = semanticLayer === 'signage' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 255, 0.4)';
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          }
          ctx.fillRect(
            startPos.x, 
            startPos.y, 
            currentPos.x - startPos.x, 
            currentPos.y - startPos.y
          );
          setHasDrawn(true);
        }
      }
    }

    // Clear preview canvas
    const pCanvas = previewCanvasRef.current;
    if (pCanvas) {
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const pCanvas = previewCanvasRef.current;
    if (!canvas || !pCanvas) return;
    const ctx = canvas.getContext('2d');
    const pCtx = pCanvas.getContext('2d');
    if (!ctx || !pCtx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setCurrentPos({ x, y });

    if (mode === 'rect' && startPos) {
      pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
      const color = isSemantic && semanticLayer === 'signage' ? 'rgba(255, 0, 0, 1)' : 'rgba(0, 0, 255, 1)';
      const fillColor = isSemantic && semanticLayer === 'signage' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)';
      pCtx.strokeStyle = isSemantic ? color : 'rgba(255, 0, 0, 1)';
      pCtx.lineWidth = 2;
      pCtx.fillStyle = isSemantic ? fillColor : 'rgba(255, 0, 0, 0.2)';
      pCtx.strokeRect(
        startPos.x, 
        startPos.y, 
        x - startPos.x, 
        y - startPos.y
      );
      pCtx.fillRect(
        startPos.x, 
        startPos.y, 
        x - startPos.x, 
        y - startPos.y
      );
      return;
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (mode === 'draw') {
      ctx.globalCompositeOperation = 'source-over';
      if (isSemantic) {
        ctx.strokeStyle = semanticLayer === 'signage' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 0, 255, 0.4)';
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      }
    } else {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || isProcessing) return;

    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      // Create a temporary canvas at the ORIGINAL image scale
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      const mCtx = maskCanvas.getContext('2d');
      if (!mCtx) return;

      // Fill with black (neutral area)
      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      // Draw the user's strokes scaled up to original size
      mCtx.drawImage(canvas, 0, 0, maskCanvas.width, maskCanvas.height);

      // Now process the pixels to ensure pure white/black
      // (The drawImage might have introduced anti-aliasing)
      const strokeData = mCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const maskData = mCtx.createImageData(maskCanvas.width, maskCanvas.height);
      
      for (let i = 0; i < strokeData.data.length; i += 4) {
        const r = strokeData.data[i];
        const g = strokeData.data[i+1];
        const b = strokeData.data[i+2];
        
        // If the pixel is notably different from the background black (0,0,0)
        // it means there's a user stroke here.
        if (r > 10 || b > 10) {
          if (isSemantic) {
            // Check if it's primarily red (signage) or blue (storefront)
            if (r > b) {
              maskData.data[i] = 255;
              maskData.data[i+1] = 0;
              maskData.data[i+2] = 0;
            } else {
              maskData.data[i] = 0;
              maskData.data[i+1] = 0;
              maskData.data[i+2] = 255;
            }
          } else {
            maskData.data[i] = 255;
            maskData.data[i+1] = 255;
            maskData.data[i+2] = 255;
          }
          maskData.data[i+3] = 255;
        } else {
          // Safe area: Black
          maskData.data[i] = 0;
          maskData.data[i+1] = 0;
          maskData.data[i+2] = 0;
          maskData.data[i+3] = 255;
        }
      }
      
      mCtx.putImageData(maskData, 0, 0);
      onSave(maskCanvas.toDataURL('image/png'), prompt);
      setIsProcessing(false);
    };
    img.onerror = () => setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-6xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-8 py-5 border-b flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-2xl">
              <Pencil className="text-red-600 h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">{title || t.partialRerender}</h2>
              <p className="text-xs text-gray-400 font-medium">{description || t.inpaintGuide}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors group">
            <X size={24} className="text-gray-400 group-hover:text-gray-600" />
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 overflow-hidden p-8 bg-gray-50/50 flex flex-col lg:flex-row gap-8">
          {/* Left: Canvas Area */}
          <div className="flex-[3] relative flex items-center justify-center bg-gray-950 rounded-[32px] shadow-2xl overflow-hidden cursor-crosshair group min-h-[50vh] lg:h-[60vh]">
            <canvas ref={bgCanvasRef} className="absolute inset-0 m-auto max-w-full max-h-full object-contain" />
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 m-auto max-w-full max-h-full object-contain z-10 touch-none opacity-80"
              style={{ mixBlendMode: 'plus-lighter' }}
            />
            <canvas 
              ref={previewCanvasRef} 
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="absolute inset-0 m-auto max-w-full max-h-full object-contain z-20 touch-none"
            />
            
            <div className="absolute bottom-6 left-6 z-30 pointer-events-none">
               <div className="bg-black/60 backdrop-blur-lg text-white text-[11px] px-5 py-2.5 rounded-2xl flex items-center gap-2 border border-white/10 shadow-2xl animate-in slide-in-from-bottom-2 duration-500">
                  <Info size={14} className="text-amber-400 shrink-0" />
                  <span className="font-bold tracking-wide">
                    {isSemantic 
                      ? (semanticLayer === 'signage' ? t.markSignage : t.markStorefront)
                      : (mode === 'rect' 
                          ? (language === 'zh' ? '在图片上拖拽以选择矩形区域' : 'Drag on image to select a rectangular area')
                          : (language === 'zh' ? '涂抹区域将作为建议生成的“蒙版”' : 'Painted areas will be used as a mask for generation'))}
                  </span>
               </div>
            </div>
          </div>

          {/* Right: Integrated Sidebar */}
          <div className="flex-[1] flex flex-col gap-6 overflow-y-auto min-w-[280px]">
             {/* Semantic Selection */}
             {isSemantic && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                    {language === 'zh' ? '标注层级' : 'Semantic Layer'}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setSemanticLayer('signage')}
                      className={`p-4 rounded-2xl transition-all flex items-center gap-3 border-2 ${semanticLayer === 'signage' ? 'bg-red-500 border-red-500 text-white shadow-xl shadow-red-100 scale-[1.02]' : 'bg-white border-gray-100 text-gray-500 hover:border-red-200 hover:bg-red-50/50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${semanticLayer === 'signage' ? 'bg-white border-white' : 'bg-gray-100 border-gray-200'}`} />
                      <div className="text-left">
                        <span className="text-sm font-black block leading-none">{t.markSignage.split('(')[0]}</span>
                        <span className={`text-[10px] font-bold ${semanticLayer === 'signage' ? 'text-red-100' : 'text-gray-400'}`}>
                          {language === 'zh' ? '点击标注招牌位置' : 'Mark the Signage Area'}
                        </span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setSemanticLayer('storefront')}
                      className={`p-4 rounded-2xl transition-all flex items-center gap-3 border-2 ${semanticLayer === 'storefront' ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 scale-[1.02]' : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:bg-blue-50/50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 ${semanticLayer === 'storefront' ? 'bg-white border-white' : 'bg-gray-100 border-gray-200'}`} />
                      <div className="text-left">
                        <span className="text-sm font-black block leading-none">{t.markStorefront.split('(')[0]}</span>
                        <span className={`text-[10px] font-bold ${semanticLayer === 'storefront' ? 'text-blue-100' : 'text-gray-400'}`}>
                          {language === 'zh' ? '点击标注店面范围' : 'Mark the Facade Area'}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Tools Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                  {language === 'zh' ? '绘图工具' : 'Drawing Tools'}
                </label>
                <div className="bg-white p-2 rounded-2xl border-2 border-gray-100 flex items-center justify-between">
                  <button 
                    onClick={() => setMode('rect')}
                    className={`p-3 rounded-xl transition-all flex-1 flex flex-col items-center gap-1 ${mode === 'rect' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                    title="Rectangle"
                  >
                    <Square size={20} />
                    <span className="text-[9px] font-black uppercase">{language === 'zh' ? '选框' : 'Rect'}</span>
                  </button>
                  <button 
                    onClick={() => setMode('draw')}
                    className={`p-3 rounded-xl transition-all flex-1 flex flex-col items-center gap-1 ${mode === 'draw' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                    title="Brush"
                  >
                    <Pencil size={20} />
                    <span className="text-[9px] font-black uppercase">{language === 'zh' ? '画笔' : 'Brush'}</span>
                  </button>
                  <button 
                    onClick={() => setMode('erase')}
                    className={`p-3 rounded-xl transition-all flex-1 flex flex-col items-center gap-1 ${mode === 'erase' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                    title="Eraser"
                  >
                    <Eraser size={20} />
                    <span className="text-[9px] font-black uppercase">{language === 'zh' ? '橡皮' : 'Eraser'}</span>
                  </button>
                  <div className="w-px h-8 bg-gray-100 mx-1" />
                  <button 
                    onClick={clearCanvas}
                    className="p-3 text-gray-400 hover:bg-gray-50 hover:text-red-500 rounded-xl transition-all flex-1 flex flex-col items-center gap-1"
                    title="Clear"
                  >
                    <Trash2 size={20} />
                    <span className="text-[9px] font-black uppercase">{language === 'zh' ? '清空' : 'Clear'}</span>
                  </button>
                </div>
              </div>

              {/* Brush Settings */}
              {mode !== 'rect' && (
                <div className="bg-white p-5 rounded-3xl border-2 border-gray-100 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.brushSize}</span>
                    <span className="text-xs font-black text-red-600">{brushSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-red-600"
                  />
                </div>
              )}

              {/* Prompt Area Integrated */}
              {!hidePrompt && (
                <div className="space-y-3 flex-1 flex flex-col">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                    {language === 'zh' ? '生成提示词' : 'Generation Prompts'}
                  </label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t.inpaintPromptPlaceholder}
                    className="w-full h-32 bg-white border-2 border-gray-100 rounded-[28px] px-5 py-4 text-sm font-bold text-gray-700 outline-none focus:border-red-500/50 focus:ring-4 focus:ring-red-500/5 transition-all resize-none shadow-sm flex-1"
                  />
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-amber-700 font-bold leading-relaxed uppercase">
                      {language === 'zh' ? '提示：AI 将自动根据环境光影渲染 3D 招牌，无需手动添加阴影' : 'Tip: AI will automatically render 3D signage with shadows based on ambient light'}
                    </p>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-gray-50 border-t flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
                <Info size={20} />
             </div>
             <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">
                {language === 'zh' ? '提示：请在图片上标注您想要改造的旧门头范围和墙面区域' : 'Tip: Mark the old facade and wall areas you want to renovate'}
             </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onCancel}
              className="px-8 py-3.5 rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-200 transition-all active:scale-95 flex-1 sm:flex-none uppercase tracking-widest"
            >
              {cancelText || t.cancel}
            </button>
            <button 
              onClick={handleSave}
              disabled={(!hidePrompt && !prompt.trim()) || !hasDrawn || isProcessing}
              className="px-10 py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none text-white rounded-2xl text-sm font-black shadow-2xl shadow-red-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 sm:flex-none min-w-[180px] uppercase tracking-widest"
            >
              <CheckCircle size={20} className={isProcessing ? 'animate-spin' : ''} />
              {isProcessing ? (language === 'zh' ? '处理中...' : 'Processing...') : (saveText || (hidePrompt ? t.confirm : t.startInpaint))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
