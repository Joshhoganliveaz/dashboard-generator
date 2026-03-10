"use client";

import { useState, useRef, useMemo } from "react";
import { Upload, FileText, Image, Download, Copy, Check, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useGenerateDashboard } from "@/hooks/useGenerateDashboard";
import ClientPicker from "@/components/ClientPicker";
import type { ClientRecord } from "@/hooks/useClients";

const AGENT_OPTIONS = [
  { value: "josh_jacqui", label: "Josh & Jacqui" },
  { value: "josh", label: "Josh" },
  { value: "jacqui", label: "Jacqui" },
  { value: "robyn", label: "Robyn" },
];

const STEPS = [
  { key: "extracting_mls", label: "MLS" },
  { key: "parsing_csv", label: "Comps" },
  { key: "reading_cromford", label: "Cromford" },
  { key: "reading_tax_records", label: "Tax" },
  { key: "researching", label: "Research" },
  { key: "generating_content", label: "Content" },
  { key: "assembling", label: "Build" },
  { key: "complete", label: "Done" },
];

interface FormFields {
  clientNames: string;
  fullName: string;
  email: string;
  address: string;
  cityStateZip: string;
  subdivision: string;
  communityName: string;
  agentKey: string;
}

export default function HomePage() {
  const [form, setForm] = useState<FormFields>({
    clientNames: "",
    fullName: "",
    email: "",
    address: "",
    cityStateZip: "",
    subdivision: "",
    communityName: "",
    agentKey: "josh_jacqui",
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [mlsFile, setMlsFile] = useState<File | null>(null);
  const [taxRecordsFile, setTaxRecordsFile] = useState<File | null>(null);
  const [cromfordFiles, setCromfordFiles] = useState<File[]>([]);

  const [selectedClientAddress, setSelectedClientAddress] = useState<string | null>(null);
  const [subdivisionLoading, setSubdivisionLoading] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null!);
  const mlsInputRef = useRef<HTMLInputElement>(null!);
  const taxRecordsInputRef = useRef<HTMLInputElement>(null!);
  const cromfordInputRef = useRef<HTMLInputElement>(null!);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { step, message, progress, html, error, warnings, generate, cancel, reset } = useGenerateDashboard();
  const [copied, setCopied] = useState(false);

  const isGenerating = step !== "idle" && step !== "complete" && step !== "error";
  const canGenerate = csvFile && form.clientNames && form.address && form.cityStateZip && form.subdivision;

  function updateField(field: keyof FormFields, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleClientSelect(client: ClientRecord) {
    setSelectedClientAddress(client.address);

    // Check localStorage cache for subdivision data
    const cacheKey = `subdivision:${client.address}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { subdivision, communityName } = JSON.parse(cached);
        setForm((f) => ({
          ...f,
          clientNames: client.clientNames,
          fullName: client.fullName,
          email: client.email,
          address: client.address,
          cityStateZip: client.cityStateZip,
          subdivision,
          communityName,
        }));
        return;
      } catch {
        // Invalid cache entry — fall through to API lookup
      }
    }

    setForm((f) => ({
      ...f,
      clientNames: client.clientNames,
      fullName: client.fullName,
      email: client.email,
      address: client.address,
      cityStateZip: client.cityStateZip,
      subdivision: "",
      communityName: "",
    }));

    // Look up subdivision via Claude with web search
    setSubdivisionLoading(true);
    try {
      const res = await fetch("/api/clients/subdivision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: client.address,
          cityStateZip: client.cityStateZip,
        }),
      });
      const data = await res.json();
      const subdivision = data.subdivision || "";
      const communityName = data.communityName || "";
      setForm((f) => ({
        ...f,
        subdivision: subdivision || f.subdivision,
        communityName: communityName || f.communityName,
      }));
      // Cache the result
      if (subdivision) {
        localStorage.setItem(cacheKey, JSON.stringify({ subdivision, communityName }));
      }
    } catch {
      // Subdivision lookup failed — user can fill manually
    } finally {
      setSubdivisionLoading(false);
    }
  }

  function handleClientClear() {
    setSelectedClientAddress(null);
    setForm({
      clientNames: "",
      fullName: "",
      email: "",
      address: "",
      cityStateZip: "",
      subdivision: "",
      communityName: "",
      agentKey: form.agentKey,
    });
  }

  async function handleGenerate() {
    if (!canGenerate) return;

    const formData = new FormData();
    formData.append("csv", csvFile);
    if (mlsFile) formData.append("mlsPdf", mlsFile);
    if (taxRecordsFile) formData.append("taxRecords", taxRecordsFile);
    cromfordFiles.forEach((f) => formData.append("cromford", f));

    formData.append(
      "clientDetails",
      JSON.stringify({
        folderName: "",
        clientNames: form.clientNames,
        fullName: form.fullName,
        email: form.email,
        address: form.address,
        cityStateZip: form.cityStateZip,
        subdivision: form.subdivision,
        communityName: form.communityName,
        agentKey: form.agentKey,
      })
    );

    await generate(formData);
  }

  function handleDownload() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = form.address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    a.href = url;
    a.download = `${slug}-dashboard.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!html) return;
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const previewUrl = useMemo(() => {
    if (!html) return null;
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [html]);

  // Find current step index for progress display
  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-slate text-white px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">Dashboard Generator</h1>
            <p className="text-sm opacity-70">Live AZ Co</p>
          </div>
          {isGenerating && (
            <button onClick={cancel} className="text-sm text-sand hover:text-white transition-colors">
              Cancel
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Show form or results */}
        {step === "complete" && html ? (
          /* === Results View === */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-sage" />
                <h2 className="text-xl font-display font-bold text-slate">Dashboard Ready</h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-terra text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-terra-dark transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download HTML
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 bg-slate text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate/80 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy HTML"}
                </button>
                <button
                  onClick={reset}
                  className="px-5 py-2.5 border border-sand rounded-lg text-slate hover:bg-sand-pale transition-colors"
                >
                  New Dashboard
                </button>
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800">Review Before Delivering</p>
                    {warnings.map((w, i) => (
                      <p key={i} className="text-sm text-amber-700 mt-1">{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: "80vh" }}>
              {previewUrl && (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Dashboard Preview"
                />
              )}
            </div>
          </div>
        ) : (
          /* === Form View === */
          <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Client Details Form */}
            <div className="lg:col-span-2 space-y-6">
              <ClientPicker
                onSelect={handleClientSelect}
                onClear={handleClientClear}
                selectedAddress={selectedClientAddress}
              />

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-display font-bold text-slate mb-4">Client Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Client Names" placeholder="Brandon & Nicole" value={form.clientNames} onChange={(v) => updateField("clientNames", v)} required />
                  <Input label="Full Name" placeholder="Brandon Newman & Nicole Savage" value={form.fullName} onChange={(v) => updateField("fullName", v)} />
                  <Input label="Email" placeholder="email@example.com" value={form.email} onChange={(v) => updateField("email", v)} />
                  <Input label="Address" placeholder="2252 S Estrella Cir" value={form.address} onChange={(v) => updateField("address", v)} required />
                  <Input label="City, State Zip" placeholder="Mesa, AZ 85202" value={form.cityStateZip} onChange={(v) => updateField("cityStateZip", v)} required />
                  <div className="relative">
                    <Input label="Subdivision" placeholder={subdivisionLoading ? "Looking up..." : "Saratoga Lakes"} value={form.subdivision} onChange={(v) => updateField("subdivision", v)} required />
                    {subdivisionLoading && <Loader2 className="w-4 h-4 text-terra animate-spin absolute right-3 top-8" />}
                  </div>
                  <div className="relative col-span-2">
                    <Input label="Community Name" placeholder={subdivisionLoading ? "Looking up..." : "Saratoga Lakes at Dobson Ranch"} value={form.communityName} onChange={(v) => updateField("communityName", v)} />
                    {subdivisionLoading && <Loader2 className="w-4 h-4 text-terra animate-spin absolute right-3 top-8" />}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-display font-bold text-slate mb-4">Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-slate mb-1">Agent</label>
                  <select
                    value={form.agentKey}
                    onChange={(e) => updateField("agentKey", e.target.value)}
                    className="w-full max-w-xs px-3 py-2 border border-sand-pale rounded-lg text-slate focus:outline-none focus:border-terra bg-white"
                  >
                    {AGENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* Right: File Uploads + Generate */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-display font-bold text-slate mb-4">Files</h2>

                {/* CSV */}
                <FileDropZone
                  label="ARMLS CSV Export"
                  sublabel="textexport*.csv"
                  accept=".csv"
                  icon={<FileText className="w-6 h-6" />}
                  file={csvFile}
                  onFile={setCsvFile}
                  onClear={() => setCsvFile(null)}
                  inputRef={csvInputRef}
                  required
                />

                {/* MLS PDF */}
                <FileDropZone
                  label="MLS Listing PDF"
                  sublabel="Optional - extracts property details"
                  accept=".pdf"
                  icon={<FileText className="w-6 h-6" />}
                  file={mlsFile}
                  onFile={setMlsFile}
                  onClear={() => setMlsFile(null)}
                  inputRef={mlsInputRef}
                />

                {/* Tax Records PDF */}
                <FileDropZone
                  label="Tax Records (PDF)"
                  sublabel="Optional - extracts purchase & loan data"
                  accept=".pdf"
                  icon={<FileText className="w-6 h-6" />}
                  file={taxRecordsFile}
                  onFile={setTaxRecordsFile}
                  onClear={() => setTaxRecordsFile(null)}
                  inputRef={taxRecordsInputRef}
                />

                {/* Cromford PNGs */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-slate">Cromford Screenshots</label>
                    <span className="text-xs text-slate-light">Optional</span>
                  </div>
                  <div
                    className="border-2 border-dashed border-sand-pale rounded-lg p-4 text-center cursor-pointer hover:border-terra transition-colors"
                    onClick={() => cromfordInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter((f) =>
                        f.type.startsWith("image/")
                      );
                      setCromfordFiles((prev) => [...prev, ...files]);
                    }}
                  >
                    <Image className="w-6 h-6 text-sand mx-auto mb-1" />
                    <p className="text-xs text-slate-light">Drop PNG screenshots here</p>
                  </div>
                  <input
                    ref={cromfordInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setCromfordFiles((prev) => [...prev, ...files]);
                    }}
                  />
                  {cromfordFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {cromfordFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-sand-pale rounded px-2 py-1">
                          <span className="truncate">{f.name}</span>
                          <button
                            onClick={() => setCromfordFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="text-slate-light hover:text-red-500 ml-2"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="w-full bg-terra text-white py-3.5 rounded-xl font-bold text-lg hover:bg-terra-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Generate Dashboard
                  </>
                )}
              </button>

              {!canGenerate && !isGenerating && (
                <p className="text-xs text-center text-slate-light">
                  Fill in required fields and upload CSV to enable
                </p>
              )}

              {/* Progress moved to full-width below grid */}

              {/* Error */}
              {step === "error" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Generation Failed</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                    <button onClick={reset} className="text-sm text-terra hover:underline mt-2">Try Again</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress — full width below the grid */}
          {isGenerating && (
            <div className="bg-white rounded-xl shadow-sm p-5 mt-6">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-terra animate-spin flex-shrink-0" />
                <span className="font-semibold text-slate text-sm">{message}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex-1 min-w-0">
                    <div
                      className={`h-2 rounded-full transition-colors ${
                        i < currentStepIdx ? "bg-sage" : i === currentStepIdx ? "bg-terra" : "bg-sand-pale"
                      }`}
                    />
                    <p className={`text-[11px] mt-1 text-center truncate ${
                      i <= currentStepIdx ? "text-slate font-medium" : "text-slate-light/50"
                    }`}>
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Reusable Components ---

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate mb-1">
        {label}
        {required && <span className="text-terra ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-sand-pale rounded-lg text-slate text-sm focus:outline-none focus:border-terra"
      />
    </div>
  );
}

function FileDropZone({
  label,
  sublabel,
  accept,
  icon,
  file,
  onFile,
  onClear,
  inputRef,
  required,
}: {
  label: string;
  sublabel: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  required?: boolean;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate">
          {label}
          {required && <span className="text-terra ml-0.5">*</span>}
        </label>
      </div>
      {file ? (
        <div className="flex items-center justify-between bg-sage/10 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-slate truncate">
            <CheckCircle2 className="w-4 h-4 text-sage flex-shrink-0" />
            <span className="truncate">{file.name}</span>
          </div>
          <button onClick={onClear} className="text-slate-light hover:text-red-500 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-sand-pale rounded-lg p-4 text-center cursor-pointer hover:border-terra transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          <div className="text-sand mx-auto mb-1">{icon}</div>
          <p className="text-xs text-slate-light">{sublabel}</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}
