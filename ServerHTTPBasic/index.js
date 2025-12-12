import express from "express"

const app = express()

app.use(express.static('public'))

app.get('/', (_req, res) => {
  res.sendFile('index')
})

app.listen(3001, () => {
  console.log('http://localhost:3001')
})
