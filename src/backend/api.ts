import {Router} from 'express'
import assert from 'assert'
import {MongoClient} from 'mongodb'
import {getHashnodeArticles, getHashnodeUsername} from './hashnode'

const client = new MongoClient(process.env.MONGO_CONNECTION_STRING_SECRET ?? '')
client.connect().then(() => console.log('Connected correctly to server'))
const db = client.db('hashnode')

export const api = Router()

api.get('/user', async (req, res) => {
  assert(req.oidc.user)
  const {email, name} = req.oidc.user

  const results = await db
    .collection('user')
    .findOneAndUpdate({email}, {$set: {email, name}}, {upsert: true})
  const user = results.value

  if (user?.connections?.hashnode?.token) {
    const articles = await getHashnodeArticles(
      user?.connections?.hashnode?.token,
      user?.connections?.hashnode?.username,
    )

    const newArticles = Object.fromEntries(
      articles
        .map((x: any) => ({
          ...x,
          ...(user?.articles?.[x?.slug] ?? {}),
        }))
        .map((x: any) => [x.slug, x]),
    )

    user.articles = {
      ...(user.articles ?? {}),
      ...newArticles,
    }
  }

  res.json(user)
})

api.put('/user', async (req, res) => {
  assert(req.oidc.user)
  const {email, name} = req.oidc.user

  // Validating hashnode connection and extracting username
  if (req?.body?.connections?.hashnode) {
    req.body.connections.hashnode.username = await getHashnodeUsername(
      req.body.connections.hashnode.token,
    )
  }

  const results = await db
    .collection('user')
    .findOneAndUpdate(
      {email},
      {$set: {...req.body, email, name}},
      {upsert: true},
    )

  res.json(results.value)
})
