import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Film, Type, FileText, Image as ImageIcon, Copy, Download, Loader, AlertTriangle, CheckCircle, Wand2, Coffee } from 'lucide-react';

// --- Helper Components ---

const IconWrapper = ({ icon: Icon, className = '' }) => (
  <div className={`p-3 bg-gray-700/50 rounded-full ${className}`}>
    <Icon className="w-6 h-6 text-gray-300" />
  </div>
);

const Section = ({ title, icon, children }) => (
  <div className="bg-gray-800/50 border border-gray-700 rounded-2xl shadow-lg backdrop-blur-sm">
    <div className="flex items-center p-4 border-b border-gray-700">
      {icon}
      <h2 className="ml-4 text-xl font-bold text-white">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const ResultField = ({ label, children, textToCopy, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (textToCopy) {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <button
          onClick={handleCopy}
          className="flex items-center px-3 py-1 text-xs text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors"
        >
          {copied ? <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 bg-gray-900/70 border border-gray-700 rounded-lg text-gray-200">
        {children}
      </div>
    </div>
  );
};


// --- Main App Component ---

export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [language, setLanguage] = useState('en');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  const [selectedTitle, setSelectedTitle] = useState('');

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      setResults(null);
      setError('');
      setStatus('idle');
      setSelectedTitle('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv'] },
    multiple: false,
  });

  const dropzoneStyles = useMemo(() => {
    const base = "p-8 w-full border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center";
    if (isDragAccept) return `${base} border-green-500 bg-green-500/10`;
    if (isDragReject) return `${base} border-red-500 bg-red-500/10`;
    return `${base} border-gray-600 hover:border-indigo-500 hover:bg-indigo-500/10`;
  }, [isDragActive, isDragAccept, isDragReject]);

  const handleProcessVideo = async () => {
    if (!videoFile) {
      setError("Please select a video file first.");
      return;
    }
    setStatus('processing');
    setError('');
    setResults(null);
    setProgress(0);

    const formData = new FormData();
    formData.append('video_file', videoFile);
    formData.append('language', language);
    
    let uploadProgress = 0;
    const progressInterval = setInterval(() => {
        uploadProgress += 5;
        if (uploadProgress >= 95) clearInterval(progressInterval);
        setProgress(uploadProgress);
    }, 200);

    try {
        // IMPORTANT: This is now your public backend URL from Hugging Face
        const API_URL = "https://pithop-creator-assistant.hf.space/process-video/";
        const response = await fetch(API_URL, { method: 'POST', body: formData });
        
        clearInterval(progressInterval);
        setProgress(100);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "An unknown error occurred during processing.");
        }

        const data = await response.json();
        setResults(data);
        if (data.titles && data.titles.length > 0) {
          setSelectedTitle(data.titles[0]);
        }
        setStatus('success');
    } catch (err) {
        setError(err.message || 'Failed to connect to the server. Is it running?');
        setStatus('error');
    }
  };
  
  const resetState = () => {
    setVideoFile(null);
    setResults(null);
    setError('');
    setStatus('idle');
    setProgress(0);
    setSelectedTitle('');
  };

  const handleDownloadThumbnail = (base64Image, index) => {
    const link = document.createElement('a');
    link.href = base64Image;
    link.download = `thumbnail_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto flex-grow">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-500 to-red-500">
            Creator Assistant AI
          </h1>
          <p className="text-gray-400 mt-2">Automate your YouTube workflow: from transcript to thumbnails in one click.</p>
        </header>

        <main>
          {status !== 'success' && status !== 'processing' ? (
            <Section title="Upload Your Video" icon={<IconWrapper icon={UploadCloud} />}>
              <div {...getRootProps()} className={dropzoneStyles}>
                <input {...getInputProps()} />
                <UploadCloud className={`w-16 h-16 mb-4 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`} />
                <p className="text-lg">{isDragActive ? "Drop the video here ..." : "Drag 'n' drop a video file here, or click to select"}</p>
                <p className="text-sm text-gray-500 mt-2">MP4, MOV, AVI, MKV supported</p>
              </div>
              
              {videoFile && (
                <div className="mt-6 p-4 bg-gray-700/50 rounded-lg flex items-center justify-between">
                  <div className='flex items-center'><Film className="w-6 h-6 mr-3 text-indigo-400" /><span className="font-medium">{videoFile.name}</span></div>
                  <button onClick={() => setVideoFile(null)} className='text-sm text-red-400 hover:text-red-300'>Remove</button>
                </div>
              )}

              <div className="mt-6">
                <label htmlFor="language" className="block text-sm font-medium text-gray-400 mb-2">Video Language</label>
                <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-900/70 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="en">English</option> <option value="es">Spanish</option> <option value="fr">French</option> <option value="de">German</option> <option value="ar">Arabic</option> <option value="">Auto-Detect</option>
                </select>
              </div>

              <div className="mt-8 text-center">
                <button onClick={handleProcessVideo} disabled={!videoFile || status === 'processing'} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all transform hover:scale-105">Generate Content</button>
              </div>
            </Section>
          ) : null}

          {status === 'processing' && (
            <Section title="Processing Status" icon={<IconWrapper icon={Loader} />}>
              <div className="text-center">
                <Loader className="w-16 h-16 text-indigo-400 animate-spin mx-auto mb-4" />
                <p className="text-lg font-semibold">Generating Magic...</p>
                <p className="text-gray-400">This might take a few minutes for longer videos.</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
              </div>
            </Section>
          )}

          {status === 'error' && (
            <Section title="Error" icon={<IconWrapper icon={AlertTriangle} />}>
              <div className="text-center p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-lg font-semibold text-red-400">An Error Occurred</p>
                <p className="text-gray-300 mt-1">{error}</p>
                <button onClick={resetState} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500">Try Again</button>
              </div>
            </Section>
          )}

          {status === 'success' && results && (
            <div className='space-y-8 mt-8'>
              <Section title="AI Generated Content" icon={<IconWrapper icon={Wand2} />}>
                
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-400">Choose Your Favorite Title</label>
                        <button onClick={() => navigator.clipboard.writeText(selectedTitle)} className="flex items-center px-3 py-1 text-xs text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors">
                            <Copy className="w-4 h-4 mr-2" /> Copy Selected
                        </button>
                    </div>
                    <div className="space-y-2">
                        {results.titles.map((title, index) => (
                            <div key={index}
                                 onClick={() => setSelectedTitle(title)}
                                 className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${selectedTitle === title ? 'bg-indigo-600/30 border-indigo-500' : 'bg-gray-900/70 border-gray-700 hover:border-gray-500'}`}>
                                <p className="text-gray-200">{title}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <ResultField label="Video Description" textToCopy={results.description}>
                  <textarea rows="8" defaultValue={results.description} className="w-full bg-transparent text-gray-200" />
                </ResultField>
              </Section>
              
              <Section title="Generated Thumbnails" icon={<IconWrapper icon={ImageIcon} />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {results.thumbnails.map((thumb, index) => (
                    <div key={index} className="group relative border-2 border-gray-700 rounded-lg overflow-hidden">
                      <img src={thumb} alt={`Thumbnail ${index + 1}`} className="w-full h-auto aspect-video object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => handleDownloadThumbnail(thumb, index)}
                          className="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-500 transition-colors"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Full Transcript" icon={<IconWrapper icon={FileText} />}>
                <ResultField label="Video Transcript" textToCopy={results.transcript}>
                  <textarea readOnly rows="10" defaultValue={results.transcript} className="w-full bg-transparent text-gray-200 text-sm leading-relaxed" />
                </ResultField>
              </Section>

              <div className="text-center pt-4"><button onClick={resetState} className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600">Process Another Video</button></div>
            </div>
          )}
        </main>
      </div>
      
      {/* --- NEW: Buy Me a Coffee Footer --- */}
      <footer className="w-full max-w-4xl mx-auto text-center py-4 mt-8">
        <a 
          href="https://buymeacoffee.com/pithop" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Coffee className="w-5 h-5 mr-2 text-yellow-400" />
          <span>Enjoy this free tool? Buy me a coffee!</span>
        </a>
      </footer>
    </div>
  );
}
