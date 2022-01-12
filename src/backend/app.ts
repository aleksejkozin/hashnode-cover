import express from 'express'
import {auth} from 'express-openid-connect'
import {api} from './api'
import bodyParser from 'body-parser'

const app = express()

app.use(bodyParser.json())

app.use(
  auth({
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    secret: process.env.AUTH0_CLIENT_SECRET,
    // All routes are protected
    authRequired: true,
  }),
)

// Serve static files
app.use(express.static('dist/frontend/public'))
// This is how you group rotes with Router() and attach them to the app
app.use('/api', api)

/*
We have a Single Page Application, so we serve index.html for all routes
And react-router-dom will handle the routing
The order of attaching routes matter you need to attach * the last
*/
app.use('*', express.static('dist/frontend/public/index.html'))

app.listen(3000, () =>
  console.log(`${process.env.NODE_ENV} server run on http://localhost:3000`),
)
