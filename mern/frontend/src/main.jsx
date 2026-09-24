import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Set font-family variables
document.documentElement.style.setProperty('--font-body', '"DM Sans", sans-serif');
document.documentElement.style.setProperty('--font-heading', '"Outfit", sans-serif');

import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
)
