import express from 'express';
const app=express();
app.get('/health',(_req,res)=>res.json({ok:true,version:'2.2-browser-data'}));
app.use(express.static('public'));
export default app;
