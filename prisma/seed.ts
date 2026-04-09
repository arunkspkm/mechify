import "dotenv/config";
import { PrismaClient, MasterDataType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as pg from "pg";
import { hashSync } from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default admin (owner) user
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hashSync("admin123", 10),
      name: "Shop Owner",
      role: "OWNER",
    },
  });

  // Create default business config
  await prisma.businessConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      shopName: "Mechify",
      gstEnabled: false,
      financialYearStartMonth: 4,
      invoicePrefix: "MEC",
      estimatePrefix: "EST",
      defaultDiscountMax: 10,
      expiryAlertDays: 30,
    },
  });

  // Seed master data
  const masterData: {
    type: MasterDataType;
    entries: { name: string; code?: string; metadata?: object }[];
  }[] = [
    {
      type: "UNIT",
      entries: [
        { name: "Pieces", code: "pcs" },
        { name: "Meters", code: "mtr" },
        { name: "Liters", code: "ltr" },
        { name: "Set", code: "set" },
        { name: "Pair", code: "pair" },
        { name: "Kilograms", code: "kg" },
        { name: "Roll", code: "roll" },
        { name: "Bundle", code: "bundle" },
        { name: "Box", code: "box" },
        { name: "Bottle", code: "bottle" },
      ],
    },
    {
      type: "CATEGORY",
      entries: [
        { name: "Electronics" },
        { name: "Audio" },
        { name: "Lighting" },
        { name: "Cleaning" },
        { name: "Exterior" },
        { name: "Interior" },
        { name: "Safety" },
        { name: "Accessories" },
        { name: "Wiring & Cables" },
        { name: "Perfumes & Fresheners" },
      ],
    },
    {
      type: "PAYMENT_METHOD",
      entries: [
        { name: "Cash" },
        { name: "UPI" },
        { name: "Card" },
        { name: "Bank Transfer" },
        { name: "Credit" },
      ],
    },
    {
      type: "TAX_RATE",
      entries: [
        { name: "GST 5%", code: "5", metadata: { rate: 5 } },
        { name: "GST 12%", code: "12", metadata: { rate: 12 } },
        { name: "GST 18%", code: "18", metadata: { rate: 18 } },
        { name: "GST 28%", code: "28", metadata: { rate: 28 } },
      ],
    },
    {
      type: "QUALITY_GRADE",
      entries: [
        { name: "Premium" },
        { name: "Standard" },
        { name: "Economy" },
      ],
    },
    {
      type: "RETURN_REASON",
      entries: [
        { name: "Didn't like" },
        { name: "Defective" },
        { name: "Warranty claim" },
        { name: "Wrong item" },
        { name: "Damaged in transit" },
      ],
    },
    {
      type: "STOCK_ADJUSTMENT_REASON",
      entries: [
        { name: "Damage" },
        { name: "Theft" },
        { name: "Miscounting" },
        { name: "Natural Wastage" },
        { name: "Found Excess" },
      ],
    },
    {
      type: "INSTALLATION_CHARGE_TYPE",
      entries: [
        { name: "Standard" },
        { name: "Complex" },
        { name: "Custom" },
      ],
    },
    {
      type: "ESTIMATE_VALIDITY_PERIOD",
      entries: [
        { name: "7 Days", metadata: { days: 7 } },
        { name: "15 Days", metadata: { days: 15 } },
        { name: "30 Days", metadata: { days: 30 } },
      ],
    },
    {
      type: "EXPENSE_CATEGORY",
      entries: [
        { name: "Advertisement" },
        { name: "Donations" },
        { name: "Utilities" },
        { name: "Rent" },
        { name: "Maintenance" },
        { name: "Transport" },
      ],
    },
    {
      type: "VEHICLE_MAKE",
      entries: [
        { name: "Maruti Suzuki" },
        { name: "Hyundai" },
        { name: "Tata" },
        { name: "Mahindra" },
        { name: "Toyota" },
        { name: "Kia" },
        { name: "Honda" },
        { name: "MG" },
        { name: "Skoda" },
        { name: "Volkswagen" },
      ],
    },
  ];

  for (const { type, entries } of masterData) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      await prisma.masterData.upsert({
        where: { type_name: { type, name: entry.name } },
        update: {},
        create: {
          type,
          name: entry.name,
          code: entry.code ?? null,
          metadata: entry.metadata ?? undefined,
          displayOrder: i,
        },
      });
    }
  }

  // Seed vehicle models (linked to makes)
  const vehicleModels: Record<string, string[]> = {
    "Maruti Suzuki": ["Swift", "Baleno", "Brezza", "Ertiga", "Dzire", "Alto", "WagonR", "Fronx", "Jimny"],
    "Hyundai": ["Creta", "Venue", "i20", "Verna", "Tucson", "Exter", "Alcazar"],
    "Tata": ["Nexon", "Punch", "Harrier", "Safari", "Altroz", "Tiago", "Curvv"],
    "Mahindra": ["XUV700", "Thar", "Scorpio N", "XUV400", "XUV3XO", "Bolero"],
    "Toyota": ["Innova", "Fortuner", "Hyryder", "Glanza", "Hilux"],
    "Kia": ["Seltos", "Sonet", "Carens", "EV6", "EV9"],
    "Honda": ["City", "Amaze", "Elevate", "WR-V"],
    "MG": ["Hector", "Astor", "ZS EV", "Gloster", "Comet"],
  };

  for (const [makeName, models] of Object.entries(vehicleModels)) {
    const make = await prisma.masterData.findUnique({
      where: { type_name: { type: "VEHICLE_MAKE", name: makeName } },
    });
    if (!make) continue;

    for (let i = 0; i < models.length; i++) {
      await prisma.masterData.upsert({
        where: { type_name: { type: "VEHICLE_MODEL", name: models[i] } },
        update: {},
        create: {
          type: "VEHICLE_MODEL",
          name: models[i],
          parentId: make.id,
          displayOrder: i,
        },
      });
    }
  }

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
