# NEOX

A movie search application with link resolver integration for resolving protected download links.

## Features

- Search movies from extrem-down.diy
- Extract download and streaming links
- link resolver integration for resolving protected-link.example URLs
- User-triggered link resolution (no automatic processing)

## Setup

### Prerequisites

- Docker and Docker Compose
- Provider subscription (for link resolution)

### Configuration

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Get your resolver API key:
   - Go to your provider's dashboard
   - Generate a new API key
   - Copy the key to your `.env` file:
     ```
     RESOLVER_API_KEY=your_actual_api_key_here
     ```

### Running the Application

1. Start the application:
   ```bash
   docker-compose up -d
   ```

2. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Link resolver integration

The application integrates with the provider to resolve protected download links:

- **protected-link.example URLs** are automatically detected
- Users must click "Résoudre le lien" button to resolve links
- Resolved links are displayed in green
- Original links remain accessible if resolution fails

### Supported Link Types

- Direct download links (displayed as-is)
- protected-link.example URLs (requires resolution)
- Streaming links (some may require link resolver)

## Development

The application consists of:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express
- **Scraping**: Cheerio for HTML parsing
- **API Integration**: the provider API v4
