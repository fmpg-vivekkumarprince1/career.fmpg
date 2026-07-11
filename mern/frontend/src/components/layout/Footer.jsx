import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';

const Footer = () => {
  const year = new Date().getFullYear();

  const links = [
    ['About us', 'https://fmpg.vercel.app/about'],
    ['Our services', 'https://fmpg.vercel.app/service'],
    ['Contact', 'https://fmpg.vercel.app/contact'],
    ['Verify certificate', '/verify'],
    ['Verify offer letter', '/verify-offer']
  ];

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-slate-200 bg-white text-slate-900">
      <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-18">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr_1fr]">
          <div className="max-w-md">
            <a href="/" className="inline-flex items-center gap-3" aria-label="FMPG Careers home">
              <img src="/logo.png" alt="FMPG" className="h-12 w-auto object-contain" />
              <div>
                <p className="font-heading text-xl font-extrabold tracking-[0.12em] text-slate-950">
                  FM<span className="text-emerald-600">PG</span>
                </p>
                <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500">CAREERS PORTAL</p>
              </div>
            </a>
            <p className="mt-6 text-base leading-7 text-slate-600">
              Build meaningful work with a team transforming premium living through technology,
              thoughtful service, and ambitious people.
            </p>
            <a
              href="https://fmpg.vercel.app/contact"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-[0_12px_26px_-14px_rgba(5,150,105,0.8)] transition hover:bg-emerald-700"
            >
              Talk to us <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Explore</h2>
            <nav className="mt-5 grid gap-3" aria-label="Footer navigation">
              {links.map(([label, href]) => (
                <a key={href} href={href} className="w-fit font-medium text-slate-600 transition hover:text-emerald-700">
                  {label}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Get in touch</h2>
            <div className="mt-5 grid gap-4 text-slate-600">
              <a href="https://maps.app.goo.gl/KJCAo6hSidjYhC5D8" className="flex items-start gap-3 hover:text-emerald-700">
                <MapPin className="mt-0.5 shrink-0 text-emerald-600" size={19} />
                <span>UIET Hoshiarpur, Punjab, India</span>
              </a>
              <a href="tel:+917321835093" className="flex items-center gap-3 hover:text-emerald-700">
                <Phone className="shrink-0 text-emerald-600" size={19} />
                <span>+91 73218 35093</span>
              </a>
              <a href="mailto:contact@fmpg.in" className="flex items-center gap-3 hover:text-emerald-700">
                <Mail className="shrink-0 text-emerald-600" size={19} />
                <span>contact@fmpg.in</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-7 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2020–{year} FMPG. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="https://fmpg.vercel.app/TermsAndConditions" className="hover:text-emerald-700">Terms</a>
            <a href="https://fmpg.vercel.app/privacypolicy" className="hover:text-emerald-700">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;