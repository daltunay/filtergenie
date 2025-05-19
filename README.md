# FilterGenie 🧞‍♂️

<!-- Project info badges -->
<div align="center">

[![License: CC BY-NC 4.0](https://img.shields.io/badge/license-CC--BY--NC%204.0-lightgrey?logo=creativecommons)](https://github.com/daltunay/filtergenie/blob/master/LICENSE)
[![Build Status](https://img.shields.io/github/check-runs/daltunay/filtergenie/master)](https://github.com/daltunay/filtergenie/actions/workflows/ci.yml)
[![Last Commit](https://img.shields.io/github/last-commit/daltunay/filtergenie)](https://github.com/daltunay/filtergenie/commits/master/?author=daltunay)
[![Deployment Status](https://img.shields.io/badge/deployment-success-brightgreen?logo=github)](https://github.com/daltunay/filtergenie/deployments)
[![Render Status](https://img.shields.io/badge/render-live-brightgreen?logo=render)](https://filtergenie-api.onrender.com/)

</div>

<!-- Tech stack badges -->
<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-009485.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Pydantic v2](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/pydantic/pydantic/main/docs/badge/v2.json)](https://docs.pydantic.dev/latest/contributing/#badges)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-306998?logo=python&logoColor=white)](https://www.sqlalchemy.org/)
[![BeautifulSoup](https://shields.io/badge/BeautifulSoup-4-green)](https://www.crummy.com/software/BeautifulSoup/)
[![Meta](https://img.shields.io/badge/Llama4-Groq-blue?logo=meta)](https://console.groq.com/docs/model/llama-4-scout-17b-16e-instruct)

</div>

<!-- Social badge -->
<div align="center">

[![LinkedIn](https://custom-icon-badges.demolab.com/badge/LinkedIn-0A66C2?logo=linkedin-white&logoColor=fff)](https://www.linkedin.com/in/daltunay/)
[![GitHub](https://custom-icon-badges.demolab.com/badge/GitHub-181717?logo=github&logoColor=fff)](https://github.com/daltunay)

</div>

<hr>

<p align="center">
  <img src="extension/assets/logo.png" alt="FilterGenie Logo" width="512" height="512">
</p>
FilterGenie is an AI-powered browser extension and API that filters e-commerce search results using natural language and vision-language models.

## Features

- Filter listings with natural language (e.g., "no scratches", "original packaging")
- Analyzes item images and descriptions
- Works with multiple e-commerce sites
- Use as browser extension or API (cloud/local)

## Supported Websites

| Name       | Domains                                           | Status  |
| ---------- | ------------------------------------------------- | ------- |
| leboncoin  | leboncoin.fr                                      | ✅ DONE |
| vinted     | vinted.fr, vinted.com, vinted.it, vinted.de, ...  | ✅ DONE |
| ebay       | ebay.fr, ebay.com, ebay.it, ebay.de, ...          | 🛠️ WIP  |
| amazon     | amazon.fr, amazon.com, amazon.it, amazon.de, ...  | 🛠️ WIP  |
| aliexpress | aliexpress.fr, aliexpress.com, aliexpress.it, ... | 📝 TODO |
| doctolib   | doctolib.fr                                       | 📝 TODO |
| seloger    | seloger.fr                                        | 📝 TODO |

<details>
<summary>Architecture</summary>

```mermaid
graph TD
    subgraph Client
        User["User<br>enters filters"]
        BrowserExt["Browser + Extension"]
        Website["E-commerce Website<br>(leboncoin, vinted, etc.)"]
        User -->|uses| BrowserExt
        BrowserExt <-->|interacts with| Website
    end

    subgraph "API Layer"
        API["API Service<br>(FastAPI)"]
    end

    subgraph Backend
        Scraper["Scraper<br>(BeautifulSoup)"]
        Analyzer["Analyzer"]
        VLM["Vision Language Model<br>(Remote or Local)"]

        Analyzer <-->|"process/analysis"| VLM
        Scraper -->|"structured data"| Analyzer
    end

    subgraph Storage
        DB["Database<br>(SQLite)"]
    end

    BrowserExt -->|"requests"| API
    API -->|"request scraping"| Scraper
    API -->|"request analysis"| Analyzer
    Analyzer <-->|"check/update cache"| DB
    Scraper <-->|"check/update cache"| DB
```

</details>

## Quick Start

### Browser Extension

Use with a **local API** (`http://localhost:8000`) or the **hosted API** (`https://filtergenie-api.onrender.com`).

To install:

1. Download the latest `extension.zip` from the [releases page](https://github.com/daltunay/filtergenie/releases).
2. Unzip the file to extract the `extension` folder.
3. In your browser, open the extensions page (e.g. `chrome://extensions` for Chrome)
4. Enable "Developer mode" (top right corner)
5. Click "Load unpacked" and select the extracted `extension` folder
6. Choose API mode (Local/Remote) and enter your API key if needed.

### Local API

#### Requirements

- [uv](https://docs.astral.sh/uv/) (Python package manager):
  `curl -LsSf https://astral.sh/uv/install.sh | sh`

#### Setup

```bash
uv venv .venv
source .venv/bin/activate
uv sync
```

#### Configuration

Set your Groq API key as an environment variable before running the API:

```bash
export GROQ_API_KEY="your_groq_api_key"
```

You can get a Groq API key at: [console.groq.com](https://console.groq.com/keys)

Optionally, set the model:

```bash
export GROQ_MODEL_NAME="meta-llama/llama-4-scout-17b-16e-instruct"  # default
```

You can also use a `.env` file in the project root:

```env
GROQ_API_KEY="your_groq_api_key"
GROQ_MODEL_NAME="meta-llama/llama-4-scout-17b-16e-instruct"
```

#### Run the API

```bash
fastapi run backend/app.py
```

Or with Docker:

```bash
docker build -t filtergenie .
docker run --rm \
  -e GROQ_API_KEY="your_groq_api_key" \
  -e GROQ_MODEL_NAME="meta-llama/llama-4-scout-17b-16e-instruct" \
  -p 8000:8000 \
  -v ./data:/app/data \
  filtergenie
```

> **Note:** Mount the `data` folder to persist the SQLite database outside the container.
