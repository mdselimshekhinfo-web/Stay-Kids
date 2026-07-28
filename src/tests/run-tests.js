import { execSync } from 'child_process'

console.log("=== RUNNING STAYKIDS AUTOMATED SECURITY TEST SUITE (VITEST) ===")
try {
  execSync('npx vitest run', { stdio: 'inherit' })
  console.log("======================================================")
  console.log("SUCCESS: ALL SECURITY & VALIDATION TESTS PASSED 100%")
} catch (_err) {
  console.error("======================================================")
  console.error("FAILURE: SOME TESTS FAILED")
  process.exit(1)
}
