require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')

const port = process.env.PORT || 9000
const app = express()
// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f0l8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})


async function run() {
  try {
    const db = client.db("TeamLoom-db");
    const employeeCollection = db.collection("employee");
    const taskCollection = db.collection("tasks")

    // Generate jwt token
    app.post('/jwt', async (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // POST ALL USER DATA
    // app.post('/add-user', async(req, res)=>{
    //   const userData = req.body;
    //   const result = await employeeCollection.insertOne({
    //     ...userData,
    //     timestamp: Date.now(),
    //   });
    //   res.send(result)
    // })

    // POST ALL USER DATA
    app.post('/add-user/:email', async(req, res)=>{
      const email = req.params.email;
      const userData = req.body;
      
      // check if user exists in db
      const query = {email};
      const isExist = await employeeCollection.findOne(query)

      // jodi age theke user theke thake
      if(isExist){ 
        return res.send(isExist)
      }

      // jodi na thake
      const result = await employeeCollection.insertOne({
        ...userData,
        role:userData?.role || 'employee',
        timestamp: Date.now(),
      });
      res.send(result)
    })

    // GET ALL USER DATA for admin
    app.get('/all-employee', async(req, res)=>{
      const role = req.query.role || ''
      const query = role ? {role:role} : {}
      const result = await employeeCollection.find(query).toArray()
      res.send(result)
    })

    // Get employee detail through their email
    app.get('/employee/:email', async(req, res)=>{
      const email = req.params.email
      const query = {'email':email}
      const result = await employeeCollection.find(query).toArray()
      res.send(result)
    })

    // Get employee detail through their id
    app.get('/employee/id/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await employeeCollection.find(query).toArray()
      res.send(result)
    })

    // Update employee detail through their id
    app.put('/makehr/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)};
      const updateData = {
        makeHR: true,
        role: 'hr'
      }
      const update = {
        $set:updateData
      }
      const options = {
        upsert: false
      } 
      const result = await employeeCollection.updateOne(query, update, options)

      res.send(result)
    })

    // update salary
    app.put('/adjust-salary/:id', async(req, res)=>{
      const id= req.params.id;
      const {salary}= req.body
      const query = {_id: new ObjectId(id)};
      const updatedData = {
        salary: parseInt(salary)
      }
      const update = {
        $set:updatedData
      }

      const options = {
        upsert: false
      }
      const result = await employeeCollection.updateOne(query, update, options)

      res.send(result)
    })

    app.get('/role/:email', async (req, res)=>{
      const email = req.params.email;
      const query = {email:email}
      const result = await employeeCollection.findOne(query)
      res.send({ role: result.role });
    })

    // delete/Fire from job 
    app.delete('/fire/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await employeeCollection.deleteOne(query)
      res.send(result)
    })

    // API FOR HR
    app.get('/only-employees', async (req, res)=>{
        const query = {role: 'employee'}
        const result = await employeeCollection.find(query).toArray()
        res.send(result)
    })

    app.patch('/verify/:id', async (req, res)=>{
      const id= req.params;
      const query = {_id: new ObjectId(id)};
      const user = await employeeCollection.findOne(query);

      const update = {
        $set: {
          isVerified: !user.isVerified, 
        },
      };

      const result = await employeeCollection.updateOne(query, update);

      res.send(result)

    })


    app.post('/add-task', async(req, res)=>{
      const data = req.body;
      const result = await taskCollection.insertOne(data);
      res.send(result)
    })

    app.get('/tasks/:email', async(req, res)=>{
      const email= req.params.email
      const query = {'employeeEmail': email}
      const result = await taskCollection.find(query).toArray();
      res.send(result)
    })

    app.get('/tasks/:email', async(req, res)=>{
      const email= req.params.email
      const query = {'employeeEmail': email}
      const result = await taskCollection.find(query).toArray();
      res.send(result)
    })

    app.put('/update-task/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const { updatedTask, updatedHours, newDate } = req.body;

      const update = {
        $set:{
          task: updatedTask,
          hoursWorked: updatedHours,
          date: newDate
        }
      }

      const options = {
        upsert:false
      }
      const result = await taskCollection.updateOne(query, update, options)

      res.send(result)
  

    })


    app.delete('/delete-task/:id', async(req, res)=>{
      const id = req.params;
      const query = {_id: new ObjectId(id)}
      const result = await taskCollection.deleteOne(query);
      res.send(result)
    })


    app.get('/employee/role/:email', async (req, res)=>{
      const email = req.params.email;
      const result = await employeeCollection.findOne({email});
      res.send({role: result?.role})
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
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
