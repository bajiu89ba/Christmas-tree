import React, { useEffect, useRef, useState } from 'react';
import UIControls from './components/UIControls';
import { ThreeEngine } from './services/engine';
import { AppConfig, FontStyleKey, SavedPhoto, SceneMode } from './types';
import { clearPhotosDB, deletePhotoFromDB, loadMusicFromDB, loadPhotosFromDB, saveMusicToDB, savePhotoToDB } from './services/db';

const FONT_STYLES: Record<FontStyleKey, { font: string; spacing: string; shadow: string; transform: string }> = {
  style1: { font: "'Ma Shan Zheng', cursive", spacing: "4px", shadow: "2px 2px 8px rgba(180,50,50,0.8)", transform: "none" },
  style2: { font: "'Cinzel', serif", spacing: "6px", shadow: "0 0 20px rgba(255,215,0,0.5)", transform: "none" },
  style3: { font: "'Great Vibes', cursive", spacing: "1px", shadow: "0 0 15px rgba(255,200,255,0.7)", transform: "none" },
  style4: { font: "'Monoton', cursive", spacing: "1px", shadow: "0 0 10px #fff", transform: "none" },
  style5: { font: "'Abril Fatface', cursive", spacing: "0px", shadow: "0 5px 15px rgba(0,0,0,0.8)", transform: "none" }
};

const DEFAULT_CONFIG: AppConfig = {
  text: { line1: "Merry", line2: "Christmas", fontKey: "style1", size: 100, color: "#fceea7" },
  particle: { treeCount: 1500, dustCount: 2500 },
  snow: { count: 1500, size: 0.12, speed: 3.5 },
  bgmVolume: 50,
  rotationSpeed: 1.4
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<ThreeEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [photos, setPhotos] = useState<SavedPhoto[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [camVisible, setCamVisible] = useState(true);
  const [camActive, setCamActive] = useState(false);
  
  // Initialize Engine and DB
  useEffect(() => {
    if (!containerRef.current || !videoRef.current || engineRef.current) return;

    // Load Data
    const initData = async () => {
       try {
         const loadedPhotos = await loadPhotosFromDB();
         setPhotos(loadedPhotos);
         const musicBlob = await loadMusicFromDB();
         if (musicBlob) {
            audioRef.current.src = URL.createObjectURL(musicBlob);
            audioRef.current.loop = true;
         }
       } catch(e) { console.warn("DB Load Error", e); }
    };

    // Initialize 3D
    initData().then(() => {
        engineRef.current = new ThreeEngine(containerRef.current!, config, videoRef.current!);
        engineRef.current.addPhotos(photos); // Add initial photos
        
        engineRef.current.onHandStatusChange = (active) => {
           setCamActive(active);
        };

        setIsLoading(false);
        
        // Setup WebCam Stream
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
           navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
              if (videoRef.current) {
                 videoRef.current.srcObject = stream;
                 videoRef.current.onloadedmetadata = () => videoRef.current?.play();
              }
           }).catch(e => console.error("Webcam error:", e));
        }
    });

    return () => {
      engineRef.current?.cleanup();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once

  // Sync Config with Engine
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.config = config;
    audioRef.current.volume = config.bgmVolume / 100;
    
    // Check specific expensive updates
    if (Math.abs(engineRef.current.particles.length - (config.particle.treeCount + config.particle.dustCount + photos.length)) > 5) {
       engineRef.current.updateParticles(); // Rebuild tree/dust if counts change significantly
    }
    engineRef.current.updateSnow(); // Rebuild snow
  }, [config, photos]);

  // Sync Photos with Engine
  useEffect(() => {
     if(engineRef.current && photos.length > 0) {
        engineRef.current.addPhotos(photos);
     }
  }, [photos]);

  // Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      
      const key = e.key.toLowerCase();
      if (key === 'h') setUiVisible(prev => !prev);
      if (e.code === 'Space') { e.preventDefault(); engineRef.current?.setMode('TREE'); }
      if (key === 'z') engineRef.current?.setMode('SCATTER');
      if (key === 'x') engineRef.current?.triggerPhotoGrab();
      
      if (engineRef.current) {
         if (e.code === 'ArrowUp') engineRef.current.manualRotate.x = -1;
         if (e.code === 'ArrowDown') engineRef.current.manualRotate.x = 1;
         if (e.code === 'ArrowLeft') engineRef.current.manualRotate.y = -1;
         if (e.code === 'ArrowRight') engineRef.current.manualRotate.y = 1;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (engineRef.current && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            engineRef.current.manualRotate = { x: 0, y: 0 };
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // UI Actions
  const handleUploadPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files) {
        Array.from(e.target.files).forEach(file => {
           const reader = new FileReader();
           reader.onload = async (ev) => {
              if (ev.target?.result) {
                 const id = await savePhotoToDB(ev.target.result as string);
                 setPhotos(prev => [...prev, { id, data: ev.target!.result as string }]);
              }
           };
           reader.readAsDataURL(file);
        });
     }
  };

  const handleUploadMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          saveMusicToDB(file);
          audioRef.current.src = URL.createObjectURL(file);
          audioRef.current.play();
          setIsPlaying(true);
      }
  };

  const toggleMusic = () => {
      if (!audioRef.current.src) return alert("Please upload music first.");
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
  };

  const handleDeletePhoto = async (id: string) => {
      await deletePhotoFromDB(id);
      setPhotos(prev => prev.filter(p => p.id !== id));
      engineRef.current?.removePhoto(id);
  };

  const handleClearPhotos = async () => {
      await clearPhotosDB();
      setPhotos([]);
      engineRef.current?.updateParticles(); // Force rebuild
  };

  const currentFont = FONT_STYLES[config.text.fontKey];
  const titleStyle: React.CSSProperties = {
      fontFamily: currentFont.font,
      letterSpacing: currentFont.spacing,
      textShadow: currentFont.shadow,
      textTransform: currentFont.transform as any,
      color: config.text.color,
      fontSize: `${config.text.size * 0.48}px`,
  };

  // Draggable Title Logic
  const titleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
      if(!titleRef.current) return;
      
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }

      const rect = titleRef.current.getBoundingClientRect();
      dragRef.current = { 
          isDragging: true, 
          startX: clientX, 
          startY: clientY, 
          initialLeft: rect.left, 
          initialTop: rect.top 
      };
      titleRef.current.style.transform = 'none'; // reset center transform
      titleRef.current.style.left = `${rect.left}px`;
      titleRef.current.style.top = `${rect.top}px`;
  };

  const onDrag = (e: React.MouseEvent | React.TouchEvent) => {
      if (dragRef.current.isDragging && titleRef.current) {
          let clientX, clientY;
          if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
          } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
          }

          const dx = clientX - dragRef.current.startX;
          const dy = clientY - dragRef.current.startY;
          titleRef.current.style.left = `${dragRef.current.initialLeft + dx}px`;
          titleRef.current.style.top = `${dragRef.current.initialTop + dy}px`;
      }
  };
  const stopDrag = () => { dragRef.current.isDragging = false; };


  return (
    <div 
        className="relative w-screen h-screen bg-black overflow-hidden" 
        onMouseMove={onDrag} 
        onMouseUp={stopDrag}
        onTouchMove={onDrag}
        onTouchEnd={stopDrag}
    >
      {/* 3D Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Hidden Video for MediaPipe */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />

      {/* Loading Screen */}
      <div className={`absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-1000 ${isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-12 h-12 border border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
          <span className="mt-4 text-yellow-500 font-serif tracking-[0.3em] text-xs">SYSTEM INITIALIZING</span>
      </div>

      {/* Draggable Title */}
      <div 
        ref={titleRef}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className="absolute top-[10%] left-1/2 -translate-x-1/2 z-50 cursor-move text-center select-none"
        style={titleStyle}
      >
        <h1 className="leading-tight transition-all duration-200">{config.text.line1}</h1>
        <h1 className="leading-tight transition-all duration-200">{config.text.line2}</h1>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
        <button onClick={() => !document.fullscreenElement ? document.documentElement.requestFullscreen() : document.exitFullscreen()} className="bg-gray-900/80 backdrop-blur border border-white/10 text-yellow-500 px-3 py-1 text-[10px] uppercase rounded hover:bg-white/10 transition-colors">
            ⛶ Fullscreen
        </button>
        <button onClick={() => setUiVisible(!uiVisible)} className="bg-gray-900/80 backdrop-blur border border-white/10 text-yellow-500 px-3 py-1 text-[10px] uppercase rounded hover:bg-white/10 transition-colors">
            👁 Toggle UI
        </button>
      </div>

      {/* Main UI Sidebar */}
      <div className={`transition-transform duration-500 ${uiVisible ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
         <UIControls 
            config={config} 
            setConfig={setConfig} 
            photos={photos}
            onUploadPhotos={handleUploadPhotos}
            onUploadMusic={handleUploadMusic}
            onDeletePhoto={handleDeletePhoto}
            onClearPhotos={handleClearPhotos}
            toggleMusic={toggleMusic}
            replayMusic={() => { if(audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); setIsPlaying(true); } }}
            isPlaying={isPlaying}
            setMode={(m) => engineRef.current?.setMode(m)}
            triggerGrab={() => engineRef.current?.triggerPhotoGrab()}
            toggleCam={() => setCamVisible(!camVisible)}
            manualRotate={(x, y) => { if(engineRef.current) engineRef.current.manualRotate = {x, y}; }}
         />
      </div>

      {/* Webcam Preview */}
      <div className={`absolute bottom-4 right-4 w-40 h-30 border border-yellow-500/50 rounded-lg overflow-hidden bg-black z-20 shadow-[0_0_20px_rgba(0,0,0,0.9)] transition-all duration-500 ${camVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <canvas ref={c => {
             if(c && videoRef.current) {
                 const ctx = c.getContext('2d');
                 const loop = () => {
                     if(videoRef.current && videoRef.current.readyState >= 2) {
                         ctx?.drawImage(videoRef.current, 0, 0, c.width, c.height);
                     }
                     requestAnimationFrame(loop);
                 };
                 loop();
             }
          }} width={320} height={240} className="w-full h-full object-cover scale-x-[-1]" />
          <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full transition-colors duration-200 ${camActive ? 'bg-green-500 shadow-[0_0_6px_#00ff00]' : 'bg-red-900 shadow-[0_0_4px_#ff0000]'}`}></div>
      </div>
      
      {/* Footer Hint */}
      <div className="absolute bottom-2 w-full text-center text-[10px] text-yellow-500/50 z-10 pointer-events-none drop-shadow-md">
         Grand Luxury Tree v18 (React Port)
      </div>
    </div>
  );
}