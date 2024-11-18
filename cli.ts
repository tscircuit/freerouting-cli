#!/usr/bin/env node
import { Command } from "commander"
import axios from "redaxios"
import { z } from "zod"
import debug from "debug"
import Conf from 'conf'

const log = debug("freerouting:cli")

const config = new Conf({
  projectName: 'freerouting-api-cli',
  defaults: {
    lastSessionId: '',
    lastJobId: '',
    profileId: ''
  }
})

const API_BASE = "https://api.freerouting.app"

const program = new Command()

program
  .name("freerouting")
  .description("CLI for interacting with the freerouting API")
  .version("0.0.1")

// Common options
const commonOptions = {
  profileId: program.opts().profileId || config.get('profileId') || process.env.FREEROUTING_PROFILE_ID,
  host: program.opts().host || process.env.FREEROUTING_HOST || "tscircuit/0.0.1"
}

const getHeaders = () => ({
  "Freerouting-Profile-ID": commonOptions.profileId,
  "Freerouting-Environment-Host": commonOptions.host
})

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
  .action(async (profileId) => {
    config.set('profileId', profileId)
    console.log(`Profile ID set to: ${profileId}`)
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
  .command("session:get <sessionId>")
  .description("Get session details")
  .action(async (sessionId) => {
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
        session_id: opts.sessionId,
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
  })

// System commands
program
  .command("system:status")
  .description("Get system status")
  .action(async () => {
    const response = await axios.get(`${API_BASE}/v1/system/status`)
    console.log(response.data)
  })

program.parse()
