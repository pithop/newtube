// frontend/src/main.jsx

import React from 'react'
import ReactDOM from 'react-dom/client'
// FIX: Changed the import from './App.jsx' to point to the correct component file.
import App from './NewTubeCreatorAssistant.jsx' 
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
