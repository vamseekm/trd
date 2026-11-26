# trd

A real-time market data ingestion, multi-timeframe candle aggregation, and technical indicator computation platform for Indian markets (**NSE** / **NFO**), integrated with the **Zerodha Kite Connect** API.

## Architecture

```mermaid
flowchart LR
    Kite["Zerodha Kite Connect<br/>(WebSocket Ticker & REST)"] -->|Live Ticks| Listener["Tick Listener<br/>(Event::startTickListener)"]
    Listener -->|Publish| Rabbit["RabbitMQ"]
    Rabbit --> Raw["Raw Consumer"]
    Rabbit --> Store["Store Consumer"]
    Rabbit --> Process["Process Consumer"]

    Store --> PG["PostgreSQL<br/>(Sequelize)"]
    Process --> Pipe["Tick → Candle → Down-Res → Indicator<br/>Pipelines"]
    Pipe --> Redis["Redis<br/>(Candle & Indicator Cache)"]
    Redis --> Pump["Write Pump<br/>(Candle::startWritePump)"]
    Pump --> PG

    Caddy["Caddy Gateway<br/>(trd.local)"] --> API["Express API Server<br/>(:3100)"]
    Caddy --> Client["React Client<br/>(:3200)"]
    Cron["Cron Tasks<br/>(Maintenance & Auto-Login)"] --> API
```

## Features

- **Broker Integration (Zerodha Kite Connect)**: OAuth login/redirect flow, live WebSocket tick streaming (full quote mode with auto-reconnect), instrument sync, LTP snapshots, and historical candle fetching.
- **Event-Driven Tick Processing**: Decoupled RabbitMQ consumers for raw tick ingestion, tick persistence/backup, and real-time candle generation.
- **Multi-Timeframe Candle Aggregation**: Builds `1m` (`M01`) candles from incoming ticks and down-samples into `5m` (`M05`), `10m` (`M10`), `15m` (`M15`), `30m` (`M30`), `60m` (`M60`), and `1d` (`D01`) candles, with a Redis-backed write pump persisting candles to PostgreSQL.
- **Technical Indicators**: Streaming indicator pipeline supporting **Moving Averages (MA)**, **VWAP**, and **MACD**, cached in Redis.
- **Scheduled Tasks & Auto-Login**: Daily maintenance/sync cron (`node-cron`) for tick backup, instrument download, and candle loading, plus optional Puppeteer-based auto-login for refreshing Kite access tokens.
- **Process Orchestration**: PM2 (`ecosystem.config.js`), Caddy reverse proxy (`trd.local`), Docker Compose (RabbitMQ), and a React + Material-UI client scaffold.

## Tech Stack

- **Backend**: TypeScript, Node.js, Express, Sequelize (`sequelize-typescript`), KiteConnect
- **Data & Messaging**: PostgreSQL, Redis, RabbitMQ (`amqplib`)
- **Frontend**: React, TypeScript, Material-UI, Webpack
- **Tooling & Ops**: PM2, Caddy, Docker Compose, Jest (`ts-jest`), ESLint, Prettier, Commitlint

## Project Structure

```text
.
├── bin/                   # Helper scripts (Caddy gateway, Redis, Redis Commander)
├── client/                # React + Material-UI web client
├── conf/                  # Caddyfile and Redis configuration
├── server/
│   ├── config/            # Environment configs (default.json, dev.json, docker.json)
│   └── src/
│       ├── api/           # Express server and middleware
│       ├── broker/        # Zerodha Kite Connect service & routes
│       ├── candle/        # Candle service & DB write pump
│       ├── cli/           # Dynamic CLI runner (--Module::action)
│       ├── event/         # RabbitMQ producers/consumers & event bridge
│       ├── exchange/      # Exchange trading-hours logic (NSE/NFO)
│       ├── indicator/     # Indicator calculations (MA, VWAP, MACD) & tests
│       ├── infrastructure/# Config, Winston logger, RabbitMQ, Redis clients
│       ├── instrument/    # Instrument sync, tracking & GraphQL resolver
│       ├── persistance/   # Sequelize models & PostgreSQL/Redis repositories
│       ├── pipeline/      # Tick, down-resolution & indicator pipelines
│       ├── task/          # Cron jobs & Puppeteer auto-login
│       ├── tick/          # Tick backup & cleanup service
│       ├── types/         # Shared TypeScript interfaces, enums & AJV validators
│       └── util/          # Candle, tick, time & math utilities
├── docker-compose.yml     # Infrastructure services (RabbitMQ, etc.)
├── ecosystem.config.js    # PM2 process definitions
└── Tiltfile               # Tilt local dev setup
```

## Configuration

### 1. Broker API Credentials

Set your Zerodha Kite Connect credentials in `server/config/default.json`:

```json
{
    "KITE_API_KEY": "<your-kite-api-key>",
    "KITE_API_SECRET": "<your-kite-api-secret>",
    "HTTP_API_SERVER_PORT": 3100
}
```

> Do not commit real API keys or secrets.

### 2. Database, Redis & RabbitMQ

Development connection settings live in `server/config/dev.json` (used when `NODE_ENV=dev`) and Docker settings in `server/config/docker.json`:

- **PostgreSQL**: `postgres://postgres:postgres@localhost:5432/postgres`
- **Redis**: `127.0.0.1:6379`
- **RabbitMQ**: `amqp://localhost:5672`
- **Tick backup path**: `~/data/ticks`

### 3. Optional Auto-Login Config

If you use `Task::autoLoginCron`, create a config file outside the repo at `../../config/kite.config.json` (relative to `server/`, i.e. one level above the repository root):

```json
{
    "user": "<kite-user-id>",
    "password": "<kite-password>",
    "pin": "<kite-pin>"
}
```

## Getting Started

### Prerequisites

- Node.js (v14+) & Yarn / npm
- PostgreSQL
- Redis (`redis-server`)
- RabbitMQ (can be started via Docker Compose)
- Caddy & PM2 (for full multi-service local setup)

### 1. Start Infrastructure

```bash
# Start RabbitMQ via Docker Compose
docker-compose up -d

# Ensure PostgreSQL and Redis are running locally
```

### 2. Install & Build

```bash
# Server
cd server
npm install
npm run build

# Client
cd ../client
yarn install
```

### 3. Sync Database Schema

```bash
cd server
./run.sh --Database::syncSchema --force-exit
```

### 4. Run Services

Run all services together with PM2:

```bash
pm2 start ecosystem.config.js
```

Or run individual services directly via the server CLI:

```bash
cd server

# List all available CLI entry points
./run.sh --help

# Start the HTTP API server
./run.sh --API::startServer

# Start the live tick listener
./run.sh --Event::startTickListener

# Start tick/candle/indicator consumers and DB write pump
./run.sh --Event::startTickRawConsumer \
         --Event::startTickStoreConsumer \
         --Event::startTickProcessConsumer \
         --Candle::startWritePump

# Start scheduled maintenance / auto-login crons
./run.sh --Task::cron
./run.sh --Task::autoLoginCron
```

For watch-mode TypeScript compilation + reload on a single action:

```bash
cd server
./dev.sh --API::startServer
```

## API Endpoints

Exposed by the Express server on port `3100` (proxied behind `https://trd.local` when Caddy is running):

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Health check (`ok`) |
| `GET` | `/api/open/broker/login` | Redirects to the Kite Connect login URL |
| `GET` | `/api/open/broker/redirect` | Exchanges `request_token` for an access token |
| `GET` | `/api/broker/profile` | Fetches the authenticated Kite user profile |
| `GET` | `/api/task/sync` | Triggers the scheduled sync task |

## Development & Testing

From the `server/` directory:

```bash
npm run build         # Compile TypeScript to dist/
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix lint issues
npm run syntax-check  # Type-check without emitting files
npm run test          # Run Jest unit tests
npm run coverage      # Run Jest with code coverage
npm run check         # Run lint, type-check, and tests together
```

## License

ISC
