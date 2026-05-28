import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { TooltipProvider } from './components/ui/tooltip';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <App />
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      </TooltipProvider>
    </BrowserRouter>
  </React.StrictMode>
);
