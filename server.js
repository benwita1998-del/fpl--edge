import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const TEAM_ID = process.env.FPL_TEAM_ID || '702959';
const API = 'https://fantasy.premierleague.com/api';
const livePath = path.join(__dirname, 'data', 'live.json');

app.use(express.static(path.join(__dirname, 'public')));

const headers = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'en-GB,en;q=0.9',
  'cache-control': 'no-cache',
  'pragma': 'no-cache',
  'referer': 'https://fantasy.premierleague.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36'
};

async function fpl(pathname) {
  const r = await fetch(API + pathname, { headers, redirect: 'follow', cache: 'no-store' });
  const text = await r.text();
  if (!r.ok) throw new Error(`FPL ${r.status} ${pathname}: ${text.slice(0,120)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`FPL returned non-JSON for ${pathname}: ${text.replace(/\s+/g,' ').slice(0,180)}`); }
}

app.get('/api/health', (_req,res) => res.json({ok:true, version:'2.3.0', teamId:Number(TEAM_ID), hasSnapshot:fs.existsSync(livePath)}));

app.get('/api/data', async (_req,res) => {
  try {
    // Prefer the GitHub-updated snapshot so the app remains usable even when FPL blocks Vercel runtime IPs.
    if (fs.existsSync(livePath)) return res.json(JSON.parse(fs.readFileSync(livePath,'utf8')));
    const b = await fpl('/bootstrap-static/');
    const e = await fpl(`/entry/${TEAM_ID}/`);
    const h = await fpl(`/entry/${TEAM_ID}/history/`);
    const t = await fpl(`/entry/${TEAM_ID}/transfers/`);
    const gw = b.events.find(x=>x.is_current)||b.events.find(x=>x.is_next)||b.events[0];
    let p = {picks:[]}; try { p = await fpl(`/entry/${TEAM_ID}/event/${gw.id}/picks/`); } catch {}
    res.json({bootstrap:b,entry:e,history:h,transfers:t,picks:p,gameweek:gw.id,source:'official-fpl-api-live'});
  } catch (e) {
    res.status(502).json({error:e.message, hint:'The app is deployed. The live FPL endpoint blocked the runtime request; use the GitHub snapshot updater.'});
  }
});

app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

export default app;
