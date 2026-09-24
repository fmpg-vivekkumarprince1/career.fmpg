const Loader = ({ fullPage = false, inline = false, size = 'md', text = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-7 w-7 border-[3px]',
    lg: 'h-10 w-10 border-4'
  };

  const spinner = (
    <span
      className={`${sizeClasses[size] || sizeClasses.md} block shrink-0 animate-spin rounded-full border-emerald-100 border-t-emerald-600`}
      aria-hidden="true"
    />
  );

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600" role="status" aria-live="polite">
        {spinner}
        {text && <span>{text}</span>}
        {!text && <span className="sr-only">Loading</span>}
      </span>
    );
  }

  return (
    <div
      className={fullPage
        ? 'flex min-h-[50vh] w-full flex-col items-center justify-center p-8'
        : 'flex min-h-40 w-full items-center justify-center p-8'}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        {spinner}
        <span className="text-sm font-semibold text-slate-700">{text || 'Loading…'}</span>
      </div>
    </div>
  );
};

export default Loader;
