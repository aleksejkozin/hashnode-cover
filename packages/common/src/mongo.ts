import { MongoClient } from 'mongodb'

export const mongo = new MongoClient(process.env.MONGO_CONNECTION_STRING)

mongo.connect().then(() => console.log('Connected to MongoDB'))
