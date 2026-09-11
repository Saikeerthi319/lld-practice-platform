import { PrismaClient } from "@prisma/client";
import { RUBRIC_CRITERIA } from "../src/domain/types.js";

const prisma = new PrismaClient();

const problems = [
  {
    slug: "parking-lot",
    title: "Parking Lot System",
    statement: `Design a parking lot that can park cars, motorcycles, and trucks across multiple floors.
Each vehicle type may require a different spot size. Drivers should be able to enter, receive a ticket, park in an available spot, leave, and pay based on duration.
Support queries for available spots by vehicle type.`,
    constraints: [
      "Multiple floors and spot sizes (compact, large, motorcycle)",
      "One vehicle per spot",
      "Entry and exit must update availability atomically from a design perspective",
      "Fee calculation depends on vehicle type and duration",
    ],
    extensionPrompt:
      "How would you add reserved EV charging spots that can only be used by electric vehicles, without rewriting the core parking flow?",
  },
  {
    slug: "elevator",
    title: "Elevator System",
    statement: `Design an elevator control system for a multi-floor building with one or more elevators.
Users can request an elevator from a floor (up/down) and select a destination inside the cabin.
The controller should assign elevators efficiently and handle concurrent requests.`,
    constraints: [
      "At least one elevator; design should not hardcode a single cabin forever",
      "Requests can arrive while elevators are moving",
      "Avoid thrashing (elevator should not reverse needlessly)",
      "Separate cabin movement from request scheduling responsibilities",
    ],
    extensionPrompt:
      "How would you add emergency/fire mode where elevators go to a designated floor and ignore normal requests?",
  },
  {
    slug: "vending-machine",
    title: "Vending Machine",
    statement: `Design a vending machine that holds products in slots, accepts money, dispenses items, and returns change.
Handle sold-out items, insufficient funds, and restocking by an operator.`,
    constraints: [
      "Inventory is finite per product/slot",
      "Support multiple denominations of payment",
      "Dispense only after successful payment validation",
      "Operator restock is a separate flow from customer purchase",
    ],
    extensionPrompt:
      "How would you add card payments and a loyalty discount without turning the purchase flow into a god object?",
  },
  {
    slug: "splitwise",
    title: "Expense Splitter (Splitwise-style)",
    statement: `Design a system where users form groups, add expenses, and split costs equally or by custom shares.
Users should see balances (who owes whom) and be able to settle up.
Keep the design clear about how balances are derived from expenses and settlements.`,
    constraints: [
      "Groups contain multiple users",
      "Expenses have a payer and one or more participants",
      "Support equal split and exact/percentage split",
      "Balances should be computable from the expense/settlement history",
    ],
    extensionPrompt:
      "How would you add multi-currency expenses with a conversion rate at expense time, without breaking existing balance calculations?",
  },
];

async function main() {
  for (const problem of problems) {
    await prisma.problem.upsert({
      where: { slug: problem.slug },
      update: {
        title: problem.title,
        statement: problem.statement,
        constraintsJson: JSON.stringify(problem.constraints),
        extensionPrompt: problem.extensionPrompt,
        rubricJson: JSON.stringify(RUBRIC_CRITERIA),
      },
      create: {
        slug: problem.slug,
        title: problem.title,
        statement: problem.statement,
        constraintsJson: JSON.stringify(problem.constraints),
        extensionPrompt: problem.extensionPrompt,
        rubricJson: JSON.stringify(RUBRIC_CRITERIA),
      },
    });
  }
  console.log(`Seeded ${problems.length} problems.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
