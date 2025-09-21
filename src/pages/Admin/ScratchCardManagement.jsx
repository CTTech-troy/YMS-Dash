// src/pages/Admin/ScratchCardManagement.jsx
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = "http://localhost:5000/api/scratch-cards"; // 🔥 update if deployed

const ScratchCardManagement = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [formData, setFormData] = useState({ quantity: 10 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 10;

  // ✅ Fetch cards from backend
  const fetchCards = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL);
      setCards(res.data);
    } catch (err) {
      console.error("❌ Error fetching cards:", err);
      toast.error("Error fetching scratch cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  // ✅ Handle input change
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Handle generate submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/generate`, { quantity });
      setCards([...res.data, ...cards]); // prepend new cards
      setShowGenerateModal(false);
      toast.success(`${quantity} scratch cards generated successfully!`);
    } catch (err) {
      console.error("❌ Error generating cards:", err);
      toast.error("Failed to generate cards");
    }
  };

  // ✅ Handle delete
  const handleDeleteCard = async (id) => {
    if (!confirm('Are you sure you want to delete this card?')) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      setCards(cards.filter((card) => card.id !== id));
      toast.success('Card deleted successfully!');
    } catch (err) {
      console.error("❌ Error deleting card:", err);
      toast.error("Error deleting card");
    }
  };

  // 🔍 Search + Filter
  const filteredCards = cards.filter(card => {
    const matchesSearch =
      card.pin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus ? card.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  // 📄 Pagination
  const indexOfLastCard = currentPage * cardsPerPage;
  const indexOfFirstCard = indexOfLastCard - cardsPerPage;
  const currentCards = filteredCards.slice(indexOfFirstCard, indexOfLastCard);
  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <DashboardLayout title="Scratch Card Management">
      {/* 🔥 Your UI remains unchanged below */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Scratch Cards</h1>
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          onClick={() => setShowGenerateModal(true)}
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Generate Cards
        </button>
      </div>

      {/* Search + Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="w-full sm:w-96">
            <label htmlFor="search" className="sr-only">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                id="search"
                name="search"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search by PIN or serial number"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="filterStatus" className="sr-only">Filter by Status</label>
            <select
              id="filterStatus"
              name="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="unused">Unused</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Scratch Cards</h3>
          <p className="text-sm text-gray-500">
            Showing {indexOfFirstCard + 1}-{Math.min(indexOfLastCard, filteredCards.length)} of {filteredCards.length} cards
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PIN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used By</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : currentCards.length > 0 ? (
                currentCards.map((card) => (
                  <tr key={card.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{card.serialNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"><span className="font-mono">{card.pin}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${card.status === 'unused' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {card.status === 'unused' ? 'Unused' : 'Used'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{card.generatedAt.split('T')[0]}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{card.usedBy || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleDeleteCard(card.id)} className="text-red-600 hover:text-red-900">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">No scratch cards found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            {/* mobile */}
            <div className="flex-1 flex justify-between sm:hidden">
              <button onClick={() => paginate(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                Previous
              </button>
              <button onClick={() => paginate(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages} className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                Next
              </button>
            </div>
            {/* desktop */}
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstCard + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(indexOfLastCard, filteredCards.length)}</span> of{' '}
                  <span className="font-medium">{filteredCards.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button onClick={() => paginate(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = index + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = index + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + index;
                    } else {
                      pageNumber = currentPage - 2 + index;
                    }
                    return (
                      <button key={pageNumber} onClick={() => paginate(pageNumber)} className={`relative inline-flex items-center px-4 py-2 border ${currentPage === pageNumber ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'} text-sm font-medium`}>
                        {pageNumber}
                      </button>
                    );
                  })}
                  <button onClick={() => paginate(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages} className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Cards Modal */}
      {showGenerateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="generate-modal-title"
          onClick={() => setShowGenerateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-auto transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} aria-describedby="generate-modal-desc">
              <div className="px-6 py-5">
                <h3 id="generate-modal-title" className="text-lg leading-6 font-medium text-gray-900">Generate Scratch Cards</h3>
                <p id="generate-modal-desc" className="mt-2 text-sm text-gray-500">
                  Enter how many scratch cards to create (max 100).
                </p>
                <div className="mt-4">
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="quantity"
                      id="quantity"
                      min="1"
                      max="100"
                      required
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ScratchCardManagement;
