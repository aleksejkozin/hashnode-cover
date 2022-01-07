import { MongoClient } from 'mongodb'

export const mongo = process.env.MONGO_CONNECTION_STRING_SECRET
  ? new MongoClient(process.env.MONGO_CONNECTION_STRING_SECRET)
  : undefined

mongo?.connect().then(() => console.log('Connected to MongoDB'))
