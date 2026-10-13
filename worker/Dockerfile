# Version 2 : worker sans bibliothèque Supabase (reconstruction forcée)
# Image officielle Playwright : contient déjà Chromium et ses dépendances
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# ffmpeg pour assembler la vidéo et ajouter la voix off
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Lance la boucle qui traite la file d'attente Supabase
CMD ["node", "job.mjs"]
