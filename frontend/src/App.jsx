import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Film, Type, Image as ImageIcon, Copy, Download, Loader, AlertTriangle, CheckCircle, Wand2, Coffee, Sparkles, Twitter, Linkedin, Hash, ClipboardCopy, ClipboardCheck } from 'lucide-react';

// --- Helper Functions ---
const parseTimestampToSeconds = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') return 0;
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
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

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoFile]);

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
      if (currentSegment && currentSegment.start !== activeSegment?.start) {
        setActiveSegment(currentSegment);
      }
    };
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    return () => videoElement.removeEventListener('timeupdate', handleTimeUpdate);
  }, [results?.transcript, activeSegment]);

  useEffect(() => {
    activeSegmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    return <EditorScreen {...{ videoUrl, videoRef, results, selectedTitle, setSelectedTitle, editedDescription, setEditedDescription, editedTranscript, handleTranscriptChange, handleTranscriptClick, activeSegment, activeSegmentRef }} />;
  }
  return null;
}

// --- UI Components ---

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
    
    const handleDownloadThumbnail = (thumbData, index) => {
        const link = document.createElement('a');
        link.href = thumbData;
        link.download = `thumbnail_${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col p-4">
            <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
                {/* Left Column */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="bg-black rounded-xl overflow-hidden aspect-video">
                        <video ref={videoRef} src={videoUrl} controls className="w-full h-full" />
                    </div>
                    <div className="flex-grow bg-gray-900/50 p-4 rounded-xl flex flex-col">
                         <h3 className="text-lg font-bold mb-3">Generated Thumbnails</h3>
                         <div className="grid grid-cols-3 gap-3">
                            {results.thumbnails.map((thumb, index) => (
                                <div key={index} className="relative group">
                                    <img src={thumb} alt={`Thumb ${index + 1}`} className="rounded-md aspect-video object-cover" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => handleDownloadThumbnail(thumb, index)} className="p-2 bg-indigo-600 rounded-full"><Download size={20}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Right Column */}
                <div className="bg-gray-900/50 rounded-xl flex flex-col h-full">
                    <div className="border-b border-gray-700 px-4">
                        <nav className="flex space-x-4">
                            <TabButton id="transcript" activeTab={activeTab} setActiveTab={setActiveTab}>Transcript</TabButton>
                            <TabButton id="content" activeTab={activeTab} setActiveTab={setActiveTab}>Content</TabButton>
                            <TabButton id="repurpose" activeTab={activeTab} setActiveTab={setActiveTab}>Repurpose</TabButton>
                        </nav>
                    </div>
                    <div className="flex-grow overflow-y-auto mt-4 pr-2">
                        {activeTab === 'transcript' && <TranscriptPanel {...{ editedTranscript, handleTranscriptChange, handleTranscriptClick, activeSegment, activeSegmentRef }} />}
                        {activeTab === 'content' && <ContentPanel {...{ results, selectedTitle, setSelectedTitle, editedDescription, setEditedDescription }} />}
                        {activeTab === 'repurpose' && <RepurposePanel transcript={results.transcript} />}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

// --- Sub-components for EditorScreen ---
const TabButton = ({ id, activeTab, setActiveTab, children }) => (
    <button onClick={() => setActiveTab(id)} className={`py-2 px-1 font-semibold transition-colors ${activeTab === id ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-gray-200'}`}>{children}</button>
);

const CopyButton = ({ textToCopy }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button onClick={handleCopy} className="p-1 text-gray-400 hover:text-white transition-colors">
            {copied ? <ClipboardCheck size={16} className="text-green-500" /> : <ClipboardCopy size={16} />}
        </button>
    );
};

const TranscriptPanel = ({ editedTranscript, handleTranscriptChange, handleTranscriptClick, activeSegment, activeSegmentRef }) => {
    const fullTranscriptText = editedTranscript.map(s => s.text).join('\n');
    return (
        <div className="px-4">
             <div className="flex justify-end mb-2">
                <button onClick={() => navigator.clipboard.writeText(fullTranscriptText)} className="flex items-center gap-2 text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md">
                    <Copy size={14} /> Copy Full Transcript
                </button>
            </div>
            <div className="space-y-1">
                {editedTranscript.map((segment, index) => (
                    <div key={segment.start + index} ref={activeSegment === segment ? activeSegmentRef : null} onClick={() => handleTranscriptClick(segment)}
                        className={`group flex gap-3 p-2 rounded-lg cursor-pointer transition-all ${activeSegment === segment ? 'bg-indigo-600/30' : 'hover:bg-gray-700/50'}`}>
                        <p className="font-mono text-sm text-indigo-400 mt-1">{segment.start}</p>
                        <textarea value={segment.text} onChange={(e) => handleTranscriptChange(e, index)} rows={Math.max(1, segment.text.length / 50)} className="w-full bg-transparent text-gray-300 resize-none leading-relaxed focus:outline-none"/>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <CopyButton textToCopy={segment.text}/>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ContentPanel = ({ results, selectedTitle, setSelectedTitle, editedDescription, setEditedDescription }) => (
    <div className="p-2 space-y-6">
        <div>
            <h4 className="font-bold mb-2">AI-Generated Titles</h4>
             <div className="space-y-2">
                {results.titles.map((title, index) => (
                    <div key={index} onClick={() => setSelectedTitle(title)} className={`p-3 rounded-lg cursor-pointer transition-all border-2 ${selectedTitle === title ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                        <p>{title}</p>
                    </div>
                ))}
            </div>
        </div>
        <div>
            <h4 className="font-bold mb-2">AI-Generated Description</h4>
            <textarea value={editedDescription} onChange={e => setEditedDescription(e.target.value)} className="w-full h-48 bg-gray-800 p-3 rounded-md resize-none border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
        </div>
    </div>
);

const RepurposePanel = ({ transcript }) => {
    const [repurposeStatus, setRepurposeStatus] = useState('idle');
    const [repurposedContent, setRepurposedContent] = useState({ hashtags: '', linkedin: '', twitter: '' });
    
    const handleRepurpose = async () => {
        setRepurposeStatus('loading');
        const fullText = transcript.map(s => s.text).join(' ');
        
        // This would be a real API call in a full implementation
        // For now, we simulate it with placeholders.
        setTimeout(() => {
            setRepurposedContent({
                hashtags: '#YourTopic, #VideoKeywords, #AI, #ContentCreation, #YouTubeTips, #NewVideo',
                linkedin: `Excited to share insights on [Your Topic] in my latest video!\n\nWe dive deep into...\n- [AI Generated Point 1]\n- [AI Generated Point 2]\n\nPerfect for anyone in [Your Industry]. Watch the full video for more! #LinkedInPost #YourIndustry`,
                twitter: `1/ Just dropped a new video on [Your Topic]! 🧵 Here are the key takeaways...\n\n- [AI Generated Hook 1].\n- [AI Generated Hook 2].\n\nWatch the full video here: [Your Link] #TwitterThread`
            });
            setRepurposeStatus('success');
        }, 1000);
    };

    return (
        <div className="p-2 space-y-6">
            <button onClick={handleRepurpose} disabled={repurposeStatus === 'loading'} className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 font-bold rounded-lg hover:bg-indigo-500 disabled:bg-gray-600 transition-colors">
                {repurposeStatus === 'loading' ? <Loader className="animate-spin"/> : <Sparkles/>}
                Generate Repurposed Content
            </button>
            <RepurposeField icon={Hash} title="Hashtags & Keywords" value={repurposedContent.hashtags} onChange={e => setRepurposedContent({...repurposedContent, hashtags: e.target.value})} />
            <RepurposeField icon={Linkedin} title="LinkedIn Post" value={repurposedContent.linkedin} onChange={e => setRepurposedContent({...repurposedContent, linkedin: e.target.value})} />
            <RepurposeField icon={Twitter} title="X / Twitter Thread" value={repurposedContent.twitter} onChange={e => setRepurposedContent({...repurposedContent, twitter: e.target.value})} />
        </div>
    );
};

const RepurposeField = ({ icon: Icon, title, value, onChange }) => (
    <div>
        <h4 className="flex items-center gap-2 font-bold mb-2"><Icon size={20}/> {title}</h4>
        <textarea value={value} onChange={onChange} className="w-full h-32 bg-gray-800 p-3 rounded-md resize-none border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"/>
    </div>
);

const Footer = () => (
    <footer className="w-full text-center py-4 mt-auto">
        <a href="https://buymeacoffee.com/pithop" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <Coffee className="text-yellow-400"/> Found this useful? Buy me a coffee!
        </a>
    </footer>
);
