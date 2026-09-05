// Which engine the browser checks drive.
//
// Chromium by default, because it is the quickest to get hold of. But the
// phone this application is written for runs WebKit, and the things it leans
// on — IndexedDB, downloading a Blob, input type=date, the safe areas — are
// exactly where engines differ. A check that only ever ran on Chromium says
// nothing about the device it was built for.

import { chromium, webkit } from 'playwright'

const ENGINES = { chromium, webkit }

/**
 * The engine named by CHECK_BROWSER, and how to launch it.
 *
 * CHROMIUM_EXECUTABLE stays honoured, for a machine that already has one and
 * would rather not download another. It applies to Chromium only, which is
 * what its name says.
 */
export function engine(name = process.env.CHECK_BROWSER ?? 'chromium') {
  const type = ENGINES[name]
  if (type === undefined) {
    throw new Error(
      `CHECK_BROWSER is "${name}". It has to be one of: ${Object.keys(ENGINES).join(', ')}`,
    )
  }
  const executable = name === 'chromium' ? process.env.CHROMIUM_EXECUTABLE : undefined
  return {
    name,
    launch: () => type.launch(executable ? { executablePath: executable } : {}),
  }
}
