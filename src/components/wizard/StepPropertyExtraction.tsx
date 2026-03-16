"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import type { DashboardWithData, SellData } from "@/lib/supabase/types";

interface StepPropertyExtractionProps {
  dashboard: DashboardWithData;
  saving: boolean;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  updateDashboardData: (updates: Partial<DashboardWithData>) => void;
}

export default function StepPropertyExtraction({
  dashboard,
  saving,
  goToStep,
}: StepPropertyExtractionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Editable property fields -- pre-fill from existing sell_data
  const sellData = dashboard.sell_data;
  const [address, setAddress] = useState(sellData?.address || "");
  const [cityStateZip, setCityStateZip] = useState(sellData?.city_state_zip || "");
  const [subdivision, setSubdivision] = useState(sellData?.subdivision || "");
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
        console.log("[MLS Extract] result.data:", JSON.stringify(result.data));
        // Populate editable fields from extraction
        if (result.data.address) {
          // Split "2854 S JACOB ST, Gilbert, AZ 85295" into street + city/state/zip
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
        // Partial extraction -- show warning but keep any data
        setExtractionError(result.error);
      }
    } catch (err) {
      setExtractionError((err as Error).message || "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [selectedFile]);

  const handleNext = useCallback(async () => {
    const updates: Partial<DashboardWithData> = {
      sell_data: {
        ...(dashboard.sell_data || {} as SellData),
        address: address.trim() || null,
        city_state_zip: cityStateZip.trim() || null,
        subdivision: subdivision.trim() || null,
        beds: beds ? parseInt(beds, 10) : null,
        baths: baths ? parseFloat(baths) : null,
        sqft: sqft ? parseInt(sqft, 10) : null,
        lot_sqft: lotSqft ? parseInt(lotSqft, 10) : null,
        year_built: yearBuilt ? parseInt(yearBuilt, 10) : null,
        pool,
        stories: stories ? parseInt(stories, 10) : null,
        estimated_sale_price: estimatedSalePrice ? parseFloat(estimatedSalePrice) : null,
      } as SellData,
    };

    await goToStep(4, updates);
  }, [
    dashboard, address, cityStateZip, subdivision, beds, baths,
    sqft, lotSqft, yearBuilt, pool, stories, estimatedSalePrice, goToStep,
  ]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h2 className="text-xl font-display font-bold text-slate mb-1">
        Property Data
      </h2>
      <p className="text-sm text-slate-light mb-6">
        Upload an MLS listing PDF to auto-extract property details, or enter them manually.
      </p>

      {/* Upload section */}
      <div className="mb-8">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-sand rounded-xl p-8 text-center cursor-pointer hover:border-terra/40 hover:bg-terra/5 transition-colors"
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
              <FileText className="w-8 h-8 text-terra" />
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
              <Upload className="w-8 h-8 text-sand mx-auto mb-2" />
              <p className="text-sm text-slate-light">
                Drop an MLS listing PDF here or click to browse
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
                  Extracting property details from MLS listing...
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
      </div>

      {/* Editable property fields */}
      <fieldset className="mb-8">
        <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
          Property Details
          {extractionDone && (
            <span className="ml-2 text-xs font-normal text-sage">
              (extracted from PDF -- review and correct as needed)
            </span>
          )}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="propAddress" className="block text-sm font-medium text-slate mb-1">
              Address
            </label>
            <input
              id="propAddress"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="propCityStateZip" className="block text-sm font-medium text-slate mb-1">
              City, State, Zip
            </label>
            <input
              id="propCityStateZip"
              type="text"
              value={cityStateZip}
              onChange={(e) => setCityStateZip(e.target.value)}
              placeholder="Phoenix, AZ 85001"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propSubdivision" className="block text-sm font-medium text-slate mb-1">
              Subdivision
            </label>
            <input
              id="propSubdivision"
              type="text"
              value={subdivision}
              onChange={(e) => setSubdivision(e.target.value)}
              placeholder="e.g. Arcadia Estates"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propBeds" className="block text-sm font-medium text-slate mb-1">
              Beds
            </label>
            <input
              id="propBeds"
              type="number"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propBaths" className="block text-sm font-medium text-slate mb-1">
              Baths
            </label>
            <input
              id="propBaths"
              type="number"
              value={baths}
              onChange={(e) => setBaths(e.target.value)}
              min="0"
              step="0.5"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propSqft" className="block text-sm font-medium text-slate mb-1">
              Sq Ft
            </label>
            <input
              id="propSqft"
              type="number"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propLotSqft" className="block text-sm font-medium text-slate mb-1">
              Lot Sq Ft
            </label>
            <input
              id="propLotSqft"
              type="number"
              value={lotSqft}
              onChange={(e) => setLotSqft(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propYearBuilt" className="block text-sm font-medium text-slate mb-1">
              Year Built
            </label>
            <input
              id="propYearBuilt"
              type="number"
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              min="1800"
              max="2100"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propStories" className="block text-sm font-medium text-slate mb-1">
              Stories
            </label>
            <input
              id="propStories"
              type="number"
              value={stories}
              onChange={(e) => setStories(e.target.value)}
              min="1"
              max="5"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div>
            <label htmlFor="propEstPrice" className="block text-sm font-medium text-slate mb-1">
              Estimated Sale Price
            </label>
            <input
              id="propEstPrice"
              type="number"
              value={estimatedSalePrice}
              onChange={(e) => setEstimatedSalePrice(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-sand rounded-lg text-sm text-slate focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              id="propPool"
              type="checkbox"
              checked={pool}
              onChange={(e) => setPool(e.target.checked)}
              className="w-4 h-4 text-terra border-sand rounded focus:ring-terra/30"
            />
            <label htmlFor="propPool" className="text-sm font-medium text-slate">
              Pool
            </label>
          </div>
        </div>
      </fieldset>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-sand-pale">
        <button
          onClick={() => goToStep(2)}
          disabled={saving}
          className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToStep(4)}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-light hover:text-slate transition-colors disabled:opacity-50"
          >
            Skip
          </button>
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
    </div>
  );
}
