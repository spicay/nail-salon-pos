import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { StaffProvider } from './lib/StaffContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StaffProvider>
      <App />
    </StaffProvider>
  </React.StrictMode>
)
