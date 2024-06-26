const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

const app = express();

// middlewar
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gdk9eql.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        const doctorsCollection = client
            .db('doctorsCollection')
            .collection('collectionAppointment');

        const bookingsCollection = client
            .db('doctorsCollection')
            .collection('bookings');
        const usersCollection = client
            .db('doctorsCollection')
            .collection('users');
        const newDoctorsCollection = client
            .db('doctorsCollection')
            .collection('doctors');

        //NOTE:  make sure you  use verify admin after verifJWT

        const verifyAdmin = async (req, res, next) => {
            console.log('inside verifyAdmin', req.decoded.email);
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbiden access' });
            }
            next();
        };

        app.get('/appointmentoptions', async (req, res) => {
            const date = req.query.date;
            const query = {};
            const options = await doctorsCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date };
            const alreadyBooked = await bookingsCollection
                .find(bookingQuery)
                .toArray();
            options.forEach((option) => {
                // console.log(option);
                const optionBooked = alreadyBooked.filter(
                    (book) => book.treatment === option.name
                );
                const bookedSlots = optionBooked.map((book) => book.slot);
                const remainingSlots = option.time_slots.filter(
                    (slot) => !bookedSlots.includes(slot)
                );
                option.time_slots = remainingSlots;
            });
            res.send(options);
        });

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden access' });
            }

            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        });

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment,
            };
            const alreadyBooked = await bookingsCollection
                .find(query)
                .toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking   on ${booking.appointmentDate}`;
                return res.send({ acknowledged: false, message });
            }

            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            // console.log(user);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
                    expiresIn: '1h',
                });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' });
        });

        app.get('/users', async (req, res) => {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        app.put(
            '/users/admin/:id',
            verifyJWT,
            verifyAdmin,
            async (req, res) => {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const options = { upsert: true };
                const updateDoc = {
                    $set: {
                        role: 'admin',
                    },
                };
                const result = await usersCollection.updateOne(
                    filter,
                    updateDoc,
                    options
                );
                res.send(result);
            }
        );

        app.get('/appointmentSpeciality', async (req, res) => {
            const query = {};
            const result = await doctorsCollection
                .find(query)
                .project({ name: 1 })
                .toArray();
            res.send(result);
        });

        app.get('/doctors', verifyJWT, verifyAdmin, async (re, res) => {
            const query = {};
            const doctors = await newDoctorsCollection.find(query).toArray();
            res.send(doctors);
        });

        app.post('/doctors', verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await newDoctorsCollection.insertOne(doctor);
            res.send(result);
        });

        app.delete('/doctors/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await newDoctorsCollection.deleteOne(filter);
            res.send(result);
        });
    } finally {
    }
}
run().catch(console.dir);

app.get('/', async (req, res) => {
    res.send('Doctors portal server is running');
});

app.listen(port, () => console.log(`Doctor portal running on ${port}`));
