import React, { useCallback } from 'react';
import { AppConfig, FontStyleKey, SavedPhoto, SceneMode } from '../types';

interface UIControlsProps {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  photos: SavedPhoto[];
  onUploadPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadMusic: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (id: string) => void;
  onClearPhotos: () => void;
  toggleMusic: () => void;
  replayMusic: () => void;
  isPlaying: boolean;
  setMode: (mode: SceneMode) => void;
  triggerGrab: () => void;
  toggleCam: () => void;
  manualRotate: (x: number, y: number) => void;
}

const UIControls: React.FC<UIControlsProps> = ({
  config, setConfig, photos, onUploadPhotos, onUploadMusic, onDeletePhoto, onClearPhotos,
  toggleMusic, replayMusic, isPlaying, setMode, triggerGrab, toggleCam, manualRotate
}) => {

  const updateText = (field: 'line1' | 'line2', val: string) => {
    setConfig(prev => ({ ...prev, text: { ...prev.text, [field]: val } }));
  };

  const updateFont = (val: string) => {
    setConfig(prev => ({ ...prev, text: { ...prev.text, fontKey: val as FontStyleKey } }));
  };

  const updateParticle = (field: 'treeCount' | 'dustCount', val: number) => {
    setConfig(prev => ({ ...prev, particle: { ...prev.particle, [field]: val } }));
  };

  const updateSnow = (field: 'count' | 'size' | 'speed', val: number) => {
    setConfig(prev => ({ ...prev, snow: { ...prev.snow, [field]: val } }));
  };

  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <>
      <div className="absolute top-4 left-4 w-52 flex flex-col gap-2 z-20 origin-top-left transition-all duration-300">
        
        {/* Scene Config Panel */}
        <div className="bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl">
          <h3 className="text-yellow-200 text-xs font-bold text-center border-b border-yellow-500/20 pb-1 mb-2 tracking-widest font-serif">SCENE CUSTOM</h3>
          
          <div className="mb-2">
            <h4 className="text-gray-400 text-[10px] font-bold uppercase mb-1">Greetings</h4>
            <div className="flex flex-col gap-1">
              <input type="text" value={config.text.line1} onChange={e => updateText('line1', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded text-yellow-500 text-[10px] px-1 h-6 text-center focus:border-yellow-500/50 outline-none transition-colors" placeholder="Line 1" />
              <input type="text" value={config.text.line2} onChange={e => updateText('line2', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded text-yellow-500 text-[10px] px-1 h-6 text-center focus:border-yellow-500/50 outline-none transition-colors" placeholder="Line 2" />
            </div>
          </div>

          <div className="mb-2">
            <h4 className="text-gray-400 text-[10px] font-bold uppercase mb-1">Typography</h4>
            <select value={config.text.fontKey} onChange={e => updateFont(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded text-yellow-500 text-[10px] h-6 px-1 outline-none mb-1">
              <option value="style1">Calligraphy</option>
              <option value="style2">Classical Serif</option>
              <option value="style3">Elegant Script</option>
              <option value="style4">Modern Art</option>
              <option value="style5">Retro Bold</option>
            </select>
            <div className="flex gap-2 items-center">
              <input type="range" min="50" max="250" value={config.text.size} onChange={e => setConfig(prev => ({...prev, text: {...prev.text, size: parseInt(e.target.value)}}))} className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer" />
              <input type="color" value={config.text.color} onChange={e => setConfig(prev => ({...prev, text: {...prev.text, color: e.target.value}}))} className="w-8 h-5 bg-transparent border-none cursor-pointer" />
            </div>
          </div>

          <div className="border-t border-white/5 pt-2 mb-2">
             <h4 className="text-gray-400 text-[10px] font-bold uppercase mb-1">Audio</h4>
             <div className="flex gap-1 mb-1">
                <button onClick={toggleMusic} className="flex-2 w-full border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded px-2 py-1 text-xs transition-all">{isPlaying ? '⏸' : '⏯'}</button>
                <button onClick={replayMusic} className="flex-1 w-full border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded px-2 py-1 text-xs transition-all">⟲</button>
             </div>
             <input type="range" min="0" max="100" value={config.bgmVolume} onChange={e => setConfig(prev => ({...prev, bgmVolume: parseInt(e.target.value)}))} className="w-full h-1 bg-white/20 rounded-lg" />
          </div>

           <div className="border-t border-white/5 pt-2">
             <h4 className="text-gray-400 text-[10px] font-bold uppercase mb-1">Particles</h4>
             <div className="max-h-24 overflow-y-auto pr-1 space-y-2 pl-1 border-l border-yellow-500/10">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500">Tree Density</span>
                  <input type="range" min="500" max="3000" value={config.particle.treeCount} onChange={e => updateParticle('treeCount', parseInt(e.target.value))} className="w-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500">Snow Count</span>
                  <input type="range" min="0" max="3000" step="100" value={config.snow.count} onChange={e => updateSnow('count', parseInt(e.target.value))} className="w-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500">Snow Speed</span>
                  <input type="range" min="1" max="8" step="0.5" value={config.snow.speed} onChange={e => updateSnow('speed', parseFloat(e.target.value))} className="w-full" />
                </div>
             </div>
           </div>
        </div>

        {/* Interaction Panel */}
        <div className="bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl">
           <h3 className="text-yellow-200 text-xs font-bold text-center border-b border-yellow-500/20 pb-1 mb-2 tracking-widest font-serif">INTERACTION</h3>
           <div className="flex gap-1 mb-1">
             <button onClick={() => setMode('TREE')} className="flex-1 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[10px] uppercase transition-all">Merge (Space)</button>
             <button onClick={() => setMode('SCATTER')} className="flex-1 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[10px] uppercase transition-all">Scatter (Z)</button>
           </div>
           <button onClick={triggerGrab} className="w-full border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[10px] uppercase transition-all mb-2">Grab Photo (X)</button>
           
           <div className="grid grid-cols-3 gap-1 mt-2 border-t border-white/5 pt-2">
              <div></div>
              <button onMouseDown={() => manualRotate(-1, 0)} onMouseUp={() => manualRotate(0, 0)} onMouseLeave={() => manualRotate(0, 0)} className="bg-white/5 hover:bg-yellow-500/20 text-yellow-500 rounded py-1">▲</button>
              <div></div>
              <button onMouseDown={() => manualRotate(0, -1)} onMouseUp={() => manualRotate(0, 0)} onMouseLeave={() => manualRotate(0, 0)} className="bg-white/5 hover:bg-yellow-500/20 text-yellow-500 rounded py-1">◀</button>
              <button onClick={() => manualRotate(0,0)} className="bg-white/5 hover:bg-yellow-500/20 text-yellow-500 rounded py-1 text-[8px]">●</button>
              <button onMouseDown={() => manualRotate(0, 1)} onMouseUp={() => manualRotate(0, 0)} onMouseLeave={() => manualRotate(0, 0)} className="bg-white/5 hover:bg-yellow-500/20 text-yellow-500 rounded py-1">▶</button>
              <div></div>
              <button onMouseDown={() => manualRotate(1, 0)} onMouseUp={() => manualRotate(0, 0)} onMouseLeave={() => manualRotate(0, 0)} className="bg-white/5 hover:bg-yellow-500/20 text-yellow-500 rounded py-1">▼</button>
              <div></div>
           </div>
        </div>

        {/* Resources Panel */}
        <div className="bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl grid grid-cols-2 gap-2">
            <h3 className="col-span-2 text-yellow-200 text-xs font-bold text-center border-b border-yellow-500/20 pb-1 mb-1 tracking-widest font-serif">RESOURCES</h3>
            <label className="border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[9px] uppercase transition-all flex items-center justify-center cursor-pointer">
              + Photos
              <input type="file" multiple accept="image/*" onChange={onUploadPhotos} className="hidden" />
            </label>
            <button onClick={() => setShowDelete(true)} className="border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[9px] uppercase transition-all">Manage</button>
            <label className="border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[9px] uppercase transition-all flex items-center justify-center cursor-pointer">
              ♫ Music
              <input type="file" accept=".mp3,audio/mpeg" onChange={onUploadMusic} className="hidden" />
            </label>
            <button onClick={toggleCam} className="border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 rounded py-1 text-[9px] uppercase transition-all">📷 Cam</button>
        </div>
      </div>

      {/* Delete Manager Modal */}
      {showDelete && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-[60] flex flex-col items-center justify-center">
            <h2 className="text-yellow-500 font-serif text-2xl tracking-widest mb-6">PHOTO LIBRARY</h2>
            <div className="flex flex-wrap gap-4 w-3/4 h-3/5 overflow-y-auto justify-center p-6 border border-yellow-500/30 rounded-lg bg-black/50">
               {photos.length === 0 && <span className="text-gray-500">No photos uploaded.</span>}
               {photos.map(p => (
                 <div key={p.id} className="w-20 h-20 relative border border-yellow-500 group cursor-pointer hover:scale-110 transition-transform">
                    <img src={p.data} className="w-full h-full object-cover" alt="user content" />
                    <button onClick={() => onDeletePhoto(p.id)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-900 text-white rounded-full flex items-center justify-center text-xs border border-white font-bold hover:bg-red-700">X</button>
                 </div>
               ))}
            </div>
            <div className="flex gap-4 mt-6">
               <button onClick={onClearPhotos} className="px-6 py-2 border border-red-500/50 text-red-300 hover:bg-red-900/40 rounded uppercase text-xs tracking-wider transition-colors">Clear All</button>
               <button onClick={() => setShowDelete(false)} className="px-6 py-2 border border-yellow-500/50 text-yellow-200 hover:bg-yellow-900/40 rounded uppercase text-xs tracking-wider transition-colors">Close</button>
            </div>
        </div>
      )}
    </>
  );
};

export default UIControls;