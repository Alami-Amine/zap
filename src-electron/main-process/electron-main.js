/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const { app } = require('electron')

const dbApi = require('../db/db-api.js')
const args = require('../util/args.js')
const env = require('../util/env.js')
const windowJs = require('./window.js')
const startup = require('./startup.js')

env.versionsCheck()

if (process.env.DEV) {
  env.setDevelopmentEnv()
} else {
  env.setProductionEnv()
}

/**
 * Hook up all the events for the electron app object.
 */
function hookAppEvents(argv) {
  app.allowRendererProcessReuse = false
  app
    .whenReady()
    .then(() => startup.startUp(true, argv))
    .catch((err) => {
      console.log(err)
      app.exit(1)
    })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    env.logInfo('Activate...')
    windowJs.windowCreateIfNotThere(args.httpPort)
  })

  app.on('will-quit', () => {
    startup.shutdown()

    if (env.mainDatabase() != null) {
      // Use a sync call, because you can't have promises in the 'quit' event.
      try {
        dbApi.closeDatabaseSync(env.mainDatabase())
        env.logInfo('Database closed, shutting down.')
      } catch (err) {
        env.logError('Failed to close database.')
      }
    }
  })

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log(`New instance: ${commandLine}`)
  })
}

// Main lifecycle of the application
let argv = args.processCommandLineArguments(process.argv)
if (app != null) {
  let reuseZapInstance = args.reuseZapInstance
  let canProceedWithThisInstance
  let gotLock = app.requestSingleInstanceLock()

  if (reuseZapInstance) {
    canProceedWithThisInstance = gotLock
  } else {
    canProceedWithThisInstance = true
  }
  if (canProceedWithThisInstance) {
    hookAppEvents(argv)
  } else {
    // The 'second-instance' event on app was triggered, we need
    // to quit.
    console.log('🧐 Existing instance of zap will service this request.')
    app.quit()
  }
} else {
  // If the code is executed via 'node' and not via 'app', then this
  // is where we end up.
  startup.startUp(false, argv)
}

exports.loaded = true
