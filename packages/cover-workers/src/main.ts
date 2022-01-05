// noinspection InfiniteLoopJS

import { CronJob } from 'cron'
import { isMainAppInstance, sleep } from '@hashnode-cover/common'

console.log('Starting workers...')

/*
You can run periodic tasks using the cron package
You can get info about cron syntax here: https://crontab.cronhub.io/
However, if you run your system on multiple nodes, you would like to run the task only on 1 main node
*/
new CronJob('*/5 * * * * *', async () => {
  try {
    if (await isMainAppInstance()) {
      console.log('Running reporting...')
    } else {
      console.log('Not the main node instance. Skipping reporting.')
    }
  } catch (e) {
    console.error('CronJob error:', e)
  }
}).start()

/*
This is how you can write queue processors:
- Endless loop
- Check for work
- If there is no work, sleep a bit
Queue will load balance workers, so you can run such tasks on all nodes
*/
const main = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log('Processing something...')
    await sleep(60000)
  }
}

main()
