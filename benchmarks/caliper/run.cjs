'use strict';

/**
 * Caliper runner.
 *
 * The Caliper 0.6 CLI's yargs@15 command loader does not register its commands
 * under Node 26, so we invoke the same CaliperEngine the CLI's launch manager
 * uses. This is still Hyperledger Caliper: the same engine, connector factory
 * (@hyperledger/caliper-ethereum), workers, rounds and HTML report builder.
 */

const path = require('node:path');
const {
  CaliperEngine,
  CaliperUtils,
  ConfigUtil,
  Constants,
} = require('@hyperledger/caliper-core');

const WORKSPACE = __dirname;
const BENCH_CONFIG = 'benchmarks/benchconfig.yaml';
const NETWORK_CONFIG = 'networks/anvil.json';
const REPORT_PATH = 'results/report.html';

// The manager forks this same file as a Caliper worker using the standard
// `launch worker` arguments. ConfigUtil also reads these environment variables,
// which are inherited by the forked process, so the worker knows the workspace
// and configuration paths without the broken yargs CLI.
process.env.CALIPER_WORKSPACE = WORKSPACE;
process.env.CALIPER_BENCHCONFIG = BENCH_CONFIG;
process.env.CALIPER_NETWORKCONFIG = NETWORK_CONFIG;
process.env.CALIPER_REPORT_PATH = REPORT_PATH;

if (process.argv[2] === 'launch' && process.argv[3] === 'worker') {
  const LaunchWorker = require('@hyperledger/caliper-cli/lib/launch/lib/launchWorker');
  LaunchWorker.handler({})
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[caliper:worker]', error);
      process.exit(1);
    });
  return;
}

ConfigUtil.set(ConfigUtil.keys.Workspace, WORKSPACE);
ConfigUtil.set(ConfigUtil.keys.BenchConfig, BENCH_CONFIG);
ConfigUtil.set(ConfigUtil.keys.NetworkConfig, NETWORK_CONFIG);
ConfigUtil.set(ConfigUtil.keys.Report.Path, REPORT_PATH);

(async () => {
  CaliperUtils.assertConfigurationFilePaths();

  const benchmarkConfigPath = path.join(WORKSPACE, BENCH_CONFIG);
  const networkConfigPath = path.join(WORKSPACE, NETWORK_CONFIG);
  const benchmarkConfig = CaliperUtils.parseYaml(benchmarkConfigPath);
  const networkConfig = CaliperUtils.parseYaml(networkConfigPath);
  const sutType = networkConfig.caliper.blockchain;

  const connectorFactory = CaliperUtils.loadModuleFunction(
    CaliperUtils.getBuiltinConnectorPackageNames(),
    sutType,
    Constants.Factories.Connector,
    require
  );

  const engine = new CaliperEngine(benchmarkConfig, networkConfig, connectorFactory);
  const code = await engine.run();

  if (code !== 0) {
    console.error(`[caliper] Benchmark failed with exit code ${code}`);
    process.exit(1);
  }

  console.log(`[caliper] Report: ${path.relative(WORKSPACE, path.join(WORKSPACE, REPORT_PATH))}`);
  process.exit(0);
})().catch((error) => {
  console.error('[caliper]', error);
  process.exit(1);
});
