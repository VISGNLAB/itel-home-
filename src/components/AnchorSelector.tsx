import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCcw, MapPin, Undo2 } from 'lucide-react';

interface AnchorSelectorProps {
  image: string;
  onConfirm: (vertices: { x: number, y: number }[]) => void;
  onCancel: () => void;
  language: 'zh' | 'en';
}

export const AnchorSelector: React.FC<AnchorSelectorProps> = ({ image, onConfirm, onCancel, language }) => {
  const [points, setPoints] = useState<{ x: number, y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (points.length >= 4) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;

    setPoints([...points, { x, y }]);
  };

  const vertexNames = language === 'zh' 
    ? ['左上 (Top-Left)', '右上 (Top-Right)', '右下 (Bottom-Right)', '左下 (Bottom-Left)']
    : ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
               <MapPin size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                {language === 'zh' ? '手动空间校准：标定整体渲染区域' : 'Manual Spatial Calibration: Define Render Zone'}
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mt-1">
                {language === 'zh' ? '请依次点击「整个将要改造的店面外立面」（包含上方招牌和下方门面主立面）的 4 个角' : 'Click the 4 corners of the ENTIRE storefront facade to be rendered (including sign & entrance) in sequence'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="relative flex-1 bg-gray-200 flex items-center justify-center min-h-[400px] cursor-crosshair">
          <div 
            ref={containerRef}
            className="relative shadow-lg max-h-[70vh] group"
            onClick={handleCanvasClick}
          >
            <img 
              src={image} 
              alt="Environment" 
              className="max-h-[70vh] max-w-full object-contain pointer-events-none"
            />
            
            {/* SVG Overlay for points and lines */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              {points.length > 0 && points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="10" fill="#FF0000" stroke="#FFFFFF" strokeWidth="2" />
                  <text 
                    x={p.x + 15} 
                    y={p.y + 15} 
                    fill="#FFFFFF" 
                    className="text-[24px] font-bold"
                    style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
                  >
                    {i + 1}
                  </text>
                </g>
              ))}

              {points.length > 1 && (
                <path 
                  d={`M ${points[0].x} ${points[0].y} ${points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')} ${points.length === 4 ? 'Z' : ''}`}
                  fill={points.length === 4 ? 'rgba(255, 0, 0, 0.2)' : 'none'}
                  stroke="#FF0000"
                  strokeWidth="3"
                  strokeDasharray={points.length === 4 ? "0" : "10,10"}
                />
              )}
            </svg>

            {/* Guide Text Overlay */}
            {points.length < 4 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-2 rounded-full border border-white/20 text-white text-xs font-bold animate-pulse">
                {language === 'zh' ? `点击确定第 ${points.length + 1} 点: ${vertexNames[points.length]}` : `Click to define Point ${points.length + 1}: ${vertexNames[points.length]}`}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setPoints(points.slice(0, -1))}
              disabled={points.length === 0}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Undo2 size={14} />
              {language === 'zh' ? '撤销 (Undo)' : 'Undo'}
            </button>
            <button
              onClick={() => setPoints([])}
              disabled={points.length === 0}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <RotateCcw size={14} />
              {language === 'zh' ? '重置 (Reset)' : 'Reset'}
            </button>
          </div>

          <div className="flex gap-3">
             <button
              onClick={onCancel}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all"
            >
              {language === 'zh' ? '取消 (Cancel)' : 'Cancel'}
            </button>
            <button
              onClick={() => onConfirm(points)}
              disabled={points.length !== 4}
              className="px-8 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
            >
              <Check size={16} />
              {language === 'zh' ? '确认同步坐标 (Confirm Anchors)' : 'Confirm Anchors'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
