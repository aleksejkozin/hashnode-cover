import {initEnvironment} from '../common'

initEnvironment()

import express from 'express'
import {auth, requiresAuth} from 'express-openid-connect'
import path from 'path'

const app = express()

app.use(
  auth({
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    secret: process.env.AUTH0_CLIENT_SECRET,
  }),
)

app.get('/submissions', requiresAuth(), async (req, res) => {
  res.json({
    status: 'success',
    user: req?.oidc?.user,
  })
})

// Will serve everything in the public folder
app.use(express.static(path.join(__dirname, '../frontend/public/dist/')))
app.use(express.static(path.join(__dirname, '../frontend/public/')))

/*
We have a Single Page Application, so we serve index.html for all routes
And react-router-dom will handle the routing
*/
app.get(['/', '/*'], requiresAuth(), (_, res) =>
  res.sendFile(path.join(__dirname, '../frontend/public/dist/index.html')),
)

app.listen(3000, () =>
  console.log(`${process.env.NODE_ENV} server run on http://localhost:3000`),
)
