// frontend/src/main.jsx

import React from 'react'
import ReactDOM from 'react-dom/client'
// CORRECTED PATH:
// We are importing from the current directory ('./') because
// NewTubeCreatorAssistant.jsx is in the same folder as main.jsx.
import App from './NewTubeCreatorAssistant.jsx' 
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
