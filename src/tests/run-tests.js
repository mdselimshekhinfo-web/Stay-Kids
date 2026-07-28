import { runSecurityTestSuite } from './security-suite.test.js'

async function main() {
  console.log("=== RUNNING STAYKIDS AUTOMATED SECURITY TEST SUITE ===")
  const { passed, results } = await runSecurityTestSuite()
  results.forEach((r) => console.log(r))
  console.log("======================================================")
  if (passed) {
    console.log("SUCCESS: ALL SECURITY & VALIDATION TESTS PASSED 100%")
  } else {
    console.error("FAILURE: SOME TESTS FAILED")
    process.exit(1)
  }
}

main()
