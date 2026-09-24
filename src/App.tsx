import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>(() => {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'home';
  });

  // Listen to popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/admin')) {
        setCurrentPage('admin');
      } else {
        setCurrentPage('home');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin/data');
    setCurrentPage('admin');
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setCurrentPage('home');
  };

  if (currentPage === 'admin') {
    return <AdminPage onBackToApp={navigateToHome} />;
  }

  return <HomePage onNavigateToAdmin={navigateToAdmin} />;
}

export default App;
