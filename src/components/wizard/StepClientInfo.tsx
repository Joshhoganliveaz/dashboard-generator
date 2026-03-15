"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
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
  // Dashboard-level fields
  const [clientNames, setClientNames] = useState(dashboard.client_names || "");
  const [fullName, setFullName] = useState(dashboard.full_name || "");
  const [email, setEmail] = useState(dashboard.email || "");
  const [agentKey, setAgentKey] = useState(dashboard.agent_key || "josh_jacqui");

  // Sell fields
  const [address, setAddress] = useState(dashboard.sell_data?.address || "");
  const [cityStateZip, setCityStateZip] = useState(dashboard.sell_data?.city_state_zip || "");
  const [subdivision, setSubdivision] = useState(dashboard.sell_data?.subdivision || "");
  const [communityName, setCommunityName] = useState(dashboard.sell_data?.community_name || "");
  const [loanPayoff, setLoanPayoff] = useState(dashboard.sell_data?.loan_payoff?.toString() || "");

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

  const [validationError, setValidationError] = useState<string | null>(null);

  const showSellFields = dashboard.type === "sell" || dashboard.type === "buysell";
  const showBuyFields = dashboard.type === "buyer" || dashboard.type === "buysell";

  const handleNext = useCallback(async () => {
    // Validate required fields
    if (!clientNames.trim()) {
      setValidationError("Client names are required.");
      return;
    }
    setValidationError(null);

    // Build update payload
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

    // Build sell_data if applicable
    if (showSellFields) {
      updates.sell_data = {
        ...(dashboard.sell_data || {} as SellData),
        address: address.trim() || null,
        city_state_zip: cityStateZip.trim() || null,
        subdivision: subdivision.trim() || null,
        community_name: communityName.trim() || null,
        loan_payoff: loanPayoff ? parseFloat(loanPayoff) : null,
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
      } as BuyData;
    }

    // For buyer type, skip step 3 (property extraction) and go to step 4
    const nextStep = dashboard.type === "buyer" ? 4 : 3;
    await goToStep(nextStep, updates);
  }, [
    clientNames, fullName, email, agentKey, address, cityStateZip,
    subdivision, communityName, loanPayoff, targetAreas, budgetMin,
    budgetMax, bedsMin, bathsMin, mustHaves, schoolPreference,
    homeSearchUrl, dashboard, showSellFields, showBuyFields, goToStep,
  ]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h2 className="text-xl font-display font-bold text-slate mb-1">
        Client Information
      </h2>
      <p className="text-sm text-slate-light mb-6">
        Enter client details and {showSellFields ? "property information" : "search criteria"}.
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

      {/* Sell / BuySell property fields */}
      {showSellFields && (
        <fieldset className="mb-8">
          <legend className="text-sm font-semibold text-slate mb-3 uppercase tracking-wide">
            Property Details
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
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
