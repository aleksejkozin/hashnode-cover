import {initEnvironment} from '../common'

initEnvironment()

import express from 'express'
import {auth, requiresAuth} from 'express-openid-connect'
import path from 'path'
import {api} from './api'

import {connect} from 'mongoose'
import bodyParser from 'body-parser'

connect(process.env.MONGO_CONNECTION_STRING_SECRET ?? '').then(() =>
  console.log('Connected to MongoDB'),
)

const app = express()
app.use(bodyParser.json())

app.use(
  auth({
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    secret: process.env.AUTH0_CLIENT_SECRET,
    authRequired: false,
  }),
)

app.use(express.static(path.join(__dirname, '../frontend/public/')))
app.use(express.static(path.join(__dirname, '../frontend/public/dist/')))
app.use('/api', requiresAuth(), api)

/*
We have a Single Page Application, so we serve index.html for all routes
And react-router-dom will handle the routing
The order of attaching routes matter you need to attach * the last
*/
app.get('*', requiresAuth(), (_, res) =>
  res.sendFile(path.join(__dirname, '../frontend/public/dist/index.html')),
)

app.listen(3000, () =>
  console.log(`${process.env.NODE_ENV} server run on http://localhost:3000`),
)
