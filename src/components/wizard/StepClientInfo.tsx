"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import type { DashboardWithData, SellData, BuyData } from "@/lib/supabase/types";
import { generateSlug } from "@/lib/slug-utils";

const AGENT_OPTIONS = [
  { value: "josh_jacqui", label: "Josh & Jacqui" },
  { value: "josh", label: "Josh" },
  { value: "jacqui", label: "Jacqui" },
  { value: "robyn", label: "Robyn" },
];

interface StepClientInfoProps {
  dashboard: DashboardWithData;
  saving: boolean;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  updateDashboardData: (updates: Partial<DashboardWithData>) => void;
}

export default function StepClientInfo({
  dashboard,
  saving,
  goToStep,
}: StepClientInfoProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard-level fields
  const [clientNames, setClientNames] = useState(dashboard.client_names || "");
  const [fullName, setFullName] = useState(dashboard.full_name || "");
  const [email, setEmail] = useState(dashboard.email || "");
  const [agentKey, setAgentKey] = useState(dashboard.agent_key || "josh_jacqui");

  // PDF upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Sell fields (merged from StepPropertyExtraction)
  const sellData = dashboard.sell_data;
  const [address, setAddress] = useState(sellData?.address || "");
  const [cityStateZip, setCityStateZip] = useState(sellData?.city_state_zip || "");
  const [subdivision, setSubdivision] = useState(sellData?.subdivision || "");
  const [communityName, setCommunityName] = useState(sellData?.community_name || "");
  const [loanPayoff, setLoanPayoff] = useState(sellData?.loan_payoff?.toString() || "");
  const [beds, setBeds] = useState(sellData?.beds?.toString() || "");
  const [baths, setBaths] = useState(sellData?.baths?.toString() || "");
  const [sqft, setSqft] = useState(sellData?.sqft?.toString() || "");
  const [lotSqft, setLotSqft] = useState(sellData?.lot_sqft?.toString() || "");
  const [yearBuilt, setYearBuilt] = useState(sellData?.year_built?.toString() || "");
  const [pool, setPool] = useState(sellData?.pool || false);
  const [stories, setStories] = useState(sellData?.stories?.toString() || "");
  const [estimatedSalePrice, setEstimatedSalePrice] = useState(
    sellData?.estimated_sale_price?.toString() || ""
  );
  const [listingStatus, setListingStatus] = useState<string>(
    sellData?.listing_status || "pre-listing"
  );

  // Buy fields
  const [targetAreas, setTargetAreas] = useState(dashboard.buy_data?.target_areas || "");
  const [budgetMin, setBudgetMin] = useState(dashboard.buy_data?.budget_min?.toString() || "");
  const [budgetMax, setBudgetMax] = useState(dashboard.buy_data?.budget_max?.toString() || "");
  const [bedsMin, setBedsMin] = useState(dashboard.buy_data?.beds_min?.toString() || "");
  const [bathsMin, setBathsMin] = useState(dashboard.buy_data?.baths_min?.toString() || "");
  const [mustHaves, setMustHaves] = useState(
    dashboard.buy_data?.must_haves?.join(", ") || ""
  );
  const [schoolPreference, setSchoolPreference] = useState(dashboard.buy_data?.school_preference || "");
  const [homeSearchUrl, setHomeSearchUrl] = useState(dashboard.buy_data?.home_search_url || "");
  const [competitionLink, setCompetitionLink] = useState(
    dashboard.sell_data?.competition_link || dashboard.buy_data?.competition_link || ""
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const showSellFields = dashboard.type === "sell" || dashboard.type === "buysell";
  const showBuyFields = dashboard.type === "buyer" || dashboard.type === "buysell";

  // PDF upload handlers
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setExtractionError(null);
      setExtractionDone(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setExtractionError(null);
      setExtractionDone(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return;

    setExtracting(true);
    setExtractionError(null);

    try {
      const formData = new FormData();
      formData.append("mlsPdf", selectedFile);

      const res = await fetch("/api/dashboard/extract-mls", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.error && !result.data) {
        setExtractionError(result.error);
        return;
      }

      if (result.data) {
        // Auto-populate property fields from extraction
        if (result.data.address) {
          const fullAddr = result.data.address;
          const commaIdx = fullAddr.indexOf(",");
          if (commaIdx > 0) {
            setAddress(fullAddr.substring(0, commaIdx).trim());
            setCityStateZip(fullAddr.substring(commaIdx + 1).trim());
          } else {
            setAddress(fullAddr);
          }
        }
        if (result.data.subdivision) setSubdivision(result.data.subdivision);
        if (result.data.beds != null) setBeds(result.data.beds.toString());
        if (result.data.baths != null) setBaths(result.data.baths.toString());
        if (result.data.sqft != null) setSqft(result.data.sqft.toString());
        if (result.data.lotSqft != null) setLotSqft(result.data.lotSqft.toString());
        if (result.data.yearBuilt != null) setYearBuilt(result.data.yearBuilt.toString());
        if (result.data.pool != null) setPool(result.data.pool);
        if (result.data.stories != null) setStories(result.data.stories.toString());
        setExtractionDone(true);
      }

      if (result.error) {
        setExtractionError(result.error);
      }
    } catch (err) {
      setExtractionError((err as Error).message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [selectedFile]);

  const handleNext = useCallback(async () => {
    if (!clientNames.trim()) {
      setValidationError("Client names are required.");
      return;
    }
    setValidationError(null);

    const updates: Partial<DashboardWithData> = {
      client_names: clientNames.trim(),
      full_name: fullName.trim() || null,
      email: email.trim() || null,
      agent_key: agentKey,
    };

    // Auto-generate slug if still using draft slug
    if (dashboard.slug.startsWith("draft-")) {
      updates.slug = generateSlug(clientNames.trim(), address.trim() || undefined);
    }

    // Build sell_data if applicable (includes all property fields)
    if (showSellFields) {
      updates.sell_data = {
        ...(dashboard.sell_data || {} as SellData),
        address: address.trim() || null,
        city_state_zip: cityStateZip.trim() || null,
        subdivision: subdivision.trim() || null,
        community_name: communityName.trim() || null,
        loan_payoff: loanPayoff ? parseFloat(loanPayoff) : null,
        beds: beds ? parseInt(beds, 10) : null,
        baths: baths ? parseFloat(baths) : null,
        sqft: sqft ? parseInt(sqft, 10) : null,
        lot_sqft: lotSqft ? parseInt(lotSqft, 10) : null,
        year_built: yearBuilt ? parseInt(yearBuilt, 10) : null,
        pool,
        stories: stories ? parseInt(stories, 10) : null,
        estimated_sale_price: estimatedSalePrice ? parseFloat(estimatedSalePrice) : null,
        listing_status: listingStatus as SellData["listing_status"],
        competition_link: competitionLink.trim() || null,
      } as SellData;
    }

    // Build buy_data if applicable
    if (showBuyFields) {
      updates.buy_data = {
        ...(dashboard.buy_data || {} as BuyData),
        target_areas: targetAreas.trim() || null,
        budget_min: budgetMin ? parseFloat(budgetMin) : null,
        budget_max: budgetMax ? parseFloat(budgetMax) : null,
        beds_min: bedsMin ? parseInt(bedsMin, 10) : null,
        baths_min: bathsMin ? parseInt(bathsMin, 10) : null,
        must_haves: mustHaves
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        school_preference: schoolPreference.trim() || null,
        home_search_url: homeSearchUrl.trim() || null,
        competition_link: competitionLink.trim() || null,
      } as BuyData;
    }

    // Skip step 3 entirely — go straight to market data (step 4)
    await goToStep(4, updates);
  }, [
    clientNames, fullName, email, agentKey, address, cityStateZip,
    subdivision, communityName, loanPayoff, beds, baths, sqft, lotSqft,
    yearBuilt, pool, stories, estimatedSalePrice, listingStatus, targetAreas, budgetMin,
    budgetMax, bedsMin, bathsMin, mustHaves, schoolPreference,
    homeSearchUrl, competitionLink, dashboard, showSellFields, showBuyFields, goToStep,
  ]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h2 className="text-xl font-display font-bold text-slate mb-1">
        Client Information
      </h2>
      <p className="text-sm text-slate-light mb-6">
        Enter client details{showSellFields ? ", upload property documents to auto-fill fields," : ""} and {showSellFields ? "review property information" : "search criteria"}.
      </p>

      {validationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {validationError}
        </div>
      )}

      {/* Common fields */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
          Contact Details
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="clientNames" className="block text-sm font-medium text-slate mb-1">
              Client Names <span className="text-red-400">*</span>
            </label>
            <input
              id="clientNames"
              type="text"
              value={clientNames}
              onChange={(e) => setClientNames(e.target.value)}
              placeholder="e.g. John & Jane Smith"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-slate mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@email.com"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="agentKey" className="block text-sm font-medium text-slate mb-1">
              Agent
            </label>
            <select
              id="agentKey"
              value={agentKey}
              onChange={(e) => setAgentKey(e.target.value)}
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra bg-white"
            >
              {AGENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      {/* Document Upload -- for sell/buysell dashboards */}
      {showSellFields && (
        <fieldset className="mb-8">
          <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
            Document Upload
          </legend>
          <p className="text-sm text-slate-light mb-3">
            Upload the ARMLS Plano PDF to auto-fill property details below.
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-sand rounded-xl p-6 text-center cursor-pointer hover:border-terra/40 hover:bg-terra/5 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-6 h-6 text-terra" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-light">
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                {extractionDone && (
                  <CheckCircle2 className="w-5 h-5 text-sage ml-2" />
                )}
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-sand mx-auto mb-2" />
                <p className="text-sm text-slate-light">
                  Drop an MLS Plano PDF here or click to browse
                </p>
                <p className="text-xs text-sand mt-1">PDF files only</p>
              </>
            )}
          </div>

          {selectedFile && !extractionDone && (
            <div className="mt-3 text-center">
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-terra text-white rounded-lg text-sm font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting property details...
                  </>
                ) : (
                  "Extract Property Data"
                )}
              </button>
            </div>
          )}

          {extractionError && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800">{extractionError}</p>
                <p className="text-xs text-amber-600 mt-1">
                  You can still enter or edit the fields manually below.
                </p>
              </div>
            </div>
          )}
        </fieldset>
      )}

      {/* Sell / BuySell property fields */}
      {showSellFields && (
        <fieldset className="mb-8">
          <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
            Property Details
            {extractionDone && (
              <span className="ml-2 text-xs font-normal text-sage">
                (extracted from PDF — review and correct as needed)
              </span>
            )}
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="address" className="block text-sm font-medium text-slate mb-1">
                Property Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="cityStateZip" className="block text-sm font-medium text-slate mb-1">
                City, State, Zip
              </label>
              <input
                id="cityStateZip"
                type="text"
                value={cityStateZip}
                onChange={(e) => setCityStateZip(e.target.value)}
                placeholder="Phoenix, AZ 85001"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="subdivision" className="block text-sm font-medium text-slate mb-1">
                Subdivision
              </label>
              <input
                id="subdivision"
                type="text"
                value={subdivision}
                onChange={(e) => setSubdivision(e.target.value)}
                placeholder="e.g. Arcadia Estates"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="communityName" className="block text-sm font-medium text-slate mb-1">
                Community Name
              </label>
              <input
                id="communityName"
                type="text"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                placeholder="e.g. Mountain Park Ranch"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="beds" className="block text-sm font-medium text-slate mb-1">
                Beds
              </label>
              <input
                id="beds"
                type="number"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="baths" className="block text-sm font-medium text-slate mb-1">
                Baths
              </label>
              <input
                id="baths"
                type="number"
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                min="0"
                step="0.5"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="sqft" className="block text-sm font-medium text-slate mb-1">
                Sq Ft
              </label>
              <input
                id="sqft"
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="lotSqft" className="block text-sm font-medium text-slate mb-1">
                Lot Sq Ft
              </label>
              <input
                id="lotSqft"
                type="number"
                value={lotSqft}
                onChange={(e) => setLotSqft(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="yearBuilt" className="block text-sm font-medium text-slate mb-1">
                Year Built
              </label>
              <input
                id="yearBuilt"
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                min="1800"
                max="2100"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="stories" className="block text-sm font-medium text-slate mb-1">
                Stories
              </label>
              <input
                id="stories"
                type="number"
                value={stories}
                onChange={(e) => setStories(e.target.value)}
                min="1"
                max="5"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="loanPayoff" className="block text-sm font-medium text-slate mb-1">
                Loan Payoff
              </label>
              <input
                id="loanPayoff"
                type="number"
                value={loanPayoff}
                onChange={(e) => setLoanPayoff(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="estimatedSalePrice" className="block text-sm font-medium text-slate mb-1">
                Estimated Sale Price
              </label>
              <input
                id="estimatedSalePrice"
                type="number"
                value={estimatedSalePrice}
                onChange={(e) => setEstimatedSalePrice(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input
                id="pool"
                type="checkbox"
                checked={pool}
                onChange={(e) => setPool(e.target.checked)}
                className="w-4 h-4 text-terra border-sand rounded focus:ring-terra/30"
              />
              <label htmlFor="pool" className="text-sm font-medium text-slate">
                Pool
              </label>
            </div>
            <div>
              <label htmlFor="listingStatus" className="block text-sm font-medium text-slate mb-1">
                Listing Status
              </label>
              <select
                id="listingStatus"
                value={listingStatus}
                onChange={(e) => setListingStatus(e.target.value)}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra bg-white"
              >
                <option value="pre-listing">Pre-Listing</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </fieldset>
      )}

      {/* Buyer / BuySell search fields */}
      {showBuyFields && (
        <fieldset className="mb-8">
          <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
            Search Criteria
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="targetAreas" className="block text-sm font-medium text-slate mb-1">
                Target Areas
              </label>
              <input
                id="targetAreas"
                type="text"
                value={targetAreas}
                onChange={(e) => setTargetAreas(e.target.value)}
                placeholder="e.g. Scottsdale, Paradise Valley"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="budgetMin" className="block text-sm font-medium text-slate mb-1">
                Budget Min
              </label>
              <input
                id="budgetMin"
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="300000"
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="budgetMax" className="block text-sm font-medium text-slate mb-1">
                Budget Max
              </label>
              <input
                id="budgetMax"
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="500000"
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="bedsMin" className="block text-sm font-medium text-slate mb-1">
                Beds (min)
              </label>
              <input
                id="bedsMin"
                type="number"
                value={bedsMin}
                onChange={(e) => setBedsMin(e.target.value)}
                placeholder="3"
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="bathsMin" className="block text-sm font-medium text-slate mb-1">
                Baths (min)
              </label>
              <input
                id="bathsMin"
                type="number"
                value={bathsMin}
                onChange={(e) => setBathsMin(e.target.value)}
                placeholder="2"
                min="0"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="mustHaves" className="block text-sm font-medium text-slate mb-1">
                Must-Haves
              </label>
              <textarea
                id="mustHaves"
                value={mustHaves}
                onChange={(e) => setMustHaves(e.target.value)}
                placeholder="Pool, 3-car garage, single story (comma-separated)"
                rows={2}
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra resize-none"
              />
            </div>
            <div>
              <label htmlFor="schoolPreference" className="block text-sm font-medium text-slate mb-1">
                School Preference
              </label>
              <input
                id="schoolPreference"
                type="text"
                value={schoolPreference}
                onChange={(e) => setSchoolPreference(e.target.value)}
                placeholder="e.g. Scottsdale Unified"
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
            <div>
              <label htmlFor="homeSearchUrl" className="block text-sm font-medium text-slate mb-1">
                Home Search URL
              </label>
              <input
                id="homeSearchUrl"
                type="url"
                value={homeSearchUrl}
                onChange={(e) => setHomeSearchUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* Competition Link -- all dashboard types */}
      {(showSellFields || showBuyFields) && (
        <fieldset className="mb-8">
          <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
            Competition Link
          </legend>
          <div>
            <label htmlFor="competitionLink" className="block text-sm font-medium text-slate mb-1">
              Competition Link URL
            </label>
            <input
              id="competitionLink"
              type="url"
              value={competitionLink}
              onChange={(e) => setCompetitionLink(e.target.value)}
              placeholder="https://... (Lofty search URL)"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
            <p className="text-xs text-slate-light mt-1">
              Paste a Lofty search URL to show active homes in the client&apos;s area
            </p>
          </div>
        </fieldset>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-sand-pale">
        <div />
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-terra text-white rounded-lg text-sm font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Next
        </button>
      </div>
    </div>
  );
}
