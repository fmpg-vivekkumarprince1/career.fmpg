import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden border-b border-slate-100 bg-white pb-20 pt-28 lg:pb-28 lg:pt-36">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(5,150,105,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(5,150,105,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-amber-50 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <BriefcaseBusiness size={15} /> Careers at FMPG
          </div>
          <h1 className="mt-7 max-w-3xl font-heading text-5xl font-extrabold leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
            Do work that makes{' '}
            <span className="relative ml-3 inline-block text-emerald-600">
              living better.
              <span className="absolute bottom-1 left-0 -z-10 h-3 w-full rounded-full bg-emerald-100" />
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Join a thoughtful, ambitious team building simpler property experiences for students,
            professionals, and communities across India.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <button
              onClick={() => navigate('/jobs')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 font-bold text-white shadow-[0_16px_30px_-16px_rgba(5,150,105,0.8)] transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              Explore open roles <ArrowRight size={19} />
            </button>
            <a
              href="#life-at-fmpg"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 py-3.5 font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Discover our culture
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-slate-600">
            {['Remote-friendly', 'Growth focused', 'People first'].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-md">
            <div className="absolute -inset-5 rotate-3 rounded-[2.25rem] border border-emerald-100 bg-emerald-50" />
            <div className="relative overflow-hidden rounded-[2rem] border-4 border-white bg-slate-100 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.35)]">
              <img
                src="/images/output.jpg"
                alt="FMPG team collaborating"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-slate-950/60 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/30 bg-white/90 p-4 shadow-lg backdrop-blur-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <MapPin size={21} />
                </span>
                <div>
                  <p className="font-bold text-slate-900">Work from where you thrive</p>
                  <p className="text-sm text-slate-500">Remote opportunities across India</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-6 top-10 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl sm:block">
              <p className="text-2xl font-extrabold text-emerald-600">100%</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Human hiring</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;