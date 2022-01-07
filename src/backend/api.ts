import {Router} from 'express'
import {model, Schema, Document} from 'mongoose'
import assert from 'assert'

export const api = Router()

export type UserType = {
  name?: string
  email?: string
  connections?: {
    hashnode?: {
      token: string
    }
  }
} & Document

const UserModel = model<UserType>(
  'User',
  new Schema({
    email: String,
    name: String,
    connections: {
      hashnode: new Schema({
        token: {type: String, required: true},
      }),
    },
  }),
)

api.get('/user', async (req, res) => {
  assert(req.oidc.user)
  const {email, name} = req.oidc.user
  res.json(
    await UserModel.findOneAndUpdate({email}, {email, name}, {upsert: true}),
  )
})

api.post('/connections/hashnode', async (req, res) => {
  assert(req.oidc.user)
  const {email} = req.oidc.user
  await UserModel.findOneAndUpdate(
    {email},
    {
      connections: {
        hashnode: req.body,
      },
    },
    {upsert: true},
  )
  res.json({status: 'ok'})
})

api.delete('/connections/hashnode', async (req, res) => {
  assert(req.oidc.user)
  const {email} = req.oidc.user
  await UserModel.findOneAndUpdate(
    {email},
    {
      connections: {
        hashnode: undefined,
      },
    },
    {upsert: true},
  )
  res.json({status: 'ok'})
})
