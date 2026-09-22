/**
 * Seeds a handful of realistic-shaped IPOs across all four statuses,
 * plus one admin user, so the site has something to show immediately
 * after `npm run seed`. Not a source of truth — just fixtures.
 *
 * Usage: node src/scripts/seed.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const Issue = require("../models/Issue");
const Subscription = require("../models/Subscription");
const GreyMarket = require("../models/GreyMarket");
const Admin = require("../models/Admin");

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(3, 30, 0, 0); // ~09:00 IST
  return d;
}

const FIXTURES = [
  {
    exchangeIdentifier: "INE001IPO01",
    tradingSymbol: "GREENFARM",
    slug: "greenfarm-agritech",
    companyName: "GreenFarm Agritech Ltd",
    issueType: "mainboard",
    exchange: "BOTH",
    openDate: daysFromNow(-2),
    closeDate: daysFromNow(0), // closes today
    allotmentDate: { date: daysFromNow(1), provisional: true },
    refundDate: { date: daysFromNow(2), provisional: true },
    dematCreditDate: { date: daysFromNow(2), provisional: true },
    listingDate: { date: daysFromNow(3), provisional: true },
    priceBandMin: 210,
    priceBandMax: 222,
    lotSize: 65,
    minInvestment: 14430,
    issueSizeCr: 850,
    freshIssueCr: 600,
    offerForSaleCr: 250,
    faceValue: 10,
    registrarName: "KFin Technologies",
    registrarAllotmentUrl: "https://kosmic.kfintech.com/ipostatus/",
    prospectusUrl: null, // seed fixture — no real prospectus link for this made-up company
  },
  {
    exchangeIdentifier: "INE002IPO02",
    tradingSymbol: "SWIFTLOG",
    slug: "swiftlog-supply-chain",
    companyName: "SwiftLog Supply Chain Ltd",
    issueType: "mainboard",
    exchange: "NSE",
    openDate: daysFromNow(-5),
    closeDate: daysFromNow(-2),
    allotmentDate: { date: daysFromNow(-1), provisional: false },
    refundDate: { date: daysFromNow(0), provisional: false },
    dematCreditDate: { date: daysFromNow(0), provisional: false },
    listingDate: { date: daysFromNow(1), provisional: true },
    priceBandMin: 88,
    priceBandMax: 95,
    lotSize: 150,
    minInvestment: 14250,
    issueSizeCr: 420,
    freshIssueCr: 420,
    offerForSaleCr: null,
    faceValue: 5,
    registrarName: "Link Intime India",
    registrarAllotmentUrl: "https://linkintime.co.in/initial_offer/public-issues.html",
    prospectusUrl: null, // seed fixture — no real prospectus link for this made-up company
  },
  {
    exchangeIdentifier: "INE003IPO03",
    tradingSymbol: "NEOMED",
    slug: "neomed-diagnostics",
    companyName: "NeoMed Diagnostics Ltd",
    issueType: "sme",
    exchange: "BSE",
    openDate: daysFromNow(-20),
    closeDate: daysFromNow(-17),
    allotmentDate: { date: daysFromNow(-16), provisional: false },
    refundDate: { date: daysFromNow(-15), provisional: false },
    dematCreditDate: { date: daysFromNow(-15), provisional: false },
    listingDate: { date: daysFromNow(-14), provisional: false },
    priceBandMin: 55,
    priceBandMax: 58,
    lotSize: 2000,
    minInvestment: 116000,
    issueSizeCr: 38,
    freshIssueCr: 38,
    offerForSaleCr: null,
    faceValue: 10,
    registrarName: "Bigshare Services",
    registrarAllotmentUrl: "https://ipo.bigshareonline.com/IPO_Status.html",
    prospectusUrl: null, // seed fixture — no real prospectus link for this made-up company
    listingPrice: 71,
    listingGainPercent: 22.41,
  },
  {
    exchangeIdentifier: "INE004IPO04",
    tradingSymbol: "URBANCRAFT",
    slug: "urbancraft-interiors",
    companyName: "UrbanCraft Interiors Ltd",
    issueType: "sme",
    exchange: "NSE",
    openDate: daysFromNow(4),
    closeDate: daysFromNow(6),
    allotmentDate: { date: daysFromNow(7), provisional: true },
    refundDate: { date: daysFromNow(8), provisional: true },
    dematCreditDate: { date: daysFromNow(8), provisional: true },
    listingDate: { date: daysFromNow(9), provisional: true },
    priceBandMin: 130,
    priceBandMax: 138,
    lotSize: 1000,
    minInvestment: 138000,
    issueSizeCr: 62,
    freshIssueCr: 62,
    offerForSaleCr: null,
    faceValue: 10,
    registrarName: "Cameo Corporate Services",
    registrarAllotmentUrl: "https://ipo.cameoindia.com/",
    prospectusUrl: null,
  },
  {
    exchangeIdentifier: "INE005IPO05",
    tradingSymbol: "SOLARVOLT",
    slug: "solarvolt-energy",
    companyName: "SolarVolt Energy Ltd",
    issueType: "mainboard",
    exchange: "BOTH",
    openDate: daysFromNow(12),
    closeDate: daysFromNow(14),
    allotmentDate: { date: null, provisional: true },
    refundDate: { date: null, provisional: true },
    dematCreditDate: { date: null, provisional: true },
    listingDate: { date: null, provisional: true },
    priceBandMin: 340,
    priceBandMax: 360,
    lotSize: 40,
    minInvestment: 14400,
    issueSizeCr: 1650,
    freshIssueCr: 1200,
    offerForSaleCr: 450,
    faceValue: 10,
    registrarName: "KFin Technologies",
    registrarAllotmentUrl: "https://kosmic.kfintech.com/ipostatus/",
    prospectusUrl: null,
  },
];

async function seed() {
  await connectDB();

  console.log("Clearing existing data...");
  await Promise.all([
    Issue.deleteMany({}),
    Subscription.deleteMany({}),
    GreyMarket.deleteMany({}),
  ]);

  const now = new Date();
  console.log("Inserting issues...");
  for (const fixture of FIXTURES) {
    const issue = await Issue.create({
      ...fixture,
      sourceUrl: "seed-script",
      fetchedAt: now,
      verified: false,
    });

    // Seed one subscription snapshot per category for open/closed issues
    if (["greenfarm-agritech", "swiftlog-supply-chain", "neomed-diagnostics"].includes(
      issue.slug
    )) {
      const values = { qib: 4.2, nii: 8.1, retail: 2.6, employee: 1.1, overall: 4.6 };
      for (const [category, timesSubscribed] of Object.entries(values)) {
        await Subscription.create({
          issue: issue._id,
          category,
          timesSubscribed,
          fetchedAt: now,
          sourceUrl: "seed-script",
        });
      }
    }

    if (issue.issueType && issue.status !== "listed") {
      await GreyMarket.create({
        issue: issue._id,
        premiumAmount: Math.round(issue.priceBandMax * 0.12),
        impliedGainPercent: 12,
        fetchedAt: now,
        sourceUrl: "seed-script",
      });
    }
  }

  console.log("Seeding admin user...");
  const username = process.env.ADMIN_SEED_USERNAME || "admin";
  const password = process.env.ADMIN_SEED_PASSWORD || "change-me";
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.deleteMany({ username });
  await Admin.create({ username, passwordHash });
  console.log(`Admin user ready: ${username} / (password from env)`);

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
