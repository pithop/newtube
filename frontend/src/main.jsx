import React from 'react'
import ReactDOM from 'react-dom/client'
// This now imports the standard App.jsx file.
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
