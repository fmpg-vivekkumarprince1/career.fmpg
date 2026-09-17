import React, { useEffect, useState } from 'react';

const getDefaultFormData = () => ({
  name: '',
  domain: '',
  jobrole: '',
  fromDate: '',
  toDate: '',
  email: '',
  issuedBy: 'FMPG'
});

const IssueForm = ({ onSubmit, loading, initialData = {} }) => {
  const [formData, setFormData] = useState({
    ...getDefaultFormData(),
    ...initialData,
    issuedBy: initialData?.issuedBy || 'FMPG'
  });

  useEffect(() => {
    setFormData({
      ...getDefaultFormData(),
      ...initialData,
      issuedBy: initialData?.issuedBy || 'FMPG'
    });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
    setFormData(getDefaultFormData());
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 md:p-8">
        <h3 className="text-xl font-bold text-slate-900 mb-5">Issue New Certificate</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter recipient name"
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter recipient email for certificate delivery"
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                If provided, certificate will be automatically sent to this email
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-slate-700 mb-1.5">
                Domain *
              </label>
              <input
                type="text"
                id="domain"
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                required
                placeholder="Enter domain (e.g., Web Development)"
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
            <div>
              <label htmlFor="jobrole" className="block text-sm font-medium text-slate-700 mb-1.5">
                Job Role *
              </label>
              <input
                type="text"
                id="jobrole"
                name="jobrole"
                value={formData.jobrole}
                onChange={handleChange}
                required
                placeholder="Enter job role or internship title"
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <label htmlFor="fromDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                From Date *
              </label>
              <input
                type="date"
                id="fromDate"
                name="fromDate"
                value={formData.fromDate}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
            <div>
              <label htmlFor="toDate" className="block text-sm font-medium text-slate-700 mb-1.5">
                To Date *
              </label>
              <input
                type="date"
                id="toDate"
                name="toDate"
                value={formData.toDate}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="issuedBy" className="block text-sm font-medium text-slate-700 mb-1.5">
              Issued By
            </label>
            <input
              type="text"
              id="issuedBy"
              name="issuedBy"
              value={formData.issuedBy}
              onChange={handleChange}
              placeholder="Enter issuer name"
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm placeholder:text-slate-400"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Issuing Certificate...' : 'Issue Certificate'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default IssueForm;