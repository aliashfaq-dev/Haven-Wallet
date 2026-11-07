import express from 'express'
import 'dotenv/config'
import transactionsHandler from './api/transactions.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

// Reuse the same read-only transaction handler locally and on Vercel.
app.get('/api/transactions', transactionsHandler)

app.listen(PORT, () => console.log(`Haven API proxy listening on http://localhost:${PORT}`))
