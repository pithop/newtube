import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Film, Type, Image as ImageIcon, Copy, Download, Loader, AlertTriangle, CheckCircle, Wand2, Coffee, Sparkles, Twitter, Linkedin, Hash, ClipboardCopy, ClipboardCheck } from 'lucide-react';

// Import the NEW, separate components
import ProcessingScreen from './ProcessingScreen';
import EditorScreen from './EditorScreen';

// --- Main App Component ---
export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  const handleProcessVideo = async (file) => {
    if (!file) return;
    setStatus('processing');
    setError('');
    setVideoFile(file); // Keep the file object for the video player

    const formData = new FormData();
    formData.append('video_file', file);
    
    try {
      // Ensure this URL points to your deployed Hugging Face Space
      const API_URL = "https://pithop-creator-assistant.hf.space/process-video/";
      const response = await fetch(API_URL, { method: 'POST', body: formData });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "An error occurred in the backend.");
      }
      const data = await response.json();
      setResults(data);
      setStatus('success');
    } catch (err) {
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

  // The main render logic that switches between screens
  if (status === 'success' && results) {
    return <EditorScreen results={results} videoFile={videoFile} onReset={handleReset} />;
  }
  
  if (status === 'processing') {
    // When processing, show the new screen with the ad/game experience.
    return <ProcessingScreen />;
  }

  // Default view is the UploadScreen
  return <UploadScreen onProcess={handleProcessVideo} error={error} />;
}


// --- UI Components ---
// We keep the UploadScreen here for simplicity, but EditorScreen is now in its own file.

const UploadScreen = ({ onProcess, error }) => {
    const [file, setFile] = useState(null);
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'video/*': ['.mp4', '.mov']}, multiple: false });

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
            <header className="text-center mb-8">
                <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-500 to-red-500">Creator AI Co-Pilot</h1>
                <p className="text-gray-400 mt-2">Go from raw video to published content in minutes.</p>
            </header>
            <div className="w-full max-w-2xl bg-gray-800/50 border border-gray-700 rounded-2xl p-8 shadow-lg">
                <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-600 hover:border-gray-500'}`}>
                    <input {...getInputProps()} />
                    <UploadCloud className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                    <p className="text-center text-lg">{file ? `Selected: ${file.name}` : (isDragActive ? "Drop it like it's hot!" : "Drag & drop video file, or click to select")}</p>
                </div>
                {error && <p className="text-center text-red-400 mt-4">{error}</p>}
                <button onClick={() => onProcess(file)} disabled={!file} className="w-full mt-6 py-3 bg-indigo-600 font-bold rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">Generate Content</button>
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
