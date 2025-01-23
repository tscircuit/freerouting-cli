import { test, expect } from "bun:test"
import { routeUsingLocalFreerouting } from "../lib/route-using-local-freerouting"
import {
  mergeDsnSessionIntoDsnPcb,
  parseDsnToDsnJson,
  type DsnPcb,
  type DsnSession,
  convertDsnSessionToCircuitJson,
  stringifyDsnJson,
} from "dsn-converter"

test("should route a simple circuit", async () => {
  const inputPath = "tests/tests-data/test-circuit.dsn"
  try {
    // Route the circuit
    const routedDsn = await routeUsingLocalFreerouting({ inputPath })
    expect(routedDsn).toBeTruthy()
    const routedDsnTemp = await Bun.file(inputPath).text()
    const pcbJson = parseDsnToDsnJson(routedDsnTemp) as DsnPcb
    const sessionJson = parseDsnToDsnJson(routedDsn) as DsnSession
    const circuitJson = convertDsnSessionToCircuitJson(pcbJson, sessionJson)
    const traces = circuitJson.length

    expect(traces).toBeGreaterThan(0)
  } catch (error) {
    console.error("Routing error:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    throw error
  }
}, 30000)
