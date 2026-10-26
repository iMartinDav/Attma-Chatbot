<div align="center">

# 🧬 Attma Chatbot 🧬

<img src="public/images/logo.png" alt="Attma Chatbot Logo" width="250" />

### The First AI Bioinformatics Assistant

[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

<p align="center">
<strong>AttmaChatbot is a state-of-the-art AI assistant specifically designed for bioinformatics professionals, researchers, and students.</strong><br> 
Developed by Attma TechBio, Inc., this intelligent platform brings specialized knowledge and powerful tools to the bioinformatics community.
</p>

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Deployment](#-deployment)
- [Usage](#-usage)
- [License and Copyright](#-license-and-copyright)
- [Contact](#-contact)

---

## 🧬 Key Features

<table>
<tr>
<td width="50%">

### 🔬 Knowledge & Intelligence

- **Specialized Bioinformatics Knowledge Base**
- **Advanced Thinking Process** via DeepSeek models
- **Code Generation and Analysis** for Python and R
- **Scientific PDF Generation**
- **AI Image Generation** with DALL-E

</td>
<td width="50%">

### 🛠️ Platform Capabilities

- **Multilingual Support** (7 languages)
- **Secure Authentication**
- **Interactive Chat Interface**
- **Customizable Subscription Plans**
- **Cross-platform Accessibility**
- **Transactional Email System** (welcome, password reset)

</td>
</tr>
</table>

---

## 🚀 Technology Stack

<table>
<tr>
<td width="33%">

### Frontend

- **Next.js App Router**
- **React Server Components**
- **shadcn/ui + Tailwind CSS**
- **Radix UI** primitives
- **Responsive Design**

</td>
<td width="33%">

### AI Integration

- **AI SDK**
- **OpenAI, Anthropic, Cohere**
- **DALL-E** for visualizations
- **DeepSeek** for enhanced reasoning
- **Structured output generation**

</td>
<td width="33%">

### Backend

- **Vercel Infrastructure**
- **Neon Postgres Database**
- **Vercel Blob Storage**
- **NextAuth.js Authentication**
- **i18n Internationalization**
- **Resend Email API** integration

</td>
</tr>
</table>

---

## 📋 Prerequisites

- **Node.js** (v22 or newer)
- **Bun** package manager
- **API keys** for AI service integrations

---

## 💻 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Genie-chatbot.git

# Navigate to the project directory
cd Attma -chatbot

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys and configuration

# Run development server
bun dev

# Run email preview server (available at http://localhost:3001/preview)
bun email:dev
```

After running the development server, open [http://localhost:3000](http://localhost:3000) in your browser.
For email template previews, open [http://localhost:3001/preview](http://localhost:3001/preview) in your browser.

---

## 🔧 Configuration

### Setting Up Environment Variables with Vercel CLI

The easiest way to configure your environment is with Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Link local instance with Vercel and GitHub accounts (creates .vercel directory)
vercel link

# Download your environment variables
vercel env pull
```

This will create a `.env.local` file with all necessary environment variables configured in your Vercel project.

> **Important:** After pulling the environment variables, make sure to change `NEXTAUTH_URL` to "http://localhost:3000" in your `.env.local` file for local development.

### Manual Environment Setup

Alternatively, you can manually create a `.env.local` file in the root directory with the following environment variables:

```
# API Configurations
OPENAI_API_KEY=your_api_key_here
DATABASE_URL=your_database_connection_string

# Authentication Settings
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# Other Configurations
DEFAULT_LOCALE=en
SUBSCRIPTION_ENDPOINT=https://your-payment-processor.com/endpoint
```

---

## 🌐 Deployment

This application can be deployed to various platforms such as Vercel (preferred), Netlify, or any host supporting Node.js applications:

```bash
# Build for production
bun run build

# Start production server
bun start
```

---

## 🔍 Usage

After logging in, users can:

1. Start a new chat conversation
2. Ask bioinformatics-specific questions
3. Request code snippets for data analysis
4. Access documentation and references
5. Save and export conversations

---

## 📄 License and Copyright

Copyright 2025 Attma TechBio, Inc.  
Author: Martin DAVILA <martin@genietechbio.com>

Licensed under the Apache License, Version 2.0.
All rights reserved.

---

## 📞 Contact

For support, partnership opportunities, or more information:

- Email: support@genietechbio.com
- Website: [www.genietechbio.com](https://www.Attma techbio.com)
- LinkedIn: [GenieTechBio](https://www.linkedin.com/company/genietechbio)

---

<p align="center">Empowering Bioinformatics with Artificial Intelligence</p>
