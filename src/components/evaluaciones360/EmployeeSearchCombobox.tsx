"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export interface EmployeeResult {
  employee_id: string;
  nombre_completo: string;
  correo: string;
  equipo?: string | null;
}

export default function EmployeeSearchCombobox({
  label, placeholder, onSelect,
}: {
  label: string;
  placeholder: string;
  onSelect: (emp: EmployeeResult | null) => void;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<EmployeeResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<EmployeeResult | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef             = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleChange = (q: string) => {
    setQuery(q);
    if (selected) { setSelected(null); onSelect(null); }
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/empleados?search=${encodeURIComponent(q)}&pageSize=8`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data ?? []);
          setShowDrop(true);
        }
      } finally { setLoading(false); }
    }, 300);
  };

  const pick = (emp: EmployeeResult) => {
    setSelected(emp);
    setQuery(emp.nombre_completo || emp.correo);
    setResults([]);
    setShowDrop(false);
    onSelect(emp);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setShowDrop(false);
    onSelect(null);
  };

  return (
    <div className="relative">
      <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0 && !selected) setShowDrop(true); }}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder={placeholder}
          className={`w-full pl-8 pr-7 py-2 text-sm bg-white border rounded-lg outline-none transition-colors ${
            selected ? "border-primary bg-primary/5" : "border-slate-200 focus:border-primary"
          }`}
        />
        {(query || selected) && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {selected && (
        <p className="text-[10px] text-[#64748b] mt-0.5 ml-1 truncate">
          {selected.correo}{selected.equipo ? ` · ${selected.equipo}` : ""}
        </p>
      )}
      {showDrop && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#64748b]">Sin resultados</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-50">
              {results.map((emp) => (
                <li
                  key={emp.employee_id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(emp)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-black text-primary">
                    {(emp.nombre_completo || emp.correo).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1e293b] truncate">{emp.nombre_completo || emp.correo}</p>
                    <p className="text-[10px] text-[#64748b] truncate">{emp.correo}{emp.equipo ? ` · ${emp.equipo}` : ""}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
