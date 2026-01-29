# Ad Astra - Cloud Resource Management Dashboard

A modern, responsive cloud resource management and cost optimization dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Features

### 1. Main Dashboard
- Total Monthly Cost overview with trend indicators
- Active Resources count (EC2, S3, RDS)
- Cost Savings Suggestions with priority indicators
- Recent Alerts for unused resources
- Quick Actions for navigation

### 2. Recommendations Panel
- Cost optimization recommendations with filtering and sorting
- Modal popup for viewing and executing recommendations
- Tier selection dropdown (Standard, Intelligent Tiering, Glacier, Glacier Deep Archive)
- Estimated savings calculator
- Execute/Dismiss actions

### 3. Kill Switch
- Emergency resource termination control
- Big red button with visual feedback
- OTP verification modal
- Warning messages and confirmations
- Success state feedback

### 4. Analytics
- Monthly cost trend chart (Area chart)
- Resource usage distribution (Pie chart)
- Cost by service (Bar chart)
- Cost breakdown table
- Summary statistics

### 5. Server Comparison
- Compare servers across AWS, Azure, DigitalOcean, and GCP
- Dynamic spec selection (CPU, RAM)
- Best value indicator
- Responsive table/card view

### 6. S3 Lifecycle Management
- Bucket tier recommendations
- One-click tier changes
- Apply All functionality
- Progress tracking
- Estimated savings display

### 7. Settings
- Profile management
- Notification preferences
- Security settings (2FA, session timeout)
- Cloud provider connections
- Appearance customization

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Data:** Mock data (no backend required)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:

```bash
cd ad-astra
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Dashboard (Home)
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── analytics/
│   │   └── page.tsx              # Analytics page
│   ├── compare/
│   │   └── page.tsx              # Server comparison page
│   ├── kill-switch/
│   │   └── page.tsx              # Kill switch page
│   ├── recommendations/
│   │   └── page.tsx              # Recommendations page
│   ├── s3-lifecycle/
│   │   └── page.tsx              # S3 lifecycle page
│   └── settings/
│       └── page.tsx              # Settings page
├── components/                   # Reusable components
│   ├── AnalyticsCharts.tsx       # Chart components
│   ├── DashboardCards.tsx        # Dashboard metric cards
│   ├── DashboardLayout.tsx       # Main layout wrapper
│   ├── KillSwitch.tsx            # Kill switch with OTP modal
│   ├── Navbar.tsx                # Top navigation bar
│   ├── RecommendationModal.tsx   # Recommendation detail modal
│   ├── S3LifecycleRecommendations.tsx  # S3 tier recommendations
│   ├── ServerComparisonTable.tsx # Server comparison table
│   └── Sidebar.tsx               # Side navigation
├── data/
│   └── mockData.ts               # Mock data for the application
└── types/
    └── index.ts                  # TypeScript type definitions
```

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Demo Credentials

For the Kill Switch OTP verification:
- **OTP Code:** `123456`

## Customization

### Mock Data
All mock data is located in `src/data/mockData.ts`. You can modify this file to change:
- Dashboard summary statistics
- Resource lists
- Recommendations
- S3 bucket configurations
- Monthly cost data
- Server comparison pricing

### Styling
The application uses Tailwind CSS with a dark theme. Global styles are in `src/app/globals.css`.

Color scheme:
- Primary: Blue (`#3b82f6`)
- Success: Green (`#10b981`)
- Warning: Amber (`#f59e0b`)
- Danger: Red (`#ef4444`)
- Background: Slate 950 (`#020617`)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License

---

Built with Next.js, TypeScript, and Tailwind CSS
