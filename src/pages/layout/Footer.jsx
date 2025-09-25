import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Facebook, Instagram, Twitter } from 'lucide-react';
const Footer = () => {
  return <footer className="bg-green-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* School Info */}
          <div>
            <div className="flex items-center mb-4">
              <div className="text-lg font-semibold">
                <img src='/logo.png' alt="Yetland Group of Schools" className="h-30 w-auto mb-2"  />
              </div>
            </div>
            <div className="flex space-x-3">
              <a href="https://facebook.com" className="hover:text-amber-400" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com" className="hover:text-amber-400" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://twitter.com" className="hover:text-amber-400" aria-label="Twitter">
                <Twitter size={20} />
              </a>
            </div>
          </div>
          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-amber-400">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-green-100 hover:text-amber-400">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/academics" className="text-green-100 hover:text-amber-400">
                  Academics
                </Link>
              </li>
              <li>
                <Link to="/admissions" className="text-green-100 hover:text-amber-400">
                  Admissions
                </Link>
              </li>
              <li>
                <Link to="/news" className="text-green-100 hover:text-amber-400">
                  News & Events
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="text-green-100 hover:text-amber-400">
                  Gallery
                </Link>
              </li>
              <li>
                <Link to="/careers" className="text-green-100 hover:text-amber-400">
                  Careers
                </Link>
              </li>
            </ul>
          </div>
          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-amber-400">
              Contact Us
            </h3>
            <ul className="space-y-3">
              <li className="flex">
                <MapPin size={20} className="mr-2 flex-shrink-0 text-amber-400" />
                <span className="text-green-100">
                 Opp. Mawuko Primary School, Opeji Road, Abeokuta, Ogun State
                </span>
              </li>
              <li className="flex">
                <Phone size={20} className="mr-2 flex-shrink-0 text-amber-400" />
                <span className="text-green-100">Main Office: +234 (803) 718 5646 <br></br>
                                                    Admissions: +234 (803) 409 3369</span>
              </li>
              <li className="flex">
                <Mail size={20} className="mr-2 flex-shrink-0 text-amber-400" />
                <span className="text-green-100">YetlandGroupofSchools@gmail.com</span>
              </li>
            </ul>
          </div>
          {/* Office Hours */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-amber-400">
              Office Hours
            </h3>
            <ul className="space-y-2 text-green-100">
              <li>Monday - Friday: 8:00 AM - 4:00 PM</li>
              <li>Saturday: 9:00 AM - 12:00 PM</li>
              <li>Sunday: Closed</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-green-800 mt-8 pt-6 text-center text-green-200">
          <p>
            &copy; {new Date().getFullYear()} Yetland Group of Schools. All
            rights reserved.
          </p>
                   <p className="text-sm"> developed by <a href="#" className="text-amber-400">CTTech.com.ng</a></p>

        </div>
        
      </div>
    </footer>;
};
export default Footer;