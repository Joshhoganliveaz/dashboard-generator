"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  Send,
  Plus,
  Trash2,
  DollarSign,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { DashboardWithData, PropertyOfInterest } from "@/lib/supabase/types";

interface StepPreviewProps {
  dashboard: DashboardWithData;
  generatedHtml: string | null;
  goToStep: (step: number, data?: Partial<DashboardWithData>) => Promise<void>;
  applyEdit: (instruction: string) => Promise<boolean>;
  isEditing: boolean;
  editError: string | null;
  saving: boolean;
}

const EXAMPLE_PROMPTS = [
  "Change the listing price to $650,000",
  "Update the market snapshot with more recent data",
  "Make the property highlights more compelling",
  "Add a note about the recent kitchen renovation",
];

export default function StepPreview({
  dashboard,
  generatedHtml,
  goToStep,
  applyEdit,
  isEditing,
  editError,
  saving,
}: StepPreviewProps) {
  const [editInstruction, setEditInstruction] = useState("");
  const [sidebarSection, setSidebarSection] = useState<"edit" | "properties">("edit");
  const [properties, setProperties] = useState<PropertyOfInterest[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    address: "",
    price: "",
    listing_url: "",
    photo_url: "",
    notes: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addingProperty, setAddingProperty] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Show properties section for buyer and buysell types
  const showProperties = dashboard.type === "buyer" || dashboard.type === "buysell";

  // Load properties of interest
  const loadProperties = useCallback(async () => {
    if (!showProperties) return;
    setLoadingProperties(true);
    try {
      const res = await fetch(`/api/dashboard/${dashboard.id}/properties`);
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch {
      // Non-critical -- properties are supplementary
    } finally {
      setLoadingProperties(false);
    }
  }, [dashboard.id, showProperties]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleApplyEdit = useCallback(async () => {
    if (!editInstruction.trim()) return;
    setEditSuccess(false);
    const success = await applyEdit(editInstruction.trim());
    if (success) {
      setEditInstruction("");
      setEditSuccess(true);
      setTimeout(() => setEditSuccess(false), 3000);
    }
  }, [editInstruction, applyEdit]);

  const handleAddProperty = useCallback(async () => {
    if (!addForm.address.trim()) {
      setAddError("Address is required");
      return;
    }
    setAddingProperty(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/dashboard/${dashboard.id}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addForm.address.trim(),
          price: addForm.price ? parseFloat(addForm.price) : undefined,
          listing_url: addForm.listing_url.trim() || undefined,
          photo_url: addForm.photo_url.trim() || undefined,
          notes: addForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add property");
      }
      setAddForm({ address: "", price: "", listing_url: "", photo_url: "", notes: "" });
      setShowAddForm(false);
      await loadProperties();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddingProperty(false);
    }
  }, [addForm, dashboard.id, loadProperties]);

  const handleRemoveProperty = useCallback(
    async (propertyId: string) => {
      setRemovingId(propertyId);
      try {
        await fetch(
          `/api/dashboard/${dashboard.id}/properties?propertyId=${propertyId}`,
          { method: "DELETE" }
        );
        await loadProperties();
      } catch {
        // Silently handle -- user can retry
      } finally {
        setRemovingId(null);
      }
    },
    [dashboard.id, loadProperties]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleApplyEdit();
      }
    },
    [handleApplyEdit]
  );

  // No HTML available state
  if (!generatedHtml) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-sand-pale rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-slate-light" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate mb-2">
            No Preview Available
          </h2>
          <p className="text-sm text-slate-light max-w-md mx-auto mb-6">
            Complete step 4 to generate your dashboard before previewing.
          </p>
          <button
            onClick={() => goToStep(4)}
            className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors"
          >
            Go to Market Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 -mx-6 px-6">
      {/* Left: Dashboard Preview */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sand-pale flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate">Dashboard Preview</h2>
            {editSuccess && (
              <span className="text-xs text-sage font-medium">Edit applied</span>
            )}
          </div>
          <div className="relative" style={{ height: "calc(100vh - 280px)" }}>
            <iframe
              ref={iframeRef}
              srcDoc={generatedHtml}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Dashboard preview"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => goToStep(4)}
            disabled={saving}
            className="px-5 py-2.5 border border-sand rounded-lg text-slate text-sm font-medium hover:bg-sand-pale transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => goToStep(6)}
            disabled={saving}
            className="bg-terra text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-terra-dark transition-colors disabled:opacity-50"
          >
            Next: Review &amp; Publish
          </button>
        </div>
      </div>

      {/* Right: Edit Sidebar */}
      <div className="w-80 flex-shrink-0 space-y-4">
        {/* Tab Selector */}
        {showProperties && (
          <div className="flex bg-white rounded-lg shadow-sm p-1">
            <button
              onClick={() => setSidebarSection("edit")}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                sidebarSection === "edit"
                  ? "bg-terra/10 text-terra"
                  : "text-slate-light hover:text-slate"
              }`}
            >
              Edit Dashboard
            </button>
            <button
              onClick={() => setSidebarSection("properties")}
              className={`flex-1 text-xs font-medium py-2 rounded-md transition-colors ${
                sidebarSection === "properties"
                  ? "bg-terra/10 text-terra"
                  : "text-slate-light hover:text-slate"
              }`}
            >
              Properties ({properties.length})
            </button>
          </div>
        )}

        {/* Natural Language Edit Section */}
        {(sidebarSection === "edit" || !showProperties) && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-terra" />
              <h3 className="text-sm font-semibold text-slate">Edit with AI</h3>
            </div>
            <p className="text-xs text-slate-light mb-3">
              Describe what you would like to change and Claude will update the dashboard.
            </p>

            <div className="relative">
              <textarea
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you'd like to change..."
                rows={3}
                disabled={isEditing}
                className="w-full text-sm border border-sand rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra disabled:opacity-50 disabled:bg-sand-pale/30"
              />
              <button
                onClick={handleApplyEdit}
                disabled={!editInstruction.trim() || isEditing}
                className="absolute bottom-2 right-2 p-1.5 bg-terra text-white rounded-md hover:bg-terra-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Apply edit (Cmd+Enter)"
              >
                {isEditing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {editError && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Example prompts */}
            <div className="mt-3 pt-3 border-t border-sand-pale">
              <p className="text-xs text-slate-light mb-2">Try an example:</p>
              <div className="space-y-1">
                {EXAMPLE_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => setEditInstruction(prompt)}
                    disabled={isEditing}
                    className="block w-full text-left text-xs text-slate-light hover:text-terra px-2 py-1 rounded hover:bg-terra/5 transition-colors disabled:opacity-50 truncate"
                  >
                    &ldquo;{prompt}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Properties of Interest Section */}
        {showProperties && sidebarSection === "properties" && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate">
                Properties of Interest
              </h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="p-1 text-terra hover:bg-terra/10 rounded transition-colors"
                title="Add property"
              >
                {showAddForm ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Add Property Form */}
            {showAddForm && (
              <div className="mb-4 p-3 bg-sand-pale/30 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="Address *"
                  value={addForm.address}
                  onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full text-sm border border-sand rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={addForm.price}
                  onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full text-sm border border-sand rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
                <input
                  type="url"
                  placeholder="Listing URL"
                  value={addForm.listing_url}
                  onChange={(e) => setAddForm((f) => ({ ...f, listing_url: e.target.value }))}
                  className="w-full text-sm border border-sand rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
                <input
                  type="url"
                  placeholder="Photo URL"
                  value={addForm.photo_url}
                  onChange={(e) => setAddForm((f) => ({ ...f, photo_url: e.target.value }))}
                  className="w-full text-sm border border-sand rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />
                <textarea
                  placeholder="Notes"
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full text-sm border border-sand rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-terra/30 focus:border-terra"
                />

                {addError && (
                  <p className="text-xs text-red-600">{addError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAddProperty}
                    disabled={addingProperty}
                    className="bg-terra text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-terra-dark transition-colors disabled:opacity-50"
                  >
                    {addingProperty ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Add Property"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddError(null);
                    }}
                    className="text-xs text-slate-light hover:text-slate"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Property List */}
            {loadingProperties ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-light">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading properties...
              </div>
            ) : properties.length === 0 ? (
              <p className="text-xs text-slate-light py-4 text-center">
                No properties added yet. Click + to add one.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {properties.map((poi) => (
                  <div
                    key={poi.id}
                    className="border border-sand-pale rounded-lg p-2.5 group hover:border-sand transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate truncate">
                          {poi.address}
                        </p>
                        {poi.price && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <DollarSign className="w-3 h-3 text-sage" />
                            <span className="text-xs text-sage font-medium">
                              {poi.price.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {poi.notes && (
                          <p className="text-xs text-slate-light mt-1 line-clamp-2">
                            {poi.notes}
                          </p>
                        )}
                        {poi.listing_url && (
                          <a
                            href={poi.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-terra hover:underline mt-1"
                          >
                            View listing <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveProperty(poi.id)}
                        disabled={removingId === poi.id}
                        className="p-1 text-slate-light hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove property"
                      >
                        {removingId === poi.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
