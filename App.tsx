
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  CheckCircleIcon, 
  ArrowPathIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import { analyzePdfPages } from './geminiService';
import { generateWordDoc } from './docxGenerator';
import { ConversionStatus } from './types';

// Load pdfjs from window
declare const pdfjsLib: any;

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [pageSelection, setPageSelection] = useState<string>('1');
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse page selection string like "1, 2, 4-6" into array [1, 2, 4, 5, 6]
  const parsePageSelection = (selection: string, max: number): number[] => {
    const pages = new Set<number>();
    const parts = selection.split(',').map(p => p.trim());
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(max, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page >= 1 && page <= max) {
          pages.add(page);
        }
      }
    });
    
    return Array.from(pages).sort((a, b) => a - b);
  };

  const loadPdfMetadata = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
      // Default to "1-X" or just "1" if many pages
      setPageSelection(pdf.numPages > 5 ? '1-5' : `1-${pdf.numPages}`);
    } catch (err) {
      setError("Hiba a PDF beolvasásakor.");
    }
  };

  const convertPdfToImages = async (file: File, selectedPages: number[]): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];

    for (let i = 0; i < selectedPages.length; i++) {
      const pageNum = selectedPages[i];
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
      setProgress(Math.round(((i + 1) / selectedPages.length) * 40)); 
    }
    return images;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setDownloadUrl(null);
      setError(null);
      setStatus('idle');
      setProgress(0);
      await loadPdfMetadata(selectedFile);
    } else if (selectedFile) {
      setError('Kérjük, válasszon érvényes PDF fájlt.');
    }
  };

  const startConversion = async () => {
    if (!file) return;

    const selectedPages = parsePageSelection(pageSelection, totalPages);
    if (selectedPages.length === 0) {
      setError("Kérjük, adjon meg érvényes oldalszámokat!");
      return;
    }

    try {
      setStatus('processing');
      setError(null);
      setProgress(5);

      // 1. Convert specific PDF pages to images
      const pageImages = await convertPdfToImages(file, selectedPages);
      setProgress(45);

      // 2. Send to Gemini for structural analysis
      const structuredDoc = await analyzePdfPages(pageImages);
      setProgress(85);
      setStatus('generating');

      // 3. Generate Word document
      const blob = await generateWordDoc(structuredDoc);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      
      setProgress(100);
      setStatus('completed');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Hiba történt a konvertálás során.');
      setStatus('error');
    }
  };

  const reset = () => {
    setFile(null);
    setTotalPages(0);
    setStatus('idle');
    setProgress(0);
    setDownloadUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getDownloadFileName = () => {
    if (!file) return 'converted.docx';
    const baseName = file.name.replace('.pdf', '');
    // Sanitize the page selection for filename
    const sanitizedSelection = pageSelection.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
    return `${baseName}_oldalak_${sanitizedSelection}.docx`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
          Smart <span className="text-blue-600">PDF to Word</span> AI
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Intelligens dokumentum-rekonstrukció Gemini 3 AI segítségével. Válaszd ki az oldalakat és töltsd le szerkeszthető Word formátumban.
        </p>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-8 md:p-10">
          {status === 'idle' && !file && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-12 transition-all duration-300 bg-slate-50/50 hover:bg-blue-50/30 text-center"
            >
              <input 
                type="file" 
                className="hidden" 
                accept="application/pdf" 
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CloudArrowUpIcon className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Kattints a PDF feltöltéséhez</h3>
                <p className="text-slate-500">Vagy húzd ide a fájlt</p>
              </div>
            </div>
          )}

          {status === 'idle' && file && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-start bg-blue-50 p-6 rounded-2xl mb-8 border border-blue-100">
                <div className="p-3 bg-blue-600 rounded-xl mr-4 shadow-lg shadow-blue-200">
                  <DocumentIcon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 truncate max-w-xs md:max-w-md">{file.name}</h3>
                  <p className="text-sm text-blue-600 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB • {totalPages} oldal</p>
                </div>
                <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <ExclamationCircleIcon className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center">
                    <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                    Konvertálandó oldalak
                  </label>
                  <input 
                    type="text"
                    value={pageSelection}
                    onChange={(e) => setPageSelection(e.target.value)}
                    placeholder="Például: 1, 3, 5-8"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium"
                  />
                  <p className="text-xs text-slate-500 mt-2">Formatálás: egyedi oldalak (1, 3) vagy tartomány (1-5). Összesen {totalPages} oldal érhető el.</p>
                </div>

                <button 
                  onClick={startConversion}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all transform hover:-translate-y-1 flex items-center justify-center text-lg"
                >
                  Konvertálás indítása AI-val
                </button>
              </div>
            </div>
          )}

          {(status === 'processing' || status === 'generating') && (
            <div className="py-8 text-center">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"
                  style={{ clipPath: `conic-gradient(transparent 0deg, white ${progress}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {status === 'processing' ? 'Dokumentum elemzése...' : 'Word fájl létrehozása...'}
              </h3>
              <p className="text-slate-500 mb-8">Az AI éppen rekonstruálja a dokumentum szerkezetét.</p>
              
              <div className="max-w-xs mx-auto space-y-3">
                <div className="flex items-center text-sm font-medium">
                  <div className={`w-2 h-2 rounded-full mr-3 ${progress >= 40 ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                  <span className={progress >= 40 ? 'text-slate-400 line-through' : 'text-slate-700'}>Oldalak beolvasása</span>
                </div>
                <div className="flex items-center text-sm font-medium">
                  <div className={`w-2 h-2 rounded-full mr-3 ${progress >= 85 ? 'bg-green-500' : progress >= 40 ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`}></div>
                  <span className={progress >= 85 ? 'text-slate-400 line-through' : progress >= 40 ? 'text-slate-700' : 'text-slate-300'}>Struktúra elemzése (AI)</span>
                </div>
                <div className="flex items-center text-sm font-medium">
                  <div className={`w-2 h-2 rounded-full mr-3 ${progress === 100 ? 'bg-green-500' : progress >= 85 ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`}></div>
                  <span className={progress === 100 ? 'text-slate-400 line-through' : progress >= 85 ? 'text-slate-700' : 'text-slate-300'}>Exportálás DOCX formátumba</span>
                </div>
              </div>
            </div>
          )}

          {status === 'completed' && downloadUrl && (
            <div className="text-center py-6 animate-in zoom-in duration-300">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-14 h-14 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Kész a konvertálás!</h3>
              <p className="text-slate-600 mb-8">A kért oldalak rekonstrukciója sikeresen befejeződött.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href={downloadUrl} 
                  download={getDownloadFileName()}
                  className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all transform hover:-translate-y-1"
                >
                  <ArrowDownTrayIcon className="w-6 h-6 mr-2" />
                  Word Fájl Letöltése
                </a>
                <button 
                  onClick={reset}
                  className="inline-flex items-center justify-center px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                >
                  Újabb konvertálás
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ExclamationCircleIcon className="w-12 h-12 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Hiba történt</h3>
              <p className="text-red-600 mb-8 font-medium">{error}</p>
              <button 
                onClick={reset}
                className="inline-flex items-center justify-center px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all"
              >
                Próbáld újra
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feature grid */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-hover hover:shadow-md">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
             <DocumentDuplicateIcon className="w-7 h-7 text-blue-600" />
          </div>
          <h4 className="font-bold text-lg text-slate-900 mb-3">Precíz Választás</h4>
          <p className="text-slate-600 leading-relaxed">Most már pontosan megadhatod, mely oldalakra van szükséged, spórolva az AI feldolgozási idővel.</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-hover hover:shadow-md">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
             <ArrowPathIcon className="w-7 h-7 text-indigo-600" />
          </div>
          <h4 className="font-bold text-lg text-slate-900 mb-3">Látványalapú OCR</h4>
          <p className="text-slate-600 leading-relaxed">Nem csak szöveget másol, hanem látja a táblázatokat és a címsorokat, mintha egy ember gépelné át.</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm transition-hover hover:shadow-md">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
             <CheckCircleIcon className="w-7 h-7 text-purple-600" />
          </div>
          <h4 className="font-bold text-lg text-slate-900 mb-3">Word-Native</h4>
          <p className="text-slate-600 leading-relaxed">A végeredmény egy valódi .docx fájl, ami megőrzi a logikai struktúrát a későbbi szerkesztéshez.</p>
        </div>
      </div>
    </div>
  );
};

export default App;
