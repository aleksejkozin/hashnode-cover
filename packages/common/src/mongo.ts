import { MongoClient } from 'mongodb'

export const mongo = process.env.MONGO_CONNECTION_STRING
  ? new MongoClient(process.env.MONGO_CONNECTION_STRING)
  : undefined

console.log('process.env.MONGO_CONNECTION_STRING', process.env.MONGO_CONNECTION_STRING)

mongo?.connect().then(() => console.log('Connected to MongoDB'))
