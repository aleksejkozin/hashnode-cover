import { getConfig } from '@hashnode-cover/common'
import { writeFileSync } from 'fs'

getConfig('env', '{}')
  .then(JSON.parse)
  .then(Object.entries)
  .then((env) =>
    writeFileSync('.env.global', env.map(([k, v]) => `${k}="${v}"`).join('\n'))
  )
