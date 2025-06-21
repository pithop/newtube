import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Film, Type, Image as ImageIcon, Copy, Download, Loader, AlertTriangle, CheckCircle, Wand2, Coffee, Sparkles, Twitter, Linkedin, Hash } from 'lucide-react';

// --- Helper Functions ---
const parseTimestampToSeconds = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') return 0;
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

// --- Main App Component ---
export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  // Editing and Interaction State
  const [selectedTitle, setSelectedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedTranscript, setEditedTranscript] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);

  const videoRef = useRef(null);
  const activeSegmentRef = useRef(null);

  // When a new video file is dropped, create a URL for the video player
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url); // Clean up the URL on component unmount
    }
  }, [videoFile]);

  // Effect to sync video playback with transcript highlighting
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !results?.transcript) return;

    const handleTimeUpdate = () => {
      const currentTime = videoElement.currentTime;
      const currentSegment = results.transcript.find(segment => {
        const start = parseTimestampToSeconds(segment.start);
        const end = parseTimestampToSeconds(segment.end);
        return currentTime >= start && currentTime < end;
      });
      if (currentSegment) {
        setActiveSegment(currentSegment);
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    return () => videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  }, [results?.transcript]);

  // Effect to scroll the active transcript segment into view
  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegment]);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      setVideoFile(acceptedFiles[0]);
      setResults(null);
      setError('');
      setStatus('idle');
    }
  }, []);

  const handleProcessVideo = async () => {
    if (!videoFile) return;
    setStatus('processing');
    setError('');

    const formData = new FormData();
    formData.append('video_file', videoFile);
    
    try {
      const API_URL = "https://pithop-creator-assistant.hf.space/process-video/";
      const response = await fetch(API_URL, { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "An error occurred.");
      }
      const data = await response.json();
      setResults(data);
      setSelectedTitle(data.titles[0] || '');
      setEditedDescription(data.description || '');
      setEditedTranscript(data.transcript || []);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Failed to connect to the server.');
      setStatus('error');
    }
  };
  
  const handleTranscriptClick = (segment) => {
    if (videoRef.current) {
        videoRef.current.currentTime = parseTimestampToSeconds(segment.start);
        videoRef.current.play();
    }
  };
  
  const handleTranscriptChange = (e, index) => {
    const newTranscript = [...editedTranscript];
    newTranscript[index].text = e.target.value;
    setEditedTranscript(newTranscript);
  };

  if (status === 'idle' || status === 'error') {
    return <UploadScreen onDrop={onDrop} handleProcessVideo={handleProcessVideo} videoFile={videoFile} error={error} />;
  }
  if (status === 'processing') {
    return <ProcessingScreen />;
  }
  if (status === 'success' && results) {
    return (
      <EditorScreen
        videoUrl={videoUrl}
        videoRef={videoRef}
        results={results}
        selectedTitle={selectedTitle}
        setSelectedTitle={setSelectedTitle}
        editedDescription={editedDescription}
        setEditedDescription={setEditedDescription}
        editedTranscript={editedTranscript}
        handleTranscriptChange={handleTranscriptChange}
        handleTranscriptClick={handleTranscriptClick}
        activeSegment={activeSegment}
        activeSegmentRef={activeSegmentRef}
      />
    );
  }
  return null; // Fallback
}

// --- UI Components for different states ---

const UploadScreen = ({ onDrop, handleProcessVideo, videoFile, error }) => {
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
          <p className="text-center text-lg">{isDragActive ? "Drop it like it's hot!" : "Drag & drop video file, or click to select"}</p>
        </div>
        {videoFile && <p className="text-center text-green-400 mt-4">Selected: {videoFile.name}</p>}
        {error && <p className="text-center text-red-400 mt-4">{error}</p>}
        <button onClick={handleProcessVideo} disabled={!videoFile} className="w-full mt-6 py-3 bg-indigo-600 font-bold rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">Generate Content</button>
      </div>
      <Footer />
    </div>
  );
};

const ProcessingScreen = () => (
  <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
    <Loader className="w-24 h-24 text-indigo-400 animate-spin" />
    <p className="text-2xl font-bold mt-8">AI is working its magic...</p>
    <p className="text-gray-400">Transcribing, analyzing, and creating content.</p>
  </div>
);

const EditorScreen = ({ videoUrl, videoRef, results, selectedTitle, setSelectedTitle, editedDescription, setEditedDescription, editedTranscript, handleTranscriptChange, handleTranscriptClick, activeSegment, activeSegmentRef }) => {
  const [activeTab, setActiveTab] = useState('transcript');
  return (
    <div className="min-h-screen bg-gray-800 text-white p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-2rem)]">
        {/* Left Column: Media */}
        <div className="flex flex-col gap-4 h-full">
          <div className="bg-black rounded-xl overflow-hidden aspect-video">
            <video ref={videoRef} src={videoUrl} controls className="w-full h-full" />
          </div>
          <div className="flex-grow bg-gray-900/50 p-4 rounded-xl">
            <h3 className="text-lg font-bold mb-3">Generated Thumbnails</h3>
            <div className="grid grid-cols-3 gap-3">
              {results.thumbnails.map((thumb, index) => (
                <img key={index} src={thumb} alt={`Thumb ${index + 1}`} className="rounded-md aspect-video object-cover" />
              ))}
            </div>
          </div>
        </div>
        {/* Right Column: Content */}
        <div className="bg-gray-900/50 p-4 rounded-xl flex flex-col h-full">
            <div className="border-b border-gray-700">
                <nav className="flex space-x-4">
                    <button onClick={() => setActiveTab('transcript')} className={`py-2 px-4 font-semibold ${activeTab === 'transcript' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>Transcript</button>
                    <button onClick={() => setActiveTab('content')} className={`py-2 px-4 font-semibold ${activeTab === 'content' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>Content</button>
                    <button onClick={() => setActiveTab('repurpose')} className={`py-2 px-4 font-semibold ${activeTab === 'repurpose' ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400'}`}>Repurpose</button>
                </nav>
            </div>
            <div className="flex-grow overflow-y-auto mt-4 pr-2">
                {activeTab === 'transcript' && (
                    <div className="space-y-4">
                        {editedTranscript.map((segment, index) => (
                            <div key={index} ref={activeSegment === segment ? activeSegmentRef : null} onClick={() => handleTranscriptClick(segment)}
                                className={`flex gap-4 p-2 rounded-lg cursor-pointer transition-all ${activeSegment === segment ? 'bg-indigo-600/30' : 'hover:bg-gray-700/50'}`}>
                                <p className="font-mono text-sm text-indigo-400">{segment.start}</p>
                                <textarea value={segment.text} onChange={(e) => handleTranscriptChange(e, index)} className="w-full bg-transparent text-gray-300 resize-none leading-relaxed focus:outline-none"/>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'content' && (
                    <div className="p-2">
                        <h4 className="font-bold mb-2">AI-Generated Titles</h4>
                         <div className="space-y-2 mb-6">
                            {results.titles.map((title, index) => (
                                <div key={index} onClick={() => setSelectedTitle(title)} className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedTitle === title ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700'}`}>
                                    <p>{title}</p>
                                </div>
                            ))}
                        </div>
                        <h4 className="font-bold mb-2">AI-Generated Description</h4>
                        <textarea value={editedDescription} onChange={e => setEditedDescription(e.target.value)} className="w-full h-48 bg-gray-800 p-2 rounded-md resize-none"/>
                    </div>
                )}
                {activeTab === 'repurpose' && <RepurposeTool transcript={results.transcript} />}
            </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const RepurposeTool = ({ transcript }) => {
    // In a real app, this would make another API call to the LLM
    const fullText = transcript.map(s => s.text).join(' ');
    return (
        <div className="p-2 space-y-6">
            <div>
                <h4 className="flex items-center gap-2 font-bold mb-2"><Hash size={20}/> Hashtags & Keywords</h4>
                <div className="bg-gray-800 p-3 rounded-md text-gray-300">#YourTopic, #VideoKeywords, #AI, #ContentCreation, #YouTubeTips</div>
            </div>
            <div>
                <h4 className="flex items-center gap-2 font-bold mb-2"><Linkedin size={20}/> LinkedIn Post</h4>
                <div className="bg-gray-800 p-3 rounded-md text-gray-300">Excited to share insights on [Your Topic] in my latest video! We dive deep into... [AI Generated Summary]. Perfect for anyone in [Your Industry]. Watch the full video for more! #LinkedInPost</div>
            </div>
            <div>
                <h4 className="flex items-center gap-2 font-bold mb-2"><Twitter size={20}/> X / Twitter Thread</h4>
                <div className="bg-gray-800 p-3 rounded-md text-gray-300">1/ Just dropped a new video on [Your Topic]! 🧵 Here are the key takeaways... [AI Generated Hook]. #TwitterThread</div>
            </div>
        </div>
    )
};

const Footer = () => (
    <footer className="w-full text-center py-4">
        <a href="https://buymeacoffee.com/pithop" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <Coffee className="text-yellow-400"/> Found this useful? Buy me a coffee!
        </a>
    </footer>
);
