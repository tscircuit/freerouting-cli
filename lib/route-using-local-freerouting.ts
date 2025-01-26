import axios from "redaxios"
import { readFileSync, existsSync } from "node:fs"
import debug from "debug"
import { FreeroutingDockerManager } from "./freerouting-docker-manager"

const log = debug("freerouting:route-using-local-freerouting")

const handleApiError = (error: any) => {
  console.error("API Error:")
  if (error.data) {
    console.error(`Status: ${error.status}`)
    console.log("Response data:", error.data)
  } else if (error.request) {
    console.error("No response received from server")
    console.error(error.request)
  } else {
    console.error("Error:", error.message)
  }
  throw error
}

interface RouteOptions {
  inputPath: string
  port?: number
}

export async function routeUsingLocalFreerouting({
  inputPath,
  port = 37864,
}: RouteOptions): Promise<string> {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`)
  }

  const freeroutingDockerManager = new FreeroutingDockerManager(port)
  const API_BASE = `http://localhost:${port}`
  const headers = {
    "Freerouting-Profile-ID": "e9866fac-e7ae-4f9f-a616-24ec577aa461",
    "Freerouting-Environment-Host": "tscircuit/0.0.1",
  }

  try {
    // Start container using FreeroutingDockerManager
    await freeroutingDockerManager.startContainer()

    // Wait for server to be ready and verify it's responding
    let serverReady = false
    let attempts = 0
    const maxStartAttempts = 10

    while (!serverReady && attempts < maxStartAttempts) {
      try {
        await axios.get(`${API_BASE}/v1/system/status`)
        serverReady = true
      } catch (error) {
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (!serverReady) {
      throw new Error("Server failed to start after multiple attempts")
    }

    // Create session
    log("Creating routing session")
    const sessionResponse = await axios
      .post(`${API_BASE}/v1/sessions/create`, "", { headers })
      .catch(handleApiError)
    const sessionId = sessionResponse.data.id
    log("Session created with ID: %s", sessionId)

    // Create job
    log("Creating routing job")
    const jobResponse = await axios
      .post(
        `${API_BASE}/v1/jobs/enqueue`,
        {
          session_id: sessionId,
          name: "circuit-routing",
          priority: "NORMAL",
        },
        { headers },
      )
      .catch(handleApiError)
    const jobId = jobResponse.data.id
    log("Job created with ID: %s", jobId)

    // Upload DSN file
    log("Uploading DSN file: %s", inputPath)
    const fileData = readFileSync(inputPath)
    await axios.post(
      `${API_BASE}/v1/jobs/${jobId}/input`,
      {
        filename: inputPath,
        data: Buffer.from(fileData).toString("base64"),
      },
      { headers },
    )

    // Start job
    log("Starting routing job...")
    await axios.put(`${API_BASE}/v1/jobs/${jobId}/start`, "", { headers })

    // Wait for completion
    let isComplete = false
    attempts = 0
    const maxAttempts = 20

    while (!isComplete && attempts < maxAttempts) {
      const jobStatus = await axios.get(`${API_BASE}/v1/jobs/${jobId}`, {
        headers,
      })

      log("Job status: %s", jobStatus.data?.state)
      if (jobStatus.data?.state === "COMPLETED") {
        isComplete = true
        break
      } else if (jobStatus.data?.state === "FAILED") {
        throw new Error(`Job failed with state: ${jobStatus.data.state}`)
      } else if (jobStatus.data?.state === "RUNNING") {
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      attempts++
    }

    if (!isComplete) {
      throw new Error("Job timed out waiting for completion")
    }

    // Get output
    const outputResponse = await axios.get(
      `${API_BASE}/v1/jobs/${jobId}/output`,
      { headers },
    )

    if (!outputResponse.data?.data) {
      throw new Error("No output received from job")
    }
    return Buffer.from(outputResponse.data.data, "base64").toString()
  } catch (error) {
    // Re-throw the error after cleanup
    throw error
  } finally {
    // Always attempt to stop the container, even if an error occurred
    try {
      await freeroutingDockerManager.stopContainer()
    } catch (cleanupError) {
      // Log cleanup errors but don't throw them
      log("Error during container cleanup:", cleanupError)
    }
  }
}
