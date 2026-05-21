#!/bin/bash
# SarkariPortal Auto-Scraper Job
# Runs automatically in the background via cron to keep job database fresh!

# Navigate to project workspace
cd /home/shivam-dhoundiyal/.gemini/antigravity/scratch/sarkari-portal

# Write execution timestamp to log
echo "=== Job Scrape Started: $(date) ===" >> auto_update.log

# Run python scraper script
python3 parse_sarkari.py >> auto_update.log 2>&1

echo "=== Job Scrape Finished: $(date) ===" >> auto_update.log
echo "" >> auto_update.log
