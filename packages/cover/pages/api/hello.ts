import {withApiAuthRequired, getSession} from '@auth0/nextjs-auth0'

export default withApiAuthRequired(async (req, res) => {
  const session = getSession(req, res)

  res.status(200).json({
    message: 'hello!',
    baseUrl: process.env.AUTH0_BASE_URL,
    user: session?.user,
  })
})
