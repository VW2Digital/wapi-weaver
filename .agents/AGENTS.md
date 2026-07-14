# Visual & Experience Guidelines

Follow these guidelines for visual aesthetics, layout, and UI/UX patterns:

## Reference Design Systems
- **Linear**: Clean, minimal, modern, highly-productive, low noise, strong hierarchy.
- **Vercel / Geist**: SaaS style, generous whitespace, high contrast, crisp typography, clean grids, tech-premium feel.
- **Stripe**: Excellent data presentation, sidebars, dashboard grids, tables, clean actions/filters.
- **Shopify Polaris**: Clear forms, buttons, success/error feedback, easy configuration flows.
- **Atlassian**: Consistent badges, menus, labels, and clear status indications.
- **IBM Carbon**: Accessible, robust, high contrast, clean enterprise-grade tables.
- **Apple HIG**: Clarity, legibility, micro-interactions, clean padding/spacing.

## Styling Rules
- **Themes**: Light background or subtle gray, white cards with soft/delicate borders.
- **Shadows**: Very soft, subtle elevation.
- **Spacing**: Consistent margins and padding.
- **Colors**: Restricted, professional accent colors (avoid overly saturated primaries/multitudinous highlights).
- **Transitions**: Smooth micro-animations on interactive states.

## Database & Docker Guidelines
- **Docker Container**: The local MySQL database runs in a Docker container named `wapi_weaver_mysql`.
- **Database Configuration**:
  - **Host**: `localhost` (from outside Docker) or `banco-mysql` (inside Docker network).
  - **Port**: `3306`
  - **User**: `wapi_user`
  - **Password**: `S0xbxPfKazBVT8JFy1UEOjIsrjox`
  - **Database Name**: `wapi_weaver`
- **Troubleshooting**: If database connection fails (e.g. `AggregateError`), verify that the `wapi_weaver_mysql` container is running in Docker. If it is stopped, start it using `docker start wapi_weaver_mysql` or Docker Desktop.
  - **Path/Mounting Errors**: If Docker fails to start the container with mount/path errors (e.g., trying to reference files from an old directory path like `C:\` instead of the current `D:\`), reset and rebuild the containers in the current working directory by running:
    1. `docker-compose down`
    2. `docker-compose up -d`
    This will recreate the containers and update Docker's host file mounts to the correct current workspace directory.

## No Supabase Rule
- **NEVER use Supabase**: We do NOT use Supabase. All database interactions MUST be done using the native MySQL connection (e.g., `db.query`) or the custom `QueryBuilder` over MySQL. Do not write code or instructions thinking about Supabase.
