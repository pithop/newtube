import React, { useState, useEffect } from 'react';
import TetrisGame from './TetrisGame'; // Import the Tetris game component

// --- Ad Component ---
const AdInterstitial = ({ onAdComplete }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onAdComplete();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onAdComplete]);

  return (
    <div className="w-full h-full bg-gray-800 text-white flex flex-col items-center justify-center p-8 text-center rounded-lg">
      <div className="border border-yellow-400 p-4 rounded-lg">
        <p className="text-yellow-400 font-bold">Advertisement</p>
      </div>
      <h2 className="text-3xl font-bold mt-8">Your content is being generated!</h2>
      <p className="text-gray-400 mt-2">In the meantime, enjoy a game of Tetris, starting in...</p>
      <div className="text-6xl font-bold my-8 text-indigo-400 font-mono">{countdown}</div>
      {/* TODO: Replace this div with your actual ad network code (e.g., Google AdSense) */}
      <div className="w-full max-w-md h-48 bg-gray-700 flex items-center justify-center rounded-md">
        <p className="text-gray-500">Your Ad Here</p>
      </div>
       <button onClick={onAdComplete} className="mt-8 text-sm text-gray-500 hover:text-white">
        Skip Ad
      </button>
    </div>
  );
};


// --- Main Processing Screen Component ---
export default function ProcessingScreen() {
  const [screenState, setScreenState] = useState('ad'); // 'ad' or 'game'

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full h-full sm:w-auto sm:h-auto sm:aspect-[4/5] sm:max-h-[90vh] bg-black shadow-2xl shadow-indigo-500/20 rounded-lg">
        {screenState === 'ad' && <AdInterstitial onAdComplete={() => setScreenState('game')} />}
        {screenState === 'game' && <TetrisGame />}
      </div>
    </div>
  );
}
