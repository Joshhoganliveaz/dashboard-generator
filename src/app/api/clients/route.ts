import { NextResponse } from "next/server";
import Papa from "papaparse";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1yHa34k7Mo6qnpPzlppU1biksGJY6Pdjp4CiTFoP1xjA/export?format=csv&gid=0";

interface SheetRow {
  "First Name": string;
  "Last Name": string;
  "Family First Name": string;
  "Family Last Name": string;
  Email: string;
  "Street Address": string;
  City: string;
  State: string;
  "Postal Code": string;
  "Buyer Closing Date": string;
  "Dashboard URL": string;
  "Closing Month": string;
  "Calculated Years Owned": string;
  "Tenure Tag": string;
}

export interface ClientRecord {
  firstName: string;
  lastName: string;
  familyFirstName: string;
  familyLastName: string;
  clientNames: string;
  fullName: string;
  email: string;
  address: string;
  cityStateZip: string;
  closingDate: string;
  closingMonth: number;
  tenureTag: string;
  yearsOwned: string;
  dashboardUrl: string;
}

// In-memory cache
let cachedClients: ClientRecord[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function parseClosingDate(raw: string): string {
  if (!raw) return "";
  // "Jan 31, 2022" → "2022-01-31"
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function mapRow(row: SheetRow): ClientRecord | null {
  const firstName = (row["First Name"] || "").trim();
  const lastName = (row["Last Name"] || "").trim();
  if (!firstName || !lastName) return null;

  const familyFirstName = (row["Family First Name"] || "").trim();
  const familyLastName = (row["Family Last Name"] || "").trim();

  const hasFamilyName = familyFirstName && familyFirstName !== firstName;

  const clientNames = hasFamilyName
    ? `${firstName} & ${familyFirstName} ${familyLastName || lastName}`
    : `${firstName} ${lastName}`;

  const fullName = hasFamilyName
    ? `${firstName} ${lastName} & ${familyFirstName} ${familyLastName || lastName}`
    : `${firstName} ${lastName}`;

  const city = (row["City"] || "").trim();
  const state = (row["State"] || "").trim();
  const zip = (row["Postal Code"] || "").trim();
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");

  return {
    firstName,
    lastName,
    familyFirstName,
    familyLastName,
    clientNames,
    fullName,
    email: (row["Email"] || "").trim(),
    address: (row["Street Address"] || "").trim(),
    cityStateZip,
    closingDate: parseClosingDate(row["Buyer Closing Date"]),
    closingMonth: parseInt(row["Closing Month"], 10) || 0,
    tenureTag: (row["Tenure Tag"] || "").trim(),
    yearsOwned: (row["Calculated Years Owned"] || "").trim(),
    dashboardUrl: (row["Dashboard URL"] || "").trim(),
  };
}

export async function GET() {
  const now = Date.now();

  if (cachedClients && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedClients);
  }

  try {
    const res = await fetch(SHEET_URL, { redirect: "follow" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch sheet: ${res.status}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();
    const parsed = Papa.parse<SheetRow>(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const clients = parsed.data
      .map(mapRow)
      .filter((c): c is ClientRecord => c !== null && c.address !== "");

    cachedClients = clients;
    cacheTimestamp = now;

    return NextResponse.json(clients);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch clients: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
