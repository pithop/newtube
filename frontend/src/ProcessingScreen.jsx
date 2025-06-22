import React, { useState } from 'react';
import TetrisGame from './TetrisGame';
import { Loader, Gamepad2, AlertTriangle, Eye } from 'lucide-react';

export default function ProcessingScreen({ progress, message, error, onReset }) {
  // 'waiting' is now the default view, giving the user a choice.
  const [viewMode, setViewMode] = useState('waiting'); // 'waiting' or 'game'

  if (error) {
    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="w-full max-w-lg bg-gray-800 text-white flex flex-col items-center justify-center p-8 text-center rounded-lg shadow-2xl">
                <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold">An Error Occurred</h2>
                <p className="text-red-400 mt-2 bg-gray-900 p-2 rounded-md">{error}</p>
                <button onClick={onReset} className="mt-6 px-6 py-2 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500">Try Again</button>
             </div>
        </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] bg-gray-800 shadow-2xl shadow-indigo-500/20 rounded-lg flex flex-col">
        {/* --- Persistent Header --- */}
        <div className="p-4 border-b border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-white">Processing Your Video</h3>
                {/* --- NEW: View Toggling Buttons --- */}
                <div className="flex items-center gap-2">
                    {viewMode === 'game' ? (
                        <button onClick={() => setViewMode('waiting')} title="Back to waiting view" className="flex items-center gap-2 px-3 py-1 bg-gray-700 text-sm rounded-md hover:bg-gray-600">
                            <Eye size={16} /> Just Watch
                        </button>
                    ) : (
                         <button onClick={() => setViewMode('game')} title="Play a game" className="flex items-center gap-2 px-3 py-1 bg-indigo-600 text-sm rounded-md hover:bg-indigo-500">
                            <Gamepad2 size={16} /> Play Tetris
                        </button>
                    )}
                </div>
            </div>
            <p className="text-center text-sm text-indigo-300 mb-2">{message}</p>
            <div className="w-full bg-gray-900 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
        </div>

        {/* --- Main Content Area --- */}
        <div className="flex-grow flex items-center justify-center p-4 relative">
            {viewMode === 'waiting' && (
                <div className="text-center">
                    <Loader className="w-16 h-16 text-indigo-400 animate-spin" />
                    <p className="mt-4 text-gray-300">Your results will appear here when ready.</p>
                </div>
            )}
            {viewMode === 'game' && (
                <div className="w-full h-full max-w-sm max-h-[500px] flex items-center justify-center">
                    <TetrisGame />
                </div>
            )}
        </div>
        
        {/* Ad Placeholder */}
        <div className="text-center p-2 border-t border-gray-700">
             <p className="text-xs text-gray-500">Advertisement</p>
        </div>
      </div>
    </div>
  );
}
