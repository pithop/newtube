import React, { useState, useCallback, useEffect } from 'react';
import ProcessingScreen from './ProcessingScreen';
import EditorScreen from './EditorScreen';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Coffee, ShieldAlert } from 'lucide-react';

const TRIES_KEY = 'creatorAITriesLeft';

// --- Main App Component ---
export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  // NEW: State for tracking usage limit
  const [triesLeft, setTriesLeft] = useState(2);
  
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  // On initial load, check localStorage for remaining tries
  useEffect(() => {
    const savedTries = localStorage.getItem(TRIES_KEY);
    // If there's a saved value, use it. Otherwise, it defaults to 2.
    if (savedTries !== null) {
      setTriesLeft(parseInt(savedTries, 10));
    }
  }, []);

  const handleProcessVideo = async (file) => {
    if (!file) return;

    // NEW: Check if the user has any tries left
    if (triesLeft <= 0) {
      setError("You've used all your free trials. To continue using this tool, please consider supporting its development!");
      return;
    }

    setStatus('processing');
    setError('');
    setVideoFile(file);
    
    // Decrement and save the new count BEFORE starting the process
    const newTries = triesLeft - 1;
    setTriesLeft(newTries);
    localStorage.setItem(TRIES_KEY, newTries);
    
    // ... (rest of the progress simulation logic)
    const totalDuration = 30;
    let elapsedTime = 0;
    setProgress(0);
    setProgressMessage('Uploading video...');

    const progressInterval = setInterval(() => {
        elapsedTime++;
        const currentProgress = Math.min(95, Math.floor((elapsedTime / totalDuration) * 100));
        setProgress(currentProgress);
        if (currentProgress < 20) setProgressMessage('Initializing AI models...');
        else if (currentProgress < 60) setProgressMessage('Transcribing audio...');
        else if (currentProgress < 85) setProgressMessage('Generating titles & descriptions...');
        else setProgressMessage('Creating thumbnails...');
    }, 1000);

    const formData = new FormData();
    formData.append('video_file', file);
    
    try {
      const API_URL = "https://pithop-creator-assistant.hf.space/process-video/";
      const response = await fetch(API_URL, { method: 'POST', body: formData });
      
      clearInterval(progressInterval);
      setProgress(100);
      setProgressMessage('Processing Complete!');

      if (!response.ok) {
        const errorData = await response.json();
        // If the backend fails, give the user their try back
        setTriesLeft(triesLeft); 
        localStorage.setItem(TRIES_KEY, triesLeft);
        throw new Error(errorData.detail || "An error occurred in the backend.");
      }
      const data = await response.json();
      setResults(data);
      setStatus('success');
    } catch (err) {
      // Also give the user their try back on connection errors
      setTriesLeft(triesLeft);
      localStorage.setItem(TRIES_KEY, triesLeft);
      setError(err.message || 'Failed to connect to the server.');
      setStatus('error');
    }
  };
  
  const handleReset = () => {
    setStatus('idle');
    setVideoFile(null);
    setResults(null);
    setError('');
  };

  if (status === 'success' && results) {
    return <EditorScreen results={results} videoFile={videoFile} onReset={handleReset} />;
  }
  
  if (status === 'processing' || (status === 'error' && !results)) {
    return <ProcessingScreen progress={progress} message={progressMessage} error={error} onReset={handleReset} />;
  }

  // Pass the number of tries left to the UploadScreen
  return <UploadScreen onProcess={handleProcessVideo} error={error} triesLeft={triesLeft} />;
}

// --- UI Components ---
const UploadScreen = ({ onProcess, error, triesLeft }) => {
    const [file, setFile] = useState(null);
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'video/*': ['.mp4', '.mov']}, multiple: false });

    const hasTries = triesLeft > 0;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <header className="text-center mb-8">
                <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-500 to-red-500">Creator AI Co-Pilot</h1>
                <p className="text-gray-400 mt-2">Go from raw video to published content in minutes.</p>
            </header>
            <div className="w-full max-w-2xl bg-gray-800/50 border border-gray-700 rounded-2xl p-8 shadow-lg">
                <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-xl transition-all ${!hasTries ? 'cursor-not-allowed' : 'cursor-pointer'} ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                    <input {...getInputProps()} disabled={!hasTries} />
                    <UploadCloud className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                    <p className="text-center text-lg">{file ? `Selected: ${file.name}` : (isDragActive ? "Drop it like it's hot!" : "Drag & drop video file, or click to select")}</p>
                </div>
                {error && <p className="text-center text-red-400 mt-4">{error}</p>}
                
                {/* NEW: UI for showing remaining tries or the limit message */}
                {hasTries ? (
                    <button onClick={() => onProcess(file)} disabled={!file} className="w-full mt-6 py-3 bg-indigo-600 font-bold rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        Generate Content ({triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left)
                    </button>
                ) : (
                    <div className="mt-6 text-center bg-yellow-900/50 border border-yellow-700 p-4 rounded-lg">
                        <ShieldAlert className="w-12 h-12 text-yellow-400 mx-auto mb-2"/>
                        <p className="font-bold text-yellow-300">You've used all your free trials!</p>
                        <p className="text-sm text-yellow-400 mt-1">To support the server costs and continue using this tool, please consider making a contribution.</p>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

const Footer = () => (
    <footer className="w-full text-center py-4 mt-auto">
        <a href="https://buymeacoffee.com/pithop" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <Coffee className="text-yellow-400"/> Found this useful? Buy me a coffee!
        </a>
    </footer>
);
