// This will make sure that environment will be load before the app after webpack compile the code
require('../common').initEnvironment()
require('./app')
