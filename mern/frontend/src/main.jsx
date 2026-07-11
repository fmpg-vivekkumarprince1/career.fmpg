import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Import font-family from App.css
// Create a link element to import the fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap';
document.head.appendChild(fontLink);

// Set font-family variables
document.documentElement.style.setProperty('--font-body', '"DM Sans", sans-serif');
document.documentElement.style.setProperty('--font-heading', '"Outfit", sans-serif');

import { HelmetProvider } from 'react-helmet-async';

ReactDOM.createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
)
