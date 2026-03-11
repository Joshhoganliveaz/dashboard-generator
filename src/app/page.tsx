"use client";

import { useState, useRef, useMemo } from "react";
import { Upload, FileText, Image, Download, Copy, Check, X, Loader2, CheckCircle2, AlertCircle, Home, TrendingUp, Search, ArrowLeftRight } from "lucide-react";
import { useGenerateDashboard } from "@/hooks/useGenerateDashboard";
import ClientPicker from "@/components/ClientPicker";
import { TEMPLATE_REGISTRY, isFileRequired, isFileRelevant } from "@/lib/template-registry";
import type { TemplateType } from "@/lib/template-registry";
import type { ClientRecord } from "@/hooks/useClients";

const AGENT_OPTIONS = [
  { value: "josh_jacqui", label: "Josh & Jacqui" },
  { value: "josh", label: "Josh" },
  { value: "jacqui", label: "Jacqui" },
  { value: "robyn", label: "Robyn" },
];

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "houseversary", label: "Houseversary", desc: "Annual equity & market update for past clients", icon: <Home className="w-4 h-4" /> },
  { value: "sell", label: "Sell", desc: "Pre-listing CMA with pricing strategy & net proceeds", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "buyer", label: "Buyer", desc: "Purchase calculator, neighborhoods & schools", icon: <Search className="w-4 h-4" /> },
  { value: "buysell", label: "Buy/Sell", desc: "Combined sell analysis + buyer search with bridge calculations", icon: <ArrowLeftRight className="w-4 h-4" /> },
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
  targetAreas: string;
  budgetMin: string;
  budgetMax: string;
  bedsMin: string;
  bathsMin: string;
  mustHaves: string;
  schoolPreference: string;
  homeSearchUrl: string;
  loanPayoff: string;
  compLinks: string;
}

export default function HomePage() {
  const [templateType, setTemplateType] = useState<TemplateType>("houseversary");
  const [form, setForm] = useState<FormFields>({
    clientNames: "",
    fullName: "",
    email: "",
    address: "",
    cityStateZip: "",
    subdivision: "",
    communityName: "",
    agentKey: "josh_jacqui",
    targetAreas: "",
    budgetMin: "400000",
    budgetMax: "800000",
    bedsMin: "3",
    bathsMin: "2",
    mustHaves: "",
    schoolPreference: "",
    homeSearchUrl: "",
    loanPayoff: "",
    compLinks: "",
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

  const templateConfig = TEMPLATE_REGISTRY[templateType];
  const pipelineSteps = templateConfig.pipelineSteps;

  const isGenerating = step !== "idle" && step !== "complete" && step !== "error";

  const showBuyerFields = templateType === "buyer" || templateType === "buysell";
  const showSellFields = templateType === "sell" || templateType === "buysell";

  const canGenerate = useMemo(() => {
    if (!form.clientNames) return false;
    if (templateType !== "buyer") {
      if (!form.address || !form.cityStateZip || !form.subdivision) return false;
    }
    if (isFileRequired(templateType, "csv") && !csvFile) return false;
    if (isFileRequired(templateType, "mlsPdf") && !mlsFile) return false;
    return true;
  }, [templateType, form.clientNames, form.address, form.cityStateZip, form.subdivision, csvFile, mlsFile]);

  function updateField(field: keyof FormFields, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleClientSelect(client: ClientRecord) {
    setSelectedClientAddress(client.address);

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
        // Invalid cache entry
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
      if (subdivision) {
        localStorage.setItem(cacheKey, JSON.stringify({ subdivision, communityName }));
      }
    } catch {
      // Subdivision lookup failed
    } finally {
      setSubdivisionLoading(false);
    }
  }

  function handleClientClear() {
    setSelectedClientAddress(null);
    setForm((f) => ({
      ...f,
      clientNames: "",
      fullName: "",
      email: "",
      address: "",
      cityStateZip: "",
      subdivision: "",
      communityName: "",
    }));
  }

  async function handleGenerate() {
    if (!canGenerate) return;

    const formData = new FormData();
    formData.append("templateType", templateType);

    if (csvFile) formData.append("csv", csvFile);
    if (mlsFile) formData.append("mlsPdf", mlsFile);
    if (taxRecordsFile) formData.append("taxRecords", taxRecordsFile);
    cromfordFiles.forEach((f) => formData.append("cromford", f));

    const clientDetailsPayload: Record<string, unknown> = {
      folderName: "",
      clientNames: form.clientNames,
      fullName: form.fullName,
      email: form.email,
      address: form.address,
      cityStateZip: form.cityStateZip,
      subdivision: form.subdivision,
      communityName: form.communityName,
      agentKey: form.agentKey,
    };

    if (showBuyerFields) {
      clientDetailsPayload.targetAreas = form.targetAreas;
      clientDetailsPayload.budgetMin = parseInt(form.budgetMin) || 400000;
      clientDetailsPayload.budgetMax = parseInt(form.budgetMax) || 800000;
      clientDetailsPayload.bedsMin = parseInt(form.bedsMin) || 3;
      clientDetailsPayload.bathsMin = parseInt(form.bathsMin) || 2;
      clientDetailsPayload.mustHaves = form.mustHaves ? form.mustHaves.split(",").map(s => s.trim()).filter(Boolean) : [];
      clientDetailsPayload.schoolPreference = form.schoolPreference;
      if (form.homeSearchUrl) clientDetailsPayload.homeSearchUrl = form.homeSearchUrl;
    }

    if (showSellFields) {
      clientDetailsPayload.loanPayoff = parseInt(form.loanPayoff) || 0;
      if (form.compLinks) clientDetailsPayload.compLinks = form.compLinks;
    }

    formData.append("clientDetails", JSON.stringify(clientDetailsPayload));

    await generate(formData);
  }

  function handleDownload() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (form.address || form.clientNames).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const typeLabel = templateType === "houseversary" ? "dashboard" : `${templateType}-dashboard`;
    a.href = url;
    a.download = `${slug}-${typeLabel}.html`;
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

  const currentStepIdx = pipelineSteps.findIndex((s) => s.key === step);
  const selectedTemplateOption = TEMPLATE_OPTIONS.find(t => t.value === templateType);

  return (
    <div className="min-h-screen bg-dark">
      {/* Header */}
      <header className="border-b border-dark-border px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-light">Dashboard Generator</span>
            <span className="text-xs text-light-dim">Live AZ Co</span>
          </div>
          {isGenerating && (
            <button onClick={cancel} className="text-xs text-light-muted hover:text-light transition-colors">
              Cancel
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {step === "complete" && html ? (
          /* === Results View === */
          <div>
            <div className="glass-card rounded-lg p-5 mb-5 border border-accent/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-accent" />
                  <div>
                    <h2 className="text-base font-semibold text-light">Dashboard Ready</h2>
                    <p className="text-light-muted text-xs mt-0.5">Generated successfully</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-accent text-dark px-5 py-2.5 rounded-md font-semibold text-sm hover:bg-accent-hover transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-dark-elevated text-light border border-dark-border px-4 py-2.5 rounded-md text-sm hover:border-light-dim transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied" : "Copy HTML"}
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-2.5 border border-dark-border rounded-md text-sm text-light-muted hover:text-light hover:border-light-dim transition-colors"
                  >
                    New
                  </button>
                </div>
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="glass-card rounded-lg p-4 mb-5 border border-warning/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-warning">Review Before Delivering</p>
                    {warnings.map((w, i) => (
                      <p key={i} className="text-xs text-light-muted mt-1">{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-lg overflow-hidden border border-dark-border" style={{ height: "80vh" }}>
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
            {/* Template Selector — Segmented Control */}
            <div className="mb-6">
              <div className="glass-card rounded-lg p-1.5 inline-flex gap-1">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTemplateType(opt.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      templateType === opt.value
                        ? "bg-accent text-dark"
                        : "text-light-muted hover:text-light hover:bg-dark-elevated"
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedTemplateOption && (
                <p className="text-xs text-light-muted mt-2 ml-1">{selectedTemplateOption.desc}</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Client Details Form */}
              <div className="lg:col-span-2 space-y-5">
                {templateType === "houseversary" && (
                  <ClientPicker
                    onSelect={handleClientSelect}
                    onClear={handleClientClear}
                    selectedAddress={selectedClientAddress}
                  />
                )}

                <div className="glass-card rounded-lg p-5 border-t border-accent/30">
                  <h2 className="text-sm font-semibold text-light tracking-tight mb-4">Client Details</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Client Names" placeholder="Brandon & Nicole" value={form.clientNames} onChange={(v) => updateField("clientNames", v)} required />
                    <Input label="Full Name" placeholder="Brandon Newman & Nicole Savage" value={form.fullName} onChange={(v) => updateField("fullName", v)} />
                    <Input label="Email" placeholder="email@example.com" value={form.email} onChange={(v) => updateField("email", v)} />
                    {templateType !== "buyer" && (
                      <>
                        <Input label="Address" placeholder="2252 S Estrella Cir" value={form.address} onChange={(v) => updateField("address", v)} required />
                        <Input label="City, State Zip" placeholder="Mesa, AZ 85202" value={form.cityStateZip} onChange={(v) => updateField("cityStateZip", v)} required />
                        <div className="relative">
                          <Input label="Subdivision" placeholder={subdivisionLoading ? "Looking up..." : "Saratoga Lakes"} value={form.subdivision} onChange={(v) => updateField("subdivision", v)} required />
                          {subdivisionLoading && <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3 top-8" />}
                        </div>
                        <div className="relative col-span-2">
                          <Input label="Community Name" placeholder={subdivisionLoading ? "Looking up..." : "Saratoga Lakes at Dobson Ranch"} value={form.communityName} onChange={(v) => updateField("communityName", v)} />
                          {subdivisionLoading && <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3 top-8" />}
                        </div>
                      </>
                    )}
                    {templateType === "buyer" && (
                      <Input label="City, State Zip" placeholder="Gilbert, AZ 85296" value={form.cityStateZip} onChange={(v) => updateField("cityStateZip", v)} className="col-span-2" />
                    )}
                  </div>
                </div>

                {/* Buyer-specific fields */}
                {showBuyerFields && (
                  <div className="glass-card rounded-lg p-5">
                    <h2 className="text-sm font-semibold text-light tracking-tight mb-4">Search Criteria</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Target Areas" placeholder="Gilbert, Chandler, Queen Creek" value={form.targetAreas} onChange={(v) => updateField("targetAreas", v)} className="col-span-2" />
                      <Input label="Budget Min" placeholder="400000" value={form.budgetMin} onChange={(v) => updateField("budgetMin", v)} type="number" />
                      <Input label="Budget Max" placeholder="800000" value={form.budgetMax} onChange={(v) => updateField("budgetMax", v)} type="number" />
                      <Input label="Min Bedrooms" placeholder="3" value={form.bedsMin} onChange={(v) => updateField("bedsMin", v)} type="number" />
                      <Input label="Min Bathrooms" placeholder="2" value={form.bathsMin} onChange={(v) => updateField("bathsMin", v)} type="number" />
                      <Input label="Must-Haves" placeholder="Pool, single story, RV gate" value={form.mustHaves} onChange={(v) => updateField("mustHaves", v)} className="col-span-2" />
                      <Input label="School Preference" placeholder="Gilbert Public Schools" value={form.schoolPreference} onChange={(v) => updateField("schoolPreference", v)} className="col-span-2" />
                      <Input label="Home Search Link" placeholder="https://liveazco.com/..." value={form.homeSearchUrl} onChange={(v) => updateField("homeSearchUrl", v)} className="col-span-2" type="url" />
                    </div>
                  </div>
                )}

                {/* Sell-specific fields */}
                {showSellFields && (
                  <div className="glass-card rounded-lg p-5">
                    <h2 className="text-sm font-semibold text-light tracking-tight mb-4">Loan Details</h2>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Estimated Loan Payoff" placeholder="340000" value={form.loanPayoff} onChange={(v) => updateField("loanPayoff", v)} type="number" />
                    </div>
                    <div className="mt-4">
                      <label className="block text-xs font-medium text-light-muted uppercase tracking-wider mb-1">Comp & Listing Links</label>
                      <textarea
                        value={form.compLinks}
                        onChange={(e) => updateField("compLinks", e.target.value)}
                        placeholder={"Paste URLs, one per line\nhttps://www.redfin.com/AZ/Mesa/...\nhttps://www.zillow.com/homedetails/..."}
                        rows={3}
                        className="w-full px-3 py-2 bg-dark-elevated border border-transparent rounded-md text-sm text-light placeholder:text-light-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 resize-y"
                      />
                      <p className="text-xs text-light-dim mt-1">Optional. Links to comp listings or reference URLs.</p>
                    </div>
                  </div>
                )}

                <div className="glass-card rounded-lg p-5">
                  <h2 className="text-sm font-semibold text-light tracking-tight mb-4">Settings</h2>
                  <div>
                    <label className="block text-xs font-medium text-light-muted uppercase tracking-wider mb-1">Agent</label>
                    <select
                      value={form.agentKey}
                      onChange={(e) => updateField("agentKey", e.target.value)}
                      className="w-full max-w-xs px-3 py-2 bg-dark-elevated border border-transparent rounded-md text-sm text-light focus:outline-none focus:border-accent"
                    >
                      {AGENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right: File Uploads + Generate */}
              <div className="space-y-5">
                <div className="glass-card rounded-lg p-5">
                  <h2 className="text-sm font-semibold text-light tracking-tight mb-4">Files</h2>

                  {/* CSV */}
                  {isFileRelevant(templateType, "csv") && (
                    <FileDropZone
                      label="ARMLS CSV Export"
                      sublabel="textexport*.csv"
                      accept=".csv"
                      icon={<FileText className="w-5 h-5" />}
                      file={csvFile}
                      onFile={setCsvFile}
                      onClear={() => setCsvFile(null)}
                      inputRef={csvInputRef}
                      required={isFileRequired(templateType, "csv")}
                    />
                  )}

                  {/* MLS PDF */}
                  {isFileRelevant(templateType, "mlsPdf") && (
                    <FileDropZone
                      label="MLS Listing PDF"
                      sublabel={isFileRequired(templateType, "mlsPdf") ? "Required" : "Optional"}
                      accept=".pdf"
                      icon={<FileText className="w-5 h-5" />}
                      file={mlsFile}
                      onFile={setMlsFile}
                      onClear={() => setMlsFile(null)}
                      inputRef={mlsInputRef}
                      required={isFileRequired(templateType, "mlsPdf")}
                    />
                  )}

                  {/* Tax Records PDF */}
                  {isFileRelevant(templateType, "taxRecords") && (
                    <FileDropZone
                      label="Tax Records (PDF)"
                      sublabel="Optional"
                      accept=".pdf"
                      icon={<FileText className="w-5 h-5" />}
                      file={taxRecordsFile}
                      onFile={setTaxRecordsFile}
                      onClear={() => setTaxRecordsFile(null)}
                      inputRef={taxRecordsInputRef}
                    />
                  )}

                  {/* Cromford PNGs */}
                  {isFileRelevant(templateType, "cromford") && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-light-muted uppercase tracking-wider">Cromford Screenshots</label>
                        <span className="text-xs text-light-dim">Optional</span>
                      </div>
                      <div
                        className="border border-dashed border-dark-border rounded-md p-4 text-center cursor-pointer hover:border-light-dim transition-colors"
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
                        <Image className="w-5 h-5 text-light-dim mx-auto mb-1" />
                        <p className="text-xs text-light-dim">Drop PNG screenshots here</p>
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
                            <div key={i} className="flex items-center justify-between text-xs bg-dark-elevated rounded-md px-2 py-1.5">
                              <span className="truncate text-light-muted">{f.name}</span>
                              <button
                                onClick={() => setCromfordFiles((prev) => prev.filter((_, j) => j !== i))}
                                className="text-light-dim hover:text-error ml-2"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* No files needed message for buyer */}
                  {templateType === "buyer" && !isFileRelevant(templateType, "csv") && (
                    <p className="text-xs text-light-muted text-center py-4">
                      No files required for buyer dashboards.
                    </p>
                  )}
                  {templateType === "buyer" && isFileRelevant(templateType, "csv") && !csvFile && (
                    <p className="text-xs text-light-dim mt-3">
                      CSV is optional for buyer dashboards.
                    </p>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="w-full bg-accent text-dark py-3 rounded-md font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Generate {templateConfig.label}
                    </>
                  )}
                </button>

                {!canGenerate && !isGenerating && (
                  <p className="text-xs text-center text-light-dim">
                    {templateType === "buyer"
                      ? "Fill in client name to enable"
                      : "Fill in required fields and upload files"
                    }
                  </p>
                )}

                {/* Error */}
                {step === "error" && (
                  <div className="glass-card rounded-lg p-4 border border-error/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-error">Generation Failed</p>
                      <p className="text-xs text-light-muted mt-1">{error}</p>
                      <button onClick={reset} className="text-xs text-accent hover:underline mt-2">Try Again</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress — thin line + dots */}
            {isGenerating && (
              <div className="glass-card rounded-lg p-5 mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />
                  <span className="text-sm font-medium text-light">{message}</span>
                </div>
                <div className="flex items-center">
                  {pipelineSteps.map((s, i) => (
                    <div key={s.key} className="flex items-center flex-1 min-w-0">
                      {/* Dot */}
                      <div className="flex flex-col items-center">
                        {i < currentStepIdx ? (
                          <div className="w-2 h-2 rounded-full bg-accent" />
                        ) : i === currentStepIdx ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-accent pulse-dot" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-dark-border" />
                        )}
                        <p className={`text-[10px] mt-2 text-center whitespace-nowrap ${
                          i <= currentStepIdx ? "text-light-muted font-medium" : "text-light-dim/50"
                        }`}>
                          {s.label}
                        </p>
                      </div>
                      {/* Connector line */}
                      {i < pipelineSteps.length - 1 && (
                        <div className={`flex-1 h-px mx-1 ${
                          i < currentStepIdx ? "bg-accent" : "bg-dark-border"
                        }`} />
                      )}
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
      <label className="block text-xs font-medium text-light-muted uppercase tracking-wider mb-1">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-dark-elevated border border-transparent rounded-md text-sm text-light placeholder:text-light-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
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
        <label className="text-xs font-medium text-light-muted uppercase tracking-wider">
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </label>
      </div>
      {file ? (
        <div className="flex items-center justify-between bg-accent-muted border border-accent/30 rounded-md px-3 py-3">
          <div className="flex items-center gap-2 text-sm text-light truncate">
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="truncate">{file.name}</span>
          </div>
          <button onClick={onClear} className="text-light-dim hover:text-error ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="border border-dashed border-dark-border rounded-md p-4 text-center cursor-pointer hover:border-light-dim transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          <div className="text-light-dim mx-auto mb-1">{icon}</div>
          <p className="text-xs text-light-dim">{sublabel}</p>
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
