import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MenuIcon, X } from 'lucide-react';
import Button from '../ui/Button';
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navItems = [{
    name: 'Home',
    path: '/'
  }, {
    name: 'About Us',
    path: '/about'
  }, {
    name: 'Academics',
    path: '/academics'
  }, {
    name: 'Admissions',
    path: '/admissions'
  }, {
    name: 'News & Events',
    path: '/news'
  }, {
    name: 'Gallery',
    path: '/gallery'
  }, {
    name: 'Careers',
    path: '/careers'
  }, {
    name: 'Contact Us',
    path: '/contact'
  }, {
    name: 'FAQ',
    path: '/faq'
  }];
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  return <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 md:py-0">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center py-3">
            <div className="flex items-center">
            <img src="/logo.png" alt="Yetland Group of Schools Logo" className="h-15 w-15 "/>             
            </div>
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex">
            <ul className="flex items-center">
              {navItems.map(item => <li key={item.name}>
                  <Link to={item.path} className={`block px-3 py-5 text-sm font-medium transition-colors hover:text-amber-500 ${location.pathname === item.path ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-700'}`}>
                    {item.name}
                  </Link>
                </li>)}
            </ul>
          </nav>
          {/* Action Buttons */}
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/admissions/apply">Apply Now</Link>
            </Button>
          </div>
          {/* Mobile Menu Button */}
          <button onClick={toggleMenu} className="md:hidden p-2 text-gray-600 hover:text-green-900 focus:outline-none" aria-label="Toggle menu">
            {isMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
          </button>
        </div>
        {/* Mobile Navigation */}
        {isMenuOpen && <div className="md:hidden py-4 border-t border-gray-200">
            <ul className="space-y-1">
              {navItems.map(item => <li key={item.name}>
                  <Link to={item.path} onClick={() => setIsMenuOpen(false)} className={`block px-4 py-2 text-base ${location.pathname === item.path ? 'text-amber-500 font-medium' : 'text-gray-700'}`}>
                    {item.name}
                  </Link>
                </li>)}
              <li className="pt-2 space-y-2">
                <Button variant="outline" fullWidth asChild>
                  <Link to="/login">Results Portal</Link>
                </Button>
                <Button fullWidth asChild>
                  <Link to="/admissions/apply">Apply Now</Link>
                </Button>
              </li>
            </ul>
          </div>}
      </div>
    </header>;
};
export default Header;