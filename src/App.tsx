import React, { useState } from 'react';
import { Header } from './components/Header';
import { Upload, Image as ImageIcon, Loader2, Download, AlertCircle, Store, X } from 'lucide-react';
import { generateStoreRendering } from './services/geminiService';

export default function App() {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [environmentImage, setEnvironmentImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [tier, setTier] = useState<string>('T3-T4');
  const [renderAngle, setRenderAngle] = useState<string>('front_panorama');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [environmentDetails, setEnvironmentDetails] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnvImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEnvironmentImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeEnvImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEnvironmentImage(null);
  };

  const removeLogoImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLogoImage(null);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateStoreRendering(tier, renderAngle, aspectRatio, environmentDetails, referenceImage || undefined, environmentImage || undefined, logoImage || undefined);
      setGeneratedImage(result);
    } catch (err: any) {
      setError(err.message || '生成图片失败，请重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const a = document.createElement('a');
      a.href = generatedImage;
      a.download = `itel-home-${tier.toLowerCase()}-render.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">生成本地化门店实景渲染图</h2>
          <p className="text-gray-600 mt-1">上传您的基础3D效果图，并根据门店级别应用真实的尼日利亚街道环境和人流特征。</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Configuration */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-5">渲染配置</h3>
              
              {/* Reference Image */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  基础3D效果图（必填）
                </label>
                <div className="mt-1 flex justify-center px-6 pt-4 pb-4 border-2 border-gray-300 border-dashed rounded-xl hover:border-red-500 transition-colors relative group bg-gray-50">
                  <div className="space-y-1 text-center">
                    {referenceImage ? (
                      <div className="relative">
                        <img src={referenceImage} alt="Reference" className="mx-auto h-24 object-contain rounded-lg shadow-sm" />
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <p className="text-white text-xs font-medium">点击更换</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-2 rounded-full inline-block shadow-sm mb-1">
                        <Upload className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                        <span>上传文件</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleImageUpload} />
                </div>
              </div>

              {/* Environment Image */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  实景环境参考图（可选）
                </label>
                <div className="mt-1 flex justify-center px-6 pt-4 pb-4 border-2 border-gray-300 border-dashed rounded-xl hover:border-red-500 transition-colors relative group bg-gray-50">
                  <div className="space-y-1 text-center w-full">
                    {environmentImage ? (
                      <div className="relative inline-block">
                        <img src={environmentImage} alt="Environment" className="mx-auto h-24 object-contain rounded-lg shadow-sm" />
                        <button
                          onClick={removeEnvImage}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors z-10"
                          title="删除图片"
                        >
                          <X size={16} />
                        </button>
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                          <p className="text-white text-xs font-medium">点击更换</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-2 rounded-full inline-block shadow-sm mb-1">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex text-sm text-gray-600 justify-center mt-2">
                      <label htmlFor="env-file-upload" className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                        <span>上传实景图</span>
                        <input id="env-file-upload" name="env-file-upload" type="file" className="sr-only" accept="image/*" onChange={handleEnvImageUpload} />
                      </label>
                    </div>
                  </div>
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleEnvImageUpload} title="" />
                </div>
              </div>

              {/* Logo Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo 样式参考（可选）
                </label>
                <div className="mt-1 flex justify-center px-6 pt-4 pb-4 border-2 border-gray-300 border-dashed rounded-xl hover:border-red-500 transition-colors relative group bg-gray-50">
                  <div className="space-y-1 text-center w-full">
                    {logoImage ? (
                      <div className="relative inline-block">
                        <img src={logoImage} alt="Logo" className="mx-auto h-24 object-contain rounded-lg shadow-sm" />
                        <button
                          onClick={removeLogoImage}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors z-10"
                          title="删除图片"
                        >
                          <X size={16} />
                        </button>
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                          <p className="text-white text-xs font-medium">点击更换</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-2 rounded-full inline-block shadow-sm mb-1">
                        <ImageIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex text-sm text-gray-600 justify-center mt-2">
                      <label htmlFor="logo-file-upload" className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                        <span>上传 Logo</span>
                        <input id="logo-file-upload" name="logo-file-upload" type="file" className="sr-only" accept="image/*" onChange={handleLogoImageUpload} />
                      </label>
                    </div>
                  </div>
                  <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoImageUpload} title="" />
                </div>
              </div>

              {/* Tier Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  门店级别
                </label>
                <div className="space-y-3">
                  {[
                    { id: 'T1-T2', label: 'T1-T2 核心城市（旗舰店/形象店）', desc: '拉各斯、阿布贾等。最高规格全套SI，优质用材与灯光，核心展示面精装。' },
                    { id: 'T3-T4', label: 'T3-T4 区域城市（标准店）', desc: '埃努古、瓦里等。统一基础SI，精简体验区与工艺，通用道具标准化复用。' },
                    { id: 'T5', label: 'T5及以下 下沉市场（乡村精简店）', desc: '县镇、乡村。极简SI，仅保留基础标识，基础墙地顶处理，道具轻量化。' }
                  ].map((t) => (
                    <label key={t.id} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${tier === t.id ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          type="radio"
                          name="tier"
                          value={t.id}
                          checked={tier === t.id}
                          onChange={(e) => setTier(e.target.value)}
                          className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <span className="font-semibold text-gray-900 block">{t.label}</span>
                        <span className="text-gray-500 mt-0.5 block">{t.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Render Angle Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  渲染视角与细节重点
                </label>
                <div className="space-y-3">
                  {[
                    { id: 'front_panorama', label: '店铺正面全景图', desc: '完整展示外立面、门头、大门类型，可清晰识别整体形象。' },
                    { id: 'interior_perspective', label: '店内全视角透视图', desc: '呈现店内全部空间、动线、陈列、道具，一览无余，无死角。' },
                    { id: 'detail_closeup', label: '局部细节特写图', desc: '门头、材质、工艺、灯具、物料接口等关键节点特写。' },
                    { id: 'exposed_ceiling', label: '裸露天花专项图', desc: '无吊顶封板，仅保留吊灯，清晰呈现裸露天花结构。' },
                    { id: 'floor_special', label: '地面专项图', desc: '无遮挡展示地面材质，明确区分地砖铺设或素水泥地面。' }
                  ].map((angle) => (
                    <label key={angle.id} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${renderAngle === angle.id ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>
                      <div className="flex items-center h-5 mt-0.5">
                        <input
                          type="radio"
                          name="render-angle"
                          value={angle.id}
                          checked={renderAngle === angle.id}
                          onChange={(e) => setRenderAngle(e.target.value)}
                          className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <span className="font-semibold text-gray-900 block">{angle.label}</span>
                        <span className="text-gray-500 mt-0.5 block">{angle.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  渲染尺寸比例
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: '16:9', label: '16:9', desc: '横向宽屏' },
                    { id: '3:4', label: '3:4', desc: '竖向海报' },
                    { id: '1:1', label: '1:1', desc: '正方形' }
                  ].map((ratio) => (
                    <label key={ratio.id} className={`flex flex-col items-center justify-center p-3 border rounded-xl cursor-pointer transition-all text-center ${aspectRatio === ratio.id ? 'border-red-500 bg-red-50 ring-1 ring-red-500 text-red-700' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700'}`}>
                      <input
                        type="radio"
                        name="aspect-ratio"
                        value={ratio.id}
                        checked={aspectRatio === ratio.id}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="sr-only"
                      />
                      <span className="font-semibold block">{ratio.label}</span>
                      <span className="text-xs opacity-70 mt-1">{ratio.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Environment Details */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  补充环境细节
                </label>
                <textarea
                  rows={3}
                  className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-xl p-3 border resize-none"
                  placeholder="例如：晴天，有很多黄色三轮车（Keke Napep），路面有些灰尘..."
                  value={environmentDetails}
                  onChange={(e) => setEnvironmentDetails(e.target.value)}
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    正在渲染环境...
                  </>
                ) : (
                  '生成实景渲染图'
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-full min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-semibold text-gray-900">渲染结果</h3>
                {generatedImage && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <Download className="-ml-1 mr-2 h-4 w-4 text-gray-500" />
                    下载图片
                  </button>
                )}
              </div>

              {error && (
                <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-sm text-red-800 font-medium">{error}</p>
                </div>
              )}

              <div className="flex-1 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative">
                {isGenerating ? (
                  <div className="text-center p-8">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                      <Store className="absolute inset-0 m-auto h-8 w-8 text-red-600" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">正在应用尼日利亚街道环境...</p>
                    <p className="text-gray-500 text-sm mt-2">正在分析参考图并生成逼真的实景环境。这可能需要 10-20 秒。</p>
                  </div>
                ) : generatedImage ? (
                  <img src={generatedImage} alt="Generated Render" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-gray-400 p-8">
                    <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-4">
                      <ImageIcon className="h-12 w-12 text-gray-300" />
                    </div>
                    <p className="font-medium text-gray-600">暂无渲染图</p>
                    <p className="text-sm mt-1">上传参考图，选择门店级别，然后点击生成</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
