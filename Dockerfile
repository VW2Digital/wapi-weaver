FROM node:20-alpine

WORKDIR /app

# Copy package lists
COPY package*.json ./

# Install all dependencies (needed for compilation)
RUN npm install

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# Expose the port (TanStack Start/Vite defaults to 3000 or 8080 in preview/production)
EXPOSE 3000

# Start production server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
