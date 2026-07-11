import { useState } from 'react';
import { contactService } from '../services/api';
import { toast } from 'react-toastify';
import { Mail, MapPin, Phone } from 'lucide-react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await contactService.submitContactForm(formData);
      toast.success("Your message has been sent successfully. We'll get back to you soon!");
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        message: ''
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page">
      <div className="ui-content max-w-6xl">
        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-emerald-100 bg-emerald-50 px-6 py-14 text-center sm:px-10">
          <span className="fmpg-kicker">Let’s connect</span>
          <h1 className="ui-page-title mt-3">Contact the FMPG team</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">Share a question, idea, or career enquiry. The right person from our team will get back to you.</p>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-3">
          <div className="ui-card p-6">
            <MapPin className="mb-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Location</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
                #51, BHAKRA ROAD, NANGAL, PUNJAB-140124
            </p>
          </div>
          <a href="mailto:contact@fmpg.in" className="ui-card block p-6 hover:border-emerald-200">
            <Mail className="mb-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Email</h2>
            <p className="mt-2 text-sm text-slate-600">contact@fmpg.in</p>
          </a>
          <a href="tel:+917321835093" className="ui-card block p-6 hover:border-emerald-200">
            <Phone className="mb-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Phone</h2>
            <p className="mt-2 text-sm text-slate-600">+91 73218 35093</p>
          </a>
          </div>

        <div className="ui-card p-6 sm:p-9">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Send a message</h2>
            <p className="mt-2 text-slate-600">Required fields are marked with an asterisk.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col space-y-2">
                <label htmlFor="name" className="ui-label">Your name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="ui-input"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="email" className="ui-label">Email address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="ui-input"
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="phone" className="ui-label">Phone number</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="ui-input"
                  placeholder="Your phone number or Skype ID"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="company" className="ui-label">Company</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="ui-input"
                  placeholder="Your company name"
                />
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <label htmlFor="message" className="ui-label">Your message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                className="ui-textarea min-h-36 resize-y"
                placeholder="Hello, can you help me with..."
              ></textarea>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="fmpg-primary-button inline-flex min-w-36 items-center justify-center px-7 py-3.5 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-bold">
                  {loading ? 'Sending…' : 'Send message'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;