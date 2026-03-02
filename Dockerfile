FROM node:22

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install system 7-Zip
RUN apt-get update && \
    apt-get install -y p7zip-full && \
    rm -rf /var/lib/apt/lists/*

# Copy all source code
COPY . .

# Expose ports
EXPOSE 5000 9229

# Start the app
CMD ["npm", "start"]