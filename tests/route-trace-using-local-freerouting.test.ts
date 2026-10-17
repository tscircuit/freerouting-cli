import { test, expect } from "bun:test"
import {
  routeUsingLocalFreerouting,
  applyTraceThicknessToDsn,
  prepareDsnForRouting,
} from "../lib/route-using-local-freerouting"
import {
  parseDsnToDsnJson,
  type DsnPcb,
  type DsnSession,
  convertDsnSessionToCircuitJson,
} from "dsn-converter"

test("should apply trace thickness requirements to DSN and Circuit JSON inputs", async () => {
  const rawDsn = await Bun.file("tests/assets/test-circuit.dsn").text()
  const updatedDsn = applyTraceThicknessToDsn(rawDsn, 0.3)
  const parsedDsn = parseDsnToDsnJson(updatedDsn) as DsnPcb
  expect(parsedDsn.structure.rule.width).toBe(300)
  expect(parsedDsn.network.classes[0]?.rule.width).toBe(300)

  const circuitJson = await Bun.file(
    "tests/assets/circuit-json-with-route.json",
  ).json()
  const prepared = prepareDsnForRouting({
    circuitJson,
    traceThickness: 0.3,
  })
  const preparedPcb = parseDsnToDsnJson(prepared.dsnString) as DsnPcb
  const customClass = preparedPcb.network.classes.find(
    (c) => c.name === "trace_width_300um",
  )
  expect(customClass).toBeDefined()
  expect(customClass?.rule.width).toBe(300)
})

test("should route a simple circuit and respect trace thickness requirements", async () => {
  const inputPath = "tests/assets/test-circuit.dsn"
  try {
    const rawDsn = await Bun.file(inputPath).text()
    const dsnWithThickness = applyTraceThicknessToDsn(rawDsn, 0.3)

    // Route the circuit with 0.3mm (300um) trace thickness requirement
    const routedDsn = await routeUsingLocalFreerouting({
      inputPath,
      traceThickness: 0.3,
    })
    expect(routedDsn).toBeTruthy()
    const pcbJson = parseDsnToDsnJson(dsnWithThickness) as DsnPcb
    const sessionJson = parseDsnToDsnJson(routedDsn) as DsnSession
    const circuitJson = convertDsnSessionToCircuitJson(pcbJson, sessionJson)
    const traces = circuitJson.length

    expect(traces).toBeGreaterThan(0)

    const pcbTrace = circuitJson.find((el: any) => el.type === "pcb_trace") as
      | { route: Array<{ route_type: string; width?: number }> }
      | undefined
    expect(pcbTrace).toBeDefined()
    const wirePoint = pcbTrace?.route.find((pt) => pt.route_type === "wire")
    expect(wirePoint?.width).toBe(0.3)
  } catch (error) {
    console.error("Routing error:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    throw error
  }
}, 30000)
