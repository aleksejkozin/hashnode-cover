import {getConfig} from '@hashnode-cover/common/src/config'

getConfig('env', '{}')
  .then(JSON.parse)
  .then(Object.entries)
  .then(x => x.forEach(([k, v]) => console.log(`${k}="${v}"`)))
