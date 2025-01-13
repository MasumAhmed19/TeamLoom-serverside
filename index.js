require('dotenv').config()
const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 9000
const app = express()

// middleware
app.use(cors())
app.use(express.json())


async function run() {
  try {


  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from TeamLoom Server');
})

app.listen(port, () => {
  console.log(`TeamLoom is running on port ${port}`)
})
