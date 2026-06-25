import { runVerifyCli } from "@harborclient/sdk/signing";

/**
 * Delegates to the sdk verification CLI.
 */
const exitCode = await runVerifyCli(process.argv);
process.exit(exitCode);
