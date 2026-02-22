# Autommensor WhatsApp Bot

An AI-powered WhatsApp bot with a management dashboard for bulk messaging, template management, and AI training.

## 🚀 Key Features

- **AI Integration**: Powered by Google Gemini (Flash-latest) for intelligent responses based on your business context.
- **Management Dashboard**: A sleek web interface to manage your bot and messaging.
- **Bulk Messaging**: Send personalized messages to multiple contacts via CSV upload.
- **Template Management**: Create and store message templates with support for images.
- **Anti-Ban Features**: Built-in delays and typing simulations to mimic human behavior.
- **Bot Commands**:
  - `!ping`: Check if the bot is alive.
  - `!help`: Show available commands.
  - `!sticker`: Convert images/videos into stickers.

## 📋 Prerequisites

- **Node.js**: Installed (v16.x or higher recommended)
- **WhatsApp Account**: A phone with WhatsApp installed to scan the QR code.
- **Google Gemini API Key**: Obtain one from [Google AI Studio](https://ai.google.dev/).

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "whatsapp bot"
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Setup Environment Variables**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   DASHBOARD_USERNAME=admin
   DASHBOARD_PASSWORD=your_secure_password
   SESSION_SECRET=your_secret_key
   ```

## 🚀 Usage

1. **Start the application**:
   ```bash
   npm start
   ```

2. **Authenticate WhatsApp**:
   - A QR code will appear in your terminal.
   - Open WhatsApp on your phone -> Linked Devices -> Link a Device.
   - Scan the terminal QR code.

3. **Access the Dashboard**:
   - Open your browser and go to: `http://localhost:3000`
   - Log in with the credentials set in your `.env` file.

## 🎯 Dashboard Overview

### 1. Dashboard
Monitor your WhatsApp connection status and view your QR code if not authenticated.

### 2. Templates
Create and manage message templates. Use `{{name}}` or other column names as placeholders for bulk messaging.

### 3. Bulk Message
Upload a CSV file containing contact information and select a template to send messages at scale.

### 4. AI Training
Update your business information (About Us, Products, FAQ, etc.) to train the AI's response logic.

## 📁 Project Structure

- `index.js`: Main entry point for the WhatsApp client and server initialization.
- `server.js`: Express server handling the management dashboard API and frontend.
- `ai.js`: AI logic and integration with Google Gemini.
- `public/`: Frontend assets (HTML, CSS, JS).
- `templates.json`: Storage for message templates.
- `business_info.json`: Storage for AI training context.

## ⚠️ Security

- Ensure your `.env` file is never committed to version control (`.gitignore` handles this by default).
- For production, use a strong `SESSION_SECRET` and `DASHBOARD_PASSWORD`.

## 📄 License

ISC License

## 🚀 Railway Deployment Settings

For 24/7 production deployment, this bot is optimized for [Railway.app](https://railway.app/).

### 1. Build and Deployment Configuration
The repository contains a `railway.json` file which automatically configures the builder.
- **Provider**: Nixpacks (Default)
- **Start Command**: `npm start` (Automatically detected)
- **Healthcheck Path**: `/` (Timeout: 300s)
- **Restart Policy**: On Failure

*Note: Ensure the `NIXPACKS_PKGS` environment variable is set so Google Chrome installs correctly.*

### 2. Environment Variables (Variables Tab)
You must configure the following variables in your Railway Dashboard:

**Core Operations (Puppeteer & Chrome)**
- `NIXPACKS_PKGS` = `nss, freetype, harfbuzz, ca-certificates, alsa-lib, pango, atk, cairo, gdk-pixbuf, glib, gtk3, libXcomposite, libXcursor, libXdamage, libXext, libXfixes, libXi, libXrandr, libXrender, libXtst, dbus, expat, libgcc, libstdc++, nss-mdns, cups`

**Permanent Session & Database**
- `MONGODB_URI` = `<Your MongoDB Connection String>`

**AI Integration (NVIDIA NIM)**
- `NVIDIA_API_KEY` = `<Your NVIDIA API Key>`
- `NVIDIA_MODEL_NAME` = `nvidia/nemotron-3-nano-30b-a3b`
- `NVIDIA_BASE_URL` = `https://integrate.api.nvidia.com/v1`

**Dashboard Admin & Media**
- `DASHBOARD_USERNAME` = `admin`
- `DASHBOARD_PASSWORD` = `<Your Password>`
- `SESSION_SECRET` = `<Your Secure Random String>`
- `CLOUDINARY_URL` = `<Your Cloudinary URL>`
- `NODE_ENV` = `production`

### 3. Networking
- Railway automatically detects port `8080` (or `3000` locally).
- Your public domain will look like: `wbot.up.railway.app`
