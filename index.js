const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
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

async function run() {
	try {
		const doctorsCollection = client
			.db("doctorsCollection")
			.collection("collectionAppointment");

		const bookingsCollection = client
			.db("doctorsCollection")
			.collection("bookings");
		app.get("/appointmentoptions", async (req, res) => {
			const date = req.query.date;
			const query = {};
			const options = await doctorsCollection.find(query).toArray();
			const bookingQuery = { appointmentDate: date };
			const alreadyBooked = await bookingsCollection
				.find(bookingQuery)
				.toArray();
			options.forEach((option) => {
				console.log(option);
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

		app.get("/v2/appointmentoptions", async (req, res) => {
			const date = req.query.date;
			const options = await doctorsCollection.aggregate([
				{
					$lookup: {
						from: "bookings",
						localField: "name",
						foreignField: "treatment",
						as: booked,
					},
				},
			]);
		});

		app.post("/bookings", async (req, res) => {
			const booking = req.body;
			console.log(booking);
			const result = await bookingsCollection.insertOne(booking);
			res.send(result);
		});
	} finally {
	}
}
run().catch(console.dir);

app.get("/", async (req, res) => {
	res.send("Doctors portal server is running");
});

app.listen(port, () => console.log(`Doctor portal running on ${port}`));
