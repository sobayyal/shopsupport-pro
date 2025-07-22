# replit.md

## Overview

This is a full-stack customer support dashboard application called "ShopSupport Pro" built with a modern tech stack. The application provides real-time chat functionality, AI-powered response suggestions, and Shopify integration for e-commerce customer support teams.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a monorepo structure with clear separation between client and server code:

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React Context for authentication
- **UI Components**: Radix UI primitives with shadcn/ui styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and bundling

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Real-time Communication**: WebSocket server for live chat functionality
- **API Design**: RESTful endpoints with Express routing

### Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle Kit for migrations and schema management

## Key Components

### Authentication System
- Custom authentication hook (`use-auth`) with localStorage persistence
- Role-based access control (agent, manager, admin)
- User session management with online/offline status tracking

### Real-time Chat System
- WebSocket manager for bidirectional communication
- Live typing indicators and message delivery
- Conversation assignment and status management
- Real-time updates for new messages and conversation changes

### AI Integration
- OpenAI GPT-4o integration for response suggestions
- Message categorization and automatic response generation
- Context-aware suggestions based on conversation history and customer data

### Shopify Integration
- Customer data synchronization from Shopify
- Order history and customer profile integration
- Support for Shopify webhook events (configured but implementation incomplete)

### UI Components
- Comprehensive design system using Radix UI primitives
- Responsive layout with mobile support
- Dark/light mode support through CSS variables
- Accessible components following ARIA guidelines

## Data Flow

1. **User Authentication**: Login credentials validated against database, user session stored in localStorage
2. **Real-time Updates**: WebSocket connection established on authentication, handles live chat events
3. **Message Processing**: Incoming messages trigger AI analysis for response suggestions
4. **Database Operations**: All data persistence handled through Drizzle ORM with type safety
5. **External API Calls**: Shopify customer data fetched on-demand, OpenAI API called for AI features

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon PostgreSQL serverless driver
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe database ORM
- **openai**: Official OpenAI API client
- **ws**: WebSocket implementation for real-time features

### UI Dependencies
- **@radix-ui/***: Accessible UI primitive components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe component variants
- **lucide-react**: Icon system

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Development
- Vite development server with HMR (Hot Module Replacement)
- Express server running with tsx for TypeScript execution
- WebSocket server integrated with HTTP server
- Replit-specific plugins for development environment

### Production Build
- Frontend: Vite builds React app to static files
- Backend: esbuild bundles server code to ESM format
- Database: Drizzle migrations managed through CLI
- Environment variables required for OpenAI API, Shopify integration, and database connection

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **OPENAI_API_KEY**: OpenAI API key for AI features
- **SHOPIFY_SHOP_DOMAIN**: Shopify store domain for integration
- **SHOPIFY_ACCESS_TOKEN**: Shopify API access token

The application is designed to be deployed on platforms supporting Node.js with WebSocket capabilities, with the database hosted separately (Neon, Railway, or similar PostgreSQL providers).

## Recent Changes

### 2025-01-22: Vercel Deployment Configuration
- Added complete Vercel deployment configuration with vercel.json
- Created web-based deployment guide for GitHub + Vercel workflow
- Configured serverless function routing for API endpoints
- Set up static file serving for React frontend and widget script
- Added comprehensive documentation for non-technical deployment process
- Prepared project for easy drag-and-drop or GitHub-based Vercel deployment