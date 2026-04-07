import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';

const AnnotationMushaf = React.lazy(() => import('./components/AnnotationMushaf'));

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading Mushaf...</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mushaf" element={<AnnotationMushaf />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
