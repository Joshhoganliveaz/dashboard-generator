"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { Upload, FileText, Image, Download, Copy, Check, X, Loader2, CheckCircle2, AlertCircle, Home, TrendingUp, Search, ArrowLeftRight, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useGenerateDashboard } from "@/hooks/useGenerateDashboard";
import ClientPicker from "@/components/ClientPicker";
import CompReviewPanel from "@/components/CompReviewPanel";
import { TEMPLATE_REGISTRY, isFileRequired, isFileRelevant } from "@/lib/template-registry";
import type { TemplateType } from "@/lib/template-registry";
import type { ClientRecord } from "@/hooks/useClients";
import type { SubjectProperty } from "@/lib/types";

const AGENT_OPTIONS = [
  { value: "josh_jacqui", label: "Josh & Jacqui" },
  { value: "josh", label: "Josh" },
  { value: "jacqui", label: "Jacqui" },
  { value: "robyn", label: "Robyn" },
];

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "houseversary", label: "Houseversary", desc: "Annual equity & market update for past clients", icon: <Home className="w-4 h-4" /> },
  { value: "sell", label: "Sell Dashboard", desc: "Pre-listing CMA with pricing strategy & net proceeds", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "buyer", label: "Buyer Dashboard", desc: "Purchase calculator, neighborhoods & schools", icon: <Search className="w-4 h-4" /> },
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

  const { step, message, progress, html, error, warnings, generate, cancel, reset, applyEdit, isEditing, editError, reviewComps, mlsDataCache, loanDataCache, continueWithComps } = useGenerateDashboard();
  const [editOpen, setEditOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  const templateConfig = TEMPLATE_REGISTRY[templateType];
  const pipelineSteps = templateConfig.pipelineSteps;

  const isGenerating = step !== "idle" && step !== "complete" && step !== "error" && step !== "review_comps";

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

  const prevUrlRef = useRef<string | null>(null);
  const previewUrl = useMemo(() => {
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    if (!html) { prevUrlRef.current = null; return null; }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    prevUrlRef.current = url;
    return url;
  }, [html]);

  useEffect(() => {
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); };
  }, []);

  const currentStepIdx = pipelineSteps.findIndex((s) => s.key === step);

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
            {/* Edit Dashboard */}
            <div className="bg-white rounded-xl shadow-sm mb-6">
              <button
                onClick={() => setEditOpen(!editOpen)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-terra" />
                  <span className="font-semibold text-slate">Edit Dashboard</span>
                </div>
                {editOpen ? <ChevronUp className="w-4 h-4 text-slate-light" /> : <ChevronDown className="w-4 h-4 text-slate-light" />}
              </button>
              {editOpen && (
                <div className="px-6 pb-5 border-t border-sand-pale pt-4">
                  <textarea
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    placeholder='Describe changes, e.g. "Change the estimated value to $650,000" or "Remove the third comp"'
                    rows={3}
                    disabled={isEditing}
                    className="w-full px-3 py-2 border border-sand-pale rounded-lg text-slate text-sm focus:outline-none focus:border-terra resize-y disabled:opacity-50"
                  />
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={async () => {
                        if (!editInstruction.trim()) return;
                        const ok = await applyEdit(editInstruction.trim());
                        if (ok) setEditInstruction("");
                      }}
                      disabled={isEditing || !editInstruction.trim()}
                      className="flex items-center gap-2 bg-terra text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isEditing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        "Apply Changes"
                      )}
                    </button>
                    {editError && (
                      <p className="text-sm text-red-600">{editError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

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
          {/* Template Type Selector */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-display font-bold text-slate mb-4">Dashboard Type</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TEMPLATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTemplateType(opt.value)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    templateType === opt.value
                      ? "border-terra bg-terra/5"
                      : "border-sand-pale hover:border-sand"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={templateType === opt.value ? "text-terra" : "text-slate-light"}>{opt.icon}</span>
                    <p className={`font-bold text-sm ${templateType === opt.value ? "text-terra" : "text-slate"}`}>
                      {opt.label}
                    </p>
                  </div>
                  <p className="text-xs text-slate-light mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Client Details Form */}
            <div className="lg:col-span-2 space-y-6">
              {templateType === "houseversary" && (
                <ClientPicker
                  onSelect={handleClientSelect}
                  onClear={handleClientClear}
                  selectedAddress={selectedClientAddress}
                />
              )}

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-display font-bold text-slate mb-4">Client Details</h2>
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
                        {subdivisionLoading && <Loader2 className="w-4 h-4 text-terra animate-spin absolute right-3 top-8" />}
                      </div>
                      <div className="relative col-span-2">
                        <Input label="Community Name" placeholder={subdivisionLoading ? "Looking up..." : "Saratoga Lakes at Dobson Ranch"} value={form.communityName} onChange={(v) => updateField("communityName", v)} />
                        {subdivisionLoading && <Loader2 className="w-4 h-4 text-terra animate-spin absolute right-3 top-8" />}
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
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-display font-bold text-slate mb-4">Search Criteria</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Target Areas / Neighborhoods" placeholder="Gilbert, Chandler, Queen Creek" value={form.targetAreas} onChange={(v) => updateField("targetAreas", v)} className="col-span-2" />
                    <Input label="Budget Min" placeholder="400000" value={form.budgetMin} onChange={(v) => updateField("budgetMin", v)} type="number" />
                    <Input label="Budget Max" placeholder="800000" value={form.budgetMax} onChange={(v) => updateField("budgetMax", v)} type="number" />
                    <Input label="Min Bedrooms" placeholder="3" value={form.bedsMin} onChange={(v) => updateField("bedsMin", v)} type="number" />
                    <Input label="Min Bathrooms" placeholder="2" value={form.bathsMin} onChange={(v) => updateField("bathsMin", v)} type="number" />
                    <Input label="Must-Haves" placeholder="Pool, single story, RV gate" value={form.mustHaves} onChange={(v) => updateField("mustHaves", v)} className="col-span-2" />
                    <Input label="School Preference" placeholder="Gilbert Public Schools, Higley Unified" value={form.schoolPreference} onChange={(v) => updateField("schoolPreference", v)} className="col-span-2" />
                    <Input label="Home Search Link" placeholder="https://liveazco.com/..." value={form.homeSearchUrl} onChange={(v) => updateField("homeSearchUrl", v)} className="col-span-2" type="url" />
                  </div>
                </div>
              )}

              {/* Sell-specific fields */}
              {showSellFields && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-display font-bold text-slate mb-4">Loan Details</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Estimated Loan Payoff" placeholder="340000" value={form.loanPayoff} onChange={(v) => updateField("loanPayoff", v)} type="number" />
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate mb-1">Comp & Listing Links</label>
                    <textarea
                      value={form.compLinks}
                      onChange={(e) => updateField("compLinks", e.target.value)}
                      placeholder={"Paste URLs, one per line\nhttps://www.redfin.com/AZ/Mesa/...\nhttps://www.zillow.com/homedetails/..."}
                      rows={3}
                      className="w-full px-3 py-2 border border-sand-pale rounded-lg text-slate text-sm focus:outline-none focus:border-terra resize-y"
                    />
                    <p className="text-xs text-slate-light mt-1">Optional. Links to comp listings or reference URLs included in the dashboard.</p>
                  </div>
                </div>
              )}

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
                {isFileRelevant(templateType, "csv") && (
                  <FileDropZone
                    label="ARMLS CSV Export"
                    sublabel="textexport*.csv"
                    accept=".csv"
                    icon={<FileText className="w-6 h-6" />}
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
                    sublabel={isFileRequired(templateType, "mlsPdf") ? "Required - extracts property details" : "Optional - extracts property details"}
                    accept=".pdf"
                    icon={<FileText className="w-6 h-6" />}
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
                    sublabel="Optional - extracts purchase & loan data"
                    accept=".pdf"
                    icon={<FileText className="w-6 h-6" />}
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
                )}

                {/* No files needed message for buyer */}
                {templateType === "buyer" && !isFileRelevant(templateType, "csv") && (
                  <p className="text-sm text-slate-light text-center py-4">
                    No files required for buyer dashboards. Neighborhood and school data is generated from your search criteria.
                  </p>
                )}
                {templateType === "buyer" && isFileRelevant(templateType, "csv") && !csvFile && (
                  <p className="text-xs text-slate-light mt-3">
                    CSV is optional for buyer dashboards. Upload one to include area market stats.
                  </p>
                )}
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
                    Generate {templateConfig.label}
                  </>
                )}
              </button>

              {!canGenerate && !isGenerating && (
                <p className="text-xs text-center text-slate-light">
                  {templateType === "buyer"
                    ? "Fill in client name to enable"
                    : "Fill in required fields and upload required files to enable"
                  }
                </p>
              )}

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
          {(isGenerating || step === "review_comps") && (
            <div className="bg-white rounded-xl shadow-sm p-5 mt-6">
              <div className="flex items-center gap-3 mb-3">
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 text-terra animate-spin flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-sage flex-shrink-0" />
                )}
                <span className="font-semibold text-slate text-sm">{message}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {pipelineSteps.map((s, i) => (
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

          {/* Comp Review Panel */}
          {step === "review_comps" && reviewComps && (
            <CompReviewPanel
              comps={reviewComps}
              subject={(mlsDataCache as { subject?: SubjectProperty })?.subject || { beds: 0, baths: 0, sqft: 0, yearBuilt: 0, pool: false, stories: 1 }}
              loanData={loanDataCache}
              onContinue={(approved, loanOverride) => continueWithComps(approved, loanOverride)}
              onCancel={cancel}
            />
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
