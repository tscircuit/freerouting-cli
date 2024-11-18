#!/usr/bin/env node
import { Command } from "commander"
import axios from "redaxios"
import { z } from "zod"
import debug from "debug"
import Conf from 'conf'

const handleApiError = (error: any) => {
  console.error("API Error:")
  console.log(error)
  if (error.data) {
    // The request was made and the server responded with a status code
    console.error(`Status: ${error.status}`)
    console.error("Response data:", error.data)
  } else if (error.request) {
    // The request was made but no response was received
    console.error("No response received from server")
    console.error(error.request)
  } else {
    // Something happened in setting up the request
    console.error("Error:", error.message)
  }
  process.exit(1)
}

const log = debug("freerouting:cli")

const config = new Conf({
  projectName: 'freerouting-api-cli',
  defaults: {
    lastSessionId: '',
    lastJobId: '',
    profileId: '',
    apiBaseUrl: "https://api.freerouting.app"
  }
})

const program = new Command()

program
  .name("freerouting")
  .description("CLI for interacting with the freerouting API")
  .version("0.0.1")

// Common options
const commonOptions = {
  profileId: program.opts().profileId || config.get('profileId') || process.env.FREEROUTING_PROFILE_ID,
  host: program.opts().host || process.env.FREEROUTING_HOST || "tscircuit/0.0.1",
  apiBaseUrl: program.opts().apiBaseUrl || process.env.FREEROUTING_API_BASE_URL || config.get('apiBaseUrl')
}

const API_BASE = commonOptions.apiBaseUrl

const getHeaders = (needsAuth = true) => {
  if (!commonOptions.profileId && needsAuth) {
    console.error("Profile ID is not set, use --profile-id, do \"freerouting config:set-profile\" or set FREEROUTING_PROFILE_ID environment variable")
    process.exit(1)
  }
  return {
    "Freerouting-Profile-ID": commonOptions.profileId,
    "Freerouting-Environment-Host": commonOptions.host
  }
}

// Session commands
program
  .command("session:create")
  .description("Create a new routing session")
  .action(async () => {
    const response = await axios.post(`${API_BASE}/v1/sessions/create`, "", {
      headers: getHeaders()
    })
    config.set('lastSessionId', response.data.id)
    console.log(response.data)
  })

// Config commands
program
  .command("config:set-profile")
  .description("Set the Freerouting Profile ID")
  .argument("<profileId>", "Profile ID to set")
  .action(async (profileId: string) => {
    config.set('profileId', profileId)
    console.log(`Profile ID set to: ${profileId}`)
  })

program
  .command("config:set-api-url")
  .description("Set the Freerouting API Base URL")
  .argument("<apiBaseUrl>", "API Base URL to set")
  .action(async (apiBaseUrl: string) => {
    config.set('apiBaseUrl', apiBaseUrl)
    console.log(`API Base URL set to: ${apiBaseUrl}`)
  })

program
  .command("session:list")
  .description("List all sessions")
  .action(async () => {
    const response = await axios.get(`${API_BASE}/v1/sessions/list`, {
      headers: getHeaders()
    })
    console.log(response.data)
  })

program
  .command("session:get [sessionId]")
  .description("Get session details")
  .action(async (sessionId) => {
    sessionId ??= config.get('lastSessionId')
    if (!sessionId) {
      console.error("No session ID provided and no last session ID found in config")
      return
    }
    const response = await axios.get(`${API_BASE}/v1/sessions/${sessionId}`, {
      headers: getHeaders()
    })
    console.log(response.data)
  })

// Job commands
program
  .command("job:create")
  .description("Create a new routing job")
  .option("-s, --session-id <sessionId>", "Session ID", config.get('lastSessionId'))
  .option("-n, --name <name>", "Job name", "untitled")
  .option("-p, --priority <priority>", "Job priority", "NORMAL")
  .action(async (opts) => {
    const response = await axios.post(
      `${API_BASE}/v1/jobs/enqueue`,
      {
        session_id: opts.sessionId ?? config.get('lastSessionId'),
        name: opts.name,
        priority: opts.priority
      },
      { headers: getHeaders() }
    )
    console.log(response.data)
  })

program
  .command("job:list <sessionId>")
  .description("List jobs for a session")
  .action(async (sessionId) => {
    const response = await axios.get(`${API_BASE}/v1/jobs/list/${sessionId}`, {
      headers: getHeaders()
    })
    console.log(response.data)
  })

program
  .command("job:get <jobId>")
  .description("Get job details")
  .action(async (jobId) => {
    const response = await axios.get(`${API_BASE}/v1/jobs/${jobId}`, {
      headers: getHeaders()
    })
    console.log(response.data)
  })

program
  .command("job:upload")
  .description("Upload design file for a job")
  .option("-j, --job-id <jobId>", "Job ID", config.get('lastJobId'))
  .requiredOption("-f, --file <file>", "Design file path")
  .action(async (opts) => {
    const fileData = await Bun.file(opts.file).text()
    const response = await axios.post(
      `${API_BASE}/v1/jobs/${opts.jobId}/input`,
      {
        filename: opts.file,
        data: Buffer.from(fileData).toString("base64")
      },
      { headers: getHeaders() }
    )
    console.log(response.data)
  })

program
  .command("job:start <jobId>")
  .description("Start a routing job")
  .action(async (jobId) => {
    const response = await axios.put(
      `${API_BASE}/v1/jobs/${jobId}/start`,
      "",
      { headers: getHeaders() }
    )
    console.log(response.data)
  })

program
  .command("job:output <jobId>")
  .description("Get job output")
  .option("-o, --output <file>", "Output file path")
  .action(async (jobId, opts) => {
    try {
      const response = await axios.get(`${API_BASE}/v1/jobs/${jobId}/output`, {
        headers: getHeaders()
      })
      
      const outputPath = opts.output || response.data.filename
      if (outputPath) {
        // Decode base64 and write to file
        const decodedData = Buffer.from(response.data.data, 'base64').toString()
        await Bun.write(outputPath, decodedData)
        console.log(`Output written to ${outputPath}`)
      } else {
        console.log(response.data)
      }
    } catch (error) {
      handleApiError(error)
    }
  })

// System commands
program
  .command("system:status")
  .description("Get system status")
  .action(async () => {
    const response = await axios.get(`${API_BASE}/v1/system/status`)
    console.log(response.data)
  })

program.parse(process.argv)
