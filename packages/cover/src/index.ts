import { CronJob } from 'cron'
import { isMainAppInstance } from '@hashnode-cover/common'

new CronJob('*/5 * * * * *', async () => {
  try {
    if (await isMainAppInstance()) {
      console.log('Running reporting...')
    } else {
      console.log('Not the main node instance. Skipping reporting.2222')
    }
  } catch (e) {
    console.error('CronJob error:', e)
  }
}).start()

