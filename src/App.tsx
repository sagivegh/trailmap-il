import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';

export function App() {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  const isAdminPath = () => {
    return window.location.pathname.includes('/admin') || window.location.hash.includes('admin');
  };

  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>(() => {
    return isAdminPath() ? 'admin' : 'home';
  });

  // Listen to popstate (browser back/forward) and hashchange
  useEffect(() => {
    const handleNavigation = () => {
      if (isAdminPath()) {
        setCurrentPage('admin');
      } else {
        setCurrentPage('home');
      }
    };
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState({}, '', `${baseUrl}admin`);
    setCurrentPage('admin');
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', baseUrl);
    setCurrentPage('home');
  };

  if (currentPage === 'admin') {
    return <AdminPage onBackToApp={navigateToHome} />;
  }

  return <HomePage onNavigateToAdmin={navigateToAdmin} />;
}

export default App;
