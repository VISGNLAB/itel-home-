import React, { useState, useEffect, useRef } from 'react';
import { Calculator, Save, X, Edit2, Loader2, AlertCircle, Sparkles, Upload, FileText, Plus, Package, Truck, ShieldCheck, RefreshCcw } from 'lucide-react';
import { TRANSLATIONS, Language } from '../constants/translations';
import { UserProfile } from '../firebase';
import { toast } from 'sonner';
import { importBOMData } from '../services/geminiService';

interface Material {
  id: string;
  category: string;
  partNumber: string;
  name: string;
  unit: string;
  price: number;
  updatedAt: string;
}

interface CountryLogistics {
  id: string;
  name: string;
  multiplier: number;
}

interface BOMCalculatorProps {
  language: Language;
  userProfile: UserProfile | null;
}

export function BOMCalculator({ language, userProfile }: BOMCalculatorProps) {
  const t = TRANSLATIONS[language];
  const [materials, setMaterials] = useState<Material[]>([]);
  const [countries, setCountries] = useState<CountryLogistics[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Material Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMaterial, setEditMaterial] = useState<Partial<Material>>({});
  
  // Country Management State
  const [isManagingCountries, setIsManagingCountries] = useState(false);
  const [editingCountryId, setEditingCountryId] = useState<string | null>(null);
  const [editCountry, setEditCountry] = useState<Partial<CountryLogistics>>({});
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile?.role === 'admin';

  const handleAIImport = async (input: string | { data: string; mimeType: string }) => {
    try {
      setIsImporting(true);
      const toastId = toast.loading(language === 'zh' ? '正在智能提取物料数据...' : 'Extracting material data...');
      
      const extractedData = await importBOMData(input);
      
      if (!Array.isArray(extractedData)) {
        throw new Error('Invalid AI response format');
      }

      // Merge identical items in extracted data (Deduplicate)
      const mergedData: any[] = [];
      extractedData.forEach(item => {
        const existing = mergedData.find(m => 
          (item.partNumber && m.partNumber === item.partNumber) || 
          (item.name && m.name === item.name)
        );
        if (existing) {
          // Update price if new one is provided and non-zero
          if (item.price > 0) existing.price = item.price;
        } else {
          // Default quantity to 1 as per user request
          mergedData.push({ ...item, quantity: 1 });
        }
      });

      // Update materials and quantities
      const newMaterials = [...materials];
      const newQuantities = { ...quantities };
      
      for (const item of mergedData) {
        // Try to find matching material in master list
        let material = newMaterials.find(m => 
          (item.partNumber && m.partNumber === item.partNumber) || 
          (item.name && m.name === item.name)
        );

        if (!material) {
          // If not found, create a local representation
          const localId = item.partNumber ? `temp-${item.partNumber}-${Date.now()}` : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          material = {
            id: localId,
            category: item.category || 'Others',
            partNumber: item.partNumber || 'AUTO-EXTRACTED',
            name: item.name || 'Unknown Material',
            unit: item.unit || 'pcs',
            price: item.price || 0,
            updatedAt: new Date().toISOString()
          };
          newMaterials.push(material);

          // If user is admin, also try to persist it to the master database
          if (isAdmin) {
            try {
              const res = await fetch('/api/bom/materials/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  category: material.category,
                  partNumber: material.partNumber,
                  name: material.name,
                  unit: material.unit,
                  price: material.price,
                  userId: userProfile?.uid
                })
              });
              if (res.ok) {
                const { id } = await res.json();
                // Replace temp ID with real ID from DB
                const realMaterial = { ...material, id };
                const index = newMaterials.findIndex(m => m.id === localId);
                if (index !== -1) newMaterials[index] = realMaterial;
                material = realMaterial;
              }
            } catch (err) {
              console.error('Failed to persist material to DB:', err);
            }
          }
        } else if (isAdmin && item.price > 0 && item.price !== material.price) {
          // Update price if different and user is admin
          await fetch('/api/bom/materials/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...material,
              price: item.price,
              userId: userProfile?.uid
            })
          });
          material.price = item.price;
        }

        if (material) {
          // Set quantity to 1 for items found in the import
          newQuantities[material.id] = 1;
        }
      }

      setMaterials(newMaterials);
      setQuantities(newQuantities);
      setShowImportModal(false);
      setImportText('');
      toast.success(language === 'zh' ? '智能导入成功！' : 'AI Import successful!', { id: toastId });
    } catch (error) {
      console.error('AI Import Error:', error);
      toast.error(language === 'zh' ? '智能导入失败，请重试' : 'AI Import failed, please try again');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const data = base64.split(',')[1];
      const mimeType = file.type;
      await handleAIImport({ data, mimeType });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    Promise.all([fetchMaterials(), fetchCountries()]);
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bom/materials');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
        // Initialize quantities to 0 if not set
        setQuantities(prev => {
          const next = { ...prev };
          data.forEach((m: Material) => {
            if (next[m.id] === undefined) next[m.id] = 0;
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
      toast.error(language === 'zh' ? '加载物料失败' : 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/countries/logistics');
      if (res.ok) {
        const data = await res.json();
        setCountries(data);
        if (data.length > 0 && !selectedCountryId) {
          setSelectedCountryId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  };

  const handleQuantityChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setQuantities(prev => ({ ...prev, [id]: numValue }));
  };

  const startEditing = (material: Material) => {
    setEditingId(material.id);
    setEditMaterial({ ...material });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditMaterial({});
  };

  const saveMaterial = async (id: string) => {
    if (!userProfile) return;
    
    try {
      setIsUpdating(true);
      const res = await fetch('/api/bom/materials/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editMaterial,
          id,
          userId: userProfile.uid
        })
      });

      if (res.ok) {
        toast.success(t.bom.updateSuccess);
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...editMaterial } as Material : m));
        setEditingId(null);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || t.bom.updateError);
      }
    } catch (error) {
      console.error('Failed to update material:', error);
      toast.error(t.bom.updateError);
    } finally {
      setIsUpdating(false);
    }
  };

  const addMaterial = async () => {
    if (!userProfile) return;
    const newMaterial = {
      category: 'Others',
      partNumber: 'NEW-PART',
      name: 'New Material',
      unit: 'pcs',
      price: 0
    };

    try {
      setIsUpdating(true);
      const res = await fetch('/api/bom/materials/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMaterial, userId: userProfile.uid })
      });
      if (res.ok) {
        const { id } = await res.json();
        const materialWithId = { ...newMaterial, id, updatedAt: new Date().toISOString() } as Material;
        setMaterials(prev => [...prev, materialWithId]);
        setQuantities(prev => ({ ...prev, [id]: 0 }));
        startEditing(materialWithId);
        toast.success(language === 'zh' ? '添加成功' : 'Added successfully');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || (language === 'zh' ? '添加失败' : 'Failed to add'));
      }
    } catch (error) {
      console.error('Failed to add material:', error);
      toast.error(language === 'zh' ? '添加失败' : 'Failed to add');
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!userProfile) return;
    
    // Check if we are already updating
    if (isUpdating) return;

    if (!window.confirm(language === 'zh' ? '确定要删除此物料吗？' : 'Are you sure you want to delete this material?')) return;
    
    try {
      setIsUpdating(true);
      const res = await fetch('/api/bom/materials/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: userProfile.uid })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setMaterials(prev => prev.filter(m => m.id !== id));
        toast.success(language === 'zh' ? '删除成功' : 'Deleted successfully');
      } else {
        throw new Error(data.error || (language === 'zh' ? '服务器拒绝了删除请求' : 'Server rejected the delete request'));
      }
    } catch (error: any) {
      console.error('Failed to delete material:', error);
      toast.error(`${language === 'zh' ? '删除失败' : 'Failed to delete'}: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const saveCountry = async (id?: string) => {
    if (!userProfile) return;
    const url = id ? '/api/countries/logistics/update' : '/api/countries/logistics/add';
    try {
      setIsUpdating(true);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editCountry, id, userId: userProfile.uid })
      });
      if (res.ok) {
        toast.success(t.bom.updateSuccess);
        fetchCountries();
        setEditingCountryId(null);
        setEditCountry({});
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || t.bom.updateError);
      }
    } catch (error) {
      console.error('Failed to save country:', error);
      toast.error(t.bom.updateError);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteCountry = async (id: string) => {
    if (!userProfile || !window.confirm(language === 'zh' ? '确定要删除该国家吗？' : 'Are you sure you want to delete this country?')) return;

    try {
      setIsUpdating(true);
      const res = await fetch('/api/countries/logistics/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId: userProfile.uid })
      });

      if (res.ok) {
        setCountries(prev => prev.filter(c => c.id !== id));
        if (selectedCountryId === id) setSelectedCountryId(countries[0]?.id || '');
        toast.success(language === 'zh' ? '删除成功' : 'Deleted successfully');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || (language === 'zh' ? '删除失败' : 'Failed to delete'));
      }
    } catch (error) {
      console.error('Failed to delete country:', error);
      toast.error(language === 'zh' ? '删除失败' : 'Failed to delete');
    } finally {
      setIsUpdating(false);
    }
  };

  const calculateSubtotal = () => {
    return materials.reduce((sum, m) => {
      return sum + (m.price * (quantities[m.id] || 0));
    }, 0);
  };

  const selectedCountry = countries.find(c => c.id === selectedCountryId);
  const multiplier = selectedCountry?.multiplier || 1;
  const subtotal = calculateSubtotal();
  const totalWithLogistics = subtotal * multiplier;
  const logisticsFee = totalWithLogistics - subtotal;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount).replace('USD', t.bom.currency);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">{language === 'zh' ? '正在加载物料清单...' : 'Loading material list...'}</p>
      </div>
    );
  }

  // Group materials by category
  const categories = Array.from(new Set(materials.map(m => m.category))) as string[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{t.bom.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{t.bom.subtitle}</p>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-6">
            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex-1 sm:flex-none px-6 py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Sparkles size={18} />
                {language === 'zh' ? '智能导入' : 'AI Import'}
              </button>
              <button
                onClick={addMaterial}
                className="flex-1 sm:flex-none px-6 py-3.5 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus size={18} />
                {t.bom.addMaterial}
              </button>
            </div>

            <div className="h-px xl:h-10 w-full xl:w-px bg-gray-100 hidden sm:block" />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
              {/* Country Selector */}
              <div className="flex flex-col flex-1 sm:flex-none">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 ml-1">
                  {t.bom.selectCountry}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedCountryId}
                    onChange={(e) => setSelectedCountryId(e.target.value)}
                    className="flex-1 sm:w-48 px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-red-500 outline-none transition-all cursor-pointer"
                  >
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.multiplier}x)</option>
                    ))}
                  </select>
                  {isAdmin && (
                    <button
                      onClick={() => setIsManagingCountries(!isManagingCountries)}
                      className={`p-2.5 rounded-xl transition-all ${isManagingCountries ? 'bg-red-600 text-white' : 'bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 shadow-sm'}`}
                      title={t.bom.manageCountries}
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Total Display */}
              <div className="flex items-center gap-4 flex-1 sm:flex-none">
                <div className="bg-gray-50 px-5 py-2.5 rounded-2xl border border-gray-100 flex flex-col items-end justify-center min-w-[120px]">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-0.5">{t.bom.subtotal}</span>
                  <span className="text-base font-black text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="bg-red-600 px-6 py-3 rounded-2xl text-white shadow-xl shadow-red-100 flex flex-col items-end justify-center min-w-[160px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Calculator size={40} />
                  </div>
                  <span className="text-[10px] uppercase font-black tracking-widest opacity-80 mb-0.5 relative z-10">{t.bom.totalWithLogistics}</span>
                  <span className="text-xl font-black relative z-10">{formatCurrency(totalWithLogistics)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Country Management Panel */}
      {isAdmin && isManagingCountries && (
        <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
              {t.bom.manageCountries}
            </h3>
            <button 
              onClick={() => {
                setEditingCountryId('new');
                setEditCountry({ name: '', multiplier: 1 });
              }}
              className="px-4 py-2 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-colors"
            >
              {t.bom.addCountry}
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {countries.map(country => (
              <div key={country.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group">
                {editingCountryId === country.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editCountry.name}
                      onChange={(e) => setEditCountry(prev => ({ ...prev, name: e.target.value }))}
                      className="flex-1 px-2 py-1 text-xs border border-red-200 rounded-lg outline-none"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={editCountry.multiplier}
                      onChange={(e) => setEditCountry(prev => ({ ...prev, multiplier: parseFloat(e.target.value) }))}
                      className="w-16 px-2 py-1 text-xs border border-red-200 rounded-lg outline-none"
                    />
                    <button onClick={() => saveCountry(country.id)} className="text-green-600"><Save size={14} /></button>
                    <button onClick={() => setEditingCountryId(null)} className="text-gray-400"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-sm font-bold text-gray-900">{country.name}</span>
                      <span className="ml-2 text-xs font-black text-red-600">{country.multiplier}x</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingCountryId(country.id);
                          setEditCountry(country);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteCountry(country.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {editingCountryId === 'new' && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-2">
                <input
                  type="text"
                  value={editCountry.name}
                  onChange={(e) => setEditCountry(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1 px-2 py-1 text-xs border border-red-200 rounded-lg outline-none"
                  placeholder="New Country"
                  autoFocus
                />
                <input
                  type="number"
                  step="0.1"
                  value={editCountry.multiplier}
                  onChange={(e) => setEditCountry(prev => ({ ...prev, multiplier: parseFloat(e.target.value) }))}
                  className="w-16 px-2 py-1 text-xs border border-red-200 rounded-lg outline-none"
                />
                <button onClick={() => saveCountry()} className="text-green-600"><Save size={14} /></button>
                <button onClick={() => setEditingCountryId(null)} className="text-gray-400"><X size={14} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl text-red-600">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    {language === 'zh' ? 'AI 智能导入物料' : 'AI Smart Material Import'}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {language === 'zh' ? '粘贴文本或上传图片，AI 将自动提取物料清单' : 'Paste text or upload an image, AI will extract the BOM'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
                  {language === 'zh' ? '粘贴物料清单文本' : 'Paste BOM Text'}
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={language === 'zh' ? '例如：\nITEL-SIG-001 ACP 10sqm $15.5\nLED模块 50pcs $0.45' : 'Example:\nITEL-SIG-001 ACP 10sqm $15.5\nLED Modules 50pcs $0.45'}
                  className="w-full h-48 p-4 text-sm bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none font-mono"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-100"></div>
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{language === 'zh' ? '或者' : 'OR'}</span>
                <div className="flex-1 h-px bg-gray-100"></div>
              </div>

              <div className="flex items-center justify-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-red-500 hover:bg-red-50/30 transition-all group"
                >
                  <div className="p-3 bg-gray-50 rounded-2xl text-gray-400 group-hover:bg-red-100 group-hover:text-red-600 transition-colors mb-3">
                    <Upload size={24} />
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {language === 'zh' ? '上传物料清单图片' : 'Upload BOM Image'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {language === 'zh' ? '支持 JPG, PNG, WEBP' : 'Supports JPG, PNG, WEBP'}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                disabled={!importText.trim() || isImporting}
                onClick={() => handleAIImport(importText)}
                className="px-8 py-2.5 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-gray-900/10"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {language === 'zh' ? '正在处理...' : 'Processing...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {language === 'zh' ? '开始提取' : 'Start Extraction'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Materials Table Section */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Package size={16} />
            </div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
              {language === 'zh' ? '物料投入明细' : 'BOM Investment Details'}
            </h3>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={async () => {
                if (!window.confirm(language === 'zh' ? '确定要合并所有相同料号和名称的物料吗？' : 'Are you sure you want to merge duplicate materials?')) return;
                
                const seen = new Map<string, Material>();
                const duplicates: string[] = [];
                
                materials.forEach(m => {
                  const key = `${m.partNumber}-${m.name}`;
                  if (seen.has(key)) {
                    duplicates.push(m.id);
                  } else {
                    seen.set(key, m);
                  }
                });
                
                if (duplicates.length === 0) {
                  toast.info(language === 'zh' ? '没有发现重复物料' : 'No duplicate materials found');
                  return;
                }
                
                const toastId = toast.loading(language === 'zh' ? '正在优化清单...' : 'Optimizing list...');
                try {
                  for (const id of duplicates) {
                    if (isAdmin && !id.startsWith('temp-')) {
                      await fetch('/api/bom/materials/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id, userId: userProfile?.uid })
                      });
                    }
                  }
                  if (isAdmin) await fetchMaterials();
                  else {
                    const filteredMaterials = materials.filter(m => !duplicates.includes(m.id));
                    setMaterials(filteredMaterials);
                  }
                  toast.success(language === 'zh' ? '清单已优化' : 'List optimized', { id: toastId });
                } catch (e) {
                  toast.error(language === 'zh' ? '优化失败' : 'Optimization failed', { id: toastId });
                }
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 text-gray-600 text-xs font-black rounded-xl hover:border-red-200 hover:text-red-600 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <RefreshCcw size={14} />
              {language === 'zh' ? '合并重复' : 'Merge Duplicates'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {materials.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-200 mb-6 border-2 border-dashed border-gray-100 animate-pulse">
                <Plus size={32} />
              </div>
              <h4 className="text-lg font-black text-gray-900 mb-2">{language === 'zh' ? '开始您的成本计算' : 'Start Your Calculation'}</h4>
              <p className="text-sm text-gray-400 max-w-sm font-medium">
                {language === 'zh' 
                  ? '点击上方的“智能导入”拍摄您的物料单，或手动“添加物料”来估算本项目的建设投入。' 
                  : 'Click "AI Import" to capture your BOM list, or "Add Material" manually to estimate project costs.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="pl-8 pr-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.category}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.partNumber}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.material}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.unit}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.price}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{t.bom.quantity}</th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right">{t.bom.amount}</th>
                  {isAdmin && <th className="pl-4 pr-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-right w-24"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categories.map(category => (
                  <React.Fragment key={category}>
                    <tr className="bg-gray-50/30">
                      <td colSpan={isAdmin ? 8 : 7} className="pl-8 pr-4 py-3 text-[11px] font-black text-red-600 uppercase tracking-[0.15em]">
                        {(t.bom.categories as Record<string, string>)[category] || category}
                      </td>
                    </tr>
                    {materials.filter(m => m.category === category).map(material => (
                      <tr key={material.id} className="hover:bg-red-50/30 transition-all group">
                        <td className="pl-8 pr-4 py-4">
                          {editingId === material.id ? (
                            <select
                              value={editMaterial.category}
                              onChange={(e) => setEditMaterial(prev => ({ ...prev, category: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                            >
                              {Object.keys(t.bom.categories).map(cat => (
                                <option key={cat} value={cat}>{(t.bom.categories as any)[cat]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">{(t.bom.categories as Record<string, string>)[category] || category}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingId === material.id ? (
                            <input
                              type="text"
                              value={editMaterial.partNumber}
                              onChange={(e) => setEditMaterial(prev => ({ ...prev, partNumber: e.target.value }))}
                              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                            />
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{material.partNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingId === material.id ? (
                            <input
                              type="text"
                              value={editMaterial.name}
                              onChange={(e) => setEditMaterial(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full px-3 py-2 text-sm font-bold bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                            />
                          ) : (
                            <span className="text-sm font-bold text-gray-900 group-hover:text-red-600 transition-colors">{material.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingId === material.id ? (
                            <input
                              type="text"
                              value={editMaterial.unit}
                              onChange={(e) => setEditMaterial(prev => ({ ...prev, unit: e.target.value }))}
                              className="w-20 px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                            />
                          ) : (
                            <span className="text-xs font-black text-gray-400">{material.unit}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {editingId === material.id ? (
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={editMaterial.price}
                                onChange={(e) => setEditMaterial(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                                className="w-32 pl-7 pr-3 py-2 text-sm font-black bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-black text-gray-900">{formatCurrency(material.price)}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            value={quantities[material.id] || ''}
                            onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                            placeholder="0"
                            className="w-20 px-4 py-2.5 text-sm font-black border border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all shadow-inner"
                          />
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-sm font-black text-gray-900 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                            {formatCurrency(material.price * (quantities[material.id] || 0))}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="pl-4 pr-8 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {editingId === material.id ? (
                                <>
                                  <button 
                                    onClick={() => saveMaterial(material.id)}
                                    disabled={isUpdating}
                                    className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-md"
                                  >
                                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  </button>
                                  <button 
                                    onClick={cancelEditing}
                                    className="p-2 text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => startEditing(material)}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-red-100 rounded-xl transition-all"
                                    title={t.bom.adminEdit}
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => deleteMaterial(material.id)}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all"
                                    title={language === 'zh' ? '删除物料' : 'Delete Material'}
                                  >
                                    {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 mb-4 block">{t.bom.subtotal}</span>
            <div className="text-3xl font-black text-gray-900 tracking-tight">{formatCurrency(subtotal)}</div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'zh' ? '基础出厂价' : 'Ex-factory Base'}</span>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] rotate-12">
            <Truck size={80} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400 mb-4 block">
              {language === 'zh' ? `${t.bom.logisticsFee} (${selectedCountry?.name})` : `${t.bom.logisticsFee} (${selectedCountry?.name})`}
            </span>
            <div className="text-3xl font-black text-red-600 tracking-tight">+{formatCurrency(logisticsFee)}</div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50">
            <p className="text-[10px] text-gray-400 font-bold italic">
              {language === 'zh' ? `清关系数: ${multiplier}x (基于目的地国家政策)` : `Customs Multiplier: ${multiplier}x (Based on destination policy)`}
            </p>
          </div>
        </div>

        <div className="bg-gray-900 p-8 rounded-[32px] shadow-2xl shadow-gray-200 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400/80 mb-4 block">
                {language === 'zh' ? '预估总投入 (含清关物流)' : 'ESTIMATED TOTAL INVESTMENT'}
              </span>
              <div className="text-4xl font-black text-white tracking-tighter tabular-nums">{formatCurrency(totalWithLogistics)}</div>
            </div>
            <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full w-fit">
              <ShieldCheck size={12} className="text-red-500" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">
                {language === 'zh' ? '本估算仅供参考' : 'For Reference Only'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-4 p-6 bg-red-50/30 rounded-[32px] border border-red-100/50">
        <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 flex-shrink-0">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1">
          <h5 className="text-sm font-black text-red-900 uppercase tracking-widest">
            {language === 'zh' ? '成本免责声明' : 'Cost Disclaimer'}
          </h5>
          <p className="text-xs text-red-800/70 leading-relaxed font-medium">
            {language === 'zh' 
              ? '此计算器提供的初步成本估算包含基于各区域历史数据的物料成本及预估的清关物流费用。由于汇率波动及当地清关政策实时调整，最终报价必须以当地供应商签订的实际法律合同为准。' 
              : 'The preliminary cost estimates provided by this calculator include material costs and estimated customs/logistics fees based on regional historical data. Due to exchange rate fluctuations and real-time adjustments of local customs policies, final quotes must be subject to the actual legal contracts signed with local suppliers.'}
          </p>
        </div>
      </div>
    </div>
  );
}
