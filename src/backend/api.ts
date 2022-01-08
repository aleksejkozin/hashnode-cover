import {Router} from 'express'
import assert from 'assert'
import {MongoClient} from 'mongodb'

const client = new MongoClient(process.env.MONGO_CONNECTION_STRING_SECRET ?? '')
client.connect().then(() => {
  console.log('Connected correctly to server')
})

export const api = Router()

api.get('/user', async (req, res) => {
  assert(req.oidc.user)
  const {email, name} = req.oidc.user

  const results = await client
    .db('hashnode')
    .collection('user')
    .findOneAndUpdate({email}, {$set: {email, name}}, {upsert: true})

  res.json(results.value)
})

api.put('/user', async (req, res) => {
  assert(req.oidc.user)
  const {email, name} = req.oidc.user

  const results = await client
    .db('hashnode')
    .collection('user')
    .findOneAndUpdate(
      {email},
      {$set: {...req.body, email, name}},
      {upsert: true},
    )

  res.json(results.value)
})
