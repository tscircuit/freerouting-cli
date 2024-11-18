# freerouting API CLI

A CLI tool for interacting with the freerouting API, maintained by [tscircuit](https://github.com/tscircuit/tscircuit).

```bash
npm install -g freerouting
```

## Initial Setup

Before using the CLI, you need to configure your profile ID. The easiest way is to generate a new one:

```bash
freerouting config:create-profile
```

Alternatively, you can set a specific UUID as your profile ID:

```bash
freerouting config:set-profile <uuid>
```

You can also optionally set a custom API base URL (defaults to https://api.freerouting.app):

```bash
freerouting config:set-api-url <api-url>
```

## Usage

The CLI follows a typical workflow for PCB autorouting:

1. Create a session
2. Create a job within that session
3. Upload your design file
4. Start the routing job
5. Retrieve the output

### Basic Workflow Example

```bash
# Create a new session
freerouting session:create

# Create a new job in the session
freerouting job:create --name "my-board"

# Upload your DSN file
freerouting job:upload --file my-board.dsn

# Start the routing process
freerouting job:start

# Get the routed output (saves to the same filename by default)
freerouting job:output
```

### Available Commands

#### Session Management
- `session:create` - Create a new routing session
- `session:list` - List all your sessions
- `session:get [sessionId]` - Get details of a specific session

#### Job Management
- `job:create` - Create a new routing job
  - Options:
    - `-s, --session-id <sessionId>` - Session ID (uses last session by default)
    - `-n, --name <name>` - Job name (default: "untitled")
    - `-p, --priority <priority>` - Job priority (default: "NORMAL")
- `job:list <sessionId>` - List all jobs in a session
- `job:get <jobId>` - Get details of a specific job
- `job:upload` - Upload a design file
  - Required: `-f, --file <file>` - Path to your DSN file
  - Optional: `-j, --job-id <jobId>` - Job ID (uses last job by default)
- `job:start [jobId]` - Start the routing process
- `job:output [jobId]` - Get the routed output
  - Optional: `-o, --output <file>` - Custom output file path

#### System Commands
- `system:status` - Check the API system status

#### Configuration
- `config:set-profile <profileId>` - Set your profile ID
- `config:set-api-url <apiBaseUrl>` - Set custom API base URL

## Acknowledgements

- [Andras Fuchs](https://github.com/andrasfuchs) is an incredible maintainer and
  none of this would have been possible without his work on the freerouting api.
  THANK YOU ANDRAS!
- [Freerouting](https://github.com/freerouting/freerouting) is the defacto
  open-source pcb routing tool. Thank you to everyone who has contributed!

> We are not affiliated with the freerouting project beyond sponsoring it! If
> the freerouting project wants us to give the npm handle for a more official
> cli just reach out to @seveibar!
