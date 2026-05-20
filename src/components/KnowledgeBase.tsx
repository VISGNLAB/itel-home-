import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Loader2, Save, History, RefreshCcw, BookOpen, Layers, Edit3, Code, Eye, AlertTriangle, RotateCcw, CheckCircle2, Plus, Trash2, Box, FileCheck, ShieldCheck } from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';
import { evolveBrandStandards } from '../services/geminiService';
import { updateSystemConfig } from '../firebase';
import { ITEL_HOME_STANDARDS, BRAND_LOGO_GUIDELINE, MATERIAL_LIBRARY } from '../constants/standards';
import { toast } from 'sonner';

interface KnowledgeBaseProps {
  language: Language;
  brandStandards: {
    itel_home_standards: any;
    brand_logo_guideline: any;
    material_library: any;
  } | null;
  onUpdateStandards: (newStandards: any) => void;
  verifiedExamples?: any[];
}

type ViewMode = 'ai' | 'edit' | 'json';

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  language,
  brandStandards,
  onUpdateStandards,
  verifiedExamples = []
}) => {
  const [instruction, setInstruction] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('ai');
  const [localStandards, setLocalStandards] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEvolving, setIsEvolving] = useState(false);
  const t = TRANSLATIONS[language];

  // Initialize local standards when brandStandards prop changes
  useEffect(() => {
    if (brandStandards && !localStandards) {
      setLocalStandards(JSON.parse(JSON.stringify(brandStandards)));
    }
  }, [brandStandards]);

  const handleEvolve = async () => {
    if (!instruction.trim() || !brandStandards) return;

    setIsEvolving(true);
    const toastId = toast.loading(t.evolving);

    try {
      const evolved = await evolveBrandStandards(instruction, brandStandards);
      
      // Update local and parent state
      setLocalStandards(evolved);
      onUpdateStandards(evolved);
      
      // Persist to database
      await updateSystemConfig('brand_standards', evolved);
      
      setInstruction('');
      toast.success(language === 'zh' ? '品牌标准已通过 AI 成功进化！' : 'Brand standards successfully evolved by AI!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(language === 'zh' ? `调整失败: ${err.message}` : `Evolution failed: ${err.message}`, { id: toastId });
    } finally {
      setIsEvolving(false);
    }
  };

  const handleManualSave = async () => {
    if (!localStandards) return;
    
    setIsSaving(true);
    const toastId = toast.loading(language === 'zh' ? '正在同步至云端...' : 'Syncing to cloud...');

    try {
      // Sync parent state
      onUpdateStandards(localStandards);
      
      // Persist to database (SQLite / System Config)
      await updateSystemConfig('brand_standards', localStandards);
      
      toast.success(language === 'zh' ? '手动修改已成功保存至云端标准库' : 'Manual changes saved to cloud knowledge base', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(language === 'zh' ? '保存失败' : 'Save failed', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToSystemDefault = () => {
    const defaults = {
      itel_home_standards: ITEL_HOME_STANDARDS,
      brand_logo_guideline: BRAND_LOGO_GUIDELINE,
      material_library: MATERIAL_LIBRARY
    };
    setLocalStandards(defaults);
    toast.info(language === 'zh' ? '已恢复系统初始默认值（尚未保存）' : 'Restored to system defaults (not yet saved)');
  };

  const updateProp = (category: string, subCategory: string, key: string, value: string) => {
    if (!localStandards) return;
    const updated = { ...localStandards };
    if (updated[category] && updated[category][subCategory]) {
      updated[category][subCategory][key] = value;
      setLocalStandards(updated);
    }
  };

  const deleteProp = (category: string, subCategory: string, key: string) => {
    if (!localStandards) return;
    const updated = { ...localStandards };
    if (updated[category] && updated[category][subCategory]) {
      delete updated[category][subCategory][key];
      setLocalStandards({ ...updated });
    }
  };

  const addNewProp = (category: string, subCategory: string) => {
    const key = window.prompt(language === 'zh' ? '请输入新标准的名称 (例如: Table_Type)' : 'Enter name for the new standard (e.g., Table_Type)');
    if (!key) return;
    
    // Normalize key to camelCase/snake_case
    const formattedKey = key.trim().replace(/\s+/g, '_');
    
    if (!localStandards) return;
    const updated = { ...localStandards };
    if (updated[category] && updated[category][subCategory]) {
      if (updated[category][subCategory][formattedKey]) {
        toast.error(language === 'zh' ? '该标准已存在' : 'This standard already exists');
        return;
      }
      updated[category][subCategory][formattedKey] = language === 'zh' ? '在此输入标准描述...' : 'Enter standard description here...';
      setLocalStandards({ ...updated });
    }
  };

  const CategoryCard = ({ icon: Icon, title, category, subCategory, colorClass }: { icon: any, title: string, category: string, subCategory: string, colorClass: string }) => {
    if (!localStandards || !localStandards[category] || !localStandards[category][subCategory]) return null;
    
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md hover:border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${colorClass.replace('text-', 'bg-').replace('600', '50')} border border-current/5`}>
              <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
            </div>
            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-tight">
              {title}
            </h3>
          </div>
          <button 
            onClick={() => addNewProp(category, subCategory)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all border border-transparent hover:border-red-100"
            title={language === 'zh' ? '新增标准' : 'Add New Standard'}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(localStandards[category][subCategory]).map(([key, value]) => (
              key !== 'audit' && (
                <div key={key} className="group space-y-1 relative">
                  <div className="flex items-center justify-between px-0.5">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider font-mono">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                    <button 
                      onClick={() => deleteProp(category, subCategory, key)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <div className="relative group/input">
                    <textarea 
                      value={value as string}
                      onChange={(e) => updateProp(category, subCategory, key, e.target.value)}
                      className="w-full p-2.5 bg-gray-50/50 border border-gray-100 rounded-xl text-[10px] leading-snug focus:bg-white focus:ring-2 focus:ring-red-500/5 focus:border-red-500 transition-all min-h-[50px] resize-none shadow-inner font-medium text-gray-600"
                      placeholder={language === 'zh' ? '输入描述细节...' : 'Enter description details...'}
                    />
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    );
  };

  const guidelineStats = {
    tiers: brandStandards?.itel_home_standards?.facade ? Object.keys(brandStandards.itel_home_standards.facade).length : 4,
    props: brandStandards?.material_library?.props ? Object.keys(brandStandards.material_library.props).length : 12,
    logos: brandStandards?.brand_logo_guideline?.primary?.types ? Object.keys(brandStandards.brand_logo_guideline.primary.types).length : 3
  };

  const handleExportStandards = () => {
    if (!localStandards) return;
    
    toast.info(language === 'zh' ? '正在生成品牌标准文档...' : 'Generating brand standards document...');
    
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `itel_Home_SI_Guidelines_${timestamp}.md`;
    
    let content = `# itel Home SI 智能生成引擎内核 V2.1\n\n`;
    content += `**导出日期:** ${new Date().toLocaleString()}\n\n`;
    content += `---\n\n`;

    // Add SI Standards
    content += `## 1. 门店分级标准 (Tier Standards)\n\n`;
    if (localStandards.itel_home_standards?.facade) {
      Object.entries(localStandards.itel_home_standards.facade).forEach(([tier, desc]) => {
        content += `### ${tier}\n${desc}\n\n`;
      });
    }

    // Add Logo Guidelines
    content += `## 2. 品牌标志守卫 (Logo Integrity)\n\n`;
    if (localStandards.brand_logo_guideline?.primary) {
      Object.entries(localStandards.brand_logo_guideline.primary).forEach(([key, val]) => {
        if (typeof val === 'string') {
          content += `**${key.toUpperCase()}:** ${val}\n\n`;
        } else if (typeof val === 'object' && val !== null) {
          content += `### ${key}\n`;
          Object.entries(val).forEach(([k, v]) => {
            content += `- **${k}:** ${v}\n`;
          });
          content += `\n`;
        }
      });
    }

    // Add Material Library
    content += `## 3. 道具物料清单 (Material Library)\n\n`;
    if (localStandards.material_library) {
      Object.entries(localStandards.material_library).forEach(([cat, items]) => {
        content += `### ${cat.toUpperCase()}\n`;
        if (typeof items === 'object' && items !== null) {
           Object.entries(items).forEach(([k, v]) => {
             if (k !== 'audit') {
               content += `- **${k}:** ${v}\n`;
             }
           });
        }
        content += `\n`;
      });
    }

    content += `\n---\n\n*文档由 itel Home SI Engine 自动生成。内部资料，严禁外泄。*`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(language === 'zh' ? '完整标准文档导出成功！' : 'Full standards document exported!');
  };

  if (!brandStandards || !localStandards) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>{language === 'zh' ? '正在同步全球品牌库...' : 'Syncing Global Knowledge Base...'}</p>
      </div>
    );
  }

  return (
    <div className="w-[98%] 2xl:max-w-screen-2xl mx-auto p-2 lg:p-6 space-y-6 min-h-screen font-sans selection:bg-red-100 selection:text-red-900 transition-all duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 bg-red-600 rounded-lg shadow-lg shadow-red-600/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter text-gray-900 uppercase">
              {t.brandLab}
              <span className="ml-2 text-[10px] font-mono font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded italic">v2.2.0</span>
            </h2>
          </div>
          <p className="text-gray-500 text-[11px] font-medium tracking-tight pl-9">{t.brandLabSubtitle}</p>
        </div>
        
        <div className="flex items-center bg-gray-100/50 backdrop-blur-sm border border-gray-200 rounded-xl p-1 shadow-inner">
          <button
            onClick={() => setViewMode('ai')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold transition-all duration-300 ${viewMode === 'ai' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Sparkles className="w-3 h-3" />
            {t.aiMode}
          </button>
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold transition-all duration-300 ${viewMode === 'edit' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Edit3 className="w-3 h-3" />
            {t.editMode}
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold transition-all duration-300 ${viewMode === 'json' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Code className="w-3 h-3" />
            {t.jsonMode}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-8">
          {viewMode === 'ai' && (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 lg:p-10 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none scale-125 origin-top-right">
                <Brain className="w-64 h-64" />
              </div>
              
              <div className="max-w-4xl relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                  <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
                    {t.aiLearningPrompt}
                  </h3>
                </div>
                
                <p className="text-gray-500 text-[11px] mb-6 leading-relaxed max-w-xl">
                  Evolve SI design language dynamically via natural language. AI will reconstruct core visual logic standards.
                </p>
                
                <div className="relative group bg-gray-50/50 p-2 rounded-2xl border border-gray-100 shadow-inner">
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder={t.aiLearningPlaceholder}
                    className="w-full h-40 p-4 bg-transparent border-none focus:ring-0 text-base leading-relaxed resize-none font-medium placeholder:text-gray-300"
                  />
                  <div className="p-3 flex justify-between items-center bg-white rounded-xl border border-gray-100 shadow-sm mt-1">
                    <div className="flex items-center gap-2 text-[8px] font-mono text-gray-400 uppercase tracking-widest pl-2">
                      <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                      Syncing
                    </div>
                    <button
                      onClick={handleEvolve}
                      disabled={isEvolving || !instruction.trim()}
                      className="flex items-center gap-2 bg-gray-900 text-white px-8 py-2.5 rounded-lg hover:bg-black disabled:bg-gray-200 transition-all font-bold text-xs shadow-lg active:scale-95 group"
                    >
                      {isEvolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-red-500" />}
                      {isEvolving ? t.evolving : t.evolve}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'edit' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Header for Edit Mode - Ultra Compact */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gray-900 p-6 lg:px-8 rounded-3xl shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 blur-[80px] rounded-full -mr-16 -mt-16 group-hover:bg-red-600/15 transition-all duration-1000" />
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-500">
                    <Edit3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
                      SI Protocol Editor
                      <span className="text-[8px] font-mono text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-full">v2.1</span>
                    </h3>
                    <p className="text-[9px] text-gray-400 font-medium font-mono uppercase tracking-widest">Manual Standard Override</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                  <button 
                    onClick={resetToSystemDefault}
                    className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold text-gray-400 hover:text-white transition-all rounded-lg border border-white/10"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {t.resetDefault}
                  </button>
                  <button 
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-8 py-2.5 bg-red-600 text-white text-[11px] font-black rounded-lg shadow-xl shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 group"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {t.saveChanges}
                  </button>
                </div>
              </div>

              {/* Status Alert Bar - Compact */}
              <div className="flex items-center justify-between px-6 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[10px] font-bold text-gray-900 uppercase tracking-tight">Active Protection Layer</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-mono text-gray-400 uppercase tracking-widest">LIVE SYNC</span>
                </div>
              </div>

              {/* Responsive Grid Layout - Rebalanced & Tighter */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                <div className="md:col-span-2 xl:col-span-2">
                  <CategoryCard 
                    icon={Layers}
                    title={t.standardCategory.props}
                    category="material_library"
                    subCategory="props"
                    colorClass="text-blue-600"
                  />
                </div>
                
                <CategoryCard 
                  icon={Eye}
                  title={t.standardCategory.lighting}
                  category="material_library"
                  subCategory="lighting"
                  colorClass="text-orange-600"
                />
                <CategoryCard 
                  icon={Box}
                  title="Ceiling"
                  category="material_library"
                  subCategory="ceiling"
                  colorClass="text-purple-600"
                />
                <CategoryCard 
                  icon={RefreshCcw}
                  title="Flooring"
                  category="material_library"
                  subCategory="flooring"
                  colorClass="text-green-600"
                />
              </div>
            </div>
          )}

          {viewMode === 'json' && (
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800 animate-in zoom-in-95 duration-300">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-mono text-gray-400">knowledge_base.json</span>
                  </div>
                  <button 
                    onClick={handleManualSave}
                    className="text-[10px] font-bold text-white bg-blue-600 px-3 py-1 rounded hover:bg-blue-700 transition-all"
                  >
                    DEPLOY RAW
                  </button>
               </div>
               <textarea
                value={JSON.stringify(localStandards, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setLocalStandards(parsed);
                  } catch (err) {}
                }}
                className="w-full h-[600px] bg-black/30 border border-white/5 rounded-xl p-6 font-mono text-xs text-blue-300 focus:ring-0 focus:outline-none scroll-smooth resize-none custom-scrollbar"
               />
            </div>
          )}
        </div>

        {/* Sidebar Status & Stats - Compact UI */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6 h-full">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm relative overflow-hidden group">
            <h3 className="text-[10px] font-black text-gray-400 mb-6 flex items-center gap-2 uppercase tracking-[0.15em] relative z-10">
              <BookOpen className="w-3.5 h-3.5 text-gray-400" />
              {t.currentStandards}
            </h3>
            
            <div className="space-y-4 relative z-10">
              <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex items-center gap-4 transition-all hover:bg-white group/item">
                <div className="w-10 h-10 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Protocol Sync</p>
                  <p className="text-xs font-black text-gray-900 mt-0.5 tracking-tight">Active</p>
                </div>
              </div>

               <div className="p-4 bg-gray-50/30 rounded-2xl border border-gray-100 space-y-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200/60 pb-2 flex items-center gap-2">
                  Analytics
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-gray-500 uppercase">Tiers</span>
                    <span className="font-mono font-black text-gray-900">{guidelineStats.tiers}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-gray-500 uppercase">Props</span>
                    <span className="font-mono font-black text-gray-900">{guidelineStats.props}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-gray-500 uppercase">Styles</span>
                    <span className="font-mono font-black text-gray-900">{guidelineStats.logos}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
               <button 
                 onClick={handleExportStandards}
                 className="w-full bg-gray-900 text-white rounded-xl py-3 text-[10px] font-black transition-all flex items-center justify-center gap-2 hover:bg-black shadow-lg shadow-black/10 active:scale-95 group/btn"
               >
                 <FileCheck className="w-3.5 h-3.5 text-red-500" />
                 EXPORT PROTOCOL
               </button>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
             <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 shadow-inner group-hover:rotate-12 transition-transform">
                     <Sparkles className="w-4 h-4 text-red-400" />
                   </div>
                   <h4 className="font-black text-xs tracking-tighter uppercase">R2 Library</h4>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
             </div>

             <div className="grid grid-cols-2 gap-3 relative z-10 mb-6">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/[0.08] transition-colors group/stat">
                   <span className="text-[8px] font-black text-gray-500 uppercase block mb-1">Photos</span>
                   <span className="text-lg font-black text-red-400 block">{verifiedExamples.filter(e => e.sampleType === 'photo').length}</span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/[0.08] transition-colors group/stat">
                   <span className="text-[8px] font-black text-gray-400 uppercase block mb-1">Renders</span>
                   <span className="text-lg font-black text-blue-400 block">{verifiedExamples.filter(e => e.sampleType === 'render' || !e.sampleType).length}</span>
                </div>
             </div>

             <div className="flex items-center gap-3 relative z-10 pt-4 border-t border-white/5">
                <div className="flex -space-x-2">
                   {verifiedExamples.slice(0, 4).map((e, i) => (
                     <div key={i} className="w-7 h-7 rounded-full border-2 border-gray-900 overflow-hidden bg-gray-800 flex items-center justify-center shadow-md">
                        {e.imageUrl ? (
                          <img src={e.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="text-[7px] font-black text-white/30">R2</div>
                        )}
                     </div>
                   ))}
                </div>
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Live Harvest</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
