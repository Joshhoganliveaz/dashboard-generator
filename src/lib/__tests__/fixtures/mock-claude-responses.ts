/** Canned Claude API responses for testing without hitting the API */

export const mockMLSExtraction = {
  beds: 4,
  baths: 2.5,
  sqft: 1920,
  yearBuilt: 1986,
  pool: true,
  stories: 1,
  features: [
    { title: "Private Pool & Spa", desc: "Resort-style backyard with a refreshed pebble-tech pool and separate spa, ideal for Arizona outdoor living." },
    { title: "Updated Kitchen", desc: "Modern granite countertops with stainless steel appliances and soft-close cabinetry." },
    { title: "Open Floor Plan", desc: "Spacious great room with vaulted ceilings and abundant natural light." },
    { title: "Mountain Views", desc: "Enjoy scenic views of the Superstition Mountains from the backyard." },
  ],
};

export const mockCromfordData = {
  metrics: [
    { label: "Cromford Supply Index", value: "85.2", arrow: "\u25b2", color: "var(--positive)", ctx: "Seller advantage" },
    { label: "Months of Supply", value: "2.4", arrow: "\u25bc", color: "var(--positive)", ctx: "Low inventory" },
    { label: "Monthly Sales $/SF", value: "$289", arrow: "\u25b2", color: "var(--positive)", ctx: "Rising" },
    { label: "Sale-to-List %", value: "97.8%", arrow: "\u25b2", color: "var(--positive)", ctx: "Strong demand" },
    { label: "Median Sold Price", value: "$485,000", arrow: "\u25b2", color: "var(--positive)", ctx: "Up 4.2% YoY" },
    { label: "Days on Market", value: "19", arrow: "\u25bc", color: "var(--positive)", ctx: "Quick sales" },
    { label: "Annual Appreciation $/SF", value: "+4.8%", arrow: "\u25b2", color: "var(--positive)", ctx: "Steady growth" },
    { label: "Contract Ratio", value: "68.4", arrow: "\u25b2", color: "var(--positive)", ctx: "Active market" },
    { label: "Listing Success Rate", value: "82.1%", arrow: "\u25b2", color: "var(--positive)", ctx: "High success" },
    { label: "Active Listings", value: "342", arrow: "\u25bc", color: "var(--positive)", ctx: "Tight supply" },
  ],
  takeaway: "The Mesa single-family market continues to favor sellers with a Cromford Supply Index of 85.2. Low inventory (2.4 months of supply) and strong demand are keeping prices stable with moderate appreciation.",
  source: "Source: Cromford Report, Mesa Single Family Detached, as of March 2026",
};

export const mockWebResearch = {
  developments: [
    { emoji: "\ud83c\udf7d\ufe0f", title: "First Watch Opening", desc: "New breakfast and brunch location opening at Dobson & Guadalupe, bringing fresh dining options to the neighborhood.", source: "AZ Central", url: "https://example.com/firstwatch" },
    { emoji: "\ud83d\uded2", title: "Sprouts Farmers Market Expansion", desc: "Sprouts is expanding their Dobson Road location with a larger organic produce section.", source: "Mesa Republic", url: "https://example.com/sprouts" },
    { emoji: "\u2615", title: "Dutch Bros Drive-Through", desc: "Popular coffee chain opening a new drive-through location near Baseline and Dobson.", source: "AZ Big Media", url: "https://example.com/dutchbros" },
  ],
  infrastructure: [
    { emoji: "\ud83d\udea7", title: "Dobson Road Improvements", desc: "City of Mesa widening Dobson Road between Southern and Baseline with new bike lanes and improved sidewalks.", source: "City of Mesa", url: "https://example.com/dobson-road" },
    { emoji: "\ud83c\udfe5", title: "Banner Health Clinic", desc: "New urgent care facility opening at Dobson Ranch, providing convenient healthcare access.", source: "Banner Health", url: "https://example.com/banner" },
    { emoji: "\ud83c\udf33", title: "Dobson Ranch Park Renovation", desc: "Mesa Parks Department investing $2.1M in playground updates and splash pad additions.", source: "Mesa Parks", url: "https://example.com/parks" },
  ],
  areaHighlights: [
    { emoji: "\ud83c\udfc5", title: "Mesa Named Top 50 Places to Live", desc: "Money Magazine ranks Mesa among the top 50 places to live in America for the third consecutive year.", source: "Money Magazine", url: "https://example.com/mesa-top50" },
    { emoji: "\u2b50", title: "Dobson Ranch A-Rated Schools", desc: "Mesa Public Schools in the Dobson Ranch area maintain A and B ratings, supporting strong property values.", source: "GreatSchools", url: "https://example.com/schools" },
  ],
};

export const mockTaxRecordsExtraction = {
  purchasePrice: 585000,
  purchaseDate: "2022-03-14",
  originalLoanAmount: 468000,
  loanDate: "2022-03-14",
  refinances: [],
  assessedValue: 542000,
  taxYear: 2025,
  legalDescription: "LOT 42 SARATOGA LAKES UNIT 3",
};

export const mockContentGeneration = {
  headerTitle: "Happy 4-Year Houseversary! \ud83c\udf89",
  outlookNarrative: [
    "Mesa's residential market remains firmly positioned in seller territory, with the Cromford Supply Index at 85.2 and inventory holding at 2.4 months of supply. Median sold prices have climbed 4.2% year-over-year to $485,000, while the average days on market sits at a brisk 19 days. The sale-to-list ratio of 97.8% signals that well-priced homes continue to attract strong offers.",
    "Saratoga Lakes at Dobson Ranch benefits from its established reputation, A-rated schools, and proximity to the Dobson Ranch lake amenities. With limited new construction in the immediate area, resale inventory remains competitive, supporting steady value appreciation for existing homeowners.",
  ],
  neighborhoodNarrative: "Values in Saratoga Lakes continue trending upward, with the most recent 12-month median price per square foot rising to $305. Pool homes in the area command a notable premium, and the 1,800-2,400 SF size segment where your home sits remains the most sought-after configuration among buyers.",
  bedroomNarrative: "Four-bedroom homes in Saratoga Lakes command a higher price per square foot than the more common 3-bedroom layout, reflecting strong buyer preference for the additional space.",
  upgrades: [
    { name: "Smart Home Integration", emoji: "\ud83d\udcf1", cost: "$2,000-$4,000", roi: "60-70%", desc: "Add smart thermostat, doorbell camera, and automated lighting to modernize your 1986-built home and appeal to tech-savvy buyers." },
    { name: "Pool Resurfacing", emoji: "\ud83c\udfca", cost: "$4,000-$8,000", roi: "70-80%", desc: "Your pool is already a major selling point. Fresh pebble-tech resurfacing keeps it looking pristine and extends its lifespan." },
    { name: "Kitchen Backsplash Update", emoji: "\ud83c\udf73", cost: "$1,500-$3,000", roi: "75-85%", desc: "A modern tile backsplash complements your existing granite countertops and creates a cohesive, updated look." },
    { name: "Exterior Paint Refresh", emoji: "\ud83c\udfa8", cost: "$3,000-$6,000", roi: "80-90%", desc: "Arizona sun takes a toll on exterior finishes. A fresh coat in a modern desert palette dramatically boosts curb appeal." },
  ],
  resources: {
    seasonal: {
      spring: "Schedule AC tune-up before temperatures climb. Check pool equipment and clean filters for the swimming season ahead.",
      summer: "Set irrigation timers for early morning watering. Inspect weatherstripping around doors to keep cool air in and energy costs down.",
      fall: "Overseed your Bermuda grass with winter rye for year-round green. Clean gutters and check roof for monsoon damage.",
      winter: "Protect frost-sensitive plants on cold nights. Test your heating system and replace HVAC filters for optimal efficiency.",
    },
    links: [
      { label: "Maricopa County Assessor", url: "https://mcassessor.maricopa.gov/", desc: "Property tax info and assessed values" },
      { label: "City of Mesa Utilities", url: "https://www.mesaaz.gov/residents/utilities", desc: "Water, trash, and utility services" },
      { label: "Saratoga Lakes at Dobson Ranch HOA", url: "", desc: "Community info, amenities, and events" },
    ],
  },
};
