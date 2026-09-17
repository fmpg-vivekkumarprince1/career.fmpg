import { useState, useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, 
  Copy, 
  Check, 
  X, 
  MapPin, 
  Briefcase, 
  Building2, 
  Smartphone,
  ExternalLink 
} from 'lucide-react';
import { 
  FaWhatsapp, 
  FaLinkedin, 
  FaTwitter, 
  FaTelegramPlane, 
  FaEnvelope 
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatCurrencyValue } from '../../utils/currencyUtils';

const ShareJobModal = ({ isOpen, onClose, job }) => {
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset copied state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const shareUrl = useMemo(() => {
    if (!job) return '';
    const identifier = job.slug || job._id;
    return `${window.location.origin}/apply/${identifier}`;
  }, [job]);

  const shareTitle = job?.title ? `${job.title} at ${job.company || 'FMPG'}` : 'Exciting Career Opportunity';
  const shareText = `🚀 We're hiring: ${job?.title || 'Open Position'} at ${job?.company || 'FMPG'}! Explore the role and apply here:`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Job link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy link. Please copy it manually.');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled share, no need to show an error toast
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const socialPlatforms = [
    {
      name: 'WhatsApp',
      icon: FaWhatsapp,
      color: 'bg-[#25D366] hover:bg-[#20bd5a] text-white',
      border: 'border-[#25D366]/20',
      getUrl: () => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    },
    {
      name: 'LinkedIn',
      icon: FaLinkedin,
      color: 'bg-[#0A66C2] hover:bg-[#084d94] text-white',
      border: 'border-[#0A66C2]/20',
      getUrl: () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'X (Twitter)',
      icon: FaTwitter,
      color: 'bg-[#0f172a] hover:bg-black text-white',
      border: 'border-slate-800/20',
      getUrl: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    },
    {
      name: 'Telegram',
      icon: FaTelegramPlane,
      color: 'bg-[#229ED9] hover:bg-[#1d87ba] text-white',
      border: 'border-[#229ED9]/20',
      getUrl: () => `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
    },
    {
      name: 'Email',
      icon: FaEnvelope,
      color: 'bg-slate-700 hover:bg-slate-800 text-white',
      border: 'border-slate-300',
      getUrl: () => `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`Hi,\n\nI wanted to share this job opening with you:\n\n${job?.title} at ${job?.company || 'FMPG'}\nLocation: ${job?.location || 'Remote'}\nType: ${job?.type || 'Full-time'}\n\nCheck out the role and apply here:\n${shareUrl}\n\nBest regards!`)}`
    }
  ];

  if (!isOpen || !job) return null;

  return (
    <div 
      className="ui-modal-backdrop" 
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="ui-modal-panel max-w-lg shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-xl font-bold text-slate-900 leading-tight">
                Share this Job
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Help someone discover this opportunity
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Job Summary Preview Card */}
          <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 flex flex-col gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Position Details
            </span>
            <h4 className="text-base font-bold text-slate-900 line-clamp-1">
              {job.title}
            </h4>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 font-medium text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                {job.company || 'FMPG'}
              </span>
              <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 font-medium text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                {job.location || 'Remote'}
              </span>
              {job.type && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 font-medium text-slate-700">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  {job.type}
                </span>
              )}
              {job.salary && (
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-100 font-semibold text-emerald-700">
                  {formatCurrencyValue(job.salary)}
                </span>
              )}
            </div>
          </div>

          {/* Social Share Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Share via Social & Messaging
            </label>
            <div className="grid grid-cols-5 gap-2.5">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <a
                    key={platform.name}
                    href={platform.getUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 ${platform.color} shadow-sm`}
                    title={`Share on ${platform.name}`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold tracking-tight text-center truncate w-full">
                      {platform.name.split(' ')[0]}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Copy Link Section */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Or Copy Link
            </label>
            <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent border-none text-xs text-slate-700 w-full focus:outline-none truncate font-mono select-all"
                onClick={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`min-h-9 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm ${
                  copied 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Native Device Share Sheet (Mobile / Supported Browsers) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 active:scale-[0.99] transition-all"
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>More options (System Share Sheet)</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ShareJobModal;
