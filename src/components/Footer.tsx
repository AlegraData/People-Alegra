export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-4">
      <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <span className="text-sm font-bold text-[#1e293b] italic">© IT Data</span>
        </div>
      </div>
    </footer>
  );
}
