import {withApiAuthRequired, getSession} from '@auth0/nextjs-auth0'
import {isMainApplicationInstance} from '@hashnode-cover/common/src'

export default withApiAuthRequired(async (req, res) => {
  const session = getSession(req, res)

  res.status(200).json({
    message: 'hello!',
    isMainApplicationInstance: await isMainApplicationInstance(),
    user: session?.user,
  })
})
