#!/usr/bin/env npx tsx
/**
 * CLI for Hedera Guardian sync
 *
 * Usage: npx tsx src/cli.ts sync hedera [--dry-run]
 */

import "dotenv/config";
import { runSync } from "./core/runner";
import { createHederaConnector } from "./connectors/hedera/index";

function parseArgs(): {
  command: string;
  connectorId: string;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const command = args[0] || "sync";
  const connectorId = args[1] || "hedera";

  return { command, connectorId, dryRun };
}

async function main(): Promise<void> {
  const { command, connectorId, dryRun } = parseArgs();

  if (command !== "sync" || connectorId !== "hedera") {
    console.error("Usage: npx tsx src/cli.ts sync hedera [--dry-run]");
    process.exit(1);
  }

  const protocolId = process.env.HEDERA_GUARDIAN_PROTOCOL_ID;
  if (!protocolId) {
    console.error(
      "Missing HEDERA_GUARDIAN_PROTOCOL_ID env var.\n" +
        "Create the 'Hedera Guardian' protocol in the admin first, then set its UUID here."
    );
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       Hedera Guardian → Regen Atlas Sync                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  if (dryRun) {
    console.log("\n🔶 DRY RUN MODE - No database changes will be made\n");
  }

  try {
    const connector = createHederaConnector(protocolId);
    const stats = await runSync({
      connector,
      dryRun,
    });

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                       Sync Complete                          ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`  ✅ Synced: ${stats.successCount}`);
    console.log(`  ⏭️  Skipped: ${stats.skipCount}`);
    console.log(`  ❌ Errors: ${stats.errorCount}`);

    if (dryRun) {
      console.log("\n🔶 This was a dry run. Run without --dry-run to apply changes.");
    }
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

main();
