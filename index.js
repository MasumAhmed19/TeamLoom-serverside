require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
// const admin = require('firebase-admin');


const port = process.env.PORT || 9000;
const app = express();
// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://teamloom-a1022.web.app",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.f0l8v.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("TeamLoom-db");
    const employeeCollection = db.collection("employee");
    const taskCollection = db.collection("tasks");
    const salaryCollection = db.collection("payroll");

    // // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      // console.log('data from verifyToken middleware--->', req.user?.email)
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Forbidden Access! Admin Only Actions!" });

      next();
    };

    const verifyHR = async (req, res, next) => {
      // console.log('data from verifyToken middleware--->', req.user?.email)
      const email = req.user?.email;
      const query = { email };
      const result = await employeeCollection.findOne(query);
      if (!result || result?.role !== "hr")
        return res
          .status(403)
          .send({ message: "Forbidden Access! HR Only Actions!" });

      next();
    };

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // POST ALL USER DATA
    app.post("/add-user/:email", async (req, res) => {
      const email = req.params.email;
      const userData = req.body;

      // check if user exists in db
      const query = { email };
      const isExist = await employeeCollection.findOne(query);

      // na paile DB te add hbe
      const result = await employeeCollection.insertOne({
        ...userData,
        timestamp: Date.now(),
      })

      res.send(result);
    });

    // Google signIn handle
    app.post('/goolgle-signIn/:email', async(req, res)=>{
      const email = req.params.email
      const query = { email }
      const user = req.body
      const isExist = await employeeCollection.findOne(query)
      if (isExist) {
        return res.send(isExist)
      }
      
      // na paile DB te add hbe
      const result = await employeeCollection.insertOne({
        ...user,
        timestamp: Date.now(),
      })
      res.send(result)
    })

    // GET ALL USER DATA for admin
    app.get("/all-employee", async (req, res) => {
      const role = req.query.role || "";
      const query = role ? { role: role } : {};
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    // all employee except admin
    app.get("/allemployees", verifyToken, async (req, res) => {
      const role = req.query.role || "";
      // Modify the query to exclude 'admin'
      const query = role ? { role: role } : { role: { $ne: "admin" } };
      try {
        const result = await employeeCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });
    

    // Get employee detail through their email
    app.get("/employee/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    // Get employee detail through their id
    app.get("/employee/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    // Update employee detail through their id
    app.put("/makehr/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateData = {
        makeHR: true,
        role: "hr",
      };
      const update = {
        $set: updateData,
      };
      const options = {
        upsert: false,
      };
      const result = await employeeCollection.updateOne(query, update, options);

      res.send(result);
    });

    // update salary
    app.put("/adjust-salary/:id", async (req, res) => {
      const id = req.params.id;
      const { salary } = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedData = {
        salary: parseInt(salary),
      };
      const update = {
        $set: updatedData,
      };

      const options = {
        upsert: false,
      };
      const result = await employeeCollection.updateOne(query, update, options);

      res.send(result);
    });

    app.get("/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await employeeCollection.findOne(query);
      res.send({ role: result.role });
    });

    // delete/Fire from job TODO: firebase thekew delete krte
    app.delete("/fire/:id", async (req, res) => {
      // const uid = req.query.uid
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await employeeCollection.deleteOne(query);
      res.send(result);
    });

    // API FOR HR---> TODO: hr middleware
    // Getting All Employee
    app.get("/only-employees", verifyToken, verifyHR, async (req, res) => {
      const query = { role: "employee" };

      const result = await employeeCollection.find(query).toArray();
      res.send(result);
    });

    // isVerify value toggling
    app.patch("/verify/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const user = await employeeCollection.findOne(query);

      const update = {
        $set: {
          isVerified: !user.isVerified,
        },
      };

      const result = await employeeCollection.updateOne(query, update);

      res.send(result);
    });

    // payment request ---> post via HR
    app.post("/payment-req", async (req, res) => {
      const data = req.body;
      try {
        const { month, year, employee_id } = data;

        const existingPayment = await salaryCollection.findOne({
          employee_id: employee_id,
          month: month,
          year: year,
        });

        if (existingPayment) {
          return res.status(400).json({
            message: "Payment Exists",
          });
        }

        const result = await salaryCollection.insertOne(data);
        res.send(result);
      } catch (err) {
        res.status(500).json({
          message: "An error occurred",
          error: err.message,
        });
      }
    });

    

    // get all payroll listings----> accessed via admin
    app.get("/all-payment-request", async (req, res) => {
      const result = await salaryCollection.find().toArray();
      res.send(result);
    });

    // get all payroll listings----> accessed via admin
    app.get("/donepayment/:empid", async (req, res) => {
      const empid = req.params.empid;
      const query = {
        employee_id: empid,
        isComplete:true,
      }
      const result = await salaryCollection.find(query).toArray();
      res.send(result);
    });

    // get all tasks for progress in HR
    app.get("/all-tasks", async (req, res) => {
      const { name, month, year } = req.query;
      const filter = {};

      if (name) {
        filter.employeeName = { $regex: name, $options: "i" };
      }

      if (month) {
        // Ensure the month is correctly matched as the second part of the date
        filter.date = {
          $regex: `^[0-9]{2}-${month.padStart(2, "0")}-`,
          $options: "i",
        };
      }

      // Filter by year
      if (year) {
        filter.date = { ...filter.date, $regex: `${year}` };
      }

      const result = await taskCollection.find(filter).toArray();
      res.send(result);
    });

    // get all tasks
    app.post("/add-task", async (req, res) => {
      const data = req.body;
      const result = await taskCollection.insertOne(data);
      res.send(result);
    });

    // task via email
    app.get("/tasks/:email", async (req, res) => {
      const email = req.params.email;
      const query = { employeeEmail: email };
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

    // task via id
    app.put("/update-task/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { updatedTask, updatedHours, newDate } = req.body;

      const update = {
        $set: {
          task: updatedTask,
          hoursWorked: updatedHours,
          date: newDate,
        },
      };

      const options = {
        upsert: false,
      };
      const result = await taskCollection.updateOne(query, update, options);

      res.send(result);
    });

    // task delete
    app.delete("/delete-task/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    });

    // make payment api
    // create payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      try {
        const { payableSalary, employee_id, month, year } = req.body;

        const user = await salaryCollection.findOne({
          employee_id: employee_id,
          month: month,
          year: year,
        });

        // Validation: Ensure necessary fields are provided
        if (!payableSalary || !employee_id || !user) {
          return res.status(400).json({ message: "Missing required fields." });
        }

        const totalSalary = payableSalary * 100;
        const { client_secret } = await stripe.paymentIntents.create({
          amount: totalSalary,
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });
        res.send({ clientSecret: client_secret });
      } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({
          message: "Failed to create payment intent",
          error: error.message,
        });
      }
    });

    // verifyToken, verifyAdmin,
    app.patch("/payment-process", verifyToken, async (req, res) => {
      const { employee_id, month, year, transaction_id } = req.body;
      const result = await salaryCollection.updateOne(
        { employee_id: employee_id, month: month, year: year },
        {
          $set: {
            isComplete: true,
            status: "Complete",
            transactionId: transaction_id,
          },
        }
      );

      res.send(result);
    });

    //1. statistics for admin: Employee Role Distribution (Pie Chart)
    app.get("/admin-stat", verifyToken, async (req, res) => {
      // Total HR count
      const totalHR = await employeeCollection.countDocuments({ role: "hr" });

      // Total Employee count
      const totalEmployee = await employeeCollection.countDocuments({
        role: "employee",
      });

      // Total working hours
      const totalWorkingHourResult = await taskCollection
        .aggregate([
          { $group: { _id: null, totalHours: { $sum: "$hoursWorked" } } },
          { $project: { _id: 0, totalHours: 1 } },
        ])
        .toArray();

      const totalWorkingHour = totalWorkingHourResult[0]?.totalHours || 0;

      // Total salary paid
      const totalSalaryPaidResult = await salaryCollection
        .aggregate([
          { $match: { isComplete: true } },
          { $group: { _id: null, totalSalary: { $sum: "$payableSalary" } } },
          { $project: { _id: 0, totalSalary: 1 } },
        ])
        .toArray();

      const totalSalaryPaid = totalSalaryPaidResult[0]?.totalSalary || 0;

      const taskOverview = await taskCollection
        .aggregate([
          {
            $group: {
              _id: "$task", // Group by task name
              totalHours: { $sum: "$hoursWorked" }, // Sum the hours worked for each task
            },
          },
          {
            $project: {
              _id: 0, // Exclude the _id field
              taskName: "$_id", // Rename _id to taskName
              totalHours: 1, // Include totalHours in the output
            },
          },
        ])
        .toArray();

      res.send({
        totalHR,
        totalEmployee,
        totalWorkingHour,
        totalSalaryPaid,
        taskOverview,
      });
    });

    // API for role
    app.get("/employee/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await employeeCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from TeamLoom Server");
});

app.listen(port, () => {
  console.log(`TeamLoom is running on port ${port}`);
});
