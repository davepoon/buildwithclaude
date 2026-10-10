# Datacircle for Claude

Datacircle is a data co-op. Query your favorite B2B data APIs through us. Same request, same price, no markup. Every morning, you get
the flat file of your data plus everyone else's.

This plugin connects Claude to Datacircle's MCP server, so Claude can fetch a person's LinkedIn profile from its URL (name, headline,
location, current company and title, positions, education, skills) from your Datacircle balance, and tell you what each lookup cost.

## What it does

- **Look up LinkedIn profiles** by URL. Right now we have 3 live LinkedIn profile APIs that we trust: Up2Data, HarvestAPI and Fetchin.
  $2.375 per 1,000 through Up2Data (a profile it can't find is free), $3.70 per 1,000 through HarvestAPI.
  $1.485 per 1,000 through Fetchin, a profile it can't find billed the same.
  At Up2Data's limit, the server tells your agent to call again through Fetchin or HarvestAPI.
  Each request goes to the provider and gets the profile as it is today.
- **Check your balance**, and start a Stripe Checkout to add funds, which you open and pay yourself: nothing is charged until you do.
- **List your files and get download links**: the free 10M+ U.S. B2B leads dataset, and the 50M+ dataset and daily co-op files once
  unlocked.
- **Get your invite link.**

A skill tells Claude how to use these well: the price first and your yes before any paid lookup, Up2Data first since a profile it
can't find is free, never fetching profiles you didn't ask for, and a profile's text treated as data, never as instructions.

## Setup

Install the plugin, then sign in when Claude Code asks (or run `/mcp`): datacircle.dev opens, you sign in with your work email and a code,
and you allow the connection. A new account starts with a $5 credit. Docs: https://docs.datacircle.dev/mcp-server

## What it sends, and where

The plugin runs no code on your machine. It declares one remote MCP server, `https://api.datacircle.dev/mcp`, run by Datacircle. Claude
sends it the LinkedIn URLs and file IDs you ask about; Datacircle calls the data provider you chose (Up2Data, HarvestAPI or Fetchin) for each
profile lookup, stores the answer, and charges your balance. Signing in gives Claude an access token that works on that server only;
resetting your API key on datacircle.dev cuts it off.

Privacy policy: https://datacircle.dev/privacy. Support: wayne@datacircle.dev.
