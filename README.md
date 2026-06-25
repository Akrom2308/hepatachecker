# HepatitCheck

AI-powered Hepatitis Information & Laboratory Analysis Platform for Uzbekistan.

## Overview

HepatitCheck is an intelligent healthcare platform designed to help patients and healthcare professionals better understand hepatitis-related conditions, liver diseases, and laboratory test results.

The platform combines modern web technologies with Anthropic Claude AI to provide educational guidance, laboratory interpretation, and hepatitis-related information.

## Features

- AI-powered hepatitis assistant
- Laboratory result interpretation
- Multi-language support
  - Uzbek
  - Russian
  - English
- Secure API architecture
- Rate limiting protection
- CORS protection
- Production-ready deployment

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### AI
- Anthropic Claude API

### Deployment
- Render

## API Endpoints

### Health Check

GET

```http
/api/health
```

### AI Chat

POST

```http
/api/chat
```

Example:

```json
{
  "lang": "uz",
  "messages": [
    {
      "role": "user",
      "content": "Gepatit B nima?"
    }
  ]
}
```

### Laboratory Analysis

POST

```http
/api/analyze
```

Example:

```json
{
  "labs": {
    "ALT": 120,
    "AST": 95,
    "HBsAg": "Positive"
  },
  "lang": "uz"
}
```

## Environment Variables

Create a `.env` file:

```env
ANTHROPIC_API_KEY=your_api_key
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-domain.com
```

## Installation

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

## Run Production Server

```bash
npm start
```

## Deployment

This application is optimized for deployment on Render.

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

## Security

- Environment variable protection
- Rate limiting
- Request validation
- CORS protection
- API key isolation

## Disclaimer

HepatitCheck provides educational and informational support only.

The platform does not provide medical diagnoses and does not replace professional medical consultation.

Always consult a qualified healthcare professional for diagnosis and treatment.

## Author

Akrom Komiljonov

## License

MIT License
